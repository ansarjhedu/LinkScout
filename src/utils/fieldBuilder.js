/**
 * Field builder with strict provenance and confidence tracking
 * 
 * Ensures every field knows:
 * - Where it came from (source URL or system)
 * - How confident we are (VERIFIED/INFERRED/MISSING)
 * - Why it's missing (if applicable)
 * - The evidence type (schema/pageText/linkPattern/external)
 */

export const CONFIDENCE_LEVELS = {
  VERIFIED: 'VERIFIED',
  INFERRED: 'INFERRED',
  MISSING: 'MISSING',
};

export const EVIDENCE_TYPES = {
  SCHEMA: 'schema',
  PAGE_TEXT: 'pageText',
  LINK_PATTERN: 'linkPattern',
  EXPLICIT_TAG: 'explicitTag',
  EXTERNAL: 'external',
  INFERRED_CONTEXTUAL: 'inferredContextual',
};

export const MISSING_REASONS = {
  NOT_ON_WEBSITE: "Not published on any crawled page",
  NO_MATCHING_LINK: "No matching link found in navigation, sitemap, or page content",
  NO_PAGE_CONTENT: "No page content matched expected patterns after full crawl",
  NOT_IN_SCHEMA: "Not present in schema.org or structured data",
  DEAD_LINK: "Link was discovered but returned HTTP error on crawl",
  INTERNAL_ONLY: "Internal business data not exposed on public website",
  COMPETITOR_DATA: "Competitor information not published on dealership website",
  UNVERIFIABLE_CLAIM: "Claim found but cannot be independently verified from public data",
  SCHEMA_INCOMPLETE: "Schema found but field was null/missing",
  EXTRACTION_FAILED: "Extraction failed due to malformed data",
  PAGE_NOT_CRAWLED: "Page matching this type was not crawled",
  ENCODING_ERROR: "Unable to parse due to character encoding issue",
  VERTICAL_NOT_APPLICABLE: "Field not applicable to detected vertical",
};

/**
 * Builds a standardized field with full provenance tracking
 */
export function buildField(
  value,
  confidence = CONFIDENCE_LEVELS.MISSING,
  source = null,
  reason = null,
  evidenceType = EVIDENCE_TYPES.PAGE_TEXT,
  metadata = {}
) {
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  const isBlankStr = typeof value === "string" && value.trim() === "";
  const isPresent = value !== undefined && value !== null && !isEmptyArray && !isBlankStr;

  // Validate confidence
  if (!Object.values(CONFIDENCE_LEVELS).includes(confidence)) {
    throw new Error(`Invalid confidence level: ${confidence}`);
  }

  // Validate evidence type
  if (!Object.values(EVIDENCE_TYPES).includes(evidenceType)) {
    throw new Error(`Invalid evidence type: ${evidenceType}`);
  }

  // VERIFIED requires strong evidence
  if (confidence === CONFIDENCE_LEVELS.VERIFIED && ![EVIDENCE_TYPES.SCHEMA, EVIDENCE_TYPES.EXPLICIT_TAG].includes(evidenceType)) {
    console.warn(
      `[WARNING] Field marked VERIFIED with evidence ${evidenceType}. Downgrading to INFERRED.`
    );
    confidence = CONFIDENCE_LEVELS.INFERRED;
  }

  // Ensure reason for MISSING
  if (!isPresent) {
    return {
      value: null,
      confidence: CONFIDENCE_LEVELS.MISSING,
      source,
      reason: reason || MISSING_REASONS.NOT_ON_WEBSITE,
      evidenceType,
      metadata,
    };
  }

  // Ensure reason not set for non-MISSING
  if (isPresent && reason) {
    console.warn(`[WARNING] Non-MISSING field has reason: ${reason}. Ignoring.`);
    reason = null;
  }

  return {
    value,
    confidence,
    source,
    reason,
    evidenceType,
    metadata,
  };
}

