export default function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans animate-pulse">
      {/* 1. Dark Operations Command Center Banner Skeleton */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 mb-6 shadow-xl border border-slate-800/80">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/15 w-12 h-12 shrink-0"></div>
            <div className="space-y-2">
              <div className="h-6 w-64 bg-white/20 rounded-lg"></div>
              <div className="h-3 w-48 bg-white/10 rounded-md"></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 bg-white/10 rounded-xl"></div>
            <div className="h-10 w-28 bg-indigo-500/30 rounded-xl border border-indigo-400/30"></div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs Bar Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
        {[1, 2, 3, 4, 5, 6].map((tab) => (
          <div key={tab} className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0"></div>
        ))}
      </div>

      {/* 3. Overview Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 w-28 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 rounded-xl bg-slate-100"></div>
            </div>
            <div className="h-7 w-32 bg-slate-300 rounded-lg mb-2"></div>
            <div className="h-3 w-24 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* 4. Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[350px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-48 bg-slate-200 rounded-lg"></div>
            <div className="h-5 w-24 bg-slate-100 rounded-full"></div>
          </div>
          <div className="flex items-end justify-between gap-3 h-64 px-4">
            {[50, 75, 40, 90, 60, 80, 45, 85, 65, 95].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-200 rounded-t-lg" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[350px] flex flex-col items-center justify-between">
          <div className="w-full flex justify-between items-center mb-4">
            <div className="h-5 w-36 bg-slate-200 rounded-lg"></div>
          </div>
          <div className="w-40 h-40 rounded-full border-8 border-slate-200 border-t-indigo-500/50 animate-spin my-auto"></div>
          <div className="w-full flex justify-around">
            <div className="h-3 w-16 bg-slate-200 rounded"></div>
            <div className="h-3 w-16 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
