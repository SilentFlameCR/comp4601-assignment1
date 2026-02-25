const db = require('./database');

function normalizeUrl(url) {
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

const dataset = process.argv[2];

if (!dataset) {
  console.log('Usage: node deduplicate-urls.js <dataset>');
  console.log('Available datasets: fruitsA, personal');
  process.exit(1);
}

console.log(`Deduplicating URLs for dataset: ${dataset}\n`);

const pages = db.prepare('SELECT id, url, title, content, pagerank FROM pages WHERE dataset = ?').all(dataset);
console.log(`Found ${pages.length} pages`);

const urlMap = new Map();
const duplicates = [];

for (const page of pages) {
  const normalized = normalizeUrl(page.url);
  
  if (urlMap.has(normalized)) {
    const existing = urlMap.get(normalized);
    const keepHigherPR = page.pagerank > existing.pagerank;
    
    if (keepHigherPR) {
      duplicates.push(existing.id);
      urlMap.set(normalized, page);
    } else {
      duplicates.push(page.id);
    }
  } else {
    urlMap.set(normalized, page);
  }
}

console.log(`Found ${duplicates.length} duplicate URLs`);
console.log(`Keeping ${urlMap.size} unique URLs\n`);

if (duplicates.length > 0) {
  const deletePages = db.prepare('DELETE FROM pages WHERE id = ?');
  const deleteLinks = db.prepare('DELETE FROM links WHERE dataset = ? AND (from_url = ? OR to_url = ?)');
  const deleteWords = db.prepare('DELETE FROM word_frequencies WHERE dataset = ? AND url = ?');
  const updateUrl = db.prepare('UPDATE pages SET url = ? WHERE id = ?');
  
  const transaction = db.transaction(() => {
    for (const id of duplicates) {
      const page = pages.find(p => p.id === id);
      if (page) {
        deleteLinks.run(dataset, page.url, page.url);
        deleteWords.run(dataset, page.url);
        deletePages.run(id);
      }
    }
    
    for (const [normalized, page] of urlMap.entries()) {
      if (page.url !== normalized) {
        const oldUrl = page.url;
        updateUrl.run(normalized, page.id);
        db.prepare('UPDATE links SET from_url = ? WHERE dataset = ? AND from_url = ?').run(normalized, dataset, oldUrl);
        db.prepare('UPDATE links SET to_url = ? WHERE dataset = ? AND to_url = ?').run(normalized, dataset, oldUrl);
        db.prepare('UPDATE word_frequencies SET url = ? WHERE dataset = ? AND url = ?').run(normalized, dataset, oldUrl);
      }
    }
  });
  
  transaction();
  
  console.log('Deduplication complete!');
  console.log(`Deleted ${duplicates.length} duplicate pages`);
  console.log(`Normalized ${urlMap.size} URLs`);
} else {
  console.log('No duplicates found!');
}
