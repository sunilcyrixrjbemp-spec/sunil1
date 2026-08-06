export default function HomeSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4 text-[#212529] p-0 sm:p-2 md:p-4 w-full max-w-none animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Header Bar Skeleton (#4A6A8A) */}
      <div className="bg-[#4A6A8A] text-white rounded-lg px-3 py-1.5 flex items-center justify-between shadow-2xs mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/20 shrink-0"></div>
          <div className="h-3.5 w-48 bg-white/30 rounded-md"></div>
        </div>
        <div className="h-6 w-20 bg-white/20 rounded-md"></div>
      </div>

      {/* 2. Expense Summary Bar Header Skeleton (#4A6A8A) */}
      <div className="space-y-1 mb-2">
        <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
          <div className="h-3 w-40 bg-white/30 rounded-md"></div>
          <div className="h-5 w-24 bg-white/20 rounded-md"></div>
        </div>

        {/* 6 Datacard Micro-Bars Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {[
            "from-blue-500 to-indigo-600",
            "from-amber-500 to-amber-600",
            "from-purple-500 to-indigo-600",
            "from-emerald-500 to-teal-600",
            "from-orange-500 to-amber-600",
            "from-rose-500 to-red-600"
          ].map((color, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} opacity-40 shrink-0`}></div>
                <div className="flex flex-col justify-center min-w-0 flex-1 space-y-1">
                  <div className="h-2 w-16 bg-slate-200 rounded"></div>
                  <div className="h-3 w-20 bg-slate-300 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Filters & Search Toolbar Skeleton */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200 rounded-lg"></div>
          <div className="h-8 w-28 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-44 bg-slate-200 rounded-lg"></div>
          <div className="h-8 w-64 bg-slate-100 rounded-lg border border-slate-200"></div>
        </div>
      </div>

      {/* 4. Claims Table Skeleton Layout */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Table Header Row */}
        <div className="bg-[#4A6A8A] px-4 py-2.5 grid grid-cols-6 gap-4 text-white text-xs font-bold">
          <div className="h-3 w-16 bg-white/30 rounded"></div>
          <div className="h-3 w-24 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
          <div className="h-3 w-32 bg-white/30 rounded"></div>
          <div className="h-3 w-16 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
        </div>

        {/* 8 Shimmering Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="px-4 py-3 border-b border-slate-100 grid grid-cols-6 gap-4 items-center">
            <div className="h-3.5 w-16 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-24 bg-slate-300 rounded font-mono"></div>
            <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
            <div className="space-y-1">
              <div className="h-3.5 w-36 bg-slate-200 rounded"></div>
              <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
            </div>
            <div className="h-4 w-16 bg-slate-300 rounded font-bold"></div>
            <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
