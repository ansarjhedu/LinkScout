import orchestrateCrawl from './src/crawler/index.js';

async function run() {
  try {
    const result = await orchestrateCrawl('https://texasmotorsports.com', (percent, stepName, fields, visited, links, currentUrl) => {
      console.error('PROGRESS', percent, stepName, 'visited', visited, 'links', links, 'url', currentUrl || '-');
    });
    console.error('DONE');
    console.log(JSON.stringify({ status: result.status, meta: result.meta, sections: Object.keys(result.sections || {}) }, null, 2));
  } catch (err) {
    console.error('FATAL ERROR', err);
    process.exit(1);
  }
}

run();
