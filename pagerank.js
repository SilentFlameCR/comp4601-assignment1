const db = require('./database');

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

async function calculatePageRank(dataset) {
  console.log(`\nCalculating PageRank for dataset: ${dataset}`);
  
  const alpha = 0.1;
  const epsilon = 0.0001;

  const pages = db.prepare('SELECT url FROM pages WHERE dataset = ?').all(dataset);
  
  if (pages.length === 0) {
    console.log('No pages found for dataset');
    return;
  }

  const urls = pages.map(p => p.url);
  const N = urls.length;
  const urlToIdx = {};
  urls.forEach((url, idx) => {
    urlToIdx[url] = idx;
  });

  console.log(`Total pages: ${N}`);

  const links = db.prepare('SELECT from_url, to_url FROM links WHERE dataset = ?').all(dataset);
  console.log(`Total links: ${links.length}`);

  const outgoing = Array.from({ length: N }, () => []);
  
  for (const link of links) {
    const fromIdx = urlToIdx[link.from_url];
    const toIdx = urlToIdx[link.to_url];
    
    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      outgoing[fromIdx].push(toIdx);
    }
  }

  let pr = new Array(N).fill(1.0 / N);
  let iterations = 0;

  while (true) {
    iterations++;
    const next = new Array(N).fill(alpha / N);

    let danglingMass = 0;
    for (let j = 0; j < N; j++) {
      if (outgoing[j].length === 0) {
        danglingMass += pr[j];
      } else {
        const share = pr[j] / outgoing[j].length;
        for (const i of outgoing[j]) {
          next[i] += (1 - alpha) * share;
        }
      }
    }

    if (danglingMass > 0) {
      const add = (1 - alpha) * (danglingMass / N);
      for (let i = 0; i < N; i++) {
        next[i] += add;
      }
    }

    const dist = euclideanDistance(pr, next);
    pr = next;

    if (dist < epsilon) {
      console.log(`Converged after ${iterations} iterations`);
      break;
    }

    if (iterations > 1000) {
      console.log(`Stopped after ${iterations} iterations (max reached)`);
      break;
    }
  }

  const updateStmt = db.prepare('UPDATE pages SET pagerank = ? WHERE dataset = ? AND url = ?');
  const updateMany = db.transaction((rankings) => {
    for (const { url, rank } of rankings) {
      updateStmt.run(rank, dataset, url);
    }
  });

  const rankings = urls.map((url, i) => ({ url, rank: pr[i] }));
  updateMany(rankings);

  const topPages = rankings.sort((a, b) => b.rank - a.rank).slice(0, 10);
  console.log('\nTop 10 pages by PageRank:');
  topPages.forEach((page, i) => {
    console.log(`${i + 1}. ${page.url.substring(0, 80)} - ${page.rank.toFixed(6)}`);
  });

  console.log('\nPageRank calculation complete!');
}

async function main() {
  const args = process.argv.slice(2);
  const dataset = args[0];

  if (!dataset) {
    console.log('Usage: node pagerank.js <dataset>');
    console.log('Available datasets: fruitsA, personal');
    process.exit(1);
  }

  try {
    await calculatePageRank(dataset);
    process.exit(0);
  } catch (error) {
    console.error('PageRank calculation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculatePageRank };
