import {
  buildField,
  combinePageText,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
} from "../utils/fieldBuilder.js";



export default function extractService(pages) {

  const servicePage = pages.find((p) => p.type === "service");

  const home = pages.find((p) => p.type === "home");

  const source = servicePage?.url || home?.url || null;

  const text = combinePageText(pages.filter((p) => ["service", "home"].includes(p.type)));



  const brandsServiced = [];

  if (/servic(e|ing)\s+all\s+major|all\s+franchised\s+lines|authorized\s+service/i.test(text)) {

    brandsServiced.push("All major franchised lines");

  }



  const specialties = [];

  if (/warranty\s*(?:&|and)?\s*recall|recall\s*lookup|warranty\s*lookup/i.test(text)) {

    specialties.push("Warranty & Recall Lookup");

  }

  if (/maintenance|repair|tune[-\s]up|oil\s+change/i.test(text)) {

    specialties.push("General maintenance and repair");

  }



  const accessoryInstall = /accessory\s+install|install\s+accessories|custom\s+install/i.test(text);

  const nonFranchise = text.match(/[^.\n]*(?:non[-\s]franchise|all\s+makes|any\s+brand)[^.\n]*/i);

  const unitAge = text.match(/[^.\n]*(?:model\s+year|years?\s+old|age\s+limit)[^.\n]*/i);

  const diagnostics = text.match(/[^.\n]*(?:diagnostic|computer\s+scan|electrical)[^.\n]*/i);

  const seasonalPrep = text.match(/[^.\n]*(?:winteri[sz]|seasonal\s+prep|storage\s+prep)[^.\n]*/i);



  return {
    brandsServiced: buildField(
      brandsServiced.length ? brandsServiced : null,
      brandsServiced.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !brandsServiced.length ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', keywords: ['service all major', 'authorized service'] }
    ),
    nonFranchisePolicy: buildField(
      nonFranchise ? nonFranchise[0].trim() : null,
      nonFranchise ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !nonFranchise ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    unitAgeLimits: buildField(
      unitAge ? unitAge[0].trim() : null,
      unitAge ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !unitAge ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    specialties: buildField(
      specialties.length ? specialties : null,
      specialties.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !specialties.length ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', count: specialties.length }
    ),
    diagnostics: buildField(
      diagnostics ? diagnostics[0].trim() : null,
      diagnostics ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !diagnostics ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    seasonalPrep: buildField(
      seasonalPrep ? seasonalPrep[0].trim() : null,
      seasonalPrep ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !seasonalPrep ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    accessoryInstall: buildField(
      accessoryInstall ? "Accessory installation offered" : null,
      accessoryInstall ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      source,
      !accessoryInstall ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match' }
    ),
    communicationStrengths: buildField(
      null,
      CONFIDENCE_LEVELS.MISSING,
      null,
      MISSING_REASONS.INTERNAL_ONLY,
      EVIDENCE_TYPES.PAGE_TEXT,
      { reason: 'internal_analysis_only' }
    ),
    riskNotes: buildField(
      null,
      CONFIDENCE_LEVELS.MISSING,
      null,
      MISSING_REASONS.INTERNAL_ONLY,
      EVIDENCE_TYPES.PAGE_TEXT,
      { reason: 'internal_analysis_only' }
    ),
  };

}

