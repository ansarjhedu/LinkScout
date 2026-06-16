import fetchProxy from "../utils/fetchProxy.js";
import crawlConfig from "../config/crawlConfig.js";
import rateLimit from "./rateLimiter.js";

function extractLocUrls(xmlText, maxEntries = 250) {
  const urls = [];
  if (!xmlText) return urls;
  const cleanedXml = xmlText.replace(/<!\[CDATA\[(.*?)\]\]>/gi, "$1");
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(cleanedXml)) !== null) {
    urls.push(match[1].trim());
    if (urls.length >= maxEntries) break;
  }
  return [...new Set(urls)];
}

const COMMON_SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/sitemap1.xml",
  "/wp-sitemap.xml",
  "/sitemap/sitemap-index.xml",
  "/sitemaps/sitemap.xml",
];

async function fetchSitemapXml(url, timeout) {
  try {
    await rateLimit(crawlConfig.rateLimitMs);
    const response = await fetchProxy(url, { retries: 0, timeout });
    return { url, ok: response.ok, html: response.html || "", status: response.status, error: response.error };
  } catch (err) {
    return { url, ok: false, html: "", status: err.status || 0, error: err.message || String(err) };
  }
}

export default async function parseSitemaps(homepageUrl, extraSitemaps = []) {
  const startTime = Date.now();
  const discoveredUrls = new Set();
  const baseObj = new URL(homepageUrl);
  const safeExtras = Array.isArray(extraSitemaps) ? extraSitemaps : [];

  const sitemapEndpoints = [
    ...COMMON_SITEMAP_PATHS.map((p) => new URL(p, baseObj.origin).href),
    ...safeExtras,
  ]
    .filter(Boolean)
    .map((u) => u.trim())
    .filter((u) => !!u);

  const uniqueEndpoints = [...new Set(sitemapEndpoints)].slice(0, crawlConfig.sitemapMaxCandidates);
  const nestedSitemaps = new Set();
  let attemptedSitemaps = 0;
  let successfulSitemaps = 0;

  const firstLevel = await Promise.allSettled(
    uniqueEndpoints.map((sitemapUrl) => fetchSitemapXml(sitemapUrl, crawlConfig.sitemapFetchTimeoutMs))
  );

  for (const result of firstLevel) {
    if (result.status !== "fulfilled") continue;
    const sitemap = result.value;
    attemptedSitemaps += 1;
    if (!sitemap.ok || !sitemap.html) continue;

    successfulSitemaps += 1;
    const urls = extractLocUrls(sitemap.html, crawlConfig.sitemapMaxLinks);
    for (const loc of urls) {
      if (!loc) continue;
      if (loc.endsWith(".xml") || /sitemap/i.test(loc)) {
        if (nestedSitemaps.size < crawlConfig.sitemapMaxNested) nestedSitemaps.add(loc);
      } else {
        discoveredUrls.add(loc);
      }
    }
  }

  const nestedCandidates = Array.from(nestedSitemaps).slice(0, crawlConfig.sitemapMaxNested);
  const nestedResults = await Promise.allSettled(
    nestedCandidates.map((sitemapUrl) => fetchSitemapXml(sitemapUrl, crawlConfig.sitemapFetchTimeoutMs))
  );

  for (const result of nestedResults) {
    if (result.status !== "fulfilled") continue;
    const sitemap = result.value;
    attemptedSitemaps += 1;
    if (!sitemap.ok || !sitemap.html) continue;

    successfulSitemaps += 1;
    const urls = extractLocUrls(sitemap.html, crawlConfig.sitemapMaxLinks);
    for (const loc of urls) {
      if (!loc) continue;
      if (!loc.endsWith(".xml") && !/sitemap/i.test(loc)) {
        discoveredUrls.add(loc);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    urls: [...discoveredUrls].slice(0, crawlConfig.sitemapMaxLinks),
    metrics: {
      durationMs,
      attemptedSitemaps,
      successfulSitemaps,
      discoveredUrlCount: discoveredUrls.size,
      sitemapCandidates: uniqueEndpoints.length,
      nestedSitemaps: nestedCandidates.length,
    },
  };
}
