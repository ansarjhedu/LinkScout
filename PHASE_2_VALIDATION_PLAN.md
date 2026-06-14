## Phase 2 Validation Plan

**Purpose**: Validate all refactored extractors work correctly with real-world dealer sites  
**Scope**: Regression testing, false-positive audit, performance validation  
**Success Criteria**: No breaking changes + zero false dealer claims + < 2 min crawl

---

## 1. Regression Testing (10 Dealer Sites)

**Objective**: Verify all fields still extract with proper confidence levels  
**Test Sites Needed**: Mix of verticals and complexity levels

### Tier 1: Simple Dealer Sites (Powersports/ATV)
1. **Polaris Dealer** - Large franchise, complete inventory
   - Expected: Full finance, inventory (new/used), service, parts, brands
   - Confidence levels: Mostly VERIFIED (schema-heavy sites)
   
2. **Honda Dealer** - Motorcycle + ATV focus
   - Expected: Finance, multi-brand inventory, service, accessories
   - Confidence levels: Mix of VERIFIED and INFERRED

3. **Local Independent Dealer** - Small operation
   - Expected: Basic NAP, limited finance/inventory
   - Confidence levels: Mostly INFERRED (less structured data)

### Tier 2: Complex Dealer Sites (Multi-brand)
4. **Multi-brand Powersports** - 3+ manufacturers
   - Expected: Multiple brands, mixed inventory, service integration
   - Confidence levels: VERIFIED where schema exists, INFERRED elsewhere

5. **Marina/Watercraft Dealer** - Boats + PWC
   - Expected: Unique product categories, seasonal variation
   - Confidence levels: INFERRED on specialty items

### Tier 3: Edge Cases
6. **Regional Dealer Group** - Multiple locations on one site
   - Challenge: Multi-location handling
   - Expected: Primary location extracted with warning
   
7. **Seasonal Dealer** - Winter prep/storage focus
   - Challenge: Seasonal language interpretation
   - Expected: Service offerings correctly detected

8. **DIY/Parts-Heavy Dealer** - Emphasizes aftermarket
   - Challenge: Parts vs inventory distinction
   - Expected: Parts offerings clearly separated

9. **Luxury Brand Dealer** - Premium positioning
   - Challenge: High-end language patterns
   - Expected: Authority role correctly identified

10. **Rural/Minimal Web** - Small website, basic HTML
    - Challenge: Minimal structured data
    - Expected: Conservative extraction, mostly INFERRED

### Regression Test Checklist for Each Site

For each test site, validate:

```
NAP Module:
  [ ] dealershipName extracted correctly
  [ ] address components complete (street, city, state, zip)
  [ ] phone number matches business listing
  [ ] social URLs accurate (Facebook, Instagram, etc.)
  [ ] Confidence levels: VERIFIED for schema, INFERRED for text
  [ ] Metadata captures extraction method

Finance Module:
  [ ] financeOffered correctly detected (page existence = VERIFIED)
  [ ] Lenders accurately identified
  [ ] Credit programs categorized
  [ ] Compliance language validated
  [ ] forbiddenLanguageFound = 0 (no regulatory violations)

Inventory Module:
  [ ] newUsedMix correctly assessed
  [ ] brandPriority matches actual brands carried
  [ ] Category priority matches product focus (ATV, SxS, etc.)
  [ ] Trade-in policy correctly detected

Service Module:
  [ ] brandsServiced: All brands or franchise-only?
  [ ] Service specialties captured
  [ ] Appointment scheduling capability detected
  [ ] Hours extracted and formatted correctly

Parts Module:
  [ ] OEM support correctly identified
  [ ] Aftermarket warranty tracked
  [ ] Special orders capability detected
  [ ] Service integration recognized

Brands Module:
  [ ] All carried brands discovered
  [ ] Parent company lookup successful (where available)
  [ ] Authority role correctly assessed (authorized vs reseller)
  [ ] Product lines inferred correctly per brand

Geo Module:
  [ ] Primary city/state matches NAP
  [ ] County correctly looked up or extracted
  [ ] Metro market description accurate
  [ ] Nearby cities realistic for service area

URLs Module:
  [ ] All deployment URLs correctly mapped
  [ ] Brand-specific inventory URLs identified
  [ ] Link registry complete
```

### Success Criteria
- ✅ All 10 sites extract without errors
- ✅ No fields unexpectedly MISSING
- ✅ Confidence levels appropriate to source type
- ✅ Field values match manual inspection
- ✅ No regression vs pre-refactor values

---

## 2. False-Positive Audit (20 Non-Dealer Sites)

**Objective**: Verify NO dealer claims on non-dealer sites  
**Risk**: Text patterns could falsely trigger dealer classification

