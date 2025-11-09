// services/aiClient.js
// Smart multi-key rotation with automatic fallback

const Anthropic = require('@anthropic-ai/sdk');

class KeyRotationManager {
  constructor() {
    const keysString = process.env.OPENROUTER_API_KEY || '';
    this.keys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    
    if (this.keys.length === 0) {
      console.warn('⚠️ No API keys - fallback mode');
      this.fallbackMode = true;
      return;
    }
    
    console.log(`✅ Loaded ${this.keys.length} API keys`);
    
    this.keyStats = this.keys.map((key, index) => ({
      index,
      fullKey: key,
      uses: 0,
      failures: 0,
      lastUsed: null,
      isBlocked: false,
      blockUntil: null
    }));
    
    this.fallbackMode = false;
    setInterval(() => this.resetBlockedKeys(), 300000); // Reset every 5min
  }

  getNextKey() {
    if (this.fallbackMode || this.keys.length === 0) return null;

    const now = Date.now();
    const available = this.keyStats.filter(k => 
      !k.isBlocked && (!k.lastUsed || now - k.lastUsed > 1000)
    );

    if (available.length === 0) {
      const leastUsed = [...this.keyStats].sort((a, b) => a.uses - b.uses)[0];
      leastUsed.isBlocked = false;
      leastUsed.blockUntil = null;
      return leastUsed.fullKey;
    }

    const best = available.sort((a, b) => a.uses - b.uses)[0];
    best.uses++;
    best.lastUsed = now;
    return best.fullKey;
  }

  recordFailure(key, error) {
    const stat = this.keyStats.find(k => k.fullKey === key);
    if (!stat) return;

    stat.failures++;
    const isRateLimit = error?.status === 429 || error?.message?.includes('rate limit');

    if (isRateLimit) {
      stat.isBlocked = true;
      stat.blockUntil = Date.now() + 600000; // Block 10min
      console.warn(`🔴 Key ${stat.index + 1} blocked - ${this.getAvailableCount()} keys left`);
    }
  }

  getAvailableCount() {
    return this.keyStats.filter(k => !k.isBlocked).length;
  }

  resetBlockedKeys() {
    const now = Date.now();
    this.keyStats.forEach(k => {
      if (k.isBlocked && k.blockUntil && now > k.blockUntil) {
        k.isBlocked = false;
        k.blockUntil = null;
        console.log(`✅ Key ${k.index + 1} unblocked`);
      }
    });
  }

  getStats() {
    return {
      total: this.keys.length,
      available: this.getAvailableCount(),
      blocked: this.keyStats.filter(k => k.isBlocked).length,
      keys: this.keyStats.map(k => ({
        index: k.index + 1,
        uses: k.uses,
        failures: k.failures,
        blocked: k.isBlocked
      }))
    };
  }
}

// Singleton instance
const keyManager = new KeyRotationManager();

class aiClient {
  constructor(apiKey = null) {
    // Use key manager instead of single key
    this.keyManager = keyManager;
    this.fallbackMode = keyManager.fallbackMode;
    
    if (this.fallbackMode) {
      console.warn('⚠️ AI Client in fallback mode');
      this.initialized = false;
      return;
    }

    this.initialized = true;
    this.clientCache = new Map(); // Cache clients per key
  }

  getClient(key) {
    if (!this.clientCache.has(key)) {
      this.clientCache.set(key, new Anthropic({ 
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1'
      }));
    }
    return this.clientCache.get(key);
  }

