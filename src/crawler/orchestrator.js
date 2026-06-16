/**
 * Enhanced Crawler Orchestration
 * 
 * Main entry point for crawling with:
 * - Error handling wrapper
 * - Site classification
 * - Structured data extraction
 * - Vertical-aware extraction
 * - Comprehensive audit trail
 */

import parseRobotsTxt, { isPathAllowed } from './robotsParser.js';
import harvestLinks, { harvestLinksFromHtml, mergeDiscoveredLinks } from './linkHarvester.js';
import parseSitemaps from './sitemapParser.js';
import fetchPool, { fetchUrl, getFetchTelemetry } from './fetchPool.js';
import fetchProxy from '../utils/fetchProxy.js';
import classifySite, { SITE_VERTICALS, getApplicableFields } from './siteClassifier.js';
import extractStructuredData, { getBestOrganization } from '../extractors/structuredData.js';
import crawlConfig from '../config/crawlConfig.js';
import { classifyUrl, normalizeUrl } from './urlClassifier.js';

import { AuditTrail, CrawlError, ERROR_CODES, withTimeout, validateUrl } from '../utils/errorHandler.js';
import { buildField, CONFIDENCE_LEVELS } from '../utils/fieldBuilder.js';

/**
 * Orchestrate a full intelligence crawl with error handling
 */
