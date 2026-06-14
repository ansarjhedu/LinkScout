/**
 * Structured Data Extractor
 * 
 * Parses JSON-LD, Microdata, and RDFa from pages.
 * This is the HIGHEST confidence data source.
 * 
 * Maps schema.org types to our field schema.
 */

import parseHtml from '../utils/domParser.js';
import { buildField, fieldFromSchema, EVIDENCE_TYPES, CONFIDENCE_LEVELS } from '../utils/fieldBuilder.js';
import { safeExtract, safeGet, AuditTrail, ERROR_CODES } from '../utils/errorHandler.js';

/**
 * Extract all JSON-LD blocks from HTML
 */
function extractJsonLd(html) {
  const blocks = [];
  try {
    const matches = html.match(/<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi);
    if (!matches) return blocks;

    for (const match of matches) {
      try {
        const jsonStr = match.replace(/<[^>]*>/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        blocks.push(parsed);
      } catch (err) {
        // Skip malformed JSON-LD blocks
        continue;
      }
    }
  } catch (err) {
    // Ignore HTML parsing errors
  }
  return blocks;
}

/**
 * Extract microdata from HTML
 */
function extractMicrodata(html) {
  const blocks = [];
  try {
    const helper = parseHtml(html);
    const items = helper.doc.querySelectorAll('[itemscope]');

    for (const item of items) {
      try {
        const obj = {
          '@type': item.getAttribute('itemtype') || 'Unknown',
          '@context': 'https://schema.org',
        };

        const props = item.querySelectorAll('[itemprop]');
        for (const prop of props) {
          const key = prop.getAttribute('itemprop');
          const value = prop.getAttribute('content') || prop.textContent;
          obj[key] = value;
        }

        blocks.push(obj);
      } catch {
        continue;
      }
    }
  } catch (err) {
    // Ignore microdata parsing errors
  }
  return blocks;
}

/**
 * Normalize schema types (handle arrays and strings)
 */
function normalizeSchemaType(schemaObj) {
  if (!schemaObj) return [];

  const types = schemaObj['@type'] || [];
  return Array.isArray(types) ? types : [types];
}

/**
 * Check if schema matches a target type
 */
function schemaMatches(schema, targetType) {
  if (!schema || !targetType) return false;

  const schemaTypes = normalizeSchemaType(schema);
  return schemaTypes.some((t) => t && t.toLowerCase().includes(targetType.toLowerCase()));
}

/**
 * Find first schema of matching type
 */
function findSchema(schemas, targetType) {
  if (!Array.isArray(schemas)) return null;

  for (const schema of schemas) {
    if (schemaMatches(schema, targetType)) {
      return schema;
    }
  }

  return null;
}

/**
 * Extract organization/business data from schema
 */
function extractOrganizationSchema(schema, source) {
  if (!schema) {
    return {
      name: buildField(null, CONFIDENCE_LEVELS.MISSING),
      address: buildField(null, CONFIDENCE_LEVELS.MISSING),
      phone: buildField(null, CONFIDENCE_LEVELS.MISSING),
      email: buildField(null, CONFIDENCE_LEVELS.MISSING),
      url: buildField(null, CONFIDENCE_LEVELS.MISSING),
      logo: buildField(null, CONFIDENCE_LEVELS.MISSING),
    };
  }

  return {
    name: fieldFromSchema(schema, 'name', source),
    address: extractAddressSchema(schema.address, source),
    phone: fieldFromSchema(schema, 'telephone', source),
    email: fieldFromSchema(schema, 'email', source),
    url: fieldFromSchema(schema, 'url', source),
    logo: fieldFromSchema(schema, 'logo', source),
    legalName: fieldFromSchema(schema, 'legalName', source),
    alternateName: fieldFromSchema(schema, 'alternateName', source),
  };
}

/**
 * Extract address from schema
 */
function extractAddressSchema(address, source) {
  if (!address) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING, source);
  }

  if (typeof address === 'string') {
    return buildField(address, CONFIDENCE_LEVELS.VERIFIED, source, null, EVIDENCE_TYPES.SCHEMA);
  }

  if (typeof address === 'object') {
    const parts = [];
    const street = safeGet(address, 'streetAddress');
    const city = safeGet(address, 'addressLocality');
    const state = safeGet(address, 'addressRegion');
    const zip = safeGet(address, 'postalCode');

    if (street) parts.push(street);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (zip) parts.push(zip);

    const formatted = parts.join(', ');
    if (formatted) {
      return buildField(formatted, CONFIDENCE_LEVELS.VERIFIED, source, null, EVIDENCE_TYPES.SCHEMA, {
        street,
        city,
        state,
        zip,
      });
    }
  }

  return buildField(null, CONFIDENCE_LEVELS.MISSING, source);
}

/**
 * Extract product data from schema
 */
