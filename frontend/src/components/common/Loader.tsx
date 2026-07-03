interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export default function Loader({ message = "Loading...", fullPage = false }: LoaderProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] animate-fadeIn">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-center min-w-[240px] border-t-4 border-t-blue-600 animate-scaleIn">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="relative flex items-center justify-center mb-3">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">{message}</span>
            <p className="text-[10px] text-gray-400 font-medium">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  // PhonePe-style card/list skeleton loaders
  return (
    <div className="space-y-4 p-4 w-full animate-pulse select-none">
      {message && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{message}</span>
        </div>
      )}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4.5 space-y-4 shadow-sm">
          {/* Header row */}
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
              <div className="space-y-1.5">
                <div className="w-24 h-3 bg-slate-200 rounded"></div>
                <div className="w-14 h-2 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div className="w-16 h-5 bg-slate-100 rounded-lg"></div>
          </div>
          {/* Detail fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="w-16 h-2 bg-slate-100 rounded"></div>
              <div className="w-28 h-3.5 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-1.5">
              <div className="w-16 h-2 bg-slate-100 rounded"></div>
              <div className="w-20 h-3.5 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-1.5">
              <div className="w-20 h-2 bg-slate-100 rounded"></div>
              <div className="w-24 h-3.5 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-1.5">
              <div className="w-16 h-2 bg-slate-100 rounded"></div>
              <div className="w-16 h-3.5 bg-slate-200 rounded"></div>
            </div>
          </div>
          {/* Footer action */}
          <div className="pt-2 border-t border-gray-150 flex justify-between items-center">
            <div className="w-32 h-3 bg-slate-100 rounded"></div>
            <div className="w-12 h-3 bg-slate-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
