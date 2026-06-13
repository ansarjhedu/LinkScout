import parseHtml from "../utils/domParser.js";

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
  const confidence = hasFinancePage ? "INFERRED" : "MISSING";
  const source = hasFinancePage ? primarySource : null;

  return {
    financingOffered: { value: hasFinancePage, confidence: hasFinancePage ? "VERIFIED" : "MISSING", source },
    inHouseFinancing: { value: isInHouse, confidence, source },
    lenders: { value: lendersFound, confidence: lendersFound.length > 0 ? "INFERRED" : "MISSING", source: lendersFound.length > 0 ? source : null },
    creditPrograms: { value: programsFound, confidence: programsFound.length > 0 ? "INFERRED" : "MISSING", source: programsFound.length > 0 ? source : null },
    tradeEquityPolicy: { value: tradeEquityPolicy, confidence: tradeEquityPolicy ? "INFERRED" : "MISSING", source: tradeEquityPolicy ? source : null },
    protectionProducts: { value: protectionProducts, confidence: protectionProducts ? "INFERRED" : "MISSING", source: protectionProducts ? source : null },
    complianceSafeLanguage: { value: safeCompliancePhrase, confidence: safeCompliancePhrase ? "INFERRED" : "MISSING", source: safeCompliancePhrase ? source : null },
    forbiddenLanguageFound: { value: forbiddenFound, confidence: "INFERRED", source }
  };
}