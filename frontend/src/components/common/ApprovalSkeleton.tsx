export default function ApprovalSkeleton() {
  return (
    <div className="w-full space-y-3 p-1 sm:p-2 md:p-4 text-[#212529] animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Darker Slate-Blue Enterprise Header Bar (#4A6A8A) Skeleton */}
      <div className="bg-[#4A6A8A] text-white rounded-none p-3 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-none bg-white/20 shrink-0"></div>
          <div className="space-y-1">
            <div className="h-4 w-64 bg-white/30 rounded"></div>
            <div className="h-2.5 w-40 bg-white/20 rounded"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-28 bg-white/20 rounded-none"></div>
          <div className="h-7 w-32 bg-white/30 rounded-none"></div>
        </div>
      </div>

      {/* 2. Desktop Search & Bulk Actions Toolbar Skeleton */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="w-full sm:w-96 h-8 bg-slate-100 border border-slate-300 rounded-none"></div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-24 bg-slate-200 rounded-none"></div>
            <div className="h-7 w-32 bg-emerald-100 border border-emerald-300 rounded-none"></div>
            <div className="h-7 w-28 bg-rose-100 border border-rose-300 rounded-none"></div>
          </div>
        </div>
      </div>

      {/* 3. Main Approvals Table Skeleton (#4A6A8A Header) */}
      <div className="border border-slate-300 rounded-none shadow-2xs bg-white overflow-hidden">
        <div className="bg-[#4A6A8A] text-white px-4 py-2.5 grid grid-cols-6 gap-4 text-xs font-extrabold uppercase">
          <div className="h-3 w-28 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
          <div className="h-3 w-24 bg-white/30 rounded"></div>
          <div className="h-3 w-32 bg-white/30 rounded"></div>
          <div className="h-3 w-20 bg-white/30 rounded"></div>
          <div className="h-3 w-28 bg-white/30 rounded"></div>
        </div>

        {/* 8 Shimmering Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="px-4 py-3 border-b border-slate-200 grid grid-cols-6 gap-4 items-center">
            {/* Employee Details Column */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 rounded-none bg-[#4A6A8A]/30 shrink-0"></div>
              <div className="space-y-1">
                <div className="h-3.5 w-28 bg-slate-300 rounded"></div>
                <div className="h-2.5 w-16 bg-[#4A6A8A]/20 rounded"></div>
              </div>
            </div>

            {/* Travel Mode Badge */}
            <div className="h-6 w-20 bg-slate-200 rounded-none"></div>

            {/* Claim Code & Date */}
            <div className="space-y-1">
              <div className="h-3.5 w-24 bg-slate-300 rounded font-mono"></div>
              <div className="h-2.5 w-16 bg-slate-200 rounded"></div>
            </div>

            {/* Purpose */}
            <div className="space-y-1">
              <div className="h-3.5 w-36 bg-slate-200 rounded"></div>
              <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
            </div>

            {/* Amount */}
            <div className="h-4 w-20 bg-slate-300 rounded font-mono font-bold"></div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-16 bg-emerald-600/30 border border-emerald-400 rounded-none"></div>
              <div className="h-7 w-16 bg-rose-600/30 border border-rose-400 rounded-none"></div>
              <div className="h-7 w-16 bg-blue-600/30 border border-blue-400 rounded-none"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
