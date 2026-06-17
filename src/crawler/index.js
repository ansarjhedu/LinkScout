import parseSitemaps from "./sitemapParser.js";
import harvestLinks, { harvestLinksFromHtml, mergeDiscoveredLinks } from "./linkHarvester.js";
import fetchPool, { clearFetchCache, resetFetchTelemetry, getFetchTelemetry, fetchUrl } from "./fetchPool.js";
import parseRobotsTxt, { isPathAllowed } from "./robotsParser.js";
import fetchProxy from "../utils/fetchProxy.js";
import getLogger from "../utils/logger.js";
import crawlConfig from "../config/crawlConfig.js";
import { classifyUrl, prioritizeUrls, normalizeUrl } from "./urlClassifier.js";

import extractNap from "../extractors/nap.js";
import extractUrls from "../extractors/urls.js";
import extractBrands from "../extractors/brands.js";
import extractDepartments from "../extractors/departments.js";
import extractFinance from "../extractors/finance.js";
import extractGeo from "../extractors/geo.js";
import extractClaims from "../extractors/claims.js";
import extractHistory from "../extractors/history.js";
import extractPositioning from "../extractors/positioning.js";
import extractInventory from "../extractors/inventory.js";
import extractService from "../extractors/service.js";
import extractParts from "../extractors/parts.js";
import extractBuyerPsychology from "../extractors/buyerPsychology.js";
import extractSeasonality from "../extractors/seasonality.js";
import extractCommunity from "../extractors/community.js";
import extractThemes from "../extractors/themes.js";
import extractPlatform from "../extractors/platform.js";
import extractOperationalRules from "../extractors/operationalRules.js";
import extractCompetitive from "../extractors/competitive.js";
import extractCatalog from "../extractors/catalog.js";
import tagConfidence from "../extractors/confidence.js";

import mergeOutputs from "../processors/merger.js";
import validateOutput from "../processors/validator.js";

export { classifyUrl } from "./urlClassifier.js";

function safeExtract(name, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.error(`Extractor "${name}" failed:`, err);
    return fallback;
  }
}

/**
 * Full intelligence crawl pipeline — single entry point.
 */
