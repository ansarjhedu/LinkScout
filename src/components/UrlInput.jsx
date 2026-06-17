import { useState } from "react";
import { Link2, Play, ShieldAlert } from "lucide-react";

/**
 * Centered URL input component with inline validation.
 * Initiates the crawler workflow and locks down during tracing.
 *
 * @param {Object} props - Component properties.
 * @param {function(string): void} props.onSubmit - Trigger callback with validated target URL.
 * @param {boolean} props.isCrawling - Global flag indicating if crawling is active.
 * @returns {React.ReactElement} Input card form module.
 */
export default function UrlInput({ onSubmit, isCrawling }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  /**
   * Evaluates input format and protocol structure.
   */
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Please paste a target dealership website URL.");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        setError("Invalid secure protocol. Target must start with http:// or https://");
        return;
      }
      
      // Standard domain pattern check
      if (!parsedUrl.hostname.includes(".")) {
        setError("Please enter a valid dealership domain name.");
        return;
      }

      onSubmit(parsedUrl.href);
    } catch {
      setError("Malformed URL structure. Verify the link and try again.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-xl p-6 sm:p-8 shadow-2xl transition-all duration-300">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-wide">
          Start Real-Time Asset Analysis
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md mx-auto">
          Enter any dealer domain. Scans schemas, sitemaps, and text grids client-side in the browser.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Link2 className="h-5 h-5 text-zinc-500" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            disabled={isCrawling}
            placeholder="e.g. https://www.hondamotordealer.com"
            className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-rose-400 text-xs sm:text-sm animate-fade-in">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isCrawling}
          className="w-full py-3.5 px-6 font-semibold tracking-wide text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-lg hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          {isCrawling ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Analyzing Domain Structure...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Analyze Dealership Website</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}