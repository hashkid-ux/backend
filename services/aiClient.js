// services/aiClient.js
// PRODUCTION-GRADE AI CLIENT - Fixed Multi-Key Management

const axios = require('axios');

class AIClient {
  constructor(apiKey = null) {
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    // MULTI-KEY MANAGEMENT - FIXED
    this.keys = this.loadKeys();
    this.keyStats = new Map();
    this.initializeKeyStats();
    
    // RATE LIMITING - CONSERVATIVE
    this.requestQueue = [];
    this.processing = false;
    this.globalDelay = 2000; // 2s between ALL requests
    this.lastRequestTime = 0;
    
    // TOKEN CONSERVATION
    this.tokenCache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // CLEAN LOGGING
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  loadKeys() {
    const keys = [];
    
    // Load primary key and parse if comma-separated
    if (process.env.OPENROUTER_API_KEY) {
      const primaryKeys = process.env.OPENROUTER_API_KEY.split(',').map(k => k.trim()).filter(k => k);
      keys.push(...primaryKeys);
    }
    
    // Load backup keys (OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3, etc)
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
    
    // Validate key format
    const validKeys = keys.filter(key => {
      if (!key.startsWith('sk-or-v1-')) {
        console.warn(`⚠️ Invalid key format (skipping): ${key.substring(0, 20)}...`);
        return false;
      }
      return true;
    });
    
    if (validKeys.length === 0) {
      throw new Error('❌ No valid API keys found (must start with sk-or-v1-)');
    }
    
    console.log(`🔑 Loaded ${validKeys.length} valid API key(s)`);
    return validKeys;
  }

  initializeKeyStats() {
    this.keys.forEach((key, index) => {
      this.keyStats.set(index, {
        healthy: true,
        requests: 0,
        errors: 0,
        lastUsed: 0,
        rateLimitUntil: 0,
        consecutiveErrors: 0,
        last401: 0 // Track 401 errors separately
      });
    });
  }

  // SMART KEY SELECTION WITH ROUND-ROBIN + HEALTH CHECK
  getHealthyKey() {
    const now = Date.now();
    let bestKey = null;
    let lowestUsage = Infinity;
    
    console.log(`🔄 Selecting key from ${this.keys.length} available keys...`);
    
    // ROUND 1: Find healthy keys with lowest usage
    for (let i = 0; i < this.keys.length; i++) {
      const stats = this.keyStats.get(i);
      
      // Skip if rate limited
      if (stats.rateLimitUntil > now) {
        console.log(`  ⏭️ Key ${i + 1}: Rate limited (${Math.ceil((stats.rateLimitUntil - now)/1000)}s left)`);
        continue;
      }
      
      // Skip if too many consecutive errors
      if (stats.consecutiveErrors >= 3) {
        console.log(`  ⏭️ Key ${i + 1}: Too many errors (${stats.consecutiveErrors})`);
        continue;
      }
      
      // Skip if recent 401 error (invalid key)
      if (stats.last401 > 0 && (now - stats.last401) < 300000) { // 5 min cooldown
        console.log(`  ⏭️ Key ${i + 1}: Invalid/expired (401 error)`);
        continue;
      }
      
      // This key is healthy - prefer least used
      if (stats.requests < lowestUsage) {
        lowestUsage = stats.requests;
        bestKey = i;
      }
    }
    
    // ROUND 2: If no healthy keys, find one that will recover soonest
    if (bestKey === null) {
      console.log(`  ⚠️ No healthy keys available, finding fastest recovery...`);
      let soonest = Infinity;
      
      for (let i = 0; i < this.keys.length; i++) {
        const stats = this.keyStats.get(i);
        
        // Skip permanently invalid keys (recent 401)
        if (stats.last401 > 0 && (now - stats.last401) < 300000) {
          continue;
        }
        
        if (stats.rateLimitUntil < soonest) {
          soonest = stats.rateLimitUntil;
          bestKey = i;
        }
      }
      
      if (bestKey === null) {
        throw new Error('❌ All keys exhausted or invalid');
      }
      
      const waitTime = Math.max(0, this.keyStats.get(bestKey).rateLimitUntil - now);
      if (waitTime > 0) {
        console.log(`  ⏳ Waiting ${Math.ceil(waitTime/1000)}s for Key ${bestKey + 1} to recover...`);
        // Don't actually wait here - let the caller handle it
      }
    }
    
    console.log(`  ✅ Selected Key ${bestKey + 1} (used ${this.keyStats.get(bestKey).requests} times)`);
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
      
      // Track 401 errors (invalid/expired keys)
      if (statusCode === 401) {
        stats.last401 = Date.now();
        console.error(`🔐 Key ${keyIndex + 1} got 401 - may be invalid/expired`);
      }
    }
  }

  markKeyRateLimited(keyIndex, cooldownMs = 60000) {
    const stats = this.keyStats.get(keyIndex);
    stats.rateLimitUntil = Date.now() + cooldownMs;
    console.log(`🚫 Key ${keyIndex + 1} rate limited (recovers in ${cooldownMs/1000}s)`);
  }

  // TOKEN CONSERVATION - CACHE IDENTICAL PROMPTS
  getCacheKey(model, messages) {
    const content = messages.map(m => m.content).join('||');
    return `${model}:${content.substring(0, 200)}`;
  }

