// services/aiClient.js
// 🚀 ULTRA AI CLIENT - BULLETPROOF VERSION
// Fixed: Rate limiting, success tracking, JSON parsing, error handling

const axios = require('axios');
const EventEmitter = require('events');

class APIKeyManager extends EventEmitter {
  constructor(apiKeysString) {
    super();
    
    this.keys = this.parseKeys(apiKeysString);
    this.currentIndex = 0;
    this.lastHealthState = '';
    
    // Enhanced key tracking with FIXED success tracking
    this.keyHealth = this.keys.map((key, index) => ({
      id: index + 1,
      key: this.maskKey(key),
      fullKey: key,
      
      // Stats - FIXED: Properly increment on success
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      
      // Rate limiting - CONSERVATIVE DEFAULTS
      rateLimitedUntil: 0,
      rateLimitCount: 0,
      lastRequestTime: 0,
      consecutiveRateLimits: 0,
      
      // Health
      isHealthy: true,
      lastError: null,
      consecutiveErrors: 0,
      
      // Performance
      averageResponseTime: 0,
      responseTimes: [],
      
      // Predictive throttling
      requestsInLastMinute: 0,
      requestTimestamps: [],
      estimatedCapacity: 40 // CONSERVATIVE: 40 req/min (was 100)
    }));
    
    // CONSERVATIVE SETTINGS - Key to preventing rate limits
    this.minDelayBetweenRequests = 5000; // 5s (was 2s) - CRITICAL FIX
    this.rateLimitCooldown = 120000; // 2min (was 90s)
    this.maxConsecutiveErrors = 3;
    this.healthCheckInterval = 30000; // 30s
    
    // Parallel limits - REDUCED for safety
    this.maxConcurrentRequests = Math.min(this.keys.length, 6); // Max 6 concurrent
    this.activeRequests = 0;
    
    // Smart backoff
    this.adaptiveDelayEnabled = true;
    this.globalBackoffMultiplier = 1.5; // Start conservative
    
    // Global request tracking - CRITICAL for preventing cascading failures
    this.globalLastRequestTime = 0;
    this.globalMinDelay = 3000; // 3s between ANY requests
    
    this.startHealthMonitoring();
    this.startRequestCleaner();
    
    console.log(`🔑 API Key Manager Initialized (BULLETPROOF):`);
    console.log(`   📊 Total Keys: ${this.keys.length}`);
    console.log(`   ⚡ Max Concurrent: ${this.maxConcurrentRequests}`);
    console.log(`   🎯 Strategy: Conservative + Predictive`);
    console.log(`   ⏱️ Min Delay: ${this.minDelayBetweenRequests}ms per key`);
    console.log(`   🌍 Global Delay: ${this.globalMinDelay}ms between all requests`);
    console.log(`   🛡️ Rate Limit Protection: Maximum`);
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

    console.log(`✅ Loaded ${keys.length} API keys`);
    return keys;
  }

  maskKey(key) {
    if (!key || key.length < 16) return '****';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }

  // ENHANCED: Predictive throttling with conservative limits
  isPredictivelyThrottled(keyHealth) {
    const now = Date.now();
    
    // Clean old timestamps
    keyHealth.requestTimestamps = keyHealth.requestTimestamps.filter(
      t => now - t < 60000
    );
    
    keyHealth.requestsInLastMinute = keyHealth.requestTimestamps.length;
    
    // CONSERVATIVE: Throttle at 60% capacity (was 80%)
    if (keyHealth.requestsInLastMinute >= keyHealth.estimatedCapacity * 0.6) {
      return true;
    }
    
    // If ANY recent rate limits, be VERY conservative
    if (keyHealth.consecutiveRateLimits > 0) {
      return keyHealth.requestsInLastMinute >= keyHealth.estimatedCapacity * 0.3;
    }
    
    return false;
  }

