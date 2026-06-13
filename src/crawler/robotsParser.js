import fetchProxy from "../utils/fetchProxy.js";

/**
 * Parses robots.txt and returns disallowed path prefixes.
 */
export default async function parseRobotsTxt(homepageUrl) {
  try {
    const origin = new URL(homepageUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetchProxy(robotsUrl, { retries: 1, timeout: 5000 });

    if (!res.ok || !res.html) {
      return { allowed: true, disallowed: [], sitemaps: [], robotsUrl };
    }

    const disallowed = [];
    const sitemaps = [];
    let inWildcardBlock = false;

    for (const line of res.html.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [directive, ...rest] = trimmed.split(":");
      const value = rest.join(":").trim();

      if (/^user-agent$/i.test(directive)) {
        inWildcardBlock = value === "*";
      } else if (inWildcardBlock && /^disallow$/i.test(directive) && value) {
        disallowed.push(value);
      } else if (/^sitemap$/i.test(directive) && value) {
        sitemaps.push(value);
      }
    }

    return { allowed: true, disallowed, sitemaps, robotsUrl };
  } catch {
    return { allowed: true, disallowed: [], sitemaps: [], robotsUrl: null };
  }
}

export function isPathAllowed(pathname, disallowedPrefixes) {
  if (!disallowedPrefixes?.length) return true;
  return !disallowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
