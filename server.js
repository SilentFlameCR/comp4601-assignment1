const express = require('express');
const db = require('./database');
const TFIDFIndex = require('./tfidf');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'pug');
app.set('views', './views');

const indexes = new Map();

async function initializeIndexes() {
  const datasets = ['fruitsA', 'personal'];
  
  for (const dataset of datasets) {
    try {
      const pages = db.prepare('SELECT url, title, content, pagerank FROM pages WHERE dataset = ?').all(dataset);
      if (pages.length > 0) {
        const index = new TFIDFIndex();
        index.buildIndex(pages);
        indexes.set(dataset, index);
        console.log(`Initialized TF-IDF index for ${dataset} with ${pages.length} documents`);
      }
    } catch (error) {
      console.error(`Error initializing index for ${dataset}:`, error);
    }
  }
}

initializeIndexes().catch(console.error);

app.get('/info', (req, res) => {
  res.json({
    name: 'MadiTook5898'
  });
});

app.get('/', (req, res) => {
  res.render('home', { 
    title: 'Search Engine - COMP 4601A Assignment 1'
  });
});

app.get('/fruitsA', async (req, res) => {
  try {
    const { q, boost, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const useBoost = boost === 'true';
    const resultLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    let index = indexes.get('fruitsA');
    if (!index) {
      const pages = db.prepare('SELECT url, title, content, pagerank FROM pages WHERE dataset = ?').all('fruitsA');
      if (pages.length === 0) {
        return res.status(404).json({ error: 'Dataset not found or empty' });
      }
      index = new TFIDFIndex();
      index.buildIndex(pages);
      indexes.set('fruitsA', index);
    }

    let results = index.search(q, resultLimit, useBoost);

    if (results.length < resultLimit) {
      const allPages = db.prepare('SELECT url, title, pagerank FROM pages WHERE dataset = ? LIMIT ?')
        .all('fruitsA', resultLimit);
      
      while (results.length < resultLimit && results.length < allPages.length) {
        const existingUrls = new Set(results.map(r => r.url));
        const additionalPage = allPages.find(p => !existingUrls.has(p.url));
        if (additionalPage) {
          results.push({
            url: additionalPage.url,
            title: additionalPage.title,
            score: 0,
            pr: additionalPage.pagerank || 0
          });
        } else {
          break;
        }
      }
    }

    results = results.slice(0, resultLimit);

    res.format({
      'application/json': function() {
        res.json({ 
          result: results.map(r => ({
            url: r.url,
            score: r.score,
            title: r.title,
            pr: r.pr
          }))
        });
      },
      'text/html': function() {
        res.render('search-results', {
          title: 'Search Results - fruitsA',
          dataset: 'fruitsA',
          query: q,
          boost: useBoost,
          limit: resultLimit,
          results: results
        });
      }
    });
  } catch (error) {
    console.error('Error in /fruitsA:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/personal', async (req, res) => {
  try {
    const { q, boost, limit } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const useBoost = boost === 'true';
    const resultLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    let index = indexes.get('personal');
    if (!index) {
      const pages = db.prepare('SELECT url, title, content, pagerank FROM pages WHERE dataset = ?').all('personal');
      if (pages.length === 0) {
        return res.status(404).json({ error: 'Dataset not found or empty' });
      }
      index = new TFIDFIndex();
      index.buildIndex(pages);
      indexes.set('personal', index);
    }

    let results = index.search(q, resultLimit, useBoost);

    if (results.length < resultLimit) {
      const allPages = db.prepare('SELECT url, title, pagerank FROM pages WHERE dataset = ? LIMIT ?')
        .all('personal', resultLimit);
      
      while (results.length < resultLimit && results.length < allPages.length) {
        const existingUrls = new Set(results.map(r => r.url));
        const additionalPage = allPages.find(p => !existingUrls.has(p.url));
        if (additionalPage) {
          results.push({
            url: additionalPage.url,
            title: additionalPage.title,
            score: 0,
            pr: additionalPage.pagerank || 0
          });
        } else {
          break;
        }
      }
    }

    results = results.slice(0, resultLimit);

    res.format({
      'application/json': function() {
        res.json({ 
          result: results.map(r => ({
            url: r.url,
            score: r.score,
            title: r.title,
            pr: r.pr
          }))
        });
      },
      'text/html': function() {
        res.render('search-results', {
          title: 'Search Results - personal',
          dataset: 'personal',
          query: q,
          boost: useBoost,
          limit: resultLimit,
          results: results
        });
      }
    });
  } catch (error) {
    console.error('Error in /personal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/page/:dataset/:pageId', (req, res) => {
  try {
    const { dataset, pageId } = req.params;
    
    const page = db.prepare('SELECT * FROM pages WHERE dataset = ? AND id = ?').get(dataset, pageId);
    
    if (!page) {
      return res.status(404).send('Page not found');
    }

    const incomingLinks = db.prepare(
      'SELECT from_url FROM links WHERE dataset = ? AND to_url = ?'
    ).all(dataset, page.url).map(row => row.from_url);

    const outgoingLinks = db.prepare(
      'SELECT to_url FROM links WHERE dataset = ? AND from_url = ?'
    ).all(dataset, page.url).map(row => row.to_url);

    const wordFreqs = db.prepare(
      'SELECT word, frequency FROM word_frequencies WHERE dataset = ? AND url = ? ORDER BY frequency DESC LIMIT 50'
    ).all(dataset, page.url);

    res.render('page-detail', {
      title: `${page.title} - Page Details`,
      dataset: dataset,
      page: page,
      incomingLinks: incomingLinks,
      outgoingLinks: outgoingLinks,
      wordFrequencies: wordFreqs
    });
  } catch (error) {
    console.error('Error fetching page details:', error);
    res.status(500).send('Internal server error');
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET / - Home page with search interface`);
  console.log(`  GET /fruitsA?q=<query>&boost=<true|false>&limit=<1-50>`);
  console.log(`  GET /personal?q=<query>&boost=<true|false>&limit=<1-50>`);
  console.log(`  GET /page/:dataset/:pageId - View page details`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close();
  process.exit(0);
});