function extractProductSchema(schema, source) {
  if (!schema) {
    return {
      name: buildField(null, CONFIDENCE_LEVELS.MISSING),
      price: buildField(null, CONFIDENCE_LEVELS.MISSING),
      description: buildField(null, CONFIDENCE_LEVELS.MISSING),
      url: buildField(null, CONFIDENCE_LEVELS.MISSING),
    };
  }

  const offer = safeGet(schema, 'offers[0]');
  const price = offer ? safeGet(offer, 'price') : null;

  return {
    name: fieldFromSchema(schema, 'name', source),
    price: buildField(price, price ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.MISSING, source, null, EVIDENCE_TYPES.SCHEMA),
    description: fieldFromSchema(schema, 'description', source),
    url: fieldFromSchema(schema, 'url', source),
    image: fieldFromSchema(schema, 'image', source),
    availability: fieldFromSchema(schema, 'offers[0].availability', source),
  };
}

/**
 * Extract article/content data from schema
 */
function extractArticleSchema(schema, source) {
  if (!schema) {
    return {
      headline: buildField(null, CONFIDENCE_LEVELS.MISSING),
      author: buildField(null, CONFIDENCE_LEVELS.MISSING),
      datePublished: buildField(null, CONFIDENCE_LEVELS.MISSING),
      dateModified: buildField(null, CONFIDENCE_LEVELS.MISSING),
      description: buildField(null, CONFIDENCE_LEVELS.MISSING),
    };
  }

  const author = safeGet(schema, 'author[0].name') || safeGet(schema, 'author');

  return {
    headline: fieldFromSchema(schema, 'headline', source),
    author: buildField(author, author ? CONFIDENCE_LEVELS.VERIFIED : CONFIDENCE_LEVELS.MISSING, source, null, EVIDENCE_TYPES.SCHEMA),
    datePublished: fieldFromSchema(schema, 'datePublished', source),
    dateModified: fieldFromSchema(schema, 'dateModified', source),
    description: fieldFromSchema(schema, 'description', source),
    image: fieldFromSchema(schema, 'image', source),
  };
}

/**
 * Main structured data extraction
 */
export default function extractStructuredData(pages, audit = null) {
  if (!audit) audit = new AuditTrail();

  if (!Array.isArray(pages) || pages.length === 0) {
    audit.logWarn('No pages provided for structured data extraction');
    return {
      foundSchema: false,
      organizations: [],
      products: [],
      articles: [],
      schemas: [],
      audit,
    };
  }

  const allSchemas = [];
  const organizations = [];
  const products = [];
  const articles = [];

  for (const page of pages) {
    if (!page || !page.html) continue;

    try {
      // Extract JSON-LD
      const jsonLd = safeExtract(
        'extractJsonLd',
        () => extractJsonLd(page.html),
        audit,
        []
      );
      allSchemas.push(...jsonLd);

      // Extract Microdata
      const microdata = safeExtract(
        'extractMicrodata',
        () => extractMicrodata(page.html),
        audit,
        []
      );
      allSchemas.push(...microdata);

      // Find and process schemas
      for (const schema of allSchemas) {
        if (schemaMatches(schema, 'Organization') || schemaMatches(schema, 'LocalBusiness')) {
          const extracted = extractOrganizationSchema(schema, page.url);
          organizations.push(extracted);
        }

        if (schemaMatches(schema, 'Product')) {
          const extracted = extractProductSchema(schema, page.url);
          products.push(extracted);
        }

        if (
          schemaMatches(schema, 'Article') ||
          schemaMatches(schema, 'BlogPosting') ||
          schemaMatches(schema, 'NewsArticle')
        ) {
          const extracted = extractArticleSchema(schema, page.url);
          articles.push(extracted);
        }
      }

      audit.logEvent('structured_data_extracted', {
        pageUrl: page.url,
        schemaCount: allSchemas.length,
        organizations: organizations.length,
        products: products.length,
        articles: articles.length,
      });
    } catch (err) {
      audit.logError(
        ERROR_CODES.ERR_SCHEMA_PARSE_FAILED,
        `Schema extraction failed on ${page.url}: ${err.message}`,
        { pageUrl: page.url }
      );
    }
  }

  return {
    foundSchema: allSchemas.length > 0,
    organizations,
    products,
    articles,
    schemas: allSchemas.slice(0, 20), // Limit to avoid huge output
    audit,
  };
}

/**
 * Get best organization schema
 */
export function getBestOrganization(result) {
  if (!result.organizations || result.organizations.length === 0) {
    return null;
  }

  // Prefer verified fields
  return result.organizations.reduce((best, org) => {
    const verifiedCount = Object.values(org).filter(
      (f) => f && f.confidence === CONFIDENCE_LEVELS.VERIFIED
    ).length;

    const bestVerified = Object.values(best).filter(
      (f) => f && f.confidence === CONFIDENCE_LEVELS.VERIFIED
    ).length;

    return verifiedCount > bestVerified ? org : best;
  });
}

/**
 * Get best product schema
 */
export function getBestProduct(result) {
  if (!result.products || result.products.length === 0) {
    return null;
  }

  return result.products[0];
}
