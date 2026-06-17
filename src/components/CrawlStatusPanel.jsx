export default function CrawlStatusPanel({
  percent,
  currentStep,
  fieldCount,
  pagesVisited,
  linksDiscovered,
  currentUrl,
  recentFetches,
  useServerMode,
  serverOnline,
  serverStatus,
  serverJobId,
  children,
}) {
  const safePercent = Math.min(Math.max(Math.round(percent || 0), 0), 100);
  const discovered = linksDiscovered || 0;
  const slowCount = recentFetches?.filter((f) => f.meta?.duration > 2000).length || 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-5 shadow-2xl shadow-black/20 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-1">Crawl status</div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Live progress dashboard</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${useServerMode ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'}`}>
              {useServerMode ? 'Server Crawl' : 'Browser Crawl'}
            </span>
            <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${serverOnline ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
              {useServerMode ? (serverOnline ? 'Server Online' : 'Server Offline') : 'Client Mode'}
            </span>
          </div>
        </div>

        <div className="w-full bg-zinc-950 h-3 rounded-full border border-zinc-800 overflow-hidden">
          <div className="h-full bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${safePercent}%` }} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-400">
          <p className="font-medium text-zinc-100">{currentStep || 'Preparing crawl...'}</p>
          <p>{safePercent}% complete</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-zinc-200">
          <div className="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
            <p className="text-zinc-400 text-[11px] uppercase tracking-[0.25em] mb-1">Pages</p>
            <p className="text-xl font-semibold">{pagesVisited || 0}</p>
          </div>
          <div className="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
            <p className="text-zinc-400 text-[11px] uppercase tracking-[0.25em] mb-1">Links</p>
            <p className="text-xl font-semibold">{discovered}</p>
          </div>
          <div className="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
            <p className="text-zinc-400 text-[11px] uppercase tracking-[0.25em] mb-1">Fields</p>
            <p className="text-xl font-semibold">{fieldCount || 0}</p>
          </div>
          <div className="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
            <p className="text-zinc-400 text-[11px] uppercase tracking-[0.25em] mb-1">Slow hits</p>
            <p className="text-xl font-semibold">{slowCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-zinc-950/90 rounded-2xl p-3 border border-zinc-800">
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Current URL</p>
            <p className="text-sm text-zinc-200 font-medium truncate wrap-break-word">{currentUrl || 'Waiting for first fetch...'}</p>
          </div>
          <div className="bg-zinc-950/90 rounded-2xl p-3 border border-zinc-800">
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Server job</p>
            <p className="text-sm text-zinc-200 font-medium truncate wrap-break-word">{useServerMode ? (serverJobId || 'Queued...') : 'Not used'}</p>
            {useServerMode && serverStatus && (
              <p className="mt-2 text-[11px] text-zinc-400">Status: {serverStatus}</p>
            )}
          </div>
          <div className="bg-zinc-950/90 rounded-2xl p-3 border border-zinc-800">
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Latest fetches</p>
            <div className="flex flex-wrap gap-2">
              {(recentFetches || []).slice(0, 5).map((fetch, index) => (
                <span key={index} className="text-[11px] px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 truncate max-w-full block">
                  {fetch.url.length > 35 ? `${fetch.url.slice(0, 34)}...` : fetch.url}
                </span>
              ))}
              {(!recentFetches || recentFetches.length === 0) && <span className="text-[11px] text-zinc-500">No fetches yet</span>}
            </div>
          </div>
        </div>
        {children && <div className="mt-5 space-y-4">{children}</div>}
      </div>
    </div>
  );
}
