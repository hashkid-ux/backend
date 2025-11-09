// services/aiClient.js - REPLACE ENTIRE FILE

const Anthropic = require('@anthropic-ai/sdk');

class AIClient {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    
    // Circuit breaker state
    this.failedAttempts = 0;
    this.maxFailures = 5;
    this.circuitOpen = false;
    this.lastFailureTime = null;
    this.circuitResetTime = 5 * 60 * 1000; // 5 minutes
  }

  async create(params) {
    // Check circuit breaker
    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.circuitResetTime) {
        console.log('🔄 Circuit breaker reset - trying again');
        this.circuitOpen = false;
        this.failedAttempts = 0;
      } else {
        const waitMinutes = Math.ceil((this.circuitResetTime - (now - this.lastFailureTime)) / 60000);
        throw new Error(`Circuit breaker open - wait ${waitMinutes} minutes before retry`);
      }
    }

    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        attempt++;
        
        // CRITICAL: Add request timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
        
        const response = await this.client.messages.create({
          ...params,
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        // Success - reset failure counter
        this.failedAttempts = 0;
        return response;
        
      } catch (error) {
        const is429 = error.status === 429 || error.message?.includes('429') || error.message?.includes('rate limit');
        
        if (is429) {
          this.failedAttempts++;
          
          // Open circuit if too many failures
          if (this.failedAttempts >= this.maxFailures) {
            this.circuitOpen = true;
            this.lastFailureTime = Date.now();
            console.error('🚫 CIRCUIT BREAKER OPEN - Too many rate limits');
            throw new Error('API rate limit exceeded - circuit breaker activated');
          }
          
          // Exponential backoff: 30s, 90s, 180s
          const backoffSeconds = 30 * Math.pow(3, attempt - 1);
          console.warn(`⏳ Rate limit (attempt ${attempt}/${maxAttempts}) - waiting ${backoffSeconds}s`);
          
          if (attempt < maxAttempts) {
            await this.sleep(backoffSeconds * 1000);
            continue;
          }
        }
        
        // Non-429 error or max attempts reached
        throw error;
      }
    }
    
    throw new Error('Max retry attempts reached');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIClient;