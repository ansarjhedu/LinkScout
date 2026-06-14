/**
 * Result wrapper containing safe DOM querying helpers.
 * @typedef {Object} DomHelper
 * @property {Document} doc - The raw parsed browser Document object.
 * @property {function(string): (string|null)} text - Retrieves text content of the first element.
 * @property {function(string): string[]} textAll - Retrieves text contents of all elements.
 * @property {function(string, string): (string|null)} attr - Retrieves attribute value from the first element.
 * @property {function(string, string): string[]} attrAll - Retrieves attribute values from all elements.
 * @property {function(): Object[]} jsonLd - Parses all application/ld+json schemas.
 * @property {function(RegExp|string): string[]} findLinksByText - Retrieves href attributes of anchor tags matching text content.
 */

/**
 * Parses raw HTML string using the client browser's native DOMParser
 * and encapsulates it in a clean helper interface for structured field extraction.
 * 
 * @param {string} html - Raw HTML document content.
 * @returns {DomHelper} Helper utilities bound to the parsed document.
 */
let DOMParserCtor;

if (typeof DOMParser !== "undefined") {
  DOMParserCtor = DOMParser;
} else {
  const { DOMParser: NodeDOMParser } = await import("linkedom");
  DOMParserCtor = NodeDOMParser;
}

export default function parseHtml(html) {
  const safeHtml = typeof html === "string" ? html : "";
  const parser = new DOMParserCtor();
  
  // Parse with the browser's highly-optimized HTML engine when available,
  // otherwise use linkedom in Node for consistent HTML parsing.
  const doc = parser.parseFromString(safeHtml, "text/html");

  return {
    doc,

    text(selector) {
      try {
        const el = doc.querySelector(selector);
        return el ? el.textContent.trim().replace(/\s+/g, " ") : null;
      } catch (e) {
        return null;
      }
    },

    textAll(selector) {
      try {
        const nodes = doc.querySelectorAll(selector);
        return Array.from(nodes)
          .map((el) => el.textContent.trim().replace(/\s+/g, " "))
          .filter(Boolean);
      } catch (e) {
        return [];
      }
    },

    attr(selector, attrName) {
      try {
        const el = doc.querySelector(selector);
        return el ? el.getAttribute(attrName)?.trim() || null : null;
      } catch (e) {
        return null;
      }
    },

    attrAll(selector, attrName) {
      try {
        const nodes = doc.querySelectorAll(selector);
        return Array.from(nodes)
          .map((el) => el.getAttribute(attrName)?.trim())
          .filter(Boolean);
      } catch (e) {
        return [];
      }
    },

    jsonLd() {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      const results = [];
      
      for (const script of scripts) {
        try {
          const text = script.textContent.trim();
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              results.push(...parsed);
            } else {
              results.push(parsed);
            }
          }
        } catch (e) {
          // Ignore invalid or malformed schema on target sites
        }
      }
      return results;
    },

    findLinksByText(pattern) {
      try {
        const links = doc.querySelectorAll("a[href]");
        const matches = [];
        const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

        for (const link of links) {
          const text = link.textContent.trim();
          if (regex.test(text)) {
            const href = link.getAttribute("href");
            if (href) {
              matches.push(href);
            }
          }
        }
        return [...new Set(matches)];
      } catch (e) {
        return [];
      }
    }
  };
}