  // Messages API
  messages = {
    create: (params) => {
      return this.createMessage(params);
    }
  };

  async createMessage(params) {
    const cacheKey = this.getCacheKey(params.model, params.messages);
    
    // CHECK CACHE
    if (this.tokenCache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.tokenCache.get(cacheKey);
      console.log(`💾 Cache hit (${this.cacheHits} hits, saved ~${this.cacheHits * 1000} tokens)`);
      return cached;
    }
    
    this.cacheMisses++;
    
    // RATE LIMITING - GLOBAL DELAY
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.globalDelay) {
      const waitTime = this.globalDelay - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    // GET HEALTHY KEY
    const keyIndex = this.getHealthyKey();
    const apiKey = this.keys[keyIndex]; // SINGLE KEY, not concatenated
    
    // WAIT IF KEY RECENTLY USED
    const keyStats = this.keyStats.get(keyIndex);
    const timeSinceKeyUsed = now - keyStats.lastUsed;
    if (timeSinceKeyUsed < 1000) {
      await this.sleep(1000 - timeSinceKeyUsed);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
    
    // CLEAN LOG - SINGLE LINE
    console.log(`🤖 AI Request #${this.requestCount} | Key ${keyIndex + 1}/${this.keys.length} | Model: ${params.model} | Tokens: ${params.max_tokens}`);
    
    try {
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
            'Authorization': `Bearer ${apiKey}`, // CRITICAL: Single key only
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'Launch AI'
          },
          timeout: 60000
        }
      );
      
      this.markKeyUsed(keyIndex, true);
      
      // CACHE RESPONSE
      const result = {
        content: [{ text: response.data.choices[0].message.content }],
        usage: response.data.usage
      };
      
      this.tokenCache.set(cacheKey, result);
      
      // CLEAN SUCCESS LOG
      console.log(`✅ Success | Used: ${response.data.usage?.total_tokens || '?'} tokens | Cache: ${this.cacheHits}/${this.cacheHits + this.cacheMisses}`);
      
      return result;
      
    } catch (error) {
      this.errorCount++;
      const status = error.response?.status;
      
      this.markKeyUsed(keyIndex, false, status);
      
      // HANDLE 401 UNAUTHORIZED (Invalid/Expired Key)
      if (status === 401) {
        console.error(`❌ 401 Unauthorized | Key ${keyIndex + 1} | ${error.response?.data?.error?.message || 'Invalid API key'}`);
        
        // Retry with different key if available
        if (this.keys.length > 1 && keyStats.consecutiveErrors < 3) {
          console.log(`🔄 Retrying with different key...`);
          await this.sleep(1000);
          return this.createMessage(params);
        }
        
        throw new Error(`API Key Error: ${error.response?.data?.error?.message || 'All keys invalid/expired'}`);
      }
      
      // HANDLE 429 RATE LIMIT
      if (status === 429) {
        this.markKeyRateLimited(keyIndex, 120000); // 2 min cooldown
        console.error(`⚠️ Rate limit | Key ${keyIndex + 1} | Retrying with different key...`);
        
        // Retry with different key if available
        if (this.keys.length > 1) {
          await this.sleep(3000);
          return this.createMessage(params);
        }
        
        throw new Error('Rate limit: All keys exhausted');
      }
      
      // HANDLE 500/502/503 SERVER ERRORS
      if (status >= 500) {
        console.error(`❌ Server error ${status} | Key ${keyIndex + 1}`);
        throw new Error(`Server error: ${status}`);
      }
      
      // OTHER ERRORS
      console.error(`❌ Request failed | Status: ${status || 'Network'} | Key ${keyIndex + 1} | ${error.message}`);
      throw error;
    }
  }

  // STATS SUMMARY
  getStats() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    
    const keyStatsSummary = [];
    this.keyStats.forEach((stats, index) => {
      const errorRate = stats.requests > 0 ? Math.round((stats.errors / stats.requests) * 100) : 0;
      const has401 = stats.last401 > 0;
      keyStatsSummary.push({
        key: index + 1,
        requests: stats.requests,
        errors: stats.errors,
        errorRate: `${errorRate}%`,
        healthy: stats.consecutiveErrors < 3 && !has401,
        status: has401 ? '🔐 Invalid' : (stats.consecutiveErrors >= 3 ? '❌ Failed' : '✅ Healthy')
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
    console.log(`Uptime: ${stats.uptime}`);
    console.log(`Total Requests: ${stats.totalRequests} (${stats.errors} errors, ${stats.errorRate})`);
    console.log(`Cache: ${stats.cacheHits} hits / ${stats.cacheMisses} misses (${stats.cacheHitRate} hit rate)`);
    console.log(`Tokens Saved: ${stats.tokensSaved}`);
    console.log('\nKey Health:');
    stats.keys.forEach(key => {
      console.log(`  Key ${key.key}: ${key.requests} req, ${key.errors} err (${key.errorRate}) ${key.status}`);
    });
    console.log('═'.repeat(50) + '\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // BACKWARD COMPATIBILITY
  async create(params) {
    return this.createMessage(params);
  }
}

module.exports = AIClient;