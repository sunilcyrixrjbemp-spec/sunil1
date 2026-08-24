import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Search,
  Command,
  Download,
  Bell,
  PanelLeft,
  User as UserIcon,
  HelpCircle,
  LogOut,
  ChevronDown,
  CheckCheck,
  ExternalLink,
  Inbox,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import type { NotificationItem } from "../../services/notificationService";

export interface NavbarProps {
  userName: string;
  userRole: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenMobileMenu?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  onLogout?: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  "/home": "Overview",
  "/": "Overview",
  "/trc-repair": "TRC Repair Hub",
  "/trc-module": "TRC Repair Hub",
  "/receive-machine": "TRC Receive Machine",
  "/submit-expense": "Expense Claims (₹)",
  "/approval-center": "Approval Center",
  "/kpi-dashboard": "KPI Metrics",
  "/analysis": "Deep Analytics",
  "/month-report": "Month Summary",
  "/consolidated-report": "Consolidated Reports",
  "/penalty-report": "Penalty Audit",
  "/penalty-module": "Penalty Module",
  "/attendance": "Attendance Roster",
  "/admin": "Admin Panel",
  "/admin/claim-level-reset": "Claim Level Reset",
  "/admin/analytics": "CF Analytics",
  "/complaint-upload": "Complaint Upload",
  "/asset-upload": "Asset Master",
  "/upload-data": "Upload Data",
  "/profile": "My Profile",
  "/notifications": "Notifications",
  "/help-center": "Help & Support",
  "/design-system": "Design System",
};

