# Global Crawler Implementation Plan
## With Edge Cases, Error Handling, and Test Scenarios

---

## Phase 1: Architecture & Requirements Validation

### 1.1 Core Requirements (MUST HAVE)

| Req ID | Requirement | Success Criteria | Test Scenario |
|--------|-------------|------------------|---------------|
| REQ-001 | Crawl any domain respecting robots.txt | No 403/robots violation | Test with /disallowed path |
| REQ-002 | Detect site vertical (dealer/ecommerce/blog/etc) | Correct vertical or "generic" | Test 10 known verticals |
| REQ-003 | Prefer structured data (schema.org) | Use schema first, fallback to text | Missing schema → fallback works |
| REQ-004 | All extracted fields have provenance | Every field has source + confidence | Trace any field back to source |
| REQ-005 | Never claim VERIFIED without evidence | Only page-level or structured data | False positives caught |
| REQ-006 | Handle extraction failures gracefully | Partial success, not crash | One extractor fails → others continue |
| REQ-007 | Support generic fallback | Output for non-dealer sites | Blog site → no inventory claims |
| REQ-008 | Error log and audit trail | Every failure recorded | Inspect audit for root cause |

---

## Phase 2: Edge Cases & Failure Modes

### 2.1 Crawling Layer Edge Cases

| Edge Case | Impact | Handling | Test Case |
|-----------|--------|----------|-----------|
| Malformed HTML | Parser crash | Try-catch + graceful degrade | `<div><p>unclosed` |
| Empty response | No data to analyze | Treat as missing → "Unable to read" | 0-byte response |
| 301/302/circular redirect | Infinite loop / timeout | Track redirect chain max 5 | A→B→A→B→A |
| robots.txt missing | Unknown crawl policy | Assume allow-all, audit note | 404 robots.txt |
| No schema.org at all | Heuristic-only extraction | Fall back to text analysis | Plain HTML site |
| Mixed encoding (UTF-8 + Latin-1) | Character corruption | Detect encoding, normalize | Latin-1 chars in UTF-8 site |
| Rate limit / 429 | Crawl stall | Backoff + retry, then skip | Rapid 429 responses |
| CORS / proxy fail | Unable to fetch | Log error, return null HTML | All proxies timeout |
| Very large page (>50MB) | Memory spike / timeout | Truncate + warn, extract head only | 100MB HTML file |
| Page timeout (>30s) | Crawl hangs | Abort, mark as timeout | Slow server responds after 60s |

### 2.2 Site Classification Edge Cases

| Edge Case | Impact | Handling | Test Case |
|-----------|--------|----------|-----------|
| Mixed vertical signals | Wrong category | Score all, pick highest, note ambiguity | Site with products AND blog AND dealer features |
| No schema.org, minimal nav | Can't classify | Default to "generic" | Plain text HTML |
| Dealer-like URLs on non-dealer | False positive | Check content + context, not just URL | Blog with "/service/" page |
| Foreign language site | NLP failures | Skip language-dependent classifiers | Site in Chinese |
| Dynamic nav (JS-only) | Nav hidden from crawler | Fall back to HTML content analysis | Next.js site |
| Home page only crawlable | Limited signals | Use home page aggressively | All subpages blocked by robots.txt |

### 2.3 Extraction Layer Edge Cases

| Edge Case | Impact | Handling | Test Case |
|-----------|--------|----------|-----------|
| Conflicting schema types | Confusion | Rank by specificity, log conflict | `LocalBusiness` + `Organization` on same page |
| Missing required schema fields | Incomplete data | Mark MISSING, not INFERRED | Schema has no address |
| Text regex false positive | Wrong inference | Require confirmation from multiple signals | "Trade in your opinion" matches trade-in regex |
| NULL/undefined in JSON-LD | Parser crash | Null-check before using | Schema property is `null` |
| Nested/circular reference in JSON | Infinite loop | Depth limit + cycle detection | Schema references itself |
| Extraction timeout (complex DOM) | Slow query selector | Timeout large queries, use simpler paths | 100k DOM nodes |
| Extraction partial fail | Corrupted output | Fail gracefully, mark field MISSING | One brand extraction throws, others succeed |

