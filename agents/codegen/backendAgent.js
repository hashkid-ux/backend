//const Anthropic = require('@anthropic-ai/sdk');
const AIClient = require('../../services/aiClient');


class BackendAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    
    this.model = 'deepseek/deepseek-chat';
  }

  async generateBackend(projectData, databaseSchema) {
    const prompt = `Generate a complete Node.js/Express backend with:
    
PROJECT: ${projectData.projectName}
FEATURES: ${JSON.stringify(projectData.features)}
DATABASE SCHEMA: ${JSON.stringify(databaseSchema)}

Generate these files:
1. server.js - Main server
2. routes/*.js - API routes  
3. controllers/*.js - Business logic
4. middleware/*.js - Auth, validation
5. package.json

Use:
- Express.js
- JWT authentication
- Input validation
- Error handling
- RESTful API design

Return JSON: { "files": { "path": "code" } }`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseCodeFromResponse(response);
  }
}