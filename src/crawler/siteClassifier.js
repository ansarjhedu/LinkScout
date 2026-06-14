/**
 * Site Classifier
 * 
 * Detects website vertical (dealer, ecommerce, blog, etc.) before extraction.
 * Uses multi-signal scoring to avoid false positives.
 * 
 * Signals:
 * - Schema.org types
 * - URL patterns
 * - Navigation structure
 * - Page content keywords
 * - Meta tags and headings
 */

import { AuditTrail, ERROR_CODES, safeGet } from '../utils/errorHandler.js';
import { CONFIDENCE_LEVELS, EVIDENCE_TYPES, buildField } from '../utils/fieldBuilder.js';
import parseHtml from '../utils/domParser.js';

export const SITE_VERTICALS = {
  DEALER: 'dealer',
  ECOMMERCE: 'ecommerce',
  CONTENT: 'content',
  SAAS: 'saas',
  MEDIA: 'media',
  RESTAURANT: 'restaurant',
  BLOG: 'blog',
  UNKNOWN: 'unknown',
};

// Vertical detection rules
const VERTICAL_RULES = {
  [SITE_VERTICALS.DEALER]: {
    schemaTypes: ['LocalBusiness', 'Dealer'],
    keywords: ['inventory', 'trade-in', 'finance', 'service', 'parts', 'vehicle', 'motorcycle', 'atv', 'powersports'],
    urlPatterns: [/inventory|trade|finance|parts|service|pre-owned|new-vehicle/i],
    navKeywords: ['new inventory', 'used inventory', 'service', 'parts', 'finance'],
    minScore: 0.6,
  },
  [SITE_VERTICALS.ECOMMERCE]: {
    schemaTypes: ['Product', 'Collection', 'ShoppingCart', 'BreadcrumbList'],
    keywords: ['product', 'price', 'add to cart', 'checkout', 'shop', 'category', 'collection'],
    urlPatterns: [/\/shop\/|\/products?\/|\/cart|\/checkout|\/collection|\/categor/i],
    navKeywords: ['shop', 'products', 'categories', 'cart', 'checkout'],
    minScore: 0.6,
  },
  [SITE_VERTICALS.BLOG]: {
    schemaTypes: ['BlogPosting', 'Article', 'NewsArticle'],
    keywords: ['article', 'post', 'author', 'published', 'category', 'tags', 'comment'],
    urlPatterns: [/\/blog\/|\/posts?\/|\/article|\/news|\.md|archive/i],
    navKeywords: ['blog', 'articles', 'news', 'categories', 'tags'],
    minScore: 0.5,
  },
  [SITE_VERTICALS.SAAS]: {
    schemaTypes: ['SoftwareApplication'],
    keywords: ['pricing', 'features', 'dashboard', 'subscription', 'api', 'documentation', 'trial', 'plan'],
    urlPatterns: [/\/pricing|\/features|\/docs|\/api|\/dashboard|\/sign-up|\/trial/i],
    navKeywords: ['pricing', 'features', 'documentation', 'pricing', 'contact'],
    minScore: 0.6,
  },
  [SITE_VERTICALS.MEDIA]: {
    schemaTypes: ['NewsArticle', 'VideoObject'],
    keywords: ['video', 'media', 'broadcast', 'episode', 'channel', 'watch', 'stream'],
    urlPatterns: [/\/video|\/watch|\/episode|\/stream|\/channel/i],
    navKeywords: ['videos', 'channels', 'episodes', 'browse'],
    minScore: 0.6,
  },
  [SITE_VERTICALS.RESTAURANT]: {
    schemaTypes: ['Restaurant', 'FoodService'],
    keywords: ['menu', 'reservation', 'order', 'delivery', 'cuisine', 'dining', 'restaurant'],
    urlPatterns: [/\/menu|\/order|\/reserv|\/delivery|\/dine/i],
    navKeywords: ['menu', 'reservations', 'order', 'delivery', 'contact'],
    minScore: 0.6,
  },
};

/**
 * Score a single vertical based on evidence
 */
