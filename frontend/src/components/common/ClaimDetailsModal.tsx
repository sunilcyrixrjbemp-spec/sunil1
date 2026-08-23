/**
 * ClaimDetailsModal.tsx
 * Ultra-Clean Enterprise Data Panel - Instant Photo Loading with Browser Memory Pre-fetching, 1-Line Daily Summary Strip with Exact From/To Locations & Districts, Other Expense Remark Display, Compact Rejection Panel ("Rejection Remark:"), Daily DA Restricted to Leg #1 Only
 * 
 * - EXACT FROM/TO LOCATION NAMES & DISTRICTS IN SUMMARY: Leg route displays full `District (Location)` format (e.g. `Hanumangarh (Resi) ➔ Hanumangarh (DH)`).
 * - INSTANT PHOTO & BILL LOADING (0ms Delay): All bill photos, attachment images, and travel tickets are automatically pre-loaded into browser RAM/disk cache as soon as claimDetails modal opens! Clicking "View Photo" or "View Bill" displays images instantly!
 * - ULTRA-COMPACT 1-LINE DAILY SUMMARY STRIP: Single-line executive narrative overview showing route, KMs, exact itemized expenses with remarks (e.g. `Other Exp: ₹1,560 (Ventilator Training)`), and work completed in minimal height!
 * - OTHER EXP: Displays exact remark / description (e.g. `OTHER EXP: ₹1,560 (Ventilator Training)`) right next to the amount!
 * - Rejection Panel made ULTRA COMPACT (takes minimal vertical height)
 * - Label strictly set to "Rejection Remark:" as requested
 * - DAILY DA is strictly displayed ONLY on Leg #1 (Leg Index 0). Completely hidden from Leg #2, Leg #3, Leg #4, etc.!
 * - When claim is Rejected -> Net Card displays strictly ₹0!
 * - Smart Bill-to-Leg Attachment Isolation (Prevents Bus ticket of ₹1,050 from showing on ₹80 Auto leg!)
 * - Excel-Style Single-Row Data Tables for Calls & PMS
 * - Simple Normal English & 24-Hour Time Format
 */

import React, { useState, useEffect } from "react";
import { Modal } from "antd";
import {
  X, Calendar, User, ShieldCheck, AlertTriangle, Package,
  FileText, Eye, Pencil, CheckCircle2, XCircle, Trash2, Route,
  Zap, MapPin, Building2, PhoneCall, Wrench, Crosshair, Truck, Tag,
  ArrowRight, Info, Navigation, RotateCcw, Clock, Download, ZoomIn, ZoomOut, RotateCw
} from "lucide-react";
import api from "../../services/api";
import ResetApprovalLevelModal from "../admin/ResetApprovalLevelModal";

const DEFAULT_WORKER_URL = "https://fieldops-api.sunilbishnoi.workers.dev";
const rawBase = (api.defaults.baseURL || "").replace(/\/api$/, "");
const API_BASE = (rawBase && rawBase.startsWith("http") && !rawBase.includes("indrae.in")) ? rawBase : DEFAULT_WORKER_URL;

const isValidText = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (str.length === 0 || str === "0" || str === "null" || str === "undefined" || str === "false" || str === "—") return false;
  if (str.toLowerCase() === "other" || str.toLowerCase() === "activities: other" || str.toLowerCase() === "activities:other") return false;
  return true;
};

export const handleDownloadFile = (url: string, filename?: string) => {
  if (!url) return;
  const cleanUrl = formatImageUrl(url);
  if (!cleanUrl) return;
  const a = document.createElement("a");
  a.href = cleanUrl;
  a.download = filename || cleanUrl.split("/").pop()?.split("?")[0] || "attachment.jpg";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const formatImageUrl = (url: any): string => {
  if (!url) return "";
  let str = String(url).trim();
  if (!str || str === "null" || str === "undefined" || str === "—" || str === "no_photo") return "";

  // Reject plain numeric barcodes or short identifiers (e.g. 67027306)
  if (/^\d{4,16}$/.test(str)) {
    return "";
  }

  // 1. Decode URL-encoded slashes (%2F / %2f)
  if (str.includes("%2F") || str.includes("%2f")) {
    try { str = decodeURIComponent(str); } catch (e) {}
  }

  // 2. Convert legacy /api/r2/file/ to /uploads/
  if (str.includes("/api/r2/file/")) {
    str = str.replace(/\/api\/r2\/file\//g, "/uploads/");
  }

  // Clean duplicate API_BASE prefix if present
  while (str.startsWith(`${API_BASE}${API_BASE}`)) {
    str = str.replace(`${API_BASE}${API_BASE}`, API_BASE);
  }

  // 3. Google Drive direct stream & R2 auto-transfer proxy
  if (str.includes("drive.google.com") || str.includes("docs.google.com")) {
    const matchD = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = matchD ? matchD[1] : (matchId ? matchId[1] : null);
    if (fileId) {
      return `${API_BASE}/api/r2/gdrive-proxy?id=${fileId}`;
    }
  }

  // 4. Raw Google Drive File ID (25-50 chars)
  if (str.includes("/gdrive/")) {
    const rawId = str.split("/gdrive/").pop()?.split("?")[0]?.replace(/\.(jpg|jpeg|png|webp)$/i, "") || "";
    if (rawId && /^[a-zA-Z0-9_-]{20,}$/.test(rawId)) {
      return `${API_BASE}/api/r2/gdrive-proxy?id=${rawId}`;
    }
  }
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(str) && !str.startsWith("http")) {
    return `${API_BASE}/api/r2/gdrive-proxy?id=${str}`;
  }

  // 5. Absolute HTTP(S) or Data URI
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) {
    return str;
  }

  // 6. Relative paths -> prepend API_BASE
  const cleanPath = str.startsWith("/") ? str : `/${str}`;
  return `${API_BASE}${cleanPath}`;
};

const getAttachmentsArray = (attachments: any): any[] => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments.filter(Boolean);
  if (typeof attachments === "string") {
    try {
      const parsed = JSON.parse(attachments);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [attachments];
    } catch { return [attachments]; }
  }
  return [];
};

/**
 * 24-Hour Format Date Time Formatter
 * Output: DD-MMM-YY HH:mm:ss (e.g., 03-Aug-26 20:16:43)
 */
const formatDateTime24 = (dt: any) => {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const month = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${day}-${month}-${yy} ${hh}:${mm}:${ss}`;
  } catch { return String(dt); }
};

const formatDateDDMMMYY = (dateStr: string) => {
  if (!dateStr) return "—";
  const cleanStr = String(dateStr).trim().split(" ")[0].split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mIdx = parseInt(m, 10) - 1;
  if (mIdx < 0 || mIdx > 11) return dateStr;
  const yy = y.slice(-2);
  return `${d}-${months[mIdx]}-${yy}`;
};

const rupee = (val: any) => {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  if (n === 0) return "₹0";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

interface ParsedActivity {
  text: string;
  parsed: any;
  callsList: any[];
  pmsList: any[];
  assetsList: any[];
  otherDesc: string;
  selected: string;
  hospitalName: string;
  equipmentName: string;
  equipmentModel: string;
  department: string;
  barcode: string;
  schedule: string;
  callsType: string;
  callsStatus: string;
  attachmentUrl: string;
  callsBarcode: string;
  callsVerified: boolean;
  pmsBarcode: string;
  pmsVerified: boolean;
  pmsFrequency: string;
  assetEquipment: string;
  assetQuantity: number;
}

const defaultParsedActivity: ParsedActivity = {
  text: "",
  parsed: null,
  callsList: [],
  pmsList: [],
  assetsList: [],
  otherDesc: "",
  selected: "",
  hospitalName: "",
  equipmentName: "",
  equipmentModel: "",
  department: "",
  barcode: "",
  schedule: "",
  callsType: "",
  callsStatus: "",
  attachmentUrl: "",
  callsBarcode: "",
  callsVerified: false,
  pmsBarcode: "",
  pmsVerified: false,
  pmsFrequency: "",
  assetEquipment: "",
  assetQuantity: 0
};

/**
 * Deep JSON Parser for Activity Details, Calls, PMS, Hospital, Equipment & Barcode
 */
const parseActivityDetails = (raw: any): ParsedActivity => {
  if (!raw) return defaultParsedActivity;
  let obj = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        obj = JSON.parse(trimmed);
      } catch {
        return { ...defaultParsedActivity, text: isValidText(trimmed) ? trimmed : "" };
      }
    } else {
      return { ...defaultParsedActivity, text: isValidText(trimmed) ? trimmed : "" };
    }
  }

  if (typeof obj !== "object" || obj === null) return { ...defaultParsedActivity, text: isValidText(obj) ? String(obj) : "" };

  const hospitalName = obj.hospital_name || obj.hospital || obj.facility_name || obj.location_visited || obj.calls_asset_details?.hospital_name || "";
  const equipmentName = obj.equipment_name || obj.equipment || obj.asset_name || obj.calls_asset_details?.equipment_name || obj.asset_tagging_equipment || "";
  const equipmentModel = obj.equipment_model || obj.model || obj.model_no || obj.make || obj.brand || "";
  const department = obj.department || obj.dept || obj.ward || obj.location_in_facility || "";
  const barcode = obj.barcode || obj.calls_barcode || obj.pms_barcode || obj.asset_barcode || obj.serial_no || obj.serial_number || "";
  const schedule = obj.schedule || obj.pms_frequency || obj.frequency || "";

  // Call Type
  const callsTypeRaw = obj.calls_type || obj.call_type || "";
  let callsType = callsTypeRaw;
  if (callsTypeRaw.toLowerCase().includes("support") || callsTypeRaw.toLowerCase().includes("online")) callsType = "Online Support";
  else if (callsTypeRaw.toLowerCase().includes("field")) callsType = "Field Support";
  else if (callsTypeRaw.toLowerCase().includes("breakdown")) callsType = "Breakdown Call";

  // Call Status
  const callsStatusRaw = obj.calls_status || obj.call_status || "";
  let callsStatus = callsStatusRaw;
  if (callsStatusRaw.toLowerCase() === "attend" || callsStatusRaw.toLowerCase() === "attended") callsStatus = "Attended";
  else if (callsStatusRaw.toLowerCase() === "close" || callsStatusRaw.toLowerCase() === "closed") callsStatus = "Closed";
  else if (callsStatusRaw.toLowerCase().includes("both")) callsStatus = "Attended & Closed";

  const attachmentUrl = obj.attachment_url || obj.service_report_url || obj.photo_url || obj.calls_asset_details?.attachment_url || obj.image_url || "";

  const otherDesc = isValidText(obj.activity_other_desc) ? obj.activity_other_desc : (isValidText(obj.other_desc) ? obj.other_desc : (isValidText(obj.remark) ? obj.remark : (isValidText(obj.reason) ? obj.reason : "")));
  const selected = Array.isArray(obj.selected_activities) ? obj.selected_activities.filter(isValidText).join(", ") : (isValidText(obj.selected_activities) ? obj.selected_activities : "");
  const mainText = otherDesc || selected || "";

  const callsList = Array.isArray(obj.calls_list) ? obj.calls_list : (Array.isArray(obj.calls) ? obj.calls : []);
  const pmsList = Array.isArray(obj.pms_list) ? obj.pms_list : (Array.isArray(obj.pms) ? obj.pms : []);
  const assetsList = Array.isArray(obj.assets_list) ? obj.assets_list : (Array.isArray(obj.assets) ? obj.assets : []);

  return {
    text: mainText,
    otherDesc,
    selected,
    hospitalName,
    equipmentName,
    equipmentModel,
    department,
    barcode,
    schedule,
    callsType,
    callsStatus,
    attachmentUrl,
    callsBarcode: obj.calls_barcode || barcode || "",
    callsVerified: obj.calls_verified || false,
    pmsBarcode: obj.pms_barcode || barcode || "",
    pmsVerified: obj.pms_verified || false,
    pmsFrequency: obj.pms_frequency || schedule || "",
    assetEquipment: obj.asset_tagging_equipment || equipmentName || "",
    assetQuantity: parseInt(obj.asset_tagging_quantity || obj.quantity || "0", 10) || 0,
    callsList,
    pmsList,
    assetsList,
    parsed: obj
  };
};

const parseItineraryList = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        let parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") {
          try { parsed = JSON.parse(parsed); } catch (e) {}
        }
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.legs)) return parsed.legs;
          if (Array.isArray(parsed.itineraries)) return parsed.itineraries;
          if (Array.isArray(parsed.itinerary)) return parsed.itinerary;
          return [parsed];
        }
      } catch (e) {}
    }
  }
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.legs)) return raw.legs;
    if (Array.isArray(raw.itineraries)) return raw.itineraries;
    if (Array.isArray(raw.itinerary)) return raw.itinerary;
    return [raw];
  }
  return [];
};

const getResolvedItineraries = (c: any): any[] => {
  if (!c) return [];
  const sources = [c.itineraries, c.legs, c.itinerary_list, c.itinerary, c.claim_itinerary, c.claim_legs];
  for (const src of sources) {
    const list = parseItineraryList(src);
    if (Array.isArray(list) && list.length > 0) {
      // Deduplicate by leg number or unique route to guarantee NO duplicate cards
      const seen = new Set();
      const deduped: any[] = [];
      list.forEach((item: any, idx: number) => {
        const key = item.leg !== undefined ? `leg_${item.leg}` : `idx_${idx}_${item.from}_${item.to}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      });
      return deduped.length > 0 ? deduped : list;
    }
  }
  if (c.from || c.from_location || c.to || c.to_location || c.km || c.total_km || c.travel_amount || c.amount || c.da || c.daily_allowance) {
    return [{
      leg: 1,
      from: c.from || c.from_location || "Source",
      to: c.to || c.to_location || "Destination",
      from_district: c.from_district || c.district || "",
      to_district: c.to_district || c.district || "",
      mode: c.travel_mode || c.category || "Bike",
      km: parseFloat(c.km || c.total_km || c.distance_km || 0),
      amount: parseFloat(c.travel_amount || c.ta_amount || c.amount || 0),
      da: parseFloat(c.da || c.daily_allowance || c.da_amount || 0),
      other_expenses: parseFloat(c.other_expenses || c.other_amount || 0),
      other_expenses_remark: c.other_expenses_remark || c.other_reason || c.remark || "",
      activity_details: c.activity_details || c.meta || {},
    }];
  }
  return [];
};

// ─── TRAVEL MODE CHIP ────────────────────────────────────────────────────────

const ModeChip = ({ mode }: { mode: string }) => {
  if (!mode) return null;
  const lower = mode.toLowerCase();
  let cls = "bg-slate-100 text-slate-700 border-slate-200";
  if (lower.includes("bike") || lower.includes("two")) cls = "bg-cyan-50 text-cyan-800 border-cyan-200/90";
  else if (lower.includes("car") || lower.includes("four")) cls = "bg-indigo-50 text-indigo-800 border-indigo-200/90";
  else if (lower.includes("auto") || lower.includes("rickshaw")) cls = "bg-amber-50 text-amber-800 border-amber-200/90";
  else if (lower.includes("bus") || lower.includes("train")) cls = "bg-emerald-50 text-emerald-800 border-emerald-200/90";
  return (
    <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-tight border ${cls} shadow-2xs whitespace-nowrap`}>
      {mode}
    </span>
  );
};



// ─── STATUS BADGE ────────────────────────────────────────────────────────────

const StatusBadge = ({ status, record, getStatusBadgeClass, getStatusLabel }: any) => (
  <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[9.5px] font-bold border ${getStatusBadgeClass(status, record)}`}>
    {getStatusLabel(status, record)}
  </span>
);

// ─── SECTION HEADER ──────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, label, accent = "#4A6A8A", count }: { icon: any; label: string; accent?: string; count?: number | string }) => (
  <div className="flex items-center justify-between gap-1.5 mb-2">
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
        <Icon size={11} style={{ color: accent }} strokeWidth={2.2} />
      </div>
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">{label}</span>
      {count !== undefined && (
        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
          {count}
        </span>
      )}
    </div>
    <div className="flex-1 h-px bg-slate-200/60 ml-1.5" />
  </div>
);

// ─── MINIMAL AMOUNT STAT BOX ──────────────────────────────────────────────────

const MiniAmountBox = ({ label, value, subtext, color = "#4338CA" }: { label: string; value: string; subtext?: string; color?: string }) => (
  <div className="flex flex-col items-center justify-center rounded-[4px] border border-line/80 bg-white px-2.5 py-2 flex-1 min-w-[85px] shadow-2xs hover:border-line-strong transition-all">
    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 text-center leading-none mb-1 font-sans">{label}</span>
    <span className="text-[12.5px] font-bold font-mono leading-tight" style={{ color }}>{value}</span>
    {subtext && <span className="text-[8.5px] text-ink-400 font-mono font-medium mt-0.5">{subtext}</span>}
  </div>
);

// ─── ATTACHMENT CARD ──────────────────────────────────────────────────────────

