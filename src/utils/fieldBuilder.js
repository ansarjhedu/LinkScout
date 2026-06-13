/**
 * Standard reasons when the crawler cannot populate a field.
 */
export const MISSING_REASONS = {
  NOT_ON_WEBSITE: "Not published on any crawled page",
  NO_MATCHING_LINK: "No matching link found in navigation, sitemap, or page content",
  NO_PAGE_CONTENT: "No page content matched expected patterns after full crawl",
  NOT_IN_SCHEMA: "Not present in schema.org or structured data",
  DEAD_LINK: "Link was discovered but returned HTTP error on crawl",
  INTERNAL_ONLY: "Internal business data not exposed on public website",
  COMPETITOR_DATA: "Competitor information not published on dealership website",
  UNVERIFIABLE_CLAIM: "Claim found but cannot be independently verified from public data",
};

/**
 * Builds a standardized leaf field node for the master JSON schema.
 */
export function buildField(value, confidence, source = null, reason = null) {
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  const isBlankStr = typeof value === "string" && value.trim() === "";
  const isPresent = value !== undefined && value !== null && !isEmptyArray && !isBlankStr;

  if (!isPresent) {
    return {
      value: null,
      confidence: "MISSING",
      source: null,
      reason: reason || MISSING_REASONS.NOT_ON_WEBSITE,
    };
  }

  return {
    value,
    confidence,
    source,
    reason: reason || null,
  };
}

/** @deprecated Use buildField(null, "MISSING", null, reason) */
export function buildDealerNeededField(defaultVal = null, reason = MISSING_REASONS.NOT_ON_WEBSITE) {
  return buildField(defaultVal, "MISSING", null, reason);
}

export function buildMissingField(reason) {
  return buildField(null, "MISSING", null, reason);
}

/**
 * Combines text from multiple crawled pages for pattern matching.
 */
export function combinePageText(pages, types = null) {
  const filtered = types ? pages.filter((p) => types.includes(p.type)) : pages;
  return filtered.map((p) => {
    try {
      const body = p.html?.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
      return body?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
    } catch {
      return "";
    }
  }).join(" ");
}

/**
 * Finds first regex match across page set.
 */
export function findInPages(pages, pattern, types = null) {
  const text = combinePageText(pages, types);
  const match = text.match(pattern);
  return match ? match[0].trim() : null;
}
