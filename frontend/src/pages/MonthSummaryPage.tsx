import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import {
  Calendar, Download, RefreshCw, Users, CheckCircle,
  IndianRupee, MapPin, Search, Filter, FileText, Loader2, Printer, X
} from "lucide-react";
import Loader from "../components/common/Loader";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getAbsoluteUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  
  const envBaseURL = import.meta.env.VITE_API_URL || "";
  let host = "";
  if (envBaseURL) {
    host = envBaseURL.replace(/\/api$/, "");
  } else {
    const baseURL = api.defaults.baseURL || "";
    if (baseURL.startsWith("http://") || baseURL.startsWith("https://")) {
      host = baseURL.replace(/\/api$/, "");
    } else {
      host = window.location.origin;
    }
  }
  return `${host}/${path.replace(/^\//, "")}`;
};

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(script);
  });
};

const convertPdfToImageBase64 = async (pdfUrlOrBase64: string): Promise<string> => {
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js");
    const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"] || (window as any).pdfjsLib;
    if (!pdfjsLib) return pdfUrlOrBase64;
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

    const loadingTask = pdfjsLib.getDocument(pdfUrlOrBase64);
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.95);
  } catch (e) {
    console.warn("Failed to render PDF to image via pdf.js:", e);
    return pdfUrlOrBase64;
  }
};

const convertImageUrlToBase64 = async (url: string): Promise<string> => {
  if (!url) return "";
  if (url.startsWith("data:image/")) return url;
  try {
    const absUrl = getAbsoluteUrl(url);
    const cleanUrl = url.toLowerCase().split("?")[0];
    const isPdf = cleanUrl.endsWith(".pdf") || url.startsWith("data:application/pdf");

    if (isPdf) {
      return await convertPdfToImageBase64(absUrl);
    }

    const response = await fetch(absUrl);
    if (!response.ok) return absUrl;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || absUrl);
      reader.onerror = () => resolve(absUrl);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return getAbsoluteUrl(url);
  }
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
  if (n < 0) return "Negative " + numberToWords(Math.abs(n));
  if (n === 0) return "Zero";
  if (n < 20) return a[n];
  if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
  return numberToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numberToWords(n % 10000000) : "");
}
function amountWords(amount: number): string {
  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);
  let w = (amount < 0 ? "Negative " : "") + "Rupees " + numberToWords(rupees);
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

