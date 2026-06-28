import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { tokenPersistence, nativeConfig } from "./utils/persistence";
import { useState, useEffect, useCallback, useRef } from "react";
import { isNativeApp, biometricAuth } from "./utils/capacitor";
import { Fingerprint, Lock, ScanFace } from "lucide-react";
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
import MISReportPage from "./pages/MISReportPage";
import KPIDashboardPage from "./pages/KPIDashboardPage";
import UploadDataPage from "./pages/UploadDataPage";
import PenaltyReportPage from "./pages/PenaltyReportPage";
import { useFCMNotifications } from "./hooks/useFCMNotifications";

function AppInner() {
  // Initialize FCM push notifications (requests permission + listens for foreground messages)
  useFCMNotifications();
  return null;
}

function App() {
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [biometryType, setBiometryType] = useState<'fingerprint' | 'face' | 'none'>('fingerprint');
  const isLockedRef = useRef(false);
  const isPromptingRef = useRef(false);
  const lastUnlockedRef = useRef(0);

  const triggerUnlock = useCallback(async () => {
    if (isPromptingRef.current) return;
    try {
      isPromptingRef.current = true;
      const type = await biometricAuth.getBiometryType();
      setBiometryType(type);
      const typeLabel = type === 'face' ? 'Face ID' : 'Fingerprint';
      const result = await biometricAuth.authenticate(`Unlock Cyrix Field using ${typeLabel}`);
      if (result.success) {
        setIsAppLocked(false);
        isLockedRef.current = false;
        lastUnlockedRef.current = Date.now(); // Set cool-down timestamp!
      }
    } catch (_) {
    } finally {
      isPromptingRef.current = false;
    }
  }, []);

  const checkAppLock = useCallback(async () => {
    if (!isNativeApp()) return;
    
    // Check cool-down (do not lock again if unlocked less than 4 seconds ago)
    if (Date.now() - lastUnlockedRef.current < 4000) {
      console.log("[Lock] Skipping app lock: within cool-down period");
      return;
    }

    // Bypass if already locked or currently prompting
    if (isLockedRef.current || isPromptingRef.current) return;

    const isAuthenticated = tokenPersistence.isAuthenticated();
    const biometricEnabled = (await nativeConfig.get('biometric_login_enabled')) === 'true';
    
    if (isAuthenticated && biometricEnabled) {
      setIsAppLocked(true);
      isLockedRef.current = true;

      try {
        const type = await biometricAuth.getBiometryType();
        setBiometryType(type);
      } catch (_) {}
      
      // Delay slightly to let the locked UI render before showing native biometric dialog
      setTimeout(() => {
        triggerUnlock();
      }, 150);
    }
  }, [triggerUnlock]);

  useEffect(() => {
    if (!isNativeApp()) return;
    
    // Check lock on startup
    checkAppLock();

    // Sync FCM push token on startup
    import("./utils/capacitor").then(({ syncFCMToken }) => {
      syncFCMToken();
    }).catch(() => {});
    
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
      <div className="min-h-screen bg-[#e9ecef] flex flex-col items-center justify-center p-6 text-gray-800 font-sans antialiased select-none">
        <div className="w-full max-w-sm flex flex-col items-center space-y-8 text-center bg-white p-8 rounded-lg shadow-md border border-gray-200 animate-fadeIn">
          {/* Brand Logo Header */}
          <div className="space-y-2">
            <img src="/brand.png" alt="Cyrix Logo" className="h-16 w-auto object-contain mx-auto" />
            <h2 className="text-sm font-bold text-gray-400 tracking-wider">CYRIX FIELD</h2>
          </div>

          {/* Secure Lock Badge */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm">
              <Lock className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-white shadow">
              {biometryType === 'face' ? <ScanFace className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
            </div>
          </div>

          {/* Locked Status Message */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700">App is Locked</p>
            <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
              Please authenticate using your device's {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} to access your workspace.
            </p>
          </div>

          {/* Action Button */}
          <div className="w-full pt-4">
            <button
              type="button"
              onClick={triggerUnlock}
              className="w-full h-11 flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-all border-0 cursor-pointer"
            >
              {biometryType === 'face' ? <ScanFace className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
              <span>{biometryType === 'face' ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}</span>
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
              <Route path="/mis-report" element={<MISReportPage />} />
              <Route path="/kpi-dashboard" element={<KPIDashboardPage />} />
              <Route path="/upload-data" element={<UploadDataPage />} />
              <Route path="/penalty-report" element={<PenaltyReportPage />} />
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
