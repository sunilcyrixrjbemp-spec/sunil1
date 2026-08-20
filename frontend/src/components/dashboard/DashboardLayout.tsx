import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { preloadRoute } from "../../utils/preload";
import { prefetchManager } from "../../utils/prefetchManager";
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
  Lock,
  X,
  FileSpreadsheet,
  Gauge,
  ShieldAlert,
  Package,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  UploadCloud,
  RotateCcw
} from "lucide-react";
import ProgressLoader from "../common/ProgressLoader";
import Badge from "../common/Badge";

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
  gradientFrom: string;
  gradientTo: string;
  shadowColor: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Overview", path: "/home", roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], icon: Home, gradientFrom: "from-blue-500", gradientTo: "to-indigo-600", shadowColor: "rgba(37, 99, 235, 0.35)" },
  { id: "new_dashboard", name: "Executive Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-violet-500", gradientTo: "to-purple-600", shadowColor: "rgba(124, 58, 237, 0.35)" },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"], gradientFrom: "from-slate-600", gradientTo: "to-slate-800", shadowColor: "rgba(100, 116, 139, 0.35)" },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP", "Travel Desk", "MIS"], gradientFrom: "from-amber-500", gradientTo: "to-orange-600", shadowColor: "rgba(245, 158, 11, 0.35)" },
  { id: "expense", name: "Expense Claims", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP", "Accountant", "MIS"], gradientFrom: "from-emerald-500", gradientTo: "to-teal-600", shadowColor: "rgba(16, 185, 129, 0.35)" },
  { id: "mis_report", name: "MIS Reports", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-cyan-500", gradientTo: "to-blue-600", shadowColor: "rgba(6, 182, 212, 0.35)" },
  { id: "kpi", name: "KPI Metrics", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-rose-500", gradientTo: "to-red-600", shadowColor: "rgba(244, 63, 94, 0.35)" },
  { id: "claim_level_reset", name: "Claim Level Reset", path: "/admin/claim-level-reset", icon: RotateCcw, roles: ["Admin"], gradientFrom: "from-amber-600", gradientTo: "to-orange-700", shadowColor: "rgba(217, 119, 6, 0.35)" },
  { id: "complaint_upload", name: "Complaint Upload", path: "/complaint-upload", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS", "Manager", "Division Manager", "Project Head", "Travel Desk", "VP", "Accountant"], gradientFrom: "from-indigo-600", gradientTo: "to-blue-700", shadowColor: "rgba(79, 70, 229, 0.35)" },
  { id: "asset_upload", name: "Asset Master", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"], gradientFrom: "from-pink-500", gradientTo: "to-rose-600", shadowColor: "rgba(236, 72, 153, 0.35)" },
  { id: "penalty_report", name: "Penalty Audit", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP", "Travel Desk"], gradientFrom: "from-red-500", gradientTo: "to-rose-700", shadowColor: "rgba(239, 68, 68, 0.35)" },
  { id: "analysis", name: "Deep Analytics", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"], gradientFrom: "from-indigo-500", gradientTo: "to-blue-700", shadowColor: "rgba(99, 102, 241, 0.35)" },
  { id: "report", name: "Month Summary", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"], gradientFrom: "from-teal-500", gradientTo: "to-emerald-600", shadowColor: "rgba(20, 184, 166, 0.35)" },
  { id: "consolidated_report", name: "Consolidated Reports", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"], gradientFrom: "from-sky-500", gradientTo: "to-blue-600", shadowColor: "rgba(14, 165, 233, 0.35)" },
  { id: "attendance", name: "Attendance Roster", path: "/attendance", icon: Calendar, roles: ["Admin"], gradientFrom: "from-indigo-500", gradientTo: "to-cyan-600", shadowColor: "rgba(99, 102, 241, 0.35)" },
  { id: "help", name: "Help & Support", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], gradientFrom: "from-purple-500", gradientTo: "to-violet-600", shadowColor: "rgba(167, 139, 250, 0.35)" },
  { id: "profile", name: "My Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], gradientFrom: "from-blue-500", gradientTo: "to-indigo-600", shadowColor: "rgba(96, 165, 250, 0.35)" },
];

const SIDEBAR_SECTIONS = [
  { label: "Workspace", ids: ["home", "new_dashboard"] },
  { label: "Claims & Approvals", ids: ["expense", "approval"] },
  { label: "Reports & Analytics", ids: ["attendance", "mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Administration", ids: ["admin", "claim_level_reset", "complaint_upload", "asset_upload"] },
  { label: "Account", ids: ["profile", "help"] },
];

// iOS-style gradient icon tile — matches HomePage IconTile component 1:1
const IconTile = ({
  icon: Icon,
  gradientFrom,
  gradientTo,
  shadowColor,
  isActive,
}: {
  icon: React.ComponentType<any>;
  gradientFrom: string;
  gradientTo: string;
  shadowColor: string;
  isActive: boolean;
}) => (
  <div
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "scale-105" : "opacity-80 group-hover:opacity-100 group-hover:scale-105"}`}
    style={{ boxShadow: isActive ? `0 2px 6px -1px ${shadowColor}` : "none" }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

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

  let allowedWindows: string[] = ["home", "expense", "help", "profile"];
  try {
    if (user?.allowed_windows !== undefined && user?.allowed_windows !== null) {
      if (Array.isArray(user.allowed_windows)) {
        allowedWindows = user.allowed_windows.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
      } else if (typeof user.allowed_windows === "string") {
        allowedWindows = user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
      }
    }
  } catch (_) {
    allowedWindows = ["home", "expense", "help", "profile"];
  }

  const allowedMenuItems = MENU_ITEMS.filter((item) => {
    if (isMobileScreen && ["report", "consolidated_report", "mis_report"].includes(item.id.toLowerCase())) {
      return false;
    }
    const idLower = item.id.toLowerCase();
    const roleLower = (user?.role || user?.designation || "").trim().toLowerCase();

    // 🔒 Admin sees ALL pages by default without exception
    if (roleLower === "admin" || user?.role === "Admin") {
      return true;
    }

    // Role-based allowance
    const itemRoles = (item.roles || []).map((r: string) => r.toLowerCase());
    if (itemRoles.includes(roleLower)) {
      return true;
    }

    return allowedWindows.includes(idLower);
  });

  const handleLogout = async () => {
    prefetchManager.clearAllUserData();
    try {
      await authService.logout();
    } catch (e) {}
    navigate("/login", { replace: true });
  };

  const currentActiveItem = [...MENU_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => {
      if (item.path === "/home") return location.pathname === "/home";
      return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
    });

  const roleLower = (user?.role || user?.designation || "").trim().toLowerCase();
  const isAdmin = roleLower === "admin" || user?.role === "Admin";

  const hasAccess =
    isAdmin ||
    !currentActiveItem ||
    allowedWindows.includes(currentActiveItem.id.toLowerCase()) ||
    (currentActiveItem.roles && currentActiveItem.roles.map((r: string) => r.toLowerCase()).includes(roleLower));
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar - Exact Ditto HomePage Background & Card Format */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-slate-50 border-r border-slate-200/90 transition-all duration-300 shadow-xs ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* HomePage Exact Dark Slate-Blue Header Bar (#4A6A8A) */}
        <div className={`h-14 bg-[#4A6A8A] flex items-center border-b border-[#3B546F] shrink-0 text-white shadow-2xs transition-all duration-300 ${
          isSidebarCollapsed ? "px-1.5 justify-between" : "px-3.5 justify-between"
        }`}>
          <Link to="/home" className="flex items-center gap-2 overflow-hidden min-w-0">
            <div className={`bg-white/95 rounded-lg shadow-2xs flex items-center justify-center shrink-0 transition-all ${
              isSidebarCollapsed ? "p-1 w-9 h-8 overflow-hidden" : "px-2 py-1"
            }`}>
              <img
                src="/logo-fieldconnect.png"
                alt="Cyrix Field Connect"
                className={`object-contain transition-all ${
                  isSidebarCollapsed ? "h-6 w-auto max-w-full" : "h-6 w-auto max-w-[160px]"
                }`}
                style={{ height: "24px", maxHeight: "24px", objectFit: "contain" }}
                height="24"
              />
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer hidden md:flex items-center justify-center shrink-0"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {SIDEBAR_SECTIONS.map((section) => {
            const sectionItems = allowedMenuItems.filter((item) => section.ids.includes(item.id));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-bold tracking-wider text-slate-500 uppercase">
                    {section.label}
                  </p>
                )}
                {sectionItems.map((item) => {
                  const isActive = currentActiveItem?.id === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onMouseEnter={() => preloadRoute(item.path)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all group relative border ${
                        isActive
                          ? "bg-[#4A6A8A] text-white border-[#3B546F] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-transparent"
                      }`}
                      title={isSidebarCollapsed ? item.name : undefined}
                    >
                      <IconTile
                        icon={item.icon}
                        gradientFrom={item.gradientFrom}
                        gradientTo={item.gradientTo}
                        shadowColor={item.shadowColor}
                        isActive={isActive}
                      />
                      {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                      {isSidebarCollapsed && isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#4A6A8A] rounded-l-full" />
                      )}
                      {!isSidebarCollapsed && isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200/90 bg-white shrink-0">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-md bg-[#4A6A8A] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0 leading-none">
                  <span className="text-[11px] font-bold text-slate-800 truncate">{user?.name || "Employee"}</span>
                  <span className="text-[9.5px] text-slate-500 truncate mt-0.5">{userRole}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop & Slide-Up Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-full max-h-[85vh] bg-slate-50 text-slate-800 flex flex-col z-10 shadow-2xl rounded-t-2xl border-t border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Drawer Drag Handle + Header */}
            <div className="pt-2 pb-3 px-4 bg-[#4A6A8A] flex flex-col text-white shrink-0 shadow-xs">
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/95 px-2.5 py-1 rounded-lg shadow-xs flex items-center shrink-0">
                    <img src="/logo-fieldconnect.png" alt="Cyrix Field Connect Logo" className="h-7 w-auto max-w-[170px] object-contain" style={{ height: "28px", maxHeight: "28px", maxWidth: "170px", objectFit: "contain" }} height="28" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/80 font-normal">All Application Menus & Services</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer All Menus Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {SIDEBAR_SECTIONS.map((section) => {
                const sectionItems = allowedMenuItems.filter((item) => section.ids.includes(item.id));
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section.label} className="space-y-2">
                    <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1">
                      {section.label}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sectionItems.map((item) => {
                        const isActive = currentActiveItem?.id === item.id;
                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all border ${
                              isActive
                                ? "bg-[#4A6A8A] text-white border-[#3B546F] shadow-xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80 shadow-2xs"
                            }`}
                          >
                            <IconTile
                              icon={item.icon}
                              gradientFrom={item.gradientFrom}
                              gradientTo={item.gradientTo}
                              shadowColor={item.shadowColor}
                              isActive={isActive}
                            />
                            <span className="truncate text-[11px]">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* User Profile Summary & Logout */}
              <div className="pt-3 border-t border-slate-200/90 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[#4A6A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0 leading-none">
                    <span className="text-xs font-bold text-slate-800 truncate">{user?.name || "Employee"}</span>
                    <span className="text-[10px] text-slate-500 truncate mt-0.5">{userRole}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer border border-rose-200/80"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
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
            <div className="flex items-center text-xs md:text-sm text-slate-700 font-semibold">
              <span>{currentActiveItem?.name || "Overview"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" size="sm" dot={false}>
              {userRole}
            </Badge>
            <Link to="/profile" className="flex items-center gap-2 border-l border-slate-200 pl-2">
              <div className="w-6 h-6 rounded-full bg-[#4A6A8A] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {initials}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Area - Bottom padding for mobile bottom bar */}
        <main className="flex-1 p-2 md:p-4 w-full max-w-full mx-auto pb-28 lg:pb-4">
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

        {/* Mobile Bottom Navigation Bar - Replaces 3-Line Top Hamburger Menu */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-1 px-2 flex items-center justify-around lg:hidden shadow-lg">
          {allowedWindows.includes("home") && (
            <Link
              to="/home"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                location.pathname === "/home"
                  ? "text-blue-600 bg-blue-50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
          )}

          {allowedWindows.includes("expense") && (
            <Link
              to="/submit-expense"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                location.pathname.startsWith("/submit-expense")
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FilePlus className="w-4 h-4" />
              <span>Expense</span>
            </Link>
          )}

          {allowedWindows.includes("approval") && (
            <Link
              to="/approval-center"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                location.pathname.startsWith("/approval-center")
                  ? "text-amber-600 bg-amber-50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Approval</span>
            </Link>
          )}

          {allowedWindows.includes("profile") && (
            <Link
              to="/profile"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                location.pathname.startsWith("/profile")
                  ? "text-purple-600 bg-purple-50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>
          )}

          {/* 9-Dot Bento Grid "More" Button to Open All Menus */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              isMobileMenuOpen
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="All Menus & Services"
          >
            <LayoutGrid className="w-4 h-4 stroke-[2.5]" />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
