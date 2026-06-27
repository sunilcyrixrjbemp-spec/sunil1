import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-5 animate-fade-in text-gray-800">
      <div className="h-16 w-16 rounded-full bg-red-50 border border-red-200 text-red-500 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-yellow-500 animate-bounce" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wider">404 - Page Not Found</h2>
        <p className="text-gray-500 text-xs max-w-sm mx-auto">
          The page you are looking for does not exist or you do not have permission to view it.
        </p>
      </div>
      <Link
        to="/home"
        className="inline-flex items-center justify-center h-9 px-4 rounded bg-[#007bff] hover:bg-[#0069d9] text-white text-xs font-bold shadow-sm transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}
