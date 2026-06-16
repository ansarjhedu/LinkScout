import parseSitemaps from "./sitemapParser.js";
import harvestLinks, { harvestLinksFromHtml, mergeDiscoveredLinks } from "./linkHarvester.js";
import fetchPool, { clearFetchCache } from "./fetchPool.js";
import parseRobotsTxt, { isPathAllowed } from "./robotsParser.js";
import fetchProxy from "../utils/fetchProxy.js";
import { fetchUrl } from "./fetchPool.js";
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
export default async function orchestrateCrawl(targetUrl, onProgress) {
  const startTime = Date.now();
  clearFetchCache();
  const normalizedTarget = normalizeUrl(targetUrl);

  onProgress(2, "Checking robots.txt compliance...", 0, 0, 0);
  const robots = await parseRobotsTxt(normalizedTarget);

  onProgress(5, "Fetching homepage and harvesting navigation links...", 0, 0, 0);
  // Use fetchPool.fetchUrl so homepage is included in unified telemetry and cache
  const homeEntry = await fetchUrl(normalizedTarget, { retries: 2, timeout: crawlConfig.fetchTimeout });

  if (!homeEntry.ok || !homeEntry.html) {
    throw new Error(homeEntry.error || "Unable to read homepage. All CORS proxies failed — the site may be blocking automated access.");
  }

  const homeHarvest = harvestLinks(normalizedTarget, homeEntry.html);
  let allDiscovered = [...(homeHarvest.internal || [])];

  onProgress(12, "Parsing sitemaps for site structure...", 0, 0, allDiscovered.length);
  const sitemapResult = await parseSitemaps(normalizedTarget, robots.sitemaps || []);
  allDiscovered = [...new Set([...allDiscovered, ...sitemapResult.urls])];

  if (sitemapResult.metrics?.durationMs > crawlConfig.sitemapFetchTimeoutMs * 2) {
    console.warn(`Sitemap discovery took too long (${sitemapResult.metrics.durationMs}ms). Falling back to homepage link discovery.`);
  }

  allDiscovered = allDiscovered.filter((url) => {
    try {
      return isPathAllowed(new URL(url).pathname, robots.disallowed || []);
    } catch {
      return true;
    }
  });

  const crawlBudget = crawlConfig.maxCrawlPages;
  const normalizedDiscovered = allDiscovered.map(normalizeUrl).filter((u) => u !== normalizedTarget);
  const seedQueue = prioritizeUrls(normalizedDiscovered, crawlBudget);
  const crawledPages = [{
    url: normalizedTarget,
    html: homeEntry.html,
    status: homeEntry.status || 200,
    type: "home",
    ok: true,
    duration: homeEntry.duration || null,
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

    onProgress(18 + Math.floor(((crawledPages.length - 1) / Math.max(crawlBudget, 1)) * 50), `Fetching batch ${crawledPages.length}/${crawlBudget}...`, 0, crawledPages.length, seenLinks.size);

    const fetched = await fetchPool(batch, {
      concurrency: crawlConfig.concurrency,
      skipUrls: new Set([normalizedTarget]),
      onProgress: (done, total, url) => {
        const pct = 18 + Math.floor(((crawledPages.length - 1 + done) / Math.max(crawlBudget, 1)) * 50);
        let pathname = "/";
        try { pathname = new URL(url).pathname; } catch { /* skip */ }
        onProgress(pct, `Fetching ${done}/${total}: ${pathname}`, 0, crawledPages.length + done, seenLinks.size);
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
  const okPages = crawledPages.filter((p) => p.ok && p.html);

  onProgress(78, "Extracting NAP, brands, and deployment URLs...", 20, crawledPages.length, allDiscovered.length);
  const napData = safeExtract("nap", () => extractNap(okPages, normalizedTarget, harvest.social || []), {});
  const brandData = safeExtract("brands", () => extractBrands(okPages), []);
  const urlResult = safeExtract("urls", () => extractUrls(okPages, allDiscovered, normalizedTarget, harvest.registry || []), { deploymentUrls: {}, linkRegistry: [] });
  const catalogData = safeExtract("catalog", () => extractCatalog(okPages), {});

  onProgress(84, "Extracting departments, finance, and service intelligence...", 60, crawledPages.length, allDiscovered.length);
  const deptData = safeExtract("departments", () => extractDepartments(okPages), {});
  const financeData = safeExtract("finance", () => extractFinance(okPages), {});
  const geoData = safeExtract("geo", () => extractGeo(okPages, napData), {});
  const historyData = safeExtract("history", () => extractHistory(okPages), {});
  const positioningData = safeExtract("positioning", () => extractPositioning(okPages, brandData), {});
  const inventoryData = safeExtract("inventory", () => extractInventory(okPages, brandData), {});
  const serviceData = safeExtract("service", () => extractService(okPages), {});
  const partsData = safeExtract("parts", () => extractParts(okPages), {});

  onProgress(92, "Building buyer psychology, seasonality, and claims...", 100, crawledPages.length, allDiscovered.length);
  const buyerData = safeExtract("buyerPsychology", () => extractBuyerPsychology(okPages, brandData), { profiles: [] });
  const seasonalityData = safeExtract("seasonality", () => extractSeasonality(okPages), {});
  const communityData = safeExtract("community", () => extractCommunity(okPages, napData), {});
  const claimsData = safeExtract("claims", () => extractClaims(okPages), {});
  const themesData = safeExtract("themes", () => extractThemes(positioningData, brandData, financeData), {});
  const platformData = safeExtract("platform", () => extractPlatform(okPages), {});
  const operationalData = safeExtract("operationalRules", () => extractOperationalRules(), {});
  const competitiveData = safeExtract("competitive", () => extractCompetitive(okPages), {});

  onProgress(96, "Merging, validating, and scoring completeness...", 140, crawledPages.length, allDiscovered.length);
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
      crawlStatus: p.crawlStatus || (p.ok ? "crawled" : "failed"),
    }));
    finalJson.meta.slowPages = finalJson.meta.crawledPages.filter((p) => p.isSlow);
    finalJson.meta.pageTiming = finalJson.meta.crawledPages.map((p) => ({
      url: p.url,
      durationMs: p.duration || null,
      ok: p.ok,
      isSlow: p.isSlow,
      crawlStatus: p.crawlStatus,
    }));
    finalJson.meta.sitemapMetrics = sitemapResult.metrics || {};
    finalJson.linkRegistry = urlResult.linkRegistry || [];
  } catch {
    // ignore
  }
  onProgress(100, "Crawl complete", fieldCount, crawledPages.length, allDiscovered.length);
  return finalJson;
}
