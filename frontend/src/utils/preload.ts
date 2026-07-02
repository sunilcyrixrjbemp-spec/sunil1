const routePreloaders: Record<string, () => Promise<any>> = {
  "/home": () => import("../pages/HomePage"),
  "/approval": () => import("../pages/ApprovalPage"),
  "/submit-expense": () => import("../pages/ExpensePage"),
  "/mis-report": () => import("../pages/MISReportPage"),
  "/kpi-dashboard": () => import("../pages/KPIDashboardPage"),
  "/upload-data": () => import("../pages/UploadDataPage"),
  "/asset-upload": () => import("../pages/AssetUploadPage"),
  "/penalty-report": () => import("../pages/PenaltyReportPage"),
  "/analysis": () => import("../pages/AnalysisPage"),
  "/month-summary": () => import("../pages/MonthSummaryPage"),
  "/consolidated-report": () => import("../pages/ConsolidatedReportPage"),
  "/notifications": () => import("../pages/NotificationsPage"),
  "/help-center": () => import("../pages/HelpPage"),
  "/profile": () => import("../pages/ProfilePage"),
  "/admin": () => import("../pages/AdminPage"),
};

const preloadedSet = new Set<string>();

/**
 * Preloads the chunk for a given route path on hover.
 */
export const preloadRoute = (path: string) => {
  const cleanPath = path.split("?")[0].split("#")[0];
  if (preloadedSet.has(cleanPath)) return;
  
  const preloader = routePreloaders[cleanPath];
  if (preloader) {
    preloadedSet.add(cleanPath);
    console.log(`[Preload] Prefetching route chunk: ${cleanPath}`);
    preloader().catch((err) => {
      console.warn(`[Preload] Failed to prefetch route chunk for ${cleanPath}:`, err);
      preloadedSet.delete(cleanPath);
    });
  }
};
