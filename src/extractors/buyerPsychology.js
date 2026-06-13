import { buildField, MISSING_REASONS } from "../utils/fieldBuilder.js";



const BUYER_PROFILES = {

  generalPowersports: {

    label: "General Powersports Buyer",

    brands: [],

    motivation: "Recreation, adventure, utility, sport, freedom, community",

    decisionTrigger: "New model releases, seasonal riding, upgrade needs",

    objection: "Price, financing terms, maintenance costs, storage",

    trustTrigger: "Large inventory, knowledgeable staff, authorized service",

    emotionalDriver: "Excitement, thrill, escape, practicality, belonging",

  },

  atvSxs: {

    label: "ATV/SxS Buyer",

    brands: ["Polaris", "Can-Am", "Honda", "Kawasaki"],

    motivation: "Off-road adventure, hunting/fishing, property maintenance",

    decisionTrigger: "Rugged transport need, family outdoor activity",

    objection: "Safety concerns, trail access, storage",

    trustTrigger: "Brand reputation, service support",

    emotionalDriver: "Adventure, capability, utility, family fun",

  },

  motorcycle: {

    label: "Motorcycle Buyer",

    brands: ["Honda", "Kawasaki", "Suzuki", "KTM", "Spyder"],

    motivation: "Freedom, sport, commuting, touring, community",

    decisionTrigger: "Open-road experience, performance upgrade",

    objection: "Safety, licensing, weather dependency",

    trustTrigger: "Brand reputation, service expertise",

    emotionalDriver: "Thrill, independence, style, community",

  },

  pwc: {

    label: "PWC Buyer",

    brands: ["Sea-Doo"],

    motivation: "Water recreation, speed, family fun on lakes/rivers",

    decisionTrigger: "Summer season, waterway access",

    objection: "Storage, trailering, maintenance, fuel costs",

    trustTrigger: "Brand reputation, service support",

    emotionalDriver: "Fun, excitement, relaxation, family time",

  },

  golfCart: {

    label: "Golf Cart Buyer",

    brands: ["Atlas Golf"],

    motivation: "Golf course transport, property utility, neighborhood mobility",

    decisionTrigger: "Course membership, property needs, seasonal use",

    objection: "Battery range, storage, local regulations",

    trustTrigger: "Brand availability, service support",

    emotionalDriver: "Convenience, leisure, utility",

  },

  service: {

    label: "Service Buyer",

    brands: [],

    motivation: "Vehicle longevity, safety, performance, warranty compliance",

    decisionTrigger: "Scheduled maintenance, breakdown, recall notice",

    objection: "Cost, downtime, trust in technicians",

    trustTrigger: "Certified technicians, warranty support, transparent pricing",

    emotionalDriver: "Reliability, peace of mind, safety",

  },

  finance: {

    label: "Finance Buyer",

    brands: [],

    motivation: "Affordability, budget management, immediate purchase",

    decisionTrigger: "Finding the right vehicle, flexible payment options",

    objection: "High interest rates, credit history, complex process",

    trustTrigger: "Clear terms, multiple lender options, credit profile support",

    emotionalDriver: "Relief, accessibility, excitement of ownership",

  },

};



export default function extractBuyerPsychology(pages, brandData = []) {

  const safeBrands = Array.isArray(brandData) ? brandData : [];
  const source = pages.find((p) => p.type === "home")?.url || null;

  const brandNames = safeBrands.map((b) => b.brandName?.value).filter(Boolean);

  const profiles = [];



  for (const [, profile] of Object.entries(BUYER_PROFILES)) {

    const relevant = profile.brands.length === 0 ||

      profile.brands.some((b) => brandNames.includes(b));



    if (relevant) {

      profiles.push({

        group: buildField(profile.label, "VERIFIED", source, "Profile matched to detected brand inventory on site"),

        motivation: buildField(profile.motivation, "INFERRED", source, "Standard buyer psychology mapped to detected brands"),

        decisionTrigger: buildField(profile.decisionTrigger, "INFERRED", source),

        objection: buildField(profile.objection, "INFERRED", source),

        trustTrigger: buildField(profile.trustTrigger, "INFERRED", source),

        emotionalDriver: buildField(profile.emotionalDriver, "INFERRED", source),

      });

    }

  }



  return {

    profiles,

    additionalBuyerGroups: buildField(null, "MISSING", null, "No additional buyer segments detected beyond brand-matched profiles"),

  };

}

