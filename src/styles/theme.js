/**
 * Theme colors for SheetJS/xlsx-js-style spreadsheet styling.
 * Hex colors are specified without the leading '#' symbol, which is the 
 * standard format expected by the SheetJS cell fill and font properties.
 */

export const VERIFIED_FILL = "D6F4E2"; // Light green background
export const VERIFIED_FONT = "1D6B3A"; // Dark green text

export const INFERRED_FILL = "FFF3CD"; // Light amber/yellow background
export const INFERRED_FONT = "7C5200"; // Dark amber text

export const MISSING_FILL = "FDECEA";  // Light red background
export const MISSING_FONT = "7C1E1E";  // Dark red text

export const DEALER_FILL = "D6E8FA";   // Light blue background
export const DEALER_FONT = "0C3D78";   // Dark blue text

export const HEADER_FILL = "1E1E2E";   // Deep charcoal/near-black for main headers
export const HEADER_FONT = "FFFFFF";   // White text for headers

export const SECTION_FILL = "2D2D3E";  // Dark grey for sub-section breaks

export const REPEATED_LINK_FILL = "FFE0B2"; // Soft orange warning background for duplicate URLs
export const REPEATED_LINK_FONT = "B25E00"; // Dark orange text for duplicate warnings

export const ROW_EVEN = "F8F9FA";      // Very light grey alternating row background color

/**
 * Utility helper to get styling parameters for a cell based on confidence level.
 * @param {string} confidence - VERIFIED, INFERRED, MISSING, or DEALER-NEEDED
 * @returns {object} Object containing fill color and font color
 */
export function getConfidenceStyle(confidence) {
  switch (confidence) {
    case "VERIFIED":
      return { fill: VERIFIED_FILL, font: VERIFIED_FONT };
    case "INFERRED":
      return { fill: INFERRED_FILL, font: INFERRED_FONT };
    case "DEALER-NEEDED":
      return { fill: DEALER_FILL, font: DEALER_FONT };
    case "MISSING":
    default:
      return { fill: MISSING_FILL, font: MISSING_FONT };
  }
}