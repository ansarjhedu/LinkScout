import {
  buildField,
  combinePageText,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
} from "../utils/fieldBuilder.js";



export default function extractParts(pages) {

  const partsPage = pages.find((p) => p.type === "parts");

  const servicePage = pages.find((p) => p.type === "service");

  const source = partsPage?.url || servicePage?.url || null;

  const text = combinePageText(pages.filter((p) => ["parts", "service", "home"].includes(p.type)));



  const oemSupport = /oem\s+parts|genuine\s+parts|parts\s+specialist|search\s+oem/i.test(text)

    ? "OEM parts specialists"

    : null;



  const aftermarket = /aftermarket\s+warranty|any\s+aftermarket\s+warranty/i.test(text)

    ? "Works with aftermarket warranty companies"

    : null;



  const apparelGear = /apparel|gear|riding\s+gear|helmet|jacket/i.test(text) ? "Apparel and gear mentioned" : null;

  const specialOrders = /special\s+order|order\s+parts|submit\s+request/i.test(text) ? "Special orders available" : null;

  const fitmentGuidance = /parts\s+specialist|fitment|compatibility/i.test(text) ? "Fitment guidance available" : null;



  return {
    oemSupport: buildField(
      oemSupport,
      oemSupport ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !oemSupport ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['OEM', 'genuine parts'] }
    ),
    aftermarket: buildField(
      aftermarket,
      aftermarket ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !aftermarket ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keyword: 'aftermarket warranty' }
    ),
    apparelGear: buildField(
      apparelGear,
      apparelGear ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !apparelGear ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['apparel', 'gear', 'helmet', 'jacket'] }
    ),
    specialOrders: buildField(
      specialOrders,
      specialOrders ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !specialOrders ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['special order', 'order parts'] }
    ),
    fitmentGuidance: buildField(
      fitmentGuidance,
      fitmentGuidance ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !fitmentGuidance ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['fitment', 'compatibility'] }
    ),
    serviceIntegration: buildField(
      partsPage && servicePage ? "Parts support service department" : null,
      partsPage ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.MISSING,
      source,
      !partsPage ? MISSING_REASONS.NO_MATCHING_LINK : null,
      EVIDENCE_TYPES.LINK_PATTERN,
      { method: 'page_coexistence', hasPartsPage: !!partsPage, hasServicePage: !!servicePage }
    ),
    lifecycleSupport: buildField(
      /maintenance|customiz/i.test(text) ? "Ongoing maintenance and customization support" : null,
      /maintenance/i.test(text) ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !/maintenance/i.test(text) ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['maintenance', 'customization'] }
    ),
  };

}

