/**
 * Downloads master intelligence as JSON.
 */
export default function exportJson(masterJson) {
  const blob = new Blob([JSON.stringify(masterJson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "master_intelligence.json";
  a.click();
  URL.revokeObjectURL(url);
}
