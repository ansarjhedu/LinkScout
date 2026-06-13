import parseHtml from "../utils/domParser.js";
import { buildField, MISSING_REASONS } from "../utils/fieldBuilder.js";
import { classifyUrl } from "../crawler/urlClassifier.js";

function extractJsonLdItems(pages) {
  const products = [];
  const collections = [];
  const seen = new Set();

  for (const page of pages) {
    const schemas = parseHtml(page.html).jsonLd();
    for (const schema of schemas) {
      const items = Array.isArray(schema) ? schema : [schema];
      for (const item of items) {
        const type = item["@type"];
        if (!type) continue;

        if (/Product|Vehicle|Car|Motorcycle|Offer/i.test(type)) {
          const name = item.name || item.model || null;
          const key = `${name}-${page.url}`;
          if (name && !seen.has(key)) {
            seen.add(key);
            products.push({
              name,
              url: item.url || page.url,
              brand: item.brand?.name || item.manufacturer?.name || item.brand || null,
              price: item.offers?.price || item.offers?.[0]?.price || null,
              sku: item.sku || item.productID || null,
              source: page.url,
              confidence: "VERIFIED",
            });
          }
        }

        if (/CollectionPage|ItemList|ProductCollection/i.test(type)) {
          const name = item.name || item.headline || null;
          if (name && !seen.has(`col-${name}`)) {
            seen.add(`col-${name}`);
            collections.push({
              name,
              url: item.url || page.url,
              itemCount: item.numberOfItems || item.itemListElement?.length || null,
              source: page.url,
              confidence: "VERIFIED",
            });
          }
        }

        if (item.itemListElement && Array.isArray(item.itemListElement)) {
          for (const el of item.itemListElement.slice(0, 20)) {
            const entry = el.item || el;
            const name = entry?.name;
            if (name && !seen.has(`item-${name}`)) {
              seen.add(`item-${name}`);
              products.push({
                name,
                url: entry.url || page.url,
                brand: entry.brand?.name || null,
                price: entry.offers?.price || null,
                sku: entry.sku || null,
                source: page.url,
                confidence: "INFERRED",
              });
            }
          }
        }
      }
    }
  }

  return { products, collections };
}

function extractFromPageContent(pages) {
  const products = [];
  const collections = [];
  const seenProducts = new Set();
  const seenCollections = new Set();

  for (const page of pages) {
    const type = page.type || classifyUrl(page.url);
    const helper = parseHtml(page.html);
    const title = helper.text("h1") || helper.attr("meta[property='og:title']", "content") || helper.text("title");
    const price = helper.text("[class*='price'i], [itemprop='price'], .msrp, .sale-price") ||
      (helper.text("body") || "").match(/\$\s?[\d,]+(?:\.\d{2})?/)?.[0];

    if (type === "product" && title) {
      const key = title.slice(0, 80);
      if (!seenProducts.has(key)) {
        seenProducts.add(key);
        products.push({
          name: title.trim(),
          url: page.url,
          brand: (title.match(/^(Polaris|Honda|Kawasaki|Can-Am|Sea-Doo|KTM|Suzuki|Yamaha|Spyder)/i) || [])[0] || null,
          price: price?.trim() || null,
          sku: helper.attr("[itemprop='sku']", "content") || null,
          source: page.url,
          confidence: "VERIFIED",
        });
      }
    }

    if (type === "collection" && title) {
      const key = title.slice(0, 80);
      if (!seenCollections.has(key)) {
        seenCollections.add(key);
        collections.push({
          name: title.trim(),
          url: page.url,
          itemCount: null,
          source: page.url,
          confidence: "VERIFIED",
        });
      }
    }
  }

  return { products, collections };
}

/**
 * Extracts product and collection catalog data from crawled pages (JSON-LD + page types).
 */
export default function extractCatalog(pages) {
  const safePages = Array.isArray(pages) ? pages : [];
  const source = safePages.find((p) => p.type === "home")?.url || safePages[0]?.url || null;

  const jsonLd = extractJsonLdItems(safePages);
  const pageContent = extractFromPageContent(safePages);

  const productMap = new Map();
  for (const p of [...jsonLd.products, ...pageContent.products]) {
    const key = p.url || p.name;
    if (!productMap.has(key)) productMap.set(key, p);
  }

  const collectionMap = new Map();
  for (const c of [...jsonLd.collections, ...pageContent.collections]) {
    const key = c.url || c.name;
    if (!collectionMap.has(key)) collectionMap.set(key, c);
  }

  const products = [...productMap.values()].slice(0, 50);
  const collections = [...collectionMap.values()].slice(0, 30);

  const productUrls = products.map((p) => p.url).filter(Boolean);
  const collectionUrls = collections.map((c) => c.url).filter(Boolean);

  return {
    products: buildField(products, products.length ? "VERIFIED" : "MISSING", source, products.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),
    collections: buildField(collections, collections.length ? "VERIFIED" : "MISSING", source, collections.length ? null : MISSING_REASONS.NO_PAGE_CONTENT),
    productUrls: buildField(productUrls, productUrls.length ? "VERIFIED" : "MISSING", source, productUrls.length ? null : "No product detail pages discovered in crawl"),
    collectionUrls: buildField(collectionUrls, collectionUrls.length ? "VERIFIED" : "MISSING", source, collectionUrls.length ? null : "No collection/category pages discovered in crawl"),
    productCount: buildField(products.length, products.length ? "VERIFIED" : "MISSING", source),
    collectionCount: buildField(collections.length, collections.length ? "VERIFIED" : "MISSING", source),
  };
}
