const axios = require('axios');

class AIClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    
    // Rate limit tracking
    this.lastRequestTime = 0;
    this.minDelayMs = 3000; // 3 seconds between requests
    this.rateLimitCooldown = 60000; // 1 minute cooldown on 429
    this._messagesCache = null;
  }

  // Messages object to match Anthropic SDK structure
  get messages() {
    if (!this._messagesCache) {
      this._messagesCache = {
        create: async (params) => {
          return await this.withRateLimitHandling(async () => {
            // Enforce minimum delay between requests
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < this.minDelayMs) {
              const waitTime = this.minDelayMs - timeSinceLastRequest;
              console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
              await this.sleep(waitTime);
            }

            this.lastRequestTime = Date.now();
            
            // Convert Anthropic format to OpenRouter/OpenAI format
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

            // Make request to OpenRouter using Axios
            const response = await axios.post(
              `${this.baseURL}/chat/completions`,
              openRouterRequest,
              {
                headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:5000',
                  'X-Title': 'Launch AI'
                },
                timeout: 60000
              }
            );

            // Convert OpenRouter response to Anthropic SDK format
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
          });
        }
      };
    }
    return this._messagesCache;
  }

  async withRateLimitHandling(requestFn, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Extract status code from axios error
        const status = error.response?.status || error.status;
        const errorMessage = error.message || '';
        
        // Check if it's a rate limit error (429)
        const isRateLimit = status === 429 || 
                           errorMessage.includes('429') || 
                           errorMessage.includes('rate limit') ||
                           errorMessage.includes('rate-limited');
        
        // Check if it's a 405 error (method not allowed)
        if (status === 405) {
          console.error(`❌ 405 Method Not Allowed - API endpoint issue`);
          throw new Error('API method not allowed - check OpenRouter configuration');
        }
        
        if (isRateLimit) {
          const waitTime = this.calculateBackoff(attempt);
          console.error(`❌ Rate limit hit (attempt ${attempt}/${maxRetries})`);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          
          await this.sleep(waitTime);
          continue;
        }

        // Log full error details for debugging
        console.error(`❌ Request failed (attempt ${attempt}/${maxRetries}):`, {
          status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: errorMessage
        });

        // Non-rate-limit error
        if (attempt < maxRetries) {
          const waitTime = this.minDelayMs * attempt;
          console.log(`⏳ Retrying in ${waitTime}ms...`);
          await this.sleep(waitTime);
          continue;
        }

        // Final attempt failed, throw the error
        throw error;
      }
    }

    throw new Error(`Request failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  calculateBackoff(attempt) {
    // Exponential backoff: 60s, 120s, 180s
    return this.rateLimitCooldown * attempt;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIClient;