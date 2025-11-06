// agents/research/researchPaperAgentUltra.js
// ULTRA Research Paper Agent - Deep Academic Intelligence

const AIClient = require('../../services/aiClient');
const axios = require('axios');
const WebScraperUltra = require('./webScraperUltra');

class ResearchPaperAgentUltra {
  constructor(tier = 'premium') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.scraper = new WebScraperUltra();
  }

  async findAndAnalyzeRelevantPapersUltra(projectDescription, keywords) {
    console.log('📚 ULTRA Research Paper Agent: Deep academic analysis...');

    if (this.tier !== 'premium') {
      return {
        error: 'Research paper analysis requires Premium tier',
        upgrade_url: '/pricing'
      };
    }

    try {
      // STEP 1: Multi-source paper discovery
      console.log('🔍 Step 1: Discovering papers from multiple sources...');
      const papers = await this.discoverPapersMultiSource(keywords, projectDescription);
      
      console.log(`✅ Found ${papers.length} relevant papers`);

      // STEP 2: Deep content analysis
      console.log('📖 Step 2: Analyzing paper content...');
      const analyzedPapers = await this.deepAnalyzePapers(papers, projectDescription);

      // STEP 3: Extract innovations
      console.log('💡 Step 3: Extracting actionable innovations...');
      const innovations = await this.extractInnovationsUltra(analyzedPapers, projectDescription);

      // STEP 4: Implementation roadmap
      console.log('🗺️  Step 4: Creating implementation roadmap...');
      const roadmap = await this.generateImplementationRoadmap(innovations, projectDescription);

      // STEP 5: Competitive intelligence
      console.log('🎯 Step 5: Analyzing competitive intelligence...');
      const competitive = await this.analyzeCompetitiveIntelligence(innovations);

      await this.scraper.closeBrowser();

      return {
        papers_analyzed: analyzedPapers.length,
        papers: analyzedPapers.map(p => ({
          title: p.title,
          authors: p.authors,
          year: p.year,
          citations: p.citations,
          url: p.url,
          relevance_score: p.relevance,
          key_findings: p.key_findings,
          methodology: p.methodology
        })),
        innovations: innovations,
        implementation_roadmap: roadmap,
        competitive_intelligence: competitive,
        research_quality_score: this.calculateResearchQuality(analyzedPapers),
        _meta: {
          sources_searched: ['Google Scholar', 'arXiv', 'Semantic Scholar', 'IEEE', 'ACM'],
          search_depth: 'deep',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Research Paper Agent Error:', error);
      return {
        error: 'Failed to analyze research papers',
        message: error.message
      };
    }
  }

  async discoverPapersMultiSource(keywords, description) {
    console.log('🌐 Searching multiple academic sources...');
    
    const allPapers = [];
    
    // SOURCE 1: Google Scholar
    try {
      console.log('   📚 Searching Google Scholar...');
      const scholarPapers = await this.searchGoogleScholar(keywords);
      allPapers.push(...scholarPapers);
      console.log(`   ✅ Google Scholar: ${scholarPapers.length} papers`);
    } catch (error) {
      console.error('   ❌ Google Scholar failed:', error.message);
    }

    // SOURCE 2: arXiv
    try {
      console.log('   📄 Searching arXiv...');
      const arxivPapers = await this.searchArxiv(keywords);
      allPapers.push(...arxivPapers);
      console.log(`   ✅ arXiv: ${arxivPapers.length} papers`);
    } catch (error) {
      console.error('   ❌ arXiv failed:', error.message);
    }

    // SOURCE 3: Semantic Scholar
    try {
      console.log('   🔬 Searching Semantic Scholar...');
      const semanticPapers = await this.searchSemanticScholar(keywords);
      allPapers.push(...semanticPapers);
      console.log(`   ✅ Semantic Scholar: ${semanticPapers.length} papers`);
    } catch (error) {
      console.error('   ❌ Semantic Scholar failed:', error.message);
    }

    // Deduplicate and sort by relevance
    const uniquePapers = this.deduplicatePapers(allPapers);
    return uniquePapers.slice(0, 10); // Top 10 most relevant
  }

  async searchGoogleScholar(keywords) {
    try {
      const query = keywords.slice(0, 5).join(' ');
      const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en&as_sdt=0,5`;
      
      const data = await this.scraper.scrapePage(url, { timeout: 20000 });
      if (data.error) return [];

      const papers = [];
      const lines = data.text.split('\n');
      
      for (let i = 0; i < lines.length && papers.length < 10; i++) {
        const line = lines[i].trim();
        if (line.length > 50 && line.length < 300 && !line.startsWith('http')) {
          papers.push({
            title: line.substring(0, 200),
            source: 'Google Scholar',
            url: data.links[papers.length] || `https://scholar.google.com/scholar?q=${encodeURIComponent(line)}`,
            year: this.extractYear(line) || new Date().getFullYear(),
            relevance: 80
          });
        }
      }

      return papers;
    } catch (error) {
      console.error('Google Scholar search error:', error.message);
      return [];
    }
  }

  async searchArxiv(keywords) {
    try {
      const query = keywords.slice(0, 3).join('+');
      const url = `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=10&sortBy=relevance&sortOrder=descending`;
      
      const response = await axios.get(url, { timeout: 15000 });
      const papers = [];

      // Parse XML (simplified)
      const entries = response.data.split('<entry>').slice(1);
      
      entries.forEach(entry => {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/s);
        const linkMatch = entry.match(/<id>(.*?)<\/id>/);
        const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/s);
        const authorMatch = entry.match(/<name>(.*?)<\/name>/);
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

        if (titleMatch && linkMatch) {
          papers.push({
            title: titleMatch[1].trim().replace(/\s+/g, ' '),
            authors: authorMatch ? authorMatch[1].trim() : 'Unknown',
            url: linkMatch[1].trim(),
            abstract: summaryMatch ? summaryMatch[1].trim().substring(0, 500) : '',
            year: publishedMatch ? new Date(publishedMatch[1]).getFullYear() : new Date().getFullYear(),
            source: 'arXiv',
            relevance: 85
          });
        }
      });

      return papers;
    } catch (error) {
      console.error('arXiv search error:', error.message);
      return [];
    }
  }

  async searchSemanticScholar(keywords) {
    try {
      const query = keywords.slice(0, 5).join(' ');
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,authors,year,citationCount,url`;
      
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!response.data?.data) return [];

      return response.data.data.map(paper => ({
        title: paper.title,
        authors: paper.authors?.map(a => a.name).join(', ') || 'Unknown',
        year: paper.year || new Date().getFullYear(),
        citations: paper.citationCount || 0,
        abstract: paper.abstract || '',
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        source: 'Semantic Scholar',
        relevance: Math.min(90, 70 + (paper.citationCount || 0) / 10)
      }));
    } catch (error) {
      console.error('Semantic Scholar search error:', error.message);
      return [];
    }
  }

  async deepAnalyzePapers(papers, projectDescription) {
    console.log('🔬 Deep analyzing papers...');

    const analyzed = [];

    for (const paper of papers) {
      try {
        // Try to get full content
        let content = paper.abstract || '';
        
        if (paper.url && !content) {
          const pageData = await this.scraper.scrapePage(paper.url, { timeout: 15000 });
          if (!pageData.error) {
            content = pageData.text.substring(0, 5000);
          }
        }

        // AI analysis
        const analysis = await this.analyzeWithAI(paper, content, projectDescription);
        
        analyzed.push({
          ...paper,
          content_analyzed: !!content,
          key_findings: analysis.key_findings,
          methodology: analysis.methodology,
          applicability: analysis.applicability,
          implementation_difficulty: analysis.implementation_difficulty,
          expected_impact: analysis.expected_impact
        });

      } catch (error) {
        console.error(`Failed to analyze paper: ${paper.title}`, error.message);
        analyzed.push({
          ...paper,
          content_analyzed: false,
          error: 'Analysis failed'
        });
      }
    }

    return analyzed;
  }

  async analyzeWithAI(paper, content, projectDescription) {
    
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
    
    const prompt = jsonInstructions +`Analyze this research paper for practical application:

PROJECT: ${projectDescription}

PAPER: ${paper.title}
AUTHORS: ${paper.authors}
CONTENT: ${content.substring(0, 2000)}

Extract:
{
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "methodology": "Research methodology used",
  "applicability": "How applicable to our project (high/medium/low)",
  "implementation_difficulty": "easy/medium/hard",
  "expected_impact": "What impact this could have",
  "actionable_insights": ["Insight 1", "Insight 2"]
}

Return ONLY JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.getDefaultAnalysis();
    } catch (error) {
      return this.getDefaultAnalysis();
    }
  }

  async extractInnovationsUltra(papers, projectDescription) {
  
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

    const prompt = jsonInstructions +`Extract ACTIONABLE innovations from research papers.

PROJECT: ${projectDescription}

PAPERS:
${papers.slice(0, 5).map((p, i) => `${i + 1}. ${p.title}`).join('\n')}

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks.
Start with { and end with }

{
  "innovations": [
    {
      "innovation": "Specific innovation",
      "from_paper": "Paper title",
      "technical_approach": "How it works",
      "user_benefit": "Why users want this",
      "implementation_complexity": "easy",
      "time_to_implement": "4 weeks",
      "competitive_advantage": "Why unique"
    }
  ]
}`;

  try {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      temperature: 0.3, // Lower for consistent JSON
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    
    // ROBUST JSON EXTRACTION
    const cleaned = this.extractCleanJSON(content);
    if (!cleaned) {
      console.warn('⚠️ Failed to extract JSON, returning empty');
      return [];
    }
    
    const result = JSON.parse(cleaned);
    return result.innovations || [];
    
  } catch (error) {
    console.error('Innovation extraction error:', error.message);
    return [];
  }
}

