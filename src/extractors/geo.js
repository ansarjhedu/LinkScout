import parseHtml from "../utils/domParser.js";
import {
  buildField,
  combinePageText,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
} from "../utils/fieldBuilder.js";



const CITY_COUNTY_MAP = {

  columbia: "Maury County",

  nashville: "Davidson County",

  phoenix: "Maricopa County",

  houston: "Harris County",

};



const LIFESTYLE_ACTIVITIES = {

  hunting: "Hunting & Outdoors",

  fishing: "Marine & Fishing",

  trail: "Trail Riding",

  "off-road": "Off-Road Adventure",

  lake: "Lake & Water Sports",

  boating: "Marine & Fishing",

  farm: "Agriculture & Farm",

  ranch: "Agriculture & Farm",

  camping: "Camping & RV Adventure",

  utility: "Industrial Utility",

};



export default function extractGeo(pages, napData) {

  const homePage = pages.find((p) => p.type === "home") || pages[0] || { html: "", url: "" };

  const aboutPage = pages.find((p) => p.type === "about");

  const helper = parseHtml(homePage.html);

  const bodyText = [homePage, aboutPage].filter(Boolean).map((p) => parseHtml(p.html).text("body") || "").join(" ");

  const footerText = helper.text("footer") || "";



  const primaryCity = napData?.address?.city?.value || null;

  const primaryState = napData?.address?.state?.value || null;

  const geoConfidence = primaryCity ? napData.address.city.confidence : "MISSING";

  const geoSource = primaryCity ? napData.address.city.source : null;



  let county = primaryCity ? CITY_COUNTY_MAP[primaryCity.toLowerCase()] : null;

  if (!county) {

    const countyMatch = bodyText.match(/\b([A-Z][a-zA-Z\s]+?)\s+County\b/);

    if (countyMatch) county = countyMatch[0].trim();

  }



  let metroMarket = null;

  const metroMatch = bodyText.match(/(?:south\s+of\s+nashville|middle\s+tennessee|serving|located\s+in|near|dealership\s+in|convenient\s+to)\s*(?:the\s+)?([A-Za-z0-9\s-]{3,40}?)(?:\s+(?:area|region|metro|valley|market))?/i);

  if (/middle\s+tennessee/i.test(bodyText)) {

    metroMarket = "South of Nashville / Middle Tennessee";

  } else if (metroMatch) {

    metroMarket = metroMatch[1].trim();

  } else if (primaryCity) {

    metroMarket = `Greater ${primaryCity} Metro`;

  }



  const nearbyCities = [];

  const servingMatch = bodyText.match(/(?:proudly\s+serves|serving\s+customers\s+from|customers\s+from|we\s+serve)\s+([A-Za-z\s,.-]{10,200})/i)

    || footerText.match(/(?:serving|customers\s+in|near|we\s+serve)\s+([A-Za-z\s,.-]{10,120})/i);



  if (servingMatch) {

    const rawList = servingMatch[1].split(/,|\band\b/i);

    for (const item of rawList) {

      const cleanCity = item.replace(/[.!\n]/g, "").trim();

      if (cleanCity && cleanCity.length > 2 && /^[A-Z]/.test(cleanCity)) {

        nearbyCities.push(cleanCity);

      }

    }

  }



  const lifestyleMarkets = [];

  for (const [keyword, label] of Object.entries(LIFESTYLE_ACTIVITIES)) {

    if (new RegExp(`\\b${keyword}\\b`, "i").test(bodyText)) {

      lifestyleMarkets.push(label);

    }

  }

  if (/where\s+to\s+ride|learn\s+to\s+ride/i.test(bodyText)) {

    lifestyleMarkets.push("Recreational riding and new rider education");

  }



  let buyerRadius = null;

  if (nearbyCities.length >= 3) {

    buyerRadius = `Serves ${nearbyCities.slice(0, 5).join(", ")} and surrounding Middle Tennessee communities`;

  }



  return {
    primaryCity: buildField(
      primaryCity,
      geoConfidence === "MISSING" ? CONFIDENCE_LEVELS.MISSING : CONFIDENCE_LEVELS.VERIFIED,
      geoSource,
      geoConfidence === "MISSING" ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.SCHEMA,
      { source: 'nap_data' }
    ),
    primaryState: buildField(
      primaryState,
      geoConfidence === "MISSING" ? CONFIDENCE_LEVELS.MISSING : CONFIDENCE_LEVELS.VERIFIED,
      geoSource,
      geoConfidence === "MISSING" ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.SCHEMA,
      { source: 'nap_data' }
    ),
    county: buildField(
      county,
      county ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      county ? homePage.url : null,
      !county ? MISSING_REASONS.NOT_IN_SCHEMA : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: county ? 'lookup_table_or_extraction' : null }
    ),
    metroMarket: buildField(
      metroMarket,
      metroMarket ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      metroMarket ? homePage.url : null,
      !metroMarket ? MISSING_REASONS.NO_PAGE_CONTENT : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction' }
    ),
    extendedMarket: buildField(
      nearbyCities.length ? "Middle Tennessee extended market" : null,
      nearbyCities.length ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      nearbyCities.length ? homePage.url : null,
      !nearbyCities.length ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'nearby_cities_inference', count: nearbyCities.length }
    ),
    nearbyCities: buildField(
      nearbyCities.length > 0 ? [...new Set(nearbyCities)].slice(0, 15) : null,
      nearbyCities.length > 0 ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      nearbyCities.length > 0 ? homePage.url : null,
      nearbyCities.length > 0 ? null : MISSING_REASONS.NOT_ON_WEBSITE,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'regex_extraction', count: nearbyCities.length }
    ),
    lifestyleMarkets: buildField(
      lifestyleMarkets.length > 0 ? [...new Set(lifestyleMarkets)] : null,
      lifestyleMarkets.length > 0 ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      lifestyleMarkets.length > 0 ? homePage.url : null,
      lifestyleMarkets.length > 0 ? null : MISSING_REASONS.NOT_ON_WEBSITE,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'keyword_match', count: lifestyleMarkets.length }
    ),
    buyerRadius: buildField(
      buyerRadius,
      buyerRadius ? CONFIDENCE_LEVELS.INFERRED : CONFIDENCE_LEVELS.MISSING,
      buyerRadius ? homePage.url : null,
      !buyerRadius ? MISSING_REASONS.NOT_ON_WEBSITE : null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'nearby_cities_compilation' }
    ),
  };

}

