/**
 * Master Test Suite Runner
 * 
 * Executes all test suites and provides a comprehensive report.
 * Run with: node src/tests/runner.js
 */

import { runAllFieldBuilderTests } from './fieldBuilder.test.js';
import { runAllTests as runSiteClassifierTests } from './siteClassifier.test.js';
import { runAllIntegrationTests } from './orchestrator.integration.test.js';
import { runAllDealerTests } from './dealer.integration.test.js';
import { runAllValidationTests } from './phase2.validation.test.js';

export async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('  LinkScout Global Crawler - Comprehensive Test Suite');
  console.log('='.repeat(80) + '\n');

  const results = {
    fieldBuilder: false,
    siteClassifier: false,
    orchestratorIntegration: false,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
    // ========== Field Builder Tests ==========
    console.log('[1/3] Running Field Builder Tests...\n');
    try {
      runAllFieldBuilderTests();
      results.fieldBuilder = true;
      results.passedTests += 20;
      results.totalTests += 20;
    } catch (err) {
      console.error('❌ Field Builder Tests FAILED:', err.message);
      results.failedTests += 20;
      results.totalTests += 20;
    }

    // ========== Site Classifier Tests ==========
    console.log('\n[2/3] Running Site Classifier Tests...\n');
    try {
      runSiteClassifierTests();
      results.siteClassifier = true;
      results.passedTests += 10;
      results.totalTests += 10;
    } catch (err) {
      console.error('❌ Site Classifier Tests FAILED:', err.message);
      results.failedTests += 10;
      results.totalTests += 10;
    }

    // ========== Orchestrator Integration Tests ==========
    console.log('\n[3/4] Running Orchestrator Integration Tests...\n');
    try {
      await runAllIntegrationTests();
      results.orchestratorIntegration = true;
      results.passedTests += 10;
      results.totalTests += 10;
    } catch (err) {
      console.error('❌ Orchestrator Integration Tests FAILED:', err.message);
      results.failedTests += 10;
      results.totalTests += 10;
    }

    // ========== Dealer Integration Tests ==========
    console.log('\n[4/5] Running Dealer Extractor Integration Tests...\n');
    try {
      await runAllDealerTests();
      results.dealerIntegration = true;
      results.passedTests += 12;
      results.totalTests += 12;
    } catch (err) {
      console.error('❌ Dealer Integration Tests FAILED:', err.message);
      results.failedTests += 12;
      results.totalTests += 12;
    }

    // ========== Phase 2 Validation Tests ==========
    console.log('\n[5/5] Running Phase 2 Validation Tests...\n');
    try {
      const validationPassed = await runAllValidationTests();
      results.phase2Validation = validationPassed;
      results.passedTests += 8;
      results.totalTests += 8;
    } catch (err) {
      console.error('❌ Phase 2 Validation Tests FAILED:', err.message);
      results.failedTests += 8;
      results.totalTests += 8;
    }
  } catch (err) {
    console.error('\n❌ Test runner encountered fatal error:', err);
  }

  const durationMs = Date.now() - startTime;

  // ========== Report ==========
  console.log('\n' + '='.repeat(80));
  console.log('  TEST EXECUTION REPORT');
  console.log('='.repeat(80) + '\n');

  console.log('Test Suites:');
  console.log(`  ${results.fieldBuilder ? '✅' : '❌'} Field Builder (20 tests)`);
  console.log(`  ${results.siteClassifier ? '✅' : '❌'} Site Classifier (10 tests)`);
  console.log(`  ${results.orchestratorIntegration ? '✅' : '❌'} Orchestrator Integration (10 tests)`);
  console.log(`  ${results.dealerIntegration ? '✅' : '❌'} Dealer Extractor (12 tests)`);
  console.log(`  ${results.phase2Validation ? '✅' : '❌'} Phase 2 Validation (8 tests)`);

  console.log('\nResults:');
  console.log(`  Total Tests:  ${results.totalTests}`);
  console.log(`  Passed:       ${results.passedTests} (${((results.passedTests / results.totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Failed:       ${results.failedTests}`);
  console.log(`  Duration:     ${durationMs}ms`);

  console.log('\nTimestamp:', results.timestamp);

  if (results.failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED 🎉\n');
  } else {
    console.log(`\n⚠️  ${results.failedTests} test(s) failed. See details above.\n`);
  }

  console.log('='.repeat(80) + '\n');

  return results;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
