/**
 * Central URL classification registry — CMS-agnostic patterns.
 */

const CLASSIFICATION_RULES = [
  { type: "home", pattern: /^\/$|^\/index\.(html|php|aspx)$/i },
  { type: "about", pattern: /about|history|story|who-we-are|profile|our-dealership/i },
  { type: "inventory-new", pattern: /new-inventory|inventory\/new|search\/new|search-inventory\/new|vehicles\/new|all-new|inventory-new|\/new\//i },
  { type: "inventory-used", pattern: /used-inventory|inventory\/used|search\/used|search-inventory\/pre-owned|pre-owned|preowned|inventory-used|\/used\//i },
  { type: "product", pattern: /\/product[s]?\/|\/vehicle[s]?\/|\/unit[s]?\/|\/listing[s]?\/|\/vdp\/|\/detail[s]?\/|\/item[s]?\/|\/p\/|\/sku\/|\/motorcycle[s]?\/[^/]+$/i },
  { type: "collection", pattern: /\/collection[s]?\/|\/categor(y|ies)\/|\/shop\/|\/browse\/|\/department[s]?\/|\/brand[s]?\/|\/make[s]?\/|\/model[s]?\/|\/lineup[s]?\/|\/showcase\//i },
  { type: "service", pattern: /service|repair|maintenance|tune-up|oil-change|service-dept/i },
  { type: "parts", pattern: /parts|accessories|gear|apparel|parts-dept|order-parts/i },
  { type: "credit-app", pattern: /credit-app|apply-for-credit|secure-finance-application|finance-application|pre-qualify/i },
  { type: "finance", pattern: /finance|financing|apply|credit|loan|prequalify/i },
  { type: "trade-in", pattern: /trade|value-your-trade|trade-in|appraisal|sell-your/i },
  { type: "promotions", pattern: /promotions|specials|deals|offers|discounts|in-stock-deals|sale[s]?/i },
  { type: "contact", pattern: /contact|location|directions|hours/i },
  { type: "scheduler", pattern: /schedule|book-service|appointment|service-scheduler/i },
  { type: "staff", pattern: /staff|team|meet-our-team|employees/i },
  { type: "blog", pattern: /blog|news|articles/i },
  { type: "events", pattern: /events|calendar/i },
  { type: "reviews", pattern: /reviews|testimonials|feedback/i },
  { type: "test-drive", pattern: /test-drive|test-ride|schedule-ride|demo-ride/i },
  { type: "parts-request", pattern: /parts-request|request-parts|order-parts/i },
  { type: "brand-inventory", pattern: /polaris|honda|kawasaki|can-am|sea-doo|ktm|suzuki|spyder|atlas|yamaha|harley/i },
];

const DEPLOYMENT_KEY_MAP = {
  home: "home",
  about: "about",
  "inventory-new": "newInventory",
  "inventory-used": "usedInventory",
  service: "service",
  parts: "parts",
  finance: "finance",
  "credit-app": "creditApp",
  "trade-in": "tradeIn",
  promotions: "promotions",
  contact: "contact",
  scheduler: "scheduler",
  staff: "staff",
  blog: "blog",
  events: "events",
  reviews: "reviews",
  "test-drive": "testDrive",
  "parts-request": "partsRequest",
};

const SOCIAL_DOMAINS = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  youtube: "youtube.com",
  tiktok: "tiktok.com",
  twitter: ["twitter.com", "x.com"],
  linkedin: "linkedin.com",
};

export function classifyUrl(urlStr) {
  try {
    const path = new URL(urlStr).pathname.toLowerCase();
    if (path === "/" || path === "") return "home";

    for (const rule of CLASSIFICATION_RULES) {
      if (rule.type === "finance" && /app|apply/i.test(path)) continue;
      if (rule.pattern.test(path)) return rule.type;
    }
    return "other";
  } catch {
    return "other";
  }
}

export function deploymentKeyForType(pageType) {
  return DEPLOYMENT_KEY_MAP[pageType] || null;
}

export function classifySocialUrl(urlStr) {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    for (const [platform, domain] of Object.entries(SOCIAL_DOMAINS)) {
      const domains = Array.isArray(domain) ? domain : [domain];
      if (domains.some((d) => host.includes(d))) return platform;
    }
  } catch { /* skip */ }
  return null;
}

export function normalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin}${path}`;
  } catch {
    return urlStr;
  }
}

const TIER_PRIORITY = [
  ["home", 1], ["contact", 1], ["about", 1], ["service", 1], ["parts", 1], ["finance", 1],
  ["credit-app", 2], ["trade-in", 2], ["inventory-new", 2], ["inventory-used", 2], ["promotions", 2],
  ["collection", 2], ["scheduler", 3], ["staff", 3], ["blog", 3], ["events", 3], ["reviews", 3],
  ["test-drive", 3], ["parts-request", 3], ["brand-inventory", 4], ["product", 5],
];

/**
 * Prioritizes URLs into a budget-limited crawl set.
 */
export function prioritizeUrls(urls, budget = 80) {
  const safeUrls = Array.isArray(urls) ? urls : [];
  const byType = {};

  for (const url of safeUrls) {
    const type = classifyUrl(url);
    if (!byType[type]) byType[type] = [];
    byType[type].push(url);
  }

  const result = [];
  const perTypeLimit = {
    home: 1,
    "inventory-new": 3,
    "inventory-used": 3,
    "brand-inventory": 8,
    collection: 8,
    product: 15,
    promotions: 3,
  };

  for (const [type] of TIER_PRIORITY) {
    if (!byType[type]) continue;
    const limit = perTypeLimit[type] || (type === "home" ? 1 : 2);
    const sorted = [...byType[type]].sort((a, b) => a.length - b.length);
    result.push(...sorted.slice(0, limit));
  }

  const remaining = safeUrls.filter((u) => !result.includes(u));
  const fill = budget - result.length;
  if (fill > 0) result.push(...remaining.slice(0, fill));

  return [...new Set(result)].slice(0, budget);
}

export { DEPLOYMENT_KEY_MAP, SOCIAL_DOMAINS, CLASSIFICATION_RULES };
