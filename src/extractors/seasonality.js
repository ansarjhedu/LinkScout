import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



export default function extractSeasonality(pages) {

  const text = combinePageText(pages.filter((p) => ["home", "promotions", "service"].includes(p.type)));

  const source = pages.find((p) => p.type === "home")?.url || null;



  const peakSeasons = [];

  if (/spring|summer/i.test(text)) peakSeasons.push("Spring/Summer (PWC, Motorcycles)");

  if (/fall|hunting/i.test(text)) peakSeasons.push("Spring/Fall (ATVs/SxS, hunting)");

  if (/service|parts/i.test(text)) peakSeasons.push("Year-round (Service/Parts)");



  const slowSeasons = /winter|off[-\s]season/i.test(text) ? ["Winter for outdoor recreational vehicles"] : [];



  const seasonalPushes = [];

  if (/spring\s+ride|ride\s+event/i.test(text)) seasonalPushes.push("Spring ride events");

  if (/hunting\s+season/i.test(text)) seasonalPushes.push("Fall hunting season promotions");

  if (/winter\s+service|service\s+special/i.test(text)) seasonalPushes.push("Winter service specials");

  if (/sales\s+event|in[-\s]stock\s+deals/i.test(text)) seasonalPushes.push("In-stock sales events");



  const promoTiming = /in[-\s]stock\s+deals|specials|promotions|sales\s+event/i.test(text)

    ? "Ongoing in-stock deals and promotions"

    : null;



  const agedInventory = text.match(/[^.\n]*(?:aged|over\s+\d+\s+days|lot\s+age)[^.\n]*/i);



  return {

    peakSeasons: buildField(

      peakSeasons.length ? peakSeasons : ["Spring/Summer PWC/Motorcycles; Spring/Fall ATVs/SxS; year-round service"],

      peakSeasons.length ? "VERIFIED" : "INFERRED",

      source,

      peakSeasons.length ? null : "Industry-standard seasonality inferred from product categories on site"

    ),

    slowSeasons: buildField(

      slowSeasons.length ? slowSeasons : ["Winter for outdoor recreational vehicles"],

      slowSeasons.length ? "VERIFIED" : "INFERRED",

      source,

      slowSeasons.length ? null : "Industry-standard slow season inferred from product categories"

    ),

    seasonalPushes: buildField(

      seasonalPushes.length ? seasonalPushes : null,

      seasonalPushes.length ? "VERIFIED" : "MISSING",

      seasonalPushes.length ? source : null,

      seasonalPushes.length ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    promoTiming: buildField(promoTiming, promoTiming ? "VERIFIED" : "MISSING", promoTiming ? source : null, promoTiming ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    agedInventory: buildField(

      agedInventory?.[0]?.trim() || null,

      agedInventory ? "INFERRED" : "MISSING",

      agedInventory ? source : null,

      agedInventory ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    monthlyNurture: buildField(null, "MISSING", null, MISSING_REASONS.INTERNAL_ONLY),

    supplementalRule: buildField("Seasonal layer supplements, never overrides, evergreen supercenter identity", "INFERRED", source),

  };

}