function buildExcelPrintHTML(user: any, claims: any[], attachments: any[] = [], advance: number = 0, autoPrint: boolean = false): string {
  // Flatten: one row per leg, ensuring ONLY APPROVED amounts are included
  const allLegs: { date: string; expCode: string; leg: any }[] = [];
  for (const claim of claims) {
    const claimStat = String(claim.status || "").toLowerCase();
    if (claimStat && claimStat !== "approved" && claimStat !== "auto_approved" && claimStat !== "auto-approved") {
      // Skip non-approved claims
      continue;
    }
    for (const rawLeg of (claim.legs || [])) {
      const legStat = String(rawLeg.status || "").toLowerCase();
      if (legStat === "rejected") continue;

      // Extract strictly approved amounts (including Bus / Train travel fare amounts)
      const mode = String(rawLeg.travel_mode || "").toLowerCase();
      const isBusOrTrain = mode.includes("bus") || mode.includes("train") || mode === "b" || mode === "t";

      const getTAAmount = () => {
        if (rawLeg.approved_ta_amount !== undefined && rawLeg.approved_ta_amount !== null && parseFloat(rawLeg.approved_ta_amount) > 0) return parseFloat(rawLeg.approved_ta_amount);
        if (rawLeg.ta_amount !== undefined && rawLeg.ta_amount !== null && parseFloat(rawLeg.ta_amount) > 0) return parseFloat(rawLeg.ta_amount);
        if (rawLeg.approved_travel_amount !== undefined && rawLeg.approved_travel_amount !== null && parseFloat(rawLeg.approved_travel_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.approved_travel_amount);
        if (rawLeg.travel_amount !== undefined && rawLeg.travel_amount !== null && parseFloat(rawLeg.travel_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.travel_amount);
        if (rawLeg.approved_sub_amount !== undefined && rawLeg.approved_sub_amount !== null && parseFloat(rawLeg.approved_sub_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.approved_sub_amount);
        if (rawLeg.sub_amount !== undefined && rawLeg.sub_amount !== null && parseFloat(rawLeg.sub_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.sub_amount);
        return 0;
      };

      const leg = {
        ...rawLeg,
        ta_amount: getTAAmount(),
        bike_amount: rawLeg.approved_bike_amount !== undefined ? parseFloat(rawLeg.approved_bike_amount || 0) : parseFloat(rawLeg.bike_amount || 0),
        car_amount: rawLeg.approved_car_amount !== undefined ? parseFloat(rawLeg.approved_car_amount || 0) : parseFloat(rawLeg.car_amount || 0),
        auto_amount: rawLeg.approved_auto_amount !== undefined ? parseFloat(rawLeg.approved_auto_amount || 0) : parseFloat(rawLeg.auto_amount || 0),
        da_amount: rawLeg.approved_da_amount !== undefined ? parseFloat(rawLeg.approved_da_amount || 0) : parseFloat(rawLeg.da_amount || 0),
        local_purchase: rawLeg.approved_local_purchase !== undefined ? parseFloat(rawLeg.approved_local_purchase || 0) : parseFloat(rawLeg.local_purchase || 0),
        hotel_amount: rawLeg.approved_hotel_amount !== undefined ? parseFloat(rawLeg.approved_hotel_amount || 0) : parseFloat(rawLeg.hotel_amount || 0),
        other_amount: rawLeg.approved_other_amount !== undefined ? parseFloat(rawLeg.approved_other_amount || 0) : parseFloat(rawLeg.other_amount || 0),
      };

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
        if (details && typeof details === 'object') {
          acts = details.selected_activities || [];
          actOtherDesc = details.activity_other_desc || "";
        }
      } catch (e) {}
    }
    
    const visitPurposeStr = String(l.visit_purpose || "");
    if ((!Array.isArray(acts) || acts.length === 0) && visitPurposeStr) {
      let clean = visitPurposeStr;
      if (clean.startsWith("Activities: ")) {
        clean = clean.replace("Activities: ", "");
      }
      acts = clean.split(",").map((s: string) => s.trim());
    }

    const finalActs = Array.isArray(acts) ? acts : [];
    finalActs.forEach((act: string) => {
      const actClean = act.trim();
      if (l.other_desc && actClean === l.other_desc.trim()) return;

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
        // Skip
      } else if (actClean && actClean !== "Field visit") {
        parts.push(actClean);
      }
    });

    if (actOtherDesc && actOtherDesc.trim()) parts.push(actOtherDesc.trim());

    if (parts.length === 0) {
      const cleanPurpose = l.visit_purpose && !visitPurposeStr.startsWith("Activities:") ? visitPurposeStr : "Field visit";
      if (l.other_desc && cleanPurpose.trim() === l.other_desc.trim()) return "Field visit";
      return cleanPurpose;
    }
    return parts.join(", ");
  };

  const getActivityOtherDesc = (l: any) => l.other_desc || "";

  // ── mode abbreviation ──
  const modeAbbr = (m: string) => {
    if (!m) return "";
    const map: Record<string, string> = {
      "Train": "T", "Bus": "B", "Bike": "Bi", "Car": "C", "Auto": "A",
      "train": "T", "bus": "B", "bike": "Bi", "car": "C", "auto": "A",
    };
    return map[m] || m;
  };

  // Collect ALL financial bill attachments
  const allAttachmentsMap = new Map<string, { url: string; date: string; label: string }>();

  // 1. Top-level attachments array from backend
  (attachments || []).forEach((att: any, idx: number) => {
    const rawUrl = att.file_url || att.url || (typeof att === "string" ? att : "");
    if (rawUrl && !allAttachmentsMap.has(rawUrl)) {
      allAttachmentsMap.set(rawUrl, {
        url: rawUrl,
        date: att.date ? fmtDate(att.date) : `Bill #${idx + 1}`,
        label: att.bill_type || att.billType || "Expense Bill Attachment"
      });
    }
  });

  // 2. Scan claims and legs for any attachment URLs (hotel, local purchase, other bills, travel tickets, etc.)
  (claims || []).forEach((claim: any) => {
    const claimDate = claim.date ? fmtDate(claim.date) : "";
    (claim.legs || []).forEach((leg: any) => {
      const candidateFields = [
        { key: "hotel_receipt", label: "Hotel Bill Receipt" },
        { key: "local_purchase_bill", label: "Local Purchase Bill" },
        { key: "other_bill", label: "Other Expense Bill" },
        { key: "receipt_url", label: "Travel / Bill Receipt" },
        { key: "bill_url", label: "Travel Ticket" },
        { key: "attachment_url", label: "Expense Bill Attachment" },
        { key: "file_url", label: "Expense Bill Attachment" },
        { key: "bill_copy", label: "Expense Bill Copy" },
        { key: "receipt", label: "Bill Receipt" }
      ];

      candidateFields.forEach(field => {
        const u = leg[field.key];
        if (u && typeof u === 'string' && u.trim() && !allAttachmentsMap.has(u)) {
          allAttachmentsMap.set(u, { url: u, date: claimDate, label: field.label });
        }
      });

      if (Array.isArray(leg.attachments)) {
        leg.attachments.forEach((aItem: any, aIdx: number) => {
          const aUrl = typeof aItem === "string" ? aItem : (aItem.file_url || aItem.url);
          if (aUrl && !allAttachmentsMap.has(aUrl)) {
            allAttachmentsMap.set(aUrl, { url: aUrl, date: claimDate, label: aItem.bill_type || `Bill Attachment #${aIdx + 1}` });
          }
        });
      }
    });
  });

  const finalAttachments = Array.from(allAttachmentsMap.values());

  // Attached receipts HTML block — 1 dedicated full page per bill attachment!
  let attachmentsSection = "";
  if (finalAttachments.length > 0) {
    attachmentsSection = finalAttachments.map((att: any, index) => {
      const rawUrl = att.url;
      const absoluteUrl = getAbsoluteUrl(rawUrl);
      const dateStr = att.date || `Receipt #${index + 1}`;
      const attLabel = att.label || "Expense Bill Attachment";

      return `
        <div class="attachment-page" style="width:1122px;height:793px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 20px;box-sizing:border-box;background:#fff;overflow:hidden;page-break-before:always;">
          <div style="width:100%;max-width:1080px;max-height:750px;border:2px solid #1565C0;border-radius:6px;padding:12px 16px;background:#fff;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="width:100%;font-size:11pt;font-weight:900;color:#1565C0;text-align:left;border-bottom:2px solid #1565C0;padding-bottom:6px;margin-bottom:12px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">
              ${attLabel.toUpperCase()} &mdash; DATE: ${dateStr}
            </div>
            <img src="${absoluteUrl}" style="max-width:100%;max-height:660px;object-fit:contain;border:1px solid #ccc;display:block;margin:0 auto;" alt="Attachment ${dateStr}" />
          </div>
        </div>
      `;
    }).join("\n");
  }

  // ── Split expense table into multi-page chunks (14 rows per page) ──
  const ROWS_PER_PAGE = 14;
  const numPages = Math.max(1, Math.ceil(allLegs.length / ROWS_PER_PAGE));

  let summaryPagesHtml = "";
  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const isLastPage = pageIdx === numPages - 1;
    const pageLegs = allLegs.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);

    const pageRowsHtml = pageLegs.map((r, i) => {
      const l = r.leg || {};
      const taCol   = l.ta_amount || 0;
      const bikeCarAmt = (l.bike_amount || 0) + (l.car_amount || 0);
      const rowTotal = taCol + bikeCarAmt + (l.auto_amount || 0) + (l.da_amount || 0)
                     + (l.local_purchase || 0) + (l.hotel_amount || 0) + (l.other_amount || 0);
      const bg = i % 2 === 0 ? "#ffffff" : "#f0f7ff";
      const c = `border:1px solid #000!important;padding:4px 5px;font-size:8.5pt;font-weight:600;color:#000;vertical-align:middle;word-wrap:break-word;`;
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
        <td style="${c}font-size:8.5pt;">${getActivityOtherDesc(l)}</td>
        <td style="${c}text-align:right;">${l.other_amount > 0 ? l.other_amount.toFixed(2) : ""}</td>
        <td style="${c}text-align:right;font-weight:800;background:#e8f5e9!important;">${rowTotal > 0 ? rowTotal.toFixed(2) : ""}</td>
        <td style="${c}font-size:8.5pt;">${getFormattedPurpose(l)}</td>
        <td style="${c}font-size:8pt;font-family:monospace;">${l.barcode_ticket || ""}</td>
        <td style="${c}text-align:center;">${pmsCalibCount}</td>
        <td style="${c}text-align:center;">${l.calls_completed || 0}/${l.calls_assigned || 0}</td>
      </tr>`;
    }).join("\n");

    summaryPagesHtml += `
    <div class="wrap summary-page" style="width:1122px;min-height:793px;padding:4mm;background:#fff;box-sizing:border-box;margin-bottom:0;page-break-after:always;">
      <table style="margin-bottom:0;">
        <colgroup><col style="width:10%;"><col style="width:65%;"><col style="width:25%;"></colgroup>
        <tr>
          <td style="background:#fff!important;border:2px solid #0d1557;padding:0;text-align:center;vertical-align:middle;height:32px;overflow:hidden;">
            <img src="${window.location.origin}/brand.png" style="height:100%; max-height:32px; width:100%; object-fit:contain; display:block; margin:0 auto;" alt="Logo" />
          </td>
          <td class="main-hdr">CYRIX &mdash; EXPENSES REIMBURSEMENT FORM ${numPages > 1 ? `(PAGE ${pageIdx + 1} OF ${numPages})` : ""}</td>
          <td style="background:#1a237e!important;color:#fff!important;border:2px solid #0d1557;padding:4px 8px;font-size:8pt;font-weight:bold;text-align:center;vertical-align:middle;">
            <div>Month-Year: ${user.month.toUpperCase().substring(0,3)} ${user.year}</div>
          </td>
        </tr>
      </table>

      <table class="info-tbl">
        <colgroup><col style="width:6%;"><col style="width:23%;"><col style="width:7%;"><col style="width:10%;"><col style="width:8%;"><col style="width:10%;"><col style="width:12%;"><col style="width:12%;"><col style="width:6%;"><col style="width:6%;"><col style="width:7%;"><col style="width:11%;"></colgroup>
        <tr>
          <td class="info-lbl">NAME :</td><td class="info-val">${user.name}</td>
          <td class="info-lbl">EECode:</td><td class="info-val">${user.e_code}</td>
          <td class="info-lbl">PROJECT:</td><td class="info-val">RJBEMP</td>
          <td class="info-lbl">BASE LOCATION:</td><td class="info-val">${(user.district || "").toUpperCase()}</td>
          <td class="info-lbl">GRADE:</td><td class="info-val">${user.grade || "—"}</td>
          <td class="info-lbl">MOBILE:</td><td class="info-val" style="border-right:none;">${user.mobile || "—"}</td>
        </tr>
      </table>

      <table style="margin-bottom:0; border-top: none; border-bottom: none;">
        <colgroup><col style="width:4.5%;"><col style="width:6.5%;"><col style="width:6.5%;"><col style="width:5%;"><col style="width:3.5%;"><col style="width:3.5%;"><col style="width:4.5%;"><col style="width:3.5%;"><col style="width:3.5%;"><col style="width:5%;"><col style="width:3.5%;"><col style="width:7.5%;"><col style="width:4%;"><col style="width:4.5%;"><col style="width:8%;"><col style="width:7%;"><col style="width:3.5%;"><col style="width:4%;"></colgroup>
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
          ${pageRowsHtml || `<tr><td colspan="18" style="text-align:center;padding:14px;color:#888;font-style:italic;font-size:8pt;">No expense leg data found for this period.</td></tr>`}
        </tbody>
        ${isLastPage ? `
        <tfoot>
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
          <tr>
            <td colspan="13" style="border: 1.5px solid #000!important; background:#fff!important; font-weight:900; text-align:center; padding:5px 6px; font-size:8pt; text-transform:uppercase;">ADVANCES</td>
            <td style="border: 1.5px solid #000!important; background:#fff!important; font-weight:950; text-align:center; font-size:8.5pt!important;">${advance > 0 ? Math.round(advance) : ""}</td>
            <td colspan="4" style="border: 1.5px solid #000!important; background:#fff!important;"></td>
          </tr>
          <tr style="background:#dcdcdc!important;">
            <td class="net-lbl" colspan="13" style="border: 1.5px solid #000!important; background:#dcdcdc!important;">NET PAYABLE</td>
            <td class="net-val" style="font-weight:950; font-size:8.5pt!important; border: 1.5px solid #000!important; background:#dcdcdc!important;">${Math.round(gTotal - advance)}</td>
            <td colspan="4" style="border: 1.5px solid #000!important; background:#dcdcdc!important;"></td>
          </tr>
        </tfoot>
        ` : ""}
      </table>

      ${isLastPage ? `
        <div class="awords-box">Amount in words (including all pages): <strong>${amountWords(gTotal - advance).toUpperCase()}</strong></div>
        <div class="remarks-box">REMARKS: APPROVED</div>
        <table class="sig-tbl">
          <colgroup><col style="width:25%;"><col style="width:25%;"><col style="width:25%;"><col style="width:25%;"></colgroup>
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
      ` : `
        <div style="font-size:8pt;font-weight:bold;text-align:right;padding:8px 4px;color:#444;font-style:italic;">
          Summary continued on Page ${pageIdx + 2} of ${numPages} ...
        </div>
      `}
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
    /* Use system fonts — Google Fonts @import fails in cross-origin iframes causing html2canvas to collapse spaces */
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;word-spacing:normal!important;letter-spacing:normal!important;}
    body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;font-size:7.5pt;}
    .wrap{width:100%;padding:4mm;background:#fff;}
    table{width:100%;border-collapse:collapse;table-layout:fixed;}
    th,td{border:1px solid #222!important;padding:3.5px 4px;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word;}
    tbody tr{page-break-inside:avoid!important;break-inside:avoid!important;}
    .main-hdr{background:#1565C0!important;color:#fff!important;text-align:center;font-size:13pt!important;
      font-weight:900!important;word-spacing:normal!important;letter-spacing:normal!important;padding:6px!important;border:1px solid #0d3f7a!important;}
    .month-hdr{background:#1565C0!important;color:#fff!important;font-size:7.5pt!important;
      font-weight:800!important;text-align:right;padding:4px 8px!important;border:1px solid #0d3f7a!important;white-space:nowrap;}
    .form-no{background:#1565C0!important;color:#FFE082!important;font-size:7.5pt!important;
      font-weight:800!important;text-align:right;padding:4px 8px!important;border:1px solid #0d3f7a!important;white-space:nowrap;}
    .info-tbl{margin-bottom:0; border:1px solid #222!important; border-top: none!important;}
    .info-lbl{font-weight:800; background:#F5F5F5!important; color:#000; border-right:1px solid #222!important; font-size:7pt; text-align:left; padding:4px 6px; text-transform:uppercase; white-space:nowrap; word-spacing:normal!important;}
    .info-val{background:#fff!important; color:#1565C0!important; border-right:1px solid #222!important; font-size:7pt; text-align:left; padding:4px 6px; font-weight:900; white-space:pre-wrap; word-spacing:normal!important; letter-spacing:normal!important;}
    .col-h1{background:#1565C0!important;color:#fff!important;font-size:7pt!important;
      font-weight:800!important;text-align:center!important;padding:4.5px 2px!important;
      border:1px solid #0d3f7a!important;line-height:1.2;vertical-align:middle;}
    .col-h2{background:#1976D2!important;color:#fff!important;font-size:6.5pt!important;
      font-weight:800!important;text-align:center!important;padding:3.5px 2px!important;
      border:1px solid #0d3f7a!important;line-height:1.15;vertical-align:middle;}
    .tot-lbl{border:1px solid #222!important;padding:4px 5px;font-size:7pt;font-weight:900;color:#000;background:#FFF9C4!important;vertical-align:middle;}
    .tot-num{border:1px solid #222!important;padding:4px 5px;font-size:7pt;font-weight:900;color:#000;background:#FFF9C4!important;vertical-align:middle;text-align:right;}
    .net-lbl{border:1px solid #222!important;padding:5px 6px;font-size:7.5pt;font-weight:900;color:#000;background:#CFD8DC!important;text-align:center;text-transform:uppercase;}
    .net-val{border:1px solid #222!important;padding:5px 6px;font-size:8pt;font-weight:900;color:#000;background:#fff!important;text-align:center;}
    .awords-box{border:1px solid #222!important;border-top:none!important;padding:5px 8px;font-size:7pt;font-weight:600;color:#000;background:#fff!important;white-space:pre-wrap;word-spacing:normal!important;}
    .remarks-box{border:1px solid #222!important;border-top:none!important;padding:4px 8px;font-size:7pt;font-weight:800;color:#000;background:#fff!important;word-spacing:normal!important;}
    .sig-tbl{border:1px solid #222!important;border-top:none!important;}
    .sig-lbl{border-right:1px solid #222!important;padding:4px 6px;font-size:7pt;font-weight:700;color:#000;background:#fff!important;height:32px;vertical-align:top;white-space:pre-wrap;word-spacing:normal!important;}
    .sig-val{border-right:1px solid #222!important;padding:4px 6px;font-size:7pt;font-weight:600;color:#000;background:#fff!important;height:32px;vertical-align:bottom;word-spacing:normal!important;}
    .attachment-page{width:1122px!important;height:793px!important;overflow:hidden!important;}
    @page{size:A4 landscape;margin:6mm 7mm;}
    @media print{
      body{margin:0;padding:0;}
      .wrap{page-break-after:always;page-break-inside:avoid;}
      tbody tr{page-break-inside:avoid!important;break-inside:avoid!important;}
      .attachment-page{page-break-before:always!important;break-before:page!important;height:793px!important;page-break-inside:avoid!important;break-inside:avoid!important;overflow:hidden!important;}
    }
  </style>
</head>
<body>
${summaryPagesHtml}
${attachmentsSection}

  ${autoPrint ? `
  <script>
    (function() {
      function doPrint() {
        const images = Array.from(document.getElementsByTagName('img'));
        let loadedCount = 0;
        
        function trigger() {
          setTimeout(function() {
            try {
              window.print();
            } catch (e) {
              console.warn("Print failed:", e);
            }
          }, 350);
        }
        
        if (images.length === 0) {
          trigger();
        } else {
          images.forEach(function(img) {
            if (img.complete) {
              loadedCount++;
              if (loadedCount === images.length) trigger();
            } else {
              img.onload = function() {
                loadedCount++;
                if (loadedCount === images.length) trigger();
              };
              img.onerror = function() {
                loadedCount++;
                if (loadedCount === images.length) trigger();
              };
            }
          });
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        doPrint();
      } else {
        document.addEventListener('DOMContentLoaded', doPrint);
        window.addEventListener('load', doPrint);
        // Fallback safety timeout
        setTimeout(doPrint, 1500);
      }
    })();
  </script>
  ` : ""}
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

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };

  // Renders a full HTML document inside a hidden iframe, captures it with
  // html2canvas + jsPDF, and returns the PDF as a Blob.
  // Renders a full HTML document inside a hidden iframe, captures all pages (summary sheet + bill attachments),
  // converts with html2canvas + jsPDF, and returns a genuine multi-page A4 Landscape PDF Blob.
  const renderHTMLToPDFBlob = async (html: string): Promise<Blob> => {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    const { jsPDF } = (window as any).jspdf;
    const h2c = (window as any).html2canvas;

    const A4_W_CSS = 1122; // A4 landscape width at 96dpi
    const SCALE = 2;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = `${A4_W_CSS}px`;
    iframe.style.height = "10000px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "none";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iDoc) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      throw new Error("No iframe document available for PDF rendering");
    }

    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    // Wait for all embedded images / attachments to load
    await new Promise<void>((resolve) => {
      const imgs = Array.from(iDoc.getElementsByTagName("img"));
      if (imgs.length === 0) { setTimeout(resolve, 500); return; }
      let done = 0;
      const check = () => { done++; if (done >= imgs.length) setTimeout(resolve, 500); };
      imgs.forEach((img) => {
        if ((img as HTMLImageElement).complete) check();
        else { img.onload = check; img.onerror = check; }
      });
    });

    // Query ALL summary pages (Page 1 of N, Page 2 of N, Page 3 of N...) + ALL attachment pages (1 page per bill)
    const pagesToRender: HTMLElement[] = [];
    const summaryPages = Array.from(iDoc.querySelectorAll(".summary-page, .wrap")) as HTMLElement[];
    const uniqueSummaryPages = Array.from(new Set(summaryPages));
    pagesToRender.push(...uniqueSummaryPages);

    const attPages = Array.from(iDoc.querySelectorAll(".attachment-page")) as HTMLElement[];
    const uniqueAttPages = Array.from(new Set(attPages)).filter(el => !pagesToRender.includes(el));
    pagesToRender.push(...uniqueAttPages);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();   // 297 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm

    for (let i = 0; i < pagesToRender.length; i++) {
      const el = pagesToRender[i];
      const canvas = await h2c(el, {
        scale: SCALE,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: A4_W_CSS,
        height: el.offsetHeight || 793,
        scrollX: 0,
        scrollY: 0,
        windowWidth: A4_W_CSS,
        windowHeight: el.offsetHeight || 793,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) {
        pdf.addPage("a4", "landscape");
      }
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }

    return pdf.output("blob");
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

    const downloadPDFFile = async (amount: number) => {
      setPdfLoadingId(key);
      const downloadTid = toast.loading(`Generating PDF Document for ${row.name}...`);
      try {
        const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
        const userObj = res.user || row;
        const claims = res.claims || [];
        if (claims.length === 0) {
          toast.error("No approved claim data found");
          return;
        }

        const rawAttachments = res.attachments || [];
        const attachments = await Promise.all(
          rawAttachments.map(async (att: any) => {
            const rawUrl = att.file_url || att.url || (typeof att === "string" ? att : "");
            const base64Url = rawUrl ? await convertImageUrlToBase64(rawUrl) : "";
            return {
              ...att,
              file_url: base64Url || rawUrl,
              url: base64Url || rawUrl
            };
          })
        );

        for (const claim of claims) {
          for (const leg of (claim.legs || [])) {
            if (leg.hotel_receipt) leg.hotel_receipt = await convertImageUrlToBase64(leg.hotel_receipt);
            if (leg.local_purchase_bill) leg.local_purchase_bill = await convertImageUrlToBase64(leg.local_purchase_bill);
            if (leg.other_bill) leg.other_bill = await convertImageUrlToBase64(leg.other_bill);
            if (leg.receipt_url) leg.receipt_url = await convertImageUrlToBase64(leg.receipt_url);
            if (leg.bill_url) leg.bill_url = await convertImageUrlToBase64(leg.bill_url);
            if (leg.attachment_url) leg.attachment_url = await convertImageUrlToBase64(leg.attachment_url);
            if (leg.file_url) leg.file_url = await convertImageUrlToBase64(leg.file_url);
          }
        }

        const html = buildExcelPrintHTML(userObj, claims, attachments, amount, false);
        const filename = `${(userObj.name || "Engineer").replace(/[^a-zA-Z0-9]/g, "_")}_Expense_Summary_${row.month}_${row.year}.pdf`;
        const pdfBlob = await renderHTMLToPDFBlob(html);

        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`PDF document downloaded successfully!`);
      } catch (err) {
        toast.error("PDF generation failed");
        console.error(err);
      } finally {
        toast.dismiss(downloadTid);
        setPdfLoadingId(null);
      }
    };

    if (exists || !isAllowedAdvance) {
      await downloadPDFFile(savedAdvance);
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
          await downloadPDFFile(amount);
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
  <script>
    (function() {
      function doPrint() {
        const images = Array.from(document.getElementsByTagName('img'));
        let loadedCount = 0;
        
        function trigger() {
          setTimeout(function() {
            try {
              window.print();
            } catch (e) {
              console.warn("Print failed:", e);
            }
          }, 500);
        }
        
        if (images.length === 0) {
          trigger();
        } else {
          images.forEach(function(img) {
            if (img.complete) {
              loadedCount++;
              if (loadedCount === images.length) trigger();
            } else {
              img.onload = function() {
                loadedCount++;
                if (loadedCount === images.length) trigger();
              };
              img.onerror = function() {
                loadedCount++;
                if (loadedCount === images.length) trigger();
              };
            }
          });
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        doPrint();
      } else {
        document.addEventListener('DOMContentLoaded', doPrint);
        window.addEventListener('load', doPrint);
        // Fallback safety timeout
        setTimeout(doPrint, 1500);
      }
    })();
  </script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) { toast.error("Allow popups to print"); return; }
    win.document.write(combinedHTML);
    win.document.close();
    
    // Fallback print trigger directly on the popup window instance
    setTimeout(() => {
      try {
        if (win && !win.closed) {
          win.focus();
          win.print();
        }
      } catch (e) {
        console.warn("Direct popup print failed:", e);
      }
    }, 1500);

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

  const generateZIPBlob = async (fetched: any[], advancesMap: Record<string, number>) => {
    const tid = toast.loading("Generating Images and packing ZIP...");
    try {
      const zip = new (window as any).JSZip();
      
      for (const item of fetched) {
        const userObj = item.res.user || item.row;
        const claims = item.res.claims || [];
        const attachments = item.res.attachments || [];
        if (claims.length === 0) continue;

        const key = `${item.row.user_id}-${item.row.month}-${item.row.year}`;
        const advance = advancesMap[key] || 0;

        const html = buildExcelPrintHTML(userObj, claims, attachments, advance, false);
        const safeName = (userObj.name || "Engineer").replace(/[^a-zA-Z0-9]/g, "_");
        const safeMonth = (userObj.month || "Month").replace(/[^a-zA-Z0-9]/g, "_");
        const fileName = `${safeName}_${userObj.e_code || userObj.user_id}_${safeMonth}_${userObj.year}.pdf`;
        const pdfBlob = await renderHTMLToPDFBlob(html);
        zip.file(fileName, pdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Claims_Reports_${appliedFilters.month || "Selected"}_${appliedFilters.year || "2026"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(tid);
      toast.success("ZIP folder downloaded successfully!");
    } catch (e) {
      toast.dismiss(tid);
      toast.error("Failed to generate ZIP");
      console.error(e);
    }
  };

  const handleBulkDownloadZIP = async () => {
    if (selectedKeys.length === 0) return;
    const tid = toast.loading(`Preparing ZIP package and fetching claims data...`);
    try {
      await Promise.all([
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")
      ]);

      const fetched: any[] = [];
      const advancesMap: Record<string, number> = {};

      const promises = selectedKeys.map(async (key) => {
        const row = data.find(r => `${r.user_id}-${r.month}-${r.year}` === key);
        if (!row) return;
        try {
          const [claimRes, advRes] = await Promise.all([
            expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year),
            expenseService.getEngineerAdvance(row.user_id, row.month, row.year)
          ]);
          fetched.push({ row, res: claimRes });
          advancesMap[key] = advRes?.advance_amount || 0;
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

      generateZIPBlob(fetched, advancesMap);
    } catch (err) {
      toast.dismiss(tid);
      toast.error("Bulk ZIP generation failed");
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn font-sans pb-10 text-[#212529]">
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">MONTH SUMMARY REPORT</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Comprehensive monthly claim breakdown, field statistics, and PDF export center.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white bg-[#4A6A8A] px-2.5 py-1 rounded-none border border-[#4A6A8A] font-mono">
            Total Staff: <strong>{totalEngineers}</strong>
          </span>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-none border border-emerald-200 font-mono">
            Approved Claims: <strong>{totalClaims}</strong>
          </span>
          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-none border border-blue-200 font-mono">
            Total Value: <strong>{fmt(totalAmount)}</strong>
          </span>
        </div>
      </div>

      {/* 4 Enterprise Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Box 1 */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Engineers</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{totalEngineers}</span>
            <span className="text-[9px] text-[#4A6A8A] font-bold uppercase block mt-0.5">Active Staff</span>
          </div>
        </div>

        {/* Box 2 */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <CheckCircle className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Approved Claims</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{totalClaims}</span>
            <span className="text-[9px] text-emerald-700 font-bold uppercase block mt-0.5">Processed</span>
          </div>
        </div>

        {/* Box 3 */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-amber-600 flex items-center justify-center text-white shrink-0">
            <IndianRupee className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Amount</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{fmt(totalAmount)}</span>
            <span className="text-[9px] text-amber-700 font-bold uppercase block mt-0.5">Disbursed Value</span>
          </div>
        </div>

        {/* Box 4 */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-purple-600 flex items-center justify-center text-white shrink-0">
            <MapPin className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Distance</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{fmtN(totalKM)} km</span>
            <span className="text-[9px] text-purple-700 font-bold uppercase block mt-0.5">Travelled</span>
          </div>
        </div>
      </div>

      {/* Filter Month Report Card */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs p-3">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-[#4A6A8A]" />
            Filter Month Report
          </h3>
          <button 
            onClick={() => fetchData(appliedFilters)} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[10.5px] font-bold rounded-none cursor-pointer disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Month</label>
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
            >
              <option value="">All Months</option>
              {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Year</label>
            <select 
              value={filterYear || ""} 
              onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : 0)}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
            >
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">District Location</label>
            <select 
              value={filterDistrict} 
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
            >
              <option value="">All Districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Engineer / E-Code</label>
            <input 
              type="text" 
              value={filterEngineer} 
              onChange={(e) => setFilterEngineer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              placeholder="Type name or code..."
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] bg-white" 
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <button 
            onClick={handleApplyFilters} 
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4A6A8A] hover:bg-[#3b5570] text-white text-xs font-extrabold uppercase rounded-none cursor-pointer border-0 shadow-2xs transition-colors disabled:opacity-60"
          >
            <Search className="w-3.5 h-3.5" /> Search Summary
          </button>
          <button 
            onClick={handleClear}
            className="px-4 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-bold rounded-none hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Summary Data Table Section */}
      <div className="border border-slate-300 rounded-none shadow-2xs bg-white overflow-hidden">
        {/* Table Header Banner */}
        <div className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-200 shrink-0" />
            <span>
              {appliedFilters.month && appliedFilters.year
                ? `${appliedFilters.month} ${appliedFilters.year}`
                : appliedFilters.month || (appliedFilters.year ? String(appliedFilters.year) : "All Months")}
              {" Summary "}
              <span className="text-emerald-300 font-mono">({filtered.length} row(s))</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedKeys.length > 0 && (
              <div className="flex items-center gap-2 bg-white/10 px-2.5 py-1 rounded-none border border-white/20">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  {selectedKeys.length} Selected
                </span>
                <button 
                  onClick={handleBulkPrintCombined}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold border-0 cursor-pointer transition-all"
                >
                  <Printer className="w-3 h-3" /> Print Combined
                </button>
                <button 
                  onClick={handleBulkDownloadZIP}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold border-0 cursor-pointer transition-all"
                >
                  <Download className="w-3 h-3" /> Download ZIP
                </button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick filter..."
                className="pl-7 pr-2 py-1 border border-slate-400 bg-white rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:border-white w-40" 
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="py-8">
              <Loader message="Loading summary records..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 font-extrabold text-xs uppercase tracking-wider">No matching summary records found</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Ensure filters are selected correctly and claims are approved.</p>
            </div>
          ) : (
            <>
              <table className="hidden md:table w-full text-left table-auto border-collapse min-w-full">
                <thead>
                  <tr className="bg-[#4A6A8A] text-white text-[10.5px] font-extrabold uppercase tracking-wider border-b border-slate-600">
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center w-10">
                      <input 
                        type="checkbox"
                        checked={filtered.length > 0 && selectedKeys.length === filtered.length}
                        onChange={handleSelectAll}
                        className="cursor-pointer rounded-none" 
                      />
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center w-10">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-600">Engineer Details</th>
                    <th className="py-2.5 px-3 border-r border-slate-600">E-Code</th>
                    <th className="py-2.5 px-3 border-r border-slate-600">Base District</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-right">Claimed (₹)</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-right bg-emerald-700/30">Approved (₹)</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-right bg-rose-700/30">Rejected (₹)</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center">Calls</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center">PMS</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center">Tagging</th>
                    <th className="py-2.5 px-3 border-r border-slate-600 text-center">Month</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filtered.map((row, idx) => {
                    const key = `${row.user_id}-${row.month}-${row.year}`;
                    const isLoading = pdfLoadingId === key;
                    return (
                      <tr key={key} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center w-10">
                          <input 
                            type="checkbox"
                            checked={selectedKeys.includes(key)}
                            onChange={(e) => handleSelectRow(key, e.target.checked)}
                            className="cursor-pointer rounded-none" 
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono font-bold border-r border-slate-200 text-center">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-extrabold text-slate-900 text-xs">{row.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase">{row.designation}</div>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <span className="font-mono font-extrabold text-xs text-[#4A6A8A] bg-slate-100 px-2 py-0.5 border border-slate-200">
                            {row.e_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-bold border-r border-slate-200">{row.district || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          {fmt(row.claimed_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 border-r border-slate-200">
                          {fmt(row.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700 bg-rose-50/30 border-r border-slate-200">
                          {row.rejected_amount > 0 ? fmt(row.rejected_amount) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.calls_assigned > 0 ? `${row.calls_completed}/${row.calls_assigned}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.pms_count || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.asset_tagging_count || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                          <span className="text-[10px] font-bold text-[#4A6A8A] bg-slate-100 px-2 py-0.5 border border-slate-200 whitespace-nowrap">
                            {row.month} {row.year}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button 
                            onClick={() => handlePDF(row)} 
                            disabled={isLoading}
                            className="bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded-none px-2.5 py-1 border-0 cursor-pointer shadow-2xs inline-flex items-center gap-1 transition-colors disabled:opacity-60 whitespace-nowrap"
                            title={`Download Reimbursement Form PDF for ${row.name}`}
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {isLoading ? "..." : "Download PDF"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length > 1 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs font-black text-slate-900 font-mono">
                      <td className="border-r border-slate-200" />
                      <td colSpan={4} className="py-2.5 px-3 border-r border-slate-200 uppercase tracking-wider text-slate-700 font-sans font-extrabold">
                        Grand Total Summary
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono font-black text-slate-900">
                        {fmt(filtered.reduce((s, r) => s + r.claimed_amount, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono font-black text-emerald-800 bg-emerald-100/60">
                        {fmt(totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono font-black text-rose-800 bg-rose-100/60">
                        {fmt(filtered.reduce((s, r) => s + r.rejected_amount, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono">
                        {filtered.reduce((s, r) => s + r.calls_completed, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono">
                        {filtered.reduce((s, r) => s + r.pms_count, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono">
                        {filtered.reduce((s, r) => s + r.asset_tagging_count, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 text-[10px] font-sans font-bold text-slate-600">
                        {filtered.length} Staff
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400 text-[10px] font-sans">
                        —
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3 p-3">
                {filtered.map((row) => {
                  const key = `${row.user_id}-${row.month}-${row.year}`;
                  const isLoading = pdfLoadingId === key;
                  return (
                    <div
                      key={key}
                      className="bg-white border border-slate-300 rounded-none p-3 space-y-2 shadow-2xs text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedKeys.includes(key)}
                            onChange={(e) => handleSelectRow(key, e.target.checked)}
                            className="cursor-pointer rounded-none h-4 w-4"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900 leading-tight">{row.name}</div>
                            <span className="text-[9.5px] text-slate-500 font-bold uppercase">{row.designation}</span>
                          </div>
                        </div>
                        <span className="font-mono font-extrabold text-xs text-[#4A6A8A] bg-slate-100 px-2 py-0.5 border border-slate-200">
                          {row.e_code}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-200 pt-2">
                        <div>
                          <span className="text-slate-400 font-extrabold uppercase text-[9px] block">Base District</span>
                          <span className="text-slate-800 font-bold">{row.district || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-extrabold uppercase text-[9px] block">Month</span>
                          <span className="text-[10px] font-bold text-[#4A6A8A] bg-slate-100 px-2 py-0.5 border border-slate-200 inline-block mt-0.5">{row.month} {row.year}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-extrabold uppercase text-[9px] block">Financials</span>
                          <span className="text-slate-800 font-bold leading-tight block">
                            Claimed: <span className="font-mono">{fmt(row.claimed_amount)}</span>
                          </span>
                          <span className="text-emerald-700 font-black leading-tight block">
                            Approved: {fmt(row.total_amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-extrabold uppercase text-[9px] block">Task Metrics</span>
                          <span className="text-slate-700 font-bold block mt-0.5">Calls: {row.calls_assigned > 0 ? `${row.calls_completed}/${row.calls_assigned}` : "—"}</span>
                          <span className="text-slate-700 font-bold block">PMS: {row.pms_count || "—"}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-2 flex justify-end">
                        <button 
                          onClick={() => handlePDF(row)} 
                          disabled={isLoading}
                          className="bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded-none px-3 py-1.5 border-0 cursor-pointer shadow-2xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          <span>Download PDF</span>
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

      {/* ================= SET MONTHLY ADVANCE MODAL ================= */}
      {showAdvanceModal && advanceModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-400 rounded-none shadow-2xl w-full max-w-sm overflow-hidden text-left animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex justify-between items-center rounded-none">
              <h3 className="text-xs font-extrabold tracking-wider uppercase m-0 flex items-center gap-2 text-white">
                <CheckCircle className="w-4 h-4 text-emerald-300" /> {advanceModalConfig.title}
              </h3>
              <button 
                onClick={() => setShowAdvanceModal(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 leading-snug">
                {advanceModalConfig.description}
              </p>
              <div>
                <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Advance Amount (₹)
                </label>
                <input
                  type="number"
                  value={advanceAmountInput}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-none px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#4A6A8A] bg-white"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="px-4 py-1.5 rounded-none text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
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
                className="px-4 py-1.5 rounded-none text-xs font-extrabold uppercase tracking-wider bg-[#4A6A8A] hover:bg-[#3b5570] text-white border-0 cursor-pointer shadow-2xs transition-colors"
              >
                Save &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
