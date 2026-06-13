import { buildField } from "../utils/fieldBuilder.js";
import { OPERATIONAL_RULES } from "../config/complianceRules.js";

export default function extractOperationalRules() {
  return {
    rules: buildField(OPERATIONAL_RULES, "VERIFIED", "system-config")
  };
}
