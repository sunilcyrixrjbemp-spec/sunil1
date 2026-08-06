export default function AnalysisSkeleton() {
  return (
    <div className="w-full space-y-2 p-1 sm:p-2 animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Ultra-Compact #4A6A8A Signature Header Bar Skeleton */}
      <div className="bg-[#4A6A8A] text-white rounded-t-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 shrink-0"></div>
            <div className="h-4 w-40 bg-white/30 rounded-md"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-36 bg-white/20 rounded-md"></div>
          <div className="h-6 w-20 bg-white/20 rounded-md"></div>
          <div className="h-6 w-24 bg-white/20 rounded-md"></div>
          <div className="h-6 w-20 bg-white/20 rounded-md"></div>
        </div>
      </div>

      {/* 2. Ultra-Compact 1-Line Filter Toolbar Skeleton */}
      <div className="bg-white border-x border-b border-slate-200/80 px-2 py-1.5 shadow-2xs">
        <div className="flex flex-nowrap items-center gap-1.5 w-full overflow-x-auto no-scrollbar">
          {[
            { w: "w-24", label: "Zone" },
            { w: "w-28", label: "District" },
            { w: "w-32", label: "Engineer" },
            { w: "w-26", label: "Coordinator" },
            { w: "w-22", label: "Status" },
            { w: "w-18", label: "Month" },
            { w: "w-16", label: "Year" }
          ].map((item, idx) => (
            <div key={idx} className={`shrink-0 ${item.w}`}>
              <div className="h-2 w-10 bg-slate-200 rounded mb-1"></div>
              <div className="h-6 w-full bg-slate-100 border border-slate-200 rounded"></div>
            </div>
          ))}
          <div className="shrink-0">
            <div className="h-2 w-16 bg-slate-200 rounded mb-1"></div>
            <div className="h-6 w-48 bg-slate-100 border border-slate-200 rounded"></div>
          </div>
        </div>
      </div>

      {/* 3. Stat Card Design System (Exact 6 Sharp-Corner Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 my-2.5">
        {[
          { color: "from-blue-600 to-indigo-600", label: "TOTAL CLAIMED" },
          { color: "from-emerald-600 to-teal-600", label: "APPROVED" },
          { color: "from-amber-500 to-orange-600", label: "PENDING" },
          { color: "from-rose-500 to-red-600", label: "REJECTED" },
          { color: "from-indigo-500 to-purple-600", label: "AVG CLAIM" },
          { color: "from-cyan-500 to-blue-600", label: "CALLS DONE" }
        ].map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-none p-2.5 flex items-center gap-2.5 shadow-2xs">
            <div className={`w-9 h-9 rounded-none bg-gradient-to-br ${card.color} shrink-0 opacity-40`}></div>
            <div className="flex flex-col justify-center min-w-0 flex-1 gap-1">
              <span className="text-[9px] font-bold text-slate-300 leading-none">{card.label}</span>
              <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
              <div className="h-2.5 w-12 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Main Grid: Daily Spend Burn (8 cols) & Claim Status Ratios (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <div className="h-3 w-32 bg-white/30 rounded"></div>
          </div>
          <div className="p-4 flex items-end justify-between gap-2" style={{ height: 300 }}>
            {[35, 55, 25, 75, 45, 85, 60, 40, 70, 90, 50, 65, 45, 80, 55, 75].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full bg-slate-100 rounded-t" style={{ height: `${h}%` }}></div>
                <div className="h-2 w-full bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <div className="h-3 w-36 bg-white/30 rounded"></div>
          </div>
          <div className="p-4 flex flex-col items-center justify-center gap-4" style={{ height: 300 }}>
            <div className="w-36 h-36 rounded-full border-8 border-slate-200 border-t-[#4A6A8A]/50 animate-spin"></div>
            <div className="flex gap-4">
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 2: District Expenditure (6 cols) & Employee Expenses (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <div className="h-3 w-40 bg-white/30 rounded"></div>
          </div>
          <div className="p-4 flex items-end gap-3 justify-around" style={{ height: 290 }}>
            {[60, 85, 45, 95, 70, 50, 80].map((h, idx) => (
              <div key={idx} className="w-10 bg-slate-200 rounded-t" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <div className="h-3 w-36 bg-white/30 rounded"></div>
          </div>
          <div className="p-4 space-y-3" style={{ height: 290 }}>
            {[80, 65, 90, 55, 70].map((w, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between">
                  <div className="h-2.5 w-24 bg-slate-200 rounded"></div>
                  <div className="h-2.5 w-16 bg-slate-200 rounded"></div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full" style={{ width: `${w}%` }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