export const Navbar: React.FC<NavbarProps> = ({
  userName,
  userRole,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMobileMenu: _onOpenMobileMenu,
  onOpenNotifications: _onOpenNotifications,
  unreadCount = 0,
  onLogout,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const [isBellOpen, setIsBellOpen] = useState(false);

  // Read notifications from localStorage (same source as DashboardLayout + NotificationsPage)
  const recentNotifications = useMemo<NotificationItem[]>(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      if (!currentUser) return [];
      const cached = localStorage.getItem(`notifications_${currentUser.user_id}`);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          // Return the 5 most recent notifications
          return list
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);
        }
      }
    } catch (_) {}
    return [];
  }, [location.pathname]); // Re-compute on route change to pick up any new cached notifications

  // Relative time formatter
  const relativeTime = (dateStr: string) => {
    try {
      const now = Date.now();
      const then = new Date(dateStr).getTime();
      const diff = Math.max(0, now - then);
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  // Command palette key shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dismiss user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  // Dismiss bell menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellMenuRef.current && !bellMenuRef.current.contains(e.target as Node)) {
        setIsBellOpen(false);
      }
    };
    if (isBellOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBellOpen]);

  // PWA Install prompt listener
  useEffect(() => {
    const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    const isNavStandalone = (navigator as any).standalone === true;
    if (isStandaloneMedia || isNavStandalone) {
      setIsStandalone(true);
    }

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (e) {}
    } else {
      window.dispatchEvent(new CustomEvent("trigger-pwa-install"));
    }
  };

  // Determine dynamic page title
  const currentPath = location.pathname;
  let pageTitle = ROUTE_TITLES[currentPath];
  if (!pageTitle) {
    const matchingKey = Object.keys(ROUTE_TITLES).find(
      (k) => k !== "/" && k !== "/home" && currentPath.startsWith(k)
    );
    if (matchingKey) {
      pageTitle = ROUTE_TITLES[matchingKey];
    } else {
      const segments = currentPath.split("/").filter(Boolean);
      pageTitle =
        segments.length > 0
          ? segments[segments.length - 1]
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")
          : "Overview";
    }
  }

  const userInitials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  return (
    <>
      <header className="sticky top-0 z-30 h-10 md:h-16 bg-white border-b border-line px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2.5 sm:gap-4 shadow-none select-none">
        {/* Left Section: Mobile Title / Desktop Sidebar Toggle + Dynamic Page Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 min-w-0">
          {/* Desktop/Tablet Sidebar Collapse Toggle */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden lg:flex items-center justify-center p-1.5 text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer focus:outline-none border border-transparent hover:border-line shrink-0"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft
                className={`w-4 h-4 transition-transform duration-300 ${
                  isSidebarCollapsed ? "rotate-180 text-accent-600" : ""
                }`}
              />
            </button>
          )}

          {/* Dynamic Page Title */}
          <div className="flex items-center min-w-0">
            <h1 className="text-xs md:text-sm lg:text-base font-semibold text-gray-800 tracking-tight truncate min-w-0 leading-none">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Center Section: Command Palette Trigger Bar (Desktop) */}
        <button
          type="button"
          onClick={() => setIsCmdOpen(true)}
          className="hidden md:flex items-center justify-between gap-3 px-3 py-1.5 bg-surface-sunken hover:bg-[#EAE8E4] border border-line rounded-lg text-xs text-ink-500 transition-all cursor-pointer w-52 lg:w-64 xl:w-72 shadow-none group focus:outline-none focus:ring-1 focus:ring-accent-600 shrink-0"
          title="Open command palette (Ctrl+K)"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Search className="w-3.5 h-3.5 text-ink-500 group-hover:text-accent-600 transition-colors shrink-0" />
            <span className="truncate text-ink-500 group-hover:text-ink-700">
              Search claims (₹), reports...
            </span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-500 bg-white border border-line rounded shrink-0">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Right Section: Mobile (Notification Bell + Profile) & Desktop (Search, Bell, User Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Right: Notification Bell Icon (Replaces Download Button) */}
          <Link
            to="/notifications"
            className="lg:hidden relative w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600 ring-1.5 ring-white animate-pulse" />
            )}
          </Link>

          <Link
            to="/profile"
            className="lg:hidden flex items-center border-l border-line pl-1.5 hover:opacity-80 transition-opacity shrink-0"
            title="My Profile"
          >
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-200 shadow-2xs">
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
          </Link>

          {/* Desktop Right: PWA Install Button (Desktop / Tablet Only) */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallApp}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg border border-accent-200 transition-all cursor-pointer shadow-none shrink-0"
              title="Install Cyrix FieldOps App"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          )}

          {/* Desktop Right: Notification Bell with Dropdown Panel (Desktop only) */}
          <div className="hidden lg:block relative shrink-0" ref={bellMenuRef}>
            <button
              type="button"
              onClick={() => { setIsBellOpen((prev) => !prev); setIsUserMenuOpen(false); }}
              className="relative w-9 h-9 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded-full transition-colors cursor-pointer focus:outline-none"
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={isBellOpen}
              aria-haspopup="true"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-600 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Bell Dropdown Panel */}
            {isBellOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-80 max-w-[calc(100vw-24px)] bg-white border border-line rounded-xl shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150 select-none overflow-hidden"
                role="menu"
              >
                {/* Dropdown Header */}
                <div className="px-3.5 py-2.5 border-b border-line flex items-center justify-between bg-surface-sunken/50">
                  <h3 className="text-xs font-bold text-ink-900 m-0 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-accent-600" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-1 text-[10px] font-bold text-white bg-accent-600 rounded-full px-1.5 py-0.5 leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  {recentNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Mark all as read in localStorage
                        try {
                          const currentUser = JSON.parse(localStorage.getItem("user") || "null");
                          if (currentUser) {
                            const cacheKey = `notifications_${currentUser.user_id}`;
                            const cached = localStorage.getItem(cacheKey);
                            if (cached) {
                              const list = JSON.parse(cached);
                              if (Array.isArray(list)) {
                                const updated = list.map((n: any) => ({ ...n, read: true }));
                                localStorage.setItem(cacheKey, JSON.stringify(updated));
                              }
                            }
                          }
                        } catch (_) {}
                        setIsBellOpen(false);
                      }}
                      className="text-[10px] font-semibold text-accent-700 hover:text-accent-900 flex items-center gap-1 border-0 bg-transparent cursor-pointer transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <Inbox className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-ink-500 m-0">No notifications yet</p>
                      <p className="text-[10px] text-ink-400 mt-0.5 m-0">You're all caught up!</p>
                    </div>
                  ) : (
                    recentNotifications.map((n: NotificationItem) => (
                      <Link
                        key={n.id}
                        to={n.link || "/notifications"}
                        onClick={() => setIsBellOpen(false)}
                        className={`flex items-start gap-2.5 px-3.5 py-2.5 border-b border-line/60 last:border-b-0 transition-colors hover:bg-surface-sunken/60 ${
                          !n.read ? "bg-accent-50/40" : ""
                        }`}
                      >
                        {/* Unread dot */}
                        <div className="mt-1.5 shrink-0">
                          {!n.read ? (
                            <span className="block w-2 h-2 rounded-full bg-accent-600" />
                          ) : (
                            <span className="block w-2 h-2 rounded-full bg-transparent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] m-0 leading-snug ${!n.read ? "font-bold text-ink-900" : "font-medium text-ink-700"}`}>
                            {n.title}
                          </p>
                          {n.description && (
                            <p className="text-[10px] text-ink-500 mt-0.5 m-0 leading-snug line-clamp-2">
                              {n.description}
                            </p>
                          )}
                          <p className="text-[9px] text-ink-400 mt-1 m-0 font-mono">
                            {relativeTime(n.created_at)}
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                {/* Footer: View All */}
                <Link
                  to="/notifications"
                  onClick={() => setIsBellOpen(false)}
                  className="block px-3.5 py-2 border-t border-line text-center text-[11px] font-semibold text-accent-700 hover:text-accent-900 hover:bg-surface-sunken/60 transition-colors"
                >
                  View All Notifications <ExternalLink className="w-3 h-3 inline-block ml-0.5 -mt-0.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Right: User Profile Avatar with Dropdown (32px Circle) */}
          <div className="hidden lg:block relative ml-1 sm:ml-2.5 shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen((prev) => !prev);
                setIsBellOpen(false);
              }}
              className="flex items-center gap-2 p-0.5 sm:p-1 rounded-lg hover:bg-surface-sunken transition-colors cursor-pointer focus:outline-none border border-transparent hover:border-line shrink-0"
              title="User Account Menu"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              {/* Avatar Circle: 32px diameter, #EEF0FF bg, #4338CA text */}
              <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-800 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-200 leading-none">
                {userInitials}
              </div>

              {/* Desktop User Info & Chevron */}
              <div className="hidden lg:flex flex-col text-left leading-tight pr-1">
                <span className="text-xs font-bold text-ink-900 max-w-[120px] truncate">
                  {userName || "User"}
                </span>
                <span className="text-[10px] font-medium text-ink-500 truncate uppercase tracking-wider">
                  {userRole || "Engineer"}
                </span>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-ink-400 hidden lg:block transition-transform duration-200 ${
                  isUserMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Floating Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-line rounded-xl shadow-lg p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Header in dropdown */}
                <div className="px-3 py-2 border-b border-line mb-1 bg-surface-sunken/50 rounded-lg">
                  <p className="text-xs font-bold text-ink-900 truncate m-0">
                    {userName || "FieldOps User"}
                  </p>
                  <p className="text-[10px] font-mono text-accent-700 uppercase tracking-wider mt-0.5 m-0">
                    {userRole || "Engineer"}
                  </p>
                </div>

                {/* Profile Link */}
                <Link
                  to="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors"
                  role="menuitem"
                >
                  <UserIcon className="w-4 h-4 text-ink-500" />
                  <span>My Profile</span>
                </Link>

                {/* Help Link */}
                <Link
                  to="/help-center"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-ink-700 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors"
                  role="menuitem"
                >
                  <HelpCircle className="w-4 h-4 text-ink-500" />
                  <span>Help &amp; Support</span>
                </Link>

                <div className="my-1 border-t border-line" />

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (onLogout) onLogout();
                    else navigate("/login");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left border-0 bg-transparent"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal */}
      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
    </>
  );
};

export default Navbar;
