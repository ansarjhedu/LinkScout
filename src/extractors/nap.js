import parseHtml from "../utils/domParser.js";
import { buildField } from "../utils/fieldBuilder.js";

function parseHoursFromText(text) {
  if (!text) return null;
  const patterns = [
    /sales[^.]{0,30}?(?:mon|monday)[^.]{0,80}/i,
    /service[^.]{0,30}?(?:mon|monday)[^.]{0,80}/i,
    /(?:mon|monday)\s*[-–]\s*(?:sat|saturday)[^.]{0,60}/i,
    /(?:open|hours)[^.]{0,40}\d{1,2}:\d{2}\s*(?:am|pm)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return null;
}

function extractFromDomFallback(pages) {
  const home = pages.find((p) => p.type === "home") || pages[0] || { html: "", url: "" };
  const contact = pages.find((p) => p.type === "contact") || home;
  const hHelper = parseHtml(home.html);
  const cHelper = parseHtml(contact.html);

  let phone = hHelper.attr("a[href^='tel:']", "href")?.replace("tel:", "");
  if (!phone) phone = cHelper.attr("a[href^='tel:']", "href")?.replace("tel:", "");
  if (!phone) {
    const match = (hHelper.text("body") || "").match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (match) phone = match[0];
  }

  let legalName = null;
  const footerText = hHelper.text("footer") || "";
  const legalMatch = footerText.match(/([A-Za-z0-9\s,&]+ (LLC|Inc|Corp|Corporation|Co\.|Company))/i);
  if (legalMatch) legalName = legalMatch[1].trim();

  let lat = null, lng = null;
  const mapsEmbed = cHelper.attr("iframe[src*='maps']", "src") || hHelper.attr("iframe[src*='maps']", "src");
  if (mapsEmbed) {
    const coordMatch = mapsEmbed.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/) || mapsEmbed.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      if (mapsEmbed.includes("!2d")) { lng = coordMatch[1]; lat = coordMatch[2]; }
      else { lat = coordMatch[1]; lng = coordMatch[2]; }
    }
  }

  const logoUrl = hHelper.attr("img[class*='logo']", "src") ||
    hHelper.attr("img[id*='logo']", "src") ||
    hHelper.attr("link[rel='icon']", "href") ||
    hHelper.attr("meta[property='og:image']", "content");

  const bodyText = (hHelper.text("body") || "") + " " + (cHelper.text("body") || "");
  const salesHours = parseHoursFromText(bodyText.match(/sales[^.]{0,20}hours[^.]{0,80}/i)?.[0] || bodyText);
  const serviceHours = parseHoursFromText(bodyText.match(/service[^.]{0,20}hours[^.]{0,80}/i)?.[0] || bodyText);

  return {
    dealershipName: hHelper.text("title")?.split("|")[0]?.split("-")[0]?.trim() || hHelper.text("h1") || null,
    legalName, phone, lat, lng, logoUrl, salesHours, serviceHours,
    sourceUrl: home.url || contact.url
  };
}

