/**
 * CORS proxy providers — tried in order until one succeeds.
 * Each provider must support browser-side fetch (Access-Control-Allow-Origin: *).
 */
export const PROXY_PROVIDERS = [
  {
    name: "allorigins-raw",
    buildUrl: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
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
  },
  {
    name: "corsproxy-io",
    buildUrl: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
  },
  {
    name: "codetabs",
    buildUrl: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    parseResponse: async (response) => response.text(),
  },
];