export default async function orchestrateCrawl(targetUrl, onProgress) {
  const audit = new AuditTrail();
  const startTime = Date.now();

  try {
    // ========== PHASE 0: Validate Input ==========
    onProgress?.(0, 'Validating target URL...', 0, 0, 0);

    let normalizedTarget;
    try {
      validateUrl(targetUrl);
      normalizedTarget = normalizeUrl(targetUrl);
      audit.logInfo('URL validated and normalized', { original: targetUrl, normalized: normalizedTarget });
    } catch (err) {
      if (err instanceof CrawlError) throw err;
      throw new CrawlError(
        ERROR_CODES.ERR_INVALID_URL,
        `URL validation failed: ${err.message}`,
        { url: targetUrl }
      );
    }

    // ========== PHASE 1: Robots.txt Compliance ==========
    onProgress?.(2, 'Checking robots.txt compliance...', 0, 0, 0);

    let robots;
    try {
      robots = await withTimeout(
        parseRobotsTxt(normalizedTarget),
        crawlConfig.fetchTimeout,
        'robots.txt fetch timeout'
      );
      audit.logInfo('robots.txt parsed', { disallowed: robots.disallowed?.length || 0 });
    } catch (err) {
      if (err instanceof CrawlError) throw err;
      audit.logWarn('robots.txt parsing failed, assuming allow-all', { error: err.message });
      robots = { disallowed: [], sitemaps: [] };
    }

    // ========== PHASE 2: Homepage Fetch ==========
    onProgress?.(5, 'Fetching homepage...', 0, 0, 0);

    let homeRes;
    try {
      homeRes = await withTimeout(
        fetchProxy(normalizedTarget, { retries: 2, timeout: crawlConfig.fetchTimeout }),
        crawlConfig.fetchTimeout + 2000,
        'Homepage fetch timeout'
      );

      if (!homeRes.ok || !homeRes.html) {
        throw new CrawlError(
          ERROR_CODES.ERR_HTML_PARSE_FAILED,
          homeRes.error || 'Unable to read homepage',
          { url: normalizedTarget, status: homeRes.status }
        );
      }

      audit.logInfo('Homepage fetched successfully', { status: homeRes.status, bytes: homeRes.html?.length });
    } catch (err) {
      if (err instanceof CrawlError) throw err;
      throw new CrawlError(
        ERROR_CODES.ERR_CRAWL_TIMEOUT,
        `Failed to fetch homepage: ${err.message}`,
        { url: normalizedTarget }
      );
    }

    // ========== PHASE 3: Link Discovery ==========
    onProgress?.(8, 'Discovering links from homepage and sitemap...', 0, 0, 0);

    const homeHarvest = harvestLinks(normalizedTarget, homeRes.html);
    let allDiscovered = [...(homeHarvest.internal || [])];

    try {
      const sitemapLinks = await withTimeout(
        parseSitemaps(normalizedTarget, robots.sitemaps || []),
        crawlConfig.fetchTimeout * 2,
        'Sitemap parsing timeout'
      );
      allDiscovered = [...new Set([...allDiscovered, ...sitemapLinks])];
      audit.logInfo('Links discovered', { fromHome: homeHarvest.internal?.length, fromSitemap: sitemapLinks?.length });
    } catch (err) {
      audit.logWarn(`Sitemap parsing failed: ${err.message}`);
    }

    // ========== PHASE 4: Filter by robots.txt ==========
    allDiscovered = allDiscovered.filter((url) => {
      try {
        const path = new URL(url).pathname;
        return isPathAllowed(path, robots.disallowed || []);
      } catch {
        return true;
      }
    });

    audit.logInfo('Links filtered by robots.txt', { remaining: allDiscovered.length });

    // ========== PHASE 5: Site Classification (BEFORE deep crawl) ==========
    onProgress?.(12, 'Classifying site vertical...', 0, 0, 0);

    const homePageObj = {
      url: normalizedTarget,
      html: homeRes.html,
      type: 'home',
      ok: true,
    };

    const siteClassification = classifySite([homePageObj], audit);
    const siteVertical = siteClassification.value;

    audit.logInfo(`Site classified as: ${siteVertical}`, {
      confidence: siteClassification.confidence,
      isAmbiguous: siteClassification.metadata?.isAmbiguous,
    });

    // ========== PHASE 6: Prioritize URLs for crawl ==========
    onProgress?.(15, `Prioritizing URLs (${siteVertical})...`, 0, 0, allDiscovered.length);

    const { prioritizeUrls } = await import('./urlClassifier.js');
    const budget = getApplicableBudget(siteVertical);
    let crawlTargets = prioritizeUrls(allDiscovered, budget);
    const targetsToCrawl = crawlTargets.filter((u) => normalizeUrl(u) !== normalizedTarget);

    audit.logInfo('URLs prioritized for crawl', { budget, prioritized: targetsToCrawl.length });

    // ========== PHASE 7: Fetch Priority Pages ==========
    onProgress?.(18, `Fetching ${targetsToCrawl.length} priority pages...`, 0, 1, allDiscovered.length);

    const crawledPages = [homePageObj];

    try {
      const fetched = await withTimeout(
        fetchPool(targetsToCrawl, {
          concurrency: crawlConfig.concurrency,
          skipUrls: new Set([normalizedTarget]),
          onProgress: (done, total, url) => {
            const pct = 18 + Math.floor((done / Math.max(total, 1)) * 50);
            let pathname = '/';
            try {
              pathname = new URL(url).pathname;
            } catch {
              /* skip */
            }
            onProgress?.(pct, `Fetching ${done}/${total}: ${pathname}`, 0, done + 1, allDiscovered.length);
          },
        }),
        crawlConfig.fetchTimeout * crawlConfig.concurrency,
        'Batch fetch timeout'
      );

      for (const entry of fetched) {
        crawledPages.push({
          url: entry.url,
          html: entry.html || '',
          status: entry.status,
          type: classifyUrl(entry.url),
          ok: entry.ok,
          error: entry.error || null,
          durationMs: entry.duration || 0,
        });
      }

      audit.logInfo('Pages fetched', { success: fetched.filter((e) => e.ok).length, failed: fetched.filter((e) => !e.ok).length });
    } catch (err) {
      audit.logWarn(`Batch fetch failed: ${err.message}. Continuing with partial results.`);
    }

    const okPages = crawledPages.filter((p) => p.ok && p.html);

    // ========== PHASE 8: Structured Data Extraction ==========
    onProgress?.(72, 'Extracting structured data...', 0, crawledPages.length, allDiscovered.length);

    const structuredResult = extractStructuredData(okPages, audit);
    const bestOrg = getBestOrganization(structuredResult);

    // ========== PHASE 9: Vertical-Specific Extraction ==========
    onProgress?.(80, `Extracting ${siteVertical} intelligence...`, 0, crawledPages.length, allDiscovered.length);

    const extractionResult = await extractByVertical(siteVertical, okPages, structuredResult, audit);

    // ========== PHASE 10: Merge and Finalize ==========
    onProgress?.(95, 'Merging results and finalizing...', 0, crawledPages.length, allDiscovered.length);

    // Attach telemetry slow pages for later user-driven retries
    const telemetry = getFetchTelemetry();
    const slowPages = telemetry.slowUrls || [];

    const finalJson = buildFinalOutput({
      crawledUrl: normalizedTarget,
      siteVertical,
      siteClassification,
      crawledPages,
      structuredData: structuredResult,
      extractionResult,
      audit,
      durationMs: Date.now() - startTime,
      slowPages,
    });

    onProgress?.(100, 'Crawl complete', finalJson.meta?.fieldCount || 0, crawledPages.length, allDiscovered.length);

    return finalJson;
  } catch (err) {
    audit.logError(
      err.errorCode || ERROR_CODES.ERR_CRAWL_TIMEOUT,
      err.message,
      err.context || {}
    );

    // Return error response
    return {
      status: 'error',
      error: {
        code: err.errorCode || 'UNKNOWN',
        message: err.message,
        recoveryAction: err.recoveryAction || 'ABORT_CRAWL',
      },
      audit: audit.toJSON(),
      meta: {
        crawledUrl: targetUrl,
        crawlDate: new Date().toISOString(),
        crawlDurationMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Get crawl budget based on site vertical
 */
function getApplicableBudget(vertical) {
  const budgets = {
    [SITE_VERTICALS.DEALER]: 100,
    [SITE_VERTICALS.ECOMMERCE]: 80,
    [SITE_VERTICALS.BLOG]: 50,
    [SITE_VERTICALS.CONTENT]: 50,
    [SITE_VERTICALS.SAAS]: 40,
    [SITE_VERTICALS.MEDIA]: 60,
  };

  return budgets[vertical] || 80;
}

/**
 * Route to appropriate vertical extractor
 */
async function extractByVertical(vertical, pages, structuredData, audit) {
  try {
    switch (vertical) {
      case SITE_VERTICALS.DEALER:
        const { default: extractDealerIntelligence } = await import('../extractors/dealer.js');
        return extractDealerIntelligence(pages, structuredData, audit);

      case SITE_VERTICALS.ECOMMERCE:
        const { default: extractEcommerceIntelligence } = await import('../extractors/ecommerce.js');
        return extractEcommerceIntelligence(pages, structuredData, audit);

      case SITE_VERTICALS.BLOG:
      case SITE_VERTICALS.CONTENT:
        const { default: extractContentIntelligence } = await import('../extractors/content.js');
        return extractContentIntelligence(pages, structuredData, audit);

      default:
        const { default: extractGenericIntelligence } = await import('../extractors/generic.js');
        return extractGenericIntelligence(pages, structuredData, audit);
    }
  } catch (err) {
    audit.logWarn(`Vertical extractor failed for ${vertical}: ${err.message}`);
    return { status: 'partial', error: err.message };
  }
}

/**
 * Build final output with all metadata
 */
function buildFinalOutput(context) {
  const {
    crawledUrl,
    siteVertical,
    siteClassification,
    crawledPages,
    structuredData,
    extractionResult,
    audit,
    durationMs,
    slowPages = [],
  } = context;

  return {
    status: 'success',
    meta: {
      crawledUrl,
      crawlDate: new Date().toISOString(),
      crawlDurationMs: durationMs,
      siteVertical,
      siteClassification,
      totalPagesVisited: crawledPages.length,
      pagesFetchedOk: crawledPages.filter((p) => p.ok).length,
      pagesFetchFailed: crawledPages.filter((p) => !p.ok).length,
      hasStructuredData: structuredData.foundSchema,
      fieldCount: countExtractedFields(extractionResult),
      slowPages: (slowPages || []).map((s) => ({ url: s.url, durationMs: s.duration, status: s.status, error: s.error || null })),
      slowPageCount: (slowPages || []).length,
    },
    data: extractionResult,
    audit: audit.toJSON(),
  };
}

/**
 * Count total extracted fields
 */
function countExtractedFields(data) {
  let count = 0;
  for (const [key, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && 'confidence' in value) {
      count++;
    }
  }
  return count;
}

// Export handled by default export above
export { orchestrateCrawl };

/**
 * Re-crawl a selected list of URLs with an increased timeout.
 * Returns page-like entries compatible with the main orchestrator output.
 */
export async function reCrawlSelectedPages(urls = [], opts = {}) {
  const timeout = opts.timeout || crawlConfig.slowRetryTimeoutMs || (crawlConfig.fetchTimeout * 3);
  const results = [];
  for (const url of Array.from(new Set(urls)).filter(Boolean)) {
    try {
      const entry = await fetchUrl(url, { timeout });
      results.push({
        url: entry.url,
        html: entry.html || '',
        status: entry.status,
        type: classifyUrl(entry.url),
        ok: entry.ok,
        error: entry.error || null,
        durationMs: entry.duration || 0,
      });
    } catch (err) {
      results.push({ url, html: '', status: 0, type: classifyUrl(url), ok: false, error: String(err), durationMs: 0 });
    }
  }
  return results;
}
