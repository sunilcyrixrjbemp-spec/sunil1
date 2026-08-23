import React, { Suspense, useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Modal } from "antd";
import {
  BarChart3,
  FileSpreadsheet,
  RotateCcw,
  Users,
  User,
  Award,
  Search,
  Eye,
  ShieldCheck,
  Wrench,
  Navigation,
  DollarSign,
  PhoneCall,
  Activity,
  Layers
} from "lucide-react";

import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import { hasFullAccess } from "../utils/constants";
import { ZohoKpiRow } from "../components/home/ZohoKpiRow";
import { ZohoSpendChart } from "../components/home/ZohoSpendChart";
import { ZohoCategoryChart } from "../components/home/ZohoCategoryChart";
import { ZohoExecutiveComparison } from "../components/home/ZohoExecutiveComparison";
import { getStatusBadgeClass, getStatusLabel } from "../components/home/claimsColumns";

const ClaimDetailsModal = React.lazy(() => import("../components/common/ClaimDetailsModal"));

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

export default function AnalysisPage() {
  const currentUser = authService.getCurrentUser();
  const allowedWindows = (currentUser?.allowed_windows || "").split(",").map((w: string) => w.trim().toLowerCase());
  const isReviewer = allowedWindows.includes("approval") || hasFullAccess(currentUser?.role);

  // ── View Mode & Date Selection ──
  const [viewMode, setViewMode] = useState<"my" | "team">(() => {
    const saved = localStorage.getItem("analysis_viewMode");
    if (saved === "my" || saved === "team") return saved;
    return isReviewer ? "team" : "my";
  });

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const saved = localStorage.getItem("analysis_selectedMonth");
    return saved !== null ? Number(saved) : currentDate.getMonth();
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem("analysis_selectedYear");
    return saved !== null ? Number(saved) : currentDate.getFullYear();
  });

  // ── Sub-tab within Deep Analysis (Overview, Field Operations, Financials) ──
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<"overview" | "field_ops" | "financials">("overview");

  // ── Filter State ──
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedEngineer, setSelectedEngineer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ── Data State ──
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [teamExpenses, setTeamExpenses] = useState<any[]>([]);

  // ── Modal & Drilldown State ──
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [statsModalTitle, setStatsModalTitle] = useState<string>("");
  const [statsModalClaims, setStatsModalClaims] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("analysis_viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedMonth", String(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedYear", String(selectedYear));
  }, [selectedYear]);

  // Fetch expenses for current month query
  useEffect(() => {
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const monthQueryParam = `${selectedYear}-${monthStr}`;

    const fetchData = async () => {
      try {
        if (isReviewer) {
          const [own, team] = await Promise.all([
            expenseService.getExpenses(monthQueryParam),
            expenseService.getTeamExpenses(monthQueryParam)
          ]);
          setMyExpenses(own || []);
          setTeamExpenses(team || []);
        } else {
          const own = await expenseService.getExpenses(monthQueryParam);
          setMyExpenses(own || []);
        }
      } catch (err) {
        console.error("Error fetching analysis data:", err);
      }
    };
    fetchData();
  }, [isReviewer, selectedMonth, selectedYear]);

  // Base raw source
  const rawList = useMemo(() => {
    const source = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    return source.filter((e) => e && e.category !== "Limit Request" && e.request_type !== "limit");
  }, [viewMode, isReviewer, teamExpenses, myExpenses]);

  // Filter options for dropdowns
  const filterOptions = useMemo(() => {
    const zones = new Set<string>(["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"]);
    const districts = new Set<string>();
    const engineers = new Set<string>();

    rawList.forEach((e) => {
      const dist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || "Unassigned";
      const name = e.submitter_name || e.name || "Self";
      const zone = e.zone || "";

      if (zone) zones.add(zone);
      if (selectedZone === "all" || cleanZone(zone) === cleanZone(selectedZone)) {
        if (dist) districts.add(dist);
        if (selectedDistrict === "all" || dist.toLowerCase() === selectedDistrict.toLowerCase()) {
          if (name) engineers.add(name);
        }
      }
    });

    return {
      zones: Array.from(zones).sort(),
      districts: Array.from(districts).sort(),
      engineers: Array.from(engineers).sort()
    };
  }, [rawList, selectedZone, selectedDistrict]);

  // Filtered expenses based on all active filters
  const filteredExpenses = useMemo(() => {
    return rawList.filter((e) => {
      const dist = String(e.district || e.submitter_district || e.home_district || e.work_location || e.location || "").toLowerCase();
      const name = String(e.submitter_name || e.name || "").toLowerCase();
      const zone = cleanZone(e.zone || "");
      const stat = String(e.status || "").toLowerCase();
      const eCode = String(e.employee_code || e.e_code || "").toLowerCase();
      const expCode = String(e.expense_code || "").toLowerCase();

      if (selectedZone !== "all" && zone !== cleanZone(selectedZone)) return false;
      if (selectedDistrict !== "all" && dist !== selectedDistrict.toLowerCase()) return false;
      if (selectedEngineer !== "all" && name !== selectedEngineer.toLowerCase()) return false;

      if (selectedStatus !== "all") {
        if (selectedStatus === "approved" && !stat.includes("approved") && stat !== "paid") return false;
        if (selectedStatus === "pending" && (stat.includes("approved") || stat.includes("reject") || stat.includes("return"))) return false;
        if (selectedStatus === "returned" && !stat.includes("return") && !stat.includes("revision")) return false;
        if (selectedStatus === "rejected" && !stat.includes("reject") && !stat.includes("declined")) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = name.includes(q);
        const matchDist = dist.includes(q);
        const matchECode = eCode.includes(q);
        const matchExpCode = expCode.includes(q);
        if (!matchName && !matchDist && !matchECode && !matchExpCode) return false;
      }

      return true;
    });
  }, [rawList, selectedZone, selectedDistrict, selectedEngineer, selectedStatus, searchQuery]);

  // Deep Field Operations & Calls Metrics
  const fieldOpsMetrics = useMemo(() => {
    let totalKm = 0;
    let bikeKm = 0;
    let carKm = 0;
    let totalPms = 0;
    let totalCalib = 0;
    let totalCallsAssigned = 0;
    let totalCallsCompleted = 0;
    let totalAssetTaggingQty = 0;
    let totalAssetTaggingVal = 0;

    filteredExpenses.forEach((exp) => {
      let rawLegs = exp.itineraries || exp.legs || exp.items;
      if (typeof rawLegs === "string") {
        try { rawLegs = JSON.parse(rawLegs); } catch { rawLegs = null; }
      }
      if (Array.isArray(rawLegs)) {
        rawLegs.forEach((leg: any) => {
          const km = Number(leg.distance_km || 0);
          totalKm += km;
          const mode = String(leg.travel_mode || "").toLowerCase();
          if (mode === "bike") bikeKm += km;
          if (mode === "car") carKm += km;

          totalPms += Number(leg.pms_count || 0);
          totalCalib += Number(leg.calibration_count || 0);
          totalCallsAssigned += Number(leg.calls_assigned || 0);
          totalCallsCompleted += Number(leg.calls_completed || 0);
          totalAssetTaggingQty += Number(leg.asset_tagging_qty || 0);
          totalAssetTaggingVal += Number(leg.asset_tagging_val || 0);
        });
      }
    });

    const callCompletionRate = totalCallsAssigned > 0
      ? Math.round((totalCallsCompleted / totalCallsAssigned) * 100)
      : 100;

    return {
      totalKm,
      bikeKm,
      carKm,
      totalPms,
      totalCalib,
      totalCallsAssigned,
      totalCallsCompleted,
      callCompletionRate,
      totalAssetTaggingQty,
      totalAssetTaggingVal
    };
  }, [filteredExpenses]);

  // KPI calculations
  const {
    totalAmount,
    approvedAmount,
    pendingAmount,
    returnedAmount,
    rejectedAmount,
    totalCount,
    approvedCount,
    pendingCount,
    returnedCount,
    rejectedCount,
    statsTotalClaims,
    statsApprovedClaims,
    statsPendingClaims,
    statsReturnedClaims,
    statsRejectedClaims,
  } = useMemo(() => {
    let totAmt = 0;
    let appAmt = 0;
    let pendAmt = 0;
    let retAmt = 0;
    let rejAmt = 0;

    const sTot: any[] = [];
    const sApp: any[] = [];
    const sPend: any[] = [];
    const sRet: any[] = [];
    const sRej: any[] = [];

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount != null ? exp.amount : (exp.total_amount || 0));
      const s = String(exp.status || "").toLowerCase().trim();

      totAmt += amt;
      sTot.push(exp);

      if (s === "approved" || s === "auto_approved" || s === "paid" || s.includes("approve")) {
        appAmt += amt;
        sApp.push(exp);
      } else if (s === "returned_to_draft" || s === "returned" || s.includes("return") || s.includes("revision")) {
        retAmt += amt;
        sRet.push(exp);
      } else if (s === "rejected" || s.includes("reject") || s.includes("declined")) {
        rejAmt += amt;
        sRej.push(exp);
      } else {
        pendAmt += amt;
        sPend.push(exp);
      }
    });

    return {
      totalAmount: totAmt,
      approvedAmount: appAmt,
      pendingAmount: pendAmt,
      returnedAmount: retAmt,
      rejectedAmount: rejAmt,
      totalCount: sTot.length,
      approvedCount: sApp.length,
      pendingCount: sPend.length,
      returnedCount: sRet.length,
      rejectedCount: sRej.length,
      statsTotalClaims: sTot,
      statsApprovedClaims: sApp,
      statsPendingClaims: sPend,
      statsReturnedClaims: sRet,
      statsRejectedClaims: sRej,
    };
  }, [filteredExpenses]);

  // Engineer leaderboard aggregation
  const engineerLeaderboard = useMemo(() => {
    const map: Record<string, any> = {};

    filteredExpenses.forEach((exp) => {
      const eCode = exp.employee_code || exp.e_code || exp.submitter_id || exp.user_id || "N/A";
      const name = exp.submitter_name || exp.name || "Self";
      const dist = exp.district || exp.submitter_district || exp.work_location || "—";
      const zone = exp.zone || "—";
      const amt = Number(exp.amount != null ? exp.amount : (exp.total_amount || 0));
      const s = String(exp.status || "").toLowerCase();

      if (!map[eCode]) {
        map[eCode] = {
          eCode,
          name,
          district: dist,
          zone,
          totalClaims: 0,
          approvedClaims: 0,
          totalAmount: 0,
          approvedAmount: 0,
          distanceKm: 0,
          callsDone: 0,
          pmsDone: 0
        };
      }

      map[eCode].totalClaims += 1;
      map[eCode].totalAmount += amt;

      if (s === "approved" || s === "auto_approved" || s === "paid" || s.includes("approve")) {
        map[eCode].approvedClaims += 1;
        map[eCode].approvedAmount += amt;
      }

      let rawLegs = exp.itineraries || exp.legs || exp.items;
      if (typeof rawLegs === "string") {
        try { rawLegs = JSON.parse(rawLegs); } catch { rawLegs = null; }
      }
      if (Array.isArray(rawLegs)) {
        rawLegs.forEach((leg: any) => {
          map[eCode].distanceKm += Number(leg.distance_km || 0);
          map[eCode].callsDone += Number(leg.calls_completed || 0);
          map[eCode].pmsDone += Number(leg.pms_count || 0);
        });
      }
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredExpenses]);

  // Handlers
  const handleOpenStatsModal = (type: string, list: any[]) => {
    setStatsModalTitle(type);
    setStatsModalClaims(list);
    setShowStatsModal(true);
  };

  const handleOpenClaimDetails = async (record: any) => {
    try {
      const expCode = record.expense_code || record.id;
      const details = await expenseService.getExpenseDetails(expCode);
      setClaimDetails(details || record);
      setShowDetailsModal(true);
    } catch {
      setClaimDetails(record);
      setShowDetailsModal(true);
    }
  };

  const handleResetFilters = () => {
    setSelectedZone("all");
    setSelectedDistrict("all");
    setSelectedEngineer("all");
    setSelectedStatus("all");
    setSearchQuery("");
  };

  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) return;

    const exportRows = filteredExpenses.map((e, idx) => ({
      "S.No": idx + 1,
      "Expense Code": e.expense_code || "—",
      "Date": e.date || "—",
      "Employee Code": e.employee_code || e.e_code || "—",
      "Employee Name": e.submitter_name || e.name || "Self",
      "Zone": e.zone || "—",
      "District": e.district || e.submitter_district || "—",
      "Amount (₹)": Number(e.amount != null ? e.amount : (e.total_amount || 0)),
      "Status": getStatusLabel(e.status),
      "Remarks / Purpose": e.purpose || e.description || "—"
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics_Report");
    XLSX.writeFile(wb, `Cyrix_Deep_Analytics_${months[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const formattedMonthParam = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#FAFAF9] pb-20 text-ink-900 font-sans">
      {/* ── 1. ZOHO HEADER & FILTER TOOLBAR ── */}
      <header className="bg-white border-b border-line px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-[#1E1B4B] text-white flex items-center justify-center shadow-2xs">
              <BarChart3 className="w-4 h-4 text-accent-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-ink-900 tracking-tight m-0 font-sans">
                  Deep Financial &amp; Field Analytics
                </h1>
                <span className="text-[10.5px] font-mono font-bold bg-accent-50 text-accent-700 border border-accent-200 px-1.5 py-0.5 rounded-[3px]">
                  {months[selectedMonth]} {selectedYear}
                </span>
              </div>
              <p className="text-[11px] text-ink-500 font-medium m-0">
                {viewMode === "team" ? "Zonal team performance, category distribution & spend audit" : "Personal monthly reimbursement analysis & spend breakdown"}
              </p>
            </div>
          </div>

          {/* Right Controls (Mode Switch & Action Buttons) */}
          <div className="flex items-center flex-wrap gap-2">
            {/* View Mode Toggle */}
            {isReviewer && (
              <div className="inline-flex rounded-[4px] p-0.5 bg-surface-sunken border border-line">
                <button
                  type="button"
                  onClick={() => setViewMode("my")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-[3px] transition-all cursor-pointer border-0 ${
                    viewMode === "my"
                      ? "bg-white text-accent-800 shadow-2xs"
                      : "bg-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>My Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("team")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-[3px] transition-all cursor-pointer border-0 ${
                    viewMode === "team"
                      ? "bg-white text-accent-800 shadow-2xs"
                      : "bg-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Team Analytics</span>
                </button>
              </div>
            )}

            {/* Reset Filters Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-2.5 rounded-[4px] text-xs font-semibold bg-white text-ink-700 border border-line hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-[4px] text-xs font-bold bg-[#0F7A4C] hover:bg-[#0c633d] text-white border-0 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* ── Multi-Parameter Filter Row ── */}
        <div className="max-w-[1440px] mx-auto mt-3 pt-3 border-t border-line/70 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Zone Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              Zone
            </label>
            <select
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setSelectedDistrict("all");
                setSelectedEngineer("all");
              }}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              <option value="all">All Zones</option>
              {filterOptions.zones.map((z) => (
                <option key={z} value={z}>{z} Zone</option>
              ))}
            </select>
          </div>

          {/* District Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedEngineer("all");
              }}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              <option value="all">All Districts ({filterOptions.districts.length})</option>
              {filterOptions.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Engineer Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              Engineer
            </label>
            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              <option value="all">All Engineers ({filterOptions.engineers.length})</option>
              {filterOptions.engineers.map((eng) => (
                <option key={eng} value={eng}>{eng}</option>
              ))}
            </select>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-1 font-mono">
              Claim Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 text-xs font-semibold bg-white border border-line rounded-[4px] px-2 text-ink-900 focus:outline-none focus:border-accent-600 cursor-pointer shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved &amp; Paid</option>
              <option value="pending">In Review / Pending</option>
              <option value="returned">Returned to Draft</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* ── 2. EXECUTIVE KPI CARDS ROW (DITTO HOMEPAGE) ── */}
        <ZohoKpiRow
          totalAmount={totalAmount}
          approvedAmount={approvedAmount}
          pendingAmount={pendingAmount}
          returnedAmount={returnedAmount}
          rejectedAmount={rejectedAmount}
          totalCount={totalCount}
          approvedCount={approvedCount}
          pendingCount={pendingCount}
          returnedCount={returnedCount}
          rejectedCount={rejectedCount}
          statsTotalClaims={statsTotalClaims}
          statsApprovedClaims={statsApprovedClaims}
          statsPendingClaims={statsPendingClaims}
          statsReturnedClaims={statsReturnedClaims}
          statsRejectedClaims={statsRejectedClaims}
          onOpenModal={handleOpenStatsModal}
        />

        {/* ── 3. SECTION SUB-NAVIGATION PILLS ── */}
        <div className="flex items-center gap-1.5 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveAnalysisTab("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all cursor-pointer border ${
              activeAnalysisTab === "overview"
                ? "bg-[#1E1B4B] text-white border-[#1E1B4B] shadow-2xs"
                : "bg-white text-ink-700 border-line hover:bg-slate-50"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Executive Overview &amp; Spend</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAnalysisTab("field_ops")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all cursor-pointer border ${
              activeAnalysisTab === "field_ops"
                ? "bg-[#1E1B4B] text-white border-[#1E1B4B] shadow-2xs"
                : "bg-white text-ink-700 border-line hover:bg-slate-50"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Field Operations &amp; Calls</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAnalysisTab("financials")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all cursor-pointer border ${
              activeAnalysisTab === "financials"
                ? "bg-[#1E1B4B] text-white border-[#1E1B4B] shadow-2xs"
                : "bg-white text-ink-700 border-line hover:bg-slate-50"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Leaderboard &amp; Audit Table</span>
          </button>
        </div>

        {/* ── 4. PRIMARY CHARTS ROW (OVERVIEW VIEW) ── */}
        {activeAnalysisTab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Spend Trend & Status Distribution (7 Cols) */}
              <div className="lg:col-span-7 h-full">
                <ZohoSpendChart
                  expenses={filteredExpenses}
                  selectMonth={months[selectedMonth]}
                />
              </div>

              {/* Right Column: Expenses by Category Breakdown (5 Cols) */}
              <div className="lg:col-span-5 h-full">
                <ZohoCategoryChart expenses={filteredExpenses} />
              </div>
            </div>

            {/* Field Executive & District Comparison Intelligence */}
            {isReviewer && (
              <div className="space-y-4">
                <ZohoExecutiveComparison
                  currentClaims={filteredExpenses}
                  user={currentUser}
                  isReviewerRole={isReviewer}
                  activeTab={viewMode === "team" ? "team-claims" : "my-claims"}
                  selectMonth={formattedMonthParam}
                  filterZone={selectedZone === "all" ? undefined : selectedZone}
                  filterDistrict={selectedDistrict === "all" ? undefined : selectedDistrict}
                  filterEmployee={selectedEngineer === "all" ? undefined : selectedEngineer}
                />
              </div>
            )}
          </div>
        )}

        {/* ── 5. FIELD OPERATIONS, PMS & CALLS TAB ── */}
        {activeAnalysisTab === "field_ops" && (
          <div className="space-y-4">
            {/* Field Ops Key Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-[4px] border border-line shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-ink-400 uppercase font-mono mb-1">
                  <span>Total Distance Covered</span>
                  <Navigation className="w-3.5 h-3.5 text-accent-600" />
                </div>
                <div className="text-lg font-bold font-mono text-ink-900">
                  {fieldOpsMetrics.totalKm.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km
                </div>
                <div className="text-[10.5px] text-ink-500 mt-1">
                  Bike: <strong>{fieldOpsMetrics.bikeKm.toFixed(0)} km</strong> | Car: <strong>{fieldOpsMetrics.carKm.toFixed(0)} km</strong>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-[4px] border border-line shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-ink-400 uppercase font-mono mb-1">
                  <span>Breakdown Calls</span>
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700">
                  {fieldOpsMetrics.totalCallsCompleted} / {fieldOpsMetrics.totalCallsAssigned}
                </div>
                <div className="text-[10.5px] text-emerald-600 font-semibold mt-1">
                  {fieldOpsMetrics.callCompletionRate}% Resolution Rate
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-[4px] border border-line shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-ink-400 uppercase font-mono mb-1">
                  <span>PMS Completed</span>
                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-lg font-bold font-mono text-indigo-900">
                  {fieldOpsMetrics.totalPms} Units
                </div>
                <div className="text-[10.5px] text-ink-500 mt-1">
                  Calibrations: <strong>{fieldOpsMetrics.totalCalib}</strong>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-[4px] border border-line shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-ink-400 uppercase font-mono mb-1">
                  <span>Asset Tagging</span>
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-bold font-mono text-amber-900">
                  {fieldOpsMetrics.totalAssetTaggingQty} Assets
                </div>
                <div className="text-[10.5px] text-ink-500 mt-1">
                  Total Value: <strong>₹{fieldOpsMetrics.totalAssetTaggingVal.toLocaleString("en-IN")}</strong>
                </div>
              </div>
            </div>

            {/* Engineer Field Activity Summary Table */}
            <div className="bg-white rounded-[4px] border border-line p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-ink-900 m-0 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-700" />
                  <span>Engineer-Wise Field Activity &amp; Calls Breakdown</span>
                </h3>
                <span className="text-xs font-mono font-bold text-ink-500">
                  {engineerLeaderboard.length} Engineers Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken/60 text-[10px] font-bold text-ink-500 uppercase tracking-wider font-mono">
                      <th className="py-2 px-3">Engineer Name</th>
                      <th className="py-2 px-3">E-Code</th>
                      <th className="py-2 px-3">Zone / District</th>
                      <th className="py-2 px-3 text-right">Distance (KM)</th>
                      <th className="py-2 px-3 text-center">Calls (Done/Assigned)</th>
                      <th className="py-2 px-3 text-center">PMS</th>
                      <th className="py-2 px-3 text-right">Total Expense</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs font-medium text-ink-800">
                    {engineerLeaderboard.map((eng) => (
                      <tr key={eng.eCode} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-bold text-ink-900">{eng.name}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-ink-600">{eng.eCode}</td>
                        <td className="py-2 px-3 text-ink-700">{eng.district} ({eng.zone})</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{eng.distanceKm.toFixed(1)} km</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700">{eng.callsDone}</td>
                        <td className="py-2 px-3 text-center font-mono">{eng.pmsDone}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-ink-900">₹{eng.totalAmount.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. FINANCIALS, LEADERBOARD & DETAILED AUDIT TABLE TAB ── */}
        {(activeAnalysisTab === "financials" || activeAnalysisTab === "overview") && (
          <div className="space-y-5">
            {/* Engineer Financial Leaderboard */}
            {viewMode === "team" && isReviewer && (
              <div className="bg-white rounded-[4px] border border-line p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-ink-900 m-0">
                        Field Engineer Spend &amp; Performance Leaderboard
                      </h3>
                      <p className="text-[10.5px] text-ink-500 m-0">
                        Ranked by total reimbursement volume for {months[selectedMonth]} {selectedYear}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-mono font-bold text-accent-700 bg-accent-50 px-2.5 py-1 rounded border border-accent-200">
                    {engineerLeaderboard.length} Active Engineers
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-surface-sunken/60 text-[10px] font-bold text-ink-500 uppercase tracking-wider font-mono">
                        <th className="py-2 px-3 text-center w-12">#</th>
                        <th className="py-2 px-3">Engineer Name</th>
                        <th className="py-2 px-3">E-Code</th>
                        <th className="py-2 px-3">Zone / District</th>
                        <th className="py-2 px-3 text-center">Claims</th>
                        <th className="py-2 px-3 text-right">Distance (KM)</th>
                        <th className="py-2 px-3 text-right">Approved Amount</th>
                        <th className="py-2 px-3 text-right">Total Claimed</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs font-medium text-ink-800">
                      {engineerLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-ink-400 font-sans">
                            No engineer claim records found for the selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        engineerLeaderboard.slice(0, 15).map((eng, index) => (
                          <tr key={eng.eCode} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-center font-mono font-bold text-ink-400">
                              {index + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-ink-900">
                              {eng.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-ink-600">
                              {eng.eCode}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px]">
                                <span className="font-semibold text-ink-800">{eng.district}</span>
                                <span className="text-ink-400">({eng.zone})</span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              <span className="text-emerald-700">{eng.approvedClaims}</span>
                              <span className="text-ink-300"> / </span>
                              <span>{eng.totalClaims}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-ink-700">
                              {eng.distanceKm > 0 ? `${eng.distanceKm.toFixed(1)} km` : "—"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              ₹{eng.approvedAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-ink-900">
                              ₹{eng.totalAmount.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEngineer(eng.name);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="text-[10px] font-bold uppercase tracking-wider text-accent-700 hover:text-accent-900 bg-accent-50 hover:bg-accent-100 px-2 py-0.5 rounded border border-accent-200 transition-colors cursor-pointer"
                              >
                                Filter
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Filtered Claims Record Table */}
            <div className="bg-white rounded-[4px] border border-line p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[3px] bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-ink-900 m-0">
                      Filtered Reimbursement Audit Records
                    </h3>
                    <p className="text-[10.5px] text-ink-500 m-0">
                      Showing {filteredExpenses.length} claims matching active criteria
                    </p>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search engineer, code, district..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-sunken border border-line rounded-[4px] text-ink-900 focus:outline-none focus:border-accent-600 font-sans"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken/60 text-[10px] font-bold text-ink-500 uppercase tracking-wider font-mono">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Claim Code</th>
                      <th className="py-2 px-3">Engineer Name</th>
                      <th className="py-2 px-3">District</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs font-medium text-ink-800">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-ink-400 font-sans">
                          No expense records found matching the active filter parameters.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.slice(0, 50).map((claim) => {
                        const amt = Number(claim.amount != null ? claim.amount : (claim.total_amount || 0));

                        return (
                          <tr
                            key={claim.expense_code || claim.id}
                            onClick={() => handleOpenClaimDetails(claim)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3 font-mono text-[11px] text-ink-700">
                              {claim.date || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-accent-700 text-[11px]">
                              {claim.expense_code || "—"}
                            </td>
                            <td className="py-2 px-3 font-bold text-ink-900">
                              {claim.submitter_name || claim.name || "Self"}
                              <span className="text-[10px] text-ink-400 font-mono block">
                                {claim.employee_code || claim.e_code || ""}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink-700">
                              {claim.district || claim.submitter_district || "—"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-ink-900">
                              ₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider font-mono ${getStatusBadgeClass(claim.status)}`}>
                                {getStatusLabel(claim.status)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenClaimDetails(claim);
                                }}
                                className="text-[10.5px] font-bold text-accent-700 hover:text-accent-900 bg-white border border-line hover:border-accent-600 px-2 py-1 rounded-[3px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1 mx-auto"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filteredExpenses.length > 50 && (
                <div className="pt-2 text-center text-xs text-ink-500 font-medium">
                  Showing top 50 records of {filteredExpenses.length}. Use filters or Export to Excel to analyze full data.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── 7. DRILLDOWN STATS MODAL ── */}
      {showStatsModal && (
        <Modal
          title={
            <div className="flex items-center gap-2 text-ink-900 font-mono text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-accent-600" />
              <span>{statsModalTitle} Claims Audit Breakdown</span>
            </div>
          }
          open={showStatsModal}
          onCancel={() => setShowStatsModal(false)}
          footer={null}
          width={800}
          className="rounded-[4px] overflow-hidden"
        >
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-600 font-mono bg-surface-sunken p-2.5 rounded border border-line">
              <span>Total Selected: <strong>{statsModalClaims.length} records</strong></span>
              <span>Total Amount: <strong>₹{statsModalClaims.reduce((s, c) => s + Number(c.amount || c.total_amount || 0), 0).toLocaleString("en-IN")}</strong></span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken text-[10px] font-bold text-ink-500 uppercase font-mono">
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5">Claim Code</th>
                    <th className="py-2 px-2.5">Engineer</th>
                    <th className="py-2 px-2.5">District</th>
                    <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                    <th className="py-2 px-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {statsModalClaims.map((c) => (
                    <tr
                      key={c.expense_code || c.id}
                      onClick={() => {
                        setShowStatsModal(false);
                        handleOpenClaimDetails(c);
                      }}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2 px-2.5 font-mono text-ink-700">{c.date || "—"}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-accent-700">{c.expense_code || "—"}</td>
                      <td className="py-2 px-2.5 font-bold text-ink-900">{c.submitter_name || c.name || "Self"}</td>
                      <td className="py-2 px-2.5 text-ink-700">{c.district || c.submitter_district || "—"}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold">
                        ₹{Number(c.amount || c.total_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase font-mono ${getStatusBadgeClass(c.status)}`}>
                          {getStatusLabel(c.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 8. CLAIM DETAILS MODAL (LAZY LOADED) ── */}
      <Suspense fallback={null}>
        {showDetailsModal && claimDetails && (
          <ClaimDetailsModal
            sourceMode="home"
            open={showDetailsModal}
            claimDetails={claimDetails}
            user={currentUser}
            comments=""
            setComments={() => {}}
            actionLoading={false}
            handleApprove={() => {}}
            handleReject={() => {}}
            handleDeleteClaim={() => {}}
            onClose={() => { setShowDetailsModal(false); setClaimDetails(null); }}
            navigate={() => {}}
            setLightboxImage={() => {}}
            getStatusBadgeClass={getStatusBadgeClass}
            getStatusLabel={getStatusLabel}
          />
        )}
      </Suspense>
    </div>
  );
}
