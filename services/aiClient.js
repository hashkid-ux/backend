// services/aiClient.js
// FIXED: Proper rate limit detection + key rotation

const axios = require('axios');
const crypto = require('crypto');

class AIClient {
  constructor(apiKey = null) {
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    this.keys = this.loadKeys();
    this.keyStats = new Map();
    this.initializeKeyStats();
    
    // CONSERVATIVE RATE LIMITING
    this.globalDelay = 3000; // 3s between ANY requests
    this.keySpecificDelay = 10000; // 10s between same key
    this.lastRequestTime = 0;
    
    // ENHANCED CACHING
    this.responseCache = new Map();
    this.requestDedup = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000;
    
    this.requestCount = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
  }

  loadKeys() {
    const keys = [];
    
    if (process.env.OPENROUTER_API_KEY) {
      const primaryKeys = process.env.OPENROUTER_API_KEY.split(',').map(k => k.trim()).filter(k => k);
      keys.push(...primaryKeys);
    }
    
    for (let i = 2; i <= 20; i++) {
      const key = process.env[`OPENROUTER_API_KEY_${i}`];
      if (key) {
        const parsedKeys = key.split(',').map(k => k.trim()).filter(k => k);
        keys.push(...parsedKeys);
      }
    }
    
    if (keys.length === 0) {
      throw new Error('❌ No API keys configured');
    }
    
    const validKeys = keys.filter(key => {
      if (!key.startsWith('sk-or-v1-')) {
        console.warn(`⚠️ Invalid key format: ${key.substring(0, 20)}...`);
        return false;
      }
      return true;
    });
    
    if (validKeys.length === 0) {
      throw new Error('❌ No valid API keys');
    }
    
    console.log(`🔑 Loaded ${validKeys.length} API key(s)`);
    return validKeys;
  }

  initializeKeyStats() {
    this.keys.forEach((key, index) => {
      this.keyStats.set(index, {
        healthy: true,
        requests: 0,
        errors: 0,
        lastUsed: 0,
        rateLimitUntil: 0, // Only set when ACTUAL 429 received
        consecutiveErrors: 0,
        last401: 0
      });
    });
  }

