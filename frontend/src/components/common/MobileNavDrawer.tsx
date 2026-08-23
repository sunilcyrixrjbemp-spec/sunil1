import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X,
  HelpCircle,
} from "lucide-react";
import { NAV_STRUCTURE, NavItem } from "./Sidebar";
import { preloadRoute } from "../../utils/preload";

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
  allowedWindows?: string[];
  isAdmin?: boolean;
  onLogout: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  userName,
  userRole,
  allowedWindows = ["home", "expense", "help", "profile"],
  isAdmin = false,
  onLogout: _onLogout,
}) => {
  const location = useLocation();
  const roleLower = (userRole || "").trim().toLowerCase();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isItemVisible = (item: NavItem) => {
    if (isAdmin) return true;
    const DEFAULT_UNIVERSAL_ITEMS = ["home", "expense", "profile", "notifications", "help"];
    if (DEFAULT_UNIVERSAL_ITEMS.includes(item.id.toLowerCase())) {
      return true;
    }
    if (item.roles && !item.roles.map((r) => r.toLowerCase()).includes(roleLower)) {
      return false;
    }
    const idLower = item.id.toLowerCase();
    return allowedWindows.map((w) => w.toLowerCase()).includes(idLower);
  };

  const isRouteActive = (itemPath: string) => {
    if (itemPath === "/home") {
      return location.pathname === "/home" || location.pathname === "/";
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + "/");
  };

  const visibleCoreOps = NAV_STRUCTURE.coreOps.filter(isItemVisible);
  const visibleReports = NAV_STRUCTURE.reportsGroup.items.filter(isItemVisible);
  const visibleAdmin = NAV_STRUCTURE.adminGroup.items.filter(isItemVisible);

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end" role="dialog" aria-modal="true">
      {/* Dimmed Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Native Mobile Bottom Sheet Modal ─────────────────────────────── */}
      <div className="relative w-full max-h-[85vh] bg-white text-ink-900 rounded-t-3xl shadow-2xl flex flex-col z-10 border-t border-line animate-in slide-in-from-bottom duration-300 ease-out select-none">
        {/* Drag Pill Handle */}
        <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-12 h-1.5 rounded-full bg-ink-300/60" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-fieldconnect.png"
              alt="Cyrix"
              className="h-6 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <h3 className="font-display font-bold text-sm text-ink-900 m-0 leading-tight">
                All Modules &amp; Features
              </h3>
              <p className="text-[11px] text-ink-500 font-medium m-0">
                Quick access to all operations &amp; reports
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-sunken hover:bg-surface text-ink-500 hover:text-ink-900 flex items-center justify-center transition-colors cursor-pointer border border-line"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sheet Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar pb-10">
          {/* ── SECTION 1: CORE OPERATIONS (Quick Action Grid) ─────────────── */}
          <div>
            <div className="text-[11px] font-bold font-mono tracking-wider text-ink-400 uppercase mb-2.5 px-1">
              CORE OPERATIONS
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {visibleCoreOps.map((item) => {
                const isActive = isRouteActive(item.path);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    onMouseEnter={() => preloadRoute(item.path)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all active:scale-95 ${
                      isActive
                        ? "bg-accent-50 border-accent-300 text-accent-800 shadow-2xs font-semibold"
                        : "bg-surface-sunken/40 border-line hover:border-line-strong text-ink-700 font-medium"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 ${
                        isActive
                          ? "bg-accent-600 text-white shadow-xs"
                          : "bg-white text-accent-700 border border-line"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="text-[11px] leading-tight line-clamp-2">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── SECTION 2: REPORTS & ANALYTICS (Card Grid) ─────────────────── */}
          {visibleReports.length > 0 && (
            <div>
              <div className="text-[11px] font-bold font-mono tracking-wider text-ink-400 uppercase mb-2 px-1">
                REPORTS &amp; ANALYTICS
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleReports.map((item) => {
                  const isActive = isRouteActive(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={onClose}
                      onMouseEnter={() => preloadRoute(item.path)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all active:scale-98 ${
                        isActive
                          ? "bg-accent-50 border-accent-300 text-accent-800 font-semibold"
                          : "bg-white border-line hover:border-line-strong text-ink-700 font-medium"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-sunken text-accent-700 flex items-center justify-center shrink-0 border border-line">
                        <Icon size={15} />
                      </div>
                      <span className="text-xs truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SECTION 3: ADMINISTRATION (For Admins) ────────────────────── */}
          {visibleAdmin.length > 0 && (
            <div>
              <div className="text-[11px] font-bold font-mono tracking-wider text-ink-400 uppercase mb-2 px-1">
                ADMINISTRATION &amp; UPLOADS
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleAdmin.map((item) => {
                  const isActive = isRouteActive(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={onClose}
                      onMouseEnter={() => preloadRoute(item.path)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all active:scale-98 ${
                        isActive
                          ? "bg-accent-50 border-accent-300 text-accent-800 font-semibold"
                          : "bg-white border-line hover:border-line-strong text-ink-700 font-medium"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-sunken text-accent-700 flex items-center justify-center shrink-0 border border-line">
                        <Icon size={15} />
                      </div>
                      <span className="text-xs truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SECTION 4: ACCOUNT & HELP ──────────────────────────────────── */}
          <div className="pt-2 border-t border-line">
            <div className="flex items-center justify-between gap-3 bg-surface-sunken/60 p-3 rounded-2xl border border-line">
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-800 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-200">
                  {userName ? userName.slice(0, 2).toUpperCase() : "CF"}
                </div>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs font-bold text-ink-900 truncate">
                    {userName || "FieldOps User"}
                  </span>
                  <span className="text-[10px] font-medium text-ink-500 uppercase tracking-wider">
                    {userRole || "Engineer"}
                  </span>
                </div>
              </Link>

              <Link
                to="/help-center"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-accent-700 bg-white hover:bg-surface rounded-lg border border-line shadow-2xs"
              >
                <HelpCircle size={13} />
                <span>Help</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNavDrawer;
