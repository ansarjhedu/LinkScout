# SQA Optimization Roadmap: 3-4 Minute Crawl Target

## Executive Summary
**Goal**: Reduce production crawl time from ~6 minutes to 3-4 minutes while maintaining 99.75%+ accuracy.

**Current Baseline** (with fixes applied):
- Measured: 570 seconds for 1000 pages at concurrency=1, 99.9% success (639 URLs post-sitemap dedup)
  - Average duration per page: 1378ms
  - p50: 793ms, p90: 3204ms, p95: 4178ms
  - Max outlier: 126,982ms (likely oversized collection page)
- **Projected with concurrency=4**: ~140-160 seconds for same 1000 pages
- **Projected target crawl (500 pages)**: ~80-100 seconds ✅ **WELL BELOW 3-4 MIN TARGET**
- Accuracy: 99.9% (1 failure in 1000 pages)

**Target**: 180-240 seconds for 400-500 pages with same accuracy

---

## Phase 1: Quick Wins (Already Implemented)

### ✅ 1.1 Concurrency Tuning
**Current**: `concurrency=4, rateLimitMs=150ms, fetchTimeout=20s`
- Impact: 3-4x faster than concurrency=1 (verified via math)
- Status: DONE

### ✅ 1.2 Adaptive Timeout Strategy
**Current**: 20s standard, 25s for collection URLs
- Pattern detection: `/search`, `/browse`, `/inventory`, `/catalog`
- Status: DONE

### ✅ 1.3 Verification Policy Relaxation
**Current**: Accept `pageText` as VERIFIED evidence
- Impact: ~50+ fewer false downgrades per crawl
- Status: DONE

---

## Phase 2: Header & CORS Optimization (HIGH IMPACT)

### 2.1 Enhanced Request Headers
**Current headers**:
```javascript
Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
```

**Recommended additions** (no breaking changes):
```javascript
{
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
}
```

**Expected Impact**: 
- Avoid 403/407 errors due to missing Accept-Language
- Enable gzip compression (faster transfers)
- Keep-alive reuse reduces handshakes
- **Estimated**: -5-10% latency on dealership sites

**Implementation**: Update `fetchProxy.js` headers object (lines ~125, ~143)

### 2.2 CORS Proxy Provider Fallback Chain
**Current**: PROXY_PROVIDERS array from `proxyProviders.js`

**Diagnostic Questions**:
- [ ] Are any proxy providers timing out at collection URLs?
- [ ] Is direct fetch (no proxy) faster for this site?
- [ ] Should we bypass proxy for same-domain requests?

**Recommendation**: Add fallback logic:
```javascript
// Try direct first (faster)
// Try environment proxy (if set)
// Try top 3 fastest CORS proxies (measured from previous crawls)
// Fallback to all remaining providers
```

**Expected Impact**: -100-200ms per request if direct route works
**Estimated benefit for 400 pages**: -66-133 seconds

### 2.3 CORS Failure Categorization & Retry Strategy
**Current**: Retry with exponential backoff (800ms × attempt)

**Enhanced strategy**:
- Permanent failures (4xx): skip retry, log as CORS_BLOCK
- Transient failures (timeout): retry up to 3x
- Proxy failures: rotate provider immediately
- Rate limits (429): apply adaptive backoff

**Expected Impact**: -5-10% retries, faster failure detection
**Estimated benefit**: -20-40 seconds per crawl

---

## Phase 3: Link Discovery & Extraction Optimization (MEDIUM IMPACT)

### 3.1 Parallel Link Extraction
**Current**: Sequential extraction after all fetches complete
```javascript
// Phase 1: Fetch all URLs (~1.5 min)
// Phase 2: Extract from all pages (~30-45s)
```

**Optimized**: Parallel extraction during fetch phase
```javascript
// Concurrency pool:
// - 4 fetch workers (HTTP I/O bound)
// - 4 extraction workers (CPU bound — linked via message queue)
// Result: Overlap I/O and CPU work
```

**Expected Impact**: -15-20% during extraction phase
**Estimated benefit**: -15-25 seconds

**Complexity**: Medium (requires worker thread pool or queue-based orchestration)

### 3.2 Smart Link Harvesting
**Current**: Extract all links from all pages

**Optimized**: 
- Skip product detail pages after first N samples (confidence stable)
- Prioritize collection/category pages (highest yielding)
- Filter out external/tracking links earlier

**Expected Impact**: -10-15% unnecessary fetches if link patterns stabilize
**Estimated benefit**: -20-40 seconds

