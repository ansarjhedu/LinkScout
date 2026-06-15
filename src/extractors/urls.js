import parseHtml from "../utils/domParser.js";
import {
  buildField,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
} from "../utils/fieldBuilder.js";
import { classifyUrl, deploymentKeyForType, classifySocialUrl } from "../crawler/urlClassifier.js";
import { KNOWN_BRANDS } from "../config/brandParents.js";

const URL_PATTERNS = {
  home: /^\/$/i,
  about: /about|history|story|who-we-are|profile|our-dealership/i,
  newInventory: /new-inventory|inventory\/new|search\/new|search-inventory\/new|vehicles\/new|all-new/i,
  usedInventory: /used-inventory|inventory\/used|search\/used|search-inventory\/pre-owned|pre-owned|preowned/i,
  service: /service|repair|maintenance|tune-up|oil-change|service-dept/i,
  parts: /parts|accessories|gear|apparel|parts-dept/i,
  finance: /finance|financing/i,
  creditApp: /credit-app|apply-for-credit|secure-finance-application|finance-application|pre-qualify/i,
  tradeIn: /trade|value-your-trade|trade-in|appraisal|sell-your/i,
  promotions: /promotions|specials|deals|offers|discounts|in-stock-deals/i,
  contact: /contact|location|directions|hours/i,
  scheduler: /schedule|book-service|appointment|service-scheduler/i,
  staff: /staff|team|meet-our-team|employees/i,
  blog: /blog|news|articles/i,
  events: /events|calendar/i,
  reviews: /reviews|testimonials|feedback/i,
  testDrive: /test-drive|test-ride|schedule-ride|demo-ride/i,
  partsRequest: /parts-request|request-parts|order-parts/i,
};

function identifyLinkContext(urlStr, homeHtml) {
  if (!homeHtml) return "sitemap";
  try {
    const helper = parseHtml(homeHtml);
    const path = new URL(urlStr).pathname;
    const navAnchors = helper.attrAll("header a[href], nav a[href], [class*='menu'i] a[href], [class*='nav'i] a[href]", "href");
    if (navAnchors.some((h) => h.includes(path))) return "nav-link";
    const footerAnchors = helper.attrAll("footer a[href], [class*='footer'i] a[href]", "href");
    if (footerAnchors.some((h) => h.includes(path))) return "footer-link";
  } catch { /* skip */ }
  return "sitemap";
}

function normalizeBrandLabel(text) {
  const cleaned = text.trim();
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`^${brand.replace("-", "[- ]?")}$`, "i").test(cleaned)) return brand;
  }
  if (/can\s*am/i.test(cleaned)) return "Can-Am";
  if (/sea\s*doo/i.test(cleaned)) return "Sea-Doo";
  if (/atlas/i.test(cleaned)) return "Atlas Golf";
  if (/waverunner/i.test(cleaned)) return "Yamaha";
  return null;
}

function isBrandInventoryPath(pathname) {
  const path = pathname.toLowerCase();
  const hasBrand = /polaris|honda|kawasaki|can-?am|sea-?doo|ktm|suzuki|spyder|atlas|yamaha/i.test(path);
  const hasInventory = /inventory|vehicles|models|showcase|search-inventory|shop/i.test(path);
  return hasBrand && hasInventory;
}

/**
 * Harvests brand-specific inventory URLs from nav links and internal link registry.
 */
function extractBrandInventoryUrls(allLinks, homePage, targetUrl, crawledPages) {
  const brandUrls = new Map();
  const homeHtml = homePage.html || "";

  // 1. Scan all internal links for brand+inventory path patterns
  for (const link of allLinks) {
    try {
      const path = new URL(link).pathname;
      if (!isBrandInventoryPath(path)) continue;
      const brandMatch = path.match(/polaris|honda|kawasaki|can-?am|sea-?doo|ktm|suzuki|spyder|atlas|yamaha/i);
      const brand = brandMatch ? normalizeBrandLabel(brandMatch[0]) || brandMatch[0] : "Unknown";
      if (!brandUrls.has(link)) {
        brandUrls.set(link, {
          brand,
          url: link,
          confidence: crawledPages.some((p) => p.url === link && p.status === 200) ? "VERIFIED" : "INFERRED",
          source: identifyLinkContext(link, homeHtml),
        });
      }
    } catch { /* skip */ }
  }

  // 2. Scan homepage anchor text for brand nav items (DX1 dropdown pattern)
  if (homeHtml) {
    const helper = parseHtml(homeHtml);
    const anchors = helper.doc.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      const text = anchor.textContent?.trim() || "";
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) continue;

      const brand = normalizeBrandLabel(text);
      if (!brand) continue;

      try {
        const absolute = new URL(href, targetUrl).href;
        if (!brandUrls.has(absolute)) {
          brandUrls.set(absolute, {
            brand,
            url: absolute,
            confidence: crawledPages.some((p) => p.url === absolute && p.status === 200) ? "VERIFIED" : "INFERRED",
            source: identifyLinkContext(absolute, homeHtml),
          });
        }
      } catch { /* skip */ }
    }
  }

  return [...brandUrls.values()].slice(0, 15);
}

