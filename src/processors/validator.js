import { MISSING_REASONS } from "../utils/fieldBuilder.js";
import { verifyGeoCoordinates, verifyServiceHours } from "../utils/verification.js";

function isValidPhonePattern(phone) {
  if (!phone) return false;
  return /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(phone.trim());
}

function isValidSocialDomain(url, expectedDomain) {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase().includes(expectedDomain);
  } catch {
    return false;
  }
}

/**
 * Enforces compliance checks, HTTP verification, and attaches reasons to missing fields.
 */
export default function validateOutput(masterJson, crawledPages) {
  const nap = masterJson.sections.s2_nap;
  const claims = masterJson.sections.s16_claims;
  const deploy = masterJson.sections.s19_deploymentUrls;

  if (nap.phone?.value) {
    if (!isValidPhonePattern(nap.phone.value)) {
      nap.phone.confidence = "INFERRED";
      nap.phone.reason = "Phone found but format did not match strict validation pattern";
    }
  }

  const socialDomains = {
    facebook: "facebook.com",
    instagram: "instagram.com",
    youtube: "youtube.com",
    tiktok: "tiktok.com",
    twitter: "twitter.com",
    linkedin: "linkedin.com",
  };

  if (nap.socialUrls) {
    for (const [platform, domain] of Object.entries(socialDomains)) {
      const socialNode = nap.socialUrls[platform];
      if (socialNode?.value) {
        if (!isValidSocialDomain(socialNode.value, domain)) {
          socialNode.value = null;
          socialNode.confidence = "MISSING";
          socialNode.source = null;
          socialNode.reason = `Link found but hostname did not match official ${platform} domain`;
        }
      } else if (socialNode && !socialNode.reason) {
        socialNode.reason = MISSING_REASONS.NO_MATCHING_LINK;
      }
    }
  }

  const urlOccurrences = {};

  for (const [key, node] of Object.entries(deploy)) {
    if (!node) continue;

    // Brand inventory URLs — array of { brand, url, confidence, source }
    if (key === "brandInventoryUrls" && Array.isArray(node.value)) {
      for (const entry of node.value) {
        const crawlTrace = crawledPages.find((p) => p.url === entry.url);
        if (crawlTrace?.status === 200) {
          entry.confidence = "VERIFIED";
        } else if (crawlTrace && crawlTrace.status >= 400) {
          entry.confidence = "MISSING";
          entry.reason = MISSING_REASONS.DEAD_LINK;
        } else if (!crawlTrace) {
          entry.confidence = "INFERRED";
          entry.reason = "Link found in navigation but page was not crawled";
        }
      }
      const verified = node.value.filter((e) => e.confidence === "VERIFIED");
      node.confidence = verified.length
        ? "VERIFIED"
        : node.value.length
          ? "INFERRED"
          : "MISSING";
      if (!node.value.length && !node.reason) {
        node.reason = MISSING_REASONS.NO_MATCHING_LINK;
      }
      continue;
    }

    if (node.value && typeof node.value === "string") {
      const targetUrl = node.value;

      if (!urlOccurrences[targetUrl]) urlOccurrences[targetUrl] = [];
      urlOccurrences[targetUrl].push(key);

      const crawlTrace = crawledPages.find((p) => p.url === targetUrl);
      if (crawlTrace) {
        if (crawlTrace.status === 200) {
          node.confidence = "VERIFIED";
          node.reason = null;
        } else if (crawlTrace.status === 301 || crawlTrace.status === 302) {
          node.confidence = "INFERRED";
          node.reason = `HTTP ${crawlTrace.status} redirect — final destination not verified`;
        } else if (crawlTrace.status >= 400) {
          node.value = null;
          node.confidence = "MISSING";
          node.source = null;
          node.reason = MISSING_REASONS.DEAD_LINK;
        }
      } else if (node.confidence !== "VERIFIED") {
        node.reason = node.reason || "URL matched by pattern but page was not fetched during crawl";
      }
    } else if (!node.value && !node.reason) {
      node.reason = MISSING_REASONS.NO_MATCHING_LINK;
    }
  }

  for (const [targetUrl, keys] of Object.entries(urlOccurrences)) {
    if (keys.length > 1) {
      const originalKey = keys[0];
      for (let i = 1; i < keys.length; i++) {
        if (deploy[keys[i]]) deploy[keys[i]].duplicateOf = originalKey;
      }
    }
  }

  if (claims?.approvedClaims?.value && Array.isArray(claims.approvedClaims.value) && claims.claimsNeedingProof) {
    if (!Array.isArray(claims.claimsNeedingProof.value)) {
      claims.claimsNeedingProof.value = [];
    }
    const vettedApproved = [];
    for (const claimObj of claims.approvedClaims.value) {
      const containsSuperlative = /largest|best|most|only|#1|number\s+one|premier|top-rated|lowest|greatest/i.test(claimObj.claim);
      if (containsSuperlative) {
        claims.claimsNeedingProof.value.push(claimObj);
      } else {
        vettedApproved.push(claimObj);
      }
    }
    claims.approvedClaims.value = vettedApproved;
  }

  // Stronger verification for geo coordinates and service hours
  try {
    if (nap.lat && nap.lng) {
      const combined = { value: { lat: nap.lat.value, lng: nap.lng.value } };
      const verified = verifyGeoCoordinates(combined, crawledPages);
      if (verified && verified.confidence) {
        nap.lat.confidence = verified.confidence;
        nap.lng.confidence = verified.confidence;
        nap.lat.reason = verified.reason || null;
        nap.lng.reason = verified.reason || null;
      }
    }
  } catch (e) { /* don't let verification break the pipeline */ }

  try {
    if (nap.serviceHours) {
      const sh = verifyServiceHours(nap.serviceHours, crawledPages);
      nap.serviceHours.confidence = sh.confidence;
      nap.serviceHours.reason = sh.reason || null;
    }
    if (nap.salesHours) {
      const s2 = verifyServiceHours(nap.salesHours, crawledPages);
      nap.salesHours.confidence = s2.confidence;
      nap.salesHours.reason = s2.reason || null;
    }
  } catch (e) { /* ignore */ }

  return masterJson;
}
