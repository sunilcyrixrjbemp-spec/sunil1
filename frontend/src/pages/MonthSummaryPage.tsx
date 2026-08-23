import { generateEngineerVectorPdf, generateBulkZipFast } from "../utils/fastVectorPdfGenerator";
import { useEffect, useState, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import {
  Calendar, Download, RefreshCw, Users, CheckCircle,
  IndianRupee, MapPin, Search, Filter, FileText, Printer, X,
  Building2, UserCircle, RotateCcw, ArrowUpRight, ChevronDown
} from "lucide-react";

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

const convertPdfBlobToJpgBase64 = async (blob: Blob | ArrayBuffer): Promise<string> => {
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js");
    const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"] || (window as any).pdfjsLib;
    if (!pdfjsLib) return "";
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

    const source = blob instanceof Blob ? await blob.arrayBuffer() : blob;
    const loadingTask = pdfjsLib.getDocument(source);
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (e) {
    console.warn("Failed to render PDF blob to JPG via pdf.js:", e);
    return "";
  }
};

// Generate fallback placeholder canvas image when a bill fails to fetch or render
const generatePlaceholderImage = (fileName = ""): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("📄 Bill Attachment Not Available", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "16px Arial, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(fileName || "Unable to load file attachment", canvas.width / 2, canvas.height / 2 + 15);

  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("(File may be restricted, deleted, or in an unsupported format)", canvas.width / 2, canvas.height / 2 + 50);

  return canvas.toDataURL("image/jpeg", 0.85);
};

const convertImageUrlToBase64WithFallback = async (url: string, fileName = ""): Promise<string> => {
  if (!url) return generatePlaceholderImage(fileName);
  if (url.startsWith("data:image/")) return url;

  try {
    const absUrl = getAbsoluteUrl(url);
    const cleanUrl = url.toLowerCase().split("?")[0];
    const isPdfByUrl = cleanUrl.endsWith(".pdf") || url.startsWith("data:application/pdf") || cleanUrl.includes(".pdf");

    if (isPdfByUrl) {
      const jpgBase64 = await convertPdfToImageBase64(absUrl);
      if (jpgBase64 && jpgBase64.startsWith("data:image/")) return jpgBase64;
    }

    const response = await fetch(absUrl);
    if (!response.ok) {
      console.warn(`HTTP ${response.status} for bill attachment: ${absUrl}`);
      return generatePlaceholderImage(fileName);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const blob = await response.blob();

    if (contentType.includes("pdf") || blob.type.includes("pdf")) {
      const jpgBase64 = await convertPdfBlobToJpgBase64(blob);
      if (jpgBase64 && jpgBase64.startsWith("data:image/")) return jpgBase64;
      return generatePlaceholderImage(fileName);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || generatePlaceholderImage(fileName));
      reader.onerror = () => resolve(generatePlaceholderImage(fileName));
      reader.readAsDataURL(blob);
    });
  } catch (e: any) {
    console.error(`Bill fetch failed: ${e?.message || e}`, url);
    return generatePlaceholderImage(fileName);
  }
};

const convertImageUrlToBase64 = async (url: string, fileName = ""): Promise<string> => {
  return convertImageUrlToBase64WithFallback(url, fileName);
};

