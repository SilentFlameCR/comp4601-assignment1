const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');
const { URL } = require('url');

class WebCrawler {
  constructor(dataset, seedUrl, maxPages = 500) {
    this.dataset = dataset;
    this.seedUrl = seedUrl;
    this.maxPages = maxPages;
    this.visitedUrls = new Set();
    this.queue = [];
    this.pageCount = 0;
  }

  async crawl() {
    console.log(`Starting crawl for dataset: ${this.dataset}`);
    console.log(`Seed URL: ${this.seedUrl}`);
    console.log(`Max pages: ${this.maxPages}\n`);

    if (this.dataset === 'fruitsA') {
      for (let i = 0; i < 100; i++) {
        const url = `https://people.scs.carleton.ca/~avamckenney/fruitsA/N-${i}.html`;
        this.queue.push(url);
      }
    } else {
      this.queue.push(this.seedUrl);
    }

    while (this.queue.length > 0 && this.pageCount < this.maxPages) {
      const url = this.queue.shift();

      if (this.visitedUrls.has(url)) {
        continue;
      }

      await this.crawlPage(url);
      await this.sleep(100);
    }

    console.log(`\nCrawl complete! Total pages: ${this.pageCount}`);
  }

  async crawlPage(url) {
    try {
      url = this.normalizeUrl(url);
      this.visitedUrls.add(url);
      this.pageCount++;

      console.log(`[${this.pageCount}/${this.maxPages}] Crawling: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.status === 404) {
        console.log(`  [404] Page not found, skipping...`);
        this.savePage(url, 'Page Deleted', '<html><body>Page Deleted</body></html>', []);
        return;
      }

      const html = response.data;
      const $ = cheerio.load(html);

      const title = $('title').text().trim() || 'No Title';
      
      const textContent = $('p').map((i, el) => $(el).text()).get().join(' ');

      const links = [];
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          try {
            let absoluteUrl = new URL(href, url).href;
            absoluteUrl = this.normalizeUrl(absoluteUrl);
            links.push(absoluteUrl);

            if (!this.visitedUrls.has(absoluteUrl) && !this.queue.includes(absoluteUrl)) {
              if (this.shouldCrawl(absoluteUrl)) {
                this.queue.push(absoluteUrl);
              }
            }
          } catch (e) {
          }
        }
      });

      this.savePage(url, title, html, links);
      this.saveWordFrequencies(url, textContent);

      console.log(`  Title: ${title}`);
      console.log(`  Found ${links.length} links`);

    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`  [404] Page not found, marking as deleted...`);
        this.savePage(url, 'Page Deleted', '<html><body>Page Deleted</body></html>', []);
      } else {
        console.error(`  Error crawling ${url}:`, error.message);
      }
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      let normalized = urlObj.href;
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (e) {
      return url;
    }
  }

  shouldCrawl(url) {
    if (this.dataset === 'fruitsA') {
      return url.includes('people.scs.carleton.ca/~avamckenney/fruitsA/');
    } else if (this.dataset === 'personal') {
      return url.includes('myanimelist.net/anime/') && /\/anime\/\d+/.test(url);
    }
    return false;
  }

  savePage(url, title, content, links) {
    const insertPage = db.prepare(`
      INSERT OR REPLACE INTO pages (dataset, url, title, content)
      VALUES (?, ?, ?, ?)
    `);
    insertPage.run(this.dataset, url, title, content);

    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO links (dataset, from_url, to_url)
      VALUES (?, ?, ?)
    `);

    for (const link of links) {
      insertLink.run(this.dataset, url, link);
    }
  }

  saveWordFrequencies(url, text) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);

    const wordCounts = new Map();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const insertWord = db.prepare(`
      INSERT OR REPLACE INTO word_frequencies (dataset, url, word, frequency)
      VALUES (?, ?, ?, ?)
    `);

    wordCounts.forEach((count, word) => {
      insertWord.run(this.dataset, url, word, count);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const datasetName = args[0];

  if (!datasetName) {
    console.log('Usage: node crawler.js <dataset>');
    console.log('Available datasets: fruitsA, personal');
    process.exit(1);
  }

  let seedUrl, maxPages;

  if (datasetName === 'fruitsA') {
    seedUrl = 'https://people.scs.carleton.ca/~avamckenney/fruitsA/N-0.html';
    maxPages = 100;
  } else if (datasetName === 'personal') {
    seedUrl = 'https://myanimelist.net/anime/56009';
    maxPages = 1000;
  } else {
    console.error(`Unknown dataset: ${datasetName}`);
    console.log('Available datasets: fruitsA, personal');
    process.exit(1);
  }

  const crawler = new WebCrawler(datasetName, seedUrl, maxPages);

  try {
    await crawler.crawl();
    console.log('\nCrawl successful!');
    process.exit(0);
  } catch (error) {
    console.error('Crawl failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WebCrawler;
