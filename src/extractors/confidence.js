import { MISSING_REASONS } from "../utils/fieldBuilder.js";

/**
 * Recursively traverses the master JSON tree to locate leaf nodes containing
 * structured { value, confidence, source } records.
 */
function traverseLeaves(node, path, callback) {
  if (!node) return;

  if (typeof node === "object" && "value" in node && "confidence" in node) {
    callback(node, path);
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      traverseLeaves(node[i], `${path}[${i}]`, callback);
    }
  } else if (typeof node === "object") {
    for (const [key, val] of Object.entries(node)) {
      traverseLeaves(val, path ? `${path}.${key}` : key, callback);
    }
  }
}

const CRITICAL_KEYS = [
  "s2_nap.dealershipName",
  "s2_nap.phone",
  "s2_nap.salesHours",
  "s2_nap.address.street",
  "s2_nap.address.city",
  "s2_nap.address.state",
  "s2_nap.address.zip",
];

/**
 * Walks the compiled master JSON to audit confidence, normalize legacy tiers,
 * attach missing reasons, and build the crawl audit report (Section 20).
 */
export default function tagConfidence(masterJson) {
  let verifiedCount = 0;
  let inferredCount = 0;
  let missingCount = 0;
  let totalFields = 0;

  const gaps = [];
  const critical = [];

  traverseLeaves(masterJson.sections, "", (leaf, path) => {
    totalFields++;

    // Normalize legacy DEALER-NEEDED → MISSING with reason
    if (leaf.confidence === "DEALER-NEEDED") {
      leaf.confidence = "MISSING";
      if (!leaf.reason) {
        leaf.reason = MISSING_REASONS.NOT_ON_WEBSITE;
      }
    }

    if (!leaf.confidence) {
      leaf.confidence = leaf.value === null || leaf.value === undefined ? "MISSING" : "INFERRED";
    }

    const isEmptyArray = Array.isArray(leaf.value) && leaf.value.length === 0;
    const isBlankStr = typeof leaf.value === "string" && leaf.value.trim() === "";

    if (leaf.value === null || leaf.value === undefined || isEmptyArray || isBlankStr) {
      leaf.confidence = "MISSING";
      if (!leaf.reason) {
        leaf.reason = MISSING_REASONS.NOT_ON_WEBSITE;
      }
    }

    if (leaf.confidence === "VERIFIED") verifiedCount++;
    else if (leaf.confidence === "INFERRED") inferredCount++;
    else if (leaf.confidence === "MISSING") missingCount++;

    const displayPath = path.replace(/^sections\./, "");

    if (leaf.confidence === "MISSING") {
      const entry = {
        field: displayPath,
        section: displayPath.split(".")[0]?.toUpperCase() || "GENERAL",
        reason: leaf.reason || MISSING_REASONS.NOT_ON_WEBSITE,
        source: leaf.source,
      };
      gaps.push(entry);

      if (CRITICAL_KEYS.some((key) => displayPath.includes(key))) {
        critical.push({
          ...entry,
          notes: `Critical field missing: ${entry.reason}`,
        });
      }
    } else if (leaf.confidence === "INFERRED" && !leaf.reason && leaf.source) {
      leaf.reason = `Inferred from crawled page: ${leaf.source}`;
    }
  });

  const completenessScore = Math.round(
    ((verifiedCount + inferredCount) / (totalFields || 1)) * 100
  );

  masterJson.meta.completenessScore = completenessScore;
  masterJson.meta.confidenceSummary = {
    verifiedCount,
    inferredCount,
    missingCount,
    totalFields,
  };

  masterJson.sections.s20_crawlAudit = {
    gaps,
    critical,
    summary: {
      totalGaps: gaps.length,
      criticalGaps: critical.length,
      verifiedFields: verifiedCount,
      inferredFields: inferredCount,
    },
  };

  // Backward-compatible alias for exporters still reading s20_missingItems
  masterJson.sections.s20_missingItems = {
    critical,
    gaps,
    summary: masterJson.sections.s20_crawlAudit.summary,
  };

  return masterJson;
}
