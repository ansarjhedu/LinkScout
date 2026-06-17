import getLogger from "./logger.js";
import crawlConfig from "../config/crawlConfig.js";
import { PROXY_PROVIDERS } from "./proxyProviders.js";

const isNode = typeof process !== "undefined" && process?.versions?.node;

let _globalHttpAgent;
let _globalHttpsAgent;
const dynamicImport = (specifier) => new Function("specifier", "return import(specifier)")(specifier);

function getProxyEnvironmentUrl() {
  if (!isNode) return null;
  return (
    crawlConfig.proxyUrl ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null
  );
}

function defaultFetchHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  };
}

async function createProxyAgent(proxyUrl) {
  if (!proxyUrl || !isNode) return undefined;
  const { HttpsProxyAgent } = await dynamicImport("https-proxy-agent");
  return new HttpsProxyAgent({
    protocol: proxyUrl.startsWith("https") ? "https:" : "http:",
    host: proxyUrl,
    keepAlive: true,
  });
}

async function directNodeFetchUrl(url, method, signal, proxyUrl) {
  if (!isNode) {
    throw new Error("directNodeFetchUrl is only available in Node environments");
  }

  const { default: nodeFetch } = await dynamicImport("node-fetch");
  const requestOptions = {
    method,
    signal,
    headers: defaultFetchHeaders(),
  };

  // prefer proxy agent when explicitly provided, otherwise reuse a keep-alive agent
  if (proxyUrl) {
    requestOptions.agent = await createProxyAgent(proxyUrl);
  } else {
    try {
      if (!_globalHttpAgent || !_globalHttpsAgent) {
        const http = await dynamicImport("http");
        const https = await dynamicImport("https");
        _globalHttpAgent = new http.Agent({ keepAlive: true });
        _globalHttpsAgent = new https.Agent({ keepAlive: true });
      }
      requestOptions.agent = (parsedUrl) => (parsedUrl.protocol === "https:" ? _globalHttpsAgent : _globalHttpAgent);
    } catch {
      // fallback: no agent
    }
  }

  return nodeFetch(url, requestOptions);
}

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

  if (isNode) {
    const nodeProxyUrl = getProxyEnvironmentUrl();
    const startTime = performance.now();
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await directNodeFetchUrl(url, method === "HEAD" ? "GET" : method, controller.signal, nodeProxyUrl);
      clearTimeout(timerId);
      const durationMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw new Error(`direct fetch HTTP ${response.status}`);
      }

      const html = await response.text();
      if (!html || html.length < 10) {
        throw new Error("direct fetch returned empty body");
      }

      const proxyNote = nodeProxyUrl ? ` via proxy ${nodeProxyUrl}` : "";
      logger.add(url, 200, durationMs, `OK via direct fetch${proxyNote}`);
      return { html, status: 200, finalUrl: url, ok: true, proxyUsed: nodeProxyUrl };
    } catch (error) {
      clearTimeout(timerId);
      const durationMs = Math.round(performance.now() - startTime);
      const isTimeout = error.name === "AbortError";
      const detail = isTimeout ? "Connection timed out" : error.message;
      const proxyNote = nodeProxyUrl ? ` using proxy ${nodeProxyUrl}` : " without proxy";
      logger.add(url, isTimeout ? "TIMEOUT" : "ERR", durationMs, `direct fetch failed${proxyNote}: ${detail}`);
      lastError = error;
      // Fall through to public CORS proxy providers if direct fetch fails
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const provider of PROXY_PROVIDERS) {
      const startTime = performance.now();
      const controller = new AbortController();
      const timerId = setTimeout(() => controller.abort(), timeout);

      try {
        const proxyUrl = provider.buildUrl(url);
        // allow provider to supply additional request headers (e.g., Origin) to increase chances of a CORS-allowed response
        const providerHeaders = typeof provider.requestHeaders === "function" ? (provider.requestHeaders(url) || {}) : {};
        const headers = { ...defaultFetchHeaders(), ...providerHeaders };
        const response = await fetch(proxyUrl, {
          method: method === "HEAD" ? "GET" : method,
          signal: controller.signal,
          headers,
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
