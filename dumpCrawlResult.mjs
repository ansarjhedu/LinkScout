import fs from 'fs';

// Ensure environment variables are set before importing crawler modules
process.env.VITE_MAX_CRAWL_PAGES = process.env.VITE_MAX_CRAWL_PAGES || '5';
process.env.VITE_FETCH_TIMEOUT_MS = process.env.VITE_FETCH_TIMEOUT_MS || '10000';
process.env.VITE_SITEMAP_FETCH_TIMEOUT_MS = process.env.VITE_SITEMAP_FETCH_TIMEOUT_MS || '2000';
process.env.VITE_CRAWL_CONCURRENCY = process.env.VITE_CRAWL_CONCURRENCY || '2';

const { default: orchestrateCrawl } = await import('./src/crawler/index.js');

async function run() {
  try {
    const result = await orchestrateCrawl('https://texasmotorsports.com', (percent, stepName, fields, visited, links, currentUrl) => {
      if (visited % 10 === 0) {
        console.error('PROGRESS', percent, stepName, 'visited', visited, 'links', links, 'url', currentUrl || '-');
      }
    });
    fs.writeFileSync('crawl-result.json', JSON.stringify(result, null, 2));
    console.error('WROTE crawl-result.json');
  } catch (err) {
    fs.writeFileSync('crawl-result-error.json', JSON.stringify({ message: err.message, stack: err.stack }, null, 2));
    console.error('ERROR writing crawl-result-error.json');
    process.exit(1);
  }
}

run();
