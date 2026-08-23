import React, { useState, useMemo } from "react";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Search, 
  MessageCircle, 
  X, 
  ShieldCheck
} from "lucide-react";

interface ZohoSubmissionComplianceWidgetProps {
  expenses: any[];
  selectMonth: string; // e.g. "2026-08"
  filterZone?: string;
  filterDistrict?: string;
  filterEmployee?: string;
  uniqueEmployees?: { code: string; name: string }[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

export const ZohoSubmissionComplianceWidget: React.FC<ZohoSubmissionComplianceWidgetProps> = ({
  expenses = [],
  selectMonth = "2026-08",
  filterZone = "all",
  filterDistrict = "all",
  filterEmployee = "all",
  uniqueEmployees = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "compliant" | "pending" | "defaulter">("all");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Parse Year and Month
  const { year, monthIndex, monthLabel } = useMemo(() => {
    const [yStr, mStr] = (selectMonth || "2026-08").split("-");
    const year = parseInt(yStr) || new Date().getFullYear();
    const month = parseInt(mStr) || (new Date().getMonth() + 1);
    const monthIndex = month - 1;
    const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
    return { year, monthIndex, monthLabel };
  }, [selectMonth]);

  // Calculate working days in month (Excluding Sundays)
  const { dateList, totalWorkingDaysTillNow } = useMemo(() => {
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIndex;
    const currentDayLimit = isCurrentMonth ? now.getDate() : totalDays;

    const list = [];
    let workingDaysCount = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dayStr = String(day).padStart(2, "0");
      const d = new Date(year, monthIndex, day);
      const isSunday = d.getDay() === 0;
      const isPastOrToday = day <= currentDayLimit;
      
      if (!isSunday && isPastOrToday) {
        workingDaysCount += 1;
      }

      list.push({
        dayNum: day,
        dateStr: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${dayStr}`,
        isSunday,
        isPastOrToday,
        isFuture: !isPastOrToday
      });
    }

    return {
      dateList: list,
      totalWorkingDaysTillNow: Math.max(1, workingDaysCount)
    };
  }, [year, monthIndex]);

  // Build per-engineer submission matrix
  const complianceData = useMemo(() => {
    const empMap: Record<string, {
      name: string;
      code: string;
      district: string;
      zone: string;
      dates: Set<string>;
      amountByDate: Record<string, number>;
    }> = {};

    // 1. Seed unique employees if available
    uniqueEmployees.forEach((u) => {
      const code = String(u.code || "").trim().toUpperCase();
      if (!code) return;
      empMap[code] = {
        name: u.name || code,
        code,
        district: "Rajasthan",
        zone: "HQ",
        dates: new Set(),
        amountByDate: {},
      };
    });

    // 2. Map claims
    expenses.forEach((claim) => {
      if (!claim) return;
      if (claim.category === "Limit Request" || claim.request_type === "limit") return;

      const code = String(
        claim.user_id || 
        claim.employee_code || 
        claim.e_code || 
        claim.submitter_code || 
        claim.employeeCode || 
        ""
      ).trim().toUpperCase();

      if (!code) return;

      if (!empMap[code]) {
        empMap[code] = {
          name: claim.submitter_name || claim.employee_name || claim.engineer_name || code,
          code,
          district: claim.district || claim.work_location || "Rajasthan",
          zone: claim.zone || "HQ",
          dates: new Set(),
          amountByDate: {},
        };
      } else {
        if (claim.district && empMap[code].district === "Rajasthan") {
          empMap[code].district = claim.district;
        }
        if (claim.zone && empMap[code].zone === "HQ") {
          empMap[code].zone = claim.zone;
        }
      }

      const dRaw = claim.date || claim.itinerary || claim.created_at;
      if (!dRaw) return;
      const d = new Date(dRaw);
      if (isNaN(d.getTime())) return;

      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      empMap[code].dates.add(dateStr);
      const amt = Number(claim.amount != null ? claim.amount : (claim.total_amount || 0));
      empMap[code].amountByDate[dateStr] = (empMap[code].amountByDate[dateStr] || 0) + amt;
    });

    // 3. Compute working days submitted & pending for each
    const rows = Object.values(empMap).map((emp) => {
      let submittedDays = 0;
      const missingDates: string[] = [];
      const dailyMap: Record<number, { submitted: boolean; amount: number; isSunday: boolean; isFuture: boolean; dateStr: string }> = {};

      dateList.forEach((d) => {
        const isSubmitted = emp.dates.has(d.dateStr);
        const amount = emp.amountByDate[d.dateStr] || 0;

        if (d.isPastOrToday && !d.isSunday) {
          if (isSubmitted) {
            submittedDays += 1;
          } else {
            missingDates.push(d.dateStr);
          }
        }

        dailyMap[d.dayNum] = {
          submitted: isSubmitted,
          amount,
          isSunday: d.isSunday,
          isFuture: d.isFuture,
          dateStr: d.dateStr,
        };
      });

      const pendingDays = missingDates.length;
      const score = Math.round((submittedDays / totalWorkingDaysTillNow) * 100);

      let statusCategory: "compliant" | "pending" | "defaulter" = "compliant";
      if (pendingDays >= 4) statusCategory = "defaulter";
      else if (pendingDays >= 1) statusCategory = "pending";

      return {
        code: emp.code,
        name: emp.name,
        district: emp.district,
        zone: emp.zone,
        submittedDays,
        pendingDays,
        expectedDays: totalWorkingDaysTillNow,
        score,
        statusCategory,
        missingDates,
        dailyMap,
      };
    });

    // Apply active global filters (Zone, District, Employee)
    return rows.filter((r) => {
      if (filterZone !== "all" && cleanZone(r.zone) !== cleanZone(filterZone)) return false;
      if (filterDistrict !== "all" && r.district.toLowerCase() !== filterDistrict.toLowerCase()) return false;
      if (filterEmployee !== "all" && r.code.toLowerCase() !== String(filterEmployee).trim().toLowerCase()) return false;
      return true;
    }).sort((a, b) => b.pendingDays - a.pendingDays);
  }, [expenses, uniqueEmployees, dateList, totalWorkingDaysTillNow, filterZone, filterDistrict, filterEmployee]);

  // Filtered rows by search & status
  const displayedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return complianceData.filter((r) => {
      if (statusFilter !== "all" && r.statusCategory !== statusFilter) return false;
      if (q) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.code.toLowerCase().includes(q);
        const matchDist = r.district.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDist) return false;
      }
      return true;
    });
  }, [complianceData, statusFilter, searchQuery]);

  // Aggregate summary counts
  const stats = useMemo(() => {
    const total = complianceData.length;
    const compliant = complianceData.filter((r) => r.statusCategory === "compliant").length;
    const pending = complianceData.filter((r) => r.statusCategory === "pending").length;
    const defaulter = complianceData.filter((r) => r.statusCategory === "defaulter").length;
    return { total, compliant, pending, defaulter };
  }, [complianceData]);

  // WhatsApp Reminder
  const handleSendWhatsApp = (r: any) => {
    const missingSample = r.missingDates.slice(0, 4).map((d: string) => d.slice(8)).join(", ");
    const msg = `Hi ${r.name}, your expense claim submission for ${r.pendingDays} working day(s) (Day ${missingSample}...) in ${monthLabel} is pending on Cyrix FieldOps. Kindly submit your daily operational claims today.`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div
      className="bg-white rounded-[4px] border border-line/80 p-3 sm:p-3.5 space-y-3 shadow-xs"
      style={{
        boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[4px] bg-surface-sunken flex items-center justify-center text-accent-600 border border-line shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
                DAILY EXPENSE SUBMISSION & PENDING TRACKER
              </h2>
              <span className="text-[10px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded border border-accent-200 font-mono leading-none">
                {monthLabel} (Excl. Sundays)
              </span>
            </div>
            <p className="text-[10px] text-ink-500 font-sans mt-0.5 m-0 leading-none">
              Live tracking of engineer daily expense submissions, pending days, and non-submitters
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-2xs font-bold text-ink-500 hover:text-ink-900 transition-colors bg-surface-sunken border border-line px-2 py-0.5 rounded-[3px] cursor-pointer"
        >
          {isCollapsed ? "Expand View" : "Collapse"}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* ── 4 Sleek Status Cards (82px ZohoKpiRow Tokens) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* 1. Total Engineers */}
            <div
              onClick={() => setStatusFilter("all")}
              className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "all" ? "border-accent-600 ring-1 ring-accent-600" : "border-[#4f4f4f]/30 hover:border-accent-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-ink-700 font-sans">
                  TOTAL ENGINEERS
                </span>
                <div className="w-5 h-5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200">
                  <Users className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold font-mono text-ink-900 leading-tight">
                  {stats.total} <span className="text-xs text-ink-500 font-normal">Active</span>
                </div>
                <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block font-mono">
                  {totalWorkingDaysTillNow} Working Days
                </span>
              </div>
            </div>

            {/* 2. Up-To-Date (0 Pending Days) */}
            <div
              onClick={() => setStatusFilter("compliant")}
              className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "compliant" ? "border-emerald-600 ring-1 ring-emerald-600" : "border-[#4f4f4f]/30 hover:border-emerald-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 font-sans">
                  100% UP-TO-DATE
                </span>
                <div className="w-5 h-5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 leading-tight">
                  {stats.compliant} <span className="text-xs text-emerald-600 font-normal">Engineers</span>
                </div>
                <span className="text-[10px] text-emerald-600/80 font-medium leading-none mt-0.5 block font-mono">
                  0 Days Pending
                </span>
              </div>
            </div>

            {/* 3. Minor Due (1-3 Days) */}
            <div
              onClick={() => setStatusFilter("pending")}
              className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "pending" ? "border-amber-600 ring-1 ring-amber-600" : "border-[#4f4f4f]/30 hover:border-amber-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 font-sans">
                  DUE (1–3 DAYS)
                </span>
                <div className="w-5 h-5 rounded-[3px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Clock className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold font-mono text-amber-700 leading-tight">
                  {stats.pending} <span className="text-xs text-amber-600 font-normal">Engineers</span>
                </div>
                <span className="text-[10px] text-amber-600/80 font-medium leading-none mt-0.5 block font-mono">
                  Partial Delay
                </span>
              </div>
            </div>

            {/* 4. Critical Defaulters (4+ Days) */}
            <div
              onClick={() => setStatusFilter("defaulter")}
              className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "defaulter" ? "border-rose-600 ring-1 ring-rose-600" : "border-[#4f4f4f]/30 hover:border-rose-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-600" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-800 font-sans">
                  DEFAULTERS (4+ DAYS)
                </span>
                <div className="w-5 h-5 rounded-[3px] bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
                  <AlertTriangle className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-700 leading-tight">
                  {stats.defaulter} <span className="text-xs text-rose-600 font-normal">Engineers</span>
                </div>
                <span className="text-[10px] text-rose-600/80 font-medium leading-none mt-0.5 block font-mono">
                  WhatsApp Reminder Needed
                </span>
              </div>
            </div>
          </div>

          {/* ── Search & Filter Controls ── */}
          <div className="bg-surface-sunken/40 border border-line rounded-[4px] p-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="relative flex items-center w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Engineer or Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-6 py-1 bg-white border border-line rounded-[3px] text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-accent-600"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 text-ink-400 hover:text-ink-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2.5 text-3xs font-bold self-start sm:self-auto flex-wrap">
              <span className="flex items-center gap-1 text-emerald-800">
                <span className="w-2 h-2 rounded-[2px] bg-emerald-500 inline-block" /> Submitted (✓)
              </span>
              <span className="flex items-center gap-1 text-rose-800">
                <span className="w-2 h-2 rounded-[2px] bg-rose-500 inline-block" /> Missing (✕)
              </span>
              <span className="flex items-center gap-1 text-ink-400">
                <span className="w-2 h-2 rounded-[2px] bg-slate-300 inline-block" /> Sun (Off)
              </span>
            </div>
          </div>

          {/* ── Matrix Table ── */}
          <div className="border border-line rounded-[4px] overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-surface-sunken z-20 border-b border-line shadow-2xs">
                  <tr className="text-[9.5px] font-extrabold uppercase text-ink-600 font-sans tracking-wider">
                    <th className="py-2 px-2.5 w-[180px] bg-surface-sunken sticky left-0 z-30">Engineer Name</th>
                    <th className="py-2 px-2 text-center w-[90px]">Zone</th>
                    <th className="py-2 px-2 text-center w-[95px]">Progress</th>
                    <th className="py-2 px-2 text-center w-[85px]">Status</th>
                    <th className="py-2 px-2 text-center">Daily Timeline (Day 1 – {dateList.length})</th>
                    <th className="py-2 px-2.5 text-right w-[80px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-white">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-400 text-xs font-semibold">
                        No engineers found matching current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r) => (
                      <tr key={r.code} className="hover:bg-surface-sunken/40 transition-colors">
                        {/* 1. Name & Code */}
                        <td className="py-1.5 px-2.5 bg-white hover:bg-surface-sunken/40 sticky left-0 z-10 border-r border-line/40">
                          <div className="font-bold text-ink-900 text-xs leading-tight truncate max-w-[160px]">
                            {r.name}
                          </div>
                          <div className="text-[10px] text-ink-500 font-mono leading-none mt-0.5">
                            {r.code} • {r.district}
                          </div>
                        </td>

                        {/* 2. Zone */}
                        <td className="py-1.5 px-2 text-center text-[10.5px] font-semibold text-ink-700">
                          {r.zone}
                        </td>

                        {/* 3. Progress */}
                        <td className="py-1.5 px-2 text-center">
                          <span className="font-mono font-bold text-ink-900 text-2xs leading-tight">
                            {r.submittedDays} / {r.expectedDays}d
                          </span>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto mt-0.5 border border-line/50">
                            <div
                              className={`h-full rounded-full ${
                                r.score >= 90
                                  ? "bg-emerald-500"
                                  : r.score >= 70
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, r.score)}%` }}
                            />
                          </div>
                        </td>

                        {/* 4. Status Badge */}
                        <td className="py-1.5 px-2 text-center">
                          {r.pendingDays === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-[3px]">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Done
                            </span>
                          ) : r.pendingDays <= 3 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-[3px]">
                              <Clock className="w-2.5 h-2.5 text-amber-600" /> {r.pendingDays}d Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-[3px]">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> {r.pendingDays}d Due
                            </span>
                          )}
                        </td>

                        {/* 5. 31-Day Timeline */}
                        <td className="py-1.5 px-2">
                          <div className="flex items-center justify-center gap-0.5 flex-wrap max-w-[480px] mx-auto">
                            {dateList.map((d) => {
                              const st = r.dailyMap[d.dayNum];
                              if (st.isSunday) {
                                return (
                                  <div
                                    key={d.dayNum}
                                    className="w-3.5 h-3.5 rounded-[2px] bg-slate-100 text-slate-400 text-[7.5px] font-bold flex items-center justify-center cursor-default"
                                    title={`Day ${d.dayNum}: Sunday (Off)`}
                                  >
                                    S
                                  </div>
                                );
                              }
                              if (st.isFuture) {
                                return (
                                  <div
                                    key={d.dayNum}
                                    className="w-3.5 h-3.5 rounded-[2px] bg-slate-50 text-slate-300 text-[7.5px] flex items-center justify-center cursor-default"
                                    title={`Day ${d.dayNum}: Upcoming`}
                                  >
                                    -
                                  </div>
                                );
                              }
                              if (st.submitted) {
                                return (
                                  <div
                                    key={d.dayNum}
                                    className="w-3.5 h-3.5 rounded-[2px] bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center shadow-2xs cursor-pointer hover:scale-110 transition-transform"
                                    title={`Day ${d.dayNum}: Submitted (₹${st.amount.toLocaleString('en-IN')})`}
                                  >
                                    ✓
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={d.dayNum}
                                  className="w-3.5 h-3.5 rounded-[2px] bg-rose-500 text-white text-[7.5px] font-bold flex items-center justify-center shadow-2xs cursor-pointer hover:scale-110 transition-transform"
                                  title={`Day ${d.dayNum}: Missing Claim (${d.dateStr})`}
                                >
                                  ✕
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 6. Action */}
                        <td className="py-1.5 px-2.5 text-right">
                          {r.pendingDays > 0 ? (
                            <button
                              onClick={() => handleSendWhatsApp(r)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-3xs font-bold transition-all shadow-2xs"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Remind</span>
                            </button>
                          ) : (
                            <span className="text-3xs font-semibold text-emerald-600">✓ On time</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
