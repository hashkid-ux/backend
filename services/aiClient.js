// services/aiClient.js
// 🚀 ULTRA AI CLIENT - Parallel Processing, Smart Load Balancing, Zero Downtime

const axios = require('axios');
const EventEmitter = require('events');

class APIKeyManager extends EventEmitter {
  constructor(apiKeysString) {
    super();
    
    this.keys = this.parseKeys(apiKeysString);
    this.currentIndex = 0;
    
    // Enhanced key tracking
    this.keyHealth = this.keys.map((key, index) => ({
      id: index + 1,
      key: this.maskKey(key),
      fullKey: key,
      
      // Stats
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      
      // Rate limiting (FIXED: More accurate tracking)
      rateLimitedUntil: 0,
      rateLimitCount: 0,
      lastRequestTime: 0,
      consecutiveRateLimits: 0, // NEW: Track consecutive limits
      
      // Health
      isHealthy: true,
      lastError: null,
      consecutiveErrors: 0,
      
      // Performance
      averageResponseTime: 0,
      responseTimes: [],
      
      // NEW: Predictive throttling
      requestsInLastMinute: 0,
      requestTimestamps: [],
      estimatedCapacity: 100 // Requests per minute estimate
    }));
    
    // Global settings (OPTIMIZED)
    this.minDelayBetweenRequests = 2000; // 2s (reduced from 3s)
    this.rateLimitCooldown = 90000; // 90s
    this.maxConsecutiveErrors = 3;
    this.healthCheckInterval = 60000; // Every minute
    
    // NEW: Parallel processing limits
    this.maxConcurrentRequests = Math.min(this.keys.length * 2, 12);
    this.activeRequests = 0;
    this.requestQueue = [];
    
    // NEW: Smart backoff
    this.adaptiveDelayEnabled = true;
    this.globalBackoffMultiplier = 1.0;
    
    this.startHealthMonitoring();
    this.startRequestCleaner();
    
    console.log(`🔑 API Key Manager Initialized:`);
    console.log(`   📊 Total Keys: ${this.keys.length}`);
    console.log(`   ⚡ Max Concurrent: ${this.maxConcurrentRequests}`);
    console.log(`   🎯 Strategy: Smart Parallel with Predictive Throttling`);
    console.log(`   🛡️ Rate Limit Protection: Enhanced`);
    console.log(`   🔄 Auto-Recovery: Enabled`);
    this.logKeyStatus();
  }

  parseKeys(keysString) {
    if (!keysString) {
      throw new Error('❌ No API keys provided!');
    }

    const keys = keysString
      .split(/[,;]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keys.length === 0) {
      throw new Error('❌ No valid API keys found');
    }

    return keys;
  }

  maskKey(key) {
    if (!key || key.length < 16) return '****';
    return `${key.substring(0, 12)}...`;
  }

  // NEW: Predictive throttling - check if key is near limit
  isPredictivelyThrottled(keyHealth) {
    const now = Date.now();
    
    // Clean old timestamps (older than 1 minute)
    keyHealth.requestTimestamps = keyHealth.requestTimestamps.filter(
      t => now - t < 60000
    );
    
    keyHealth.requestsInLastMinute = keyHealth.requestTimestamps.length;
    
    // If approaching capacity (80% of estimated), throttle
    if (keyHealth.requestsInLastMinute >= keyHealth.estimatedCapacity * 0.8) {
      return true;
    }
    
    // If consecutive rate limits, be more conservative
    if (keyHealth.consecutiveRateLimits > 0) {
      return keyHealth.requestsInLastMinute >= keyHealth.estimatedCapacity * 0.5;
    }
    
    return false;
  }

