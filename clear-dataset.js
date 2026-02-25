const db = require('./database');

const dataset = process.argv[2];

if (!dataset) {
  console.log('Usage: node clear-dataset.js <dataset>');
  console.log('Available datasets: fruitsA, personal');
  process.exit(1);
}

console.log(`Clearing dataset: ${dataset}`);

db.prepare('DELETE FROM pages WHERE dataset = ?').run(dataset);
db.prepare('DELETE FROM links WHERE dataset = ?').run(dataset);
db.prepare('DELETE FROM word_frequencies WHERE dataset = ?').run(dataset);

console.log(`Dataset ${dataset} cleared successfully!`);
