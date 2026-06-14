/**
 * Generic Intelligence Extractor
 * 
 * Fallback for non-specialist sites (UNKNOWN vertical or minimal content).
 * Extracts only basic, non-vertical-specific metadata:
 * - Site name/title
 * - Contact info
 * - Social links
 * - Basic categories/sections
 * 
 * NEVER claims: inventory, finance, parts, service, products
 * (unless explicitly in schema.org)
 */

import { buildField, mergeFields, CONFIDENCE_LEVELS, EVIDENCE_TYPES, MISSING_REASONS, buildMissingField } from '../utils/fieldBuilder.js';
import parseHtml from '../utils/domParser.js';
import { safeExtract, safeGet, AuditTrail } from '../utils/errorHandler.js';

export default function extractGenericIntelligence(pages, structuredData, audit = null) {
  if (!audit) audit = new AuditTrail();
  if (!Array.isArray(pages)) pages = [];

  audit.logInfo('Starting generic intelligence extraction');

  const result = {
    // Basic metadata
    siteName: extractSiteName(pages, structuredData, audit),
    siteTitle: extractSiteTitle(pages, structuredData, audit),
    siteDescription: extractSiteDescription(pages, structuredData, audit),

    // Contact
    contactEmail: extractContactEmail(pages, structuredData, audit),
    contactPhone: extractContactPhone(pages, structuredData, audit),
    contactForm: extractContactForm(pages, structuredData, audit),

    // Social
    socialLinks: extractSocialLinks(pages, structuredData, audit),
    socialMediaHandles: extractSocialMediaHandles(pages, structuredData, audit),

    // Navigation
    mainCategories: extractMainCategories(pages, structuredData, audit),

    // Note: NO vertical-specific fields extracted
    status: 'generic_extraction_only',
  };

  audit.logEvent('generic_extraction_complete', { fieldsExtracted: Object.keys(result).length });

  return result;
}

/**
 * Extract site name/business name
 */
function extractSiteName(pages, structuredData, audit) {
  const fields = [];

  // Try schema first (highest confidence)
  if (structuredData?.organizations?.[0]?.name?.value) {
    fields.push(buildField(
      structuredData.organizations[0].name.value,
      CONFIDENCE_LEVELS.VERIFIED,
      null,
      null,
      EVIDENCE_TYPES.SCHEMA,
      { source: 'Organization schema' }
    ));
  }

  // Try page title
  if (pages.length > 0 && pages[0].html) {
    try {
      const helper = parseHtml(pages[0].html);
      const title = helper.text('title') || helper.attr('meta[property="og:site_name"]', 'content');
      if (title && title.length > 3) {
        fields.push(buildField(
          title,
          CONFIDENCE_LEVELS.INFERRED,
          pages[0].url,
          null,
          EVIDENCE_TYPES.PAGE_TEXT,
          { source: 'title or og:site_name' }
        ));
      }
    } catch (err) {
      audit.logWarn(`Failed to extract site name from title: ${err.message}`);
    }
  }

  return mergeFields(fields) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
}

/**
 * Extract page title
 */
function extractSiteTitle(pages, structuredData, audit) {
  if (!pages.length || !pages[0].html) {
    return buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
  }

  try {
    const helper = parseHtml(pages[0].html);
    const title = helper.text('title');
    if (title) {
      return buildField(title, CONFIDENCE_LEVELS.INFERRED, pages[0].url, null, EVIDENCE_TYPES.PAGE_TEXT);
    }
  } catch (err) {
    audit.logWarn(`Title extraction failed: ${err.message}`);
  }

  return buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
}

/**
 * Extract meta description
 */
function extractSiteDescription(pages, structuredData, audit) {
  const fields = [];

  // Schema description
  if (structuredData?.organizations?.[0]?.description?.value) {
    fields.push(buildField(
      structuredData.organizations[0].description.value,
      CONFIDENCE_LEVELS.VERIFIED,
      null,
      null,
      EVIDENCE_TYPES.SCHEMA
    ));
  }

  // Meta description
  if (pages.length > 0 && pages[0].html) {
    try {
      const helper = parseHtml(pages[0].html);
      const desc = helper.attr('meta[name="description"]', 'content') ||
        helper.attr('meta[property="og:description"]', 'content');
      if (desc) {
        fields.push(buildField(
          desc,
          CONFIDENCE_LEVELS.INFERRED,
          pages[0].url,
          null,
          EVIDENCE_TYPES.EXPLICIT_TAG
        ));
      }
    } catch (err) {
      audit.logWarn(`Description extraction failed: ${err.message}`);
    }
  }

  return mergeFields(fields) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
}

/**
 * Extract contact email
 */
function extractContactEmail(pages, structuredData, audit) {
  const fields = [];

  // Schema email
  if (structuredData?.organizations?.[0]?.email?.value) {
    fields.push(buildField(
      structuredData.organizations[0].email.value,
      CONFIDENCE_LEVELS.VERIFIED,
      null,
      null,
      EVIDENCE_TYPES.SCHEMA
    ));
  }

  // Regex match from pages
  if (pages.length > 0) {
    try {
      const allText = pages.map((p) => p.html || '').join(' ');
      const match = allText.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (match) {
        fields.push(buildField(
          match[0],
          CONFIDENCE_LEVELS.INFERRED,
          pages[0].url,
          null,
          EVIDENCE_TYPES.PAGE_TEXT,
          { method: 'regex' }
        ));
      }
    } catch (err) {
      audit.logWarn(`Email extraction failed: ${err.message}`);
    }
  }

  return mergeFields(fields) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
}

