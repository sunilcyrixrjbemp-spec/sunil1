import { useState, useEffect, useMemo } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { prefetchManager } from "../../utils/prefetchManager";
import { Lock, ArrowLeft } from "lucide-react";
import ProgressLoader from "../common/ProgressLoader";
import Sidebar, { NAV_SECTIONS, NavSection, NavItem } from "../common/Sidebar";
import Navbar from "../common/Navbar";
import MobileBottomNav from "../common/MobileBottomNav";
import MobileNavDrawer from "../common/MobileNavDrawer";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch (_) {
      return false;
    }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isRouteNavigating, setIsRouteNavigating] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    // Trigger 2px top route progress indicator
    setIsRouteNavigating(true);
    const timer = setTimeout(() => {
      setIsRouteNavigating(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Persist sidebar collapse state
  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch (_) {}
      return next;
    });
  };

  // User Authentication & Profile Loading
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate("/login", { replace: true });
    } else {
      setUser(currentUser);
      prefetchManager.triggerGlobalPrefetch(currentUser);
      authService
        .getProfile()
        .then((freshProfile) => {
          if (freshProfile) {
            localStorage.setItem("user", JSON.stringify(freshProfile));
            setUser(freshProfile);
            prefetchManager.triggerGlobalPrefetch(freshProfile);
          }
        })
        .catch(() => {});
    }
  }, [navigate]);

  // Parse allowed_windows permissions
  const allowedWindows: string[] = useMemo(() => {
    if (!user) return ["home", "expense", "help", "profile"];
    try {
      if (user.allowed_windows !== undefined && user.allowed_windows !== null) {
        if (Array.isArray(user.allowed_windows)) {
          return user.allowed_windows.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
        } else if (typeof user.allowed_windows === "string") {
          return user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
        }
      }
      if (user.window_permissions) {
        const perms = typeof user.window_permissions === "string"
          ? JSON.parse(user.window_permissions)
          : user.window_permissions;
        if (Array.isArray(perms)) {
          return perms.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
        }
      }
    } catch (_) {}
    return ["home", "expense", "help", "profile"];
  }, [user]);

  const userRole = user?.role || user?.designation || "Engineer";
  const roleLower = (userRole || "").trim().toLowerCase();
  const isAdmin = roleLower === "admin" || user?.role === "Admin";

  // Calculate unread notification count
  const unreadCount = useMemo(() => {
    if (!user?.user_id) return 0;
    try {
      const cached = localStorage.getItem(`notifications_${user.user_id}`);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          return list.filter((n: any) => !n.read).length;
        }
      }
    } catch (_) {}
    return 0;
  }, [user?.user_id, location.pathname]);

  const handleLogout = async () => {
    prefetchManager.clearAllUserData();
    try {
      await authService.logout();
    } catch (e) {}
    navigate("/login", { replace: true });
  };

  // Flatten all NAV_SECTIONS items for route permission checking
  const allNavItems = useMemo(() => {
    const items: NavItem[] = [];
    NAV_SECTIONS.forEach((sec: NavSection) => items.push(...sec.items));
    return items;
  }, []);

  // Determine current active item for permissions gating
  const currentActiveItem = useMemo(() => {
    const currentPath = location.pathname;
    return [...allNavItems]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => {
        if (item.path === "/home") return currentPath === "/home" || currentPath === "/";
        return currentPath === item.path || currentPath.startsWith(item.path + "/");
      });
  }, [allNavItems, location.pathname]);

  // Permission Check for current route
  const hasAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!currentActiveItem) return true;
    if (currentActiveItem.roles && !currentActiveItem.roles.map((r) => r.toLowerCase()).includes(roleLower)) {
      return false;
    }
    const idLower = currentActiveItem.id.toLowerCase();
    return allowedWindows.includes(idLower);
  }, [isAdmin, currentActiveItem, roleLower, allowedWindows]);

  if (!user) {
    return <ProgressLoader message="Loading System..." fullPage />;
  }

  return (
    <div className="min-h-screen bg-canvas flex text-ink-900 font-sans antialiased">
      {/* 2px Fixed Top Route Progress Bar */}
      <div
        className={`fixed top-0 left-0 right-0 h-[2px] z-50 bg-accent-600 transition-all duration-300 pointer-events-none ${
          isRouteNavigating ? "opacity-100 w-full" : "opacity-0 w-0"
        }`}
      />

      {/* Desktop/Tablet Sidebar Navigation (hidden on mobile < 1024px) */}
      <div className="hidden lg:block">
        <Sidebar
          userRole={userRole}
          userName={user.name || "Employee"}
          userEmail={user.email}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onLogout={handleLogout}
          allowedWindows={allowedWindows}
        />
      </div>

      {/* Mobile Slide-in Drawer Navigation (triggered by Navbar hamburger) */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        userName={user.name || "Employee"}
        userRole={userRole}
        allowedWindows={allowedWindows}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      {/* Main Page Area (offset by Sidebar width on desktop) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "lg:ml-[48px]" : "lg:ml-[240px]"
        }`}
      >
        {/* Top Navbar */}
        <Navbar
          userName={user.name || "Employee"}
          userRole={userRole}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          unreadCount={unreadCount}
          onLogout={handleLogout}
        />

        {/* Content Container on #FAFAF9 Canvas */}
        <main className="flex-1 bg-canvas p-4 md:p-6 max-w-7xl mx-auto w-full pb-24 lg:pb-6">
          {!hasAccess ? (
            <div className="card-lte max-w-lg mx-auto my-12 p-6 sm:p-8 text-center bg-surface border border-line rounded-lg shadow-none">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="font-display text-lg font-bold text-ink-900 tracking-tight">
                Access Restricted
              </h2>
              <p className="text-xs md:text-sm text-ink-500 mt-2 max-w-sm mx-auto leading-relaxed">
                You do not have administrative permissions to view this module (
                <span className="font-semibold text-ink-700">
                  {currentActiveItem?.name || location.pathname}
                </span>
                ). Please contact your administrator for access.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  to="/home"
                  className="btn-lte-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 rounded-md transition-colors shadow-none"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Overview
                </Link>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Mobile Fixed Bottom Tab Bar (< 1024px) */}
        <MobileBottomNav
          unreadCount={unreadCount}
          allowedWindows={allowedWindows}
          isAdmin={isAdmin}
          onOpenMoreMenu={() => setIsMobileMenuOpen(true)}
        />
      </div>
    </div>
  );
}
