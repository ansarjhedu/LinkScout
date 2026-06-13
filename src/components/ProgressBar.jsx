import React from "react";
import { FileText, Database, Compass, Link2 } from "lucide-react";

export default function ProgressBar({ percent, currentStep, fieldCount, pagesVisited, linksDiscovered }) {
  const safePercent = Math.min(Math.max(Math.round(percent || 0), 0), 100);

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-xl p-6 shadow-2xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-zinc-300 font-medium tracking-wide truncate max-w-[280px] sm:max-w-md">
            {currentStep || "Initializing..."}
          </span>
        </div>
        <span className="text-indigo-400 font-mono font-bold text-lg self-end sm:self-auto">
          {safePercent}%
        </span>
      </div>

      <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-850 p-[2px]">
        <div
          style={{ width: `${safePercent}%` }}
          className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-300 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-zinc-850 text-zinc-400 text-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Pages</div>
            <div className="font-bold font-mono text-zinc-300 text-base">{pagesVisited || 0}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <Link2 className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Links Found</div>
            <div className="font-bold font-mono text-zinc-300 text-base">{linksDiscovered || 0}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Fields</div>
            <div className="font-bold font-mono text-zinc-300 text-base">{fieldCount || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
