export default function AdminAnalyticsSkeleton() {
  return (
    <div className="space-y-6 text-[#212529] animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          "border-indigo-200 bg-indigo-50/20",
          "border-emerald-200 bg-emerald-50/20",
          "border-rose-200 bg-rose-50/20",
          "border-amber-200 bg-amber-50/20"
        ].map((cls, idx) => (
          <div key={idx} className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between ${cls}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-28 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
            </div>
            <div className="h-7 w-32 bg-slate-300 rounded-lg mb-2 font-mono"></div>
            <div className="h-3 w-24 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* 2. Edge Events Breakdown & Email Queue Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-xs min-h-[320px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-48 bg-slate-200 rounded"></div>
            <div className="h-4 w-20 bg-slate-100 rounded"></div>
          </div>
          <div className="space-y-3">
            {[85, 60, 45, 90, 70].map((w, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <div className="h-3 w-32 bg-slate-200 rounded"></div>
                  <div className="h-3 w-16 bg-slate-200 rounded"></div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full" style={{ width: `${w}%` }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-xs min-h-[320px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-36 bg-slate-200 rounded"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div className="h-3.5 w-24 bg-slate-200 rounded"></div>
                <div className="h-5 w-14 bg-slate-300 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Security Audit Logs Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="h-5 w-44 bg-slate-200 rounded"></div>
          <div className="h-4 w-24 bg-slate-100 rounded"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200"></div>
                <div className="space-y-1">
                  <div className="h-3.5 w-36 bg-slate-200 rounded"></div>
                  <div className="h-2.5 w-20 bg-slate-100 rounded"></div>
                </div>
              </div>
              <div className="h-3.5 w-24 bg-slate-200 rounded font-mono"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
