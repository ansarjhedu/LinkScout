import parseHtml from "../utils/domParser.js";
import {
  APPROVED_CLAIM_PATTERNS,
  FORBIDDEN_FINANCE_PATTERNS,
  COMPLIANCE_SAFE_FINANCE,
  SUPERLATIVE_PATTERNS
} from "../config/complianceRules.js";
import { buildField, MISSING_REASONS } from "../utils/fieldBuilder.js";

const FACTUAL_TRIGGERS = [
  /since\s+\d{4}/i, /family[-\s]owned/i, /founded\s+in/i,
  /over\s+\d+\s+years/i, /locally\s+owned/i, /authorized\s+dealer/i
];

export default function extractClaims(pages) {
  const approvedClaims = [];
  const claimsNeedingProof = [];
  const complianceFlags = [];
  const forbiddenLanguage = [];
  const complianceGuidance = [];

  const claimPages = pages.filter((p) => ["home", "about", "finance", "service"].includes(p.type));
  const primaryUrl = claimPages[0]?.url || null;

  for (const page of claimPages) {
    const helper = parseHtml(page.html);
    const bodyText = helper.text("body") || "";

    for (const pattern of APPROVED_CLAIM_PATTERNS) {
      const match = bodyText.match(pattern);
      if (match && !approvedClaims.some((c) => c.claim === match[0])) {
        approvedClaims.push({ claim: match[0].trim(), sourceUrl: page.url, confidence: "VERIFIED" });
      }
    }

    for (const pattern of FORBIDDEN_FINANCE_PATTERNS) {
      const match = bodyText.match(pattern);
      if (match && !forbiddenLanguage.includes(match[0])) {
        forbiddenLanguage.push(match[0].trim());
        complianceFlags.push({
          issue: `Forbidden finance language: "${match[0].trim()}"`,
          severity: "CRITICAL",
          sourceUrl: page.url
        });
      }
    }

    const elements = ["h1", "h2", "h3", "p", "li"];
    for (const tag of elements) {
      for (const text of helper.textAll(tag)) {
        if (text.length < 15 || text.length > 250) continue;

        if (SUPERLATIVE_PATTERNS.some((p) => p.test(text))) {
          if (!claimsNeedingProof.some((c) => c.claim === text)) {
            claimsNeedingProof.push({ claim: text.trim(), sourceUrl: page.url, confidence: "INFERRED" });
          }
        } else if (FACTUAL_TRIGGERS.some((p) => p.test(text))) {
          if (!approvedClaims.some((c) => c.claim === text)) {
            approvedClaims.push({ claim: text.trim(), sourceUrl: page.url, confidence: "INFERRED" });
          }
        }

        if (/\$\d+[-\s]?(?:per\s+month|mo|\/mo)\b/i.test(text)) {
          const hasDisclaimer = /subject\s+to\s+credit|with\s+approved\s+credit|OAC|see\s+dealer/i.test(bodyText);
          if (!hasDisclaimer) {
            complianceFlags.push({
              issue: `Promotional payment without disclaimer: "${text.trim()}"`,
              severity: "WARNING",
              sourceUrl: page.url
            });
          }
        }
      }
    }
  }

  complianceGuidance.push(
    { area: "Finance", guidance: COMPLIANCE_SAFE_FINANCE },
    { area: "Trade-in", guidance: "Use 'Find out what your vehicle is worth' rather than 'get top dollar'." },
    { area: "Ranking", guidance: "Tie 'Largest' claims to verifiable metrics or flag for proof." }
  );

  return {
    approvedClaims: buildField(approvedClaims.slice(0, 12), approvedClaims.length ? "VERIFIED" : "MISSING", primaryUrl),
    claimsNeedingProof: buildField(claimsNeedingProof.slice(0, 12), claimsNeedingProof.length ? "INFERRED" : "MISSING", primaryUrl),
    complianceFlags: buildField(complianceFlags, complianceFlags.length ? "INFERRED" : "MISSING", primaryUrl),
    forbiddenLanguage: buildField(forbiddenLanguage, forbiddenLanguage.length ? "VERIFIED" : "MISSING", primaryUrl),
    complianceGuidance: buildField(complianceGuidance, "VERIFIED", "system-config"),
    internalOnlyIntel: buildField(null, "MISSING", null, MISSING_REASONS.INTERNAL_ONLY)
  };
}