### 2.4 Confidence / Provenance Edge Cases

| Edge Case | Impact | Handling | Test Case |
|-----------|--------|----------|-----------|
| Same field from multiple sources | Conflict resolution | Prioritize schema > page text > inferred | Schema says "Acme", text says "Acme Inc" |
| Source URL invalid | Broken provenance | Log invalid source, flag field | Source URL is malformed |
| Missing source on VERIFIED | Audit fail | Always require source for VERIFIED | Field marked VERIFIED but source null |
| Confidence > 100% | Logic error | Cap at 100%, alert | Accidental double-counting |
| Reason text missing | Unclear MISSING | Default reason if not provided | MISSING field has no reason |

### 2.5 Vertical-Specific Edge Cases

#### Dealer Sites
| Edge Case | Handling | Test |
|-----------|----------|------|
| No inventory pages | Mark MISSING, not "no inventory" | Site has zero product pages |
| Brand is unrecognized | Store in `unknownBrand` field | Non-standard brand name |
| Finance page exists but no data | Mark INFERRED only | Finance page is empty/redirect |

#### Ecommerce Sites
| Edge Case | Handling | Test |
|-----------|----------|------|
| No price on product | Product still valid, price MISSING | Product page without price |
| Out-of-stock product | Include but mark unavailable | Product exists but stock = 0 |
| Lazy-loaded images | Get alt text or title, not image | Images not in initial HTML |

#### Content Sites
| Edge Case | Handling | Test |
|-----------|----------|------|
| No author metadata | Treat as MISSING, not "unknown" | Article without author |
| Auto-publish date | Verify against manual date if present | Generated date vs actual |

---

## Phase 3: Error Handling Strategy

### 3.1 Error Categories

```
CRITICAL (stop crawl)
  - Invalid URL
  - robots.txt fetch fails after retry
  - Crawler timeout

MAJOR (skip page, continue)
  - 404 / 410 responses
  - HTML parse failure
  - Schema parse failure

MINOR (mark field MISSING, continue)
  - Regex no match
  - Extraction timeout
  - Null pointer in optional field

WARN (log, continue with note)
  - Redirect chain > 3
  - Encoding mismatch
  - Ambiguous classification
```

### 3.2 Error Response Format

```javascript
{
  status: "error" | "partial" | "success",
  errorCode: "ERR_INVALID_URL" | "ERR_CRAWL_TIMEOUT" | etc,
  message: "Human-readable error",
  source: "phase name" | "extractor name",
  recoveryAction: "skip page" | "use fallback" | "abort crawl",
  auditLog: [ /* every error logged */ ]
}
```

---

## Phase 4: Test Case Matrix

### 4.1 Unit Tests (Extractor Level)

#### Test: extractStructuredData on valid schema
```
Input: Page with schema.org LocalBusiness
Expected: All structured fields VERIFIED
Assert: confidence=VERIFIED, source=URL, value populated
```

#### Test: extractStructuredData on missing schema
```
Input: Page with no schema
Expected: Result is empty/null, not crash
Assert: No exception thrown
```

#### Test: siteClassifier on ecommerce
```
Input: HomePage with Product schema + /shop/ URLs
Expected: vertical="ecommerce"
Assert: confidence > 0.8, reasoning includes schema
```

#### Test: siteClassifier on ambiguous
```
Input: HomePage with both dealer and ecommerce signals
Expected: vertical="ambiguous" or top candidate with warning
Assert: Audit note includes both signals
```

### 4.2 Integration Tests (Crawler Level)

#### Test: Full crawl on dealer site
```
Input: Known dealer site
Expected: All sections populated, dealer-specific fields accurate
Assert: Compare output to manual audit
```

#### Test: Full crawl on ecommerce site
```
Input: Known ecommerce site
Expected: No dealer fields, product/category fields present
Assert: No inventory/finance/parts claims
```

#### Test: Full crawl on blog
```
Input: Known blog/content site
Expected: Author, publish date, categories, no products/inventory
Assert: Audit shows content classification
```

