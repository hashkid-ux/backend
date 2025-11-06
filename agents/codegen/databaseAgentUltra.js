// agents/codegen/databaseAgentUltra.js
// ULTRA Database Agent - Intelligent, Optimized Schema Generation

const AIClient = require('../../services/aiClient');

class DatabaseAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.maxRetries = 3;
  }

  async designSchemaUltra(enhancedRequirements, researchData) {
    console.log('🗄️  ULTRA Database Agent: Designing intelligent schema...');

    let attempt = 0;
    
    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   🔄 Schema design attempt ${attempt}/${this.maxRetries}`);

        // PHASE 1: Analyze requirements and plan schema
        const schemaplan = await this.planDatabaseSchema(enhancedRequirements, researchData);
        console.log(`   ✅ Schema planned: ${schemaplan.tables?.length || 0} tables`);

        // PHASE 2: Generate Prisma schema
        const prismaSchema = await this.generatePrismaSchema(schemaplan, enhancedRequirements);
        console.log(`   ✅ Prisma schema generated`);

        // PHASE 3: Generate migrations
        const migrations = this.generateMigrations(schemaplan);
        console.log(`   ✅ ${migrations.length} migrations generated`);

        // PHASE 4: Validate schema
        const validation = this.validateSchema(prismaSchema, schemaplan);
        
        if (validation.isValid) {
          console.log('   ✅ Schema validated successfully');
          
          return {
            prisma_schema: prismaSchema,
            sql_migrations: migrations.map(m => m.sql),
            migrations: migrations,
            seed_data: this.generateSeedData(schemaplan),
            stats: {
              total_tables: schemaplan.tables?.length || 0,
              total_relations: this.countRelations(schemaplan),
              total_indexes: this.countIndexes(schemaplan)
            },
            optimizations: schemaplan.optimizations || [],
            validation
          };
        }

        console.warn(`   ⚠️  Schema validation failed: ${validation.errors.join(', ')}`);
        
      } catch (error) {
        console.error(`   ❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt >= this.maxRetries) {
          console.warn('   ⚠️  Using default schema');
          return this.getDefaultDatabaseSchema();
        }
        
        await this.sleep(2000);
      }
    }
    
    return this.getDefaultDatabaseSchema();
  }

  async planDatabaseSchema(requirements, researchData) {
    console.log('📐 Planning intelligent database schema...');

    const {
      projectName,
      description,
      features,
      competitive_advantages,
      database = 'postgresql'
    } = requirements;

    const jsonInstructions = `CRITICAL JSON RULES:
1. Return ONLY valid JSON
2. No markdown code blocks
3. No explanations before or after JSON
4. Start response with {
5. End response with }
6. No trailing commas
7. Escape all quotes in strings
8. Maximum response length: 4000 tokens

`;

    const prompt = jsonInstructions +`You are a database architect expert. Design an OPTIMAL database schema.

PROJECT: ${projectName}
DESCRIPTION: ${description}
FEATURES: ${JSON.stringify(features || [])}
COMPETITIVE ADVANTAGES: ${JSON.stringify(competitive_advantages?.slice(0, 5) || [])}
DATABASE: ${database}

MARKET INSIGHTS:
${researchData?.market ? `Market Size: ${researchData.market.market_overview?.size || 'Unknown'}` : ''}
${researchData?.competitors ? `Competitors: ${researchData.competitors.total_analyzed || 0} analyzed` : ''}

Design a database schema that:
1. Supports all required features
2. Is normalized (3NF minimum)
3. Has proper indexes for performance
4. Includes audit fields (createdAt, updatedAt)
5. Has proper foreign key relationships
6. Is scalable for growth

Return ONLY this JSON:
{
  "tables": [
    {
      "name": "User",
      "purpose": "Store user accounts",
      "fields": [
        {
          "name": "id",
          "type": "String",
          "attributes": "@id @default(uuid())",
          "description": "Primary key"
        },
        {
          "name": "email",
          "type": "String",
          "attributes": "@unique",
          "description": "User email"
        },
        {
          "name": "password",
          "type": "String?",
          "attributes": "",
          "description": "Hashed password"
        },
        {
          "name": "createdAt",
          "type": "DateTime",
          "attributes": "@default(now())",
          "description": "Creation timestamp"
        }
      ],
      "indexes": [
        {
          "fields": ["email"],
          "type": "unique"
        }
      ],
      "relations": []
    }
  ],
  "optimizations": [
    {
      "type": "index",
      "table": "User",
      "reason": "Fast email lookups for login",
      "impact": "high"
    }
  ],
  "scalability": {
    "partitioning": "Consider partitioning Users by date if > 1M users",
    "caching": "Cache frequently accessed user profiles"
  }
}

CRITICAL: 
- Only create tables actually needed for the features
- Don't create generic tables that won't be used
- Include proper indexes for performance
- Add audit fields to all tables
- Plan for scalability`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 6000 : 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse schema plan');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('❌ Schema planning failed:', error.message);
      throw error;
    }
  }

  async generatePrismaSchema(schemaplan, requirements) {
  console.log('🔨 Generating Prisma schema...');

  let prismaSchema = `// Prisma Schema for ${requirements.projectName}
// Generated by Launch AI

generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

  // CRITICAL FIX: Ensure every model has @id
  for (const table of schemaplan.tables || []) {
    prismaSchema += `model ${table.name} {\n`;
    
    let hasId = false;
    const fields = table.fields || [];
    
    // Check if ID exists
    hasId = fields.some(f => f.attributes && f.attributes.includes('@id'));
    
    // If no ID, inject one at the start
    if (!hasId) {
      prismaSchema += `  id              String   @id @default(uuid())\n`;
    }
    
    // Add all fields
    for (const field of fields) {
      // Skip if it's a duplicate id field
      if (field.name === 'id' && !hasId) continue;
      
      const attributes = field.attributes || '';
      prismaSchema += `  ${field.name.padEnd(15)} ${field.type.padEnd(15)}${attributes ? ' ' + attributes : ''}\n`;
    }
    
    // Add relations
    if (table.relations && table.relations.length > 0) {
      prismaSchema += '\n  // Relations\n';
      for (const relation of table.relations) {
        prismaSchema += `  ${relation.field.padEnd(15)} ${relation.type}\n`;
      }
    }
    
    // Add indexes
    if (table.indexes && table.indexes.length > 0) {
      prismaSchema += '\n';
      for (const index of table.indexes) {
        if (index.type === 'unique') {
          prismaSchema += `  @@unique([${index.fields.join(', ')}])\n`;
        } else {
          prismaSchema += `  @@index([${index.fields.join(', ')}])\n`;
        }
      }
    }
    
    prismaSchema += '}\n\n';
  }

  return prismaSchema;
}

  generateMigrations(schemaplan) {
  console.log('📝 Generating SQL migrations...');

  const migrations = [];
  let migrationNumber = 1;

  for (const table of schemaplan.tables || []) {
    const tableName = table.name;
    const fields = table.fields || [];
    
    // CRITICAL FIX: Ensure ID field exists
    let hasId = fields.some(f => f.attributes && f.attributes.includes('@id'));
    
    let createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    
    const fieldsSql = [];
    
    // Add ID if missing
    if (!hasId) {
      fieldsSql.push('  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()');
    }
    
    // Add other fields
    fields.forEach(field => {
      if (field.name === 'id' && !hasId) return; // Skip duplicate
      
      let sql = `  "${field.name}" `;
      
      const typeMap = {
        'String': 'TEXT',
        'String?': 'TEXT',
        'Int': 'INTEGER',
        'Int?': 'INTEGER',
        'Float': 'DOUBLE PRECISION',
        'Boolean': 'BOOLEAN',
        'DateTime': 'TIMESTAMP',
        'Json': 'JSONB'
      };
      
      sql += typeMap[field.type] || 'TEXT';
      
      const attrs = field.attributes || '';
      
      if (attrs.includes('@id')) {
        sql += ' PRIMARY KEY';
      }
      if (attrs.includes('@unique')) {
        sql += ' UNIQUE';
      }
      if (!field.type.includes('?') && !attrs.includes('@default') && !attrs.includes('@id')) {
        sql += ' NOT NULL';
      }
      if (attrs.includes('@default(now())')) {
        sql += ' DEFAULT CURRENT_TIMESTAMP';
      }
      if (attrs.includes('@default(uuid())')) {
        sql += ' DEFAULT gen_random_uuid()';
      }
      
      fieldsSql.push(sql);
    });
    
    createTableSql += fieldsSql.join(',\n') + '\n);';
    
    migrations.push({
      name: `migration_${String(migrationNumber++).padStart(3, '0')}_create_${tableName.toLowerCase()}`,
      sql: createTableSql
    });
    
    // Add index migrations
    if (table.indexes && table.indexes.length > 0) {
      for (const index of table.indexes) {
        const indexName = `idx_${tableName.toLowerCase()}_${index.fields.join('_')}`;
        const indexSql = `CREATE ${index.type === 'unique' ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" (${index.fields.map(f => `"${f}"`).join(', ')});`;
        
        migrations.push({
          name: `migration_${String(migrationNumber++).padStart(3, '0')}_index_${indexName}`,
          sql: indexSql
        });
      }
    }
  }

  return migrations;
}

  generateSeedData(schemaplan) {
    const seedData = [];

    // Generate seed data for User table if it exists
    const userTable = schemaplan.tables?.find(t => t.name === 'User');
    if (userTable) {
      seedData.push({
        table: 'User',
        data: [
          {
            email: 'admin@example.com',
            password: '$2b$10$rQJ5cGmXvZ3QlGxNzqJwvOqYk8CQQq0GqLZQh0qZqZqZqZqZqZqZq', // "password123"
            name: 'Admin User',
            role: 'admin'
          },
          {
            email: 'user@example.com',
            password: '$2b$10$rQJ5cGmXvZ3QlGxNzqJwvOqYk8CQQq0GqLZQh0qZqZqZqZqZqZqZq',
            name: 'Test User',
            role: 'user'
          }
        ]
      });
    }

    return seedData;
  }

  validateSchema(prismaSchema, schemaplan) {
    const errors = [];
    const warnings = [];

    // 1. Check for datasource
    if (!prismaSchema.includes('datasource db')) {
      errors.push('Missing datasource configuration');
    }

    // 2. Check for generator
    if (!prismaSchema.includes('generator client')) {
      errors.push('Missing generator configuration');
    }

    // 3. Check each table has ID
    for (const table of schemaplan.tables || []) {
      const hasId = table.fields.some(f => 
  f.name === 'id' || 
  (f.attributes && f.attributes.includes('@id'))
);
      if (!hasId) {
        errors.push(`Table ${table.name} missing primary key`);
      }

      // Check for audit fields
      const hasCreatedAt = table.fields.some(f => f.name === 'createdAt');
      const hasUpdatedAt = table.fields.some(f => f.name === 'updatedAt');
      if (!hasCreatedAt) {
        warnings.push(`Table ${table.name} missing createdAt field`);
      }
      if (!hasUpdatedAt) {
        warnings.push(`Table ${table.name} missing updatedAt field`);
      }
    }

    // 4. Check for indexes on foreign keys
    for (const table of schemaplan.tables || []) {
      for (const relation of table.relations || []) {
        const hasIndex = table.indexes?.some(idx => 
          idx.fields.includes(relation.field)
        );
        if (!hasIndex) {
          warnings.push(`Table ${table.name} missing index on relation ${relation.field}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings)
    };
  }

  countRelations(schemaplan) {
    return schemaplan.tables?.reduce((count, table) => 
      count + (table.relations?.length || 0), 0
    ) || 0;
  }

  countIndexes(schemaplan) {
    return schemaplan.tables?.reduce((count, table) => 
      count + (table.indexes?.length || 0), 0
    ) || 0;
  }

  calculateValidationScore(errors, warnings) {
    let score = 100;
    score -= errors.length * 20;
    score -= warnings.length * 5;
    return Math.max(0, score);
  }

  getDefaultDatabaseSchema() {
    const defaultSchema = `generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
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
  role      String   @default("user")
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

    return {
      prisma_schema: defaultSchema,
      sql_migrations: [
        'CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, role TEXT DEFAULT \'user\', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP);',
        'CREATE INDEX "User_email" ON "User"(email);',
        'CREATE TABLE "Session" (id TEXT PRIMARY KEY, "userId" TEXT, token TEXT UNIQUE, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);',
        'CREATE INDEX "Session_userId" ON "Session"("userId");',
        'CREATE INDEX "Session_token" ON "Session"(token);'
      ],
      migrations: [
        {
          name: 'migration_001_create_user',
          sql: 'CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, role TEXT DEFAULT \'user\', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP);'
        },
        {
          name: 'migration_002_create_session',
          sql: 'CREATE TABLE "Session" (id TEXT PRIMARY KEY, "userId" TEXT, token TEXT UNIQUE, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);'
        }
      ],
      seed_data: [],
      stats: {
        total_tables: 2,
        total_relations: 1,
        total_indexes: 3
      },
      optimizations: [
        { type: 'index', table: 'User', reason: 'Email is used for login', impact: 'high' }
      ]
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DatabaseAgentUltra;