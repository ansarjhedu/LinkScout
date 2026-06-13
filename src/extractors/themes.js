import { buildField } from "../utils/fieldBuilder.js";

export default function extractThemes(positioning = {}, brandData = [], financeData = {}) {
  const source = positioning?.primaryType?.source || null;
  const brandCount = brandData?.length || 0;
  const hasFinance = financeData?.financingOffered?.value;

  const primary = [];
  if (positioning?.category?.value === "Supercenter") primary.push("Largest Multi-Line Powersports Supercenter");
  if (positioning?.departments?.value?.length >= 3) primary.push("Full-Service Powersports Hub (Sales, Service, Parts, Finance)");
  if (brandCount >= 3) primary.push("Comprehensive Multi-Brand Inventory Destination");

  const secondary = [];
  if (hasFinance) secondary.push("Accessible Financing for Diverse Credit Profiles");
  if (brandCount >= 2) secondary.push("Expert Multi-Brand Sales & Service");
  secondary.push("Community for Riders & Outdoor Enthusiasts");

  const tertiary = ["OEM & Aftermarket Parts Support", "Trade-in & Buy-Outright Options"];

  const avoidReducingTo = positioning?.shouldNotReduceTo?.value || [
    "Just a local single-line shop",
    "Solely a used vehicle dealer",
    "Only a service center"
  ];

  return {
    primaryThemes: buildField(primary, primary.length ? "INFERRED" : "MISSING", source),
    secondaryThemes: buildField(secondary, "INFERRED", source),
    tertiaryThemes: buildField(tertiary, "INFERRED", source),
    avoidReducingTo: buildField(avoidReducingTo, "INFERRED", source)
  };
}
