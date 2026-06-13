import XLSX from "xlsx-js-style";
import { 
  getConfidenceStyle, 
  HEADER_FILL, 
  HEADER_FONT, 
  ROW_EVEN,
  MISSING_FILL,
  MISSING_FONT,
  VERIFIED_FILL,
  VERIFIED_FONT
} from "../styles/theme.js";

/**
 * Creates a formatted SheetJS cell object with custom font, alignment, and fill styles.
 * 
 * @param {any} value - Cell value.
 * @param {string} [fillHex] - Background hex code.
 * @param {string} [fontHex] - Foreground text hex code.
 * @param {boolean} [isBold=false] - True to render text in bold.
 * @returns {Object} Styled SheetJS cell object.
 */
function buildCell(value, fillHex, fontHex, isBold = false) {
  const cell = { v: value !== null && value !== undefined ? String(value) : "", t: "s" };
  cell.s = {
    font: { name: "Calibri", sz: 11, bold: isBold },
    alignment: { vertical: "center", horizontal: "left" }
  };
  
  if (fillHex) {
    cell.s.fill = { fgColor: { rgb: fillHex } };
  }
  if (fontHex) {
    cell.s.font.color = { rgb: fontHex };
  }
  
  return cell;
}

/**
 * Adjusts column widths of a SheetJS worksheet to fit longest contents.
 * 
 * @param {Object} ws - Target worksheet.
 * @param {Object[][]} matrix - 2D grid containing cell data objects.
 */
function applyAutoWidths(ws, matrix) {
  if (!matrix || matrix.length === 0) return;
  const cols = [];
  const colCount = matrix[0].length;

  for (let c = 0; c < colCount; c++) {
    let maxLen = 12;
    for (let r = 0; r < matrix.length; r++) {
      const cell = matrix[r][c];
      const valStr = cell && cell.v ? String(cell.v) : "";
      if (valStr.length > maxLen) maxLen = valStr.length;
    }
    cols.push({ wch: Math.min(maxLen + 3, 60) });
  }
  ws["!cols"] = cols;
}

/**
 * Normalizes lists and boolean values into clean exportable strings.
 * 
 * @param {any} val - Core node value.
 * @returns {string} String-formatted output.
 */
function stringifyValue(val) {
  if (val === true) return "Yes";
  if (val === false) return "No";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "None";
  return val !== null && val !== undefined ? String(val) : "Not Found";
}

/**
 * Appends standard metadata key-value pairings to a worksheet matrix.
 * 
 * @param {string} label - Row label descriptor.
 * @param {Object} node - Leaf metadata node { value, confidence }.
 * @param {Object[][]} matrix - Target grid matrix.
 * @param {string} [overrideFill] - Custom background fill override.
 * @param {string} [overrideFont] - Custom text font color override.
 */
function pushKeyValueRow(label, node, matrix, overrideFill, overrideFont) {
  const confidence = node?.confidence || "MISSING";
  const { fill: confFill, font: confFont } = getConfidenceStyle(confidence);

  matrix.push([
    buildCell(label, overrideFill || confFill, overrideFont || confFont, true),
    buildCell(stringifyValue(node?.value), overrideFill || confFill, overrideFont || confFont),
    buildCell(confidence, overrideFill || confFill, overrideFont || confFont, true)
  ]);
}

/**
 * Generates and triggers browser download of the "intel_brands_depts.xlsx" workbook.
 * Workbook collects corporate positioning assets across 4 distinct operational tabs.
 * 
 * @param {Object} masterJson - Validated and tagged Master JSON dataset.
 */
