import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search, AlertTriangle, Info } from "lucide-react";

/**
 * Read-only crawl audit report showing missing fields and why the crawler could not verify them.
 */
export default function QAChecklist({ missingItems }) {
  const [isOpen, setIsOpen] = useState(false);

  const audit = missingItems || {};
  const { critical = [], gaps = [] } = audit;
  const totalCount = gaps.length;

  if (totalCount === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-xl overflow-hidden mt-6 shadow-xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-zinc-800/20 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-zinc-200 text-sm sm:text-base tracking-wide">
              Section 20 — Crawl Audit Report
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              {totalCount} fields not found on website — each includes reason why.
            </p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-zinc-850/60 animate-fade-in space-y-6 pt-4">
          {critical.length > 0 && (
            <div className="border border-rose-500/20 bg-rose-500/5 rounded-lg p-4 space-y-3">
              <h4 className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Critical Gaps ({critical.length})
              </h4>
              <div className="space-y-2">
                {critical.map((item) => (
                  <div key={item.field} className="text-sm">
                    <strong className="text-zinc-300 font-mono text-xs">{item.field}</strong>
                    <span className="text-rose-400/80 text-xs block mt-0.5">{item.reason || item.notes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-zinc-700/40 bg-zinc-950/40 rounded-lg p-4 space-y-3">
            <h4 className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs uppercase tracking-wider">
              <Info className="w-4 h-4 shrink-0" />
              All Missing Fields ({gaps.length})
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {gaps.map((item) => (
                <div key={item.field} className="text-sm border-b border-zinc-850/60 pb-2 last:border-0">
                  <strong className="text-zinc-400 font-mono text-xs">{item.field}</strong>
                  <span className="text-zinc-500 text-xs block mt-0.5">{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
