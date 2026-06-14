import parseSitemaps from "./sitemapParser.js";
import harvestLinks, { harvestLinksFromHtml, mergeDiscoveredLinks } from "./linkHarvester.js";
import fetchPool, { clearFetchCache } from "./fetchPool.js";
import parseRobotsTxt, { isPathAllowed } from "./robotsParser.js";
import fetchProxy from "../utils/fetchProxy.js";
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
  const homeRes = await fetchProxy(normalizedTarget, { retries: 2, timeout: crawlConfig.fetchTimeout });

  if (!homeRes.ok || !homeRes.html) {
    throw new Error(
      homeRes.error ||
      "Unable to read homepage. All CORS proxies failed — the site may be blocking automated access."
    );
  }

  const homeHarvest = harvestLinks(normalizedTarget, homeRes.html);
  let allDiscovered = [...(homeHarvest.internal || [])];

  onProgress(12, "Parsing sitemaps for site structure...", 0, 0, allDiscovered.length);
  const sitemapLinks = await parseSitemaps(normalizedTarget, robots.sitemaps || []);
  allDiscovered = [...new Set([...allDiscovered, ...sitemapLinks])];

  allDiscovered = allDiscovered.filter((url) => {
    try {
      return isPathAllowed(new URL(url).pathname, robots.disallowed || []);
    } catch {
      return true;
    }
  });

  let crawlTargets = prioritizeUrls(allDiscovered, crawlConfig.maxCrawlPages);
  const targetsToCrawl = crawlTargets.filter((u) => normalizeUrl(u) !== normalizedTarget);

  const crawledPages = [{
    url: normalizedTarget,
    html: homeRes.html,
    status: 200,
    type: "home",
    ok: true,
  }];

  onProgress(18, `Fetching ${targetsToCrawl.length} priority pages...`, 0, 1, allDiscovered.length);

  const fetched = await fetchPool(targetsToCrawl, {
    concurrency: crawlConfig.concurrency,
    skipUrls: new Set([normalizedTarget]),
    onProgress: (done, total, url) => {
      const pct = 18 + Math.floor((done / Math.max(total, 1)) * 50);
      let pathname = "/";
      try { pathname = new URL(url).pathname; } catch { /* skip */ }
      onProgress(pct, `Fetching ${done}/${total}: ${pathname}`, 0, done + 1, allDiscovered.length);
    },
  });

  const pageHarvests = [homeHarvest];

  for (const entry of fetched) {
    crawledPages.push({
      url: entry.url,
      html: entry.html || "",
      status: entry.status,
      type: classifyUrl(entry.url),
      ok: entry.ok,
      error: entry.error || null,
    });

    if (entry.ok && entry.html) {
      const pageHarvest = harvestLinksFromHtml(entry.url, entry.html, homeHarvest.registry || []);
      pageHarvests.push(pageHarvest);
    }
  }

  // Second-pass link discovery from all fetched page HTML
  onProgress(72, "Discovering product/collection pages from crawled content...", 0, crawledPages.length, allDiscovered.length);
  const mergedHarvest = mergeDiscoveredLinks(normalizedTarget, pageHarvests);
  const newLinks = mergedHarvest.internal.filter((u) => !allDiscovered.includes(u));
  allDiscovered = [...new Set([...allDiscovered, ...mergedHarvest.internal])];

  if (newLinks.length > 0) {
    // Expand second-pass discovery budget to match overall crawl budget
    const extraTargets = prioritizeUrls(newLinks, crawlConfig.maxCrawlPages).filter(
      (u) => !crawledPages.some((p) => p.url === u)
    );

    if (extraTargets.length > 0) {
      onProgress(74, `Fetching ${extraTargets.length} newly discovered pages...`, 0, crawledPages.length, allDiscovered.length);
      const extraFetched = await fetchPool(extraTargets, {
        concurrency: crawlConfig.concurrency,
        skipUrls: new Set(crawledPages.map((p) => p.url)),
      });

      for (const entry of extraFetched) {
        crawledPages.push({
          url: entry.url,
          html: entry.html || "",
          status: entry.status,
          type: classifyUrl(entry.url),
          ok: entry.ok,
          error: entry.error || null,
        });
        if (entry.ok && entry.html) {
          harvestLinksFromHtml(entry.url, entry.html, mergedHarvest.registry || []);
        }
      }
    }
  }

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
  onProgress(100, "Crawl complete", fieldCount, crawledPages.length, allDiscovered.length);
  return finalJson;
}
