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
  X,
  AlertTriangle
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
      const attRes = await api.get(`/attendance?month=${selectedMonth}&year=${selectedYear}`);
      if (attRes.data?.success) setAttendanceData(attRes.data.data || []);

      const sumRes = await api.get(`/attendance/summary?month=${selectedMonth}&year=${selectedYear}`);
      if (sumRes.data?.success) setSummaryData(sumRes.data);

      const discRes = await api.get(`/attendance/discrepancies?month=${selectedMonth}&year=${selectedYear}`);
      if (discRes.data?.success) setDiscrepancies(discRes.data.data || []);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      toast.error("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

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

  const discrepancyMap = useMemo(() => {
    const map = new Set<string>();
    discrepancies.forEach((d) => {
      if (d.emp_code && d.expense_date) {
        map.add(`${d.emp_code.toUpperCase().replace(/[- ]/g, "")}_${d.expense_date}`);
      }
    });
    return map;
  }, [discrepancies]);

  const filteredAttendance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[- ]/g, "");
    return attendanceData.filter((emp) => {
      const empCodeNorm = (emp.employee_code || "").toLowerCase().replace(/[- ]/g, "");
      const empNameNorm = (emp.employee_name || "").toLowerCase();
      const empDesigNorm = (emp.designation || "").toLowerCase();
      const empDistNorm = (emp.district || "").toLowerCase();
      const matchesSearch = !q || empCodeNorm.includes(q) || empNameNorm.includes(q) || empDesigNorm.includes(q) || empDistNorm.includes(q);
      const matchesZone = selectedZone === "all" || (emp.zone && emp.zone.toLowerCase() === selectedZone.toLowerCase());
      const matchesDistrict = selectedDistrict === "all" || (emp.district && emp.district.toLowerCase() === selectedDistrict.toLowerCase());
      if (selectedStatusFilter !== "all") {
        const hasStatus = Object.values(emp.dates || {}).includes(selectedStatusFilter);
        if (!hasStatus) return false;
      }
      return matchesSearch && matchesZone && matchesDistrict;
    });
  }, [attendanceData, searchQuery, selectedZone, selectedDistrict, selectedStatusFilter]);

  const filteredDiscrepancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/[- ]/g, "");
    return discrepancies.filter((d) => {
      const codeNorm = (d.emp_code || "").toLowerCase().replace(/[- ]/g, "");
      const nameNorm = (d.emp_name || "").toLowerCase();
      const expCodeNorm = (d.expense_code || "").toLowerCase();
      return !q || codeNorm.includes(q) || nameNorm.includes(q) || expCodeNorm.includes(q);
    });
  }, [discrepancies, searchQuery]);

  const totalDiscrepancyAmount = useMemo(() => {
    return discrepancies.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [discrepancies]);

  const renderStatusBadge = (status: string | undefined, empCode: string, dateStr: string) => {
    if (!status) return <span className="text-slate-300 text-[10px]">-</span>;
    const codeKey = `${empCode.toUpperCase().replace(/[- ]/g, "")}_${dateStr}`;
    const hasExpenseDiscrepancy = discrepancyMap.has(codeKey);
    let style = "bg-slate-100 text-slate-500 border-slate-200";
    switch (status) {
      case "P":     style = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-100"; break;
      case "WO-P":  style = "bg-teal-50 text-teal-700 border-teal-200 font-bold hover:bg-teal-100"; break;
      case "WO":    style = "bg-sky-50 text-sky-700 border-sky-200 font-semibold"; break;
      case "A":
      case "LWP":   style = "bg-rose-50 text-rose-700 border-rose-200 font-black"; break;
      case "CL":
      case "SiL":
      case "CO":
      case "EL":
      case "PatL":  style = "bg-amber-50 text-amber-700 border-amber-200 font-semibold"; break;
    }
    return (
      <div
        className={`relative inline-flex items-center justify-center w-5.5 h-5.5 rounded-none text-[9.5px] border transition-transform hover:scale-105 cursor-pointer leading-none ${style}`}
        title={`${dateStr}: ${status}${hasExpenseDiscrepancy ? ' (🚨 Expense on Non-Working Day)' : ''}`}
      >
        {status}
        {hasExpenseDiscrepancy && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-rose-600 text-[6px] font-black text-white ring-1 ring-white animate-pulse">!</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2.5 antialiased text-slate-800 font-sans">

      {/* ── Page Header ── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">Attendance Roster &amp; Audit</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">31-day attendance matrix &amp; expense discrepancy audit</p>
          </div>
        </div>

        {/* Month / Year + Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-none px-2.5 py-1.5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-slate-300 mx-1">|</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-none border border-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Employees */}
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md hover:border-blue-300 transition-all">
          <div className="w-9 h-9 rounded-none bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">TOTAL EMPLOYEES</span>
            <span className="text-[15px] font-mono font-extrabold text-slate-900 leading-none">{attendanceData.length}</span>
            <span className="text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-none font-mono leading-none w-fit">Staff</span>
          </div>
        </div>

        {/* Present Days */}
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md hover:border-emerald-300 transition-all">
          <div className="w-9 h-9 rounded-none bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">PRESENT DAYS</span>
            <span className="text-[15px] font-mono font-extrabold text-emerald-700 leading-none">
              {((summaryData?.statusCounts?.P || 0) + (summaryData?.statusCounts?.['WO-P'] || 0)).toLocaleString()}
            </span>
            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-none font-mono leading-none w-fit">P + WO-P</span>
          </div>
        </div>

        {/* Leaves */}
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md hover:border-amber-300 transition-all">
          <div className="w-9 h-9 rounded-none bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">LEAVES ACCOUNTED</span>
            <span className="text-[15px] font-mono font-extrabold text-amber-700 leading-none">
              {((summaryData?.statusCounts?.CL || 0) + (summaryData?.statusCounts?.SiL || 0) + (summaryData?.statusCounts?.CO || 0) + (summaryData?.statusCounts?.EL || 0)).toLocaleString()}
            </span>
            <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-none font-mono leading-none w-fit">CL / SiL / CO / EL</span>
          </div>
        </div>

        {/* Discrepancy Risk */}
        <div className="bg-white border border-rose-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md hover:border-rose-400 transition-all">
          <div className="w-9 h-9 rounded-none bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 leading-none">DISCREPANCY RISK</span>
            <span className="text-[15px] font-mono font-extrabold text-rose-700 leading-none">{discrepancies.length}</span>
            <span className="text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-none font-mono leading-none w-fit">Flagged Claims</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar + Tabs ── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
        {/* Tab Row */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-3 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1.5 rounded-none border ${
                activeTab === "matrix"
                  ? "bg-[#4A6A8A] text-white border-[#4A6A8A]"
                  : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" />
              31-Day Roster
            </button>
            <button
              onClick={() => setActiveTab("discrepancies")}
              className={`px-3 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1.5 rounded-none border ${
                activeTab === "discrepancies"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              Discrepancies ({discrepancies.length})
            </button>
            <button
              onClick={() => setActiveTab("roster")}
              className={`px-3 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1.5 rounded-none border ${
                activeTab === "roster"
                  ? "bg-[#4A6A8A] text-white border-[#4A6A8A]"
                  : "text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Briefcase className="w-3 h-3" />
              Workforce Summary
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Employee / Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-none text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#4A6A8A] w-44 sm:w-52"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {zonesList.length > 0 && (
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Zones</option>
                {zonesList.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            )}

            {districtsList.length > 0 && (
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Districts</option>
                {districtsList.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
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

        {/* Legend */}
        {activeTab === "matrix" && (
          <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-medium text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Legend:</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 inline-block"></span> P — Present</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-teal-500 inline-block"></span> WO-P</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-sky-400 inline-block"></span> WO</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 inline-block"></span> CL / SiL / CO / EL</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-rose-500 inline-block"></span> A / LWP</span>
            </div>
            <span className="text-rose-600 font-bold inline-flex items-center gap-1 text-[9.5px]">
              <span className="w-1.5 h-1.5 bg-rose-600 rounded-full inline-block animate-pulse"></span>
              Red Badge = Non-Working Day Expense
            </span>
          </div>
        )}
      </div>

      {/* ── Table Views ── */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-none p-10 flex flex-col items-center justify-center text-center space-y-2 shadow-2xs">
          <RefreshCw className="w-5 h-5 text-[#4A6A8A] animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Loading Roster...</p>
        </div>

      ) : activeTab === "matrix" ? (
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
          {/* Table Header */}
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              31-DAY ATTENDANCE MATRIX — {selectedMonth.toUpperCase()} {selectedYear}
            </span>
            <span className="text-[10px] font-semibold text-blue-100 bg-white/15 px-2 py-0.5 rounded-none border border-white/20">
              {filteredAttendance.length} Employees
            </span>
          </div>
          <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-2 text-[11px] font-bold text-slate-700 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-30 min-w-[190px]">
                    Employee Details
                  </th>
                  {dateList.map((d) => (
                    <th
                      key={d.dateStr}
                      className={`px-0.5 py-1.5 text-[10px] font-bold text-center border-b border-r border-slate-200 min-w-[28px] ${
                        d.isWeekend ? "bg-indigo-50 text-indigo-600" : "text-slate-500"
                      }`}
                    >
                      {d.dayNum}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="px-4 py-8 text-center text-slate-400 text-xs">
                      No employees found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((emp) => (
                    <tr
                      key={emp.employee_code}
                      onClick={() => setInspectEmployee(emp)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-3 py-1.5 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-blue-50/40 z-10">
                        <div className="font-bold text-slate-900 text-[11px] leading-tight truncate max-w-[165px] group-hover:text-[#4A6A8A] transition-colors" title={emp.employee_name}>
                          {emp.employee_name}
                        </div>
                        <div className="text-[9.5px] text-slate-400 font-mono leading-none mt-0.5 flex items-center gap-1">
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
                            className={`px-0.5 py-0.5 text-center border-r border-slate-100 ${d.isWeekend ? "bg-indigo-50/30" : ""}`}
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
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
          {/* Discrepancy Header */}
          <div className="bg-rose-600 text-white px-3.5 py-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              DISCREPANCY AUDIT — EXPENSES ON NON-WORKING DAYS
            </span>
            <span className="text-[10px] font-semibold text-rose-100 bg-white/15 px-2 py-0.5 rounded-none border border-white/20">
              {filteredDiscrepancies.length} Claims · ₹{totalDiscrepancyAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Expense Code</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Expense Date</th>
                  <th className="px-3 py-2">Attendance</th>
                  <th className="px-3 py-2">Claim Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDiscrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No discrepancy records found
                    </td>
                  </tr>
                ) : (
                  filteredDiscrepancies.map((disc) => (
                    <tr key={disc.expense_id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-3 py-1.5 font-mono font-bold text-indigo-600">{disc.expense_code}</td>
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-slate-900">{disc.emp_name}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{disc.emp_code}</div>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-700">{disc.expense_date}</td>
                      <td className="px-3 py-1.5">
                        <span className="px-1.5 py-0.5 rounded-none text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {disc.attendance_status || "UNMATCHED"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-extrabold text-slate-900">
                        ₹{(disc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-black uppercase ${
                          disc.expense_status === "approved"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : disc.expense_status === "rejected"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {disc.expense_status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 max-w-xs truncate text-slate-500">{disc.description || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
          {/* Workforce Header */}
          <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              WORKFORCE SUMMARY — {selectedMonth.toUpperCase()} {selectedYear}
            </span>
            <span className="text-[10px] font-semibold text-blue-100 bg-white/15 px-2 py-0.5 rounded-none border border-white/20">
              {filteredAttendance.length} Staff
            </span>
          </div>

          <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Designation</th>
                  <th className="px-3 py-2">District / Zone</th>
                  <th className="px-3 py-2 text-center">Present (P)</th>
                  <th className="px-3 py-2 text-center">Week Off</th>
                  <th className="px-3 py-2 text-center">Leaves</th>
                  <th className="px-3 py-2 text-center">Absent (A)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttendance.map((emp) => {
                  const values = Object.values(emp.dates || {});
                  const pCount = values.filter((v) => v === "P" || v === "WO-P").length;
                  const woCount = values.filter((v) => v === "WO").length;
                  const leaveCount = values.filter((v) => ["CL", "SiL", "CO", "EL", "PatL"].includes(v)).length;
                  const aCount = values.filter((v) => v === "A" || v === "LWP").length;
                  return (
                    <tr key={emp.employee_code} className="hover:bg-blue-50/30 transition-colors font-medium">
                      <td className="px-3 py-1.5 font-mono font-bold text-[#4A6A8A]">{emp.employee_code}</td>
                      <td className="px-3 py-1.5 font-bold text-slate-900">{emp.employee_name}</td>
                      <td className="px-3 py-1.5 text-slate-500 max-w-[180px] truncate">{emp.designation || '—'}</td>
                      <td className="px-3 py-1.5 text-slate-500">{emp.district || emp.zone || '—'}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">{pCount}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-none bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">{woCount}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-none bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">{leaveCount}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded-none text-[10px] font-bold ${
                          aCount > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "text-slate-300"
                        }`}>{aCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Inspector Drawer ── */}
      {inspectEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto border-l border-slate-200">
            {/* Drawer Header */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white leading-none">{inspectEmployee.employee_name}</h3>
                <p className="text-[10px] text-blue-200 font-mono mt-0.5">{inspectEmployee.employee_code}</p>
              </div>
              <button onClick={() => setInspectEmployee(null)} className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-none">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-none">
                  <span className="text-slate-400 font-bold block text-[9px] uppercase mb-1">Designation</span>
                  <span className="font-bold text-slate-800">{inspectEmployee.designation || 'Field Staff'}</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-none">
                  <span className="text-slate-400 font-bold block text-[9px] uppercase mb-1">Territory / Zone</span>
                  <span className="font-bold text-slate-800">{inspectEmployee.district || inspectEmployee.zone || 'Rajasthan'}</span>
                </div>
              </div>

              {/* Monthly Log */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Monthly Log — {selectedMonth} {selectedYear}
                </h4>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {dateList.map((d) => {
                    const st = inspectEmployee.dates[d.dateStr];
                    const codeKey = `${inspectEmployee.employee_code.toUpperCase().replace(/[- ]/g, "")}_${d.dateStr}`;
                    const isDisc = discrepancyMap.has(codeKey);
                    return (
                      <div
                        key={d.dateStr}
                        className={`p-1 border rounded-none text-[10px] flex flex-col items-center justify-center relative ${
                          isDisc
                            ? "bg-rose-50 border-rose-300 text-rose-800"
                            : d.isWeekend
                            ? "bg-indigo-50 border-indigo-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span className="text-[8px] text-slate-400 font-mono">{d.dayNum}</span>
                        <span className="font-bold text-[9px]">{st || '—'}</span>
                        {isDisc && <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-rose-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discrepancy Warning */}
              {Array.from(discrepancyMap).some(k => k.startsWith(inspectEmployee.employee_code.toUpperCase().replace(/[- ]/g, ""))) && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-none p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-semibold text-rose-700">
                    This employee has expense claims submitted on non-working days. Review discrepancy tab for details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