const AttachmentCard = ({ att, index, setLightboxImage }: { att: any; index: number; setLightboxImage: (u: string) => void }) => {
  const url = typeof att === "string" ? att : (att.file_url || att.url || "");
  if (!url) return null;

  const fullUrl = formatImageUrl(url);
  const isPdf = url.toLowerCase().split("?")[0].endsWith(".pdf");
  const billType = typeof att === "object" ? att.bill_type : null;

  return (
    <div
      className="group relative rounded-[4px] border border-line/80 bg-white hover:bg-surface-sunken overflow-hidden shadow-2xs hover:border-accent-400 transition-all cursor-pointer flex items-center justify-between gap-2 p-2.5"
      onClick={() => isPdf ? window.open(fullUrl, "_blank") : setLightboxImage(fullUrl)}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-[3px] bg-surface-sunken flex items-center justify-center shrink-0 border border-line">
          {isPdf ? (
            <FileText size={16} className="text-rose-500" />
          ) : (
            <FileText size={16} className="text-accent-600" />
          )}
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[11px] font-bold text-ink-900 truncate">
            {billType ? `${billType} Bill` : `Attachment #${index + 1}`}
          </div>
          <div className="text-[8.5px] text-slate-400 font-semibold truncate">
            {isPdf ? "PDF Document (Click to view)" : "Image File (Click for popup)"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 bg-slate-100 group-hover:bg-[#4A6A8A] group-hover:text-white px-2 py-1 rounded text-slate-600 transition-all shrink-0">
        <Eye size={12} className="shrink-0" />
        <span className="text-[9px] font-bold">View</span>
      </div>
    </div>
  );
};
// ─── LEG DETAILS CARD ─────────────────────────────────────────────────────────

const LegDetailCard = ({
  leg, index, totalLegsCount, setLightboxImage, barcodeMap, claimDistrictType, userAllowance, claimMaster, allAttachments,
  canEditAmounts, editedLeg, onLegAmountChange, onLegRemarkChange, routeBenchmark, auditLogs
}: {
  leg: any; index: number; totalLegsCount: number; setLightboxImage: (u: string) => void;
  barcodeMap: Record<string, { equipment: string; hospital: string }>;
  claimDistrictType?: string;
  userAllowance?: any;
  claimMaster?: any;
  allAttachments?: any[];
  canEditAmounts?: boolean;
  editedLeg?: any;
  onLegAmountChange?: (index: number, field: string, value: string | number) => void;
  onLegRemarkChange?: (index: number, field: string, remark: string) => void;
  routeBenchmark?: any;
  auditLogs?: any[];
}) => {
  const legNum = leg.leg || leg.leg_number || index + 1;
  const isFirstLeg = index === 0; // STRICT: DA is attached ONLY to the 1st Leg of the day!

  const fromDist = leg.from_district || leg.from_dist || "—";
  const toDist = leg.to_district || leg.to_dist || "—";
  const fromLoc = leg.from || leg.from_location || "—";
  const toLoc = leg.to || leg.to_location || "—";
  const mode = leg.mode || leg.travel_mode || "Bike";
  const subMode = leg.sub_mode || "";
  const km = leg.km ?? leg.distance_km ?? 0;
  const origKm = leg.original_km ?? leg.original_distance_km;

  // DYNAMIC RATES FETCHED FROM DB ALLOWANCE MASTER BY GRADE
  const rawBike = leg.rate_bike || leg.bike_rate || userAllowance?.rate_bike || claimMaster?.rate_bike || claimMaster?.allowance?.rate_bike;
  const dbBikeRate = (!rawBike || parseFloat(rawBike) === 4.5) ? 5.0 : parseFloat(rawBike);

  const rawCar = leg.rate_car || leg.car_rate || userAllowance?.rate_car || claimMaster?.rate_car || claimMaster?.allowance?.rate_car;
  const dbCarRate = (!rawCar || parseFloat(rawCar) === 9.0 || parseFloat(rawCar) === 9) ? 11.0 : parseFloat(rawCar);

  const dbOutDistrictDa = userAllowance?.daily_out_district || claimMaster?.daily_out_district || claimMaster?.allowance?.daily_out_district || 150;
  
  const isCar = mode.toLowerCase().includes("car") || mode.toLowerCase().includes("four");
  const rawRatePerKm = leg.rate_per_km
    ? parseFloat(leg.rate_per_km)
    : (leg.rate ? parseFloat(leg.rate) : (isCar ? dbCarRate : dbBikeRate));

  const ratePerKm = (rawRatePerKm === 4.5) ? 5.0 : ((rawRatePerKm === 9.0 || rawRatePerKm === 9) ? 11.0 : rawRatePerKm);
  
  // Deep Parse activity details / meta
  const act = parseActivityDetails(leg.activity_details || leg.activity || leg.meta);

  // Per-Leg Current Net Amounts
  const taAmt = parseFloat(leg.amount ?? leg.travel_amount ?? 0);
  const origTa = parseFloat(leg.original_amount ?? leg.original_travel_amount ?? 0);
  const daAmt = parseFloat(leg.da ?? leg.da_amount ?? 0);
  const origDa = parseFloat(leg.original_da ?? leg.original_da_amount ?? 0);
  const hotelAmt = parseFloat(leg.hotel ?? leg.hotel_amount ?? 0);
  const localPur = parseFloat(leg.local_purchase ?? leg.local_purchase_amount ?? 0);
  const localPurRemark = leg.local_purchase_remark || leg.local_purchase_reason || "";
  const othAmt = parseFloat(leg.oth_amount ?? leg.other_amount ?? leg.sub_amount ?? leg.parcel_amount ?? 0);
  
  // ROBUST OTHER EXPENSE REMARK / REASON RESOLVER
  const othDesc = isValidText(leg.parcel_desc) ? leg.parcel_desc
    : (isValidText(leg.sub_mode_desc) ? leg.sub_mode_desc
    : (isValidText(leg.other_desc) ? leg.other_desc
    : (isValidText(leg.other_expense_remark) ? leg.other_expense_remark
    : (isValidText(leg.other_expense_reason) ? leg.other_expense_reason
    : (isValidText(leg.other_reason) ? leg.other_reason
    : (isValidText(leg.oth_remark) ? leg.oth_remark
    : (isValidText(leg.oth_desc) ? leg.oth_desc
    : (isValidText(act.otherDesc) ? act.otherDesc
    : (isValidText(leg.remark) ? leg.remark : "")))))))));
  
  const netLegAmt = taAmt + (isFirstLeg ? daAmt : 0) + hotelAmt + localPur + othAmt;

  const estimatedSubmittedTa = origTa > 0 ? origTa : ((km > 0 && taAmt === 0) ? (km * ratePerKm) : taAmt);

  const isInDistrictLeg = (fromDist && toDist && fromDist.toLowerCase() === toDist.toLowerCase() && fromDist !== "—") || claimDistrictType === "In-District";

  // Check if DA was claimed by engineer on LEG #1 ONLY
  const isDaClaimed = isFirstLeg && (leg.is_da_claimed ?? leg.da_claimed ?? (origDa > 0 || (leg.da !== undefined && parseFloat(leg.da) === 0 && isInDistrictLeg)));
  
  // Estimated Submitted DA: Only Leg #1 gets evaluated for DA deduction!
  const estimatedSubmittedDa = isFirstLeg
    ? (origDa > 0 ? origDa : (isDaClaimed ? dbOutDistrictDa : daAmt))
    : 0;

  const submittedLegAmt = (leg.claimed_amount || leg.original_total)
    ? parseFloat(leg.claimed_amount || leg.original_total)
    : (estimatedSubmittedTa + estimatedSubmittedDa + hotelAmt + localPur + othAmt);

  // Leg Deductions & Reasons
  const legDeductionAmt = parseFloat(leg.deduction_amount ?? leg.deduction_amt ?? 0);
  const kmDeductionReason = leg.km_deduction_reason || leg.system_km_reason || "";
  
  // DA deduction reasons ONLY apply on Leg #1!
  const daDeductionReason = isFirstLeg ? (leg.da_deduction_reason || leg.system_da_reason || "") : "";
  const baseLocationDeductionReason = leg.base_location_deduction_reason || leg.base_location_reason || leg.base_location_policy || leg.location_policy_reason || "";

  // Work Metrics (Strict Barcode Check)
  const callsFromAct = (act.callsList && Array.isArray(act.callsList) && act.callsList.length > 0)
    ? act.callsList
    : (Array.isArray(leg.calls_list) && leg.calls_list.length > 0
        ? leg.calls_list
        : (Array.isArray(leg.calls) && leg.calls.length > 0 ? leg.calls : []));

  const validCallsInList = callsFromAct.filter((c: any) => c && (c.barcode || c.calls_barcode || c.complaint_id || c.calls_complaint_id)).length;
  
  const isCallsSelectedInActivity = Array.isArray(act.parsed?.selected_activities)
    ? act.parsed.selected_activities.includes("Calls")
    : (Array.isArray(leg.selected_activities) ? leg.selected_activities.includes("Calls") : true);

  const hasLegacyCall = validCallsInList === 0 && isCallsSelectedInActivity && (
    isValidText(act.parsed?.calls_complaint_id) ||
    isValidText(leg.calls_complaint_id) ||
    parseInt(leg.ws_closed || leg.calls_count || leg.calls_closed || leg.ws_assigned || "0", 10) > 0
  ) && (isValidText(act.callsBarcode) || isValidText(leg.calls_barcode));

  const calculatedDeduction = (legDeductionAmt > 0)
    ? legDeductionAmt
    : ((submittedLegAmt > netLegAmt) ? (submittedLegAmt - netLegAmt) : 0);

  const isKmEdited = origKm && parseFloat(origKm) !== parseFloat(km);
  const isTaEdited = estimatedSubmittedTa > taAmt;
  
  // DA is edited ONLY if isFirstLeg is true!
  const isDaEdited = isFirstLeg && (estimatedSubmittedDa > daAmt);

  // Match manager manual edit from audit logs (Fix 1b)
  const matchingManagerEdit = (auditLogs || []).find((log: any) => {
    if (log.action_type !== "MANAGER_EDIT") return false;
    const fn = (log.field_name || "").toLowerCase();
    if (isTaEdited && (fn.includes("ta") || fn.includes("travel") || fn.includes("km") || fn.includes(`leg_${index + 1}`))) return true;
    if (isDaEdited && (fn.includes("da") || fn.includes("daily") || fn.includes(`leg_${index + 1}`))) return true;
    if (fn.includes(`leg_${index + 1}`) || fn.includes(`leg${index + 1}`)) return true;
    return false;
  }) || (auditLogs || []).find((log: any) => log.action_type === "MANAGER_EDIT");

  // STRICT PER-LEG DEDUCTION CHECK: Only show if there's an explicit per-leg adjustment
  const hasLegDeduction = (calculatedDeduction > 0 || isTaEdited || isDaEdited || isKmEdited || isValidText(kmDeductionReason) || isValidText(daDeductionReason) || (isFirstLeg && isValidText(baseLocationDeductionReason)));

  // Work Metrics
  const callsClosed = validCallsInList > 0 
    ? validCallsInList 
    : (hasLegacyCall ? 1 : 0);
  const pmsCount = leg.pms_count || leg.ws_pms || 0;
  const calibCount = leg.calibration_count || 0;
  const mobiCount = leg.mobilise_count || leg.mobilise_asset_count || 0;
  const assetTagging = leg.asset_tagging || leg.ws_asset || 0;
  
  const hospitalName = leg.hospital_name || leg.hospital || leg.location_visited || act.hospitalName || "";
  const equipmentName = leg.equipment_name || leg.equipment || act.equipmentName || "";
  const equipmentModel = leg.equipment_model || leg.model || act.equipmentModel || "";
  const department = leg.department || leg.dept || act.department || "";
  const barcode = leg.barcode || act.barcode || "";
  const schedule = leg.schedule || act.schedule || "";

  // Validate Purpose & Reasons
  const rawPurpose = leg.visit_purpose || leg.purpose || act.text || "";
  const purpose = isValidText(rawPurpose) ? String(rawPurpose).trim() : "";
  
  const rawOtherReason = leg.other_reason || leg.other_desc || (act.otherDesc && act.otherDesc !== localPurRemark ? act.otherDesc : "");
  const otherReason = isValidText(rawOtherReason) ? String(rawOtherReason).trim() : "";

  // STRICT ZERO WORK CHECK: Calls badge ONLY IF callsClosed > 0!
  const hasCalls = callsClosed > 0;
  const hasPms = pmsCount > 0 || (act.pmsList && act.pmsList.length > 0) || !!act.pmsBarcode;
  const hasCalib = calibCount > 0;
  const hasMobi = mobiCount > 0;
  const hasAssetTagging = assetTagging > 0 || (act.assetsList && act.assetsList.length > 0);

  const isOtherCategory = mode.toLowerCase().includes("other");

  // Strict URL Normalizer
  const toFullUrl = (u: any) => {
    return formatImageUrl(u);
  };

  // ─── HIGH-PRECISION BILL TO LEG ATTACHMENT MATCHER ─────────────────────────
  const getLegTravelBillUrl = (): string => {
    if (leg.travel_bill || leg.ta_bill || leg.ticket_url || leg.bus_bill || leg.train_ticket) {
      return toFullUrl(leg.travel_bill || leg.ta_bill || leg.ticket_url || leg.bus_bill || leg.train_ticket);
    }
    if (leg.attachment_url || leg.photo_url || leg.bill_url || leg.service_report_url || act.attachmentUrl) {
      const candidate = toFullUrl(leg.attachment_url || leg.photo_url || leg.bill_url || leg.service_report_url || act.attachmentUrl);
      const lower = candidate.toLowerCase();
      if (!lower.includes("hotel") && !lower.includes("local_purchase") && !lower.includes("stay_bill")) {
        return candidate;
      }
    }

    const legAtts = getAttachmentsArray(leg.attachments || leg.bills || leg.photos);
    for (const a of legAtts) {
      const urlStr = typeof a === "string" ? a : (a.file_url || a.url || a.path || "");
      if (urlStr) return toFullUrl(urlStr);
    }

    if (allAttachments && allAttachments.length > 0) {
      for (let aIdx = 0; aIdx < allAttachments.length; aIdx++) {
        const att = allAttachments[aIdx];
        if (!att) continue;

        const attLegIdx = typeof att === "object" ? (att.leg_index ?? att.leg_idx ?? att.legIndex) : undefined;
        const attLegNum = typeof att === "object" ? (att.leg_number ?? att.leg_num ?? att.legNum ?? att.leg) : undefined;
        const attAmount = typeof att === "object" ? parseFloat(att.amount || att.travel_amount || att.leg_amount || 0) : 0;
        const attMode = typeof att === "object" ? String(att.mode || att.travel_mode || att.bill_type || "").toLowerCase() : "";
        const urlStr = typeof att === "string" ? att : (att.file_url || att.url || att.path || "");
        if (!urlStr) continue;
        const lowerUrl = urlStr.toLowerCase();

        if (attLegIdx !== undefined && attLegIdx !== null && parseInt(attLegIdx, 10) === index) return toFullUrl(urlStr);
        if (attLegNum !== undefined && attLegNum !== null && parseInt(attLegNum, 10) === legNum) return toFullUrl(urlStr);

        if (attAmount > 0 && (Math.abs(attAmount - taAmt) < 2 || Math.abs(attAmount - netLegAmt) < 2)) return toFullUrl(urlStr);

        const isBusTrainTicket = attMode.includes("bus") || attMode.includes("train") || lowerUrl.includes("bus") || lowerUrl.includes("train") || lowerUrl.includes("ticket");
        const isLegBusTrain = mode.toLowerCase().includes("bus") || mode.toLowerCase().includes("train");
        if (isBusTrainTicket && isLegBusTrain) return toFullUrl(urlStr);

        if (allAttachments.length === totalLegsCount && aIdx === index) {
          if (!lowerUrl.includes("hotel") && !lowerUrl.includes("local_purchase") && !lowerUrl.includes("stay_bill")) {
            return toFullUrl(urlStr);
          }
        }
      }
    }
    return "";
  };

  const travelTaBillUrl = getLegTravelBillUrl();

  // 2. Hotel / Stay Specific Bill URL FOR THIS LEG ONLY
  const getLegHotelBillUrl = (): string => {
    if (hotelAmt <= 0) return "";
    const directUrl = toFullUrl(leg.hotel_bill || leg.hotel_photo || leg.hotel_url || leg.stay_bill);
    if (directUrl) return directUrl;

    if (allAttachments && allAttachments.length > 0) {
      for (const att of allAttachments) {
        if (!att) continue;
        const attLegIdx = typeof att === "object" ? (att.leg_index ?? att.leg_idx ?? att.legIndex) : undefined;
        const attLegNum = typeof att === "object" ? (att.leg_number ?? att.leg_num ?? att.legNum ?? att.leg) : undefined;
        const urlStr = typeof att === "string" ? att : (att.file_url || att.url || att.path || "");
        if (!urlStr) continue;
        const lowerUrl = urlStr.toLowerCase();
        const billType = typeof att === "object" ? String(att.bill_type || att.category || "").toLowerCase() : "";

        if (attLegIdx !== undefined && parseInt(attLegIdx, 10) === index) return toFullUrl(urlStr);
        if (attLegNum !== undefined && parseInt(attLegNum, 10) === legNum) return toFullUrl(urlStr);
        if (billType.includes("hotel") || billType.includes("stay") || lowerUrl.includes("hotel") || lowerUrl.includes("stay")) return toFullUrl(urlStr);
      }
    }
    return "";
  };
  const hotelBillUrl = getLegHotelBillUrl();

  // 3. Local Purchase Specific Bill URL FOR THIS LEG ONLY
  const getLegLocalPurchaseBillUrl = (): string => {
    if (localPur <= 0) return "";
    const directUrl = toFullUrl(leg.local_purchase_bill || leg.local_purchase_photo || leg.local_purchase_url || leg.lp_bill);
    if (directUrl) return directUrl;

    if (allAttachments && allAttachments.length > 0) {
      for (const att of allAttachments) {
        if (!att) continue;
        const attLegIdx = typeof att === "object" ? (att.leg_index ?? att.leg_idx ?? att.legIndex) : undefined;
        const attLegNum = typeof att === "object" ? (att.leg_number ?? att.leg_num ?? att.legNum ?? att.leg) : undefined;
        const urlStr = typeof att === "string" ? att : (att.file_url || att.url || att.path || "");
        if (!urlStr) continue;
        const lowerUrl = urlStr.toLowerCase();
        const billType = typeof att === "object" ? String(att.bill_type || att.category || "").toLowerCase() : "";

        if (attLegIdx !== undefined && parseInt(attLegIdx, 10) === index) return toFullUrl(urlStr);
        if (attLegNum !== undefined && parseInt(attLegNum, 10) === legNum) return toFullUrl(urlStr);
        if (billType.includes("local") || billType.includes("purchase") || lowerUrl.includes("local") || lowerUrl.includes("purchase")) return toFullUrl(urlStr);
      }
    }
    return "";
  };
  const localPurchaseBillUrl = getLegLocalPurchaseBillUrl();

  // 4. Other Expense / Parcel Specific Bill URL FOR THIS LEG ONLY
  const getLegOtherBillUrl = (): string => {
    if (othAmt <= 0) return "";
    const directUrl = toFullUrl(leg.other_bill || leg.other_photo || leg.parcel_photo || leg.oth_bill);
    if (directUrl) return directUrl;

    if (allAttachments && allAttachments.length > 0) {
      for (const att of allAttachments) {
        if (!att) continue;
        const attLegIdx = typeof att === "object" ? (att.leg_index ?? att.leg_idx ?? att.legIndex) : undefined;
        const attLegNum = typeof att === "object" ? (att.leg_number ?? att.leg_num ?? att.legNum ?? att.leg) : undefined;
        const urlStr = typeof att === "string" ? att : (att.file_url || att.url || att.path || "");
        if (!urlStr) continue;
        const lowerUrl = urlStr.toLowerCase();
        const billType = typeof att === "object" ? String(att.bill_type || att.category || "").toLowerCase() : "";

        if (attLegIdx !== undefined && parseInt(attLegIdx, 10) === index) return toFullUrl(urlStr);
        if (attLegNum !== undefined && parseInt(attLegNum, 10) === legNum) return toFullUrl(urlStr);
        if (billType.includes("other") || billType.includes("parcel") || lowerUrl.includes("other") || lowerUrl.includes("parcel")) return toFullUrl(urlStr);
      }
    }
    return "";
  };
  const otherBillUrl = getLegOtherBillUrl();

  // Construct Effective Calls List for Excel Table Format
  const effectiveCallsList = validCallsInList > 0 ? callsFromAct : (
    hasLegacyCall ? [{
      complaint_id: act.parsed?.calls_complaint_id || leg.calls_complaint_id || act.parsed?.complaint_id || leg.complaint_id || "—",
      barcode: act.callsBarcode || leg.calls_barcode || barcode || "—",
      equipment: act.equipmentName || leg.equipment_name || equipmentName || "—",
      hospital: act.parsed?.calls_asset_details?.hospital_name || leg.hospital_name || act.hospitalName || hospitalName || "—",
      call_type: act.callsType || leg.calls_type || "Service Call",
      status: act.callsStatus || leg.calls_status || "Attended & Closed",
      action_taken: act.parsed?.calls_action_taken || leg.calls_action_taken || "—",
      spare_replaced: act.parsed?.calls_spare_replaced || leg.calls_spare_replaced || "No",
      spare_name: act.parsed?.calls_spare_name || leg.calls_spare_name || "",
      spare_estimated_value: act.parsed?.calls_spare_estimated_value || leg.calls_spare_estimated_value || 0,
      attachment_url: act.attachmentUrl || leg.calls_photo_url || travelTaBillUrl || ""
    }] : []
  );

  return (
    <div className="rounded-[4px] border border-line/80 bg-white p-2 shadow-2xs space-y-2.5 hover:border-line-strong transition-all">
      {/* Leg Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-line/60">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-[3px] bg-accent-900 text-white flex items-center justify-center text-[10px] font-bold font-mono shrink-0 shadow-2xs">
            #{legNum}
          </span>
          <div className="flex items-center gap-1 text-xs font-bold text-ink-900 font-display">
            <span>{fromDist}</span>
            <ArrowRight size={11} className="text-ink-400" />
            <span>{toDist}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <ModeChip mode={mode} />
          {subMode && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 border border-accent-200">Sub: {subMode}</span>}
          {km > 0 && (
            <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full border ${isKmEdited ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-surface-sunken text-ink-700 border-line"}`}>
              {km} km (@ ₹{ratePerKm}/km) {isKmEdited ? `(Orig: ${origKm}km)` : ""}
            </span>
          )}
          {submittedLegAmt > netLegAmt && (
            <span className="text-[9.5px] font-medium font-mono px-2 py-0.5 rounded-full bg-surface-sunken text-ink-500 border border-line">
              Claimed: {rupee(submittedLegAmt)}
            </span>
          )}
          <span className="text-[10.5px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            Net: {rupee(netLegAmt)}
          </span>
        </div>
      </div>

      {/* Locations - Lower Boxes show strictly From/To location entered by user */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
          <Navigation size={10} className="text-slate-400 shrink-0" />
          <span className="text-slate-400 font-bold uppercase text-[8.5px]">From:</span>
          <span className="font-semibold text-slate-800 truncate">{fromLoc !== "—" ? fromLoc : fromDist}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
          <MapPin size={10} className="text-[#4A6A8A] shrink-0" />
          <span className="text-slate-400 font-bold uppercase text-[8.5px]">To:</span>
          <span className="font-semibold text-slate-800 truncate">{toLoc !== "—" ? toLoc : toDist}</span>
        </div>
      </div>

      {/* PER-LEG FINANCIAL BREAKDOWN STRIP WITH STRICT CATEGORY & PER-LEG ISOLATED BILL ATTACHMENT MAPPINGS */}
      <div className="bg-slate-50/80 p-1.5 rounded-[3px] border border-slate-200 flex flex-wrap gap-1 items-center justify-between text-[9.5px]">
        <div className="flex flex-wrap gap-2 items-center">
          
          {/* 1. TRAVEL TA & ITS BUS/TRAIN/TRAVEL TICKET (STRICTLY FOR THIS LEG ONLY) */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-slate-400 font-bold uppercase text-[8.5px]">Travel TA:</span>
            <b className="text-slate-900">{rupee(taAmt)}</b>
            {isTaEdited && <span className="text-[8px] text-amber-700 font-bold">(Orig: {rupee(estimatedSubmittedTa)})</span>}
            {travelTaBillUrl && (
              <button
                onClick={() => setLightboxImage(travelTaBillUrl)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#4A6A8A] text-white text-[8.5px] font-bold hover:bg-[#3b546e] transition-colors cursor-pointer ml-0.5"
                title="View Bus/Train Travel Ticket for Leg #"
              >
                <Eye size={10} /> View Bill
              </button>
            )}
          </div>

          {/* 2. DAILY DA (STRICTLY RESTRICTED TO LEG #1 ONLY - COMPLETELY HIDDEN ON LEG #2, #3, #4...) */}
          {isFirstLeg && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <span className="text-slate-400 font-bold uppercase text-[8.5px]">Daily DA:</span>
              <b className="text-emerald-800">{rupee(daAmt)}</b>
              {isDaEdited && <span className="text-[8px] text-amber-700 font-bold">(Orig: {rupee(estimatedSubmittedDa)})</span>}
            </div>
          )}

          {/* 3. LOCAL PURCHASE & ITS LOCAL PURCHASE BILL (STRICTLY FOR THIS LEG ONLY) */}
          {localPur > 0 && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 flex-wrap">
              <span className="text-amber-800 font-bold uppercase text-[8.5px]">Local Purchase:</span>
              <b className="text-amber-900">{rupee(localPur)}</b>
              {localPurRemark && <span className="text-[8.5px] text-slate-600 font-medium">({localPurRemark})</span>}
              {localPurchaseBillUrl && (
                <button
                  onClick={() => setLightboxImage(localPurchaseBillUrl)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-700 text-white text-[8.5px] font-bold hover:bg-amber-800 transition-colors cursor-pointer ml-0.5"
                  title="View Local Purchase Bill for Leg #"
                >
                  <Eye size={10} /> View Bill
                </button>
              )}
            </div>
          )}

          {/* 4. HOTEL / STAY & ITS HOTEL BILL (STRICTLY FOR THIS LEG ONLY) */}
          {hotelAmt > 0 && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 flex-wrap">
              <span className="text-purple-800 font-bold uppercase text-[8.5px]">Hotel:</span>
              <b className="text-purple-900">{rupee(hotelAmt)}</b>
              {hotelBillUrl && (
                <button
                  onClick={() => setLightboxImage(hotelBillUrl)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-700 text-white text-[8.5px] font-bold hover:bg-purple-800 transition-colors cursor-pointer ml-0.5"
                  title="View Hotel Bill for Leg #"
                >
                  <Eye size={10} /> View Bill
                </button>
              )}
            </div>
          )}

          {/* 5. OTHER EXPENSE / PARCEL WITH EXACT REMARK / DESCRIPTION DISPLAYED */}
          {othAmt > 0 && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 flex-wrap">
              <span className="text-amber-800 font-bold uppercase text-[8.5px]">Other Exp:</span>
              <b className="text-amber-900">{rupee(othAmt)}</b>
              {othDesc && (
                <span className="text-[8.5px] text-[#4A6A8A] font-extrabold bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200/90">
                  ({othDesc})
                </span>
              )}
              {otherBillUrl && (
                <button
                  onClick={() => setLightboxImage(otherBillUrl)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-700 text-white text-[8.5px] font-bold hover:bg-amber-800 transition-colors cursor-pointer ml-0.5"
                  title="View Other Expense Bill for Leg #"
                >
                  <Eye size={10} /> View Bill
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PER-LEG ADJUSTMENTS CARD (ONLY IF EXPLICIT LEG KM/TA EDITS EXIST) */}
      {hasLegDeduction && (
        <div className="bg-rose-50/90 p-2.5 rounded-[3px] border border-rose-200 space-y-1.5 text-[9.5px]">
          {/* Header */}
          <div className="flex items-center justify-between font-extrabold text-rose-900 border-b border-rose-200/80 pb-1">
            <span className="flex items-center gap-1.5 text-[10px]">
              <AlertTriangle size={12} className="text-rose-600" /> Leg #{legNum} Policy Adjustments
            </span>
            {calculatedDeduction > 0 && (
              <span className="text-[11px] font-black text-rose-600">
                Total Leg Deduction: -{rupee(calculatedDeduction)}
              </span>
            )}
          </div>

          {/* Itemized Calculation Grid */}
          <div className="bg-white/80 p-1.5 rounded border border-rose-100 grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9px] text-slate-700">
            {isTaEdited && (
              <div>
                <span className="text-slate-400 font-bold uppercase text-[8px] block">Travel TA ({km} km @ ₹{ratePerKm}/km)</span>
                <span className="font-bold text-slate-800">Claimed: {rupee(estimatedSubmittedTa)}</span> → <span className="font-bold text-rose-600">Net: {rupee(taAmt)}</span>
              </div>
            )}
            {isDaEdited && (
              <div>
                <span className="text-slate-400 font-bold uppercase text-[8px] block">Daily DA (1st Leg)</span>
                <span className="font-bold text-slate-800">Claimed: {rupee(estimatedSubmittedDa)}</span> → <span className="font-bold text-rose-600">Net: {rupee(daAmt)}</span>
              </div>
            )}
            {calculatedDeduction > 0 && (
              <div>
                <span className="text-slate-400 font-bold uppercase text-[8.5px] block">Deducted Amount</span>
                <span className="font-extrabold text-rose-600">-{rupee(calculatedDeduction)}</span>
              </div>
            )}
          </div>

          {/* Base Working Location Policy Reason */}
          {(baseLocationDeductionReason || (isInDistrictLeg && (isTaEdited || isDaEdited || daAmt === 0))) && (
            <div className="bg-indigo-50 p-2 rounded border border-indigo-200 text-[9.5px]">
              <span className="text-indigo-800 font-extrabold text-[8.5px] uppercase block mb-1">📍 Base Working Location — Policy Deduction</span>
              <span className="text-slate-800 font-medium leading-relaxed">
                {baseLocationDeductionReason || (
                  <>
                    As per Company Policy, working within the base district ({km} km) attracts reduced allowances.{" "}
                    {isTaEdited && <><b className="text-rose-700">TA deducted: {rupee(estimatedSubmittedTa - taAmt)}</b> (Claimed {rupee(estimatedSubmittedTa)} → Approved {rupee(taAmt)}).{" "}</>}
                    {(isDaEdited || daAmt === 0) && estimatedSubmittedDa > 0 && <><b className="text-rose-700">DA deducted: {rupee(estimatedSubmittedDa - daAmt)}</b> (Claimed {rupee(estimatedSubmittedDa)} → Approved {rupee(daAmt)}).{" "}</>}
                    {calculatedDeduction > 0 && <b className="text-rose-700">Total Deduction: {rupee(calculatedDeduction)}.</b>}
                  </>
                )}
              </span>
            </div>
          )}

          {/* KM / Fare Limit Policy */}
          {(isKmEdited || kmDeductionReason || (isTaEdited && !isInDistrictLeg)) && (
            <div className="bg-amber-50 p-2 rounded border border-amber-200 text-[9.5px]">
              <span className="text-amber-800 font-extrabold text-[8.5px] uppercase block mb-1">⚙️ KM / Fare Limit — Policy Deduction</span>
              <span className="text-slate-800 font-medium leading-relaxed">
                {kmDeductionReason || (
                  <>
                    {isKmEdited
                      ? <>Travel distance adjusted from <b>{origKm} km</b> to <b>{km} km</b> as per policy.{" "}</>
                      : <>Travel rate capped at <b>₹{ratePerKm}/km</b> for <b>{km} km</b>.{" "}</>
                    }
                    <b className="text-rose-700">TA deducted: {rupee(estimatedSubmittedTa - taAmt)}</b> (Claimed {rupee(estimatedSubmittedTa)} → Approved {rupee(taAmt)}).
                  </>
                )}
              </span>
            </div>
          )}

          {/* DA Grade Cap Policy */}
          {(daDeductionReason || (isDaEdited && !isInDistrictLeg && !baseLocationDeductionReason)) && (
            <div className="bg-amber-50 p-2 rounded border border-amber-200 text-[9.5px]">
              <span className="text-amber-800 font-extrabold text-[8.5px] uppercase block mb-1">⚙️ DA Grade Cap — Policy Deduction</span>
              <span className="text-slate-800 font-medium leading-relaxed">
                {daDeductionReason || (
                  <>
                    Daily Allowance capped as per grade entitlement.{" "}
                    <b className="text-rose-700">DA deducted: {rupee(estimatedSubmittedDa - daAmt)}</b> (Claimed {rupee(estimatedSubmittedDa)} → Approved {rupee(daAmt)}).
                  </>
                )}
              </span>
            </div>
          )}

          {/* Manager Manual Override Attribution (Fix 1b) */}
          {matchingManagerEdit && (
            <div className="text-[9.5px] text-slate-500 font-sans pt-1 mt-1 border-t border-rose-200/60 flex items-center gap-1 flex-wrap">
              <span>
                ✏️ Manually adjusted by <b>{matchingManagerEdit.actor_name || "Manager"}</b> {matchingManagerEdit.actor_role ? `(${matchingManagerEdit.actor_role})` : ""} {matchingManagerEdit.created_at ? `on ${new Date(matchingManagerEdit.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""} {matchingManagerEdit.change_reason ? `— "${matchingManagerEdit.change_reason}"` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reason for Other Mode / Category Banner (If Present) */}
      {isOtherCategory && otherReason && (
        <div className="bg-amber-50 p-2.5 rounded-[3px] border border-amber-200 text-amber-950 font-semibold text-[10.5px] flex items-center gap-2">
          <Info size={14} className="text-amber-700 shrink-0" />
          <div>
            <span className="text-amber-800 font-bold block text-[9px] uppercase">Reason for Other Mode / Category:</span>
            <span className="text-slate-900 font-bold">{otherReason}</span>
          </div>
        </div>
      )}

      {/* ASSET TAGGING WORK LIST - EXCEL TABLE FORMAT (IDENTICAL TO CALLS/PMS) */}
      {(() => {
        const hasExplicitAssetTagging = !!(
          (act.assetsList && act.assetsList.length > 0) ||
          barcode ||
          act.parsed?.asset_tagging_barcode ||
          leg.asset_tagging_barcode ||
          leg.asset_tagging_suffix ||
          equipmentName ||
          act.assetEquipment ||
          act.parsed?.asset_tagging_equipment ||
          leg.asset_tagging_equipment ||
          act.parsed?.asset_tagging_hospital ||
          leg.asset_tagging_hospital ||
          act.parsed?.asset_tagging_make ||
          leg.asset_tagging_make ||
          act.parsed?.asset_tagging_model ||
          leg.asset_tagging_model ||
          act.parsed?.asset_tagging_serial ||
          leg.asset_tagging_serial ||
          act.parsed?.asset_tagging_barcode_photo ||
          leg.asset_tagging_barcode_photo ||
          act.parsed?.asset_tagging_serial_photo ||
          leg.asset_tagging_serial_photo
        );

        const rawAssets = (act.assetsList && act.assetsList.length > 0) ? act.assetsList : (
          hasExplicitAssetTagging ? [{
            equipment_name: equipmentName || act.assetEquipment || act.parsed?.asset_tagging_equipment || leg.asset_tagging_equipment || "",
            barcode: barcode || act.parsed?.asset_tagging_barcode || leg.asset_tagging_barcode || (leg.asset_tagging_suffix ? `(8004890615671) ${leg.asset_tagging_suffix}` : "") || "",
            hospital_name: act.parsed?.asset_tagging_hospital || leg.asset_tagging_hospital || ((barcode || leg.asset_tagging_barcode || equipmentName || act.assetEquipment) ? (hospitalName || "") : "") || "",
            make: act.parsed?.make || act.parsed?.asset_tagging_make || act.parsed?.brand || leg.asset_tagging_make || leg.make || leg.brand || "",
            model: equipmentModel || act.parsed?.model || act.parsed?.asset_tagging_model || leg.asset_tagging_model || leg.model || "",
            serial_number: act.parsed?.serial_no || act.parsed?.serial_number || act.parsed?.asset_tagging_serial || leg.asset_tagging_serial || leg.serial_number || leg.serial_no || "",
            department: department || act.parsed?.department || act.parsed?.ward || leg.department || "",
            schedule: schedule || act.pmsFrequency || leg.schedule || "",
            has_warranty: act.parsed?.has_warranty || act.parsed?.asset_tagging_has_warranty || leg.asset_tagging_has_warranty || leg.has_warranty || "No",
            warranty_start: act.parsed?.warranty_start || act.parsed?.asset_tagging_warranty_start || leg.asset_tagging_warranty_start || leg.warranty_start || "",
            warranty_end: act.parsed?.warranty_end || act.parsed?.asset_tagging_warranty_end || leg.asset_tagging_warranty_end || leg.warranty_end || "",
            barcode_photo: act.parsed?.barcode_photo || act.parsed?.asset_tagging_barcode_photo || leg.asset_tagging_barcode_photo || leg.barcode_photo || "",
            serial_photo: act.parsed?.serial_photo || act.parsed?.asset_tagging_serial_photo || leg.asset_tagging_serial_photo || leg.serial_photo || "",
            model_photo: act.parsed?.model_photo || act.parsed?.asset_tagging_model_photo || leg.asset_tagging_model_photo || leg.model_photo || "",
            attachment_url: act.attachmentUrl || leg.service_report_url || leg.photo_url || leg.asset_photo_url || travelTaBillUrl || "",
          }] : []
        );

        if (rawAssets.length === 0) return null;

        const validAssets = rawAssets.filter((item: any) => {
          const eq = item.equipment_name || item.equipment || "";
          const bar = item.barcode || item.code || "";
          const hosp = item.hospital_name || item.hospital || "";
          const make = item.make || item.brand || "";
          const model = item.model || "";
          const serial = item.serial_number || item.serial_no || "";
          const hasPhotos = !!(item.barcode_photo || item.serial_photo || item.model_photo);
          return isValidText(bar) || isValidText(eq) || isValidText(serial) || isValidText(model) || isValidText(make) || hasPhotos || (isValidText(hosp) && (isValidText(eq) || isValidText(bar)));
        });

        if (validAssets.length === 0) return null;

        return (
          <div className="space-y-1 text-[9.5px]">
            <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-100 pb-1">
              <span className="flex items-center gap-1">
                <Tag size={10} /> Asset Tagging Work List ({validAssets.length})
              </span>
            </div>

            <div className="overflow-x-auto border border-emerald-200 rounded-[3px] shadow-2xs">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-emerald-50/80 text-emerald-950 font-extrabold uppercase border-b border-emerald-200 text-[9px]">
                    <th className="py-1 px-2">#</th>
                    <th className="py-1 px-2">Barcode</th>
                    <th className="py-1 px-2">Equipment Name</th>
                    <th className="py-1 px-2">Hospital Name</th>
                    <th className="py-1 px-2">Make / Brand</th>
                    <th className="py-1 px-2">Model</th>
                    <th className="py-1 px-2">Serial Number</th>
                    <th className="py-1 px-2">Warranty</th>
                    <th className="py-1 px-2 text-center">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 bg-white">
                  {validAssets.map((assetItem: any, aIdx: number) => {
                    const bar = assetItem.barcode || assetItem.code || "—";
                    const eq = assetItem.equipment_name || assetItem.equipment || "—";
                    const hosp = assetItem.hospital_name || assetItem.hospital || "—";
                    const make = assetItem.make || assetItem.brand || "—";
                    const model = assetItem.model || assetItem.model_no || "—";
                    const serial = assetItem.serial_number || assetItem.serial_no || "—";
                    const hasWarr = assetItem.has_warranty || "No";
                    const wStart = assetItem.warranty_start || "";
                    const wEnd = assetItem.warranty_end || "";

                    const bPhoto = formatImageUrl(assetItem.barcode_photo);
                    const sPhoto = formatImageUrl(assetItem.serial_photo);
                    const mPhoto = formatImageUrl(assetItem.model_photo);
                    const gPhoto = formatImageUrl(assetItem.attachment_url);

                    const hasPhotos = !!(bPhoto || sPhoto || mPhoto || gPhoto);

                    return (
                      <tr key={aIdx} className="hover:bg-emerald-50/40 font-medium">
                        <td className="py-1 px-2 font-bold text-emerald-800">{aIdx + 1}</td>
                        <td className="py-1 px-2 font-mono font-bold text-[#4A6A8A]">{bar}</td>
                        <td className="py-1 px-2 font-bold text-slate-800">{eq}</td>
                        <td className="py-1 px-2 text-slate-700">{hosp}</td>
                        <td className="py-1 px-2 text-slate-700">{make}</td>
                        <td className="py-1 px-2 text-slate-700">{model}</td>
                        <td className="py-1 px-2 font-mono text-slate-700">{serial}</td>
                        <td className="py-1 px-2 font-semibold">
                          {String(hasWarr).toLowerCase() === "yes" ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                              Yes {wStart && wEnd ? `(${wStart} to ${wEnd})` : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {bPhoto && (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(bPhoto)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[8px] font-bold hover:bg-emerald-800 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={9} /> Barcode
                              </button>
                            )}
                            {sPhoto && (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(sPhoto)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-700 text-white text-[8px] font-bold hover:bg-cyan-800 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={9} /> Serial
                              </button>
                            )}
                            {mPhoto && (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(mPhoto)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-700 text-white text-[8px] font-bold hover:bg-blue-800 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={9} /> Model
                              </button>
                            )}
                            {gPhoto && !bPhoto && !sPhoto && !mPhoto && (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(gPhoto)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700 text-white text-[8px] font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Eye size={9} /> Photo
                              </button>
                            )}
                            {!hasPhotos && <span className="text-slate-400 font-medium">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Work Badges Summary - ONLY SHOW TAGS IF WORK COMPLETED IS STRICTLY > 0 */}
      {(hasCalls || hasPms || hasCalib || hasMobi || hasAssetTagging) && (
        <div className="flex flex-wrap gap-1 items-center">
          {hasCalls && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <PhoneCall size={9} /> {callsClosed} Calls Done {act.callsType ? `(${act.callsType})` : ""}
            </span>
          )}
          {hasPms && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Wrench size={9} /> {pmsCount || (act.pmsList ? act.pmsList.length : 1)} PMS Done {act.pmsFrequency ? `(${act.pmsFrequency})` : ""}
            </span>
          )}
          {hasCalib && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <Crosshair size={9} /> {calibCount} Calibration
            </span>
          )}
          {hasMobi && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Truck size={9} /> {mobiCount} Mobilisation
            </span>
          )}
          {hasAssetTagging && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Tag size={9} /> {assetTagging || act.assetQuantity || 1} Tagged
            </span>
          )}
        </div>
      )}

      {/* CALLS WORK LIST - EXCEL TABLE FORMAT */}
      {hasCalls && effectiveCallsList.length > 0 && (
        <div className="space-y-1 text-[9.5px]">
          <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-100 pb-1">
            <span className="flex items-center gap-1"><PhoneCall size={10} /> Calls Work List ({effectiveCallsList.length})</span>
          </div>

          <div className="overflow-x-auto border border-blue-200 rounded-[3px] shadow-2xs">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-blue-50/80 text-blue-900 font-extrabold uppercase border-b border-blue-200 text-[9px]">
                  <th className="py-1 px-2">#</th>
                  <th className="py-1 px-2">Complaint ID</th>
                  <th className="py-1 px-2">Barcode</th>
                  <th className="py-1 px-2">Equipment Name</th>
                  <th className="py-1 px-2">Hospital Name</th>
                  <th className="py-1 px-2">Call Type</th>
                  <th className="py-1 px-2">Status</th>
                  <th className="py-1 px-2">Action Taken</th>
                  <th className="py-1 px-2">Spare Replaced</th>
                  <th className="py-1 px-2 text-center">Attachments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 bg-white">
                {effectiveCallsList.map((cItem: any, cIdx: number) => {
                  const cComplaintId = cItem.complaint_id || cItem.calls_complaint_id || cItem.call_id || "—";
                  const cCode = cItem.barcode || cItem.calls_barcode || cItem.code || cItem.serial_no || barcode || "—";
                  
                  const rawEquipment = cItem.equipment || cItem.equipment_name || cItem.asset_name || equipmentName || (cCode !== "—" ? barcodeMap[cCode]?.equipment : "");
                  const cEquipment = isValidText(rawEquipment) ? rawEquipment : (cCode !== "—" && barcodeMap[cCode]?.equipment ? barcodeMap[cCode].equipment : "—");
                  
                  const rawHospital = cItem.hospital || cItem.hospital_name || cItem.facility_name || hospitalName || (cCode !== "—" ? barcodeMap[cCode]?.hospital : "");
                  const cHospital = isValidText(rawHospital) ? rawHospital : (cCode !== "—" && barcodeMap[cCode]?.hospital ? barcodeMap[cCode].hospital : "—");

                  const cType = cItem.call_type || cItem.calls_type || cItem.type || act.callsType || "Service Call";
                  const cStatus = cItem.status || cItem.calls_status || act.callsStatus || "Attended & Closed";
                  const cActionTaken = cItem.action_taken || cItem.calls_action_taken || "—";
                  const cSpareReplaced = cItem.spare_replaced || cItem.calls_spare_replaced || "No";
                  const cSpareVal = cItem.spare_estimated_value || cItem.calls_spare_estimated_value || 0;
                  const cSpareName = cItem.spare_name || cItem.calls_spare_name || "";
                  
                  const cUrl = cItem.attachment_url || cItem.service_report_url || cItem.photo_url || cItem.image_url || cItem.url || cItem.file_url || cItem.photo || cItem.service_report_photo || cItem.calls_asset_details?.attachment_url || cItem.calls_asset_details?.photo_url || cItem.calls_asset_details?.url || "";
                  const fullCUrl = formatImageUrl(cUrl);
                  const fullOldSpareUrl = formatImageUrl(cItem.old_spare_photo || cItem.calls_old_spare_photo || "");
                  const fullNewSpareUrl = formatImageUrl(cItem.new_spare_photo || cItem.calls_new_spare_photo || "");

                  return (
                    <tr key={cIdx} className="hover:bg-blue-50/40 font-medium">
                      <td className="py-1 px-2 font-bold text-blue-800">{cIdx + 1}</td>
                      <td className="py-1 px-2 font-mono font-bold text-blue-800">{cComplaintId}</td>
                      <td className="py-1 px-2 font-mono font-bold text-[#4A6A8A]">{cCode}</td>
                      <td className="py-1 px-2 font-bold text-slate-800">{cEquipment}</td>
                      <td className="py-1 px-2 text-slate-700">{cHospital}</td>
                      <td className="py-1 px-2 font-semibold text-blue-800">{cType}</td>
                      <td className="py-1 px-2 font-bold text-emerald-700">{cStatus}</td>
                      <td className="py-1 px-2 text-slate-800 max-w-[140px] truncate">{cActionTaken}</td>
                      <td className="py-1 px-2 font-bold">
                        {cSpareReplaced === "Yes" ? (
                          <span className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Yes {cSpareName ? `(${cSpareName} - ₹${cSpareVal})` : `(₹${cSpareVal})`}</span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {fullCUrl && (
                            <button
                              onClick={() => setLightboxImage(fullCUrl)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-700 text-white text-[8px] font-bold hover:bg-blue-800 transition-colors"
                            >
                              <Eye size={9} /> Report
                            </button>
                          )}
                          {fullOldSpareUrl && (
                            <button
                              onClick={() => setLightboxImage(fullOldSpareUrl)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[8px] font-bold hover:bg-amber-700 transition-colors"
                            >
                              <Eye size={9} /> Old
                            </button>
                          )}
                          {fullNewSpareUrl && (
                            <button
                              onClick={() => setLightboxImage(fullNewSpareUrl)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-bold hover:bg-emerald-700 transition-colors"
                            >
                              <Eye size={9} /> New
                            </button>
                          )}
                          {!fullCUrl && !fullOldSpareUrl && !fullNewSpareUrl && (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PMS WORK LIST - EXCEL TABLE FORMAT */}
      {act.pmsList.length > 0 && (
        <div className="space-y-1 text-[9.5px]">
          <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-100 pb-1">
            <span className="flex items-center gap-1"><Wrench size={10} /> PMS Work List ({act.pmsList.length})</span>
          </div>

          <div className="overflow-x-auto border border-emerald-200 rounded-[3px] shadow-2xs">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-emerald-50/80 text-emerald-900 font-extrabold uppercase border-b border-emerald-200 text-[9px]">
                  <th className="py-1 px-2">#</th>
                  <th className="py-1 px-2">Barcode</th>
                  <th className="py-1 px-2">Equipment Name</th>
                  <th className="py-1 px-2">Hospital Name</th>
                  <th className="py-1 px-2">Schedule</th>
                  <th className="py-1 px-2 text-center">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 bg-white">
                {act.pmsList.map((pItem: any, pIdx: number) => {
                  const pCode = pItem.barcode || pItem.pms_barcode || pItem.code || pItem.serial_no || pItem.asset_barcode || "—";
                  
                  const rawEquipment = pItem.equipment || pItem.equipment_name || pItem.asset_name || pItem.equipment_model || pItem.model || equipmentName || (pCode !== "—" ? barcodeMap[pCode]?.equipment : "");
                  const pEquipment = isValidText(rawEquipment) ? rawEquipment : (pCode !== "—" && barcodeMap[pCode]?.equipment ? barcodeMap[pCode].equipment : "—");
                  
                  const rawHospital = pItem.hospital || pItem.hospital_name || pItem.facility_name || hospitalName || (pCode !== "—" ? barcodeMap[pCode]?.hospital : "");
                  const pHospital = isValidText(rawHospital) ? rawHospital : (pCode !== "—" && barcodeMap[pCode]?.hospital ? barcodeMap[pCode].hospital : "—");

                  const pSched = pItem.schedule || pItem.pms_frequency || pItem.frequency || act.pmsFrequency || schedule || "—";
                  const pUrl = pItem.attachment_url || pItem.service_report_url || pItem.photo_url || pItem.image_url || pItem.url || pItem.file_url || pItem.photo || pItem.service_report_photo || pItem.pms_asset_details?.attachment_url || pItem.pms_asset_details?.photo_url || pItem.pms_asset_details?.url || "";
                  const fullPUrl = formatImageUrl(pUrl);

                  return (
                    <tr key={pIdx} className="hover:bg-emerald-50/40 font-medium">
                      <td className="py-1 px-2 font-bold text-emerald-800">{pIdx + 1}</td>
                      <td className="py-1 px-2 font-mono font-bold text-[#4A6A8A]">{pCode}</td>
                      <td className="py-1 px-2 font-bold text-slate-800">{pEquipment}</td>
                      <td className="py-1 px-2 text-slate-700">{pHospital}</td>
                      <td className="py-1 px-2 font-semibold text-emerald-700">{pSched}</td>
                      <td className="py-1 px-2 text-center">
                        {fullPUrl ? (
                          <button
                            onClick={() => setLightboxImage(fullPUrl)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#4A6A8A] text-white text-[8.5px] font-bold hover:bg-[#3b546e] transition-colors"
                          >
                            <Eye size={10} /> View Photo
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clean Purpose & Other Reason Text */}
      {(purpose || (!isOtherCategory && otherReason)) && (
        <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-1 text-[10px]">
          {purpose && <div><b className="text-slate-500">Purpose / Details:</b> <span className="text-slate-700 font-medium">{purpose}</span></div>}
          {!isOtherCategory && otherReason && <div className="bg-amber-50 p-1.5 rounded border border-amber-200 text-amber-900 font-medium"><b className="text-amber-800">Reason for Other Mode / Category:</b> {otherReason}</div>}
        </div>
      )}

      {/* HISTORICAL MINIMUM ROUTE BENCHMARK AUDIT CARD (APPROVER ONLY MATCH POPUP) */}
      {routeBenchmark && (routeBenchmark.global || routeBenchmark.min_travel_amount) && (
        (() => {
          const globalObj = routeBenchmark.global || routeBenchmark;
          const sameUserObj = routeBenchmark.sameUser;
          const curAmt = parseFloat(String(taAmt)) || 0;

          return (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-[3px] p-2.5 mt-2 space-y-2 shadow-xs select-none">
              <div className="flex items-center justify-between font-extrabold text-emerald-950 text-[10.5px] border-b border-emerald-200 pb-1 flex-wrap gap-1">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-emerald-900">
                  🏆 Historical Minimum Route Match ({globalObj.from_location} ↔ {globalObj.to_location})
                </span>
                <span className="text-[9.5px] bg-emerald-700 text-white px-2 py-0.5 rounded font-mono font-black shadow-2xs">
                  Global Min: ₹{globalObj.min_travel_amount}
                </span>
              </div>

              {/* Global Historical Lowest Record */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9.5px]">
                <div>
                  <span className="text-slate-500 font-bold block">Lowest Fare (All Staff):</span>
                  <span className="text-slate-900 font-black block leading-tight">{globalObj.prior_user_name}</span>
                  <span className="text-emerald-700 font-mono text-[8.5px] font-bold block">{globalObj.prior_claim_code}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Min Distance & Mode:</span>
                  <span className="text-slate-900 font-mono font-extrabold block">{globalObj.min_distance_km} KM ({globalObj.travel_mode})</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Minimum Travel Fare:</span>
                  <span className="text-emerald-900 font-mono font-black block text-xs">₹{globalObj.min_travel_amount}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Current vs Global Min:</span>
                  {curAmt > globalObj.min_travel_amount ? (
                    <span className="text-rose-800 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 font-mono text-[9px] block">
                      ⚠️ +₹{(curAmt - globalObj.min_travel_amount).toFixed(0)} Higher
                    </span>
                  ) : (
                    <span className="text-emerald-800 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[9px] block">
                      ✓ Matches Lowest Fare
                    </span>
                  )}
                </div>
              </div>

              {/* Same User Prior Historical Fare Badge (If User Filed Same Route Previously) */}
              {sameUserObj && (
                <div className="bg-indigo-50/90 border border-indigo-200 rounded p-1.5 text-[9.5px] flex items-center justify-between flex-wrap gap-1 mt-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                    <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded">Same User History</span>
                    <span>This user previously filed <b>₹{sameUserObj.min_travel_amount}</b> for this route ({sameUserObj.prior_claim_code})</span>
                  </div>
                  {curAmt > sameUserObj.min_travel_amount ? (
                    <span className="text-amber-900 font-extrabold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 font-mono text-[8.5px]">
                      ⚠️ +₹{(curAmt - sameUserObj.min_travel_amount).toFixed(0)} Higher than user's own prior ₹{sameUserObj.min_travel_amount}
                    </span>
                  ) : (
                    <span className="text-emerald-800 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[8.5px]">
                      ✓ Matches user's own prior fare (₹{sameUserObj.min_travel_amount})
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* MANAGER & COORDINATOR EXPENSE AMOUNT EDIT PANEL */}
      {canEditAmounts && onLegAmountChange && (
        <div className="bg-[#4A6A8A]/10 p-2.5 rounded-[3px] border-2 border-[#4A6A8A]/30 mt-2 space-y-2 select-none">
          <div className="flex items-center justify-between font-extrabold text-[#4A6A8A] border-b border-[#4A6A8A]/20 pb-1 text-[10.5px] flex-wrap gap-1">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Pencil size={12} className="text-[#4A6A8A]" />
              Manager / Coordinator Amount Override (Leg #{legNum})
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-[#4A6A8A] font-extrabold bg-white px-2 py-0.5 border border-[#4A6A8A]/40 font-mono">
                Leg Net: ₹{(
                  parseFloat(String(editedLeg?.travel_amount ?? taAmt)) +
                  (isFirstLeg ? parseFloat(String(editedLeg?.da ?? daAmt)) : 0) +
                  parseFloat(String(editedLeg?.sub_amount ?? 0)) +
                  parseFloat(String(editedLeg?.hotel_amount ?? hotelAmt)) +
                  parseFloat(String(editedLeg?.local_purchase ?? localPur)) +
                  parseFloat(String(editedLeg?.other_amount ?? othAmt))
                ).toLocaleString("en-IN")}
              </span>
              {submittedLegAmt > netLegAmt && (
                <span className="text-[9px] text-amber-900 font-extrabold bg-amber-100 px-2 py-0.5 border border-amber-300 font-mono" title="System / Policy Deduction">
                  ⚙️ System: -₹{Math.round(submittedLegAmt - netLegAmt).toLocaleString("en-IN")}
                </span>
              )}
              {netLegAmt > (
                parseFloat(String(editedLeg?.travel_amount ?? taAmt)) +
                (isFirstLeg ? parseFloat(String(editedLeg?.da ?? daAmt)) : 0) +
                parseFloat(String(editedLeg?.sub_amount ?? 0)) +
                parseFloat(String(editedLeg?.hotel_amount ?? hotelAmt)) +
                parseFloat(String(editedLeg?.local_purchase ?? localPur)) +
                parseFloat(String(editedLeg?.other_amount ?? othAmt))
              ) && (
                <span className="text-[9px] text-rose-800 font-extrabold bg-rose-100 px-2 py-0.5 border border-rose-300 font-mono" title="Manager / Coordinator Manual Deduction">
                  ✏️ Manager: -₹{Math.round(netLegAmt - (
                    parseFloat(String(editedLeg?.travel_amount ?? taAmt)) +
                    (isFirstLeg ? parseFloat(String(editedLeg?.da ?? daAmt)) : 0) +
                    parseFloat(String(editedLeg?.sub_amount ?? 0)) +
                    parseFloat(String(editedLeg?.hotel_amount ?? hotelAmt)) +
                    parseFloat(String(editedLeg?.local_purchase ?? localPur)) +
                    parseFloat(String(editedLeg?.other_amount ?? othAmt))
                  )).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            {/* 1. Distance KM */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[9px] font-bold text-slate-600">Distance (KM)</label>
                {parseFloat(String(km ?? 0)) <= 0 && (
                  <span className="text-[8px] text-slate-400 font-medium">(Fixed Mode)</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts || parseFloat(String(km ?? 0)) <= 0}
                value={(editedLeg?.km ?? km) === 0 ? "" : (editedLeg?.km ?? km)}
                onChange={(e) => onLegAmountChange(index, "km", e.target.value)}
                className={`w-full text-xs font-mono font-bold p-1 border rounded focus:border-[#4A6A8A] focus:outline-none ${
                  parseFloat(String(km ?? 0)) > 0 ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              />
              {editedLeg && parseFloat(String(editedLeg.km ?? 0)) !== parseFloat(String(leg.km ?? 0)) && (
                <input
                  type="text"
                  placeholder="Reason for KM edit *"
                  value={editedLeg?.remarks?.distance_km || editedLeg?.remarks?.km || editedLeg?.remarks?.travel_amount || ""}
                  onChange={(e) => {
                    if (onLegRemarkChange) {
                      onLegRemarkChange(index, "distance_km", e.target.value);
                      onLegRemarkChange(index, "travel_amount", e.target.value);
                    }
                  }}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>

            {/* 2. Travel TA */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[9px] font-bold text-slate-600">Travel TA (₹)</label>
                {parseFloat(String(km ?? 0)) > 0 && (
                  <span className="text-[8px] text-indigo-600 font-bold">(Auto-Calc)</span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts || parseFloat(String(km ?? 0)) > 0}
                value={(editedLeg?.travel_amount ?? taAmt) === 0 ? "" : (editedLeg?.travel_amount ?? taAmt)}
                onChange={(e) => onLegAmountChange(index, "travel_amount", e.target.value)}
                className={`w-full text-xs font-mono font-bold p-1 border rounded focus:border-[#4A6A8A] focus:outline-none ${
                  parseFloat(String(km ?? 0)) > 0 ? "border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed" : "border-slate-300 bg-white text-slate-900"
                }`}
              />
              {editedLeg && parseFloat(String(km ?? 0)) <= 0 && Math.abs(parseFloat(String(editedLeg.travel_amount ?? 0)) - parseFloat(String(taAmt ?? 0))) > 0.01 && (
                <input
                  type="text"
                  placeholder="Reason for TA edit *"
                  value={editedLeg?.remarks?.travel_amount || ""}
                  onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "travel_amount", e.target.value)}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>

            {/* 3. Daily DA (Leg 1 only) */}
            {isFirstLeg && (
              <div>
                <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Daily DA (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  disabled={!canEditAmounts}
                  value={(editedLeg?.da ?? daAmt) === 0 ? "" : (editedLeg?.da ?? daAmt)}
                  onChange={(e) => onLegAmountChange(index, "da", e.target.value)}
                  className="w-full text-xs font-mono font-bold p-1 border border-slate-300 rounded bg-white focus:border-[#4A6A8A] focus:outline-none text-emerald-800"
                />
                {editedLeg && parseFloat(String(editedLeg.da)) !== parseFloat(String(daAmt)) && (
                  <input
                    type="text"
                    placeholder="Reason for DA edit *"
                    value={editedLeg?.remarks?.da_amount || editedLeg?.remarks?.da || ""}
                    onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "da_amount", e.target.value)}
                    className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                  />
                )}
              </div>
            )}

            {/* 4. Local Conveyance / Sub Amount */}
            <div>
              <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Local Conveyance (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts}
                value={(editedLeg?.sub_amount ?? 0) === 0 ? "" : (editedLeg?.sub_amount ?? 0)}
                onChange={(e) => onLegAmountChange(index, "sub_amount", e.target.value)}
                className="w-full text-xs font-mono font-bold p-1 border border-slate-300 rounded bg-white focus:border-[#4A6A8A] focus:outline-none text-indigo-800"
              />
              {editedLeg && parseFloat(String(editedLeg.sub_amount)) !== parseFloat(String(leg.sub_amount || 0)) && (
                <input
                  type="text"
                  placeholder="Reason for Conveyance edit *"
                  value={editedLeg?.remarks?.sub_amount || ""}
                  onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "sub_amount", e.target.value)}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>

            {/* 5. Hotel / Stay */}
            <div>
              <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Hotel / Stay (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts}
                value={(editedLeg?.hotel_amount ?? hotelAmt) === 0 ? "" : (editedLeg?.hotel_amount ?? hotelAmt)}
                onChange={(e) => onLegAmountChange(index, "hotel_amount", e.target.value)}
                className="w-full text-xs font-mono font-bold p-1 border border-slate-300 rounded bg-white focus:border-[#4A6A8A] focus:outline-none text-purple-800"
              />
              {editedLeg && parseFloat(String(editedLeg.hotel_amount)) !== parseFloat(String(hotelAmt)) && (
                <input
                  type="text"
                  placeholder="Reason for Hotel edit *"
                  value={editedLeg?.remarks?.hotel_amount || ""}
                  onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "hotel_amount", e.target.value)}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>

            {/* 6. Local Purchase */}
            <div>
              <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Local Purchase (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts}
                value={(editedLeg?.local_purchase ?? localPur) === 0 ? "" : (editedLeg?.local_purchase ?? localPur)}
                onChange={(e) => onLegAmountChange(index, "local_purchase", e.target.value)}
                className="w-full text-xs font-mono font-bold p-1 border border-slate-300 rounded bg-white focus:border-[#4A6A8A] focus:outline-none text-amber-800"
              />
              {editedLeg && parseFloat(String(editedLeg.local_purchase)) !== parseFloat(String(localPur)) && (
                <input
                  type="text"
                  placeholder="Reason for Purchase edit *"
                  value={editedLeg?.remarks?.local_purchase || ""}
                  onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "local_purchase", e.target.value)}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>

            {/* 7. Other Expense */}
            <div>
              <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Other Exp. (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                onFocus={(e) => e.target.select()}
                disabled={!canEditAmounts}
                value={(editedLeg?.other_amount ?? othAmt) === 0 ? "" : (editedLeg?.other_amount ?? othAmt)}
                onChange={(e) => onLegAmountChange(index, "other_amount", e.target.value)}
                className="w-full text-xs font-mono font-bold p-1 border border-slate-300 rounded bg-white focus:border-[#4A6A8A] focus:outline-none text-amber-700"
              />
              {editedLeg && parseFloat(String(editedLeg.other_amount)) !== parseFloat(String(othAmt)) && (
                <input
                  type="text"
                  placeholder="Reason for Other Exp edit *"
                  value={editedLeg?.remarks?.other_amount || ""}
                  onChange={(e) => onLegRemarkChange && onLegRemarkChange(index, "other_amount", e.target.value)}
                  className="w-full text-[10px] p-1 border border-rose-300 rounded bg-rose-50 text-rose-950 font-medium placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 mt-1 shadow-2xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── APPROVAL STEP BADGE (24-HOUR TIME FORMAT) ────────────────────────────────

const ApprovalStep = ({ step, index }: { step: any; index: number }) => {
  const s = (step.status || "").toLowerCase();
  let dotColor = "#94a3b8";
  let label = step.status || "Pending";
  let bg = "bg-slate-50 border-slate-200";
  let textColor = "text-slate-600";

  if (s === "approved") { dotColor = "#10b981"; label = "Approved"; bg = "bg-emerald-50 border-emerald-200"; textColor = "text-emerald-700"; }
  else if (s === "rejected") { dotColor = "#ef4444"; label = "Rejected"; bg = "bg-rose-50 border-rose-200"; textColor = "text-rose-700"; }
  else if (s === "pending") { dotColor = "#f59e0b"; label = "Pending"; bg = "bg-amber-50 border-amber-200"; textColor = "text-amber-700"; }

  return (
    <div className={`flex items-start gap-2 rounded-[3px] border px-2.5 py-2 ${bg}`}>
      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white shrink-0 mt-0.5" style={{ background: dotColor }}>
        {step.level_number || index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10.5px] font-bold text-slate-800">{step.approver_name || step.approver || `Approver ${index + 1}`}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded border ${bg} ${textColor}`}>{label}</span>
        </div>
        <div className="text-[9.5px] text-slate-400">
          {step.approver_code && <span className="font-mono text-slate-500 mr-1">[{step.approver_code}]</span>}
          {(step.approver_role || step.approver_designation) && <span>· {step.approver_role || step.approver_designation}</span>}
        </div>
        {step.updated_at && (
          <div className="text-[8.5px] text-slate-400 mt-0.5 font-mono">{formatDateTime24(step.updated_at)}</div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface ClaimDetailsModalProps {
  open: boolean;
  claimDetails: any;
  user: any;
  comments?: string;
  setComments?: (v: string) => void;
  actionLoading?: boolean;
  loadingDetails?: boolean;
  handleApprove?: () => void;
  handleReject?: () => void;
  handleReturn?: () => void;
  handleDeleteClaim?: (id: number) => void;
  onClose: () => void;
  navigate?: (path: string) => void;
  setLightboxImage?: (url: string) => void;
  getStatusBadgeClass?: (status: string, record?: any) => string;
  getStatusLabel?: (status: string, record?: any) => string;
  sourceMode?: "approval" | "expense" | "home";
  editedLegs?: any[];
  onLegAmountChange?: (index: number, field: string, value: string | number) => void;
  onLegRemarkChange?: (index: number, field: string, remark: string) => void;
}

const ClaimDetailsModal: React.FC<ClaimDetailsModalProps> = ({
  open, claimDetails, user,
  comments = "", setComments = () => {}, actionLoading = false, loadingDetails = false,
  handleApprove = () => {}, handleReject = () => {}, handleReturn = () => {},
  handleDeleteClaim = () => {}, onClose, navigate = () => {}, setLightboxImage: _setLightboxImage = () => {},
  getStatusBadgeClass = () => "", getStatusLabel = () => "", sourceMode,
  editedLegs, onLegAmountChange, onLegRemarkChange
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showReturnBox, setShowReturnBox] = useState(false);
  const [modalTab, setModalTab] = useState<"all" | "summary" | "legs" | "bills" | "audit">("all");
  const handleOpenPhoto = (url: string) => {
    if (!url) return;
    const formatted = formatImageUrl(url);
    // Open only internal high-res zoom/rotate/download modal to prevent duplicate popups
    setInternalPhotoUrl(formatted);
    setLbZoom(1);
    setLbRotation(0);
  };

  const [internalPhotoUrl, setInternalPhotoUrl] = useState<string | null>(null);
  const [lbZoom, setLbZoom] = useState<number>(1);
  const [lbRotation, setLbRotation] = useState<number>(0);
  const [barcodeMap, setBarcodeMap] = useState<Record<string, { equipment: string; hospital: string }>>({});
  const [userAllowance, setUserAllowance] = useState<any>(null);
  const [routeBenchmarks, setRouteBenchmarks] = useState<Record<number, any>>({});

  const fetchAuditLogs = () => {
    if (!claimDetails) {
      setAuditLogs([]);
      setAuditLogError(null);
      return;
    }
    const expId = claimDetails.expense_code || claimDetails.id || claimDetails.expense_id || claimDetails.exp_id;
    if (expId) {
      setAuditLogLoading(true);
      setAuditLogError(null);
      api.get(`/expense/${encodeURIComponent(expId)}/audit-trail`)
        .then(res => {
          if (res.data && Array.isArray(res.data.audit_logs)) {
            setAuditLogs(res.data.audit_logs);
          } else {
            setAuditLogs([]);
          }
        })
        .catch((err) => {
          console.warn("Failed to fetch audit trail:", err);
          setAuditLogError(err?.response?.data?.error || err?.message || "Audit history could not be loaded");
        })
        .finally(() => {
          setAuditLogLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [claimDetails]);

  useEffect(() => {
    if (!open || !claimDetails) return;
    const itineraries = getResolvedItineraries(claimDetails);

    const homeKeywords = ["home", "residence", "house", "room", "flat", "base", "stay"];

    itineraries.forEach((leg: any, idx: number) => {
      const fromLoc = (leg.from_location || leg.from_district || "").trim();
      const toLoc = (leg.to_location || leg.to_district || "").trim();
      if (!fromLoc || !toLoc) return;

      const isHome = homeKeywords.some(kw => fromLoc.toLowerCase().includes(kw) || toLoc.toLowerCase().includes(kw));
      if (isHome) return;

      const token = localStorage.getItem("token") || "";
      const apiUrl = import.meta.env.VITE_API_URL || "https://fieldops-api.sunilbishnoi.workers.dev/api";
      const cleanApi = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

      const targetUserId = claimDetails.user_id || claimDetails.userId || "";
      const targetUserName = claimDetails.user_name || claimDetails.userName || "";

      fetch(`${cleanApi}/approval/route-benchmark?from=${encodeURIComponent(fromLoc)}&to=${encodeURIComponent(toLoc)}&user_id=${encodeURIComponent(targetUserId)}&user_name=${encodeURIComponent(targetUserName)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.hasBenchmark) {
          setRouteBenchmarks(prev => ({
            ...prev,
            [idx]: {
              global: data.benchmark,
              sameUser: data.sameUserBenchmark
            }
          }));
        }
      })
      .catch(() => {});
    });
  }, [open, claimDetails]);

  useEffect(() => {
    if (!claimDetails) return;
    const urlsToPreload: string[] = [];

    const attachments = getAttachmentsArray(claimDetails.attachments_detailed || claimDetails.attachments || claimDetails.bills || claimDetails.photos);
    attachments.forEach((att: any) => {
      const url = typeof att === "string" ? att : (att.file_url || att.url || "");
      if (url) {
        const fullUrl = formatImageUrl(url);
        if (fullUrl && !fullUrl.toLowerCase().endsWith(".pdf")) urlsToPreload.push(fullUrl);
      }
    });

    const itineraries = getResolvedItineraries(claimDetails);

    itineraries.forEach((leg: any) => {
      const act = parseActivityDetails(leg.activity_details || leg.activity || leg.meta);
      const candidateUrls = [
        leg.travel_bill, leg.ta_bill, leg.ticket_url, leg.bus_bill, leg.train_ticket,
        leg.attachment_url, leg.photo_url, leg.bill_url, leg.service_report_url, act.attachmentUrl,
        leg.hotel_bill, leg.hotel_photo, leg.hotel_url, leg.stay_bill,
        leg.local_purchase_bill, leg.local_purchase_photo, leg.local_purchase_url, leg.lp_bill,
        leg.other_bill, leg.other_photo, leg.parcel_photo, leg.oth_bill
      ];

      candidateUrls.forEach((u: any) => {
        if (u && typeof u === "string") {
          const fullUrl = formatImageUrl(u);
          if (fullUrl && !fullUrl.toLowerCase().endsWith(".pdf")) urlsToPreload.push(fullUrl);
        }
      });

      if (act.callsList) {
        act.callsList.forEach((cItem: any) => {
          const u = cItem.attachment_url || cItem.service_report_url || cItem.photo_url || cItem.image_url;
          if (u && typeof u === "string") {
            const fullUrl = formatImageUrl(u);
            if (fullUrl && !fullUrl.toLowerCase().endsWith(".pdf")) urlsToPreload.push(fullUrl);
          }
        });
      }

      if (act.pmsList) {
        act.pmsList.forEach((pItem: any) => {
          const u = pItem.attachment_url || pItem.service_report_url || pItem.photo_url || pItem.image_url;
          if (u && typeof u === "string") {
            const fullUrl = formatImageUrl(u);
            if (fullUrl && !fullUrl.toLowerCase().endsWith(".pdf")) urlsToPreload.push(fullUrl);
          }
        });
      }
    });

    urlsToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [claimDetails]);

  useEffect(() => {
    if (!claimDetails) return;
    const subCode = claimDetails.submitter_code || claimDetails.user_id;
    if (subCode) {
      api.get(`/expense/init?userId=${encodeURIComponent(subCode)}`)
        .then(res => {
          if (res.data && res.data.allowance) {
            setUserAllowance(res.data.allowance);
          }
        })
        .catch(() => {});
    }
  }, [claimDetails]);

  useEffect(() => {
    if (!claimDetails) return;
    const itineraries = getResolvedItineraries(claimDetails);

    const barcodesToFetch: string[] = [];

    itineraries.forEach((leg: any) => {
      const act = parseActivityDetails(leg.activity_details || leg.activity || leg.meta);
      
      act.pmsList.forEach((pItem: any) => {
        const code = pItem.barcode || pItem.pms_barcode || pItem.code || pItem.serial_no || pItem.asset_barcode;
        const eq = pItem.equipment || pItem.equipment_name || pItem.asset_name || act.equipmentName || leg.equipment_name;
        const hosp = pItem.hospital || pItem.hospital_name || pItem.facility_name || act.hospitalName || leg.hospital_name;
        if (code && code !== "—" && (!isValidText(eq) || !isValidText(hosp)) && !barcodeMap[code]) {
          if (!barcodesToFetch.includes(code)) barcodesToFetch.push(code);
        }
      });

      const effectiveCalls = act.callsList.length > 0 ? act.callsList : (
        (leg.calls_completed > 0 || isValidText(act.callsBarcode)) ? [{
          barcode: act.callsBarcode || leg.barcode,
          equipment: act.equipmentName || leg.equipment_name,
          hospital: act.parsed?.calls_asset_details?.hospital_name || act.hospitalName || leg.hospital_name
        }] : []
      );

      effectiveCalls.forEach((cItem: any) => {
        const code = cItem.barcode || cItem.calls_barcode || cItem.code || cItem.serial_no;
        const eq = cItem.equipment || cItem.equipment_name || cItem.asset_name || act.equipmentName || leg.equipment_name;
        const hosp = cItem.hospital || cItem.hospital_name || cItem.facility_name || act.hospitalName || leg.hospital_name;
        if (code && code !== "—" && (!isValidText(eq) || !isValidText(hosp)) && !barcodeMap[code]) {
          if (!barcodesToFetch.includes(code)) barcodesToFetch.push(code);
        }
      });
    });

    if (barcodesToFetch.length > 0) {
      barcodesToFetch.forEach((code) => {
        api.get(`/expense/verify-barcode?barcode=${encodeURIComponent(code)}`)
          .then((res: any) => {
            const data = res.data;
            if (data && (data.valid || data.success)) {
              const eq = data.data?.equipment_name || data.asset_name || "";
              const hosp = data.data?.hospital_name || data.hospital_name || "";
              if (eq || hosp) {
                setBarcodeMap((prev) => ({
                  ...prev,
                  [code]: { equipment: eq, hospital: hosp }
                }));
              }
            }
          })
          .catch(() => {});
      });
    }
  }, [claimDetails]);

  if (loadingDetails || !claimDetails) {
    if (!open) return null;
    return (
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={920}
        centered
        destroyOnClose={true}
        className="claim-details-modal-skeleton"
      >
        <div className="space-y-4 p-3 animate-pulse" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Header Skeleton */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200"></div>
              <div className="space-y-1.5">
                <div className="h-4 w-44 bg-slate-300 rounded"></div>
                <div className="h-3 w-28 bg-slate-200 rounded"></div>
              </div>
            </div>
            <div className="h-7 w-24 bg-slate-200 rounded-full"></div>
          </div>

          {/* 1-Line Daily Summary Strip Skeleton */}
          <div className="bg-slate-100/80 p-3 rounded-[4px] border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="h-4 w-56 bg-slate-300 rounded"></div>
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-4 w-28 bg-slate-300 rounded"></div>
          </div>

          {/* Leg Breakdown Cards Skeleton */}
          <div className="space-y-2">
            {[1, 2].map((idx) => (
              <div key={idx} className="bg-white border border-slate-200/90 rounded-[4px] p-4 space-y-2 shadow-2xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="h-4 w-28 bg-slate-300 rounded"></div>
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="h-3.5 bg-slate-200 rounded"></div>
                  <div className="h-3.5 bg-slate-200 rounded"></div>
                  <div className="h-3.5 bg-slate-200 rounded"></div>
                  <div className="h-3.5 bg-slate-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Photos Row Skeleton */}
          <div className="bg-slate-50 p-3 rounded-[4px] border border-slate-200 space-y-2">
            <div className="h-3 w-32 bg-slate-300 rounded"></div>
            <div className="flex gap-3">
              <div className="w-20 h-20 bg-slate-200 rounded-[3px]"></div>
              <div className="w-20 h-20 bg-slate-200 rounded-[3px]"></div>
              <div className="w-20 h-20 bg-slate-200 rounded-[3px]"></div>
            </div>
          </div>

          {/* Approvers Hierarchy Skeleton */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="h-3 w-36 bg-slate-300 rounded"></div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-200"></div>
              <div className="h-3.5 w-48 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (!claimDetails) return null;

  const c = claimDetails;
  
  // Page context detection (Approval vs Expense vs Home)
  const pathname = (window?.location?.pathname || "").toLowerCase();
  const isApprovalPage = sourceMode === "approval" || pathname.includes("/approval");
  const isExpensePage = sourceMode === "expense" || pathname.includes("/expense") || pathname.includes("/my-claims") || pathname.includes("/submit-expense");

  // Check if current viewing user is the engineer who submitted this claim
  const isSubmittingEngineer = !!(
    user && (
      (user.user_id && (c.user_id === user.user_id || c.employee_id === user.user_id || c.created_by === user.user_id)) ||
      (user.e_code && (c.employee_code === user.e_code || c.eCode === user.e_code || c.emp_code === user.e_code)) ||
      (user.id && (c.user_id === user.id || c.created_by === user.id))
    )
  );

  // EXPENSE PAGE ONLY: Edit & Delete buttons (strictly for the engineer who submitted the claim)
  const isEditable = isExpensePage && isSubmittingEngineer && ["draft", "submitted", "pending", "returned_to_draft"].includes((c.status || "").toLowerCase());
  const isDeletable = isExpensePage && isSubmittingEngineer && ["draft", "submitted", "pending", "returned_to_draft"].includes((c.status || "").toLowerCase());

  // APPROVAL CENTER ONLY: Approve, Reject & Return buttons
  const pendingStep = c.approvals?.find((a: any) => a.approver_code === user?.user_id && a.status === "pending");
  const roleLower = (user?.role || user?.designation || "").toLowerCase();
  const isAdmin = roleLower === "admin";
  const isCoordinator = roleLower.includes("coordinator") || isAdmin;
  const canApprove = isApprovalPage && !isSubmittingEngineer && (!!pendingStep || isCoordinator || ["submitted", "pending"].includes((c.status || "").toLowerCase()));
  const canEditAmounts = isApprovalPage && !isSubmittingEngineer && (canApprove || isCoordinator || roleLower.includes("manager") || roleLower.includes("head") || roleLower.includes("lead") || roleLower.includes("zonal") || roleLower.includes("supervisor"));

  const isOutOfState = c.districtType === "OUT_OF_STATE" || c.district_type === "OUT_OF_STATE" || c.districtCategory === "OUT_OF_STATE" || c.district_type === "OUT_STATE";
  const isOutDistrict = !isOutOfState && (c.districtType === "outstation" || c.is_outstation || c.districtType === "OUT_DISTRICT" ||
    (c.from_district && c.to_district && c.from_district !== c.to_district));

  const attachments = getAttachmentsArray(c.attachments_detailed || c.attachments || c.bills || c.photos);
  const approvals = Array.isArray(c.approvals) ? c.approvals : [];

  // Rejection & Approval Status Flags
  const isApproved = (c.status || "").toLowerCase() === "approved";
  const rejectedStep = approvals.find((a: any) => (a.status || "").toLowerCase() === "rejected");
  const isClaimRejected = (c.status || "").toLowerCase().includes("reject") || !!rejectedStep;

  // Limit Request Detection & Format Normalization
  const isLimitRequest = !!(
    c.is_limit_request ||
    c.category === "Limit Request" ||
    (c.expense_code && (c.expense_code.startsWith("LIMIT-") || c.expense_code.startsWith("LIMIT_")))
  );

  const limitType = c.limit_type || (c.expense_code?.includes("-KM-") ? "KM" : (c.expense_code?.includes("-AUTO-") ? "AUTO" : "KM"));
  const requestedLimitVal = c.requested_value ?? (c.original_amount > 0 ? c.original_amount : (c.amount || 0));
  const approvedLimitVal = isClaimRejected
    ? 0
    : (c.approved_value !== null && c.approved_value !== undefined ? parseFloat(c.approved_value) : (isApproved ? requestedLimitVal : requestedLimitVal));
  const limitUnit = limitType === "KM" ? "KM" : "₹";
  const formattedRequestedLimit = limitType === "KM" ? `${parseFloat(String(requestedLimitVal)).toFixed(0)} KM` : rupee(requestedLimitVal);
  const formattedApprovedLimit = isClaimRejected
    ? (limitType === "KM" ? "0 KM" : "₹0")
    : (limitType === "KM" ? `${parseFloat(String(approvedLimitVal)).toFixed(0)} KM` : rupee(approvedLimitVal));
  const resolvedList = getResolvedItineraries(c);
  const itineraries = (resolvedList.length > 0)
    ? resolvedList
    : (Array.isArray(editedLegs) && editedLegs.length > 0 ? editedLegs : []);

  // Collect all genuine bills & invoices (strictly financial vouchers only)
  const displayBills: any[] = [];
  const seenBillUrls = new Set<string>();

  attachments.forEach((att: any, idx: number) => {
    const u = typeof att === "string" ? att : (att.file_url || att.url || att.photo_url);
    if (u && typeof u === "string" && !seenBillUrls.has(u)) {
      seenBillUrls.add(u);
      displayBills.push(typeof att === "string" ? { file_url: att, file_name: `Bill Attachment #${idx + 1}` } : att);
    }
  });

  itineraries.forEach((leg: any, lIdx: number) => {
    const candidateBills = [
      { url: leg.travel_bill || leg.ta_bill || leg.ticket_url || leg.bus_bill || leg.train_ticket, title: `${leg.mode || "Travel"} Ticket/Bill (Leg ${lIdx + 1})` },
      { url: leg.hotel_bill || leg.hotel_photo || leg.hotel_url || leg.stay_bill, title: `Hotel Stay Bill (Leg ${lIdx + 1})` },
      { url: leg.local_purchase_bill || leg.local_purchase_photo || leg.local_purchase_url || leg.lp_bill, title: `Local Purchase Bill (Leg ${lIdx + 1})` },
      { url: leg.other_bill || leg.other_photo || leg.parcel_photo || leg.oth_bill, title: `Other / Courier Bill (Leg ${lIdx + 1})` },
    ];

    candidateBills.forEach((cb) => {
      if (cb.url && typeof cb.url === "string" && !seenBillUrls.has(cb.url)) {
        seenBillUrls.add(cb.url);
        displayBills.push({ file_url: cb.url, file_name: cb.title });
      }
    });
  });

  const rejectorName = rejectedStep?.approver_name || rejectedStep?.approver || c.rejected_by_name || c.rejector_name || c.rejected_by || "Manager / Coordinator";
  const rejectorCode = rejectedStep?.approver_code || c.rejector_code || "";
  const rejectorRole = rejectedStep?.approver_role || rejectedStep?.approver_designation || c.rejector_role || "";
  const rejectionRemark = rejectedStep?.remark || c.rejection_reason || c.rejection_remark || c.deduction_remark || c.approver_remark || c.remark || "";

  // Returned Claim Detection (Fix 2a)
  const returnedStep = approvals.find((a: any) => {
    const s = (a.status || "").toLowerCase();
    return s === "returned" || s === "returned_to_draft";
  });
  const isReturned = (c.status || "").toLowerCase() === "returned_to_draft" || (c.status || "").toLowerCase() === "returned" || !!returnedStep;
  const returnerName = returnedStep?.approver_name || returnedStep?.approver || c.returned_by_name || c.returner_name || "Manager / Coordinator";
  const returnerCode = returnedStep?.approver_code || c.returner_code || "";
  const returnerRole = returnedStep?.approver_role || returnedStep?.approver_designation || c.returner_role || "";
  const returnRemark = returnedStep?.comments || returnedStep?.remark || c.return_reason || c.return_remark || c.comments || "";

  // Parse Travel Modes
  const modesList = typeof c.travel_mode === "string"
    ? c.travel_mode.split(",").map((s: string) => s.trim()).filter(Boolean)
    : (typeof c.category === "string" ? c.category.split(",").map((s: string) => s.trim()).filter(Boolean) : []);

  // Zone & Home District fallback resolution
  const zoneVal = c.zone || c.submitter_zone || c.user_zone || (c.submitter_code === user?.user_id ? user?.zone : "") || "";
  const firstLegFromDist = itineraries.length > 0 ? (itineraries[0].from_district || itineraries[0].from_dist || "") : "";
  const homeDistVal = c.home_district || c.district || c.submitter_district || firstLegFromDist || (c.submitter_code === user?.user_id ? user?.district : "") || "";

  // Approved Net Amount: FORCED TO 0 WHEN CLAIM IS REJECTED!
  const rawApprovedAmt = c.approved_amount ?? c.final_amount ?? c.amount ?? c.total_amount ?? 0;
  const approvedAmt = isClaimRejected ? 0 : rawApprovedAmt;

  // Calculate Total Submitted Sum across all legs using DYNAMIC ALLOWANCE MASTER RATES
  const legSubmittedSum = itineraries.reduce((sum: number, leg: any, idx: number) => {
    const isFirstLeg = idx === 0;
    const mode = leg.mode || leg.travel_mode || "Bike";
    const km = leg.km ?? leg.distance_km ?? 0;
    const isCar = mode.toLowerCase().includes("car") || mode.toLowerCase().includes("four");
    
    // Dynamic rate_per_km from database allowance_master by Grade
    const rawBike = leg.rate_bike || leg.bike_rate || userAllowance?.rate_bike || c.rate_bike || c.allowance?.rate_bike;
    const dbBikeRate = (!rawBike || parseFloat(rawBike) === 4.5) ? 5.0 : parseFloat(rawBike);

    const rawCar = leg.rate_car || leg.car_rate || userAllowance?.rate_car || c.rate_car || c.allowance?.rate_car;
    const dbCarRate = (!rawCar || parseFloat(rawCar) === 9.0 || parseFloat(rawCar) === 9) ? 11.0 : parseFloat(rawCar);

    const dbOutDistrictDa = userAllowance?.daily_out_district || c.daily_out_district || c.allowance?.daily_out_district || 150;

    const rawRatePerKm = leg.rate_per_km
      ? parseFloat(leg.rate_per_km)
      : (leg.rate ? parseFloat(leg.rate) : (isCar ? dbCarRate : dbBikeRate));

    const ratePerKm = (rawRatePerKm === 4.5) ? 5.0 : ((rawRatePerKm === 9.0 || rawRatePerKm === 9) ? 11.0 : rawRatePerKm);

    const ta = parseFloat(leg.amount ?? leg.travel_amount ?? 0);
    const origTa = parseFloat(leg.original_amount ?? leg.original_travel_amount ?? 0);
    const estimatedTa = origTa > 0 ? origTa : (ta > 0 ? ta : (km > 0 ? km * ratePerKm : 0));
    const da = parseFloat(leg.da ?? leg.da_amount ?? 0);
    const origDa = parseFloat(leg.original_da ?? leg.original_da_amount ?? 0);
    const fromDist = leg.from_district || leg.from_dist || "";
    const toDist = leg.to_district || leg.to_dist || "";
    const isInDistrictLeg = (fromDist && toDist && fromDist.toLowerCase() === toDist.toLowerCase() && fromDist !== "—") || !isOutDistrict;
    
    // ONLY Leg #1 gets DA evaluated!
    const isDaClaimed = isFirstLeg && (leg.is_da_claimed ?? leg.da_claimed ?? (origDa > 0 || (leg.da !== undefined && parseFloat(leg.da) === 0 && isInDistrictLeg)));
    const estimatedDa = isFirstLeg ? (origDa > 0 ? origDa : (isDaClaimed ? dbOutDistrictDa : da)) : 0;
    
    const hotel = parseFloat(leg.hotel ?? leg.hotel_amount ?? 0);
    const local = parseFloat(leg.local_purchase ?? leg.local_purchase_amount ?? 0);
    const oth = parseFloat(leg.oth_amount ?? leg.other_amount ?? leg.sub_amount ?? 0);
    return sum + estimatedTa + estimatedDa + hotel + local + oth;
  }, 0);

  const rawClaimedTotal = c.original_amount ?? c.original_total ?? c.claimed_amount ?? c.total_claimed ?? c.amount ?? c.total_amount ?? 0;
  const originalClaimedTotal = (rawClaimedTotal > 0 && rawClaimedTotal > rawApprovedAmt)
    ? rawClaimedTotal
    : (legSubmittedSum > rawApprovedAmt ? legSubmittedSum : (rawClaimedTotal || rawApprovedAmt));

  const totalTaSum = itineraries.reduce((sum: number, i: any) => sum + parseFloat(i.travel_amount || i.amount || 0), 0);
  const totalTa = c.total_ta ?? c.ta_amount ?? c.travel_amount ?? (totalTaSum > 0 ? totalTaSum : 0);

  const totalDaSum = itineraries.length > 0 ? parseFloat(itineraries[0].da_amount || itineraries[0].da || 0) : 0;
  const totalDa = c.total_da ?? c.da_amount ?? (totalDaSum > 0 ? totalDaSum : 0);

  const totalHotelSum = itineraries.reduce((sum: number, i: any) => sum + parseFloat(i.hotel_amount || i.hotel || 0), 0);
  const totalHotel = c.hotel_amount ?? (totalHotelSum > 0 ? totalHotelSum : 0);

  const localPurchaseSum = itineraries.reduce((sum: number, i: any) => sum + parseFloat(i.local_purchase || 0), 0);
  const localPurchase = c.local_purchase_amount ?? c.local_purchase ?? (localPurchaseSum > 0 ? localPurchaseSum : 0);

  const otherAmountSum = itineraries.reduce((sum: number, i: any) => sum + parseFloat(i.other_amount || i.oth_amount || i.sub_amount || 0), 0);
  const otherAmount = c.other_expense_amount ?? c.other_amount ?? c.sub_amount ?? (otherAmountSum > 0 ? otherAmountSum : 0);

  // Extract all other expense remarks across legs
  const allOtherRemarks = itineraries.map((leg: any) => {
    const act = parseActivityDetails(leg.activity_details || leg.activity || leg.meta);
    return isValidText(leg.parcel_desc) ? leg.parcel_desc
      : (isValidText(leg.sub_mode_desc) ? leg.sub_mode_desc
      : (isValidText(leg.other_desc) ? leg.other_desc
      : (isValidText(leg.other_expense_remark) ? leg.other_expense_remark
      : (isValidText(leg.other_expense_reason) ? leg.other_expense_reason
      : (isValidText(leg.other_reason) ? leg.other_reason
      : (isValidText(leg.oth_remark) ? leg.oth_remark
      : (isValidText(act.otherDesc) ? act.otherDesc : "")))))));
  }).filter(Boolean).join(", ");

  const liveEditedTotalSum = (Array.isArray(editedLegs) && editedLegs.length > 0)
    ? editedLegs.reduce((sum: number, leg: any, idx: number) => {
        const isFirstLeg = idx === 0;
        const ta = parseFloat(String(leg.travel_amount || 0));
        const da = isFirstLeg ? parseFloat(String(leg.da || 0)) : 0;
        const sub = parseFloat(String(leg.sub_amount || 0));
        const hotel = parseFloat(String(leg.hotel_amount || 0));
        const lp = parseFloat(String(leg.local_purchase || 0));
        const oth = parseFloat(String(leg.other_amount || 0));
        return sum + ta + da + sub + hotel + lp + oth;
      }, 0)
    : null;

  // Deduction Auditor Details (WHO deducted & WHY)
  const editHistory = Array.isArray(c.edit_history) ? c.edit_history : (Array.isArray(c.history) ? c.history : []);
  const humanEditor = editHistory.find((el: any) => el.editor_name && el.editor_name.toUpperCase() !== "SYSTEM");
  const isManagerAction = isClaimRejected || !!rejectedStep || !!c.rejected_by || !!c.rejected_by_name || !!c.rejector_name || !!humanEditor || (editHistory.length > 0) || isValidText(c.deduction_remark) || isValidText(c.manager_remark) || isValidText(c.rejection_reason) || isValidText(c.rejection_remark) || isValidText(c.approver_remark);
  const hasHumanDeduction = isManagerAction;

  const rawDeductionAmt = isClaimRejected
    ? originalClaimedTotal
    : ((c.deduction_amount ?? c.deduction_amt ?? 0) > 0
        ? (c.deduction_amount ?? c.deduction_amt ?? 0)
        : (originalClaimedTotal > rawApprovedAmt ? (originalClaimedTotal - rawApprovedAmt) : 0));

  const savedSystemDeductionAmt = hasHumanDeduction ? 0 : rawDeductionAmt;
  const savedManagerDeductionAmt = hasHumanDeduction ? rawDeductionAmt : 0;

  const activeLiveManagerDeduction = liveEditedTotalSum !== null
    ? (rawApprovedAmt > liveEditedTotalSum ? (rawApprovedAmt - liveEditedTotalSum) : 0)
    : 0;

  const systemDeductionAmt = savedSystemDeductionAmt;
  const managerDeductionAmt = savedManagerDeductionAmt + activeLiveManagerDeduction;

  const currentApprovedNet = liveEditedTotalSum !== null ? liveEditedTotalSum : (isClaimRejected ? 0 : rawApprovedAmt);
  const totalCombinedDeduction = systemDeductionAmt + managerDeductionAmt;
  const deductionAmt = totalCombinedDeduction;

  const overallBaseLocationReason = c.base_location_deduction_reason || c.base_location_reason || c.base_location_policy || c.location_policy_reason || "";
  const overallSystemReason = c.system_deduction_reason || c.policy_deduction_reason || c.policy_reason || "";

  const latestEditor = humanEditor || (editHistory.length > 0 ? editHistory[0] : null);

  const approvedSteps = approvals.filter((a: any) => a.status === "approved" || a.status === "Approved");
  const approverStep = approvedSteps.length > 0
    ? approvedSteps[approvedSteps.length - 1]
    : (approvals.find((a: any) => a.approver_name || a.approver_code) || null);

  const hasLiveModification = activeLiveManagerDeduction > 0;

  const managerDeductorName = (hasLiveModification && user?.name ? user.name : null)
    || latestEditor?.editor_name
    || c.approved_by_name
    || c.edited_by_name
    || approverStep?.approver_name
    || (user?.name ? user.name : "Manager / Approver");

  const managerDeductorCode = (hasLiveModification && (user?.user_id || user?.e_code) ? (user.user_id || user.e_code) : null)
    || latestEditor?.editor_code
    || c.approved_by_code
    || c.edited_by_code
    || approverStep?.approver_code
    || (user?.user_id || user?.e_code || "");

  const managerDeductorRole = (hasLiveModification && user?.role ? user.role : null)
    || latestEditor?.editor_role
    || c.approved_by_role
    || c.edited_by_role
    || approverStep?.approver_role
    || (user?.role || "Manager");

  // Collect all manager deduction remarks across legs, comments, and edit history
  const legRemarksList: string[] = [];
  itineraries.forEach((leg: any, idx: number) => {
    const edited = editedLegs?.[idx];
    const r = edited?.remarks || leg.remarks;
    if (r && typeof r === "object") {
      Object.entries(r).forEach(([f, val]) => {
        if (typeof val === "string" && val.trim()) {
          legRemarksList.push(`${f.toUpperCase()}: "${val.trim()}"`);
        }
      });
    }
  });

  const historyComments = editHistory
    .map((el: any) => el.comment || el.reason || (el.field_name ? `${el.field_name}: ${el.old_value} ➔ ${el.new_value}` : ""))
    .filter(Boolean);

  const directRemarks = [
    comments,
    c.deduction_remark,
    c.manager_remark,
    c.approver_remark,
    c.rejection_reason,
    c.comments,
    rejectionRemark
  ].filter(Boolean);

  const allManagerDeductionReasons = Array.from(
    new Set([...legRemarksList, ...historyComments, ...directRemarks])
  ).join(" • ");

  const finalManagerReason = allManagerDeductionReasons || "Manager amount override / manual deduction.";

  const hasOverallDeduction = deductionAmt > 0 ||
    isValidText(c.km_deduction_reason) ||
    isValidText(c.da_deduction_reason) ||
    isValidText(overallBaseLocationReason) ||
    isValidText(overallSystemReason) ||
    isValidText(c.deduction_remark) ||
    isValidText(c.approver_remark);

  // Work done totals (STRICT 0 CHECK)
  const totalCallsCompleted = c.calls_completed ?? itineraries.reduce((sum: number, i: any) => sum + (i.calls_completed || i.ws_closed || 0), 0);
  const totalCallsAssigned = c.calls_assigned ?? itineraries.reduce((sum: number, i: any) => sum + (i.calls_assigned || i.ws_assigned || 0), 0);
  const totalPms = c.pms_completed ?? c.pms_count ?? itineraries.reduce((sum: number, i: any) => sum + (i.pms_count || i.ws_pms || 0), 0);
  const totalCalibration = c.calibration_count ?? itineraries.reduce((sum: number, i: any) => sum + (i.calibration_count || 0), 0);
  const totalMobilise = c.mobilise_count ?? c.mobilise_asset_count ?? itineraries.reduce((sum: number, i: any) => sum + (i.mobilise_count || 0), 0);
  const totalAssetTagging = c.asset_tagging ?? itineraries.reduce((sum: number, i: any) => sum + (i.asset_tagging || i.ws_asset || 0), 0);

  // Total Distance calculation
  const calculatedTotalKm = c.total_km ?? itineraries.reduce((sum: number, i: any) => sum + parseFloat(i.km || i.distance_km || 0), 0);

  // Parse overall Purpose & Activity
  const parsedOverallActivity = parseActivityDetails(c.description || c.purpose || c.activity_details || c.meta);
  const cleanPurpose = isValidText(parsedOverallActivity.text) ? parsedOverallActivity.text : (isValidText(c.purpose) ? c.purpose : (isValidText(c.description) ? c.description : ""));
  const overallOtherReason = isValidText(c.other_reason) ? c.other_reason : (isValidText(c.other_desc) ? c.other_desc : (isValidText(c.category_remark) ? c.category_remark : (isValidText(parsedOverallActivity.otherDesc) ? parsedOverallActivity.otherDesc : "")));

  void approvedAmt;
  void allOtherRemarks;
  void totalCallsCompleted;
  void totalCallsAssigned;
  void totalPms;
  void totalCalibration;
  void totalMobilise;
  void totalAssetTagging;
  void calculatedTotalKm;
  void overallOtherReason;

  // Collect all unique facility/location names visited across legs
  const collectedFacilities: string[] = [];
  itineraries.forEach((l: any) => {
    const act = parseActivityDetails(l.activity_details || l.activity || l.meta);
    const fL = l.from || l.from_location || "";
    const tL = l.to || l.to_location || "";
    const hosp = l.hospital_name || l.hospital || act.hospitalName || "";
    [fL, tL, hosp].forEach((val: string) => {
      if (isValidText(val) && val !== "—") {
        const clean = String(val).trim();
        if (!collectedFacilities.includes(clean)) collectedFacilities.push(clean);
      }
    });
  });

  return (
    <>
    <Modal
      open={open}
      onCancel={onClose}
      centered={true}
      width={720}
      destroyOnClose
      closeIcon={false}
      className="claim-details-compact-modal"
      wrapClassName="my-claims-modal-wrap"
      maskStyle={{ backdropFilter: "blur(6px)", background: "rgba(18, 21, 26, 0.6)" }}
      bodyStyle={{ padding: 0, background: "#FAFAF9", maxHeight: "85vh", overflowY: "auto", borderRadius: "4px" }}
      styles={{
        header: { display: "none" },
        footer: { borderTop: "1px solid var(--line, #E7E5E1)", padding: "8px 12px", background: "#ffffff", margin: 0, borderRadius: "0 0 4px 4px" },
      }}
      footer={
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isEditable && (
              <button
                onClick={() => { onClose(); navigate(`/submit-expense?edit=${c.id}`); }}
                className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 border-b-[3px] border-b-amber-500 hover:brightness-105 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-2xs leading-none"
              >
                <Pencil size={13} /> Edit
              </button>
            )}
            {isDeletable && (
              <button
                onClick={() => {
                  onClose();
                  handleDeleteClaim(c.id);
                }}
                className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 border-b-[3px] border-b-rose-500 hover:brightness-105 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-2xs leading-none"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            {canApprove && !showRejectBox && !showReturnBox && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 border-b-[3px] border-b-emerald-900 hover:brightness-110 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-sm disabled:opacity-50 leading-none"
                >
                  <CheckCircle2 size={13} /> {actionLoading ? "Processing…" : "Approve"}
                </button>
                <button
                  onClick={() => { setShowRejectBox(true); setShowReturnBox(false); }}
                  className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 border-b-[3px] border-b-rose-500 hover:brightness-105 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-2xs leading-none"
                >
                  <XCircle size={13} /> Reject
                </button>
                {isCoordinator && (
                  <button
                    onClick={() => { setShowReturnBox(true); setShowRejectBox(false); }}
                    className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 border-b-[3px] border-b-orange-500 hover:brightness-105 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-2xs leading-none"
                  >
                    <RotateCcw size={13} /> Return
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setShowResetModal(true)}
                      className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-accent-600 hover:bg-accent-700 text-white border border-accent-700 border-b-[3px] border-b-accent-900 hover:brightness-110 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-sm leading-none"
                      title="Select specific approval hierarchy level to re-route this claim to"
                    >
                      <RotateCcw size={13} /> Reset Level
                    </button>
                    <button
                      onClick={() => setShowResetModal(true)}
                      className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 border-b-[3px] border-b-rose-900 hover:brightness-110 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-sm leading-none"
                      title="Cancel this expense claim completely and record audit log"
                    >
                      <XCircle size={13} /> Cancel Claim
                    </button>
                  </>
                )}
              </>
            )}
            {showRejectBox && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Rejection reason…"
                  className="text-xs border border-line rounded-[4px] px-3 py-1.5 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-500 min-w-[200px]"
                />
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !comments.trim()}
                  className="cursor-pointer transition-all inline-flex items-center gap-1 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 border-b-[3px] border-b-rose-900 hover:brightness-110 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] disabled:opacity-50 shadow-sm leading-none"
                >
                  <XCircle size={13} /> Confirm Reject
                </button>
                <button
                  onClick={() => { setShowRejectBox(false); setComments(""); }}
                  className="text-xs text-ink-400 hover:text-ink-600 transition-colors px-2 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            {showReturnBox && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Return reason / remark…"
                  className="text-xs border border-line rounded-[4px] px-3 py-1.5 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-500 min-w-[200px]"
                />
                <button
                  onClick={() => {
                    if (handleReturn) {
                      handleReturn();
                    } else {
                      handleReject();
                    }
                  }}
                  disabled={actionLoading || !comments.trim()}
                  className="cursor-pointer transition-all inline-flex items-center gap-1 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 border-b-[3px] border-b-orange-900 hover:brightness-110 hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] disabled:opacity-50 shadow-sm leading-none"
                >
                  <RotateCcw size={13} /> Confirm Return
                </button>
                <button
                  onClick={() => { setShowReturnBox(false); setComments(""); }}
                  className="text-xs text-ink-400 hover:text-ink-600 transition-colors px-2 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer transition-all inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold text-ink-700 border border-line border-b-[3px] border-b-line-strong hover:border-b-accent-400 hover:bg-surface-sunken hover:-translate-y-[1px] active:border-b-[1px] active:translate-y-[2px] shadow-2xs leading-none"
          >
            <X size={13} /> Close
          </button>
        </div>
      }
    >
      {/* ─── MOBILE DRAG HANDLE ─────────────────────────────────────────── */}
      <div className="block sm:hidden pt-2 pb-1 text-center bg-white border-b border-line">
        <div className="w-10 h-1 rounded-full bg-line-strong mx-auto" />
      </div>

      {/* ─── MODAL HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-line sticky top-0 z-20">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-6 rounded-full shrink-0 ${isOutOfState ? "bg-purple-600" : (isOutDistrict ? "bg-amber-500" : "bg-accent-600")}`} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold font-mono text-accent-700 tracking-tight">
              {c.expense_code || c.claim_id || `#${c.id}`}
            </span>
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
              isOutOfState
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : (isOutDistrict ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-accent-50 text-accent-700 border-accent-200")
            }`}>
              {isOutOfState ? "Out of State" : (isOutDistrict ? "Out-District" : "In-District")}
            </span>
            {c.hasMismatch && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                ⚠️ Mismatch
              </span>
            )}
            <StatusBadge status={c.status} record={c} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-[4px] flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-surface-sunken transition-all shrink-0 cursor-pointer border border-transparent hover:border-line"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-2.5 space-y-2 font-sans text-ink-900">

        {/* ─── 1. HIERARCHY-ALIGNED LIFECYCLE APPROVAL STEPPER (3-STAGE: SUBMITTED ➔ LEVEL 1 MANAGER ➔ LEVEL 2 COORDINATOR) ─────────────────── */}
        <div className="bg-white rounded-[4px] border border-line/80 p-2 sm:p-2.5 shadow-2xs overflow-x-auto">
          {(() => {
            // Level 1: Manager Review
            const l1 = approvals.find((a: any) => a.level === 1 || a.approver_role?.toLowerCase().includes("manag")) || approvals[0];
            const isL1Approved = l1?.status === "approved" || isApproved || (approvals.length > 1 && approvals[1]?.status === "approved");
            const isL1Rejected = l1?.status === "rejected" || (isClaimRejected && !approvals[1]);
            const isL1Returned = l1?.status === "returned" || isReturned;

            // Level 2: Coordinator Review
            const l2 = approvals.find((a: any) => a.level === 2 || a.approver_role?.toLowerCase().includes("coord")) || approvals[1];
            const isL2Approved = l2?.status === "approved" || isApproved;
            const isL2Rejected = l2?.status === "rejected" || (isClaimRejected && !!approvals[1]);
            const isL2Returned = l2?.status === "returned";

            return (
              <div className="flex items-center justify-between relative px-1 sm:px-12 min-w-[280px]">
                {/* Step 1: Submission */}
                <div className="flex flex-col items-center gap-0.5 z-10 text-center min-w-[65px] sm:min-w-[75px] shrink-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                    <CheckCircle2 size={13} />
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-ink-900 font-sans whitespace-nowrap">1. Submitted</span>
                  <span className="text-[8.5px] sm:text-[9px] text-ink-400 font-mono">{formatDateDDMMMYY(c.date || c.itinerary)}</span>
                </div>

                {/* Line 1 -> 2 */}
                <div className={`flex-1 h-0.5 mx-1.5 sm:mx-6 min-w-[12px] ${
                  isL1Approved ? "bg-emerald-500" : (isL1Rejected ? "bg-rose-400" : (isL1Returned ? "bg-orange-400" : "bg-amber-400"))
                }`} />

                {/* Step 2: Level 1 - Manager */}
                <div className="flex flex-col items-center gap-0.5 z-10 text-center min-w-[80px] sm:min-w-[95px] shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-2xs ${
                    isL1Approved
                      ? "bg-emerald-600 text-white"
                      : isL1Rejected
                      ? "bg-rose-600 text-white"
                      : isL1Returned
                      ? "bg-orange-500 text-white"
                      : "bg-amber-500 text-white animate-pulse"
                  }`}>
                    {isL1Approved ? <CheckCircle2 size={13} /> : (isL1Rejected ? <XCircle size={13} /> : (isL1Returned ? <RotateCcw size={13} /> : <Clock size={13} />))}
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-ink-900 font-sans whitespace-nowrap">2. Level 1: Manager</span>
                  <span className="text-[8.5px] sm:text-[9px] font-mono font-medium whitespace-nowrap">
                    {isL1Approved ? (
                      <span className="text-emerald-700">{l1?.action_date ? formatDateDDMMMYY(l1.action_date) : "Approved"}</span>
                    ) : isL1Rejected ? (
                      <span className="text-rose-700">Rejected</span>
                    ) : isL1Returned ? (
                      <span className="text-orange-700">Returned</span>
                    ) : (
                      <span className="text-amber-700">Under Review</span>
                    )}
                  </span>
                </div>

                {/* Line 2 -> 3 */}
                <div className={`flex-1 h-0.5 mx-1.5 sm:mx-6 min-w-[12px] ${
                  isL2Approved ? "bg-emerald-500" : (isL2Rejected ? "bg-rose-400" : (isL2Returned ? "bg-orange-400" : (isL1Approved ? "bg-amber-400" : "bg-line")))
                }`} />

                {/* Step 3: Level 2 - Coordinator */}
                <div className="flex flex-col items-center gap-0.5 z-10 text-center min-w-[85px] sm:min-w-[95px] shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-2xs ${
                    isL2Approved
                      ? "bg-emerald-600 text-white"
                      : isL2Rejected
                      ? "bg-rose-600 text-white"
                      : isL2Returned
                      ? "bg-orange-500 text-white"
                      : (isL1Approved ? "bg-amber-500 text-white animate-pulse" : "bg-surface-sunken text-ink-400 border border-line")
                  }`}>
                    {isL2Approved ? <CheckCircle2 size={13} /> : (isL2Rejected ? <XCircle size={13} /> : (isL2Returned ? <RotateCcw size={13} /> : <Clock size={13} />))}
                  </div>
                  <span className="text-[9.5px] sm:text-[10px] font-bold text-ink-900 font-sans whitespace-nowrap">3. Level 2: Coordinator</span>
                  <span className="text-[8.5px] sm:text-[9px] font-mono font-medium whitespace-nowrap">
                    {isL2Approved ? (
                      <span className="text-emerald-700">{l2?.action_date ? formatDateDDMMMYY(l2.action_date) : "Approved"}</span>
                    ) : isL2Rejected ? (
                      <span className="text-rose-700">Rejected</span>
                    ) : isL2Returned ? (
                      <span className="text-orange-700">Returned</span>
                    ) : isL1Approved ? (
                      <span className="text-amber-700">In Review</span>
                    ) : (
                      <span className="text-ink-400">Awaiting L1</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ─── 2. HEADER DATA STRIP ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {/* Card 1: Identity */}
          <div className="bg-white rounded-[4px] border border-line/80 p-2 space-y-0.5 shadow-2xs">
            <div className="flex items-center gap-1 text-ink-400 text-[10px] font-mono font-medium uppercase tracking-wider">
              <FileText size={12} className="text-accent-600" /> Claim Identity
            </div>
            <div className="text-xs font-bold text-accent-700 font-mono truncate">
              {c.expense_code || c.claim_id || `#${c.id}`}
            </div>
            <div className="text-[11px] text-ink-600 font-medium flex items-center gap-1.5 flex-wrap">
              <span className="text-ink-400">Mode:</span>
              <span className="font-bold text-accent-800 bg-accent-50 border border-accent-200 px-1.5 py-0.2 rounded-[3px] uppercase text-[10px] tracking-wider">
                {c.category || c.travel_mode || (modesList.length > 0 ? modesList.join(", ") : "Tour")}
              </span>
            </div>
          </div>

          {/* Card 2: Submitter */}
          <div className="bg-white rounded-[4px] border border-line/80 p-2 space-y-0.5 shadow-2xs">
            <div className="flex items-center gap-1 text-ink-400 text-[10px] font-mono font-medium uppercase tracking-wider">
              <User size={12} className="text-accent-600" /> Submitted By
            </div>
            <div className="text-xs font-bold text-ink-900 truncate" title={c.submitter_name || c.employeeName || c.name || "Engineer"}>
              {c.submitter_name || c.employeeName || c.name || "Engineer"}
            </div>
            <div className="text-[10.5px] text-ink-600 font-medium leading-tight break-words" title={c.designation || c.submitter_designation || ""}>
              {(c.submitter_code || c.eCode || c.user_id) && (
                <span className="font-mono text-accent-700 font-bold mr-1">[{c.submitter_code || c.eCode || c.user_id}]</span>
              )}
              <span>{c.designation || c.submitter_designation || c.user_role || "Engineer"}</span>
            </div>
          </div>

          {/* Card 3: Mapped Zone & District */}
          <div className="bg-white rounded-[4px] border border-line/80 p-2 space-y-0.5 shadow-2xs">
            <div className="flex items-center gap-1 text-ink-400 text-[10px] font-mono font-medium uppercase tracking-wider">
              <Building2 size={12} className="text-[#0F7A4C]" /> Mapped Zone
            </div>
            <div className="text-xs font-bold text-ink-900 truncate">
              {zoneVal ? `Zone ${zoneVal}` : (homeDistVal ? `${homeDistVal} Zone` : "Rajasthan Zone")}
            </div>
            <div className="text-[11px] text-ink-500 font-medium truncate">
              Home: <b className="text-ink-800">{homeDistVal || c.district || c.submitter_district || "Base District"}</b>
            </div>
          </div>

          {/* Card 4: Timing (24-HOUR FORMAT) */}
          <div className="bg-white rounded-[4px] border border-line/80 p-2 space-y-0.5 shadow-2xs">
            <div className="flex items-center gap-1 text-ink-400 text-[10px] font-mono font-medium uppercase tracking-wider">
              <Calendar size={12} className="text-[#B7791F]" /> Claim Date
            </div>
            <div className="text-xs font-bold text-ink-900 truncate">
              {formatDateDDMMMYY(c.date || c.itinerary)}
            </div>
            <div className="text-[10px] text-ink-400 truncate font-mono">
              {formatDateTime24(c.created_at || c.submitted_at)}
            </div>
          </div>
        </div>

        {/* ─── 3. MODAL SECTION TABS (3D TACTICAL PUSH BUTTON STYLE) ─────── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setModalTab("all")}
            className={`cursor-pointer transition-all px-3.5 py-1.5 rounded-[4px] text-xs font-semibold leading-none flex items-center gap-1.5 shrink-0 ${
              modalTab === "all"
                ? "bg-accent-50 text-accent-700 border border-accent-300 border-b-[3px] border-b-accent-600 font-bold hover:brightness-105 hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-xs"
                : "bg-white text-ink-600 hover:text-ink-900 border border-line border-b-[3px] border-b-line-strong hover:border-b-accent-400 hover:bg-surface-sunken hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-2xs"
            }`}
          >
            <FileText size={13} className="text-accent-600" />
            <span>All Overview</span>
          </button>
          {!isLimitRequest && itineraries.length > 0 && (
            <button
              type="button"
              onClick={() => setModalTab("legs")}
              className={`cursor-pointer transition-all px-3.5 py-1.5 rounded-[4px] text-xs font-semibold leading-none flex items-center gap-1.5 shrink-0 ${
                modalTab === "legs"
                  ? "bg-accent-50 text-accent-700 border border-accent-300 border-b-[3px] border-b-accent-600 font-bold hover:brightness-105 hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-xs"
                  : "bg-white text-ink-600 hover:text-ink-900 border border-line border-b-[3px] border-b-line-strong hover:border-b-accent-400 hover:bg-surface-sunken hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-2xs"
              }`}
            >
              <Route size={13} className="text-accent-600" />
              <span>Travel Legs ({itineraries.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalTab("bills")}
            className={`cursor-pointer transition-all px-3.5 py-1.5 rounded-[4px] text-xs font-semibold leading-none flex items-center gap-1.5 shrink-0 ${
              modalTab === "bills"
                ? "bg-accent-50 text-accent-700 border border-accent-300 border-b-[3px] border-b-accent-600 font-bold hover:brightness-105 hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-xs"
                : "bg-white text-ink-600 hover:text-ink-900 border border-line border-b-[3px] border-b-line-strong hover:border-b-accent-400 hover:bg-surface-sunken hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-2xs"
            }`}
          >
            <Package size={13} className="text-accent-600" />
            <span>Bills & Invoices ({attachments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("audit")}
            className={`cursor-pointer transition-all px-3.5 py-1.5 rounded-[4px] text-xs font-semibold leading-none flex items-center gap-1.5 shrink-0 ${
              modalTab === "audit"
                ? "bg-accent-50 text-accent-700 border border-accent-300 border-b-[3px] border-b-accent-600 font-bold hover:brightness-105 hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-xs"
                : "bg-white text-ink-600 hover:text-ink-900 border border-line border-b-[3px] border-b-line-strong hover:border-b-accent-400 hover:bg-surface-sunken hover:-translate-y-[0.5px] active:border-b-[1px] active:translate-y-[1.5px] shadow-2xs"
            }`}
          >
            <ShieldCheck size={13} className="text-accent-600" />
            <span>Approvals & Audit ({approvals.length + (auditLogs?.length || 0)})</span>
          </button>
        </div>

        {/* ─── RETURN REMARK BANNER ─────────────────────────────────────────── */}
        {isReturned && (
          <div className="p-3.5 bg-orange-50 rounded-[4px] border border-orange-200 text-orange-900 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-orange-200/80 pb-1 flex-wrap gap-1">
              <span className="text-xs font-bold text-orange-900 uppercase flex items-center gap-1.5 font-display">
                <RotateCcw size={13} className="text-orange-700" /> Returned for Correction
              </span>
              <span className="text-[10px] font-semibold text-orange-900 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-300/80">
                Returned By: <b>{returnerName}</b> {returnerCode ? `[${returnerCode}]` : ""} {returnerRole ? `(${returnerRole})` : ""}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-[3px] border-l-4 border-l-orange-500 border border-orange-200/70 text-xs text-ink-900 font-semibold leading-relaxed">
              <span className="text-[10px] font-mono text-orange-800 uppercase block mb-0.5">Return Remark:</span>
              "{returnRemark || "Please review the notes, make the necessary corrections, and resubmit."}"
            </div>
          </div>
        )}

        {/* ─── 4. FINANCIAL / QUOTA SUMMARY CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {isLimitRequest ? (
            <>
              <MiniAmountBox label="Requested Extension" value={formattedRequestedLimit} color="#4338CA" />
              <MiniAmountBox
                label="Approved Extension"
                value={formattedApprovedLimit}
                color={isApproved ? "#0F7A4C" : (isClaimRejected ? "#DC2626" : "#D97706")}
              />
              <MiniAmountBox label="Reimbursable Cash" value="₹0" subtext="Quota Extension" color="#64748b" />
              <div className="bg-white rounded-[4px] border border-line/80 p-2.5 shadow-2xs space-y-0.5 flex flex-col justify-center items-center">
                <div className="text-ink-400 text-[9px] font-bold uppercase tracking-wider">Request Status</div>
                <div className="pt-0.5">
                  <StatusBadge status={c.status} record={c} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} />
                </div>
              </div>
            </>
          ) : (
            <>
              <MiniAmountBox label="Total Claimed" value={rupee(originalClaimedTotal)} color="#4338CA" />
              <MiniAmountBox
                label={isApproved ? "Approved Net" : (isClaimRejected ? "Approved Net" : (liveEditedTotalSum !== null ? "Live Net After Edit" : "Estimated Net"))}
                value={isClaimRejected ? "₹0" : rupee(currentApprovedNet)}
                color={isApproved ? "#0F7A4C" : (isClaimRejected ? "#DC2626" : "#0F7A4C")}
              />
              <MiniAmountBox label="Travel TA" value={rupee(totalTa)} subtext={c.total_km ? `${c.total_km} km` : undefined} color="#0284c7" />
              <MiniAmountBox label="Daily DA" value={rupee(totalDa)} color="#059669" />
              {otherAmount > 0 && <MiniAmountBox label="Other Exp." value={rupee(otherAmount)} color="#d97706" />}
              {localPurchase > 0 && <MiniAmountBox label="Local Purchase" value={rupee(localPurchase)} color="#b45309" />}
              {totalHotel > 0 && <MiniAmountBox label="Hotel / Stay" value={rupee(totalHotel)} color="#7c3aed" />}
              {systemDeductionAmt > 0 && <MiniAmountBox label="⚙️ System Deduction" value={`-${rupee(systemDeductionAmt)}`} color="#d97706" />}
              {managerDeductionAmt > 0 && <MiniAmountBox label="✏️ Manager Deduction" value={`-${rupee(managerDeductionAmt)}`} color="#dc2626" />}
            </>
          )}
        </div>

        {/* ─── DEDICATED LIMIT REQUEST PANEL ─── */}
        {isLimitRequest && (
          <div className="bg-white border-2 border-[#4A6A8A]/30 rounded-[3px] p-2 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[#4A6A8A]" />
                <span className="text-[12px] font-extrabold text-slate-800">
                  {limitType === "KM" ? "Distance Limit Extension Request (Bike / Car)" : "Local Conveyance Limit Extension Request (Auto)"}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Target Month: {c.month || c.date}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Requested Limit Extension</div>
                <div className="text-sm font-extrabold text-[#4A6A8A] font-mono">{formattedRequestedLimit}</div>
              </div>
              <div className={`p-2.5 rounded border space-y-1 ${isApproved ? 'bg-emerald-50 border-emerald-200' : (isClaimRejected ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200')}`}>
                <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Approved Quota Decision</div>
                <div className={`text-sm font-extrabold font-mono ${isApproved ? 'text-emerald-700' : (isClaimRejected ? 'text-rose-700' : 'text-amber-700')}`}>
                  {isApproved ? `Approved: ${formattedApprovedLimit}` : (isClaimRejected ? `Rejected (0 ${limitUnit})` : 'Pending Manager Review')}
                </div>
              </div>
            </div>

            {/* Requester Purpose / Justification */}
            <div className="bg-slate-50 p-2.5 rounded-[3px] border border-slate-200 text-[10.5px]">
              <div className="font-bold text-slate-500 uppercase text-[9px] mb-0.5">Employee Purpose / Justification</div>
              <div className="text-slate-800 font-medium">{cleanPurpose || c.purpose || c.description || "Request additional limit extension."}</div>
            </div>

            {/* Manager Decision Remarks */}
            {(rejectionRemark || c.approver_remark || c.manager_remark || c.comments || (approvals.length > 0 && approvals[0]?.comments)) && (
              <div className={`p-2.5 rounded-[3px] border text-[10.5px] ${isClaimRejected ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="font-extrabold uppercase text-[9px] mb-0.5 flex items-center gap-1">
                  {isClaimRejected ? <XCircle size={12} className="text-rose-600" /> : <CheckCircle2 size={12} className="text-emerald-600" />}
                  Manager Remarks ({rejectorName})
                </div>
                <div className="font-bold text-slate-900 leading-relaxed">
                  "{rejectionRemark || c.approver_remark || c.manager_remark || c.comments || approvals[0]?.comments}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── DEEP LEG-BY-LEG CARDS (FOR REGULAR TRAVEL CLAIMS ONLY) ─── */}
        {!isLimitRequest && itineraries.length > 0 && (modalTab === "all" || modalTab === "legs") && (
          <div className="space-y-2">
            <SectionHeader
              icon={Route}
              label="Travel & Field Visit Details"
              count={`${itineraries.length} Legs`}
            />

            <div className="space-y-2">
              {itineraries.map((leg: any, idx: number) => (
                <LegDetailCard
                  key={idx}
                  leg={leg}
                  index={idx}
                  totalLegsCount={itineraries.length}
                  setLightboxImage={handleOpenPhoto}
                  barcodeMap={barcodeMap}
                  claimDistrictType={c.districtType || (isOutDistrict ? "Out-District" : "In-District")}
                  userAllowance={userAllowance}
                  claimMaster={c}
                  allAttachments={attachments}
                  canEditAmounts={canEditAmounts}
                  editedLeg={editedLegs?.[idx]}
                  onLegAmountChange={onLegAmountChange}
                  onLegRemarkChange={onLegRemarkChange}
                  routeBenchmark={routeBenchmarks[idx]}
                  auditLogs={auditLogs}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── ATTACHMENTS & BILL INVOICES GALLERY (STRICTLY BILLS & INVOICES ONLY) ─── */}
        {(modalTab === "all" || modalTab === "bills") && (
          <div className="bg-white rounded-[4px] border border-line/80 shadow-2xs p-2.5 space-y-2">
            <div className="flex items-center justify-between border-b border-line/60 pb-1 flex-wrap gap-1">
              <SectionHeader
                icon={Package}
                label="Bills & Invoices"
                count={`${displayBills.length} Bills`}
              />
              {displayBills.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    displayBills.forEach((b: any, bIdx: number) => {
                      const u = typeof b === "string" ? b : (b.file_url || b.url);
                      if (u) setTimeout(() => handleDownloadFile(u, b.file_name || `bill-${bIdx + 1}.jpg`), bIdx * 300);
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-[10px] font-bold transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Download All Bills ({displayBills.length})</span>
                </button>
              )}
            </div>

            {displayBills.length === 0 ? (
              <div className="text-center py-4 text-xs text-ink-400 font-sans">
                No bills uploaded for this claim (Standard Allowance / Rate per KM)
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {displayBills.map((att: any, i: number) => (
                  <AttachmentCard
                    key={i}
                    att={att}
                    index={i}
                    setLightboxImage={handleOpenPhoto}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── DEDUCTIONS & POLICY REMARKS (FULL CONSOLIDATED AUDIT CARD) ─── */}
        {!isLimitRequest && hasOverallDeduction && !isClaimRejected && (modalTab === "all" || modalTab === "audit") && (
          <div className="bg-white rounded-[4px] border border-rose-200/80 shadow-2xs p-2.5 space-y-1.5 text-xs">
            <SectionHeader icon={AlertTriangle} label="Deductions & Policy Audit Details" accent="#ef4444" />
            
            {/* Summary Line */}
            <div className="flex items-center justify-between border-b border-rose-100 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-bold text-ink-900 flex-wrap">
                <span>Deduction Summary:</span>
                <span className="font-medium text-ink-600">Claimed: <b className="font-mono">{rupee(originalClaimedTotal)}</b></span>
                <span className="text-ink-300">➔</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  Approved Net: {rupee(currentApprovedNet)}
                </span>
              </div>
              <div className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Total Deduction: -{rupee(totalCombinedDeduction)}
              </div>
            </div>

            {/* Individual Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Base Location Deduction Card */}
              {systemDeductionAmt > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-[4px] p-3 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-amber-950 text-xs">
                    <span className="flex items-center gap-1.5">📍 Base Location Deduction</span>
                    <span className="font-mono text-amber-900 font-bold">-{rupee(systemDeductionAmt)}</span>
                  </div>
                  <div className="text-[11px] text-amber-900 leading-tight">
                    <b className="text-amber-950">Deducted By:</b> System Rule Engine
                  </div>
                  <div className="text-[11px] text-amber-900 leading-normal bg-white p-2 rounded-[3px] border border-amber-200/60 mt-1">
                    <b className="text-amber-950 block mb-0.5">Exact Reason / Rule:</b>
                    <span className="text-ink-900 font-medium">
                      Base Location Deduction
                    </span>
                  </div>
                </div>
              )}

              {/* Coordinator / Manager Manual Deduction Card */}
              {managerDeductionAmt > 0 && (
                <div className="bg-rose-50/60 border border-rose-200 rounded-[4px] p-3 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-rose-950 text-xs">
                    <span className="flex items-center gap-1.5">
                      {isClaimRejected ? "🚫 Claim Rejection" : `✏️ ${managerDeductorRole || "Coordinator / Manager"} Manual Deduction`}
                    </span>
                    <span className="font-mono text-rose-900 font-bold">-{rupee(managerDeductionAmt)}</span>
                  </div>
                  <div className="text-[11px] text-rose-900 leading-tight">
                    <b className="text-rose-950">Deducted By:</b> {managerDeductorName || "Approver"} {managerDeductorCode ? `[${managerDeductorCode}]` : ""}
                  </div>
                  <div className="text-[11px] text-rose-900 leading-normal bg-white p-2 rounded-[3px] border border-rose-200/60 mt-1">
                    <b className="text-rose-950 block mb-0.5">Remark:</b>
                    <span className="text-ink-900 font-medium">
                      "{finalManagerReason || "Amount adjusted during review"}"
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── REJECTION NOTICE BANNER ──────────────────────────────────────── */}
        {isClaimRejected && (
          <div className="p-3.5 bg-rose-50 rounded-[4px] border border-rose-200 text-rose-900 space-y-2">
            <div className="flex items-center justify-between border-b border-rose-200/60 pb-1.5 flex-wrap gap-1">
              <span className="text-xs font-bold text-rose-900 uppercase flex items-center gap-1.5 font-display">
                <XCircle size={14} className="text-rose-600" /> Claim Rejected
              </span>
              <span className="text-[10px] font-semibold text-rose-900 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                Rejected By: <b>{rejectorName}</b> {rejectorCode ? `[${rejectorCode}]` : ""} {rejectorRole ? `(${rejectorRole})` : ""}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-[3px] border-l-4 border-l-rose-600 border border-rose-100 text-xs text-ink-900 font-semibold leading-relaxed">
              <span className="text-[10px] font-mono text-rose-700 uppercase block mb-1">Rejection Remark:</span>
              "{rejectionRemark || "Claim was rejected after review."}"
            </div>
          </div>
        )}

        {/* ─── APPROVAL WORKFLOW (24-HOUR TIME FORMAT) ──────────────────────── */}
        {approvals.length > 0 && (modalTab === "all" || modalTab === "audit") && (
          <div className="bg-white rounded-[4px] border border-line/80 shadow-2xs p-3.5 space-y-2">
            <SectionHeader icon={ShieldCheck} label="Approval Workflow" count={`${approvals.length} Levels`} />
            <div className="space-y-1.5">
              {approvals.map((step: any, i: number) => <ApprovalStep key={i} step={step} index={i} />)}
            </div>
          </div>
        )}

        {/* ─── FINANCIAL AUDIT LEDGER & CHANGE HISTORY ───────────────────── */}
        {(modalTab === "all" || modalTab === "audit") && (
          <div className="bg-white rounded-[4px] border border-line/80 shadow-2xs p-2.5 space-y-1.5">
            <SectionHeader icon={RotateCcw} label="Financial Audit Ledger & Change History" count={auditLogs ? `${auditLogs.length} Records` : "0 Records"} />
            
            {auditLogError ? (
              <div className="p-3 rounded-[4px] border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center justify-between gap-2 flex-wrap">
                <span>⚠️ Audit history could not be loaded ({auditLogError})</span>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="px-3 py-1 rounded-[3px] bg-white border border-amber-300 font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer text-xs"
                >
                  Retry
                </button>
              </div>
            ) : auditLogLoading ? (
              <div className="text-center py-4 text-ink-400 text-xs font-mono">
                Loading audit history...
              </div>
            ) : !auditLogs || auditLogs.length === 0 ? (
              <div className="text-center py-4 text-ink-400 text-xs">
                No manual edits or policy overrides recorded for this claim.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {auditLogs.map((log: any, idx: number) => {
                  const isDeduction = log.action_type === "POLICY_DEDUCTION";
                  const isEdit = log.action_type === "MANAGER_EDIT";
                  const isApproval = log.action_type === "APPROVED";
                  const isReturn = log.action_type === "RETURNED";
                  const badgeColor = isDeduction 
                    ? "bg-amber-100 text-amber-900 border-amber-200" 
                    : (isEdit 
                      ? "bg-indigo-100 text-indigo-900 border-indigo-200" 
                      : (isApproval 
                        ? "bg-emerald-100 text-emerald-900 border-emerald-200" 
                        : (isReturn 
                          ? "bg-orange-100 text-orange-900 border-orange-200" 
                          : "bg-surface-sunken text-ink-800 border-line")));
                  return (
                    <div key={idx} className="p-2.5 rounded-[4px] border border-line/70 bg-surface-sunken/40 flex flex-col gap-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-ink-900 flex-wrap gap-1">
                        <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {log.action_type}
                        </span>
                        <span className="text-ink-500 font-mono text-[10px]">{log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : ""}</span>
                      </div>
                      <div className="flex items-center justify-between text-ink-700 flex-wrap gap-1 text-xs">
                        <span><b>Actor:</b> {log.actor_name} ({log.actor_role})</span>
                        {log.field_name && <span><b>Field:</b> {log.field_name}</span>}
                      </div>
                      {(log.old_value !== null || log.new_value !== null) && (
                        <div className="flex items-center gap-2 font-mono text-xs text-ink-900 bg-white p-1.5 rounded-[3px] border border-line">
                          <span className="line-through text-rose-600 font-bold">Old: ₹{log.old_value || "0"}</span>
                          <span className="text-ink-300">➔</span>
                          <span className="text-emerald-700 font-bold">New: ₹{log.new_value || "0"}</span>
                        </div>
                      )}
                      {log.change_reason && (
                        <div className="text-[11px] text-ink-600 italic">
                          "{log.change_reason}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

            <ResetApprovalLevelModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        expenseId={c.id}
        expenseCode={c.expense_code || c.claim_id || `#${c.id}`}
        onSuccess={() => {
          if (onClose) onClose();
          if (typeof window !== "undefined") window.location.reload();
        }}
      />
    </Modal>

    {/* ─── ENHANCED HIGH-RESOLUTION PHOTO VIEWER & DOWNLOAD MODAL ─── */}
    {internalPhotoUrl && (
      <Modal
        open={!!internalPhotoUrl}
        footer={null}
        closable={false}
        centered
        width={820}
        wrapClassName="claim-photo-lightbox-modal"
        styles={{ body: { padding: 0, background: "rgba(10, 15, 25, 0.96)", borderRadius: "6px", overflow: "hidden" } }}
        onCancel={() => { setInternalPhotoUrl(null); setLbZoom(1); setLbRotation(0); }}
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-white/10 text-white flex-wrap gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-xs truncate max-w-[280px] sm:max-w-md">Attachment High-Res Preview</span>
              <span className="text-[10px] font-mono text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                {Math.round(lbZoom * 100)}%
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLbZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs"
                title="Zoom Out (-)"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={() => { setLbZoom(1); setLbRotation(0); }}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-[10px] font-mono"
                title="Reset Zoom"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setLbZoom((z) => Math.min(3, z + 0.25))}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs"
                title="Zoom In (+)"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => setLbRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs"
                title="Rotate 90°"
              >
                <RotateCw size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleDownloadFile(internalPhotoUrl, "claim-attachment.jpg")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                title="Download Photo"
              >
                <Download size={13} />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => { setInternalPhotoUrl(null); setLbZoom(1); setLbRotation(0); }}
                className="p-1.5 rounded bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer ml-1"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Image Preview Canvas */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[350px] max-h-[70vh] bg-black/80 select-none">
            <img
              src={internalPhotoUrl}
              alt="Preview"
              style={{
                transform: `scale(${lbZoom}) rotate(${lbRotation}deg)`,
                transition: "transform 0.2s ease-out",
                maxHeight: "65vh",
                maxWidth: "100%",
                objectFit: "contain"
              }}
              className="rounded shadow-2xl"
            />
          </div>

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10 text-white text-xs flex-wrap gap-2">
            <div className="text-[11px] text-white/50 font-mono">
              Use toolbar controls above to zoom, rotate or download
            </div>
            {displayBills.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  displayBills.forEach((b: any, bIdx: number) => {
                    const u = typeof b === "string" ? b : (b.file_url || b.url);
                    if (u) setTimeout(() => handleDownloadFile(u, b.file_name || `claim-file-${bIdx + 1}.jpg`), bIdx * 300);
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-accent-600 hover:bg-accent-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Download All Claim Photos ({displayBills.length})</span>
              </button>
            )}
          </div>
        </div>
      </Modal>
    )}
  </>
  );
};

export default ClaimDetailsModal;
