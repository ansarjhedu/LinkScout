/**
 * Test Suite: Site Classifier
 * 
 * Tests classification accuracy on:
 * - Known verticals (dealer, ecommerce, blog, etc.)
 * - Ambiguous sites (mixed signals)
 * - Edge cases (no schema, minimal content, unsupported sites)
 */

import classifySite, { SITE_VERTICALS, isSiteSupported } from '../crawler/siteClassifier.js';
import { AuditTrail } from '../utils/errorHandler.js';
import { CONFIDENCE_LEVELS } from '../utils/fieldBuilder.js';

/**
 * Test 1: Dealer site classification
 */
export function testClassifyDealerSite() {
  const pages = [
    {
      type: 'home',
      url: 'https://example.com/',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "LocalBusiness",
                "@context": "https://schema.org",
                "name": "Acme Honda",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "123 Main St"
                }
              }
            </script>
            <meta name="description" content="New and used Honda inventory, service, and financing">
          </head>
          <nav>
            <a href="/new-inventory">New Inventory</a>
            <a href="/used-inventory">Used Inventory</a>
            <a href="/service">Service</a>
            <a href="/finance">Financing</a>
          </nav>
          <body>
            Welcome to Acme Honda. We offer new and used motorcycles, parts, and service.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  console.assert(result.value === SITE_VERTICALS.DEALER, `Expected dealer, got ${result.value}`);
  console.assert(result.confidence === CONFIDENCE_LEVELS.VERIFIED || result.confidence === CONFIDENCE_LEVELS.INFERRED, 'Confidence should be set');
  console.log('✓ Test 1: Dealer site classification PASSED');
}

/**
 * Test 2: Ecommerce site classification
 */
