import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";
import { approvalService } from "../../services/approvalService";
import { expenseService } from "../../services/expenseService";
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
  X
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  link: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Home", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP"] },
  { id: "expense", name: "Submit Expense", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP"] },
  { id: "analysis", name: "Analysis", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP"] },
  { id: "report", name: "Month Report", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP"] },
  { id: "help", name: "Help Center", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "profile", name: "Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
];

const MenuGridIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="4" height="4" />
    <rect x="10" y="3" width="4" height="4" />
    <rect x="17" y="3" width="4" height="4" />
    <rect x="3" y="10" width="4" height="4" />
    <rect x="10" y="10" width="4" height="4" />
    <rect x="17" y="10" width="4" height="4" />
    <rect x="3" y="17" width="4" height="4" />
    <rect x="10" y="17" width="4" height="4" />
    <rect x="17" y="17" width="4" height="4" />
  </svg>
);

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Notification State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
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

  const fetchNotifications = async (currentUser: any) => {
    const list: NotificationItem[] = [];
    try {
      const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");

      // 1. If Manager/Approver: fetch pending approvals
      const allowedWindows = currentUser.allowed_windows
        ? currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
        : ["home", "profile", "help"];
      const isApprover = currentUser.role === "Admin" || allowedWindows.includes("approval");
      if (isApprover) {
        const pendings = await approvalService.getPendingApprovals();
        pendings.forEach((p: any) => {
          const id = `approval-${p.id}`;
          list.push({
            id: id,
            title: "Pending Approval",
            description: `Expense claim from ${p.employeeName} (${p.eCode}) for "${p.purpose || p.description}" of ₹${p.amount.toLocaleString()} is waiting for your review.`,
            time: "Action Required",
            type: "warning",
            read: readNotifIds.includes(id),
            link: "/approval-center"
          });
        });
      }

      // 2. Fetch user's own expenses to check for status updates
      const expenses = await expenseService.getExpenses();
      // Only check the most recent 5 expenses, and do not make N+1 detailed API calls.
      // Simply list the claims directly. Sub-details comments can be omitted or loaded on-demand.
      expenses.slice(0, 5).forEach((e: any) => {
        const id = `claim-${e.id}`;
        if (e.status === "approved" || e.status === "rejected") {
          list.push({
            id: id,
            title: `Claim ${e.status.toUpperCase()}`,
            description: `Your claim of ₹${e.amount.toLocaleString()} for "${e.description || e.purpose}" has been ${e.status}.`,
            time: "Recent Update",
            type: e.status === "approved" ? "success" : "error",
            read: readNotifIds.includes(id),
            link: "/home"
          });
        } else if (e.status.startsWith("submitted")) {
          list.push({
            id: id,
            title: "Claim Submitted",
            description: `Your claim of ₹${e.amount.toLocaleString()} for "${e.description || e.purpose}" is successfully submitted and pending review.`,
            time: "Submitted",
            type: "info",
            read: readNotifIds.includes(id) || true,
            link: "/home"
          });
        }
      });
    } catch (err) {
      console.error("Failed to build notifications:", err);
    }
    
    // Add default system welcome notification
    const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");
    list.push({
      id: "sys-welcome",
      title: "System Active",
      description: `Welcome to Cyrix Healthcare Expense Management System.`,
      time: "Now",
      type: "info",
      read: readNotifIds.includes("sys-welcome") || true,
      link: "/home"
    });

    setNotifications(list);

    // Trigger local push notification for unread alerts
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notifiedIds = JSON.parse(localStorage.getItem("pwa_notified_ids") || "[]");
        let hasNew = false;
        list.forEach(n => {
          if (!n.read && n.id !== "sys-welcome" && !notifiedIds.includes(n.id)) {
            new Notification(n.title, {
              body: n.description,
              icon: brandLogo,
              tag: n.id
            });
            notifiedIds.push(n.id);
            hasNew = true;
          }
        });
        if (hasNew) {
          localStorage.setItem("pwa_notified_ids", JSON.stringify(notifiedIds));
        }
      }
    } catch (e) {
      console.warn("Push notification block error:", e);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");
    if (!readNotifIds.includes(id)) {
      readNotifIds.push(id);
      localStorage.setItem("read_notification_ids", JSON.stringify(readNotifIds));
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");
    notifications.forEach(n => {
      if (!readNotifIds.includes(n.id)) {
        readNotifIds.push(n.id);
      }
    });
    localStorage.setItem("read_notification_ids", JSON.stringify(readNotifIds));
  };

  if (!user) return null;

  const userRole = user.role || "Engineer";

  // Parse allowed_windows from DB configuration
  const allowedWindows = user.allowed_windows
    ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
    : ["home", "profile", "help"];

  // Check if user has permission for menu items based on allowed_windows (and bypass for Admin)
  const allowedMenuItems = MENU_ITEMS.filter((item) => {
    if (userRole === "Admin") return true;
    if (["home", "profile", "help"].includes(item.id.toLowerCase())) return true;
    return allowedWindows.includes(item.id.toLowerCase());
  });

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  // Active route validation
  const currentActiveItem = MENU_ITEMS.find((item) => {
    if (item.path === "/home" && location.pathname === "/home") return true;
    return item.path !== "/home" && location.pathname.startsWith(item.path);
  });

  const hasAccess = 
    !currentActiveItem || 
    userRole === "Admin" || 
    ["home", "profile", "help"].includes(currentActiveItem.id.toLowerCase()) ||
    allowedWindows.includes(currentActiveItem.id.toLowerCase());
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#212529] flex flex-col lg:flex-row antialiased">
      
      {/* Mobile Sidebar Backdrop */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* SIDEBAR DRAWER - MOBILE & DESKTOP */}
      <aside className={`fixed inset-y-0 left-0 z-50 lg:sticky lg:flex flex-col bg-[#343a40] text-[#c2c7d0] transition-all duration-200 ${
        isSidebarCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-60"
      } h-screen shrink-0 shadow-lg`}>
        
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
            <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name || "Employee"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{userRole}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
                title={isSidebarCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors group ${
                  isActive
                    ? "bg-blue-600 text-white font-bold"
                    : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`${isActive ? "text-white" : "text-[#c2c7d0] group-hover:text-white"}`}>
                  <Icon />
                </div>
                {!isSidebarCollapsed && <span className="uppercase tracking-wider">{item.name}</span>}
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
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* TOP NAVBAR - ADMINLTE WHITE NAVBAR */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-40 shrink-0 shadow-sm">
          
          {/* Left Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">
              {currentActiveItem ? currentActiveItem.name : "Dashboard"}
            </span>
          </div>

          {/* Right Actions & Notification System */}
          <div className="flex items-center gap-3">
            
            {/* Notification Bell Center */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="h-9 w-9 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors relative"
                title="Notifications Center"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="fixed right-4 left-4 sm:absolute sm:right-0 sm:left-auto mt-2 sm:w-80 bg-white border border-gray-200 rounded shadow-lg z-50 overflow-hidden text-xs text-gray-700 animate-fade-in">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between font-bold">
                      <span className="uppercase tracking-wider text-[10px]">Alerts Center</span>
                      <span className="text-[10px] text-blue-600 cursor-pointer hover:underline" onClick={markAllAsRead}>
                        Mark all read
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            to={n.link}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsNotifOpen(false);
                            }}
                            className={`p-3 block transition-colors ${n.read ? "bg-white hover:bg-gray-50" : "bg-blue-50/30 hover:bg-blue-50/50"}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                                n.type === "warning" ? "bg-amber-100 text-amber-700" :
                                n.type === "success" ? "bg-green-100 text-green-700" :
                                n.type === "error" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {n.title}
                              </span>
                              <span className="text-[9px] text-gray-400 font-medium shrink-0">{n.time}</span>
                            </div>
                            <p className="text-gray-600 mt-1 leading-normal font-semibold">{n.description}</p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link to="/notifications" onClick={() => setIsNotifOpen(false)} className="block py-2 text-center bg-gray-50 border-t border-gray-200 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider">
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
        <main className="flex-1 p-4 pb-16 lg:pb-4 overflow-y-auto">
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
      <nav className="lg:hidden h-14 fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around px-2 z-40 shadow-lg">
        {allowedMenuItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = currentActiveItem?.id === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex flex-col items-center justify-center w-14 h-10 rounded transition-all ${
                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider mt-1 truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
        {/* Menu (9-dot Icon) */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-14 h-10 rounded transition-all border-0 bg-transparent cursor-pointer ${
            isMobileMenuOpen ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <MenuGridIcon />
          <span className="text-[9px] font-semibold uppercase tracking-wider mt-1">Menu</span>
        </button>
      </nav>

      {/* MOBILE FULL NAVIGATION OVERLAY MODAL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end lg:hidden animate-fadeIn">
          {/* Backdrop tap to close */}
          <div className="absolute inset-0" onClick={() => setIsMobileMenuOpen(false)} />
          
          {/* Menu Card Content */}
          <div className="relative bg-white rounded-t-2xl shadow-2xl w-full max-h-[80vh] flex flex-col z-50 overflow-hidden text-gray-800 animate-slideUp">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <MenuGridIcon /> Navigation Menu
              </span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500 hover:text-gray-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-5 pb-8">
              <div className="grid grid-cols-3 gap-x-3 gap-y-4 text-center">
                {allowedMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentActiveItem?.id === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        isActive 
                          ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                          : "bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      <div className={`p-2 rounded-full ${isActive ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-100 shadow-sm"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-2.5 leading-tight truncate w-full">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
                {/* Logout Button in Grid */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border bg-rose-50 border-rose-100 hover:bg-rose-100/50 text-rose-700 transition-all cursor-pointer"
                >
                  <div className="p-2 rounded-full bg-rose-600 text-white shadow-sm">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-2.5 leading-tight">
                    Logout
                  </span>
                </button>
              </div>
            </div>
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
