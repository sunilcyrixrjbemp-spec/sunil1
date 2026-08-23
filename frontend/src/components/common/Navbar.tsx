import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import CommandPalette from "./CommandPalette";

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
  "/mis-report": "MIS Reports",
  "/kpi-dashboard": "KPI Metrics",
  "/analysis": "Deep Analytics",
  "/month-report": "Month Summary",
  "/consolidated-report": "Consolidated Reports",
  "/penalty-report": "Penalty Audit",
  "/penalty-module": "Penalty Module",
  "/attendance": "Attendance Roster",
  "/admin": "Admin Panel",
  "/admin/claim-level-reset": "Claim Level Reset",
  "/admin/enterprise": "Enterprise Panel",
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
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-white border-b border-line px-3.5 md:px-6 flex items-center justify-between gap-3 shadow-none pt-[env(safe-area-inset-top)]">
        {/* Left Section: Mobile Brand Mark / Desktop Sidebar Toggle + Page Title */}
        <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
          {/* Mobile Logo Mark (Clean, 24px) */}
          <Link to="/home" className="lg:hidden flex items-center shrink-0">
            <img
              src="/logo-fieldconnect.png"
              alt="Cyrix"
              className="h-6 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </Link>

          {/* Desktop/Tablet Sidebar Collapse Toggle */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden lg:flex p-1.5 text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer focus:outline-none border border-transparent hover:border-line"
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

          {/* Dynamic Page Title in font-display (Inter Tight) */}
          <div className="flex items-center min-w-0">
            <h1 className="font-display text-sm md:text-base font-bold text-ink-900 tracking-tight truncate">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Center Section: Command Palette Trigger Bar (Desktop) */}
        <button
          type="button"
          onClick={() => setIsCmdOpen(true)}
          className="hidden md:flex items-center justify-between gap-3 px-3 py-1.5 bg-surface-sunken hover:bg-[#EAE8E4] border border-line rounded-lg text-xs text-ink-500 transition-all cursor-pointer w-56 lg:w-72 shadow-none group focus:outline-none focus:ring-1 focus:ring-accent-600"
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

        {/* Right Section: Mobile Search, PWA Install, Notifications, User Profile */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Mobile Command Palette Search Trigger */}
          <button
            type="button"
            onClick={() => setIsCmdOpen(true)}
            className="md:hidden p-2 text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* PWA Install Button */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallApp}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg border border-accent-200 transition-all cursor-pointer shadow-none"
              title="Install Cyrix FieldOps App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Notification Bell with Unread Badge */}
          <Link
            to="/notifications"
            className="relative p-2 text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded-lg transition-colors cursor-pointer"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-600 ring-2 ring-white animate-pulse" />
            )}
          </Link>

          {/* User Profile Avatar with Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-sunken transition-colors cursor-pointer focus:outline-none border border-transparent hover:border-line"
              title="User Account Menu"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              {/* Avatar Circle: #EEF0FF bg, #4338CA text */}
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-accent-100 text-accent-800 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-200">
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
