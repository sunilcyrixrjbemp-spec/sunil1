export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Header Bar Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-[10px] border border-line">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-surface-sunken rounded-md"></div>
          <div className="h-3.5 w-64 bg-surface-sunken/60 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-surface-sunken rounded-lg"></div>
          <div className="h-9 w-32 bg-surface-sunken rounded-lg"></div>
        </div>
      </div>

      {/* 2. KPI Stat Cards Row Skeleton (4 across desktop, 2x2 tablet, 1-col mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-[10px] border border-line flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 w-24 bg-surface-sunken rounded"></div>
              <div className="w-8 h-8 rounded-lg bg-surface-sunken/80"></div>
            </div>
            <div className="h-8 w-32 bg-surface-sunken rounded-lg mb-3"></div>
            <div className="h-3 w-28 bg-surface-sunken/60 rounded"></div>
          </div>
        ))}
      </div>

      {/* 3. Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-5 rounded-[10px] border border-line min-h-[350px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-44 bg-surface-sunken rounded"></div>
            <div className="h-4 w-20 bg-surface-sunken/60 rounded"></div>
          </div>
          <div className="flex items-end justify-between gap-2.5 h-60 px-2">
            {[45, 70, 35, 85, 55, 75, 40, 90, 60, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-surface-sunken rounded-t"
                style={{ height: `${h}%` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-5 rounded-[10px] border border-line min-h-[350px] flex flex-col items-center justify-between">
          <div className="w-full flex justify-between items-center mb-4">
            <div className="h-5 w-32 bg-surface-sunken rounded"></div>
          </div>
          <div className="w-36 h-36 rounded-full border-4 border-surface-sunken border-t-accent-400 animate-spin my-auto"></div>
          <div className="w-full flex justify-around border-t border-line/60 pt-3">
            <div className="h-3 w-16 bg-surface-sunken rounded"></div>
            <div className="h-3 w-16 bg-surface-sunken rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
