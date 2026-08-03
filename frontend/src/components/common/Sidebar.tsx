import React from "react";
import { Link, useLocation } from "react-router-dom";
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
  UploadCloud,
  ShieldAlert,
  Package,
  Database,
  ClipboardList,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import brandLogo from "../../assets/images/brand.png";

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
  { id: "home",               name: "Overview",             path: "/home",               icon: Home,          roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-blue-500",    gradientTo: "to-blue-700",    shadowColor: "rgba(37,99,235,0.35)" },
  { id: "new_dashboard",      name: "Executive Dashboard",  path: "/new-dashboard",      icon: TrendingUp,    roles: ["Admin","Manager","Division Manager","Coordinator","MIS","VP","Accountant","Travel Desk"],                                  gradientFrom: "from-violet-500",  gradientTo: "to-purple-700",  shadowColor: "rgba(124,58,237,0.35)" },
  { id: "expense",            name: "Expense Claims",       path: "/submit-expense",     icon: FilePlus,      roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Project Head","Travel Desk","VP","Accountant","MIS"],         gradientFrom: "from-emerald-400", gradientTo: "to-emerald-600", shadowColor: "rgba(16,185,129,0.35)" },
  { id: "approval",           name: "Approval Center",      path: "/approval-center",    icon: CheckSquare,   roles: ["Admin","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","VP","Travel Desk","MIS"],              gradientFrom: "from-amber-400",   gradientTo: "to-orange-500",  shadowColor: "rgba(245,158,11,0.35)" },
  { id: "mis_report",         name: "MIS Reports",          path: "/mis-report",         icon: FileSpreadsheet, roles: ["Admin","Manager","Division Manager","MIS","VP","Accountant","Travel Desk"],                                             gradientFrom: "from-cyan-500",    gradientTo: "to-sky-700",     shadowColor: "rgba(6,182,212,0.35)" },
  { id: "kpi",                name: "KPI Metrics",          path: "/kpi-dashboard",      icon: Gauge,         roles: ["Admin","Manager","Division Manager","Engineer","Coordinator","Project Head","MIS","VP","Accountant","Travel Desk"],         gradientFrom: "from-rose-400",    gradientTo: "to-rose-600",    shadowColor: "rgba(244,63,94,0.35)" },
  { id: "analysis",           name: "Deep Analytics",       path: "/analysis",           icon: BarChart3,     roles: ["Admin","Manager","Division Manager","MIS","VP","Project Head","Travel Desk","Accountant","HR"],                            gradientFrom: "from-indigo-500",  gradientTo: "to-indigo-700",  shadowColor: "rgba(99,102,241,0.35)" },
  { id: "report",             name: "Month Summary",        path: "/month-report",       icon: Calendar,      roles: ["Admin","Manager","Division Manager","Accountant","HR","MIS","VP","Project Head","Travel Desk"],                            gradientFrom: "from-teal-400",    gradientTo: "to-teal-600",    shadowColor: "rgba(20,184,166,0.35)" },
  { id: "consolidated_report",name: "Consolidated Reports", path: "/consolidated-report",icon: ClipboardList, roles: ["Admin","Manager","Division Manager","Coordinator","Accountant","HR","MIS","VP","Project Head","Travel Desk"],              gradientFrom: "from-sky-400",     gradientTo: "to-blue-600",    shadowColor: "rgba(14,165,233,0.35)" },
  { id: "penalty_report",     name: "Penalty Audit",        path: "/penalty-report",     icon: ShieldAlert,   roles: ["Admin","Manager","Division Manager","Accountant","MIS","VP","Travel Desk"],                                               gradientFrom: "from-red-500",     gradientTo: "to-rose-700",    shadowColor: "rgba(239,68,68,0.35)" },
  { id: "admin",              name: "Admin Console",        path: "/admin",              icon: Settings,      roles: ["Admin"],                                                                                                                  gradientFrom: "from-slate-500",   gradientTo: "to-slate-700",   shadowColor: "rgba(100,116,139,0.35)" },
  { id: "db_monitor",         name: "DB Health",            path: "/db-monitor",         icon: Database,      roles: ["Admin"],                                                                                                                  gradientFrom: "from-green-500",   gradientTo: "to-emerald-700", shadowColor: "rgba(34,197,94,0.35)" },
  { id: "upload_data",        name: "Data Import",          path: "/upload-data",        icon: UploadCloud,   roles: ["Admin","Coordinator","MIS"],                                                                                              gradientFrom: "from-orange-400",  gradientTo: "to-amber-600",   shadowColor: "rgba(251,146,60,0.35)" },
  { id: "asset_upload",       name: "Asset Master",         path: "/asset-upload",       icon: Package,       roles: ["Admin","Coordinator","MIS","Engineer"],                                                                                   gradientFrom: "from-pink-400",    gradientTo: "to-rose-500",    shadowColor: "rgba(236,72,153,0.35)" },
  { id: "profile",            name: "My Profile",           path: "/profile",            icon: User,          roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-blue-400",    gradientTo: "to-cyan-600",    shadowColor: "rgba(96,165,250,0.35)" },
  { id: "help",               name: "Support & Help",       path: "/help-center",        icon: HelpCircle,    roles: ["Admin","Engineer","Manager","Division Manager","Coordinator","Accountant","HR","Project Head","Travel Desk","MIS","VP"], gradientFrom: "from-violet-400",  gradientTo: "to-purple-600",  shadowColor: "rgba(167,139,250,0.35)" },
];

const NAV_GROUPS = [
  { label: "Workspace",          ids: ["home", "new_dashboard"] },
  { label: "Claims & Approvals", ids: ["expense", "approval"] },
  { label: "Reports & Analytics",ids: ["mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Management & Config",ids: ["admin", "db_monitor", "upload_data", "asset_upload"] },
  { label: "Account",            ids: ["profile", "help"] },
];

// iOS-style gradient icon tile — matches HomePage IconTile style
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
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "scale-110" : "opacity-75 group-hover:opacity-100 group-hover:scale-105"}`}
    style={{ boxShadow: isActive ? `0 2px 8px -1px ${shadowColor}` : "none" }}
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
  userEmail,
  isCollapsed,
  onToggleCollapse,
  onLogout,
}) => {
  const location = useLocation();

  // Filter items by role
  const accessibleItems = MENU_ITEMS.filter(
    (item) => item.roles.includes("All") || item.roles.includes(userRole) || userRole === "Admin"
  );

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-900 text-slate-100 flex flex-col transition-all duration-300 border-r border-slate-800 shadow-xl ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <Link to="/home" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md" style={{ boxShadow: "0 2px 8px -1px rgba(37,99,235,0.5)" }}>
            {brandLogo ? (
              <img src={brandLogo} alt="Cyrix Logo" className="w-6 h-6 object-contain" />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-white text-base tracking-tight leading-tight">
                CYRIX <span className="text-blue-400 font-semibold text-xs uppercase tracking-wider block">Field Ops</span>
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer hidden md:flex items-center justify-center"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {NAV_GROUPS.map((group) => {
          const groupItems = accessibleItems.filter((item) => group.ids.includes(item.id));
          if (groupItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-3 pb-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  {group.label}
                </div>
              )}
              {groupItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs md:text-sm font-medium transition-all group relative ${
                      isActive
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
                    {/* Active indicator bar when collapsed */}
                    {isCollapsed && isActive && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-l-full" />
                    )}
                    {/* Active indicator dot when expanded */}
                    {!isCollapsed && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md" style={{ boxShadow: "0 2px 6px -1px rgba(37,99,235,0.4)" }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">{userName}</span>
                <span className="text-[10px] text-slate-400 truncate">{userEmail || userRole}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full flex justify-center py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
