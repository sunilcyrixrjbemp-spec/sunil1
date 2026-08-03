import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { preloadRoute } from "../../utils/preload";
import { prefetchManager } from "../../utils/prefetchManager";
import brandLogo from "../../assets/images/brand.png";
import {
  Home,
  CheckSquare,
  FilePlus,
  BarChart3,
  Calendar,
  HelpCircle,
  User,
  LogOut,
  Settings,
  Menu,
  Lock,
  X,
  FileSpreadsheet,
  Gauge,
  UploadCloud,
  ShieldAlert,
  Package,
  Activity,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import ProgressLoader from "../common/ProgressLoader";
import Badge from "../common/Badge";

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Overview", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "new_dashboard", name: "Executive Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "db_monitor", name: "DB Health", path: "/db-monitor", icon: Activity, roles: ["Admin"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP", "Travel Desk", "MIS"] },
  { id: "expense", name: "Expense Claims", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP", "Accountant", "MIS"] },
  { id: "mis_report", name: "MIS Reports", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "kpi", name: "KPI Metrics", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "upload_data", name: "Data Import", path: "/upload-data", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS"] },
  { id: "asset_upload", name: "Asset Master", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
  { id: "penalty_report", name: "Penalty Audit", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP", "Travel Desk"] },
  { id: "analysis", name: "Deep Analytics", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"] },
  { id: "report", name: "Month Summary", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "consolidated_report", name: "Consolidated Reports", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "attendance", name: "Attendance Roster", path: "/attendance", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk", "Engineer"] },
  { id: "help", name: "Help & Support", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "profile", name: "My Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
];

const SIDEBAR_SECTIONS = [
  { label: "Workspace", ids: ["home", "new_dashboard"] },
  { label: "Claims & Approvals", ids: ["expense", "approval"] },
  { label: "Reports & Analytics", ids: ["attendance", "mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Administration", ids: ["admin", "db_monitor", "upload_data", "asset_upload"] },
  { label: "Account", ids: ["profile", "help"] },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsMobileScreen(isMobile);
      if (isMobile) setIsSidebarCollapsed(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate("/login");
    } else {
      setUser(currentUser);
      prefetchManager.triggerGlobalPrefetch(currentUser);
      authService.getProfile()
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

  if (!user) return <ProgressLoader message="Loading System..." fullPage />;

  const userRole = user.role || "Engineer";
  const isAdmin = ["Admin", "admin", "Super Admin", "super_admin"].includes(userRole);

  let allowedWindows: string[] = [];
  try {
    if (user?.allowed_windows) {
      if (Array.isArray(user.allowed_windows)) {
        allowedWindows = user.allowed_windows.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
      } else if (typeof user.allowed_windows === "string") {
        allowedWindows = user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
      }
    } else {
      if (isAdmin) {
        allowedWindows = MENU_ITEMS.map((item) => item.id.toLowerCase());
      } else {
        allowedWindows = ["home", "profile", "help", "expense"];
      }
    }
  } catch (_) {
    allowedWindows = ["home", "profile", "help", "expense"];
  }

  if (isAdmin) {
    MENU_ITEMS.forEach((item) => {
      const id = item.id.toLowerCase();
      if (!allowedWindows.includes(id)) allowedWindows.push(id);
    });
  }

  ["home", "profile", "help", "expense", "attendance"].forEach((w) => {
    if (!allowedWindows.includes(w)) allowedWindows.push(w);
  });

  const allowedMenuItems = MENU_ITEMS.filter((item) => {
    if (isMobileScreen && ["report", "consolidated_report", "mis_report"].includes(item.id.toLowerCase())) {
      return false;
    }
    return allowedWindows.includes(item.id.toLowerCase());
  });

  const handleLogout = async () => {
    prefetchManager.clearAllUserData();
    try {
      await authService.logout();
    } catch (e) {}
    navigate("/login", { replace: true });
  };

  const currentActiveItem = MENU_ITEMS.find((item) => {
    if (item.path === "/home" && location.pathname === "/home") return true;
    return item.path !== "/home" && location.pathname.startsWith(item.path);
  });

  const hasAccess = !currentActiveItem || allowedWindows.includes(currentActiveItem.id.toLowerCase());
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-300 shadow-xl ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <Link to="/home" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center shrink-0 shadow-md">
              <img src={brandLogo} alt="Cyrix Logo" className="w-6 h-6 object-contain" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-white text-base tracking-tight leading-tight">
                  CYRIX
                </span>
                <span className="text-[10px] text-accent-400 font-semibold uppercase tracking-wider">
                  Field Ops
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {SIDEBAR_SECTIONS.map((section) => {
            const sectionItems = allowedMenuItems.filter((item) => section.ids.includes(item.id));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    {section.label}
                  </p>
                )}
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentActiveItem?.id === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onMouseEnter={() => preloadRoute(item.path)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all group relative ${
                        isActive
                          ? "bg-accent-600 text-white font-semibold shadow-xs"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                      }`}
                      title={isSidebarCollapsed ? item.name : undefined}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                      {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-accent-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate">{user?.name || "Employee"}</span>
                  <span className="text-[10px] text-slate-400 truncate">{userRole}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop & Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-slate-900 text-slate-100 flex flex-col h-full z-10 shadow-2xl">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img src={brandLogo} alt="Cyrix Logo" className="w-7 h-7 object-contain" />
                <span className="font-bold text-white text-base">Cyrix FieldOps</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentActiveItem?.id === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive ? "bg-accent-600 text-white font-semibold" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-10 bg-white/95 backdrop-blur-md border-b border-border px-3 md:px-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center text-xs md:text-sm text-slate-700 font-semibold">
              <span>{currentActiveItem?.name || "Overview"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" size="sm" dot={false}>
              {userRole}
            </Badge>
            <Link to="/profile" className="flex items-center gap-2 border-l border-slate-200 pl-2">
              <div className="w-6 h-6 rounded-full bg-accent-100 text-accent-700 font-bold text-xs flex items-center justify-center border border-accent-200">
                {initials}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {!hasAccess ? (
            <div className="p-8 text-center bg-white border border-border rounded-xl shadow-xs my-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                You do not have administrative permissions to view this module. Please contact your manager or system administrator.
              </p>
              <Link to="/home" className="mt-4 inline-block px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium">
                Return to Home
              </Link>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
