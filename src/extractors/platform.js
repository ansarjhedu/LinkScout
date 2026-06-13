import { buildField } from "../utils/fieldBuilder.js";

const PLATFORM_SIGNATURES = [
  { platform: "DX1", patterns: [/dx1/i, /dx1portal/i, /dx1\.com/i] },
  { platform: "Dealer.com", patterns: [/dealer\.com/i, /dealerdotcom/i, /ddc\./i] },
  { platform: "DealerOn", patterns: [/dealeron/i, /dealeron\.com/i] },
  { platform: "Dealer Inspire", patterns: [/dealerinspire/i] },
  { platform: "Dealer Spike", patterns: [/dealerspike/i] },
  { platform: "WordPress", patterns: [/wp-content/i, /wordpress/i, /wp-includes/i] },
  { platform: "WooCommerce", patterns: [/woocommerce/i, /wc-api/i] },
  { platform: "Shopify", patterns: [/cdn\.shopify/i, /shopify/i, /myshopify\.com/i] },
  { platform: "Magento", patterns: [/magento/i, /mage\/cookies/i] },
  { platform: "Webflow", patterns: [/webflow/i, /assets\.website-files\.com/i] },
  { platform: "Wix", patterns: [/wix\.com/i, /wixsite\.com/i, /parastorage\.com/i] },
  { platform: "Squarespace", patterns: [/squarespace/i, /static\.squarespace/i] },
];

export default function extractPlatform(pages) {
  const home = pages.find((p) => p.type === "home") || pages[0];
  const html = home?.html || "";
  const source = home?.url || null;

  let platform = null;
  for (const { platform: name, patterns } of PLATFORM_SIGNATURES) {
    if (patterns.some((p) => p.test(html))) {
      platform = name;
      break;
    }
  }

  const limitations = [];
  if (!/facebook\.com|instagram\.com/.test(html)) limitations.push("Social media links not found on homepage");
  if (!/schedule|appointment/i.test(html)) limitations.push("Service scheduler not detected");
  if (!/test[-\s]drive|test[-\s]ride/i.test(html)) limitations.push("Test drive page not detected");

  return {
    platform: buildField(platform, platform ? "VERIFIED" : "INFERRED", source),
    knownLimitations: buildField(limitations, limitations.length ? "INFERRED" : "MISSING", source)
  };
}
