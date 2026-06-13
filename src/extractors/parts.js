import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



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

    oemSupport: buildField(oemSupport, oemSupport ? "VERIFIED" : "MISSING", oemSupport ? source : null, oemSupport ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    aftermarket: buildField(aftermarket, aftermarket ? "VERIFIED" : "MISSING", aftermarket ? source : null, aftermarket ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    apparelGear: buildField(apparelGear, apparelGear ? "INFERRED" : "MISSING", apparelGear ? source : null, apparelGear ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    specialOrders: buildField(specialOrders, specialOrders ? "VERIFIED" : "MISSING", specialOrders ? source : null, specialOrders ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    fitmentGuidance: buildField(fitmentGuidance, fitmentGuidance ? "INFERRED" : "MISSING", fitmentGuidance ? source : null, fitmentGuidance ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    serviceIntegration: buildField(partsPage && servicePage ? "Parts support service department" : null, partsPage ? "VERIFIED" : "MISSING", source, partsPage ? null : MISSING_REASONS.NO_MATCHING_LINK),

    lifecycleSupport: buildField(/maintenance|customiz/i.test(text) ? "Ongoing maintenance and customization support" : null, /maintenance/i.test(text) ? "INFERRED" : "MISSING", source, /maintenance/i.test(text) ? null : MISSING_REASONS.NO_PAGE_CONTENT),

  };

}

