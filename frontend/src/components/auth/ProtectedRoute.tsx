import { Navigate, Outlet } from "react-router-dom";
import { tokenPersistence } from "../../utils/persistence";

export default function ProtectedRoute() {
  // Uses in-memory cache + cookie check — synchronous, no flicker
  if (!tokenPersistence.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
