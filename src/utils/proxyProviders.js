/**
 * CORS proxy providers — tried in order until one succeeds.
 * Each provider must support browser-side fetch (Access-Control-Allow-Origin: *).
 */
export const PROXY_PROVIDERS = [
  {
    name: "allorigins-raw",
    buildUrl: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
    // allow fetchProxy to ask for request headers to send to provider
    requestHeaders: (target) => ({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      // reflect the origin so proxies can echo Access-Control-Allow-Origin
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
  {
    name: "allorigins-get",
    buildUrl: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
    parseResponse: async (response) => {
      const json = await response.json();
      if (json.status?.http_code >= 400) {
        throw new Error(`Target returned HTTP ${json.status.http_code}`);
      }
      return json.contents || "";
    },
    requestHeaders: (target) => ({
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
  {
    name: "corsproxy-io",
    buildUrl: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
    requestHeaders: (target) => ({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
  {
    name: "codetabs",
    buildUrl: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
    requestHeaders: (target) => ({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
  {
    name: "thingproxy",
    buildUrl: (target) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
    requestHeaders: (target) => ({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
  {
    name: "jsonp-afeld",
    buildUrl: (target) => `https://jsonp.afeld.me/?url=${encodeURIComponent(target)}`,
    parseResponse: async (response) => {
      const json = await response.json();
      if (json.status && json.status >= 400) {
        throw new Error(`Target returned HTTP ${json.status}`);
      }
      return json.contents || "";
    },
    requestHeaders: (target) => ({
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      Origin: typeof location !== "undefined" ? location.origin : undefined,
      "X-Requested-With": "XMLHttpRequest",
    }),
  },
];
