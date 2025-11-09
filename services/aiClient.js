const Anthropic = require('@anthropic-ai/sdk');

class aiClient {
  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) {
      throw new Error('CRITICAL: OPENROUTER_API_KEY missing');
    }

    try {
      this.client = new Anthropic({ 
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      this.initialized = true;
    } catch (error) {
      console.error('❌ Anthropic init failed:', error);
      this.initialized = false;
      throw error;
    }

    this.failedAttempts = 0;
    this.maxFailures = 5;
    this.circuitOpen = false;
    this.lastFailureTime = null;
    this.circuitResetTime = 300000; // 5 min
  }

  async create(params) {
    if (!this.initialized || !this.client?.messages) {
      throw new Error('AI Client not initialized');
    }

    if (this.circuitOpen) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.circuitResetTime) {
        this.circuitOpen = false;
        this.failedAttempts = 0;
      } else {
        const waitMin = Math.ceil((this.circuitResetTime - (now - this.lastFailureTime)) / 60000);
        throw new Error(`Circuit breaker open - retry in ${waitMin}min`);
      }
    }

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await this.client.messages.create({
          ...params,
          signal: controller.signal
        });

        clearTimeout(timeout);
        this.failedAttempts = 0;
        return response;

      } catch (error) {
        clearTimeout(timeout);
        
        const is429 = error.status === 429 || error.message?.includes('rate limit');

        if (is429) {
          this.failedAttempts++;

          if (this.failedAttempts >= this.maxFailures) {
            this.circuitOpen = true;
            this.lastFailureTime = Date.now();
            throw new Error('Circuit breaker: Too many rate limits');
          }

          const backoff = 30 * Math.pow(3, attempt - 1);
          
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, backoff * 1000));
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  get messages() {
    return {
      create: this.create.bind(this)
    };
  }
}

module.exports = aiClient;