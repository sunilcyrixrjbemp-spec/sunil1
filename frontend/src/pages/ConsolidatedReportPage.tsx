import { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Search,
  RefreshCw,
  Download,
  ShieldAlert,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Users,
  Wallet,
  CheckCircle2,
  TrendingDown,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { expenseService } from "../services/expenseService";

const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ConsolidatedReportPage() {
  const currentDate = new Date();
  const [month, setMonth] = useState<string>(MONTHS[currentDate.getMonth() + 1]);
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPolicyGrade, setSelectedPolicyGrade] = useState<string>("");
  const [allPolicies, setAllPolicies] = useState<any[]>([]);
  const [showPolicyPanel, setShowPolicyPanel] = useState<boolean>(false);

  const fetchPolicies = async () => {
    try {
      const res = await expenseService.getPolicyRules("");
      if (res && res.success) {
        const policies = res.data || [];
        setAllPolicies(policies);
        if (policies.length > 0 && !selectedPolicyGrade) {
          setSelectedPolicyGrade(policies[0].grade || "");
        }
      }
    } catch (err) {
      console.error("Failed to load policy rules from allowance master", err);
    }
  };

  useEffect(() => {
    if (showPolicyPanel && allPolicies.length === 0) {
      fetchPolicies();
    }
  }, [showPolicyPanel]);

  const availableGrades = Array.from(new Set(allPolicies.map((p) => p.grade)))
    .filter(Boolean)
    .sort();
  const selectedPolicy = allPolicies.find((p) => p.grade === selectedPolicyGrade);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    const tid = toast.loading("Fetching consolidated report data...");
    try {
      const res = await expenseService.getConsolidatedReport(month, year);
      toast.dismiss(tid);
      if (res && res.success) {
        setData(res.data || []);
        toast.success(`Loaded ${res.data?.length || 0} consolidated records!`);
      } else {
        toast.error("Failed to load report data");
      }
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.detail || "Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter(
      (r) =>
        (r.ee_name || "").toLowerCase().includes(q) ||
        (r.ee_code || "").toLowerCase().includes(q) ||
        (r.designation || "").toLowerCase().includes(q) ||
        (r.manager || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Aggregates
  const { totalApprovedSum, totalAdvances, totalNet, totalClaimed } = useMemo(() => {
    let app = 0;
    let adv = 0;
    let net = 0;
    let clm = 0;

    data.forEach((r) => {
      const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
      const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
      const rowTotal =
        privateTravel +
        publicTravel +
        (r.da_allowance || 0) +
        (r.spare_purchase || 0) +
        (r.courier_charges || 0) +
        (r.boarding_lodging || 0) +
        (r.printing_stationery || 0) +
        (r.misc_expenses || 0);
      const rowNet = rowTotal - (r.advance || 0);

      app += rowTotal;
      adv += r.advance || 0;
      net += rowNet;
      clm += r.claimed_amount || 0;
    });

    return {
      totalApprovedSum: app,
      totalAdvances: adv,
      totalNet: net,
      totalClaimed: clm,
    };
  }, [data]);

  const fmt = (num: number | undefined) => {
    if (num === undefined || num === null) return "0.00";
    return Number(num).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const downloadExcel = async () => {
    if (data.length === 0) {
      toast.error("No data available to download");
      return;
    }

    const tid = toast.loading("Generating styled Excel report with cell notes...");

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Cyrix Field Connect";
      workbook.lastModifiedBy = "Cyrix Field Connect";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Consolidated Report", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { header: "Sl No", key: "sl_no", width: 8 },
        { header: "Submitted Date", key: "submitted_date", width: 15 },
        { header: "Mail / Hard Copy", key: "mail_hard_copy", width: 16 },
        { header: "EE Code", key: "ee_code", width: 12 },
        { header: "Grade", key: "grade", width: 10 },
        { header: "Designation", key: "designation", width: 25 },
        { header: "CC", key: "cc", width: 10 },
        { header: "EE Name", key: "ee_name", width: 25 },
        { header: "5314101 - Exp Private Transport", key: "private_transport", width: 28 },
        { header: "5314101 - Exp Public Transport", key: "public_transport", width: 28 },
        { header: "5314102 - Exp DA", key: "da_allowance", width: 18 },
        { header: "5314108 - Exp Spare Purchase", key: "spare_purchase", width: 24 },
        { header: "5314103 - Exp Courier", key: "courier_charges", width: 20 },
        { header: "5314104 - Exp Boarding & Lodging", key: "boarding_lodging", width: 28 },
        { header: "5314105 - Exp Printing", key: "printing_stationery", width: 20 },
        { header: "5314106 - Exp Misc", key: "misc_expenses", width: 18 },
        { header: "5314107 - Fuel", key: "fuel", width: 15 },
        { header: "Total", key: "total_approved", width: 18 },
        { header: "Advances", key: "advance", width: 15 },
        { header: "Net Payable", key: "net_payable", width: 18 },
        { header: "GST Bills", key: "gst_bills", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Reason for Deduction", key: "deduction_reason", width: 35 },
        { header: "Month", key: "month", width: 14 },
        { header: "Hold Reason", key: "hold_reason", width: 14 },
        { header: "Remarks", key: "remarks", width: 30 },
        { header: "Manager", key: "manager", width: 22 },
        { header: "State", key: "state", width: 15 },
        { header: "Total Claimed", key: "claimed_amount", width: 18 },
        { header: "Difference", key: "difference", width: 18 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E1B4B" },
        };
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 10,
          name: "Segoe UI",
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FF4338CA" } },
          bottom: { style: "medium", color: { argb: "FF4338CA" } },
          left: { style: "thin", color: { argb: "FF4338CA" } },
          right: { style: "thin", color: { argb: "FF4338CA" } },
        };
      });

      data.forEach((r, idx) => {
        const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
        const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
        const rowTotal =
          privateTravel +
          publicTravel +
          (r.da_allowance || 0) +
          (r.spare_purchase || 0) +
          (r.courier_charges || 0) +
          (r.boarding_lodging || 0) +
          (r.printing_stationery || 0) +
          (r.misc_expenses || 0);
        const rowNet = rowTotal - (r.advance || 0);
        const rowDiff = (r.claimed_amount || 0) - rowTotal;

        const row = worksheet.addRow({
          sl_no: idx + 1,
          submitted_date: r.submitted_date || "",
          mail_hard_copy: r.mail_hard_copy || "Soft Copy",
          ee_code: r.ee_code || "",
          grade: r.grade || "",
          designation: r.designation || "",
          cc: r.cc || "",
          ee_name: r.ee_name || "",
          private_transport: privateTravel,
          public_transport: publicTravel,
          da_allowance: r.da_allowance || 0,
          spare_purchase: r.spare_purchase || 0,
          courier_charges: r.courier_charges || 0,
          boarding_lodging: r.boarding_lodging || 0,
          printing_stationery: r.printing_stationery || 0,
          misc_expenses: r.misc_expenses || 0,
          fuel: 0,
          total_approved: rowTotal,
          advance: r.advance || 0,
          net_payable: rowNet,
          gst_bills: "",
          status: "Approved",
          deduction_reason: r.deduction_reason || "",
          month: r.month || "",
          hold_reason: r.hold_reason || "No",
          remarks: r.remarks || "",
          manager: r.manager || "",
          state: r.state || "Rajasthan",
          claimed_amount: r.claimed_amount || 0,
          difference: rowDiff,
        });

        row.eachCell((cell, colNum) => {
          cell.font = { name: "Segoe UI", size: 9.5 };
          cell.alignment = { vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNum >= 9 && colNum <= 20) {
            cell.numFmt = "₹#,##0.00";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          }
          if (colNum >= 29 && colNum <= 30) {
            cell.numFmt = "₹#,##0.00";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Consolidated_Report_${month}_${year}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.dismiss(tid);
      toast.success("Excel report exported successfully!");
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error("Failed to generate Excel: " + (err.message || ""));
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] pb-24 text-ink-900 font-sans">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 space-y-3.5">
        
        {/* ══════════════════════════════════════════════════════════════════
            DITTO HOME PAGE ZOHO KPI ROW (EXACT 100% SAME CARD SPECIFICATIONS)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          
          {/* 1. Total Headcount */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-ink-500 font-sans group-hover:text-ink-700 transition-colors">
                TOTAL HEADCOUNT
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 group-hover:bg-accent-100 transition-colors">
                <Users className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-ink-900 leading-tight flex items-baseline justify-between">
                <span>{data.length} <span className="text-xs font-sans text-ink-500 font-normal">Engineers</span></span>
                <ArrowUpRight className="w-3 h-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block">
                100% Processed
              </span>
            </div>
          </div>

          {/* 2. Total Approved */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-emerald-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 font-sans">
                TOTAL APPROVED
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 leading-tight flex items-baseline justify-between">
                <span>₹{fmt(totalApprovedSum)}</span>
                <ArrowUpRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-emerald-600/80 font-medium leading-none mt-0.5 block">
                Audited Claims
              </span>
            </div>
          </div>

          {/* 3. Advances Deducted */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-rose-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-rose-800 font-sans">
                ADVANCES DEDUCTED
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 group-hover:bg-rose-100 transition-colors">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-rose-700 leading-tight flex items-baseline justify-between">
                <span>₹{fmt(totalAdvances)}</span>
                <ArrowUpRight className="w-3 h-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-rose-600/80 font-medium leading-none mt-0.5 block">
                Pre-paid amounts
              </span>
            </div>
          </div>

          {/* 4. Net Payable */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-accent-800 font-sans">
                NET PAYABLE (DISBURSEMENT)
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 group-hover:bg-accent-100 transition-colors">
                <Wallet className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-accent-900 leading-tight flex items-baseline justify-between">
                <span>₹{fmt(totalNet)}</span>
                <ArrowUpRight className="w-3 h-3 text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-accent-700 font-medium leading-none mt-0.5 block">
                Final Bank Transfer
              </span>
            </div>
          </div>

          {/* 5. Claimed Difference */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-amber-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden col-span-2 sm:col-span-1 shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 font-sans">
                CLAIMED DIFFERENCE
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:bg-amber-100 transition-colors">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-rose-700 leading-tight flex items-baseline justify-between">
                <span>₹{fmt(totalClaimed - totalApprovedSum)}</span>
                <ArrowUpRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block">
                Policy Deductions
              </span>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            DITTO HOME PAGE CRISP GEOMETRIC TOOLBAR ROW (CLEAR VISIBILITY)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 w-full flex-nowrap">
          {/* Left: Month, Year & Fetch Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap">
            {/* 1. Month Dropdown */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600">
              <Calendar className="w-3.5 h-3.5 text-accent-600 mr-1.5 shrink-0" />
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-full pr-5 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Select Month"
              >
                {MONTHS.slice(1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 2. Year Dropdown */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600">
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="h-full pr-5 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Select Year"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 3. Fetch Data Button (Clear High Contrast) */}
            <button
              onClick={fetchReport}
              disabled={loading}
              className="h-9 rounded-[4px] bg-[#4338CA] hover:bg-[#3730A3] text-white px-4 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-[#3730A3] disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Fetch Data</span>
            </button>
          </div>

          {/* Right: Search, Policy Master & Export Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap">
            {/* Search Input */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 shrink-0 transition-all focus-within:ring-1 focus-within:ring-accent-600 focus-within:border-accent-600 w-52 sm:w-64">
              <Search className="w-3.5 h-3.5 text-ink-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search engineer, code, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-full w-full text-xs font-medium text-ink-900 placeholder:text-ink-400 bg-transparent border-0 focus:outline-none leading-none"
              />
            </div>

            {/* Policy Master Button */}
            <button
              onClick={() => setShowPolicyPanel(!showPolicyPanel)}
              className="h-9 rounded-[4px] bg-white hover:bg-surface-sunken text-ink-900 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs border border-[#4f4f4f] hover:border-accent-600 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-accent-600" />
              <span>Policy Master</span>
              {showPolicyPanel ? <ChevronUp className="w-3.5 h-3.5 text-ink-500" /> : <ChevronDown className="w-3.5 h-3.5 text-ink-500" />}
            </button>

            {/* Excel Export Button (Clear High Contrast) */}
            <button
              onClick={downloadExcel}
              disabled={data.length === 0}
              className="h-9 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-emerald-700 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Export Excel</span>
            </button>

            {/* Sync Refresh Button */}
            <button
              onClick={fetchReport}
              disabled={loading}
              title="Refresh Report Data"
              className="w-9 h-9 rounded-[4px] border border-[#4f4f4f] bg-white flex items-center justify-center text-ink-700 hover:text-accent-600 hover:border-accent-600 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Policy Rules Collapsible Panel ── */}
        {showPolicyPanel && (
          <div className="rounded-[4px] border border-accent-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-accent-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-ink-900 font-mono">
                  Company Allowance Master & Policy Limits
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-ink-500">Grade:</label>
                <select
                  value={selectedPolicyGrade}
                  onChange={(e) => setSelectedPolicyGrade(e.target.value)}
                  className="rounded-[4px] border border-line bg-surface-sunken px-2.5 py-1 text-xs font-mono font-bold text-ink-900 focus:border-accent-600 focus:outline-none"
                >
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPolicy && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-[4px] border border-line bg-surface-sunken">
                  <span className="text-[9.5px] text-ink-400 block uppercase font-bold">DA (HQ / Normal)</span>
                  <span className="text-sm font-bold text-ink-900">₹{(selectedPolicy.daily_hq || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-ink-500 font-sans mt-0.5">Normal daily allowance</p>
                </div>
                <div className="p-2.5 rounded-[4px] border border-line bg-surface-sunken">
                  <span className="text-[9.5px] text-ink-400 block uppercase font-bold">DA (Hotel Stay)</span>
                  <span className="text-sm font-bold text-ink-900">₹{(selectedPolicy.daily_hotel || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-ink-500 font-sans mt-0.5">When hotel is claimed</p>
                </div>
                <div className="p-2.5 rounded-[4px] border border-line bg-surface-sunken">
                  <span className="text-[9.5px] text-ink-400 block uppercase font-bold">Bike Travel Rate</span>
                  <span className="text-sm font-bold text-ink-900">₹{(selectedPolicy.rate_bike || 4.5).toFixed(2)} / KM</span>
                  <p className="text-[9.5px] text-ink-500 font-sans mt-0.5">Two-wheeler rate</p>
                </div>
                <div className="p-2.5 rounded-[4px] border border-line bg-surface-sunken">
                  <span className="text-[9.5px] text-ink-400 block uppercase font-bold">Car Travel Rate</span>
                  <span className="text-sm font-bold text-ink-900">₹{(selectedPolicy.rate_car || 9.0).toFixed(2)} / KM</span>
                  <p className="text-[9.5px] text-ink-500 font-sans mt-0.5">Four-wheeler rate</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DITTO HIGH-DENSITY ZOHO TABLE (CLEAR READABLE HEADER & CONTRAST)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="rounded-[4px] border border-[#4f4f4f]/30 bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-line bg-[#1E1B4B] px-4 py-2.5 flex items-center justify-between text-white font-mono">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-accent-300" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                {month} {year} Consolidated Audit Ledger ({filteredData.length} Staff)
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-300 font-mono">
              Net Disbursement: ₹{fmt(totalNet)}
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-ink-500 font-bold text-xs">
                <RefreshCw className="h-4 w-4 animate-spin text-accent-600" />
                Loading consolidated ledger data...
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-20 text-ink-400 font-bold text-xs uppercase tracking-wider">
                No approved expense claims found for this period.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[2200px]">
                <thead>
                  <tr className="border-b border-line bg-[#F4F3F1] text-ink-800 text-[10.5px] font-mono uppercase font-bold">
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">#</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Submitted Date</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Copy Mode</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-accent-700">EE Code</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Grade</th>
                    <th className="py-2.5 px-2 border-r border-line text-left bg-[#F4F3F1] text-ink-700">Designation</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">CC</th>
                    <th className="py-2.5 px-2 border-r border-line text-left bg-[#F4F3F1] text-ink-900">Employee Name</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314101 Private Tr.</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314101 Public Tr.</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314102 DA</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314108 Spares</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314103 Courier</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314104 Hotel/Board</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314105 Print/Stat</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314106 Misc</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">5314107 Fuel</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-emerald-50 text-emerald-800 font-bold">Total Approved</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-rose-50 text-rose-800 font-bold">Advances</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-accent-50 text-accent-800 font-bold">Net Payable</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Status</th>
                    <th className="py-2.5 px-2 border-r border-line text-left min-w-[150px] bg-[#F4F3F1] text-ink-700">Reason for Deduction</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Month</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">Hold</th>
                    <th className="py-2.5 px-2 border-r border-line text-left bg-[#F4F3F1] text-ink-700">Remarks</th>
                    <th className="py-2.5 px-2 border-r border-line text-left bg-[#F4F3F1] text-ink-700">Manager</th>
                    <th className="py-2.5 px-2 border-r border-line text-center bg-[#F4F3F1] text-ink-700">State</th>
                    <th className="py-2.5 px-2 border-r border-line text-right bg-[#F4F3F1] text-ink-700">Total Claimed</th>
                    <th className="py-2.5 px-2 text-right bg-[#F4F3F1] text-ink-700">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {filteredData.map((r, idx) => {
                    const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
                    const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
                    const rowTotal =
                      privateTravel +
                      publicTravel +
                      (r.da_allowance || 0) +
                      (r.spare_purchase || 0) +
                      (r.courier_charges || 0) +
                      (r.boarding_lodging || 0) +
                      (r.printing_stationery || 0) +
                      (r.misc_expenses || 0);
                    const rowNet = rowTotal - (r.advance || 0);
                    const rowDiff = (r.claimed_amount || 0) - rowTotal;

                    return (
                      <tr key={idx} className="hover:bg-accent-50/30 transition-colors">
                        <td className="py-2 px-2 text-center text-ink-400 border-r border-line">{idx + 1}</td>
                        <td className="py-2 px-2 text-center border-r border-line text-ink-700">{r.submitted_date || "—"}</td>
                        <td className="py-2 px-2 text-center border-r border-line text-ink-600 font-sans">{r.mail_hard_copy || "Soft Copy"}</td>
                        <td className="py-2 px-2 text-center font-bold text-accent-700 bg-accent-50/40 border-r border-line">{r.ee_code}</td>
                        <td className="py-2 px-2 text-center border-r border-line text-ink-700">{r.grade || "—"}</td>
                        <td className="py-2 px-2 border-r border-line font-sans truncate max-w-[150px] text-ink-700" title={r.designation}>{r.designation || "—"}</td>
                        <td className="py-2 px-2 text-center border-r border-line text-ink-700">{r.cc || "—"}</td>
                        <td className="py-2 px-2 font-bold font-sans text-ink-900 border-r border-line">{r.ee_name || "—"}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(privateTravel)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(publicTravel)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.da_allowance)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.spare_purchase)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.courier_charges)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.boarding_lodging)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.printing_stationery)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">{fmt(r.misc_expenses)}</td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-400">0.00</td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold bg-emerald-50/40 text-emerald-800">{fmt(rowTotal)}</td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-rose-700 bg-rose-50/40">{fmt(r.advance)}</td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-accent-800 bg-accent-50/40">{fmt(rowNet)}</td>
                        <td className="py-2 px-2 text-center border-r border-line">
                          <span className="rounded-[3px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 uppercase">
                            Approved
                          </span>
                        </td>
                        <td className="py-2 px-2 border-r border-line font-sans text-ink-600 min-w-[150px] truncate" title={r.deduction_reason}>{r.deduction_reason || "—"}</td>
                        <td className="py-2 px-2 text-center border-r border-line font-bold text-accent-700">{r.month || "—"}</td>
                        <td className="py-2 px-2 text-center border-r border-line text-ink-500">{r.hold_reason || "No"}</td>
                        <td className="py-2 px-2 border-r border-line font-sans text-ink-600 truncate max-w-[150px]" title={r.remarks}>{r.remarks || "—"}</td>
                        <td className="py-2 px-2 border-r border-line font-sans font-bold text-ink-800 truncate max-w-[120px]" title={r.manager}>{r.manager || "—"}</td>
                        <td className="py-2 px-2 text-center border-r border-line font-sans text-ink-700">{r.state || "Rajasthan"}</td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-ink-800">{fmt(r.claimed_amount)}</td>
                        <td className="py-2 px-2 text-right font-bold text-rose-700 bg-rose-50/20">{fmt(rowDiff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-sunken border-t-2 border-line text-xs font-bold font-mono text-ink-900">
                    <td colSpan={8} className="py-2.5 px-2 border-r border-line text-center uppercase tracking-wider text-accent-900 font-sans">
                      Grand Total Summary
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + ((r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + ((r.auto_amount || 0) + (r.train_bus_amount || 0)), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.da_allowance || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.spare_purchase || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.courier_charges || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.boarding_lodging || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.printing_stationery || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.misc_expenses || 0), 0))}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">0.00</td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-emerald-800 bg-emerald-50/60">{fmt(totalApprovedSum)}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-rose-700 bg-rose-50/60">{fmt(totalAdvances)}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-accent-800 bg-accent-50/80">{fmt(totalNet)}</td>
                    <td colSpan={7} className="border-r border-line text-center text-ink-500 font-sans font-bold">{data.length} Staff Members</td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold">{fmt(totalClaimed)}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-rose-700 bg-rose-50/60">{fmt(totalClaimed - totalApprovedSum)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
