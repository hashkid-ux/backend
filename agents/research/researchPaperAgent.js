// backend/agents/research/researchPaperAgent.js
//const Anthropic = require('@anthropic-ai/sdk');
const AIClient = require('../../services/aiClient');
const axios = require('axios');
const WebScraper = require('./webScraper');

class ResearchPaperAgent {
  constructor(tier = 'premium') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);

    this.model = 'deepseek/deepseek-chat-v3.1:free';

    this.scraper = new WebScraper();
  }

  async findAndAnalyzeRelevantPapers(projectDescription, keywords) {
    console.log('📚 Research Paper Agent: Finding academic papers...');

    if (this.tier !== 'premium') {
      return {
        error: 'Research paper analysis requires Premium tier',
        upgrade_url: '/pricing'
      };
    }

    try {
      // Step 1: Search for papers on Google Scholar, arXiv, Semantic Scholar
      const papers = await this.searchAcademicPapers(keywords, projectDescription);

      // Step 2: Scrape and extract paper content
      const scrapedPapers = await this.scrapePaperContent(papers.slice(0, 5));

      // Step 3: AI analysis to extract innovations
      const innovations = await this.extractInnovations(scrapedPapers, projectDescription);

      // Step 4: Implementation recommendations
      const implementations = await this.generateImplementationPlan(innovations, projectDescription);

      await this.scraper.closeBrowser();

      return {
        papers_analyzed: scrapedPapers.length,
        papers: scrapedPapers.map(p => ({
          title: p.title,
          authors: p.authors,
          year: p.year,
          url: p.url,
          relevance_score: p.relevance
        })),
        innovations: innovations,
        implementation_plan: implementations,
        competitive_advantage: `Academic research-backed features that competitors likely don't have`
      };

    } catch (error) {
      console.error('❌ Research Paper Agent Error:', error);
      return {
        error: 'Failed to analyze research papers',
        message: error.message
      };
    }
  }

  async searchAcademicPapers(keywords, description) {
    console.log('🔍 Searching academic databases...');

    const searchQuery = this.createAcademicSearchQuery(keywords, description);
    const papers = [];

    // Search Google Scholar via web scraping
    try {
      const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(searchQuery)}&hl=en&as_sdt=0,5`;
      const scholarResults = await this.scraper.scrapePage(scholarUrl, {
        waitForSelector: '.gs_r',
        timeout: 15000
      });

      // Parse scholar results
      const $ = require('cheerio').load(scholarResults.text);
      $('.gs_r').each((i, elem) => {
        if (i < 10) { // Limit to top 10
          const title = $(elem).find('.gs_rt').text().trim();
          const link = $(elem).find('.gs_rt a').attr('href');
          const snippet = $(elem).find('.gs_rs').text().trim();
          const authors = $(elem).find('.gs_a').text().split('-')[0].trim();

          if (title && link) {
            papers.push({
              title,
              url: link,
              snippet,
              authors,
              source: 'Google Scholar'
            });
          }
        }
      });

    } catch (error) {
      console.error('Scholar search error:', error.message);
    }

    // Try arXiv API as backup
    try {
      const arxivQuery = keywords.slice(0, 3).join('+');
      const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${arxivQuery}&start=0&max_results=10`;
      
      const response = await axios.get(arxivUrl, { timeout: 10000 });
      
      // Parse XML (simplified - in production use xml2js)
      const entries = response.data.split('<entry>').slice(1);
      entries.forEach(entry => {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/s);
        const linkMatch = entry.match(/<id>(.*?)<\/id>/);
        const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/s);
        const authorMatch = entry.match(/<name>(.*?)<\/name>/);

        if (titleMatch && linkMatch) {
          papers.push({
            title: titleMatch[1].trim(),
            url: linkMatch[1].trim(),
            snippet: summaryMatch ? summaryMatch[1].trim().substring(0, 300) : '',
            authors: authorMatch ? authorMatch[1].trim() : 'Unknown',
            source: 'arXiv'
          });
        }
      });

    } catch (error) {
      console.error('arXiv search error:', error.message);
    }

    console.log(`📄 Found ${papers.length} potentially relevant papers`);
    return papers;
  }

  async scrapePaperContent(papers) {
    console.log('📖 Reading paper content...');

    const scrapedPapers = [];

    for (const paper of papers) {
      try {
        // Try to access paper (many are paywalled, so we extract what we can)
        const content = await this.scraper.scrapePage(paper.url, {
          timeout: 20000
        });

        if (content && !content.error) {
          scrapedPapers.push({
            ...paper,
            full_text: content.text.substring(0, 10000), // First 10k chars
            relevance: await this.calculateRelevance(paper, content.text),
            year: this.extractYear(content.text)
          });
        }
      } catch (error) {
        console.error(`Failed to scrape ${paper.title}:`, error.message);
        // Still include paper with limited info
        scrapedPapers.push({
          ...paper,
          full_text: paper.snippet,
          relevance: 50,
          year: 'Unknown'
        });
      }
    }

    return scrapedPapers.filter(p => p.relevance > 30);
  }

  async extractInnovations(papers, projectDescription) {
    console.log('💡 Extracting actionable innovations...');

    const prompt = `Analyze these research papers and extract innovations relevant to this project:

PROJECT: ${projectDescription}

PAPERS:
${papers.map((p, i) => `
Paper ${i + 1}: ${p.title}
Authors: ${p.authors}
Content: ${p.full_text.substring(0, 2000)}
`).join('\n\n')}

Extract ONLY innovations that:
1. Are technically feasible to implement
2. Would give a competitive advantage
3. Solve real user problems
4. Are not already common in the market

Return JSON:
{
  "innovations": [
    {
      "innovation": "Clear description",
      "from_paper": "Paper title",
      "technical_approach": "How it works",
      "user_benefit": "Why users would love this",
      "implementation_complexity": "low/medium/high",
      "competitive_advantage": "Why competitors don't have this",
      "how_to_implement": "Step-by-step guide for developers"
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.innovations || [];
      }

      return [];

    } catch (error) {
      console.error('Innovation extraction error:', error);
      return [];
    }
  }

  async generateImplementationPlan(innovations, projectDescription) {
    if (innovations.length === 0) return null;

    const prompt = `Create an implementation roadmap for these research-backed innovations:

PROJECT: ${projectDescription}

INNOVATIONS:
${JSON.stringify(innovations, null, 2)}

Create a practical implementation plan:

Return JSON:
{
  "quick_wins": [
    {
      "innovation": "which one",
      "timeline": "1-2 weeks",
      "resources_needed": ["developer", "designer"],
      "implementation_steps": ["step1", "step2"],
      "expected_impact": "user benefit"
    }
  ],
  "medium_term": [similar structure, 1-3 months],
  "long_term": [similar structure, 3-6 months],
  "total_competitive_advantage": "overall strategic benefit"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    } catch (error) {
      console.error('Implementation plan error:', error);
      return null;
    }
  }

  createAcademicSearchQuery(keywords, description) {
    // Create focused academic search query
    const domain = this.extractDomain(description);
    const topKeywords = keywords.slice(0, 3).join(' ');
    
    return `${topKeywords} ${domain} machine learning algorithm optimization`;
  }

  extractDomain(description) {
    const desc = description.toLowerCase();
    
    if (desc.includes('health') || desc.includes('medical')) return 'healthcare technology';
    if (desc.includes('finance') || desc.includes('payment')) return 'fintech';
    if (desc.includes('education') || desc.includes('learning')) return 'edtech';
    if (desc.includes('social') || desc.includes('network')) return 'social computing';
    if (desc.includes('e-commerce') || desc.includes('shop')) return 'e-commerce systems';
    
    return 'software engineering';
  }

  async calculateRelevance(paper, fullText) {
    // Simple relevance scoring
    const titleWords = paper.title.toLowerCase().split(' ');
    const textLower = fullText.toLowerCase();
    
    let score = 0;
    titleWords.forEach(word => {
      if (word.length > 4 && textLower.includes(word)) {
        score += 10;
      }
    });

    // Check for implementation keywords
    const implKeywords = ['algorithm', 'implementation', 'system', 'method', 'approach'];
    implKeywords.forEach(keyword => {
      if (textLower.includes(keyword)) score += 5;
    });

    return Math.min(100, score);
  }

  extractYear(text) {
    const yearMatch = text.match(/20\d{2}/);
    return yearMatch ? yearMatch[0] : 'Recent';
  }
}

module.exports = ResearchPaperAgent;