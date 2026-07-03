
interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export default function Loader({ message = "Loading...", fullPage = false }: LoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
      {/* Circular spinner ring */}
      <div className="relative flex items-center justify-center mb-3">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
      
      {message && (
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1">
          {message}
        </span>
      )}
      <p className="text-[10px] text-gray-400 font-medium">Please wait...</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] animate-fadeIn">
        <div className="bg-white border border-gray-300 rounded shadow-xl p-6 flex flex-col items-center justify-center min-w-[240px] border-t-3 border-t-[#007bff] animate-scaleIn">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
