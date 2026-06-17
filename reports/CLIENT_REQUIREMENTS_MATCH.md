# Client Requirements Match Report

This document summarizes how LinkScout currently handles exporters, product/catalog extraction, pricing data, PDF requirement linkage, and missing items. It is built to help the client understand what the crawler can verify directly and where additional validation or enhancement is needed.

## 1. Exporters and Deliverables

LinkScout currently supports the following export formats:

- `src/exporters/pagesExporter.js`
  - Exports discovered pages, links, social URLs and page-level registry details.
- `src/exporters/intelExporter.js`
  - Builds intelligence-style workbook tabs for brands, departments, finance, service, geo, and compliance.
- `src/exporters/masterExporter.js`
  - Builds the full 14-tab audit workbook, including:
    - all discovered URLs
    - slow page timing
    - products and collections
    - crawl audit gaps
    - comprehensive NAP, brands, departments, finance, and business positioning
- `src/exporters/jsonExporter.js`
  - Generates a full machine-readable `master_intelligence.json` file.
- `src/exporters/packetExporter.js`
  - Generates a client-ready markdown intelligence packet with verified fields, brand hierarchy, deployment URLs, and missing QA items.

## 2. Product and Collection Extraction

The crawler extracts product/catalog data in `src/extractors/catalog.js`.

### How it finds products

- Preferred source: `JSON-LD` structured schema in page HTML.
  - Extracts items where `@type` matches `Product`, `Vehicle`, `Motorcycle`, `Offer`, etc.
  - Captures `name`, `brand`, `price`, `sku`, `url`, and `source`.
- Fallback source: page content heuristics.
  - Detects product pages by URL type and page title.
  - Extracts price values from selectors such as `[class*='price' i]`, `[itemprop='price']`, `.msrp`, `.sale-price`.
  - Uses first visible dollar amount on page content if available.

### How it finds collections

- Uses `JSON-LD` types such as `CollectionPage`, `ItemList`, and `ProductCollection`.
- Also uses page type heuristics for collection/category pages.
- Outputs collection names, URLs, item counts, source page, and confidence.

### What is exported

`masterExporter.js` writes:
- `Products` sheet with `URL`, `Name`, `Brand`, `Price`, `Source`, `Confidence`
- `Collections` sheet with `URL`, `Name`, `Item Count`, `Source`, `Confidence`

This means the system can already deliver a product/pricing sheet when price data is directly present on the site.

## 3. PDF Requirement Detection and Matching

The repository contains a requirement text extract at:

- `reports/pdf_requirements_extracted.txt`

This document appears to contain the client intent and QA rules extracted from a PDF or intake document.

### Current crawler PDF behavior

- `src/crawler/linkHarvester.js` identifies and harvests links from page HTML.
- The current crawler deliberately excludes asset URLs such as `.pdf`, `.jpg`, `.css`, `.js` from the internal page crawl queue.
- That means PDF links may still be discovered as referenced assets, but they are not treated as crawlable pages or parsed for content in the current pipeline.

### What this implies

- If the client requirement is stored in a PDF, the current system can discover the PDF link if it is linked from the site.
- It cannot currently extract or interpret the PDF document text automatically.
- To cover client PDF requirement docs fully, a PDF parser step should be added.

## 4. Requirement Matching Status

The crawler is already aligned with many client requirements via these mechanisms:

- `packetExporter.js` generates a client-ready packet with:
  - verified and missing NAP fields
  - brand hierarchy
  - inventory strategy and finance summaries
  - deployment URL coverage
  - missing QA items in Section 20
- `masterExporter.js` includes missing item tracking and slow page audit info.
- `ResultsDashboard.jsx` surfaces:
  - product pricing snippets
  - collection counts
  - product/collection page discovery

### What can be matched directly

- Verified site identity data (name, address, phone, hours, business role)
- Brand and franchise hierarchy
- Catalog/product pages discovered by schema and page content
- Product prices when they appear in JSON-LD or page price selectors
- Collection/category pages and item counts if schema is available
- Crawl gaps and missing fields via Section 20 audit

### What is still missing or needs manual validation

- PDF-based requirements and intake documents are not automatically parsed.
- Legal business name, DBA name, and ownership history are often missing unless explicitly on page.
- Logo URL, Google Maps URL, review URL, and social profile URLs are frequently absent.
- Pricing for products that are not directly exposed on the product page is not guaranteed.
- Any data that is not in page HTML or structured schema is treated as missing rather than guessed.

## 5. Suggested Improvements

To better satisfy the requirement set and support the client’s PDF-based rules, I recommend:

1. Add PDF discovery and parsing support
   - Detect `.pdf` links in `linkHarvester.js`
   - Fetch linked PDFs and extract text
   - Map the extracted text into the same QA pipeline
2. Add a dedicated `requirements-match` report generator
   - Compare `reports/pdf_requirements_extracted.txt` items with crawler output fields
   - Produce an explicit `matched / missing / manual review` section
3. Enhance `catalog.js` price extraction
   - Add more price selectors and variant/offer table support
   - Normalize currency values for higher accuracy
4. Represent `productCount` and `collectionCount` in the packet with separate verified/missing status.

## 6. Client-Facing Summary

The crawler can already produce:
- a complete workbook export (`master_intelligence.xlsx`)
- a JSON master export (`master_intelligence.json`)
- a client markdown packet (`intelligence_packet.md`)
- product/pricing sheets and collection listings

It cannot yet guarantee that it has extracted every client PDF requirement document or that every possible product price is captured unless those values are directly present on the website.

## 7. Practical Outcome

### What works

- Verified data remains authentic because the system only exports fields it can directly observe.
- Products and prices are captured when found in structured schema or clear page selectors.
- Missing data is exposed, not invented, through audit/gap reporting.

### What needs caution

- If the PDF contains client-specific intake rules, that document should be treated as a separate source and parsed independently.
- Any suggested claim or pricing language should only be used after the field is verified by the crawler.
- The crawler’s current logic is intentionally conservative: it prefers `MISSING` over `GUESS`.

## 8. Recommended next deliverable

Create a `requirements match` markdown report that:
- lists all client-required fields from `pdf_requirements_extracted.txt`
- marks each as `Verified`, `Inferred`, `Missing`, or `Needs PDF review`
- identifies whether product pricing is available in the crawl
- identifies whether collection URLs are discovered and confidently categorized

That is the ideal next step to turn the crawler output into a fully client-ready QA checklist.
