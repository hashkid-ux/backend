const express = require('express');
const router = express.Router();
const AIClient = require('../services/aiClient');
const { authenticateToken } = require('./authWithDb');

router.post('/repair-code', authenticateToken, async (req, res) => {
  try {
    const { code, errors, language = 'javascript' } = req.body;
    
    if (!code || !errors) {
      return res.status(400).json({ error: 'Code and errors required' });
    }
    
    console.log('🔧 AI code repair requested');
    
    const client = new AIClient();
    
    const prompt = `Fix this ${language} code. Syntax errors detected:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

BROKEN CODE:
\`\`\`${language}
${code}
\`\`\`

Return ONLY the fixed code. No explanations. Remove artifacts.`;

    const response = await client.messages.create({
      model: 'qwen/qwen-2.5-coder-32b-instruct:free',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    let fixed = response.content[0].text
      .replace(/```[\w]*\n?/g, '')
      .replace(/<\|.*?\|>/g, '')
      .trim();
    
    console.log('✅ AI repair complete');
    
    res.json({ fixed_code: fixed, success: true });
    
  } catch (error) {
    console.error('❌ Code repair error:', error);
    res.status(500).json({ 
      error: 'Repair failed', 
      message: error.message 
    });
  }
});

module.exports = router;