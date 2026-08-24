import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X,
  Home,
  Wrench,
  TrendingUp,
  Settings,
  CheckSquare,
  FilePlus,
  FileSpreadsheet,
  Gauge,
  RotateCcw,
  UploadCloud,
  Package,
  ShieldAlert,
  BarChart3,
  Calendar,
  HelpCircle,
  User,
  LogOut,
} from "lucide-react";

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
  allowedWindows?: string[];
  isAdmin?: boolean;
  onLogout: () => void;
}

const ALL_NAV_ITEMS = [
  { id: "home", name: "Overview", path: "/home", icon: Home, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], gradientFrom: "from-blue-500", gradientTo: "to-indigo-600", shadowColor: "rgba(59, 130, 246, 0.35)" },
  { id: "trc_repair", name: "TRC Repair Hub", path: "/trc-repair", icon: Wrench, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Engineer", "Project Head", "MIS", "Accountant", "Travel Desk", "VP"], gradientFrom: "from-cyan-500", gradientTo: "to-blue-600", shadowColor: "rgba(6, 182, 212, 0.35)" },
  { id: "new_dashboard", name: "Executive Dashboard", path: "/new-dashboard", icon: TrendingUp, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-violet-500", gradientTo: "to-purple-600", shadowColor: "rgba(124, 58, 237, 0.35)" },
  { id: "admin", name: "Admin Panel", path: "/admin", icon: Settings, roles: ["Admin"], gradientFrom: "from-slate-600", gradientTo: "to-slate-800", shadowColor: "rgba(100, 116, 139, 0.35)" },
  { id: "approval", name: "Approval Center", path: "/approval-center", icon: CheckSquare, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "VP", "Travel Desk", "MIS"], gradientFrom: "from-amber-500", gradientTo: "to-orange-600", shadowColor: "rgba(245, 158, 11, 0.35)" },
  { id: "expense", name: "Expense Claims", path: "/submit-expense", icon: FilePlus, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Project Head", "Travel Desk", "VP", "Accountant", "MIS"], gradientFrom: "from-emerald-500", gradientTo: "to-teal-600", shadowColor: "rgba(16, 185, 129, 0.35)" },
  { id: "mis_report", name: "MIS Reports", path: "/mis-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-cyan-500", gradientTo: "to-blue-600", shadowColor: "rgba(6, 182, 212, 0.35)" },
  { id: "kpi", name: "KPI Metrics", path: "/kpi-dashboard", icon: Gauge, roles: ["Admin", "Manager", "Division Manager", "Engineer", "Coordinator", "Project Head", "MIS", "VP", "Accountant", "Travel Desk"], gradientFrom: "from-rose-500", gradientTo: "to-red-600", shadowColor: "rgba(244, 63, 94, 0.35)" },
  { id: "claim_level_reset", name: "Claim Level Reset", path: "/admin/claim-level-reset", icon: RotateCcw, roles: ["Admin"], gradientFrom: "from-amber-600", gradientTo: "to-orange-700", shadowColor: "rgba(217, 119, 6, 0.35)" },
  { id: "complaint_upload", name: "Complaint Upload", path: "/complaint-upload", icon: UploadCloud, roles: ["Admin", "Coordinator", "MIS", "Manager", "Division Manager", "Project Head", "Travel Desk", "VP", "Accountant"], gradientFrom: "from-indigo-600", gradientTo: "to-blue-700", shadowColor: "rgba(79, 70, 229, 0.35)" },
  { id: "asset_upload", name: "Asset Master", path: "/asset-upload", icon: Package, roles: ["Admin", "Coordinator", "MIS", "Engineer"], gradientFrom: "from-pink-500", gradientTo: "to-rose-600", shadowColor: "rgba(236, 72, 153, 0.35)" },
  { id: "penalty_report", name: "Penalty Audit", path: "/penalty-report", icon: ShieldAlert, roles: ["Admin", "Manager", "Division Manager", "Accountant", "MIS", "VP", "Travel Desk"], gradientFrom: "from-red-500", gradientTo: "to-rose-700", shadowColor: "rgba(239, 68, 68, 0.35)" },
  { id: "analysis", name: "Deep Analytics", path: "/analysis", icon: BarChart3, roles: ["Admin", "Manager", "Division Manager", "MIS", "VP", "Project Head", "Travel Desk", "Accountant", "HR"], gradientFrom: "from-indigo-500", gradientTo: "to-blue-700", shadowColor: "rgba(99, 102, 241, 0.35)" },
  { id: "report", name: "Month Summary", path: "/month-report", icon: Calendar, roles: ["Admin", "Manager", "Division Manager", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"], gradientFrom: "from-teal-500", gradientTo: "to-emerald-600", shadowColor: "rgba(20, 184, 166, 0.35)" },
  { id: "consolidated_report", name: "Consolidated Reports", path: "/consolidated-report", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "MIS", "VP", "Project Head", "Travel Desk"], gradientFrom: "from-sky-500", gradientTo: "to-blue-600", shadowColor: "rgba(14, 165, 233, 0.35)" },
  { id: "attendance", name: "Attendance Roster", path: "/attendance", icon: Calendar, roles: ["Admin"], gradientFrom: "from-indigo-500", gradientTo: "to-cyan-600", shadowColor: "rgba(99, 102, 241, 0.35)" },
  { id: "help", name: "Help & Support", path: "/help-center", icon: HelpCircle, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], gradientFrom: "from-purple-500", gradientTo: "to-violet-600", shadowColor: "rgba(167, 139, 250, 0.35)" },
  { id: "profile", name: "My Profile", path: "/profile", icon: User, roles: ["Admin", "Engineer", "Manager", "Division Manager", "Coordinator", "Accountant", "HR", "Project Head", "Travel Desk", "MIS", "VP"], gradientFrom: "from-blue-500", gradientTo: "to-indigo-600", shadowColor: "rgba(96, 165, 250, 0.35)" },
];

const SIDEBAR_SECTIONS = [
  { label: "Workspace & TRC", ids: ["home", "trc_repair", "new_dashboard"] },
  { label: "Claims & Approvals", ids: ["expense", "approval"] },
  { label: "Reports & Analytics", ids: ["attendance", "mis_report", "kpi", "analysis", "report", "consolidated_report", "penalty_report"] },
  { label: "Administration", ids: ["admin", "claim_level_reset", "complaint_upload", "asset_upload"] },
  { label: "Account", ids: ["profile", "help"] },
];

// iOS-style gradient icon tile — matches commit f5dcac5 1:1
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
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "scale-105" : "opacity-80 group-hover:opacity-100 group-hover:scale-105"}`}
    style={{ boxShadow: isActive ? `0 2px 6px -1px ${shadowColor}` : "none" }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  userName,
  userRole,
  allowedWindows = ["home", "expense", "help", "profile"],
  isAdmin = false,
  onLogout,
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

  const initials = userName
    ? userName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs select-none">
      {/* Dimmed Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Container (Exact f5dcac5 design) */}
      <div className="relative w-full max-h-[85vh] bg-slate-50 rounded-t-3xl shadow-2xl flex flex-col z-10 border-t border-slate-200 animate-in slide-in-from-bottom duration-300 ease-out">
        {/* Top Handle */}
        <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-2 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/apple-touch-icon.png" alt="Cyrix" className="h-6 w-6 rounded-md object-contain" />
            <span className="text-sm font-bold text-slate-800">All Menus &amp; Services</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer border-0"
            title="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sheet Scrollable Menu Sections */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-12">
          {SIDEBAR_SECTIONS.map((section) => {
            const sectionItems = ALL_NAV_ITEMS.filter((item) => {
              if (!section.ids.includes(item.id)) return false;
              if (isAdmin) return true;
              const DEFAULT_UNIVERSAL_ITEMS = ["home", "expense", "profile", "help"];
              if (DEFAULT_UNIVERSAL_ITEMS.includes(item.id.toLowerCase())) return true;
              if (item.roles && !item.roles.map((r) => r.toLowerCase()).includes(roleLower)) return false;
              const idLower = item.id.toLowerCase();
              return allowedWindows.includes(idLower);
            });

            if (sectionItems.length === 0) return null;

            return (
              <div key={section.label} className="space-y-2">
                <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1 m-0">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sectionItems.map((item) => {
                    const isActive =
                      item.path === "/home"
                        ? location.pathname === "/home" || location.pathname === "/"
                        : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all border ${
                          isActive
                            ? "bg-[#4A6A8A] text-white border-[#3B546F] shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200/80 shadow-2xs"
                        }`}
                      >
                        <IconTile
                          icon={item.icon}
                          gradientFrom={item.gradientFrom}
                          gradientTo={item.gradientTo}
                          shadowColor={item.shadowColor}
                          isActive={isActive}
                        />
                        <span className="truncate text-[11px]">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* User Profile Summary & Logout */}
          <div className="pt-3 border-t border-slate-200/90 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[#4A6A8A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex flex-col min-w-0 leading-none">
                <span className="text-xs font-bold text-slate-800 truncate">{userName || "Employee"}</span>
                <span className="text-[10px] text-slate-500 truncate mt-0.5">{userRole}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer border border-rose-200/80"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNavDrawer;
