import parseHtml from "../utils/domParser.js";

import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



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

    primaryCity: buildField(primaryCity, geoConfidence, geoSource),

    primaryState: buildField(primaryState, geoConfidence, geoSource),

    county: buildField(county, county ? "VERIFIED" : "MISSING", county ? homePage.url : null, county ? null : MISSING_REASONS.NOT_IN_SCHEMA),

    metroMarket: buildField(metroMarket, metroMarket ? "VERIFIED" : "MISSING", metroMarket ? homePage.url : null, metroMarket ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    extendedMarket: buildField(

      nearbyCities.length ? "Middle Tennessee extended market" : null,

      nearbyCities.length ? "VERIFIED" : "MISSING",

      nearbyCities.length ? homePage.url : null,

      nearbyCities.length ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    nearbyCities: buildField([...new Set(nearbyCities)].slice(0, 15), nearbyCities.length > 0 ? "VERIFIED" : "MISSING", nearbyCities.length > 0 ? homePage.url : null, nearbyCities.length > 0 ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    lifestyleMarkets: buildField([...new Set(lifestyleMarkets)], lifestyleMarkets.length > 0 ? "VERIFIED" : "MISSING", lifestyleMarkets.length > 0 ? homePage.url : null, lifestyleMarkets.length > 0 ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    buyerRadius: buildField(buyerRadius, buyerRadius ? "INFERRED" : "MISSING", buyerRadius ? homePage.url : null, buyerRadius ? null : MISSING_REASONS.NO_PAGE_CONTENT),

  };

}

