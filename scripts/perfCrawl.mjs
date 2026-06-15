#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import orchestrateCrawl from '../src/crawler/index.js';
import { getFetchTelemetry, resetFetchTelemetry } from '../src/crawler/fetchPool.js';

function human(ms) {
  return `${ms}ms`;
}

function categorizeFailure(statusCode, error) {
  if (!statusCode && error && error.includes('TIMEOUT')) return 'TIMEOUT';
  if (!statusCode && error && error.includes('ECONNREFUSED')) return 'CONNECTION_REFUSED';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode >= 500) return '5XX_ERROR';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return '404_NOT_FOUND';
  if (statusCode >= 400) return '4XX_ERROR';
  if (error) return 'UNKNOWN_ERROR';
  return 'UNKNOWN';
}

async function run() {
  const target = process.argv[2] || 'https://example.com/';
  console.log('perfCrawl: starting run()');
  const outDir = path.resolve('./reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  resetFetchTelemetry();

  console.log(`Starting instrumented crawl for: ${target}`);
  const start = Date.now();

  const onProgress = (pct, msg, fields, done, total) => {
    process.stdout.write(`\r[${String(pct).padStart(3)}%] ${msg} (${done}/${total})`);
  };

  let result;
  try {
    result = await orchestrateCrawl(target, onProgress);
  } catch (err) {
    console.error('\nCrawl failed:', err.message || err);
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

  // compute duration percentiles
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

  const slug = `perf-report-${Date.now()}`;
  const jsonFile = path.join(outDir, `${slug}.json`);
  const txtFile = path.join(outDir, `${slug}.txt`);

  fs.writeFileSync(jsonFile, JSON.stringify(stats, null, 2), 'utf8');

  const lines = [];
  lines.push(`Performance Crawl Report`);
  lines.push(`Target: ${target}`);
  lines.push(`Timestamp: ${stats.timestamp}`);
  lines.push(`Crawl duration: ${human(stats.crawlDurationMs)}`);
  lines.push(`Pages visited: ${stats.pagesVisited} (ok: ${stats.pagesFetchedOk}, failed: ${stats.pagesFetchFailed})`);
  lines.push(`Fetch requests: ${stats.fetchStats.totalRequests} (success: ${stats.fetchStats.successes}, failures: ${stats.fetchStats.failures})`);
  lines.push(`Avg fetch: ${human(stats.fetchStats.avgMs)}, p50: ${human(stats.fetchStats.p50)}, p90: ${human(stats.fetchStats.p90)}, p95: ${human(stats.fetchStats.p95)}`);
  lines.push('Slow URLs:');
  if (stats.fetchStats.slowUrls && stats.fetchStats.slowUrls.length) {
    for (const s of stats.fetchStats.slowUrls.slice(0,50)) {
      lines.push(` - ${s.url} [status=${s.status || 'N/A'}] ${human(s.duration)} ${s.error ? `error=${s.error}` : ''}`);
    }
  } else {
    lines.push(' - none');
  }

  fs.writeFileSync(txtFile, lines.join('\n'), 'utf8');

  // Write failure log if there are failures
  if (telemetry.slowUrls && telemetry.slowUrls.length > 0) {
    const failedUrls = telemetry.slowUrls.filter(u => u.error || (u.status && u.status >= 400));
    if (failedUrls.length > 0) {
      const failureLines = ['# Failure Log\n'];
      const failuresByCategory = {};
      for (const u of failedUrls) {
        const category = categorizeFailure(u.status, u.error);
        if (!failuresByCategory[category]) failuresByCategory[category] = [];
        failuresByCategory[category].push(u);
      }
      for (const [category, urls] of Object.entries(failuresByCategory)) {
        failureLines.push(`\n## ${category} (${urls.length} failures)`);
        for (const u of urls.slice(0, 20)) {
          failureLines.push(`- ${u.url} [${u.status}] ${u.error ? `error: ${u.error}` : ''}`);
        }
      }
      const failureFile = path.join(outDir, `crawl-failures-${Date.now()}.log`);
      fs.writeFileSync(failureFile, failureLines.join('\n'), 'utf8');
      console.log('Failure log written:', failureFile);
    }
  }

  console.log('\nReport written:', jsonFile, txtFile);
}

export { run };

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err)=>{ console.error('Fatal:', err); process.exit(3); });
}
