/**
 * ============================================================
 * Analysis Dashboard High-Fidelity Skeleton Loader
 * Built with Unified AppSkeleton System
 * ============================================================
 */

import Skeleton from "./AppSkeleton";

export default function AnalysisSkeleton() {
  return (
    <div className="w-full space-y-3 p-1 sm:p-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* 1. Header Bar Skeleton */}
      <div className="bg-[#4A6A8A] text-white rounded-t-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-3">
          <Skeleton width={28} height={28} borderRadius={6} baseColor="rgba(255,255,255,0.15)" highlightColor="rgba(255,255,255,0.3)" />
          <Skeleton width={160} height={18} borderRadius={4} baseColor="rgba(255,255,255,0.2)" highlightColor="rgba(255,255,255,0.4)" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width={120} height={24} borderRadius={4} baseColor="rgba(255,255,255,0.15)" highlightColor="rgba(255,255,255,0.3)" />
          <Skeleton width={80} height={24} borderRadius={4} baseColor="rgba(255,255,255,0.15)" highlightColor="rgba(255,255,255,0.3)" />
          <Skeleton width={80} height={24} borderRadius={4} baseColor="rgba(255,255,255,0.15)" highlightColor="rgba(255,255,255,0.3)" />
        </div>
      </div>

      {/* 2. Filter Toolbar Skeleton */}
      <div className="bg-white border-x border-b border-slate-200/80 p-2 shadow-2xs">
        <div className="flex flex-nowrap items-center gap-2 w-full overflow-x-auto no-scrollbar">
          {[100, 120, 140, 110, 90, 80, 70].map((w, idx) => (
            <div key={idx} className="shrink-0" style={{ width: w }}>
              <Skeleton width={w * 0.4} height={10} className="mb-1" />
              <Skeleton width={w} height={28} borderRadius={4} />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Stat Cards Skeleton (Exact 6 Sharp Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 my-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200 p-2.5 flex items-center gap-2.5 shadow-2xs">
            <Skeleton width={36} height={36} borderRadius={4} />
            <div className="flex flex-col justify-center flex-1">
              <Skeleton width={60} height={10} className="mb-1" />
              <Skeleton width={80} height={16} />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 bg-white border border-slate-200/80 p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <Skeleton width={180} height={16} />
            <Skeleton width={100} height={24} />
          </div>
          <Skeleton height={280} borderRadius={6} />
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200/80 p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <Skeleton width={140} height={16} />
          </div>
          <Skeleton height={280} borderRadius={6} />
        </div>
      </div>
    </div>
  );
}
