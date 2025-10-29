// backend/agents/codegen/databaseAgent.js
const AIClient = require('../../services/aiClient');

class DatabaseAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
  }

  /**
   * Generates database schema using project requirements & research insights
   * @param {Object} enhancedRequirements - Features, UX, pain points, competitive advantages
   * @param {Object} researchData - Market, competitors, reviews, papers, margins
   * @returns {Object} JSON with Prisma schema, SQL migrations, seed data
   */
  async designSchemaWithResearch(enhancedRequirements, researchData) {
    const prompt = `
Design a PostgreSQL database schema for a project with the following details:

PROJECT REQUIREMENTS:
${JSON.stringify(enhancedRequirements, null, 2)}

RESEARCH DATA:
${JSON.stringify(researchData, null, 2)}

Requirements:
1. Use Prisma schema format.
2. Include SQL migrations.
3. Provide seed data for initial setup.
4. Reflect all important features from competitive advantages, pain points, and market gaps.
5. Include relations, indexes, and constraints.

Return JSON in this structure:
{
  "prisma_schema": "full Prisma schema as string",
  "sql_migrations": ["migration SQL statements as strings"],
  "seed_data": ["INSERT statements or JSON seed objects"]
}
`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      console.log('AI raw response:', content);


      // Extract JSON from AI response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('DatabaseAgent: Could not parse JSON from AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;

    } catch (error) {
      console.error('DatabaseAgent error:', error);
      return null;
    }
  }
}

module.exports = DatabaseAgent;