function scoreVertical(vertical, signals) {
  const rules = VERTICAL_RULES[vertical];
  if (!rules) return 0;

  let score = 0;
  let maxPossible = 0;

  // Schema type match (weight: 3)
  if (signals.schemaTypes && signals.schemaTypes.length > 0) {
    maxPossible += 3;
    const matches = signals.schemaTypes.filter((t) =>
      rules.schemaTypes.some((rt) => t.toLowerCase().includes(rt.toLowerCase()))
    );
    score += (matches.length / signals.schemaTypes.length) * 3;
  }

  // URL pattern match (weight: 2)
  if (signals.urlPatterns && signals.urlPatterns.length > 0) {
    maxPossible += 2;
    const matches = signals.urlPatterns.filter((u) =>
      rules.urlPatterns.some((p) => p.test(u))
    );
    score += (matches.length / signals.urlPatterns.length) * 2;
  }

  // Keyword match (weight: 2)
  if (signals.pageText) {
    maxPossible += 2;
    const keywordMatches = rules.keywords.filter((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(signals.pageText)
    );
    const keywordScore = Math.min(keywordMatches.length / 3, 1) * 2;
    score += keywordScore;
  }

  // Navigation keyword match (weight: 2)
  if (signals.navText) {
    maxPossible += 2;
    const navMatches = rules.navKeywords.filter((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(signals.navText)
    );
    const navScore = Math.min(navMatches.length / 2, 1) * 2;
    score += navScore;
  }

  // Meta description/title (weight: 1)
  if (signals.metaDescription) {
    maxPossible += 1;
    const metaMatches = rules.keywords.filter((k) =>
      new RegExp(`\\b${k}\\b`, 'i').test(signals.metaDescription)
    );
    if (metaMatches.length > 0) score += 1;
  }

  return maxPossible > 0 ? score / maxPossible : 0;
}

/**
 * Extract signals from crawled pages
 */
function extractSignals(pages, audit) {
  const signals = {
    schemaTypes: [],
    urlPatterns: [],
    pageText: '',
    navText: '',
    metaDescription: '',
    sourceUrls: [],
  };

  if (!Array.isArray(pages) || pages.length === 0) {
    audit.logWarn('No pages provided for classification');
    return signals;
  }

  try {
    for (const page of pages) {
      if (!page || !page.html) continue;

      const helper = parseHtml(page.html);

      // Extract schema types
      try {
        const schemas = helper.jsonLd() || [];
        for (const schema of schemas) {
          if (schema['@type']) {
            const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
            signals.schemaTypes.push(...types);
          }
        }
      } catch (err) {
        audit.logWarn(`Schema parsing failed on ${page.url}`, { error: err.message });
      }

      // Extract URL patterns
      try {
        const path = new URL(page.url).pathname;
        signals.urlPatterns.push(path);
      } catch {
        audit.logWarn(`Invalid URL: ${page.url}`);
      }

      // Extract page text (only for home page to save memory)
      if (page.type === 'home' && !signals.pageText) {
        try {
          signals.pageText = helper.text('body') || '';
          signals.pageText = signals.pageText.slice(0, 20000);
        } catch {
          // Ignore text extraction errors
        }
      }

      // Extract nav text
      if (page.type === 'home' && !signals.navText) {
        try {
          const navText = helper.text('nav') || '';
          const headerText = helper.text('header') || '';
          signals.navText = (navText + ' ' + headerText).slice(0, 5000);
        } catch {
          // Ignore nav extraction errors
        }
      }

      // Extract meta description
      if (page.type === 'home' && !signals.metaDescription) {
        try {
          signals.metaDescription = helper.attr('meta[name="description"]', 'content') || '';
        } catch {
          // Ignore meta extraction errors
        }
      }

      signals.sourceUrls.push(page.url);
    }

    // Remove duplicates
    signals.schemaTypes = [...new Set(signals.schemaTypes)];
    signals.urlPatterns = [...new Set(signals.urlPatterns)];
  } catch (err) {
    audit.logWarn(`Signal extraction failed: ${err.message}`);
  }

  return signals;
}

/**
 * Main classifier function
 */
export default function classifySite(pages, audit = null) {
  if (!audit) audit = new AuditTrail();

  audit.logInfo('Starting site classification');

  const signals = extractSignals(pages, audit);
  audit.logEvent('signals_extracted', { schemaTypes: signals.schemaTypes });

  // Score all verticals
  const scores = {};
  for (const vertical of Object.values(SITE_VERTICALS)) {
    if (vertical === SITE_VERTICALS.UNKNOWN) continue;
    scores[vertical] = scoreVertical(vertical, signals);
  }

  // Find top candidates
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topVertical = sorted[0][0];
  const topScore = sorted[0][1];
  const secondScore = sorted[1]?.[1] || 0;

  audit.logEvent('classification_complete', {
    topVertical,
    topScore,
    secondScore,
    allScores: scores,
  });

  // Detect ambiguity
  const ambiguityThreshold = 0.2;
  const isAmbiguous = Math.abs(topScore - secondScore) < ambiguityThreshold;

  if (isAmbiguous) {
    audit.logWarn(`Site classification ambiguous: ${topVertical} (${topScore.toFixed(2)}) vs ${sorted[1][0]} (${secondScore.toFixed(2)})`);
  }

  // Determine confidence
  let confidence = CONFIDENCE_LEVELS.VERIFIED;
  if (topScore < 0.6) {
    confidence = CONFIDENCE_LEVELS.INFERRED;
  }
  if (isAmbiguous) {
    confidence = CONFIDENCE_LEVELS.INFERRED;
  }

  return buildField(
    topVertical,
    confidence,
    signals.sourceUrls[0] || null,
    null,
    EVIDENCE_TYPES.INFERRED_CONTEXTUAL,
    {
      allScores: scores,
      topScore: topScore.toFixed(2),
      isAmbiguous,
      signals: {
        schemaTypes: signals.schemaTypes.slice(0, 5),
        urlPatterns: signals.urlPatterns.slice(0, 3),
      },
    }
  );
}

/**
 * Check if site is supported for detailed extraction
 */
export function isSiteSupported(vertical) {
  return Object.values(SITE_VERTICALS).includes(vertical) && vertical !== SITE_VERTICALS.UNKNOWN;
}

/**
 * Get applicable fields for a vertical
 */
export function getApplicableFields(vertical) {
  const applicableFields = {
    [SITE_VERTICALS.DEALER]: [
      'dealershipName', 'address', 'phone', 'hours', 'brands', 'inventory', 'finance', 'service', 'parts'
    ],
    [SITE_VERTICALS.ECOMMERCE]: [
      'businessName', 'products', 'categories', 'pricing', 'contact', 'shipping'
    ],
    [SITE_VERTICALS.BLOG]: [
      'siteTitle', 'author', 'categories', 'posts', 'socialLinks', 'contact'
    ],
    [SITE_VERTICALS.SAAS]: [
      'productName', 'features', 'pricing', 'documentation', 'trial', 'contact'
    ],
  };

  return applicableFields[vertical] || [];
}
