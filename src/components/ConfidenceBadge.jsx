/**
 * Maps system confidence levels to cohesive TailwindCSS classes.
 * Aligns component colors with spreadsheet visual themes (Green/Amber/Red/Blue).
 */
const CONFIDENCE_STYLES = {
  "VERIFIED": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "INFERRED": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "MISSING": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "DEALER-NEEDED": "bg-sky-500/10 text-sky-400 border-sky-500/20"
};

/**
 * Display badge displaying a field's extraction confidence status.
 *
 * @param {Object} props - React props.
 * @param {string} props.confidence - Rating value: VERIFIED, INFERRED, MISSING, or DEALER-NEEDED.
 * @returns {React.ReactElement} Styled badge pill element.
 */
export default function ConfidenceBadge({ confidence }) {
  const normConfidence = typeof confidence === "string" ? confidence.toUpperCase() : "MISSING";
  const colorClasses = CONFIDENCE_STYLES[normConfidence] || CONFIDENCE_STYLES.MISSING;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wider border uppercase transition-colors duration-150 ${colorClasses}`}
    >
      {normConfidence.replace("-", " ")}
    </span>
  );
}