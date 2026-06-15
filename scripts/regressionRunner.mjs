#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Configure crawl limits before importing the crawler so crawlConfig picks them up
process.env.VITE_MAX_CRAWL_PAGES = process.env.VITE_MAX_CRAWL_PAGES || '100';
process.env.VITE_CRAWL_CONCURRENCY = process.env.VITE_CRAWL_CONCURRENCY || '4';
process.env.VITE_CRAWL_RATE_LIMIT_MS = process.env.VITE_CRAWL_RATE_LIMIT_MS || '100';

const OUT_DIR = path.resolve(process.cwd(), 'regression_results');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sites = [
  'https://www.columbiatnpowersports.com/',
  'https://www.cyclegear.com/',
  'https://www.revzilla.com/',
  'https://www.basspro.com/',
  'https://www.cabelas.com/',
  'https://www.cycletrader.com/',
  'https://www.rockymountainatvmc.com/',
  'https://www.genuinepowersports.com/',
  'https://www.motorcycle-superstore.com/',
  'https://www.sportsmansguide.com/'
];

function safeHost(u) {
  try {
    const p = new URL(u).hostname;
    return p.replace(/[^a-z0-9.-]+/gi, '-');
  } catch (e) {
    return u.replace(/[^a-z0-9.-]+/gi, '-');
  }
}

async function run() {
  console.log('Regression runner starting; sites:', sites.length);

  const { default: orchestrateCrawl } = await import('../src/crawler/index.js');

  const summary = [];

  for (const site of sites) {
    const host = safeHost(site);
    console.log(`\n--- Starting crawl for ${site} -> ${host} ---`);
    const progress = (pct, stepName, fields, visited, links) => {
      process.stdout.write(`\r[${host}] ${pct}% ${stepName} visited=${visited} links=${links}`);
    };

    try {
      const result = await orchestrateCrawl(site, progress);
      const outPath = path.join(OUT_DIR, `${host}.json`);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      summary.push({ site, host, pages: result.meta.totalPagesVisited || result.pages || 0, links: result.meta.linksDiscovered || 0, durationMs: result.meta.crawlDurationMs || 0, ok: true });
      console.log(`\nSaved result: ${outPath}`);
    } catch (err) {
      const errPath = path.join(OUT_DIR, `${host}.error.json`);
      const payload = { site, error: String(err && err.message ? err.message : err) };
      fs.writeFileSync(errPath, JSON.stringify(payload, null, 2));
      summary.push({ site, host, pages: 0, links: 0, durationMs: 0, ok: false, error: payload.error });
      console.error(`\nCrawl failed for ${site}: ${payload.error}`);
    }
  }

  const summaryPath = path.join(OUT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('\nRegression run complete. Summary written to', summaryPath);
  console.table(summary.map(s => ({ site: s.site, pages: s.pages, links: s.links, durationMs: s.durationMs, ok: s.ok })));
}

run().catch((e) => {
  console.error('Regression runner fatal error:', e);
  process.exit(1);
});
