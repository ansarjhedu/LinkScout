import parseHtml from "../utils/domParser.js";
import {
  buildField,
  fieldFromSchema,
  mergeFields,
  CONFIDENCE_LEVELS,
  EVIDENCE_TYPES,
  MISSING_REASONS,
  buildMissingField,
} from "../utils/fieldBuilder.js";

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
    facebook: "facebook.com",
    instagram: "instagram.com",
    youtube: "youtube.com",
    tiktok: "tiktok.com",
    twitter: ["twitter.com", "x.com"],
    linkedin: "linkedin.com"
  };

  const confidence = schema ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.INFERRED;
  const evidenceType = schema ? EVIDENCE_TYPES.SCHEMA : EVIDENCE_TYPES.PAGE_TEXT;
  const source = schema ? schemaSource : domFallback.sourceUrl;

  let salesHours = domFallback.salesHours;
  let serviceHours = domFallback.serviceHours;
  if (schema?.openingHoursSpecification) {
    salesHours = JSON.stringify(schema.openingHoursSpecification);
  }

  // Build all fields with proper evidence tracking
  const dealershipNameField = mergeFields([
    schema?.name ? fieldFromSchema(schema, 'name', source) : null,
    domFallback.dealershipName ? buildField(
      domFallback.dealershipName,
      CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { extractedFrom: 'title_or_h1' }
    ) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const legalNameField = mergeFields([
    schema?.legalName ? fieldFromSchema(schema, 'legalName', source) : null,
    domFallback.legalName ? buildField(
      domFallback.legalName,
      CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { extractedFrom: 'footer_regex' }
    ) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_IN_SCHEMA);

  const dbaNameField = schema?.alternateName
    ? fieldFromSchema(schema, 'alternateName', source)
    : buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  // Address components
  const streetField = mergeFields([
    street ? buildField(street, confidence, source, null, evidenceType, { component: 'street' }) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const cityField = mergeFields([
    city ? buildField(city, confidence, source, null, evidenceType, { component: 'city' }) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const stateField = mergeFields([
    state ? buildField(state, confidence, source, null, evidenceType, { component: 'state' }) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const zipField = mergeFields([
    zip ? buildField(zip, confidence, source, null, evidenceType, { component: 'zip' }) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const phoneField = mergeFields([
    schema?.telephone ? fieldFromSchema(schema, 'telephone', source) : null,
    domFallback.phone ? buildField(
      domFallback.phone,
      CONFIDENCE_LEVELS.INFERRED,
      source,
      null,
      EVIDENCE_TYPES.PAGE_TEXT,
      { method: 'tel_link_or_regex' }
    ) : null,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const salesHoursField = salesHours
    ? buildField(salesHours, confidence, source, null, EVIDENCE_TYPES.PAGE_TEXT, { hoursType: 'sales' })
    : buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const serviceHoursField = serviceHours
    ? buildField(serviceHours, CONFIDENCE_LEVELS.INFERRED, source, null, EVIDENCE_TYPES.PAGE_TEXT, { hoursType: 'service' })
    : buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const latField = schema?.geo?.latitude
    ? buildField(schema.geo.latitude, CONFIDENCE_LEVELS.VERIFIED, source, null, EVIDENCE_TYPES.SCHEMA, { via: 'geo.latitude' })
    : (domFallback.lat ? buildField(domFallback.lat, CONFIDENCE_LEVELS.INFERRED, source, null, EVIDENCE_TYPES.PAGE_TEXT, { via: 'maps_embed' }) : buildMissingField());

  const lngField = schema?.geo?.longitude
    ? buildField(schema.geo.longitude, CONFIDENCE_LEVELS.VERIFIED, source, null, EVIDENCE_TYPES.SCHEMA, { via: 'geo.longitude' })
    : (domFallback.lng ? buildField(domFallback.lng, CONFIDENCE_LEVELS.INFERRED, source, null, EVIDENCE_TYPES.PAGE_TEXT, { via: 'maps_embed' }) : buildMissingField());

  const logoUrlField = schema?.logo
    ? fieldFromSchema(schema, 'logo', source)
    : (domFallback.logoUrl ? buildField(domFallback.logoUrl, CONFIDENCE_LEVELS.INFERRED, source, null, EVIDENCE_TYPES.EXPLICIT_TAG, { via: 'img_or_link' }) : buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE));

  const googleBusinessUrlField = gBus
    ? buildField(gBus, CONFIDENCE_LEVELS.VERIFIED, homePage.url, null, EVIDENCE_TYPES.EXPLICIT_TAG)
    : buildMissingField(MISSING_REASONS.NO_MATCHING_LINK);

  const googleMapsUrlField = gMaps
    ? buildField(gMaps, CONFIDENCE_LEVELS.VERIFIED, homePage.url, null, EVIDENCE_TYPES.EXPLICIT_TAG)
    : buildMissingField(MISSING_REASONS.NO_MATCHING_LINK);

  const googleReviewUrlField = gRev
    ? buildField(gRev, CONFIDENCE_LEVELS.VERIFIED, homePage.url, null, EVIDENCE_TYPES.EXPLICIT_TAG)
    : buildMissingField(MISSING_REASONS.NO_MATCHING_LINK);

  // Build social URLs with new evidence tracking
  const socialUrls = {};
  for (const page of pages) {
    const hrefs = parseHtml(page.html).attrAll("a[href]", "href");
    for (const [plat, domain] of Object.entries(socialPlats)) {
      if (socialUrls[plat]?.value) continue;
      const domains = Array.isArray(domain) ? domain : [domain];
      const url = hrefs.find((h) => domains.some((d) => h.includes(d)));
      if (url) {
        socialUrls[plat] = buildField(url, CONFIDENCE_LEVELS.VERIFIED, page.url, null, EVIDENCE_TYPES.EXPLICIT_TAG, { platform: plat });
      }
    }
  }

  for (const entry of socialHarvest) {
    const plat = entry.socialPlatform;
    if (plat && !socialUrls[plat]?.value) {
      socialUrls[plat] = buildField(
        entry.url,
        CONFIDENCE_LEVELS.VERIFIED,
        homePage.url,
        null,
        EVIDENCE_TYPES.EXPLICIT_TAG,
        { platform: plat, source: 'harvested_links' }
      );
    }
  }


  // Mark all social platforms (found or not found)
  for (const plat of Object.keys(socialPlats)) {
    if (!socialUrls[plat]) {
      socialUrls[plat] = buildMissingField(MISSING_REASONS.NO_MATCHING_LINK);
    }
  }

  return {
    dealershipName: dealershipNameField,
    legalName: legalNameField,
    dbaName: dbaNameField,
    address: {
      street: streetField,
      city: cityField,
      state: stateField,
      zip: zipField,
    },
    phone: phoneField,
    salesHours: salesHoursField,
    serviceHours: serviceHoursField,
    lat: latField,
    lng: lngField,
    logoUrl: logoUrlField,
    googleBusinessUrl: googleBusinessUrlField,
    googleMapsUrl: googleMapsUrlField,
    googleReviewUrl: googleReviewUrlField,
    socialUrls,
  };
}
