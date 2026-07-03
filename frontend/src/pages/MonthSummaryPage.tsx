import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import {
  Calendar, Download, RefreshCw, Users, CheckCircle,
  IndianRupee, MapPin, Search, Filter, FileText, Loader2, Printer,
} from "lucide-react";
import Loader from "../components/common/Loader";

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

// ─── PDF — EXACT CYRIX EXCEL FORMAT ──────────────────────────────────────────

function buildExcelPrintHTML(user: any, claims: any[], attachments: string[] = [], advance: number = 0): string {
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

  const gPMS = allLegs.reduce((s, r) => s + (r.leg.pms_count || 0), 0);
  const gCalibration = allLegs.reduce((s, r) => s + (r.leg.calibration_count || 0), 0);
  const gPMSCalib = gPMS + gCalibration;
  
  const gCallsA = allLegs.reduce((s, r) => s + (r.leg.calls_assigned || 0), 0);
  const gCallsC = allLegs.reduce((s, r) => s + (r.leg.calls_completed || 0), 0);
  const gAssetQty = allLegs.reduce((s, r) => s + (r.leg.asset_tagging_qty || 0), 0);
  const gAssetVal = allLegs.reduce((s, r) => s + (r.leg.asset_tagging_val || 0), 0);

  // ── visit purpose formatter ──
  const getFormattedPurpose = (l: any) => {
    const parts: string[] = [];
    let acts: string[] = [];
    let actOtherDesc = "";
    if (l.activity_details) {
      try {
        const details = typeof l.activity_details === 'string' ? JSON.parse(l.activity_details) : l.activity_details;
        acts = details.selected_activities || [];
        actOtherDesc = details.activity_other_desc || "";
      } catch (e) {}
    }
    
    if (acts.length === 0 && l.visit_purpose) {
      let clean = l.visit_purpose;
      if (clean.startsWith("Activities: ")) {
        clean = clean.replace("Activities: ", "");
      }
      acts = clean.split(",").map((s: string) => s.trim());
    }

    acts.forEach((act: string) => {
      const actClean = act.trim();
      // Filter out any activity name that matches the monetary other_desc
      if (l.other_desc && actClean === l.other_desc.trim()) {
        return;
      }

      if (actClean === "Calls" || actClean === "Breakdown Call") {
        parts.push("Breakdown Call");
      } else if (actClean === "PMS") {
        parts.push("PMS");
      } else if (actClean === "Asset Tagging") {
        parts.push("Asset Tagging");
      } else if (actClean === "Mobilise Asset Update" || actClean === "Asset Verification") {
        parts.push("Asset Verification");
      } else if (actClean === "Calibration") {
        parts.push("Calibration");
      } else if (actClean === "Other") {
        // Skip literal "Other"
      } else if (actClean && actClean !== "Field visit") {
        parts.push(actClean);
      }
    });

    if (actOtherDesc && actOtherDesc.trim()) {
      parts.push(actOtherDesc.trim());
    }

    if (parts.length === 0) {
      const cleanPurpose = l.visit_purpose && !l.visit_purpose.startsWith("Activities:") ? l.visit_purpose : "Field visit";
      if (l.other_desc && cleanPurpose.trim() === l.other_desc.trim()) {
        return "Field visit";
      }
      return cleanPurpose;
    }
    return parts.join(", ");
  };

  const getActivityOtherDesc = (l: any) => {
    return l.other_desc || "";
  };

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
  const dataRows = allLegs.map((r, i) => {
    const l = r.leg;
    const taCol   = l.ta_amount || 0;
    const bikeCarAmt = (l.bike_amount || 0) + (l.car_amount || 0);
    const rowTotal = taCol + bikeCarAmt + (l.auto_amount || 0) + (l.da_amount || 0)
                   + (l.local_purchase || 0) + (l.hotel_amount || 0) + (l.other_amount || 0);
    const bg = i % 2 === 0 ? "#ffffff" : "#f0f7ff";
    const c = `border:1px solid #000!important;padding:3.5px 4px;font-size:7pt;font-weight:500;color:#000;vertical-align:middle;word-wrap:break-word;`;
    
    const pmsCalibCount = (l.pms_count || 0) + (l.calibration_count || 0);

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
      <td style="${c}font-size:6.5pt;">${getActivityOtherDesc(l)}</td>
      <td style="${c}text-align:right;">${l.other_amount > 0 ? l.other_amount.toFixed(2) : ""}</td>
      <td style="${c}text-align:right;font-weight:800;background:#e8f5e9!important;">${rowTotal > 0 ? rowTotal.toFixed(2) : ""}</td>
      <td style="${c}font-size:6.5pt;">${getFormattedPurpose(l)}</td>
      <td style="${c}font-size:6pt;font-family:monospace;">${l.barcode_ticket || ""}</td>
      <td style="${c}text-align:center;">${pmsCalibCount}</td>
      <td style="${c}text-align:center;">${l.calls_completed || 0}/${l.calls_assigned || 0}</td>
    </tr>`;
  }).join("\n");

  // Attached receipts HTML block — each on its own page
  let attachmentsSection = "";
  if (attachments && attachments.length > 0) {
    attachmentsSection = attachments.map((att: any, index) => {
      const absoluteUrl = getAbsoluteUrl(att.file_url);
      const dateStr = att.date ? fmtDate(att.date) : `Receipt #${index + 1}`;
      return `
        <div class="attachment-page" style="page-break-before: always; width: 100%; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5mm; box-sizing: border-box; overflow: hidden;">
          <div style="width: 100%; max-width: 950px; border: 1.5px solid #000; padding: 10px; background: #fff; text-align: center; border-radius: 4px; box-sizing: border-box;">
            <div style="font-size: 10pt; font-weight: bold; color: #000; text-align: left; border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 15px; text-transform: uppercase; font-family:'Arial',sans-serif;">
              BILL ATTACHMENT &mdash; DATE: ${dateStr}
            </div>
            <img src="${absoluteUrl}" style="max-width: 100%; max-height: 180mm; object-fit: contain; border: 1px solid #ccc;" alt="Attachment ${dateStr}" />
          </div>
        </div>
      `;
    }).join("\n");
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Form — ${user.name} — ${user.month} ${user.year}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',sans-serif;color:#000;background:#fff;font-size:7.5pt;}
    .wrap{width:100%;padding:4mm;background:#fff;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    th,td{border:1px solid #000!important;padding:3.5px 4px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;}
    .main-hdr{background:#1e3a8a!important;color:#fff!important;text-align:center;font-size:13pt!important;
      font-weight:800!important;letter-spacing:1px;padding:6px!important;border:1px solid #000!important;}
    .month-hdr{background:#1e3a8a!important;color:#eff6ff!important;font-size:7.5pt!important;
      font-weight:700!important;text-align:right;padding:4px 8px!important;border:1px solid #000!important;white-space:nowrap;}
    .form-no{background:#1e3a8a!important;color:#fef08a!important;font-size:7.5pt!important;
      font-weight:700!important;text-align:right;padding:4px 8px!important;border:1px solid #000!important;white-space:nowrap;}
    .info-tbl{margin-bottom:0; border:1px solid #000!important; border-top: none!important;}
    .info-lbl{font-weight:700; background:#fff!important; color:#000; border-right:1px solid #000!important; font-size:7pt; text-align:left; padding:4px 6px; text-transform:uppercase; white-space:nowrap;}
    .info-val{background:#fff!important; color:#1e3a8a!important; border-right:1px solid #000!important; font-size:7pt; text-align:left; padding:4px 6px; font-weight:800;}
    .col-h1{background:#1d4ed8!important;color:#fff!important;font-size:7pt!important;
      font-weight:700!important;text-align:center!important;padding:4.5px 2px!important;
      border:1px solid #000!important;line-height:1.2;vertical-align:middle;}
    .col-h2{background:#3b82f6!important;color:#fff!important;font-size:6.5pt!important;
      font-weight:700!important;text-align:center!important;padding:3.5px 2px!important;
      border:1px solid #000!important;line-height:1.15;vertical-align:middle;}
    .tot-lbl{border:1px solid #000!important;padding:4px 5px;font-size:7pt;font-weight:800;color:#000;background:#fef3c7!important;vertical-align:middle;}
    .tot-num{border:1px solid #000!important;padding:4px 5px;font-size:7pt;font-weight:800;color:#000;background:#fef3c7!important;vertical-align:middle;text-align:right;}
    .net-lbl{border:1px solid #000!important;padding:5px 6px;font-size:7.5pt;font-weight:800;color:#000;background:#e5e7eb!important;text-align:center;text-transform:uppercase;}
    .net-val{border:1px solid #000!important;padding:5px 6px;font-size:8pt;font-weight:900;color:#000;background:#fff!important;text-align:center;}
    .awords-box{border:1px solid #000!important;border-top:none!important;padding:5px 8px;font-size:7pt;font-weight:500;color:#000;background:#fff!important;}
    .remarks-box{border:1px solid #000!important;border-top:none!important;padding:4px 8px;font-size:7pt;font-weight:700;color:#000;background:#fff!important;}
    .sig-tbl{border:1px solid #000!important;border-top:none!important;}
    .sig-lbl{border-right:1px solid #000!important;padding:4px 6px;font-size:7pt;font-weight:500;color:#000;background:#fff!important;height:32px;vertical-align:top;}
    .sig-val{border-right:1px solid #000!important;padding:4px 6px;font-size:7pt;font-weight:500;color:#000;background:#fff!important;height:32px;vertical-align:bottom;}
    @page{size:A4 landscape;margin:6mm 7mm;}
    @media print{
      body{margin:0;padding:0;}
      .wrap{page-break-after:always;page-break-inside:avoid;}
      .attachment-page{page-break-before:always!important;break-before:page!important;height:100vh!important;page-break-inside:avoid!important;break-inside:avoid!important;overflow:hidden!important;}
    }
  </style>
</head>
<body>
<div class="wrap">

  <table style="margin-bottom:0;">
    <colgroup>
      <col style="width:10%;"><col style="width:65%;"><col style="width:25%;">
    </colgroup>
    <tr>
      <td style="background:#fff!important;border:2px solid #0d1557;padding:0;text-align:center;vertical-align:middle;height:32px;overflow:hidden;">
        <img src="${window.location.origin}/brand.png" style="height:100%; max-height:32px; width:100%; object-fit:contain; display:block; margin:0 auto;" alt="Logo" />
      </td>
      <td class="main-hdr">CYRIX &mdash; EXPENSES REIMBURSEMENT FORM</td>
      <td style="background:#1a237e!important;color:#fff!important;border:2px solid #0d1557;padding:4px 8px;font-size:8pt;font-weight:bold;text-align:center;vertical-align:middle;">
        <div>Month-Year: ${user.month.toUpperCase().substring(0,3)} ${user.year}</div>
      </td>
    </tr>
  </table>

  <table class="info-tbl">
    <colgroup>
      <col style="width:6%;"><col style="width:23%;"><col style="width:7%;"><col style="width:10%;"><col style="width:8%;"><col style="width:10%;"><col style="width:12%;"><col style="width:12%;"><col style="width:6%;"><col style="width:6%;"><col style="width:7%;"><col style="width:11%;">
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

  <table style="margin-bottom:0; border-top: none; border-bottom: none;">
    <colgroup>
      <col style="width:4.5%;"><col style="width:6.5%;"><col style="width:6.5%;"><col style="width:5%;"><col style="width:3.5%;"><col style="width:3.5%;"><col style="width:4.5%;"><col style="width:3.5%;"><col style="width:3.5%;"><col style="width:5%;"><col style="width:3.5%;"><col style="width:7.5%;"><col style="width:4%;"><col style="width:4.5%;"><col style="width:8%;"><col style="width:7%;"><col style="width:3.5%;"><col style="width:4%;">
    </colgroup>
    <thead>
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
        <th class="col-h1" rowspan="2">PMS/<br>Calibration</th>
        <th class="col-h1" rowspan="2">Calls<br>(Done/Assign)</th>
      </tr>
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
      <!-- TOTAL EXPENSE CLAIMED row -->
      <tr style="background:#fff3cd!important;">
        <td class="tot-lbl" colspan="5" style="text-align:center; border: 1.5px solid #000!important; text-transform:uppercase; background:#fff3cd!important;">
          TOTAL EXPENSE CLAIMED
        </td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important; text-align:center;">${gKM > 0 ? gKM.toFixed(1) : ""}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gTA > 0 ? gTA.toFixed(2) : ""}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gAuto > 0 ? gAuto.toFixed(2) : ""}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gDA > 0 ? gDA.toFixed(2) : ""}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gLocal > 0 ? gLocal.toFixed(2) : ""}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gHotel > 0 ? gHotel.toFixed(2) : ""}</td>
        <td class="tot-lbl" style="text-align:center; font-size:6.5pt; border: 1.5px solid #000!important; background:#fff3cd!important;">Other Total</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; background:#fff3cd!important;">${gOther > 0 ? gOther.toFixed(2) : ""}</td>
        <td class="tot-num" style="background:#fff3cd!important; font-weight:950; text-align:right; border: 1.5px solid #000!important;">${gTotal.toFixed(2)}</td>
        <td class="tot-lbl" style="border: 1.5px solid #000!important; background:#fff3cd!important;"></td>
        <td class="tot-lbl" style="border: 1.5px solid #000!important; font-size:6.5pt!important; text-align:center; font-weight:bold; background:#fff3cd!important;">
          ${gAssetQty > 0 ? `Qty: ${gAssetQty} | ₹${gAssetVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ""}
        </td>
        <td class="tot-num" style="border: 1.5px solid #000!important; text-align:center; font-weight:bold; background:#fff3cd!important;">${gPMSCalib}</td>
        <td class="tot-num" style="border: 1.5px solid #000!important; text-align:center; font-weight:bold; background:#fff3cd!important;">${gCallsC}/${gCallsA}</td>
      </tr>
      <!-- ADVANCES ROW -->
      <tr>
        <td colspan="13" style="border: 1.5px solid #000!important; background:#fff!important; font-weight:900; text-align:center; padding:5px 6px; font-size:8pt; text-transform:uppercase;">
          ADVANCES
        </td>
        <td style="border: 1.5px solid #000!important; background:#fff!important; font-weight:950; text-align:center; font-size:8.5pt!important;">
          ${advance > 0 ? Math.round(advance) : ""}
        </td>
        <td colspan="4" style="border: 1.5px solid #000!important; background:#fff!important;"></td>
      </tr>
      <!-- NET PAYABLE ROW -->
      <tr style="background:#dcdcdc!important;">
        <td class="net-lbl" colspan="13" style="border: 1.5px solid #000!important; background:#dcdcdc!important;">NET PAYABLE</td>
        <td class="net-val" style="font-weight:950; font-size:8.5pt!important; border: 1.5px solid #000!important; background:#dcdcdc!important;">${Math.round(gTotal - advance)}</td>
        <td colspan="4" style="border: 1.5px solid #000!important; background:#dcdcdc!important;"></td>
      </tr>
    </tfoot>
  </table>

  <!-- ══ AMOUNT IN WORDS ══ -->
  <div class="awords-box">
    Amount in words (including all pages): <strong>${amountWords(gTotal - advance).toUpperCase()}</strong>
  </div>

  <!-- ══ REMARKS ══ -->
  <div class="remarks-box">
    REMARKS: APPROVED
  </div>

  <!-- ══ SIGNATURES GRID (Image 3 simple style) ══ -->
  <table class="sig-tbl">
    <colgroup>
      <col style="width:25%;"><col style="width:25%;"><col style="width:25%;"><col style="width:25%;">
    </colgroup>
    <tr>
      <td class="sig-lbl">Claimed By: <strong>${user.name}</strong></td>
      <td class="sig-lbl">Approved By:<br><strong>${user.manager || ""}</strong></td>
      <td class="sig-lbl">Checked By: (Verifier)<br><strong>${user.coordinator || ""}</strong></td>
      <td class="sig-lbl" style="border-right:none;">Accounted By: (Accounts)<br><strong>Amit Rawat</strong></td>
    </tr>
    <tr>
      <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
      <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
      <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
      <td class="sig-val" style="border-right:none;">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
    </tr>
  </table>

  <!-- ══ ATTACHED RECEIPTS SECTION ══ -->
  ${attachmentsSection}

</div>
</body>
</html>`;
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function MonthSummaryPage() {
  const [data, setData] = useState<any[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal states
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceModalConfig, setAdvanceModalConfig] = useState<{
    title: string;
    description: string;
    initialValue: number;
    userCode: string;
    month: string;
    year: number;
    row?: any;
    onSave: (amount: number) => Promise<void>;
  } | null>(null);
  const [advanceAmountInput, setAdvanceAmountInput] = useState("0");

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const roleLower = (currentUser.role || "").toLowerCase().trim();
  const isAllowedAdvance = ["coordinator", "accountant", "travel desk", "admin", "superadmin"].includes(roleLower);

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

  const generateSinglePDF = async (row: any, advance: number) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    const tid = toast.loading(`Fetching data for ${row.name}…`);
    try {
      const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
      const user = res.user || row;
      const claims = res.claims || [];
      const attachments = res.attachments || [];
      if (claims.length === 0) { toast.dismiss(tid); toast.error("No approved claim data found"); return; }
      const html = buildExcelPrintHTML(user, claims, attachments, advance);
      const win = window.open("", "_blank", "width=1400,height=900");
      if (!win) { toast.dismiss(tid); toast.error("Allow popups to download PDF"); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => setTimeout(() => win.print(), 600);
      toast.dismiss(tid);
      toast.success(`PDF ready — ${row.name} (${row.month} ${row.year})`);
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.detail || "PDF generation failed");
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handlePDF = async (row: any) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    const tid = toast.loading("Checking advance details...");
    
    let savedAdvance = 0;
    let exists = false;
    try {
      const resAdv = await expenseService.getEngineerAdvance(row.user_id, row.month, row.year);
      if (resAdv && resAdv.success) {
        savedAdvance = resAdv.advance_amount || 0;
        exists = !!resAdv.exists;
      }
    } catch (e) {
      console.error(e);
    } finally {
      toast.dismiss(tid);
      setPdfLoadingId(null);
    }

    if (exists || !isAllowedAdvance) {
      await generateSinglePDF(row, savedAdvance);
    } else {
      setAdvanceAmountInput("0");
      setAdvanceModalConfig({
        title: "Set Monthly Advance",
        description: `Enter Advance Amount (₹) for ${row.name} for ${row.month} ${row.year}. This will be saved to the database and won't prompt again.`,
        initialValue: 0,
        userCode: row.user_id,
        month: row.month,
        year: row.year,
        onSave: async (amount: number) => {
          const saveTid = toast.loading("Saving advance amount...");
          try {
            await expenseService.saveEngineerAdvance(row.user_id, row.month, row.year, amount);
            toast.success("Advance saved to database");
          } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to save advance");
          } finally {
            toast.dismiss(saveTid);
          }
          await generateSinglePDF(row, amount);
        }
      });
      setShowAdvanceModal(true);
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

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedKeys(filtered.map(r => `${r.user_id}-${r.month}-${r.year}`));
    } else {
      setSelectedKeys([]);
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    if (checked) {
      setSelectedKeys(prev => [...prev, key]);
    } else {
      setSelectedKeys(prev => prev.filter(k => k !== key));
    }
  };

  const generateBulkPrintCombined = (fetched: any[], advancesMap: Record<string, number>) => {
    let combinedBody = "";
    let combinedStyles = "";
    let first = true;

    for (const item of fetched) {
      const user = item.res.user || item.row;
      const claims = item.res.claims || [];
      const attachments = item.res.attachments || [];
      if (claims.length === 0) continue;

      const key = `${item.row.user_id}-${item.row.month}-${item.row.year}`;
      const advance = advancesMap[key] || 0;

      const html = buildExcelPrintHTML(user, claims, attachments, advance);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const bodyContent = doc.querySelector(".wrap")?.innerHTML || "";
      const styleContent = doc.querySelector("style")?.innerHTML || "";
      
      if (first) {
        combinedStyles = styleContent;
        first = false;
      }

      combinedBody += `
        <div class="wrap" style="page-break-after: always; min-height: 100vh; box-sizing: border-box; padding: 4mm;">
          ${bodyContent}
        </div>
      `;
    }

    if (!combinedBody) {
      toast.error("No valid claim data found to print");
      return;
    }

    const combinedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bulk Expense Reimbursement Sheet</title>
  <style>
    ${combinedStyles}
    @media print {
      .wrap {
        page-break-after: always!important;
        break-after: page!important;
      }
    }
  </style>
</head>
<body>
  ${combinedBody}
</body>
</html>`;

    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) { toast.error("Allow popups to print"); return; }
    win.document.write(combinedHTML);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 800);
    toast.success(`Print preview loaded for ${fetched.length} claims`);
  };

  const handleBulkPrintCombined = async () => {
    if (selectedKeys.length === 0) return;
    const tid = toast.loading(`Checking advance details and fetching data…`);
    try {
      const fetched: any[] = [];
      const advancesMap: Record<string, number> = {};
      const keysWithNoAdvance: any[] = [];

      const promises = selectedKeys.map(async (key) => {
        const row = data.find(r => `${r.user_id}-${r.month}-${r.year}` === key);
        if (!row) return;
        try {
          const [claimRes, advRes] = await Promise.all([
            expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year),
            expenseService.getEngineerAdvance(row.user_id, row.month, row.year)
          ]);
          fetched.push({ row, res: claimRes });
          const amt = advRes?.advance_amount || 0;
          const exists = !!advRes?.exists;
          advancesMap[key] = amt;
          if (!exists) {
            keysWithNoAdvance.push({ row, key });
          }
        } catch (e) {
          console.error(e);
        }
      });

      await Promise.all(promises);
      toast.dismiss(tid);

      if (fetched.length === 0) {
        toast.error("Failed to load claims for selected engineers");
        return;
      }

      if (keysWithNoAdvance.length > 0 && isAllowedAdvance) {
        setAdvanceAmountInput("0");
        setAdvanceModalConfig({
          title: "Set Default Advance",
          description: `You selected ${selectedKeys.length} claims, and ${keysWithNoAdvance.length} of them have no saved advance. Enter a default advance (₹) to save in the database for these ${keysWithNoAdvance.length} engineers:`,
          initialValue: 0,
          userCode: "BULK",
          month: "",
          year: 0,
          onSave: async (amount: number) => {
            const saveTid = toast.loading("Saving advances...");
            try {
              const savePromises = keysWithNoAdvance.map(item => 
                expenseService.saveEngineerAdvance(item.row.user_id, item.row.month, item.row.year, amount)
              );
              await Promise.all(savePromises);
              keysWithNoAdvance.forEach(item => {
                advancesMap[item.key] = amount;
              });
              toast.success("Advances saved successfully");
            } catch (err) {
              console.error(err);
              toast.error("Failed to save default advances");
            } finally {
              toast.dismiss(saveTid);
            }
            generateBulkPrintCombined(fetched, advancesMap);
          }
        });
        setShowAdvanceModal(true);
      } else {
        generateBulkPrintCombined(fetched, advancesMap);
      }
    } catch (err) {
      toast.dismiss(tid);
      toast.error("Bulk print generation failed");
    }
  };

  const generateBulkDownloadIndividual = (fetched: any[], advancesMap: Record<string, number>) => {
    fetched.forEach((item, index) => {
      setTimeout(() => {
        const user = item.res.user || item.row;
        const claims = item.res.claims || [];
        const attachments = item.res.attachments || [];
        if (claims.length === 0) return;

        const key = `${item.row.user_id}-${item.row.month}-${item.row.year}`;
        const advance = advancesMap[key] || 0;

        const html = buildExcelPrintHTML(user, claims, attachments, advance);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeName = (user.name || "Engineer").replace(/[^a-zA-Z0-9]/g, "_");
        const safeMonth = (user.month || "Month").replace(/[^a-zA-Z0-9]/g, "_");
        a.download = `${safeName}_${user.e_code || user.user_id}_${safeMonth}_${user.year}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, index * 350);
    });
    toast.success(`Started downloading ${fetched.length} files successfully!`);
  };

  const handleBulkDownloadIndividual = async () => {
    if (selectedKeys.length === 0) return;
    const tid = toast.loading(`Checking advance details and fetching data…`);
    try {
      const fetched: any[] = [];
      const advancesMap: Record<string, number> = {};
      const keysWithNoAdvance: any[] = [];

      const promises = selectedKeys.map(async (key) => {
        const row = data.find(r => `${r.user_id}-${r.month}-${r.year}` === key);
        if (!row) return;
        try {
          const [claimRes, advRes] = await Promise.all([
            expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year),
            expenseService.getEngineerAdvance(row.user_id, row.month, row.year)
          ]);
          fetched.push({ row, res: claimRes });
          const amt = advRes?.advance_amount || 0;
          const exists = !!advRes?.exists;
          advancesMap[key] = amt;
          if (!exists) {
            keysWithNoAdvance.push({ row, key });
          }
        } catch (e) {
          console.error(e);
        }
      });

      await Promise.all(promises);
      toast.dismiss(tid);

      if (fetched.length === 0) {
        toast.error("Failed to load claims for selected engineers");
        return;
      }

      if (keysWithNoAdvance.length > 0 && isAllowedAdvance) {
        setAdvanceAmountInput("0");
        setAdvanceModalConfig({
          title: "Set Default Advance",
          description: `You selected ${selectedKeys.length} claims, and ${keysWithNoAdvance.length} of them have no saved advance. Enter a default advance (₹) to save in the database for these ${keysWithNoAdvance.length} engineers:`,
          initialValue: 0,
          userCode: "BULK",
          month: "",
          year: 0,
          onSave: async (amount: number) => {
            const saveTid = toast.loading("Saving advances...");
            try {
              const savePromises = keysWithNoAdvance.map(item => 
                expenseService.saveEngineerAdvance(item.row.user_id, item.row.month, item.row.year, amount)
              );
              await Promise.all(savePromises);
              keysWithNoAdvance.forEach(item => {
                advancesMap[item.key] = amount;
              });
              toast.success("Advances saved successfully");
            } catch (err) {
              console.error(err);
              toast.error("Failed to save default advances");
            } finally {
              toast.dismiss(saveTid);
            }
            generateBulkDownloadIndividual(fetched, advancesMap);
          }
        });
        setShowAdvanceModal(true);
      } else {
        generateBulkDownloadIndividual(fetched, advancesMap);
      }
    } catch (err) {
      toast.dismiss(tid);
      toast.error("Bulk download failed");
    }
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1 */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#007bff]">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Engineers</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{totalEngineers}</span>
            <span className="text-[9px] text-[#007bff] font-bold uppercase block mt-1">Active Staff</span>
          </div>
        </div>
        {/* Box 2 */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#28a745]">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Approved Claims</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{totalClaims}</span>
            <span className="text-[9px] text-[#28a745] font-bold uppercase block mt-1">Processed</span>
          </div>
        </div>
        {/* Box 3 */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#ffc107]">
            <IndianRupee className="w-5 h-5 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Total Amount</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{fmt(totalAmount)}</span>
            <span className="text-[9px] text-amber-600 font-bold uppercase block mt-1">Disbursed</span>
          </div>
        </div>
        {/* Box 4 */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#605ca8]">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Total Distance</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{fmtN(totalKM)} km</span>
            <span className="text-[9px] text-[#605ca8] font-bold uppercase block mt-1">Travelled</span>
          </div>
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
          <div className="flex items-center gap-3">
            {selectedKeys.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1 rounded-sm animate-fadeIn">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  {selectedKeys.length} Selected
                </span>
                <button onClick={handleBulkPrintCombined}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-sm cursor-pointer transition-all">
                  <Printer className="w-3 h-3" /> Print Combined
                </button>
                <button onClick={handleBulkDownloadIndividual}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold shadow-sm cursor-pointer transition-all">
                  <Download className="w-3 h-3" /> Download HTMLs
                </button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search..."
                className="pl-8 pr-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-44" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8">
              <Loader message="Loading summary records..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-10 h-10 text-gray-250 mx-auto mb-3" />
              <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">No matching summary records found</p>
              <p className="text-gray-450 text-[11px] mt-1">Make sure filters are correct and claims have been approved.</p>
            </div>
          ) : (
            <>
              <table className="hidden md:table w-full text-left table-auto min-w-[1050px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold tracking-wider text-gray-600 font-sans">
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center w-10">
                    <input type="checkbox"
                      checked={filtered.length > 0 && selectedKeys.length === filtered.length}
                      onChange={handleSelectAll}
                      className="cursor-pointer rounded" />
                  </th>
                  <th className="py-2.5 px-3 border-r border-gray-200">#</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Engineer Details</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">E-Code</th>
                  <th className="py-2.5 px-3 border-r border-gray-200">Base District</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right">Claimed (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right text-green-700 bg-green-50/10">Approved (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right text-rose-700 bg-rose-50/10">Rejected (₹)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center text-blue-700">Calls (Comp/Assg)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center text-indigo-700">PMS Count</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center text-amber-700">Asset Tagging</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center">Month</th>
                  <th className="py-2.5 px-3 text-center">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filtered.map((row, idx) => {
                  const key = `${row.user_id}-${row.month}-${row.year}`;
                  const isLoading = pdfLoadingId === key;
                  return (
                    <tr key={key} className="hover:bg-blue-50/20 transition-colors border-b border-gray-150">
                      <td className="py-3 px-3 border-r border-gray-150 text-center w-10">
                        <input type="checkbox"
                          checked={selectedKeys.includes(key)}
                          onChange={(e) => handleSelectRow(key, e.target.checked)}
                          className="cursor-pointer rounded" />
                      </td>
                      <td className="py-3 px-3 text-gray-400 font-mono font-bold border-r border-gray-150">{idx + 1}</td>
                      <td className="py-3 px-3 border-r border-gray-150 font-sans">
                        <div className="font-bold text-gray-800">{row.name}</div>
                        <div className="text-[10px] text-gray-500 font-semibold uppercase">{row.designation}</div>
                      </td>
                      <td className="py-3 px-3 border-r border-gray-150">
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">{row.e_code}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-700 font-semibold border-r border-gray-150">{row.district || "—"}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-650 border-r border-gray-150">
                        {fmt(row.claimed_amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-green-700 bg-green-50/20 border-r border-gray-150">
                        {fmt(row.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-700 bg-rose-50/10 border-r border-gray-150">
                        {row.rejected_amount > 0 ? fmt(row.rejected_amount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-gray-700 border-r border-gray-150">
                        {row.calls_assigned > 0 ? `${row.calls_completed}/${row.calls_assigned}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-gray-700 border-r border-gray-150">
                        {row.pms_count || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-gray-700 border-r border-gray-150">
                        {row.asset_tagging_count || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 border-r border-gray-150 text-center">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">{row.month} {row.year}</span>
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
                    <td className="border-r border-gray-150" />
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

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-3">
              {filtered.map((row) => {
                const key = `${row.user_id}-${row.month}-${row.year}`;
                const isLoading = pdfLoadingId === key;
                return (
                  <div
                    key={key}
                    className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 shadow-sm text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key)}
                          onChange={(e) => handleSelectRow(key, e.target.checked)}
                          className="cursor-pointer rounded h-4 w-4"
                        />
                        <div>
                          <div className="font-bold text-gray-800 leading-tight">{row.name}</div>
                          <span className="text-[9px] text-gray-500 font-semibold uppercase">{row.designation}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">{row.e_code}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-gray-150 pt-2.5">
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Base District</span>
                        <span className="text-gray-700 font-semibold">{row.district || "—"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Month</span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">{row.month} {row.year}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Claimed / Approved / Rejected</span>
                        <span className="text-gray-800 font-bold leading-tight block">
                          Claimed: <span className="text-blue-650">{fmt(row.claimed_amount)}</span>
                        </span>
                        <span className="text-green-700 font-bold leading-tight block">
                          Approved: {fmt(row.total_amount)}
                        </span>
                        {row.rejected_amount > 0 && (
                          <span className="text-rose-700 font-bold leading-tight block">
                            Rejected: {fmt(row.rejected_amount)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Tasks Metrics</span>
                        <span className="text-gray-700 block mt-0.5">Calls: {row.calls_assigned > 0 ? `${row.calls_completed}/${row.calls_assigned}` : "—"}</span>
                        <span className="text-gray-700 block">PMS: {row.pms_count || "—"}</span>
                        <span className="text-gray-700 block">Tagging: {row.asset_tagging_count || "—"}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-150 pt-3.5 flex justify-end">
                      <button onClick={() => handlePDF(row)} disabled={isLoading}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60 border-0 active:scale-95"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>Download PDF Form</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {showAdvanceModal && advanceModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden border border-gray-200 animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-[#1e3a8a] text-white px-4 py-3 flex justify-between items-center">
              <h3 className="text-sm font-bold tracking-wide uppercase m-0 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" /> {advanceModalConfig.title}
              </h3>
              <button 
                onClick={() => setShowAdvanceModal(false)}
                className="text-white/80 hover:text-white font-bold text-lg leading-none cursor-pointer border-0 bg-transparent"
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                {advanceModalConfig.description}
              </p>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Advance Amount (₹)
                </label>
                <input
                  type="number"
                  value={advanceAmountInput}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            {/* Modal Footer */}
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-xs font-bold hover:bg-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const amount = parseFloat(advanceAmountInput) || 0;
                  setShowAdvanceModal(false);
                  await advanceModalConfig.onSave(amount);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 cursor-pointer"
              >
                Save & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
