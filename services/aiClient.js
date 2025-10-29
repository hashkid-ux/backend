const axios = require('axios');

class AIClient {
  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.model = 'deepseek/deepseek-chat-v3.1:free'; // Free model
  }

  // Main method - matches Anthropic SDK naming
  async create(params) {
    return await this.messages.create(params);
  }

  // Messages object to match Anthropic SDK structure
  get messages() {
    return {
      create: async (params) => {
        try {
          const response = await axios.post(
            `${this.baseURL}/chat/completions`,
            {
              model: this.model,
              messages: params.messages.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              max_tokens: params.max_tokens || 4000,
              temperature: 0.7,
              stream: false
            },
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

          // Format response to match Anthropic SDK structure
          return {
            content: [{
              type: 'text',
              text: response.data.choices[0].message.content
            }]
          };
        } catch (error) {
          console.error('OpenRouter API Error:', error.response?.data || error.message);
          throw new Error(`AI API failed: ${error.message}`);
        }
      }
    };
  }
}

module.exports = AIClient;