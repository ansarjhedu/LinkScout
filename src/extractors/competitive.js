import { buildField, combinePageText, MISSING_REASONS } from "../utils/fieldBuilder.js";



export default function extractCompetitive(pages) {

  const text = combinePageText(pages);

  const source = pages.find((p) => p.type === "home")?.url || null;



  const competitorMention = text.match(/(?:compared\s+to|unlike|vs\.?)\s+([A-Za-z0-9\s&'.-]{3,40})/i);

  const competitorNames = competitorMention?.[1]?.trim() || null;



  const reason = MISSING_REASONS.COMPETITOR_DATA;



  return {

    competitorNames: buildField(competitorNames, competitorNames ? "INFERRED" : "MISSING", competitorNames ? source : null, competitorNames ? null : reason),

    competitorUrls: buildField(null, "MISSING", null, reason),

    competitorCities: buildField(null, "MISSING", null, reason),

    whyTheyMatter: buildField(null, "MISSING", null, reason),

    positioningResponse: buildField(

      /largest|multi[-\s]line|comprehensive/i.test(text)

        ? "Emphasize largest inventory, multi-line selection, comprehensive service and financing"

        : null,

      /largest|multi[-\s]line/i.test(text) ? "VERIFIED" : "MISSING",

      source,

      /largest|multi[-\s]line/i.test(text) ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

  };

}

