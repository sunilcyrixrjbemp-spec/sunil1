import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Search, 
  Mail, 
  X, 
  ShieldCheck,
  Palmtree,
  Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

interface ZohoSubmissionComplianceWidgetProps {
  user?: any;
  activeTab?: "my-claims" | "team-claims";
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
  user,
  activeTab = "team-claims",
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
  const [sendingEmailCode, setSendingEmailCode] = useState<string | null>(null);
  const [sentRemindersSet, setSentRemindersSet] = useState<Set<string>>(new Set());

  // Leave Management State
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [targetEmpForLeave, setTargetEmpForLeave] = useState<any>(null);
  const [selectedLeaveDates, setSelectedLeaveDates] = useState<string[]>([]);
  const [leaveType, setLeaveType] = useState<string>("Casual Leave");
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [savingLeave, setSavingLeave] = useState(false);

  // Strict Admin Role Check — ONLY Admins & Superadmins see the Remind / Sent action button!
  const isAdmin = useMemo(() => {
    const role = String(user?.role || user?.designation || "").toLowerCase().trim();
    if (
      role === "admin" || 
      role === "superadmin" || 
      role === "super_admin" || 
      role.includes("super admin") ||
      user?.is_admin === true || 
      user?.isAdmin === true
    ) {
      return true;
    }

    try {
      const stored = localStorage.getItem("cyrix_user") || localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        const r = String(u.role || u.designation || "").toLowerCase().trim();
        if (
          r === "admin" || 
          r === "superadmin" || 
          r === "super_admin" || 
          r.includes("super admin") ||
          u.is_admin === true || 
          u.isAdmin === true
        ) {
          return true;
        }
      }
    } catch (_) {}

    return false; // Non-admin (Engineer, Coordinator, Manager) strictly gets false!
  }, [user]);

  // Parse Year and Month
  const { year, monthIndex, monthLabel } = useMemo(() => {
    const [yStr, mStr] = (selectMonth || "2026-08").split("-");
    const year = parseInt(yStr) || new Date().getFullYear();
    const month = parseInt(mStr) || (new Date().getMonth() + 1);
    const monthIndex = month - 1;
    const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
    return { year, monthIndex, monthLabel };
  }, [selectMonth]);


  // Load list of engineers who have already been sent a reminder today
  useEffect(() => {
    let isMounted = true;
    const fetchSentStatus = async () => {
      try {
        const res = await api.get(`/attendance/reminder-status?month=${selectMonth}`);
        if (isMounted && res.data?.success && Array.isArray(res.data.sent_today)) {
          setSentRemindersSet(new Set(res.data.sent_today.map((c: string) => String(c).toUpperCase())));
        }
      } catch (_) {}
    };
    fetchSentStatus();
    return () => { isMounted = false; };
  }, []);

  // Load logged leaves for this month
  useEffect(() => {
    let isMounted = true;
    const fetchLeaves = async () => {
      try {
        const res = await api.get(`/attendance/leaves?month=${selectMonth}`);
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          setLeavesList(res.data.data);
        }
      } catch (err) {
        console.warn("Could not fetch logged leaves from backend:", err);
      }
    };
    fetchLeaves();
    return () => { isMounted = false; };
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

  // Build per-engineer submission matrix with Zero-Due Leave calculation
  const complianceData = useMemo(() => {
    const empMap: Record<string, {
      name: string;
      code: string;
      district: string;
      zone: string;
      dates: Set<string>;
      amountByDate: Record<string, number>;
      leaves: Record<string, { leave_type: string; reason: string }>;
    }> = {};

    // 1. Seed employees:
    // If on "My Claims" tab, strictly seed ONLY the logged-in user (NO team members seeded!)
    if (activeTab === "my-claims" && user) {
      const myCode = String(user.user_id || user.e_code || user.id || "").trim().toUpperCase();
      const myName = user.name || myCode || "Me";
      if (myCode) {
        empMap[myCode] = {
          name: myName,
          code: myCode,
          district: user.district || "Rajasthan",
          zone: user.zone || "HQ",
          dates: new Set(),
          amountByDate: {},
          leaves: {},
        };
      }
    } else {
      // On Team Claims tab: Seed unique employees
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
          leaves: {},
        };
      });
    }

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
          leaves: {},
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

    // 3. Map logged leaves to employees
    leavesList.forEach((lv) => {
      const code = String(lv.employee_code || lv.user_id || "").trim().toUpperCase();
      if (!code || !lv.date) return;
      if (!empMap[code]) {
        empMap[code] = {
          name: lv.employee_name || code,
          code,
          district: "Rajasthan",
          zone: "HQ",
          dates: new Set(),
          amountByDate: {},
          leaves: {},
        };
      }
      empMap[code].leaves[lv.date] = {
        leave_type: lv.leave_type || "Leave",
        reason: lv.reason || "",
      };
    });

    // 4. Compute working days submitted & pending for each (Leaves = Zero Due!)
    const rows = Object.values(empMap).map((emp) => {
      let submittedDays = 0;
      let sundaySubmittedCount = 0;
      let leaveDaysCount = 0;
      const missingDates: string[] = [];
      const dailyMap: Record<number, { 
        submitted: boolean; 
        isLeave: boolean; 
        leaveType?: string; 
        leaveReason?: string; 
        amount: number; 
        isSunday: boolean; 
        isFuture: boolean; 
        dateStr: string 
      }> = {};

      dateList.forEach((d) => {
        const isSubmitted = emp.dates.has(d.dateStr);
        const isLeave = Boolean(emp.leaves[d.dateStr]);
        const leaveInfo = emp.leaves[d.dateStr];
        const amount = emp.amountByDate[d.dateStr] || 0;

        if (d.isPastOrToday) {
          if (d.isSunday) {
            // Sunday duty expense submitted
            if (isSubmitted) {
              submittedDays += 1;
              sundaySubmittedCount += 1;
            }
          } else {
            // Regular working day
            if (isSubmitted) {
              submittedDays += 1;
            } else if (isLeave) {
              leaveDaysCount += 1;
              // On Leave -> Do NOT add to missingDates / pendingDays (Zero Due!)
            } else {
              missingDates.push(d.dateStr);
            }
          }
        }

        dailyMap[d.dayNum] = {
          submitted: isSubmitted,
          isLeave,
          leaveType: leaveInfo?.leave_type,
          leaveReason: leaveInfo?.reason,
          amount,
          isSunday: d.isSunday,
          isFuture: d.isFuture,
          dateStr: d.dateStr,
        };
      });

      const pendingDays = missingDates.length;
      const expectedDays = Math.max(1, totalWorkingDaysTillNow + sundaySubmittedCount - leaveDaysCount);
      const score = Math.round((submittedDays / expectedDays) * 100);

      let statusCategory: "compliant" | "pending" | "defaulter" = "compliant";
      if (pendingDays >= 4) statusCategory = "defaulter";
      else if (pendingDays >= 1) statusCategory = "pending";

      return {
        code: emp.code,
        name: emp.name,
        district: emp.district,
        zone: emp.zone,
        submittedDays,
        leaveDaysCount,
        pendingDays,
        expectedDays,
        score,
        statusCategory,
        missingDates,
        dailyMap,
      };
    });

    // If on "My Claims" tab, strictly show ONLY the logged-in user's own record!
    if (activeTab === "my-claims" && user) {
      const myCode = String(user.user_id || user.e_code || user.id || "").trim().toUpperCase();
      const myName = String(user.name || "").trim().toLowerCase();

      let myRows = rows.filter((r) => {
        const rCode = String(r.code || "").trim().toUpperCase();
        const rName = String(r.name || "").trim().toLowerCase();
        return (myCode && (rCode === myCode || rCode.includes(myCode))) || (myName && rName === myName);
      });

      // Fallback: If no exact match row found in team map, synthesize a single self-row
      if (myRows.length === 0) {
        myRows = rows.slice(0, 1);
      }
      return myRows;
    }

    return rows.filter((r) => {
      if (filterZone !== "all" && cleanZone(r.zone) !== cleanZone(filterZone)) return false;
      if (filterDistrict !== "all" && r.district.toLowerCase() !== filterDistrict.toLowerCase()) return false;
      if (filterEmployee !== "all" && r.code.toLowerCase() !== String(filterEmployee).trim().toLowerCase()) return false;
      return true;
    }).sort((a, b) => b.pendingDays - a.pendingDays);
  }, [expenses, leavesList, uniqueEmployees, dateList, totalWorkingDaysTillNow, filterZone, filterDistrict, filterEmployee]);

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

  const stats = useMemo(() => {
    const total = complianceData.length;
    const compliant = complianceData.filter((r) => r.statusCategory === "compliant").length;
    const pending = complianceData.filter((r) => r.statusCategory === "pending").length;
    const defaulter = complianceData.filter((r) => r.statusCategory === "defaulter").length;
    return { total, compliant, pending, defaulter };
  }, [complianceData]);

  // Executive Email Reminder Sender (100% Automated Background API Dispatch)
  const handleSendEmailReminder = async (r: any) => {
    setSendingEmailCode(r.code);
    try {
      const res = await api.post("/attendance/send-reminder", {
        empCode: r.code,
        pendingDays: r.pendingDays,
        missingDates: r.missingDates,
        monthName: monthLabel,
        year,
      });

      if (res.data?.success) {
        toast.success(
          `Official reminder email sent automatically to ${r.name}! (CC: Manager, DM & Coordinator)`,
          { id: `remind-${r.code}`, duration: 4500 }
        );
        setSentRemindersSet(prev => new Set([...prev, r.code.toUpperCase()]));
      } else {
        toast.error(res.data?.error || "Failed to dispatch reminder email.");
      }
    } catch (err: any) {
      console.error("Backend email dispatch error:", err);
      toast.error(err.response?.data?.error || "Failed to dispatch reminder email via API.");
    } finally {
      setSendingEmailCode(null);
    }
  };

  // Open Leave Marking Modal for Engineer (starts with EMPTY selection so user explicitly picks dates)
  const handleOpenLeaveModal = (emp: any, defaultDate?: string) => {
    setTargetEmpForLeave(emp);
    setSelectedLeaveDates(defaultDate ? [defaultDate] : []);
    setLeaveType("Casual Leave");
    setLeaveReason("");
    setShowLeaveModal(true);
  };

  // Save Leave Status to D1 Database
  const handleSaveLeaveStatus = async () => {
    if (!targetEmpForLeave || selectedLeaveDates.length === 0) {
      toast.error("Please select at least one date to mark as leave.");
      return;
    }

    setSavingLeave(true);
    try {
      const res = await api.post("/attendance/mark-leave", {
        employee_code: targetEmpForLeave.code,
        employee_name: targetEmpForLeave.name,
        dates: selectedLeaveDates,
        leave_type: leaveType,
        reason: leaveReason || "Approved Leave / Off-Duty",
      });

      if (res.data?.success) {
        toast.success(`Marked ${selectedLeaveDates.length} date(s) as On Leave for ${targetEmpForLeave.name}!`);
        
        // Optimistic local state update
        const newLeaves = selectedLeaveDates.map((dStr) => ({
          employee_code: targetEmpForLeave.code,
          employee_name: targetEmpForLeave.name,
          date: dStr,
          month: selectMonth,
          year,
          leave_type: leaveType,
          reason: leaveReason || "Approved Leave",
        }));

        setLeavesList((prev) => [
          ...prev.filter(l => !(l.employee_code === targetEmpForLeave.code && selectedLeaveDates.includes(l.date))),
          ...newLeaves
        ]);

        setShowLeaveModal(false);
      } else {
        toast.error(res.data?.error || "Failed to mark leave.");
      }
    } catch (err: any) {
      console.error("Mark leave error:", err);
      toast.error(err.response?.data?.error || "Error saving leave status.");
    } finally {
      setSavingLeave(false);
    }
  };

  return (
    <div
      className="bg-white rounded-[4px] border border-line/80 p-2.5 sm:p-3.5 space-y-3 shadow-xs"
      style={{
        boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-[4px] bg-surface-sunken flex items-center justify-center text-accent-600 border border-line shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-tight">
                {activeTab === "my-claims" ? "MY EXPENSE SUBMISSION & LEAVE TRACKER" : "DAILY EXPENSE SUBMISSION & PENDING TRACKER"}
              </h2>
              <span className="text-[9.5px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.2 rounded border border-accent-200 font-mono whitespace-nowrap leading-none">
                {monthLabel} (Excl. Sundays & Leaves)
              </span>
            </div>
            <p className="text-[10px] text-ink-500 font-sans mt-0.5 m-0 leading-tight truncate">
              Live tracking of engineer daily expense submissions, pending days, and non-submitters
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-2xs font-bold text-ink-500 hover:text-ink-900 transition-colors bg-surface-sunken border border-line px-2 py-0.5 rounded-[3px] cursor-pointer self-end sm:self-auto"
        >
          {isCollapsed ? "Expand View" : "Collapse"}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* ── 4 Sleek Status Cards (82px ZohoKpiRow Tokens) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* 1. Total Engineers */}
            <div
              onClick={() => setStatusFilter("all")}
              className={`group bg-white rounded-[4px] border p-2 sm:p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[74px] sm:h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "all" ? "border-accent-600 ring-1 ring-accent-600" : "border-[#4f4f4f]/30 hover:border-accent-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-ink-700 font-sans truncate">
                  TOTAL ACTIVE ENGINEERS
                </span>
                <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 shrink-0">
                  <Users className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold font-mono text-ink-900 leading-tight truncate">
                  {stats.total} <span className="text-[10px] text-ink-500 font-normal">Active</span>
                </div>
                <span className="text-[9.5px] sm:text-[10px] text-ink-500 font-medium leading-none mt-0.5 block font-mono truncate">
                  {totalWorkingDaysTillNow} Working Days
                </span>
              </div>
            </div>

            {/* 2. Up-To-Date (0 Pending Days) */}
            <div
              onClick={() => setStatusFilter("compliant")}
              className={`group bg-white rounded-[4px] border p-2 sm:p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[74px] sm:h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "compliant" ? "border-emerald-600 ring-1 ring-emerald-600" : "border-[#4f4f4f]/30 hover:border-emerald-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-800 font-sans truncate">
                  100% UP-TO-DATE
                </span>
                <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold font-mono text-emerald-700 leading-tight truncate">
                  {stats.compliant} <span className="text-[10px] text-emerald-600 font-normal">Engineers</span>
                </div>
                <span className="text-[9.5px] sm:text-[10px] text-emerald-600/80 font-medium leading-none mt-0.5 block font-mono truncate">
                  0 Days Overdue
                </span>
              </div>
            </div>

            {/* 3. Minor Due (1-3 Days) */}
            <div
              onClick={() => setStatusFilter("pending")}
              className={`group bg-white rounded-[4px] border p-2 sm:p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[74px] sm:h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "pending" ? "border-amber-600 ring-1 ring-amber-600" : "border-[#4f4f4f]/30 hover:border-amber-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-800 font-sans truncate">
                  DUE (1–3 DAYS)
                </span>
                <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-[3px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold font-mono text-amber-700 leading-tight truncate">
                  {stats.pending} <span className="text-[10px] text-amber-600 font-normal">Engineers</span>
                </div>
                <span className="text-[9.5px] sm:text-[10px] text-amber-600/80 font-medium leading-none mt-0.5 block font-mono truncate">
                  Partial Lag
                </span>
              </div>
            </div>

            {/* 4. Critical Defaulters (4+ Days) */}
            <div
              onClick={() => setStatusFilter("defaulter")}
              className={`group bg-white rounded-[4px] border p-2 sm:p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[74px] sm:h-[78px] relative overflow-hidden shadow-2xs ${
                statusFilter === "defaulter" ? "border-rose-600 ring-1 ring-rose-600" : "border-[#4f4f4f]/30 hover:border-rose-600"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-600" />
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider text-rose-800 font-sans truncate">
                  DEFAULTERS (4+ DAYS)
                </span>
                <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-[3px] bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="text-xs sm:text-sm md:text-base font-bold font-mono text-rose-700 leading-tight truncate">
                  {stats.defaulter} <span className="text-[10px] text-rose-600 font-normal">Engineers</span>
                </div>
                <span className="text-[9.5px] sm:text-[10px] text-rose-600/80 font-medium leading-none mt-0.5 block font-mono truncate">
                  Mail Reminder Required
                </span>
              </div>
            </div>
          </div>

          {/* ── Search & Legend Controls ── */}
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
            <div className="flex items-center gap-2 text-3xs font-bold self-start sm:self-auto flex-wrap">
              <span className="flex items-center gap-1 text-emerald-800">
                <span className="w-2 h-2 rounded-[2px] bg-emerald-500 inline-block" /> Submitted (✓)
              </span>
              <span className="flex items-center gap-1 text-amber-800">
                <span className="w-2 h-2 rounded-[2px] bg-amber-500 inline-block" /> On Leave (L)
              </span>
              <span className="flex items-center gap-1 text-rose-800">
                <span className="w-2 h-2 rounded-[2px] bg-rose-500 inline-block" /> Missing (✕)
              </span>
              <span className="flex items-center gap-1 text-ink-400">
                <span className="w-2 h-2 rounded-[2px] bg-slate-300 inline-block" /> Sun (Off)
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RESPONSIVE PRESENTATION:
              1. MOBILE VIEW (sm:hidden) — Sleek, High-Density Cards
              2. DESKTOP VIEW (hidden sm:block) — Wide Horizontal Matrix Table
          ══════════════════════════════════════════════════════════════════ */}

          {/* ── 1. Mobile Cards View (<640px) ── */}
          <div className="block sm:hidden space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
            {displayedRows.length === 0 ? (
              <div className="py-6 text-center text-ink-400 text-xs font-semibold">
                No engineers found matching filter criteria.
              </div>
            ) : (
              displayedRows.map((r) => (
                <div
                  key={r.code}
                  className="bg-white border border-line rounded-[4px] p-2.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-ink-900 text-xs truncate">
                        {r.name}
                      </div>
                      <div className="text-[10px] text-ink-500 font-mono mt-0.5">
                        {r.code} • {r.district} • {r.zone}
                      </div>
                    </div>
                    {r.pendingDays === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-[3px] shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> On Time
                      </span>
                    ) : r.pendingDays <= 3 ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-[3px] shrink-0">
                        <Clock className="w-2.5 h-2.5 text-amber-600" /> {r.pendingDays}d Due
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-[3px] shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> {r.pendingDays}d Overdue
                      </span>
                    )}
                  </div>

                  {/* Progress Line */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-ink-600 font-bold">
                        {r.submittedDays} Submitted {r.leaveDaysCount > 0 ? `(${r.leaveDaysCount} On Leave)` : ''} of {r.expectedDays}d
                      </span>
                      <span className="font-bold text-ink-900">{r.score}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 border border-line/60">
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
                  </div>

                  {/* Missing Dates Badges Snippet (if overdue) */}
                  {r.missingDates.length > 0 && (
                    <div className="bg-rose-50/50 border border-rose-100 rounded p-1.5 text-[10px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-800">
                          Missing Dates ({r.missingDates.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenLeaveModal(r)}
                          className="text-[9.5px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5 underline cursor-pointer"
                        >
                          <Palmtree className="w-2.5 h-2.5" /> Mark Leave
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {r.missingDates.slice(0, 5).map((d: string) => (
                          <span key={d} className="px-1 py-0.2 bg-white border border-rose-200 text-rose-700 font-mono text-[9px] rounded font-bold">
                            {d.slice(5)}
                          </span>
                        ))}
                        {r.missingDates.length > 5 && (
                          <span className="text-rose-600 font-semibold text-[9px]">
                            +{r.missingDates.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions: Send Email or Mark Leave */}
                  {r.pendingDays > 0 ? (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {isAdmin && (
                        sentRemindersSet.has(r.code.toUpperCase()) ? (
                          <div className="flex-1 py-1.5 px-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-[3px] text-2xs font-bold flex items-center justify-center gap-1 cursor-default">
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            <span>Mail Sent Today</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={sendingEmailCode === r.code}
                            onClick={() => handleSendEmailReminder(r)}
                            className="flex-1 py-1.5 px-2 bg-[#4338CA] hover:bg-[#3730A3] text-white rounded-[3px] text-2xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                          >
                            {sendingEmailCode === r.code ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <>
                                <Mail className="w-3 h-3" />
                                <span>Send Official Mail</span>
                              </>
                            )}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenLeaveModal(r)}
                        className="py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-[3px] text-2xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      >
                        <Palmtree className="w-3 h-3 text-amber-700" />
                        <span>Leave</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-700 font-semibold text-center py-0.5">
                      ✓ All working day expenses up to date
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── 2. Desktop Matrix Table (≥640px) ── */}
          <div className="hidden sm:block border border-line rounded-[4px] overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-surface-sunken z-20 border-b border-line shadow-2xs">
                  <tr className="text-[9.5px] font-extrabold uppercase text-ink-600 font-sans tracking-wider">
                    <th className="py-2 px-2.5 w-[160px] bg-surface-sunken sticky left-0 z-30">Engineer Name</th>
                    <th className="py-2 px-2 text-center w-[80px]">Zone</th>
                    <th className="py-2 px-2 text-center w-[95px]">Progress</th>
                    <th className="py-2 px-2 text-center w-[85px]">Status</th>
                    <th className="py-2 px-2 text-center">Daily Timeline (Day 1 – {dateList.length})</th>
                    <th className="py-2 px-2.5 text-right w-[110px]">Action</th>
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
                          <div className="font-bold text-ink-900 text-xs leading-tight truncate max-w-[145px]">
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

                        {/* 5. 31-Day Timeline (Horizontal Non-Wrapping) */}
                        <td className="py-1.5 px-2">
                          <div className="flex items-center justify-center gap-0.5 flex-nowrap min-w-[340px] max-w-[500px] mx-auto overflow-x-auto py-0.5">
                            {dateList.map((d) => {
                              const st = r.dailyMap[d.dayNum];
                              if (st.isSunday) {
                                if (st.submitted) {
                                  return (
                                    <div
                                      key={d.dayNum}
                                      className="w-3.5 h-3.5 rounded-[2px] bg-emerald-600 text-white text-[8px] font-bold flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:scale-110 transition-transform ring-1 ring-emerald-300"
                                      title={`Day ${d.dayNum} (Sunday Duty Submitted): ₹${st.amount.toLocaleString('en-IN')}`}
                                    >
                                      ✓
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={d.dayNum}
                                    className="w-3.5 h-3.5 rounded-[2px] bg-slate-100 text-slate-400 text-[7.5px] font-bold flex items-center justify-center shrink-0 cursor-default"
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
                                    className="w-3.5 h-3.5 rounded-[2px] bg-slate-50 text-slate-300 text-[7.5px] flex items-center justify-center shrink-0 cursor-default"
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
                                    className="w-3.5 h-3.5 rounded-[2px] bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:scale-110 transition-transform"
                                    title={`Day ${d.dayNum}: Submitted (₹${st.amount.toLocaleString('en-IN')})`}
                                  >
                                    ✓
                                  </div>
                                );
                              }
                              if (st.isLeave) {
                                return (
                                  <div
                                    key={d.dayNum}
                                    className="w-3.5 h-3.5 rounded-[2px] bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:scale-110 transition-transform"
                                    title={`Day ${d.dayNum}: On Leave (${st.leaveType}${st.leaveReason ? ' - ' + st.leaveReason : ''})`}
                                  >
                                    L
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={d.dayNum}
                                  onClick={() => handleOpenLeaveModal(r, d.dateStr)}
                                  className="w-3.5 h-3.5 rounded-[2px] bg-rose-500 text-white text-[7.5px] font-bold flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:scale-125 transition-transform hover:ring-2 hover:ring-amber-400"
                                  title={`Day ${d.dayNum}: Missing Claim (${d.dateStr}) — Click to Mark as Leave`}
                                >
                                  ✕
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 6. Action: Remind or Mark Leave */}
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          {r.pendingDays > 0 ? (
                            <div className="inline-flex items-center gap-1 justify-end">
                              {sentRemindersSet.has(r.code.toUpperCase()) ? (
                                <span
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] bg-slate-100 text-slate-500 border border-slate-200 text-3xs font-bold whitespace-nowrap cursor-default"
                                  title="Reminder email already sent today"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" />
                                  <span>Sent</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={sendingEmailCode === r.code}
                                  onClick={() => handleSendEmailReminder(r)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] bg-accent-50 hover:bg-accent-100 text-accent-700 border border-accent-200 text-3xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  title="Send official reminder email (CC Manager & DM)"
                                >
                                  {sendingEmailCode === r.code ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : (
                                    <Mail className="w-2.5 h-2.5 text-accent-600 shrink-0" />
                                  )}
                                  <span>Remind</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenLeaveModal(r)}
                                className="inline-flex items-center justify-center p-1 rounded-[3px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-3xs font-bold transition-all shadow-2xs cursor-pointer"
                                title="Mark Leave / Absent"
                              >
                                <Palmtree className="w-2.5 h-2.5" />
                              </button>
                            </div>
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

      {/* ── High-Density Leave Marking Modal ── */}
      {showLeaveModal && targetEmpForLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3">
          <div className="bg-white rounded-[6px] border border-line w-full max-w-md p-4 space-y-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[4px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Palmtree className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0">
                    Mark On Leave / Absent
                  </h3>
                  <p className="text-[10px] text-ink-500 m-0 font-mono">
                    {targetEmpForLeave.name} ({targetEmpForLeave.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="text-ink-400 hover:text-ink-700 cursor-pointer p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-[11px] text-emerald-800 leading-snug">
              ✨ <strong>Zero-Due Policy:</strong> Dates marked as <em>On Leave</em> will be excluded from overdue missing claims and will not attract reminder escalations.
            </div>

            {/* Missing Dates Selection Checkboxes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-ink-800">
                <span>Select Specific Date(s) for Leave:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedLeaveDates.length === targetEmpForLeave.missingDates.length) {
                        setSelectedLeaveDates([]);
                      } else {
                        setSelectedLeaveDates([...targetEmpForLeave.missingDates]);
                      }
                    }}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                  >
                    {selectedLeaveDates.length === targetEmpForLeave.missingDates.length ? "Deselect All" : "Select All"}
                  </button>
                  <span className="text-[10px] text-amber-700 font-mono font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    {selectedLeaveDates.length} chosen
                  </span>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto border border-line rounded p-2 bg-surface-sunken/40 space-y-1.5">
                {targetEmpForLeave.missingDates.length === 0 ? (
                  <div className="text-center py-2 text-ink-400 text-xs font-medium">
                    No pending missing dates found.
                  </div>
                ) : (
                  targetEmpForLeave.missingDates.map((dStr: string) => {
                    const isChecked = selectedLeaveDates.includes(dStr);
                    const d = new Date(dStr);
                    const dayName = !isNaN(d.getTime()) ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] : "";
                    return (
                      <label
                        key={dStr}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                          isChecked ? "bg-amber-50/90 border border-amber-300 ring-1 ring-amber-300" : "bg-white border border-line/60 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeaveDates([...selectedLeaveDates, dStr]);
                              } else {
                                setSelectedLeaveDates(selectedLeaveDates.filter(d => d !== dStr));
                              }
                            }}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                          />
                          <span className="font-mono text-xs font-bold text-ink-800">{dStr} ({dayName})</span>
                        </div>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${isChecked ? "bg-amber-100 text-amber-800" : "text-ink-500"}`}>
                          {isChecked ? "Mark Leave" : "Missing"}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Leave Type Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-800 block">Leave / Absence Type:</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-line rounded text-xs text-ink-900 focus:outline-none focus:border-amber-600"
              >
                <option value="Casual Leave">Casual Leave (CL)</option>
                <option value="Sick Leave">Sick Leave (SL)</option>
                <option value="Official Off">Official Off / Holiday</option>
                <option value="Weekly Comp Off">Compensatory Off</option>
                <option value="Absent">Absent / Personal Emergency</option>
              </select>
            </div>

            {/* Optional Reason / Remarks */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-800 block">Remarks / Notes (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Medical emergency / Family function..."
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className="w-full py-1 px-2.5 bg-white border border-line rounded text-xs text-ink-900 focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-2.5">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-3 py-1.5 bg-surface-sunken hover:bg-slate-200 text-ink-700 rounded text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingLeave || selectedLeaveDates.length === 0}
                onClick={handleSaveLeaveStatus}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {savingLeave ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Confirm On Leave</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
