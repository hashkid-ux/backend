// backend/agents/codegen/databaseAgent.js
const AIClient = require('../../services/aiClient');

class DatabaseAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.maxRetries = 3;
  }

  /**
   * Generates database schema using project requirements & research insights
   * @param {Object} enhancedRequirements - Features, UX, pain points, competitive advantages
   * @param {Object} researchData - Market, competitors, reviews, papers, margins
   * @returns {Object} JSON with Prisma schema, SQL migrations, seed data
   */
  async designSchemaWithResearch(enhancedRequirements, researchData) {
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`📊 Database schema generation attempt ${attempt}/${this.maxRetries}`);

        const prompt = `Design a PostgreSQL database schema for a project with the following details:

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
6. Return ONLY valid JSON - no markdown, no code blocks.

Return ONLY this JSON structure (no other text):
{
  "prisma_schema": "full Prisma schema as a string with proper escaping",
  "sql_migrations": ["migration 1 SQL statement", "migration 2 SQL statement"],
  "seed_data": [{"table": "table_name", "data": {}}],
  "stats": {
    "total_tables": 5,
    "total_relations": 4,
    "total_indexes": 3
  }
}`;

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        console.log('📝 AI Response length:', content.length);

        // Extract JSON from response
        const parsed = this.extractAndParseJSON(content);
        
        if (!parsed) {
          throw new Error('Failed to extract valid JSON from AI response');
        }

        console.log('✅ Database schema generated successfully');
        return {
          prisma_schema: parsed.prisma_schema || this.getDefaultPrismaSchema(),
          sql_migrations: parsed.sql_migrations || [],
          seed_data: parsed.seed_data || [],
          stats: parsed.stats || { total_tables: 0, total_relations: 0, total_indexes: 0 },
          migrations: (parsed.sql_migrations || []).map((sql, i) => ({
            name: `migration_${String(i + 1).padStart(3, '0')}`,
            sql: sql
          }))
        };

      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (attempt < this.maxRetries) {
          console.log('🔄 Retrying with simplified prompt...');
          await this.sleep(2000);
        }
      }
    }

    // If all retries failed, return a default schema
    console.warn(`⚠️  All ${this.maxRetries} attempts failed, using default schema`);
    return this.getDefaultDatabaseSchema();
  }

  /**
   * Extracts JSON from AI response, handling various formats
   */
  extractAndParseJSON(content) {
    if (!content) return null;

    // Try 1: Look for JSON object pattern
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️  No JSON object found in response');
      return null;
    }

    const jsonStr = jsonMatch[0];

    // Try 2: Direct parse
    try {
      return JSON.parse(jsonStr);
    } catch (e1) {
      console.warn('Direct JSON parse failed, attempting cleanup...');
    }

    // Try 3: Clean up common JSON errors
    try {
      let cleaned = jsonStr;
      
      // Fix: Remove trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix: Unescaped quotes in strings (common AI error)
      // This is tricky - only replace quotes that aren't part of valid escaping
      cleaned = cleaned.replace(/([^\\])"([^"\\]*)"([^\\])/g, '$1\\"$2\\"$3');
      
      // Fix: Single quotes to double quotes (for property names)
      cleaned = cleaned.replace(/'([^']*)':/g, '"$1":');
      
      // Fix: Newlines in strings
      cleaned = cleaned.replace(/\n/g, '\\n');
      
      return JSON.parse(cleaned);
    } catch (e2) {
      console.warn('Cleaned JSON parse failed:', e2.message);
    }

    // Try 4: Extract just the essential parts
    try {
      const prismaMatch = content.match(/"prisma_schema"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
      const migrationsMatch = content.match(/"sql_migrations"\s*:\s*\[(.*?)\]/s);
      const seedMatch = content.match(/"seed_data"\s*:\s*\[(.*?)\]/s);

      if (prismaMatch) {
        return {
          prisma_schema: prismaMatch[1],
          sql_migrations: migrationsMatch ? this.extractArrayItems(migrationsMatch[1]) : [],
          seed_data: seedMatch ? this.extractArrayItems(seedMatch[1]) : []
        };
      }
    } catch (e3) {
      console.warn('Regex extraction failed:', e3.message);
    }

    return null;
  }

  /**
   * Extract array items from raw JSON string
   */
  extractArrayItems(arrayContent) {
    const items = [];
    try {
      // Match quoted strings
      const matches = arrayContent.match(/"(?:[^"\\]|\\.)*"/g) || [];
      matches.forEach(match => {
        items.push(JSON.parse(match));
      });
    } catch (e) {
      console.warn('Array extraction error:', e.message);
    }
    return items;
  }

  /**
   * Get default Prisma schema if generation fails
   */
  getDefaultPrismaSchema() {
    return `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([email])
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([token])
}
`;
  }

  /**
   * Get default complete database schema
   */
  getDefaultDatabaseSchema() {
    return {
      prisma_schema: this.getDefaultPrismaSchema(),
      sql_migrations: [
        `CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP);`,
        `CREATE TABLE "Session" (id TEXT PRIMARY KEY, "userId" TEXT, token TEXT UNIQUE, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
        `CREATE INDEX "User_email" ON "User"(email);`,
        `CREATE INDEX "Session_userId" ON "Session"("userId");`,
        `CREATE INDEX "Session_token" ON "Session"(token);`
      ],
      seed_data: [],
      stats: {
        total_tables: 2,
        total_relations: 1,
        total_indexes: 3
      },
      migrations: [
        {
          name: 'migration_001_initial_schema',
          sql: `CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP);`
        },
        {
          name: 'migration_002_add_sessions',
          sql: `CREATE TABLE "Session" (id TEXT PRIMARY KEY, "userId" TEXT, token TEXT UNIQUE, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
        }
      ]
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DatabaseAgent;