  // BULLETPROOF: Smart key selection with global throttling
  async getNextAvailableKey() {
    const now = Date.now();
    const totalKeys = this.keys.length;

    // ← ADD: Emergency brake
  const availableKeys = this.keyHealth.filter(k => 
    k.isHealthy && 
    k.rateLimitedUntil < now &&
    k.requestsInLastMinute < k.estimatedCapacity * 0.8
  );
  
  if (availableKeys.length === 0) {
    console.warn('⚠️ ALL KEYS EXHAUSTED - forcing 300s cooldown');
    await this.sleep(300000);
    // Reset counters
    this.keyHealth.forEach(k => k.requestsInLastMinute = 0);
  }
    
    // CRITICAL: Global rate limiting across ALL keys
    const timeSinceGlobalRequest = now - this.globalLastRequestTime;
    if (timeSinceGlobalRequest < this.globalMinDelay) {
      const waitTime = this.globalMinDelay - timeSinceGlobalRequest;
      console.log(`⏳ Global throttle: waiting ${Math.ceil(waitTime/1000)}s`);
      await this.sleep(waitTime);
    }
    
    let attempts = 0;
    
    while (attempts < totalKeys * 2) {
      const keyHealth = this.keyHealth[this.currentIndex];
      attempts++;
      
      // Check rate limit
      if (keyHealth.rateLimitedUntil > now) {
        const waitTime = Math.ceil((keyHealth.rateLimitedUntil - now) / 1000);
        console.log(`⏭️ Key ${keyHealth.id} rate limited (${waitTime}s remaining)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        continue;
      }
      
      // Check health
      if (!keyHealth.isHealthy) {
        console.log(`⏭️ Key ${keyHealth.id} unhealthy (${keyHealth.consecutiveErrors} errors)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        continue;
      }
      
      // Predictive throttling
      if (this.isPredictivelyThrottled(keyHealth)) {
        console.log(`⏭️ Key ${keyHealth.id} predictively throttled (${keyHealth.requestsInLastMinute}/${keyHealth.estimatedCapacity} per min)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        continue;
      }
      
      // Per-key delay with adaptive backoff
      const effectiveDelay = this.minDelayBetweenRequests * this.globalBackoffMultiplier;
      const timeSinceLastRequest = now - keyHealth.lastRequestTime;
      if (timeSinceLastRequest < effectiveDelay) {
        const waitTime = Math.ceil((effectiveDelay - timeSinceLastRequest) / 1000);
        console.log(`⏭️ Key ${keyHealth.id} cooling down (${waitTime}s)`);
        this.currentIndex = (this.currentIndex + 1) % totalKeys;
        continue;
      }
      
      // Key is available!
      const selectedIndex = this.currentIndex;
      const selectedKey = keyHealth.fullKey;
      
      // Update tracking
      keyHealth.lastRequestTime = now;
      keyHealth.totalRequests++;
      keyHealth.requestTimestamps.push(now);
      this.globalLastRequestTime = now;
      
      // Move to next
      this.currentIndex = (this.currentIndex + 1) % totalKeys;
      
      const successRate = keyHealth.totalRequests > 0 
        ? Math.round((keyHealth.successfulRequests / keyHealth.totalRequests) * 100)
        : 0;
      
      console.log(`🔑 Using Key ${keyHealth.id} (${keyHealth.successfulRequests}/${keyHealth.totalRequests} = ${successRate}% success) [Backoff: ${this.globalBackoffMultiplier.toFixed(2)}x]`);
      
      return {
        key: selectedKey,
        index: selectedIndex,
        health: keyHealth
      };
    }
    
    // All keys unavailable - wait and retry with least bad
    console.warn(`⚠️ All ${totalKeys} keys unavailable, finding best option...`);
    return this.findLeastBadKey(now);
  }

  async findLeastBadKey(now) {
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
      console.warn(`⏳ Best key ${bestKey.id} rate limited. Waiting ${Math.ceil(waitTime/1000)}s...`);
      await this.sleep(waitTime);
    }
    
    return {
      key: bestKey.fullKey,
      index,
      health: bestKey
    };
  }

  // FIXED: Proper rate limit handling with extended cooldown
  markRateLimited(index, cooldownMs = null) {
    const keyHealth = this.keyHealth[index];
    const cooldown = cooldownMs || this.rateLimitCooldown;
    
    keyHealth.rateLimitedUntil = Date.now() + cooldown;
    keyHealth.rateLimitCount++;
    keyHealth.failedRequests++;
    keyHealth.consecutiveRateLimits++;
    
    // Drastically reduce capacity
    keyHealth.estimatedCapacity = Math.max(10, keyHealth.estimatedCapacity * 0.5);
    
    // Increase global backoff significantly
    const limitedCount = this.keyHealth.filter(k => k.rateLimitedUntil > Date.now()).length;
    this.globalBackoffMultiplier = Math.min(5.0, this.globalBackoffMultiplier * 1.5);
    
    console.error(`🚫 Key ${keyHealth.id} RATE LIMITED (cooldown: ${Math.ceil(cooldown/1000)}s, capacity reduced to ${keyHealth.estimatedCapacity}/min)`);
    console.warn(`⚠️ Global backoff now ${this.globalBackoffMultiplier.toFixed(2)}x | ${limitedCount}/${this.keys.length} keys limited`);
    
    this.emit('rateLimited', { keyId: keyHealth.id, cooldown });
  }

  // FIXED: Proper success tracking
  markSuccess(index, responseTimeMs) {
    const keyHealth = this.keyHealth[index];
    
    // CRITICAL FIX: Increment success counter
    keyHealth.successfulRequests++;
    keyHealth.consecutiveErrors = 0;
    keyHealth.consecutiveRateLimits = 0;
    
    // Gradually increase capacity (conservative)
    keyHealth.estimatedCapacity = Math.min(60, keyHealth.estimatedCapacity * 1.02);
    
    // Track response time
    keyHealth.responseTimes.push(responseTimeMs);
    if (keyHealth.responseTimes.length > 20) {
      keyHealth.responseTimes.shift();
    }
    keyHealth.averageResponseTime = 
      keyHealth.responseTimes.reduce((a, b) => a + b, 0) / keyHealth.responseTimes.length;
    
    // Mark healthy
    if (!keyHealth.isHealthy) {
      keyHealth.isHealthy = true;
      console.log(`✅ Key ${keyHealth.id} recovered`);
    }
    
    // Gradually reduce global backoff on success
    if (this.globalBackoffMultiplier > 1.0) {
      this.globalBackoffMultiplier = Math.max(1.0, this.globalBackoffMultiplier * 0.98);
    }
  }

  markFailure(index, error) {
    const keyHealth = this.keyHealth[index];
    
    keyHealth.failedRequests++;
    keyHealth.consecutiveErrors++;
    keyHealth.lastError = error.message?.substring(0, 100);
    
    // Be aggressive about marking unhealthy
    if (keyHealth.consecutiveErrors >= 2) {
      keyHealth.isHealthy = false;
      console.error(`❌ Key ${keyHealth.id} marked UNHEALTHY (${keyHealth.consecutiveErrors} consecutive errors)`);
      this.emit('keyUnhealthy', { keyId: keyHealth.id, error: error.message });
    }
  }

  startRequestCleaner() {
    setInterval(() => {
      const now = Date.now();
      this.keyHealth.forEach(key => {
        key.requestTimestamps = key.requestTimestamps.filter(
          t => now - t < 60000
        );
        key.requestsInLastMinute = key.requestTimestamps.length;
      });
    }, 10000);
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
    
    // Auto-recover from errors after 5 minutes
    if (!key.isHealthy && now - key.lastRequestTime > 300000) {
      key.isHealthy = true;
      key.consecutiveErrors = 0;
      console.log(`🔄 Key ${key.id} auto-recovered from errors`);
    }
    
    // Count
    if (key.rateLimitedUntil > now) rateLimitedKeys++;
    else if (!key.isHealthy) unhealthyKeys++;
    else healthyKeys++;
  });
  
  // CRITICAL FIX: Only log if state changed
  const currentState = `${healthyKeys}-${rateLimitedKeys}-${unhealthyKeys}`;
  if (this.lastHealthState !== currentState) {
    console.log(`📊 Health Check: ${healthyKeys} healthy, ${rateLimitedKeys} rate limited, ${unhealthyKeys} unhealthy`);
    this.lastHealthState = currentState;
  }
  
  if (healthyKeys === 0 && rateLimitedKeys === 0) {
    console.error('🚨 CRITICAL: No healthy keys available!');
    this.emit('allKeysUnhealthy');
  }
}

  logKeyStatus() {
    console.log('📊 Key Status:');
    this.keyHealth.forEach(key => {
      const status = key.rateLimitedUntil > Date.now() ? '🚫 Rate Limited' :
                     !key.isHealthy ? '❌ Unhealthy' :
                     '✅ Healthy';
      const successRate = key.totalRequests > 0 
        ? Math.round((key.successfulRequests / key.totalRequests) * 100)
        : 0;
      console.log(`   Key ${key.id}: ${status} | ${key.successfulRequests}/${key.totalRequests} (${successRate}%) | ${key.requestsInLastMinute}/min`);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    return this.keyHealth.map(key => ({
      id: key.id,
      masked: key.key,
      status: key.rateLimitedUntil > now ? 'rate_limited' :
              !key.isHealthy ? 'unhealthy' : 'healthy',
      totalRequests: key.totalRequests,
      successfulRequests: key.successfulRequests,
      successRate: key.totalRequests > 0 
        ? `${Math.round(key.successfulRequests / key.totalRequests * 100)}%` 
        : '0%',
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
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    
    // Global settings
    this.maxRetries = 22; // Keep for compatibility
    this.baseTimeout = 120000; // 2 minutes
    
    // Event listeners
    this.keyManager.on('rateLimited', (data) => {
      console.warn(`⚠️ Rate limit event: Key ${data.keyId} (cooldown: ${Math.ceil(data.cooldown/1000)}s)`);
    });
    
    this.keyManager.on('keyUnhealthy', (data) => {
      console.error(`⚠️ Key ${data.keyId} unhealthy: ${data.error}`);
    });
    
    this.keyManager.on('allKeysUnhealthy', () => {
      console.error('🚨 CRITICAL: All keys unhealthy or rate limited!');
    });
    
    console.log('✅ AIClient initialized with bulletproof multi-key support');
  }

  get messages() {
    return {
      create: async (params) => {
        const maxAttempts = Math.min(this.keyManager.keys.length * 3, 15);
        let attempt = 0;
        let lastError = null;

        while (attempt < maxAttempts) {
          attempt++;
          
          try {
            console.log(`   Attempt ${attempt}/${maxAttempts}...`);
            
            // Get next available key (with built-in throttling)
            const keyInfo = await this.keyManager.getNextAvailableKey();
            
            // Make request
            const startTime = Date.now();
            const result = await this.makeRequest(params, keyInfo);
            const responseTime = Date.now() - startTime;
            
            // CRITICAL: Mark success
            this.keyManager.markSuccess(keyInfo.index, responseTime);
            
            console.log(`✅ Request succeeded with Key ${keyInfo.health.id} in ${responseTime}ms`);
            return result;
            
          } catch (error) {
            lastError = error;
            
            // Get the key index that just failed
            const failedIndex = this.keyManager.currentIndex === 0 
              ? this.keyManager.keys.length - 1 
              : this.keyManager.currentIndex - 1;
            
            const status = error.response?.status;
            const errorMsg = error.message?.toLowerCase() || '';
            
            // Detect rate limiting
            const isRateLimit = status === 429 || 
                               errorMsg.includes('429') ||
                               errorMsg.includes('rate limit') ||
                               errorMsg.includes('too many requests');
            
            if (isRateLimit) {
              const retryAfter = error.response?.headers['retry-after'];
              const cooldown = retryAfter ? parseInt(retryAfter) * 1000 : null;
              
              this.keyManager.markRateLimited(failedIndex, cooldown);
              console.error(`❌ Rate limit hit on attempt ${attempt}`);
              
              // Exponential backoff on rate limits
              await this.sleep(5000 * attempt);
              continue;
            }
            
            // Other errors
            this.keyManager.markFailure(failedIndex, error);
            console.error(`❌ Request failed (attempt ${attempt}): ${error.message?.substring(0, 100)}`);
            
            // Exponential backoff
            if (attempt < maxAttempts) {
              const delay = Math.min(10000, 2000 * attempt);
              console.log(`   ⏳ Backing off ${delay/1000}s...`);
              await this.sleep(delay);
            }
          }
        }

        // Failed after all attempts
        console.error(`❌ Request failed after ${maxAttempts} attempts`);
        console.log('📊 Final key stats:');
        this.keyManager.logKeyStatus();
        
        throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
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
      temperature: params.temperature !== undefined ? params.temperature : 0.7,
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
        timeout: this.baseTimeout,
        validateStatus: (status) => status < 500
      }
    );

    // Check for errors
    if (response.status !== 200) {
      const error = new Error(
        response.data?.error?.message || 
        `Request failed with status ${response.status}`
      );
      error.response = response;
      error.status = response.status;
      throw error;
    }

    // Validate response
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response: missing content');
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

  // Alias for compatibility
  async create(params) {
    return this.messages.create(params);
  }

  getKeyStats() {
    return this.keyManager.getStats();
  }

  logStatus() {
    this.keyManager.logKeyStatus();
  }
}

module.exports = AIClient;