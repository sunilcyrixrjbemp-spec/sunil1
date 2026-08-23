import React from "react";
import { FileText, Calendar, ChevronDown, Sparkles, Users, User, MapPin, Building2, UserCircle, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

interface ZohoHeaderProps {
  user: any;
  isReviewerRole: boolean;
  activeTab: "my-claims" | "team-claims";
  onTabChange: (tab: "my-claims" | "team-claims") => void;
  myExpensesCount: number;
  teamExpensesCount: number;
  pendingApprovalsCount?: number;
  pendingLimitRequestsCount?: number;
  selectMonth: string;
  onSelectMonth: (month: string) => void;
  // Dynamic Dropdown Filter Props
  filterZone?: string;
  onFilterZoneChange?: (zone: string) => void;
  uniqueZones?: string[];
  filterDistrict?: string;
  onFilterDistrictChange?: (dist: string) => void;
  uniqueDistricts?: string[];
  filterEmployee?: string;
  onFilterEmployeeChange?: (emp: string) => void;
  uniqueEmployees?: { code: string; name: string }[];
}

export const ZohoHeader: React.FC<ZohoHeaderProps> = ({
  user,
  isReviewerRole,
  activeTab,
  onTabChange,
  myExpensesCount,
  teamExpensesCount,
  selectMonth,
  onSelectMonth,
  filterZone = "all",
  onFilterZoneChange,
  uniqueZones = [],
  filterDistrict = "all",
  onFilterDistrictChange,
  uniqueDistricts = [],
  filterEmployee = "all",
  onFilterEmployeeChange,
  uniqueEmployees = [],
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const monthOptions = React.useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const val = `${yyyy}-${mm}`;
      const name = `${MONTHS[d.getMonth()]} ${yyyy}`;
      if (i === 0) {
        options.push({ value: val, label: `This Month (${name})` });
      } else if (i === 1) {
        options.push({ value: val, label: `Last Month (${name})` });
      } else {
        options.push({ value: val, label: name });
      }
    }
    return options;
  }, []);

  const hasActiveFilters = filterZone !== "all" || filterDistrict !== "all" || filterEmployee !== "all";

  const handleZoneChange = (zone: string) => {
    if (onFilterZoneChange) onFilterZoneChange(zone);
    if (onFilterDistrictChange) onFilterDistrictChange("all");
    if (onFilterEmployeeChange) onFilterEmployeeChange("all");
  };

  const handleDistrictChange = (dist: string) => {
    if (onFilterDistrictChange) onFilterDistrictChange(dist);
    if (onFilterEmployeeChange) onFilterEmployeeChange("all");
  };

  const handleResetFilters = () => {
    if (onFilterZoneChange) onFilterZoneChange("all");
    if (onFilterDistrictChange) onFilterDistrictChange("all");
    if (onFilterEmployeeChange) onFilterEmployeeChange("all");
  };

  return (
    <div
      className="bg-white rounded-[6px] border border-[#4f4f4f]/30 p-3.5 space-y-3 relative z-10"
      style={{
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* ── TOP TIER: User Identity & Clean Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-[#E7E5E1]">
        {/* Left: User Avatar & Greetings */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[4px] bg-[#1E1B4B] text-white font-display font-bold text-xs flex items-center justify-center shadow-xs shrink-0 tracking-wider">
            {getInitials(user?.name || "User")}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold font-display text-ink-900 tracking-tight m-0 leading-none">
                {getGreeting()}, {user?.name || "User"}
              </h1>
              {user?.role && (
                <span className="text-[10px] font-semibold text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-[3px] leading-tight inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-accent-500" />
                  <span>{user.role}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-500 font-sans mt-1 m-0 flex items-center gap-1.5 leading-none">
              <Calendar className="w-3 h-3 text-ink-400" />
              <span>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Crisp Geometric "All Claims Ledger" Link */}
        <div className="flex items-center gap-2 justify-end">
          <Link
            to="/claims-history"
            className="uiverse-btn h-9 rounded-[4px] border border-[#4f4f4f] text-xs font-semibold px-3.5"
          >
            <FileText className="w-3.5 h-3.5 text-accent-600" />
            <span>All Claims Ledger</span>
          </Link>
        </div>
      </div>

      {/* ── BOTTOM TIER: Scope Buttons & Dropdown Filters — ALL IN ONE CRISP GEOMETRIC ROW ── */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 w-full flex-nowrap">
        {/* Left: Geometric Scope Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isReviewerRole ? (
            <>
              <button
                type="button"
                onClick={() => onTabChange("my-claims")}
                className={`uiverse-btn h-9 rounded-[4px] text-xs font-semibold px-3.5 shrink-0 ${
                  activeTab === "my-claims"
                    ? "border-accent-600 bg-accent-50 text-accent-700 font-bold ring-1 ring-accent-400"
                    : "border-[#4f4f4f] bg-white text-ink-800"
                }`}
              >
                <User className="w-3.5 h-3.5 text-accent-600" />
                <span>My Claims ({myExpensesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange("team-claims")}
                className={`uiverse-btn h-9 rounded-[4px] text-xs font-semibold px-3.5 shrink-0 ${
                  activeTab === "team-claims"
                    ? "border-accent-600 bg-accent-50 text-accent-700 font-bold ring-1 ring-accent-400"
                    : "border-[#4f4f4f] bg-white text-ink-800"
                }`}
              >
                <Users className="w-3.5 h-3.5 text-accent-600" />
                <span>Team Claims ({teamExpensesCount})</span>
              </button>
            </>
          ) : (
            <div className="h-9 px-3.5 bg-white rounded-[4px] border border-[#4f4f4f] flex items-center gap-2 text-xs font-semibold text-ink-700 shrink-0">
              <User className="w-3.5 h-3.5 text-accent-600" />
              <span>Personal Claims ({myExpensesCount})</span>
            </div>
          )}
        </div>

        {/* Right: Crisp Geometric Dropdown Filters — All in one line with exact same h-9 height */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* 1. Month Selector Dropdown */}
          <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600">
            <Calendar className="w-3.5 h-3.5 text-accent-600 mr-1.5 shrink-0" />
            <select
              value={selectMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="h-full pr-5 text-xs font-semibold text-ink-800 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
              title="Select Month"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-ink-400 absolute right-2 pointer-events-none" />
          </div>

          {/* 2. Zone Dropdown (Always visible in Team Scope) */}
          {activeTab === "team-claims" && (
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
              <select
                value={filterZone}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="h-full pr-5 text-xs font-semibold text-ink-800 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Select Zone"
              >
                <option value="all">All Zones</option>
                {uniqueZones.map((z) => (
                  <option key={z} value={z}>
                    Zone {z}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-400 absolute right-2 pointer-events-none" />
            </div>
          )}

          {/* 3. District Dropdown (Always visible in Team Scope) */}
          {activeTab === "team-claims" && (
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600 max-w-[190px]">
              <Building2 className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
              <select
                value={filterDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="h-full w-full pr-5 text-xs font-semibold text-ink-800 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none truncate"
                title="Select District"
              >
                <option value="all">All Districts</option>
                {uniqueDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-400 absolute right-2 pointer-events-none" />
            </div>
          )}

          {/* 4. Engineer / Coordinator / Staff Dropdown (Always visible in Team Scope) */}
          {activeTab === "team-claims" && (
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600 max-w-[210px]">
              <UserCircle className="w-3.5 h-3.5 text-accent-600 mr-1.5 shrink-0" />
              <select
                value={filterEmployee}
                onChange={(e) => onFilterEmployeeChange && onFilterEmployeeChange(e.target.value)}
                className="h-full w-full pr-5 text-xs font-semibold text-ink-800 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none truncate"
                title="Select Engineer / Staff"
              >
                <option value="all">All Engineers / Staff</option>
                {uniqueEmployees.map((emp) => (
                  <option key={emp.code} value={emp.code}>
                    {emp.name} [{emp.code}]
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-400 absolute right-2 pointer-events-none" />
            </div>
          )}

          {/* 5. Geometric Reset Filters Button */}
          {activeTab === "team-claims" && hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="uiverse-btn uiverse-btn-rose h-9 rounded-[4px] px-3 shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
