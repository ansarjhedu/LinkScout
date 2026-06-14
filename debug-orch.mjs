import orchestrateCrawl from './src/crawler/index.js';

const targetUrl = 'https://www.columbiatnpowersports.com';

async function main() {
  try {
    const result = await orchestrateCrawl(targetUrl, (percent, stepName, fields, visited, links) => {
      console.log(`PROGRESS ${percent} ${stepName} visited=${visited} links=${links}`);
    });
    console.log('DONE', JSON.stringify({ crawledUrl: result.meta?.crawledUrl, pages: result.meta?.totalPagesVisited, fields: Object.keys(result.sections || {}).length }, null, 2));
  } catch (err) {
    console.error('ORCH ERROR', err?.message || err, err?.stack || 'no stack');
    process.exit(1);
  }
}

main();
