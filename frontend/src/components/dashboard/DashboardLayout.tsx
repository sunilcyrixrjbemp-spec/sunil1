import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { preloadRoute } from "../../utils/preload";
import { prefetchManager } from "../../utils/prefetchManager";
import api from "../../services/api";
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
  TrendingUp
} from "lucide-react";
import ProgressLoader from "../common/ProgressLoader";
import { CurrentTimeWidget } from "../common/CurrentTimeWidget";
import Footer from "../common/Footer";


interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Home", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "new_dashboard", name: "New Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "db_monitor", name: "DB Monitor", path: "/db-monitor", icon: Activity, roles: ["Admin"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP", "Travel Desk", "MIS"] },
  { id: "expense", name: "Submit Expense", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP", "Accountant", "MIS"] },
  { id: "mis_report", name: "MIS Report", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "kpi", name: "KPI Dashboard", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "upload_data", name: "Upload Data", path: "/upload-data", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS"] },
  { id: "asset_upload", name: "Asset Inventory", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
  { id: "penalty_report", name: "Penalty Report", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP", "Travel Desk"] },
  { id: "analysis", name: "Analysis", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"] },
  { id: "report", name: "Month Report", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "consolidated_report", name: "Consolidated Report", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "help", name: "Help Center", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "profile", name: "Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
];

const HomeSvgIcon = ({ active }: { active?: boolean }) => (
  <svg className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} viewBox="0 0 24 24" fill="none">
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z" 
      fill={active ? "#2563eb" : "#94a3b8"} 
      stroke={active ? "#1d4ed8" : "#64748b"} 
      strokeWidth="1.8" 
      strokeLinejoin="round" 
    />
  </svg>
);

const ClaimSvgIcon = ({ active }: { active?: boolean }) => (
  <svg className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" 
      fill={active ? "#16a34a" : "#94a3b8"} 
      stroke={active ? "#15803d" : "#64748b"} 
      strokeWidth="1.8" 
    />
    <path d="M12 8v8M8 12h8" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const ApprovalSvgIcon = ({ active }: { active?: boolean }) => (
  <svg className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" 
      fill={active ? "#7c3aed" : "#94a3b8"} 
      stroke={active ? "#6d28d9" : "#64748b"} 
      strokeWidth="1.8" 
    />
    <path d="M8.5 12.5l2.5 2.5 5-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ProfileSvgIcon = ({ active }: { active?: boolean }) => (
  <svg className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" 
      fill={active ? "#d97706" : "#94a3b8"} 
      stroke={active ? "#b45309" : "#64748b"} 
      strokeWidth="1.8" 
    />
    <path d="M20 21a8 8 0 10-16 0" 
      stroke={active ? "#d97706" : "#64748b"} 
      strokeWidth="2.2" 
      strokeLinecap="round" 
    />
  </svg>
);

const MoreSvgIcon = ({ active }: { active?: boolean }) => (
  <svg className={`w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="5" height="5" rx="1.5" fill={active ? "#0284c7" : "#64748b"} />
    <rect x="10.5" y="3" width="5" height="5" rx="1.5" fill={active ? "#2563eb" : "#64748b"} />
    <rect x="18" y="3" width="3" height="5" rx="1" fill={active ? "#7c3aed" : "#94a3b8"} />
    <rect x="3" y="10.5" width="5" height="5" rx="1.5" fill={active ? "#16a34a" : "#64748b"} />
    <rect x="10.5" y="10.5" width="5" height="5" rx="1.5" fill={active ? "#d97706" : "#64748b"} />
    <rect x="18" y="10.5" width="3" height="5" rx="1" fill={active ? "#dc2626" : "#94a3b8"} />
    <rect x="3" y="18" width="5" height="3" rx="1" fill={active ? "#db2777" : "#94a3b8"} />
    <rect x="10.5" y="18" width="5" height="3" rx="1" fill={active ? "#4f46e5" : "#94a3b8"} />
    <rect x="18" y="18" width="3" height="3" rx="1" fill={active ? "#0d9488" : "#94a3b8"} />
  </svg>
);

const ITEM_GRADIENTS: Record<string, string> = {
  home: "bg-primary-600 text-white shadow-xs",
  new_dashboard: "bg-blue-600 text-white shadow-xs",
  admin: "bg-slate-800 text-white shadow-xs",
  db_monitor: "bg-amber-600 text-white shadow-xs",
  approval: "bg-purple-600 text-white shadow-xs",
  expense: "bg-emerald-600 text-white shadow-xs",
  mis_report: "bg-teal-600 text-white shadow-xs",
  kpi: "bg-rose-600 text-white shadow-xs",
  upload_data: "bg-sky-600 text-white shadow-xs",
  asset_upload: "bg-amber-500 text-white shadow-xs",
  penalty_report: "bg-red-600 text-white shadow-xs",
  analysis: "bg-indigo-600 text-white shadow-xs",
  report: "bg-violet-600 text-white shadow-xs",
  consolidated_report: "bg-teal-600 text-white shadow-xs",
  help: "bg-green-600 text-white shadow-xs",
  profile: "bg-amber-600 text-white shadow-xs"
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024);
  const [navLoading, setNavLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsMobileScreen(isMobile);
      if (isMobile) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
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
        .then(freshProfile => {
          if (freshProfile) {
            localStorage.setItem("user", JSON.stringify(freshProfile));
            setUser(freshProfile);
            window.dispatchEvent(new Event("user-profile-synced"));
            prefetchManager.triggerGlobalPrefetch(freshProfile);
          }
        })
        .catch(err => console.warn("Failed to sync profile on mount:", err));
    }
  }, [navigate]);

  useEffect(() => {
    const handleStorageChange = () => {
      const freshUser = authService.getCurrentUser();
      if (freshUser) {
        setUser(freshUser);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!user || !user.profile_pic_url) {
      setAvatarUrl(null);
      setAvatarError(false);
      return;
    }
    
    setAvatarError(false);
    const cacheKey = `cached_avatar_${user.user_id || user.id || 'default'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAvatarUrl(cached);
    } else {
      setAvatarUrl(authService.getAbsoluteImageUrl(user.profile_pic_url));
    }
    
    const preloadImage = async () => {
      try {
        const absoluteUrl = authService.getAbsoluteImageUrl(user.profile_pic_url);
        if (!absoluteUrl) return;
        
        const path = absoluteUrl.replace(api.defaults.baseURL || "", "");
        const res = await api.get(path, { responseType: 'blob' });
        const blob = res.data;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          localStorage.setItem(cacheKey, base64);
          setAvatarUrl(base64);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
      }
    };
    preloadImage();
  }, [user?.profile_pic_url, user?.user_id, user?.id]);

  if (!user) return <ProgressLoader message="Initializing Workspace..." fullPage />;

  const userRole = user.role || "Engineer";
  const isAdmin = ["Admin", "admin", "Super Admin", "super_admin"].includes(userRole);

  let allowedWindows: string[] = [];
  try {
    if (user && user.allowed_windows !== undefined && user.allowed_windows !== null && user.allowed_windows !== "") {
      if (Array.isArray(user.allowed_windows)) {
        allowedWindows = user.allowed_windows.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
      } else if (typeof user.allowed_windows === "string") {
        allowedWindows = user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
      }
    } else {
      if (isAdmin) {
        allowedWindows = MENU_ITEMS.map(item => item.id.toLowerCase());
      } else {
        allowedWindows = ["home", "profile", "help", "expense"];
      }
    }
  } catch (_) {
    allowedWindows = ["home", "profile", "help", "expense"];
  }

  ["home", "profile", "help", "expense"].forEach(w => {
    if (!allowedWindows.includes(w)) {
      allowedWindows.push(w);
    }
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
    } catch (e) {
      console.warn("Logout error:", e);
    }
    navigate("/login", { replace: true });
  };

  const currentActiveItem = MENU_ITEMS.find((item) => {
    if (item.path === "/home" && location.pathname === "/home") return true;
    return item.path !== "/home" && location.pathname.startsWith(item.path);
  });

  const hasAccess = 
    !currentActiveItem || 
    allowedWindows.includes(currentActiveItem.id.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
      {/* SIDEBAR - DESKTOP ONLY */}
      <aside className={`hidden lg:flex flex-col bg-slate-900 text-slate-300 transition-all duration-200 ${
        isSidebarCollapsed ? "w-16" : "w-60"
      } sticky top-0 h-screen shrink-0 z-30 shadow-md border-r border-slate-800`}>
        
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-center border-b border-slate-800/80 px-4 bg-slate-950/60 shrink-0 overflow-hidden">
          <Link to="/home" className="flex items-center gap-2.5 font-bold text-white truncate no-underline">
            <img src={brandLogo} alt="Cyrix Logo" className="h-8 w-8 object-contain shrink-0 rounded bg-white p-1" />
            {!isSidebarCollapsed && (
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Cyrix Healthcare
              </span>
            )}
          </Link>
        </div>

        {/* User Profile Info */}
        <div className="p-3.5 border-b border-slate-800/80 shrink-0">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-xs shrink-0 overflow-hidden">
              {avatarUrl && !avatarError ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  className="h-full w-full object-cover" 
                  onError={() => setAvatarError(true)}
                />
              ) : (
                user?.name ? user.name.charAt(0).toUpperCase() : "U"
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate m-0">{user?.name || "Employee"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{userRole}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {!isSidebarCollapsed && (
            <span className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Menu Navigation
            </span>
          )}
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentActiveItem?.id === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                onMouseEnter={() => preloadRoute(item.path)}
                title={isSidebarCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 rounded-lg no-underline group ${
                  isActive
                    ? "bg-primary-600 text-white font-bold shadow-xs"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className={`${isActive ? "text-white" : "text-slate-400 group-hover:text-white"} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-2 border-t border-slate-800/80 shrink-0">
          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Log Out" : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-rose-600/20 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {!isSidebarCollapsed && <span className="uppercase tracking-wider font-bold">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        
        {/* TOP NAVBAR - ENTERPRISE HEADER */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 md:px-5 sticky top-0 z-40 shrink-0 shadow-xs">
          
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all border-0 bg-transparent cursor-pointer"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Ant Design Section Pill Header */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1 text-white shadow-2xs">
              {currentActiveItem && currentActiveItem.icon && (
                <currentActiveItem.icon className="w-4 h-4 text-primary-400 shrink-0 stroke-[2.5]" />
              )}
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white uppercase tracking-wider truncate max-w-[150px] sm:max-w-[240px] md:max-w-none m-0 leading-none">
                {currentActiveItem ? currentActiveItem.name : "Dashboard"}
              </h1>
            </div>
          </div>

          {/* Right Actions — Live IST Clock, User Avatar & Framed Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <CurrentTimeWidget variant="navbar" className="hidden sm:flex" />
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-2 p-1 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 text-white transition-all no-underline shadow-2xs"
            >
              <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs overflow-hidden">
                {avatarUrl && !avatarError ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
                ) : (
                  user?.name ? user.name.charAt(0).toUpperCase() : "U"
                )}
              </div>
              <span className="text-xs font-bold text-slate-200 hidden lg:inline max-w-[100px] truncate pr-1">{user?.name?.split(" ")[0]}</span>
            </Link>

            <div className="bg-white rounded-lg px-2 py-1 shadow-2xs border border-slate-200/80 flex items-center justify-center">
              <img 
                src={brandLogo} 
                alt="Cyrix" 
                className="h-6 sm:h-7 lg:h-8 w-auto max-w-[85px] sm:max-w-[105px] lg:max-w-[120px] object-contain" 
              />
            </div>
          </div>
        </header>

        {/* MAIN AREA WORKSPACE */}
        <main className="flex-1 p-2 sm:p-4 pb-16 lg:pb-4 overflow-y-auto min-w-0 overflow-x-hidden w-full">
          {hasAccess ? (
            <>
              <Outlet />
              <Footer />
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-xs p-6 text-center space-y-4 animate-fade-in border-t-4 border-t-rose-600">
                <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
                  <Lock className="w-6 h-6" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Access Denied</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    You do not have permission to view the <span className="text-primary-600 font-semibold">"{currentActiveItem?.name}"</span> screen. Please contact your system administrator to adjust your permitted windows.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => navigate("/home")}
                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold transition-all border-0 cursor-pointer shadow-2xs"
                  >
                    Go back to home
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-15 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 z-[999] pb-safe">
        {/* Home Tab */}
        <Link
          to="/home"
          onMouseEnter={() => preloadRoute("/home")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
            currentActiveItem?.id === "home" 
              ? "bg-primary-50 border border-primary-100 text-primary-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <HomeSvgIcon active={currentActiveItem?.id === "home"} />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "home" ? "text-primary-600 font-black" : "text-slate-500"}`}>
            Home
          </span>
          {currentActiveItem?.id === "home" && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary-600 shadow-2xs"></span>
          )}
        </Link>

        {/* Submit Claim Tab */}
        {allowedWindows.includes("expense") && (
          <Link
            to="/submit-expense"
            onMouseEnter={() => preloadRoute("/submit-expense")}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
              currentActiveItem?.id === "expense" 
                ? "bg-emerald-50 border border-emerald-100 text-emerald-600 scale-105 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ClaimSvgIcon active={currentActiveItem?.id === "expense"} />
            <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "expense" ? "text-emerald-600 font-black" : "text-slate-500"}`}>
              Claim
            </span>
            {currentActiveItem?.id === "expense" && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-600 shadow-2xs"></span>
            )}
          </Link>
        )}

        {/* Approval Center Tab */}
        {allowedWindows.includes("approval") && (
          <Link
            to="/approval-center"
            onMouseEnter={() => preloadRoute("/approval-center")}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
              currentActiveItem?.id === "approval" 
                ? "bg-purple-50 border border-purple-100 text-purple-600 scale-105 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ApprovalSvgIcon active={currentActiveItem?.id === "approval"} />
            <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "approval" ? "text-purple-600 font-black" : "text-slate-500"}`}>
              Approval
            </span>
            {currentActiveItem?.id === "approval" && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-600 shadow-2xs"></span>
            )}
          </Link>
        )}

        {/* Profile Tab */}
        <Link
          to="/profile"
          onMouseEnter={() => preloadRoute("/profile")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
            currentActiveItem?.id === "profile" 
              ? "bg-amber-50 border border-amber-100 text-amber-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ProfileSvgIcon active={currentActiveItem?.id === "profile"} />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "profile" ? "text-amber-600 font-black" : "text-slate-500"}`}>
            Profile
          </span>
          {currentActiveItem?.id === "profile" && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-600 shadow-2xs"></span>
          )}
        </Link>

        {/* More Tab */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all border-0 bg-transparent cursor-pointer relative ${
            isMobileMenuOpen 
              ? "bg-sky-50 border border-sky-100 text-sky-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MoreSvgIcon active={isMobileMenuOpen} />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${isMobileMenuOpen ? "text-sky-600 font-black" : "text-slate-500"}`}>
            More
          </span>
          {isMobileMenuOpen && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-600 shadow-2xs"></span>
          )}
        </button>
      </nav>

      {navLoading && <ProgressLoader message="Opening Module..." fullPage />}

      {/* MOBILE FULL NAVIGATION OVERLAY MODAL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-50 z-[999] flex flex-col lg:hidden animate-fadeIn">
          {/* Header */}
          <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md relative">
            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <MoreSvgIcon active={true} /> Navigation Menu
            </span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-7 h-7 rounded-full border border-slate-700 bg-slate-800 text-white hover:bg-rose-600 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* User Info Bar */}
          <Link 
            to="/profile" 
            onClick={() => {
              setIsMobileMenuOpen(false);
              setNavLoading(true);
              setTimeout(() => setNavLoading(false), 500);
            }}
            className="m-3 p-3.5 bg-slate-900 border border-slate-800 rounded-xl shrink-0 flex items-center gap-3 text-white hover:border-primary-500 transition-all no-underline shadow-xs"
          >
            <div className="h-11 w-11 rounded-full bg-primary-600 border-2 border-primary-400 flex items-center justify-center text-white font-black text-base shadow-2xs shrink-0 overflow-hidden">
              {avatarUrl && !avatarError ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  className="h-full w-full object-cover" 
                  onError={() => setAvatarError(true)}
                />
              ) : (
                user?.name ? user.name.charAt(0).toUpperCase() : "U"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-tight truncate m-0">{user?.name || "Employee"}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate m-0">{user?.user_id}</p>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2 py-0.5 shrink-0">
              <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">{userRole}</span>
            </div>
          </Link>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto py-2 px-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>All Applications</span>
              <span className="text-emerald-600 font-mono text-[9px] font-bold">Live Sync</span>
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentActiveItem?.id === item.id;
                const gradientClass = ITEM_GRADIENTS[item.id] || "bg-primary-600 text-white shadow-2xs";
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setNavLoading(true);
                      setTimeout(() => setNavLoading(false), 500);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all no-underline ${
                      isActive 
                        ? "bg-white border-primary-600 text-primary-900 font-bold shadow-xs scale-[1.03] ring-2 ring-primary-500/30" 
                        : "bg-white border-slate-200 hover:border-primary-300 text-slate-800 shadow-2xs"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl mb-1.5 shadow-2xs transition-transform ${gradientClass}`}>
                      <Icon className="w-5 h-5 text-white stroke-[2.2]" />
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight tracking-tight uppercase ${
                      isActive ? "text-primary-600 font-extrabold" : "text-slate-700"
                    }`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer with Home and Logout Buttons */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setNavLoading(true);
                setTimeout(() => setNavLoading(false), 500);
                navigate("/home");
              }}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-2xs rounded-lg"
            >
              <Home className="w-4 h-4" /> HOME
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-2xs rounded-lg"
            >
              <LogOut className="w-4 h-4" /> LOGOUT
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