### Test Categories

#### A. Blogs/Content Sites (5 sites)
1. Powersports blog (talks about dealers, maintenance)
2. ATV enthusiast blog (reviews, buying guides)
3. Motorcycle blog (news, community)
4. General auto blog (advice, reviews)
5. Retail/shopping blog (product comparisons)

**Key Check**: No `/service/`, `/finance/`, `/inventory/` pages found

#### B. E-Commerce Sites (5 sites)
1. ATV parts retailer
2. Motorcycle gear shop
3. General sporting goods
4. Automotive accessories
5. Power tools/equipment

**Key Check**: Product pages not confused with dealer inventory

#### C. Third-Party Information Sites (5 sites)
1. Dealer review/listing site (like Yelp for dealers)
2. Manufacturer website (brand info)
3. Insurance/financing provider
4. Classified listings (Craigslist-like)
5. News/media outlet covering dealerships

**Key Check**: No NAP extraction from listing/reviews

#### D. Educational/Reference (5 sites)
1. Wikipedia article on ATVs
2. Government safety information
3. Educational institution (mentions powersports program)
4. Museum/historical site (vehicles)
5. Forum/community discussion

**Key Check**: No business data extraction

### False-Positive Validation

For each site, verify:

```
Site Classification:
  [ ] Vertical correctly identified (NOT "dealer")
  [ ] Confidence score makes sense for detected vertical
  [ ] No ambiguity flags raised incorrectly

Finance Field:
  [ ] financeOffered = MISSING (not page existence confusion)
  [ ] lenders = MISSING (no lender keywords found)
  [ ] forbiddenLanguageFound = FALSE

Inventory Field:
  [ ] newUsedMix = MISSING (no inventory pages)
  [ ] usedStance = MISSING
  [ ] tradeInPolicy = MISSING

Service Field:
  [ ] brandsServiced = MISSING
  [ ] Service specialties = MISSING

Parts Field:
  [ ] Parts offerings not confused with retail products

Brands Field:
  [ ] Brand mentions correctly contextualized
  [ ] Not falsely claiming "authorized dealer" status

Overall:
  [ ] No dealer confidence > 50% on non-dealer site
  [ ] Orchestrator never routes to dealer.js
```

### Success Criteria
- ✅ All 20 sites correctly classified as non-dealer
- ✅ Zero false dealer claims
- ✅ All dealer-specific fields = MISSING
- ✅ siteClassifier prevents dealer.js execution

---

## 3. Performance Validation

**Objective**: Measure crawl performance with new metadata overhead  
**Target**: < 2 minutes for 80-page budget

### Metrics to Collect

```
Per-Site Crawl:
  [ ] Total crawl time (target: < 120s)
  [ ] Homepage fetch time
  [ ] Link discovery time
  [ ] Structured data parse time
  [ ] Field extraction time (per module)
  [ ] Memory usage (baseline vs peak)
  [ ] Field extraction throughput (fields/sec)

Memory Usage:
  [ ] Baseline: ~50MB
  [ ] Peak during crawl: < 200MB
  [ ] No memory leaks (stable after extraction)

Metadata Overhead:
  [ ] Time to build each field: < 1ms
  [ ] Audit trail logging: < 2ms per entry
  [ ] Total overhead: < 5% of total crawl time
```

### Performance Test Scenarios

**Scenario 1**: Large dealer site (100+ pages)
- Real Polaris dealer, full extraction
- Measure maximum crawl time

**Scenario 2**: Complex site (multi-location)
- Multiple dealer locations on one domain
- Measure memory stability

**Scenario 3**: Minimal site (20 pages)
- Small local dealer, sparse content
- Verify no artificial slowdown

### Success Criteria
- ✅ Large site < 120 seconds
- ✅ Memory stays < 200MB peak
- ✅ Metadata overhead < 5%
- ✅ No timeout hangs
- ✅ Stable throughput (not degrading)

---

## 4. Accuracy Metrics

**Objective**: Measure confidence calibration and classification accuracy

### Metric 1: Vertical Classification Accuracy

```
Calculation:
  Accuracy = (Correct Classifications / Total Evaluations) × 100
  Target: > 90%

Per-Vertical Analysis:
  Dealer:    Expected > 95% (most important)
  Ecommerce: Expected > 85%
  Content:   Expected > 80%
  Generic:   Expected > 90%
  Unknown:   Expected > 75%
```

**Sample Sites**: 50 total (10 per vertical)
- 10 confirmed dealer sites
- 10 confirmed ecommerce sites
- 10 confirmed content/blog sites
- 10 generic/other sites
- 10 ambiguous/edge cases