/** @deprecated Use buildField(null, CONFIDENCE_LEVELS.MISSING, null, reason) */
export function buildDealerNeededField(defaultVal = null, reason = MISSING_REASONS.NOT_ON_WEBSITE) {
  return buildField(defaultVal, CONFIDENCE_LEVELS.MISSING, null, reason);
}

export function buildMissingField(reason) {
  return buildField(null, CONFIDENCE_LEVELS.MISSING, null, reason);
}

/**
 * Merge multiple field sources with priority
 */
export function mergeFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING);
  }

  const validFields = fields.filter((f) => f && f.value !== null && f.value !== undefined);
  if (validFields.length === 0) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING);
  }

  const priority = [
    EVIDENCE_TYPES.SCHEMA,
    EVIDENCE_TYPES.EXPLICIT_TAG,
    EVIDENCE_TYPES.PAGE_TEXT,
    EVIDENCE_TYPES.LINK_PATTERN,
  ];

  const sorted = [...validFields].sort(
    (a, b) => priority.indexOf(a.evidenceType) - priority.indexOf(b.evidenceType)
  );

  return sorted[0];
}

/**
 * Combines text from multiple crawled pages for pattern matching.
 */
export function combinePageText(pages, types = null) {
  if (!Array.isArray(pages)) return "";

  const filtered = types ? pages.filter((p) => types.includes(p.type)) : pages;
  return filtered
    .filter((p) => p && p.html)
    .map((p) => {
      try {
        const body = p.html
          ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ");
        return body?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";
      } catch {
        return "";
      }
    })
    .join(" ")
    .slice(0, 100000);
}

/**
 * Finds first regex match across page set.
 */
export function findInPages(pages, pattern, types = null) {
  const text = combinePageText(pages, types);
  try {
    const match = text.match(pattern);
    return match ? match[0].trim() : null;
  } catch (err) {
    console.warn(`[WARNING] Regex pattern failed: ${err.message}`);
    return null;
  }
}

/**
 * Extract field with guaranteed provenance
 */
export function extractWithProvenance(
  value,
  source,
  evidenceType = EVIDENCE_TYPES.PAGE_TEXT,
  metadata = {}
) {
  if (value === null || value === undefined) {
    return buildField(
      null,
      CONFIDENCE_LEVELS.MISSING,
      source,
      MISSING_REASONS.NOT_ON_WEBSITE,
      evidenceType,
      metadata
    );
  }

  const confidence =
    evidenceType === EVIDENCE_TYPES.SCHEMA
      ? CONFIDENCE_LEVELS.VERIFIED
      : evidenceType === EVIDENCE_TYPES.EXPLICIT_TAG
        ? CONFIDENCE_LEVELS.VERIFIED
        : CONFIDENCE_LEVELS.INFERRED;

  return buildField(value, confidence, source, null, evidenceType, metadata);
}

/**
 * Create field from schema with safe access
 */
export function fieldFromSchema(schemaObj, path, source) {
  if (!schemaObj) {
    return buildField(
      null,
      CONFIDENCE_LEVELS.MISSING,
      source,
      MISSING_REASONS.NOT_IN_SCHEMA,
      EVIDENCE_TYPES.SCHEMA
    );
  }

  try {
    const keys = path.split('.');
    let value = schemaObj;
    for (const key of keys) {
      if (value === null || value === undefined) {
        throw new Error(`Path broken at ${key}`);
      }
      value = value[key];
    }

    if (value === null || value === undefined) {
      return buildField(
        null,
        CONFIDENCE_LEVELS.MISSING,
        source,
        MISSING_REASONS.SCHEMA_INCOMPLETE,
        EVIDENCE_TYPES.SCHEMA
      );
    }

    return buildField(value, CONFIDENCE_LEVELS.VERIFIED, source, null, EVIDENCE_TYPES.SCHEMA, {
      schemaPath: path,
    });
  } catch (err) {
    return buildField(
      null,
      CONFIDENCE_LEVELS.MISSING,
      source,
      MISSING_REASONS.SCHEMA_INCOMPLETE,
      EVIDENCE_TYPES.SCHEMA
    );
  }
}
