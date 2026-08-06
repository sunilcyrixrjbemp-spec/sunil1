export default function MonthSummarySkeleton() {
  return (
    <div className="w-full space-y-3 text-[#212529] animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Top Header Bar (#4A6A8A) Skeleton */}
      <div className="bg-[#4A6A8A] text-white rounded-none p-3 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-none bg-white/20 shrink-0"></div>
          <div className="space-y-1">
            <div className="h-4 w-64 bg-white/30 rounded"></div>
            <div className="h-2.5 w-44 bg-white/20 rounded"></div>
          </div>
        </div>
        <div className="h-7 w-28 bg-white/20 rounded-none"></div>
      </div>

      {/* 2. Top 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          "bg-blue-600",
          "bg-emerald-600",
          "bg-amber-600",
          "bg-purple-600"
        ].map((bg, idx) => (
          <div key={idx} className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
            <div className={`w-9 h-9 rounded-none ${bg} opacity-40 shrink-0`}></div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-2 w-16 bg-slate-200 rounded"></div>
              <div className="h-3.5 w-24 bg-slate-300 rounded"></div>
              <div className="h-2 w-12 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Filter Month Report Card Skeleton */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs p-3 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="h-4 w-36 bg-slate-200 rounded"></div>
          <div className="h-6 w-20 bg-slate-100 border border-slate-200 rounded"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-2.5 w-16 bg-slate-200 rounded"></div>
              <div className="h-7 w-full bg-slate-100 border border-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Main Summary Table Skeleton (#4A6A8A Header) */}
      <div className="border border-slate-300 rounded-none shadow-2xs bg-white overflow-hidden">
        <div className="bg-[#4A6A8A] text-white px-4 py-2.5 grid grid-cols-7 gap-3 text-xs font-extrabold uppercase">
          <div className="h-3 w-28 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
          <div className="h-3 w-16 bg-white/30 rounded"></div>
          <div className="h-3 w-16 bg-white/30 rounded"></div>
          <div className="h-3 w-16 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
          <div className="h-3 w-24 bg-white/30 rounded"></div>
        </div>

        {/* 8 Shimmering Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="px-4 py-3 border-b border-slate-200 grid grid-cols-7 gap-3 items-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-none bg-[#4A6A8A]/30 shrink-0"></div>
              <div className="space-y-1">
                <div className="h-3.5 w-24 bg-slate-300 rounded"></div>
                <div className="h-2.5 w-14 bg-slate-200 rounded"></div>
              </div>
            </div>
            <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-14 bg-slate-200 rounded font-mono"></div>
            <div className="h-3.5 w-14 bg-slate-200 rounded font-mono"></div>
            <div className="h-3.5 w-14 bg-slate-200 rounded font-mono"></div>
            <div className="h-4 w-16 bg-slate-300 rounded font-mono font-bold"></div>
            <div className="h-7 w-24 bg-blue-600/20 border border-blue-300 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
