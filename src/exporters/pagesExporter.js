import XLSX from "xlsx-js-style";
import {
  getConfidenceStyle,
  HEADER_FILL,
  HEADER_FONT,
  REPEATED_LINK_FILL,
  REPEATED_LINK_FONT
} from "../styles/theme.js";
import { formatFieldValue, formatBrandInventoryUrls } from "../utils/formatFieldValue.js";

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

function buildCell(value, fillHex, fontHex, isBold = false) {
  const cell = { v: value !== null && value !== undefined ? String(value) : "", t: "s" };
  cell.s = {
    font: { name: "Calibri", sz: 11, bold: isBold },
    alignment: { vertical: "center", horizontal: "left", wrapText: true }
  };
  if (fillHex) cell.s.fill = { fgColor: { rgb: fillHex } };
  if (fontHex) cell.s.font.color = { rgb: fontHex };
  return cell;
}

function applyAutoWidths(ws, matrix) {
  if (!matrix || matrix.length === 0) return;
  const cols = [];
  const colCount = matrix[0].length;

  for (let c = 0; c < colCount; c++) {
    let maxLen = 12;
    for (let r = 0; r < matrix.length; r++) {
      const valStr = matrix[r][c]?.v ? String(matrix[r][c].v) : "";
      if (valStr.length > maxLen) maxLen = valStr.length;
    }
    cols.push({ wch: Math.min(maxLen + 3, 80) });
  }
  ws["!cols"] = cols;
}

export default function generatePagesSheet(masterJson) {
  try {
    const wb = XLSX.utils.book_new();
    const tab1Matrix = [];
    const t1Headers = ["Section", "Label", "URL", "HTTP Status", "Confidence", "Source", "Notes"];
    tab1Matrix.push(t1Headers.map((h) => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const deployUrls = masterJson.sections.s19_deploymentUrls || {};

    for (const [key, node] of Object.entries(deployUrls)) {
      const label = formatLabel(key);
      const isBrandUrls = key === "brandInventoryUrls";
      const urlVal = isBrandUrls
        ? formatBrandInventoryUrls(node.value)
        : formatFieldValue(node.value);
      const confidence = node.confidence || "MISSING";
      const source = node.source || "—";
      const { fill: confFill, font: confFont } = getConfidenceStyle(confidence);

      let statusText = "404 - Missing";
      if (isBrandUrls && Array.isArray(node.value) && node.value.length) {
        const verified = node.value.filter((e) => e.confidence === "VERIFIED").length;
        statusText = `${verified}/${node.value.length} verified`;
      } else if (urlVal) {
        statusText = confidence === "VERIFIED" ? "200 OK" : "3xx Redirect";
      }

      let notes = node.reason || "";
      let urlFill = confFill;
      let urlFont = confFont;

      if (node.duplicateOf) {
        notes = `Reuses ${formatLabel(node.duplicateOf)} link`;
        urlFill = REPEATED_LINK_FILL;
        urlFont = REPEATED_LINK_FONT;
      }

      tab1Matrix.push([
        buildCell("Deployment URLs (Section 19)", confFill, confFont),
        buildCell(label, confFill, confFont),
        buildCell(urlVal, urlFill, urlFont),
        buildCell(statusText, confFill, confFont),
        buildCell(confidence, confFill, confFont, true),
        buildCell(source, confFill, confFont),
        buildCell(notes, confFill, confFont)
      ]);
    }

    const ws1 = XLSX.utils.aoa_to_sheet(tab1Matrix);
    ws1["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws1, tab1Matrix);
    XLSX.utils.book_append_sheet(wb, ws1, "Pages & URLs");

    const tab2Matrix = [];
    const t2Headers = ["Platform", "URL", "Status", "Confidence", "Reason"];
    tab2Matrix.push(t2Headers.map((h) => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const socialUrls = masterJson.sections.s2_nap?.socialUrls || {};

    for (const [platform, node] of Object.entries(socialUrls)) {
      const urlVal = node.value || "";
      const confidence = node.confidence || "MISSING";
      const { fill: confFill, font: confFont } = getConfidenceStyle(confidence);
      const statusText = urlVal ? "Active Link" : "Not Found";

      tab2Matrix.push([
        buildCell(formatLabel(platform), confFill, confFont, true),
        buildCell(urlVal, confFill, confFont),
        buildCell(statusText, confFill, confFont),
        buildCell(confidence, confFill, confFont, true),
        buildCell(node.reason || "", confFill, confFont)
      ]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(tab2Matrix);
    ws2["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws2, tab2Matrix);
    XLSX.utils.book_append_sheet(wb, ws2, "Social Media");

    XLSX.writeFile(wb, "pages_urls.xlsx");
  } catch (error) {
    console.error("Pages exporter encountered a workbook compiling failure", error);
  }
}
