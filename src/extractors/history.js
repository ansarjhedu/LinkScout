import parseHtml from "../utils/domParser.js";

import { buildField, combinePageText, findInPages, MISSING_REASONS } from "../utils/fieldBuilder.js";



const HISTORY_PATTERNS = {

  foundingYear: /(?:since|founded\s+in|established\s+in|serving\s+since)\s+(\d{4})/i,

  priorNames: /(?:formerly\s+known\s+as|previously\s+called)\s+([A-Za-z0-9\s&'.-]+)/i,

  familyStatus: /family[-\s]owned|family[-\s]operated|locally\s+owned/i,

  communityHistory: /(?:serving|proud\s+to\s+serve)\s+([A-Za-z\s,]+?)\s+(?:for|since)/i,

  ownership: /(?:owned\s+by|operated\s+by)\s+([A-Za-z0-9\s&'.-]{3,60})/i,

};



export default function extractHistory(pages) {

  const aboutPages = pages.filter((p) => ["about", "home"].includes(p.type));

  const source = aboutPages.find((p) => p.type === "about")?.url || aboutPages[0]?.url || null;

  const text = combinePageText(aboutPages);



  const foundingMatch = text.match(HISTORY_PATTERNS.foundingYear);

  const priorMatch = text.match(HISTORY_PATTERNS.priorNames);

  const familyMatch = text.match(HISTORY_PATTERNS.familyStatus);

  const communityMatch = text.match(HISTORY_PATTERNS.communityHistory);

  const ownershipMatch = text.match(HISTORY_PATTERNS.ownership);



  const storyMatch = text.match(/(?:about\s+us|our\s+story)[^.]{10,300}/i)

    || aboutPages.find((p) => p.type === "about") && combinePageText(aboutPages.filter((p) => p.type === "about")).slice(0, 400);



  const facilityMatch = text.match(/(?:expanded|relocated|moved\s+to|new\s+facility)[^.]{10,120}/i);



  return {

    foundingYear: buildField(

      foundingMatch?.[1] || null,

      foundingMatch ? "VERIFIED" : "MISSING",

      foundingMatch ? source : null,

      foundingMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    priorNames: buildField(

      priorMatch?.[1]?.trim() || null,

      priorMatch ? "VERIFIED" : "MISSING",

      priorMatch ? source : null,

      priorMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    ownership: buildField(

      ownershipMatch?.[1]?.trim() || (familyMatch ? "Locally owned and operated" : null),

      ownershipMatch || familyMatch ? "VERIFIED" : "MISSING",

      ownershipMatch || familyMatch ? source : null,

      ownershipMatch || familyMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    facilityHistory: buildField(

      facilityMatch?.[0]?.trim() || null,

      facilityMatch ? "INFERRED" : "MISSING",

      facilityMatch ? source : null,

      facilityMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    familyStatus: buildField(

      familyMatch ? "Family/Local Business" : null,

      familyMatch ? "VERIFIED" : "MISSING",

      familyMatch ? source : null,

      familyMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    communityHistory: buildField(

      communityMatch?.[1]?.trim() || null,

      communityMatch ? "VERIFIED" : "MISSING",

      communityMatch ? source : null,

      communityMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

    approvedPublicStory: buildField(

      typeof storyMatch === "string" ? storyMatch.trim().slice(0, 500) : null,

      storyMatch ? "VERIFIED" : "MISSING",

      storyMatch ? source : null,

      storyMatch ? null : MISSING_REASONS.NO_PAGE_CONTENT

    ),

  };

}