const prepareConvertedAttachments = async (claims: any[]) => {
  const rawAttachmentsMap = new Map<string, any>();
  
  (claims || []).forEach((claim: any) => {
    const claimDate = claim.date || "N/A";
    const claimAtts = [
      ...(Array.isArray(claim.attachments) ? claim.attachments : []),
      ...(Array.isArray(claim.attachments_detailed) ? claim.attachments_detailed : []),
      ...(Array.isArray(claim.attachment_urls) ? claim.attachment_urls : []),
      ...(typeof claim.attachments === "string" ? (() => { try { return JSON.parse(claim.attachments); } catch { return [claim.attachments]; } })() : [])
    ];

    claimAtts.forEach((cItem: any, cIdx: number) => {
      const cUrl = typeof cItem === "string" ? cItem : (cItem.file_url || cItem.url);
      const label = (typeof cItem === "object" && (cItem.bill_type || cItem.billType)) ? (cItem.bill_type || cItem.billType) : `Claim Attachment #${cIdx + 1}`;
      if (cUrl && typeof cUrl === "string" && cUrl.trim() && !rawAttachmentsMap.has(cUrl)) {
        rawAttachmentsMap.set(cUrl, {
          file_url: cUrl,
          url: cUrl,
          date: claimDate,
          bill_type: label
        });
      }
    });

    (claim.legs || []).forEach((leg: any) => {
      const legCandidateFields = [
        { key: "hotel_receipt", label: "Hotel Bill Receipt" },
        { key: "local_purchase_bill", label: "Local Purchase Bill" },
        { key: "other_bill", label: "Other Expense Bill" },
        { key: "receipt_url", label: "Travel / Bill Receipt" },
        { key: "bill_url", label: "Travel Ticket" },
        { key: "attachment_url", label: "Expense Bill Attachment" },
        { key: "file_url", label: "Expense Bill Attachment" },
        { key: "bill_copy", label: "Expense Bill Copy" },
        { key: "receipt", label: "Bill Receipt" },
        { key: "ticket_attachment", label: "Train / Bus Ticket" },
        { key: "main_bill_file", label: "Travel Ticket Receipt" },
        { key: "sub_bill_file", label: "Sub-connection Ticket" },
        { key: "hotel_bill_file", label: "Hotel Bill" },
        { key: "lp_bill_file", label: "Local Purchase Bill" },
        { key: "oth_bill_file", label: "Other Expense Bill" },
        { key: "other_attachment", label: "Other Bill Attachment" }
      ];

      legCandidateFields.forEach(field => {
        const u = leg[field.key];
        if (u && typeof u === "string" && u.trim() && !rawAttachmentsMap.has(u)) {
          rawAttachmentsMap.set(u, {
            file_url: u,
            url: u,
            date: claimDate,
            bill_type: field.label
          });
        }
      });

      if (Array.isArray(leg.attachments)) {
        leg.attachments.forEach((aItem: any) => {
          const aUrl = typeof aItem === "string" ? aItem : (aItem.file_url || aItem.url);
          if (aUrl && !rawAttachmentsMap.has(aUrl)) {
            rawAttachmentsMap.set(aUrl, {
              file_url: aUrl,
              url: aUrl,
              date: claimDate,
              bill_type: (typeof aItem === "object" && aItem.bill_type) ? aItem.bill_type : "Bill Attachment"
            });
          }
        });
      }
    });
  });

  const rawAttachments = Array.from(rawAttachmentsMap.values());
  return await Promise.all(
    rawAttachments.map(async (att: any) => {
      const rawUrl = att.file_url || att.url || (typeof att === "string" ? att : "");
      const base64Url = rawUrl ? await convertImageUrlToBase64(rawUrl) : "";
      return {
        ...att,
        original_url: rawUrl,
        file_url: base64Url || rawUrl,
        url: base64Url || rawUrl
      };
    })
  );
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

  // Helper to identify Call Service Reports and PMS Reports
  const isCallOrPmsReport = (label: string = "", billType: string = ""): boolean => {
    const l = (label || "").toLowerCase();
    const b = (billType || "").toLowerCase();
    if (l.includes("hotel") || l.includes("purchase") || l.includes("ticket") || l.includes("receipt") || l.includes("bill") || l.includes("fare") || l.includes("travel")) {
      return false;
    }
    return l.includes("pms report") || l.includes("service report sheet") || l.includes("breakdown call report") ||
           b.includes("pms_report") || b.includes("service_report_sheet") || b === "service_report";
  };

  // Helper to get normalized deduplication key from attachment URL
  const getAttachmentNormKey = (urlStr: string): string => {
    if (!urlStr) return "";
    if (urlStr.startsWith("data:")) return urlStr.slice(0, 120);
    const clean = urlStr.split("?")[0].replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "");
    const base = clean.split("/").pop() || clean;
    return base.toLowerCase().replace(/\.[^/.]+$/, "");
  };

  // Collect ALL financial bill attachments (excluding Call Service Reports & PMS Reports)
  const allAttachmentsMap = new Map<string, { url: string; date: string; label: string }>();
  const seenNormKeys = new Set<string>();

  // 1. Top-level attachments array from backend / prepareConvertedAttachments
  (attachments || []).forEach((att: any, idx: number) => {
    const rawUrl = att.file_url || att.url || (typeof att === "string" ? att : "");
    const origUrl = att.original_url || rawUrl;
    const normKey = getAttachmentNormKey(origUrl) || getAttachmentNormKey(rawUrl);
    const label = att.bill_type || att.billType || "Expense Bill Attachment";

    if (rawUrl && normKey && !isCallOrPmsReport(label, att.bill_type) && !seenNormKeys.has(normKey)) {
      seenNormKeys.add(normKey);
      allAttachmentsMap.set(normKey, {
        url: rawUrl,
        date: att.date ? fmtDate(att.date) : `Bill #${idx + 1}`,
        label: label
      });
    }
  });

  // 2. Scan claims and legs for any financial bill attachment URLs
  (claims || []).forEach((claim: any) => {
    const claimDate = claim.date ? fmtDate(claim.date) : "";

    const claimAtts = [
      ...(Array.isArray(claim.attachments) ? claim.attachments : []),
      ...(Array.isArray(claim.attachments_detailed) ? claim.attachments_detailed : []),
      ...(Array.isArray(claim.attachment_urls) ? claim.attachment_urls : []),
      ...(typeof claim.attachments === "string" ? (() => { try { return JSON.parse(claim.attachments); } catch { return [claim.attachments]; } })() : [])
    ];

    claimAtts.forEach((cItem: any, cIdx: number) => {
      const cUrl = typeof cItem === "string" ? cItem : (cItem.file_url || cItem.url);
      const normKey = getAttachmentNormKey(cUrl);
      const label = (typeof cItem === "object" && (cItem.bill_type || cItem.billType)) ? (cItem.bill_type || cItem.billType) : `Claim Attachment #${cIdx + 1}`;
      if (cUrl && normKey && !isCallOrPmsReport(label, (cItem.bill_type || "")) && !seenNormKeys.has(normKey)) {
        seenNormKeys.add(normKey);
        allAttachmentsMap.set(normKey, {
          url: cUrl,
          date: claimDate,
          label: label
        });
      }
    });

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
        { key: "receipt", label: "Bill Receipt" },
        { key: "ticket_attachment", label: "Train / Bus Ticket" },
        { key: "main_bill_file", label: "Travel Ticket Receipt" },
        { key: "sub_bill_file", label: "Sub-connection Ticket" },
        { key: "hotel_bill_file", label: "Hotel Bill" },
        { key: "lp_bill_file", label: "Local Purchase Bill" },
        { key: "oth_bill_file", label: "Other Expense Bill" },
        { key: "other_attachment", label: "Other Bill Attachment" }
      ];

      candidateFields.forEach(field => {
        const u = leg[field.key];
        const normKey = getAttachmentNormKey(u);
        if (u && normKey && !isCallOrPmsReport(field.label, "") && !seenNormKeys.has(normKey)) {
          seenNormKeys.add(normKey);
          allAttachmentsMap.set(normKey, { url: u, date: claimDate, label: field.label });
        }
      });

      if (Array.isArray(leg.attachments)) {
        leg.attachments.forEach((aItem: any, aIdx: number) => {
          const aUrl = typeof aItem === "string" ? aItem : (aItem.file_url || aItem.url);
          const normKey = getAttachmentNormKey(aUrl);
          const label = aItem.bill_type || `Bill Attachment #${aIdx + 1}`;
          if (aUrl && normKey && !isCallOrPmsReport(label, aItem.bill_type || "") && !seenNormKeys.has(normKey)) {
            seenNormKeys.add(normKey);
            allAttachmentsMap.set(normKey, { url: aUrl, date: claimDate, label: label });
          }
        });
      }
    });
  });

  // Build a lookup map of originalUrl -> base64Url from attachments parameter
  const base64Lookup = new Map<string, string>();
  if (Array.isArray(attachments)) {
    attachments.forEach((item: any) => {
      const orig = item.original_url || item.raw_url || item.url || item.file_url;
      const b64 = item.file_url || item.url;
      if (orig && b64) {
        base64Lookup.set(orig, b64);
        base64Lookup.set(getAbsoluteUrl(orig), b64);
      }
    });
  }

  const finalAttachments = Array.from(allAttachmentsMap.values());

  // Attached receipts HTML block — 1 dedicated full page per bill attachment!
  let attachmentsSection = "";
  if (finalAttachments.length > 0) {
    attachmentsSection = finalAttachments.map((att: any, index) => {
      const rawUrl = att.url;
      const base64OrUrl = base64Lookup.get(rawUrl) || base64Lookup.get(getAbsoluteUrl(rawUrl)) || rawUrl;
      const absoluteUrl = base64OrUrl.startsWith("data:") ? base64OrUrl : getAbsoluteUrl(base64OrUrl);
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
  const [loading, setLoading] = useState(true);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const cancelZipRef = useRef(false);

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
  
  // Dependent cascading filters
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterCoordinator, setFilterCoordinator] = useState<string>("all");
  const [filterEngineer, setFilterEngineer] = useState<string>("all");

  const [appliedFilters, setAppliedFilters] = useState({
    month: MONTHS[currentDate.getMonth() + 1],
    year: currentDate.getFullYear(),
  });
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchData(appliedFilters);
  }, []);

  const fetchData = async (f: { month?: string; year?: number }) => {
    setLoading(true);
    try {
      const res = await expenseService.getMonthSummary({
        month: f.month || undefined,
        year: f.year || undefined,
      });
      setData(res.data || []);
    } catch (err: any) {
      console.error("Failed to load month summary", err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Available Zones (from all data)
  const uniqueZones = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r: any) => {
      const z = (r.zone || r.state || "").trim();
      if (z) set.add(z);
    });
    return Array.from(set).sort();
  }, [data]);

  // 2. Available Districts (Dependent on Selected Zone)
  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r: any) => {
      const zoneMatch = filterZone === "all" || (r.zone || r.state || "").trim() === filterZone;
      if (zoneMatch && r.district) {
        set.add(r.district.trim());
      }
    });
    return Array.from(set).sort();
  }, [data, filterZone]);

  // 3. Available Coordinators / Managers (Dependent on Zone & District)
  const uniqueCoordinators = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r: any) => {
      const zoneMatch = filterZone === "all" || (r.zone || r.state || "").trim() === filterZone;
      const districtMatch = filterDistrict === "all" || (r.district || "").trim() === filterDistrict;
      if (zoneMatch && districtMatch) {
        const coord = (r.coordinator || r.manager || "").trim();
        if (coord) set.add(coord);
      }
    });
    return Array.from(set).sort();
  }, [data, filterZone, filterDistrict]);

  // 4. Available Engineers (Dependent on Zone, District & Coordinator)
  const uniqueEngineers = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r: any) => {
      const zoneMatch = filterZone === "all" || (r.zone || r.state || "").trim() === filterZone;
      const districtMatch = filterDistrict === "all" || (r.district || "").trim() === filterDistrict;
      const coordMatch = filterCoordinator === "all" || (r.coordinator || r.manager || "").trim() === filterCoordinator;

      if (zoneMatch && districtMatch && coordMatch) {
        if (r.e_code && r.name) {
          map.set(r.e_code, r.name);
        }
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filterZone, filterDistrict, filterCoordinator]);

  // Cascading Handlers
  const handleZoneChange = (zone: string) => {
    setFilterZone(zone);
    setFilterDistrict("all");
    setFilterCoordinator("all");
    setFilterEngineer("all");
  };

  const handleDistrictChange = (dist: string) => {
    setFilterDistrict(dist);
    setFilterCoordinator("all");
    setFilterEngineer("all");
  };

  const handleCoordinatorChange = (coord: string) => {
    setFilterCoordinator(coord);
    setFilterEngineer("all");
  };

  const handleEngineerChange = (emp: string) => {
    setFilterEngineer(emp);
  };

  const handleResetFilters = () => {
    setFilterZone("all");
    setFilterDistrict("all");
    setFilterCoordinator("all");
    setFilterEngineer("all");
    setSearch("");
  };

  const handleApplyMonthYear = () => {
    const f = { month: filterMonth, year: filterYear };
    setAppliedFilters(f);
    fetchData(f);
  };





  const handleDownloadSingle = async (row: any) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    try {
      const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
      const userObj = res.user || row;
      const claims = res.claims || [];
      if (claims.length === 0) {
        toast.error("No approved claim data found");
        return;
      }

      const pdfBlob = await generateEngineerVectorPdf(userObj, claims, row.advance_amount || 0, true);
      const safeName = (userObj.name || "Staff").replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `${safeName}_${userObj.e_code || row.e_code || "E"}_${row.month}_${row.year}.pdf`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF downloaded instantly!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleOpenAdvanceModal = (r: any) => {
    setAdvanceAmountInput(String(r.advance_amount || 0));
    setAdvanceModalConfig({
      title: "Edit Monthly Advance",
      description: `Update Advance Amount (₹) for ${r.name} for ${r.month} ${r.year}.`,
      initialValue: r.advance_amount || 0,
      userCode: r.user_id,
      month: r.month,
      year: r.year,
      onSave: async (amount: number) => {
        try {
          await expenseService.saveEngineerAdvance(r.user_id, r.month, r.year, amount);
          setData(prev => prev.map(item => {
            if (item.user_id === r.user_id && item.month === r.month && item.year === r.year) {
              return { ...item, advance_amount: amount };
            }
            return item;
          }));
          toast.success("Advance updated successfully");
        } catch (err: any) {
          toast.error(err?.response?.data?.detail || "Failed to save advance");
        }
      }
    });
    setShowAdvanceModal(true);
  };

  const handlePrintSingle = async (row: any) => {
    const key = `${row.user_id}-${row.month}-${row.year}`;
    setPdfLoadingId(key);
    try {
      const res = await expenseService.getEngineerMonthClaims(row.user_id, row.month, row.year);
      const userObj = res.user || row;
      const claims = res.claims || [];
      if (claims.length === 0) {
        toast.error("No approved claim data found");
        return;
      }
      await Promise.all(
        claims.map(async (claim: any) => {
          try {
            const details = await expenseService.getExpenseDetails(claim.expense_code);
            if (details) {
              if (details.attachments && Array.isArray(details.attachments)) {
                claim.attachments = details.attachments;
              }
              if (details.attachments_detailed && Array.isArray(details.attachments_detailed)) {
                claim.attachments_detailed = details.attachments_detailed;
              }
            }
          } catch (e) {}
        })
      );
      const attachments = await prepareConvertedAttachments(claims);
      const html = buildExcelPrintHTML(userObj, claims, attachments, row.advance_amount || 0, true);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (e) {
      toast.error("Print preview failed");
    } finally {
      setPdfLoadingId(null);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((r: any) => {
      if (filterZone !== "all" && (r.zone || r.state || "").trim() !== filterZone) return false;
      if (filterDistrict !== "all" && (r.district || "").trim() !== filterDistrict) return false;
      if (filterCoordinator !== "all" && (r.coordinator || r.manager || "").trim() !== filterCoordinator) return false;
      if (filterEngineer !== "all" && r.e_code !== filterEngineer) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.e_code || "").toLowerCase().includes(q) ||
        (r.district || "").toLowerCase().includes(q) ||
        (r.zone || "").toLowerCase().includes(q) ||
        (r.coordinator || r.manager || "").toLowerCase().includes(q)
      );
    });
  }, [data, filterZone, filterDistrict, filterCoordinator, filterEngineer, search]);

  const hasActiveFilters =
    filterZone !== "all" ||
    filterDistrict !== "all" ||
    filterCoordinator !== "all" ||
    filterEngineer !== "all" ||
    Boolean(search.trim());

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

  const [zipProgress, setZipProgress] = useState<{
    active: boolean;
    stage: "fetching" | "rendering" | "compressing" | "complete" | "error";
    current: number;
    total: number;
    currentName: string;
    percent: number;
    message: string;
  } | null>(null);

  const handleCancelZIP = () => {
    cancelZipRef.current = true;
    setZipProgress(null);
    toast("ZIP generation cancelled", { icon: "ℹ️" });
  };



  const handleBulkDownloadZIP = async () => {
    if (selectedKeys.length === 0) return;
    cancelZipRef.current = false;

    const selectedRows = filtered.filter((r: any) =>
      selectedKeys.includes(`${r.user_id}-${r.month}-${r.year}`)
    );

    try {
      const zipBlob = await generateBulkZipFast(
        selectedRows,
        appliedFilters.month || "Selected",
        appliedFilters.year || 2026,
        (progress) => {
          setZipProgress(progress);
        },
        () => cancelZipRef.current
      );

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Claims_Reports_${appliedFilters.month || "Selected"}_${appliedFilters.year || "2026"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`ZIP archive with ${selectedRows.length} reports downloaded!`);
      setTimeout(() => {
        setZipProgress(null);
      }, 2500);
    } catch (e: any) {
      if (cancelZipRef.current) {
        setZipProgress(null);
        toast("ZIP generation cancelled", { icon: "ℹ️" });
        return;
      }
      console.error(e);
      toast.error("ZIP generation failed");
      setZipProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] pb-24 text-ink-900 font-sans">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 space-y-3.5">
        
        {/* ══════════════════════════════════════════════════════════════════
            DITTO HOME PAGE ZOHO KPI ROW (EXACT 100% SAME CARD SPECIFICATIONS)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* 1. Total Engineers */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-ink-500 font-sans group-hover:text-ink-700 transition-colors">
                TOTAL ENGINEERS
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 group-hover:bg-accent-100 transition-colors">
                <Users className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-ink-900 leading-tight flex items-baseline justify-between">
                <span>{totalEngineers} <span className="text-xs font-sans text-ink-500 font-normal">Active</span></span>
                <ArrowUpRight className="w-3 h-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block">
                {filtered.length} Displayed
              </span>
            </div>
          </div>

          {/* 2. Approved Claims */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-emerald-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 font-sans">
                APPROVED CLAIMS
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 leading-tight flex items-baseline justify-between">
                <span>{totalClaims}</span>
                <ArrowUpRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-emerald-600/80 font-medium leading-none mt-0.5 block">
                Audited & Approved
              </span>
            </div>
          </div>

          {/* 3. Total Amount */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-accent-800 font-sans">
                TOTAL AMOUNT
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 group-hover:bg-accent-100 transition-colors">
                <IndianRupee className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-accent-900 leading-tight flex items-baseline justify-between">
                <span>₹{fmt(totalAmount)}</span>
                <ArrowUpRight className="w-3 h-3 text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-accent-700 font-medium leading-none mt-0.5 block">
                Disbursement Value
              </span>
            </div>
          </div>

          {/* 4. Total Distance */}
          <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-purple-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-600" />
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-purple-800 font-sans">
                TOTAL DISTANCE
              </span>
              <div className="w-5.5 h-5.5 rounded-[3px] bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 group-hover:bg-purple-100 transition-colors">
                <MapPin className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold font-mono text-purple-800 leading-tight flex items-baseline justify-between">
                <span>{fmtN(totalKM)} <span className="text-xs font-sans font-normal">km</span></span>
                <ArrowUpRight className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-[10px] text-purple-600/80 font-medium leading-none mt-0.5 block">
                Logged Travel
              </span>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            DITTO HOME PAGE CRISP DEPENDENT CASCADING FILTERS BAR
        ══════════════════════════════════════════════════════════════════ */}
        <div className="rounded-[4px] border border-[#4f4f4f]/30 bg-white shadow-2xs p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent-600" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-900 m-0 leading-none">
                Targeted Filters (Zone • District • Coordinator • Employee)
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-accent-700">
              {filtered.length} Filtered Staff
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 1. Month */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <Calendar className="w-3.5 h-3.5 text-accent-600 mr-1.5 shrink-0" />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Select Month"
              >
                {MONTHS.slice(1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 2. Year */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <select
                value={filterYear || ""}
                onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : 0)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Select Year"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 3. Dependent Zone Filter */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
              <select
                value={filterZone}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Filter by Zone"
              >
                <option value="all">All Zones</option>
                {uniqueZones.map((z: any) => (
                  <option key={z} value={z}>Zone {z}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 4. Dependent District Filter */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <Building2 className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
              <select
                value={filterDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Filter by District"
              >
                <option value="all">All Districts ({uniqueDistricts.length})</option>
                {uniqueDistricts.map((d: any) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 5. Dependent Coordinator Filter */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <Users className="w-3.5 h-3.5 text-purple-600 mr-1.5 shrink-0" />
              <select
                value={filterCoordinator}
                onChange={(e) => handleCoordinatorChange(e.target.value)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Filter by Coordinator / Manager"
              >
                <option value="all">All Coordinators ({uniqueCoordinators.length})</option>
                {uniqueCoordinators.map((c: any) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>

            {/* 6. Dependent Engineer Filter */}
            <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600">
              <UserCircle className="w-3.5 h-3.5 text-accent-600 mr-1.5 shrink-0" />
              <select
                value={filterEngineer}
                onChange={(e) => handleEngineerChange(e.target.value)}
                className="h-full w-full pr-4 text-xs font-semibold text-ink-900 bg-transparent border-0 focus:outline-none cursor-pointer appearance-none leading-none"
                title="Filter by Engineer"
              >
                <option value="all">All Engineers ({uniqueEngineers.length})</option>
                {uniqueEngineers.map((emp: any) => (
                  <option key={emp.code} value={emp.code}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-500 absolute right-2 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-line flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyMonthYear}
                disabled={loading}
                className="h-9 rounded-[4px] bg-[#4338CA] hover:bg-[#3730A3] text-white px-4 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-[#3730A3] disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5 text-white" />
                <span className="text-white">Fetch Month Data</span>
              </button>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="h-9 rounded-[4px] bg-white hover:bg-surface-sunken text-ink-800 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs border border-[#4f4f4f] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-ink-500" />
                  <span>Reset Dropdowns</span>
                </button>
              )}
            </div>

            {/* Right: Quick Search & Targeted Batch Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative inline-flex items-center bg-white rounded-[4px] border border-[#4f4f4f] hover:border-accent-600 h-9 px-2.5 transition-all focus-within:ring-1 focus-within:ring-accent-600 w-48">
                <Search className="w-3.5 h-3.5 text-ink-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Quick search table..."
                  className="h-full w-full text-xs font-medium text-ink-900 placeholder:text-ink-400 bg-transparent border-0 focus:outline-none leading-none"
                />
              </div>

              {filtered.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedKeys.length === filtered.length) {
                      setSelectedKeys([]);
                    } else {
                      setSelectedKeys(filtered.map((r: any) => `${r.user_id}-${r.month}-${r.year}`));
                    }
                  }}
                  className="h-9 rounded-[4px] bg-white hover:bg-surface-sunken text-accent-700 px-3 text-xs font-bold border border-accent-300 shadow-2xs transition-colors cursor-pointer"
                >
                  {selectedKeys.length === filtered.length
                    ? "Deselect All"
                    : `Select All ${filtered.length} Filtered`}
                </button>
              )}

              {selectedKeys.length > 0 && (
                <>
                  <button
                    onClick={handleBulkPrintCombined}
                    className="h-9 rounded-[4px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-[#1D4ED8]"
                  >
                    <Printer className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Print Combined ({selectedKeys.length})</span>
                  </button>

                  <button
                    onClick={handleBulkDownloadZIP}
                    className="h-9 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-emerald-700"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Download ZIP ({selectedKeys.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            DITTO HIGH-DENSITY ZOHO TABLE (CLEAR READABLE HEADER & CONTRAST)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="rounded-[4px] border border-[#4f4f4f]/30 bg-white shadow-2xs overflow-hidden">
          {/* Table Header Banner */}
          <div className="bg-[#1E1B4B] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between rounded-none flex-wrap gap-2 font-mono">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent-300 shrink-0" />
              <span>
                {appliedFilters.month && appliedFilters.year
                  ? `${appliedFilters.month} ${appliedFilters.year}`
                  : appliedFilters.month || (appliedFilters.year ? String(appliedFilters.year) : "All Months")}
                {" Monthly Ledger "}
                <span className="text-emerald-300 font-mono">({filtered.length} Staff)</span>
              </span>
            </div>

            <span className="text-xs font-bold text-emerald-300 font-mono">
              Total Disbursed: ₹{fmt(totalAmount)}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-ink-500 font-bold text-xs">
                <RefreshCw className="h-4 w-4 animate-spin text-accent-600" />
                Loading monthly summary data...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-ink-400 font-bold text-xs uppercase tracking-wider">
                No monthly summary records found for this period.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                <thead className="bg-[#F4F3F1] text-ink-800 text-[10.5px] font-bold font-mono uppercase tracking-wider text-left border-b border-line">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10 border-r border-line bg-[#F4F3F1] text-ink-700">
                      <input 
                        type="checkbox" 
                        checked={filtered.length > 0 && selectedKeys.length === filtered.length}
                        onChange={handleSelectAll}
                        className="cursor-pointer rounded-[2px]"
                      />
                    </th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-accent-700 text-center">E-Code</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-900">Engineer Name</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700">District</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700 text-center">Month</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700 text-right">Distance</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700 text-right">Claims</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700 text-right">Gross Claimed</th>
                    <th className="py-2.5 px-2 border-r border-line bg-rose-50 text-rose-800 text-right font-bold">Advance (Adv)</th>
                    <th className="py-2.5 px-2 border-r border-line bg-emerald-50 text-emerald-800 text-right font-bold">Total Approved</th>
                    <th className="py-2.5 px-2 border-r border-line bg-accent-50 text-accent-800 text-right font-bold">Net Payable</th>
                    <th className="py-2.5 px-2 border-r border-line bg-[#F4F3F1] text-ink-700 text-center">Status</th>
                    <th className="py-2.5 px-2 text-center bg-[#F4F3F1] text-ink-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {filtered.map((r: any, idx: number) => {
                    const rowKey = `${r.user_id}-${r.month}-${r.year}`;
                    const isSelected = selectedKeys.includes(rowKey);
                    const gross = r.total_claimed || (r.bike_amount + r.car_amount + r.da_amount + r.other_amount);
                    const adv = r.advance_amount || 0;
                    const net = (r.total_amount || 0) - adv;
                    const isRowPdfLoading = pdfLoadingId === rowKey;

                    return (
                      <tr 
                        key={rowKey} 
                        className={`hover:bg-accent-50/30 transition-colors ${isSelected ? "bg-accent-50/40" : idx % 2 === 0 ? "bg-white" : "bg-surface-sunken/20"}`}
                      >
                        <td className="py-2 px-2 text-center border-r border-line">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(rowKey, e.target.checked)}
                            className="cursor-pointer rounded-[2px]"
                          />
                        </td>
                        <td className="py-2 px-2 font-bold text-accent-700 bg-accent-50/40 border-r border-line text-center">
                          {r.e_code || "—"}
                        </td>
                        <td className="py-2 px-2 font-bold font-sans text-ink-900 border-r border-line">
                          {r.name || "—"}
                        </td>
                        <td className="py-2 px-2 border-r border-line text-ink-700">
                          {r.district || "—"}
                        </td>
                        <td className="py-2 px-2 border-r border-line text-center text-accent-700 font-bold">
                          {r.month} {r.year}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">
                          {fmtN(r.total_km)} km
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-700">
                          {r.claim_count}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line text-ink-800">
                          {fmt(gross)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-rose-700 bg-rose-50/40">
                          {isAllowedAdvance ? (
                            <button
                              onClick={() => handleOpenAdvanceModal(r)}
                              title="Click to edit advance"
                              className="text-rose-700 hover:text-rose-900 underline font-bold cursor-pointer transition-colors"
                            >
                              ₹{fmt(adv)}
                            </button>
                          ) : (
                            `₹${fmt(adv)}`
                          )}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-emerald-700 bg-emerald-50/40">
                          ₹{fmt(r.total_amount)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-line font-bold text-accent-800 bg-accent-50/40">
                          ₹{fmt(net)}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-line">
                          <span className="rounded-[3px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 uppercase">
                            Approved
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleDownloadSingle(r)}
                              disabled={isRowPdfLoading}
                              title="Download individual PDF"
                              className="p-1 rounded-[3px] bg-white border border-[#4f4f4f] hover:border-accent-600 text-ink-700 hover:text-accent-600 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Download className={`w-3.5 h-3.5 ${isRowPdfLoading ? "animate-spin text-accent-600" : ""}`} />
                            </button>

                            <button
                              onClick={() => handlePrintSingle(r)}
                              title="Print individual PDF"
                              className="p-1 rounded-[3px] bg-white border border-[#4f4f4f] hover:border-accent-600 text-ink-700 hover:text-accent-600 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-sunken border-t-2 border-line text-xs font-bold font-mono text-ink-900">
                    <td colSpan={5} className="py-2.5 px-2 border-r border-line text-center uppercase tracking-wider text-accent-900 font-sans">
                      Grand Total ({filtered.length} Staff)
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{fmtN(totalKM)} km</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">{totalClaims}</td>
                    <td className="py-2.5 px-2 text-right border-r border-line">
                      ₹{fmt(filtered.reduce((s: number, r: any) => s + (r.total_claimed || (r.bike_amount + r.car_amount + r.da_amount + r.other_amount)), 0))}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-rose-700 bg-rose-50/60">
                      ₹{fmt(filtered.reduce((s: number, r: any) => s + (r.advance_amount || 0), 0))}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-emerald-700 bg-emerald-50/60">
                      ₹{fmt(totalAmount)}
                    </td>
                    <td className="py-2.5 px-2 text-right border-r border-line font-bold text-accent-800 bg-accent-50/80">
                      ₹{fmt(totalAmount - filtered.reduce((s: number, r: any) => s + (r.advance_amount || 0), 0))}
                    </td>
                    <td colSpan={2} className="text-center text-ink-500 font-sans font-bold">100% Processed</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* ================= SET MONTHLY ADVANCE MODAL ================= */}
      {showAdvanceModal && advanceModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#4f4f4f]/30 rounded-[4px] shadow-2xl w-full max-w-sm overflow-hidden text-left animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-[#1E1B4B] text-white px-4 py-3 flex justify-between items-center rounded-none font-mono">
              <h3 className="text-xs font-bold tracking-wider uppercase m-0 flex items-center gap-2 text-white">
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
              <p className="text-xs font-semibold text-ink-700 leading-snug">
                {advanceModalConfig.description}
              </p>
              <div>
                <label className="block text-[10.5px] font-bold text-ink-900 uppercase tracking-wider mb-1 font-mono">
                  Advance Amount (₹)
                </label>
                <input
                  type="number"
                  value={String(advanceAmountInput) === "0" || advanceAmountInput === "" ? "" : advanceAmountInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  className="w-full border border-[#4f4f4f] rounded-[4px] px-3 py-1.5 text-xs font-mono font-bold text-ink-900 focus:outline-none focus:border-accent-600 bg-white"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-surface-sunken px-4 py-3 flex justify-end gap-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="h-9 px-4 rounded-[4px] text-xs font-bold bg-white text-ink-800 border border-[#4f4f4f] hover:bg-slate-100 transition-colors cursor-pointer"
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
                className="h-9 px-4 rounded-[4px] text-xs font-bold uppercase tracking-wider bg-[#4338CA] hover:bg-[#3730A3] text-white border-0 cursor-pointer shadow-2xs transition-colors"
              >
                Save &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LIVE ZIP GENERATION PROGRESS MODAL ================= */}
      {zipProgress && zipProgress.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn font-sans">
          <div className="bg-white border border-[#4f4f4f]/30 rounded-[4px] shadow-2xl w-full max-w-md overflow-hidden text-left">
            {/* Modal Header */}
            <div className="bg-[#1E1B4B] text-white px-4 py-3 flex justify-between items-center rounded-none font-mono">
              <h3 className="text-xs font-bold tracking-wider uppercase m-0 flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-accent-300" />
                <span>ZIP Download Progress</span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                  {zipProgress.percent}%
                </div>
                {zipProgress.stage !== "complete" && (
                  <button
                    type="button"
                    onClick={handleCancelZIP}
                    className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded-[3px] border-0 cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                    title="Cancel Download"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink-700 truncate max-w-[260px]">
                  {zipProgress.stage === "fetching" && "📥 Step 1/3: Fetching Data"}
                  {zipProgress.stage === "rendering" && "📄 Step 2/3: Generating PDFs"}
                  {zipProgress.stage === "compressing" && "📦 Step 3/3: Packing ZIP Archive"}
                  {zipProgress.stage === "complete" && "✅ Step 3/3: Download Ready"}
                  {zipProgress.stage === "error" && "❌ Error"}
                </span>
                <span className="font-bold text-accent-700 font-mono">
                  {zipProgress.current} / {zipProgress.total} Ready
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-3.5 border border-line rounded-[2px] p-0.5 overflow-hidden">
                <div
                  className="bg-accent-600 h-full transition-all duration-300 ease-out rounded-[2px]"
                  style={{ width: `${zipProgress.percent}%` }}
                />
              </div>

              {/* Current Status Log */}
              <div className="bg-surface-sunken border border-line p-3 rounded-[4px] space-y-1">
                <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider font-mono">Current Activity</div>
                <div className="font-semibold text-ink-800 break-words font-mono text-[11px]">
                  {zipProgress.message}
                </div>
                {zipProgress.stage === "rendering" && zipProgress.total > 0 && (
                  <div className="text-[10.5px] text-ink-500 font-sans pt-1 border-t border-line mt-1 flex justify-between">
                    <span>Remaining: <strong className="text-ink-900">{zipProgress.total - zipProgress.current} PDFs</strong></span>
                    <span className="font-mono text-accent-700 font-bold">{Math.round((zipProgress.current / zipProgress.total) * 100)}% PDFs Done</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer / Completion Notification */}
            {zipProgress.stage === "complete" && (
              <div className="bg-emerald-50 px-4 py-2.5 border-t border-emerald-200 text-center">
                <span className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 font-mono">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> ZIP Folder Downloaded Successfully!
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}