function buildLinkRegistry(allLinks, crawledPages, homeHtml) {
  const registry = [];
  const seen = new Set();

  for (const url of allLinks) {
    if (seen.has(url)) continue;
    seen.add(url);

    const social = classifySocialUrl(url);
    const crawled = crawledPages.find((p) => p.url === url);
    const pageType = social ? "social" : (crawled?.type || classifyUrl(url));

    registry.push({
      url,
      category: social ? `social-${social}` : pageType,
      pageType,
      deploymentKey: deploymentKeyForType(pageType),
      source: identifyLinkContext(url, homeHtml),
      status: crawled?.status ?? null,
      confidence: crawled?.status === 200 ? "VERIFIED" : crawled ? "INFERRED" : "INFERRED",
    });
  }

  return registry.sort((a, b) => a.category.localeCompare(b.category));
}

export default function extractUrls(crawledPages, discoveredUrls, targetUrl, harvestRegistry = []) {
  const safePages = Array.isArray(crawledPages) ? crawledPages : [];
  const safeDiscovered = Array.isArray(discoveredUrls) ? discoveredUrls : [];
  const safeRegistry = Array.isArray(harvestRegistry) ? harvestRegistry : [];
  const homePage = safePages.find((p) => p.type === "home") || { html: "", url: targetUrl };
  const allLinks = [...new Set([...safeDiscovered, ...safePages.map((p) => p.url)])];
  const deploymentUrls = {};

  for (const [key, pattern] of Object.entries(URL_PATTERNS)) {
    let bestMatch = null;
    if (key === "home") {
      bestMatch = targetUrl;
    } else {
      const matches = allLinks.filter((link) => {
        try { return pattern.test(new URL(link).pathname); } catch { return false; }
      });
      if (matches.length) {
        matches.sort((a, b) => a.length - b.length);
        bestMatch = matches[0];
      }
    }

    if (bestMatch) {
      const crawled = crawledPages.find((p) => p.url === bestMatch);
      const isVerified = key === "home" || crawled?.status === 200;
      deploymentUrls[key] = buildField(
        bestMatch,
        isVerified ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.INFERRED,
        identifyLinkContext(bestMatch, homePage.html),
        null,
        isVerified ? EVIDENCE_TYPES.EXPLICIT_TAG : EVIDENCE_TYPES.LINK_PATTERN,
        { urlType: key, httpStatus: crawled?.status }
      );
    } else {
      deploymentUrls[key] = buildField(
        null,
        CONFIDENCE_LEVELS.MISSING,
        null,
        MISSING_REASONS.NO_MATCHING_LINK,
        EVIDENCE_TYPES.LINK_PATTERN,
        { urlType: key }
      );
    }
  }

  const brandUrls = extractBrandInventoryUrls(allLinks, homePage, targetUrl, safePages);

  const brandConfidence = brandUrls.length
    ? brandUrls.some((b) => b.confidence === "VERIFIED")
      ? CONFIDENCE_LEVELS.VERIFIED
      : CONFIDENCE_LEVELS.INFERRED
    : CONFIDENCE_LEVELS.MISSING;

  deploymentUrls.brandInventoryUrls = buildField(
    brandUrls.length ? brandUrls : null,
    brandConfidence,
    brandUrls.length ? homePage.url : null,
    !brandUrls.length ? MISSING_REASONS.NOT_ON_WEBSITE : null,
    EVIDENCE_TYPES.LINK_PATTERN,
    { method: 'brand_url_extraction', count: brandUrls.length }
  );

  const registry = buildLinkRegistry(allLinks, safePages, homePage.html);
  for (const entry of safeRegistry) {
    if (!registry.some((r) => r.url === entry.url)) {
      registry.push({
        ...entry,
        pageType: entry.pageType || classifyUrl(entry.url),
        category: entry.category || classifyUrl(entry.url),
        deploymentKey: deploymentKeyForType(entry.pageType || classifyUrl(entry.url)),
        status: entry.status ?? null,
      });
    }
  }

  return { deploymentUrls, linkRegistry: registry };
}
