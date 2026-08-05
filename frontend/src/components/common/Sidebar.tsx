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
  FileSpreadsheet,
  Gauge,
  ShieldAlert,
  Package,
  ClipboardList,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Zap,
  Activity,
} from "lucide-react";
import React from "react";
import { useLocation, Link } from "react-router-dom";
import { authService } from "../../services/authService";

export interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
  gradientFrom: string;
  gradientTo: string;
  shadowColor: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { id: "home",               name: "Overview",             path: "/home",               icon: Home,          roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-blue-500",    gradientTo: "to-indigo-600", shadowColor: "rgba(37,99,235,0.35)" },
  { id: "new_dashboard",      name: "Executive Dashboard",  path: "/new-dashboard",      icon: TrendingUp,    roles: ["Admin","Manager","Division Manager","Coordinator","MIS","VP","Accountant","Travel Desk"],                                  gradientFrom: "from-violet-500",  gradientTo: "to-purple-600", shadowColor: "rgba(124,58,237,0.35)" },
  { id: "expense",            name: "Expense Claims",       path: "/submit-expense",     icon: FilePlus,      roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Project Head","Travel Desk","VP","Accountant","MIS"],         gradientFrom: "from-emerald-500", gradientTo: "to-teal-600",   shadowColor: "rgba(16,185,129,0.35)" },
  { id: "approval",           name: "Approval Center",      path: "/approval-center",    icon: CheckSquare,   roles: ["Admin","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","VP","Travel Desk","MIS"],              gradientFrom: "from-amber-500",   gradientTo: "to-orange-600", shadowColor: "rgba(245,158,11,0.35)" },
  { id: "mis_report",         name: "MIS Reports",          path: "/mis-report",         icon: FileSpreadsheet, roles: ["Admin","Manager","Division Manager","MIS","VP","Accountant","Travel Desk"],                                             gradientFrom: "from-cyan-500",    gradientTo: "to-blue-600",   shadowColor: "rgba(6,182,212,0.35)" },
  { id: "kpi",                name: "KPI Metrics",          path: "/kpi-dashboard",      icon: Gauge,         roles: ["Admin","Manager","Division Manager","Engineer","Coordinator","Project Head","MIS","VP","Accountant","Travel Desk"],         gradientFrom: "from-rose-500",    gradientTo: "to-red-600",    shadowColor: "rgba(244,63,94,0.35)" },
  { id: "analysis",           name: "Deep Analytics",       path: "/analysis",           icon: BarChart3,     roles: ["Admin","Manager","Division Manager","MIS","VP","Project Head","Travel Desk","Accountant","HR"],                            gradientFrom: "from-indigo-500",  gradientTo: "to-blue-700",   shadowColor: "rgba(99,102,241,0.35)" },
  { id: "report",             name: "Month Summary",        path: "/month-report",       icon: Calendar,      roles: ["Admin","Manager","Division Manager","Accountant","HR","MIS","VP","Project Head","Travel Desk"],                            gradientFrom: "from-teal-500",    gradientTo: "to-emerald-600", shadowColor: "rgba(20,184,166,0.35)" },
  { id: "consolidated_report",name: "Consolidated Reports", path: "/consolidated-report",icon: ClipboardList, roles: ["Admin","Manager","Division Manager","Coordinator","Accountant","HR","MIS","VP","Project Head","Travel Desk"],              gradientFrom: "from-sky-500",     gradientTo: "to-blue-600",   shadowColor: "rgba(14,165,233,0.35)" },
  { id: "penalty_report",     name: "Penalty Audit",        path: "/penalty-report",     icon: ShieldAlert,   roles: ["Admin","Manager","Division Manager","Accountant","MIS","VP","Travel Desk"],                                               gradientFrom: "from-red-500",     gradientTo: "to-rose-700",   shadowColor: "rgba(239,68,68,0.35)" },
  { id: "attendance",         name: "Attendance Roster",    path: "/attendance",         icon: Calendar,      roles: ["Admin"],                                                                                                                  gradientFrom: "from-indigo-500",  gradientTo: "to-cyan-600",   shadowColor: "rgba(99,102,241,0.35)" },
  { id: "admin",              name: "Admin Console",        path: "/admin",              icon: Settings,      roles: ["Admin"],                                                                                                                  gradientFrom: "from-slate-600",   gradientTo: "to-slate-800",  shadowColor: "rgba(100,116,139,0.35)" },
  { id: "admin_enterprise",   name: "Enterprise Panel",     path: "/admin/enterprise",   icon: Zap,           roles: ["Admin"],                                                                                                                  gradientFrom: "from-violet-600",  gradientTo: "to-purple-800", shadowColor: "rgba(139,92,246,0.35)" },
  { id: "admin_analytics",    name: "CF Analytics",         path: "/admin/analytics",    icon: Activity,      roles: ["Admin"],                                                                                                                  gradientFrom: "from-orange-500",  gradientTo: "to-amber-600",  shadowColor: "rgba(249,115,22,0.35)" },
  { id: "asset_upload",       name: "Asset Master",         path: "/asset-upload",       icon: Package,       roles: ["Admin","Coordinator","MIS","Engineer"],                                                                                   gradientFrom: "from-pink-500",    gradientTo: "to-rose-600",   shadowColor: "rgba(236,72,153,0.35)" },
  { id: "profile",            name: "My Profile",           path: "/profile",            icon: User,          roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-blue-500",    gradientTo: "to-indigo-600", shadowColor: "rgba(96,165,250,0.35)" },
  { id: "help",               name: "Support & Help",       path: "/help-center",        icon: HelpCircle,    roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-purple-500",  gradientTo: "to-violet-600", shadowColor: "rgba(167,139,250,0.35)" },
];

const NAV_GROUPS = [
  { label: "Workspace",          ids: ["home", "new_dashboard"] },
  { label: "Claims & Approvals", ids: ["expense", "approval"] },
  { label: "Reports & Analytics",ids: ["attendance", "mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Management & Config",ids: ["admin", "admin_enterprise", "admin_analytics", "asset_upload"] },
  { label: "Account",            ids: ["profile", "help"] },
];

// iOS / Meta AI style gradient icon tile — matches HomePage IconTile component 1:1
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
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white shrink-0 transition-all duration-200 ${isActive ? "scale-105" : "opacity-85 group-hover:opacity-100 group-hover:scale-105"}`}
    style={{ boxShadow: isActive ? `0 2px 6px -1px ${shadowColor}` : "none" }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

interface SidebarProps {
  userRole: string;
  userName: string;
  userEmail?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  userName,
  userEmail: _userEmail,
  isCollapsed,
  onToggleCollapse,
  onLogout,
}) => {
  const location = useLocation();

  const currentUser = authService.getCurrentUser();
  let allowedWindows: string[] = ["home", "expense", "help", "profile"];
  if (currentUser?.allowed_windows !== undefined && currentUser?.allowed_windows !== null) {
    if (Array.isArray(currentUser.allowed_windows)) {
      allowedWindows = currentUser.allowed_windows.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
    } else if (typeof currentUser.allowed_windows === "string") {
      allowedWindows = currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
    }
  } else if (currentUser?.window_permissions) {
    try {
      const perms = typeof currentUser.window_permissions === "string"
        ? JSON.parse(currentUser.window_permissions)
        : currentUser.window_permissions;
      if (Array.isArray(perms)) {
        allowedWindows = perms.map((w: any) => String(w).trim().toLowerCase()).filter(Boolean);
      }
    } catch (e) {}
  }

  // Strictly map accessible menu items to user's assigned allowed_windows. No role fallback or auto-grant.
  const accessibleItems = MENU_ITEMS.filter((item) => {
    return allowedWindows.includes(item.id.toLowerCase());
  });

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#16222F] text-slate-100 flex flex-col transition-all duration-300 border-r border-[#263749] shadow-xl ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* HomePage Exact Dark Slate-Blue Header Bar (#4A6A8A) */}
      <div className="h-14 px-3.5 bg-[#4A6A8A] flex items-center justify-between border-b border-[#3B546F] shrink-0 text-white shadow-2xs">
        <Link to="/home" className="flex items-center gap-2 overflow-hidden">
          <div className="bg-white/95 px-2 py-1 rounded-lg shadow-2xs flex items-center shrink-0">
            <img
              src="/logo-fieldconnect.png"
              alt="Cyrix Field Connect"
              className="h-6 w-auto max-w-[160px] object-contain"
            />
          </div>
        </Link>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer hidden md:flex items-center justify-center"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Groups List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 custom-scrollbar">
        {NAV_GROUPS.map((group) => {
          const groupItems = accessibleItems.filter((item) => group.ids.includes(item.id));
          if (groupItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-bold tracking-wider text-[#8FA8C4] uppercase">
                  {group.label}
                </div>
              )}
              {groupItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all group relative border ${
                      isActive
                        ? "bg-[#4A6A8A] text-white border-[#3B546F] shadow-2xs"
                        : "bg-[#1E2D3E]/60 text-slate-300 border-[#26384C] hover:border-[#38516B] hover:text-white hover:bg-[#233448]"
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <IconTile
                      icon={item.icon}
                      gradientFrom={item.gradientFrom}
                      gradientTo={item.gradientTo}
                      shadowColor={item.shadowColor}
                      isActive={isActive}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                    {isCollapsed && isActive && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-l-full" />
                    )}
                    {!isCollapsed && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Profile Footer - Slate-Blue Theme (#233448) */}
      <div className="p-2.5 border-t border-[#263749] bg-[#111A24] shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-[#4A6A8A] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 leading-none">
                <span className="text-[11px] font-bold text-white truncate">{userName}</span>
                <span className="text-[9.5px] text-slate-400 truncate mt-0.5">{userRole}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full flex justify-center py-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