  // ENHANCED: Smart key selection with predictive throttling
  getNextAvailableKey(skipPredictiveCheck = false) {
    const now = Date.now();
    const totalKeys = this.keys.length;
    let attempts = 0;
    
    // Try each key once
    while (attempts < totalKeys) {
      const keyHealth = this.keyHealth[this.currentIndex];
      
      // Check rate limit
      if (keyHealth.rateLimitedUntil > now) {
        const waitTime = Math.ceil((keyHealth.rateLimitedUntil - now) / 1000);
        console.log(`⏭️ Key ${keyHealth.id} rate limited (${waitTime}s remaining)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        attempts++;
        continue;
      }
      
      // Check health
      if (!keyHealth.isHealthy) {
        console.log(`⏭️ Key ${keyHealth.id} unhealthy`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        attempts++;
        continue;
      }
      
      // NEW: Predictive throttling check
      if (!skipPredictiveCheck && this.isPredictivelyThrottled(keyHealth)) {
        console.log(`⏭️ Key ${keyHealth.id} predictively throttled (${keyHealth.requestsInLastMinute}/min)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        attempts++;
        continue;
      }
      
      // Check minimum delay (ADAPTIVE)
      const effectiveDelay = this.minDelayBetweenRequests * this.globalBackoffMultiplier;
      const timeSinceLastRequest = now - keyHealth.lastRequestTime;
      if (timeSinceLastRequest < effectiveDelay) {
        const waitTime = Math.ceil((effectiveDelay - timeSinceLastRequest) / 1000);
        console.log(`⏭️ Key ${keyHealth.id} cooling down (${waitTime}s)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        attempts++;
        continue;
      }
      
      // Key is available!
      const selectedIndex = this.currentIndex;
      const selectedKey = keyHealth.fullKey;
      
      // Update tracking
      keyHealth.lastRequestTime = now;
      keyHealth.totalRequests++;
      keyHealth.requestTimestamps.push(now);
      
      // Move to next
      this.currentIndex = (this.currentIndex + 1) % totalKeys;
      
      const successRate = keyHealth.totalRequests > 0 
        ? (keyHealth.successfulRequests / keyHealth.totalRequests * 100).toFixed(0)
        : 'N/A';
      
      console.log(`🔑 Using Key ${keyHealth.id} (${keyHealth.successfulRequests}/${keyHealth.totalRequests} = ${successRate}% success)`);
      
      return {
        key: selectedKey,
        index: selectedIndex,
        health: keyHealth
      };
    }
    
    // All keys unavailable
    console.warn(`⚠️ All ${totalKeys} keys unavailable, finding best option...`);
    return this.findLeastBadKey(now);
  }

  findLeastBadKey(now) {
    const sorted = [...this.keyHealth].sort((a, b) => {
      // Healthy first
      if (a.isHealthy && !b.isHealthy) return -1;
      if (!a.isHealthy && b.isHealthy) return 1;
      
      // Not rate limited
      const aLimited = a.rateLimitedUntil > now;
      const bLimited = b.rateLimitedUntil > now;
      if (!aLimited && bLimited) return -1;
      if (aLimited && !bLimited) return 1;
      
      // Soonest recovery
      if (aLimited && bLimited) {
        return a.rateLimitedUntil - b.rateLimitedUntil;
      }
      
      // Least recently used
      return a.lastRequestTime - b.lastRequestTime;
    });

    const bestKey = sorted[0];
    const index = this.keyHealth.indexOf(bestKey);
    
    if (bestKey.rateLimitedUntil > now) {
      const waitTime = bestKey.rateLimitedUntil - now;
      console.warn(`⏳ Best available key ${bestKey.id} rate limited. Waiting ${Math.ceil(waitTime/1000)}s...`);
      return {
        key: bestKey.fullKey,
        index,
        health: bestKey,
        waitTime
      };
    }
    
    console.warn(`⚠️ Using fallback key ${bestKey.id}`);
    return {
      key: bestKey.fullKey,
      index,
      health: bestKey
    };
  }

  // ENHANCED: Rate limit tracking with adaptive backoff
  markRateLimited(index, cooldownMs = null) {
    const keyHealth = this.keyHealth[index];
    const cooldown = cooldownMs || this.rateLimitCooldown;
    
    keyHealth.rateLimitedUntil = Date.now() + cooldown;
    keyHealth.rateLimitCount++;
    keyHealth.failedRequests++;
    keyHealth.consecutiveRateLimits++;
    
    // Adjust estimated capacity DOWN
    keyHealth.estimatedCapacity = Math.max(10, keyHealth.estimatedCapacity * 0.8);
    
    // Increase global backoff if many keys are limited
    const limitedCount = this.keyHealth.filter(k => k.rateLimitedUntil > Date.now()).length;
    if (limitedCount > this.keys.length * 0.5) {
      this.globalBackoffMultiplier = Math.min(3.0, this.globalBackoffMultiplier * 1.2);
      console.warn(`⚠️ Global backoff increased to ${this.globalBackoffMultiplier.toFixed(2)}x`);
    }
    
    const until = new Date(keyHealth.rateLimitedUntil).toLocaleTimeString();
    console.error(`🚫 Key ${keyHealth.id} RATE LIMITED until ${until}`);
    
    this.emit('rateLimited', { keyId: keyHealth.id, until });
  }

  markSuccess(index, responseTimeMs) {
    const keyHealth = this.keyHealth[index];
    
    keyHealth.successfulRequests++;
    keyHealth.consecutiveErrors = 0;
    keyHealth.consecutiveRateLimits = 0; // Reset on success
    
    // Adjust estimated capacity UP slightly
    keyHealth.estimatedCapacity = Math.min(120, keyHealth.estimatedCapacity * 1.05);
    
    // Track response time
    keyHealth.responseTimes.push(responseTimeMs);
    if (keyHealth.responseTimes.length > 10) {
      keyHealth.responseTimes.shift();
    }
    keyHealth.averageResponseTime = 
      keyHealth.responseTimes.reduce((a, b) => a + b, 0) / keyHealth.responseTimes.length;
    
    // Mark healthy
    if (!keyHealth.isHealthy) {
      keyHealth.isHealthy = true;
      console.log(`✅ Key ${keyHealth.id} recovered`);
      this.emit('keyRecovered', { keyId: keyHealth.id });
    }
    
    // Reduce global backoff on success
    if (this.globalBackoffMultiplier > 1.0) {
      this.globalBackoffMultiplier = Math.max(1.0, this.globalBackoffMultiplier * 0.95);
    }
  }

  markFailure(index, error) {
    const keyHealth = this.keyHealth[index];
    
    keyHealth.failedRequests++;
    keyHealth.consecutiveErrors++;
    keyHealth.lastError = error.message;
    
    if (keyHealth.consecutiveErrors >= this.maxConsecutiveErrors) {
      keyHealth.isHealthy = false;
      console.error(`❌ Key ${keyHealth.id} marked UNHEALTHY`);
      this.emit('keyUnhealthy', { keyId: keyHealth.id, error: error.message });
    }
  }

  // NEW: Clean old request timestamps
  startRequestCleaner() {
    setInterval(() => {
      const now = Date.now();
      this.keyHealth.forEach(key => {
        key.requestTimestamps = key.requestTimestamps.filter(
          t => now - t < 60000
        );
        key.requestsInLastMinute = key.requestTimestamps.length;
      });
    }, 10000); // Every 10 seconds
  }

  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  performHealthCheck() {
    const now = Date.now();
    let healthyKeys = 0;
    let rateLimitedKeys = 0;
    let unhealthyKeys = 0;
    
    this.keyHealth.forEach(key => {
      // Auto-recover from rate limits
      if (key.rateLimitedUntil > 0 && key.rateLimitedUntil < now) {
        key.rateLimitedUntil = 0;
        key.consecutiveRateLimits = 0;
        console.log(`🔄 Key ${key.id} recovered from rate limit`);
      }
      
      // Auto-recover from errors
      if (!key.isHealthy && now - key.lastRequestTime > 300000) {
        key.isHealthy = true;
        key.consecutiveErrors = 0;
        console.log(`🔄 Key ${key.id} auto-recovered`);
      }
      
      // Count
      if (key.rateLimitedUntil > now) rateLimitedKeys++;
      else if (!key.isHealthy) unhealthyKeys++;
      else healthyKeys++;
    });
    
    console.log(`📊 Health Check: ${healthyKeys} healthy, ${rateLimitedKeys} rate limited, ${unhealthyKeys} unhealthy`);
    
    if (healthyKeys === 0) {
      console.error('🚨 CRITICAL: No healthy keys!');
      this.emit('allKeysUnhealthy');
    }
  }

  logKeyStatus() {
    console.log('📊 Key Status:');
    this.keyHealth.forEach(key => {
      const status = key.rateLimitedUntil > Date.now() ? '🚫 Rate Limited' :
                     !key.isHealthy ? '❌ Unhealthy' :
                     '✅ Healthy';
      console.log(`   Key ${key.id}: ${status} | ${key.successfulRequests}/${key.totalRequests} success`);
    });
  }

  getStats() {
    const now = Date.now();
    return this.keyHealth.map(key => ({
      id: key.id,
      masked: key.key,
      status: key.rateLimitedUntil > now ? 'rate_limited' :
              !key.isHealthy ? 'unhealthy' : 'healthy',
      totalRequests: key.totalRequests,
      successRate: key.totalRequests > 0 
        ? `${Math.round(key.successfulRequests / key.totalRequests * 100)}%` 
        : 'N/A',
      avgResponseTime: `${Math.round(key.averageResponseTime)}ms`,
      requestsPerMin: key.requestsInLastMinute,
      capacity: key.estimatedCapacity
    }));
  }
}

class AIClient {
  constructor(apiKey) {
    this.keyManager = new APIKeyManager(
      apiKey || process.env.OPENROUTER_API_KEY
    );
    
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    
    // Event listeners
    this.keyManager.on('rateLimited', (data) => {
      console.warn(`⚠️ Rate limit event: Key ${data.keyId} limited until ${data.until}`);
    });
    
    this.keyManager.on('keyUnhealthy', (data) => {
      console.error(`⚠️ Unhealthy key: Key ${data.keyId}`);
    });
    
    this.keyManager.on('allKeysUnhealthy', () => {
      console.error('🚨 CRITICAL: All keys unhealthy!');
    });
    
    console.log('✅ AIClient initialized with multi-key support');
  }

  get messages() {
    return {
      create: async (params) => {
        const maxRetries = this.keyManager.keys.length * 2;
        let attempt = 0;
        let lastError = null;

        while (attempt < maxRetries) {
          try {
            attempt++;
            console.log(`   Attempt ${attempt}/${maxRetries}...`);
            
            const keyInfo = this.keyManager.getNextAvailableKey();
            
            if (keyInfo.waitTime) {
              console.log(`⏳ Waiting ${Math.ceil(keyInfo.waitTime/1000)}s...`);
              await this.sleep(keyInfo.waitTime);
            }
            
            const startTime = Date.now();
            const result = await this.makeRequest(params, keyInfo);
            const responseTime = Date.now() - startTime;
            
            this.keyManager.markSuccess(keyInfo.index, responseTime);
            
            console.log(`✅ Request succeeded with Key ${keyInfo.health.id} in ${responseTime}ms`);
            return result;
            
          } catch (error) {
            lastError = error;
            
            const currentIndex = this.keyManager.currentIndex === 0 
              ? this.keyManager.keys.length - 1 
              : this.keyManager.currentIndex - 1;
            
            const status = error.response?.status;
            const isRateLimit = status === 429 || 
                               error.message?.includes('429') ||
                               error.message?.includes('rate limit');
            
            if (isRateLimit) {
              const retryAfter = error.response?.headers['retry-after'];
              const cooldown = retryAfter ? parseInt(retryAfter) * 1000 : null;
              
              this.keyManager.markRateLimited(currentIndex, cooldown);
              console.error(`❌ Rate limit (attempt ${attempt}/${maxRetries})`);
              continue;
            }
            
            this.keyManager.markFailure(currentIndex, error);
            console.error(`❌ Request failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
            
            await this.sleep(2000 * attempt);
          }
        }

        throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
      }
    };
  }

  async makeRequest(params, keyInfo) {
    const openRouterRequest = {
      model: params.model || this.model,
      messages: params.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: params.max_tokens || 4000,
      temperature: params.temperature || 0.7,
      stream: false
    };

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      openRouterRequest,
      {
        headers: {
          'Authorization': `Bearer ${keyInfo.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:5000',
          'X-Title': 'Launch AI'
        },
        timeout: 120000, // 2 minutes
        validateStatus: (status) => status < 500
      }
    );

    if (response.status !== 200) {
      const error = new Error(
        response.data?.error?.message || 
        `Request failed with status ${response.status}`
      );
      error.response = response;
      error.status = response.status;
      throw error;
    }

    return {
      content: [{
        type: 'text',
        text: response.data.choices[0].message.content
      }],
      id: response.data.id,
      model: response.data.model,
      role: 'assistant',
      stop_reason: 'end_turn'
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getKeyStats() {
    return this.keyManager.getStats();
  }

  logStatus() {
    this.keyManager.logKeyStatus();
  }
}

module.exports = AIClient;