export default async function orchestrateCrawl(targetUrl, onProgress, opts = {}) {
  const startTime = Date.now();
  clearFetchCache();
  getLogger().clear();
  resetFetchTelemetry();
  const normalizedTarget = normalizeUrl(targetUrl);
  const crawlBudget = Math.max(1, Number(opts.maxCrawlPages ?? crawlConfig.maxCrawlPages));
  const enableReCrawl = opts.enableReCrawl !== false;
  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  progress(2, "Checking robots.txt compliance...", 0, 0, 0, null);
  const robots = await parseRobotsTxt(normalizedTarget);

  progress(5, "Fetching homepage and harvesting navigation links...", 0, 0, 0, null);
  // Use fetchPool.fetchUrl so homepage is included in unified telemetry and cache
  const homeEntry = await fetchUrl(normalizedTarget, { retries: 2, timeout: crawlConfig.fetchTimeout });

  const homeEntryIsSlow = homeEntry.duration !== null && homeEntry.duration > crawlConfig.slowThresholdMs;
  getLogger().add(
    normalizedTarget,
    homeEntry.status || 0,
    homeEntry.duration || 0,
    homeEntry.ok
      ? homeEntryIsSlow
        ? `Homepage slow (> ${crawlConfig.slowThresholdMs}ms)`
        : "Homepage crawled"
      : `Homepage fetch failed: ${homeEntry.error || "unknown"}`
  );

  if (!homeEntry.ok || !homeEntry.html) {
    throw new Error(homeEntry.error || "Unable to read homepage. All CORS proxies failed — the site may be blocking automated access.");
  }

  const homeHarvest = harvestLinks(normalizedTarget, homeEntry.html);
  let allDiscovered = [...(homeHarvest.internal || [])];

  progress(12, "Parsing sitemaps for site structure...", 0, 0, allDiscovered.length, null);
  const sitemapResult = await parseSitemaps(normalizedTarget, robots.sitemaps || []);
  allDiscovered = [...new Set([...allDiscovered, ...sitemapResult.urls])];

  if (sitemapResult.metrics?.durationMs > crawlConfig.sitemapFetchTimeoutMs * 2) {
    const warningNote = `Sitemap discovery took too long (${sitemapResult.metrics.durationMs}ms). Falling back to homepage link discovery.`;
    console.warn(warningNote);
    getLogger().add(normalizedTarget, "SITEMAP", sitemapResult.metrics.durationMs, warningNote);
  }

  allDiscovered = allDiscovered.filter((url) => {
    try {
      return isPathAllowed(new URL(url).pathname, robots.disallowed || []);
    } catch {
      return true;
    }
  });

  const normalizedDiscovered = allDiscovered.map(normalizeUrl).filter((u) => u !== normalizedTarget);
  const seedQueue = prioritizeUrls(normalizedDiscovered, crawlBudget);
  const homeEntrySlow = homeEntry.duration !== null && homeEntry.duration > crawlConfig.slowThresholdMs;
  const crawledPages = [{
    url: normalizedTarget,
    html: homeEntry.html,
    status: homeEntry.status || 200,
    type: "home",
    ok: true,
    duration: homeEntry.duration || null,
    isSlow: homeEntrySlow,
    crawlStatus: homeEntrySlow ? "slow" : "crawled"
  }];
  const pageHarvests = [homeHarvest];
  const seenLinks = new Set([normalizedTarget, ...normalizedDiscovered]);
  const pendingQueue = [...seedQueue];

  while (pendingQueue.length > 0 && crawledPages.length - 1 < crawlBudget) {
    const batchSize = Math.min(
      Math.max(crawlConfig.concurrency, 6),
      pendingQueue.length,
      crawlBudget - (crawledPages.length - 1)
    );
    const batch = pendingQueue.splice(0, batchSize);

    progress(18 + Math.floor(((crawledPages.length - 1) / Math.max(crawlBudget, 1)) * 50), `Fetching batch ${crawledPages.length}/${crawlBudget}...`, 0, crawledPages.length, seenLinks.size, null);

    const fetched = await fetchPool(batch, {
      concurrency: crawlConfig.concurrency,
      skipUrls: new Set([normalizedTarget]),
      onProgress: (done, total, url) => {
        const pct = 18 + Math.floor(((crawledPages.length - 1 + done) / Math.max(crawlBudget, 1)) * 50);
        let pathname = "/";
        try { pathname = new URL(url).pathname; } catch { /* skip */ }
        progress(pct, `Fetching ${done}/${total}: ${pathname}`, 0, crawledPages.length + done, seenLinks.size, url);
      },
    });

    const newlyDiscovered = new Set();
    for (const entry of fetched) {
      const duration = entry.duration || null;
      const isSlow = duration !== null && duration > crawlConfig.slowThresholdMs;
      const crawlStatus = entry.ok ? (isSlow ? "slow" : "crawled") : "failed";

      crawledPages.push({
        url: entry.url,
        html: entry.html || "",
        status: entry.status,
        type: classifyUrl(entry.url, entry.html || ""),
        ok: entry.ok,
        error: entry.error || null,
        duration,
        isSlow,
        crawlStatus,
      });

      getLogger().add(
        entry.url,
        entry.status || 0,
        duration || 0,
        entry.ok
          ? isSlow
            ? `Page slow (> ${crawlConfig.slowThresholdMs}ms)`
            : "Page crawled"
          : `Fetch failed: ${entry.error || "unknown"}`
      );

      if (entry.ok && entry.html) {
        const pageHarvest = harvestLinksFromHtml(entry.url, entry.html, homeHarvest.registry || []);
        pageHarvests.push(pageHarvest);

        for (const discovery of pageHarvest.internal || []) {
          const normalizedDiscovery = normalizeUrl(discovery);
          if (!seenLinks.has(normalizedDiscovery) && normalizeUrl(discovery) !== normalizedTarget) {
            newlyDiscovered.add(normalizedDiscovery);
            seenLinks.add(normalizedDiscovery);
          }
        }
      }
    }

    if (newlyDiscovered.size > 0) {
      const extraTargets = prioritizeUrls(Array.from(newlyDiscovered), crawlBudget);
      for (const extra of extraTargets) {
        if (!pendingQueue.includes(extra) && crawledPages.every((p) => p.url !== extra)) {
          pendingQueue.push(extra);
        }
      }
    }
  }

  allDiscovered = [...seenLinks];
  const mergedHarvest = mergeDiscoveredLinks(normalizedTarget, pageHarvests);
  const harvest = mergedHarvest;
  // Perform an optional re-crawl pass for slow or above-average pages to improve data quality
  try {
    const durations = crawledPages.map((p) => (typeof p.duration === "number" ? p.duration : null)).filter((d) => d !== null);
    const averageDuration = durations.length ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length) : null;
    const reTargets = crawledPages
      .filter((p) => p.url !== normalizedTarget && (p.isSlow || (averageDuration !== null && typeof p.duration === "number" && p.duration > averageDuration)))
      .map((p) => p.url)
      .slice(0, 50); // safety cap for re-crawl

    const reCrawlSummary = { attempted: 0, successes: 0, updated: [] };
    if (reTargets.length > 0) {
      for (const url of reTargets) {
        reCrawlSummary.attempted += 1;
        try {
          const reEntry = await fetchUrl(url, { retries: Math.max(1, crawlConfig.fetchRetries + 1), timeout: crawlConfig.slowRetryTimeoutMs });
          const idx = crawledPages.findIndex((pp) => pp.url === url);
          if (idx >= 0) {
            crawledPages[idx] = {
              url: reEntry.url || url,
              html: reEntry.html || crawledPages[idx].html || "",
              status: reEntry.status || crawledPages[idx].status,
              type: classifyUrl(url, reEntry.html || crawledPages[idx].html || ""),
              ok: !!reEntry.ok,
              error: reEntry.error || crawledPages[idx].error || null,
              duration: reEntry.duration || reEntry.duration === 0 ? reEntry.duration : crawledPages[idx].duration,
              isSlow: (typeof reEntry.duration === "number" ? reEntry.duration : crawledPages[idx].duration) > crawlConfig.slowThresholdMs,
              crawlStatus: reEntry.ok ? ((typeof reEntry.duration === "number" && reEntry.duration > crawlConfig.slowThresholdMs) ? "slow" : "crawled") : "failed",
              proxyUsed: reEntry.proxyUsed || crawledPages[idx].proxyUsed || null,
            };
            reCrawlSummary.successes += reEntry.ok ? 1 : 0;
            reCrawlSummary.updated.push({ url, status: reEntry.status || null, duration: reEntry.duration || null, ok: !!reEntry.ok, proxyUsed: reEntry.proxyUsed || null });
            getLogger().add(url, reEntry.status || 0, reEntry.duration || 0, reEntry.ok ? `Re-crawled (improved data)` : `Re-crawl failed: ${reEntry.error || 'unknown'}`);
          }
        } catch (e) {
          getLogger().add(url, "ERR", 0, `Re-crawl exception: ${String(e)}`);
        }
      }
    }
    // attach re-crawl summary into meta for exports
    // will be merged later into finalJson.meta
    reCrawlSummary.averageDuration = averageDuration;
    // store locally to merge into finalJson later
    var __reCrawlSummary = reCrawlSummary;
  } catch (e) {
    console.warn("Re-crawl pass failed:", e);
  }

  const okPages = crawledPages.filter((p) => p.ok && p.html);

  progress(78, "Extracting NAP, brands, and deployment URLs...", 20, crawledPages.length, allDiscovered.length, null);
  const napData = safeExtract("nap", () => extractNap(okPages, normalizedTarget, harvest.social || []), {});
  const brandData = safeExtract("brands", () => extractBrands(okPages), []);
  const urlResult = safeExtract("urls", () => extractUrls(okPages, allDiscovered, normalizedTarget, harvest.registry || []), { deploymentUrls: {}, linkRegistry: [] });
  const catalogData = safeExtract("catalog", () => extractCatalog(okPages), {});

  progress(84, "Extracting departments, finance, and service intelligence...", 60, crawledPages.length, allDiscovered.length, null);
  const deptData = safeExtract("departments", () => extractDepartments(okPages), {});
  const financeData = safeExtract("finance", () => extractFinance(okPages), {});
  const geoData = safeExtract("geo", () => extractGeo(okPages, napData), {});
  const historyData = safeExtract("history", () => extractHistory(okPages), {});
  const positioningData = safeExtract("positioning", () => extractPositioning(okPages, brandData), {});
  const inventoryData = safeExtract("inventory", () => extractInventory(okPages, brandData), {});
  const serviceData = safeExtract("service", () => extractService(okPages), {});
  const partsData = safeExtract("parts", () => extractParts(okPages), {});

  progress(92, "Building buyer psychology, seasonality, and claims...", 100, crawledPages.length, allDiscovered.length, null);
  const buyerData = safeExtract("buyerPsychology", () => extractBuyerPsychology(okPages, brandData), { profiles: [] });
  const seasonalityData = safeExtract("seasonality", () => extractSeasonality(okPages), {});
  const communityData = safeExtract("community", () => extractCommunity(okPages, napData), {});
  const claimsData = safeExtract("claims", () => extractClaims(okPages), {});
  const themesData = safeExtract("themes", () => extractThemes(positioningData, brandData, financeData), {});
  const platformData = safeExtract("platform", () => extractPlatform(okPages), {});
  const operationalData = safeExtract("operationalRules", () => extractOperationalRules(), {});
  const competitiveData = safeExtract("competitive", () => extractCompetitive(okPages), {});

  progress(96, "Merging, validating, and scoring completeness...", 140, crawledPages.length, allDiscovered.length, null);
  const rawMaster = mergeOutputs({
    meta: {
      crawledUrl: normalizedTarget,
      crawlDate: new Date().toISOString(),
      crawlDurationMs: Date.now() - startTime,
      totalPagesVisited: crawledPages.length,
      pagesFetchedOk: okPages.length,
      pagesFetchFailed: crawledPages.length - okPages.length,
      linksDiscovered: allDiscovered.length,
      robotsTxt: robots.robotsUrl,
    },
    napData,
    urlData: urlResult.deploymentUrls,
    linkRegistry: urlResult.linkRegistry,
    brandData,
    catalogData,
    deptData,
    financeData,
    geoData,
    historyData,
    positioningData,
    inventoryData,
    serviceData,
    partsData,
    buyerData,
    seasonalityData,
    communityData,
    claimsData,
    themesData,
    platformData,
    operationalData,
    competitiveData,
  });

  const validatedMaster = safeExtract("validator", () => validateOutput(rawMaster, crawledPages), rawMaster);
  const finalJson = safeExtract("confidence", () => tagConfidence(validatedMaster), validatedMaster);

  const fieldCount = finalJson.meta.confidenceSummary?.totalFields || 0;
  // Attach raw crawled page summary (url, status, type, duration) for performance analysis
  try {
    finalJson.meta.crawledPages = (crawledPages || []).map((p) => ({
      url: p.url,
      status: p.status,
      type: p.type,
      ok: !!p.ok,
      duration: p.duration || null,
      isSlow: !!p.isSlow,
      proxyUsed: p.proxyUsed || null,
      crawlStatus: p.crawlStatus || (p.ok ? "crawled" : "failed"),
    }));

    const durations = finalJson.meta.crawledPages
      .map((p) => typeof p.duration === "number" ? p.duration : null)
      .filter((duration) => duration !== null);
    const averageDurationMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;

    finalJson.meta.averagePageDurationMs = averageDurationMs;
    finalJson.meta.pagesAboveAverage = finalJson.meta.crawledPages
      .filter((p) => typeof p.duration === "number" && averageDurationMs !== null && p.duration > averageDurationMs)
      .map((p) => ({
        url: p.url,
        duration: p.duration,
        ok: p.ok,
        isSlow: p.isSlow,
        crawlStatus: p.crawlStatus,
        status: p.status,
      }));
    finalJson.meta.pagesAboveAverageCount = finalJson.meta.pagesAboveAverage.length;
    finalJson.meta.slowPages = finalJson.meta.crawledPages.filter((p) => p.isSlow);
    finalJson.meta.pagesAboveThresholdCount = finalJson.meta.slowPages.length;
    finalJson.meta.pageTiming = finalJson.meta.crawledPages.map((p) => ({
      url: p.url,
      durationMs: p.duration || null,
      ok: p.ok,
      isSlow: p.isSlow,
      crawlStatus: p.crawlStatus,
    }));
    finalJson.meta.sitemapMetrics = sitemapResult.metrics || {};
    finalJson.linkRegistry = urlResult.linkRegistry || [];
    // attach low-level fetch telemetry and re-crawl summary for diagnostic export
    try {
      finalJson.meta.fetchTelemetry = getFetchTelemetry();
    } catch { /* ignore if not available */ }
    try {
      finalJson.meta.reCrawlSummary = typeof __reCrawlSummary !== 'undefined' ? __reCrawlSummary : { attempted: 0, successes: 0, updated: [], averageDuration: null };
    } catch { /* ignore */ }
  } catch {
    // ignore
  }
  progress(100, "Crawl complete", fieldCount, crawledPages.length, allDiscovered.length, null);
  return finalJson;
}
