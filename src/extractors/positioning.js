import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



const TYPE_PATTERNS = [

  { type: "Multi-line Powersports & Marine Dealership", pattern: /multi[-\s]line|powersports.*marine|marine.*powersports/i },

  { type: "Powersports Dealership", pattern: /powersports\s+dealer/i },

  { type: "Marine Dealership", pattern: /marine\s+dealer|boat\s+dealer/i },

  { type: "Auto Dealership", pattern: /auto\s+dealer|car\s+dealer/i },

];



const DIFFERENTIATOR_PATTERNS = [

  /largest\s+[^.]{5,60}/i,

  /largest\s+inventory/i,

  /multi[-\s]line\s+[^.]{5,50}/i,

  /authorized\s+dealer/i,

  /supercenter/i,

  /full[-\s]service/i,

  /one[-\s]stop\s+shop/i,

];



const NOT_REDUCE_TO = [

  "Single-line brand dealer",

  "Small local shop only",

  "Used vehicle outlet only",

];



export default function extractPositioning(pages, brandData = []) {

  const home = pages.find((p) => p.type === "home") || pages[0];

  const about = pages.find((p) => p.type === "about");

  const source = home?.url || null;

  const text = combinePageText([home, about].filter(Boolean));



  let primaryType = null;

  for (const { type, pattern } of TYPE_PATTERNS) {

    if (pattern.test(text)) { primaryType = type; break; }

  }



  const brandCount = brandData?.length || 0;

  const franchiseStructure = brandCount >= 2

    ? `Authorized dealer for ${brandCount} major brands`

    : brandCount === 1

      ? "Authorized single-brand dealer"

      : null;



  const category = /supercenter|super\s+center/i.test(text) ? "Supercenter" : /dealership/i.test(text) ? "Dealership" : null;



  const departments = [];

  if (/sales|inventory|new\s+and\s+used/i.test(text)) departments.push("Sales (New & Used)");

  if (/service|repair|maintenance/i.test(text)) departments.push("Service");

  if (/parts|accessories/i.test(text)) departments.push("Parts");

  if (/finance|financing|credit/i.test(text)) departments.push("Finance");



  const differentiators = [];

  for (const pattern of DIFFERENTIATOR_PATTERNS) {

    const match = text.match(pattern);

    if (match && !differentiators.includes(match[0].trim())) {

      differentiators.push(match[0].trim());

    }

  }



  return {

    primaryType: buildField(primaryType, primaryType ? "VERIFIED" : "MISSING", source, primaryType ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    franchiseStructure: buildField(franchiseStructure, franchiseStructure ? "VERIFIED" : "MISSING", source, franchiseStructure ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    category: buildField(category, category ? "VERIFIED" : "MISSING", source, category ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    departments: buildField(departments, departments.length ? "VERIFIED" : "MISSING", source, departments.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    differentiators: buildField(differentiators, differentiators.length ? "VERIFIED" : "MISSING", source, differentiators.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    shouldNotReduceTo: buildField(NOT_REDUCE_TO, "INFERRED", source, "Standard positioning guardrails applied"),

  };

}

