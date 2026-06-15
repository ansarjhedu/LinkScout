#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
// Allow runtime overrides via command-line args by setting env vars before imports
const targetArg = process.argv[2] || 'https://example.com/';
const pageLimitArg = process.argv[3] || '10';
process.env.VITE_MAX_CRAWL_PAGES = process.env.VITE_MAX_CRAWL_PAGES || String(pageLimitArg);
process.env.VITE_CRAWL_CONCURRENCY = process.env.VITE_CRAWL_CONCURRENCY || '1';
process.env.VITE_CRAWL_RATE_LIMIT_MS = process.env.VITE_CRAWL_RATE_LIMIT_MS || '300';

import orchestrateCrawl from '../src/crawler/index.js';
import { getFetchTelemetry, resetFetchTelemetry } from '../src/crawler/fetchPool.js';

function human(ms) { return `${ms}ms`; }

async function run() {
  const target = targetArg;
  const pageLimit = Number(pageLimitArg) || 10;
  console.log('quickPerf: starting run()', { target, pageLimit });

  const outDir = path.resolve('./reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  resetFetchTelemetry();

  const start = Date.now();

  // orchestrateCrawl accepts optional overrides via second arg
  let result;
  try {
    // pass a no-op onProgress callback
    result = await orchestrateCrawl(target, () => {});
  } catch (err) {
    console.error('Crawl failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
    return;
  }

  const telemetry = getFetchTelemetry();
  const durationMs = Date.now() - start;

  const stats = {
    target,
    timestamp: new Date().toISOString(),
    crawlDurationMs: durationMs,
    pagesVisited: result?.meta?.totalPagesVisited || (result && result.pagesVisited) || 0,
    pagesFetchedOk: result?.meta?.pagesFetchedOk || 0,
    pagesFetchFailed: result?.meta?.pagesFetchFailed || 0,
    fetchTelemetry: telemetry,
  };

  const d = telemetry.durations.slice().sort((a,b)=>a-b);
  const pct = (p) => {
    if (!d.length) return 0;
    const idx = Math.min(d.length - 1, Math.floor((p/100) * d.length));
    return d[idx];
  };

  stats.fetchStats = {
    totalRequests: telemetry.totalRequests,
    successes: telemetry.successes,
    failures: telemetry.failures,
    avgMs: d.length ? Math.round(d.reduce((s,x)=>s+x,0)/d.length) : 0,
    p50: pct(50),
    p90: pct(90),
    p95: pct(95),
    slowUrls: telemetry.slowUrls,
  };

  const slug = `quick-perf-${Date.now()}`;
  const jsonFile = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(stats, null, 2), 'utf8');
  console.log('Quick report written:', jsonFile);
}

run().catch((err)=>{ console.error('Fatal:', err); process.exit(3); });

export { run };

/*
Note: This script calls orchestrateCrawl with an override option. The orchestrator
should accept an optional third argument with runtime overrides; if not, this
script will still call the default orchestrator which reads from config.
*/
