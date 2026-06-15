import XLSX from "xlsx-js-style";
import { formatFieldValue, formatBrandInventoryUrls } from "../utils/formatFieldValue.js";
import getLogger from "../utils/logger.js";
import { 
  getConfidenceStyle, 
  HEADER_FILL, 
  HEADER_FONT, 
  REPEATED_LINK_FILL, 
  REPEATED_LINK_FONT,
  DEALER_FILL,
  DEALER_FONT,
  MISSING_FILL,
  MISSING_FONT
} from "../styles/theme.js";

// Reusable standard cell and layout helper routines
function buildCell(val, fill, font, bold = false) {
  const isPresent = val !== null && val !== undefined && String(val).trim() !== "";
  const cell = { v: isPresent ? String(val) : "None", t: "s" };
  cell.s = {
    font: { name: "Calibri", sz: 11, bold },
    alignment: { vertical: "center", horizontal: "left" }
  };
  if (fill) cell.s.fill = { fgColor: { rgb: fill } };
  if (font) cell.s.font.color = { rgb: font };
  return cell;
}

function autoWidths(ws, matrix) {
  if (!matrix || matrix.length === 0) return;
  ws["!cols"] = matrix[0].map((_, c) => {
    const maxLen = matrix.reduce((acc, r) => Math.max(acc, r[c]?.v ? String(r[c].v).length : 0), 12);
    return { wch: Math.min(maxLen + 3, 60) };
  });
}

function pushNodeRow(label, node, matrix) {
  const conf = node?.confidence || "MISSING";
  const { fill, font } = getConfidenceStyle(conf);
  const displayValue = formatFieldValue(node?.value);
  const reason = node?.reason ? ` (${node.reason})` : "";

  matrix.push([
    buildCell(label, fill, font, true),
    buildCell(displayValue ? displayValue + reason : reason.trim() || "None", fill, font),
    buildCell(conf, fill, font, true)
  ]);
}

/**
 * Compiles the exhaustive 14-Tab master intelligence audit portfolio sheet.
 * Consolidates all system extractors, trace crawl histories, and checklist tables 
 * into a single unified workspace.
 * 
 * @param {Object} masterJson - The completed, validated and tagged Master JSON tree.
 */
