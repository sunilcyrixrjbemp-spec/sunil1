import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Home,
  CheckSquare,
  FilePlus,
  BarChart3,
  Calendar,
  HelpCircle,
  User,
  Settings,
  Gauge,
  ShieldAlert,
  Package,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UploadCloud,
  RotateCcw,
  Wrench,
  Activity,
  Bell,
} from "lucide-react";
import { preloadRoute } from "../../utils/preload";

export interface NavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles?: string[];
}

export interface NavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  items: NavItem[];
  roles?: string[];
}

// ── Smart Categorization & Grouping Structure ────────────────────────────────
export const NAV_STRUCTURE: {
  coreOps: NavItem[];
  reportsGroup: NavGroup;
  adminGroup: NavGroup;
  supportItems: NavItem[];
} = {
  coreOps: [
    { id: "home", name: "Overview", path: "/home", icon: Home },
    { id: "expense", name: "Expense Claims (₹)", path: "/submit-expense", icon: FilePlus },
    { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare },
    { id: "trc_repair", name: "TRC Repair Hub", path: "/trc-repair", icon: Wrench },
  ],
  reportsGroup: {
    id: "reports_group",
    title: "Reports & Analytics",
    icon: BarChart3,
    items: [
      { id: "report", name: "Month Summary", path: "/month-report", icon: Calendar },
      { id: "consolidated_report", name: "Consolidated Reports", path: "/consolidated-report", icon: ClipboardList },
      { id: "kpi", name: "KPI Metrics", path: "/kpi-dashboard", icon: Gauge },
      { id: "analysis", name: "Deep Analytics", path: "/analysis", icon: BarChart3 },
      { id: "penalty_report", name: "Penalty Audit", path: "/penalty-report", icon: ShieldAlert },
    ],
  },
  adminGroup: {
    id: "admin_group",
    title: "Administration",
    icon: Settings,
    roles: ["Admin", "Coordinator", "MIS", "Manager", "Division Manager", "Project Head", "Travel Desk", "VP", "Accountant"],
    items: [
      { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"] },
      { id: "complaint_upload", name: "Complaint Upload", path: "/complaint-upload", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS", "Manager", "Division Manager", "Project Head", "Travel Desk", "VP", "Accountant"] },
      { id: "asset_upload", name: "Asset Master", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
      { id: "attendance", name: "Attendance Roster", path: "/attendance", icon: Calendar, roles: ["Admin"] },
      { id: "claim_level_reset", name: "Claim Level Reset", path: "/admin/claim-level-reset", icon: RotateCcw, roles: ["Admin"] },
      { id: "admin_analytics", name: "CF Analytics", path: "/admin/analytics", icon: Activity, roles: ["Admin"] },
    ],
  },
  supportItems: [
    { id: "notifications", name: "Notifications", path: "/notifications", icon: Bell },
    { id: "profile", name: "My Profile", path: "/profile", icon: User },
    { id: "help", name: "Help & Support", path: "/help-center", icon: HelpCircle },
  ],
};

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { title: "OPERATIONS", items: NAV_STRUCTURE.coreOps },
  { title: "REPORTS", items: NAV_STRUCTURE.reportsGroup.items },
  { title: "ADMIN", items: NAV_STRUCTURE.adminGroup.items },
  { title: "OTHERS", items: NAV_STRUCTURE.supportItems },
];

export interface SidebarProps {
  userRole: string;
  userName: string;
  userEmail?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  allowedWindows?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  userName,
  userEmail: _userEmail,
  isCollapsed,
  onToggleCollapse,
  onLogout: _onLogout,
  allowedWindows = ["home", "expense", "help", "profile"],
}) => {
  const location = useLocation();
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const isReportsActive = NAV_STRUCTURE.reportsGroup.items.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  );
  const isAdminActive = NAV_STRUCTURE.adminGroup.items.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  );

  const [openReports, setOpenReports] = useState<boolean>(true);
  const [openAdmin, setOpenAdmin] = useState<boolean>(true);

  useEffect(() => {
    if (isReportsActive) setOpenReports(true);
  }, [isReportsActive]);

  useEffect(() => {
    if (isAdminActive) setOpenAdmin(true);
  }, [isAdminActive]);

  const roleLower = (userRole || "").trim().toLowerCase();
  const isAdmin = roleLower === "admin";

  const isItemVisible = (item: NavItem) => {
    if (isAdmin) return true;
    
    // Core essential items universally accessible to EVERY employee by default:
    // Overview (Home), Expense Claims (₹), My Profile, Notifications, Help & Support
    const DEFAULT_UNIVERSAL_ITEMS = ["home", "expense", "profile", "notifications", "help"];
    if (DEFAULT_UNIVERSAL_ITEMS.includes(item.id.toLowerCase())) {
      return true;
    }

    // All other modules require assigned role or explicit window permission
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

  const userInitials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  const visibleCoreOps = NAV_STRUCTURE.coreOps.filter(isItemVisible);
  const visibleReports = NAV_STRUCTURE.reportsGroup.items.filter(isItemVisible);
  const visibleAdmin = NAV_STRUCTURE.adminGroup.items.filter(isItemVisible);
  const visibleSupport = NAV_STRUCTURE.supportItems.filter(isItemVisible);

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-white text-ink-900 flex flex-col transition-all duration-300 ease-in-out border-r border-line select-none ${
        isCollapsed ? "w-[56px]" : "w-[240px]"
      }`}
      style={{
        boxShadow: "1px 0 3px 0 rgba(18, 21, 26, 0.02)",
      }}
      aria-label="Main Sidebar Navigation"
    >
      {/* ── 64px Header Branding (Clean Official Logo & Typography) ──────── */}
      <div
        className={`h-16 flex items-center border-b border-line shrink-0 px-3.5 transition-all duration-300 ${
          isCollapsed ? "justify-center px-1" : "justify-between"
        }`}
      >
        <Link
          to="/home"
          className="flex items-center overflow-hidden group focus:outline-none"
          title="Cyrix Field Connect"
        >
          {/* Official Logo (Clean, No artificial background box) */}
          <img
            src="/logo-fieldconnect.png"
            alt="Cyrix Field Connect"
            className="h-8 w-auto object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </Link>

        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-surface-sunken border border-transparent hover:border-line transition-colors cursor-pointer hidden lg:flex items-center justify-center focus:outline-none"
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation Tree Area with Smart Grouping ─────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3 custom-scrollbar">
        {/* ── SECTION 1: CORE OPERATIONS (Direct Access) ────────────────── */}
        <div className="space-y-0.5">
          {!isCollapsed ? (
            <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold font-mono tracking-wider text-ink-400 uppercase">
              OPERATIONS
            </div>
          ) : (
            <div className="w-full my-1 border-t border-line/60" />
          )}

          {visibleCoreOps.map((item) => {
            const isActive = isRouteActive(item.path);
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => {
                  preloadRoute(item.path);
                  setHoveredItemId(item.id);
                }}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <Link
                  to={item.path}
                  className={`h-9 flex items-center gap-2.5 rounded-lg text-xs transition-all duration-150 relative ${
                    isCollapsed ? "justify-center px-0" : "px-2.5"
                  } ${
                    isActive
                      ? "bg-accent-50 text-accent-700 font-semibold"
                      : "text-ink-700 hover:text-ink-900 hover:bg-surface-sunken font-medium"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-accent-600" : "text-ink-500"
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="truncate text-[13px]">{item.name}</span>
                  )}

                  {!isCollapsed && isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-600 shrink-0" />
                  )}
                </Link>

                {/* Collapsed Tooltip */}
                {isCollapsed && hoveredItemId === item.id && (
                  <div className="fixed left-[62px] z-50 px-2.5 py-1 bg-ink-900 text-white text-xs font-medium rounded-md shadow-md whitespace-nowrap pointer-events-none -translate-y-1/2">
                    {item.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── SECTION 2: REPORTS & ANALYTICS (Smart Folder Accordion) ─────── */}
        {visibleReports.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {!isCollapsed ? (
              <div>
                {/* Accordion Toggle Header */}
                <button
                  type="button"
                  onClick={() => setOpenReports(!openReports)}
                  className="w-full h-8 flex items-center justify-between px-2.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-accent-600" />
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-ink-600">
                      REPORTS &amp; ANALYTICS
                    </span>
                  </div>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      openReports ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {/* Nested Sub-items */}
                {openReports && (
                  <div className="pl-3.5 mt-0.5 space-y-0.5 border-l-2 border-line ml-3">
                    {visibleReports.map((item) => {
                      const isActive = isRouteActive(item.path);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          onMouseEnter={() => preloadRoute(item.path)}
                          className={`h-8 flex items-center gap-2 rounded-md px-2 text-xs transition-colors ${
                            isActive
                              ? "bg-accent-50 text-accent-700 font-semibold"
                              : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken font-medium"
                          }`}
                        >
                          <Icon
                            size={14}
                            className={isActive ? "text-accent-600" : "text-ink-400"}
                          />
                          <span className="truncate text-xs">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Collapsed Mode Icon with Flyout
              <div
                className="relative"
                onMouseEnter={() => setHoveredItemId(NAV_STRUCTURE.reportsGroup.id)}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <div
                  className={`h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    isReportsActive ? "bg-accent-50 text-accent-700" : "text-ink-500 hover:bg-surface-sunken"
                  }`}
                >
                  <BarChart3 size={16} />
                </div>

                {hoveredItemId === NAV_STRUCTURE.reportsGroup.id && (
                  <div className="fixed left-[62px] z-50 w-48 bg-white border border-line rounded-lg shadow-lg p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-bold font-mono tracking-wider text-ink-400 uppercase px-2 py-1">
                      REPORTS &amp; ANALYTICS
                    </div>
                    {visibleReports.map((item) => (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                          isRouteActive(item.path)
                            ? "bg-accent-50 text-accent-700 font-semibold"
                            : "text-ink-700 hover:bg-surface-sunken"
                        }`}
                      >
                        <item.icon size={13} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 3: ADMINISTRATION (Smart Folder Accordion) ──────────── */}
        {visibleAdmin.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {!isCollapsed ? (
              <div>
                {/* Accordion Toggle Header */}
                <button
                  type="button"
                  onClick={() => setOpenAdmin(!openAdmin)}
                  className="w-full h-8 flex items-center justify-between px-2.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-accent-600" />
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-ink-600">
                      ADMINISTRATION
                    </span>
                  </div>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${
                      openAdmin ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {/* Nested Sub-items */}
                {openAdmin && (
                  <div className="pl-3.5 mt-0.5 space-y-0.5 border-l-2 border-line ml-3">
                    {visibleAdmin.map((item) => {
                      const isActive = isRouteActive(item.path);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          onMouseEnter={() => preloadRoute(item.path)}
                          className={`h-8 flex items-center gap-2 rounded-md px-2 text-xs transition-colors ${
                            isActive
                              ? "bg-accent-50 text-accent-700 font-semibold"
                              : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken font-medium"
                          }`}
                        >
                          <Icon
                            size={14}
                            className={isActive ? "text-accent-600" : "text-ink-400"}
                          />
                          <span className="truncate text-xs">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Collapsed Mode Icon with Flyout
              <div
                className="relative"
                onMouseEnter={() => setHoveredItemId(NAV_STRUCTURE.adminGroup.id)}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <div
                  className={`h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    isAdminActive ? "bg-accent-50 text-accent-700" : "text-ink-500 hover:bg-surface-sunken"
                  }`}
                >
                  <Settings size={16} />
                </div>

                {hoveredItemId === NAV_STRUCTURE.adminGroup.id && (
                  <div className="fixed left-[62px] z-50 w-48 bg-white border border-line rounded-lg shadow-lg p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-bold font-mono tracking-wider text-ink-400 uppercase px-2 py-1">
                      ADMINISTRATION
                    </div>
                    {visibleAdmin.map((item) => (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                          isRouteActive(item.path)
                            ? "bg-accent-50 text-accent-700 font-semibold"
                            : "text-ink-700 hover:bg-surface-sunken"
                        }`}
                      >
                        <item.icon size={13} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 4: SUPPORT & SYSTEM ─────────────────────────────────── */}
        <div className="space-y-0.5 pt-2 border-t border-line/60">
          {visibleSupport.map((item) => {
            const isActive = isRouteActive(item.path);
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => {
                  preloadRoute(item.path);
                  setHoveredItemId(item.id);
                }}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <Link
                  to={item.path}
                  className={`h-9 flex items-center gap-2.5 rounded-lg text-xs transition-all duration-150 ${
                    isCollapsed ? "justify-center px-0" : "px-2.5"
                  } ${
                    isActive
                      ? "bg-accent-50 text-accent-700 font-semibold"
                      : "text-ink-700 hover:text-ink-900 hover:bg-surface-sunken font-medium"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-accent-600" : "text-ink-500"
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="truncate text-[13px]">{item.name}</span>
                  )}
                </Link>

                {isCollapsed && hoveredItemId === item.id && (
                  <div className="fixed left-[62px] z-50 px-2.5 py-1 bg-ink-900 text-white text-xs font-medium rounded-md shadow-md whitespace-nowrap pointer-events-none -translate-y-1/2">
                    {item.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 48px Collapsed Mode Expand Button ────────────────────────────── */}
      {isCollapsed && (
        <div className="p-1 border-t border-line hidden lg:flex justify-center">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-surface-sunken transition-colors cursor-pointer w-full flex justify-center"
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── User Footer Profile (Clean, Redundant Logout Removed) ────────── */}
      <div className="p-2.5 border-t border-line bg-surface-sunken/40 shrink-0">
        {!isCollapsed ? (
          <Link
            to="/profile"
            className="flex items-center gap-2.5 min-w-0 overflow-hidden hover:opacity-85 transition-opacity"
            title="View Profile"
          >
            {/* User Initials Avatar */}
            <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-800 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-200">
              {userInitials}
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-bold text-ink-900 truncate">
                {userName || "FieldOps User"}
              </span>
              <span className="text-[10px] font-medium text-ink-500 truncate uppercase tracking-wider mt-0.5">
                {userRole || "Engineer"}
              </span>
            </div>
          </Link>
        ) : (
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full bg-accent-100 text-accent-800 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-200 mx-auto"
            title="View Profile"
          >
            {userInitials}
          </Link>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