/**
 * Extract contact phone
 */
function extractContactPhone(pages, structuredData, audit) {
  const fields = [];

  // Schema phone
  if (structuredData?.organizations?.[0]?.phone?.value) {
    fields.push(buildField(
      structuredData.organizations[0].phone.value,
      CONFIDENCE_LEVELS.VERIFIED,
      null,
      null,
      EVIDENCE_TYPES.SCHEMA
    ));
  }

  // Regex match
  if (pages.length > 0) {
    try {
      const allText = pages.map((p) => p.html || '').join(' ');
      const match = allText.match(/(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
      if (match) {
        fields.push(buildField(
          match[0],
          CONFIDENCE_LEVELS.INFERRED,
          pages[0].url,
          null,
          EVIDENCE_TYPES.PAGE_TEXT,
          { method: 'regex' }
        ));
      }
    } catch (err) {
      audit.logWarn(`Phone extraction failed: ${err.message}`);
    }
  }

  return mergeFields(fields) || buildMissingField(MISSING_REASONS.NOT_ON_WEBSITE);
}

/**
 * Detect if contact form exists
 */
function extractContactForm(pages, structuredData, audit) {
  for (const page of pages) {
    if (!page.html) continue;
    try {
      const helper = parseHtml(page.html);
      if (helper.find('form').length > 0) {
        return buildField(
          true,
          CONFIDENCE_LEVELS.VERIFIED,
          page.url,
          null,
          EVIDENCE_TYPES.EXPLICIT_TAG,
          { hasForm: true }
        );
      }
    } catch {
      continue;
    }
  }

  return buildField(
    false,
    CONFIDENCE_LEVELS.INFERRED,
    pages[0]?.url,
    null,
    EVIDENCE_TYPES.PAGE_TEXT,
    { searched: true }
  );
}

/**
 * Extract social media links
 */
function extractSocialLinks(pages, structuredData, audit) {
  const socialUrls = new Set();
  const socialPatterns = [
    /https?:\/\/(www\.)?facebook\.com\//i,
    /https?:\/\/(www\.)?twitter\.com\//i,
    /https?:\/\/(www\.)?instagram\.com\//i,
    /https?:\/\/(www\.)?linkedin\.com\//i,
    /https?:\/\/(www\.)?youtube\.com\//i,
  ];

  for (const page of pages) {
    if (!page.html) continue;
    try {
      const helper = parseHtml(page.html);
      const links = helper.find('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        for (const pattern of socialPatterns) {
          if (pattern.test(href)) {
            socialUrls.add(href);
          }
        }
      }
    } catch {
      continue;
    }
  }

  if (socialUrls.size === 0) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING, pages[0]?.url);
  }

  return buildField(
    Array.from(socialUrls).slice(0, 10),
    CONFIDENCE_LEVELS.INFERRED,
    pages[0]?.url,
    null,
    EVIDENCE_TYPES.EXPLICIT_TAG,
    { count: socialUrls.size }
  );
}

/**
 * Extract social media handles from links
 */
function extractSocialMediaHandles(pages, structuredData, audit) {
  const handles = {};

  const patterns = {
    twitter: /twitter\.com\/(@?\w+)/i,
    instagram: /instagram\.com\/(@?\w+)/i,
    facebook: /facebook\.com\/([.\w]+)/i,
  };

  for (const page of pages) {
    if (!page.html) continue;
    try {
      const helper = parseHtml(page.html);
      const allText = helper.text('body');

      for (const [platform, pattern] of Object.entries(patterns)) {
        const match = allText.match(pattern);
        if (match && match[1]) {
          handles[platform] = match[1].replace(/^@/, '');
        }
      }
    } catch {
      continue;
    }
  }

  if (Object.keys(handles).length === 0) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING);
  }

  return buildField(handles, CONFIDENCE_LEVELS.INFERRED, pages[0]?.url);
}

/**
 * Extract main navigation categories
 */
function extractMainCategories(pages, structuredData, audit) {
  const categories = new Set();

  if (!pages.length || !pages[0].html) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING);
  }

  try {
    const helper = parseHtml(pages[0].html);
    const navLinks = helper.find('nav a, header a');

    for (const link of navLinks) {
      const text = link.textContent?.trim();
      if (text && text.length > 2 && text.length < 50) {
        categories.add(text);
      }
    }
  } catch (err) {
    audit.logWarn(`Category extraction failed: ${err.message}`);
  }

  if (categories.size === 0) {
    return buildField(null, CONFIDENCE_LEVELS.MISSING, pages[0]?.url);
  }

  return buildField(
    Array.from(categories).slice(0, 20),
    CONFIDENCE_LEVELS.INFERRED,
    pages[0]?.url,
    null,
    EVIDENCE_TYPES.EXPLICIT_TAG
  );
}
