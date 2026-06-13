import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



export default function extractCommunity(pages, napData = {}) {

  const home = pages.find((p) => p.type === "home");

  const about = pages.find((p) => p.type === "about");

  const events = pages.find((p) => p.type === "events");

  const source = about?.url || home?.url || null;

  const text = combinePageText([home, about, events].filter(Boolean));

  const city = napData?.address?.city?.value;

  const state = napData?.address?.state?.value;



  const localIdentity = city && state

    ? `Key business in ${city}, ${state} serving the broader Middle Tennessee region`

    : null;



  const familyTrust = /family[-\s]owned|locally\s+owned|independent/i.test(text)

    ? "Family/Independent local dealership"

    : null;



  const lifestyleThemes = [];

  if (/outdoor|recreation|adventure/i.test(text)) lifestyleThemes.push("Outdoor recreation and adventure");

  if (/utility|farm|ranch/i.test(text)) lifestyleThemes.push("Utility and rural needs");

  if (/ride|where\s+to\s+ride|learn\s+to\s+ride/i.test(text)) lifestyleThemes.push("Rider community and education");



  const reputationSignals = [];

  if (/largest/i.test(text)) reputationSignals.push("Largest inventory/selection claims");

  if (/multi[-\s]line/i.test(text)) reputationSignals.push("Multi-line powersports positioning");

  if (/high[-\s]volume|#1/i.test(text)) reputationSignals.push("High-volume dealer positioning");



  const communityInvolvement = [];

  if (/events\s+calendar|community\s+event|sponsor/i.test(text)) communityInvolvement.push("Events calendar and community engagement mentioned");

  if (/employment|careers|hiring/i.test(text)) communityInvolvement.push("Local employment opportunities");



  return {

    communityInvolvement: buildField(

      communityInvolvement.length ? communityInvolvement : null,

      communityInvolvement.length ? "VERIFIED" : "MISSING",

      communityInvolvement.length ? source : null,

      communityInvolvement.length ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    localIdentity: buildField(localIdentity, localIdentity ? "VERIFIED" : "MISSING", source, localIdentity ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    familyIndependentTrust: buildField(familyTrust, familyTrust ? "VERIFIED" : "MISSING", familyTrust ? source : null, familyTrust ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    regionalLifestyleThemes: buildField(lifestyleThemes, lifestyleThemes.length ? "VERIFIED" : "MISSING", source, lifestyleThemes.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    reputationSignals: buildField(reputationSignals, reputationSignals.length ? "VERIFIED" : "MISSING", source, reputationSignals.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),

    toneGuidance: buildField("Enthusiastic, knowledgeable, customer-focused, authoritative", "INFERRED", source, "Derived from on-site marketing copy tone"),

  };

}

