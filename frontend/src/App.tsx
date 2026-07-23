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
import PenaltyReportPage from "./pages/PenaltyReportPage";
import AnalysisPage from "./pages/AnalysisPage";
import MonthSummaryPage from "./pages/MonthSummaryPage";
import ConsolidatedReportPage from "./pages/ConsolidatedReportPage";
import NotificationsPage from "./pages/NotificationsPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import DBMonitoringPage from "./pages/DBMonitoringPage";
import NotFoundPage from "./pages/NotFoundPage";
import DesignSystemPage from "./pages/DesignSystemPage";

import ProgressLoader from "./components/common/ProgressLoader";

function PageLoader() {
  return <ProgressLoader message="Loading System..." fullPage />;
}
import { useFCMNotifications } from "./hooks/useFCMNotifications";

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
          background: "#fff3cd",
          color: "#856404",
          border: "1px solid #ffeeba",
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

  // Non-blocking ping to wake up free-tier backend server instantly on app startup
  useEffect(() => {
    fetch("https://fieldops-secondary-api.sunilbishnoi.workers.dev/api/health").catch(() => {});
  }, []);

  // Prevent background body scrolling when any modal is open
  // AND auto-scroll all modal scrollable containers back to top when modal opens
  useEffect(() => {
    // Track which modals we have already reset scroll for (to avoid re-triggering)
    const resetScrollForModal = (modal: Element) => {
      // Reset the overlay itself (if it is the scroll container)
      modal.scrollTop = 0;
      // Reset every inner scrollable area: flex-1 overflow-y-auto, overflow-y-auto, etc.
      const scrollables = modal.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-y-scroll"]');
      scrollables.forEach((el) => {
        (el as HTMLElement).scrollTop = 0;
      });
    };

    let lockTimer: any = null;
    const debouncedHandleScrollLock = () => {
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        const modals = document.querySelectorAll('.modal-lte-overlay, .ant-modal-wrap, [class*="fixed"][class*="inset-0"][class*="bg-black/"]');
        if (modals.length > 0) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      }, 150);
    };

    debouncedHandleScrollLock();

    const observer = new MutationObserver((mutations) => {
      debouncedHandleScrollLock();
      // For every newly ADDED node, check if it is a modal root overlay
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) continue;
          
          const classNameStr = typeof node.className === 'string' ? node.className : '';
          const isModalRoot = 
            node.classList.contains('modal-lte-overlay') ||
            node.classList.contains('ant-modal-wrap') ||
            node.classList.contains('approval-review-modal-wrap') ||
            node.classList.contains('my-claims-modal-wrap') ||
            (classNameStr.includes('fixed') && classNameStr.includes('inset-0'));

          // FIX B: Only reset scroll when an actual modal root is initially mounted
          if (isModalRoot) {
            resetScrollForModal(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => {
      if (lockTimer) clearTimeout(lockTimer);
      observer.disconnect();
      document.body.style.overflow = '';
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
    <ErrorBoundary>
      <ConfigProvider theme={antdTheme}>
        <Router>
        <div className="min-h-screen bg-[#f4f6f9] text-[#212529] font-sans antialiased relative">
        {isOffline && (
          <div 
            style={{ 
              background: "linear-gradient(90deg, #f59e0b, #ea580c)",
              boxShadow: "0 2px 10px rgba(234, 88, 12, 0.25)"
            }}
            className="sticky top-0 z-[9999] w-full text-white text-[10px] font-extrabold uppercase tracking-wider py-1.5 px-4 text-center flex items-center justify-center gap-2 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
            <span>Working Offline — Showing Cached Data</span>
          </div>
        )}
        {/* FCM notification system — runs silently in background */}
        <AppInner />
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
                <Route path="/penalty-report" element={<PenaltyReportPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/new-dashboard" element={<NewDashboardPage />} />
                <Route path="/month-report" element={<MonthSummaryPage />} />
                <Route path="/consolidated-report" element={<ConsolidatedReportPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/help-center" element={<HelpPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
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
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