export default function generateIntelSheet(masterJson) {
  try {
    const wb = XLSX.utils.book_new();

    // ==========================================
    // TAB 1: Brands Portfolio
    // ==========================================
    const tab1Matrix = [];
    tab1Matrix.push(["Brand", "Parent Company", "Product Lines", "Authority Role", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const brands = masterJson.sections.s5_brands || [];
    brands.forEach((b) => {
      const conf = b.brandName?.confidence || "INFERRED";
      const { fill: cFill, font: cFont } = getConfidenceStyle(conf);

      tab1Matrix.push([
        buildCell(b.brandName?.value, cFill, cFont, true),
        buildCell(b.parentCompany?.value || "—", cFill, cFont),
        buildCell(stringifyValue(b.productLines?.value), cFill, cFont),
        buildCell(b.authorityRole?.value, cFill, cFont),
        buildCell(conf, cFill, cFont, true)
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(tab1Matrix);
    ws1["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws1, tab1Matrix);
    XLSX.utils.book_append_sheet(wb, ws1, "Brands");

    // ==========================================
    // TAB 2: Departments Landing
    // ==========================================
    const tab2Matrix = [];
    tab2Matrix.push(["Dept Name", "Role", "Authority Theme", "Customer Need", "Page URL", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const depts = masterJson.sections.s7_departments || {};
    for (const [key, d] of Object.entries(depts)) {
      const conf = d.pageUrl?.confidence || "MISSING";
      const { fill: cFill, font: cFont } = getConfidenceStyle(conf);

      tab2Matrix.push([
        buildCell(key.toUpperCase(), cFill, cFont, true),
        buildCell(d.role?.value, cFill, cFont),
        buildCell(d.authorityTheme?.value, cFill, cFont),
        buildCell(d.customerNeed?.value, cFill, cFont),
        buildCell(d.pageUrl?.value, cFill, cFont),
        buildCell(conf, cFill, cFont, true)
      ]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(tab2Matrix);
    ws2["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws2, tab2Matrix);
    XLSX.utils.book_append_sheet(wb, ws2, "Departments");

    // ==========================================
    // TAB 3: Finance Portfolio
    // ==========================================
    const tab3Matrix = [];
    tab3Matrix.push(["Field", "Value", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const fin = masterJson.sections.s8_finance || {};
    pushKeyValueRow("Financing Offered", fin.financingOffered, tab3Matrix);
    pushKeyValueRow("In-House Financing", fin.inHouseFinancing, tab3Matrix);
    pushKeyValueRow("Lenders Catalog", fin.lenders, tab3Matrix);
    pushKeyValueRow("Credit Risk Programs", fin.creditPrograms, tab3Matrix);
    pushKeyValueRow("Trade Equity Policy", fin.tradeEquityPolicy, tab3Matrix);
    pushKeyValueRow("Protection Products", fin.protectionProducts, tab3Matrix);
    pushKeyValueRow("Compliance Phrasing", fin.complianceSafeLanguage, tab3Matrix);

    // Warning highlights on illegal guaranteed-claims
    if (fin.forbiddenLanguageFound?.value) {
      pushKeyValueRow("Forbidden Language Found", fin.forbiddenLanguageFound, tab3Matrix, MISSING_FILL, MISSING_FONT);
    } else {
      pushKeyValueRow("Forbidden Language Found", fin.forbiddenLanguageFound, tab3Matrix, VERIFIED_FILL, VERIFIED_FONT);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(tab3Matrix);
    ws3["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws3, tab3Matrix);
    XLSX.utils.book_append_sheet(wb, ws3, "Finance");

    // ==========================================
    // TAB 4: Geo & Market
    // ==========================================
    const tab4Matrix = [];
    tab4Matrix.push(["Field", "Value", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true)));

    const geo = masterJson.sections.s11_geo || {};
    pushKeyValueRow("Primary City", geo.primaryCity, tab4Matrix);
    pushKeyValueRow("Primary State", geo.primaryState, tab4Matrix);
    pushKeyValueRow("County Area", geo.county, tab4Matrix);
    pushKeyValueRow("Metro Market Area", geo.metroMarket, tab4Matrix);
    pushKeyValueRow("Extended Territory", geo.extendedMarket, tab4Matrix);
    pushKeyValueRow("Nearby Cities Mentions", geo.nearbyCities, tab4Matrix);
    pushKeyValueRow("Lifestyle Demographics", geo.lifestyleMarkets, tab4Matrix);

    const ws4 = XLSX.utils.aoa_to_sheet(tab4Matrix);
    ws4["!views"] = [{ state: "frozen", ySplit: 1 }];
    applyAutoWidths(ws4, tab4Matrix);
    XLSX.utils.book_append_sheet(wb, ws4, "Geo & Market");

    XLSX.writeFile(wb, "intel_brands_depts.xlsx");
  } catch (error) {
    console.error("Intel exporter failed to build the workbook", error);
  }
}