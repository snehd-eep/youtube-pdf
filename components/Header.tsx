export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h3.75m-3.75 0H5.625a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 1 3.375-3.375h3.75m0 12.75h3.75M12 12.75H8.25m3.75 0h3.75m-3.75 0V9m0 3.75v3.75m3.75-3.75H15a3.375 3.375 0 0 1 3.375 3.375v1.5a1.125 1.125 0 0 1-1.125 1.125H12m3.75-3.75V9m0 3.75v7.5"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            yt<span className="text-indigo-600 dark:text-indigo-400">2</span>pdf
          </h1>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
          Video → PDF in seconds
        </span>
      </div>
    </header>
  );
}