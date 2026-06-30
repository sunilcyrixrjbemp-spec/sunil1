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

const fmtN = (n: number, dec = 1) =>
  (n || 0).toLocaleString("en-IN", { maximumFractionDigits: dec });

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
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
function fmtDate(d: string): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

// ─── EXACT PDF HTML matching provided template ──────────────────────────────

function buildDetailedPrintHTML(user: any, claims: any[]): string {
  const now = getISTNow();

  // Flatten: one row per leg across all claims
  const allLegs: { date: string; expCode: string; leg: any }[] = [];
  for (const claim of claims) {
    for (const leg of claim.legs) {
      allLegs.push({ date: claim.date, expCode: claim.expense_code, leg });
    }
  }

  // Grand totals
  const grandDA     = allLegs.reduce((s, r) => s + (r.leg.da_amount || 0), 0);
  const grandBikeKm = allLegs.reduce((s, r) => s + (r.leg.bike_km || 0), 0);
  const grandBike   = allLegs.reduce((s, r) => s + (r.leg.bike_amount || 0), 0);
  const grandCarKm  = allLegs.reduce((s, r) => s + (r.leg.car_km || 0), 0);
  const grandCar    = allLegs.reduce((s, r) => s + (r.leg.car_amount || 0), 0);
  const grandAuto   = allLegs.reduce((s, r) => s + (r.leg.auto_amount || 0), 0);
  const grandHotel  = allLegs.reduce((s, r) => s + (r.leg.hotel_amount || 0), 0);
  const grandLocal  = allLegs.reduce((s, r) => s + (r.leg.local_purchase || 0), 0);
  const grandOther  = allLegs.reduce((s, r) => s + (r.leg.other_amount || 0), 0);
  const grandTotal  = grandDA + grandBike + grandCar + grandAuto + grandHotel + grandLocal + grandOther;
  const grandKm     = grandBikeKm + grandCarKm;

  const dataRows = allLegs.map((r, i) => {
    const l = r.leg;
    const rowTotal = (l.da_amount||0)+(l.bike_amount||0)+(l.car_amount||0)+(l.auto_amount||0)+(l.hotel_amount||0)+(l.local_purchase||0)+(l.other_amount||0);
    const bg = i % 2 === 0 ? "background:#fff!important;" : "background:#f7f9ff!important;";
    const km = l.distance_km > 0 ? `${l.distance_km.toFixed(1)} km` : "—";
    return `<tr style="${bg}">
      <td style="text-align:center;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${i + 1}</td>
      <td style="font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${fmtDate(r.date)}</td>
      <td style="font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.from_location}</td>
      <td style="font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.to_location}</td>
      <td style="text-align:center;font-size:7.5pt;font-weight:700;border:1.2px solid #444;padding:4px 3px;">${l.travel_mode}</td>
      <td style="text-align:center;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${km}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.da_amount > 0 ? l.da_amount.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.bike_amount > 0 ? l.bike_amount.toFixed(2) : (l.car_amount > 0 ? l.car_amount.toFixed(2) : "—")}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.auto_amount > 0 ? l.auto_amount.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.hotel_amount > 0 ? l.hotel_amount.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.local_purchase > 0 ? l.local_purchase.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:600;border:1.2px solid #444;padding:4px 3px;">${l.other_amount > 0 ? l.other_amount.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-size:7.5pt;font-weight:800;background:#eff6ff!important;border:1.2px solid #444;padding:4px 3px;">${rowTotal.toFixed(2)}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Expense Report — ${user.name} — ${user.month} ${user.year}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Arial',sans-serif;color:#000;background:#fff;}
    .cyrix-form{font-family:'Arial',sans-serif;color:#000;width:100%;background:#fff;font-size:9pt;line-height:1.35;}
    .cyrix-form *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;}
    .cyrix-form table{width:100%;border-collapse:collapse;table-layout:fixed;}
    .cyrix-form td,.cyrix-form th{border:1.5px solid #1a1a2e;padding:5px 5px;vertical-align:middle;font-size:8pt;font-weight:500;color:#000;word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;}
    .hdr-main{background:#002b5e!important;color:#fff!important;text-align:center;font-size:13pt!important;font-weight:900!important;padding:10px 8px!important;letter-spacing:1px;border:2px solid #001a3e!important;}
    .hdr-sub{background:#1e40af!important;color:#fff!important;text-align:center;font-size:9pt!important;font-weight:800!important;padding:5px 8px!important;border:1.5px solid #1630a0!important;}
    .hdr-info{background:#f0f4ff!important;font-size:8.5pt!important;font-weight:700!important;padding:6px 8px!important;color:#001840!important;border:1.5px solid #1a1a2e!important;}
    .hdr-info-val{background:#f0f4ff!important;font-size:9pt!important;font-weight:800!important;color:#002b5e!important;padding:6px 8px!important;border:1.5px solid #1a1a2e!important;}
    .col-hdr{background:#1e3a8a!important;color:#fff!important;font-weight:800!important;font-size:7.5pt!important;text-align:center!important;padding:6px 3px!important;border:1.5px solid #162d70!important;line-height:1.3;}
    .total-row td{background:#fef3c7!important;font-weight:900!important;font-size:8.5pt!important;color:#78350f!important;border:1.5px solid #d97706!important;padding:6px 5px!important;}
    .total-row .grand{background:#d1fae5!important;color:#065f46!important;font-size:9.5pt!important;}
    .awords-row td{background:#eff6ff!important;font-size:8pt!important;font-weight:700!important;font-style:italic;color:#1e3a8a!important;border:1.2px solid #93c5fd!important;padding:5px 8px!important;}
    .net-row td{background:#dcfce7!important;font-size:9.5pt!important;font-weight:900!important;color:#14532d!important;border:2px solid #16a34a!important;padding:6px 8px!important;}
    .approved-strip td{background:#002b5e!important;color:#fff!important;font-weight:900!important;text-align:center;font-size:9pt!important;letter-spacing:0.5px;padding:7px 8px!important;border:2px solid #001a3e!important;}
    .sig-section table{border:2px solid #1a1a2e!important;}
    .sig-hdr td{background:#1e3a8a!important;color:#fff!important;font-weight:800!important;font-size:8pt!important;text-align:center;padding:5px 8px!important;border:1.5px solid #162d70!important;}
    .sig-cell{text-align:center;vertical-align:top;padding:8px!important;background:linear-gradient(to bottom,#fafafa 0%,#f5f5f5 100%)!important;border:1.5px solid #333!important;min-height:90px;position:relative;}
    .sig-cell:nth-child(1)::before{content:'✎';position:absolute;top:12px;right:8px;font-size:28pt;color:#059669;font-weight:bold;}
    .sig-cell:nth-child(2)::before{content:'✓';position:absolute;top:12px;right:8px;font-size:28pt;color:#059669;font-weight:bold;}
    .sig-cell:nth-child(3)::before{content:'✔';position:absolute;top:12px;right:8px;font-size:28pt;color:#059669;font-weight:bold;}
    .sig-cell:nth-child(4)::before{content:'📋';position:absolute;top:12px;right:8px;font-size:26pt;}
    .sig-cell .sig-title{font-size:7.5pt;font-weight:900;color:#059669;margin-bottom:32px;margin-top:10px;letter-spacing:0.4px;padding-right:28px;}
    .sig-cell .sig-line{border-top:1.5px solid #333;margin:0 6px;}
    .sig-cell .sig-name{font-size:7.5pt;font-weight:800;color:#000;margin-top:3px;line-height:1.2;}
    .sig-cell .sig-date{font-size:6.5pt;color:#555;margin-top:2px;font-weight:600;}
    .tc{text-align:center!important;} .tr{text-align:right!important;} .tl{text-align:left!important;}
    .fw9{font-weight:900!important;} .fw8{font-weight:800!important;}
    @page{size:A4 landscape;margin:7mm 8mm 7mm 8mm;}
    @media print{body,html{margin:0;padding:0;background:white;}}
  </style>
</head>
<body>
<div class="cyrix-form" style="padding:4mm;">

  <!-- ── HEADER ── -->
  <table style="margin-bottom:0;">
    <tr><td colspan="14" class="hdr-main">CYRIX HEALTHCARE — MONTHLY EXPENSE REIMBURSEMENT FORM</td></tr>
    <tr><td colspan="14" class="hdr-sub">${user.month.toUpperCase()} ${user.year} &nbsp;|&nbsp; TRAVEL &amp; FIELD EXPENSE CLAIM STATEMENT — APPROVED</td></tr>
  </table>

  <!-- ── EMPLOYEE INFO ── -->
  <table style="margin-bottom:2px;">
    <colgroup>
      <col style="width:13%;"><col style="width:20%;"><col style="width:9%;"><col style="width:10%;">
      <col style="width:9%;"><col style="width:10%;"><col style="width:9%;"><col style="width:20%;">
    </colgroup>
    <tr>
      <td class="hdr-info">Employee Name</td>
      <td class="hdr-info-val fw9">${user.name}</td>
      <td class="hdr-info">E-Code</td>
      <td class="hdr-info-val">${user.e_code}</td>
      <td class="hdr-info">Grade</td>
      <td class="hdr-info-val">${user.grade || "—"}</td>
      <td class="hdr-info">Month / Year</td>
      <td class="hdr-info-val fw9">${user.month} ${user.year}</td>
    </tr>
    <tr>
      <td class="hdr-info">Designation</td>
      <td class="hdr-info-val">${user.designation}</td>
      <td class="hdr-info">District</td>
      <td class="hdr-info-val">${user.district}</td>
      <td class="hdr-info">Zone</td>
      <td class="hdr-info-val">${user.zone || "—"}</td>
      <td class="hdr-info">Total Claims</td>
      <td class="hdr-info-val">${claims.length} Claim Day(s) &nbsp;|&nbsp; ${allLegs.length} Leg(s)</td>
    </tr>
  </table>

  <!-- ── DETAILED EXPENSE TABLE ── -->
  <table style="margin-bottom:2px;">
    <colgroup>
      <col style="width:3%;"><col style="width:7%;"><col style="width:11%;"><col style="width:11%;">
      <col style="width:5%;"><col style="width:5%;"><col style="width:6%;"><col style="width:7%;">
      <col style="width:6%;"><col style="width:6%;"><col style="width:7%;"><col style="width:7%;"><col style="width:7%;">
    </colgroup>
    <thead>
      <tr>
        <th class="col-hdr">#</th>
        <th class="col-hdr">Date</th>
        <th class="col-hdr">From (Origin)</th>
        <th class="col-hdr">To (Destination)</th>
        <th class="col-hdr">Travel Mode</th>
        <th class="col-hdr">KM</th>
        <th class="col-hdr">DA (₹)</th>
        <th class="col-hdr">Bike / Car (₹)</th>
        <th class="col-hdr">Auto (₹)</th>
        <th class="col-hdr">Hotel (₹)</th>
        <th class="col-hdr">Local Purchase (₹)</th>
        <th class="col-hdr">Other (₹)</th>
        <th class="col-hdr">Row Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows || `<tr><td colspan="13" style="text-align:center;padding:12px;color:#888;font-style:italic;">No individual leg data available</td></tr>`}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" class="tl fw9">TOTAL &nbsp;(${claims.length} days · ${allLegs.length} legs · ${fmtN(grandKm)} KM)</td>
        <td class="tc fw9">${fmtN(grandKm)}</td>
        <td class="tr fw9">${grandDA > 0 ? grandDA.toFixed(2) : "—"}</td>
        <td class="tr fw9">${(grandBike + grandCar) > 0 ? (grandBike + grandCar).toFixed(2) : "—"}</td>
        <td class="tr fw9">${grandAuto > 0 ? grandAuto.toFixed(2) : "—"}</td>
        <td class="tr fw9">${grandHotel > 0 ? grandHotel.toFixed(2) : "—"}</td>
        <td class="tr fw9">${grandLocal > 0 ? grandLocal.toFixed(2) : "—"}</td>
        <td class="tr fw9">${grandOther > 0 ? grandOther.toFixed(2) : "—"}</td>
        <td class="tr grand fw9">₹${grandTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- ── AMOUNT IN WORDS ── -->
  <table style="margin-bottom:2px;">
    <tr class="awords-row">
      <td colspan="13">Amount in Words: &nbsp;<strong>${amountWords(grandTotal)}</strong></td>
    </tr>
  </table>

  <!-- ── NET PAYABLE ── -->
  <table style="margin-bottom:6px;">
    <tr class="net-row">
      <td colspan="10" class="tl">NET PAYABLE AMOUNT &nbsp;&nbsp; ${user.month} ${user.year} &nbsp;|&nbsp; ${user.name} (${user.e_code})</td>
      <td colspan="2" class="tr fw9" style="font-size:11pt!important;">₹ ${grandTotal.toFixed(2)}</td>
      <td class="tc" style="font-size:7pt!important;color:#065f46!important;">Generated: ${now}</td>
    </tr>
  </table>

  <!-- ── APPROVED STRIP ── -->
  <table style="margin-bottom:6px;">
    <tr class="approved-strip">
      <td colspan="13">✓&nbsp; APPROVED &nbsp;—&nbsp; All ${claims.length} expense claim(s) for ${user.month} ${user.year} have been reviewed and approved by the designated authority. &nbsp;|&nbsp; Total KM: ${fmtN(grandKm)} km</td>
    </tr>
  </table>

  <!-- ── SIGNATURES ── -->
  <div class="sig-section">
    <table>
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
          <div class="sig-name">${user.name}</div>
          <div class="sig-date">${user.e_code} &nbsp;|&nbsp; ${user.district}</div>
        </td>
        <td class="sig-cell">
          <div class="sig-title">Manager / L1 Approver</div>
          <div class="sig-line"></div>
          <div class="sig-name">${user.manager || "Authorised Signatory"}</div>
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

</div>
</body>
</html>`;
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function MonthSummaryPage() {
  const [data, setData] = useState<any[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(MONTHS[currentDate.getMonth() + 1]);
  const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");

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
    const f = { month: filterMonth, year: filterYear, district: filterDistrict, engineer: filterEngineer };
    setAppliedFilters(f);
    fetchData(f);
  };

  const handleClear = () => {
    const f = { month: "", year: 0, district: "", engineer: "" };
    setFilterMonth(""); setFilterYear(0); setFilterDistrict(""); setFilterEngineer(""); setSearch("");
    setAppliedFilters(f);
    fetchData(f);
  };

  // Generate detailed PDF: fetch per-leg data then open print window
  const handlePDF = async (row: any) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    try {
      toast("Fetching claim details...", { icon: "⏳" });
      const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
      const user = res.user || row;
      const claims = res.claims || [];
      if (claims.length === 0) {
        toast.error("No claim leg data found for this engineer/month");
        return;
      }
      const html = buildDetailedPrintHTML(user, claims);
      const win = window.open("", "_blank", "width=1280,height=900");
      if (!win) { toast.error("Allow popups to generate PDF"); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => setTimeout(() => win.print(), 500);
      toast.success(`PDF ready for ${row.name}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load PDF data");
    } finally {
      setPdfLoadingId(null);
    }
  };

  // Local search
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
    { label: "Approved Claims", value: totalClaims, icon: <CheckCircle className="w-5 h-5" />, color: "bg-green-50 text-green-600" },
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
            Engineer-wise approved expenses — click PDF to generate the detailed reimbursement form.
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
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="">All Months</option>
              {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Year</label>
            <select value={filterYear || ""} onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">District</label>
            <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="">All Districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Engineer / E-Code</label>
            <input type="text" value={filterEngineer} onChange={(e) => setFilterEngineer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              placeholder="Search name or code..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleApplyFilters} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 cursor-pointer">
            <Search className="w-3.5 h-3.5" /> Apply Filters
          </button>
          <button onClick={handleClear}
            className="px-4 py-2 border border-gray-200 bg-white text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-gray-800 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
              {appliedFilters.month && appliedFilters.year
                ? `${appliedFilters.month} ${appliedFilters.year}`
                : appliedFilters.month || (appliedFilters.year ? String(appliedFilters.year) : "All Months")}
              {" · "}
              <span className="text-blue-600">{filtered.length} engineer(s)</span>
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in results..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:border-blue-500 w-52" />
          </div>
        </div>

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
              <p className="text-gray-300 text-xs mt-1">Try adjusting filters or check if claims have been approved</p>
            </div>
          ) : (
            <table className="w-full text-left table-auto min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase font-bold tracking-wider text-gray-500">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">E-Code</th>
                  <th className="py-3 px-3">Grade</th>
                  <th className="py-3 px-3">District</th>
                  <th className="py-3 px-3">Month</th>
                  <th className="py-3 px-3">Claims</th>
                  <th className="py-3 px-3">DA</th>
                  <th className="py-3 px-3">Bike/Car</th>
                  <th className="py-3 px-3">Auto</th>
                  <th className="py-3 px-3">Hotel</th>
                  <th className="py-3 px-3">KM</th>
                  <th className="py-3 px-3 text-green-700">Total Amount</th>
                  <th className="py-3 px-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, idx) => {
                  const key = `${row.user_id}-${row.month}-${row.year}`;
                  const isLoading = pdfLoadingId === key;
                  return (
                    <tr key={key} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="py-3 px-3 text-gray-400 text-xs font-bold">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{row.designation}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{row.e_code}</span>
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">{row.grade || "—"}</td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">{row.district || "—"}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{row.month} {row.year}</span>
                      </td>
                      <td className="py-3 px-3 text-xs font-bold text-gray-700">{row.claims_count}</td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">
                        {row.da_amount > 0 ? fmt(row.da_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">
                        {(row.bike_amount + row.car_amount) > 0 ? fmt(row.bike_amount + row.car_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">
                        {row.auto_amount > 0 ? fmt(row.auto_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">
                        {row.hotel_amount > 0 ? fmt(row.hotel_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-gray-600">
                        {row.total_km > 0 ? <>{fmtN(row.total_km)} km</> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm font-bold text-green-700">{fmt(row.total_amount)}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handlePDF(row)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 hover:border-red-500 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-60"
                          title={`Download PDF for ${row.name}`}
                        >
                          {isLoading
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                          {isLoading ? "..." : "PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand total footer */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td colSpan={6} className="py-3 px-3 text-xs font-bold text-amber-800 uppercase tracking-wide">
                      Grand Total ({filtered.length} Engineers)
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-800">{totalClaims}</td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.da_amount, 0))}</td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.bike_amount + r.car_amount, 0))}</td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.auto_amount, 0))}</td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-700">{fmt(filtered.reduce((s, r) => s + r.hotel_amount, 0))}</td>
                    <td className="py-3 px-3 text-xs font-bold text-amber-700">{fmtN(totalKM)} km</td>
                    <td className="py-3 px-3">
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
