// services/aiClient.js
// SMART ROTATION: Maximize free tier by spreading load across time

const axios = require('axios');
const crypto = require('crypto');

class AIClient {
  constructor(apiKey = null) {
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    this.keys = this.loadKeys();
    this.keyStats = new Map();
    this.initializeKeyStats();
    
    // ULTRA-CONSERVATIVE for free tier
    this.globalDelay = 4500; // 4.5s = ~13 calls/min (under 15/min limit)
    this.keySpecificDelay = 0; // No per-key delay (IP limit is shared anyway)
    this.lastRequestTime = 0;
    this.lastKeyUsed = -1;
    
    // Smart retry logic
    this.maxConsecutive429 = 2; // Switch keys after 2 consecutive 429s
    this.consecutive429Count = 0;
    
    // CACHING
    this.responseCache = new Map();
    this.requestDedup = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000;
    
    this.requestCount = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
    
    console.log(`🔑 Loaded ${this.keys.length} keys | Mode: Smart Rotation`);
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
    
    const validKeys = keys.filter(key => key.startsWith('sk-or-v1-'));
    
    if (validKeys.length === 0) {
      throw new Error('❌ No valid API keys');
    }
    
    return validKeys;
  }

  initializeKeyStats() {
    this.keys.forEach((key, index) => {
      this.keyStats.set(index, {
        requests: 0,
        errors: 0,
        last429: 0,
        consecutiveErrors: 0
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

  // SMART: Round-robin with 429 awareness
  getNextKey() {
    const now = Date.now();
    
    // Round-robin through all keys
    let nextIndex = (this.lastKeyUsed + 1) % this.keys.length;
    
    // Skip if this key had recent 429 (within 60s)
    let attempts = 0;
    while (attempts < this.keys.length) {
      const stats = this.keyStats.get(nextIndex);
      
      if (stats.last429 > 0 && (now - stats.last429) < 60000) {
        console.log(`⏭️  Skipping Key ${nextIndex + 1} (429 within 60s)`);
        nextIndex = (nextIndex + 1) % this.keys.length;
        attempts++;
      } else {
        break;
      }
    }
    
    this.lastKeyUsed = nextIndex;
    console.log(`🔑 Using Key ${nextIndex + 1}/${this.keys.length} (rotation)`);
    return nextIndex;
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
      console.log(`💾 Cache hit #${this.cacheHits}`);
      return cached.response;
    }
    
    // CHECK DEDUP
    if (this.requestDedup.has(cacheKey)) {
      console.log(`⏳ Waiting for duplicate...`);
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
    
    const maxAttempts = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // GLOBAL DELAY (most important for free tier)
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.globalDelay) {
          const waitTime = this.globalDelay - timeSinceLastRequest;
          console.log(`⏳ Rate limit protection: ${Math.ceil(waitTime/1000)}s...`);
          await this.sleep(waitTime);
        }
        
        // Get next key (round-robin)
        const keyIndex = this.getNextKey();
        const apiKey = this.keys[keyIndex];
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
        
        console.log(`🤖 Request #${this.requestCount} | Attempt ${attempt}/${maxAttempts}`);
        
        // MAKE REQUEST
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
            timeout: 120000
          }
        );
        
        // SUCCESS
        this.keyStats.get(keyIndex).requests++;
        this.keyStats.get(keyIndex).consecutiveErrors = 0;
        this.consecutive429Count = 0; // Reset global 429 counter
        
        const result = {
          content: [{ text: response.data.choices[0].message.content }],
          usage: response.data.usage
        };
        
        console.log(`✅ SUCCESS | Tokens: ${response.data.usage?.total_tokens || '?'}`);
        
        return result;
        
      } catch (error) {
        this.errorCount++;
        const status = error.response?.status;
        const errorMsg = error.response?.data?.error?.message || error.message;
        
        console.error(`❌ Attempt ${attempt}/${maxAttempts} | Status: ${status || 'Network'}`);
        
        lastError = error;
        
        // HANDLE 429
        if (status === 429) {
          const keyIndex = this.lastKeyUsed;
          this.keyStats.get(keyIndex).last429 = Date.now();
          this.consecutive429Count++;
          
          console.log(`🚫 Rate limit (429) on Key ${keyIndex + 1}`);
          
          // If we've hit 429 multiple times in a row, wait longer
          if (this.consecutive429Count >= this.maxConsecutive429) {
            const longWait = 45000; // 45s wait after persistent 429s
            console.log(`⏳ PERSISTENT rate limits - waiting ${longWait/1000}s...`);
            await this.sleep(longWait);
            this.consecutive429Count = 0; // Reset after long wait
          } else if (attempt < maxAttempts) {
            const backoff = 20000 * attempt; // 20s, 40s
            console.log(`⏳ Backoff: ${backoff/1000}s...`);
            await this.sleep(backoff);
          }
          
          if (attempt < maxAttempts) continue;
          throw new Error('Rate limit: Max attempts reached');
        }
        
        // HANDLE 401
        if (status === 401) {
          console.error(`🔒 Key ${this.lastKeyUsed + 1} invalid (401)`);
          
          if (this.keys.length > 1 && attempt < maxAttempts) {
            console.log(`🔄 Switching to next key...`);
            await this.sleep(2000);
            continue;
          }
          
          throw new Error('All keys invalid (401)');
        }
        
        // HANDLE 5XX
        if (status >= 500) {
          console.error(`⚠️ Server error ${status}`);
          
          if (attempt < maxAttempts) {
            const backoff = 10000 * attempt;
            console.log(`⏳ Server backoff: ${backoff/1000}s...`);
            await this.sleep(backoff);
            continue;
          }
        }
        
        // OTHER ERRORS
        if (attempt < maxAttempts) {
          const backoff = 5000 * attempt;
          console.log(`⏳ Retry backoff: ${backoff/1000}s...`);
          await this.sleep(backoff);
          continue;
        }
        
        throw lastError;
      }
    }
    
    throw lastError || new Error('Request failed');
  }

  getStats() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    
    const keyStatsSummary = [];
    this.keyStats.forEach((stats, index) => {
      const has429 = stats.last429 > 0 && (Date.now() - stats.last429) < 60000;
      
      keyStatsSummary.push({
        key: index + 1,
        requests: stats.requests,
        errors: stats.errors,
        status: has429 ? '⏸️ Cooling' : '✅ Ready'
      });
    });
    
    const requestsPerMin = this.requestCount / (uptime / 60);
    
    return {
      uptime: `${uptime}s`,
      totalRequests: this.requestCount,
      requestsPerMin: requestsPerMin.toFixed(1),
      errors: this.errorCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: `${this.cacheHits + this.cacheMisses > 0 ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100) : 0}%`,
      keys: keyStatsSummary
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log('\n📊 AI CLIENT STATS');
    console.log('═'.repeat(50));
    console.log(`Requests: ${stats.totalRequests} (${stats.requestsPerMin}/min avg)`);
    console.log(`Cache: ${stats.cacheHits}/${stats.cacheMisses} (${stats.cacheHitRate})`);
    console.log(`Errors: ${stats.errors}`);
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