/**
 * Lightweight verification helpers to strengthen VERIFIED evidence.
 * Rules:
 * - Geo coordinates: require matching JSON-LD GeoCoordinates or exact lat/lng text on an OK page.
 * - Service hours: require JSON-LD openingHours or a clearly labeled hours table on the site.
 */
export function findJsonLdObjects(pages) {
  const found = [];
  for (const p of pages) {
    if (!p.html) continue;
    try {
      const matches = [...p.html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const m of matches) {
        try {
          const json = JSON.parse(m[1]);
          if (Array.isArray(json)) json.forEach((j) => found.push({ doc: j, url: p.url }));
          else found.push({ doc: json, url: p.url });
        } catch { /* ignore parse errors */ }
      }
    } catch { /* ignore */ }
  }
  return found;
}

export function verifyGeoCoordinates(napNode, crawledPages) {
  if (!napNode || !napNode.value) return napNode;
  const lat = parseFloat(napNode.value?.lat || napNode.value?.latitude || napNode.value?.lat);
  const lng = parseFloat(napNode.value?.lng || napNode.value?.longitude || napNode.value?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    napNode.confidence = "MISSING";
    napNode.reason = "Coordinates not present or unparsable";
    return napNode;
  }

  const jsonld = findJsonLdObjects(crawledPages);
  for (const obj of jsonld) {
    try {
      const doc = obj.doc;
      const schemaType = doc && doc['@type'];
      const typeCandidates = Array.isArray(schemaType) ? schemaType : [schemaType];
      const isLocalBusiness = typeCandidates.some((t) => typeof t === 'string' && t.toLowerCase() === 'localbusiness');
      const geo = doc?.geo || doc?.address?.geo || (isLocalBusiness && doc?.geo);
      if (geo && geo.latitude && geo.longitude) {
        const jlat = parseFloat(geo.latitude);
        const jlng = parseFloat(geo.longitude);
        const distLat = Math.abs(jlat - lat);
        const distLng = Math.abs(jlng - lng);
        if (distLat < 0.02 && distLng < 0.02) {
          napNode.confidence = "VERIFIED";
          napNode.reason = null;
          return napNode;
        }
      }
    } catch { /* ignore */ }
  }

  // fallback: try to find explicit coordinates text on homepage
  const home = crawledPages.find((p) => p.type === "home") || crawledPages[0];
  if (home && home.html) {
    const coordMatch = home.html.match(/([+-]?\d{1,2}\.\d+)[ ,;]+([+-]?\d{1,3}\.\d+)/);
    if (coordMatch) {
      const hlat = parseFloat(coordMatch[1]);
      const hlng = parseFloat(coordMatch[2]);
      if (Math.abs(hlat - lat) < 0.02 && Math.abs(hlng - lng) < 0.02) {
        napNode.confidence = "VERIFIED";
        napNode.reason = "Matched coordinates in visible text";
        return napNode;
      }
    }
  }

  napNode.confidence = "UNKNOWN";
  napNode.reason = "Coordinates present but not verifiable via structured data or visible text";
  return napNode;
}

export function verifyServiceHours(hoursNode, crawledPages) {
  if (!hoursNode || !hoursNode.value) return hoursNode;

  const jsonld = findJsonLdObjects(crawledPages);
  for (const obj of jsonld) {
    try {
      const doc = obj.doc;
      const oh = doc?.openingHours || doc?.openingHoursSpecification;
      if (oh) {
        hoursNode.confidence = "VERIFIED";
        hoursNode.reason = null;
        return hoursNode;
      }
    } catch { /* ignore */ }
  }

  // Look for a visible hours table around keywords like "Hours", "Open".
  const home = crawledPages.find((p) => p.type === "home") || crawledPages[0];
  if (home && home.html) {
    const snippet = home.html.slice(0, 20000).toLowerCase();
    if (/\b(hours|open|opening hours|service hours|sales hours)\b/.test(snippet) && /mon|tue|wed|thu|fri|sat|sun/.test(snippet)) {
      hoursNode.confidence = "VERIFIED";
      hoursNode.reason = "Found labeled hours table or list in page HTML";
      return hoursNode;
    }
  }

  hoursNode.confidence = "MISSING";
  hoursNode.reason = "No structured openingHours found; visible hours not clearly present";
  return hoursNode;
}

export default {
  findJsonLdObjects,
  verifyGeoCoordinates,
  verifyServiceHours,
};
