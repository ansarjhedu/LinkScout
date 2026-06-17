import { useState } from "react";
import { Download, CheckCircle2, Grid, FileSpreadsheet, Layers, FileJson, FileText } from "lucide-react";
import generatePagesSheet from "../exporters/pagesExporter.js";
import generateIntelSheet from "../exporters/intelExporter.js";
import generateMasterSheet from "../exporters/masterExporter.js";
import exportJson from "../exporters/jsonExporter.js";
import exportPacket from "../exporters/packetExporter.js";

export default function DownloadButtons({ masterJson }) {
  const [loading, setLoading] = useState({});
  const [success, setSuccess] = useState({});

  const triggerDownload = (key, exportFn) => {
    if (!masterJson) return;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setSuccess((prev) => ({ ...prev, [key]: false }));

    setTimeout(() => {
      try {
        exportFn(masterJson);
        setLoading((prev) => ({ ...prev, [key]: false }));
        setSuccess((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => setSuccess((prev) => ({ ...prev, [key]: false })), 3000);
      } catch (err) {
        console.error(`Export failed: ${key}`, err);
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    }, 400);
  };

  const buttons = [
    { key: "pages", label: "Pages Sheet", desc: "URLs & social links", file: "pages_urls.xlsx", icon: Grid, color: "emerald", fn: generatePagesSheet },
    { key: "intel", label: "Intel Sheet", desc: "Brands, depts, finance, geo", file: "intel_brands_depts.xlsx", icon: FileSpreadsheet, color: "sky", fn: generateIntelSheet },
    { key: "master", label: "Master Sheet", desc: "Full 14-tab audit portfolio", file: "master_intelligence.xlsx", icon: Layers, color: "purple", fn: generateMasterSheet },
    { key: "json", label: "JSON Export", desc: "Complete structured data", file: "master_intelligence.json", icon: FileJson, color: "amber", fn: exportJson },
    { key: "packet", label: "Intel Packet", desc: "Client-ready markdown report", file: "intelligence_packet.md", icon: FileText, color: "rose", fn: exportPacket }
  ];

  const colorMap = {
    emerald: "border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    sky: "border-sky-500/20 hover:border-sky-500/40 text-sky-400 bg-sky-500/10",
    purple: "border-purple-500/20 hover:border-purple-500/40 text-purple-400 bg-purple-500/10",
    amber: "border-amber-500/20 hover:border-amber-500/40 text-amber-400 bg-amber-500/10",
    rose: "border-rose-500/20 hover:border-rose-500/40 text-rose-400 bg-rose-500/10"
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-6">
      {buttons.map(({ key, label, desc, file, icon: Icon, color, fn }) => (
        <button
          key={key}
          onClick={() => triggerDownload(key, fn)}
          disabled={loading[key] || !masterJson}
          className={`flex flex-col items-center justify-center p-4 text-center bg-zinc-900 hover:bg-zinc-850 border rounded-xl transition-all duration-150 group cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${colorMap[color].split(" ")[0]} ${colorMap[color].split(" ")[1]}`}
        >
          <div className={`p-2.5 rounded-lg group-hover:scale-105 transition-transform ${colorMap[color].split(" ").slice(2).join(" ")}`}>
            {loading[key] ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : success[key] ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>
          <h4 className="mt-3 font-bold text-zinc-200 text-xs tracking-wide">{label}</h4>
          <p className="mt-1 text-zinc-500 text-[10px] leading-relaxed">{desc}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold group-hover:underline">
            <Download className="w-3 h-3" />
            <span>{success[key] ? "Done!" : file}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
