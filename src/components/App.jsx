import React, { useState } from "react";
import { Sparkles, Terminal, Activity, AlertTriangle } from "lucide-react";
import UrlInput from "./UrlInput";
import ProgressBar from "./ProgressBar";
import ResultsDashboard from "./ResultsDashboard";
import DownloadButtons from "./DownloadButtons";
import QAChecklist from "./QAChecklist";
import orchestrateCrawl from "../crawler/index";

/**
 * Main application coordinator for the MaxOpp Intelligence Crawler dashboard.
 * Manages core layout structures, state machines, progress streams, 
 * and simulated loading sequences.
 *
 * @returns {React.ReactElement} App core frame.
 */
export default function App() {
  const [status, setStatus] = useState("idle"); // "idle" | "crawling" | "complete" | "error"
  const [progress, setProgress] = useState({
    percent: 0,
    currentStep: "",
    fieldCount: 0,
    pagesVisited: 0,
    linksDiscovered: 0
  });
  const [masterJson, setMasterJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  /**
   * Triggers the full web crawler and scraper sequence.
   * Runs simulated safety gates (e.g., robots.txt audits) before starting sequential parsing.
   * 
   * @param {string} targetUrl - Validated target domain URL.
   */
  const handleStartCrawl = async (targetUrl) => {
    setStatus("crawling");
    setErrorMsg(null);
    setMasterJson(null);

    try {
      setProgress({
        percent: 1,
        currentStep: "Initializing intelligence crawler...",
        fieldCount: 0,
        pagesVisited: 0,
        linksDiscovered: 0
      });

      const finalResult = await orchestrateCrawl(targetUrl, (percent, stepName, fields, visited, links) => {
        setProgress({
          percent,
          currentStep: stepName,
          fieldCount: fields,
          pagesVisited: visited,
          linksDiscovered: links || 0
        });
      });

      setMasterJson(finalResult);
      setStatus("complete");
    } catch (err) {
      console.error("Crawler coordinator encountered a fatal pipeline crash", err);
      setErrorMsg(err.message || "An unexpected error disrupted the client-side crawling pipeline.");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-300 font-sans antialiased">
      {/* Header Panel */}
      <header className="sticky top-0 z-50 bg-[#1E1E2E] border-b border-zinc-800/80 px-4 sm:px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-wider text-white uppercase flex items-center gap-1.5">
              <span>MaxOpp Intelligence Crawler</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400 fill-current" />
            </h1>
            <p className="text-[10px] sm:text-xs text-zinc-400 tracking-wide">
              Browser-Native Structured Business Intelligence Extractor
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 text-xs">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono">Status: {status.toUpperCase()}</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        {status === "idle" && (
          <div className="animate-fade-in space-y-4">
            <UrlInput onSubmit={handleStartCrawl} isCrawling={false} />
          </div>
        )}

        {status === "crawling" && (
          <div className="animate-fade-in space-y-6">
            <ProgressBar
              percent={progress.percent}
              currentStep={progress.currentStep}
              fieldCount={progress.fieldCount}
              pagesVisited={progress.pagesVisited}
              linksDiscovered={progress.linksDiscovered}
            />
          </div>
        )}

        {status === "complete" && masterJson && (
          <div className="animate-fade-in space-y-6">
            {/* Download Board Deck */}
            <DownloadButtons masterJson={masterJson} />

            {/* QA Checklist Board */}
            <QAChecklist missingItems={masterJson.sections.s20_crawlAudit || masterJson.sections.s20_missingItems} />

            {/* Interactive Tab Panels */}
            <ResultsDashboard masterJson={masterJson} />

            {/* Restart Trigger Card */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setStatus("idle")}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg text-sm font-semibold tracking-wide shadow transition-all active:scale-[0.98]"
              >
                Reset and Crawl Another Domain
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="max-w-md mx-auto text-center bg-zinc-900/60 border border-rose-500/20 p-8 rounded-xl space-y-4 shadow-xl">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto animate-bounce" />
            <h3 className="text-zinc-200 font-bold text-lg">Analysis Pipeline Interrupted</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-2 w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold tracking-wide transition-colors"
            >
              Restart Auditing Engine
            </button>
          </div>
        )}
      </main>

      {/* Footer copyright anchor */}
      <footer className="py-6 border-t border-zinc-900 bg-zinc-950/40 text-center text-[10px] sm:text-xs text-zinc-600 font-medium select-none">
        &copy; {new Date().getFullYear()} MaxOpp Intelligence Scraper. All audits run client-side via CORS loop proxies.
      </footer>
    </div>
  );
}