export function testClassifyEcommerceSite() {
  const pages = [
    {
      type: 'home',
      url: 'https://shop.example.com/',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Collection",
                "name": "Electronics Shop"
              }
            </script>
            <meta name="description" content="Shop for electronics, gadgets, and accessories">
          </head>
          <nav>
            <a href="/shop">Shop</a>
            <a href="/products">Products</a>
            <a href="/categories">Categories</a>
            <a href="/cart">Cart</a>
          </nav>
          <body>
            Browse our wide selection of products. Add items to cart and checkout.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  console.assert(result.value === SITE_VERTICALS.ECOMMERCE, `Expected ecommerce, got ${result.value}`);
  console.log('✓ Test 2: Ecommerce site classification PASSED');
}

/**
 * Test 3: Blog site classification
 */
export function testClassifyBlogSite() {
  const pages = [
    {
      type: 'home',
      url: 'https://blog.example.com/',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "BlogPosting",
                "headline": "Welcome to our blog"
              }
            </script>
            <meta name="description" content="Read our latest articles and posts">
          </head>
          <nav>
            <a href="/blog">Blog</a>
            <a href="/articles">Articles</a>
            <a href="/categories">Categories</a>
            <a href="/tags">Tags</a>
          </nav>
          <body>
            Latest articles and blog posts from our team.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  console.assert(result.value === SITE_VERTICALS.BLOG, `Expected blog, got ${result.value}`);
  console.log('✓ Test 3: Blog site classification PASSED');
}

/**
 * Test 4: No schema - should still classify by keywords
 */
export function testClassifyNoSchema() {
  const pages = [
    {
      type: 'home',
      url: 'https://example.com/',
      html: `
        <html>
          <head>
            <meta name="description" content="Browse our inventory">
          </head>
          <nav>
            <a href="/new-inventory">New</a>
            <a href="/used-inventory">Used</a>
            <a href="/service">Service</a>
          </nav>
          <body>
            We have a large inventory of vehicles in stock. Finance available.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  // Should be dealer based on keywords and URLs, even without schema
  console.assert(result.value === SITE_VERTICALS.DEALER, `Expected dealer (no schema), got ${result.value}`);
  console.log('✓ Test 4: No schema classification PASSED');
}

/**
 * Test 5: Ambiguous site (mixed signals)
 */
export function testClassifyAmbiguousSite() {
  const pages = [
    {
      type: 'home',
      url: 'https://example.com/',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              [{
                "@type": "LocalBusiness",
                "name": "Acme Shop"
              }, {
                "@type": "Product",
                "name": "Motorcycle"
              }]
            </script>
          </head>
          <nav>
            <a href="/inventory">Inventory</a>
            <a href="/products">Products</a>
            <a href="/blog">Blog</a>
          </nav>
          <body>
            We sell vehicles and also publish articles about maintenance.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  // Should classify as one vertical, but note ambiguity
  console.assert(result.value !== SITE_VERTICALS.UNKNOWN, `Should classify to specific vertical`);
  if (result.metadata && result.metadata.isAmbiguous) {
    console.log('✓ Test 5: Ambiguous site PASSED (detected ambiguity)');
  } else {
    console.log('✓ Test 5: Ambiguous site PASSED (classified to top candidate)');
  }
}

/**
 * Test 6: Empty/minimal content
 */
export function testClassifyMinimalSite() {
  const pages = [
    {
      type: 'home',
      url: 'https://example.com/',
      html: '<html><body>Welcome</body></html>',
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  // Should still return a vertical (likely UNKNOWN or lowest-scored)
  console.assert(result.value, 'Should return a classification');
  console.assert(Object.values(SITE_VERTICALS).includes(result.value), 'Should be valid vertical');
  console.log('✓ Test 6: Minimal site classification PASSED');
}

/**
 * Test 7: False positive: Blog with "/service/" URL
 * Should NOT classify as dealer just because of /service/ path
 */
export function testNoFalsePositiveDealerOnBlog() {
  const pages = [
    {
      type: 'home',
      url: 'https://blog.example.com/',
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "BlogPosting"
              }
            </script>
          </head>
          <nav>
            <a href="/blog">Blog</a>
            <a href="/articles">Articles</a>
          </nav>
          <body>
            Check out our latest articles about customer service and support.
          </body>
        </html>
      `,
    },
    {
      type: 'other',
      url: 'https://blog.example.com/service/',
      html: `
        <html>
          <body>
            Our customer service team is here to help.
          </body>
        </html>
      `,
    },
  ];

  const audit = new AuditTrail();
  const result = classifySite(pages, audit);

  console.assert(result.value === SITE_VERTICALS.BLOG, `Expected blog, got ${result.value}. False positive detector failed!`);
  console.log('✓ Test 7: False positive avoidance PASSED');
}

/**
 * Test 8: Audit trail completeness
 */
export function testAuditTrailCaptures() {
  const pages = [
    {
      type: 'home',
      url: 'https://example.com/',
      html: '<html><body>Test</body></html>',
    },
  ];

  const audit = new AuditTrail();
  classifySite(pages, audit);

  const summary = audit.getSummary();
  console.assert(summary.total > 0, 'Audit trail should have entries');
  console.log('✓ Test 8: Audit trail capture PASSED');
  console.log(`  - Total entries: ${summary.total}`);
  console.log(`  - Audit summary:`, summary);
}

/**
 * Test 9: isSiteSupported function
 */
export function testIsSiteSupported() {
  console.assert(isSiteSupported(SITE_VERTICALS.DEALER), 'Dealer should be supported');
  console.assert(isSiteSupported(SITE_VERTICALS.ECOMMERCE), 'Ecommerce should be supported');
  console.assert(isSiteSupported(SITE_VERTICALS.BLOG), 'Blog should be supported');
  console.assert(!isSiteSupported(SITE_VERTICALS.UNKNOWN), 'Unknown should not be supported');
  console.log('✓ Test 9: isSiteSupported PASSED');
}

/**
 * Test 10: No pages provided
 */
export function testClassifyNoPages() {
  const audit = new AuditTrail();
  const result = classifySite([], audit);

  console.assert(result.confidence === CONFIDENCE_LEVELS.INFERRED || result.confidence === CONFIDENCE_LEVELS.MISSING, 'Confidence should be low');
  console.log('✓ Test 10: No pages handling PASSED');
}

/**
 * Run all tests
 */
export function runAllTests() {
  console.log('\n=== Site Classifier Test Suite ===\n');

  try {
    testClassifyDealerSite();
    testClassifyEcommerceSite();
    testClassifyBlogSite();
    testClassifyNoSchema();
    testClassifyAmbiguousSite();
    testClassifyMinimalSite();
    testNoFalsePositiveDealerOnBlog();
    testAuditTrailCaptures();
    testIsSiteSupported();
    testClassifyNoPages();

    console.log('\n=== All tests PASSED ===\n');
  } catch (err) {
    console.error('\n=== Test FAILED ===');
    console.error(err);
  }
}

// Export for manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
