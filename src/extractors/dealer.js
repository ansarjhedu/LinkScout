/**
 * Dealer Intelligence Extractor Orchestrator
 * 
 * Coordinates extraction of all dealership fields using:
 * - Structured data (highest priority)
 * - Individual module extractors (nap, finance, inventory, service, parts, etc.)
 * - Field priority merging
 * - Comprehensive audit trail
 */

import extractStructuredData, { getBestOrganization } from './structuredData.js';
import extractNap from './nap.js';
import extractFinance from './finance.js';
import extractInventory from './inventory.js';
import extractService from './service.js';
import extractParts from './parts.js';
import extractBrands from './brands.js';
import extractGeo from './geo.js';
import extractUrls from './urls.js';

import { mergeFields, buildField, CONFIDENCE_LEVELS, EVIDENCE_TYPES, buildMissingField, MISSING_REASONS } from '../utils/fieldBuilder.js';
import { AuditTrail, safeExtract } from '../utils/errorHandler.js';

export default function extractDealerIntelligence(pages, structuredData, audit = null) {
  if (!audit) audit = new AuditTrail();
  if (!Array.isArray(pages)) pages = [];

  audit.logInfo('Starting dealer intelligence extraction');

  // ========== PHASE 1: Extract from Structured Data ==========
  audit.logInfo('Extracting from structured data');

  const structuredOrg = getBestOrganization(structuredData);
  const structuredFields = structuredOrg ? {
    // NAP Data
    name: structuredOrg.name,
    legalName: structuredOrg.legalName,
    phone: structuredOrg.phone,
    email: structuredOrg.email,
    address: structuredOrg.address,
    website: structuredOrg.url,
  } : {};

  // ========== PHASE 2: Extract NAP (Name, Address, Phone) ==========
  audit.logInfo('Extracting NAP data');
  let napResult = {};
  try {
    napResult = safeExtract(
      'extractNap',
      () => extractNap(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`NAP extraction failed: ${err.message}`);
  }

  // ========== PHASE 3: Extract Dealership Metadata ==========
  const dealerName = mergeFields([
    structuredFields.name,
    napResult.dealershipName,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const legalName = mergeFields([
    structuredFields.legalName,
    napResult.legalName,
  ]) || buildMissingField(MISSING_REASONS.NOT_IN_SCHEMA);

  const phone = mergeFields([
    structuredFields.phone,
    napResult.phone,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const email = structuredFields.email || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const address = mergeFields([
    structuredFields.address,
    napResult.address,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  const website = mergeFields([
    structuredFields.website,
    napResult.website,
  ]) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  // ========== PHASE 4: Extract Finance Data ==========
  audit.logInfo('Extracting finance information');
  let financeResult = {};
  try {
    financeResult = safeExtract(
      'extractFinance',
      () => extractFinance(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`Finance extraction failed: ${err.message}`);
  }

  const financeOffered = financeResult.financeOffered || buildField(
    false,
    CONFIDENCE_LEVELS.INFERRED,
    null,
    null,
    EVIDENCE_TYPES.PAGE_TEXT
  );

  const lenders = financeResult.lenders || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
  const creditPrograms = financeResult.creditPrograms || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);

  // ========== PHASE 5: Extract Inventory Data ==========
  audit.logInfo('Extracting inventory information');
  let inventoryResult = {};
  try {
    inventoryResult = safeExtract(
      'extractInventory',
      () => extractInventory(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`Inventory extraction failed: ${err.message}`);
  }

  const inventoryNew = inventoryResult.inventoryNew || buildField(
    null,
    CONFIDENCE_LEVELS.MISSING,
    null,
    MISSING_REASONS.NOT_ON_WEBSITE
  );

  const inventoryUsed = inventoryResult.inventoryUsed || buildField(
    null,
    CONFIDENCE_LEVELS.MISSING,
    null,
    MISSING_REASONS.NOT_ON_WEBSITE
  );

  const tradeInOffered = inventoryResult.tradeInOffered || buildField(
    false,
    CONFIDENCE_LEVELS.INFERRED
  );

  // ========== PHASE 6: Extract Service Data ==========
  audit.logInfo('Extracting service information');
  let serviceResult = {};
  try {
    serviceResult = safeExtract(
      'extractService',
      () => extractService(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`Service extraction failed: ${err.message}`);
  }

  const serviceOffered = serviceResult.serviceOffered || buildField(
    false,
    CONFIDENCE_LEVELS.INFERRED
  );

  const serviceDepartment = serviceResult.serviceDepartment || buildMissingField();

  // ========== PHASE 7: Extract Parts Data ==========
  audit.logInfo('Extracting parts information');
  let partsResult = {};
  try {
    partsResult = safeExtract(
      'extractParts',
      () => extractParts(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`Parts extraction failed: ${err.message}`);
  }

  const partsOffered = partsResult.partsOffered || buildField(
    false,
    CONFIDENCE_LEVELS.INFERRED
  );

  const partsDepartment = partsResult.partsDepartment || buildMissingField();

  // ========== PHASE 8: Extract Brands ==========
  audit.logInfo('Extracting brand information');
  let brandsResult = {};
  try {
    brandsResult = safeExtract(
      'extractBrands',
      () => extractBrands(pages),
      audit,
      {}
    );
  } catch (err) {
    audit.logWarn(`Brands extraction failed: ${err.message}`);
  }

  const brands = brandsResult.brands || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
  const authorityRole = brandsResult.authorityRole || buildMissingField();

  // ========== PHASE 9: Extract Geographic/Social Data ==========
  audit.logInfo('Extracting geographic and social data');
  let geoResult = {};
  let urlsResult = {};
  try {
    geoResult = safeExtract('extractGeo', () => extractGeo(pages, structuredData), audit, {});
    urlsResult = safeExtract('extractUrls', () => extractUrls(pages), audit, {});
  } catch (err) {
    audit.logWarn(`Geo/URL extraction failed: ${err.message}`);
  }

  const coordinates = geoResult.coordinates || buildMissingField();
  const socialLinks = geoResult.socialLinks || buildMissingField();

  const homepageUrl = urlsResult.homepage || buildMissingField();
  const aboutUrl = urlsResult.about || buildMissingField();
  const contactUrl = urlsResult.contact || buildMissingField();

  // ========== FINALIZE RESULT ==========
  audit.logEvent('dealer_extraction_complete', {
    fieldsExtracted: 25,
    structuredDataUsed: structuredData?.foundSchema || false,
  });

  return {
    // Core NAP
    dealershipName,
    legalName,
    phone,
    email,
    address,
    website,

    // Finance
    financeOffered,
    lenders,
    creditPrograms,

    // Inventory
    inventoryNew,
    inventoryUsed,
    tradeInOffered,

    // Service & Parts
    serviceOffered,
    serviceDepartment,
    partsOffered,
    partsDepartment,

    // Brands & Authority
    brands,
    authorityRole,

    // Geographic & Social
    coordinates,
    socialLinks,

    // Key URLs
    homepageUrl,
    aboutUrl,
    contactUrl,

    // Metadata
    status: 'dealer_extraction_complete',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract dealer fields that were previously in individual modules
 * This is called by orchestrator to coordinate all extraction
 */
export async function orchestrateDealerExtraction(pages, audit = null) {
  if (!audit) audit = new AuditTrail();

  // Extract structured data first
  const structuredData = extractStructuredData(pages, audit);

  // Extract dealer-specific intelligence
  const dealerData = extractDealerIntelligence(pages, structuredData, audit);

  return {
    data: dealerData,
    audit: audit.toJSON(),
  };
}
