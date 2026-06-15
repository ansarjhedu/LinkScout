#!/usr/bin/env node
/**
 * Production Crawl Runner with Concurrency Override
 * Sets environment variables BEFORE importing the crawler to ensure they take effect
 */
import fs from 'fs';
import path from 'path';

// Set environment variables FIRST, before any crawler imports
process.env.VITE_CRAWL_CONCURRENCY = '4';
process.env.VITE_CRAWL_RATE_LIMIT_MS = '150';
process.env.VITE_MAX_CRAWL_PAGES = '500';

// Now import after env vars are set
import orchestrateCrawl from '../src/crawler/index.js';
import getLogger from '../src/utils/logger.js';
import { getFetchTelemetry, resetFetchTelemetry } from '../src/crawler/fetchPool.js';

async function run() {
  const target = process.argv[2] || 'https://example.com/';
  
  console.log(`🚀 Production Crawl Runner`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Target: ${target}`);
  console.log(`Concurrency: 4`);
  console.log(`Rate Limit: 150ms`);
  console.log(`Max Pages: 500`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const outDir = path.resolve('./reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  resetFetchTelemetry();
  const startTime = Date.now();
  let lastProgressTime = startTime;

  try {
    const onProgress = (progress, message, a, b, c) => {
      const now = Date.now();
      // Only log every 2 seconds to avoid spam
      if (now - lastProgressTime > 2000) {
        const elapsed = Math.round((now - startTime) / 1000);
        console.log(`[${elapsed}s] (${progress}%) ${message}`);
        lastProgressTime = now;
      }
    };

    const result = await orchestrateCrawl(target, onProgress);

    const crawlDurationMs = Date.now() - startTime;
    const telemetry = getFetchTelemetry();
    const logs = getLogger().getLogs();

    // Calculate percentiles
    const durations = telemetry.durations.sort((a, b) => a - b);
    const len = durations.length;
    const p50 = durations[Math.floor(len * 0.50)];
    const p90 = durations[Math.floor(len * 0.90)];
    const p95 = durations[Math.floor(len * 0.95)];

    const report = {
      target,
      timestamp: new Date().toISOString(),
      crawlDurationMs,
      pagesVisited: result.pages.length,
      pagesFetchedOk: telemetry.successes,
      pagesFetchFailed: telemetry.failures,
      fetchTelemetry: {
        totalRequests: telemetry.totalRequests,
        successes: telemetry.successes,
        failures: telemetry.failures,
        durations: telemetry.durations,
        percentiles: { p50, p90, p95 }
      },
      crawledPages: result.pages || [],
      logger: { logs }
    };

    const reportFilename = `perf-report-${Date.now()}.json`;
    const reportPath = path.join(outDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log(`\n✅ Crawl Complete`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Duration: ${Math.round(crawlDurationMs / 1000)}s (${(crawlDurationMs / 60000).toFixed(1)} min)`);
    console.log(`Pages: ${result.pages.length}`);
    console.log(`Fetched OK: ${telemetry.successes}`);
    console.log(`Failed: ${telemetry.failures}`);
    console.log(`Success Rate: ${((telemetry.successes / telemetry.totalRequests) * 100).toFixed(2)}%`);
    console.log(`\nLatency Percentiles:`);
    console.log(`  p50: ${p50}ms`);
    console.log(`  p90: ${p90}ms`);
    console.log(`  p95: ${p95}ms`);
    console.log(`\nReport saved: ${reportPath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(4);
});