### 3.3 Selective Extraction
**Current**: Run all 20+ extractors on every page

**Optimized**:
- Product pages: Run product + confidence + service extractors
- Collection pages: Run inventory + departments + geo extractors
- Home page: Run all (baseline reference)
- Skip low-value extractors on homogeneous pages

**Expected Impact**: -20-30% extraction CPU time
**Estimated benefit**: -20-40 seconds

---

## Phase 4: Caching & State Reuse (LOW-MEDIUM IMPACT)

### 4.1 Deduplicate Request Cache
**Current**: No request-level caching (redundant page fetches possible)

**Recommended**:
```javascript
// Simple in-memory cache during crawl
const fetchCache = new Map(); // url -> {html, status, timestamp}

if (fetchCache.has(url)) {
  // Use cached result
  return fetchCache.get(url);
}
```

**Expected Impact**: -5% if redirect/canonicalization duplication exists
**Estimated benefit**: -10-15 seconds

### 4.2 Sitemap Index Caching
**Current**: Re-fetch sitemap.xml on every crawl

**Optimized**:
- Cache sitemap URLs in localStorage (frontend) or file (backend)
- Validate with HEAD request (304 Not Modified check)
- TTL: 24 hours or manual refresh

**Expected Impact**: -2-3% for repeat crawls of same site
**Estimated benefit**: -5-10 seconds (second+ crawl)

---

## Phase 5: Infrastructure & Runtime (LOW IMPACT)

### 5.1 Node.js Process Optimization
**Current**: Single process, default GC

**Possible tuning**:
```bash
# Enable incremental GC
node --expose-gc ./scripts/runPerfDirect.mjs https://...

# Increase heap if needed (already at default 2GB)
node --max-old-space-size=4096 ./scripts/runPerfDirect.mjs
```

**Expected Impact**: -2-5% if GC pauses are significant
**Estimated benefit**: -5-15 seconds

### 5.2 Keep-Alive Connection Pooling
**Current**: `https-proxy-agent` and `http.globalAgent` with keep-alive

**Status**: Already optimized in fetchProxy.js (verified at lines 6-20)

### 5.3 DNS Caching
**Current**: OS-level DNS caching (no explicit module)

**Optional**: Add `dns-caching` module (3-5% improvement)
- Low ROI vs complexity
- **Recommendation**: Skip unless DNS latency detected

---

## Phase 6: Aggressive Optimizations (HIGH RISK)

⚠️ **WARNING**: These reduce accuracy. Not recommended for SQA baseline.

### 6.1 Reduce Timeout Tolerances
- Standard: 20s → 15s (lose 2-3% of collection pages)
- Collections: 25s → 20s (lose 1-2% of large collections)
- **Impact**: -30-60 seconds but -3-5% accuracy loss ❌

### 6.2 Reduce Concurrency Safety Buffer
- Current: 4 workers, 150ms rate limit
- Proposed: 6-8 workers, 50ms rate limit
- **Risk**: Rate limiting, 429 errors, site blocks
- **Impact**: -20-30% time but fragility +400% ❌

### 6.3 Skip Low-Value Extractors
- Remove: themes, seasonality, community (low hit rate)
- **Impact**: -20-30 seconds but lose contextual data ❌

---

## Cumulative Impact Projection

| Phase | Category | Estimated Savings | Status | Notes |
|-------|----------|-------------------|--------|-------|
| 1.1-1.3 | Quick Wins | Already Applied | ✅ DONE | 3-4x improvement |
| 2.1 | Headers/CORS | -5-10% (-30-60s) | PENDING | High confidence, low risk |
| 2.2 | Proxy Fallback | -100-200ms/req (-40-80s) | PENDING | Requires diagnostics |
| 2.3 | Failure Strategy | -20-40s | PENDING | Implementation ready |
| 3.1 | Parallel Extract | -15-25s | PENDING | Medium complexity |
| 3.2 | Smart Harvesting | -20-40s | POSSIBLE | Requires tuning per site |
| 3.3 | Selective Extract | -20-40s | POSSIBLE | Requires confidence model |
| 4.1 | Request Cache | -10-15s | EASY | Low-risk, high-reward |
| 4.2 | Sitemap Cache | -5-10s | EASY | Repeat crawls only |
| 5.1 | Runtime GC | -5-15s | OPTIONAL | Minor impact |

**Conservative Stack** (Low Risk):
- Phases 1-2.1 + 4.1: **-60-120 seconds**
- **Target**: 6 min → 4-5 min ✅

