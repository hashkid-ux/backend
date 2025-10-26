const { chromium } = require('playwright');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

// Cache scraped data for 24 hours to save costs
const cache = new NodeCache({ stdTTL: 86400 });

class WebScraper {
  constructor() {
    this.browser = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // Scrape a single page
  async scrapePage(url, options = {}) {
    const cacheKey = `page_${url}`;
    const cached = cache.get(cacheKey);
    if (cached && !options.skipCache) {
      console.log(`📦 Using cached data for ${url}`);
      return cached;
    }

    console.log(`🌐 Scraping: ${url}`);

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 }
      });

      const page = await context.newPage();
      
      // Set timeout
      await page.goto(url, { 
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 30000 
      });

      // Wait for specific selector if provided
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      // Get page content
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract data based on options
      let data = {};

      if (options.extract) {
        data = this.extractData($, options.extract);
      } else {
        // Default extraction
        data = {
          title: $('title').text(),
          metaDescription: $('meta[name="description"]').attr('content'),
          headings: $('h1, h2, h3').map((i, el) => $(el).text().trim()).get(),
          links: $('a').map((i, el) => $(el).attr('href')).get().filter(Boolean),
          text: $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000)
        };
      }

      // Take screenshot if needed
      if (options.screenshot) {
        data.screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: false 
        });
      }

      await context.close();

      // Cache result
      cache.set(cacheKey, data);

      return data;

    } catch (error) {
      console.error(`❌ Scraping error for ${url}:`, error.message);
      return { error: error.message, url };
    }
  }

  // Extract specific data using selectors
  extractData($, extractConfig) {
    const result = {};

    for (const [key, selector] of Object.entries(extractConfig)) {
      if (typeof selector === 'string') {
        result[key] = $(selector).text().trim();
      } else if (selector.type === 'array') {
        result[key] = $(selector.selector)
          .map((i, el) => $(el).text().trim())
          .get()
          .filter(Boolean);
      } else if (selector.type === 'attr') {
        result[key] = $(selector.selector).attr(selector.attr);
      }
    }

    return result;
  }

  // Scrape multiple pages in parallel
  async scrapeMultiple(urls, options = {}) {
    console.log(`🌐 Scraping ${urls.length} URLs...`);
    
    const results = await Promise.allSettled(
      urls.map(url => this.scrapePage(url, options))
    );

    return results.map((result, index) => ({
      url: urls[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  // Search Google and get top results
  async searchGoogle(query, numResults = 10) {
    const cacheKey = `google_${query}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    console.log(`🔍 Google search: "${query}"`);

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent()
      });
      const page = await context.newPage();

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

      // Wait a bit for results to load
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract search results
      const results = [];
      $('div.g').each((i, elem) => {
        const title = $(elem).find('h3').text();
        const link = $(elem).find('a').attr('href');
        const snippet = $(elem).find('.VwiC3b').text();

        if (title && link) {
          results.push({
            title: title.trim(),
            url: link,
            snippet: snippet.trim()
          });
        }
      });

      await context.close();

      cache.set(cacheKey, results);
      return results;

    } catch (error) {
      console.error('❌ Google search error:', error.message);
      return [];
    }
  }

  // Extract pricing from competitor page
  async extractPricing(url) {
    console.log(`💰 Extracting pricing from: ${url}`);

    try {
      const data = await this.scrapePage(url, {
        waitForSelector: 'body',
        timeout: 30000
      });

      // Look for common pricing patterns
      const priceRegex = /\$\d+(?:,\d{3})*(?:\.\d{2})?/g;
      const prices = data.text.match(priceRegex) || [];

      return {
        url,
        prices: [...new Set(prices)], // Remove duplicates
        rawText: data.text
      };

    } catch (error) {
      console.error(`❌ Pricing extraction error:`, error.message);
      return { url, prices: [], error: error.message };
    }
  }

  // Extract reviews from a page
  async extractReviews(url, reviewSelector = '.review') {
    console.log(`⭐ Extracting reviews from: ${url}`);

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const reviews = [];
      $(reviewSelector).each((i, elem) => {
        reviews.push({
          text: $(elem).text().trim(),
          rating: $(elem).find('[class*="rating"]').text() || 'N/A'
        });
      });

      await context.close();

      return reviews;

    } catch (error) {
      console.error(`❌ Review extraction error:`, error.message);
      return [];
    }
  }

  // Clear cache
  clearCache() {
    cache.flushAll();
    console.log('🗑️  Cache cleared');
  }
}

module.exports = WebScraper;