/**
 * Centralized crawl configuration sourced from Vite environment variables.
 */
let _env;
try {
  _env = import.meta.env || {};
} catch (e) {
  _env = (typeof process !== 'undefined' && process.env) ? process.env : {};
}

const crawlConfig = {
  corsProxyUrl: _env.VITE_CORS_PROXY_URL || _env.VITE_CORS_PROXY_URL || "https://api.allorigins.win/raw?url=",
  proxyUrl: _env.VITE_PROXY_URL || _env.PROXY_URL || _env.HTTPS_PROXY || _env.https_proxy || _env.HTTP_PROXY || _env.http_proxy || null,
  // Production defaults: optimized for faster deep crawl budgets
  maxCrawlPages: Number(_env.VITE_MAX_CRAWL_PAGES) || 5000,
  rateLimitMs: Number(_env.VITE_CRAWL_RATE_LIMIT_MS) || 40,
  concurrency: Number(_env.VITE_CRAWL_CONCURRENCY) || 10,
  appTitle: _env.VITE_APP_TITLE || "MaxOpp Intelligence Crawler",
  fetchTimeout: Number(_env.VITE_FETCH_TIMEOUT_MS) || 18000,
  // Longer timeout for collection/inventory pages (often heavy with filters + dynamic content)
  collectionTimeoutMs: Number(_env.VITE_COLLECTION_TIMEOUT_MS) || 30000,
  fetchRetries: Number(_env.VITE_FETCH_RETRIES) || 1,
  productPageBudget: 15,
  collectionPageBudget: 8,
};

export default crawlConfig;
