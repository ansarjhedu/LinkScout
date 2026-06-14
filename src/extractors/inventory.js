import {
  buildField,
  combinePageText,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
} from "../utils/fieldBuilder.js";



export default function extractInventory(pages, brandData = []) {
  const safeBrands = Array.isArray(brandData) ? brandData : [];

  const tradePage = pages.find((p) => p.type === "trade-in");

  const newPage = pages.find((p) => p.type === "inventory-new");

  const usedPage = pages.find((p) => p.type === "inventory-used");

  const home = pages.find((p) => p.type === "home");

  const source = tradePage?.url || home?.url || null;

  const text = combinePageText(pages.filter((p) => ["trade-in", "home", "inventory-new", "inventory-used"].includes(p.type)));



  const hasTradeIn = /value\s+your\s+trade|trade[-\s]in|accept\s+trade/i.test(text);

  const hasBuyOutright = /buy\s+(?:your|outright)|sell\s+your\s+(?:unit|vehicle|atv|bike)|we\s+buy/i.test(text);

  const hasUsed = !!usedPage || /pre[-\s]owned|used\s+inventory/i.test(text);

  const hasNew = !!newPage || /new\s+inventory/i.test(text);



  let newUsedMix = null;

  if (hasNew && hasUsed) newUsedMix = "New and Used";

  else if (hasNew) newUsedMix = "Primarily New";

  else if (hasUsed) newUsedMix = "Primarily Used";



  const brandPriority = safeBrands.map((b) => b.brandName?.value).filter(Boolean);



  const categoryPriority = [];

  if (/side[-\s]by[-\s]side|sxs|utv/i.test(text)) categoryPriority.push("SxS");

  if (/\batv\b|all[-\s]terrain/i.test(text)) categoryPriority.push("ATV");

  if (/motorcycle|bike|dirt\s+bike/i.test(text)) categoryPriority.push("Motorcycle");

  if (/pwc|watercraft|sea[-\s]doo|jet\s+ski/i.test(text)) categoryPriority.push("PWC");

  if (/golf\s+cart/i.test(text)) categoryPriority.push("Golf Cart");



  const opportunityCategories = [];

  if (/golf\s+cart|atlas/i.test(text)) opportunityCategories.push("Golf Carts");

  if (/spyder|3[-\s]wheel/i.test(text)) opportunityCategories.push("3-Wheel Motorcycles");



  const consignment = text.match(/[^.\n]*consignment[^.\n]*/i);

  const nonBrandTrade = text.match(/[^.\n]*(?:non[-\s]brand|any\s+make|all\s+makes)[^.\n]*trade/i);



  return {
    newUsedMix: buildField(
      newUsedMix,
      newUsedMix ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !newUsedMix ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'page_existence', hasNew, hasUsed }
    ),
    brandPriority: buildField(
      brandPriority.length ? brandPriority : null,
      brandPriority.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      home?.url || null,
      !brandPriority.length ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { source: 'brand_extraction', count: brandPriority.length }
    ),
    categoryPriority: buildField(
      categoryPriority.length ? categoryPriority : null,
      categoryPriority.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !categoryPriority.length ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', categories: categoryPriority }
    ),
    opportunityCategories: buildField(
      opportunityCategories.length ? opportunityCategories : null,
      opportunityCategories.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !opportunityCategories.length ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', categories: opportunityCategories }
    ),
    usedStance: buildField(
      hasUsed ? "Actively offers used/pre-owned inventory" : null,
      hasUsed ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.MISSING,
      hasUsed ? (usedPage?.url || source) : null,
      !hasUsed ? MISSING_REASONS.NO_MATCHING_LINK : null,
      hasUsed ? EVIDENCE_TYPES.LINK_PATTERN : EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'page_existence', pageType: 'inventory-used' }
    ),
    tradeInPolicy: buildField(
      hasTradeIn ? "Accepts trade-ins" : null,
      hasTradeIn ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !hasTradeIn ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['trade-in', 'trade in', 'accept trade'] }
    ),
    buyOutrightPolicy: buildField(
      hasBuyOutright ? "Offers to buy vehicles outright" : null,
      hasBuyOutright ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !hasBuyOutright ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['buy outright', 'sell your vehicle', 'we buy'] }
    ),
    consignmentStance: buildField(
      consignment ? consignment[0].trim() : null,
      consignment ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !consignment ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keyword: 'consignment' }
    ),
    nonBrandTradeIns: buildField(
      nonBrandTrade ? nonBrandTrade[0].trim() : null,
      nonBrandTrade ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !nonBrandTrade ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['non-brand', 'any make', 'all makes'] }
    ),
    primaryUsedCategories: buildField(
      categoryPriority.length ? categoryPriority : null,
      categoryPriority.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !categoryPriority.length ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'category_extraction', count: categoryPriority.length }
    ),
  };

}

