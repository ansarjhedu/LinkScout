import parseHtml from "../utils/domParser.js";

import { BRAND_PARENT_MAP, KNOWN_BRANDS, BRAND_PRODUCT_HINTS } from "../config/brandParents.js";

/**
 * Standard product categories we search for inside site content.
 */
const GENERAL_PRODUCT_LINES = [
  "ATV", "SxS", "Side-by-Side", "Motorcycle", "PWC", "Watercraft", 
  "Golf Cart", "3-Wheel", "Snowmobile", "Dirt Bike", "Generator"
];

/**
 * Scans a page's content and metadata to match against standard product line classifications.
 * 
 * @param {string} textContext - Combined clean text from the target brand context.
 * @returns {string[]} Inferred product categories.
 */
function inferProductLines(textContext) {
  const matchedLines = [];
  const upperContext = textContext.toUpperCase();

  for (const line of GENERAL_PRODUCT_LINES) {
    // Regex matching with boundary padding (e.g. matches "ATVs" or "ATV")
    const regex = new RegExp(`\\b${line}s?\\b`, "i");
    if (regex.test(upperContext)) {
      matchedLines.push(line);
    }
  }
  // Standardize "Side-by-Side" label
  if (matchedLines.includes("Side-by-Side") && !matchedLines.includes("SxS")) {
    matchedLines.push("SxS");
  }
  return matchedLines.length > 0 ? [...new Set(matchedLines)] : ["Powersports"];
}

/**
 * Evaluates whether the dealership possesses official retail rights for a brand.
 * 
 * @param {string} brandName - Discovered brand label.
 * @param {string} bodyText - Webpage content.
 * @returns {string} Inferred dealer relationship status.
 */
function inferAuthorityRole(brandName, bodyText) {
  const authRegex = new RegExp(`(authorized|certified|franchised|official)\\s+[^.\\n]*?${brandName}`, "i");
  if (authRegex.test(bodyText)) {
    return "Authorized Dealer";
  }
  return "Reseller / Service Center";
}

/**
 * Discovers and parses franchise brand portfolios from image alt attributes, 
 * navigation menu categories, page headers, and partner grids.
 * 
 * @param {Object[]} pages - Array of crawled pages with HTML and classified labels.
 * @returns {Object[]} List of brand records matching the master schema.
 */
export default function extractBrands(pages) {
  const brandsFound = new Map();
  const expandedBrandsList = [...new Set([...KNOWN_BRANDS, "Indian", "BMW", "Ducati", "Triumph", "Husqvarna"])];

  for (const page of pages) {
    const helper = parseHtml(page.html);
    const bodyText = helper.text("body") || "";
    const allImagesAlt = helper.attrAll("img", "alt");
    const navText = helper.text("nav") || helper.text("header") || "";

    for (const brand of expandedBrandsList) {
      let isBrandDiscovered = false;
      let matchedSourceUrl = page.url;
      let evidenceText = "";

      // Check 1: Alt text inside partner grid logos
      const matchingAlt = allImagesAlt.find((alt) => new RegExp(`\\b${brand}\\b`, "i").test(alt));
      if (matchingAlt) {
        isBrandDiscovered = true;
        evidenceText += `Alt Text: ${matchingAlt}. `;
      }

      // Check 2: Top menu items (e.g. "New Honda", "Polaris Inventory")
      if (new RegExp(`(new|shop|our)\\s+${brand}`, "i").test(navText)) {
        isBrandDiscovered = true;
        evidenceText += `Navigation Menu mention. `;
      }

      // Check 3: Page titles or main headings
      const h1Text = helper.text("h1") || "";
      if (new RegExp(`\\b${brand}\\b`, "i").test(h1Text) && page.type === "home") {
        isBrandDiscovered = true;
        evidenceText += `Main Heading (H1). `;
      }

      if (isBrandDiscovered) {
        const productLines = BRAND_PRODUCT_HINTS[brand] || inferProductLines(bodyText + " " + evidenceText);
        const authorityRole = inferAuthorityRole(brand, bodyText);
        
        const parentCompany = BRAND_PARENT_MAP[brand] || null;
        const parentConfidence = parentCompany ? "VERIFIED" : "MISSING";

        // Collect or update the entry
        if (!brandsFound.has(brand)) {
          brandsFound.set(brand, {
            brandName: { value: brand, confidence: "VERIFIED", source: matchedSourceUrl },
            parentCompany: {
              value: parentCompany,
              confidence: parentConfidence,
              source: parentCompany ? null : matchedSourceUrl,
              reason: parentCompany ? null : "Parent company not in known manufacturer database",
            },
            productLines: { value: productLines, confidence: "INFERRED", source: matchedSourceUrl },
            authorityRole: { value: authorityRole, confidence: "INFERRED", source: matchedSourceUrl }
          });
        } else {
          // If already found, merge product lines to compile a complete list
          const existing = brandsFound.get(brand);
          const mergedProducts = [...new Set([...existing.productLines.value, ...productLines])];
          existing.productLines.value = mergedProducts;
          if (authorityRole === "Authorized Dealer") {
            existing.authorityRole.value = "Authorized Dealer";
          }
        }
      }
    }
  }

  // Return formatted array list matching schema specs
  return Array.from(brandsFound.values());
}