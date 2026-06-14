import parseHtml from "../utils/domParser.js";
import {
  buildField,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
  buildMissingField,
} from "../utils/fieldBuilder.js";

// Lenders list to audit
const KNOWN_LENDERS = [
  "Synchrony", "Octane", "Roadrunner", "Sheffield", "GreenSky", 
  "Southeast Financial", "DealerSocket", "RouteOne", "Yamaha Financial", 
  "Honda Financial", "Kawasaki Motors Finance", "Polaris Acceptance"
];

// Credit tiers/programs keywords
const CREDIT_PROGRAMS = [
  "prime", "credit builder", "first-time buyer", "second chance", 
  "sub-prime", "no credit", "bad credit", "bankruptcy", "credit rehab"
];

// Legally compliance phrases
const COMPLIANCE_PATTERNS = [
  /subject\s+to\s+credit\s+approval/i,
  /with\s+approved\s+credit/i,
  /on\s+approved\s+credit/i,
  /o\.a\.c\b/i,
  /terms\s+may\s+vary/i,
  /see\s+dealer\s+for\s+details/i
];

// Red-flag sales phrases
const FORBIDDEN_PATTERNS = [
  /guaranteed\s+approval/i,
  /everyone\s+approved/i,
  /no\s+credit\s+turned\s+down/i,
  /100%\s+approval/i,
  /approval\s+guaranteed/i
];

/**
 * Searches body content for finance-specific policies and compliance warnings.
 * 
 * @param {Object[]} pages - Array of crawled pages.
 * @returns {Object} Structured s8_finance node matching the master schema.
 */
export default function extractFinance(pages) {
  // Focus audit on finance or credit-app pages, falling back to homepage
  const targetPages = pages.filter((p) => ["finance", "credit-app", "home"].includes(p.type));
  
  let combinedText = "";
  let primarySource = null;

  if (targetPages.length > 0) {
    combinedText = targetPages.map((p) => p.html).join(" ");
    const priorityPage = targetPages.find((p) => p.type === "finance") || targetPages.find((p) => p.type === "credit-app") || targetPages[0];
    primarySource = priorityPage.url;
  }

  // Parse DOM elements safely
  const parsedText = targetPages.map(p => parseHtml(p.html).text("body") || "").join(" ");

  // 1. Audit Lenders
  const lendersFound = KNOWN_LENDERS.filter((lender) => {
    const regex = new RegExp(`\\b${lender}\\b`, "i");
    return regex.test(parsedText);
  });

  // 2. Audit Credit Programs
  const programsFound = CREDIT_PROGRAMS.filter((prog) => {
    const regex = new RegExp(`\\b${prog}\\b`, "i");
    return regex.test(parsedText);
  });

  // 3. In-House Financing (e.g. BHPH)
  const isInHouse = /buy\s+here\s+pay\s+here|bhph|in-house\s+financing|we\s+finance\s+you/i.test(parsedText);

  // 4. Forbidden Statements (Compliance Flags)
  let forbiddenFound = false;
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(parsedText)) {
      forbiddenFound = true;
      break;
    }
  }

  // 5. Compliance Safe Phrasing Extraction
  let safeCompliancePhrase = null;
  for (const pattern of COMPLIANCE_PATTERNS) {
    const match = parsedText.match(pattern);
    if (match) {
      safeCompliancePhrase = match[0].trim();
      break;
    }
  }

  // 6. Trade Policy & Equity Rollover
  let tradeEquityPolicy = null;
  const equityMatch = parsedText.match(/[^.\n]*?(equity|negative\s+equity|pay\s+off\s+your\s+loan|trade\s+allowance)[^.\n]*/i);
  if (equityMatch) {
    tradeEquityPolicy = equityMatch[0].trim();
  }

  // 7. Protection Products
  let protectionProducts = null;
  const protectionMatch = parsedText.match(/[^.\n]*?(gap\s+insurance|extended\s+warranty|protection\s+plan|tire\s+and\s+wheel)[^.\n]*/i);
  if (protectionMatch) {
    protectionProducts = protectionMatch[0].trim();
  }

  const hasFinancePage = pages.some((p) => ["finance", "credit-app"].includes(p.type));
  const source = hasFinancePage ? primarySource : pages[0]?.url;
  const evidenceType = hasFinancePage ? EVIDENCE_TYPES.LINK_PATTERN : EVIDENCE_TYPES.PAGE_TEXT;

  return {
    financeOffered: buildField(
      hasFinancePage,
      hasFinancePage ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.LINK_PATTERN,
      { method: 'page_existence', pageTypes: ['finance', 'credit-app'] }
    ),
    inHouseFinancing: buildField(
      isInHouse,
      isInHouse ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['buy here pay here', 'bhph'] }
    ),
    lenders: buildField(
      lendersFound.length > 0 ? lendersFound : null,
      lendersFound.length > 0 ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      lendersFound.length > 0 ? source : null,
      lendersFound.length === 0 ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', count: lendersFound.length }
    ),
    creditPrograms: buildField(
      programsFound.length > 0 ? programsFound : null,
      programsFound.length > 0 ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      programsFound.length > 0 ? source : null,
      programsFound.length === 0 ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', count: programsFound.length }
    ),
    tradeEquityPolicy: buildField(
      tradeEquityPolicy,
      tradeEquityPolicy ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !tradeEquityPolicy ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    protectionProducts: buildField(
      protectionProducts,
      protectionProducts ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !protectionProducts ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction', products: ['gap', 'warranty', 'protection'] }
    ),
    complianceSafeLanguage: buildField(
      safeCompliancePhrase,
      safeCompliancePhrase ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !safeCompliancePhrase ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'compliance_check' }
    ),
    forbiddenLanguageFound: buildField(
      forbiddenFound,
      forbiddenFound ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'compliance_violation_check', isWarning: forbiddenFound }
    ),
  };
}