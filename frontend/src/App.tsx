import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { tokenPersistence, nativeConfig } from "./utils/persistence";
import { useState, useEffect, useCallback } from "react";
import { isNativeApp, biometricAuth } from "./utils/capacitor";
import { Fingerprint, Lock } from "lucide-react";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import HomePage from "./pages/HomePage";
import ApprovalPage from "./pages/ApprovalPage";
import ExpensePage from "./pages/ExpensePage";
import AnalysisPage from "./pages/AnalysisPage";
import MonthSummaryPage from "./pages/MonthSummaryPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useFCMNotifications } from "./hooks/useFCMNotifications";

function AppInner() {
  // Initialize FCM push notifications (requests permission + listens for foreground messages)
  useFCMNotifications();
  return null;
}

function App() {
  const [isAppLocked, setIsAppLocked] = useState(false);

  const triggerUnlock = useCallback(async () => {
    try {
      const type = await biometricAuth.getBiometryType();
      const typeLabel = type === 'face' ? 'Face ID' : 'Fingerprint';
      const result = await biometricAuth.authenticate(`Unlock Cyrix Field using ${typeLabel}`);
      if (result.success) {
        setIsAppLocked(false);
      }
    } catch (_) {}
  }, []);

  const checkAppLock = useCallback(async () => {
    if (!isNativeApp()) return;
    const isAuthenticated = tokenPersistence.isAuthenticated();
    const biometricEnabled = (await nativeConfig.get('biometric_login_enabled')) === 'true';
    
    if (isAuthenticated && biometricEnabled) {
      setIsAppLocked(true);
      // Trigger authentication immediately
      try {
        const type = await biometricAuth.getBiometryType();
        const typeLabel = type === 'face' ? 'Face ID' : 'Fingerprint';
        const result = await biometricAuth.authenticate(`Unlock Cyrix Field using ${typeLabel}`);
        if (result.success) {
          setIsAppLocked(false);
        }
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    
    // Check lock on startup
    checkAppLock();
    
    let activeListener: any = null;
    
    // Load @capacitor/app dynamically
    import('@capacitor/app').then(({ App: CapApp }) => {
      activeListener = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkAppLock();
        }
      });
    });
    
    return () => {
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [checkAppLock]);

  if (isAppLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans antialiased select-none">
        <div className="w-full max-w-sm flex flex-col items-center space-y-8 text-center">
          {/* Brand Logo Header */}
          <div className="space-y-2">
            <img src="/brand.png" alt="Cyrix Logo" className="h-16 w-auto object-contain mx-auto brightness-200" />
            <h2 className="text-lg font-bold text-slate-300 tracking-wider">CYRIX FIELD</h2>
          </div>

          {/* Secure Lock Badge */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-blue-500/20 flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10">
              <Lock className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-slate-950 shadow">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>

          {/* Locked Status Message */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-300">App is Locked</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please authenticate using your device's fingerprint or Face ID to access your workspace.
            </p>
          </div>

          {/* Action Button */}
          <div className="w-full pt-4">
            <button
              type="button"
              onClick={triggerUnlock}
              className="w-full h-11 flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all border-0 cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Unlock App</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#f4f6f9] text-[#212529] font-sans antialiased">
        {/* FCM notification system — runs silently in background */}
        <AppInner />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/approval-center" element={<ApprovalPage />} />
              <Route path="/submit-expense" element={<ExpensePage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/month-report" element={<MonthSummaryPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/help-center" element={<HelpPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/not-found" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* Navigation Fallbacks */}
          <Route path="/" element={
            tokenPersistence.isAuthenticated() 
              ? <Navigate to="/home" replace /> 
              : <Navigate to="/login" replace />
          } />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#FFFFFF",
              color: "#212529",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "600",
            },
            success: {
              iconTheme: {
                primary: "#28a745",
                secondary: "#FFFFFF",
              },
            },
            error: {
              iconTheme: {
                primary: "#dc3545",
                secondary: "#FFFFFF",
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
