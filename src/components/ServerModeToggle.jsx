export default function ServerModeToggle({ useServer, setUseServer, serverOnline }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-zinc-800/70 bg-zinc-950/80 p-4 shadow-lg shadow-black/20">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span className={`px-2 py-1 rounded-full ${useServer ? 'bg-sky-500/15 text-sky-300' : 'bg-zinc-800 text-zinc-400'}`}>
            Server crawl
          </span>
          <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${serverOnline ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
            {serverOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-xs text-zinc-500 max-w-2xl">
          Submit the target URL to the backend worker instead of running a deep browser crawl. Use this when the browser crawl is too slow or you need a heavier analysis.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setUseServer(!useServer)}
        className={`self-start rounded-full px-4 py-2 text-sm font-semibold transition ${useServer ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
      >
        {useServer ? 'Server crawl enabled' : 'Enable server crawl'}
      </button>
    </div>
  );
}
