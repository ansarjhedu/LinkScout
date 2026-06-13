import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



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

    newUsedMix: buildField(newUsedMix, newUsedMix ? "VERIFIED" : "MISSING", newUsedMix ? source : null, newUsedMix ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    brandPriority: buildField(brandPriority, brandPriority.length ? "VERIFIED" : "MISSING", brandPriority.length ? home?.url : null, brandPriority.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    categoryPriority: buildField(categoryPriority, categoryPriority.length ? "VERIFIED" : "MISSING", categoryPriority.length ? source : null, categoryPriority.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    opportunityCategories: buildField(opportunityCategories, opportunityCategories.length ? "VERIFIED" : "MISSING", opportunityCategories.length ? source : null, opportunityCategories.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    usedStance: buildField(hasUsed ? "Actively offers used/pre-owned inventory" : null, hasUsed ? "VERIFIED" : "MISSING", hasUsed ? usedPage?.url || source : null, hasUsed ? null : MISSING_REASONS.NO_MATCHING_LINK),

    tradeInPolicy: buildField(hasTradeIn ? "Accepts trade-ins" : null, hasTradeIn ? "VERIFIED" : "MISSING", hasTradeIn ? source : null, hasTradeIn ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    buyOutrightPolicy: buildField(hasBuyOutright ? "Offers to buy vehicles outright" : null, hasBuyOutright ? "VERIFIED" : "MISSING", hasBuyOutright ? source : null, hasBuyOutright ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    consignmentStance: buildField(consignment?.[0]?.trim() || null, consignment ? "VERIFIED" : "MISSING", consignment ? source : null, consignment ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    nonBrandTradeIns: buildField(nonBrandTrade?.[0]?.trim() || null, nonBrandTrade ? "VERIFIED" : "MISSING", nonBrandTrade ? source : null, nonBrandTrade ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    primaryUsedCategories: buildField(categoryPriority.length ? categoryPriority : null, categoryPriority.length ? "INFERRED" : "MISSING", source, categoryPriority.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

  };

}

