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
  Activity,
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
}

export const MENU_ITEMS: MenuItem[] = [
  { id: "home", name: "Overview", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "new_dashboard", name: "Executive Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "expense", name: "Expense Claims", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP", "Accountant", "MIS"] },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP", "Travel Desk", "MIS"] },
  { id: "mis_report", name: "MIS Reports", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "kpi", name: "KPI Metrics", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP", "Accountant", "Travel Desk"] },
  { id: "analysis", name: "Deep Analytics", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"] },
  { id: "report", name: "Month Summary", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "consolidated_report", name: "Consolidated Reports", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"] },
  { id: "penalty_report", name: "Penalty Audit", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP", "Travel Desk"] },
  { id: "admin", name: "Admin Console", path: "/admin", icon: Settings, roles: ["Admin"] },
  { id: "db_monitor", name: "DB Health", path: "/db-monitor", icon: Activity, roles: ["Admin"] },
  { id: "upload_data", name: "Data Import", path: "/upload-data", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS"] },
  { id: "asset_upload", name: "Asset Master", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"] },
  { id: "profile", name: "My Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
  { id: "help", name: "Support & Help", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"] },
];

const NAV_GROUPS = [
  { label: "Main Workspace", ids: ["home", "new_dashboard"] },
  { label: "Operations & Claims", ids: ["expense", "approval"] },
  { label: "Reports & Insights", ids: ["mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Management & Config", ids: ["admin", "db_monitor", "upload_data", "asset_upload"] },
  { label: "User Account", ids: ["profile", "help"] },
];

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
          <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center shrink-0 shadow-md">
            {brandLogo ? (
              <img src={brandLogo} alt="Cyrix Logo" className="w-6 h-6 object-contain" />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-white text-base tracking-tight leading-tight">
                CYRIX <span className="text-accent-400 font-semibold text-xs uppercase tracking-wider block">FieldOps</span>
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
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {NAV_GROUPS.map((group) => {
          const groupItems = accessibleItems.filter((item) => group.ids.includes(item.id));
          if (groupItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {group.label}
                </div>
              )}
              {groupItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all group relative ${
                      isActive
                        ? "bg-accent-600 text-white font-semibold shadow-xs"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                    {isCollapsed && isActive && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent-400 rounded-l-full" />
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
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-accent-400 font-bold text-xs flex items-center justify-center shrink-0">
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