export default function extractNap(pages, targetUrl, socialHarvest = []) {
  let schema = null;
  let schemaSource = null;

  for (const page of pages) {
    const schemas = parseHtml(page.html).jsonLd();
    const match = schemas.find((s) => s["@type"] && /Business|Dealer|Organization|Store/i.test(s["@type"]));
    if (match) { schema = match; schemaSource = page.url; break; }
  }

  const domFallback = extractFromDomFallback(pages);
  const homePage = pages.find((p) => p.type === "home") || { html: "", url: targetUrl };
  const hHelper = parseHtml(homePage.html);

  let street = schema?.address?.streetAddress || null;
  let city = schema?.address?.addressLocality || null;
  let state = schema?.address?.addressRegion || null;
  let zip = schema?.address?.postalCode || null;

  if (!street) {
    const footer = hHelper.text("footer") || "";
    const addressMatch = footer.match(/\d+\s+[A-Za-z0-9\s.,#-]+?\s+[A-Z]{2}\s+\d{5}/i);
    if (addressMatch) {
      const matchedStr = addressMatch[0].trim();
      zip = matchedStr.match(/\d{5}$/)?.[0] || zip;
      state = matchedStr.match(/([A-Z]{2})\s+\d{5}$/i)?.[1]?.toUpperCase() || state;
      const cleaned = matchedStr.replace(/\s*[A-Z]{2}\s+\d{5}$/i, "").trim();
      const cityWords = cleaned.split(/[\s,]+/);
      if (cityWords.length) {
        city = cityWords[cityWords.length - 1];
        street = cleaned.replace(new RegExp(`[,\\s]+${city}$`, "i"), "").trim();
      }
    }
  }

  let gBus = null, gMaps = null, gRev = null;
  for (const page of pages) {
    const hrefs = parseHtml(page.html).attrAll("a[href]", "href");
    if (!gBus) gBus = hrefs.find((h) => /share\.google|g\.page(?!\/r)/i.test(h));
    if (!gMaps) gMaps = hrefs.find((h) => /google\.com\/maps/i.test(h));
    if (!gRev) gRev = hrefs.find((h) => /writereview|g\.page\/r/i.test(h));
  }

  const socialPlats = {
    facebook: "facebook.com", instagram: "instagram.com", youtube: "youtube.com",
    tiktok: "tiktok.com", twitter: ["twitter.com", "x.com"], linkedin: "linkedin.com"
  };
  const socialUrls = {};

  for (const page of pages) {
    const hrefs = parseHtml(page.html).attrAll("a[href]", "href");
    for (const [plat, domain] of Object.entries(socialPlats)) {
      if (socialUrls[plat]?.value) continue;
      const domains = Array.isArray(domain) ? domain : [domain];
      const url = hrefs.find((h) => domains.some((d) => h.includes(d)));
      if (url) socialUrls[plat] = buildField(url, "VERIFIED", page.url);
    }
  }

  for (const entry of socialHarvest) {
    const plat = entry.socialPlatform;
    if (plat && !socialUrls[plat]?.value) {
      socialUrls[plat] = buildField(entry.url, "VERIFIED", homePage.url);
    }
  }

  for (const plat of Object.keys(socialPlats)) {
    if (!socialUrls[plat]) socialUrls[plat] = buildField(null, "MISSING", null, "No link to this platform found in navigation, footer, or page content");
  }

  const confidence = schema ? "VERIFIED" : "INFERRED";
  const source = schema ? schemaSource : domFallback.sourceUrl;

  let salesHours = domFallback.salesHours;
  let serviceHours = domFallback.serviceHours;
  if (schema?.openingHoursSpecification) {
    salesHours = JSON.stringify(schema.openingHoursSpecification);
  }

  return {
    dealershipName: buildField(schema?.name || domFallback.dealershipName, confidence, source),
    legalName: buildField(schema?.legalName || domFallback.legalName, domFallback.legalName ? "INFERRED" : "MISSING", source, domFallback.legalName ? null : "Legal entity name not found in schema.org or footer"),
    dbaName: buildField(schema?.alternateName || null, schema?.alternateName ? confidence : "MISSING", source, schema?.alternateName ? null : "DBA name not published on website"),
    address: {
      street: buildField(street, confidence, source),
      city: buildField(city, confidence, source),
      state: buildField(state, confidence, source),
      zip: buildField(zip, confidence, source)
    },
    phone: buildField(schema?.telephone || domFallback.phone, confidence, source),
    salesHours: buildField(salesHours, salesHours ? confidence : "MISSING", source),
    serviceHours: buildField(serviceHours, serviceHours ? "INFERRED" : "MISSING", serviceHours ? source : null),
    lat: buildField(schema?.geo?.latitude || domFallback.lat, confidence, source),
    lng: buildField(schema?.geo?.longitude || domFallback.lng, confidence, source),
    logoUrl: buildField(schema?.logo || domFallback.logoUrl, domFallback.logoUrl || schema?.logo ? confidence : "MISSING", source, domFallback.logoUrl || schema?.logo ? null : "Logo URL not found in page markup or schema.org"),
    googleBusinessUrl: buildField(gBus, gBus ? "VERIFIED" : "MISSING", gBus ? homePage.url : null, gBus ? null : "No Google Business Profile link found on crawled pages"),
    googleMapsUrl: buildField(gMaps, gMaps ? "VERIFIED" : "MISSING", gMaps ? homePage.url : null, gMaps ? null : "No Google Maps embed or link found on crawled pages"),
    googleReviewUrl: buildField(gRev, gRev ? "VERIFIED" : "MISSING", gRev ? homePage.url : null, gRev ? null : "No Google review link found on crawled pages"),
    socialUrls
  };
}
