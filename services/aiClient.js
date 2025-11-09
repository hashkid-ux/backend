// services/aiClient.js
// Native OpenRouter client - NO Anthropic SDK

class KeyRotationManager {
  constructor() {
    const keysString = process.env.OPENROUTER_API_KEY || '';
    this.keys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    
    if (this.keys.length === 0) {
      console.warn('⚠️ No API keys - fallback mode');
      this.fallbackMode = true;
      return;
    }
    
    console.log(`✅ Loaded ${this.keys.length} OpenRouter API keys`);
    
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
    setInterval(() => this.resetBlockedKeys(), 300000);
  }

  getNextKey() {
    if (this.fallbackMode || this.keys.length === 0) return null;

    const now = Date.now();
    const available = this.keyStats.filter(k => 
      !k.isBlocked && (!k.lastUsed || now - k.lastUsed > 5000)
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
    const isRateLimit = error?.status === 429 || 
                       error?.message?.includes('rate limit') ||
                       error?.message?.includes('429');

    if (isRateLimit) {
      stat.isBlocked = true;
      stat.blockUntil = Date.now() + 600000;
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

const keyManager = new KeyRotationManager();

class aiClient {
  constructor() {
    this.keyManager = keyManager;
    this.fallbackMode = keyManager.fallbackMode;
    this.baseURL = 'https://openrouter.ai/api/v1/chat/completions';
    
    if (this.fallbackMode) {
      console.warn('⚠️ AI Client in fallback mode');
      this.initialized = false;
      return;
    }

    this.initialized = true;
  }

  // Convert Anthropic-style params to OpenRouter format
  convertParams(params) {
    return {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens || 4000,
      temperature: params.temperature !== undefined ? params.temperature : 0.7,
      ...(params.stream !== undefined && { stream: params.stream })
    };
  }

  // Convert OpenRouter response to Anthropic-style
  convertResponse(data) {
    return {
      content: [{
        type: 'text',
        text: data.choices?.[0]?.message?.content || ''
      }],
      model: data.model,
      usage: data.usage
    };
  }

  async create(params) {
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
        const body = this.convertParams(params);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentKey}`,
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
            'X-Title': 'Launch AI'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw {
            status: response.status,
            message: error.error?.message || `HTTP ${response.status}`
          };
        }

        const data = await response.json();
        return this.convertResponse(data);

      } catch (error) {
        this.keyManager.recordFailure(currentKey, error);
        
        const isRateLimit = error?.status === 429 || 
                           error?.message?.includes('rate limit');
        
        if (isRateLimit) {
          console.warn(`⚠️ Rate limit on key ${attempt}/${maxAttempts} - rotating`);
          
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
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
    if (prompt.includes('architecture') || prompt.includes('Plan')) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalFiles: 12,
            fileStructure: {
              routes: [
                { name: 'health', path: 'routes/health.js', purpose: 'Health check', priority: 'critical' }
              ],
              controllers: [
                { name: 'authController', path: 'controllers/authController.js', purpose: 'Auth logic', methods: ['register', 'login'], priority: 'critical' }
              ],
              middleware: [
                { name: 'auth', path: 'middleware/auth.js', purpose: 'JWT', priority: 'critical' }
              ],
              utils: [
                { name: 'jwt', path: 'utils/jwt.js', purpose: 'JWT utils', priority: 'high' }
              ],
              config: [
                { name: 'database', path: 'config/database.js', purpose: 'DB config', priority: 'critical' }
              ]
            },
            techStack: { runtime: 'Node.js', framework: 'Express', database: 'PostgreSQL', orm: 'Prisma', auth: 'JWT' }
          })
        }]
      };
    }

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
                  { name: 'email', type: 'String', attributes: '@unique', description: 'Email' }
                ],
                indexes: [{ fields: ['email'], type: 'unique' }]
              }
            ]
          })
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, fallback: true })
      }]
    };
  }

  generateFallbackCode(prompt) {
    if (prompt.includes('route') || prompt.includes('Express')) {
      return `const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'API endpoint' });
});

module.exports = router;`;
    }

    if (prompt.includes('React') || prompt.includes('component')) {
      return `import React from 'react';

function Component() {
  return <div className="p-4"><h1>Component</h1></div>;
}

export default Component;`;
    }

    return `// Fallback template\nmodule.exports = {};`;
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