  getCacheKey(model, messages, maxTokens) {
    const content = messages.map(m => 
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('||');
    
    const hash = crypto.createHash('md5')
      .update(`${model}:${maxTokens}:${content}`)
      .digest('hex');
    
    return hash;
  }

  getHealthyKey() {
    const now = Date.now();
    let bestKey = null;
    let lowestUsage = Infinity;
    
    // Find least-used key that's not rate limited or invalid
    for (let i = 0; i < this.keys.length; i++) {
      const stats = this.keyStats.get(i);
      
      // Skip if ACTUALLY rate limited (has future cooldown)
      if (stats.rateLimitUntil > now) {
        const waitSec = Math.ceil((stats.rateLimitUntil - now) / 1000);
        console.log(`⏸️  Key ${i + 1} still cooling down (${waitSec}s left)`);
        continue;
      }
      
      // Skip if had recent 401 (invalid key)
      if (stats.last401 > 0 && (now - stats.last401) < 300000) {
        console.log(`🔒 Key ${i + 1} invalid (401 within 5min)`);
        continue;
      }
      
      // Skip if too many consecutive errors
      if (stats.consecutiveErrors >= 3) {
        console.log(`❌ Key ${i + 1} unhealthy (${stats.consecutiveErrors} errors)`);
        continue;
      }
      
      // Pick least used key
      if (stats.requests < lowestUsage) {
        lowestUsage = stats.requests;
        bestKey = i;
      }
    }
    
    // If all keys cooling down, wait for soonest
    if (bestKey === null) {
      let soonest = Infinity;
      let soonestKey = null;
      
      for (let i = 0; i < this.keys.length; i++) {
        const stats = this.keyStats.get(i);
        
        // Skip permanently invalid keys
        if (stats.last401 > 0 && (now - stats.last401) < 300000) continue;
        
        if (stats.rateLimitUntil < soonest) {
          soonest = stats.rateLimitUntil;
          soonestKey = i;
        }
      }
      
      if (soonestKey === null) {
        throw new Error('❌ All keys exhausted or invalid');
      }
      
      const waitTime = soonest - now;
      if (waitTime > 0) {
        console.log(`⏳ All keys cooling down. Waiting ${Math.ceil(waitTime/1000)}s for Key ${soonestKey + 1}...`);
      }
      
      return soonestKey;
    }
    
    console.log(`✅ Selected Key ${bestKey + 1} (used ${lowestUsage}x)`);
    return bestKey;
  }

  markKeyUsed(keyIndex, success = true, statusCode = null) {
    const stats = this.keyStats.get(keyIndex);
    stats.requests++;
    stats.lastUsed = Date.now();
    
    if (success) {
      stats.consecutiveErrors = 0;
    } else {
      stats.errors++;
      stats.consecutiveErrors++;
      
      if (statusCode === 401) {
        stats.last401 = Date.now();
        console.error(`🔐 Key ${keyIndex + 1} INVALID (401) - marking for 5min`);
      }
    }
  }

  markKeyRateLimited(keyIndex, cooldownMs = 180000) {
    const stats = this.keyStats.get(keyIndex);
    stats.rateLimitUntil = Date.now() + cooldownMs;
    console.log(`🚫 Key ${keyIndex + 1} ACTUALLY rate limited (429) - cooling ${cooldownMs/1000}s`);
  }

  messages = {
    create: (params) => this.createMessage(params)
  };

  async createMessage(params) {
    const cacheKey = this.getCacheKey(params.model, params.messages, params.max_tokens);
    
    // CHECK CACHE
    const cached = this.responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      this.cacheHits++;
      console.log(`💾 Cache hit #${this.cacheHits} (saved API call)`);
      return cached.response;
    }
    
    // CHECK DEDUP
    if (this.requestDedup.has(cacheKey)) {
      console.log(`⏳ Waiting for duplicate request...`);
      return await this.requestDedup.get(cacheKey);
    }
    
    const requestPromise = this._executeRequest(params, cacheKey);
    this.requestDedup.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      
      this.responseCache.set(cacheKey, {
        response: result,
        timestamp: Date.now()
      });
      
      return result;
    } finally {
      this.requestDedup.delete(cacheKey);
    }
  }

  async _executeRequest(params, cacheKey) {
    this.cacheMisses++;
    
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      try {
        // Get healthy key
        const keyIndex = this.getHealthyKey();
        const apiKey = this.keys[keyIndex];
        const keyStats = this.keyStats.get(keyIndex);
        
        // GLOBAL DELAY - prevent hammering
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.globalDelay) {
          const waitTime = this.globalDelay - timeSinceLastRequest;
          console.log(`⏳ Global cooldown: ${Math.ceil(waitTime/1000)}s...`);
          await this.sleep(waitTime);
        }
        
        // KEY-SPECIFIC DELAY - prevent same key spam
        const timeSinceKeyUsed = Date.now() - keyStats.lastUsed;
        if (timeSinceKeyUsed < this.keySpecificDelay) {
          const waitTime = this.keySpecificDelay - timeSinceKeyUsed;
          console.log(`⏳ Key ${keyIndex + 1} cooldown: ${Math.ceil(waitTime/1000)}s...`);
          await this.sleep(waitTime);
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
        
        console.log(`🤖 Request #${this.requestCount} | Key ${keyIndex + 1}/${this.keys.length} | Attempt ${attempt}/${maxAttempts}`);
        
        // MAKE THE ACTUAL REQUEST
        const response = await axios.post(
          `${this.baseURL}/chat/completions`,
          {
            model: params.model,
            max_tokens: params.max_tokens,
            temperature: params.temperature || 0.3,
            messages: params.messages
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
              'X-Title': 'Launch AI'
            },
            timeout: 120000 // 2min timeout
          }
        );
        
        // SUCCESS!
        this.markKeyUsed(keyIndex, true);
        
        const result = {
          content: [{ text: response.data.choices[0].message.content }],
          usage: response.data.usage
        };
        
        console.log(`✅ SUCCESS | Tokens: ${response.data.usage?.total_tokens || '?'} | Cache: ${this.cacheHits}/${this.cacheHits + this.cacheMisses}`);
        
        return result;
        
      } catch (error) {
        this.errorCount++;
        const status = error.response?.status;
        const errorMsg = error.response?.data?.error?.message || error.message;
        
        console.error(`❌ Error on attempt ${attempt}/${maxAttempts} | Status: ${status || 'Network'}`);
        console.error(`   Message: ${errorMsg}`);
        
        lastError = error;
        
        // HANDLE 401 - INVALID KEY
        if (status === 401) {
          const keyIndex = this.getHealthyKey(); // Gets the key that just failed
          this.markKeyUsed(keyIndex, false, 401);
          
          if (this.keys.length > 1 && attempt < maxAttempts) {
            console.log(`🔄 Switching to different key...`);
            await this.sleep(2000);
            continue; // Try next key immediately
          }
          
          throw new Error(`All API keys invalid (401)`);
        }
        
        // HANDLE 429 - ACTUAL RATE LIMIT
        if (status === 429) {
          const keyIndex = this.getHealthyKey();
          this.markKeyRateLimited(keyIndex, 180000); // 3min cooldown
          this.markKeyUsed(keyIndex, false, 429);
          
          console.log(`🚫 ACTUAL 429 rate limit on Key ${keyIndex + 1}`);
          
          if (attempt < maxAttempts) {
            const backoff = Math.min(30000 * Math.pow(2, attempt - 1), 120000);
            console.log(`⏳ Exponential backoff: ${backoff/1000}s...`);
            await this.sleep(backoff);
            continue; // Try different key after cooldown
          }
          
          throw new Error('Rate limit: All keys exhausted (429)');
        }
        
        // HANDLE 5XX - SERVER ERRORS
        if (status >= 500) {
          console.error(`⚠️ Server error ${status} - may be temporary`);
          
          if (attempt < maxAttempts) {
            const backoff = 10000 * attempt; // 10s, 20s, 30s
            console.log(`⏳ Server error backoff: ${backoff/1000}s...`);
            await this.sleep(backoff);
            continue;
          }
          
          throw new Error(`Server error: ${status}`);
        }
        
        // OTHER ERRORS - retry with backoff
        if (attempt < maxAttempts) {
          const backoff = 5000 * attempt;
          console.log(`⏳ Retry backoff: ${backoff/1000}s...`);
          await this.sleep(backoff);
          continue;
        }
        
        // Max attempts reached
        throw lastError;
      }
    }
    
    throw lastError || new Error('Request failed after max attempts');
  }

  getStats() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    
    const keyStatsSummary = [];
    this.keyStats.forEach((stats, index) => {
      const errorRate = stats.requests > 0 ? Math.round((stats.errors / stats.requests) * 100) : 0;
      const has401 = stats.last401 > 0 && (Date.now() - stats.last401) < 300000;
      const isRateLimited = stats.rateLimitUntil > Date.now();
      
      let status = '✅ Healthy';
      if (has401) status = '🔒 Invalid';
      else if (isRateLimited) status = `⏸️ Cooling (${Math.ceil((stats.rateLimitUntil - Date.now())/1000)}s)`;
      else if (stats.consecutiveErrors >= 3) status = '❌ Failed';
      
      keyStatsSummary.push({
        key: index + 1,
        requests: stats.requests,
        errors: stats.errors,
        errorRate: `${errorRate}%`,
        status
      });
    });
    
    return {
      uptime: `${uptime}s`,
      totalRequests: this.requestCount,
      errors: this.errorCount,
      errorRate: `${this.requestCount > 0 ? Math.round((this.errorCount / this.requestCount) * 100) : 0}%`,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: `${this.cacheHits + this.cacheMisses > 0 ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100) : 0}%`,
      tokensSaved: `~${this.cacheHits * 1000}`,
      keys: keyStatsSummary
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log('\n📊 AI CLIENT STATS');
    console.log('═'.repeat(50));
    console.log(`Requests: ${stats.totalRequests} (${stats.errors} errors)`);
    console.log(`Cache: ${stats.cacheHits}/${stats.cacheMisses} (${stats.cacheHitRate} hit rate)`);
    console.log(`Saved: ${stats.tokensSaved} tokens`);
    console.log('\nKeys:');
    stats.keys.forEach(key => {
      console.log(`  Key ${key.key}: ${key.requests} req | ${key.status}`);
    });
    console.log('═'.repeat(50) + '\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async create(params) {
    return this.createMessage(params);
  }
}

module.exports = AIClient;