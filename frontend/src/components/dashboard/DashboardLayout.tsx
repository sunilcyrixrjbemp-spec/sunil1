import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { preloadRoute } from "../../utils/preload";
import api, { getActiveBaseURL } from "../../services/api";
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
  Plus,
  AlertTriangle,
  Check,
  Info,
  Activity,
  Server,
  Database,
  TrendingUp
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Home", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "new_dashboard", name: "New Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP"] },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "db_monitor", name: "DB Monitor", path: "/db-monitor", icon: Activity, roles: ["Admin"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP"] },
  { id: "expense", name: "Submit Expense", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP"] },
  { id: "mis_report", name: "MIS Report", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP"] },
  { id: "kpi", name: "KPI Dashboard", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP"] },
  { id: "upload_data", name: "Upload Data", path: "/upload-data", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS"] },
  { id: "asset_upload", name: "Asset Inventory", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
  { id: "penalty_report", name: "Penalty Report", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP"] },
  { id: "analysis", name: "Analysis", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"] },
  { id: "report", name: "Month Report", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "consolidated_report", name: "Consolidated Report", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "help", name: "Help Center", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "profile", name: "Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
];

const MenuGridIcon = () => (
  <svg className="w-5 h-5 transition-all duration-300 hover:rotate-90 text-inherit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="10" y="3" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="17" y="3" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="3" y="10" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="17" y="10" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="3" y="17" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="10" y="17" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="17" y="17" width="4" height="4" rx="1" fill="currentColor" />
  </svg>
);

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024);
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [currentBaseURL, setCurrentBaseURL] = useState(() => getActiveBaseURL());
  
  useEffect(() => {
    const handleSwap = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.baseURL) {
        setCurrentBaseURL(customEvent.detail.baseURL);
      }
    };
    window.addEventListener("backend-server-swap", handleSwap);
    return () => window.removeEventListener("backend-server-swap", handleSwap);
  }, []);

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
    setIsNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate("/login");
    } else {
      setUser(currentUser);

      // Auto-sync profile to get fresh permissions and details
      authService.getProfile()
        .then(freshProfile => {
          if (freshProfile) {
            localStorage.setItem("user", JSON.stringify(freshProfile));
            setUser(freshProfile);
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
        // Ignore background caching errors
      }
    };
    preloadImage();
  }, [user?.profile_pic_url, user?.user_id, user?.id]);

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "Just now";
      const day = String(d.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}-${month}-${d.getFullYear()} ${hours}:${minutes}:${String(d.getSeconds()).padStart(2, "0")}`;
    } catch (_) {
      return "—";
    }
  };

  if (!user) return null;

  const userRole = user.role || "Engineer";
  const userRoleClean = userRole.trim().toLowerCase();
  const isAlwaysAllowedAll = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleClean);

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

  // Force-enable specified windows for special roles
  if (isAlwaysAllowedAll) {
    const forced = ["home", "analysis", "report", "consolidated_report", "profile", "help"];
    forced.forEach(w => {
      if (!allowedWindows.includes(w)) {
        allowedWindows.push(w);
      }
    });
  }

  // Check if user has permission for menu items based on allowed_windows
  const allowedMenuItems = MENU_ITEMS.filter((item) => {
    if (isMobileScreen && ["report", "consolidated_report", "mis_report"].includes(item.id.toLowerCase())) {
      return false;
    }
    return allowedWindows.includes(item.id.toLowerCase());
  });



  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    navigate("/login");
  };

  // Active route validation
  const currentActiveItem = MENU_ITEMS.find((item) => {
    if (item.path === "/home" && location.pathname === "/home") return true;
    return item.path !== "/home" && location.pathname.startsWith(item.path);
  });

  const hasAccess = 
    !currentActiveItem || 
    allowedWindows.includes(currentActiveItem.id.toLowerCase());
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#212529] flex flex-col lg:flex-row antialiased">
      

      
      {/* SIDEBAR - DESKTOP ONLY */}
      <aside className={`hidden lg:flex flex-col bg-[#343a40] text-[#c2c7d0] transition-all duration-200 ${
        isSidebarCollapsed ? "w-16" : "w-60"
      } sticky top-0 h-screen shrink-0 z-30 shadow-lg`}>
        
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-center border-b border-gray-700 px-4 bg-[#2f353f]/50 shrink-0 overflow-hidden">
          <Link to="/home" className="flex items-center gap-2.5 font-bold text-white truncate">
            <img src={brandLogo} alt="Cyrix Logo" className="h-8 w-8 object-contain shrink-0 rounded bg-white p-1" />
            {!isSidebarCollapsed && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-100">
                Cyrix Healthcare
              </span>
            )}
          </Link>
        </div>

        {/* User Profile Info */}
        <div className="p-3.5 border-b border-gray-700 shrink-0">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 overflow-hidden">
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
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Employee"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{userRole}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {!isSidebarCollapsed && (
            <span className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
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
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-150 border-l-4 group ${
                  isActive
                    ? "bg-indigo-600 text-white font-bold border-l-indigo-400 shadow-sm"
                    : "border-l-transparent text-[#c2c7d0] hover:bg-indigo-950/40 hover:text-indigo-300"
                }`}
              >
                <div className={`${isActive ? "text-white" : "text-[#c2c7d0] group-hover:text-indigo-300"} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer System Status */}
        {isSidebarCollapsed ? (
          <div className="flex justify-center py-2.5 border-t border-gray-700 shrink-0" title={`Server: ${!currentBaseURL.includes("onrender.com") ? "Cloudflare Worker" : "Render (Fallback)"}\nRead DB: ${!currentBaseURL.includes("onrender.com") ? "Secondary D1 (Replica)" : "Primary D1 (Direct)"}`}>
            <span className={`h-2 w-2 rounded-full ${!currentBaseURL.includes("onrender.com") ? "bg-emerald-400 animate-pulse" : "bg-purple-400"}`}></span>
          </div>
        ) : (
          <div className="mx-3 my-2 p-2.5 rounded bg-gray-800/40 border border-gray-700/50 text-[10px] space-y-1.5 font-semibold text-gray-400 select-none shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">System status</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                !currentBaseURL.includes("onrender.com") ? "bg-emerald-500/15 text-emerald-400" : "bg-purple-500/15 text-purple-400"
              }`}>
                ● Active
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <div className="truncate">
                <p className="text-gray-500 text-[8px] uppercase tracking-wide leading-none">Active Server</p>
                <p className="text-white font-bold text-[9px] truncate leading-tight mt-0.5">{!currentBaseURL.includes("onrender.com") ? "Cloudflare Worker" : "Render (Fallback)"}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <div className="truncate">
                <p className="text-gray-500 text-[8px] uppercase tracking-wide leading-none">Database (Reads)</p>
                <p className="text-gray-300 font-bold text-[9px] truncate leading-tight mt-0.5">
                  {!currentBaseURL.includes("onrender.com") ? "Secondary D1 (Replica)" : "Primary D1 (Direct)"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Footer Logout */}
        <div className="p-2 border-t border-gray-700 shrink-0">
          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Log Out" : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-xs text-gray-400 hover:text-white hover:bg-red-600/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!isSidebarCollapsed && <span className="uppercase tracking-wider">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        
        {/* TOP NAVBAR - ANT DESIGN ENTERPRISE HEADER */}
        <header className="h-14 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/90 flex items-center justify-between px-3 md:px-5 sticky top-0 z-40 shrink-0 shadow-md">
          
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-all border-0 bg-transparent cursor-pointer"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Ant Design Section Pill Header */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1 text-white shadow-inner">
              {currentActiveItem && currentActiveItem.icon && (
                <currentActiveItem.icon className="w-4 h-4 text-indigo-400 shrink-0 stroke-[2.5]" />
              )}
              <h1 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-wider truncate max-w-[150px] sm:max-w-[240px] md:max-w-none m-0 leading-none">
                {currentActiveItem ? currentActiveItem.name : "Dashboard"}
              </h1>
            </div>
          </div>

          {/* Right Actions — User Avatar & Framed Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User Profile Quick Link */}
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-2 p-1 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-white transition-all no-underline shadow-2xs"
            >
              <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs overflow-hidden">
                {avatarUrl && !avatarError ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
                ) : (
                  user?.name ? user.name.charAt(0).toUpperCase() : "U"
                )}
              </div>
              <span className="text-xs font-bold text-slate-200 hidden lg:inline max-w-[100px] truncate pr-1">{user?.name?.split(" ")[0]}</span>
            </Link>

            {/* Cyrix Brand Logo Container */}
            <div className="bg-white rounded-lg px-2 py-1 shadow-xs border border-slate-200/50 flex items-center justify-center">
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
            <Outlet />
          ) : (
            /* ACCESS DENIED WORKSPACE */
            <div className="h-full flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white border border-gray-200 rounded shadow-md p-6 text-center space-y-4 animate-fade-in border-t-3 border-t-red-500">
                <div className="w-12 h-12 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mx-auto text-red-600">
                  <Lock className="w-6 h-6" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-800 uppercase tracking-wide">Access Denied</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    You do not have permission to view the <span className="text-blue-600 font-semibold">"{currentActiveItem?.name}"</span> screen. Please contact your system administrator to adjust your permitted windows.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => navigate("/home")}
                    className="btn-lte-primary px-6"
                  >
                    Go back to home
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR - ANT DESIGN ENTERPRISE DOCK */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-15 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 z-[999] pb-safe">
        {/* Home Tab */}
        <Link
          to="/home"
          onMouseEnter={() => preloadRoute("/home")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
            currentActiveItem?.id === "home" 
              ? "bg-indigo-50 border border-indigo-100 text-indigo-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Home className={`w-5 h-5 transition-all ${currentActiveItem?.id === "home" ? "text-indigo-600 stroke-[2.5]" : "stroke-[1.75]"}`} />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "home" ? "text-indigo-600 font-black" : "text-slate-500"}`}>
            Home
          </span>
          {currentActiveItem?.id === "home" && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs"></span>
          )}
        </Link>

        {/* Submit Claim Tab */}
        {allowedWindows.includes("expense") && (
          <Link
            to="/submit-expense"
            onMouseEnter={() => preloadRoute("/submit-expense")}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
              currentActiveItem?.id === "expense" 
                ? "bg-indigo-50 border border-indigo-100 text-indigo-600 scale-105 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Plus className={`w-5 h-5 transition-all ${currentActiveItem?.id === "expense" ? "text-indigo-600 stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "expense" ? "text-indigo-600 font-black" : "text-slate-500"}`}>
              Claim
            </span>
            {currentActiveItem?.id === "expense" && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs"></span>
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
                ? "bg-indigo-50 border border-indigo-100 text-indigo-600 scale-105 shadow-2xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckSquare className={`w-5 h-5 transition-all ${currentActiveItem?.id === "approval" ? "text-indigo-600 stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "approval" ? "text-indigo-600 font-black" : "text-slate-500"}`}>
              Approval
            </span>
            {currentActiveItem?.id === "approval" && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs"></span>
            )}
          </Link>
        )}

        {/* Profile Tab */}
        <Link
          to="/profile"
          onMouseEnter={() => preloadRoute("/profile")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative no-underline ${
            currentActiveItem?.id === "profile" 
              ? "bg-indigo-50 border border-indigo-100 text-indigo-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <User className={`w-5 h-5 transition-all ${currentActiveItem?.id === "profile" ? "text-indigo-600 stroke-[2.5]" : "stroke-[1.75]"}`} />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${currentActiveItem?.id === "profile" ? "text-indigo-600 font-black" : "text-slate-500"}`}>
            Profile
          </span>
          {currentActiveItem?.id === "profile" && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs"></span>
          )}
        </Link>

        {/* More Tab */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all border-0 bg-transparent cursor-pointer relative ${
            isMobileMenuOpen 
              ? "bg-indigo-50 border border-indigo-100 text-indigo-600 scale-105 shadow-2xs" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MenuGridIcon />
          <span className={`text-[9px] font-bold uppercase tracking-tight mt-0.5 ${isMobileMenuOpen ? "text-indigo-600 font-black" : "text-slate-500"}`}>
            More
          </span>
          {isMobileMenuOpen && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs"></span>
          )}
        </button>
      </nav>

      {/* MOBILE FULL NAVIGATION OVERLAY MODAL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-[#f8fafc] z-[999] flex flex-col lg:hidden animate-fadeIn">
          {/* Header */}
          <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
            <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <MenuGridIcon /> Navigation Menu
            </span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-7 h-7 rounded-full border border-slate-700 bg-slate-800 text-white hover:bg-red-600 transition-all cursor-pointer flex items-center justify-center shadow-xs"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* User Info Bar (AntD Card style) */}
          <Link 
            to="/profile" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="m-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-xl shrink-0 flex items-center gap-3 text-white hover:border-indigo-500 transition-all no-underline shadow-md"
          >
            <div className="h-11 w-11 rounded-full bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0 overflow-hidden">
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
              <p className="text-xs font-extrabold text-white leading-tight truncate">{user?.name || "Employee"}</p>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate">{user?.user_id}</p>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2 py-0.5 shrink-0">
              <span className="text-[9px] text-emerald-300 font-black uppercase tracking-wider">{userRole}</span>
            </div>
          </Link>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto py-2 px-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 px-1">All Applications</p>
            <div className="grid grid-cols-3 gap-2.5">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentActiveItem?.id === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all no-underline ${
                      isActive 
                        ? "bg-indigo-600 border-indigo-600 text-white font-extrabold shadow-md scale-[1.02]" 
                        : "bg-white border-gray-200/80 hover:border-indigo-300 text-gray-800 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl mb-1.5 ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-indigo-50/70 text-indigo-600 border border-indigo-100/60"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight tracking-tight uppercase ${
                      isActive ? "text-white font-black" : "text-gray-700"
                    }`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer with Home and Logout Buttons */}
          <div className="p-4 bg-white border-t border-gray-200 shrink-0 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/home");
              }}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Home className="w-4 h-4" /> HOME
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 shadow-sm"
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
