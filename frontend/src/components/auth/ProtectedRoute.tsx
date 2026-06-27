import { Navigate, Outlet } from "react-router-dom";
import { tokenPersistence } from "../../utils/persistence";
import { useState, useEffect } from "react";

export default function ProtectedRoute() {
  const [restoring, setRestoring] = useState(tokenPersistence.isRestoring());

  useEffect(() => {
    if (restoring) {
      tokenPersistence.restore().finally(() => {
        setRestoring(false);
      });
    }
  }, [restoring]);

  if (restoring) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  // Uses in-memory cache + cookie check — synchronous, no flicker
  if (!tokenPersistence.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
