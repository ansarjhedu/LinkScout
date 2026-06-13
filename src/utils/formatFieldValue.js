/**
 * Formats any field value for display in exports and UI.
 * Handles brand inventory URL arrays and nested objects safely.
 */
export function formatFieldValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (typeof value[0] === "object" && value[0]?.url) {
      return value.map((v) => v.url).join(", ");
    }
    return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "object" && value.url) return value.url;
  return String(value);
}

/**
 * Formats brand inventory URL entries as multi-line text for spreadsheets.
 */
export function formatBrandInventoryUrls(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  return entries.map((e) => `${e.brand || "Brand"}: ${e.url} [${e.confidence}]`).join("\n");
}
