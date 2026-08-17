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
  ArrowRight, Info, Navigation, RotateCcw
} from "lucide-react";
import api from "../../services/api";

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

const MiniAmountBox = ({ label, value, subtext, color = "#4A6A8A" }: { label: string; value: string; subtext?: string; color?: string }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex-1 min-w-[80px] shadow-2xs">
    <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400 text-center leading-none mb-0.5">{label}</span>
    <span className="text-[12px] font-black leading-tight" style={{ color }}>{value}</span>
    {subtext && <span className="text-[8px] text-slate-400 font-semibold">{subtext}</span>}
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
      className="group relative rounded-lg border border-slate-200 bg-white hover:bg-slate-50/80 overflow-hidden shadow-2xs hover:border-[#4A6A8A] transition-all cursor-pointer flex items-center justify-between gap-2 p-2"
      onClick={() => isPdf ? window.open(fullUrl, "_blank") : setLightboxImage(fullUrl)}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-slate-100/90 flex items-center justify-center shrink-0 border border-slate-200/80">
          {isPdf ? (
            <FileText size={16} className="text-rose-500" />
          ) : (
            <FileText size={16} className="text-[#4A6A8A]" />
          )}
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[10.5px] font-bold text-slate-800 truncate">
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
  canEditAmounts, editedLeg, onLegAmountChange, onLegRemarkChange, routeBenchmark
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
  const validCallsInList = (act.callsList && Array.isArray(act.callsList))
    ? act.callsList.filter((c: any) => c && c.barcode && String(c.barcode).trim() !== "").length
    : 0;
  
  const calculatedDeduction = (legDeductionAmt > 0)
    ? legDeductionAmt
    : ((submittedLegAmt > netLegAmt) ? (submittedLegAmt - netLegAmt) : 0);

  const isKmEdited = origKm && parseFloat(origKm) !== parseFloat(km);
  const isTaEdited = estimatedSubmittedTa > taAmt;
  
  // DA is edited ONLY if isFirstLeg is true!
  const isDaEdited = isFirstLeg && (estimatedSubmittedDa > daAmt);

  // STRICT PER-LEG DEDUCTION CHECK: Only show if there's an explicit per-leg adjustment
  const hasLegDeduction = (calculatedDeduction > 0 || isTaEdited || isDaEdited || isKmEdited || isValidText(kmDeductionReason) || isValidText(daDeductionReason) || (isFirstLeg && isValidText(baseLocationDeductionReason)));

  // Work Metrics
  const callsClosed = validCallsInList > 0 ? validCallsInList : 0;
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
  
  const rawOtherReason = leg.other_reason || leg.other_desc || leg.local_purchase_remark || act.otherDesc || "";
  const otherReason = isValidText(rawOtherReason) ? String(rawOtherReason).trim() : "";

  // STRICT ZERO WORK CHECK: Calls badge ONLY IF callsClosed > 0!
  const hasCalls = callsClosed > 0;
  const hasPms = pmsCount > 0 || (act.pmsList && act.pmsList.length > 0) || !!act.pmsBarcode;
  const hasCalib = calibCount > 0;
  const hasMobi = mobiCount > 0;
  const hasAssetTagging = assetTagging > 0 || (act.assetsList && act.assetsList.length > 0);

  const isOtherCategory = mode.toLowerCase().includes("other") || (otherReason && !hospitalName && !equipmentName && act.pmsList.length === 0);

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
  const effectiveCallsList = act.callsList.length > 0 ? act.callsList : (
    (callsClosed > 0 || isValidText(act.callsBarcode) || isValidText(act.callsType) || isValidText(act.callsStatus)) ? [{
      barcode: act.callsBarcode || barcode || "—",
      equipment: act.equipmentName || equipmentName || "—",
      hospital: act.parsed?.calls_asset_details?.hospital_name || act.hospitalName || hospitalName || "—",
      call_type: act.callsType || "Service Call",
      status: act.callsStatus || "Attended & Closed",
      attachment_url: act.attachmentUrl || travelTaBillUrl || ""
    }] : []
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2">
      {/* Leg Header */}
      <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-[#4A6A8A] text-white flex items-center justify-center text-[9.5px] font-extrabold shrink-0">
            #{legNum}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800">
            <span>{fromDist}</span>
            <ArrowRight size={10} className="text-slate-400" />
            <span>{toDist}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <ModeChip mode={mode} />
          {subMode && <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Sub: {subMode}</span>}
          {km > 0 && (
            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border ${isKmEdited ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
              {km} km (@ ₹{ratePerKm}/km) {isKmEdited ? `(Orig: ${origKm}km)` : ""}
            </span>
          )}
          {submittedLegAmt > netLegAmt && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
              Claimed: {rupee(submittedLegAmt)}
            </span>
          )}
          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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
      <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200 flex flex-wrap gap-1 items-center justify-between text-[9.5px]">
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
        <div className="bg-rose-50/90 p-2.5 rounded-lg border border-rose-200 space-y-1.5 text-[9.5px]">
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
        </div>
      )}

      {/* IF REASON IS OTHER: ONLY RENDER THE CLEAN OTHER REASON BOX AND NOTHING ELSE! */}
      {isOtherCategory && otherReason ? (
        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-950 font-semibold text-[10.5px] flex items-center gap-2">
          <Info size={14} className="text-amber-700 shrink-0" />
          <div>
            <span className="text-amber-800 font-bold block text-[9px] uppercase">Reason for Other Mode / Category:</span>
            <span className="text-slate-900 font-bold">{otherReason}</span>
          </div>
        </div>
      ) : (
        <>
          {/* HOSPITAL & EQUIPMENT DETAILS BOX (ONLY IF HOSPITAL NAME OR EQUIPMENT NAME EXISTS) */}
          {(hospitalName || equipmentName || barcode) && (
            <div className="bg-slate-50 p-2 rounded border border-slate-200/80 space-y-1 text-[10px]">
              {hospitalName && (
                <div className="font-bold text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-emerald-800 font-extrabold"><Building2 size={11} /> {hospitalName}</span>
                  {travelTaBillUrl && (
                    <button
                      onClick={() => setLightboxImage(travelTaBillUrl)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#4A6A8A] text-white text-[8.5px] font-bold hover:bg-[#3b546e] transition-colors"
                    >
                      <Eye size={10} /> View Photo
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 pt-0.5 text-[9.5px]">
                {equipmentName && <div><b className="text-slate-500 uppercase text-[8.5px]">Equipment:</b> <span className="font-bold text-slate-900">{equipmentName}</span></div>}
                {equipmentModel && <div><b className="text-slate-500 uppercase text-[8.5px]">Model:</b> <span className="font-semibold text-slate-800">{equipmentModel}</span></div>}
                {barcode && <div><b className="text-slate-500 uppercase text-[8.5px]">Barcode:</b> <span className="font-mono font-bold text-[#4A6A8A]">{barcode}</span></div>}
                {schedule && <div><b className="text-slate-500 uppercase text-[8.5px]">Schedule:</b> <span className="font-bold text-emerald-700">{schedule}</span></div>}
                {department && <div><b className="text-slate-500 uppercase text-[8.5px]">Department:</b> <span className="font-semibold text-slate-800">{department}</span></div>}
              </div>
            </div>
          )}

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

              <div className="overflow-x-auto border border-blue-200 rounded-lg shadow-2xs">
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
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-700 text-white text-[8px] font-bold hover:bg-amber-800 transition-colors"
                                >
                                  <Eye size={9} /> Old Spare
                                </button>
                              )}
                              {fullNewSpareUrl && (
                                <button
                                  onClick={() => setLightboxImage(fullNewSpareUrl)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[8px] font-bold hover:bg-emerald-800 transition-colors"
                                >
                                  <Eye size={9} /> New Spare
                                </button>
                              )}
                              {!fullCUrl && !fullOldSpareUrl && !fullNewSpareUrl && "—"}
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

              <div className="overflow-x-auto border border-emerald-200 rounded-lg shadow-2xs">
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
          {(purpose || otherReason) && (
            <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-1 text-[10px]">
              {purpose && <div><b className="text-slate-500">Purpose / Details:</b> <span className="text-slate-700 font-medium">{purpose}</span></div>}
              {otherReason && <div className="bg-amber-50 p-1.5 rounded border border-amber-200 text-amber-900 font-medium"><b className="text-amber-800">Reason for Other Mode / Category:</b> {otherReason}</div>}
            </div>
          )}
        </>
      )}

      {/* HISTORICAL MINIMUM ROUTE BENCHMARK AUDIT CARD (APPROVER ONLY MATCH POPUP) */}
      {routeBenchmark && (routeBenchmark.global || routeBenchmark.min_travel_amount) && (
        (() => {
          const globalObj = routeBenchmark.global || routeBenchmark;
          const sameUserObj = routeBenchmark.sameUser;
          const curAmt = parseFloat(String(taAmt)) || 0;

          return (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-2.5 mt-2 space-y-2 shadow-xs select-none">
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
        <div className="bg-[#4A6A8A]/10 p-2.5 rounded-lg border-2 border-[#4A6A8A]/30 mt-2 space-y-2 select-none">
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
    <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${bg}`}>
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
  comments: string;
  setComments: (v: string) => void;
  actionLoading: boolean;
  loadingDetails?: boolean;
  handleApprove: () => void;
  handleReject: () => void;
  handleReturn?: () => void;
  handleDeleteClaim: (id: number) => void;
  onClose: () => void;
  navigate: (path: string) => void;
  setLightboxImage: (url: string) => void;
  getStatusBadgeClass: (status: string, record?: any) => string;
  getStatusLabel: (status: string, record?: any) => string;
  sourceMode?: "approval" | "expense" | "home";
  editedLegs?: any[];
  onLegAmountChange?: (index: number, field: string, value: string | number) => void;
  onLegRemarkChange?: (index: number, field: string, remark: string) => void;
}

const ClaimDetailsModal: React.FC<ClaimDetailsModalProps> = ({
  open, claimDetails, user,
  comments, setComments, actionLoading, loadingDetails, handleApprove, handleReject, handleReturn,
  handleDeleteClaim, onClose, navigate, setLightboxImage,
  getStatusBadgeClass, getStatusLabel, sourceMode,
  editedLegs, onLegAmountChange, onLegRemarkChange
}) => {
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
          <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="h-4 w-56 bg-slate-300 rounded"></div>
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-4 w-28 bg-slate-300 rounded"></div>
          </div>

          {/* Leg Breakdown Cards Skeleton */}
          <div className="space-y-3">
            {[1, 2].map((idx) => (
              <div key={idx} className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-3 shadow-2xs">
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
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="h-3 w-32 bg-slate-300 rounded"></div>
            <div className="flex gap-3">
              <div className="w-20 h-20 bg-slate-200 rounded-lg"></div>
              <div className="w-20 h-20 bg-slate-200 rounded-lg"></div>
              <div className="w-20 h-20 bg-slate-200 rounded-lg"></div>
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
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!claimDetails) {
      setAuditLogs([]);
      return;
    }
    const expId = claimDetails.expense_code || claimDetails.id || claimDetails.expense_id || claimDetails.exp_id;
    if (expId) {
      api.get(`/expense/${encodeURIComponent(expId)}/audit-trail`)
        .then(res => {
          if (res.data && Array.isArray(res.data.audit_logs)) {
            setAuditLogs(res.data.audit_logs);
          }
        })
        .catch(() => {});
    }
  }, [claimDetails]);

  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showReturnBox, setShowReturnBox] = useState(false);
  const [barcodeMap, setBarcodeMap] = useState<Record<string, { equipment: string; hospital: string }>>({});
  const [userAllowance, setUserAllowance] = useState<any>(null);
  const [routeBenchmarks, setRouteBenchmarks] = useState<Record<number, any>>({});

  useEffect(() => {
    if (!open || !claimDetails) return;
    const itineraries = Array.isArray(claimDetails.itineraries) && claimDetails.itineraries.length > 0
      ? claimDetails.itineraries
      : (Array.isArray(claimDetails.legs) ? claimDetails.legs : []);

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

  // INSTANT PHOTO PREFETCHER INTO BROWSER MEMORY (0ms DELAY WHEN CLICKING VIEW PHOTO / VIEW BILL)
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

    const itineraries = Array.isArray(claimDetails.itineraries) && claimDetails.itineraries.length > 0
      ? claimDetails.itineraries
      : (Array.isArray(claimDetails.legs) ? claimDetails.legs : []);

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

  // Dynamic Allowance Master Grade Rates Fetcher
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

  // Auto-resolve missing barcode details via backend asset API
  useEffect(() => {
    if (!claimDetails) return;
    const itineraries = Array.isArray(claimDetails.itineraries) && claimDetails.itineraries.length > 0
      ? claimDetails.itineraries
      : (Array.isArray(claimDetails.legs) ? claimDetails.legs : []);

    const barcodesToFetch: string[] = [];

    itineraries.forEach((leg: any) => {
      const act = parseActivityDetails(leg.activity_details || leg.activity || leg.meta);
      
      // PMS barcodes
      act.pmsList.forEach((pItem: any) => {
        const code = pItem.barcode || pItem.pms_barcode || pItem.code || pItem.serial_no || pItem.asset_barcode;
        const eq = pItem.equipment || pItem.equipment_name || pItem.asset_name || act.equipmentName || leg.equipment_name;
        const hosp = pItem.hospital || pItem.hospital_name || pItem.facility_name || act.hospitalName || leg.hospital_name;
        if (code && code !== "—" && (!isValidText(eq) || !isValidText(hosp)) && !barcodeMap[code]) {
          if (!barcodesToFetch.includes(code)) barcodesToFetch.push(code);
        }
      });

      // Calls barcodes
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
  const isCoordinator = roleLower.includes("coordinator") || roleLower === "admin";
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
  const itineraries = (Array.isArray(c.itineraries) && c.itineraries.length > 0)
    ? c.itineraries
    : ((Array.isArray(c.legs) && c.legs.length > 0)
        ? c.legs
        : ((Array.isArray(c.itinerary_list) && c.itinerary_list.length > 0)
            ? c.itinerary_list
            : ((Array.isArray(editedLegs) && editedLegs.length > 0)
                ? editedLegs
                : (Array.isArray(c.itinerary) ? c.itinerary : []))));

  const rejectorName = rejectedStep?.approver_name || rejectedStep?.approver || c.rejected_by_name || c.rejector_name || c.rejected_by || "Manager / Coordinator";
  const rejectorCode = rejectedStep?.approver_code || c.rejector_code || "";
  const rejectorRole = rejectedStep?.approver_role || rejectedStep?.approver_designation || c.rejector_role || "";

  const rejectionRemark = rejectedStep?.remark || c.rejection_reason || c.rejection_remark || c.deduction_remark || c.approver_remark || c.remark || "";

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
    <Modal
      open={open}
      onCancel={onClose}
      centered={true}
      width={860}
      destroyOnClose
      closeIcon={false}
      className="claim-details-compact-modal"
      wrapClassName="my-claims-modal-wrap"
      maskStyle={{ backdropFilter: "blur(3px)", background: "rgba(15, 23, 42, 0.5)" }}
      bodyStyle={{ padding: 0, background: "#f8fafc", maxHeight: "82vh", overflowY: "auto" }}
      styles={{
        header: { display: "none" },
        footer: { borderTop: "1px solid #e2e8f0", padding: "8px 12px", background: "#ffffff", margin: 0 },
      }}
      footer={
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isEditable && (
              <button
                onClick={() => { onClose(); navigate(`/submit-expense?edit=${c.id}`); }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Pencil size={10} /> Edit
              </button>
            )}
            {isDeletable && (
              <button
                onClick={() => {
                  onClose();
                  handleDeleteClaim(c.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Trash2 size={10} /> Delete
              </button>
            )}
            {canApprove && !showRejectBox && !showReturnBox && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3.5 py-1 rounded text-[10.5px] font-bold bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={10} /> {actionLoading ? "Processing…" : "Approve"}
                </button>
                <button
                  onClick={() => { setShowRejectBox(true); setShowReturnBox(false); }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <XCircle size={10} /> Reject
                </button>
                {isCoordinator && (
                  <button
                    onClick={() => { setShowReturnBox(true); setShowRejectBox(false); }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-bold bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={10} /> Return
                  </button>
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
                  className="text-[10.5px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-[#4A6A8A] min-w-[180px]"
                />
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !comments.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <XCircle size={10} /> Confirm Reject
                </button>
                <button
                  onClick={() => { setShowRejectBox(false); setComments(""); }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-1 cursor-pointer"
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
                  className="text-[10.5px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-[#4A6A8A] min-w-[180px]"
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw size={10} /> Confirm Return
                </button>
                <button
                  onClick={() => { setShowReturnBox(false); setComments(""); }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <X size={10} /> Close
          </button>
        </div>
      }
    >
      {/* ─── MODAL HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1 h-6 rounded-full shrink-0 ${isOutOfState ? "bg-purple-600" : (isOutDistrict ? "bg-orange-500" : "bg-[#4A6A8A]")}`} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-extrabold font-mono tracking-tight ${isOutOfState ? "text-purple-700" : (isOutDistrict ? "text-orange-600" : "text-[#4A6A8A]")}`}>
              {c.expense_code || c.claim_id || `#${c.id}`}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
              isOutOfState
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : (isOutDistrict ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-blue-50 text-blue-600 border-blue-200")
            }`}>
              {isOutOfState ? "Out of State" : (isOutDistrict ? "Out-District" : "In-District")}
            </span>
            {c.hasMismatch && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-200">
                ⚠️ Mismatch
              </span>
            )}
            <StatusBadge status={c.status} record={c} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-3 py-3 space-y-3">

        {/* ─── HEADER DATA STRIP ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {/* Card 1: Identity */}
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[8.5px] font-bold uppercase tracking-wider">
              <FileText size={10} className="text-[#4A6A8A]" /> Claim Identity
            </div>
            <div className="text-[11.5px] font-extrabold text-[#4A6A8A] font-mono truncate">
              {c.expense_code || c.claim_id || `#${c.id}`}
            </div>
            <div className="text-[9px] text-slate-500 font-semibold truncate flex items-center gap-1 flex-wrap">
              <span>Category: <b className="text-slate-800">{c.category || c.travel_mode || "Auto"}</b></span>
              {modesList.map((m: string, idx: number) => <ModeChip key={idx} mode={m} />)}
            </div>
          </div>

          {/* Card 2: Submitter */}
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[8.5px] font-bold uppercase tracking-wider">
              <User size={10} className="text-indigo-600" /> Submitted By
            </div>
            <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
              {c.submitter_name || c.employeeName || c.name || c.user_name || "Engineer"}
            </div>
            <div className="text-[9px] text-slate-500 font-medium truncate">
              {(c.submitter_code || c.eCode || c.user_id) && <span className="font-mono text-slate-600 mr-1">[{c.submitter_code || c.eCode || c.user_id}]</span>}
              {c.designation || c.submitter_designation || c.user_role || ""}
            </div>
          </div>

          {/* Card 3: Mapped Zone & District */}
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[8.5px] font-bold uppercase tracking-wider">
              <Building2 size={10} className="text-emerald-600" /> Mapped Zone & District
            </div>
            <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
              {zoneVal ? `Zone ${zoneVal}` : (homeDistVal ? `${homeDistVal} Zone` : "Rajasthan Zone")}
            </div>
            <div className="text-[9px] text-slate-500 font-medium truncate">
              Home: <b>{homeDistVal || c.district || c.submitter_district || "Base District"}</b>
            </div>
          </div>

          {/* Card 4: Timing (24-HOUR FORMAT) */}
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[8.5px] font-bold uppercase tracking-wider">
              <Calendar size={10} className="text-amber-600" /> Claim Date (24H)
            </div>
            <div className="text-[11.5px] font-extrabold text-slate-800 truncate">
              {formatDateDDMMMYY(c.date || c.itinerary)}
            </div>
            <div className="text-[8.5px] text-slate-400 truncate font-mono">
              {formatDateTime24(c.created_at || c.submitted_at)}
            </div>
          </div>
        </div>

        {/* ─── FINANCIAL / QUOTA SUMMARY CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {isLimitRequest ? (
            <>
              <MiniAmountBox label="Requested Extension" value={formattedRequestedLimit} color="#4A6A8A" />
              <MiniAmountBox
                label="Approved Extension"
                value={formattedApprovedLimit}
                color={isApproved ? "#10b981" : (isClaimRejected ? "#dc2626" : "#f59e0b")}
              />
              <MiniAmountBox label="Reimbursable Cash" value="₹0" subtext="Quota Extension" color="#64748b" />
              <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs space-y-0.5">
                <div className="text-slate-400 text-[8.5px] font-bold uppercase tracking-wider">Request Status</div>
                <div className="pt-0.5">
                  <StatusBadge status={c.status} record={c} getStatusBadgeClass={getStatusBadgeClass} getStatusLabel={getStatusLabel} />
                </div>
              </div>
            </>
          ) : (
            <>
              <MiniAmountBox label="Total Claimed" value={rupee(originalClaimedTotal)} color="#4A6A8A" />
              <MiniAmountBox
                label={isApproved ? "Approved Net" : (isClaimRejected ? "Approved Net" : (liveEditedTotalSum !== null ? "Live Net After Edit" : "Estimated Net"))}
                value={isClaimRejected ? "₹0" : rupee(currentApprovedNet)}
                color={isApproved ? "#10b981" : (isClaimRejected ? "#dc2626" : "#059669")}
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
          <div className="bg-white border-2 border-[#4A6A8A]/30 rounded-lg p-3 space-y-2.5 shadow-2xs">
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
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10.5px]">
              <div className="font-bold text-slate-500 uppercase text-[9px] mb-0.5">Employee Purpose / Justification</div>
              <div className="text-slate-800 font-medium">{cleanPurpose || c.purpose || c.description || "Request additional limit extension."}</div>
            </div>

            {/* Manager Decision Remarks */}
            {(rejectionRemark || c.approver_remark || c.manager_remark || c.comments || (approvals.length > 0 && approvals[0]?.comments)) && (
              <div className={`p-2.5 rounded-lg border text-[10.5px] ${isClaimRejected ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
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
        {!isLimitRequest && itineraries.length > 0 && (
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
                  setLightboxImage={setLightboxImage}
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
                />
              ))}
            </div>
          </div>
        )}



        {/* ─── ATTACHMENTS & BILL INVOICES GALLERY ──────────────────────────── */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-2.5">
          <SectionHeader icon={Package} label="Attachments & Invoices" count={attachments.length} />
          {attachments.length === 0 ? (
            <div className="text-center py-3 text-[10px] text-slate-400">
              No bills uploaded for this claim
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
              {attachments.map((att: any, i: number) => (
                <AttachmentCard
                  key={i}
                  att={att}
                  index={i}
                  setLightboxImage={setLightboxImage}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── DEDUCTIONS & POLICY REMARKS (FULL CONSOLIDATED AUDIT CARD) ─── */}
        {!isLimitRequest && hasOverallDeduction && !isClaimRejected && (
          <div className="bg-white rounded-lg border-2 border-rose-200 shadow-2xs p-2.5 space-y-2 text-[10.5px]">
            <SectionHeader icon={AlertTriangle} label="Deductions & Policy Audit Details" accent="#ef4444" />
            
            {/* Summary Line */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-800 flex-wrap">
                <span>Deduction Audit Details:</span>
                <span className="font-semibold text-slate-600">Claimed: <b>{rupee(originalClaimedTotal)}</b></span>
                <span className="text-slate-400">➔</span>
                <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Approved Net: {rupee(currentApprovedNet)}
                </span>
              </div>
              <div className="font-mono text-[10.5px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Total Deduction: -{rupee(totalCombinedDeduction)}
              </div>
            </div>

            {/* Individual Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Base Location Deduction Card */}
              {systemDeductionAmt > 0 && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between font-extrabold text-amber-950 text-[10.5px]">
                    <span className="flex items-center gap-1.5">📍 Base Location Deduction</span>
                    <span className="font-mono text-amber-900 font-black">-{rupee(systemDeductionAmt)}</span>
                  </div>
                  <div className="text-[9.5px] text-amber-900 leading-tight">
                    <b className="text-amber-950">Deducted By:</b> System Rule Engine
                  </div>
                  <div className="text-[9.5px] text-amber-900 leading-normal bg-white p-1.5 rounded border border-amber-200 mt-1">
                    <b className="text-amber-950 block mb-0.5">Exact Reason / Rule:</b>
                    <span className="text-slate-900 font-semibold">
                      Base Location Deduction
                    </span>
                  </div>
                </div>
              )}

              {/* Coordinator / Manager Manual Deduction Card */}
              {managerDeductionAmt > 0 && (
                <div className="bg-rose-50/90 border border-rose-300 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between font-extrabold text-rose-950 text-[10.5px]">
                    <span className="flex items-center gap-1.5">
                      {isClaimRejected ? "🚫 Claim Rejection" : `✏️ ${managerDeductorRole || "Coordinator / Manager"} Manual Deduction`}
                    </span>
                    <span className="font-mono text-rose-900 font-black">-{rupee(managerDeductionAmt)}</span>
                  </div>
                  <div className="text-[9.5px] text-rose-900 leading-tight">
                    <b className="text-rose-950">{isClaimRejected ? "Rejected By:" : "Deducted By:"}</b>{" "}
                    <span className="font-extrabold text-slate-900">{managerDeductorName}</span>{" "}
                    {managerDeductorRole ? <span className="font-bold text-indigo-900 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200 text-[9px]">({managerDeductorRole})</span> : ""}
                    {managerDeductorCode ? <span className="font-mono text-slate-500 font-bold text-[9px]"> [{managerDeductorCode}]</span> : ""}
                  </div>
                  <div className="text-[9.5px] text-rose-900 leading-normal bg-white p-1.5 rounded border border-rose-200 mt-1">
                    <b className="text-rose-950 block mb-0.5">Exact Remarks:</b>
                    <span className="text-slate-900 font-semibold">
                      "{rejectionRemark || finalManagerReason || "Manual deduction applied during approval review."}"
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ULTRA-COMPACT REJECTION BANNER & POLICY NOTICE ─── */}
        {isClaimRejected && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-2 space-y-1.5">
            {/* Header & Rejector Info */}
            <div className="flex items-center justify-between border-b border-rose-200/60 pb-1 flex-wrap gap-1">
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center font-extrabold text-[8.5px]">
                  ✕
                </div>
                <span className="text-[10px] font-extrabold text-rose-900 uppercase tracking-tight">
                  Expense Claim Rejected
                </span>
              </div>
              <div className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 text-[9px] font-bold border border-rose-200/80">
                Rejected By: <b>{rejectorName}</b> {rejectorCode ? `[${rejectorCode}]` : ""} {rejectorRole ? `(${rejectorRole})` : ""}
              </div>
            </div>

            {/* Rejection Remark - EXACT TITLE REQUESTED: Rejection Remark: */}
            {rejectionRemark && (
              <div className="bg-white px-2 py-1 rounded border-l-3 border-rose-500 border-y border-r border-rose-200/60 text-[10px] text-slate-800">
                <span className="text-rose-800 font-extrabold text-[8.5px] uppercase tracking-wider block">
                  👤 Rejection Remark:
                </span>
                <div className="text-slate-900 font-semibold leading-snug">
                  "{rejectionRemark}"
                </div>
              </div>
            )}

            {/* Ultra-Compact English Policy Notice */}
            <div className="text-[9px] text-slate-700 font-medium flex items-center gap-1 bg-rose-100/50 px-2 py-0.5 rounded border border-rose-200/50">
              <AlertTriangle size={11} className="text-rose-600 shrink-0" />
              <span>
                <b>Policy Notice:</b> Expense claim for <b>{formatDateDDMMMYY(c.date || c.itinerary)}</b> was rejected. No re-submission or reimbursement is allowed for this date.
              </span>
            </div>
          </div>
        )}

        {/* ─── APPROVAL WORKFLOW (24-HOUR TIME FORMAT) ──────────────────────── */}
        {approvals.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-2.5">
            <SectionHeader icon={ShieldCheck} label="Approval Workflow" count={`${approvals.length} Levels`} />
            <div className="space-y-1.5">
              {approvals.map((step: any, i: number) => <ApprovalStep key={i} step={step} index={i} />)}
            </div>
          </div>
        )}

        {/* ─── FINANCIAL AUDIT LEDGER & CHANGE HISTORY ───────────────────── */}
        {auditLogs && auditLogs.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-2.5 space-y-2">
            <SectionHeader icon={RotateCcw} label="Financial Audit Ledger & Change History" count={`${auditLogs.length} Records`} />
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {auditLogs.map((log: any, idx: number) => {
                const isDeduction = log.action_type === "POLICY_DEDUCTION";
                const isEdit = log.action_type === "MANAGER_EDIT";
                const isApproval = log.action_type === "APPROVED";
                const badgeColor = isDeduction ? "bg-amber-100 text-amber-900 border-amber-300" : (isEdit ? "bg-indigo-100 text-indigo-900 border-indigo-300" : (isApproval ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-slate-100 text-slate-800 border-slate-300"));
                return (
                  <div key={idx} className="p-2 rounded border border-slate-200 bg-slate-50/50 flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center justify-between font-bold text-slate-800 flex-wrap gap-1">
                      <span className={`px-1.5 py-0.2 rounded border text-[9px] font-extrabold uppercase ${badgeColor}`}>
                        {log.action_type}
                      </span>
                      <span className="text-slate-500 font-mono text-[9.5px]">{log.created_at ? new Date(log.created_at).toLocaleString("en-IN") : ""}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 flex-wrap gap-1">
                      <span><b>Actor:</b> {log.actor_name} ({log.actor_role})</span>
                      {log.field_name && <span><b>Field:</b> {log.field_name}</span>}
                    </div>
                    {(log.old_value !== null || log.new_value !== null) && (
                      <div className="flex items-center gap-2 font-mono text-[9.5px] text-slate-900 bg-white p-1 rounded border border-slate-200">
                        <span className="line-through text-rose-600 font-bold">Old: ₹{log.old_value || "0"}</span>
                        <span>➔</span>
                        <span className="text-emerald-700 font-bold">New: ₹{log.new_value || "0"}</span>
                      </div>
                    )}
                    {log.change_reason && (
                      <div className="text-[9.5px] text-slate-600 italic">
                        "{log.change_reason}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};

export default ClaimDetailsModal;
