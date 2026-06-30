import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import {
  Calendar, Download, RefreshCw, Users, CheckCircle,
  IndianRupee, MapPin, Search, Filter, FileText, Loader2,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getAbsoluteUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const baseURL = api.defaults.baseURL || "";
  const host = baseURL.replace(/\/api$/, "");
  return `${host}/${path.replace(/^\//, "")}`;
};

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
  let w = "Rupees " + numberToWords(rupees);
  if (paise > 0) w += " And " + numberToWords(paise) + " Paise";
  return w + " Only";
}
function fmtDate(d: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(2);
    return `${dd}-${mm}-${yy}`;
  } catch { return d; }
}
function getISTNow(): string {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// ─── PDF — EXACT CYRIX EXCEL FORMAT ──────────────────────────────────────────

function buildExcelPrintHTML(user: any, claims: any[], attachments: string[] = []): string {
  const now = getISTNow();

  // Flatten: one row per leg
  const allLegs: { date: string; expCode: string; leg: any }[] = [];
  for (const claim of claims) {
    for (const leg of claim.legs) {
      allLegs.push({ date: claim.date, expCode: claim.expense_code, leg });
    }
  }

  // Grand totals — TA only Train/Bus; bike/car goes into Total but not TA column
  const gTA     = allLegs.reduce((s, r) => s + (r.leg.ta_amount || 0), 0);          // Train/Bus only
  const gBikeCar= allLegs.reduce((s, r) => s + (r.leg.bike_amount || 0) + (r.leg.car_amount || 0), 0);
  const gAuto   = allLegs.reduce((s, r) => s + (r.leg.auto_amount || 0), 0);
  const gDA     = allLegs.reduce((s, r) => s + (r.leg.da_amount || 0), 0);
  const gLocal  = allLegs.reduce((s, r) => s + (r.leg.local_purchase || 0), 0);
  const gHotel  = allLegs.reduce((s, r) => s + (r.leg.hotel_amount || 0), 0);
  const gOther  = allLegs.reduce((s, r) => s + (r.leg.other_amount || 0), 0);
  const gKM     = allLegs.reduce((s, r) => s + (r.leg.distance_km || 0), 0);
  const gTotal  = gTA + gBikeCar + gAuto + gDA + gLocal + gHotel + gOther;
  const gPMS    = allLegs.reduce((s, r) => s + (r.leg.pms_count || 0), 0);
  const gCallsA = allLegs.reduce((s, r) => s + (r.leg.calls_assigned || 0), 0);
  const gCallsC = allLegs.reduce((s, r) => s + (r.leg.calls_completed || 0), 0);

  // ── mode abbreviation ──
  const modeAbbr = (m: string) => {
    if (!m) return "";
    const map: Record<string, string> = {
      "Train": "T", "Bus": "B", "Bike": "Bi", "Car": "C", "Auto": "A",
      "train": "T", "bus": "B", "bike": "Bi", "car": "C", "auto": "A",
    };
    return map[m] || m;
  };

  // ── Data rows — 18 columns ──
  // Col order: Date | From | To | Worked District | Mode | KM |
  //            TA(Train/Bus only) | Auto | DA | Local Spare | Hotel |
  //            Other Desc | Other Amt | Total | Remarks | Barcode | PMS | Calls
  const dataRows = allLegs.map((r, i) => {
    const l = r.leg;
    // TA column = ONLY train/bus ticket amount
    const taCol   = l.ta_amount || 0;
    // Bike/Car amounts included in Total but no separate column
    const bikeCarAmt = (l.bike_amount || 0) + (l.car_amount || 0);
    const rowTotal = taCol + bikeCarAmt + (l.auto_amount || 0) + (l.da_amount || 0)
                   + (l.local_purchase || 0) + (l.hotel_amount || 0) + (l.other_amount || 0);
    const bg = i % 2 === 0 ? "#ffffff" : "#f0f7ff";
    const c = `border:1px solid #b0c4de;padding:3px 4px;font-size:7pt;font-weight:500;color:#000;vertical-align:middle;word-wrap:break-word;`;

    return `<tr style="background:${bg}!important;">
      <td style="${c}text-align:center;">${fmtDate(r.date)}</td>
      <td style="${c}">${l.from_location || ""}</td>
      <td style="${c}">${l.to_location || ""}</td>
      <td style="${c}text-align:center;">${l.worked_district || ""}</td>
      <td style="${c}text-align:center;font-weight:700;">${modeAbbr(l.travel_mode)}</td>
      <td style="${c}text-align:center;">${l.distance_km > 0 ? l.distance_km.toFixed(1) : ""}</td>
      <td style="${c}text-align:right;">${taCol > 0 ? taCol.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;">${l.auto_amount > 0 ? l.auto_amount.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;">${l.da_amount > 0 ? l.da_amount.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;">${l.local_purchase > 0 ? l.local_purchase.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;">${l.hotel_amount > 0 ? l.hotel_amount.toFixed(2) : ""}</td>
      <td style="${c}font-size:6.5pt;">${l.other_desc || ""}</td>
      <td style="${c}text-align:right;">${l.other_amount > 0 ? l.other_amount.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;font-weight:800;background:#e8f5e9!important;">${rowTotal > 0 ? rowTotal.toFixed(2) : ""}</td>
      <td style="${c}font-size:6.5pt;">${l.visit_purpose || ""}</td>
      <td style="${c}font-size:6pt;font-family:monospace;">${l.barcode_ticket || ""}</td>
      <td style="${c}text-align:center;">${(l.pms_count || 0) > 0 ? l.pms_count : ""}</td>
      <td style="${c}text-align:center;">${(l.calls_completed || 0) > 0 ? `${l.calls_completed}/${l.calls_assigned || 0}` : ""}</td>
    </tr>`;
  }).join("\n");

  const totalC = `border:1.5px solid #8B6914;padding:4px 5px;font-size:7.5pt;font-weight:900;color:#5d4007;background:#fff3cd!important;vertical-align:middle;`;

  // Attached receipts HTML block
  let attachmentsSection = "";
  if (attachments && attachments.length > 0) {
    attachmentsSection = `
      <div style="page-break-before: always; margin-top: 30px; padding-top: 10px;">
        <h3 style="font-size: 11pt; font-weight: 800; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase;">
          Attached Expense Receipts / Bills
        </h3>
        <div style="display: flex; flex-direction: column; gap: 30px; align-items: center; justify-content: center; width: 100%;">
          ${attachments.map((url, index) => {
            const absoluteUrl = getAbsoluteUrl(url);
            return `
              <div style="width: 100%; max-width: 800px; border: 1px solid #b0c4de; padding: 10px; background: #fff; text-align: center; page-break-inside: avoid; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-size: 8.5pt; font-weight: bold; color: #1a237e; text-align: left; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px;">
                  Receipt #${index + 1}
                </div>
                <img src="${absoluteUrl}" style="max-width: 100%; max-height: 230mm; object-fit: contain; border-radius: 2px;" alt="Receipt ${index + 1}" />
              </div>
            `;
          }).join("\n")}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Form — ${user.name} — ${user.month} ${user.year}</title>
  <style>
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Arial',sans-serif;color:#000;background:#fff;font-size:8pt;}
    .wrap{width:100%;padding:4mm;background:#fff;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    th,td{border:1px solid #b0c4de;padding:3px 4px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;}
    .main-hdr{background:#1a237e!important;color:#fff!important;text-align:center;font-size:14pt!important;
      font-weight:900!important;letter-spacing:1.5px;padding:8px!important;border:2px solid #0d1557!important;}
    .month-hdr{background:#1a237e!important;color:#e3f2fd!important;font-size:8pt!important;
      font-weight:800!important;text-align:right;padding:5px 10px!important;border:2px solid #0d1557!important;white-space:nowrap;}
    .form-no{background:#1a237e!important;color:#fff9c4!important;font-size:8pt!important;
      font-weight:800!important;text-align:right;padding:5px 10px!important;border:2px solid #0d1557!important;white-space:nowrap;}
    .info-tbl{margin-bottom:0; border: 1.5px solid #000; border-top: none;}
    .info-lbl{font-weight:bold; background:#fff!important; color:#000; border-right:1px solid #000; font-size:7.5pt; font-family:'Arial',sans-serif; text-align:left; padding:4px 6px; text-transform:uppercase; white-space:nowrap;}
    .info-val{background:#fff!important; color:#000; border-right:1px solid #000; font-size:7.5pt; font-family:'Arial',sans-serif; text-align:left; padding:4px 6px; font-weight:800; color:#1a237e;}
    .col-h1{background:#1565c0!important;color:#fff!important;font-size:7pt!important;
      font-weight:800!important;text-align:center!important;padding:5px 2px!important;
      border:1.5px solid #0d47a1!important;line-height:1.25;vertical-align:middle;}
    .col-h2{background:#1e88e5!important;color:#fff!important;font-size:6.5pt!important;
      font-weight:800!important;text-align:center!important;padding:4px 2px!important;
      border:1.5px solid #1565c0!important;line-height:1.2;vertical-align:middle;}
    .tot-lbl{${totalC}text-align:left;}
    .tot-num{${totalC}text-align:right;}
    .tot-grand{${totalC}background:#d4edda!important;color:#155724!important;font-size:9pt!important;}
    .awords{background:#e3f2fd!important;color:#1a237e!important;font-size:7.5pt!important;
      font-weight:700!important;font-style:italic;border:1px solid #90caf9!important;padding:5px 8px!important;}
    .net-row td{background:#c8e6c9!important;color:#1b5e20!important;font-size:9pt!important;
      font-weight:900!important;border:2px solid #388e3c!important;padding:6px 8px!important;}
    .approved-bar td{background:#1a237e!important;color:#fff!important;font-size:8.5pt!important;
      font-weight:900!important;text-align:center;padding:6px!important;border:2px solid #0d1557!important;letter-spacing:0.5px;}
    .sig-hdr td{background:#1565c0!important;color:#fff!important;font-weight:800!important;
      font-size:7.5pt!important;text-align:center;padding:5px!important;border:1.5px solid #0d47a1!important;}
    .sig-body td{text-align:center;vertical-align:top;padding:8px 5px!important;height:85px;
      background:#fafafa!important;border:1.5px solid #888!important;}
    .sig-title{font-size:7pt;font-weight:900;color:#1565c0;display:block;margin-bottom:30px;}
    .sig-line{border-top:1.5px solid #333;margin:0 6px;}
    .sig-name{font-size:7pt;font-weight:800;margin-top:3px;display:block;}
    .sig-info{font-size:6pt;color:#555;display:block;margin-top:2px;}
    @page{size:A4 landscape;margin:6mm 7mm;}
    @media print{body{margin:0;padding:0;}}
  </style>
</head>
<body>
<div class="wrap">

  <!-- ══ ROW 1: Company Title + Month + Form No ══ -->
  <table style="margin-bottom:0;">
    <colgroup>
      <col style="width:8%;">
      <col style="width:67%;">
      <col style="width:13%;">
      <col style="width:12%;">
    </colgroup>
    <tr>
      <td style="background:#1a237e!important;border:2px solid #0d1557;padding:4px 6px;text-align:center;">
        <img src="https://cyrixhealthcare.com/favicon.ico" onerror="this.style.display='none'" style="height:30px;" alt="">
        <div style="color:#fff;font-size:7pt;font-weight:800;margin-top:2px;">CYRIX</div>
      </td>
      <td class="main-hdr">CYRIX &mdash; EXPENSES REIMBURSEMENT FORM</td>
      <td class="month-hdr">Month-Year: ${user.month.toUpperCase().substring(0,3)} ${user.year}</td>
      <td class="form-no">Form No: CYKL01 V2023</td>
    </tr>
  </table>

  <!-- ══ ROW 2: Employee Info (Image 2 clean white style) ══ -->
  <table class="info-tbl">
    <colgroup>
      <col style="width:6%;"><col style="width:23%;">
      <col style="width:7%;"><col style="width:10%;">
      <col style="width:8%;"><col style="width:10%;">
      <col style="width:12%;"><col style="width:12%;">
      <col style="width:6%;"><col style="width:6%;">
      <col style="width:7%;"><col style="width:11%;">
    </colgroup>
    <tr>
      <td class="info-lbl">NAME :</td>
      <td class="info-val">${user.name}</td>
      <td class="info-lbl">EECode:</td>
      <td class="info-val">${user.e_code}</td>
      <td class="info-lbl">PROJECT:</td>
      <td class="info-val">RJBEMP</td>
      <td class="info-lbl">BASE LOCATION:</td>
      <td class="info-val">${(user.district || "").toUpperCase()}</td>
      <td class="info-lbl">GRADE:</td>
      <td class="info-val">${user.grade || "—"}</td>
      <td class="info-lbl">MOBILE:</td>
      <td class="info-val" style="border-right:none;">${user.mobile || "—"}</td>
    </tr>
  </table>

  <!-- ══ DATA TABLE ══ -->
  <!-- Columns (18 total):
       Date | From | To | Worked Dist | Mode | KM |
       TA(Train/Bus only) | Auto | DA | Local Spare | Hotel |
       Other Desc | Other Amt | Total | Remarks | Barcode/Asset | PMS | Calls -->
  <table style="margin-bottom:0; border-top: none;">
    <colgroup>
      <col style="width:4.5%;"><!-- Date -->
      <col style="width:6.5%;"><!-- From -->
      <col style="width:6.5%;"><!-- To -->
      <col style="width:5%;">  <!-- Worked Dist -->
      <col style="width:3.5%;"><!-- Mode -->
      <col style="width:3.5%;"><!-- KM -->
      <col style="width:4.5%;"><!-- TA (Train/Bus only) -->
      <col style="width:3.5%;"><!-- Auto -->
      <col style="width:3.5%;"><!-- DA -->
      <col style="width:5%;">  <!-- Local Spare -->
      <col style="width:3.5%;"><!-- Hotel -->
      <col style="width:7.5%;"><!-- Other Desc -->
      <col style="width:4%;">  <!-- Other Amt -->
      <col style="width:4.5%;"><!-- Total -->
      <col style="width:8%;">  <!-- Remarks -->
      <col style="width:7%;">  <!-- Barcode/Asset -->
      <col style="width:3.5%;"><!-- PMS -->
      <col style="width:4%;">  <!-- Calls -->
    </colgroup>
    <thead>
      <!-- Header Row 1 -->
      <tr>
        <th class="col-h1" rowspan="2">Date<br>(DD-MM-YY)</th>
        <th class="col-h1" colspan="2">Locations</th>
        <th class="col-h1" rowspan="2">Worked<br>District</th>
        <th class="col-h1" rowspan="2">Mode of<br>Trans.<br>(T/B/Bi/C)</th>
        <th class="col-h1" rowspan="2">Distance<br>in (KM)</th>
        <th class="col-h1" rowspan="2">TA (if mode<br>is Train(T)/<br>Bus(B))</th>
        <th class="col-h1" rowspan="2">Auto<br>fare</th>
        <th class="col-h1" rowspan="2">D.A.</th>
        <th class="col-h1" rowspan="2">Local Spare<br>Purch. Rate</th>
        <th class="col-h1" rowspan="2">Hotel</th>
        <th class="col-h1" colspan="2">Other Expenses</th>
        <th class="col-h1" rowspan="2">Total</th>
        <th class="col-h1" rowspan="2">Remarks /<br>Purpose</th>
        <th class="col-h1" rowspan="2">Barcode/<br>Asset No. and<br>Ticket No./MPT ID</th>
        <th class="col-h1" rowspan="2">PMS</th>
        <th class="col-h1" rowspan="2">Calls<br>(Done/Assign)</th>
      </tr>
      <!-- Header Row 2 (sub-headers) -->
      <tr>
        <th class="col-h2">From</th>
        <th class="col-h2">To</th>
        <th class="col-h2">Description</th>
        <th class="col-h2">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows || `<tr><td colspan="18" style="text-align:center;padding:14px;color:#888;font-style:italic;font-size:8pt;">No expense leg data found for this period.</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td class="tot-lbl" colspan="6" style="text-align:left;">
          TOTAL &nbsp;(${claims.length} days &nbsp;·&nbsp; ${allLegs.length} legs &nbsp;·&nbsp; ${gKM.toFixed(1)} KM)
        </td>
        <td class="tot-num">${gTA > 0 ? gTA.toFixed(2) : "—"}</td>
        <td class="tot-num">${gAuto > 0 ? gAuto.toFixed(2) : "—"}</td>
        <td class="tot-num">${gDA > 0 ? gDA.toFixed(2) : "—"}</td>
        <td class="tot-num">${gLocal > 0 ? gLocal.toFixed(2) : "—"}</td>
        <td class="tot-num">${gHotel > 0 ? gHotel.toFixed(2) : "—"}</td>
        <td class="tot-lbl" style="text-align:center;font-size:6.5pt!">Other Total</td>
        <td class="tot-num">${gOther > 0 ? gOther.toFixed(2) : "—"}</td>
        <td class="tot-grand" style="font-size:9pt!important;text-align:right;">₹${gTotal.toFixed(2)}</td>
        <td class="tot-lbl" style="text-align:center;font-size:6pt!important;">Generated:<br>${now}</td>
        <td class="tot-lbl" style="font-size:6.5pt!"></td>
        <td class="tot-num" style="text-align:center;">${gPMS > 0 ? gPMS : ""}</td>
        <td class="tot-num" style="text-align:center;">${gCallsC > 0 ? `${gCallsC}/${gCallsA}` : ""}</td>
      </tr>
    </tfoot>
  </table>

  <!-- ══ AMOUNT IN WORDS ══ -->
  <table style="margin-bottom:2px;">
    <tr>
      <td class="awords" colspan="18">
        <strong>Amount in Words:</strong> &nbsp; ${amountWords(gTotal)}
      </td>
    </tr>
  </table>

  <!-- ══ NET PAYABLE ══ -->
  <table class="net-row" style="margin-bottom:4px;">
    <tr>
      <td colspan="12" style="text-align:left;">
        NET PAYABLE AMOUNT &nbsp;&mdash;&nbsp; ${user.month} ${user.year} &nbsp;&mdash;&nbsp; ${user.name} &nbsp;(${user.e_code})
      </td>
      <td colspan="3" style="text-align:right;font-size:12pt!important;">₹ ${gTotal.toFixed(2)}</td>
      <td colspan="3" style="text-align:center;font-size:7pt!important;color:#1b5e20!important;">
        Printed: ${now}
      </td>
    </tr>
  </table>

  <!-- ══ APPROVED BANNER ══ -->
  <table class="approved-bar" style="margin-bottom:6px;">
    <tr>
      <td colspan="18">
        ✓ &nbsp; APPROVED &nbsp;—&nbsp; All ${claims.length} expense claim(s) for ${user.month} ${user.year} have been verified and approved by the designated authority. &nbsp;|&nbsp; Total KM Travelled: ${gKM.toFixed(1)} km
      </td>
    </tr>
  </table>

  <!-- ══ SIGNATURES ══ -->
  <table>
    <tr class="sig-hdr">
      <td style="width:25%">CLAIMED BY (Employee)</td>
      <td style="width:25%">APPROVED BY (Manager / L1)</td>
      <td style="width:25%">CHECKED BY (Finance)</td>
      <td style="width:25%">ACCOUNTED BY</td>
    </tr>
    <tr class="sig-body">
      <td>
        <span class="sig-title">Employee Signature</span>
        <div class="sig-line"></div>
        <span class="sig-name">${user.name}</span>
        <span class="sig-info">${user.e_code} &nbsp;|&nbsp; ${user.district}</span>
      </td>
      <td>
        <span class="sig-title">Manager / L1 Approver</span>
        <div class="sig-line"></div>
        <span class="sig-name">${user.manager || "Authorised Signatory"}</span>
        <span class="sig-info">Approving Manager</span>
      </td>
      <td>
        <span class="sig-title">Finance / Accounts Check</span>
        <div class="sig-line"></div>
        <span class="sig-name">Finance Dept.</span>
        <span class="sig-info">Date: _______________</span>
      </td>
      <td>
        <span class="sig-title">Accounts Entry</span>
        <div class="sig-line"></div>
        <span class="sig-name">Amit Rawat</span>
        <span class="sig-info">Accounts Department</span>
      </td>
    </tr>
  </table>

  <!-- ══ ATTACHED RECEIPTS SECTION ══ -->
  ${attachmentsSection}

</div>
</body>
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function MonthSummaryPage() {
  const [data, setData] = useState<any[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(MONTHS[currentDate.getMonth() + 1]);
  const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    month: MONTHS[currentDate.getMonth() + 1],
    year: currentDate.getFullYear(),
    district: "", engineer: "",
  });
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchData(appliedFilters);
  }, []);

  const fetchData = async (f: typeof appliedFilters) => {
    setLoading(true);
    try {
      const res = await expenseService.getMonthSummary({
        month: f.month || undefined, year: f.year || undefined,
        district: f.district || undefined, engineer: f.engineer || undefined,
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
    setAppliedFilters(f); fetchData(f);
  };

  const handlePDF = async (row: any) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    const tid = toast.loading(`Fetching data for ${row.name}…`);
    try {
      const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
      toast.dismiss(tid);
      const user = res.user || row;
      const claims = res.claims || [];
      const attachments = res.attachments || [];
      if (claims.length === 0) { toast.error("No approved claim data found"); return; }
      const html = buildExcelPrintHTML(user, claims, attachments);
      const win = window.open("", "_blank", "width=1400,height=900");
      if (!win) { toast.error("Allow popups to download PDF"); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => setTimeout(() => win.print(), 600);
      toast.success(`PDF ready — ${row.name} (${row.month} ${row.year})`);
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.detail || "PDF generation failed");
    } finally {
      setPdfLoadingId(null);
    }
  };

  const filtered = data.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.name || "").toLowerCase().includes(q) ||
      (r.e_code || "").toLowerCase().includes(q) ||
      (r.district || "").toLowerCase().includes(q) ||
      (r.month || "").toLowerCase().includes(q);
  });

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
    <div className="space-y-4 animate-fadeIn font-sans pb-10">
      {/* AdminLTE Content Header */}
      <div className="flex items-center justify-between border-b border-gray-250 pb-3 mb-4 bg-gray-50/20 px-1">
        <div>
          <h1 className="text-xl font-bold text-[#333] flex items-center gap-2 tracking-tight">
            <Users className="w-5.5 h-5.5 text-blue-600" />
            Month Summary
            <span className="text-xs font-normal text-gray-500 hidden sm:inline-block ml-1">Reports &amp; Billing</span>
          </h1>
        </div>
        <div className="text-[11px] font-semibold text-[#666] flex items-center gap-1.5">
          <span className="text-blue-600 cursor-pointer hover:underline">Home</span>
          <span className="text-gray-400">/</span>
          <span className="text-blue-600 cursor-pointer hover:underline">Reports</span>
          <span className="text-gray-400">/</span>
          <span className="text-[#888]">Month Summary</span>
        </div>
      </div>

      {/* AdminLTE Info Boxes (Stats) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Box 1 */}
        <div className="bg-white border-t-3 border-blue-500 shadow-sm rounded-sm p-3 flex items-center justify-between border border-gray-200">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Engineers</span>
            <span className="text-xl font-bold text-gray-800 font-mono">{totalEngineers}</span>
          </div>
          <div className="text-blue-600 bg-blue-50/60 p-2.5 rounded-sm"><Users className="w-5.5 h-5.5" /></div>
        </div>
        {/* Box 2 */}
        <div className="bg-white border-t-3 border-green-500 shadow-sm rounded-sm p-3 flex items-center justify-between border border-gray-200">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Approved Claims</span>
            <span className="text-xl font-bold text-gray-800 font-mono">{totalClaims}</span>
          </div>
          <div className="text-green-600 bg-green-50/60 p-2.5 rounded-sm"><CheckCircle className="w-5.5 h-5.5" /></div>
        </div>
        {/* Box 3 */}
        <div className="bg-white border-t-3 border-yellow-500 shadow-sm rounded-sm p-3 flex items-center justify-between border border-gray-200">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Amount</span>
            <span className="text-xl font-bold text-gray-800 font-mono">{fmt(totalAmount)}</span>
          </div>
          <div className="text-yellow-600 bg-yellow-50/60 p-2.5 rounded-sm"><IndianRupee className="w-5.5 h-5.5" /></div>
        </div>
        {/* Box 4 */}
        <div className="bg-white border-t-3 border-purple-500 shadow-sm rounded-sm p-3 flex items-center justify-between border border-gray-200">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total distance</span>
            <span className="text-xl font-bold text-gray-800 font-mono">{fmtN(totalKM)} km</span>
          </div>
          <div className="text-purple-600 bg-purple-50/60 p-2.5 rounded-sm"><MapPin className="w-5.5 h-5.5" /></div>
        </div>
      </div>

      {/* AdminLTE Card: Filters */}
      <div className="card border-t-3 border-primary bg-white shadow-sm border border-gray-200 rounded-sm">
        <div className="card-header border-b border-gray-150 px-4 py-2.5 flex items-center justify-between bg-gray-50/40">
          <h3 className="card-title text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-blue-600" />
            Filter Month Report
          </h3>
          <button onClick={() => fetchData(appliedFilters)} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-60">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="card-body p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Month</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer">
                <option value="">All Months</option>
                {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Year</label>
              <select value={filterYear || ""} onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : 0)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer">
                <option value="">All Years</option>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">District Location</label>
              <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer">
                <option value="">All Districts</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Engineer / E-Code</label>
              <input type="text" value={filterEngineer} onChange={(e) => setFilterEngineer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                placeholder="Type name or code..."
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 border-t border-gray-100 pt-3.5">
            <button onClick={handleApplyFilters} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-sm shadow-sm transition-colors disabled:opacity-60 cursor-pointer">
              <Search className="w-3.5 h-3.5" /> Search Summary
            </button>
            <button onClick={handleClear}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 text-xs font-semibold rounded-sm hover:bg-gray-100 transition-colors cursor-pointer">
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* AdminLTE Card: Data Table */}
      <div className="card border-t-3 border-blue-500 bg-white shadow-sm border border-gray-200 rounded-sm">
        <div className="card-header border-b border-gray-150 px-4 py-3 flex items-center justify-between bg-gray-50/40">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {appliedFilters.month && appliedFilters.year
                ? `${appliedFilters.month} ${appliedFilters.year}`
                : appliedFilters.month || (appliedFilters.year ? String(appliedFilters.year) : "All Months")}
              {" Summary "}
              <span className="text-blue-600 font-mono">({filtered.length} row(s))</span>
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Quick search..."
              className="pl-8 pr-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-44" />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-450">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading summary records...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-10 h-10 text-gray-250 mx-auto mb-3" />
              <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">No matching summary records found</p>
              <p className="text-gray-450 text-[11px] mt-1">Make sure filters are correct and claims have been approved.</p>
            </div>
          ) : (
            <table className="w-full text-left table-auto min-w-[1050px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold tracking-wider text-gray-600 font-sans">
                  <th className="py-2.5 px-3 border-r border-gray-200">#</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Engineer Details</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">E-Code</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Grade</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Base District</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Claim Period</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center">Days</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right">DA (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right">Bike/Car (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right">Auto (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right">Hotel (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center">Total KM</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right text-green-700 bg-green-50/20 font-bold">Approved Total (₹)</th>
                  <th className="py-2.5 px-3 text-center">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filtered.map((row, idx) => {
                  const key = `${row.user_id}-${row.month}-${row.year}`;
                  const isLoading = pdfLoadingId === key;
                  return (
                    <tr key={key} className="hover:bg-blue-50/20 transition-colors border-b border-gray-150">
                      <td className="py-3 px-3 text-gray-400 font-mono font-bold border-r border-gray-150">{idx + 1}</td>
                      <td className="py-3 px-3 border-r border-gray-150 font-sans">
                        <div className="font-bold text-gray-800">{row.name}</div>
                        <div className="text-[10px] text-gray-500 font-semibold uppercase">{row.designation}</div>
                      </td>
                      <td className="py-3 px-3 border-r border-gray-150">
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">{row.e_code}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-700 font-semibold border-r border-gray-150">{row.grade || "—"}</td>
                      <td className="py-3 px-3 text-gray-700 font-semibold border-r border-gray-150">{row.district || "—"}</td>
                      <td className="py-3 px-3 border-r border-gray-150">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">{row.month} {row.year}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-700 border-r border-gray-150">{row.claims_count}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-650 border-r border-gray-150">
                        {row.da_amount > 0 ? fmt(row.da_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-650 border-r border-gray-150">
                        {(row.bike_amount + row.car_amount) > 0 ? fmt(row.bike_amount + row.car_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-650 border-r border-gray-150">
                        {row.auto_amount > 0 ? fmt(row.auto_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-650 border-r border-gray-150">
                        {row.hotel_amount > 0 ? fmt(row.hotel_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-700 border-r border-gray-150">
                        {row.total_km > 0 ? `${fmtN(row.total_km)} km` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-green-700 bg-green-50/10 border-r border-gray-150">
                        {fmt(row.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handlePDF(row)} disabled={isLoading}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                          title={`Download Reimbursement PDF Form CYKL01 for ${row.name}`}>
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          {isLoading ? "..." : "Form PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="bg-yellow-50/50 border-t-2 border-yellow-200 text-xs font-bold text-gray-800">
                    <td colSpan={6} className="py-3 px-3 border-r border-gray-150 uppercase tracking-wider text-gray-600 font-sans">
                      Grand Total Summary
                    </td>
                    <td className="py-3 px-3 text-center border-r border-gray-150 font-mono">{totalClaims}</td>
                    <td className="py-3 px-3 text-right border-r border-gray-150 font-mono">{fmt(filtered.reduce((s, r) => s + r.da_amount, 0))}</td>
                    <td className="py-3 px-3 text-right border-r border-gray-150 font-mono">{fmt(filtered.reduce((s, r) => s + r.bike_amount + r.car_amount, 0))}</td>
                    <td className="py-3 px-3 text-right border-r border-gray-150 font-mono">{fmt(filtered.reduce((s, r) => s + r.auto_amount, 0))}</td>
                    <td className="py-3 px-3 text-right border-r border-gray-150 font-mono">{fmt(filtered.reduce((s, r) => s + r.hotel_amount, 0))}</td>
                    <td className="py-3 px-3 text-center border-r border-gray-150 font-mono">{fmtN(totalKM)} km</td>
                    <td className="py-3 px-3 text-right text-green-700 bg-green-50/20 font-bold border-r border-gray-150 font-mono">
                      {fmt(totalAmount)}
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
