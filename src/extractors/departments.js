import parseHtml from "../utils/domParser.js";

/**
 * Registry of keywords used to detect authority assertions or specializations.
 */
const AUTHORITY_KEYWORDS = [
  /authorized\s+[^.\n]*/i,
  /certified\s+[^.\n]*/i,
  /factory-trained\s+[^.\n]*/i,
  /specialist\s+[^.\n]*/i,
  /oem\s+[^.\n]*/i,
  /expert\s+[^.\n]*/i,
  /premier\s+[^.\n]*/i,
  /guaranteed\s+[^.\n]*/i
];

/**
 * Registry of keywords used to detect customer need statements or benefit pitches.
 */
const NEED_KEYWORDS = [
  /we\s+help\s+you\s+[^.\n]*/i,
  /designed\s+to\s+[^.\n]*/i,
  /maximize\s+your\s+[^.\n]*/i,
  /get\s+you\s+back\s+[^.\n]*/i,
  /hassle-free\s+[^.\n]*/i,
  /flexible\s+terms\s+[^.\n]*/i,
  /we've\s+got\s+you\s+covered/i,
  /your\s+one-stop\s+shop/i
];

/**
 * Searches page body text for paragraph claims matching semantic rules.
 * 
 * @param {string} bodyText - Webpage main text.
 * @param {RegExp[]} regexes - Expressions matching targets.
 * @returns {string|null} The first matching statement found.
 */
function findSemanticMatch(bodyText, regexes) {
  if (!bodyText) return null;
  for (const regex of regexes) {
    const match = bodyText.match(regex);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Identifies links within the current department page that route to sibling departments.
 * 
 * @param {string[]} hrefs - Extracted anchor href links.
 * @param {string} currentUrl - URL of the current department page.
 * @returns {string[]} Filtered relative or absolute sibling links.
 */
function extractSiblingDeptLinks(hrefs, currentUrl) {
  try {
    const currentPath = new URL(currentUrl).pathname;
    const siblingTargets = ["/parts", "/service", "/finance", "/inventory", "/apply", "/contact"];
    
    const matches = hrefs.filter((href) => {
      if (!href) return false;
      const isSibling = siblingTargets.some((target) => href.toLowerCase().includes(target));
      const isSelf = href.includes(currentPath);
      return isSibling && !isSelf;
    });

    return [...new Set(matches)].slice(0, 5); // Return a maximum of 5 sibling links to keep it focused
  } catch (e) {
    return [];
  }
}

/**
 * Audits, parses, and extracts operational roles, credentials, value propositions, 
 * and lateral interconnectivity of the Sales, Service, Parts, and Finance departments.
 * 
 * @param {Object[]} pages - Array of crawled pages with HTML and classified labels.
 * @returns {Object} Structured s7_departments node matching the master JSON schema.
 */
export default function extractDepartments(pages) {
  const departments = { sales: null, service: null, parts: null, finance: null };
  const categoriesMap = {
    sales: ["home", "inventory-new", "inventory-used"],
    service: ["service"],
    parts: ["parts"],
    finance: ["finance", "credit-app"]
  };

  for (const [dept, pageTypes] of Object.entries(categoriesMap)) {
    // Find matching pages in crawled set
    const matchedPage = pages.find((p) => pageTypes.includes(p.type)) || null;

    if (matchedPage) {
      const helper = parseHtml(matchedPage.html);
      const h1Text = helper.text("h1") || helper.text("title")?.split("|")[0]?.trim();
      const metaDesc = helper.attr("meta[name='description'i]", "content");
      const bodyText = helper.text("body") || "";
      const allHrefs = helper.attrAll("a[href]", "href");

      const role = h1Text || metaDesc || `Dealership ${dept} operations`;
      const authorityTheme = findSemanticMatch(bodyText, AUTHORITY_KEYWORDS) || `${dept.toUpperCase()} department specialists`;
      const customerNeed = findSemanticMatch(bodyText, NEED_KEYWORDS) || `Supporting your ${dept} needs`;
      const siblingLinks = extractSiblingDeptLinks(allHrefs, matchedPage.url);

      departments[dept] = {
        pageUrl: { value: matchedPage.url, confidence: "VERIFIED", source: matchedPage.url },
        role: { value: role, confidence: "VERIFIED", source: matchedPage.url },
        authorityTheme: { value: authorityTheme, confidence: "INFERRED", source: matchedPage.url },
        customerNeed: { value: customerNeed, confidence: "INFERRED", source: matchedPage.url },
        internalLinks: { value: siblingLinks, confidence: "VERIFIED", source: matchedPage.url }
      };
    } else {
      // Flag department as MISSING to trigger checklist warnings
      departments[dept] = {
        pageUrl: { value: null, confidence: "MISSING", source: null },
        role: { value: null, confidence: "MISSING", source: null },
        authorityTheme: { value: null, confidence: "MISSING", source: null },
        customerNeed: { value: null, confidence: "MISSING", source: null },
        internalLinks: { value: [], confidence: "MISSING", source: null }
      };
    }
  }

  return departments;
}