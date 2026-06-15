import parseHtml from "../utils/domParser.js";
import { classifyUrl, classifySocialUrl, normalizeUrl } from "./urlClassifier.js";

function getApexDomain(hostname) {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length >= 2) {
    const sld = parts[parts.length - 2];
    const commonSLDs = ["com", "co", "org", "net", "gov", "edu", "ltd", "me"];
    if (commonSLDs.includes(sld) && parts.length > 2) return parts.slice(-3).join(".");
    return parts.slice(-2).join(".");
  }
  return hostname;
}

function isValidInternalPage(urlStr, host) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (getApexDomain(url.hostname) !== getApexDomain(host)) return false;
    const path = url.pathname.toLowerCase();
    const assets = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".css", ".js", ".xml", ".zip", ".mp4", ".woff", ".woff2", ".ico"];
    if (assets.some((ext) => path.endsWith(ext))) return false;
    if (/^\/(wp-json|api|cdn-cgi|ajax|graphql)/i.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

function detectLinkSource(href, pageHtml) {
  if (!pageHtml) return "body-link";
  const idx = pageHtml.indexOf(href);
  if (idx === -1) return "sitemap";

  const context = pageHtml.slice(Math.max(0, idx - 400), idx + 200).toLowerCase();
  if (/<nav[\s>]|<header[\s>]/.test(context) || /class=["'][^"']*nav/.test(context)) return "nav-link";
  if (/<footer[\s>]/.test(context) || /class=["'][^"']*footer/.test(context)) return "footer-link";
  return "body-link";
}

/**
 * Harvests internal and social links from any page HTML.
 */
export function harvestLinksFromHtml(pageUrl, pageHtml, existingRegistry = []) {
  const internal = new Set();
  const linkRegistry = [...existingRegistry];
  const seenUrls = new Set(existingRegistry.map((r) => r.url));

  if (!pageHtml) {
    return { internal: [], social: [], registry: linkRegistry };
  }

  let targetHost = "";
  try {
    targetHost = new URL(pageUrl).hostname;
    internal.add(normalizeUrl(pageUrl));
  } catch {
    return { internal: [], social: [], registry: linkRegistry };
  }

  const helper = parseHtml(pageHtml);
  const anchors = Array.from(helper.doc.querySelectorAll("a[href]"));
  const hrefs = anchors.map((anchor) => ({ href: anchor.getAttribute("href"), text: anchor.textContent || "" }));
  const canonicalLinks = helper.attrAll("link[rel='canonical']", "href");
  const alternateLinks = helper.attrAll("link[rel='alternate']", "href");

  for (const item of [...hrefs, ...canonicalLinks.map((href) => ({ href, text: "" })), ...alternateLinks.map((href) => ({ href, text: "" }))]) {
    const href = item.href;
    const anchorText = item.text;
    try {
      const absolute = new URL(href, pageUrl).href;
      const socialType = classifySocialUrl(absolute);

      if (socialType) {
        if (!seenUrls.has(absolute)) {
          seenUrls.add(absolute);
          linkRegistry.push({
            url: absolute,
            category: "social",
            socialPlatform: socialType,
            source: detectLinkSource(href, pageHtml),
            pageType: "social",
          });
        }
        continue;
      }

      if (isValidInternalPage(absolute, targetHost)) {
        const clean = normalizeUrl(absolute);
        internal.add(clean);
        if (!seenUrls.has(clean)) {
          seenUrls.add(clean);
          const inferredType = classifyUrl(clean);
          linkRegistry.push({
            url: clean,
            category: inferredType,
            source: detectLinkSource(href, pageHtml),
            pageType: inferredType,
          });
        }
      }
    } catch { /* skip malformed */ }
  }

  const social = linkRegistry.filter((l) => l.category === "social");
  return { internal: [...internal], social, registry: linkRegistry };
}

/**
 * Harvests links from homepage HTML with source context.
 */
export default function harvestLinks(homepageUrl, homepageHtml) {
  return harvestLinksFromHtml(homepageUrl, homepageHtml, []);
}

/**
 * Merges link harvest results from multiple pages into a single discovery set.
 */
export function mergeDiscoveredLinks(baseUrl, pageHarvests) {
  const allInternal = new Set([normalizeUrl(baseUrl)]);
  const registryMap = new Map();
  const socialMap = new Map();

  for (const harvest of pageHarvests) {
    if (!harvest) continue;
    for (const url of harvest.internal || []) {
      allInternal.add(url);
    }

    for (const item of harvest.registry || []) {
      if (!item || !item.url) continue;
      if (!registryMap.has(item.url)) registryMap.set(item.url, item);
    }

    for (const item of harvest.social || []) {
      if (!item || !item.url) continue;
      if (!socialMap.has(item.url)) socialMap.set(item.url, item);
    }
  }

  return {
    internal: [...allInternal],
    social: [...socialMap.values()],
    registry: [...registryMap.values()],
  };
}
