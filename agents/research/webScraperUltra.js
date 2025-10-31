// agents/research/webScraperUltra.js
// ULTRA Web Scraper - Real scraping with multiple fallbacks + intelligence

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

class WebScraperUltra {
  constructor() {
    this.browser = null;
    this.browserReady = false;
    this.maxRetries = 3;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  async initBrowser() {
    if (this.browser && this.browserReady) return this.browser;

    try {
      console.log('🌐 Initializing browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      this.browserReady = true;
      console.log('✅ Browser ready');
      return this.browser;
    } catch (error) {
      console.error('❌ Browser launch failed:', error.message);
      this.browserReady = false;
      return null;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserReady = false;
      console.log('🔌 Browser closed');
    }
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // ULTRA SCRAPING WITH MULTIPLE FALLBACKS
  async scrapePage(url, options = {}) {
    const cacheKey = `page_${url}`;
    const cached = cache.get(cacheKey);
    if (cached && !options.skipCache) {
      console.log(`📦 Cache hit: ${url}`);
      return cached;
    }

    console.log(`🌐 Scraping: ${url}`);

    // Try methods in order: Browser -> Axios -> Fallback
    const methods = [
      () => this.scrapeWithBrowser(url, options),
      () => this.scrapeWithAxios(url, options),
      () => this.scrapeFallback(url, options)
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        const result = await methods[i]();
        if (result && !result.error) {
          cache.set(cacheKey, result);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ Method ${i + 1} failed: ${error.message}`);
        if (i === methods.length - 1) {
          return { error: 'All scraping methods failed', url };
        }
      }
    }

    return { error: 'Scraping failed', url };
  }

  // METHOD 1: Browser-based (most powerful)
  async scrapeWithBrowser(url, options) {
    const browser = await this.initBrowser();
    if (!browser) throw new Error('Browser not available');

    const context = await browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 30000
      });

      // Wait for dynamic content
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const data = {
        url,
        title: $('title').text().trim(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        metaKeywords: $('meta[name="keywords"]').attr('content') || '',
        headings: this.extractHeadings($),
        links: this.extractLinks($, url),
        images: this.extractImages($, url),
        text: this.extractText($),
        structured: this.extractStructuredData($),
        social: this.extractSocialLinks($),
        contactInfo: this.extractContactInfo($),
        pricing: this.extractPricing($),
        features: this.extractFeatures($),
        method: 'browser',
        scrapedAt: new Date().toISOString()
      };

      await context.close();
      return data;
    } catch (error) {
      await context.close().catch(() => {});
      throw error;
    }
  }

  // METHOD 2: Axios (fast, lightweight)
  async scrapeWithAxios(url, options) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: options.timeout || 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    return {
      url,
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      headings: this.extractHeadings($),
      links: this.extractLinks($, url),
      text: this.extractText($),
      pricing: this.extractPricing($),
      features: this.extractFeatures($),
      method: 'axios',
      scrapedAt: new Date().toISOString()
    };
  }

  // METHOD 3: Minimal fallback
  async scrapeFallback(url, options) {
    console.log(`📡 Using minimal fallback for: ${url}`);
    
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 10000
      });

      return {
        url,
        title: 'Scraped via fallback',
        text: response.data.substring(0, 5000),
        method: 'fallback',
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Fallback failed: ${error.message}`);
    }
  }

  // GOOGLE SEARCH WITH REAL RESULTS
  async searchGoogle(query, numResults = 10) {
    const cacheKey = `google_${query}_${numResults}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    console.log(`🔍 Google search: "${query}"`);

    const browser = await this.initBrowser();
    if (!browser) {
      console.warn('⚠️ Browser not available, using DuckDuckGo');
      return await this.searchDuckDuckGo(query, numResults);
    }

    try {
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent()
      });
      const page = await context.newPage();

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const results = [];
      $('div.g, div[data-sokoban-container]').each((i, elem) => {
        const $elem = $(elem);
        const title = $elem.find('h3').first().text().trim();
        const link = $elem.find('a').first().attr('href');
        const snippet = $elem.find('.VwiC3b, .yXK7lf, .s').first().text().trim();

        if (title && link && link.startsWith('http')) {
          results.push({
            title,
            url: link,
            snippet: snippet || 'No description available',
            source: 'Google'
          });
        }
      });

      await context.close();

      console.log(`✅ Found ${results.length} Google results`);
      cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('❌ Google search failed:', error.message);
      return await this.searchDuckDuckGo(query, numResults);
    }
  }

  // DUCKDUCKGO FALLBACK
  async searchDuckDuckGo(query, numResults = 10) {
    try {
      const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result__body').each((i, elem) => {
        if (i >= numResults) return false;
        
        const $elem = $(elem);
        const title = $elem.find('.result__title').text().trim();
        const link = $elem.find('.result__url').attr('href');
        const snippet = $elem.find('.result__snippet').text().trim();

        if (title && link) {
          results.push({
            title,
            url: link.startsWith('http') ? link : `https://${link}`,
            snippet: snippet || 'No description',
            source: 'DuckDuckGo'
          });
        }
      });

      console.log(`✅ Found ${results.length} DuckDuckGo results`);
      return results;
    } catch (error) {
      console.error('❌ DuckDuckGo search failed:', error.message);
      return [];
    }
  }

  // SCRAPE MULTIPLE PAGES IN PARALLEL
  async scrapeMultiple(urls, options = {}) {
    console.log(`🌐 Scraping ${urls.length} URLs in parallel...`);

    const maxConcurrent = options.maxConcurrent || 3;
    const results = [];

    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.scrapePage(url, options))
      );

      batchResults.forEach((result, idx) => {
        const url = batch[idx];
        if (result.status === 'fulfilled' && !result.value.error) {
          results.push(result.value);
        } else {
          console.warn(`⚠️ Failed to scrape: ${url}`);
          results.push({ url, error: 'Scraping failed' });
        }
      });

      // Rate limiting between batches
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`✅ Scraped ${results.filter(r => !r.error).length}/${urls.length} successfully`);
    return results;
  }

  // INTELLIGENT DATA EXTRACTORS
  extractHeadings($) {
    const headings = [];
    $('h1, h2, h3').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 3 && text.length < 200) {
        headings.push(text);
      }
    });
    return headings.slice(0, 20);
  }

  extractLinks($, baseUrl) {
    const links = new Set();
    $('a[href]').each((i, elem) => {
      let href = $(elem).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const url = new URL(href, baseUrl);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            links.add(url.href);
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    return Array.from(links).slice(0, 50);
  }

  extractImages($, baseUrl) {
    const images = new Set();
    $('img[src]').each((i, elem) => {
      let src = $(elem).attr('src');
      if (src) {
        try {
          const url = new URL(src, baseUrl);
          images.add(url.href);
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    return Array.from(images).slice(0, 20);
  }

  extractText($) {
    // Remove scripts, styles, and hidden elements
    $('script, style, noscript, iframe, [style*="display: none"], [style*="display:none"]').remove();
    
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 10000);
  }

  extractStructuredData($) {
    const structured = [];
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        structured.push(data);
      } catch (e) {
        // Invalid JSON, skip
      }
    });
    return structured;
  }

  extractSocialLinks($) {
    const social = {};
    const platforms = {
      facebook: /facebook\.com/,
      twitter: /twitter\.com|x\.com/,
      linkedin: /linkedin\.com/,
      instagram: /instagram\.com/,
      youtube: /youtube\.com/,
      github: /github\.com/
    };

    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        for (const [platform, regex] of Object.entries(platforms)) {
          if (regex.test(href) && !social[platform]) {
            social[platform] = href;
          }
        }
      }
    });

    return social;
  }

  extractContactInfo($) {
    const contact = {};
    
    // Email
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const text = $('body').text();
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      contact.email = emails[0];
    }

    // Phone
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
      contact.phone = phones[0];
    }

    return contact;
  }

  extractPricing($) {
    const prices = [];
    const priceRegex = /\$\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*\/\s*(?:month|mo|year|yr))?/gi;
    
    $('body').find('*').each((i, elem) => {
      const text = $(elem).text();
      const matches = text.match(priceRegex);
      if (matches) {
        prices.push(...matches);
      }
    });

    return [...new Set(prices)].slice(0, 10);
  }

  extractFeatures($) {
    const features = [];
    
    // Look for common feature indicators
    const featureSelectors = [
      '.features li',
      '.feature-list li',
      '[class*="feature"] h3',
      '[class*="benefit"] h3',
      'ul[class*="feature"] li',
      'ul[class*="benefit"] li'
    ];

    featureSelectors.forEach(selector => {
      $(selector).each((i, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length > 5 && text.length < 200) {
          features.push(text);
        }
      });
    });

    return [...new Set(features)].slice(0, 20);
  }

  // EXTRACT REVIEWS FROM PAGE
  async extractReviews(url, selector = '.review, [class*="review"]') {
    console.log(`⭐ Extracting reviews from: ${url}`);

    const data = await this.scrapePage(url);
    if (data.error) return [];

    const $ = cheerio.load(data.text);
    const reviews = [];

    $(selector).each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text().trim();
      const rating = $elem.find('[class*="rating"], [class*="star"]').text();
      
      if (text && text.length > 20) {
        reviews.push({
          text: text.substring(0, 500),
          rating: rating || 'N/A',
          source: url
        });
      }
    });

    console.log(`✅ Extracted ${reviews.length} reviews`);
    return reviews;
  }

  // SCRAPE PRODUCT HUNT
  async scrapeProductHunt(query) {
    const url = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`;
    console.log(`🏆 Scraping Product Hunt: ${query}`);

    try {
      const data = await this.scrapePage(url, { timeout: 20000 });
      if (data.error) return [];

      const products = [];
      const lines = data.text.split('\n');

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 30 && trimmed.length < 200) {
          products.push({
            name: trimmed.substring(0, 100),
            url: `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`,
            source: 'Product Hunt'
          });
        }
      });

      return products.slice(0, 5);
    } catch (error) {
      console.error('Product Hunt scraping failed:', error.message);
      return [];
    }
  }

  clearCache() {
    cache.flushAll();
    console.log('🗑️ Cache cleared');
  }
}

module.exports = WebScraperUltra;