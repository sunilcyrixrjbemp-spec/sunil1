import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { tokenPersistence, nativeConfig } from "./utils/persistence";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { isNativeApp, biometricAuth } from "./utils/capacitor";
import { Fingerprint, Lock, ScanFace } from "lucide-react";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import ErrorBoundary from "./components/common/ErrorBoundary";
import NewDashboardPage from "./pages/NewDashboardPage";
import { ConfigProvider } from "antd";
import { antdTheme } from "./styles/themeConfig";

import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ApprovalPage from "./pages/ApprovalPage";
import ExpensePage from "./pages/ExpensePage";
import MISReportPage from "./pages/MISReportPage";
import KPIDashboardPage from "./pages/KPIDashboardPage";
import UploadDataPage from "./pages/UploadDataPage";
import AssetUploadPage from "./pages/AssetUploadPage";
import PenaltyModulePage from "./pages/PenaltyModulePage";
import AnalysisPage from "./pages/AnalysisPage";
import MonthSummaryPage from "./pages/MonthSummaryPage";
import ConsolidatedReportPage from "./pages/ConsolidatedReportPage";
import AttendancePage from "./pages/AttendancePage";
import NotificationsPage from "./pages/NotificationsPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import DBMonitoringPage from "./pages/DBMonitoringPage";
import NotFoundPage from "./pages/NotFoundPage";
import DesignSystemPage from "./pages/DesignSystemPage";
import AdminAnalyticsDashboard from "./pages/AdminAnalyticsDashboard";
import AdminEnterprisePage from "./pages/AdminEnterprisePage";

import ProgressLoader from "./components/common/ProgressLoader";
import InstallAppPrompt from "./components/common/InstallAppPrompt";

function PageLoader() {
  return <ProgressLoader message="Loading System..." fullPage />;
}
import { useFCMNotifications } from "./hooks/useFCMNotifications";
import { initOtaUpdates } from "./utils/otaUpdater";

function AppInner() {
  // Initialize FCM push notifications (requests permission + listens for foreground messages)
  useFCMNotifications();
  return null;
}

function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Back Online — Synced! 👍", {
        id: "offline-toast",
        duration: 3000,
        style: {
          background: "#d4edda",
          color: "#155724",
          border: "1px solid #c3e6cb",
        },
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.error("You are working offline. Drafts will be saved locally.", {
        id: "offline-toast",
        duration: 6000,
        style: {
          background: "#FCF6EB",
          color: "#B7791F",
          border: "1px solid #F1E1BC",
          borderLeft: "3px solid #B7791F",
        },
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Non-blocking prefetch of static master data on app startup
  useEffect(() => {
    initOtaUpdates();
    fetch("https://fieldops-api.sunilbishnoi.workers.dev/api/auth/dropdowns").catch(() => {});
  }, []);

  // Global cleanup handler to ensure body styles are clean on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
    };
  }, []);

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
    
    let isMounted = true;
    let activeListener: any = null;
    
    // Load @capacitor/app dynamically
    import('@capacitor/app').then(({ App: CapApp }) => {
      if (!isMounted) return;
      activeListener = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkAppLock();
        }
      });
    });
    
    return () => {
      isMounted = false;
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [checkAppLock]);

  if (isAppLocked) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 antialiased select-none"
        style={{ backgroundColor: "var(--canvas)" }}
      >
        <div
          className="w-full max-w-sm flex flex-col items-center space-y-8 text-center animate-fade-in"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 36,
          }}
        >
          {/* Brand Logo Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <img src="/brand.png" alt="Cyrix Logo" style={{ height: 52, width: "auto", objectFit: "contain" }} />
            <p
              className="m-0"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-300)" }}
            >
              Cyrix Field
            </p>
          </div>

          {/* Lock Icon */}
          <div className="relative">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 72, height: 72,
                backgroundColor: "var(--accent-50)",
                border: "1px solid var(--accent-100)",
              }}
            >
              <Lock style={{ width: 28, height: 28, color: "var(--accent-600)" }} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
              style={{
                width: 28, height: 28,
                backgroundColor: "var(--accent-600)",
                border: "2px solid var(--surface)",
              }}
            >
              {biometryType === 'face' ? <ScanFace style={{ width: 14, height: 14, color: "#ffffff" }} /> : <Fingerprint style={{ width: 14, height: 14, color: "#ffffff" }} />}
            </div>
          </div>

          {/* Status text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="m-0" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", fontFamily: "'Inter Tight', sans-serif" }}>App is Locked</p>
            <p className="m-0" style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: "20px", maxWidth: 280 }}>
              Please authenticate using your device's {biometryType === 'face' ? 'Face ID' : 'Fingerprint'} to access your workspace.
            </p>
          </div>

          {/* Unlock button */}
          <button
            type="button"
            onClick={triggerUnlock}
            className="btn-lte-primary w-full"
            style={{ height: 44, fontSize: 14, gap: 8 }}
          >
            {biometryType === 'face' ? <ScanFace style={{ width: 16, height: 16 }} /> : <Fingerprint style={{ width: 16, height: 16 }} />}
            <span>{biometryType === 'face' ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ConfigProvider theme={antdTheme}>
        <Router>
        <div className="min-h-screen antialiased relative" style={{ backgroundColor: "var(--canvas)", color: "var(--ink-900)" }}>
        {isOffline && (
          <div
            style={{ backgroundColor: "var(--pending-text)" }}
            className="sticky top-0 z-[9999] w-full text-white text-[11px] font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
            <span>Working Offline — Showing Cached Data</span>
          </div>
        )}
        {/* FCM notification system — runs silently in background */}
        <AppInner />
        <InstallAppPrompt />
        <Suspense fallback={<PageLoader />}>
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
                <Route path="/asset-upload" element={<AssetUploadPage />} />
                <Route path="/penalty-report" element={<PenaltyModulePage />} />
                <Route path="/penalty-module" element={<PenaltyModulePage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/new-dashboard" element={<NewDashboardPage />} />
                <Route path="/month-report" element={<MonthSummaryPage />} />
                <Route path="/consolidated-report" element={<ConsolidatedReportPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/help-center" element={<HelpPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsDashboard />} />
                <Route path="/admin/enterprise" element={<AdminEnterprisePage />} />
                <Route path="/db-monitor" element={<DBMonitoringPage />} />
                <Route path="/design-system" element={<DesignSystemPage />} />
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
        </Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#12151A",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "500",
              boxShadow: "0 4px 12px -2px rgba(18,21,26,0.20)",
            },
            success: {
              iconTheme: {
                primary: "#0F7A4C",
                secondary: "#FFFFFF",
              },
            },
            error: {
              iconTheme: {
                primary: "#B3261E",
                secondary: "#FFFFFF",
              },
            },
          }}
        />
        </div>
      </Router>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
