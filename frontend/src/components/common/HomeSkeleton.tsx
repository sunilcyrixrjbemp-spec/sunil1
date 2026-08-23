export default function HomeSkeleton() {
  return (
    <div className="space-y-6 w-full max-w-none antialiased animate-pulse">
      {/* 1. Greeting Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-line">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-surface-sunken rounded-md"></div>
          <div className="h-3.5 w-40 bg-surface-sunken/60 rounded"></div>
        </div>
        <div className="h-9 w-36 bg-surface-sunken rounded-lg"></div>
      </div>

      {/* 2. KPI Stat Cards Row (5 cards matching exact spec) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="bg-white border border-line rounded-[10px] p-4 flex flex-col justify-between h-[104px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-surface-sunken rounded"></div>
              <div className="w-5 h-5 rounded-full bg-surface-sunken/60"></div>
            </div>
            <div className="h-7 w-28 bg-surface-sunken rounded-md mt-2"></div>
          </div>
        ))}
      </div>

      {/* 3. Underline Tab & Filter Bar Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-6 border-b border-line pb-2">
          <div className="h-4 w-24 bg-surface-sunken rounded"></div>
          <div className="h-4 w-28 bg-surface-sunken/60 rounded"></div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-line rounded-[10px] p-3.5 flex flex-wrap items-center gap-3">
          <div className="h-8 w-32 bg-surface-sunken rounded-lg"></div>
          <div className="h-8 w-60 bg-surface-sunken rounded-full"></div>
          <div className="h-8 w-48 bg-surface-sunken rounded-lg ml-auto"></div>
        </div>
      </div>

      {/* 4. Claims Table / Card List Skeleton */}
      <div className="bg-white border border-line rounded-[10px] overflow-hidden">
        {/* Table Header */}
        <div className="bg-surface-sunken px-4 py-3 grid grid-cols-5 gap-4 border-b border-line">
          <div className="h-3.5 w-20 bg-line-strong/60 rounded"></div>
          <div className="h-3.5 w-24 bg-line-strong/60 rounded"></div>
          <div className="h-3.5 w-28 bg-line-strong/60 rounded"></div>
          <div className="h-3.5 w-20 bg-line-strong/60 rounded text-right ml-auto"></div>
          <div className="h-3.5 w-16 bg-line-strong/60 rounded ml-auto"></div>
        </div>

        {/* 6 Shimmering Rows */}
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="px-4 py-3.5 border-b border-line/60 grid grid-cols-5 gap-4 items-center last:border-0"
          >
            <div className="h-4 w-28 bg-surface-sunken rounded font-mono"></div>
            <div className="h-3.5 w-24 bg-surface-sunken/70 rounded"></div>
            <div className="space-y-1">
              <div className="h-3.5 w-32 bg-surface-sunken rounded"></div>
              <div className="h-2.5 w-20 bg-surface-sunken/50 rounded"></div>
            </div>
            <div className="h-4 w-20 bg-surface-sunken rounded font-mono ml-auto"></div>
            <div className="h-6 w-20 bg-surface-sunken/80 rounded-full ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
