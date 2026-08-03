import { useState, useEffect, useMemo } from "react";
import { 
  Calendar, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  RefreshCw,
  ShieldAlert,
  Users,
  Briefcase,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../services/api";

interface AttendanceRecord {
  employee_code: string;
  employee_name: string;
  designation: string;
  district: string;
  zone: string;
  dates: Record<string, string>;
}

interface DiscrepancyRecord {
  expense_id: number;
  expense_code: string;
  emp_code: string;
  emp_name: string;
  designation: string;
  district: string;
  zone: string;
  expense_date: string;
  attendance_status: string;
  amount: number;
  expense_status: string;
  description: string;
}

export default function AttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("July");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<"matrix" | "discrepancies" | "roster">("matrix");
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRecord[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Inspector Drawer State
  const [inspectEmployee, setInspectEmployee] = useState<AttendanceRecord | null>(null);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const daysInMonth = useMemo(() => {
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) return 31;
    return new Date(selectedYear, monthIndex + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  const dateList = useMemo(() => {
    const monthIndex = months.indexOf(selectedMonth);
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const d = new Date(selectedYear, monthIndex, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      dates.push({
        dayNum: day,
        dateStr: `${selectedYear}-${monthStr}-${dayStr}`,
        isWeekend
      });
    }
    return dates;
  }, [selectedMonth, selectedYear, daysInMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Attendance Matrix
      const attRes = await api.get(`/attendance?month=${selectedMonth}&year=${selectedYear}`);
      if (attRes.data?.success) {
        setAttendanceData(attRes.data.data || []);
      }

      // Fetch Summary
      const sumRes = await api.get(`/attendance/summary?month=${selectedMonth}&year=${selectedYear}`);
      if (sumRes.data?.success) {
        setSummaryData(sumRes.data);
      }

      // Fetch Discrepancies
      const discRes = await api.get(`/attendance/discrepancies?month=${selectedMonth}&year=${selectedYear}`);
      if (discRes.data?.success) {
        setDiscrepancies(discRes.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      toast.error("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Extract unique Zones and Districts
  const zonesList = useMemo(() => {
    const set = new Set<string>();
    attendanceData.forEach((a) => { if (a.zone) set.add(a.zone); });
    return Array.from(set).sort();
  }, [attendanceData]);

  const districtsList = useMemo(() => {
    const set = new Set<string>();
    attendanceData.forEach((a) => { if (a.district) set.add(a.district); });
    return Array.from(set).sort();
  }, [attendanceData]);

  // Set of date + employee_code to discrepancy flag
  const discrepancyMap = useMemo(() => {
    const map = new Set<string>();
    discrepancies.forEach((d) => {
      if (d.emp_code && d.expense_date) {
        map.add(`${d.emp_code.toUpperCase().replace(/[- ]/g, "")}_${d.expense_date}`);
      }
    });
    return map;
  }, [discrepancies]);

  // Search & Filter Logic
  const filteredAttendance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[- ]/g, "");

    return attendanceData.filter((emp) => {
      const empCodeNorm = (emp.employee_code || "").toLowerCase().replace(/[- ]/g, "");
      const empNameNorm = (emp.employee_name || "").toLowerCase();
      const empDesigNorm = (emp.designation || "").toLowerCase();
      const empDistNorm = (emp.district || "").toLowerCase();

      const matchesSearch = 
        !q ||
        empCodeNorm.includes(q) ||
        empNameNorm.includes(q) ||
        empDesigNorm.includes(q) ||
        empDistNorm.includes(q);

      const matchesZone = selectedZone === "all" || (emp.zone && emp.zone.toLowerCase() === selectedZone.toLowerCase());
      const matchesDistrict = selectedDistrict === "all" || (emp.district && emp.district.toLowerCase() === selectedDistrict.toLowerCase());

      if (selectedStatusFilter !== "all") {
        const hasStatus = Object.values(emp.dates || {}).includes(selectedStatusFilter);
        if (!hasStatus) return false;
      }

      return matchesSearch && matchesZone && matchesDistrict;
    });
  }, [attendanceData, searchQuery, selectedZone, selectedDistrict, selectedStatusFilter]);

  // Filtered Discrepancies List
  const filteredDiscrepancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[- ]/g, "");
    return discrepancies.filter((d) => {
      const codeNorm = (d.emp_code || "").toLowerCase().replace(/[- ]/g, "");
      const nameNorm = (d.emp_name || "").toLowerCase();
      const expCodeNorm = (d.expense_code || "").toLowerCase();
      return !q || codeNorm.includes(q) || nameNorm.includes(q) || expCodeNorm.includes(q);
    });
  }, [discrepancies, searchQuery]);

  // Total Discrepancy Amount
  const totalDiscrepancyAmount = useMemo(() => {
    return discrepancies.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [discrepancies]);

  // Render Status Badges
  const renderStatusBadge = (status: string | undefined, empCode: string, dateStr: string) => {
    if (!status) return <span className="text-slate-300 dark:text-slate-600 text-[10px]">-</span>;

    const codeKey = `${empCode.toUpperCase().replace(/[- ]/g, "")}_${dateStr}`;
    const hasExpenseDiscrepancy = discrepancyMap.has(codeKey);

    let style = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";

    switch (status) {
      case "P":
        style = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80 font-bold hover:bg-emerald-100";
        break;
      case "WO-P":
        style = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800/80 font-bold hover:bg-teal-100";
        break;
      case "WO":
        style = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60 font-semibold";
        break;
      case "A":
      case "LWP":
        style = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80 font-black";
        break;
      case "CL":
      case "SiL":
      case "CO":
      case "EL":
      case "PatL":
        style = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/70 font-semibold";
        break;
    }

    return (
      <div 
        className={`relative inline-flex items-center justify-center w-5.5 h-5.5 rounded text-[9.5px] border transition-transform hover:scale-105 cursor-pointer leading-none ${style}`}
        title={`${dateStr}: ${status}${hasExpenseDiscrepancy ? ' (🚨 Expense Submitted on Non-Working Day)' : ''}`}
      >
        {status}
        {hasExpenseDiscrepancy && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-rose-600 text-[6px] font-black text-white ring-1 ring-white dark:ring-slate-900 animate-pulse">
            !
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2.5 antialiased text-slate-800 dark:text-slate-100 font-sans p-1 sm:p-2">
      {/* 1. Ultra-Compact Top Ribbon Header */}
      <div className="bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 dark:text-white leading-none">Attendance Roster & Audit</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">31-day attendance matrix & expense discrepancy audit</p>
          </div>
        </div>

        {/* Month Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 dark:bg-slate-700/60 rounded-lg px-2 py-0.5 border border-slate-200 dark:border-slate-600 text-xs font-semibold">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              {months.map((m) => (
                <option key={m} value={m} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{m}</option>
              ))}
            </select>
            <span className="text-slate-300 dark:text-slate-600 mx-1">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={2026} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">2026</option>
              <option value={2025} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">2025</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-600"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Ultra-Slim Single Row Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 block leading-none">TOTAL EMPLOYEES</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{attendanceData.length} Staff</span>
          </div>
          <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 block leading-none">PRESENT DAYS</span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {((summaryData?.statusCounts?.P || 0) + (summaryData?.statusCounts?.['WO-P'] || 0)).toLocaleString()}
            </span>
          </div>
          <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 block leading-none">LEAVES ACCOUNTED</span>
            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
              {((summaryData?.statusCounts?.CL || 0) + (summaryData?.statusCounts?.SiL || 0) + (summaryData?.statusCounts?.CO || 0) + (summaryData?.statusCounts?.EL || 0)).toLocaleString()}
            </span>
          </div>
          <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-rose-50/50 dark:bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block leading-none">DISCREPANCY RISK</span>
            <span className="text-sm font-extrabold text-rose-700 dark:text-rose-300">
              {discrepancies.length} Claims
            </span>
          </div>
          <div className="w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                activeTab === "matrix"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>31-Day Attendance Roster</span>
            </button>

            <button
              onClick={() => setActiveTab("discrepancies")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                activeTab === "discrepancies"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Discrepancies ({discrepancies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("roster")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                activeTab === "roster"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Workforce Summary</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Employee / Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-6 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Zone Filter */}
            {zonesList.length > 0 && (
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Zones</option>
                {zonesList.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            )}

            {/* District Filter */}
            {districtsList.length > 0 && (
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Districts</option>
                {districtsList.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="P">Present (P)</option>
              <option value="WO">Week Off (WO)</option>
              <option value="WO-P">WO Present (WO-P)</option>
              <option value="A">Absent (A)</option>
              <option value="CL">Casual Leave (CL)</option>
              <option value="SiL">Sick Leave (SiL)</option>
              <option value="CO">Comp Off (CO)</option>
            </select>
          </div>
        </div>

        {/* Legend Ribbon */}
        {activeTab === "matrix" && (
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[9px]">Legend:</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> P</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500"></span> WO-P</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> WO</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> CL/SiL/CO/EL</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> A / LWP</span>
            </div>

            <span className="text-rose-600 dark:text-rose-400 font-bold inline-flex items-center gap-1 text-[9.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              Red Badge = Non-Working Day Expense Claim
            </span>
          </div>
        )}
      </div>

      {/* 4. Table Views */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center space-y-2 shadow-xs">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Loading Roster...</p>
        </div>
      ) : activeTab === "matrix" ? (
        /* High-Density 31-Day Table */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-900 z-30 min-w-[180px]">
                    Employee Details ({filteredAttendance.length})
                  </th>
                  {dateList.map((d) => (
                    <th 
                      key={d.dateStr} 
                      className={`px-0.5 py-1 text-[10px] font-bold text-center border-b border-r border-slate-200 dark:border-slate-800 min-w-[28px] ${
                        d.isWeekend ? "bg-slate-100/70 dark:bg-slate-850 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {d.dayNum}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="px-4 py-6 text-center text-slate-400 text-xs">
                      No employees found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((emp) => (
                    <tr 
                      key={emp.employee_code} 
                      onClick={() => setInspectEmployee(emp)}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-3 py-1 border-r border-slate-200 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-750 z-10 shadow-xs">
                        <div className="font-bold text-slate-900 dark:text-white text-[11px] leading-tight truncate max-w-[160px] group-hover:text-indigo-600 transition-colors" title={emp.employee_name}>
                          {emp.employee_name}
                        </div>
                        <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono leading-none mt-0.5 flex items-center gap-1">
                          <span className="font-semibold">{emp.employee_code}</span>
                          <span>•</span>
                          <span className="truncate max-w-[80px]">{emp.district || emp.zone || 'RJ'}</span>
                        </div>
                      </td>
                      {dateList.map((d) => {
                        const st = emp.dates[d.dateStr];
                        return (
                          <td 
                            key={d.dateStr} 
                            className={`px-0.5 py-0.5 text-center border-r border-slate-100 dark:border-slate-800/60 ${
                              d.isWeekend ? "bg-slate-50/40 dark:bg-slate-900/20" : ""
                            }`}
                          >
                            {renderStatusBadge(st, emp.employee_code, d.dateStr)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "discrepancies" ? (
        /* Discrepancies Audit View */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold text-xs">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Audit Log: Expenses Submitted on Non-Working Days</span>
            </div>
            <span className="text-[10.5px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200">
              Total Claims: {filteredDiscrepancies.length} (₹{totalDiscrepancyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-1.5">Expense Code</th>
                  <th className="px-3 py-1.5">Employee</th>
                  <th className="px-3 py-1.5">Expense Date</th>
                  <th className="px-3 py-1.5">Attendance Status</th>
                  <th className="px-3 py-1.5">Claim Amount</th>
                  <th className="px-3 py-1.5">Approval Status</th>
                  <th className="px-3 py-1.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDiscrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      No discrepancy records found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredDiscrepancies.map((disc) => (
                    <tr key={disc.expense_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {disc.expense_code}
                      </td>
                      <td className="px-3 py-1">
                        <div className="font-bold text-slate-900 dark:text-white">{disc.emp_name}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{disc.emp_code}</div>
                      </td>
                      <td className="px-3 py-1 font-medium">{disc.expense_date}</td>
                      <td className="px-3 py-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                          {disc.attendance_status || "UNMATCHED"}
                        </span>
                      </td>
                      <td className="px-3 py-1 font-extrabold text-slate-900 dark:text-white">
                        ₹{(disc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          disc.expense_status === "approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : disc.expense_status === "rejected"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {disc.expense_status}
                        </span>
                      </td>
                      <td className="px-3 py-1 max-w-xs truncate text-slate-600 dark:text-slate-400">
                        {disc.description || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Summary View */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-1.5">Code</th>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Designation</th>
                  <th className="px-3 py-1.5">District / Zone</th>
                  <th className="px-3 py-1.5 text-center">Present (P)</th>
                  <th className="px-3 py-1.5 text-center">Week Off (WO)</th>
                  <th className="px-3 py-1.5 text-center">Leaves (CL/SiL/CO/EL)</th>
                  <th className="px-3 py-1.5 text-center">Absent (A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAttendance.map((emp) => {
                  const values = Object.values(emp.dates || {});
                  const pCount = values.filter((v) => v === "P" || v === "WO-P").length;
                  const woCount = values.filter((v) => v === "WO").length;
                  const leaveCount = values.filter((v) => ["CL", "SiL", "CO", "EL", "PatL"].includes(v)).length;
                  const aCount = values.filter((v) => v === "A" || v === "LWP").length;

                  return (
                    <tr key={emp.employee_code} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors font-medium">
                      <td className="px-3 py-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">{emp.employee_code}</td>
                      <td className="px-3 py-1 font-bold text-slate-900 dark:text-white">{emp.employee_name}</td>
                      <td className="px-3 py-1 text-slate-500 max-w-[180px] truncate">{emp.designation || '-'}</td>
                      <td className="px-3 py-1 text-slate-500">{emp.district || emp.zone || '-'}</td>

                      <td className="px-3 py-1 text-center font-bold">
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                          {pCount}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-center font-bold">
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px]">
                          {woCount}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-center font-bold">
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                          {leaveCount}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-center font-bold">
                        <span className={`inline-flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded-full text-[10px] ${
                          aCount > 0 
                            ? "bg-rose-50 text-rose-700 border border-rose-200 font-extrabold"
                            : "text-slate-400"
                        }`}>
                          {aCount}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspector Drawer Modal */}
      {inspectEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-4 shadow-2xl overflow-y-auto space-y-4 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">{inspectEmployee.employee_name}</h3>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold mt-0.5">{inspectEmployee.employee_code}</p>
              </div>

              <button
                onClick={() => setInspectEmployee(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 font-semibold block text-[9px] uppercase">Designation</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inspectEmployee.designation || 'Field Staff'}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 font-semibold block text-[9px] uppercase">Territory / Zone</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{inspectEmployee.district || inspectEmployee.zone || 'Rajasthan'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monthly Log ({selectedMonth} {selectedYear})</h4>
              <div className="grid grid-cols-7 gap-1 text-center">
                {dateList.map((d) => {
                  const st = inspectEmployee.dates[d.dateStr];
                  const codeKey = `${inspectEmployee.employee_code.toUpperCase().replace(/[- ]/g, "")}_${d.dateStr}`;
                  const isDisc = discrepancyMap.has(codeKey);

                  return (
                    <div 
                      key={d.dateStr} 
                      className={`p-1 rounded border text-[10px] flex flex-col items-center justify-center relative ${
                        isDisc ? "bg-rose-100 dark:bg-rose-950 border-rose-400 text-rose-800 dark:text-rose-200 font-bold" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <span className="text-[8px] text-slate-400 font-mono">{d.dayNum}</span>
                      <span className="font-bold text-[9px]">{st || '-'}</span>
                      {isDisc && (
                        <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-rose-600" title="Expense Discrepancy" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
