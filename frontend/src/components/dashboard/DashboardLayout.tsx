import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { preloadRoute } from "../../utils/preload";
import api from "../../services/api";
import { notificationService, NotificationItem } from "../../services/notificationService";
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
  Bell,
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
  Info
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
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP"] },
  { id: "expense", name: "Submit Expense", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP"] },
  { id: "mis_report", name: "MIS Report", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP"] },
  { id: "kpi", name: "KPI Dashboard", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP"] },
  { id: "upload_data", name: "Upload Data", path: "/upload-data", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS"] },
  { id: "asset_upload", name: "Asset Inventory", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
  { id: "penalty_report", name: "Penalty Report", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP"] },
  { id: "analysis", name: "Analysis", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP"] },
  { id: "report", name: "Month Report", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP"] },
  { id: "consolidated_report", name: "Consolidated Report", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP"] },
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
  
  // Notification State (loads instantly from cache for maximum speed)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      if (currentUser) {
        const cached = localStorage.getItem(`notifications_${currentUser.user_id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            return parsed.slice(0, 10);
          }
        }
      }
    } catch (_) {}
    return [];
  });
  const [isNotifOpen, setIsNotifOpen] = useState(false);

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
      fetchNotifications(currentUser);
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

  const fetchNotifications = async (currentUser: any) => {
    try {
      const list = await notificationService.getNotifications();
      if (Array.isArray(list)) {
        setNotifications(list.slice(0, 10)); // Display top 10 most recent in nav dropdown
        localStorage.setItem(`notifications_${currentUser.user_id}`, JSON.stringify(list));

        // Trigger local browser push notification for unread alerts (PWA features)
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          let notifiedIds = [];
          try {
            const notifiedIdsString = localStorage.getItem("pwa_notified_ids");
            if (notifiedIdsString) {
              const parsedNotified = JSON.parse(notifiedIdsString);
              if (Array.isArray(parsedNotified)) {
                notifiedIds = parsedNotified;
              }
            }
          } catch (_) {}

          let hasNew = false;
          list.forEach(n => {
            if (!n) return;
            const stringId = String(n.id);
            if (!n.read && !notifiedIds.includes(stringId)) {
              new Notification(n.title || "Notification", {
                body: n.description || "",
                icon: brandLogo,
                tag: stringId
              });
              notifiedIds.push(stringId);
              hasNew = true;
            }
          });
          if (hasNew) {
            localStorage.setItem("pwa_notified_ids", JSON.stringify(notifiedIds));
          }
        }
      } else {
        console.warn("getNotifications did not return an array:", list);
        setNotifications([]);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setNotifications([]);
    }
  };

  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };



  if (!user) return null;

  const userRole = user.role || "Engineer";

  let allowedWindows: string[] = ["home", "profile", "help", "expense"];
  try {
    if (user && user.allowed_windows) {
      if (Array.isArray(user.allowed_windows)) {
        const parsed = user.allowed_windows.map((w: any) => String(w).trim().toLowerCase());
        parsed.forEach((w: string) => {
          if (!allowedWindows.includes(w)) allowedWindows.push(w);
        });
      } else if (typeof user.allowed_windows === "string") {
        const parsed = user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase());
        parsed.forEach((w: string) => {
          if (!allowedWindows.includes(w)) allowedWindows.push(w);
        });
      }
    }
  } catch (_) {}

  // Check if user has permission for menu items based on allowed_windows
  const allowedMenuItems = MENU_ITEMS.filter((item) => {
    if (isMobileScreen && ["report", "consolidated_report", "mis_report"].includes(item.id.toLowerCase())) {
      return false;
    }
    if (["home", "profile", "help", "expense"].includes(item.id.toLowerCase())) return true;
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
    ["home", "profile", "help"].includes(currentActiveItem.id.toLowerCase()) ||
    allowedWindows.includes(currentActiveItem.id.toLowerCase());
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => n && !n.read).length;

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
                    ? "bg-blue-600 text-white font-bold border-l-[#ffc107] shadow-sm"
                    : "border-l-transparent text-[#c2c7d0] hover:bg-emerald-950/30 hover:text-emerald-300"
                }`}
              >
                <div className={`${isActive ? "text-white" : "text-[#c2c7d0] group-hover:text-emerald-300"} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

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
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        
        {/* TOP NAVBAR - ADMINLTE WHITE NAVBAR */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-40 shrink-0 shadow-md">
          
          {/* Left Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-xl font-black text-white uppercase tracking-wider ml-4 md:ml-6">
              {currentActiveItem ? currentActiveItem.name : "Dashboard"}
            </h1>
          </div>

          {/* Right Actions & Notification System */}
          <div className="flex items-center gap-3">
            
            {/* Notification Bell Center */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
                title="Notifications Center"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>              {/* Notification Dropdown Panel */}
              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-[9998] bg-black/40 sm:bg-transparent" onClick={() => setIsNotifOpen(false)} />
                  
                  {/* MOBILE FULL-SCREEN NOTIFICATION CENTER & DESKTOP DROPDOWN */}
                  <div className="fixed inset-0 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-2 sm:w-85 bg-[#f8fafc] sm:bg-white border sm:border-gray-200 rounded-none sm:rounded-xl shadow-2xl z-[9999] overflow-hidden text-xs text-gray-700 animate-fadeIn flex flex-col h-full sm:h-auto sm:max-h-none">
                    
                    {/* Header */}
                    <div className="px-4 py-3 bg-white sm:bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0 h-14 shadow-sm sm:shadow-none">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsNotifOpen(false)}
                          className="sm:hidden w-7 h-7 rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer flex items-center justify-center font-bold text-xs"
                        >
                          ✕
                        </button>
                        <span className="uppercase tracking-widest text-[11px] sm:text-[10px] font-black text-gray-800">Notifications Center</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold uppercase bg-transparent border-0 cursor-pointer"
                      >
                        Mark all read
                      </button>
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-0 divide-y sm:divide-y divide-gray-150 max-h-none sm:max-h-80 bg-[#f8fafc] sm:bg-white space-y-3 sm:space-y-0 pb-20 sm:pb-0">
                      {safeNotifications.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 font-extrabold uppercase tracking-wider text-[10px] bg-white rounded-2xl border border-gray-150 sm:border-0 sm:rounded-none">
                          No notifications
                        </div>
                      ) : (
                        safeNotifications.map((n) => (
                          <Link
                            key={n.id}
                            to={n.link}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsNotifOpen(false);
                            }}
                            className={`block p-4 sm:p-4.5 transition-all no-underline ${
                              n.read 
                                ? "bg-white hover:bg-gray-50 text-gray-700" 
                                : "bg-blue-50/40 hover:bg-blue-50/70 border-l-4 border-l-blue-600 text-gray-800 shadow-sm sm:shadow-none"
                            } rounded-2xl sm:rounded-none border border-gray-200/70 sm:border-0 sm:border-b sm:border-b-gray-100`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {n.type === "warning" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                {n.type === "success" && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                {n.type === "error" && <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                {n.type !== "warning" && n.type !== "success" && n.type !== "error" && <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                
                                <span className={`font-black uppercase text-[8px] px-1.5 py-0.5 rounded tracking-wide ${
                                  n.type === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  n.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  n.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}>
                                  {n.title || "Notification"}
                                </span>

                                {!n.read && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                )}
                              </div>
                              <span className="text-[9px] text-gray-400 font-bold shrink-0 font-mono">{formatDateTime(n.created_at)}</span>
                            </div>
                            <p className="text-gray-800 font-bold text-xs mt-2.5 leading-relaxed">{n.description}</p>
                          </Link>
                        ))
                      )}
                    </div>

                    <Link to="/notifications" onClick={() => setIsNotifOpen(false)} className="block py-3.5 text-center bg-white border-t border-gray-200 text-[10px] text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-widest shrink-0 shadow-lg sm:shadow-none mb-safe">
                      See All Notifications
                    </Link>
                  </div>
                </>
              )}
            </div>

            <img 
              src={brandLogo} 
              alt="Cyrix" 
              className="h-9 w-auto max-w-[120px] rounded border border-gray-200 object-contain bg-white px-2 py-0.5 shadow-sm" 
            />
          </div>
        </header>

        {/* MAIN AREA WORKSPACE */}
        <main className="flex-1 p-4 pb-20 lg:pb-4 overflow-y-auto min-w-0 overflow-x-hidden w-full">
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

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-center justify-around px-2 z-[999] shadow-lg pb-safe">
        {/* Home Tab */}
        <Link
          to="/home"
          onMouseEnter={() => preloadRoute("/home")}
          className={`flex flex-col items-center justify-center w-16 h-11 rounded-xl transition-all relative ${
            currentActiveItem?.id === "home" ? "bg-blue-600 text-white font-extrabold shadow-xs" : "text-gray-500 hover:bg-slate-100 hover:text-gray-800"
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Home</span>
          {currentActiveItem?.id === "home" && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white animate-pulse"></span>
          )}
        </Link>

        {/* Submit Claim Tab (Inline layout!) */}
        {allowedWindows.includes("expense") && (
          <Link
            to="/submit-expense"
            onMouseEnter={() => preloadRoute("/submit-expense")}
            className={`flex flex-col items-center justify-center w-16 h-11 rounded-xl transition-all relative ${
              currentActiveItem?.id === "expense" ? "bg-blue-600 text-white font-extrabold shadow-xs" : "text-gray-500 hover:bg-slate-100 hover:text-gray-800"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Claim</span>
            {currentActiveItem?.id === "expense" && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white animate-pulse"></span>
            )}
          </Link>
        )}

        {/* Approval Center Tab (Inline layout!) */}
        {allowedWindows.includes("approval") && (
          <Link
            to="/approval-center"
            onMouseEnter={() => preloadRoute("/approval-center")}
            className={`flex flex-col items-center justify-center w-16 h-11 rounded-xl transition-all relative ${
              currentActiveItem?.id === "approval" ? "bg-blue-600 text-white font-extrabold shadow-xs" : "text-gray-500 hover:bg-slate-100 hover:text-gray-800"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Approval</span>
            {currentActiveItem?.id === "approval" && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white animate-pulse"></span>
            )}
          </Link>
        )}

        {/* Profile Tab */}
        <Link
          to="/profile"
          onMouseEnter={() => preloadRoute("/profile")}
          className={`flex flex-col items-center justify-center w-16 h-11 rounded-xl transition-all relative ${
            currentActiveItem?.id === "profile" ? "bg-blue-600 text-white font-extrabold shadow-xs" : "text-gray-500 hover:bg-slate-100 hover:text-gray-800"
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Profile</span>
          {currentActiveItem?.id === "profile" && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white animate-pulse"></span>
          )}
        </Link>

        {/* More Tab - always visible for everyone to access Help Center, etc. */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-16 h-11 rounded-xl transition-all border-0 bg-transparent cursor-pointer relative ${
            isMobileMenuOpen ? "bg-blue-600 text-white font-extrabold shadow-xs" : "text-gray-500 hover:bg-slate-100 hover:text-gray-800"
          }`}
        >
          <MenuGridIcon />
          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">More</span>
          {isMobileMenuOpen && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white animate-pulse"></span>
          )}
        </button>
      </nav>

      {/* MOBILE FULL NAVIGATION OVERLAY MODAL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-[#f4f6f9] z-[999] flex flex-col lg:hidden animate-fadeIn">
          {/* Header */}
          <div className="h-14 px-4 bg-[#0f172a] border-b-0 flex items-center justify-between shrink-0 shadow-md">
            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <MenuGridIcon /> Navigation Menu
            </span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1 rounded-full border border-red-500 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Info Bar */}
          <Link 
            to="/profile" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-4 bg-white border-b border-gray-150 shrink-0 flex items-center gap-3 text-gray-800 hover:bg-gray-50 transition-colors no-underline block"
          >
            <div className="h-10 w-10 rounded-full bg-indigo-650 flex items-center justify-center text-white font-black text-sm shadow-sm select-none overflow-hidden">
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
            <div>
              <p className="text-xs font-bold text-gray-800 leading-tight">{user?.name || "Employee"}</p>
              <p className="text-[10px] text-gray-550 font-mono mt-0.5">{user?.user_id}</p>
            </div>
            <div className="ml-auto bg-green-50 border border-green-200 rounded px-2 py-0.5">
              <span className="text-[9px] text-green-700 font-bold uppercase tracking-wide">{userRole}</span>
            </div>
          </Link>

          {/* Menu Items Grid - centered vertically */}
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
            <div className="w-full max-w-sm grid grid-cols-3 gap-3 text-center">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentActiveItem?.id === item.id;
                               return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      isActive 
                        ? "bg-blue-600 border-blue-600 text-white font-extrabold shadow-md" 
                        : "bg-white border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 shadow-sm"
                    }`}
                  >
                    <div className={`p-2.5 rounded-full ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-gray-50 text-gray-500 border border-gray-100 shadow-inner"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-2 leading-tight truncate w-full">
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
