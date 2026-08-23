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
      {/* ── Page Header Banner ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-ink-900 tracking-tight font-display">
                    Consolidated Expense MIS Report
                  </h1>
                  <span className="rounded-md bg-accent-50 border border-accent-200 px-2 py-0.5 text-[11px] font-mono font-bold text-accent-700">
                    {month} {year}
                  </span>
                </div>
                <p className="text-xs text-ink-500 hidden sm:block">
                  Company-wide audited expense ledger, GL code breakdown & net payables
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={downloadExcel}
                disabled={data.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel (.xlsx)
              </button>

              <button
                onClick={fetchReport}
                disabled={loading}
                title="Refresh Report Data"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink-700 hover:bg-surface-sunken hover:text-ink-900 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-accent-600" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ── KPI Financial Stat Cards (Zoho Style) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-1">
            <span className="text-[11px] font-mono font-bold text-ink-500 uppercase tracking-wider block">
              Total Headcount
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-ink-900">{data.length}</span>
              <span className="text-xs text-ink-400 font-mono">Engineers</span>
            </div>
            <p className="text-[11px] text-accent-700 font-mono">100% Processed</p>
          </div>

          <div className="rounded-xl border border-line bg-white p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-1">
            <span className="text-[11px] font-mono font-bold text-ink-500 uppercase tracking-wider block">
              Total Approved
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-emerald-700">₹{fmt(totalApprovedSum)}</span>
            </div>
            <p className="text-[11px] text-ink-400 font-mono">Audited Claims</p>
          </div>

          <div className="rounded-xl border border-line bg-white p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-1">
            <span className="text-[11px] font-mono font-bold text-ink-500 uppercase tracking-wider block">
              Advances Deducted
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-rose-700">₹{fmt(totalAdvances)}</span>
            </div>
            <p className="text-[11px] text-rose-500 font-mono">Pre-paid amounts</p>
          </div>

          <div className="rounded-xl border border-accent-200 bg-accent-50/40 p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-1">
            <span className="text-[11px] font-mono font-bold text-accent-800 uppercase tracking-wider block">
              Net Payable (Disbursement)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-accent-900">₹{fmt(totalNet)}</span>
            </div>
            <p className="text-[11px] text-accent-700 font-mono font-bold">Final Bank Transfer</p>
          </div>

          <div className="rounded-xl border border-line bg-white p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-1 col-span-2 lg:col-span-1">
            <span className="text-[11px] font-mono font-bold text-ink-500 uppercase tracking-wider block">
              Claimed Difference
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-rose-700">₹{fmt(totalClaimed - totalApprovedSum)}</span>
            </div>
            <p className="text-[11px] text-ink-400 font-mono">Policy Deductions</p>
          </div>
        </div>

        {/* ── Filter & Search Toolbar ── */}
        <div className="rounded-xl border border-line bg-white p-4 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent-600" />
              <label className="text-xs font-mono font-bold text-ink-700 uppercase tracking-wider">Billing Period:</label>
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-xs font-mono font-bold text-ink-900 shadow-2xs focus:border-accent-600 focus:outline-none cursor-pointer"
            >
              {MONTHS.slice(1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-xs font-mono font-bold text-ink-900 shadow-2xs focus:border-accent-600 focus:outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" />
              Fetch Data
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Search engineer, code, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-sunken pl-8 pr-3 py-1.5 text-xs font-sans text-ink-900 placeholder:text-ink-300 focus:border-accent-600 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowPolicyPanel(!showPolicyPanel)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white hover:bg-surface-sunken px-3 py-1.5 text-xs font-bold text-ink-700 shadow-2xs transition-all cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-accent-600" />
              Policy Master
              {showPolicyPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Policy Rules Collapsible Panel ── */}
        {showPolicyPanel && (
          <div className="rounded-xl border border-accent-200 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-line pb-3">
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
                  className="rounded-lg border border-line bg-surface-sunken px-2.5 py-1 text-xs font-mono font-bold text-ink-900 focus:border-accent-600 focus:outline-none"
                >
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPolicy && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-line bg-surface-sunken">
                  <span className="text-[10px] text-ink-400 block uppercase font-bold">DA (HQ / Normal)</span>
                  <span className="text-sm font-black text-ink-900">₹{(selectedPolicy.daily_hq || 0).toFixed(2)}</span>
                  <p className="text-[10px] text-ink-500 font-sans mt-0.5">Normal daily working allowance</p>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface-sunken">
                  <span className="text-[10px] text-ink-400 block uppercase font-bold">DA (Hotel Stay)</span>
                  <span className="text-sm font-black text-ink-900">₹{(selectedPolicy.daily_hotel || 0).toFixed(2)}</span>
                  <p className="text-[10px] text-ink-500 font-sans mt-0.5">When hotel stay is claimed</p>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface-sunken">
                  <span className="text-[10px] text-ink-400 block uppercase font-bold">Bike Travel Rate</span>
                  <span className="text-sm font-black text-ink-900">₹{(selectedPolicy.rate_bike || 4.5).toFixed(2)} / KM</span>
                  <p className="text-[10px] text-ink-500 font-sans mt-0.5">Two-wheeler reimbursement</p>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface-sunken">
                  <span className="text-[10px] text-ink-400 block uppercase font-bold">Car Travel Rate</span>
                  <span className="text-sm font-black text-ink-900">₹{(selectedPolicy.rate_car || 9.0).toFixed(2)} / KM</span>
                  <p className="text-[10px] text-ink-500 font-sans mt-0.5">Four-wheeler reimbursement</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── High-Density Zoho Consolidated Data Grid ── */}
        <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
          <div className="border-b border-line bg-[#1E1B4B] px-5 py-3.5 flex items-center justify-between text-white font-mono">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-accent-300" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                {month} {year} Consolidated Audit Ledger ({filteredData.length} Staff)
              </h2>
            </div>
            <span className="text-xs font-bold text-accent-200 font-mono">
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
                  <tr className="border-b border-line bg-[#1E1B4B] text-white text-[11px] font-mono">
                    <th className="py-3 px-2 border-r border-white/10 text-center">#</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Submitted Date</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Copy Mode</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">EE Code</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Grade</th>
                    <th className="py-3 px-2 border-r border-white/10 text-left">Designation</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">CC</th>
                    <th className="py-3 px-2 border-r border-white/10 text-left">Employee Name</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314101 Private Tr.</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314101 Public Tr.</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314102 DA</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314108 Spares</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314103 Courier</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314104 Hotel/Board</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314105 Print/Stat</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314106 Misc</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">5314107 Fuel</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right bg-accent-950 text-emerald-300 font-bold">Total Approved</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right bg-rose-950 text-rose-300 font-bold">Advances</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right bg-emerald-950 text-emerald-300 font-bold">Net Payable</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Status</th>
                    <th className="py-3 px-2 border-r border-white/10 text-left min-w-[150px]">Reason for Deduction</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Month</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">Hold</th>
                    <th className="py-3 px-2 border-r border-white/10 text-left">Remarks</th>
                    <th className="py-3 px-2 border-r border-white/10 text-left">Manager</th>
                    <th className="py-3 px-2 border-r border-white/10 text-center">State</th>
                    <th className="py-3 px-2 border-r border-white/10 text-right">Total Claimed</th>
                    <th className="py-3 px-2 text-right">Difference</th>
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
                      <tr key={idx} className="hover:bg-surface-sunken/40 transition-colors">
                        <td className="py-2.5 px-2 text-center text-ink-400 border-r border-line">{idx + 1}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line">{r.submitted_date || "—"}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line text-ink-600 font-sans">{r.mail_hard_copy || "Soft Copy"}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-accent-700 bg-accent-50/30 border-r border-line">{r.ee_code}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line">{r.grade || "—"}</td>
                        <td className="py-2.5 px-2 border-r border-line font-sans truncate max-w-[150px]" title={r.designation}>{r.designation || "—"}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line">{r.cc || "—"}</td>
                        <td className="py-2.5 px-2 font-bold font-sans text-ink-900 border-r border-line">{r.ee_name || "—"}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(privateTravel)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(publicTravel)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.da_allowance)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.spare_purchase)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.courier_charges)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.boarding_lodging)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.printing_stationery)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line">{fmt(r.misc_expenses)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line text-ink-400">0.00</td>
                        <td className="py-2.5 px-2 text-right border-r border-line font-black bg-surface-sunken text-ink-900">{fmt(rowTotal)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line font-black text-rose-700 bg-rose-50/40">{fmt(r.advance)}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line font-black text-emerald-700 bg-emerald-50/40">{fmt(rowNet)}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line">
                          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                            Approved
                          </span>
                        </td>
                        <td className="py-2.5 px-2 border-r border-line font-sans text-ink-600 min-w-[150px] truncate" title={r.deduction_reason}>{r.deduction_reason || "—"}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line font-bold text-accent-700">{r.month || "—"}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line text-ink-500">{r.hold_reason || "No"}</td>
                        <td className="py-2.5 px-2 border-r border-line font-sans text-ink-600 truncate max-w-[150px]" title={r.remarks}>{r.remarks || "—"}</td>
                        <td className="py-2.5 px-2 border-r border-line font-sans font-bold text-ink-800 truncate max-w-[120px]" title={r.manager}>{r.manager || "—"}</td>
                        <td className="py-2.5 px-2 text-center border-r border-line font-sans">{r.state || "Rajasthan"}</td>
                        <td className="py-2.5 px-2 text-right border-r border-line font-bold">{fmt(r.claimed_amount)}</td>
                        <td className="py-2.5 px-2 text-right font-black text-rose-700 bg-rose-50/20">{fmt(rowDiff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-sunken border-t-2 border-line text-xs font-black font-mono text-ink-900">
                    <td colSpan={8} className="py-3 px-2 border-r border-line text-center uppercase tracking-wider text-accent-900 font-sans">
                      Grand Total Summary
                    </td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + ((r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + ((r.auto_amount || 0) + (r.train_bus_amount || 0)), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.da_allowance || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.spare_purchase || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.courier_charges || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.boarding_lodging || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.printing_stationery || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">{fmt(data.reduce((s, r) => s + (r.misc_expenses || 0), 0))}</td>
                    <td className="py-3 px-2 text-right border-r border-line">0.00</td>
                    <td className="py-3 px-2 text-right border-r border-line font-black text-ink-900 bg-surface-sunken">{fmt(totalApprovedSum)}</td>
                    <td className="py-3 px-2 text-right border-r border-line font-black text-rose-700 bg-rose-50/60">{fmt(totalAdvances)}</td>
                    <td className="py-3 px-2 text-right border-r border-line font-black text-emerald-700 bg-emerald-50/80">{fmt(totalNet)}</td>
                    <td colSpan={7} className="border-r border-line text-center text-ink-500 font-sans font-bold">{data.length} Staff Members</td>
                    <td className="py-3 px-2 text-right border-r border-line font-bold">{fmt(totalClaimed)}</td>
                    <td className="py-3 px-2 text-right font-black text-rose-700 bg-rose-50/60">{fmt(totalClaimed - totalApprovedSum)}</td>
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
