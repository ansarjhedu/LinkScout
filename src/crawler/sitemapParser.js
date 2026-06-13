import fetchProxy from "../utils/fetchProxy.js";
import crawlConfig from "../config/crawlConfig.js";
import rateLimit from "./rateLimiter.js";

function extractLocUrls(xmlText) {
  const urls = [];
  if (!xmlText) return urls;
  const cleanedXml = xmlText.replace(/<!\[CDATA\[(.*?)\]\]>/gi, "$1");
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(cleanedXml)) !== null) {
    urls.push(match[1].trim());
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

export default async function parseSitemaps(homepageUrl, extraSitemaps = []) {
  const discoveredUrls = new Set();
  const baseObj = new URL(homepageUrl);
  const safeExtras = Array.isArray(extraSitemaps) ? extraSitemaps : [];

  const sitemapEndpoints = [
    ...COMMON_SITEMAP_PATHS.map((p) => new URL(p, baseObj.origin).href),
    ...safeExtras,
  ];

  const subSitemapsToFetch = [];

  for (const sitemapUrl of [...new Set(sitemapEndpoints)]) {
    try {
      await rateLimit(crawlConfig.rateLimitMs);
      const response = await fetchProxy(sitemapUrl, { retries: 1, timeout: 8000 });
      if (response.ok && response.html) {
        const urls = extractLocUrls(response.html);
        for (const loc of urls) {
          if (loc.endsWith(".xml") || /sitemap/i.test(loc)) {
            subSitemapsToFetch.push(loc);
          } else {
            discoveredUrls.add(loc);
          }
        }
      }
    } catch { /* skip */ }
  }

  const nestedLimit = Math.min(subSitemapsToFetch.length, 12);
  for (let i = 0; i < nestedLimit; i++) {
    try {
      await rateLimit(crawlConfig.rateLimitMs);
      const response = await fetchProxy(subSitemapsToFetch[i], { retries: 0, timeout: 6000 });
      if (response.ok && response.html) {
        for (const loc of extractLocUrls(response.html)) {
          if (!loc.endsWith(".xml") && !/sitemap/i.test(loc)) {
            discoveredUrls.add(loc);
          }
        }
      }
    } catch { /* skip */ }
  }

  return [...discoveredUrls];
}