  async create(params) {
    // Fallback mode: return mock
    if (this.fallbackMode || !this.initialized) {
      console.log('🔧 Fallback mode - mock response');
      return this.getMockResponse(params);
    }

    const maxAttempts = Math.min(3, this.keyManager.keys.length);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const currentKey = this.keyManager.getNextKey();
      
      if (!currentKey) {
        console.warn('⚠️ No keys available - using fallback');
        return this.getMockResponse(params);
      }

      try {
        const client = this.getClient(currentKey);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await client.messages.create({
          ...params,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;

      } catch (error) {
        this.keyManager.recordFailure(currentKey, error);
        
        const isRateLimit = error?.status === 429 || error?.message?.includes('rate limit');
        
        if (isRateLimit) {
          console.warn(`⚠️ Rate limit on key ${attempt}/${maxAttempts} - rotating`);
          
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000)); // 2s delay
            continue;
          }
        } else {
          console.error(`❌ API error (attempt ${attempt}):`, error.message?.substring(0, 100));
        }
        
        if (attempt >= maxAttempts) {
          console.warn('⚠️ All attempts failed - using fallback');
          return this.getMockResponse(params);
        }
      }
    }

    return this.getMockResponse(params);
  }

  getMockResponse(params) {
    const prompt = params.messages?.[0]?.content || '';
    
    if (prompt.includes('Return ONLY valid JSON') || prompt.includes('Return JSON')) {
      return this.getMockJSONResponse(prompt);
    }
    
    return {
      content: [{
        type: 'text',
        text: this.generateFallbackCode(prompt)
      }]
    };
  }

  getMockJSONResponse(prompt) {
    // Architecture
    if (prompt.includes('architecture') || prompt.includes('Plan')) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalFiles: 12,
            fileStructure: {
              routes: [
                { name: 'health', path: 'routes/health.js', purpose: 'Health check', priority: 'critical' },
                { name: 'auth', path: 'routes/auth.js', purpose: 'Auth', priority: 'critical' }
              ],
              controllers: [
                { name: 'authController', path: 'controllers/authController.js', purpose: 'Auth logic', methods: ['register', 'login'], priority: 'critical' }
              ],
              middleware: [
                { name: 'auth', path: 'middleware/auth.js', purpose: 'JWT', priority: 'critical' }
              ],
              models: [],
              utils: [
                { name: 'jwt', path: 'utils/jwt.js', purpose: 'JWT utils', priority: 'high' }
              ],
              config: [
                { name: 'database', path: 'config/database.js', purpose: 'DB config', priority: 'critical' }
              ]
            },
            techStack: {
              runtime: 'Node.js',
              framework: 'Express',
              database: 'PostgreSQL',
              orm: 'Prisma',
              auth: 'JWT'
            }
          })
        }]
      };
    }

    // Schema
    if (prompt.includes('schema') || prompt.includes('database')) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tables: [
              {
                name: 'User',
                purpose: 'User accounts',
                fields: [
                  { name: 'id', type: 'String', attributes: '@id @default(uuid())', description: 'Primary key' },
                  { name: 'email', type: 'String', attributes: '@unique', description: 'Email' },
                  { name: 'password', type: 'String?', attributes: '', description: 'Password' },
                  { name: 'createdAt', type: 'DateTime', attributes: '@default(now())', description: 'Created' },
                  { name: 'updatedAt', type: 'DateTime', attributes: '@updatedAt', description: 'Updated' }
                ],
                indexes: [{ fields: ['email'], type: 'unique' }],
                relations: []
              }
            ],
            optimizations: [
              { type: 'index', table: 'User', reason: 'Fast email lookup', impact: 'high' }
            ]
          })
        }]
      };
    }

    // Generic JSON
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, fallback: true, data: {} })
      }]
    };
  }

  generateFallbackCode(prompt) {
    if (prompt.includes('route') || prompt.includes('Express')) {
      return `const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'API endpoint', timestamp: new Date().toISOString() });
});

module.exports = router;`;
    }

    if (prompt.includes('controller')) {
      return `exports.handler = async (req, res) => {
  try {
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};`;
    }

    if (prompt.includes('React') || prompt.includes('component')) {
      return `import React from 'react';

function Component() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Component</h1>
    </div>
  );
}

export default Component;`;
    }

    return `// Fallback template
// Replace with actual implementation

module.exports = {};`;
  }

  get messages() {
    return {
      create: this.create.bind(this)
    };
  }

  getKeyStats() {
    return this.keyManager.getStats();
  }
}

module.exports = aiClient;