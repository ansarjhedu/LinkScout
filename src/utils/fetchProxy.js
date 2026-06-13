import getLogger from "./logger.js";
import crawlConfig from "../config/crawlConfig.js";
import { PROXY_PROVIDERS } from "./proxyProviders.js";

/**
 * Performs a CORS-safe HTTP request by rotating through multiple public proxy providers.
 */
export default async function fetchProxy(url, options = {}) {
  const {
    retries = crawlConfig.fetchRetries,
    timeout = crawlConfig.fetchTimeout,
    method = "GET",
  } = options;

  const logger = getLogger();
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const provider of PROXY_PROVIDERS) {
      const startTime = performance.now();
      const controller = new AbortController();
      const timerId = setTimeout(() => controller.abort(), timeout);

      try {
        const proxyUrl = provider.buildUrl(url);
        const response = await fetch(proxyUrl, {
          method: method === "HEAD" ? "GET" : method,
          signal: controller.signal,
          headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        });

        clearTimeout(timerId);
        const durationMs = Math.round(performance.now() - startTime);

        if (!response.ok) {
          throw new Error(`${provider.name}: proxy HTTP ${response.status}`);
        }

        const html = await provider.parseResponse(response);

        if (!html || html.length < 10) {
          throw new Error(`${provider.name}: empty response body`);
        }

        logger.add(url, 200, durationMs, `OK via ${provider.name} (attempt ${attempt + 1})`);
        return { html, status: 200, finalUrl: url, ok: true, proxyUsed: provider.name };
      } catch (error) {
        clearTimeout(timerId);
        const durationMs = Math.round(performance.now() - startTime);
        const isTimeout = error.name === "AbortError";
        const detail = isTimeout ? "Connection timed out" : error.message;

        logger.add(url, isTimeout ? "TIMEOUT" : "ERR", durationMs, `${provider.name} failed: ${detail}`);
        lastError = error;
      }
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }

  return {
    html: "",
    status: lastError?.name === "AbortError" ? "TIMEOUT" : "ERR",
    finalUrl: url,
    ok: false,
    error: lastError?.message || "All proxy providers failed",
  };
}