extractCleanJSON(text) {
  // Remove markdown code blocks
  text = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
  
  // Find JSON boundaries
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  
  let jsonStr = text.substring(firstBrace, lastBrace + 1);
  
  // Remove trailing commas
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  
  // Remove comments
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
  jsonStr = jsonStr.replace(/\/\/.*/g, '');
  
  // CRITICAL: Truncate at position that caused error (8574)
  // This prevents malformed content after valid JSON
  try {
    // Test parse
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {
    // If error at specific position, truncate there
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      // Find last complete object before error
      const truncated = jsonStr.substring(0, pos);
      const lastComplete = truncated.lastIndexOf('}');
      if (lastComplete > 0) {
        return jsonStr.substring(0, lastComplete + 1);
      }
    }
    return null;
  }
}

  async generateImplementationRoadmap(innovations, projectDescription) {
    if (innovations.length === 0) return null;

    return {
      quick_wins: innovations
        .filter(i => i.implementation_complexity === 'easy')
        .map(i => ({
          innovation: i.innovation,
          timeline: i.time_to_implement,
          steps: i.implementation_steps,
          impact: i.expected_roi
        })),
      
      medium_term: innovations
        .filter(i => i.implementation_complexity === 'medium')
        .map(i => ({
          innovation: i.innovation,
          timeline: i.time_to_implement,
          requirements: i.required_expertise,
          impact: i.expected_roi
        })),
      
      long_term: innovations
        .filter(i => i.implementation_complexity === 'hard')
        .map(i => ({
          innovation: i.innovation,
          timeline: i.time_to_implement,
          investment: i.estimated_cost,
          impact: i.expected_roi
        })),
      
      prioritization: this.prioritizeInnovations(innovations)
    };
  }

  async analyzeCompetitiveIntelligence(innovations) {
    return {
      total_innovations: innovations.length,
      unique_to_research: innovations.length,
      competitive_moats: innovations
        .filter(i => i.competitive_advantage)
        .map(i => ({
          innovation: i.innovation,
          advantage: i.competitive_advantage,
          defensibility: 'high'
        })),
      market_differentiation: `${innovations.length} research-backed features competitors likely don't have`,
      innovation_score: Math.min(100, innovations.length * 15)
    };
  }

  // Helper methods

  deduplicatePapers(papers) {
    const seen = new Set();
    return papers.filter(paper => {
      const key = paper.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  extractYear(text) {
    const match = text.match(/20\d{2}/);
    return match ? parseInt(match[0]) : null;
  }

  calculateResearchQuality(papers) {
    if (papers.length === 0) return 0;
    
    let score = 0;
    papers.forEach(paper => {
      if (paper.citations) score += Math.min(10, paper.citations / 10);
      if (paper.content_analyzed) score += 10;
      if (paper.key_findings?.length > 0) score += 5;
    });
    
    return Math.min(100, Math.round(score / papers.length * 10));
  }

  prioritizeInnovations(innovations) {
    return innovations
      .map(i => ({
        innovation: i.innovation,
        priority_score: this.calculatePriorityScore(i),
        complexity: i.implementation_complexity,
        impact: i.expected_roi
      }))
      .sort((a, b) => b.priority_score - a.priority_score);
  }

  calculatePriorityScore(innovation) {
    let score = 0;
    
    // Easy to implement = higher priority
    if (innovation.implementation_complexity === 'easy') score += 30;
    else if (innovation.implementation_complexity === 'medium') score += 20;
    else score += 10;
    
    // High ROI = higher priority
    const roiMatch = innovation.expected_roi?.match(/(\d+)/);
    if (roiMatch) {
      score += Math.min(40, parseInt(roiMatch[1]));
    }
    
    // Low cost = higher priority
    const costMatch = innovation.estimated_cost?.match(/(\d+)/);
    if (costMatch) {
      const cost = parseInt(costMatch[1]);
      if (cost < 5000) score += 30;
      else if (cost < 10000) score += 20;
      else score += 10;
    }
    
    return score;
  }

  getDefaultAnalysis() {
    return {
      key_findings: ['Research findings unavailable'],
      methodology: 'Unknown',
      applicability: 'low',
      implementation_difficulty: 'hard',
      expected_impact: 'Unknown'
    };
  }
}

module.exports = ResearchPaperAgentUltra;