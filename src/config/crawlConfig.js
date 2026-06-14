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
  maxCrawlPages: Number(_env.VITE_MAX_CRAWL_PAGES) || 80,
  // Raise defaults to allow deeper crawls in server/CI environments; still configurable via env vars
  maxCrawlPages: Number(_env.VITE_MAX_CRAWL_PAGES) || 500,
  rateLimitMs: Number(_env.VITE_CRAWL_RATE_LIMIT_MS) || 100,
  concurrency: Number(_env.VITE_CRAWL_CONCURRENCY) || 8,
  appTitle: _env.VITE_APP_TITLE || "MaxOpp Intelligence Crawler",
  fetchTimeout: Number(_env.VITE_FETCH_TIMEOUT_MS) || 15000,
  fetchRetries: 2,
  productPageBudget: 15,
  collectionPageBudget: 8,
};

export default crawlConfig;
