export default function ApprovalSkeleton() {
  return (
    <div className="w-full space-y-4 antialiased animate-pulse">
      {/* Table Container Skeleton */}
      <div className="bg-white border border-line rounded-xl overflow-hidden shadow-xs">
        
        {/* Table Header Bar Skeleton */}
        <div className="bg-[#F8FAFC] border-b border-line px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent-200"></div>
            <div className="h-4 w-44 bg-surface-sunken rounded-md"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-28 bg-surface-sunken rounded-lg"></div>
            <div className="h-7 w-28 bg-surface-sunken rounded-lg"></div>
          </div>
        </div>

        {/* Column Headers */}
        <div className="bg-surface-sunken/60 px-4 py-2.5 grid grid-cols-12 gap-3 border-b border-line/60">
          <div className="col-span-3 h-3 w-28 bg-line-strong/50 rounded"></div>
          <div className="col-span-2 h-3 w-20 bg-line-strong/50 rounded"></div>
          <div className="col-span-2 h-3 w-20 bg-line-strong/50 rounded"></div>
          <div className="col-span-2 h-3 w-24 bg-line-strong/50 rounded"></div>
          <div className="col-span-2 h-3 w-16 bg-line-strong/50 rounded text-right ml-auto"></div>
          <div className="col-span-1 h-3 w-12 bg-line-strong/50 rounded ml-auto"></div>
        </div>

        {/* 6 Shimmering Table Rows */}
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            className="px-4 py-3.5 border-b border-line/50 grid grid-cols-12 gap-3 items-center last:border-0 hover:bg-slate-50/50"
          >
            {/* Employee Details Column */}
            <div className="col-span-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-sunken shrink-0"></div>
              <div className="space-y-1 min-w-0">
                <div className="h-3.5 w-28 bg-surface-sunken rounded"></div>
                <div className="h-2.5 w-16 bg-surface-sunken/70 rounded font-mono"></div>
              </div>
            </div>

            {/* Claim ID */}
            <div className="col-span-2">
              <div className="h-6 w-24 bg-surface-sunken rounded-md"></div>
            </div>

            {/* Category */}
            <div className="col-span-2">
              <div className="h-5 w-20 bg-surface-sunken/80 rounded-md"></div>
            </div>

            {/* Date & Purpose */}
            <div className="col-span-2 space-y-1">
              <div className="h-3.5 w-24 bg-surface-sunken rounded"></div>
              <div className="h-2.5 w-32 bg-surface-sunken/60 rounded"></div>
            </div>

            {/* Amount */}
            <div className="col-span-2 flex justify-end">
              <div className="h-4 w-20 bg-surface-sunken rounded-md"></div>
            </div>

            {/* Action Button */}
            <div className="col-span-1 flex justify-end">
              <div className="h-7 w-16 bg-accent-100 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