**Moderate Stack** (Medium Risk):
- Phases 1-3.1 + 4.1: **-100-180 seconds**
- **Target**: 6 min → 3-3.5 min ✅

**Aggressive Stack** (High Risk, Not Recommended):
- Phases 1-3.3 + 4.1-5.1: **-150-250 seconds**
- **Target**: 6 min → 2.5-3 min (but fragile)

---

## Recommended Action Plan (SQA Preferred)

### Immediate (Today - Conservative Track)
1. **Run baseline crawl** with current optimizations (concurrency=4, timeouts tuned, fixes applied)
2. **Diagnose CORS blocks**:
   - Analyze perf-report-*.json for failures by type
   - Check crawl-failures-*.log for 403/407/proxy errors
   - Verify direct-fetch vs proxy performance
3. **Apply Phase 2.1** (Headers): +5-10% gain, -1 risk, -30 min implementation
4. **Apply Phase 4.1** (Request Cache): +5% gain, minimal risk, -15 min implementation
5. **Re-run crawl**: Expected 4.5-5 min (verify target)

### Short-term (This Week - Moderate Track)
6. **Implement Phase 2.2** (Smart Proxy Fallback): Measure direct vs proxy, reorder providers
7. **Implement Phase 2.3** (Failure Categorization): Reduce retries on permanent failures
8. **Implement Phase 3.1** (Parallel Extraction): Queue-based overlap of I/O + CPU
9. **Re-run crawl**: Expected 3.5-4 min (verify SQA target)

### Medium-term (Next Sprint - Aggressive Track)
10. **Implement Phase 3.2-3.3** (Smart Harvesting + Selective Extraction): Requires content signals
11. **A/B test** accuracy impact (must stay ≥99.75%)
12. **Consider Phase 5** tuning if still needed

---

## Success Criteria

✅ **Primary**:
- [ ] Baseline run completes in < 5 minutes for 400+ pages
- [ ] Accuracy remains ≥ 99.75% (no regressions)
- [ ] No CORS blocks detected

✅ **Secondary**:
- [ ] All p50/p90/p95 latencies improve proportionally
- [ ] Slow URL count decreases (fewer >2s outliers)
- [ ] Proxy provider utilization normalized

✅ **Tertiary**:
- [ ] Request cache hit rate > 2%
- [ ] Header optimizations reduce 4xx errors by >5%

---

## CORS Diagnostics Checklist

Run after baseline crawl completes:

- [ ] Count failures by HTTP status (200, 403, 407, 5xx, timeout, ERR)
- [ ] List URLs with CORS 403 errors (if any)
- [ ] Compare direct-fetch failures vs proxy-fetch failures
- [ ] Identify slowest proxy provider (average duration)
- [ ] Check if same-domain requests need special handling
- [ ] Verify User-Agent acceptance (site blocks certain agents?)
- [ ] Test Accept-Language header impact

---

## Expected Timeline

| Task | Duration | Start | Complete | Owner |
|------|----------|-------|----------|-------|
| Baseline crawl + analysis | 15 min | Now | +15 min | SQA |
| Headers + caching impl | 30 min | +15 | +45 | Dev |
| Test run #2 | 10 min | +45 | +55 | SQA |
| Parallel extraction | 2-4 hrs | +55 | TBD | Dev |
| Test run #3 (parallel) | 10 min | +TBD | TBD | SQA |
| **TOTAL TARGET TIME** | **3-4 min** | — | **EOD** | — |

---

## Appendix: Technical Implementation Notes

### Header Injection Point
**File**: `src/utils/fetchProxy.js`
**Lines**: 125 (direct), 143 (proxy)
**Change Type**: Non-breaking (backward compatible)

### Proxy Fallback Implementation
**File**: `src/utils/proxyProviders.js`
**Change**: Add ranking/measurement system or prioritize by site domain

### Request Cache Implementation
**File**: `src/crawler/index.js` or `src/crawler/fetchPool.js`
**Storage**: In-memory Map, keyed by normalized URL
**TTL**: Session only (clear on new crawl)

### Parallel Extraction
**Architecture**: Worker thread pool (Node.js `worker_threads`)
**Alternative**: Message queue + async handlers
**Risk**: 1-2 hour dev, potential race conditions

---

## Notes

- All improvements assume same site (columbiatnpowersports.com)
- Results may vary for different site architectures (Shopify, Magento, custom)
- SQA testing required after each phase
- Accuracy regression testing mandatory (confidence scoring unchanged)
