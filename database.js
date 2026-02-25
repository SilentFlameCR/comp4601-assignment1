const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'searchengine.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      content TEXT,
      pagerank REAL DEFAULT 0,
      UNIQUE(dataset, url)
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT NOT NULL,
      from_url TEXT NOT NULL,
      to_url TEXT NOT NULL,
      UNIQUE(dataset, from_url, to_url)
    );

    CREATE TABLE IF NOT EXISTS word_frequencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT NOT NULL,
      url TEXT NOT NULL,
      word TEXT NOT NULL,
      frequency INTEGER NOT NULL,
      UNIQUE(dataset, url, word)
    );

    CREATE INDEX IF NOT EXISTS idx_pages_dataset ON pages(dataset);
    CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(dataset, url);
    CREATE INDEX IF NOT EXISTS idx_links_dataset ON links(dataset);
    CREATE INDEX IF NOT EXISTS idx_links_from ON links(dataset, from_url);
    CREATE INDEX IF NOT EXISTS idx_links_to ON links(dataset, to_url);
    CREATE INDEX IF NOT EXISTS idx_word_freq ON word_frequencies(dataset, url);
  `);

  console.log('Database initialized');
}

initializeDatabase();

module.exports = db;