#### Test: Full crawl on unsupported site
```
Input: Non-standard site (e.g., forum, wiki)
Expected: generic output, clear "unsupported" note
Assert: No false vertical claims
```

#### Test: Crawl with robots.txt blocking
```
Input: Site with robots.txt disallowing /admin
Expected: /admin not crawled, audit notes compliance
Assert: No 403 errors, crawl success
```

#### Test: Crawl with timeout
```
Input: Simulate slow server (>30s response)
Expected: Timeout, skip page, continue crawl
Assert: Audit records timeout, crawl completes
```

### 4.3 Data Validation Tests

#### Test: Confidence scoring
```
Input: Field with multiple sources (schema + text)
Expected: Mark VERIFIED if schema exists, reason includes source
Assert: confidence tag correct, source chain traceable
```

#### Test: Missing reason provided
```
Input: Field marked MISSING
Expected: reason field populated (e.g., "No schema, page not crawled, regex no match")
Assert: Reason is one of defined enum values
```

#### Test: No false VERIFIED on inferred data
```
Input: Inferred field (e.g., regex match on text)
Expected: confidence=INFERRED, source points to page text
Assert: Never marked VERIFIED without schema/structured data
```

#### Test: Circular reference detection
```
Input: Schema with self-reference
Expected: Detect cycle, output only first level, log warning
Assert: No infinite loop, audit notes cycle
```

### 4.4 Regression Tests

#### Must not break existing dealer functionality
```
Test set: 5 known dealer sites
Expected: Output matches previous crawl (excluding time-sensitive fields)
Assert: All dealer fields present and accurate
```

#### Must not produce dealer claims on non-dealer
```
Test set: Blog, ecommerce, SaaS, media sites
Expected: No "inventory", "trade-in", "parts", "finance" claims
Assert: Audit shows generic classification
```

---

## Phase 5: Implementation Milestones

### Milestone 1: Core Crawler + Site Classifier (Week 1)
- [ ] Refactor crawl orchestration
- [ ] Add siteClassifier module
- [ ] Add error handling wrapper
- [ ] 20 unit tests
- [ ] Test with 3 site types

### Milestone 2: Structured Data Extractor (Week 2)
- [ ] Parse JSON-LD, Microdata, RDFa
- [ ] Confidence + provenance layer
- [ ] Null-safety and error handling
- [ ] 30 unit tests
- [ ] Test with schema edge cases

### Milestone 3: Vertical Extractors (Week 3)
- [ ] Refactor dealer as plugin
- [ ] Add generic extractor
- [ ] Add ecommerce extractor
- [ ] Add content extractor
- [ ] 40 unit + integration tests

### Milestone 4: Integration & QA (Week 4)
- [ ] Full test suite
- [ ] Regression testing on existing dealer sites
- [ ] False positive detection
- [ ] Documentation and runbook
- [ ] 50+ comprehensive tests

---

## Phase 6: Code Quality Gates

### Before Merge
- [ ] Zero high-severity errors
- [ ] All tests pass
- [ ] Code review: 2 approvals
- [ ] No new INFERRED fields without reason
- [ ] No new VERIFIED fields without source
- [ ] Error handling covers all edge cases
- [ ] Audit log includes new failure scenarios

### Before Release
- [ ] Regression tests on 10+ known sites
- [ ] False positive rate < 2%
- [ ] No misleading output on non-dealer sites
- [ ] Performance: crawl completes in < 2 minutes
- [ ] Documentation updated

---

## Phase 7: Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Vertical detection accuracy | > 90% | Test on 50 known sites |
| No misleading claims | 100% | Audit output on 20 non-dealer sites |
| Coverage of schema sites | > 95% | Compare schema fields detected |
| False VERIFIED rate | < 1% | Manual audit of 100 VERIFIED fields |
| Extraction success rate | > 95% | Partial failures acceptable, crashes not |
| Error logging completeness | 100% | Every error recorded with trace |
| Dealer functionality regression | 0% | Output matches baseline on 10 sites |

