import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



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

      brandsServiced,

      brandsServiced.length ? "VERIFIED" : "MISSING",

      brandsServiced.length ? source : null,

      brandsServiced.length ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    nonFranchisePolicy: buildField(

      nonFranchise?.[0]?.trim() || null,

      nonFranchise ? "VERIFIED" : "MISSING",

      nonFranchise ? source : null,

      nonFranchise ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    unitAgeLimits: buildField(

      unitAge?.[0]?.trim() || null,

      unitAge ? "VERIFIED" : "MISSING",

      unitAge ? source : null,

      unitAge ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    specialties: buildField(

      specialties,

      specialties.length ? "VERIFIED" : "MISSING",

      specialties.length ? source : null,

      specialties.length ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    diagnostics: buildField(

      diagnostics?.[0]?.trim() || null,

      diagnostics ? "INFERRED" : "MISSING",

      diagnostics ? source : null,

      diagnostics ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    seasonalPrep: buildField(

      seasonalPrep?.[0]?.trim() || null,

      seasonalPrep ? "INFERRED" : "MISSING",

      seasonalPrep ? source : null,

      seasonalPrep ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    accessoryInstall: buildField(

      accessoryInstall ? "Accessory installation offered" : null,

      accessoryInstall ? "INFERRED" : "MISSING",

      accessoryInstall ? source : null,

      accessoryInstall ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    communicationStrengths: buildField(null, "MISSING", null, MISSING_REASONS.INTERNAL_ONLY),

    riskNotes: buildField(null, "MISSING", null, MISSING_REASONS.INTERNAL_ONLY),

  };

}

