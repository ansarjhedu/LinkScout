#!/usr/bin/env node
/**
 * CORS & Header Diagnostic Tool
 * Analyzes crawl results for CORS blocks, header issues, and proxy performance
 */
import fs from 'fs';
import path from 'path';

const reportFile = process.argv[2];
if (!reportFile) {
  console.error('Usage: node corsAnalyzer.mjs <perf-report-*.json>');
  process.exit(1);
}

const reportPath = path.resolve(reportFile);
if (!fs.existsSync(reportPath)) {
  console.error(`Report file not found: ${reportPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const logs = data.logger?.logs || [];
const crawledPages = data.crawledPages || [];

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           CORS & HEADER DIAGNOSTIC ANALYSIS                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Analyze failures by type
const failuresByType = {
  cors403: [],
  cors407: [],
  timeout: [],
  connectionRefused: [],
  proxyFailed: [],
  other: []
};

console.log('📊 FAILURE CATEGORIZATION');
console.log('─────────────────────────\n');

logs.filter(log => log.status !== 200 && log.status !== 'N/A').forEach(log => {
  const notes = (log.notes || '').toLowerCase();
  
  if (log.status === 403) {
    failuresByType.cors403.push(log);
  } else if (log.status === 407) {
    failuresByType.cors407.push(log);
  } else if (notes.includes('timeout') || log.status === 'TIMEOUT') {
    failuresByType.timeout.push(log);
  } else if (notes.includes('refused') || notes.includes('econnrefused')) {
    failuresByType.connectionRefused.push(log);
  } else if (notes.includes('proxy') || notes.includes('provider')) {
    failuresByType.proxyFailed.push(log);
  } else {
    failuresByType.other.push(log);
  }
});

console.log(`✓ 403 CORS Blocks (Forbidden): ${failuresByType.cors403.length}`);
if (failuresByType.cors403.length > 0) {
  console.log('  URLs:');
  failuresByType.cors403.slice(0, 5).forEach(log => {
    console.log(`    - ${log.url}`);
  });
  if (failuresByType.cors403.length > 5) {
    console.log(`    ... and ${failuresByType.cors403.length - 5} more`);
  }
}

console.log(`\n✓ 407 CORS Blocks (Auth Required): ${failuresByType.cors407.length}`);
if (failuresByType.cors407.length > 0) {
  console.log('  URLs:');
  failuresByType.cors407.slice(0, 5).forEach(log => {
    console.log(`    - ${log.url}`);
  });
}

console.log(`\n✓ Timeouts: ${failuresByType.timeout.length}`);
if (failuresByType.timeout.length > 0) {
  const timeoutDurations = failuresByType.timeout
    .map(log => log.durationMs)
    .filter(d => typeof d === 'number');
  const avgTimeout = timeoutDurations.length > 0 
    ? Math.round(timeoutDurations.reduce((a, b) => a + b, 0) / timeoutDurations.length)
    : 0;
  console.log(`  Average timeout duration: ${avgTimeout}ms`);
  console.log('  Sample URLs:');
  failuresByType.timeout.slice(0, 3).forEach(log => {
    console.log(`    - ${log.url} (${log.durationMs}ms)`);
  });
}

console.log(`\n✓ Connection Refused: ${failuresByType.connectionRefused.length}`);
console.log(`✓ Proxy Provider Failures: ${failuresByType.proxyFailed.length}`);
console.log(`✓ Other Errors: ${failuresByType.other.length}`);

// Analyze proxy performance
console.log('\n\n📡 PROXY PROVIDER PERFORMANCE');
console.log('──────────────────────────────\n');

const proxyStats = {};
logs.forEach(log => {
  const notes = log.notes || '';
  const proxyMatch = notes.match(/via\s+(\w+[\w\s]*?)(?:\s+\(|$)/);
  const proxyName = proxyMatch ? proxyMatch[1].trim() : 'unknown';
  
  if (!proxyStats[proxyName]) {
    proxyStats[proxyName] = { count: 0, totalDuration: 0, failures: 0 };
  }
  
  proxyStats[proxyName].count++;
  proxyStats[proxyName].totalDuration += log.durationMs || 0;
  
  if (log.status !== 200 && log.status !== 'N/A') {
    proxyStats[proxyName].failures++;
  }
});

Object.entries(proxyStats)
  .sort((a, b) => (b[1].totalDuration / b[1].count) - (a[1].totalDuration / a[1].count))
  .forEach(([provider, stats]) => {
    const avgDuration = Math.round(stats.totalDuration / stats.count);
    const failureRate = Math.round((stats.failures / stats.count) * 100);
    console.log(`  ${provider}:`);
    console.log(`    Requests: ${stats.count}`);
    console.log(`    Avg Duration: ${avgDuration}ms`);
    console.log(`    Failure Rate: ${failureRate}%`);
  });

// Check for header-related issues
console.log('\n\n🔍 POTENTIAL HEADER ISSUES');
console.log('────────────────────────────\n');

const headerIssues = logs.filter(log => 
  (log.notes || '').match(/401|403|407|Unauthorized|Forbidden|Proxy.*required/i)
);

if (headerIssues.length === 0) {
  console.log('✓ No obvious header/auth issues detected');
} else {
  console.log(`⚠ Found ${headerIssues.length} potential header-related issues:`);
  headerIssues.slice(0, 5).forEach(log => {
    console.log(`  - ${log.url}`);
    console.log(`    Status: ${log.status}, Duration: ${log.durationMs}ms`);
    console.log(`    Notes: ${log.notes}`);
  });
}

// Direct vs Proxy performance
console.log('\n\n⚡ DIRECT VS PROXY PERFORMANCE');
console.log('────────────────────────────────\n');

const directLogs = logs.filter(log => (log.notes || '').includes('direct'));
const proxyLogs = logs.filter(log => (log.notes || '').includes('via'));

if (directLogs.length > 0) {
  const directDurations = directLogs.map(log => log.durationMs).filter(d => typeof d === 'number');
  const directAvg = Math.round(directDurations.reduce((a, b) => a + b, 0) / directDurations.length);
  const directSuccess = directLogs.filter(log => log.status === 200).length;
  console.log(`Direct Fetch:`);
  console.log(`  Success: ${directSuccess}/${directLogs.length}`);
  console.log(`  Avg Duration: ${directAvg}ms`);
}

if (proxyLogs.length > 0) {
  const proxyDurations = proxyLogs.map(log => log.durationMs).filter(d => typeof d === 'number');
  const proxyAvg = Math.round(proxyDurations.reduce((a, b) => a + b, 0) / proxyDurations.length);
  const proxySuccess = proxyLogs.filter(log => log.status === 200).length;
  console.log(`\nProxy Fetch:`);
  console.log(`  Success: ${proxySuccess}/${proxyLogs.length}`);
  console.log(`  Avg Duration: ${proxyAvg}ms`);
}

// Recommendations
console.log('\n\n💡 RECOMMENDATIONS');
console.log('──────────────────────\n');

const recommendations = [];

if (failuresByType.cors403.length > 0) {
  recommendations.push(
    `Add Auth headers: The ${failuresByType.cors403.length} 403 errors suggest missing authorization. Consider adding Accept-Language or custom headers.`
  );
}

if (failuresByType.timeout.length > 10) {
  recommendations.push(
    `Increase timeout tolerance: ${failuresByType.timeout.length} timeouts detected. Consider raising fetchTimeout from 20s to 25-30s.`
  );
}

if (failuresByType.timeout.length > data.fetchTelemetry.totalRequests * 0.05) {
  recommendations.push(
    `Too many timeouts (${Math.round((failuresByType.timeout.length / data.fetchTelemetry.totalRequests) * 100)}%). Check site stability or use multiple proxy providers.`
  );
}

if (recommendations.length === 0) {
  console.log('✓ No major issues detected. Crawl performance appears optimal.');
} else {
  recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
}

console.log('\n');
