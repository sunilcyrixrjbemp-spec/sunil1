import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import {
  Calendar,
  Download,
  RefreshCw,
  Users,
  CheckCircle,
  IndianRupee,
  MapPin,
  Search,
  Filter,
  FileText,
  Loader2,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtN = (n: number) =>
  (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });

function numberToWords(num: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const n = Math.floor(num);
  if (n === 0) return "Zero";
  if (n < 20) return a[n];
  if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
  return numberToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numberToWords(n % 10000000) : "");
}

function amountWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = "Rupees " + numberToWords(rupees);
  if (paise > 0) words += " And " + numberToWords(paise) + " Paise";
  return words + " Only";
}

function getISTNow(): string {
  const d = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  };
  return d.toLocaleString("en-IN", opts).replace(",", "");
}

// ─── PDF generation ────────────────────────────────────────────────────────

function buildPrintHTML(row: any): string {
  const totalBike = row.bike_amount || 0;
  const totalCar = row.car_amount || 0;
  const totalKm = row.total_km || 0;
  const totalDA = row.da_amount || 0;
  const totalHotel = row.hotel_amount || 0;
  const totalAuto = row.auto_amount || 0;
  const totalLocal = row.local_purchase_amount || 0;
  const totalOther = row.other_amount || 0;
  const grandTotal = row.total_amount || 0;
  const now = getISTNow();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Expense Report — ${row.name} — ${row.month} ${row.year}</title>
  <style>
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;}
    body{font-family:'Arial',sans-serif;color:#000;background:#fff;margin:0;padding:8mm;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    td,th{border:1.5px solid #1a1a2e;padding:5px;vertical-align:middle;font-size:8pt;font-weight:500;word-wrap:break-word;}
    .hdr-main{background:#002b5e!important;color:#fff!important;text-align:center;font-size:13pt!important;font-weight:900!important;padding:10px 8px!important;letter-spacing:1px;border:2px solid #001a3e!important;}
    .hdr-sub{background:#1e40af!important;color:#fff!important;text-align:center;font-size:9pt!important;font-weight:800!important;padding:5px 8px!important;border:1.5px solid #1630a0!important;}
    .hdr-info{background:#f0f4ff!important;font-size:8.5pt!important;font-weight:700!important;padding:6px 8px!important;color:#001840!important;border:1.5px solid #1a1a2e!important;}
    .hdr-info-val{background:#f0f4ff!important;font-size:9pt!important;font-weight:800!important;color:#002b5e!important;padding:6px 8px!important;border:1.5px solid #1a1a2e!important;}
    .col-hdr{background:#1e3a8a!important;color:#fff!important;font-weight:800!important;font-size:7.5pt!important;text-align:center!important;padding:6px 3px!important;border:1.5px solid #162d70!important;line-height:1.3;}
    .data-row td{font-size:8pt!important;font-weight:600!important;color:#0a0a1a!important;padding:5px!important;border:1.2px solid #444!important;}
    .data-row:nth-child(even) td{background:#f7f9ff!important;}
    .data-row:nth-child(odd) td{background:#fff!important;}
    .total-row td{background:#fef3c7!important;font-weight:900!important;font-size:8.5pt!important;color:#78350f!important;border:1.5px solid #d97706!important;padding:6px 5px!important;}
    .total-row .grand{background:#d1fae5!important;color:#065f46!important;font-size:9.5pt!important;}
    .awords-row td{background:#eff6ff!important;font-size:8pt!important;font-weight:700!important;font-style:italic;color:#1e3a8a!important;border:1.2px solid #93c5fd!important;padding:5px 8px!important;}
    .net-row td{background:#dcfce7!important;font-size:9.5pt!important;font-weight:900!important;color:#14532d!important;border:2px solid #16a34a!important;padding:6px 8px!important;}
    .approved-strip td{background:#002b5e!important;color:#fff!important;font-weight:900!important;text-align:center;font-size:9pt!important;letter-spacing:0.5px;padding:7px 8px!important;border:2px solid #001a3e!important;}
    .sig-hdr td{background:#1e3a8a!important;color:#fff!important;font-weight:800!important;font-size:8pt!important;text-align:center;padding:5px 8px!important;border:1.5px solid #162d70!important;}
    .sig-cell{text-align:center;vertical-align:top;padding:8px!important;background:linear-gradient(to bottom,#fafafa 0%,#f5f5f5 100%)!important;border:1.5px solid #333!important;min-height:90px;position:relative;}
    .sig-cell .sig-title{font-size:7.5pt;font-weight:900;color:#059669;margin-bottom:32px;margin-top:10px;letter-spacing:0.4px;}
    .sig-cell .sig-line{border-top:1.5px solid #333;margin:0 6px;}
    .sig-cell .sig-name{font-size:7.5pt;font-weight:800;color:#000;margin-top:3px;line-height:1.2;}
    .sig-cell .sig-date{font-size:6.5pt;color:#555;margin-top:2px;font-weight:600;}
    .tc{text-align:center!important;}.tr{text-align:right!important;}.tl{text-align:left!important;}
    @page{size:A4 landscape;margin:7mm 8mm 7mm 8mm;}
  </style>
</head>
<body>
<div style="font-family:'Arial',sans-serif;color:#000;width:100%;background:#fff;font-size:9pt;line-height:1.35;">

  <!-- HEADER -->
  <table style="margin-bottom:0;">
    <tr><td colspan="12" class="hdr-main">CYRIX HEALTHCARE — MONTHLY EXPENSE REIMBURSEMENT FORM</td></tr>
    <tr><td colspan="12" class="hdr-sub">${row.month.toUpperCase()} ${row.year} &nbsp;|&nbsp; APPROVED EXPENSES SUMMARY</td></tr>
  </table>

  <!-- EMPLOYEE INFO -->
  <table style="margin-bottom:8px;">
    <tr>
      <td class="hdr-info" style="width:13%">Employee Name</td>
      <td class="hdr-info-val" style="width:22%">${row.name}</td>
      <td class="hdr-info" style="width:10%">E-Code</td>
      <td class="hdr-info-val" style="width:12%">${row.e_code}</td>
      <td class="hdr-info" style="width:10%">Grade</td>
      <td class="hdr-info-val" style="width:10%">${row.grade || "—"}</td>
      <td class="hdr-info" style="width:10%">Month</td>
      <td class="hdr-info-val" style="width:13%">${row.month} ${row.year}</td>
    </tr>
    <tr>
      <td class="hdr-info">Designation</td>
      <td class="hdr-info-val">${row.designation}</td>
      <td class="hdr-info">District</td>
      <td class="hdr-info-val">${row.district}</td>
      <td class="hdr-info">Zone</td>
      <td class="hdr-info-val">${row.zone || "—"}</td>
      <td class="hdr-info">Claims</td>
      <td class="hdr-info-val">${row.claims_count} Claim(s)</td>
    </tr>
  </table>

  <!-- EXPENSE BREAKDOWN TABLE -->
  <table>
    <thead>
      <tr>
        <th class="col-hdr" style="width:5%">#</th>
        <th class="col-hdr" style="width:22%">Expense Head</th>
        <th class="col-hdr" style="width:15%">Details / KM</th>
        <th class="col-hdr" style="width:12%">Amount (₹)</th>
        <th class="col-hdr" style="width:46%">Remarks</th>
      </tr>
    </thead>
    <tbody>
      <tr class="data-row">
        <td class="tc">1</td>
        <td>Daily Allowance (DA)</td>
        <td class="tc">—</td>
        <td class="tr">${(totalDA).toFixed(2)}</td>
        <td>As per entitlement grade &amp; approved travel days</td>
      </tr>
      <tr class="data-row">
        <td class="tc">2</td>
        <td>Bike / Two-Wheeler Travel</td>
        <td class="tc">${fmtN(totalKm)} KM</td>
        <td class="tr">${(totalBike).toFixed(2)}</td>
        <td>Mileage reimbursement at approved rate per KM</td>
      </tr>
      <tr class="data-row">
        <td class="tc">3</td>
        <td>Car / Four-Wheeler Travel</td>
        <td class="tc">—</td>
        <td class="tr">${(totalCar).toFixed(2)}</td>
        <td>Car travel reimbursement as per approved claim</td>
      </tr>
      <tr class="data-row">
        <td class="tc">4</td>
        <td>Auto / Local Conveyance</td>
        <td class="tc">—</td>
        <td class="tr">${(totalAuto).toFixed(2)}</td>
        <td>Auto/taxi/local conveyance charges</td>
      </tr>
      <tr class="data-row">
        <td class="tc">5</td>
        <td>Hotel / Accommodation</td>
        <td class="tc">—</td>
        <td class="tr">${(totalHotel).toFixed(2)}</td>
        <td>Lodging as per approved rate and receipts</td>
      </tr>
      <tr class="data-row">
        <td class="tc">6</td>
        <td>Local Purchase</td>
        <td class="tc">—</td>
        <td class="tr">${(totalLocal).toFixed(2)}</td>
        <td>Consumables/spare purchases with bills</td>
      </tr>
      <tr class="data-row">
        <td class="tc">7</td>
        <td>Other Expenses</td>
        <td class="tc">—</td>
        <td class="tr">${(totalOther).toFixed(2)}</td>
        <td>Miscellaneous approved expenses with supporting documents</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" class="tl" style="font-weight:900;">TOTAL (${row.claims_count} Approved Claim Days)</td>
        <td class="tr grand" style="font-size:10pt!important;">₹${(grandTotal).toFixed(2)}</td>
        <td class="tc">Total KM: ${fmtN(totalKm)} km</td>
      </tr>
    </tfoot>
  </table>

  <!-- AMOUNT IN WORDS -->
  <table style="margin-top:4px;">
    <tr class="awords-row">
      <td colspan="5">Amount in Words: <strong>${amountWords(grandTotal)}</strong></td>
    </tr>
  </table>

  <!-- NET PAYABLE -->
  <table style="margin-top:4px;">
    <tr class="net-row">
      <td colspan="3" class="tl">NET PAYABLE AMOUNT &nbsp;(${row.month} ${row.year})</td>
      <td class="tr" style="width:18%;">₹ ${(grandTotal).toFixed(2)}</td>
      <td class="tc" style="width:20%;font-size:8pt!important;color:#065f46!important;">Generated: ${now}</td>
    </tr>
  </table>

  <!-- APPROVED STRIP -->
  <table style="margin-top:8px;">
    <tr class="approved-strip">
      <td colspan="5">✓ APPROVED &nbsp;—&nbsp; All ${row.claims_count} expense claim(s) for ${row.month} ${row.year} have been reviewed and approved by the designated authority.</td>
    </tr>
  </table>

  <!-- SIGNATURES -->
  <table style="margin-top:8px;border:2px solid #1a1a2e!important;">
    <tr class="sig-hdr">
      <td>CLAIMED BY</td>
      <td>APPROVED BY</td>
      <td>CHECKED BY</td>
      <td>ACCOUNTED BY</td>
    </tr>
    <tr>
      <td class="sig-cell" style="height:90px;">
        <div class="sig-title">Employee Signature</div>
        <div class="sig-line"></div>
        <div class="sig-name">${row.name}</div>
        <div class="sig-date">${row.e_code} &nbsp;|&nbsp; ${row.district}</div>
      </td>
      <td class="sig-cell">
        <div class="sig-title">Manager / L1 Approver</div>
        <div class="sig-line"></div>
        <div class="sig-name">${row.manager || "Authorised Signatory"}</div>
        <div class="sig-date">Designation: Approving Manager</div>
      </td>
      <td class="sig-cell">
        <div class="sig-title">Finance / Accounts Check</div>
        <div class="sig-line"></div>
        <div class="sig-name">Verified By Accounts</div>
        <div class="sig-date">Verification Date: ___________</div>
      </td>
      <td class="sig-cell">
        <div class="sig-title">Accounts Entry</div>
        <div class="sig-line"></div>
        <div class="sig-name">Amit Rawat</div>
        <div class="sig-date">Accounts Department</div>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;
}

function downloadPDF(row: any) {
  const html = buildPrintHTML(row);
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    toast.error("Please allow popups to generate PDF");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 400);
  };
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function MonthSummaryPage() {
  const [data, setData] = useState<any[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Filters
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(MONTHS[currentDate.getMonth() + 1]);
  const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");

  // Applied filters (only refreshed on search click)
  const [appliedFilters, setAppliedFilters] = useState({
    month: MONTHS[currentDate.getMonth() + 1],
    year: currentDate.getFullYear(),
    district: "",
    engineer: "",
  });

  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchData(appliedFilters);
  }, []);

  const fetchData = async (filters: typeof appliedFilters) => {
    setLoading(true);
    try {
      const res = await expenseService.getMonthSummary({
        month: filters.month || undefined,
        year: filters.year || undefined,
        district: filters.district || undefined,
        engineer: filters.engineer || undefined,
      });
      setData(res.data || []);
      if (res.districts?.length) setDistricts(res.districts);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load month summary");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const f = {
      month: filterMonth,
      year: filterYear,
      district: filterDistrict,
      engineer: filterEngineer,
    };
    setAppliedFilters(f);
    fetchData(f);
  };

  const handleClear = () => {
    const f = { month: "", year: 0, district: "", engineer: "" };
    setFilterMonth("");
    setFilterYear(0);
    setFilterDistrict("");
    setFilterEngineer("");
    setSearch("");
    setAppliedFilters(f);
    fetchData(f);
  };

  // Local search filter on top of server data
  const filtered = data.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.e_code || "").toLowerCase().includes(q) ||
      (r.district || "").toLowerCase().includes(q) ||
      (r.grade || "").toLowerCase().includes(q) ||
      (r.month || "").toLowerCase().includes(q)
    );
  });

  // Stats
  const totalEngineers = filtered.length;
  const totalClaims = filtered.reduce((s, r) => s + (r.claims_count || 0), 0);
  const totalAmount = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalKM = filtered.reduce((s, r) => s + (r.total_km || 0), 0);

  const statCards = [
    { label: "Engineers", value: totalEngineers, icon: <Users className="w-5 h-5" />, color: "bg-blue-50 text-blue-600" },
    { label: "Total Claims", value: totalClaims, icon: <CheckCircle className="w-5 h-5" />, color: "bg-green-50 text-green-600" },
    { label: "Total Amount", value: fmt(totalAmount), icon: <IndianRupee className="w-5 h-5" />, color: "bg-amber-50 text-amber-600" },
    { label: "Total KM", value: fmtN(totalKM) + " km", icon: <MapPin className="w-5 h-5" />, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-5 animate-fadeIn text-[#212529]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Month Summary</h2>
          <p className="text-gray-500 text-xs mt-1">
            Engineer-wise approved expenses — filter by month, district &amp; generate individual PDFs.
          </p>
        </div>
        <button
          onClick={() => fetchData(appliedFilters)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Months</option>
              {MONTHS.slice(1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Year</label>
            <select
              value={filterYear || ""}
              onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">District</label>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Engineer / E-Code</label>
            <input
              type="text"
              value={filterEngineer}
              onChange={(e) => setFilterEngineer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              placeholder="Search name or code..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Apply Filters
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 border border-gray-200 bg-white text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-gray-800 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
              {appliedFilters.month && appliedFilters.year
                ? `${appliedFilters.month} ${appliedFilters.year}`
                : appliedFilters.month || appliedFilters.year
                ? `${appliedFilters.month || ""} ${appliedFilters.year || ""}`.trim()
                : "All Months"}
              {" · "}
              <span className="text-blue-600">{filtered.length} engineers</span>
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in results..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:border-blue-500 w-52"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading data...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold text-sm">No approved expenses found</p>
              <p className="text-gray-300 text-xs mt-1">
                Try adjusting filters or check if claims have been approved
              </p>
            </div>
          ) : (
            <table className="w-full text-left table-auto min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase font-bold tracking-wider text-gray-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">E-Code</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Claims</th>
                  <th className="py-3 px-4">DA</th>
                  <th className="py-3 px-4">Bike</th>
                  <th className="py-3 px-4">Auto</th>
                  <th className="py-3 px-4">Hotel</th>
                  <th className="py-3 px-4">KM</th>
                  <th className="py-3 px-4 text-green-700">Total Amount</th>
                  <th className="py-3 px-4 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, idx) => (
                  <tr
                    key={`${row.user_id}-${row.month}-${row.year}`}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td className="py-3 px-4 text-gray-400 text-xs font-bold">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{row.designation}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {row.e_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">{row.grade || "—"}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">{row.district || "—"}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {row.month} {row.year}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-gray-700">{row.claims_count}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                      {row.da_amount > 0 ? fmt(row.da_amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                      {row.bike_amount > 0 ? fmt(row.bike_amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                      {row.auto_amount > 0 ? fmt(row.auto_amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                      {row.hotel_amount > 0 ? fmt(row.hotel_amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                      {row.total_km > 0 ? <>{fmtN(row.total_km)} km</> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-green-700">{fmt(row.total_amount)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          toast.success(`Generating PDF for ${row.name}...`);
                          downloadPDF(row);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 hover:border-red-500 text-[11px] font-bold transition-all cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals row */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td colSpan={6} className="py-3 px-4 text-xs font-bold text-amber-800 uppercase tracking-wide">
                      Grand Total ({filtered.length} Engineers)
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-800">{totalClaims}</td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.da_amount, 0))}</td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.bike_amount, 0))}</td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.auto_amount, 0))}</td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.hotel_amount, 0))}</td>
                    <td className="py-3 px-4 text-xs font-bold text-amber-700">{fmtN(totalKM)} km</td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-green-700">{fmt(totalAmount)}</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
