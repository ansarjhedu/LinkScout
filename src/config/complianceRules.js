export const APPROVED_CLAIM_PATTERNS = [
  /largest\s+inventory\s+selection/i,
  /servicing\s+all\s+major\s+franchised\s+lines/i,
  /instant\s+financing\s+for\s+more\s+people/i,
  /prime,\s*credit\s+builder,\s*and\s*first-time\s+buyer/i,
  /work\s+with\s+any\s+aftermarket\s+warranty/i
];

export const FORBIDDEN_FINANCE_PATTERNS = [
  /guaranteed\s+approval/i,
  /everyone\s+approved/i,
  /bad\s+credit\s+approved/i,
  /no\s+credit\s+turned\s+down/i,
  /100%\s+approval/i
];

export const COMPLIANCE_SAFE_FINANCE =
  "Financing options designed to support a range of qualified buyers, including prime, credit builder, and first-time buyer programs.";

export const SUPERLATIVE_PATTERNS = [
  /\blargest\b/i, /\bbest\b/i, /\bmost\b/i, /\bonly\b/i,
  /\b#1\b/i, /\bnumber\s+one\b/i, /\bpremier\b/i,
  /\btop-rated\b/i, /\blowest\b/i, /\bgreatest\b/i
];

export const OPERATIONAL_RULES = [
  { rule: "Evergreen over Seasonal", description: "Prioritize permanent identity over temporary promotions." },
  { rule: "Deployment Sheet Controls URLs", description: "All URLs must come from verified crawl discovery, never invented." },
  { rule: "No Invented Claims/URLs", description: "Do not create facts, claims, URLs, awards, or certifications not found on-site." },
  { rule: "Safe Finance Language", description: "Never use guaranteed approval or everyone approved phrasing." },
  { rule: "Preserve Brand Hierarchy", description: "Maintain parent company and product line separation." },
  { rule: "Department Distinctions", description: "Clearly differentiate Sales, Service, Parts, and Finance." },
  { rule: "Risk Notes Control Public Claims", description: "Public claims must align with approved safe claims and compliance rules." }
];