export default function generateMasterSheet(masterJson) {
  try {
    const wb = XLSX.utils.book_new();
    const sections = masterJson.sections;

    // --- TAB 1: Summary Dashboard ---
    const t1 = [["Audit Metric", "Value", "Notes"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    t1.push([buildCell("Dealership Domain", null, null, true), buildCell(masterJson.meta.crawledUrl), buildCell("Target host parsed")]);
    const scoreColor = masterJson.meta.completenessScore < 40 ? "FDECEA" : "D6F4E2";
    t1.push([buildCell("Completeness Score", scoreColor, null, true), buildCell(`${masterJson.meta.completenessScore}%`, scoreColor, null, true), buildCell("Target benchmark threshold >= 40%")]);
    const summary = masterJson.meta.confidenceSummary || {};
    t1.push([buildCell("Verified Properties", "D6F4E2", "1D6B3A", true), buildCell(summary.verifiedCount, "D6F4E2", "1D6B3A"), buildCell("Direct schema matches")]);
    t1.push([buildCell("Inferred Text Assets", "FFF3CD", "7C5200", true), buildCell(summary.inferredCount, "FFF3CD", "7C5200"), buildCell("Pattern-matched from page content")]);
    t1.push([buildCell("Missing / Not Found", "FDECEA", "7C1E1E", true), buildCell(summary.missingCount, "FDECEA", "7C1E1E"), buildCell("Not on website — see Section 20 reasons")]);

    // --- TAB 2: NAP & Profile ---
    const t2 = [["Identity Field", "Value", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const nap = sections.s2_nap;
    pushNodeRow("Dealership Name", nap.dealershipName, t2);
    pushNodeRow("Legal Corporate Name", nap.legalName, t2);
    pushNodeRow("DBA Alternate Name", nap.dbaName, t2);
    pushNodeRow("Street Address", nap.address?.street, t2);
    pushNodeRow("City", nap.address?.city, t2);
    pushNodeRow("State", nap.address?.state, t2);
    pushNodeRow("Zip Code", nap.address?.zip, t2);
    pushNodeRow("Telephone Main Line", nap.phone, t2);
    pushNodeRow("Sales Hours Specifications", nap.salesHours, t2);
    pushNodeRow("Service Hours Specifications", nap.serviceHours, t2);
    pushNodeRow("GPS Latitude Coordinate", nap.lat, t2);
    pushNodeRow("GPS Longitude Coordinate", nap.lng, t2);
    pushNodeRow("Google Business URL", nap.googleBusinessUrl, t2);

    // --- TAB 3: Pages & URLs ---
    const t3 = [["Section Identifier", "Department Label", "Target URL", "Status Code", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    Object.entries(sections.s19_deploymentUrls).forEach(([key, n]) => {
      const { fill, font } = getConfidenceStyle(n.confidence);
      const urlDisplay = key === "brandInventoryUrls"
        ? formatBrandInventoryUrls(n.value)
        : formatFieldValue(n.value);
      t3.push([
        buildCell("Deployment URLs", fill, font),
        buildCell(key.toUpperCase(), fill, font, true),
        buildCell(urlDisplay, n.duplicateOf ? REPEATED_LINK_FILL : fill, n.duplicateOf ? REPEATED_LINK_FONT : font),
        buildCell(urlDisplay ? (n.confidence === "VERIFIED" ? "200 OK" : "3xx Redirect") : "404 - Missing", fill, font),
        buildCell(n.confidence, fill, font, true)
      ]);
    });

    // --- TAB 4: Social Accounts ---
    const t4 = [["Social Platform", "Verified Channel URL", "Channel Status", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    Object.entries(nap.socialUrls || {}).forEach(([p, n]) => {
      const { fill, font } = getConfidenceStyle(n.confidence);
      t4.push([buildCell(p.toUpperCase(), fill, font, true), buildCell(n.value, fill, font), buildCell(n.value ? "Active Profile" : "Missing Profile", fill, font), buildCell(n.confidence, fill, font, true)]);
    });

    // --- TAB 5: Franchise Brands ---
    const t5 = [["Brand Asset", "Parent Corporation", "Product Classification", "Retail Authority", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    (sections.s5_brands || []).forEach((b) => {
      const conf = b.brandName?.confidence || "INFERRED";
      const { fill, font } = getConfidenceStyle(conf);
      t5.push([buildCell(b.brandName?.value, fill, font, true), buildCell(b.parentCompany?.value || "—", fill, font), buildCell(b.productLines?.value?.join(", "), fill, font), buildCell(b.authorityRole?.value, fill, font), buildCell(conf, fill, font, true)]);
    });

    // --- TAB 6: Departments landing ---
    const t6 = [["Division ID", "Corporate Role", "Department Creed", "User Benefit Focus", "Department URL", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    Object.entries(sections.s7_departments || {}).forEach(([key, d]) => {
      const { fill, font } = getConfidenceStyle(d.pageUrl?.confidence);
      t6.push([buildCell(key.toUpperCase(), fill, font, true), buildCell(d.role?.value, fill, font), buildCell(d.authorityTheme?.value, fill, font), buildCell(d.customerNeed?.value, fill, font), buildCell(d.pageUrl?.value, fill, font), buildCell(d.pageUrl?.confidence, fill, font, true)]);
    });

    // --- TAB 7: Finance Portfolio ---
    const t7 = [["Corporate Finance Attribute", "Discovered Details", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const fin = sections.s8_finance;
    pushNodeRow("Financing Program Offered", fin.financingOffered, t7);
    pushNodeRow("In-House Funding Stance", fin.inHouseFinancing, t7);
    pushNodeRow("Lending Partners", fin.lenders, t7);
    pushNodeRow("Finance Tiers", fin.creditPrograms, t7);
    pushNodeRow("Negative Trade Policy", fin.tradeEquityPolicy, t7);
    pushNodeRow("Protection Policies", fin.protectionProducts, t7);
    pushNodeRow("Risk Disclosures Found", fin.complianceSafeLanguage, t7);
    pushNodeRow("Guaranteed Claims (Violation)", fin.forbiddenLanguageFound, t7);

    // --- TAB 8: Service & Parts ---
    const t8 = [["Division Policy Element", "Discovered Value", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const srv = sections.s9_service;
    const pts = sections.s10_parts;
    pushNodeRow("Service: Brands Maintained", srv.brandsServiced, t8);
    pushNodeRow("Service: Non-Franchise Policy", srv.nonFranchisePolicy, t8);
    pushNodeRow("Service: Tooling Specialties", srv.specialties, t8);
    pushNodeRow("Service: Diagnostics", srv.diagnostics, t8);
    pushNodeRow("Parts: OEM Support Policy", pts.oemSupport, t8);
    pushNodeRow("Parts: Aftermarket Integration", pts.aftermarket, t8);
    pushNodeRow("Parts: Apparel & Gear Lines", pts.apparelGear, t8);
    pushNodeRow("Parts: Custom Special Orders", pts.specialOrders, t8);

    // --- TAB 9: Geo Territories ---
    const t9 = [["Spatial Target", "Corporate Range Details", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const geo = sections.s11_geo;
    pushNodeRow("Dealer Location City", geo.primaryCity, t9);
    pushNodeRow("Dealer State Code", geo.primaryState, t9);
    pushNodeRow("State County Area", geo.county, t9);
    pushNodeRow("Metro Core Hub", geo.metroMarket, t9);
    pushNodeRow("Extended Trade Range", geo.extendedMarket, t9);
    pushNodeRow("Adjacent Communities", geo.nearbyCities, t9);
    pushNodeRow("Lifestyle Target Demographics", geo.lifestyleMarkets, t9);

    // --- TAB 10: Buyer Psychology ---
    const t10 = [["Buyer Persona", "Motivation / Triggers", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    (sections.s12_buyer_psychology?.profiles || []).forEach((p) => {
      const conf = p.group?.confidence || "INFERRED";
      const { fill, font } = getConfidenceStyle(conf);
      t10.push([
        buildCell(p.group?.value, fill, font, true),
        buildCell(`${p.motivation?.value} | Trigger: ${p.decisionTrigger?.value}`, fill, font),
        buildCell(conf, fill, font, true)
      ]);
    });

    // --- TAB 11: Claims & Compliance ---
    const t11 = [["Audit Class", "Claim/Phrase text", "Element Located", "Source Page URL"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const cl = sections.s16_claims;
    (cl.approvedClaims?.value || []).forEach(c => t11.push([buildCell("APPROVED FACT", "D6F4E2", "1D6B3A", true), buildCell(c.claim), buildCell(c.sourceElement), buildCell(c.sourceUrl)]));
    (cl.claimsNeedingProof?.value || []).forEach(c => t11.push([buildCell("NEEDS PROOF (SUPERLATIVE)", "FFF3CD", "7C5200", true), buildCell(c.claim), buildCell(c.sourceElement), buildCell(c.sourceUrl)]));
    (cl.complianceFlags?.value || []).forEach(c => t11.push([buildCell("RISK ALERT", "FDECEA", "7C1E1E", true), buildCell(c.issue), buildCell("Page Scraped"), buildCell(c.sourceUrl)]));

    // --- TAB 12: Business History ---
    const t12 = [["Timeline Historical Element", "Discovered Timeline Details", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const hist = sections.s3_business_history;
    pushNodeRow("Year Founded", hist.foundingYear, t12);
    pushNodeRow("Prior Corporate Names", hist.priorNames, t12);
    pushNodeRow("Active Ownership Group", hist.ownership, t12);
    pushNodeRow("Facility Expansions", hist.facilityHistory, t12);
    pushNodeRow("Multi-Generational Status", hist.familyStatus, t12);

    // --- TAB 13: Crawl audit gaps ---
    const t13 = [["Severity Status", "Field Identifier", "Target Sheet Section", "Reason Not Found"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const audit = sections.s20_crawlAudit || sections.s20_missingItems || {};
    (audit.critical || []).forEach(m => t13.push([buildCell("CRITICAL", "FDECEA", "7C1E1E", true), buildCell(m.field), buildCell(m.section), buildCell(m.reason || m.notes)]));
    (audit.gaps || []).slice(0, 40).forEach(m => t13.push([buildCell("MISSING", "FFF3CD", "7C5200", true), buildCell(m.field), buildCell(m.section), buildCell(m.reason)]));

    // --- TAB 14: Trace Crawl log ---
    const t14 = [["Execution Timestamp", "Processed URL Target", "HTTP Response Status", "Duration (ms)", "Crawler Telemetry Notes"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    getLogger().getLogs().forEach(l => t14.push([buildCell(l.timestamp), buildCell(l.url), buildCell(l.status), buildCell(l.durationMs), buildCell(l.notes)]));

    // --- TAB X: All Discovered URLs (flat registry) ---
    const tAll = [["URL", "Type", "Category", "Deployment Key", "HTTP Status", "Confidence", "Source"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    (masterJson.linkRegistry || []).forEach((r) => {
      tAll.push([
        buildCell(r.url),
        buildCell(r.pageType || "other"),
        buildCell(r.category),
        buildCell(r.deploymentKey),
        buildCell(r.status || ""),
        buildCell(r.confidence || "INFERRED"),
        buildCell(r.source || "")
      ]);
    });

    // Compile into workbook sheets
    const productRows = [["URL", "Name", "Brand", "Price", "Source", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const collectionRows = [["URL", "Name", "Item Count", "Source", "Confidence"].map(h => buildCell(h, HEADER_FILL, HEADER_FONT, true))];
    const catalog = masterJson.sections.s5b_catalog || {};
    (catalog.products?.value || []).forEach((p) => {
      productRows.push([
        buildCell(p.url),
        buildCell(p.name),
        buildCell(p.brand),
        buildCell(p.price),
        buildCell(p.source),
        buildCell(p.confidence),
      ]);
    });
    (catalog.collections?.value || []).forEach((c) => {
      collectionRows.push([
        buildCell(c.url),
        buildCell(c.name),
        buildCell(c.itemCount),
        buildCell(c.source),
        buildCell(c.confidence),
      ]);
    });

    const sheetsMap = {
      "Summary": t1, "NAP & Identity": t2, "Pages & URLs": t3, "All Discovered URLs": tAll, "Collections": collectionRows, "Products": productRows, "Social Media": t4,
      "Brands": t5, "Departments": t6, "Finance": t7, "Service & Parts": t8,
      "Geo & Market": t9, "Buyer Psychology": t10, "Claims & Compliance": t11,
      "Business History": t12, "Crawl Audit Gaps": t13, "Crawl Log": t14
    };

    Object.entries(sheetsMap).forEach(([name, matrix]) => {
      const ws = XLSX.utils.aoa_to_sheet(matrix);
      if (name !== "Summary") ws["!views"] = [{ state: "frozen", ySplit: 1 }];
      autoWidths(ws, matrix);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, "master_intelligence.xlsx");
  } catch (error) {
    console.error("Master intelligence exporter encountered an execution failure", error);
  }
}