import React from "react";

export default function AnalysisSkeleton() {
  return (
    <div className="w-full space-y-4 p-2 sm:p-4 animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Header Filter Bar Skeleton */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-9 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>

      {/* 2. Top 4 KPI Metrics Skeleton Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            </div>
            <div className="h-8 w-36 bg-slate-300 dark:bg-slate-700 rounded-lg mb-2"></div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Analytics Section: Rajasthan Map + Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Rajasthan Map Container Skeleton (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl flex items-center justify-center relative overflow-hidden">
            <div className="w-48 h-48 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-700 animate-spin" style={{ animationDuration: "12s" }}></div>
            <div className="absolute text-xs font-medium text-slate-400 dark:text-slate-500">Loading Map Geometry...</div>
          </div>
        </div>

        {/* Expense Category & Mode Donut/Bar Skeleton (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[200px] flex flex-col justify-between">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-300 dark:bg-slate-700 rounded-full" style={{ width: `${30 + j * 20}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[200px] flex flex-col justify-between">
            <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded-md mb-4"></div>
            <div className="flex items-center justify-center gap-6">
              <div className="w-28 h-28 rounded-full border-8 border-slate-200 dark:border-slate-800 border-t-blue-500/40 animate-spin"></div>
              <div className="space-y-2">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 3D Hybrid Trend Chart Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[240px] flex flex-col justify-between">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="flex items-end justify-between gap-2 h-36 px-4">
          {[40, 65, 30, 85, 50, 90, 70, 45, 60, 75, 95, 55].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-t-md" style={{ height: `${h}%` }}></div>
              <div className="h-2 w-6 bg-slate-200 dark:bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Employee Breakdown Table Skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-6 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          </div>
        </div>

        {/* Table Rows Shimmer */}
        <div className="space-y-3">
          {/* Header Row */}
          <div className="grid grid-cols-6 gap-4 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
          </div>

          {/* 6 Skeleton Table Rows */}
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="grid grid-cols-6 gap-4 py-3 items-center border-b border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                <div className="space-y-1">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-2.5 w-14 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
              <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded font-bold"></div>
              <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