**Validation Method**:
1. Run siteClassifier on sample
2. Record detected vertical and confidence
3. Compare to manual truth labels
4. Calculate per-vertical and overall accuracy

### Metric 2: VERIFIED Confidence Reliability

```
Calculation:
  Reliability = (Correct VERIFIED / Total VERIFIED) × 100
  Target: > 95%

What counts as "correct VERIFIED":
  - Schema data that matches manual verification
  - Explicit tags (tel: links, actual social URLs) that work
  - Page existence tests (e.g., /service/ page is real service)

What counts as "incorrect VERIFIED":
  - Schema data that is stale/wrong
  - Explicit tags pointing to dead URLs
  - Page existence tests where page has unrelated content
```

**Sample Size**: 100 VERIFIED fields across extraction
- 20 from schema
- 30 from explicit tags
- 50 from link patterns

**Validation Method**:
1. Collect all VERIFIED fields from extraction
2. Manually verify each one
3. Calculate accuracy percentage
4. If < 95%, investigate over-confidence

### Metric 3: INFERRED Confidence Conservatism

```
Calculation:
  False Positive Rate = (Incorrectly INFERRED / Total INFERRED) × 100
  Target: < 10%

What should be INFERRED:
  - Text patterns matching keywords (conservative estimate)
  - Regex extractions (uncertain)
  - Keyword matches (probabilistic)

What should NOT be INFERRED:
  - Schema data (should be VERIFIED)
  - Explicit URLs (should be VERIFIED)
  - Strong page existence signals (should be VERIFIED)
```

**Validation Method**:
1. Collect all INFERRED fields
2. Manually verify ground truth
3. Calculate false positive rate
4. If > 10%, adjust confidence thresholds

### Metric 4: MISSING Field Accuracy

```
Calculation:
  Accuracy = (Correct MISSING / Total MISSING) × 100
  Target: > 90%

Correct MISSING:
  - Field truly not on website
  - Reason enum matches reality
  - No false negatives

Incorrect MISSING:
  - Field is on website but not found
  - Wrong reason enum
```

**Validation Method**:
1. Review sample MISSING fields
2. Manually check if data really absent
3. Verify reason enum is appropriate
4. Calculate accuracy

---

## Regression Test Execution Plan

### Phase 2a: Quick Validation (1 hour)
1. Run test suite: `npm test` (should show 60/60 passing)
2. Spot-check 2 dealer sites manually
3. Spot-check 5 non-dealer sites manually
4. Verify no obvious errors

### Phase 2b: Thorough Regression (4 hours)
1. Test 10 dealer sites systematically
2. Document any field extraction differences
3. Verify confidence levels appropriate
4. Analyze error cases

### Phase 2c: False-Positive Audit (3 hours)
1. Test 20 non-dealer sites
2. Verify zero dealer misclassification
3. Spot-check field extraction isolation
4. Document any edge cases

### Phase 2d: Performance Validation (2 hours)
1. Baseline measurement (large site)
2. Memory profiling
3. Throughput measurement
4. Bottleneck identification

### Phase 2e: Accuracy Metrics (3 hours)
1. Vertical classification on 50 sites
2. VERIFIED reliability check (100 fields)
3. INFERRED conservatism check (100 fields)
4. MISSING accuracy check (50 fields)

---

## Success Criteria Summary

| Phase | Criteria | Status |
|-------|----------|--------|
| Regression | 10/10 sites extract correctly | ⏳ |
| False-Positive | 0/20 sites false dealer claims | ⏳ |
| Performance | < 2 min crawl, < 200MB memory | ⏳ |
| Vertical Accuracy | > 90% correct classification | ⏳ |
| VERIFIED Reliability | > 95% accuracy | ⏳ |
| INFERRED Conservatism | < 10% false positive rate | ⏳ |
| MISSING Accuracy | > 90% accuracy | ⏳ |

---

## Blockers & Workarounds

### Potential Issues
1. **Stale schema data** → Inspect manually, note in results
2. **Dynamic content** → Accept limitation, note in audit
3. **Rendering-required sites** → Skip (known limitation)
4. **Broken social links** → Expected for old sites, mark as stale

### If Issues Found
- Document in findings
- Create GitHub issue for Phase 3
- Do NOT block Phase 2 completion
- Update accuracy metrics accordingly

---

## Validation Sign-Off

- [ ] All regression tests complete
- [ ] No false-positive claims found
- [ ] Performance within targets
- [ ] Accuracy metrics acceptable
- [ ] Phase 2 validated and ready for production

**Phase 2 Validation Start Date**: [Date]  
**Phase 2 Validation End Date**: [Date]  
**Validation Status**: ⏳ IN PROGRESS
