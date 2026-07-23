interface ProgressLoaderProps {
  message?: string;
  onComplete?: () => void;
  fullPage?: boolean;
}

export default function ProgressLoader({
  message = "Loading...",
  fullPage = true,
}: ProgressLoaderProps) {
  const containerClasses = fullPage
    ? "fixed inset-0 z-[99999] bg-white/80 backdrop-blur-sm flex items-center justify-center"
    : "w-full min-h-[200px] flex items-center justify-center";

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
        {/* Message */}
        {message && (
          <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
