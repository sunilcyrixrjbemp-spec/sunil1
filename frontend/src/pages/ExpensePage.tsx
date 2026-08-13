import React, { useEffect, useState, useRef } from "react";
import { formatToIST } from "../utils/timezone";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import DistrictBadge, { computeDistrictType } from "../components/common/DistrictBadge";
import { expenseService } from "../services/expenseService";
import { uploadService } from "../services/uploadService";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { prefetchManager } from "../utils/prefetchManager";
import { checkIsPdf } from "../utils/pdf";
import { getISTDate, getISTMonth } from "../utils/dateUtils";
import { ALL_INDIAN_STATES, getDistrictsForState } from "../utils/indianStatesDistricts";
import ClaimDetailsModal, { formatImageUrl } from "../components/common/ClaimDetailsModal";
import { 
  Trash2, Plus, Calendar, 
  AlertTriangle, Check, Loader2,
  TrendingUp,
  Zap,
  Info,
  MapPin,
  User,
  Users,
  FileText,
  Navigation,
  Camera,
  ShieldCheck,
  Car,
  Bike,
  Search
} from "lucide-react";
import api from "../services/api";
import { 
  DatePicker, ConfigProvider, Modal, Button, Tag, Space, Card, Pagination 
} from "antd";
import { 
  EditOutlined, CloseCircleOutlined, FileTextOutlined 
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";

const DEFAULT_WORKER_URL = "https://fieldops-api.sunilbishnoi.workers.dev";
const rawBase = (api.defaults.baseURL || "").replace(/\/api$/, "");
const API_BASE = (rawBase && rawBase.startsWith("http") && !rawBase.includes("indrae.in")) ? rawBase : DEFAULT_WORKER_URL;

const renderAntdStatusTag = (status: string) => {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "approved":
      return <Tag color="success" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Approved</Tag>;
    case "rejected":
      return <Tag color="error" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Rejected</Tag>;
    case "submitted":
    case "pending":
      return <Tag color="processing" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Pending</Tag>;
    case "returned_to_draft":
    case "returned":
      return <Tag color="warning" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Returned to Draft</Tag>;
    default:
      return <Tag className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">{status || "Draft"}</Tag>;
  }
};

const formatToDDMMYYYY = (dateStr: any): string => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const clean = dateStr.trim();
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, "0");
    const dd = ymdMatch[3].padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  return clean;
};

const getCardStatusClass = (status: string) => {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("approve") || s.includes("approved")) {
    return "border border-emerald-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(16,185,129,0.3),0_2px_4px_-2px_rgba(16,185,129,0.3)]";
  }
  if (s.includes("reject") || s.includes("rejected")) {
    return "border border-rose-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(239,68,68,0.3),0_2px_4px_-2px_rgba(239,68,68,0.3)]";
  }
  if (s.includes("pending") || s.includes("submitted") || s.includes("return")) {
    return "border border-amber-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(245,158,11,0.3),0_2px_4px_-2px_rgba(245,158,11,0.3)]";
  }
  return "border border-slate-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors shadow-sm sharp-card";
};

const getAttachmentsArray = (attachments: any): string[] => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments.filter(Boolean);
  if (typeof attachments === "string") {
    const trimmed = attachments.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("\"[")) {
      try {
        let parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean);
        }
      } catch (e) {
        console.warn("Failed to parse attachments JSON string:", trimmed, e);
      }
    }
    if (trimmed.includes(",")) {
      return trimmed.split(",").map(x => x.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
};

interface ItineraryLeg {
  company_provided?: boolean;
  leg: number;
  travel_type: "In-District" | "Outdoor" | "Out of State";
  district_from: string;
  district: string;
  state?: string;
  dest_state?: string;
  from: string;
  to: string;
  mode: string;
  km: string;
  amount: string;
  sub_mode: string;
  sub_km: string;
  sub_amount: string;
  da: string; // Leg 1 only
  hotel: string; // Leg 1 only
  local_purchase: string; // Leg 1 only
  local_purchase_remark?: string; // Leg 1 only
  oth_desc: string;
  oth_amount: string;
  ws_assigned: string;
  ws_closed: string;
  ws_pms: string;
  ws_asset: string;
  visit_purpose: string;
  show_sub_leg?: boolean;
  from_custom?: boolean;
  to_custom?: boolean;
  activity_details?: string;
  selected_activities?: string[];
  calls_barcode?: string;
  calls_verified?: boolean;
  calls_asset_details?: any;
  calls_type?: string;
  calls_status?: string;
  calls_photo_url?: string;
  calls_photo_name?: string;
  calls_photo_loading?: boolean;
  pms_barcode?: string;
  pms_verified?: boolean;
  pms_asset_details?: any;
  pms_frequency?: string;
  pms_photo_url?: string;
  pms_photo_name?: string;
  pms_photo_loading?: boolean;
  asset_tagging_equipment?: string;
  asset_tagging_quantity?: string;
  mobilise_asset_count?: string;
  calibration_count?: string;
  activity_other_desc?: string;
  calls_complaint_id?: string;
  calls_hospital?: string;
  calls_action_taken?: string;
  calls_spare_replaced?: string;
  calls_spare_name?: string;
  calls_spare_estimated_value?: string | number;
  calls_old_spare_photo?: string;
  calls_new_spare_photo?: string;
  calls_old_spare_loading?: boolean;
  calls_new_spare_loading?: boolean;
  asset_tagging_suffix?: string;
  asset_tagging_barcode?: string;
  asset_tagging_hospital?: string;
  asset_tagging_make?: string;
  asset_tagging_model?: string;
  asset_tagging_serial?: string;
  asset_tagging_has_warranty?: string;
  asset_tagging_warranty_start?: string;
  asset_tagging_warranty_end?: string;
  asset_tagging_barcode_photo?: string;
  asset_tagging_serial_photo?: string;
  asset_tagging_model_photo?: string;
  asset_barcode_photo_loading?: boolean;
  asset_serial_photo_loading?: boolean;
  asset_model_photo_loading?: boolean;
  calls_list?: Array<{
    barcode: string;
    complaint_id?: string;
    hospital_name?: string;
    action_taken?: string;
    verified: boolean;
    type: string;
    status: string;
    spare_replaced?: string;
    spare_estimated_value?: number;
    asset_details: any;
    photo_url?: string;
    old_spare_photo?: string;
    new_spare_photo?: string;
  }>;
  pms_list?: Array<{
    barcode: string;
    verified: boolean;
    frequency: string;
    asset_details: any;
    photo_url?: string;
  }>;
  assets_list?: Array<{
    equipment_name: string;
    barcode?: string;
    suffix?: string;
    hospital_name?: string;
    make?: string;
    model?: string;
    serial_number?: string;
    has_warranty?: string;
    warranty_start?: string;
    warranty_end?: string;
    barcode_photo?: string;
    serial_photo?: string;
    model_photo?: string;
    quantity?: string;
  }>;
}

interface LegFiles {
  main_bill: File | null;
  sub_bill: File | null;
  comm_mail: File | null;
  oth_bill: File | null;
  hotel_bill?: File | null; // Leg 1 only
  local_purchase_bill?: File | null; // Leg 1 only
}

export default function ExpensePage() {
  const navigate = useNavigate();
  const getProgressPercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  // Pre-calculate user context ONCE to avoid 17 redundant localStorage parses
  const { parsedUser, currentUserId, isCalibrationUser } = React.useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return {
        parsedUser: u,
        currentUserId: (u.user_id || "Admin").trim(),
        isCalibrationUser: (u.designation || "").toLowerCase().includes("calibration")
      };
    } catch (e) {
      return { parsedUser: {}, currentUserId: "Admin", isCalibrationUser: false };
    }
  }, []);

  // Date State (Strictly IST Asia/Kolkata timezone)
  const [date, setDate] = useState(() => getISTDate());

  // Init default helpers
  const createDefaultLeg = (num: number): ItineraryLeg => {
    return {
      company_provided: false,
      leg: num,
      travel_type: "In-District",
      district_from: "",
      district: "",
      state: "Rajasthan",
      dest_state: "Rajasthan",
      from: "",
      to: "",
      mode: "",
      km: "",
      amount: "",
      sub_mode: "",
      sub_km: "",
      sub_amount: "",
      da: "",
      hotel: "",
      local_purchase: "",
      local_purchase_remark: "",
      oth_desc: "",
      oth_amount: "",
      ws_assigned: "",
      ws_closed: "",
      ws_pms: "",
      ws_asset: "",
      visit_purpose: "",
      show_sub_leg: false,
      activity_details: "",
      selected_activities: isCalibrationUser ? ["Calibration"] : [],
      calls_barcode: "",
      calls_verified: false,
      calls_asset_details: null,
      calls_type: "Support Call",
      calls_status: "Attend",
      pms_barcode: "",
      pms_verified: false,
      pms_asset_details: null,
      pms_frequency: "3 month",
      asset_tagging_equipment: "",
      asset_tagging_quantity: "",
      mobilise_asset_count: "",
      calibration_count: "",
      activity_other_desc: "",
      calls_list: [],
      pms_list: [],
      assets_list: []
    };
  };

  const createDefaultFiles = (): LegFiles => ({
    main_bill: null,
    sub_bill: null,
    comm_mail: null,
    oth_bill: null,
    hotel_bill: null,
  });

  const resetForm = () => {
    setItineraries([createDefaultLeg(1)]);
    setFiles({ 1: createDefaultFiles() });
    setDate(new Date().toLocaleDateString('sv'));
    setHasShownExceededModal(false);
    setEditExpenseId(null);
    setExistingAttachments([]);
    setExistingAttachmentsDetailed([]);
    setDeletedAttachments([]);
    
    // Clear URL query parameters from browser address bar silently
    if (window.location.search.includes("edit")) {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const validatedItinerariesRef = useRef<ItineraryLeg[] | null>(null);

  const [itineraries, setItineraries] = useState<ItineraryLeg[]>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    let homeDistrict = "Jodhpur";
    if (parsedUser && Object.keys(parsedUser).length > 0) {
      homeDistrict = parsedUser.district || parsedUser.home_district || "Jodhpur";
    } else if (cached) {
      try {
        const parsed = JSON.parse(cached).user || {};
        homeDistrict = parsed.district || parsed.home_district || "Jodhpur";
      } catch (e) {}
    }
    
    const leg: ItineraryLeg = {
      company_provided: false,
      leg: 1,
      travel_type: "In-District",
      district_from: homeDistrict,
      district: homeDistrict,
      from: "",
      to: "",
      mode: "",
      km: "",
      amount: "",
      sub_mode: "",
      sub_km: "",
      sub_amount: "",
      da: "",
      hotel: "",
      local_purchase: "",
      local_purchase_remark: "",
      oth_desc: "",
      oth_amount: "",
      ws_assigned: "",
      ws_closed: "",
      ws_pms: "",
      ws_asset: "",
      visit_purpose: "Field visit",
      show_sub_leg: false,
      activity_details: "",
      selected_activities: isCalibrationUser ? ["Calibration"] : [],
      calls_barcode: "",
      calls_verified: false,
      calls_asset_details: null,
      calls_type: "Support Call",
      calls_status: "Attend",
      pms_barcode: "",
      pms_verified: false,
      pms_asset_details: null,
      pms_frequency: "3 month",
      asset_tagging_equipment: "",
      asset_tagging_quantity: "",
      mobilise_asset_count: "",
      calibration_count: "",
      activity_other_desc: "",
      calls_list: [],
      pms_list: [],
      assets_list: []
    };
    return [leg];
  });
  const [files, setFiles] = useState<Record<number, LegFiles>>({ 1: createDefaultFiles() });

  // Camera Capture Modal States
  const [activeCameraTarget, setActiveCameraTarget] = useState<{ legNum: number; key: keyof LegFiles } | null>(null);
  const [activeActivityCameraTarget, setActiveActivityCameraTarget] = useState<{ legNum: number; activityType: "Calls" | "PMS" } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Camera helper triggers removed (camera modal preserved if needed, but not triggered)

  useEffect(() => {
    if (!activeCameraTarget && !activeActivityCameraTarget) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;
    let active = true;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode }
    }).then((stream) => {
      if (active) {
        activeStream = stream;
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        stream.getTracks().forEach(track => track.stop());
      }
    }).catch((err) => {
      console.error(err);
      toast.error("Camera access failed! Please check site permissions.");
      setActiveCameraTarget(null);
      setActiveActivityCameraTarget(null);
    });

    return () => {
      active = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeCameraTarget, activeActivityCameraTarget, facingMode]);

  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Create canvas matching video dimensions
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Could not capture image from stream.");
        return;
      }
      
      const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
      
      // Stop camera stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      const target = activeCameraTarget;
      const actTarget = activeActivityCameraTarget;
      
      // Close modal
      setActiveCameraTarget(null);
      setActiveActivityCameraTarget(null);
      
      if (target) {
        // Set standard leg file
        handleLegFileChange(target.legNum, target.key, file);
      } else if (actTarget) {
        // Upload call/pms photo
        uploadActivityPhoto(actTarget.legNum, actTarget.activityType, file);
      }
    }, "image/jpeg", 0.9);
  };

  // Init Data States
  const [user, setUser] = useState<any>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      const parsed = JSON.parse(cached).user || {};
      return {
        ...parsed,
        name: parsed.name || parsed.full_name,
        district: parsed.district || parsed.home_district
      };
    }
    if (parsedUser && Object.keys(parsedUser).length > 0) {
      return {
        ...parsedUser,
        name: parsedUser.name || parsedUser.full_name,
        district: parsedUser.district || parsedUser.home_district
      };
    }
    return {};
  });
  const [allowance, setAllowance] = useState<any>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.allowance || {};
      } catch (e) {}
    }
    return {};
  });
  const [facilities, setFacilities] = useState<Record<string, string[]>>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.facilities || {};
      } catch (e) {}
    }
    return {};
  });
  const [submittedDates, setSubmittedDates] = useState<string[]>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.submitted_dates || [];
      } catch (e) {}
    }
    return [];
  });
  const [nextExpId, setNextExpId] = useState(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.next_exp_id) return parsed.next_exp_id;
      } catch (e) {}
    }
    const istNow = getISTDate();
    const mm = istNow.slice(5, 7);
    const yy = istNow.slice(2, 4);
    return `RJ-${mm}/${yy}-PENDING`;
  });

  // Limits tracking
  const [approvedKm, setApprovedKm] = useState(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.approved_km || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [approvedAuto, setApprovedAuto] = useState(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.approved_auto || 0;
      } catch (e) {}
    }
    return 0;
  });
  const [existingKmReq, setExistingKmReq] = useState<any>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.existing_km_req;
      } catch (e) {}
    }
    return null;
  });
  const [existingAutoReq, setExistingAutoReq] = useState<any>(() => {
    const monthStr = getISTMonth();
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.existing_auto_req;
      } catch (e) {}
    }
    return null;
  });
  const [loadedMonth, setLoadedMonth] = useState<string>("");


  const getFacilitiesForDistrict = (districtName: string): string[] => {
    if (!districtName || !facilities) return [];
    let cleanName = districtName.trim().toLowerCase();
    
    // Normalize common naming mismatches
    if (cleanName === "ganganar") {
      cleanName = "ganganagar";
    }
    
    const matchingKey = Object.keys(facilities).find(
      k => k.trim().toLowerCase() === cleanName
    );
    return matchingKey ? facilities[matchingKey] : [];
  };

  // UI status flags
  const [initLoading, setInitLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claims, setClaims] = useState<any[]>(() => {
    const cached = localStorage.getItem(`cache_my_expenses_${currentUserId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [claimsLoading, setClaimsLoading] = useState(() => {
    return !localStorage.getItem(`cache_my_expenses_${currentUserId}`);
  });
  const [myClaimsPage, setMyClaimsPage] = useState(1);
  const [myClaimsPageSize, setMyClaimsPageSize] = useState(10);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error"; title: string; message: string; claimCode?: string; deductions?: { policyMessage: string; items: { leg: number; from: string; to: string; taDeducted: number; daDeducted: number }[] } | null } | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [exceededType, setExceededType] = useState<"KM" | "AUTO">("KM");
  const [reqAdditional, setReqAdditional] = useState("0");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [hasShownExceededModal, setHasShownExceededModal] = useState(false);
  // Stores per-leg deduction breakdown to show in the confirm modal
  const [baseLocDeductions, setBaseLocDeductions] = useState<{
    hasDeductions: boolean;
    policyMessage: string;
    items: { leg: number; from: string; to: string; taDeducted: number; daDeducted: number }[];
  } | null>(null);

  // Read-only popup modal state (Dashboard Preview Modal)
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deletedAttachments, setDeletedAttachments] = useState<{leg: number; type: string}[]>([]);
  const [assetValueMaster, setAssetValueMaster] = useState<{equipment_name: string; rmsc_tender_cost: number; asset_value?: number}[]>([]);

  // Image Preview Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    setImageLoadError(false);
    setIsLoadingPdf(false);

    if (!lightboxImage) {
      setDisplayImageUrl(null);
      setIsConvertingHeic(false);
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
      return;
    }

    // IMMEDIATELY set image URL synchronously for 0ms instant display!
    const formattedUrl = formatImageUrl(lightboxImage);
    if (!formattedUrl) {
      setImageLoadError(true);
      setDisplayImageUrl(null);
      return;
    }
    setDisplayImageUrl(formattedUrl);

    const isPdfUrl = formattedUrl.toLowerCase().includes(".pdf") || 
                     formattedUrl.toLowerCase().includes(".pdf?");

    if (isPdfUrl) {
      setIsLoadingPdf(true);
      fetch(formattedUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          if (!active) return;
          const pdfBlob = new Blob([blob], { type: "application/pdf" });
          localUrl = URL.createObjectURL(pdfBlob);
          setDisplayImageUrl(localUrl);
          setIsLoadingPdf(false);
        })
        .catch((err) => {
          console.warn("Failed to fetch PDF blob, falling back to direct URL:", err);
          if (active) {
            setDisplayImageUrl(formattedUrl);
            setIsLoadingPdf(false);
          }
        });

      return () => {
        active = false;
        if (localUrl) URL.revokeObjectURL(localUrl);
      };
    }

    if (formattedUrl.toLowerCase().endsWith(".heic") || formattedUrl.toLowerCase().endsWith(".heif")) {
      checkIsHeic(formattedUrl).then(isHeicImg => {
        if (!active) return;
        if (isHeicImg) {
          setIsConvertingHeic(true);
          convertHeicToJpegUrl(formattedUrl)
            .then((url) => {
              if (!active) {
                URL.revokeObjectURL(url);
                return;
              }
              localUrl = url;
              setDisplayImageUrl(url);
              setIsConvertingHeic(false);
            })
            .catch(() => {
              if (active) {
                setDisplayImageUrl(formattedUrl);
                setIsConvertingHeic(false);
              }
            });
        }
      });
    }

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [lightboxImage]);

  // Custom Validation Warning Modal
  const [validationModal, setValidationModal] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: "", message: "" });

  // Active / Open Complaints Selection Modal state
  const [openCallsModalData, setOpenCallsModalData] = useState<{
    legNum: number;
    barcode: string;
    hospitalName: string;
    openCalls: Array<{
      complaint_id: string;
      barcode: string;
      call_type: string;
      status: string;
      action_taken: string;
      spare_replaced?: string;
      spare_name?: string;
      photo_url?: string;
      attended_by: string;
      attended_date: string;
      history?: Array<{
        user_name: string;
        status: string;
        action_taken: string;
        date: string;
        photo_url?: string;
      }>;
    }>;
  } | null>(null);

  // Live Complaint DB Status map per leg
  const [complaintCheckStatusMap, setComplaintCheckStatusMap] = useState<{
    [legNum: number]: {
      status: "idle" | "checking" | "found" | "fresh";
      message: string;
      count: number;
    };
  }>({});

  // Edit Mode & Calendar Constraints states
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [_existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [existingAttachmentsDetailed, setExistingAttachmentsDetailed] = useState<any[]>([]);
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [originalExpenseDate, setOriginalExpenseDate] = useState<string | null>(null);

  // My Claims advanced search & filters
  const [claimsSearch, setClaimsSearch] = useState("");
  const [claimsStatusFilter, setClaimsStatusFilter] = useState("all");
  const [claimsMonthFilter, setClaimsMonthFilter] = useState(() => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[new Date().getMonth()];
  });
  const [activeClaimsTab, setActiveClaimsTab] = useState<"sheets" | "legs">("sheets");

  useEffect(() => {
    // Unconditionally clear any lingering scroll locks on mount and unmount
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    document.body.style.touchAction = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.pointerEvents = '';
    document.documentElement.style.touchAction = '';

    return () => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
    };
  }, []);

  useEffect(() => {
    const hasAnyModalOpen = showDetailsModal || showConfirmModal || !!submitStatus || showApprovalModal || validationModal.show || !!activeCameraTarget || !!activeActivityCameraTarget || !!lightboxImage || !!openCallsModalData;
    if (hasAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
      document.body.classList.remove('ant-scrolling-effect');
      document.documentElement.classList.remove('ant-scrolling-effect');
    }
  }, [showDetailsModal, showConfirmModal, submitStatus, showApprovalModal, validationModal.show, activeCameraTarget, activeActivityCameraTarget, lightboxImage, openCallsModalData]);
  const [claimsSortOrder, setClaimsSortOrder] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  const hasExistingFile = (legNum: number, billType: string) => {
    if (!editExpenseId) return false;
    const isDeletedLocally = deletedAttachments.some(d => d.leg === legNum && d.type.toLowerCase() === (billType || "").toLowerCase());
    if (isDeletedLocally) return false;
    return existingAttachmentsDetailed.some(a => {
      const parts = a.itinerary_id.split("-");
      const aLegNum = parseInt(parts[parts.length - 1]);
      const billTypeLower = (a.bill_type || "").trim().toLowerCase();
      const checkLower = (billType || "").trim().toLowerCase();
      return aLegNum === legNum && (a.bill_type === billType || billTypeLower === checkLower);
    });
  };

  const getExistingFileUrl = (legNum: number, billType: string) => {
    if (!editExpenseId) return null;
    const found = existingAttachmentsDetailed.find(a => {
      const parts = a.itinerary_id.split("-");
      const aLegNum = parseInt(parts[parts.length - 1]);
      return aLegNum === legNum && a.bill_type === billType;
    });
    if (!found) return null;
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return `${baseUrl}${found.file_url}`;
  };

  useEffect(() => {
    const handlePullRefresh = () => {
      if (date) {
        const monthStr = date.slice(0, 7);
        const cacheKey = `cache_month_limits_${currentUserId}_${monthStr}`;
        localStorage.removeItem(cacheKey);
        fetchMonthLimits(monthStr, false);
      }
      const claimsCacheKey = `cache_my_expenses_${currentUserId}`;
      localStorage.removeItem(claimsCacheKey);
      fetchClaims();
    };

    window.addEventListener("app-pull-to-refresh", handlePullRefresh);
    return () => window.removeEventListener("app-pull-to-refresh", handlePullRefresh);
  }, [date, currentUserId]);

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get("edit");
    if (editId) {
      setEditExpenseId(editId);
      loadExpenseForEdit(editId);
    } else {
      setEditExpenseId(null);
      resetForm();
    }
  }, [location.search]);

  useEffect(() => {
    setupDateRules();
    fetchClaims();

    const fetchAssetMaster = async () => {
      try {
        const data = await expenseService.getAssetValueMaster();
        setAssetValueMaster(data || []);
      } catch (e) {
        console.error("Error loading asset value master list", e);
      }
    };
    fetchAssetMaster();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetForm();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const loadExpenseForEdit = async (editId: string) => {
    setInitLoading(true);
    try {
      const data = await expenseService.getExpenseDetails(editId);
      if (data) {
        setDate(data.date);
        setOriginalExpenseDate(data.date);
        setupDateRules(data.date);
        setNextExpId(data.expense_code);
        setExistingAttachments(data.attachments || []);
        setExistingAttachmentsDetailed(data.attachments_detailed || []);
        setDeletedAttachments([]);

        const mappedIti = data.itineraries.map((leg: any) => {
          let activityObj: any = {};
          try {
            if (leg.activity_details) {
              activityObj = JSON.parse(leg.activity_details);
            }
          } catch (e) {
            console.error("Error parsing activity_details", e);
          }

          const isCalib = (user?.designation || "").toLowerCase().includes("calibration");

          const fromCustom = leg.from ? !getFacilitiesForDistrict(leg.from_district || "").includes(leg.from) : false;
          const toCustom = leg.to ? !getFacilitiesForDistrict(leg.to_district || "").includes(leg.to) : false;

          const legDistType = computeDistrictType(user?.district, [leg], leg.to_district || leg.to);
          return {
            leg: leg.leg,
            travel_type: legDistType === "OUT_DISTRICT" ? "Outdoor" : "In-District",
            district_from: leg.from_district,
            district: leg.to_district,
            from: leg.from || "",
            from_custom: fromCustom,
            to: leg.to || "",
            to_custom: toCustom,
            mode: leg.mode || "",
            km: (leg.km || 0).toString(),
            amount: (leg.amount || 0).toString(),
            sub_mode: leg.sub_mode || "",
            sub_km: (leg.sub_km || 0).toString(),
            sub_amount: (leg.sub_amount || 0).toString(),
            da: (leg.da || 0).toString(),
            hotel: leg.hotel !== undefined && leg.hotel !== null && parseFloat(leg.hotel.toString()) === 0 ? "0" : (leg.hotel && parseFloat(leg.hotel.toString()) !== 0 ? leg.hotel.toString() : ""),
            company_provided: leg.hotel !== undefined && leg.hotel !== null && parseFloat(leg.hotel.toString()) === 0 && 
              (parseFloat((leg.da || 0).toString()) === (allowance?.daily_hotel || 0) || parseFloat((leg.da || 0).toString()) === (allowance?.daily_out_state || 0)),
            local_purchase: leg.local_purchase && parseFloat(leg.local_purchase) !== 0 ? leg.local_purchase.toString() : "",
            oth_desc: leg.oth_desc || "",
            oth_amount: (leg.oth_amount || 0).toString(),
            ws_assigned: (leg.ws_assigned || 0).toString(),
            ws_closed: (leg.ws_closed || 0).toString(),
            ws_pms: (leg.ws_pms || 0).toString(),
            ws_asset: (leg.ws_asset || 0).toString(),
            visit_purpose: leg.visit_purpose || "",
            show_sub_leg: !!leg.sub_mode,

            // Activity fields
            activity_details: leg.activity_details || "",
            selected_activities: activityObj.selected_activities || (isCalib ? ["Calibration"] : []),
            calls_barcode: activityObj.calls_barcode || "",
            calls_verified: !!activityObj.calls_verified,
            calls_asset_details: activityObj.calls_asset_details || null,
            calls_type: activityObj.calls_type || "Support Call",
            calls_status: activityObj.calls_status || "Attend",
            pms_barcode: activityObj.pms_barcode || "",
            pms_verified: !!activityObj.pms_verified,
            pms_asset_details: activityObj.pms_asset_details || null,
            pms_frequency: activityObj.pms_frequency || "3 month",
            asset_tagging_equipment: activityObj.asset_tagging_equipment || "",
            asset_tagging_quantity: activityObj.asset_tagging_quantity || "0",
            mobilise_asset_count: activityObj.mobilise_asset_count || "0",
            calibration_count: activityObj.calibration_count || "0",
            activity_other_desc: activityObj.activity_other_desc || "",
            calls_list: activityObj.calls_list || [],
            pms_list: activityObj.pms_list || [],
            assets_list: activityObj.assets_list || []
          };
        });
        setItineraries(mappedIti);

        const initialFiles: Record<number, LegFiles> = {};
        mappedIti.forEach((leg: any) => {
          initialFiles[leg.leg] = createDefaultFiles();
        });
        setFiles(initialFiles);
      }
    } catch (err) {
      console.error("Failed to load expense for editing", err);
      toast.error("Failed to load claim details for editing.");
    } finally {
      setInitLoading(false);
    }
  };

  const [systemSettings, setSystemSettings] = useState<any>(null);

  const setupDateRules = (referenceDate?: string, sysSettings?: any) => {
    const activeSettings = sysSettings || systemSettings;
    const monthlyCutoffDay = activeSettings?.monthly_cutoff_day ? parseInt(activeSettings.monthly_cutoff_day, 10) : 3;

    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    
    // Max date: today (prevent future date submissions)
    const maxStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // Min date based on monthly cutoff day from System Settings
    // If today's date <= monthlyCutoffDay: both current month and previous month dates are selectable
    // If today's date > monthlyCutoffDay: only current month dates are selectable
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStartStr = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-01`;
    const currentMonthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

    let minStr = currentMonthStartStr;
    if (today.getDate() <= monthlyCutoffDay) {
      minStr = prevMonthStartStr;
    }

    // If editing, allow the original date if it's older than our current min limit
    if (referenceDate && referenceDate < minStr) {
      minStr = referenceDate;
    }

    setMinDate(minStr);
    setMaxDate(maxStr);

    if (!referenceDate && !date) {
      setDate(maxStr);
    }
  };

  useEffect(() => {
    if (date) {
      const monthStr = date.slice(0, 7);
      if (monthStr !== loadedMonth) {
        fetchMonthLimits(monthStr, itineraries.length === 1 && !itineraries[0].from);
      }
    }
  }, [date, loadedMonth]);

  const fetchMonthLimits = async (monthStr: string, isInitialLoad = false) => {
    const cacheKey = `cache_month_limits_${currentUserId}_${monthStr}`;

    const applyInitData = (data: any) => {
      setLoadedMonth(monthStr);
      const normalizedUser = {
        ...data.user,
        name: data.user?.name || data.user?.full_name,
        district: data.user?.district || data.user?.home_district
      };
      setUser(normalizedUser);
      setAllowance(data.allowance || {});
      setFacilities(data.facilities);
      setSubmittedDates(data.submitted_dates || []);
      setNextExpId(data.next_exp_id);
      
      setApprovedKm(data.approved_km || 0);
      setApprovedAuto(data.approved_auto || 0);
      setExistingKmReq(data.existing_km_req);
      setExistingAutoReq(data.existing_auto_req);

      if (data.system_settings) {
        setSystemSettings(data.system_settings);
        setupDateRules(originalExpenseDate || undefined, data.system_settings);
      }

      // Populate initial leg default values
      setItineraries(prev => {
        const hDist = (normalizedUser.district || "Jodhpur").trim();
        const updated = prev.map(leg => {
          let updatedLeg = { ...leg };
          if (leg.travel_type === "In-District") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.district = hDist === "All" ? "Jodhpur" : hDist;
          } else {
            updatedLeg.district_from = leg.district_from || (hDist === "All" ? "Jodhpur" : hDist);
          }
          return updatedLeg;
        });

        // Calculate DA for Leg 1
        const leg1 = updated.find(l => l.leg === 1);
        if (leg1) {
          const hotelAmt = parseFloat(leg1.hotel) || 0;
          const hasOutStateLeg = updated.some(l => l.travel_type === "Out of State" || (l.dest_state && l.dest_state !== l.state));
          const hasOutDistrictLeg = computeDistrictType(hDist, updated, null) === "OUT_DISTRICT" || hasOutStateLeg;

          const allowanceObj = data.allowance || {};
          if (hasOutStateLeg && allowanceObj.daily_out_state && allowanceObj.daily_out_state > 0) {
            // Out of State: DA remains daily_out_state from DB even when staying at hotel
            leg1.da = (allowanceObj.daily_out_state || 0).toString();
          } else if (leg1.company_provided) {
            leg1.da = (allowanceObj.daily_hotel || 0).toString();
          } else if (hotelAmt > 0) {
            leg1.da = (allowanceObj.daily_hotel || 0).toString();
          } else if (hasOutDistrictLeg) {
            leg1.da = (allowanceObj.daily_out_district || 0).toString();
          } else {
            const hasAnyDistrict = updated.some(l => l.district);
            if (!hasAnyDistrict) {
              leg1.da = "0";
            } else {
              leg1.da = (allowanceObj.daily_in_district || 0).toString();
            }
          }
        }
        return updated;
      });
    };

    const cached = localStorage.getItem(cacheKey);
    let hasLoadedFromCache = false;
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        applyInitData(cachedData);
        hasLoadedFromCache = true;
        if (!isInitialLoad) return;
      } catch (_) {}
    }

    if (isInitialLoad && !hasLoadedFromCache) {
      setInitLoading(true);
    }

    try {
      const data = await expenseService.getExpenseInit(currentUserId, monthStr);
      if (data.success) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        applyInitData(data);
      }
    } catch (err) {
      console.error("Failed to load month limits", err);
      setLoadedMonth(monthStr);
      if (!cached) {
        toast.error("Failed to initialize expense rules.");
      }
    } finally {
      if (isInitialLoad) {
        setInitLoading(false);
      }
    }
  };

  const fetchClaims = async () => {
    setClaimsLoading(true);
    try {
      const data = await expenseService.getExpenses("all");
      if (Array.isArray(data)) {
        setClaims(data);
        localStorage.setItem(`cache_my_expenses_${currentUserId}_all`, JSON.stringify(data));
      }
    } catch (err: any) {
      console.error("Failed to load claims list", err);
    } finally {
      setClaimsLoading(false);
    }
  };

  // Note: date-submitted check is inlined in DatePicker onChange below

  const addItinerary = () => {
    if (itineraries.length >= 15) {
      toast.error("You can add a maximum of 15 visits.");
      return;
    }
    const nextLeg = itineraries.length + 1;
    const newLeg = createDefaultLeg(nextLeg);
    const hDist = user.district || user.home_district || "Jodhpur";
    newLeg.district_from = hDist;
    newLeg.district = hDist;

    // Auto-fill: next leg's From = previous leg's To
    const prevLeg = itineraries[itineraries.length - 1];
    if (prevLeg && prevLeg.to) {
      newLeg.from = prevLeg.to;
      // If previous leg's To was a custom entry, mark this leg's From as custom too
      newLeg.from_custom = !!prevLeg.to_custom;
      // Carry forward district from previous leg's destination
      if (prevLeg.district) {
        newLeg.district_from = prevLeg.district;
        newLeg.district = prevLeg.district;
      }
    }
    
    setItineraries(prev => [...prev, newLeg]);
    setFiles(prev => ({ ...prev, [nextLeg]: createDefaultFiles() }));
  };

  const removeItinerary = (legNum: number) => {
    if (itineraries.length === 1) return;
    
    const filteredIti = itineraries.filter(leg => leg.leg !== legNum).map((leg, index) => ({
      ...leg,
      leg: index + 1
    }));
    
    const newFiles: Record<number, LegFiles> = {};
    filteredIti.forEach(leg => {
      const originalLeg = itineraries.find(old => old.from === leg.from && old.to === leg.to)?.leg || 1;
      newFiles[leg.leg] = files[originalLeg] || createDefaultFiles();
    });

    setItineraries(filteredIti);
    setFiles(newFiles);
  };

  const verifyLegBarcode = async (legNum: number, activityType: "Calls" | "PMS") => {
    const leg = itineraries.find(l => l.leg === legNum);
    if (!leg) return;
    
    if (!leg.to || !leg.to.trim()) {
      toast.error("Please select or enter the Destination Location (To) facility first.");
      return;
    }
    
    const rawBarcode = activityType === "Calls" ? leg.calls_barcode : leg.pms_barcode;
    if (!rawBarcode) {
      toast.error("Barcode must be exactly 8 digits.");
      return;
    }
    const barcode = String(rawBarcode).trim();
    if (barcode.length !== 8) {
      toast.error("Barcode must be exactly 8 digits.");
      return;
    }

    const currentList = activityType === "Calls" ? (leg.calls_list || []) : (leg.pms_list || []);
    if (currentList.some(item => item.barcode === barcode)) {
      toast.error("This barcode has already been added to this leg.");
      return;
    }

    // Cross-leg duplicate barcode check
    for (const otherLeg of itineraries) {
      if (otherLeg.leg === legNum) continue;
      if (activityType === "Calls") {
        const otherCallsBarcodes = (otherLeg.calls_list || []).map(item => item.barcode);
        if (otherCallsBarcodes.includes(barcode)) {
          toast.error(`This barcode (${barcode}) has already been used in Leg ${otherLeg.leg} Calls. Same barcode cannot be repeated in Calls on the same day.`);
          return;
        }
      } else {
        const otherPmsBarcodes = (otherLeg.pms_list || []).map(item => item.barcode);
        if (otherPmsBarcodes.includes(barcode)) {
          toast.error(`This barcode (${barcode}) has already been used in Leg ${otherLeg.leg} PMS. Same barcode cannot be repeated in PMS on the same day.`);
          return;
        }
      }
    }

    try {
      const res = await expenseService.verifyBarcode(barcode, leg.to);
      if (res.success && res.data) {
        const hospitalName = res.data.hospital_name;
        // Check matching with To facility
        const toMatch = (leg.to || "").toLowerCase().trim() === hospitalName.toLowerCase().trim();
        
        if (!toMatch) {
          toast.error("This barcode was not fetched for this hospital.");
          return;
        }

        // Successfully matched!
        toast.success("Barcode verified successfully!");
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          if (activityType === "Calls") {
            return {
              ...l,
              calls_verified: true,
              calls_hospital: hospitalName,
              calls_asset_details: res.data
            };
          } else {
            return {
              ...l,
              pms_verified: true,
              pms_hospital: hospitalName,
              pms_asset_details: res.data
            };
          }
        }));
        if (activityType === "Calls") {
          setTimeout(() => instantCheckComplaintId(legNum), 100);
        }
      } else {
        toast.error(res.message || "Barcode not found in assets inventory.");
      }
    } catch (e) {
      toast.error("Failed to verify barcode.");
    }
  };

  const instantCheckComplaintId = async (legNum: number, typedVal?: string) => {
    const leg = itineraries.find(l => l.leg === legNum);
    if (!leg) return;
    
    const complaintId = (typedVal !== undefined ? typedVal : leg.calls_complaint_id || "").trim();
    if (!complaintId || complaintId.length < 3) {
      setComplaintCheckStatusMap(prev => ({ ...prev, [legNum]: { status: "idle", message: "", count: 0 } }));
      return;
    }

    const barcode = (leg.calls_barcode || "").trim();
    const hospitalName = leg.calls_asset_details?.hospital_name || leg.calls_hospital || leg.to || "Facility";

    setComplaintCheckStatusMap(prev => ({
      ...prev,
      [legNum]: { status: "checking", message: "Scanning database for barcode & complaint history...", count: 0 }
    }));

    try {
      const res = await expenseService.checkComplaintId(complaintId, barcode);
      let openCalls = res.openCalls || res.open_calls || [];

      // Fallback: If backend query returned no results, check claims loaded in memory (claims)
      if (openCalls.length === 0 && claims && claims.length > 0) {
        const cleanTyped = complaintId.toLowerCase().replace(/[^a-z0-9]/g, "");
        const localMatches: any[] = [];

        claims.forEach((claim: any) => {
          let itiArr: any[] = [];
          try { itiArr = typeof claim.itinerary === 'string' ? JSON.parse(claim.itinerary) : (claim.itinerary || []); } catch(e){}
          itiArr.forEach((l: any) => {
            const list = Array.isArray(l.calls_list) ? l.calls_list : (Array.isArray(l.calls) ? l.calls : []);
            if (l.calls_complaint_id) {
              list.push({
                calls_complaint_id: l.calls_complaint_id,
                calls_barcode: l.calls_barcode,
                calls_type: l.calls_type,
                calls_status: l.calls_status,
                calls_action_taken: l.calls_action_taken
              });
            }
            list.forEach((c: any) => {
              const cId = String(c.calls_complaint_id || c.complaint_id || c.id || l.calls_complaint_id || "").trim();
              const cleanCId = cId.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (cleanCId && (cleanCId === cleanTyped || cleanCId.includes(cleanTyped) || cleanTyped.includes(cleanCId))) {
                localMatches.push({
                  complaint_id: cId,
                  barcode: c.barcode || c.calls_barcode || l.calls_barcode || "",
                  call_type: c.calls_type || c.type || l.calls_type || "Support Call",
                  status: c.calls_status || c.status || l.calls_status || "Attend",
                  action_taken: c.calls_action_taken || c.action_taken || l.calls_action_taken || "",
                  spare_replaced: c.calls_spare_replaced || c.spare_replaced || "No",
                  spare_name: c.calls_spare_name || c.spare_name || "",
                  photo_url: c.calls_photo_url || c.photo_url || "",
                  attended_by: claim.user_name || "Engineer",
                  attended_date: claim.expense_date || claim.created_at || ""
                });
              }
            });
          });
        });

        if (localMatches.length > 0) {
          openCalls = localMatches;
        }
      }

      if (openCalls.length > 0) {
        setComplaintCheckStatusMap(prev => ({
          ...prev,
          [legNum]: { status: "found", message: `${openCalls.length} Open Complaint(s) Found in Database!`, count: openCalls.length }
        }));
        setOpenCallsModalData({
          legNum,
          barcode: leg.calls_barcode || complaintId,
          hospitalName: hospitalName,
          openCalls: openCalls
        });
        toast.success(`📋 ${openCalls.length} Active/Open Complaint history found in database for #${complaintId}! Opening popup.`);
      } else {
        setComplaintCheckStatusMap(prev => ({
          ...prev,
          [legNum]: { status: "fresh", message: `Fresh Entry: No open complaint found in database for #${complaintId}`, count: 0 }
        }));
        if (complaintId.length >= 4) {
          toast.success(`✓ Checked database: No open complaint found for #${complaintId} (Fresh Entry).`);
        }
      }
    } catch (e) {
      setComplaintCheckStatusMap(prev => ({
        ...prev,
        [legNum]: { status: "fresh", message: `Fresh Entry: Ready to log call`, count: 0 }
      }));
    }
  };

  const addVerifiedBarcode = (legNum: number, activityType: "Calls" | "PMS") => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      if (activityType === "Calls") {
        if (!l.calls_verified || !l.calls_asset_details) {
          toast.error("Please verify the barcode first.");
          return l;
        }

        const complaintId = (l.calls_complaint_id || "").trim();
        const callType = l.calls_type || "Support Call";

        if (!complaintId) {
          toast.error(`Complaint ID / Call ID is compulsory for ${callType}.`);
          return l;
        }

        if (callType === "Support Call") {
          const isValidSupport = /^SCRJ\d+$/i.test(complaintId);
          if (!isValidSupport) {
            toast.error('Support Call ID must start with "SCRJ" followed strictly by numeric digits (e.g. SCRJ12345). No spaces or special characters.');
            return l;
          }
        } else if (callType === "Online Call") {
          const isValidOnline = /^\d{8}-\d{6}$/.test(complaintId) || /^\d+-\d+$/.test(complaintId);
          if (!isValidOnline) {
            toast.error('Online Call Complaint ID must strictly follow "13126080-100125" format.');
            return l;
          }
        }

        const actionTaken = (l.calls_action_taken || "").trim();
        if (!actionTaken) {
          toast.error("Action Taken Remark is compulsory for Calls.");
          return l;
        }

        if (!l.calls_photo_url) {
          toast.error("Service Report photo is compulsory for Calls.");
          return l;
        }

        if (l.calls_spare_replaced === "Yes") {
          if (!l.calls_spare_name || !l.calls_spare_name.trim()) {
            toast.error("Spare / Item Name is compulsory when Spare Replaced / Local Purchase is Yes.");
            return l;
          }
          if (!l.calls_old_spare_photo) {
            toast.error("Old Spare Photo is compulsory when Spare Replaced is Yes.");
            return l;
          }
          if (!l.calls_new_spare_photo) {
            toast.error("New Spare Photo is compulsory when Spare Replaced is Yes.");
            return l;
          }
        }

        const newItem = {
          barcode: l.calls_barcode || "",
          complaint_id: complaintId.toUpperCase(),
          hospital_name: l.calls_hospital || l.calls_asset_details?.hospital_name || "",
          action_taken: actionTaken,
          verified: true,
          type: callType,
          status: l.calls_status || "Attend",
          spare_replaced: l.calls_spare_replaced === "Yes" ? "Yes" : "No",
          spare_name: l.calls_spare_replaced === "Yes" ? (l.calls_spare_name || "").trim() : "",
          spare_estimated_value: l.calls_spare_replaced === "Yes" ? (parseFloat(String(l.calls_spare_estimated_value || 0)) || 0) : 0,
          asset_details: l.calls_asset_details,
          photo_url: l.calls_photo_url || "",
          old_spare_photo: l.calls_spare_replaced === "Yes" ? (l.calls_old_spare_photo || "") : "",
          new_spare_photo: l.calls_spare_replaced === "Yes" ? (l.calls_new_spare_photo || "") : ""
        };
        return {
          ...l,
          calls_list: [...(l.calls_list || []), newItem],
          calls_barcode: "",
          calls_complaint_id: "",
          calls_action_taken: "",
          calls_spare_replaced: "No",
          calls_spare_name: "",
          calls_spare_estimated_value: "",
          calls_old_spare_photo: "",
          calls_new_spare_photo: "",
          calls_verified: false,
          calls_asset_details: null,
          calls_photo_url: ""
        };
      } else {
        if (!l.pms_verified || !l.pms_asset_details) {
          toast.error("Please verify the barcode first.");
          return l;
        }
        const newItem = {
          barcode: l.pms_barcode || "",
          verified: true,
          frequency: l.pms_frequency || "3 month",
          asset_details: l.pms_asset_details,
          photo_url: l.pms_photo_url || ""
        };
        return {
          ...l,
          pms_list: [...(l.pms_list || []), newItem],
          pms_barcode: "",
          pms_verified: false,
          pms_asset_details: null,
          pms_photo_url: ""
        };
      }
    }));
  };

  const removeBarcode = (legNum: number, activityType: "Calls" | "PMS", index: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      if (activityType === "Calls") {
        return {
          ...l,
          calls_list: (l.calls_list || []).filter((_, idx) => idx !== index)
        };
      } else {
        return {
          ...l,
          pms_list: (l.pms_list || []).filter((_, idx) => idx !== index)
        };
      }
    }));
  };

  const uploadActivityPhoto = async (
    legNum: number, 
    activityType: "Calls" | "PMS" | "Asset_Barcode" | "Asset_Serial" | "Asset_Model" | "Calls_Old_Spare" | "Calls_New_Spare", 
    file: File
  ) => {
    // Any file format is allowed for photos

    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      if (activityType === "Calls") return { ...l, calls_photo_loading: true };
      if (activityType === "PMS") return { ...l, pms_photo_loading: true };
      if (activityType === "Asset_Barcode") return { ...l, asset_barcode_photo_loading: true };
      if (activityType === "Asset_Serial") return { ...l, asset_serial_photo_loading: true };
      if (activityType === "Asset_Model") return { ...l, asset_model_photo_loading: true };
      if (activityType === "Calls_Old_Spare") return { ...l, calls_old_spare_loading: true };
      if (activityType === "Calls_New_Spare") return { ...l, calls_new_spare_loading: true };
      return l;
    }));

    try {
      let processedFile = file;
      
      // Compress image if larger than 50KB
      if (file.size > 50 * 1024) {
        const toastId = toast.loading(`Compressing photo... (${Math.round(file.size / 1024)}KB)`);
        try {
          processedFile = await compressImage(file);
          toast.dismiss(toastId);
          toast.success(`Compressed to ${Math.round(processedFile.size / 1024)}KB ✓`, { duration: 2000 });
        } catch {
          toast.dismiss(toastId);
          processedFile = file;
        }
      }

      // Validate final size (maximum 2MB)
      if (processedFile.size > 2 * 1024 * 1024) {
        toast.error("Photo size exceeds the 2MB limit. Please upload a smaller photo.");
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          if (activityType === "Calls") return { ...l, calls_photo_loading: false };
          if (activityType === "PMS") return { ...l, pms_photo_loading: false };
          if (activityType === "Asset_Barcode") return { ...l, asset_barcode_photo_loading: false };
          if (activityType === "Asset_Serial") return { ...l, asset_serial_photo_loading: false };
          if (activityType === "Asset_Model") return { ...l, asset_model_photo_loading: false };
          if (activityType === "Calls_Old_Spare") return { ...l, calls_old_spare_loading: false };
          if (activityType === "Calls_New_Spare") return { ...l, calls_new_spare_loading: false };
          return l;
        }));
        return;
      }

      const data = await uploadService.uploadReceipt(processedFile);
      if (data && data.url) {
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          if (activityType === "Calls") return { ...l, calls_photo_url: data.url, calls_photo_name: file.name, calls_photo_loading: false };
          if (activityType === "PMS") return { ...l, pms_photo_url: data.url, pms_photo_name: file.name, pms_photo_loading: false };
          if (activityType === "Asset_Barcode") return { ...l, asset_tagging_barcode_photo: data.url, asset_barcode_photo_loading: false };
          if (activityType === "Asset_Serial") return { ...l, asset_tagging_serial_photo: data.url, asset_serial_photo_loading: false };
          if (activityType === "Asset_Model") return { ...l, asset_tagging_model_photo: data.url, asset_model_photo_loading: false };
          if (activityType === "Calls_Old_Spare") return { ...l, calls_old_spare_photo: data.url, calls_old_spare_loading: false };
          if (activityType === "Calls_New_Spare") return { ...l, calls_new_spare_photo: data.url, calls_new_spare_loading: false };
          return l;
        }));
        toast.success("Photo uploaded successfully.");
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (e) {
      console.error("Photo upload error", e);
      toast.error("Failed to upload photo.");
      setItineraries(prev => prev.map(l => {
        if (l.leg !== legNum) return l;
        if (activityType === "Calls") return { ...l, calls_photo_loading: false };
        if (activityType === "PMS") return { ...l, pms_photo_loading: false };
        if (activityType === "Asset_Barcode") return { ...l, asset_barcode_photo_loading: false };
        if (activityType === "Asset_Serial") return { ...l, asset_serial_photo_loading: false };
        if (activityType === "Asset_Model") return { ...l, asset_model_photo_loading: false };
        if (activityType === "Calls_Old_Spare") return { ...l, calls_old_spare_loading: false };
        if (activityType === "Calls_New_Spare") return { ...l, calls_new_spare_loading: false };
        return l;
      }));
    }
  };

  const addAssetTag = (legNum: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      const eq = l.asset_tagging_equipment;
      const suffix = (l.asset_tagging_suffix || "").trim();
      const barcode = l.asset_tagging_barcode || `(8004890615671) ${suffix}`;
      const hospital = (l.asset_tagging_hospital || l.district || "").trim();
      const make = (l.asset_tagging_make || "").trim();
      const model = (l.asset_tagging_model || "").trim();
      const serial = (l.asset_tagging_serial || "").trim();
      const hasWarranty = l.asset_tagging_has_warranty || "No";
      const warrantyStart = l.asset_tagging_warranty_start || "";
      const warrantyEnd = l.asset_tagging_warranty_end || "";

      if (!eq) {
        toast.error("Equipment Name is compulsory.");
        return l;
      }
      if (suffix.length !== 8) {
        toast.error("Barcode suffix is compulsory and must be exactly 8 numeric digits.");
        return l;
      }
      if (!hospital) {
        toast.error("Hospital / Facility Name is compulsory.");
        return l;
      }
      if (!make) {
        toast.error("Make / Brand is compulsory.");
        return l;
      }
      if (!model) {
        toast.error("Model is compulsory.");
        return l;
      }
      if (!serial) {
        toast.error("Serial Number is compulsory.");
        return l;
      }
      if (hasWarranty === "Yes" && (!warrantyStart || !warrantyEnd)) {
        toast.error("Warranty Start Date & End Date are compulsory when Warranty Details is Yes.");
        return l;
      }

      const newItem = {
        equipment_name: eq,
        barcode: barcode,
        suffix: suffix,
        hospital_name: hospital,
        make: make,
        model: model,
        serial_number: serial,
        has_warranty: hasWarranty,
        warranty_start: warrantyStart,
        warranty_end: warrantyEnd,
        barcode_photo: l.asset_tagging_barcode_photo || "",
        serial_photo: l.asset_tagging_serial_photo || "",
        model_photo: l.asset_tagging_model_photo || ""
      };

      // Save to field_asset_data table via API in background
      try {
        const token = localStorage.getItem("token") || "";
        const apiUrl = import.meta.env.VITE_API_URL || "https://fieldops-api.sunilbishnoi.workers.dev/api";
        const cleanApi = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

        fetch(`${cleanApi}/expense/assets/tag`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            barcode: barcode,
            prefix_code: "(8004890615671)",
            suffix_code: suffix,
            equipment_name: eq,
            district: l.district || "",
            hospital_name: hospital,
            make: make,
            model: model,
            serial_number: serial,
            has_warranty: hasWarranty === "Yes" ? 1 : 0,
            warranty_start_date: warrantyStart,
            warranty_end_date: warrantyEnd,
            barcode_photo: l.asset_tagging_barcode_photo || "",
            serial_photo: l.asset_tagging_serial_photo || "",
            model_photo: l.asset_tagging_model_photo || ""
          })
        }).catch(() => {});
      } catch (e) {}

      toast.success(`Asset Tagged: ${barcode}`);

      return {
        ...l,
        assets_list: [...(l.assets_list || []), newItem],
        asset_tagging_equipment: "",
        asset_tagging_suffix: "",
        asset_tagging_barcode: "",
        asset_tagging_make: "",
        asset_tagging_model: "",
        asset_tagging_serial: "",
        asset_tagging_has_warranty: "No",
        asset_tagging_warranty_start: "",
        asset_tagging_warranty_end: "",
        asset_tagging_barcode_photo: "",
        asset_tagging_serial_photo: "",
        asset_tagging_model_photo: ""
      };
    }));
  };

  const removeAssetTag = (legNum: number, index: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      return {
        ...l,
        assets_list: (l.assets_list || []).filter((_, idx) => idx !== index)
      };
    }));
  };

  const handleItineraryChange = (legNum: number, field: keyof ItineraryLeg, value: any) => {
    setItineraries(prev => {
      // 1. Map to get the updated list of legs
      const updatedLegs = prev.map(leg => {
        if (leg.leg !== legNum) return leg;
        
        const updatedLeg = { ...leg, [field]: value };

        // Immediate validation: starting and destination locations cannot be the same
        if (field === "from" || field === "to" || field === "district_from" || field === "district") {
          const checkFrom = field === "from" ? value : (updatedLeg.from || "");
          const checkTo = field === "to" ? value : (updatedLeg.to || "");
          const checkFromDist = field === "district_from" ? value : (updatedLeg.district_from || "");
          const checkToDist = field === "district" ? value : (updatedLeg.district || "");

          if (
            checkFrom.trim() && 
            checkTo.trim() && 
            checkFrom.trim().toLowerCase() === checkTo.trim().toLowerCase() &&
            checkFromDist.trim().toLowerCase() === checkToDist.trim().toLowerCase()
          ) {
            toast.error("Source (From) and Destination (To) locations cannot be the same.", { id: "same-location-error" });
            (updatedLeg as any)[field] = "";
          }
        }

        if (field === "mode") {
          updatedLeg.km = "0";
          updatedLeg.amount = "0";
          updatedLeg.sub_mode = "";
          updatedLeg.sub_amount = "0";
          updatedLeg.show_sub_leg = false;
        }

        const hDist = (user.district || user.home_district || "Jodhpur").trim();

        if (field === "travel_type") {
          updatedLeg.travel_type = value;
          if (value === "In-District") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.district = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.state = user.state || "Rajasthan";
            updatedLeg.dest_state = user.state || "Rajasthan";
          } else if (value === "Outdoor") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.state = user.state || "Rajasthan";
            updatedLeg.dest_state = user.state || "Rajasthan";
          } else if (value === "Out of State") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.state = user.state || "Rajasthan";
            if (!updatedLeg.dest_state || updatedLeg.dest_state === updatedLeg.state) {
              updatedLeg.dest_state = "Gujarat";
            }
            const destDists = getDistrictsForState(updatedLeg.dest_state);
            if (destDists.length > 0 && (!updatedLeg.district || !destDists.includes(updatedLeg.district))) {
              updatedLeg.district = destDists[0];
            }
          }
        }

        if (field === "district_from" && updatedLeg.travel_type === "In-District") {
          updatedLeg.district = value;
        }

        if (field === "km" && (updatedLeg.mode === "Bike" || updatedLeg.mode === "Car")) {
          const kmNum = parseFloat(value) || 0;
          const rate = updatedLeg.mode === "Bike" ? (allowance.rate_bike || 0) : (allowance.rate_car || 0);
          updatedLeg.amount = (kmNum * rate).toFixed(2);
        }

        if (field === "hotel" && legNum === 1) {
          const hotelAmt = parseFloat(value) || 0;
          const isOutState = updatedLeg.travel_type === "Out of State" || updatedLeg.dest_state !== updatedLeg.state;
          const hotelLimit = isOutState 
            ? (allowance.hotel_out_state_s && allowance.hotel_out_state_s > 0 ? allowance.hotel_out_state_s : 2000)
            : (allowance.hotel_in_state_s || 1000);
          if (hotelAmt > hotelLimit) {
            toast.error(`Maximum hotel stay allowance is ₹${hotelLimit}`, { id: "hotel-limit-exceeded" });
            updatedLeg.hotel = hotelLimit.toString();
          }
          if (value !== "0" && value !== 0) {
            updatedLeg.company_provided = false;
          }
        }

        if (field === "dest_state" && legNum === 1) {
          const hotelAmt = parseFloat(updatedLeg.hotel) || 0;
          const isOutState = updatedLeg.travel_type === "Out of State" || value !== updatedLeg.state;
          const hotelLimit = isOutState 
            ? (allowance.hotel_out_state_s && allowance.hotel_out_state_s > 0 ? allowance.hotel_out_state_s : 2000)
            : (allowance.hotel_in_state_s || 1000);
          if (hotelAmt > hotelLimit) {
            toast.error(`Maximum hotel stay allowance is ₹${hotelLimit}`, { id: "hotel-limit-exceeded" });
            updatedLeg.hotel = hotelLimit.toString();
          }
        }

        // Force company_provided to false if conditions are not met
        const isUserJodhpur = (user.district || "").trim().toLowerCase() === "jodhpur";
        const isLegOutdoor = updatedLeg.travel_type === "Outdoor" || updatedLeg.travel_type === "Out of State";
        const isDestJodhpur = (updatedLeg.district || "").trim().toLowerCase() === "jodhpur";
        const isHotelZero = updatedLeg.hotel === "0";
        
        if (isUserJodhpur || !isLegOutdoor || !isDestJodhpur || !isHotelZero) {
          updatedLeg.company_provided = false;
        }

        return updatedLeg;
      });

      // 2. Recalculate DA for Leg 1 based on the updated list of legs
      const hasOutStateLeg = updatedLegs.some(l => l.travel_type === "Out of State" || (l.dest_state && l.dest_state !== l.state));
      const hasOutDistrictLeg = updatedLegs.some(l => (l.travel_type || "").toLowerCase() === "outdoor" || l.travel_type === "Out of State");

      const leg1 = updatedLegs.find(l => l.leg === 1);
      if (leg1) {
        if (field !== "da") {
          const hotelAmt = parseFloat(leg1.hotel) || 0;
          if (hasOutStateLeg) {
            // Out of State: DA remains daily_out_state from DB even when staying at hotel
            const outStateDa = (allowance.daily_out_state && allowance.daily_out_state > 0)
              ? allowance.daily_out_state
              : (allowance.daily_out_district || 0);
            leg1.da = outStateDa.toString();
          } else if (leg1.company_provided) {
            leg1.da = (allowance.daily_hotel || 0).toString();
          } else if (hotelAmt > 0) {
            leg1.da = (allowance.daily_hotel || 0).toString();
          } else if (hasOutDistrictLeg) {
            leg1.da = (allowance.daily_out_district || 0).toString();
          } else {
            const hasAnyDistrict = updatedLegs.some(l => l.district);
            if (!hasAnyDistrict) {
              leg1.da = "0";
            } else {
              leg1.da = (allowance.daily_in_district || 0).toString();
            }
          }
        }
      }

      // 3. Auto-propagate "To" changes → next leg's "From"
      if (field === "to" || field === "to_custom" || field === "district") {
        const changedLegIndex = updatedLegs.findIndex(l => l.leg === legNum);
        const nextLeg = updatedLegs[changedLegIndex + 1];
        if (nextLeg) {
          if (field === "to") {
            nextLeg.from = value;
          }
          if (field === "to_custom") {
            nextLeg.from_custom = value;
          }
          if (field === "district") {
            nextLeg.district_from = value;
            if (nextLeg.travel_type === "In-District") {
              nextLeg.district = value;
            }
          }
        }
      }

      return updatedLegs;
    });
  };


  // Compress an image file to ≤50KB JPEG using Canvas API (fast, in-browser)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // If it's a PDF, pass through unchanged (can't compress PDFs in browser)
      if (file.type === "application/pdf") {
        resolve(file);
        return;
      }
      const TARGET_SIZE = 50 * 1024; // 50 KB
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        
        // Since target size is 50KB, limit max dimensions to 1000px for optimal compression & performance
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Try single-pass encoding first (most images under 1000px at 0.6 quality fit in 50KB)
        canvas.toBlob((blob) => {
          if (blob && blob.size <= TARGET_SIZE) {
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            // Second pass at 0.4 quality if first pass exceeded 50KB
            canvas.toBlob((secondBlob) => {
              const finalBlob = secondBlob || blob || file;
              const compressedFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }, "image/jpeg", 0.4);
          }
        }, "image/jpeg", 0.6);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  };

  const handleLegFileChange = async (legNum: number, key: keyof LegFiles, file: File | null) => {
    if (!file) {
      setFiles(prev => ({ ...prev, [legNum]: { ...prev[legNum], [key]: null } }));
      return;
    }
    
    // Explicitly block PDF files (FIX #2 Requirement)
    if (checkIsPdf(file) || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("PDF allowed nahi hai, sirf image (JPG/PNG) upload karein.");
      return;
    }

    const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif") || file.type.includes("heic") || file.type.includes("heif");
    
    let processedFile = file;
    const isImage = processedFile.type.startsWith("image/") || isHeic;
    
    if (isImage && !isHeic) {
      // Compress non-HEIC images larger than 50KB to make sure they are well under 2MB
      if (processedFile.size > 50 * 1024) {
        const toastId = toast.loading(`Compressing image... (${Math.round(processedFile.size / 1024)}KB)`);
        try {
          processedFile = await compressImage(processedFile);
          toast.dismiss(toastId);
          toast.success(`Compressed to ${Math.round(processedFile.size / 1024)}KB ✓`, { duration: 2000 });
        } catch {
          toast.dismiss(toastId);
        }
      }
    }
    
    // Validate final size (maximum 2MB)
    if (processedFile.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds the 2MB limit. Please upload a smaller file.");
      return;
    }
    
    setFiles(prev => ({
      ...prev,
      [legNum]: {
        ...prev[legNum],
        [key]: processedFile
      }
    }));
  };

  const removeLegFile = (legNum: number, key: keyof LegFiles) => {
    setFiles(prev => ({
      ...prev,
      [legNum]: {
        ...prev[legNum],
        [key]: null
      }
    }));
  };



  // ── TA/DA Rule E: Special base locations where DA is ALLOWED even during base-only travel ──
  // Employees based at PBM Medical College (Bikaner) or Mathura Das Mathur Hospital (Jodhpur)
  // receive DA even during base-location-only travel days.
  const SPECIAL_BASE_LOCATIONS = [
    "pbm medical college and hospital", "pbm medical college", "pbm hospital", "pbm",
    "mathura das mathur hospital", "mathura das mathur", "mdm hospital", "mdm"
  ];

  const isSpecialBaseLocation = (baseLocs: string[]): boolean => {
    return baseLocs.some(loc =>
      SPECIAL_BASE_LOCATIONS.some(special => loc.includes(special))
    );
  };
  // ────────────────────────────────────────────────────────────────────────

  const normalizeLoc = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/[,._-]/g, " ").replace(/\s+/g, " ").trim();
  };

  const parseBaseLocations = (baseReportingLocation: string): string[] => {
    if (!baseReportingLocation) return [];
    const raw = String(baseReportingLocation).trim();
    if (!raw) return [];
    const fullNorm = normalizeLoc(raw);
    const bases = [fullNorm];
    if (raw.includes(";") || raw.includes("|") || raw.includes("\n")) {
      const parts = raw.split(/[;|\n]/).map(x => normalizeLoc(x)).filter(Boolean);
      for (const p of parts) {
        if (p && !bases.includes(p)) bases.push(p);
      }
    }
    return bases;
  };

  const matchesBase = (locText: string, baseLocations: string[]) => {
    const normText = normalizeLoc(locText);
    if (!normText) return false;

    const bases = Array.isArray(baseLocations) ? baseLocations : parseBaseLocations(baseLocations);

    return bases.some(base => {
      const normBase = normalizeLoc(base);
      if (!normBase) return false;

      // 1. Exact match
      if (normText === normBase) return true;

      // 2. Substring match on normalized strings
      if (normText.includes(normBase) || normBase.includes(normText)) return true;

      // 3. Known specific hospital abbreviation logic
      if (normBase.includes("mathura das mathur") || normBase.includes("mdm")) {
        if (normText.includes("mdm") || normText.includes("mathura das")) return true;
        if (normText === "jodhpur" || normText === "jodhpur base" || normText === "mdm hospital") return true;
      }
      if (normBase.includes("pbm") || normBase.includes("bikaner")) {
        if (normText.includes("pbm")) return true;
        if (normText === "bikaner" || normText === "bikaner base" || normText === "pbm hospital") return true;
      }
      if (normBase.includes("jln") || normBase.includes("ajmer")) {
        if (normText.includes("jln")) return true;
        if (normText === "ajmer" || normText === "ajmer base" || normText === "jln hospital") return true;
      }
      return false;
    });
  };


  /**
   * True only when this leg is a direct commute between residence and base hospital.
   * Mirrors backend checkIsCommuteLeg().
   *
   * FIX: Residence is detected via content (residence words) as PRIMARY signal.
   * from_custom is a BOOSTER — helps in ambiguous cases but is NOT required.
   * This ensures Leg 1 "My Home, Jodhpur" (from_custom may be undefined/false)
   * is correctly identified as a residence for commute detection.
   */
  const isCommuteLeg = (leg: ItineraryLeg, baseLocations: string[], index?: number, totalLegs?: number): boolean => {
    const f = (leg.from || "").trim().toLowerCase();
    const t = (leg.to || "").trim().toLowerCase();

    // NOTE: "local" removed — too ambiguous ("local market", "local office" are work locations)
    const RESIDENCE_WORDS = ["home", "residence", "room", "quarter", "house", "flat", "pg", "stay",
      "village", "vill", "rent", "address", "dera", "deri", "hotel"];
    const WORK_WORDS = [
      "market", "bazaar", "bazar", "mandi", "haat", "shop", "store", "vendor", "dukan", "dukaan", "mart", "supermarket", "commercial market",
      "courier", "parcel", "transport", "dispatch", "post office", "post", "speedpost", "speed post", "dtdc", "delhivery", "bluedart", "blue dart", "tci", "cargo", "godown", "warehouse",
      "bus stand", "bus stop", "bus depot", "bus adda", "busstand", "busstop", "bus-stand", "bus-stop", "station", "railway", "rly", "rly station", "junction", "jn", "taxi stand", "auto stand",
      "repair", "repairing", "service", "service center", "collection", "pickup", "workshop", "garage", "mechanic", "spare parts", "spares", "hardware", "tools",
      "dealer", "distributor", "supplier", "agency", "firm", "surgicals", "surgical", "medical store", "chemist",
      "hospital", "chc", "phc", "dh", "sdh", "clinic", "lab", "customer", "site", "work", "office", "tower"
    ];

    const fromHasResidenceWord = RESIDENCE_WORDS.some(w => f.includes(w));
    const toHasResidenceWord   = RESIDENCE_WORDS.some(w => t.includes(w));
    const fromHasWorkWord      = WORK_WORDS.some(w => f.includes(w));
    const toHasWorkWord        = WORK_WORDS.some(w => t.includes(w));

    const isFirstLeg = index === 0;
    const isLastLeg  = (totalLegs !== undefined && index !== undefined) ? (index === totalLegs - 1) : false;

    // CRITICAL FIX: Residence detection requires BOTH residence word AND no work word.
    // "Local Market" has "local" (residence) + "market" (work) → NOT a residence.
    // "My Home, Jodhpur" has "home" (residence) + no work word → IS a residence.
    // from_custom is an additional BOOSTER for ambiguous non-work-word cases.
    const fromIsResidence =
      (fromHasResidenceWord && !fromHasWorkWord)  // content-first: has residence keyword AND no work keyword
      || (!!leg.from_custom && !fromHasWorkWord && (fromHasResidenceWord || (isFirstLeg && !fromHasWorkWord)))
      || (isFirstLeg && !fromHasWorkWord && !matchesBase(f, baseLocations) && f.length > 0);
    const toIsResidence =
      (toHasResidenceWord && !toHasWorkWord)      // content-first: has residence keyword AND no work keyword
      || (!!leg.to_custom   && !toHasWorkWord   && (toHasResidenceWord   || (isLastLeg  && !toHasWorkWord)))
      || (isLastLeg  && !toHasWorkWord   && !matchesBase(t, baseLocations) && t.length > 0);

    const fromIsBase = matchesBase(f, baseLocations);
    const toIsBase   = matchesBase(t, baseLocations);

    // Edge-case: a location cannot be both residence AND base at the same time
    if (fromIsResidence && fromIsBase) return false;
    if (toIsResidence   && toIsBase)   return false;
    if (fromIsResidence && toIsBase)   return true;  // Home → Base
    if (fromIsBase      && toIsResidence) return true;  // Base → Home
    if (fromIsBase      && toIsBase)   return true;  // Base → Base (e.g. JLN Medical College → JLN Hospital)
    return false;
  };

  const isBaseLocationOnlyTravel = (legs: ItineraryLeg[] = itineraries) => {
    if (!user || !user.base_reporting_location) return false;
    const baseLocations = parseBaseLocations(user.base_reporting_location);
    if (baseLocations.length === 0) return false;

    // EXCLUSION: If any leg has travel_type === "Outdoor", policy is completely disabled
    const hasOutdoorLeg = legs.some(leg => (leg.travel_type || "").trim().toLowerCase() === "outdoor");
    if (hasOutdoorLeg) return false;



    // Healthcare facility keywords matched at word boundaries to avoid matching substrings like "gandhi" (dh)
    const HEALTHCARE_FACILITY_REGEX = /\b(chc|uchc|phc|sdh|dh|hospital|hosp|college|collage|dispensary|subcenter|sub-center|sub center|ddw|warehouse|uphc|up-hc|up hc)\b/i;

    // List of Rajasthan Districts for Out-Station travel validation
    const RAJASTHAN_DISTRICTS = [
      "ajmer", "alwar", "banswara", "baran", "barmer", "bharatpur", "bhilwara", "bikaner",
      "bundi", "chittorgarh", "churu", "dausa", "dholpur", "dungarpur", "ganganagar", "sri ganganagar",
      "hanumangarh", "jaipur", "jaisalmer", "jalore", "jhalawar", "jhunjhunu", "jodhpur", "karauli",
      "kota", "nagaur", "pali", "pratapgarh", "rajsamand", "sawai madhopur", "sikar",
      "sirohi", "tonk", "udaipur", "anupgarh", "balotra", "beawar", "deeg", "didwana", "kuchaman",
      "dudu", "gangapur", "jaipur rural", "jodhpur rural", "kekri", "kotputli", "behror",
      "khairthal", "tijara", "neem ka thana", "phalodi", "salumbar", "sanchore", "shahpura"
    ];

    const isOfficialNonBaseFacility = (locText: string, leg?: ItineraryLeg) => {
      if (!locText) return false;
      const clean = locText.trim().toLowerCase();
      const normalized = clean.replace(/[-_]/g, " ");

      // If it matches base location → it is base, NOT a non-base facility
      if (matchesBase(clean, baseLocations)) return false;

      // 1. Must match an official healthcare facility keyword at word boundaries
      if (HEALTHCARE_FACILITY_REGEX.test(clean) || HEALTHCARE_FACILITY_REGEX.test(normalized)) {
        return true;
      }

      // 2. Activity = "Other": ONLY allow DA if location contains a non-base Rajasthan district name OR bus/train ticket is present
      if (leg) {
        const act = ((leg as any).activity || (leg as any).activity_type || "").trim().toLowerCase();
        const isOther = act.includes("other");
        const mode = ((leg as any).mode || "").trim().toLowerCase();
        const subMode = ((leg as any).sub_mode || "").trim().toLowerCase();
        const isBusOrTrain = mode.includes("bus") || mode.includes("train") || subMode.includes("bus") || subMode.includes("train");
        const hasTicketOrFare = parseFloat((leg as any).train_bus_amount || leg.sub_amount || (leg as any).hotel || "0") > 0;

        const fromText = (leg.from || "").trim().toLowerCase();
        const toText = (leg.to || "").trim().toLowerCase();

        const hasNonBaseRajasthanDistrict = RAJASTHAN_DISTRICTS.some(dist =>
          (fromText.includes(dist) || toText.includes(dist)) && !matchesBase(dist, baseLocations)
        );

        // STRICT RULE: If Activity is "Other", ONLY allow DA if Rajasthan District name is written OR Bus/Train ticket is attached. Otherwise DENY DA.
        if (isOther) {
          return hasNonBaseRajasthanDistrict || isBusOrTrain || hasTicketOrFare;
        }

        // Non-"Other" legs with Bus/Train ticket
        if ((isBusOrTrain || hasTicketOrFare) && hasNonBaseRajasthanDistrict) {
          return true;
        }
      }

      return false;
    };

    const visitedNonBaseOfficialFacility = legs.some(leg => {
      const fromLoc = leg.from || "";
      const toLoc   = leg.to   || "";
      return isOfficialNonBaseFacility(fromLoc, leg) || isOfficialNonBaseFacility(toLoc, leg);
    });

    return !visitedNonBaseOfficialFacility;
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 LOCKED POLICY LOGIC — DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL 🔒
  // TA/DA Base Location policy — confirmed & finalized business rule (mirrors
  // backend computeBaseLocPolicy() in expense.js). AI assistants / developers:
  // do NOT alter this rule's behavior, refactor it, "optimize" it, or change
  // its conditions for ANY reason unless the user EXPLICITLY asks to change
  // THIS specific rule. If unsure, STOP and ask first.
  //
  //   1. Home → Base (direct) or Base → Home (direct), nothing else that day
  //        → TA NOT allowed on that leg (see isCommuteLeg — always denies
  //          boundary residence↔base legs, no exceptions).
  //   2. Home → Base → [market/bus-stand/courier/repairing/pickup errands]
  //      → Base → Home
  //        → TA allowed ONLY on the errand legs in between. Boundary legs
  //          (Home→Base, Base→Home) still NEVER get TA.
  //        → DA NOT allowed — no real "other facility" was visited — EXCEPT
  //          for PBM (Bikaner) / MDM (Jodhpur) base locations, which ALWAYS
  //          get DA in this scenario regardless of market/courier/repairing/
  //          pickup errands (isDaAllowedBaseLocation does not depend on
  //          hasMarket).
  //        → Exception to the exception: if the errand involves a
  //          station/bus-stand (hasStation), DA is NOT allowed even for
  //          PBM/MDM — station/bus-stand travel is treated differently.
  //   3. Home → Other facility → Home (base never touched that day)
  //        → TA/DA fully allowed on all legs.
  //   4. Home → Base → Other facility → Home
  //        → TA NOT allowed only on the Home→Base leg; everything else
  //          (TA and DA) is allowed.
  //   5. Home → Other facility → Base → Home
  //        → TA NOT allowed only on the Base→Home leg; everything else
  //          (TA and DA) is allowed.
  //
  //   NOTE: An older "official activities" override (Calls/PMS/Asset Tagging/
  //   Calibration present on a leg → auto-allow DA at base location) used to
  //   sit right after the guard clauses below and silently bypass all 5 rules
  //   above. It was explicitly removed on user instruction because it
  //   defeated the whole point of this policy. Do NOT re-add an
  //   activity-based DA override here.
  // ═══════════════════════════════════════════════════════════════════════════
  const isStationLocation = (locText: string) => {
    if (!locText) return false;
    const clean = locText.trim().toLowerCase();
    const normalized = clean.replace(/[-_]/g, " ");
    const stationWords = [
      "station", "railway", "rly", "bus stand", "busstand", "bus-stand",
      "bus stop", "busstop", "bus-stop", "bus depot", "busdepot", "bus adda",
      "busadda", "bus-adda", "stand", "depot"
    ];
    return stationWords.some(w => clean.includes(w) || normalized.includes(w));
  };

  const isDailyAllowanceAllowed = (legs: ItineraryLeg[] = itineraries) => {
    if (!isBaseLocationOnlyTravel(legs)) return true;
    if (!user || !user.base_reporting_location) return true;

    const baseLocations = user.base_reporting_location
      ? user.base_reporting_location.split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean)
      : [];

    const hasStation = legs.some(leg => {
      const fromLoc = leg.from || "";
      const toLoc = leg.to || "";
      return isStationLocation(fromLoc) || isStationLocation(toLoc);
    });

    // Rule E: PBM Bikaner / MDM Jodhpur → DA always allowed in base-only travel,
    // regardless of market/courier/repairing/pickup errands (see 🔒 LOCKED comment above).
    const isDaAllowedBaseLocation = isSpecialBaseLocation(baseLocations);

    if (hasStation) {
      return false;
    }

    if (isDaAllowedBaseLocation) {
      return true;
    }

    return false;
  };

  const calculateTotals = () => {
    let totalKmVal = 0;
    let totalAmtVal = 0;
    let totalAutoVal = 0;
    let totalDAVal = 0;
    let totalHotelVal = 0;
    let totalOtherVal = 0;
    let totalLocalPurchaseVal = 0;
    let totalBikeCarKmVal = 0;
    let totalBikeCarAmtVal = 0;

    const isBaseLocOnly = isBaseLocationOnlyTravel();
    const isDaAllowed = isDailyAllowanceAllowed();
    const baseLocs = (user?.base_reporting_location || "")
      .split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean);

    itineraries.forEach((leg, index) => {
      const legNum = index + 1;
      const legKm = parseFloat(leg.km) || 0;
      // Only zero TA for actual Home ↔ Base Hospital commute legs, not all legs
      const isCommute = isBaseLocOnly && isCommuteLeg(leg, baseLocs, index, itineraries.length);
      const legAmt = isCommute ? 0 : (parseFloat(leg.amount) || 0);
      const subAmt = isCommute ? 0 : (parseFloat(leg.sub_amount) || 0);
      const otherAmt = parseFloat(leg.oth_amount) || 0;

      if (leg.mode === "Bike" || leg.mode === "Car") {
        totalKmVal += legKm;
        totalBikeCarKmVal += legKm;
        totalBikeCarAmtVal += legAmt;
      }
      if (leg.mode === "Auto") {
        totalAutoVal += legAmt;
      }
      if (leg.sub_mode === "Auto") {
        totalAutoVal += subAmt;
      }

      totalAmtVal += legAmt + subAmt + otherAmt;
      totalOtherVal += otherAmt;

      if (legNum === 1) {
        const daAmt = isDaAllowed ? (parseFloat(leg.da) || 0) : 0;
        const hotelAmt = parseFloat(leg.hotel) || 0;
        const lpAmt = parseFloat(leg.local_purchase) || 0;
        totalAmtVal += daAmt + hotelAmt + lpAmt;
        totalDAVal += daAmt;
        totalHotelVal += hotelAmt;
        totalLocalPurchaseVal += lpAmt;
      }
    });

    return { 
      totalKm: totalKmVal, 
      totalAmt: totalAmtVal, 
      totalAuto: totalAutoVal, 
      totalDA: totalDAVal, 
      totalHotel: totalHotelVal, 
      totalOther: totalOtherVal,
      totalLocalPurchase: totalLocalPurchaseVal,
      totalBikeCarKm: totalBikeCarKmVal,
      totalBikeCarAmt: totalBikeCarAmtVal
    };
  };

  const { totalKm, totalAmt, totalAuto, totalDA, totalHotel, totalOther, totalLocalPurchase, totalBikeCarKm, totalBikeCarAmt } = calculateTotals();

  // Compute aggregate visit metrics across all itineraries
  const totalCallsAttended = itineraries.reduce((sum, leg) => {
    return sum + (leg.calls_list || []).filter(c => c.status === "Attend" || c.status === "Attend & Close").length;
  }, 0);

  const totalCallsClosed = itineraries.reduce((sum, leg) => {
    return sum + (leg.calls_list || []).filter(c => c.status === "Close" || c.status === "Attend & Close").length;
  }, 0);

  const totalPmsDone = itineraries.reduce((sum, leg) => {
    return sum + (leg.pms_list || []).length;
  }, 0);

  const totalAssetsTagged = itineraries.reduce((sum, leg) => {
    return sum + (leg.assets_list || []).reduce((s, item) => s + (parseInt(item.quantity || "0") || 0), 0);
  }, 0);

  const totalMobiliseAsset = itineraries.reduce((sum, leg) => {
    return sum + (parseInt(leg.mobilise_asset_count || "0") || 0);
  }, 0);

  const totalCalibration = itineraries.reduce((sum, leg) => {
    return sum + (parseInt(leg.calibration_count || "0") || 0);
  }, 0);

  const checkLimitsExceeded = () => {
    const maxKmAllowed = (allowance.max_km_per_month || 0) + approvedKm;
    const maxAutoAllowed = (allowance.max_auto_per_month || 0) + approvedAuto;

    let limitType: "KM" | "AUTO" | null = null;
    let excess = 0;

    if ((allowance.current_month_km + totalKm) > maxKmAllowed) {
      limitType = "KM";
      excess = (allowance.current_month_km + totalKm) - maxKmAllowed;
    } else if ((allowance.current_month_auto + totalAuto) > maxAutoAllowed) {
      limitType = "AUTO";
      excess = (allowance.current_month_auto + totalAuto) - maxAutoAllowed;
    }

    return { limitType, excess };
  };

  const { limitType, excess } = checkLimitsExceeded();
  const isLimitExceeded = limitType !== null;

  useEffect(() => {
    if (isLimitExceeded && !hasShownExceededModal) {
      setExceededType(limitType!);
      setReqAdditional(excess.toFixed(2));
      setHasShownExceededModal(true);
      setShowApprovalModal(true);
    } else if (!isLimitExceeded) {
      setHasShownExceededModal(false);
    }
  }, [isLimitExceeded, limitType, excess]);

  const validateClaim = (customItineraries?: ItineraryLeg[]) => {
    const listToValidate = customItineraries || itineraries;
    if (!date) {
      setValidationModal({
        show: true,
        title: "Missing Travel Date",
        message: "Please choose a travel date first before submitting."
      });
      return false;
    }

    if (minDate && date < minDate) {
      setValidationModal({
        show: true,
        title: "Invalid Travel Date",
        message: `Expense date cannot be earlier than ${minDate}.`
      });
      return false;
    }
    if (maxDate && date > maxDate) {
      setValidationModal({
        show: true,
        title: "Invalid Travel Date",
        message: `Expense date cannot be later than ${maxDate}.`
      });
      return false;
    }

    // Minimum 2 visits required for expense submission
    if (listToValidate.length < 2) {
      setValidationModal({
        show: true,
        title: "Minimum Visits Required",
        message: "Minimum 2 visits are required to submit an expense claim."
      });
      return false;
    }

    for (let idx = 0; idx < listToValidate.length; idx++) {
      const leg = listToValidate[idx];
      const legNum = idx + 1;

      if (!leg.from.trim()) {
        setValidationModal({
          show: true,
          title: `Visit ${legNum}: Missing Starting Location`,
          message: "Please enter the starting location (From)."
        });
        return false;
      }
      // Leg 1 In-District: From must contain Home, Room, or Hotel (case-insensitive)
      if (legNum === 1 && leg.travel_type === "In-District") {
        const fromLower = leg.from.trim().toLowerCase();
        const hasResidenceWord = ["home", "room", "hotel"].some(w => fromLower.includes(w));
        if (!hasResidenceWord) {
          setValidationModal({
            show: true,
            title: "Visit 1: Invalid Starting Location",
            message: "For In-District expense, the Starting Location (From) must mention where you started from.\n\nIt must contain one of:\n\u2022 Home  \u2022 Room  \u2022 Hotel\n\nExamples: \"My Home, Jodhpur\", \"Rented Room\", \"Hotel XYZ\"\n\nPlease update the Starting Location (From) field."
          });
          return false;
        }
      }
      if (!leg.to.trim()) {
        setValidationModal({
          show: true,
          title: `Visit ${legNum}: Missing Destination Location`,
          message: "Please enter the destination location (To)."
        });
        return false;
      }
      // Same from/to location not allowed in a single leg
      if (leg.from.trim().toLowerCase() === leg.to.trim().toLowerCase()) {
        setValidationModal({
          show: true,
          title: `Visit ${legNum}: Same Locations`,
          message: "Starting location (From) and Destination (To) cannot be the same."
        });
        return false;
      }
      if (!leg.mode) {
        setValidationModal({
          show: true,
          title: `Visit ${legNum}: Missing Travel Mode`,
          message: "Please select a travel mode."
        });
        return false;
      }

      if (leg.mode === "Bike" || leg.mode === "Car") {
        const kmVal = parseFloat(leg.km) || 0;
        if (kmVal <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Distance`,
            message: "Please enter a distance greater than 0 KM."
          });
          return false;
        }
      } else {
        const amtVal = parseFloat(leg.amount) || 0;
        if (amtVal <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Amount`,
            message: "Please enter a valid fare amount."
          });
          return false;
        }
      }

      const mainBill = files[legNum]?.main_bill;
      const modeLower = (leg.mode || "").trim().toLowerCase();
      const hasMainAttachment = mainBill || hasExistingFile(legNum, leg.mode) || hasExistingFile(legNum, modeLower);
      const mainAmt = parseFloat(leg.amount) || 0;

      if (modeLower === "train") {
        // Train: bill always required (any amount ≥ ₹1)
        if (mainAmt >= 1 && !hasMainAttachment) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Train Ticket Required`,
            message: "Train ticket / receipt upload is mandatory for Train travel. Please attach your train ticket before submitting."
          });
          return false;
        }
      } else if (modeLower !== "bike" && modeLower !== "car") {
        // All non-bike, non-car paid modes (Auto, Bus, Taxi, Flight, Company Provided, etc.): bill required when fare ≥ ₹300
        if (mainAmt >= 300 && !hasMainAttachment) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: ${leg.mode} Receipt Required`,
            message: `${leg.mode} fare is ₹${mainAmt.toFixed(0)} (₹300 or more). Please upload the ${leg.mode} receipt / ticket before submitting.`
          });
          return false;
        }
      }

      if (leg.sub_mode) {
        const subAmt = parseFloat(leg.sub_amount) || 0;
        if (subAmt <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Sub-connection Fare`,
            message: "Please enter a valid sub-connection fare."
          });
          return false;
        }
        const subBill = files[legNum]?.sub_bill;
        const subModeLower = (leg.sub_mode || "").trim().toLowerCase();
        const hasSubAttachment = subBill || hasExistingFile(legNum, leg.sub_mode) || hasExistingFile(legNum, subModeLower);

        if (subModeLower === "train") {
          // Sub Train: bill always required (any amount ≥ ₹1)
          if (subAmt >= 1 && !hasSubAttachment) {
            setValidationModal({
              show: true,
              title: `Visit ${legNum}: Sub-connection Train Ticket Required`,
              message: "Train ticket upload is mandatory for sub-connection travel. Please attach the ticket before submitting."
            });
            return false;
          }
        } else if (subModeLower !== "bike" && subModeLower !== "car") {
          // Non-bike, non-car sub-modes: bill required when fare ≥ ₹300
          if (subAmt >= 300 && !hasSubAttachment) {
            setValidationModal({
              show: true,
              title: `Visit ${legNum}: Sub-connection ${leg.sub_mode} Receipt Required`,
              message: `Sub-connection ${leg.sub_mode} fare is ₹${subAmt.toFixed(0)} (₹300 or more). Please upload the receipt before submitting.`
            });
            return false;
          }
        }
      }


      if (leg.travel_type === "Outdoor") {
        if (!leg.district_from) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Starting District`,
            message: "Please select the starting district."
          });
          return false;
        }
        if (!leg.district) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Destination District`,
            message: "Please select the destination district."
          });
          return false;
        }
        // Allowed user to choose any district (including the same district) for starting and destination locations during outdoor travel
        // if (leg.district_from === leg.district) {
        //   setValidationModal({
        //     show: true,
        //     title: `Visit ${legNum}: Same Districts`,
        //     message: "The starting and destination districts must be different for outdoor travel."
        //   });
        //   return false;
        // }
      }

      if (legNum === 1) {
        const hotelAmt = parseFloat(leg.hotel) || 0;
        const hotelBill = files[1]?.hotel_bill;
        const hasHotelAttachment = hotelBill || hasExistingFile(1, "Hotel");
        if (hotelAmt >= 1 && !hasHotelAttachment) {
          setValidationModal({
            show: true,
            title: "Visit 1: Missing Hotel stay receipt",
            message: "Please upload your hotel stay receipt."
          });
          return false;
        }

        const lpAmt = parseFloat(leg.local_purchase) || 0;
        if (lpAmt > 0 && !leg.local_purchase_remark?.trim()) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Local Purchase Remark`,
            message: "Local Purchase Remark is compulsory when a local purchase amount is entered. Please describe what items were purchased."
          });
          return false;
        }

        const lpBill = files[1]?.local_purchase_bill;
        const hasLpAttachment = lpBill || hasExistingFile(1, "Local_Purchase");
        if (lpAmt >= 300 && !hasLpAttachment) {
          setValidationModal({
            show: true,
            title: "Visit 1: Missing Local Purchase receipt",
            message: "Please upload a receipt for local purchase since the amount is ₹300 or more."
          });
          return false;
        }
      }

      if (leg.oth_desc.trim()) {
        const othAmt = parseFloat(leg.oth_amount) || 0;
        if (othAmt <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Other Amount`,
            message: "Please enter a valid amount for other expenses."
          });
          return false;
        }
        const othBill = files[legNum]?.oth_bill;
        const hasOthAttachment = othBill || hasExistingFile(legNum, "Other_Expense");
        if (othAmt >= 300 && !hasOthAttachment) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Other Receipt`,
            message: "Please upload a receipt screenshot for other expenses since the amount is ₹300 or more."
          });
          return false;
        }
      }

      // Dynamic activities validations
      const acts = leg.selected_activities || [];
      if (acts.length === 0) {
        setValidationModal({
          show: true,
          title: `Visit ${legNum}: No Activity Selected`,
          message: "Please select at least one activity (Calls, PMS, Asset Tagging, etc.)"
        });
        return false;
      }
      
      if (acts.includes("Calls")) {
        if ((leg.calls_list || []).length === 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Calls Selected but Not Added`,
            message: `You have selected "Calls" in Visit ${legNum}, but you have not added the call record.\n\nPlease scroll to Calls under Visit ${legNum}, enter the 8-digit barcode, click "VERIFY" to check, select the Call Type, Status, upload the Service Report photo, and click the add button (+).`
          });
          return false;
        }
        // Check all added calls have a service report photo
        const callsWithoutPhoto = (leg.calls_list || []).filter(c => !c.photo_url);
        if (callsWithoutPhoto.length > 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Service Report Photo`,
            message: `You have added ${callsWithoutPhoto.length} call entry(s) in Visit ${legNum} that are missing the Service Report photo.\n\nPlease upload the Service Report photo for each Call in the list. Service Report is compulsory for all Calls.`
          });
          return false;
        }
      }

      if (acts.includes("PMS")) {
        if ((leg.pms_list || []).length === 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: PMS Selected but Not Added`,
            message: `You have selected "PMS" in Visit ${legNum}, but you have not added the PMS record.\n\nPlease scroll to PMS under Visit ${legNum}, enter the 8-digit barcode, click "VERIFY", select the PMS Period (3/6/12 Month), upload the report/equipment photo, and click the add button (+).`
          });
          return false;
        }
      }

      if (acts.includes("Asset Tagging")) {
        if ((leg.assets_list || []).length === 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Asset Tagging Details`,
            message: "Please add at least one tagged equipment and quantity."
          });
          return false;
        }
      }

      if (acts.includes("Mobilise Asset Update")) {
        const qty = parseInt(leg.mobilise_asset_count || "0") || 0;
        if (qty <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Mobilise Asset Count`,
            message: "Please enter a valid quantity for Mobilise Asset Update."
          });
          return false;
        }
      }

      if (acts.includes("Calibration")) {
        const qty = parseInt(leg.calibration_count || "0") || 0;
        if (qty <= 0) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Invalid Calibration Count`,
            message: "Please enter a valid quantity for Calibration."
          });
          return false;
        }
      }

      if (acts.includes("Other")) {
        if (!leg.activity_other_desc || !leg.activity_other_desc.trim()) {
          setValidationModal({
            show: true,
            title: `Visit ${legNum}: Missing Other Activity Description`,
            message: "Please enter description for Other activity."
          });
          return false;
        }
      }
    }

    return true;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-add any unadded asset tagging equipment selection to the list
    const processedItineraries = itineraries.map(l => {
      if (l.selected_activities?.includes("Asset Tagging") && l.asset_tagging_equipment) {
        const qty = parseInt(l.asset_tagging_quantity || "0") || 0;
        if (qty > 0) {
          const currentList = l.assets_list || [];
          if (!currentList.some(item => item.equipment_name === l.asset_tagging_equipment)) {
            return {
              ...l,
              assets_list: [...currentList, { equipment_name: l.asset_tagging_equipment, quantity: qty.toString() }],
              asset_tagging_equipment: "",
              asset_tagging_quantity: ""
            };
          }
        }
      }
      return l;
    });

    setItineraries(processedItineraries);
    validatedItinerariesRef.current = processedItineraries;

    if (!validateClaim(processedItineraries)) return;

    // ── Call server-side Policy Evaluation API BEFORE opening confirmation modal ──
    try {
      const evalRes = await expenseService.evaluatePolicy({
        user_id: currentUserId,
        itinerary_legs: processedItineraries
      });

      if (evalRes && evalRes.hasDeductions && evalRes.items && evalRes.items.length > 0) {
        setBaseLocDeductions({
          hasDeductions: true,
          policyMessage: evalRes.policyMessage || "Base Location Policy: Deductions applied as per policy.",
          items: evalRes.items
        });
      } else {
        setBaseLocDeductions(null);
      }
    } catch (err) {
      console.warn("Failed to pre-evaluate policy via API, using local fallback:", err);
      // Fallback calculation in case of network issue
      const deductionItems: { leg: number; from: string; to: string; taDeducted: number; daDeducted: number }[] = [];
      const baseLocs = user.base_reporting_location
        ? user.base_reporting_location.split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean)
        : [];
      const isBaseLocOnly = isBaseLocationOnlyTravel(processedItineraries);
      const isDAAllowed = isDailyAllowanceAllowed(processedItineraries);

      if (isBaseLocOnly) {
        processedItineraries.forEach((leg, idx) => {
          const legNum = idx + 1;
          const origTA = parseFloat(leg.amount || "0") + parseFloat(leg.sub_amount || "0");
          const origDA = legNum === 1 ? parseFloat(leg.da || "0") : 0;
          const isCommute = isCommuteLeg(leg, baseLocs, idx, processedItineraries.length);
          const taDeducted = isCommute ? origTA : 0;
          const daDeducted = isDAAllowed ? 0 : origDA;
          if (taDeducted > 0 || daDeducted > 0) {
            deductionItems.push({ leg: legNum, from: leg.from, to: leg.to, taDeducted, daDeducted });
          }
        });
      }

      if (deductionItems.length > 0) {
        setBaseLocDeductions({
          hasDeductions: true,
          policyMessage: "Base Location Policy: Deductions applied as per policy.",
          items: deductionItems
        });
      } else {
        setBaseLocDeductions(null);
      }
    }

    setShowConfirmModal(true);
  };

  const doSubmit = async () => {
    if (isLimitExceeded) {
      toast.error("Submission is locked due to limit overflow.");
      return;
    }

    const activeItineraries = (validatedItinerariesRef.current && validatedItinerariesRef.current.length >= 2)
      ? validatedItinerariesRef.current
      : itineraries;

    if (!activeItineraries || activeItineraries.length < 2) {
      toast.error("Minimum 2 visits are required to submit an expense claim.");
      setShowConfirmModal(false);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("user_id", currentUserId);
      formData.append("exp_date", date);
      formData.append("total_amount", totalAmt.toFixed(2));
      if (editExpenseId) {
        formData.append("edit_expense_id", editExpenseId);
      }
      const getLocalTimestamp = () => {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      formData.append("client_timestamp", getLocalTimestamp());

      const hasOutdoorLeg = activeItineraries.some(l => (l.travel_type || "").trim().toLowerCase() === "outdoor");
      const overallDistrictCategory = hasOutdoorLeg ? "OUT_DISTRICT" : "IN_DISTRICT";
      formData.append("district_type", overallDistrictCategory);
      formData.append("districtCategory", overallDistrictCategory);
      const isBaseLocOnly = isBaseLocationOnlyTravel(activeItineraries);
      const isDAAllowed = isDailyAllowanceAllowed(activeItineraries);

      // Compute deductions directly from current itineraries to avoid stale state/closure issue
      const deductionItems: { leg: number; from: string; to: string; taDeducted: number; daDeducted: number }[] = [];
      let policyMsg = "";

      if (!hasOutdoorLeg) {
        if (isBaseLocOnly && !isDAAllowed) {
          policyMsg = "Under base location policy, both Travel Allowance (TA) and Daily Allowance (DA) are not eligible.";
        } else {
          policyMsg = "Under base location policy, Travel Allowance (TA) for commute legs (Home ↔ Base Hospital) is not eligible.";
        }

        const baseLocs2 = user.base_reporting_location
          ? user.base_reporting_location.split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean)
          : [];

        activeItineraries.forEach((leg, idx) => {
          const legNum = idx + 1;
          const origTA = parseFloat(leg.amount || "0");
          const origSub = parseFloat(leg.sub_amount || "0");
          const origDA = legNum === 1 ? parseFloat(leg.da || "0") : 0;
          // Only deduct TA for commute legs (Home ↔ Base Hospital)
          const isCommute = isCommuteLeg(leg, baseLocs2, idx, activeItineraries.length);
          const taDeducted = isCommute ? origTA + origSub : 0;
          const daDeducted = isDAAllowed ? 0 : origDA;
          if (taDeducted > 0 || daDeducted > 0) {
            deductionItems.push({ leg: legNum, from: leg.from || "", to: leg.to || "", taDeducted, daDeducted });
          }
        });
      }

      const deductionSnapshot = deductionItems.length > 0
        ? { policyMessage: policyMsg, items: deductionItems }
        : null;

      // Base locations list — reused in payload builder below
      const baseLocs3 = user.base_reporting_location
        ? user.base_reporting_location.split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean)
        : [];

      const itinerariesData = activeItineraries.map((leg, index) => {
        const legNum = index + 1;
        const rawActs = leg.selected_activities || [];
        const callsList = leg.calls_list || [];
        const pmsList = leg.pms_list || [];
        const assetsList = leg.assets_list || [];
        const calibCount = parseInt(leg.calibration_count || "0") || 0;
        const mobCount = parseInt(leg.mobilise_asset_count || "0") || 0;

        const acts: string[] = [];
        if (callsList.length > 0) acts.push("Calls");
        if (pmsList.length > 0) acts.push("PMS");
        if (assetsList.length > 0) acts.push("Asset Tagging");
        if (calibCount > 0) acts.push("Calibration");
        if (mobCount > 0) acts.push("Mobilisation");
        if (rawActs.includes("Other") || (leg.activity_other_desc && leg.activity_other_desc.trim()) || (leg.oth_desc && leg.oth_desc.trim())) {
          acts.push("Other");
        }

        // Compute CRM work metrics based on actual list entries
        const ws_assigned = callsList.length;
        const ws_closed = callsList.filter((c: any) => c.status === "Close" || c.status === "Attend & Close" || c.barcode).length;
        const ws_pms = pmsList.filter((p: any) => p.barcode || p.status === "Close" || p.status === "Attended").length;
        const ws_asset = assetsList.reduce((sum: number, item: any) => sum + (parseInt(item.quantity || "0") || 0), 0);

        const detailsObj = {
          state: leg.state || "Rajasthan",
          dest_state: leg.dest_state || "Rajasthan",
          is_out_of_state: leg.travel_type === "Out of State" || (leg.dest_state && leg.dest_state !== leg.state),
          travel_type: leg.travel_type,
          selected_activities: acts,
          calls_barcode: leg.calls_barcode || "",
          calls_verified: !!leg.calls_verified,
          calls_asset_details: leg.calls_asset_details || null,
          calls_type: leg.calls_type || "Support Call",
          calls_status: leg.calls_status || "Attend",
          pms_barcode: leg.pms_barcode || "",
          pms_verified: !!leg.pms_verified,
          pms_asset_details: leg.pms_asset_details || null,
          pms_frequency: leg.pms_frequency || "3 month",
          asset_tagging_equipment: leg.asset_tagging_equipment || "",
          asset_tagging_quantity: leg.asset_tagging_quantity || "0",
          mobilise_asset_count: mobCount.toString(),
          calibration_count: calibCount.toString(),
          activity_other_desc: leg.activity_other_desc || "",
          calls_list: callsList,
          pms_list: pmsList,
          assets_list: assetsList
        };

        const isLegCommute = !hasOutdoorLeg && isCommuteLeg(leg, baseLocs3, index, activeItineraries.length);

        return {
          leg: legNum,
          travel_type: leg.travel_type,
          district_from: leg.district_from || user.home_district,
          district: leg.district,
          state: leg.state || "Rajasthan",
          dest_state: leg.dest_state || "Rajasthan",
          from: leg.from,
          from_custom: !!leg.from_custom,
          to: leg.to,
          to_custom: !!leg.to_custom,
          mode: leg.mode,
          km: leg.km,
          // Only zero TA for actual commute legs (Home ↔ Base Hospital); other legs keep their TA
          amount: isLegCommute ? "0" : leg.amount,
          sub_mode: leg.sub_mode,
          sub_amount: isLegCommute ? "0" : leg.sub_amount,
          da: legNum === 1 ? (isDAAllowed ? leg.da : "0") : "0",
          hotel: legNum === 1 ? leg.hotel : "0",
          local_purchase: legNum === 1 ? leg.local_purchase : "0",
          local_purchase_remark: legNum === 1 ? (leg.local_purchase_remark || "") : "",
          company_provided: legNum === 1 ? !!leg.company_provided : false,
          oth_desc: leg.oth_desc,
          oth_amount: leg.oth_amount,
          ws_assigned: ws_assigned.toString(),
          ws_closed: ws_closed.toString(),
          ws_pms: ws_pms.toString(),
          ws_asset: ws_asset.toString(),
          calibration_count: calibCount.toString(),
          mobilise_asset_count: mobCount.toString(),
          visit_purpose: acts.length > 0 ? `Activities: ${acts.join(", ")}` : "Field visit",
          activity_details: JSON.stringify(detailsObj)
        };
      });

      formData.append("itineraries", JSON.stringify(itinerariesData));

      // Append files
      activeItineraries.forEach((_, index) => {
        const legNum = index + 1;
        const legFiles = files[legNum];
        if (legFiles) {
          if (legFiles.main_bill) formData.append(`main_bill_${legNum}`, legFiles.main_bill);
          if (legFiles.sub_bill) formData.append(`sub_bill_${legNum}`, legFiles.sub_bill);
          if (legFiles.comm_mail) formData.append(`comm_mail_${legNum}`, legFiles.comm_mail);
          if (legFiles.oth_bill) formData.append(`oth_bill_${legNum}`, legFiles.oth_bill);
          if (legNum === 1 && legFiles.hotel_bill && !itineraries[0].company_provided) formData.append("hotel_bill_1", legFiles.hotel_bill);
          if (legNum === 1 && legFiles.local_purchase_bill) formData.append("local_purchase_bill_1", legFiles.local_purchase_bill);
        }
      });
      formData.append("deleted_attachments", JSON.stringify(deletedAttachments));

      const res = await expenseService.submitItineraryExpense(formData);
      if (res.success || res.status === "success") {

        // Use backend's auto_approved flag — most reliable source of truth
        const isAutoApproved = !!res.auto_approved;
        const finalDeductions = res.deductions || deductionSnapshot;
        const hasPolicyDeductions = finalDeductions && finalDeductions.items && finalDeductions.items.length > 0;
        const successMessage = isAutoApproved
          ? (res.message || (hasPolicyDeductions
              ? "Your claim has been auto-approved since the total reimbursable amount is ₹0 after base location policy deductions. No manager approval is required."
              : "Your claim has been auto-approved since the total reimbursable amount is ₹0. No manager approval is required."))
          : "Your reimbursement claim has been successfully recorded and forwarded to your reporting manager for approval.";

        setSubmitStatus({
          type: "success",
          title: isAutoApproved ? "Auto Approved!" : "Claim Submitted!",
          message: successMessage,
          claimCode: res.expense_code,
          deductions: finalDeductions
        });
        setShowConfirmModal(false);
        
        // Reset form
        const targetMonth = date ? date.slice(0, 7) : getISTMonth();
        resetForm();
        
        // Clear limits cache to force refetch
        const cacheKey = `cache_month_limits_${currentUserId}_${targetMonth}`;
        localStorage.removeItem(cacheKey);
        
        // Invalidate prefetch memory cache
        prefetchManager.invalidateMyExpenses(currentUserId || "");
        
        await fetchMonthLimits(targetMonth, false);
        await fetchClaims();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.error || err.message || "Failed to submit claim.";
      setSubmitStatus({
        type: "error",
        title: "Submission Failed",
        message: errMsg
      });
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const sendApprovalRequest = async () => {
    if (!reqAdditional || parseFloat(reqAdditional) <= 0) {
      toast.error("Please enter a valid extension amount.");
      return;
    }
    setSendingRequest(true);
    try {
      const res = await expenseService.createLimitRequest(
        currentUserId,
        exceededType,
        parseFloat(reqAdditional),
        date.slice(0, 7)
      );
      if (res.success || res.status === "success") {
        toast.success(res.message);
        setShowApprovalModal(false);
        if (exceededType === "KM") {
          setExistingKmReq({ status: "Pending", requested_value: reqAdditional });
        } else {
          setExistingAutoReq({ status: "Pending", requested_value: reqAdditional });
        }
        // Clear local cache to force a fresh fetch from server
        localStorage.removeItem(`cache_my_expenses_${currentUserId}`);
        await fetchMonthLimits(date.slice(0, 7), false);
        await fetchClaims();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Failed to send request.");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleViewDetails = async (claimId: number) => {
    // Instantly set selectedClaim from claims list (0ms delay) so modal opens immediately
    const existingClaim = claims.find((c: any) => c.id === claimId);
    if (existingClaim) {
      setSelectedClaim(existingClaim);
    }
    setShowDetailsModal(true);
    setDetailsLoading(true);

    try {
      const details = await expenseService.getExpenseDetails(claimId);
      if (details) {
        setSelectedClaim(details);
      }
    } catch (err: any) {
      if (!existingClaim) {
        toast.error("Failed to load claim status details.");
        setShowDetailsModal(false);
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  const getUniqueMonths = () => {
    const uniqueMap = new Map<string, string>();
    const curMonth = date ? date.slice(0, 7) : getISTMonth();
    if (curMonth) uniqueMap.set(curMonth, curMonth);

    claims.forEach(c => {
      if (c.month) {
        uniqueMap.set(c.month, c.month);
      }
      if (c.itinerary && c.itinerary.length >= 7) {
        const ym = c.itinerary.slice(0, 7);
        uniqueMap.set(ym, ym);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const getFilteredClaims = () => {
    if (!Array.isArray(claims)) return [];

    const result = claims.filter(c => {
      if (!c) return false;

      // 1. Month filter
      if (claimsMonthFilter && claimsMonthFilter !== "all") {
        const qm = claimsMonthFilter.toLowerCase();
        const matchMonthName = c.month && c.month.toLowerCase() === qm;
        const matchItinerary = c.itinerary && String(c.itinerary).startsWith(claimsMonthFilter);
        const matchYearMonth = (c.year && c.month) ? `${c.year}-${c.month}`.toLowerCase() === qm : false;
        if (!matchMonthName && !matchItinerary && !matchYearMonth) {
          return false;
        }
      }

      // 2. Status filter
      if (claimsStatusFilter && claimsStatusFilter !== "all") {
        const cStat = (c.status || "").toLowerCase().trim();
        const fStat = claimsStatusFilter.toLowerCase().trim();
        if (fStat === "returned_to_draft" || fStat === "returned") {
          if (!cStat.includes("returned") && cStat !== "returned_to_draft") return false;
        } else if (fStat === "submitted" || fStat === "pending") {
          if (!cStat.includes("submitted") && cStat !== "pending") return false;
        } else if (cStat !== fStat) {
          return false;
        }
      }

      // 3. Search query
      if (claimsSearch && claimsSearch.trim()) {
        const q = claimsSearch.trim().toLowerCase();
        const codeMatch = c.expense_code?.toLowerCase().includes(q);
        const descMatch = c.description?.toLowerCase().includes(q);
        const modeMatch = c.travel_mode?.toLowerCase().includes(q);
        const itineraryMatch = c.itinerary?.toLowerCase().includes(q);
        const statusMatch = c.status?.toLowerCase().includes(q);
        const amtMatch = c.amount?.toString().includes(q);

        const legMatch = (c.legs || c.itineraries || []).some((l: any) =>
          (l.from_district || "").toLowerCase().includes(q) ||
          (l.to_district || "").toLowerCase().includes(q) ||
          (l.from || "").toLowerCase().includes(q) ||
          (l.to || "").toLowerCase().includes(q) ||
          (l.visit_purpose || "").toLowerCase().includes(q)
        );

        if (!codeMatch && !descMatch && !modeMatch && !itineraryMatch && !statusMatch && !amtMatch && !legMatch) {
          return false;
        }
      }
      return true;
    });

    // Apply sorting
    if (claimsSortOrder === "date_desc") {
      result.sort((a, b) => new Date(b.itinerary || "1970-01-01").getTime() - new Date(a.itinerary || "1970-01-01").getTime());
    } else if (claimsSortOrder === "date_asc") {
      result.sort((a, b) => new Date(a.itinerary || "1970-01-01").getTime() - new Date(b.itinerary || "1970-01-01").getTime());
    } else if (claimsSortOrder === "amount_desc") {
      result.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0));
    } else if (claimsSortOrder === "amount_asc") {
      result.sort((a, b) => (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0));
    }
    return result;
  };

  const getFilteredLegs = () => {
    const currentFilteredClaims = getFilteredClaims();
    if (!Array.isArray(currentFilteredClaims) || currentFilteredClaims.length === 0) return [];

    const legsList: any[] = [];
    currentFilteredClaims.forEach(c => {
      if (!c) return;

      const legsArray = (Array.isArray(c.itineraries) && c.itineraries.length > 0)
        ? c.itineraries
        : ((Array.isArray(c.legs) && c.legs.length > 0) ? c.legs : null);

      const claimLegs = legsArray || [{
        leg: 1,
        from_district: c.district || "Base",
        to_district: c.district || "Base",
        from: "",
        to: "",
        mode: c.travel_mode || c.category || "Travel",
        sub_mode: "",
        sub_amount: 0,
        km: c.total_km || 0,
        amount: c.amount || 0,
        da: c.da_amount || 0,
        hotel: c.hotel_amount || 0,
        local_purchase: c.local_purchase_amount || 0,
        other_amount: c.other_expense_amount || 0,
        visit_purpose: c.description || "Field visit"
      }];

      claimLegs.forEach((l: any, idx: number) => {
        legsList.push({
          parentCode: c.expense_code || "EXP",
          parentDate: c.itinerary || c.date || "",
          parentStatus: c.status || "draft",
          parentAmount: c.amount || 0,
          leg: l.leg || l.leg_number || (idx + 1),
          from_district: l.from_district || c.district || "",
          to_district: l.to_district || c.district || "",
          from: l.from || l.from_location || "",
          to: l.to || l.to_location || "",
          mode: l.mode || l.travel_mode || c.travel_mode || "Other",
          sub_mode: l.sub_mode || "",
          sub_amount: parseFloat(l.sub_amount) || 0,
          km: parseFloat(l.km || l.distance_km) || 0,
          amount: parseFloat(l.amount || l.travel_amount) || 0,
          da: parseFloat(l.da || l.da_amount) || 0,
          hotel: parseFloat(l.hotel || l.hotel_amount) || 0,
          local_purchase: parseFloat(l.local_purchase) || 0,
          local_purchase_remark: l.local_purchase_remark || "",
          other_amount: parseFloat(l.other_amount || l.other_expense_amount || l.oth_amount) || 0,
          visit_purpose: l.visit_purpose || l.purpose || c.description || "Field visit"
        });
      });
    });

    // Apply sorting to legs directly
    if (claimsSortOrder === "date_desc") {
      legsList.sort((a, b) => new Date(b.parentDate || "1970-01-01").getTime() - new Date(a.parentDate || "1970-01-01").getTime());
    } else if (claimsSortOrder === "date_asc") {
      legsList.sort((a, b) => new Date(a.parentDate || "1970-01-01").getTime() - new Date(b.parentDate || "1970-01-01").getTime());
    } else if (claimsSortOrder === "amount_desc") {
      legsList.sort((a, b) => {
        const amtA = (parseFloat(a.amount) || 0) + (parseFloat(a.da) || 0) + (parseFloat(a.hotel) || 0) + (parseFloat(a.local_purchase) || 0) + (parseFloat(a.other_amount) || 0);
        const amtB = (parseFloat(b.amount) || 0) + (parseFloat(b.da) || 0) + (parseFloat(b.hotel) || 0) + (parseFloat(b.local_purchase) || 0) + (parseFloat(b.other_amount) || 0);
        return amtB - amtA;
      });
    } else if (claimsSortOrder === "amount_asc") {
      legsList.sort((a, b) => {
        const amtA = (parseFloat(a.amount) || 0) + (parseFloat(a.da) || 0) + (parseFloat(a.hotel) || 0) + (parseFloat(a.local_purchase) || 0) + (parseFloat(a.other_amount) || 0);
        const amtB = (parseFloat(b.amount) || 0) + (parseFloat(b.da) || 0) + (parseFloat(b.hotel) || 0) + (parseFloat(b.local_purchase) || 0) + (parseFloat(b.other_amount) || 0);
        return amtA - amtB;
      });
    }
    return legsList;
  };

  const handleEditFromModal = (claimId: number | string) => {
    const stringId = String(claimId);
    setEditExpenseId(stringId);
    loadExpenseForEdit(stringId);
    
    const newurl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?edit=${stringId}`;
    window.history.pushState({ path: newurl }, '', newurl);
    
    setShowDetailsModal(false);
    setSelectedClaim(null);
  };

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "—";
    return formatToIST(dateVal);
  };

  const handleDeleteClaim = async (claimId: number) => {
    if (!window.confirm("Are you sure you want to cancel this expense claim? Cancelled claims will be preserved in your history, and you can submit a new claim for this date if needed.")) return;
    try {
      // Find the claim's month before cancelling to refresh the correct month's limits!
      const targetClaim = claims.find((c: any) => c.id === claimId);
      const targetMonth = targetClaim?.itinerary ? targetClaim.itinerary.slice(0, 7) : getISTMonth();
      
      await expenseService.deleteExpense(claimId);
      toast.success("Claim cancelled successfully. You may submit a fresh claim for this date.");
      
      // Clear limits cache to force refetch
      const cacheKey = `cache_month_limits_${currentUserId}_${targetMonth}`;
      localStorage.removeItem(cacheKey);
      
      // Refresh limits in state
      await fetchMonthLimits(targetMonth, false);
      
      // Refresh claims list
      await fetchClaims();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to cancel claim.");
    }
  };

  if (initLoading) {
    return <Loader message="Initializing Expense Builder..." />;
  }

  const policyMissing = !initLoading && (!allowance || allowance.policy_missing || allowance.daily_in_district === null || allowance.daily_in_district === undefined);
  const limitPillLabel = allowance.vehicle_type === "None" ? "Allowances" : `${allowance.vehicle_type} Limits`;

  return (
    <>
      <div className="space-y-6 animate-fadeIn text-[#212529] pb-32 md:pb-8 text-xs font-sans">
      
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-200 rounded-md shadow-2xs flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#4A6A8A] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">Submit Daily Expense Claim</h1>
            <p className="text-[9.5px] text-slate-500 font-medium">Submit daily travel & work details.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">EXPENSE ID:</span>
          <span className="bg-[#4A6A8A] text-white font-extrabold py-0.5 px-2.5 rounded text-[10px] sm:text-[11px] font-mono tracking-wide shadow-2xs">
            {nextExpId}
          </span>
        </div>
      </div>
      {policyMissing && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-none flex items-start gap-2.5 font-medium shadow-2xs animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-650" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm">Policy data load नहीं हुआ, कृपया page reload करें</p>
            <p className="text-[10px] mt-0.5 text-rose-600 leading-relaxed font-semibold">Your grade-specific policy limits could not be retrieved from the database. Claim creation and updates have been disabled to prevent incorrect calculations.</p>
          </div>
        </div>
      )}

      {/* 4 Premium Stat Cards (Compact 2x2 Mobile Grid System) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-md shadow-2xs p-2 sm:p-2.5 flex items-center gap-2 hover:border-indigo-300 transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <User className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">EMPLOYEE PROFILE</span>
            <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight truncate" title={user.name || "—"}>
              {user.name || "—"}
            </span>
            <div className="flex items-center gap-1 text-[8.5px] text-slate-500 font-mono mt-0.5">
              <span>{user.e_code || "—"}</span>
              <span className="text-slate-300">|</span>
              <span className="text-indigo-600 font-bold bg-indigo-50 px-1 py-0.2 rounded text-[8px]">Grade: {user.grade || "—"}</span>
            </div>
          </div>
        </div>

        {/* Assigned Home District Card */}
        <div className="bg-white border border-slate-200 rounded-md shadow-2xs p-2 sm:p-2.5 flex items-center gap-2 hover:border-emerald-300 transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">ASSIGNED DISTRICT</span>
            <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight truncate">
              {user.district || "—"}
            </span>
            <span className="text-[8px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded font-mono leading-none w-fit mt-0.5">
              In-District Boundary
            </span>
          </div>
        </div>

        {/* Monthly Distance Limit Card */}
        <div className="bg-white border border-slate-200 rounded-md shadow-2xs p-2 sm:p-2.5 flex items-center gap-2 hover:border-blue-300 transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            {allowance.vehicle_type === "Car" ? (
              <Car className="w-4 h-4" />
            ) : allowance.vehicle_type === "Bike" ? (
              <Bike className="w-4 h-4" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
              {limitPillLabel}
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-black text-slate-900 leading-tight">
              {allowance.current_month_km || 0} / {((allowance.max_km_per_month || 0) + approvedKm)} KM
            </span>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden flex items-center">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(allowance.current_month_km ? 5 : 0, getProgressPercentage(allowance.current_month_km || 0, ((allowance.max_km_per_month || 0) + approvedKm)))}%` }}
              ></div>
            </div>
            {existingKmReq && (
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[8px] font-bold shrink-0">
                <span className="text-slate-400">Request:</span>
                <span className={
                  existingKmReq.status === "Approved" ? "text-green-600 font-black" :
                  existingKmReq.status === "Rejected" ? "text-rose-600 font-black" :
                  "text-amber-600 animate-pulse font-black"
                }>
                  {existingKmReq.status === "Approved" ? "✓ Approved" :
                   existingKmReq.status === "Rejected" ? "❌ Rejected" :
                   "⏳ Pending"}: +{existingKmReq.requested_value} KM
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Auto Cap Card */}
        <div className="bg-white border border-slate-200 rounded-md shadow-2xs p-2 sm:p-2.5 flex items-center gap-2 hover:border-amber-300 transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
              MONTHLY AUTO CAP
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-black text-slate-900 leading-tight">
              ₹{(allowance.current_month_auto || 0).toLocaleString()} / ₹{((allowance.max_auto_per_month || 0) + approvedAuto).toLocaleString()}
            </span>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden flex items-center">
              <div 
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(allowance.current_month_auto ? 5 : 0, getProgressPercentage(allowance.current_month_auto || 0, ((allowance.max_auto_per_month || 0) + approvedAuto)))}%` }}
              ></div>
            </div>
            {existingAutoReq && (
              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[8px] font-bold shrink-0">
                <span className="text-slate-400">Request:</span>
                <span className={
                  existingAutoReq.status === "Approved" ? "text-green-600 font-black" :
                  existingAutoReq.status === "Rejected" ? "text-rose-600 font-black" :
                  "text-amber-600 animate-pulse font-black"
                }>
                  {existingAutoReq.status === "Approved" ? "✓ Approved" :
                   existingAutoReq.status === "Rejected" ? "❌ Rejected" :
                   "⏳ Pending"}: +₹{existingAutoReq.requested_value}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Form container supporting dual layout */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="space-y-6">
          <div className="space-y-6">
            
            {/* Date Selection card */}
            {(() => {
              const claimDatesFromList = (claims || [])
                .filter((c: any) => String(c.status || "").toLowerCase().trim() !== "cancelled")
                .map((c: any) => (c.expense_date || c.date || "").slice(0, 10))
                .filter(Boolean);
              const allSubmittedDates = Array.from(new Set([...(submittedDates || []), ...claimDatesFromList]));
              const isCurrentDateSubmitted = !!(date && allSubmittedDates.includes(date) && (!editExpenseId || date !== originalExpenseDate));

              return (
                <div className="card-lte-primary bg-white shadow-sm">
                  <div className="bg-slate-50 border-b border-gray-200 p-3 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Expense Date
                    </h3>
                  </div>
                  <div className="p-4 max-w-xs">
                    <label className="label-lte">Choose Travel Date <span className="text-red-500">*</span></label>
                    <ConfigProvider
                      theme={{
                        token: {
                          colorPrimary: "#4f46e5",
                          borderRadius: 8,
                          fontFamily: "inherit",
                          fontSize: 12,
                        }
                      }}
                    >
                      <DatePicker
                        value={date ? dayjs(date) : null}
                        format="YYYY-MM-DD"
                        allowClear={false}
                        inputReadOnly
                        style={{ width: "100%" }}
                        disabledDate={(current: Dayjs) => {
                          if (!current) return false;
                          const dateStr = current.format("YYYY-MM-DD");
                          if (maxDate && dateStr > maxDate) return true;
                          if (minDate && dateStr < minDate) return true;
                          const cleanOrigDate = (originalExpenseDate || "").slice(0, 10);
                          if (editExpenseId && dateStr === cleanOrigDate) return false;
                          if (allSubmittedDates.includes(dateStr)) return true;
                          return false;
                        }}
                        cellRender={(current: string | number | Dayjs, _info: any) => {
                          const d = dayjs.isDayjs(current) ? current : dayjs(current);
                          const dateStr = d.format("YYYY-MM-DD");
                          const isSubmitted = allSubmittedDates.includes(dateStr);
                          const isInRange = (!minDate || dateStr >= minDate) && (!maxDate || dateStr <= maxDate);
                          const cleanOrigDate = (originalExpenseDate || "").slice(0, 10);
                          const isEditOriginal = !!(editExpenseId && dateStr === cleanOrigDate);
                          const isAvailable = isInRange && !isSubmitted;
                          return (
                            <div className="ant-picker-cell-inner" style={{ position: "relative" }}>
                              {d.date()}
                              {(isAvailable || isEditOriginal) && isInRange && (
                                <span style={{
                                  position: "absolute",
                                  bottom: 1,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: "#22c55e",
                                  display: "block"
                                }} />
                              )}
                              {isSubmitted && !isEditOriginal && (
                                <span style={{
                                  position: "absolute",
                                  bottom: 1,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: "#ef4444",
                                  display: "block"
                                }} />
                              )}
                            </div>
                          );
                        }}
                        onChange={(dayjsVal: Dayjs | null) => {
                          if (!dayjsVal) return;
                          const newDate = dayjsVal.format("YYYY-MM-DD");
                          if (editExpenseId && newDate === originalExpenseDate) {
                            setDate(newDate);
                            return;
                          }
                          if (allSubmittedDates.includes(newDate)) {
                            toast.error(`Claim for ${newDate} has already been submitted! Please choose another date.`);
                            setDate("");
                            return;
                          }
                          setDate(newDate);
                        }}
                      />
                    </ConfigProvider>
                    {isCurrentDateSubmitted && (
                      <div className="mt-2 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Claim for {date} already submitted! Please pick an unsubmitted date.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Visit Details Legs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-650 uppercase tracking-wider">Travel & Visits</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase">(Visits: {itineraries.length} / 15)</span>
              </div>

              {itineraries.map((leg, index) => {
                const legNum = index + 1;
                const isFirst = legNum === 1;
                const prevLeg = index > 0 ? itineraries[index - 1] : null;
                const isFromLocked = !isFirst && Boolean(prevLeg?.to && prevLeg.to.trim() !== "");
                const currentFromDist = isFromLocked ? (prevLeg?.district || prevLeg?.district_from || leg.district_from) : leg.district_from;
                const currentFrom = isFromLocked ? (prevLeg?.to || leg.from) : leg.from;

                const rawDistOpts = Object.keys(facilities).length > 0 ? Object.keys(facilities) : [
                  "Ajmer", "Beawer", "Bhilwara", "Nagaur", "Tonk", "Bikaner", "Churu", "Ganganagar", "Hanumangarh", 
                  "Barmer", "Balotra", "Jaisalmer", "Jalore", "Jodhpur", "Pali", "Phalodi", "Sirohi", 
                  "Banswara", "Chittorgarh", "Dungarpur", "Rajsamand", "Pratapgarh", "Udaipur"
                ];
                const hDist = user.district || user.home_district || "Jodhpur";
                const distOpts = Array.from(new Set([...rawDistOpts, hDist, "Jaipur", "Kota"])).filter(Boolean).filter(d => d !== "All");

                return (
                  <div key={leg.leg} className="bg-white text-xs mb-6 border border-slate-200 rounded-none shadow-2xs overflow-hidden border-t-4 border-t-[#4A6A8A]">
                    
                    {/* Leg Header with Solid Theme Styling */}
                    <div className="px-4 py-2.5 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
                      <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2.5 m-0">
                        <span className="h-5 px-2 rounded-none flex items-center justify-center text-[10px] font-black font-mono bg-white text-[#4A6A8A]">
                          #{legNum}
                        </span>
                        <span>Facility Visit {legNum}</span>
                      </h3>
                      {legNum > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItinerary(leg.leg)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-none border-0 cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Visit
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 -mx-4 px-4 -mt-4 pt-3 mb-1 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Travel Category</span>
                        <div className="grid grid-cols-3 gap-1 sm:flex sm:gap-2 w-full sm:w-auto" role="group">
                          <button
                            key="In-District"
                            type="button"
                            onClick={() => handleItineraryChange(leg.leg, "travel_type", "In-District")}
                            className={`px-1.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-extrabold rounded-none border transition-all cursor-pointer shadow-2xs text-center flex items-center justify-center ${
                              leg.travel_type === "In-District"
                                ? "border-[#4A6A8A] bg-[#4A6A8A] text-white"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            In-District
                          </button>
                          <button
                            key="Outdoor"
                            type="button"
                            onClick={() => handleItineraryChange(leg.leg, "travel_type", "Outdoor")}
                            className={`px-1.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-extrabold rounded-none border transition-all cursor-pointer shadow-2xs text-center flex items-center justify-center ${
                              leg.travel_type === "Outdoor"
                                ? "border-amber-600 bg-amber-500 text-white"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Outdoor
                          </button>
                          <button
                            key="Out of State"
                            type="button"
                            onClick={() => handleItineraryChange(leg.leg, "travel_type", "Out of State")}
                            className={`px-1.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-extrabold rounded-none border transition-all cursor-pointer shadow-2xs text-center flex items-center justify-center whitespace-nowrap ${
                              leg.travel_type === "Out of State"
                                ? "border-purple-600 bg-purple-600 text-white font-bold"
                                : "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100"
                            }`}
                          >
                            ✈️ Out of State
                          </button>
                        </div>
                      </div>

                      {/* Locations Row (From and To side by side) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* From Location block */}
                        <div className="p-4 bg-white border border-slate-200 rounded-none space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-none bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">STARTING LOCATION (FROM)</span>
                            </div>
                            {isFromLocked && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-none uppercase tracking-wider flex items-center gap-1">
                                🔒 AUTO-LOCKED (VISIT #{prevLeg?.leg} TO)
                              </span>
                            )}
                          </div>
                          <div className="space-y-2.5">
                            {leg.travel_type === "Out of State" && (
                              <div>
                                <label className="label-lte text-purple-800 font-extrabold flex items-center gap-1">
                                  <span>State Name</span> <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={leg.state || "Rajasthan"}
                                  disabled={isFromLocked}
                                  onChange={(e) => {
                                    const newState = e.target.value;
                                    handleItineraryChange(leg.leg, "state", newState);
                                    const stateDists = getDistrictsForState(newState);
                                    handleItineraryChange(leg.leg, "district_from", stateDists[0] || "");
                                    handleItineraryChange(leg.leg, "from", "");
                                  }}
                                  className="input-lte font-semibold pr-8 border-purple-300 bg-purple-50/50 rounded-none shadow-2xs disabled:bg-slate-100 mb-2"
                                >
                                  <option value="">Select From State</option>
                                  {ALL_INDIAN_STATES.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="label-lte">District <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <select
                                  value={currentFromDist}
                                  required
                                  disabled={leg.travel_type === "In-District" || isFromLocked}
                                  onChange={(e) => {
                                    handleItineraryChange(leg.leg, "district_from", e.target.value);
                                    handleItineraryChange(leg.leg, "from", ""); // reset location on district change
                                  }}
                                  className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                >
                                  <option value="">Select District</option>
                                  {(leg.travel_type === "Out of State"
                                    ? getDistrictsForState(leg.state || "Rajasthan")
                                    : distOpts
                                  ).map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="label-lte mb-0">Facility / Location Name <span className="text-red-500">*</span></label>
                                {!isFromLocked && !(isFirst && leg.travel_type === "In-District") && leg.district_from && getFacilitiesForDistrict(leg.district_from).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItineraryChange(leg.leg, "from_custom", !leg.from_custom);
                                      handleItineraryChange(leg.leg, "from", "");
                                    }}
                                    className="text-[9.5px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md cursor-pointer uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                                  >
                                    {leg.from_custom ? "📋 Select From List" : "✍️ Type Custom"}
                                  </button>
                                )}
                              </div>
                              {isFromLocked ? (
                                <input
                                  type="text"
                                  required
                                  readOnly
                                  disabled
                                  value={currentFrom}
                                  className="input-lte font-semibold border-slate-300 rounded-none disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed shadow-2xs"
                                />
                              ) : isFirst && leg.travel_type === "In-District" ? (
                                <div>
                                  <input
                                    type="text"
                                    required
                                    value={leg.from}
                                    placeholder="e.g. My Home / My Room / Hotel Name..."
                                    onChange={(e) => handleItineraryChange(leg.leg, "from", e.target.value)}
                                    className="input-lte font-semibold border-slate-300 rounded-none"
                                  />
                                  <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                                    <span>⚠️</span>
                                    <span>Must contain: <strong>Home</strong>, <strong>Room</strong>, or <strong>Hotel</strong></span>
                                  </p>
                                </div>
                              ) : leg.district_from && getFacilitiesForDistrict(leg.district_from).length > 0 && !leg.from_custom ? (
                                <select
                                  required
                                  value={leg.from}
                                  onChange={(e) => handleItineraryChange(leg.leg, "from", e.target.value)}
                                  className="input-lte font-semibold border-slate-300 rounded-none"
                                >
                                  <option value="">-- Select Hospital / Location --</option>
                                  {getFacilitiesForDistrict(leg.district_from).map((f: string, fIdx: number) => (
                                    <option key={fIdx} value={f}>{f}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={leg.from}
                                  placeholder="Enter facility or location..."
                                  onChange={(e) => handleItineraryChange(leg.leg, "from", e.target.value)}
                                  className="input-lte font-semibold border-slate-300 rounded-none"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* To Location block */}
                        <div className="p-4 bg-slate-50 border border-gray-200 rounded-md space-y-3 shadow-xs">
                          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">DESTINATION LOCATION (TO)</span>
                          </div>
                          <div className="space-y-2.5">
                            {leg.travel_type === "Out of State" && (
                              <div>
                                <label className="label-lte text-purple-800 font-extrabold flex items-center gap-1">
                                  <span>State Name</span> <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={leg.dest_state || "Gujarat"}
                                  onChange={(e) => {
                                    const newState = e.target.value;
                                    handleItineraryChange(leg.leg, "dest_state", newState);
                                    const stateDists = getDistrictsForState(newState);
                                    handleItineraryChange(leg.leg, "district", stateDists[0] || "");
                                    handleItineraryChange(leg.leg, "to", "");
                                  }}
                                  className="input-lte font-semibold pr-8 border-purple-300 bg-purple-50/50 rounded-none shadow-2xs mb-2"
                                >
                                  <option value="">Select State</option>
                                  {ALL_INDIAN_STATES.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="label-lte">District <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <select
                                  value={leg.district}
                                  required
                                  disabled={leg.travel_type === "In-District"}
                                  onChange={(e) => {
                                    handleItineraryChange(leg.leg, "district", e.target.value);
                                    handleItineraryChange(leg.leg, "to", ""); // reset location on district change
                                  }}
                                  className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                  <option value="">Select District</option>
                                  {(leg.travel_type === "Out of State" || (leg.dest_state && leg.dest_state !== leg.state)
                                    ? getDistrictsForState(leg.dest_state || "Gujarat")
                                    : distOpts
                                  ).map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="label-lte mb-0">Facility / Location Name <span className="text-red-500">*</span></label>
                                {leg.district && getFacilitiesForDistrict(leg.district).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItineraryChange(leg.leg, "to_custom", !leg.to_custom);
                                      handleItineraryChange(leg.leg, "to", "");
                                    }}
                                    className="text-[9.5px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md cursor-pointer uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                                  >
                                    {leg.to_custom ? "📋 Select From List" : "⚡ Type Custom"}
                                  </button>
                                )}
                              </div>
                              {leg.district && getFacilitiesForDistrict(leg.district).length > 0 && !leg.to_custom ? (
                                <select
                                  required
                                  value={leg.to}
                                  onChange={(e) => handleItineraryChange(leg.leg, "to", e.target.value)}
                                  className="input-lte font-semibold border-slate-300 rounded-none"
                                >
                                  <option value="">-- Select Hospital / Location --</option>
                                  {getFacilitiesForDistrict(leg.district).map((f: string, fIdx: number) => (
                                    <option key={fIdx} value={f}>{f}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={leg.to}
                                  placeholder="Enter facility or location..."
                                  onChange={(e) => handleItineraryChange(leg.leg, "to", e.target.value)}
                                  className="input-lte font-semibold border-slate-300 rounded-none"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Travel Mode, KM and Amount details */}
                      <div className="border-t border-slate-200 pt-4 space-y-3">
                        <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider leading-none flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-[#4A6A8A]" />
                          TRAVEL DETAILS
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <label className="label-lte mb-1 block">Travel Mode <span className="text-red-500">*</span></label>
                            <select
                              value={leg.mode}
                              required
                              onChange={(e) => handleItineraryChange(leg.leg, "mode", e.target.value)}
                              className="input-lte font-bold border-slate-300 rounded-none"
                            >
                              <option value="">Select Travel Mode</option>
                              {[
                                { value: "Bike", label: "Bike", visible: allowance.vehicle_type === "Bike" || allowance.vehicle_type === "Car" },
                                // 🔒 Per-user override: employee E1702 is allowed BOTH Bike and Car regardless of grade's
                                // default vehicle_type policy. Do not extend this override to other users without being asked.
                                { value: "Car", label: "Car", visible: allowance.vehicle_type === "Car" || user?.user_id === "E1702" || user?.e_code === "E1702" },
                                { value: "Auto", label: "Auto", visible: true },
                                { value: "Bus", label: "Bus", visible: true },
                                { value: "Train", label: "Train", visible: true },
                              ].filter(x => x.visible).map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="label-lte">Distance {(leg.mode === "Bike" || leg.mode === "Car") && <span className="text-red-500">*</span>}</label>
                            <div className="flex rounded shadow-xs">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={String(leg.km) === "0" || leg.km === "" ? "" : leg.km}
                                onFocus={(e) => e.target.select()}
                                disabled={leg.mode !== "Bike" && leg.mode !== "Car"}
                                placeholder="0"
                                onChange={(e) => handleItineraryChange(leg.leg, "km", e.target.value)}
                                className="input-lte rounded-none font-mono disabled:bg-slate-100 disabled:text-slate-500 border-slate-300"
                              />
                              <span className="inline-flex items-center rounded-none border border-l-0 border-slate-300 bg-slate-100 px-3 text-slate-700 text-[10px] font-mono font-bold uppercase shrink-0">
                                KM
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="label-lte">Fare Amount {leg.mode !== "" && <span className="text-red-500">*</span>}</label>
                            <div className="flex rounded-none shadow-2xs">
                              <span className="inline-flex items-center rounded-none border border-r-0 border-slate-300 bg-slate-100 px-3 text-slate-700 text-xs font-mono font-bold shrink-0">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={String(leg.amount) === "0" || leg.amount === "" ? "" : leg.amount}
                                onFocus={(e) => e.target.select()}
                                disabled={leg.mode === "Bike" || leg.mode === "Car"}
                                placeholder="0"
                                onChange={(e) => handleItineraryChange(leg.leg, "amount", e.target.value)}
                                className="input-lte rounded-none font-mono disabled:bg-slate-100 disabled:text-slate-500 border-slate-300"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File upload for main mode */}
                        {leg.mode !== "" && leg.mode !== "Bike" && leg.mode !== "Car" && (
                          <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-md">
                            <label className="label-lte block mb-1.5">
                              Upload Ticket / Receipt Image
                              {leg.mode === "Train" && <span className="text-red-500"> *</span>}
                              {(leg.mode === "Bus" || leg.mode === "Auto") && (parseFloat(leg.amount) || 0) >= 300 && <span className="text-red-500"> *</span>}
                            </label>
                            {!files[leg.leg]?.main_bill && !hasExistingFile(leg.leg, leg.mode) ? (
                              <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
    <span>Upload Ticket / Receipt Image</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "main_bill", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                            ) : files[leg.leg]?.main_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-blue-700 truncate max-w-[200px]">{files[leg.leg]?.main_bill?.name}</span>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => files[leg.leg]?.main_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].main_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.main_bill ? URL.createObjectURL(files[leg.leg].main_bill!) : ""} download={files[leg.leg]?.main_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "main_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-green-700">✓ Existing receipt retained</span>
                                <div className="flex gap-2">
                                  {getExistingFileUrl(leg.leg, leg.mode) && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, leg.mode) || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, leg.mode) || ""} download={`receipt_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: leg.mode }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* File upload for manager approval email (Outdoor Only) */}
                        {leg.travel_type === "Outdoor" && (
                          <div className="p-3 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-md">
                            <label className="label-lte block mb-1.5">
                              Upload Manager Approval Screenshot (Optional)
                            </label>
                            {!files[leg.leg]?.comm_mail && !hasExistingFile(leg.leg, "Communication_Mail") ? (
                              <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
    <span>Upload Approval Screenshot</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "comm_mail", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                            ) : files[leg.leg]?.comm_mail ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-blue-700 truncate max-w-[200px]">{files[leg.leg]?.comm_mail?.name}</span>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => files[leg.leg]?.comm_mail && setLightboxImage(URL.createObjectURL(files[leg.leg].comm_mail!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.comm_mail ? URL.createObjectURL(files[leg.leg].comm_mail!) : ""} download={files[leg.leg]?.comm_mail?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "comm_mail")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-green-700">✓ Existing approval screenshot retained</span>
                                <div className="flex gap-2">
                                  {getExistingFileUrl(leg.leg, "Communication_Mail") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Communication_Mail") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Communication_Mail") || ""} download={`approval_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Communication_Mail" }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sub-connections details */}
                      <div className="border-t border-gray-150 pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-none">Sub-connections & Conveyance</h4>
                          {!(leg.mode === "Bus" || leg.mode === "Train") && (
                            <span className="text-[9px] text-gray-400 italic">Available for Bus/Train legs only</span>
                          )}
                          {(leg.mode === "Bus" || leg.mode === "Train") && !leg.show_sub_leg && (
                            <button
                              type="button"
                              onClick={() => handleItineraryChange(leg.leg, "show_sub_leg", true)}
                              className="text-blue-605 hover:underline border-0 bg-transparent text-[10px] font-bold p-0 cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 animate-pulse" /> Add Extra Sub-Connection (Auto / Bus / Train)
                            </button>
                          )}
                        </div>

                        {leg.show_sub_leg && (
                          <div className="p-4 bg-slate-50/50 rounded border border-gray-200 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <span className="font-bold text-[10px] text-gray-600 uppercase tracking-wide">Extra Sub-leg detail</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleItineraryChange(leg.leg, "show_sub_leg", false);
                                  handleItineraryChange(leg.leg, "sub_mode", "");
                                  handleItineraryChange(leg.leg, "sub_amount", "0");
                                  removeLegFile(leg.leg, "sub_bill");
                                }}
                                className="text-red-600 hover:text-red-800 text-[10px] font-bold border-0 bg-transparent cursor-pointer"
                              >
                                Remove connection
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="label-lte mb-1 block">Mode <span className="text-red-500">*</span></label>
                                <select
                                  value={leg.sub_mode}
                                  required
                                  onChange={(e) => handleItineraryChange(leg.leg, "sub_mode", e.target.value)}
                                  className="input-lte font-bold"
                                >
                                  <option value="">Select Mode</option>
                                  <option value="Auto">Auto</option>
                                  <option value="Bus">Bus</option>
                                  <option value="Train">Train</option>
                                </select>
                              </div>
                              <div>
                                <label className="label-lte">Amount (₹) <span className="text-red-500">*</span></label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  onFocus={(e) => e.target.select()}
                                  value={String(leg.sub_amount) === "0" || leg.sub_amount === "" ? "" : leg.sub_amount}
                                  onChange={(e) => handleItineraryChange(leg.leg, "sub_amount", e.target.value)}
                                  className="input-lte font-bold"
                                />
                              </div>
                              <div>
                                <label className="label-lte">
                                  Ticket Upload 
                                  {leg.sub_mode === "Train" && <span className="text-red-500"> *</span>}
                                  {(leg.sub_mode === "Bus" || leg.sub_mode === "Auto") && (parseFloat(leg.sub_amount) || 0) >= 300 && <span className="text-red-500"> *</span>}
                                </label>
                                {!files[leg.leg]?.sub_bill && !hasExistingFile(leg.leg, leg.sub_mode) ? (
                                  <div className="mt-1.5">
                                    <label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg h-8 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    <span>Upload Sub-Travel Ticket</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "sub_bill", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                                  </div>
                                ) : files[leg.leg]?.sub_bill ? (
                                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                    <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.sub_bill?.name}</span>
                                    <div className="flex gap-1.5">
                                      <button type="button" onClick={() => files[leg.leg]?.sub_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].sub_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={files[leg.leg]?.sub_bill ? URL.createObjectURL(files[leg.leg].sub_bill!) : ""} download={files[leg.leg]?.sub_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                      <button type="button" onClick={() => removeLegFile(leg.leg, "sub_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                    <span className="font-semibold text-green-700">✓ Retained</span>
                                    <div className="flex gap-1.5">
                                      {getExistingFileUrl(leg.leg, leg.sub_mode) && (
                                        <>
                                          <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, leg.sub_mode) || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                          <a href={getExistingFileUrl(leg.leg, leg.sub_mode) || ""} download={`sub_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                        </>
                                      )}
                                      <button 
                                        type="button" 
                                        onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: leg.sub_mode }])} 
                                        className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* DA and Hotel fields (Leg #1 Only) */}
                      {isFirst && (
                        <div className="border-t border-gray-150 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/30 p-3 rounded border">
                          <div>
                            <label className="label-lte" title={`Grade Allowances. Daily district: ₹${allowance.daily_in_district}. Daily out-district: ₹${allowance.daily_out_district}. Daily hotel: ₹${allowance.daily_hotel}. Daily out-state: ₹${allowance.daily_out_state}.`}>
                              Daily Allowance (DA) <Info className="w-3 h-3 inline text-blue-500 mb-0.5" />
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={leg.da}
                              readOnly
                              className="input-lte font-bold bg-gray-100 text-gray-500 cursor-not-allowed"
                            />
                            {/* Reason audit badge */}
                            <div className="mt-1 flex items-center gap-1 text-[9px]">
                              {isDailyAllowanceAllowed() ? (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200" title="DA Granted per policy">
                                  ✓ DA Granted
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold border border-amber-200" title="DA ₹0: Base location travel without outdoor or non-base facility visit">
                                  ⚠️ DA ₹0 (Base Policy)
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <label 
                              className="label-lte" 
                              title={leg.travel_type === "Out of State" || leg.dest_state !== leg.state
                                ? `Out-of-State Hotel Limit (DB): max ₹${allowance.hotel_out_state_s || 2000} per night.` 
                                : `Outstation Hotel Limit (DB): max ₹${allowance.hotel_in_state_s || 1000} per night.`
                              }
                            >
                              Hotel Charges <Info className="w-3 h-3 inline text-blue-500 mb-0.5" />
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              value={String(leg.hotel) === "0" || leg.hotel === "" ? "" : leg.hotel}
                              onChange={(e) => handleItineraryChange(leg.leg, "hotel", e.target.value)}
                              className="input-lte font-bold"
                            />
                            {/* No out-of-state checkbox — DA is always daily_hotel when hotel amount > 0 */}
                            {leg.hotel === "0" &&
                             (user.district || "").trim().toLowerCase() !== "jodhpur" &&
                             leg.travel_type === "Outdoor" &&
                             (leg.district || "").trim().toLowerCase() === "jodhpur" && (
                              <div className="flex items-center gap-1.5 mt-2 bg-blue-50/50 p-1.5 rounded border border-blue-100 w-fit">
                                <input
                                  type="checkbox"
                                  id="company_provided_hotel"
                                  checked={!!leg.company_provided}
                                  onChange={(e) => handleItineraryChange(leg.leg, "company_provided", e.target.checked)}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="company_provided_hotel" className="text-[10px] font-bold text-blue-800 cursor-pointer select-none">
                                  Company Provided
                                </label>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="label-lte">Hotel Bill Attachment</label>
                            {leg.company_provided ? (
                              <div className="bg-emerald-50/50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded text-[10px] mt-1.5 font-bold flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                Company Provided Stay - Bill Exempted
                              </div>
                            ) : !files[leg.leg]?.hotel_bill && !hasExistingFile(leg.leg, "Hotel") ? (
                              <div className="mt-1.5">
                                <label className="cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg h-8 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-3.5 h-3.5 text-purple-600 shrink-0" />
    <span>Upload Hotel Bill</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "hotel_bill", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                              </div>
                            ) : files[leg.leg]?.hotel_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.hotel_bill?.name}</span>
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={() => files[leg.leg]?.hotel_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].hotel_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.hotel_bill ? URL.createObjectURL(files[leg.leg].hotel_bill!) : ""} download={files[leg.leg]?.hotel_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "hotel_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                <div className="flex gap-1.5">
                                  {getExistingFileUrl(leg.leg, "Hotel") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Hotel") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Hotel") || ""} download={`hotel_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Hotel" }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="label-lte">Local Purchase (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              value={String(leg.local_purchase) === "0" || leg.local_purchase === "" ? "" : leg.local_purchase}
                              onChange={(e) => handleItineraryChange(leg.leg, "local_purchase", e.target.value)}
                              className="input-lte font-bold"
                            />
                          </div>

                          {parseFloat(leg.local_purchase) > 0 && (
                            <div className="col-span-1 md:col-span-2">
                              <label className="label-lte text-amber-900 font-bold">
                                Local Purchase Remark / Details <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={leg.local_purchase_remark || ""}
                                onChange={(e) => handleItineraryChange(leg.leg, "local_purchase_remark", e.target.value)}
                                placeholder="Compulsory: Describe what was purchased (e.g. 2 Pin Connectors, MCB)"
                                className="input-lte font-semibold bg-amber-50/70 border-amber-300 focus:border-amber-500"
                                required
                              />
                            </div>
                          )}

                          <div>
                            <label className="label-lte">
                              Local Purchase Bill {parseFloat(leg.local_purchase) >= 300 && <span className="text-red-500">*</span>}
                            </label>
                            {!files[leg.leg]?.local_purchase_bill && !hasExistingFile(leg.leg, "Local_Purchase") ? (
                              <div className="mt-1.5">
                                <label className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg h-8 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    <span>Upload Local Purchase Bill</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "local_purchase_bill", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                              </div>
                            ) : files[leg.leg]?.local_purchase_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.local_purchase_bill?.name}</span>
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={() => files[leg.leg]?.local_purchase_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].local_purchase_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.local_purchase_bill ? URL.createObjectURL(files[leg.leg].local_purchase_bill!) : ""} download={files[leg.leg]?.local_purchase_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "local_purchase_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                <div className="flex gap-1.5">
                                  {getExistingFileUrl(leg.leg, "Local_Purchase") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Local_Purchase") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Local_Purchase") || ""} download={`local_purchase_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Local_Purchase" }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      )}

                      {/* Other expenses details */}
                      <div className="border-t border-gray-150 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/10 p-3 rounded border border-dashed">
                        <div className="sm:col-span-2">
                          <label className="label-lte">Other Purchases / Misc Description</label>
                          <input
                            type="text"
                            value={leg.oth_desc}
                            placeholder="Detail outstation toll tax, stationery, local components purchase..."
                            onChange={(e) => handleItineraryChange(leg.leg, "oth_desc", e.target.value)}
                            className="input-lte"
                          />
                        </div>
                        <div>
                          <label className="label-lte">Other Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            value={String(leg.oth_amount) === "0" || leg.oth_amount === "" ? "" : leg.oth_amount}
                            onChange={(e) => handleItineraryChange(leg.leg, "oth_amount", e.target.value)}
                            disabled={!leg.oth_desc.trim()}
                            className={`input-lte font-bold ${!leg.oth_desc.trim() ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
                          />
                        </div>
                        <div className="sm:col-span-3 border-t border-gray-100 pt-2 flex items-center justify-between">
                          <label className="label-lte block">Misc Bill Attachment Indicator</label>
                          <div className="flex items-center gap-2">
                            {!files[leg.leg]?.oth_bill && !hasExistingFile(leg.leg, "Other") ? (
                              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg h-8 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-extrabold shadow-2xs w-full transition-all active:scale-[0.98]">
    <Camera className="w-3.5 h-3.5 text-slate-600 shrink-0" />
    <span>Upload Misc Bill</span>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleLegFileChange(leg.leg, "oth_bill", e.target.files ? e.target.files[0] : null)}
      className="hidden"
    />
  </label>
                            ) : files[leg.leg]?.oth_bill ? (
                              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px]">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.oth_bill?.name}</span>
                                <button type="button" onClick={() => files[leg.leg]?.oth_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].oth_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                <a href={files[leg.leg]?.oth_bill ? URL.createObjectURL(files[leg.leg].oth_bill!) : ""} download={files[leg.leg]?.oth_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                <button type="button" onClick={() => removeLegFile(leg.leg, "oth_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px]">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                {getExistingFileUrl(leg.leg, "Other") && (
                                  <>
                                    <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Other") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                    <a href={getExistingFileUrl(leg.leg, "Other") || ""} download={`oth_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                  </>
                                )}
                                <button 
                                  type="button" 
                                  onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Other" }])} 
                                  className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visit Activities & Tasks Section */}
                      <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
                        <div>
                          <label className="label-lte font-extrabold text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">VISIT ACTIVITIES / TASKS</label>
                          <div className="flex flex-wrap gap-x-6 gap-y-2.5 bg-slate-50 p-3 rounded-none border border-slate-200 shadow-2xs">
                            {/* We check if calibration user or regular */}
                            {(() => {
                              const isCalib = (user?.designation || "").toLowerCase().includes("calibration");
                              if (isCalib) {
                                return (
                                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      disabled={true}
                                      className="rounded-none text-[#4A6A8A] focus:ring-0 w-4 h-4"
                                    />
                                    <span>Calibration</span>
                                  </label>
                                );
                              }
                              
                              // Else, normal engineer options (excluding Calibration)
                              const options = [
                                { label: "Calls", val: "Calls" },
                                { label: "PMS", val: "PMS" },
                                { label: "Asset Tagging", val: "Asset Tagging" },
                                  { label: "Mobilise Asset Update", val: "Mobilise Asset Update" },
                                { label: "Calibration", val: "Calibration" },
                                { label: "Other", val: "Other" }
                              ];
                              
                              return options.map(opt => {
                                const checked = (leg.selected_activities || []).includes(opt.val);
                                return (
                                  <label key={opt.val} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer hover:text-[#4A6A8A] transition-colors select-none">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const current = leg.selected_activities || [];
                                        let next: string[];
                                        if (e.target.checked) {
                                          next = [...current, opt.val];
                                        } else {
                                          next = current.filter(x => x !== opt.val);
                                        }
                                        handleItineraryChange(leg.leg, "selected_activities", next);
                                      }}
                                      className="rounded-none text-[#4A6A8A] focus:ring-0 w-4 h-4 cursor-pointer"
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Sub-forms for active selections */}
                        <div className="grid grid-cols-1 gap-4">
                          {/* Calls Sub-Form */}
                          {(leg.selected_activities || []).includes("Calls") && (() => {
                            return (
                            <div className="bg-blue-50/20 border border-blue-150 rounded p-2.5 flex flex-col gap-2">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Support Calls Log</span>
                                <span className="text-[8px] font-bold text-rose-500 uppercase">⚠ All Fields & Service Report Compulsory</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-gray-50/50 p-2.5 rounded-lg border border-gray-200 text-[10px]">
                                {/* 1. Barcode */}
                                <div className="col-span-12 sm:col-span-4">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase flex items-center justify-between">
                                    <span>Barcode (QR) <span className="text-red-500">*</span></span>
                                    {leg.calls_verified && leg.calls_asset_details && (
                                      <span className="text-emerald-800 text-[8px] font-mono">
                                        ✓ {leg.calls_asset_details.equipment_name || 'Verified'}
                                      </span>
                                    )}
                                  </label>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={8}
                                      value={leg.calls_barcode || ""}
                                      placeholder="8 digits"
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, "");
                                        handleItineraryChange(leg.leg, "calls_barcode", cleaned);
                                        handleItineraryChange(leg.leg, "calls_verified", false);
                                        handleItineraryChange(leg.leg, "calls_asset_details", null);
                                      }}
                                      className="input-lte font-mono h-8 py-1 text-xs border-blue-300 flex-1 min-w-0"
                                    />
                                    <div
                                      onClick={() => {
                                        if (String(leg.calls_barcode || '').replace(/\D/g, '').length === 8) {
                                          verifyLegBarcode(leg.leg, "Calls");
                                        }
                                      }}
                                      className="h-8 px-3 flex items-center justify-center rounded-lg text-[10px] font-extrabold uppercase select-none transition-colors shrink-0"
                                      style={
                                        String(leg.calls_barcode || '').replace(/\D/g, '').length === 8
                                          ? { backgroundColor: '#10b981', color: '#000000', borderColor: '#0f172a', borderWidth: '1.5px', borderStyle: 'solid', cursor: 'pointer' }
                                          : { backgroundColor: '#e2e8f0', color: '#94a3b8', borderColor: '#cbd5e1', borderWidth: '1px', borderStyle: 'solid', cursor: 'not-allowed' }
                                      }
                                    >
                                      Verify
                                    </div>
                                  </div>
                                </div>

                                {/* Call Type */}
                                <div className="col-span-12 sm:col-span-2">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase">Call Type <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.calls_type || "Support Call"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_type", e.target.value)}
                                    className="input-lte text-[10px] font-bold h-8 py-1 px-1.5 bg-white border-blue-300 w-full"
                                  >
                                    <option value="Support Call">Support</option>
                                    <option value="Online Call">Online</option>
                                  </select>
                                </div>

                                {/* Complaint ID / Call ID */}
                                <div className="col-span-12 sm:col-span-3">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase flex items-center justify-between">
                                    <span>Complaint ID <span className="text-red-500">*</span></span>
                                    <span className="text-[8px] text-blue-600 font-bold">
                                      {(leg.calls_type || "Support Call") === "Support Call" ? "e.g. SCRJ1234" : "e.g. 13126080-100125"}
                                    </span>
                                  </label>
                                  <input
                                    type="text"
                                    value={leg.calls_complaint_id || ""}
                                    placeholder={(leg.calls_type || "Support Call") === "Support Call" ? "SCRJ1234" : "13126080-100125"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleItineraryChange(leg.leg, "calls_complaint_id", val);
                                      instantCheckComplaintId(leg.leg, val);
                                    }}
                                    onBlur={() => instantCheckComplaintId(leg.leg)}
                                    className="input-lte font-mono font-bold h-8 py-1 text-xs bg-white border-blue-300 w-full"
                                  />
                                </div>

                                {/* Call Status */}
                                <div className="col-span-12 sm:col-span-3">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase">Status <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.calls_status || "Attend"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_status", e.target.value)}
                                    className="input-lte text-[10px] font-bold h-8 py-1 px-1.5 bg-white border-blue-300 w-full"
                                  >
                                    <option value="Attend">Attend</option>
                                    <option value="Close">Close</option>
                                    <option value="Attend & Close">Both</option>
                                  </select>
                                </div>

                                {/* Live Complaint DB Check Status Banner Row */}
                                {(() => {
                                  const checkStatus = complaintCheckStatusMap[leg.leg];
                                  if (!checkStatus || checkStatus.status === "idle") return null;
                                  return (
                                    <div className="col-span-12 -mt-1 mb-1">
                                      {checkStatus.status === "checking" && (
                                        <div className="text-[9px] font-bold text-amber-600 animate-pulse flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                          <span>⏳ Checking database for open calls...</span>
                                        </div>
                                      )}
                                      {checkStatus.status === "found" && (
                                        <div className="flex items-center justify-between bg-amber-50 p-1.5 rounded border border-amber-200 text-[10px]">
                                          <span className="font-extrabold text-amber-900 flex items-center gap-1">
                                            ⚡ {checkStatus.count} Active Call(s) Found in Database!
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => instantCheckComplaintId(leg.leg)}
                                            className="text-[9px] font-extrabold bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded shadow-xs"
                                          >
                                            View Popup Modal ➔
                                          </button>
                                        </div>
                                      )}
                                      {checkStatus.status === "fresh" && (
                                        <div className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                          <span>🟢 Fresh Entry: No open complaint found in database</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Hospital / Facility Name (Read-Only / Auto-filled from Verified Barcode) */}
                                <div className="col-span-12 sm:col-span-6">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase flex items-center justify-between">
                                    <span>FACILITY / HOSPITAL NAME <span className="text-red-500">*</span></span>
                                    {leg.calls_verified && (
                                      <span className="text-emerald-700 text-[8px] font-bold font-mono">
                                        ✓ Verified Barcode Facility
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    readOnly
                                    disabled
                                    value={leg.calls_asset_details?.hospital_name || leg.calls_hospital || leg.to || "—"}
                                    placeholder="Auto-filled from barcode verification"
                                    className="input-lte text-[10px] font-extrabold h-8 py-1 px-2 bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed w-full shadow-inner"
                                  />
                                </div>

                                {/* Action Taken Remark */}
                                <div className="col-span-12 sm:col-span-6">
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase">
                                    Action Taken Remark <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={leg.calls_action_taken || ""}
                                    placeholder="Describe action / work performed..."
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_action_taken", e.target.value)}
                                    className="input-lte text-xs font-semibold h-8 py-1 px-2 bg-white border-blue-300 w-full"
                                  />
                                </div>

                                {/* Is Spare Replaced? */}
                                <div className={leg.calls_spare_replaced === "Yes" ? "col-span-12 sm:col-span-4" : "col-span-12"}>
                                  <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase">Spare Replaced / Local Purchase? <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.calls_spare_replaced || "No"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_spare_replaced", e.target.value)}
                                    className="input-lte text-[10px] font-bold h-8 py-1 px-1.5 bg-white border-blue-300 w-full"
                                  >
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                  </select>
                                </div>

                                {/* Spare / Item Name */}
                                {leg.calls_spare_replaced === "Yes" && (
                                  <div className="col-span-12 sm:col-span-4">
                                    <label className="label-lte font-extrabold text-[8px] text-amber-800 uppercase">Spare / Item Name <span className="text-red-500">*</span></label>
                                    <input
                                      type="text"
                                      placeholder="Item / Spare Name"
                                      value={leg.calls_spare_name || ""}
                                      onChange={(e) => handleItineraryChange(leg.leg, "calls_spare_name", e.target.value)}
                                      className="input-lte text-xs font-semibold h-8 py-1 px-2 bg-amber-50 border-amber-300 w-full"
                                    />
                                  </div>
                                )}

                                {/* Estimated Value if Spare Replaced */}
                                {leg.calls_spare_replaced === "Yes" && (
                                  <div className="col-span-12 sm:col-span-4">
                                    <label className="label-lte font-extrabold text-[8px] text-amber-800 uppercase">Est Value (₹) <span className="text-red-500">*</span></label>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      onFocus={(e) => e.target.select()}
                                      value={String(leg.calls_spare_estimated_value) === "0" || leg.calls_spare_estimated_value === "" ? "" : leg.calls_spare_estimated_value}
                                      onChange={(e) => handleItineraryChange(leg.leg, "calls_spare_estimated_value", e.target.value)}
                                      className="input-lte font-mono font-bold h-8 py-1 text-xs bg-amber-50 border-amber-300 w-full"
                                    />
                                  </div>
                                )}

                              {/* Photo Upload Section (1 or 3 depending on Spare Replaced) */}
                                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                                  {leg.calls_spare_replaced === "Yes" ? (
                                    <>
                                      {/* 1. Service Report Photo */}
                                      <div className="col-span-12 sm:col-span-4">
                                        <label className="label-lte font-extrabold text-[8px] text-gray-600 uppercase">1. Service Report <span className="text-red-500">*</span></label>
                                        {leg.calls_photo_url ? (
                                          <div className="flex gap-1.5 h-9 items-center justify-between bg-blue-50 border border-blue-200 px-2 rounded-lg text-[10px] font-bold">
                                            <span className="text-blue-700 cursor-pointer underline truncate max-w-[120px]" onClick={() => setLightboxImage(formatImageUrl(leg.calls_photo_url))}>View Photo</span>
                                            <button type="button" onClick={() => handleItineraryChange(leg.leg, "calls_photo_url", "")} className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-xs">✕</button>
                                          </div>
                                        ) : (
                                          <label className="cursor-pointer bg-gray-900 hover:bg-gray-800 text-white border border-gray-900 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs w-full">
                                            <Camera className="w-4 h-4 text-white" />
                                            <span>1. Service Report</span>
                                            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadActivityPhoto(leg.leg, "Calls", e.target.files[0])} className="hidden" />
                                          </label>
                                        )}
                                      </div>

                                      {/* 2. Old Spare Photo */}
                                      <div className="col-span-12 sm:col-span-4">
                                        <label className="label-lte font-extrabold text-[8px] text-amber-800 uppercase">2. Old Spare Photo <span className="text-red-500">*</span></label>
                                        {leg.calls_old_spare_photo ? (
                                          <div className="flex gap-1.5 h-9 items-center justify-between bg-amber-50 border border-amber-200 px-2 rounded-lg text-[10px] font-bold">
                                            <span className="text-amber-800 cursor-pointer underline truncate max-w-[120px]" onClick={() => setLightboxImage(formatImageUrl(leg.calls_old_spare_photo))}>View Photo</span>
                                            <button type="button" onClick={() => handleItineraryChange(leg.leg, "calls_old_spare_photo", "")} className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-xs">✕</button>
                                          </div>
                                        ) : (
                                          <label className="cursor-pointer bg-amber-700 hover:bg-amber-800 text-white border border-amber-700 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs w-full">
                                            <Camera className="w-4 h-4 text-white" />
                                            <span>2. Old Spare Photo</span>
                                            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadActivityPhoto(leg.leg, "Calls_Old_Spare", e.target.files[0])} className="hidden" />
                                          </label>
                                        )}
                                      </div>

                                      {/* 3. New Spare Photo */}
                                      <div className="col-span-12 sm:col-span-4">
                                        <label className="label-lte font-extrabold text-[8px] text-emerald-800 uppercase">3. New Spare Photo <span className="text-red-500">*</span></label>
                                        {leg.calls_new_spare_photo ? (
                                          <div className="flex gap-1.5 h-9 items-center justify-between bg-emerald-50 border border-emerald-200 px-2 rounded-lg text-[10px] font-bold">
                                            <span className="text-emerald-800 cursor-pointer underline truncate max-w-[120px]" onClick={() => setLightboxImage(formatImageUrl(leg.calls_new_spare_photo))}>View Photo</span>
                                            <button type="button" onClick={() => handleItineraryChange(leg.leg, "calls_new_spare_photo", "")} className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-xs">✕</button>
                                          </div>
                                        ) : (
                                          <label className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-700 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs w-full">
                                            <Camera className="w-4 h-4 text-white" />
                                            <span>3. New Spare Photo</span>
                                            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadActivityPhoto(leg.leg, "Calls_New_Spare", e.target.files[0])} className="hidden" />
                                          </label>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="col-span-12">
                                      <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase">Service Report Photo <span className="text-red-500">*</span></label>
                                      {leg.calls_photo_url ? (
                                        <div className="flex gap-1.5 h-9 items-center justify-between bg-blue-50 border border-blue-200 px-2 rounded-lg text-[10px] font-bold">
                                          <span className="text-blue-700 cursor-pointer underline truncate max-w-[160px]" onClick={() => setLightboxImage(formatImageUrl(leg.calls_photo_url))}>View Service Report Photo</span>
                                          <button type="button" onClick={() => handleItineraryChange(leg.leg, "calls_photo_url", "")} className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-xs">✕</button>
                                        </div>
                                      ) : (
                                        <label className="cursor-pointer bg-gray-900 hover:bg-gray-800 text-white border border-gray-900 rounded-lg h-9 px-3 flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs w-full">
                                          <Camera className="w-4 h-4 text-white" />
                                          <span>Add Service Report Photo</span>
                                          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadActivityPhoto(leg.leg, "Calls", e.target.files[0])} className="hidden" />
                                        </label>
                                      )}
                                    </div>
                                  )}

                                  {/* + Add Entry Button */}
                                  <div className="col-span-12 flex justify-end pt-2">
                                    <div
                                      onClick={() => leg.calls_verified && addVerifiedBarcode(leg.leg, "Calls")}
                                      className="h-9 px-4 flex items-center justify-center rounded-lg shadow-sm transition-colors text-xs font-bold uppercase gap-1.5 w-full sm:w-auto"
                                      style={
                                        leg.calls_verified
                                          ? { backgroundColor: '#111827', color: '#ffffff', borderColor: '#000000', borderWidth: '1.5px', borderStyle: 'solid', cursor: 'pointer' }
                                          : { backgroundColor: '#e2e8f0', color: '#94a3b8', borderColor: '#cbd5e1', borderWidth: '1.5px', borderStyle: 'solid', cursor: 'not-allowed' }
                                      }
                                      title="Add Verified Call Entry"
                                    >
                                      <Plus className="w-4 h-4" /> Add Call Entry
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Verified Preview Info */}
                              {leg.calls_verified && leg.calls_asset_details && (
                                <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] p-2 rounded flex flex-wrap gap-x-4">
                                  <span><strong>Verified Asset:</strong> {leg.calls_asset_details.equipment_name} ({leg.calls_asset_details.model_name})</span>
                                  <span><strong>Hospital:</strong> {leg.calls_asset_details.hospital_name}</span>
                                  <span><strong>District:</strong> {leg.calls_asset_details.district_name}</span>
                                  <span><strong>Status:</strong> {leg.calls_asset_details.inventory_status}</span>
                                </div>
                              )}

                              {/* Added Barcodes Table */}
                              {(leg.calls_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-x-auto mt-2 bg-white w-full max-w-full block scrollbar-thin">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left font-mono">Complaint ID</th>
                                        <th className="py-1.5 px-2 text-left font-mono">Bar Code</th>
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-left">Hospital Name</th>
                                        <th className="py-1.5 px-2 text-left">Call Type</th>
                                        <th className="py-1.5 px-2 text-left">Call Status</th>
                                        <th className="py-1.5 px-2 text-left">Action Taken</th>
                                        <th className="py-1.5 px-2 text-left">Spare Replaced</th>
                                        <th className="py-1.5 px-2 text-center">Photos</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.calls_list || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="py-1.5 px-2 font-mono font-bold text-blue-700 text-[10px]">{item.complaint_id || "—"}</td>
                                          <td className="py-1.5 px-2 font-mono font-bold text-gray-800 text-[10px]">{item.barcode}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700 font-bold">{item.asset_details?.equipment_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.hospital_name || item.asset_details?.hospital_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-800 max-w-[150px] truncate">{item.action_taken || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] font-bold">
                                             {item.spare_replaced === "Yes" ? (
                                               <span className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Yes (₹{item.spare_estimated_value || 0})</span>
                                             ) : (
                                               <span className="text-gray-500">No</span>
                                             )}
                                           </td>
                                           <td className="py-1.5 px-2 text-center">
                                             <div className="flex items-center justify-center gap-1">
                                               {item.photo_url && (
                                                 <button type="button" onClick={() => setLightboxImage(formatImageUrl(item.photo_url))} className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded border border-blue-200 hover:underline">Report</button>
                                               )}
                                               {item.old_spare_photo && (
                                                 <button type="button" onClick={() => setLightboxImage(formatImageUrl(item.old_spare_photo))} className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200 hover:underline">Old Spare</button>
                                               )}
                                               {item.new_spare_photo && (
                                                 <button type="button" onClick={() => setLightboxImage(formatImageUrl(item.new_spare_photo))} className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 hover:underline">New Spare</button>
                                               )}
                                             </div>
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] uppercase ${
                                              item.status === "Close" ? "bg-green-50 text-green-700 border border-green-200" :
                                              item.status === "Attend & Close" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                              "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removeBarcode(leg.leg, "Calls", idx)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                              title="Remove Call entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            );
                          })()}

                          {/* PMS Sub-Form */}
                          {(leg.selected_activities || []).includes("PMS") && (
                            <div className="bg-amber-50/20 border border-amber-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                                <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                                  🛠️ Preventive Maintenance Services (PMS)
                                </span>
                              </div>

                              <div className="grid grid-cols-12 gap-2.5 items-end bg-white p-2.5 rounded-lg border border-amber-200 text-[10px]">
                                {/* 1. Barcode */}
                                <div className="col-span-12 sm:col-span-5">
                                  <label className="label-lte font-extrabold text-[8px] text-amber-900 uppercase">Barcode (QR) <span className="text-red-500">*</span></label>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={8}
                                      value={leg.pms_barcode || ""}
                                      placeholder="8 numeric digits"
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, "");
                                        handleItineraryChange(leg.leg, "pms_barcode", cleaned);
                                        handleItineraryChange(leg.leg, "pms_verified", false);
                                        handleItineraryChange(leg.leg, "pms_asset_details", null);
                                      }}
                                      className="input-lte font-mono h-7 py-0.5 px-2 text-xs border-amber-200 w-full"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (String(leg.pms_barcode || '').replace(/\D/g, '').length === 8) {
                                          verifyLegBarcode(leg.leg, "PMS");
                                        }
                                      }}
                                      className="h-7 px-3 flex items-center justify-center rounded text-[10px] font-extrabold uppercase select-none transition-colors border-0 cursor-pointer shrink-0"
                                      style={
                                        String(leg.pms_barcode || '').replace(/\D/g, '').length === 8
                                          ? { backgroundColor: '#10b981', color: '#ffffff' }
                                          : { backgroundColor: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }
                                      }
                                    >
                                      Verify
                                    </button>
                                  </div>
                                </div>

                                {/* 2. PMS Period */}
                                <div className="col-span-6 sm:col-span-3">
                                  <label className="label-lte font-extrabold text-[8px] text-amber-900 uppercase">PMS Period <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.pms_frequency || "3 month"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "pms_frequency", e.target.value)}
                                    className="input-lte text-[10px] font-bold h-7 py-0.5 px-1.5 bg-white border-amber-200 w-full"
                                  >
                                    <option value="3 month">3 month</option>
                                    <option value="6 month">6 month</option>
                                    <option value="12 month">12 month</option>
                                  </select>
                                </div>

                                {/* 3. Photo Upload */}
                                <div className="col-span-6 sm:col-span-4">
                                  <label className="label-lte font-extrabold text-[8px] text-amber-900 uppercase">PMS Report Photo <span className="text-red-500">*</span></label>
                                  {leg.pms_photo_url ? (
                                    <div className="flex gap-1 h-7 items-center justify-between bg-white border border-amber-300 px-1.5 rounded text-[9px] font-bold">
                                      <span className="text-amber-700 cursor-pointer underline truncate max-w-[80px]" onClick={() => {
                                        const fullUrl = formatImageUrl(leg.pms_photo_url);
                                        setLightboxImage(fullUrl);
                                      }}>Preview</span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          handleItineraryChange(leg.leg, "pms_photo_url", "");
                                          handleItineraryChange(leg.leg, "pms_photo_name", "");
                                        }} 
                                        className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-[9px]"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded h-7 px-2 flex items-center justify-center gap-1.5 text-[9.5px] font-extrabold shadow-2xs w-full">
                                      <Camera className="w-3 h-3 text-white" />
                                      <span>Add Report Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) uploadActivityPhoto(leg.leg, "PMS", file);
                                        }}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  {leg.pms_photo_loading && <span className="text-[8px] text-amber-700 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                </div>

                                {/* 4. Add Verified PMS Entry Button */}
                                <div className="col-span-12 flex justify-center sm:justify-end mt-1 w-full">
                                  <button
                                    type="button"
                                    onClick={() => leg.pms_verified && addVerifiedBarcode(leg.leg, "PMS")}
                                    disabled={!leg.pms_verified}
                                    className="btn-lte h-8 sm:h-7 py-1 sm:py-0.5 px-4 sm:px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] sm:text-[10px] uppercase rounded border-0 cursor-pointer flex items-center justify-center gap-1.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-2xs w-full sm:w-auto"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add PMS Entry
                                  </button>
                                </div>
                              </div>

                              {/* Verified Preview Info */}
                              {leg.pms_verified && leg.pms_asset_details && (
                                <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] p-2 rounded flex flex-wrap gap-x-4">
                                  <span><strong>Verified Asset:</strong> {leg.pms_asset_details.equipment_name} ({leg.pms_asset_details.model_name})</span>
                                  <span><strong>Hospital:</strong> {leg.pms_asset_details.hospital_name}</span>
                                  <span><strong>District:</strong> {leg.pms_asset_details.district_name}</span>
                                  <span><strong>Status:</strong> {leg.pms_asset_details.inventory_status}</span>
                                </div>
                              )}

                              {/* Added PMS Barcodes Table */}
                              {(leg.pms_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-x-auto mt-2 bg-white w-full max-w-full block scrollbar-thin">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left">District Name</th>
                                        <th className="py-1.5 px-2 text-left">Hospital Name</th>
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-left">Model</th>
                                        <th className="py-1.5 px-2 text-left font-mono">Bar Code</th>
                                        <th className="py-1.5 px-2 text-left">Inventory Status</th>
                                        <th className="py-1.5 px-2 text-left">PMS Frequency Period</th>
                                        <th className="py-1.5 px-2 text-center w-12">Photo</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.pms_list || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.district_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.hospital_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700 font-bold">{item.asset_details?.equipment_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.model_name || "—"}</td>
                                          <td className="py-1.5 px-2 font-mono font-bold text-gray-800">{item.barcode}</td>
                                          <td className="py-1.5 px-2">
                                            <span className="px-1.5 py-0.5 rounded font-bold text-[8px] uppercase bg-green-50 text-green-700 border border-green-200">
                                              {item.asset_details?.inventory_status || "Active"}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-600 font-semibold">{item.frequency}</td>
                                          <td className="py-1.5 px-2 text-center">
                                            {item.photo_url ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const fullUrl = formatImageUrl(item.photo_url);
                                                  setLightboxImage(fullUrl);
                                                }}
                                                className="text-xs text-blue-600 font-bold hover:underline border-0 bg-transparent cursor-pointer"
                                              >
                                                Preview
                                              </button>
                                            ) : (
                                              <span className="text-[10px] text-gray-400">—</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removeBarcode(leg.leg, "PMS", idx)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                              title="Remove PMS entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Asset Tagging Sub-Form */}
                          {(leg.selected_activities || []).includes("Asset Tagging") && (() => {
                            const destDistrict = leg.district || leg.to || "";
                            const districtHospitals = getFacilitiesForDistrict(destDistrict);

                            return (
                            <div className="bg-emerald-50/30 border border-emerald-200 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                                <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                  🏷️ Asset Tagging Details
                                </span>
                              </div>

                              <div className="grid grid-cols-12 gap-2.5 items-end bg-white p-2.5 rounded-lg border border-emerald-100 text-[10px]">
                                {/* 1. Equipment Selection */}
                                <div className="col-span-12 sm:col-span-6">
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">Select Equipment Name <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.asset_tagging_equipment || ""}
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_equipment", e.target.value)}
                                    className="input-lte text-[10px] font-semibold h-7 py-0.5 px-1.5 bg-white border-emerald-200 w-full"
                                  >
                                    <option value="">-- Choose Equipment --</option>
                                    {assetValueMaster.map((eq, i) => (
                                      <option key={i} value={eq.equipment_name}>
                                        {eq.equipment_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* 2. Barcode 2 Columns: Prefix (Non-editable) + Suffix (8 digits) */}
                                <div className="col-span-12 sm:col-span-6">
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">BARCODE <span className="text-red-500">*</span></label>
                                  <div className="flex items-center h-7 rounded border border-slate-300 overflow-hidden bg-white shadow-2xs w-full">
                                    <span className="bg-slate-100 px-1.5 h-full flex items-center justify-center text-[9px] sm:text-[10px] font-mono font-bold text-slate-700 select-none shrink-0 border-r border-slate-300">
                                      (8004890615671)
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={8}
                                      placeholder="8 numeric digits"
                                      value={leg.asset_tagging_suffix || ""}
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        handleItineraryChange(leg.leg, "asset_tagging_suffix", cleaned);
                                        handleItineraryChange(leg.leg, "asset_tagging_barcode", `(8004890615671) ${cleaned}`);
                                      }}
                                      className="font-mono font-bold text-[10px] px-1.5 h-full flex-1 min-w-0 outline-none border-0 bg-transparent text-slate-800"
                                    />
                                  </div>
                                </div>

                                {/* 3. Hospital Name */}
                                <div className="col-span-12 sm:col-span-6">
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">HOSPITAL NAME <span className="text-red-500">*</span></label>
                                  {districtHospitals.length > 0 ? (
                                    <select
                                      value={leg.asset_tagging_hospital || ""}
                                      onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_hospital", e.target.value)}
                                      className="input-lte text-[10px] font-semibold h-7 py-0.5 px-1.5 bg-white border-emerald-200 w-full"
                                    >
                                      <option value="">-- Choose Hospital --</option>
                                      {districtHospitals.map((h, hIdx) => (
                                        <option key={hIdx} value={h}>{h}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={leg.asset_tagging_hospital || ""}
                                      placeholder="Enter Hospital / Facility Name"
                                      onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_hospital", e.target.value)}
                                      className="input-lte text-[10px] font-semibold h-7 py-0.5 px-1.5 bg-white w-full border-emerald-200"
                                    />
                                  )}
                                </div>

                                {/* 4. Make & Model */}
                                <div className="col-span-6 sm:col-span-3">
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">Make / Brand <span className="text-red-500">*</span></label>
                                  <input
                                    type="text"
                                    value={leg.asset_tagging_make || ""}
                                    placeholder="e.g. Philips, GE"
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_make", e.target.value)}
                                    className="input-lte text-[10px] h-7 py-0.5 px-1.5 bg-white w-full border-emerald-200"
                                  />
                                </div>
                                <div className="col-span-6 sm:col-span-3">
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">Model <span className="text-red-500">*</span></label>
                                  <input
                                    type="text"
                                    value={leg.asset_tagging_model || ""}
                                    placeholder="Model No / Name"
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_model", e.target.value)}
                                    className="input-lte text-[10px] h-7 py-0.5 px-1.5 bg-white w-full border-emerald-200"
                                  />
                                </div>

                                {/* 5. Serial Number & 6. Warranty Toggle */}
                                <div className={leg.asset_tagging_has_warranty === "Yes" ? "col-span-6 sm:col-span-3" : "col-span-6 sm:col-span-3"}>
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase">Serial Number <span className="text-red-500">*</span></label>
                                  <input
                                    type="text"
                                    value={leg.asset_tagging_serial || ""}
                                    placeholder="Serial No"
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_serial", e.target.value)}
                                    className="input-lte font-mono text-[10px] h-7 py-0.5 px-1.5 bg-white w-full border-emerald-200"
                                  />
                                </div>
                                <div className={leg.asset_tagging_has_warranty === "Yes" ? "col-span-6 sm:col-span-3" : "col-span-6 sm:col-span-3"}>
                                  <label className="label-lte font-extrabold text-[8px] text-emerald-900 uppercase whitespace-nowrap truncate block">WARRANTY AVAILABLE? <span className="text-red-500">*</span></label>
                                  <select
                                    value={leg.asset_tagging_has_warranty || "No"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_has_warranty", e.target.value)}
                                    className="input-lte text-[10px] font-bold h-7 py-0.5 px-1.5 bg-white w-full border-emerald-200"
                                  >
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                  </select>
                                </div>

                                {/* Warranty Dates (If Yes) */}
                                {leg.asset_tagging_has_warranty === "Yes" && (
                                  <>
                                    <div className="col-span-6 sm:col-span-3">
                                      <label className="label-lte font-extrabold text-[8px] text-emerald-800 uppercase">Start Date <span className="text-red-500">*</span></label>
                                      <input
                                        type="date"
                                        value={leg.asset_tagging_warranty_start || ""}
                                        onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_warranty_start", e.target.value)}
                                        className="input-lte text-[10px] font-semibold h-7 py-0.5 px-1 bg-emerald-50 border-emerald-300 w-full"
                                      />
                                    </div>
                                    <div className="col-span-6 sm:col-span-3">
                                      <label className="label-lte font-extrabold text-[8px] text-emerald-800 uppercase">End Date <span className="text-red-500">*</span></label>
                                      <input
                                        type="date"
                                        value={leg.asset_tagging_warranty_end || ""}
                                        onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_warranty_end", e.target.value)}
                                        className="input-lte text-[10px] font-semibold h-7 py-0.5 px-1 bg-emerald-50 border-emerald-300 w-full"
                                      />
                                    </div>
                                  </>
                                )}

                                {/* 3 Photo Upload Columns */}
                                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200 mt-1">
                                  {/* Photo 1: Barcode Photo */}
                                  <div className="col-span-1">
                                    <label className="label-lte font-bold text-[8px] text-emerald-800 uppercase block mb-0.5">
                                      1. Barcode Photo
                                    </label>
                                    {leg.asset_tagging_barcode_photo ? (
                                      <div className="flex gap-1 h-7 items-center justify-between bg-white border border-emerald-300 px-1.5 rounded text-[9px] font-bold">
                                        <span className="text-emerald-700 cursor-pointer underline truncate max-w-[80px]" onClick={() => {
                                          const fullUrl = formatImageUrl(leg.asset_tagging_barcode_photo);
                                          setLightboxImage(fullUrl);
                                        }}>Preview</span>
                                        <button 
                                          type="button" 
                                          onClick={() => handleItineraryChange(leg.leg, "asset_tagging_barcode_photo", "")} 
                                          className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-[9px]"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded h-7 px-2 flex items-center justify-center gap-1 text-[9px] font-extrabold shadow-2xs w-full">
                                        <Camera className="w-3 h-3 text-white" />
                                        <span>Add Barcode Photo</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadActivityPhoto(leg.leg, "Asset_Barcode", file);
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                    {leg.asset_barcode_photo_loading && <span className="text-[8px] text-emerald-700 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                  </div>

                                  {/* Photo 2: Serial Number Photo */}
                                  <div className="col-span-1">
                                    <label className="label-lte font-bold text-[8px] text-emerald-800 uppercase block mb-0.5">
                                      2. Serial Number Photo
                                    </label>
                                    {leg.asset_tagging_serial_photo ? (
                                      <div className="flex gap-1 h-7 items-center justify-between bg-white border border-emerald-300 px-1.5 rounded text-[9px] font-bold">
                                        <span className="text-emerald-700 cursor-pointer underline truncate max-w-[80px]" onClick={() => {
                                          const fullUrl = formatImageUrl(leg.asset_tagging_serial_photo);
                                          setLightboxImage(fullUrl);
                                        }}>Preview</span>
                                        <button 
                                          type="button" 
                                          onClick={() => handleItineraryChange(leg.leg, "asset_tagging_serial_photo", "")} 
                                          className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-[9px]"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded h-7 px-2 flex items-center justify-center gap-1 text-[9px] font-extrabold shadow-2xs w-full">
                                        <Camera className="w-3 h-3 text-white" />
                                        <span>Add Serial Photo</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadActivityPhoto(leg.leg, "Asset_Serial", file);
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                    {leg.asset_serial_photo_loading && <span className="text-[8px] text-emerald-700 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                  </div>

                                  {/* Photo 3: Make & Model Photo */}
                                  <div className="col-span-1">
                                    <label className="label-lte font-bold text-[8px] text-emerald-800 uppercase block mb-0.5">
                                      3. Make & Model Photo
                                    </label>
                                    {leg.asset_tagging_model_photo ? (
                                      <div className="flex gap-1 h-7 items-center justify-between bg-white border border-emerald-300 px-1.5 rounded text-[9px] font-bold">
                                        <span className="text-emerald-700 cursor-pointer underline truncate max-w-[80px]" onClick={() => {
                                          const fullUrl = formatImageUrl(leg.asset_tagging_model_photo);
                                          setLightboxImage(fullUrl);
                                        }}>Preview</span>
                                        <button 
                                          type="button" 
                                          onClick={() => handleItineraryChange(leg.leg, "asset_tagging_model_photo", "")} 
                                          className="text-rose-600 border-0 bg-transparent font-black cursor-pointer text-[9px]"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded h-7 px-2 flex items-center justify-center gap-1 text-[9px] font-extrabold shadow-2xs w-full">
                                        <Camera className="w-3 h-3 text-white" />
                                        <span>Add Model Photo</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadActivityPhoto(leg.leg, "Asset_Model", file);
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                    {leg.asset_model_photo_loading && <span className="text-[8px] text-emerald-700 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                  </div>
                                 </div>

                                 {/* Add Asset Tag Button */}
                                 <div className="col-span-12 flex justify-center sm:justify-end mt-2 w-full">
                                   <button
                                     type="button"
                                     onClick={() => addAssetTag(leg.leg)}
                                     disabled={!leg.asset_tagging_equipment || (leg.asset_tagging_suffix || "").length !== 8}
                                     className="btn-lte h-8 sm:h-7 py-1 sm:py-0.5 px-4 sm:px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] sm:text-[10px] uppercase rounded border-0 cursor-pointer flex items-center justify-center gap-1.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-2xs w-full sm:w-auto"
                                   >
                                     <Plus className="w-3.5 h-3.5" /> Save Tagged Asset
                                   </button>
                                 </div>
                               </div>

                              {/* Added Assets Table */}
                              {(leg.assets_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-x-auto mt-1 bg-white w-full max-w-full block scrollbar-thin">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left font-mono">Barcode</th>
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-left">Hospital</th>
                                        <th className="py-1.5 px-2 text-left">Make / Model</th>
                                        <th className="py-1.5 px-2 text-left">Warranty</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.assets_list || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="py-1.5 px-2 font-mono font-bold text-emerald-800 text-[10px]">{item.barcode || item.equipment_name}</td>
                                          <td className="py-1.5 px-2 font-bold text-gray-800 text-[10px]">{item.equipment_name}</td>
                                          <td className="py-1.5 px-2 text-gray-700 text-[10px]">{item.hospital_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-gray-600 text-[10px]">{item.make || item.model ? `${item.make || ''} ${item.model || ''}` : "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px]">
                                            {item.has_warranty === "Yes" ? (
                                              <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[8.5px]">
                                                {item.warranty_start} to {item.warranty_end}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">No</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removeAssetTag(leg.leg, idx)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                              title="Remove equipment entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            );
                          })()}

                          {/* Mobilise Asset Update Sub-Form */}
                          {(leg.selected_activities || []).includes("Mobilise Asset Update") && (
                            <div className="bg-indigo-50/20 border border-indigo-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Mobilise Asset Update</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div>
                                  <label className="label-lte">Mobilise Count (Qty)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={leg.mobilise_asset_count || ""}
                                    onChange={(e) => handleItineraryChange(leg.leg, "mobilise_asset_count", e.target.value)}
                                    className="input-lte font-semibold"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Calibration Sub-Form */}
                          {((leg.selected_activities || []).includes("Calibration") || (user?.designation || "").toLowerCase().includes("calibration")) && (
                            <div className="bg-purple-50/20 border border-purple-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">Calibration Tasks</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div>
                                  <label className="label-lte">Calibration Count (Qty)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={leg.calibration_count || ""}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calibration_count", e.target.value)}
                                    className="input-lte font-semibold"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Other Task Sub-Form */}
                          {(leg.selected_activities || []).includes("Other") && (
                            <div className="bg-slate-50/70 border border-slate-300 rounded-lg p-3 flex flex-col gap-2.5 shadow-2xs">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                  ✏️ Other Activity Description / Remark
                                </span>
                                <span className="text-[8.5px] font-extrabold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 uppercase tracking-wider shrink-0">
                                  Required
                                </span>
                              </div>
                              <div>
                                <label className="label-lte text-slate-700 font-extrabold text-[9px] uppercase tracking-wider mb-1 block">
                                  State Exact Details & Purpose of Work Done <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  value={leg.activity_other_desc || ""}
                                  onChange={(e) => handleItineraryChange(leg.leg, "activity_other_desc", e.target.value)}
                                  placeholder="Describe the miscellaneous work performed in detail..."
                                  rows={2.5}
                                  className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 focus:border-slate-500 rounded-md p-2.5 shadow-2xs placeholder:text-slate-400 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add leg trigger */}
            <button
              type="button"
              onClick={addItinerary}
              className={`w-full py-2.5 flex items-center justify-center gap-1.5 font-bold mb-6 cursor-pointer rounded transition-all text-xs uppercase tracking-wider ${
                (itineraries[itineraries.length - 1]?.travel_type || "In-District") === "In-District"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-indigo-700"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm border border-amber-650"
              }`}
            >
              <Plus className="w-4 h-4 animate-bounce" /> Add Visit
            </button>

          </div>

        </div>

        {/* Claims Totals & Submissions bar (Full width under the grid) */}
        <div className="bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 border border-slate-200/90 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-4 text-xs font-semibold mt-6 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#4A6A8A] flex items-center justify-center text-white shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-wider m-0">Claim Financial Summary</h3>
                <p className="text-[9.5px] text-slate-500 font-medium m-0">Review breakdown before submitting claim</p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span className="text-[9px] font-extrabold uppercase text-emerald-800 tracking-wider">NET PAYABLE:</span>
              <span className="text-emerald-700 font-black font-mono text-base">₹{totalAmt.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">TRAVEL DATE</span>
              <span className="text-slate-900 font-bold text-[11px] truncate block">{date || "No date selected"}</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">VISITS / LEGS</span>
              <span className="text-slate-900 font-bold text-[11px]">{itineraries.length} Visit{itineraries.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">BIKE / CAR</span>
              <span className="text-slate-900 font-mono font-bold text-[11px]">{totalBikeCarKm.toFixed(1)} KM (₹{totalBikeCarAmt.toLocaleString()})</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">ALLOWANCE (DA)</span>
              <span className="text-slate-900 font-mono font-bold text-[11px]">₹{totalDA.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">AUTO / CAB</span>
              <span className="text-slate-900 font-mono font-bold text-[11px]">₹{totalAuto.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">HOTEL / STAY</span>
              <span className="text-slate-900 font-mono font-bold text-[11px]">₹{totalHotel.toLocaleString()}</span>
            </div>
            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-150">
              <span className="text-slate-400 uppercase text-[8.5px] font-extrabold block mb-0.5 tracking-wider">SPARE / OTHER</span>
              <span className="text-slate-900 font-mono font-bold text-[11px]">₹{(totalLocalPurchase + totalOther).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 w-full pt-1">
            {isLimitExceeded && (
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                disabled={policyMissing}
                className="w-full sm:w-auto h-11 px-5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4" /> EXTEND LIMIT
              </button>
            )}
            <button
              type="submit"
              disabled={isLimitExceeded || submitting || policyMissing}
              className="w-full sm:w-auto h-11 px-7 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>SUBMITTING...</span>
                </>
              ) : (
                <>
                  <Check className="w-4.5 h-4.5 stroke-[3] shrink-0" />
                  <span>{editExpenseId ? "UPDATE CLAIM" : "SUBMIT CLAIM"}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="w-full sm:w-auto h-11 px-6 bg-white hover:bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-xs rounded-xl border border-slate-300 shadow-xs flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
            >
              CANCEL
            </button>
          </div>
        </div>

        {/* Visit Activities Metrics Summary Grid of Box Cards */}
        <div className="mt-3 grid grid-cols-6 gap-1.5 w-full text-xs font-semibold">
          {/* Card 1: Calls Attended */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">Attended</span>
            <span className="text-gray-900 font-mono font-black text-xs leading-none">{totalCallsAttended}</span>
          </div>

          {/* Card 2: Calls Closed */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md border-t-2 border-t-green-500">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">Closed</span>
            <span className="text-green-700 font-mono font-black text-xs leading-none">{totalCallsClosed}</span>
          </div>

          {/* Card 3: PMs Done */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md border-t-2 border-t-amber-500">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">PMs</span>
            <span className="text-amber-700 font-mono font-black text-xs leading-none">{totalPmsDone}</span>
          </div>

          {/* Card 4: Assets Tagged */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md border-t-2 border-t-emerald-500">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">Tagged</span>
            <span className="text-emerald-700 font-mono font-black text-xs leading-none">{totalAssetsTagged}</span>
          </div>

          {/* Card 5: Mobilise Assets */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md border-t-2 border-t-indigo-500">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">Mobilise</span>
            <span className="text-indigo-700 font-mono font-black text-xs leading-none">{totalMobiliseAsset}</span>
          </div>

          {/* Card 6: Calibrations */}
          <div className="bg-white border border-gray-200 sharp-card rounded-none p-1 shadow-xs text-center flex flex-col justify-center items-center h-11 transition-all hover:shadow-md border-t-2 border-t-purple-500">
            <span className="text-gray-400 uppercase text-[6px] tracking-wider font-black mb-0.5 block leading-tight">Calib</span>
            <span className="text-purple-700 font-mono font-black text-xs leading-none">{totalCalibration}</span>
          </div>
        </div>

      </form>

      {/* Full Width Bottom Section: Recent Submissions table with Ant Design Tabs and Filters */}
      <Card
        className="sharp-card rounded-none border-slate-200/80 shadow-xs overflow-hidden mt-6"
        bodyStyle={{ padding: 0 }}
      >
        {/* Card Header with Sharp Tab Switcher */}
        <div className="px-4 py-3 bg-[#4A6A8A] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2">
            <FileText className="text-white w-4 h-4" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider m-0">MY CLAIMS DASHBOARD</h3>
          </div>
          
          {/* Custom Sharp Tab Buttons */}
          <div className="flex gap-1.5 bg-black/20 p-1 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => { setActiveClaimsTab("sheets"); setMyClaimsPage(1); }}
              className={`px-3 py-1 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                activeClaimsTab === "sheets"
                  ? "bg-white text-[#4A6A8A] shadow-xs"
                  : "bg-transparent text-white/80 hover:bg-white/10"
              }`}
            >
              Expense Sheets ({getFilteredClaims().length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveClaimsTab("legs"); setMyClaimsPage(1); }}
              className={`px-3 py-1 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                activeClaimsTab === "legs"
                  ? "bg-white text-[#4A6A8A] shadow-xs"
                  : "bg-transparent text-white/80 hover:bg-white/10"
              }`}
            >
              Legs Details ({getFilteredLegs().length})
            </button>
          </div>
        </div>

        {/* High-Density Responsive Filter Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box with Non-Overlapping Magnifying Glass */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search code, route, amount..."
              value={claimsSearch}
              onChange={(e) => { setClaimsSearch(e.target.value); setMyClaimsPage(1); }}
              style={{ paddingLeft: "2.25rem", paddingRight: "2rem" }}
              className="w-full h-9 rounded-lg font-semibold text-xs border border-slate-300 bg-white shadow-2xs focus:border-blue-500 focus:outline-none"
            />
            {claimsSearch && (
              <button
                type="button"
                onClick={() => { setClaimsSearch(""); setMyClaimsPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Grid with Full Width Option Support */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center">
            <div className="flex flex-col gap-0.5 w-full md:w-auto">
              <span className="text-[8.5px] font-extrabold uppercase text-slate-500 tracking-wider">MONTH</span>
              <select
                value={claimsMonthFilter}
                onChange={(e) => { setClaimsMonthFilter(e.target.value); setMyClaimsPage(1); }}
                className="w-full md:w-32 h-8 px-2 text-[11px] font-bold border border-slate-300 bg-white rounded-lg cursor-pointer focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Months</option>
                {getUniqueMonths().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-0.5 w-full md:w-auto">
              <span className="text-[8.5px] font-extrabold uppercase text-slate-500 tracking-wider">STATUS</span>
              <select
                value={claimsStatusFilter}
                onChange={(e) => { setClaimsStatusFilter(e.target.value as any); setMyClaimsPage(1); }}
                className="w-full md:w-32 h-8 px-2 text-[11px] font-bold border border-slate-300 bg-white rounded-lg cursor-pointer focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="returned_to_draft">Returned</option>
              </select>
            </div>

            <div className="flex flex-col gap-0.5 w-full md:w-auto">
              <span className="text-[8.5px] font-extrabold uppercase text-slate-500 tracking-wider">SORT</span>
              <select
                value={claimsSortOrder}
                onChange={(e) => { setClaimsSortOrder(e.target.value as any); setMyClaimsPage(1); }}
                className="w-full md:w-32 h-8 px-2 text-[11px] font-bold border border-slate-300 bg-white rounded-lg cursor-pointer focus:border-blue-500 focus:outline-none"
              >
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">High Amt</option>
                <option value="amount_asc">Low Amt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table / Cards Content */}
        <div className="p-3 sm:p-4">
          {claimsLoading ? (
            <Loader message="Loading claims data..." />
          ) : (
            (() => {
              const filteredClaims = getFilteredClaims();
              const filteredLegs = getFilteredLegs();
              const itemsList = activeClaimsTab === "sheets" ? filteredClaims : filteredLegs;
              const totalItems = itemsList.length;
              const slicedItems = itemsList.slice((myClaimsPage - 1) * myClaimsPageSize, myClaimsPage * myClaimsPageSize);

              if (totalItems === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    No matching claim records found.
                  </div>
                );
              }

              if (activeClaimsTab === "sheets") {
                return (
                  <>
                    <div className="overflow-x-auto w-full border border-slate-200 shadow-2xs rounded-none">
                      <table className="hidden md:table table-lte w-full text-xs min-w-[850px]">
                        <thead>
                          <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-black tracking-wider border-b border-slate-700">
                            <th className="py-2.5 px-3 text-left">Claim ID</th>
                            <th className="py-2.5 px-3 text-left">Date</th>
                            <th className="py-2.5 px-3 text-left">Purpose</th>
                            <th className="py-2.5 px-3 text-left">Travel Mode</th>
                            <th className="py-2.5 px-3 text-left">Amount</th>
                            <th className="py-2.5 px-3 text-left">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {slicedItems.map((exp: any) => (
                            <tr
                              key={exp.id}
                              onClick={() => handleViewDetails(exp.id)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-3 font-semibold font-mono text-indigo-600 uppercase whitespace-nowrap">{exp.expense_code}</td>
                              <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">{exp.itinerary}</td>
                              <td className="py-3 px-3 font-semibold text-slate-800 truncate max-w-[200px] whitespace-nowrap" title={exp.description}>{exp.description}</td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{exp.travel_mode}</td>
                              <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap text-blue-700">₹{exp.amount.toLocaleString()}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {renderAntdStatusTag(exp.status)}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {(exp.status === "draft" || exp.status === "submitted" || exp.status === "returned_to_draft") && (
                                  <Space size="small">
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<EditOutlined />}
                                      onClick={() => handleEditFromModal(exp.id)}
                                      className="bg-amber-500 hover:bg-amber-600 font-bold text-[10px] border-0"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="small"
                                      danger
                                      icon={<CloseCircleOutlined />}
                                      onClick={() => handleDeleteClaim(exp.id)}
                                      className="font-bold text-[10px]">
                                       Cancel
                                     </Button>
                                  </Space>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden space-y-3 text-xs">
                      {slicedItems.map((exp: any) => (
                        <div
                          key={exp.id}
                          onClick={() => handleViewDetails(exp.id)}
                          className={`sharp-card bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 active:bg-slate-50 transition-all cursor-pointer text-xs ${getCardStatusClass(exp.status)}`}
                        >
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2 flex-wrap gap-1">
                            <span className="font-extrabold font-mono text-indigo-600 text-xs uppercase">{exp.expense_code}</span>
                            {renderAntdStatusTag(exp.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-400 font-bold uppercase text-[9px] block">Travel Date</span>
                              <span className="text-slate-700 font-semibold">{exp.itinerary}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase text-[9px] block">Travel Mode</span>
                              <span className="text-slate-700 font-semibold">{exp.travel_mode || "Other"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold uppercase text-[9px] block">Total Claimed</span>
                              <span className="text-slate-900 font-black text-sm text-blue-700">₹{exp.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {(exp.status === "draft" || exp.status === "submitted" || exp.status === "returned_to_draft") && (
                                <>
                                  <Button
                                    size="small"
                                    type="primary"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditFromModal(exp.id)}
                                    className="bg-amber-500 hover:bg-amber-600 font-bold text-[10px] border-0"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="small"
                                    danger
                                    icon={<CloseCircleOutlined />}
                                    onClick={() => handleDeleteClaim(exp.id)}
                                    className="font-bold text-[10px]">
                                       Cancel
                                     </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {exp.description && (
                            <div className="border-t border-slate-100 pt-2 text-[10px]">
                              <span className="text-slate-400 font-bold uppercase text-[8px] block">Purpose / Work Summary</span>
                              <p className="text-slate-700 font-medium mt-0.5 truncate m-0">{exp.description}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <div className="overflow-x-auto w-full border border-slate-200 shadow-2xs rounded-none">
                      <table className="hidden md:table table-lte w-full text-xs min-w-[1100px]">
                        <thead>
                          <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-black tracking-wider border-b border-slate-700">
                            <th className="py-2.5 px-3 text-left">Parent ID</th>
                            <th className="py-2.5 px-3 text-left">Travel Date</th>
                            <th className="py-2.5 px-3 text-center">Leg</th>
                            <th className="py-2.5 px-3 text-left">Route</th>
                            <th className="py-2.5 px-3 text-left">Mode</th>
                            <th className="py-2.5 px-3 text-right">KM</th>
                            <th className="py-2.5 px-3 text-right">Fare</th>
                            <th className="py-2.5 px-3 text-right">DA</th>
                            <th className="py-2.5 px-3 text-right">Hotel</th>
                            <th className="py-2.5 px-3 text-right">Local Purchase</th>
                            <th className="py-2.5 px-3 text-right">Other</th>
                            <th className="py-2.5 px-3 text-left">Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {slicedItems.map((leg: any, idx: number) => {
                            const hasSub = leg.sub_mode && (parseFloat(leg.sub_amount) || 0) > 0;
                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-semibold font-mono text-indigo-600 uppercase whitespace-nowrap">{leg.parentCode}</td>
                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{leg.parentDate}</td>
                                <td className="py-3 px-3 text-center font-bold text-slate-400 whitespace-nowrap">
                                  <Tag color="blue" className="font-bold text-[10px] uppercase">Visit {leg.leg}</Tag>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="font-bold text-slate-800">{leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}</span>
                                  <span className="text-[9px] text-slate-400 block">{leg.from || "Start"} → {leg.to || "End"}</span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{leg.mode || "Other"}</span>
                                  {hasSub && <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 ml-1">+{leg.sub_mode}</span>}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-650 whitespace-nowrap">{leg.km || 0} KM</td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">₹{(parseFloat(leg.amount) || 0).toLocaleString()}</td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">₹{(parseFloat(leg.da) || 0).toLocaleString()}</td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">₹{(parseFloat(leg.hotel) || 0).toLocaleString()}</td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                  ₹{(parseFloat(leg.local_purchase) || 0).toLocaleString()}
                                  {leg.local_purchase_remark && (
                                    <span className="text-[9.5px] text-amber-700 font-sans block font-normal truncate max-w-[120px]" title={leg.local_purchase_remark}>"{leg.local_purchase_remark}"</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">₹{(parseFloat(leg.other_amount) || 0).toLocaleString()}</td>
                                <td className="py-3 px-3 text-slate-600 max-w-[150px] truncate whitespace-nowrap" title={leg.visit_purpose}>{leg.visit_purpose || "Field visit"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden space-y-3 text-xs">
                      {slicedItems.map((leg: any, idx: number) => {
                        const hasSub = leg.sub_mode && (parseFloat(leg.sub_amount) || 0) > 0;
                        return (
                          <div
                            key={idx}
                            className={`sharp-card bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 transition-all cursor-pointer text-xs ${getCardStatusClass(leg.parentStatus)}`}
                          >
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="font-extrabold font-mono text-indigo-600 text-xs uppercase">{leg.parentCode}</span>
                              <Tag color="blue" className="font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">Visit {leg.leg}</Tag>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Travel Date</span>
                                <span className="text-slate-700 font-semibold">{leg.parentDate}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Route</span>
                                <span className="text-slate-800 font-bold block leading-tight">{leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">{leg.from || "Start"} → {leg.to || "End"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Mode / Distance</span>
                                <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 inline-block mr-1">{leg.mode || "Other"}</span>
                                {hasSub && <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 inline-block mr-1">+{leg.sub_mode}</span>}
                                <span className="text-slate-700 font-semibold">{leg.km || 0} KM</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Fare / DA / Hotel</span>
                                <span className="text-slate-700 font-semibold">
                                  ₹{(parseFloat(leg.amount) || 0).toLocaleString()} / ₹{(parseFloat(leg.da) || 0).toLocaleString()} / ₹{(parseFloat(leg.hotel) || 0).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Local Purchase / Other</span>
                                <span className="text-slate-700 font-semibold">
                                  ₹{(parseFloat(leg.local_purchase) || 0).toLocaleString()} / ₹{(parseFloat(leg.other_amount) || 0).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Purpose</span>
                                <span className="text-slate-600 font-semibold leading-snug block">{leg.visit_purpose || "Field visit"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              }
            })()
          )}
        </div>

        {/* Ant Design Pagination controls */}
        {!claimsLoading && (
          (() => {
            const filteredClaims = getFilteredClaims();
            const filteredLegs = getFilteredLegs();
            const itemsList = activeClaimsTab === "sheets" ? filteredClaims : filteredLegs;
            const totalItems = itemsList.length;

            if (totalItems === 0) return null;

            return (
              <div className="px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 mb-2 md:mb-0">
                <span>Showing {((myClaimsPage - 1) * myClaimsPageSize) + 1} to {Math.min(myClaimsPage * myClaimsPageSize, totalItems)} of {totalItems} entries</span>
                <Pagination
                  current={myClaimsPage}
                  total={totalItems}
                  pageSize={myClaimsPageSize}
                  onChange={(p, size) => {
                    setMyClaimsPage(p);
                    if (size && size !== myClaimsPageSize) {
                      setMyClaimsPageSize(size);
                    }
                  }}
                  onShowSizeChange={(_, size) => {
                    setMyClaimsPageSize(size);
                    setMyClaimsPage(1);
                  }}
                  showSizeChanger={true}
                  pageSizeOptions={["10", "25", "50", "100"]}
                  size="small"
                />
              </div>
            );
          })()
        )}
      </Card>
      </div>

      {/* ================= STEP 3 CONFIRMATION SUBMIT DIALOG ================= */}
      {showConfirmModal && (
        <div className="modal-lte-overlay z-[99999]">
          <div className="modal-lte-content max-w-md p-0 overflow-hidden rounded-none border border-slate-300 shadow-2xl bg-white">
            {/* Solid Theme Header */}
            <div className="px-4 py-3 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
              <h3 className="text-xs font-black uppercase tracking-wider text-white m-0 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>CONFIRM REIMBURSEMENT SUBMISSION</span>
              </h3>
            </div>

            <div className="p-4 space-y-4 text-xs font-semibold">
              {/* Breakdown Details Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-none space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">TRAVEL DATE</span>
                  <span className="font-extrabold text-slate-900 font-mono">{formatToDDMMYYYY(date)}</span>
                </div>
                {totalKm > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">TOTAL DISTANCE</span>
                    <span className="font-extrabold text-slate-900 font-mono">{totalKm.toFixed(1)} KM</span>
                  </div>
                )}
                {totalAuto > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">AUTO / RICKSHAW FARE</span>
                    <span className="font-extrabold text-slate-900 font-mono">₹{totalAuto.toLocaleString()}</span>
                  </div>
                )}
                {totalDA > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">DAILY ALLOWANCE (DA)</span>
                    <span className="font-extrabold text-emerald-700 font-mono">₹{totalDA.toLocaleString()}</span>
                  </div>
                )}
                {totalHotel > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">HOTEL STAY</span>
                    <span className="font-extrabold text-indigo-700 font-mono">₹{totalHotel.toLocaleString()}</span>
                  </div>
                )}
                {totalOther > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">OTHER EXPENSES</span>
                    <span className="font-extrabold text-amber-700 font-mono">₹{totalOther.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">TOTAL CLAIM AMOUNT</span>
                  <span className="text-[#4A6A8A] font-black font-mono text-base">₹{totalAmt.toLocaleString()}</span>
                </div>
              </div>

              {/* ── Base Location Deduction Breakdown (PRE-SUBMISSION PREVIEW) ── */}
              {baseLocDeductions && baseLocDeductions.hasDeductions && (() => {
                const totalTA = baseLocDeductions.items.reduce((s, i) => s + i.taDeducted, 0);
                const totalDA = baseLocDeductions.items.reduce((s, i) => s + i.daDeducted, 0);
                const totalDeducted = totalTA + totalDA;
                return (
                  <div className="rounded-none border border-amber-300 overflow-hidden shadow-2xs">
                    {/* Card Header */}
                    <div className="bg-amber-600 px-3.5 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                        <span className="text-white text-[11px] font-black uppercase tracking-wider">
                          Policy Deductions Summary
                        </span>
                      </div>
                      <span className="bg-white/20 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-none">
                        -₹{totalDeducted.toFixed(0)}
                      </span>
                    </div>

                    {/* Leg Breakdown Rows */}
                    <div className="divide-y divide-amber-100 bg-amber-50">
                      {baseLocDeductions.items.map(item => (
                        <div key={item.leg} className="px-3.5 py-2">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-0.5">
                            Visit {item.leg}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-800 truncate mb-1">
                            {item.from} <span className="text-slate-400 mx-1">→</span> {item.to}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {item.taDeducted > 0 && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-none border border-rose-200 font-mono">
                                Commute TA: -₹{item.taDeducted.toFixed(0)}
                              </span>
                            )}
                            {item.daDeducted > 0 && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-none border border-rose-200 font-mono">
                                Base Location DA: -₹{item.daDeducted.toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total Deduction Footer */}
                    <div className="bg-amber-100/80 px-3.5 py-2 flex items-center justify-between border-t border-amber-200">
                      <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        Total Amount Deducted:
                      </span>
                      <span className="text-xs font-black text-rose-700 font-mono">
                        -₹{totalDeducted.toFixed(0)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-none flex items-start gap-2 text-[11px] leading-relaxed font-medium shadow-2xs">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  {totalAmt <= 0
                    ? "This claim has ₹0 amount (all TA/DA waived by policy). It will be auto-approved without requiring manager review."
                    : "By clicking Confirm, you verify that this travel log and all attached invoice screenshots are genuine. The claim will be forwarded to your mapped manager."
                  }
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold uppercase tracking-wider py-2 px-5 rounded-none border border-slate-300 shadow-2xs cursor-pointer text-xs transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={doSubmit}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider py-2 px-6 rounded-none shadow-2xs border border-emerald-600 flex items-center justify-center gap-2 cursor-pointer text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>SUBMITTING...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>CONFIRM SUBMIT</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUBMISSION STATUS MODAL (SUCCESS/ERROR) ================= */}
      {submitStatus && (
        <div className="modal-lte-overlay z-[99999]">
          <div className="modal-lte-content max-w-sm p-0 overflow-hidden rounded-none shadow-2xl border border-slate-300 bg-white">

            {/* Solid Header Strip */}
            <div className={`px-6 pt-5 pb-4 text-center ${
              submitStatus.type === "success"
                ? submitStatus.title === "Auto Approved!"
                  ? "bg-indigo-600"
                  : "bg-emerald-600"
                : "bg-rose-600"
            }`}>
              <div className="mx-auto w-12 h-12 rounded-none bg-white/20 flex items-center justify-center mb-2.5 border border-white/30 shadow-2xs">
                {submitStatus.type === "success"
                  ? <ShieldCheck className="h-6 w-6 text-white" />
                  : <AlertTriangle className="h-6 w-6 text-white" />
                }
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {submitStatus.type === "success" ? submitStatus.title : "SUBMISSION FAILED"}
              </h3>
              {submitStatus.type === "success" && submitStatus.claimCode && (
                <p className="mt-1.5 inline-block bg-white/25 text-white font-mono text-[11px] font-bold px-3 py-1 rounded-none tracking-widest uppercase border border-white/30 shadow-2xs">
                  #{submitStatus.claimCode}
                </p>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4 bg-white space-y-4 text-xs font-semibold">

              {/* Main Message */}
              <p className="text-xs text-slate-700 font-semibold leading-relaxed text-center bg-slate-50 p-3 rounded-none border border-slate-200 shadow-2xs">
                {submitStatus.message}
              </p>

              {/* Deduction Breakdown Card */}
              {submitStatus.type === "success" && submitStatus.deductions && submitStatus.deductions.items.length > 0 && (() => {
                const totalTA = submitStatus.deductions.items.reduce((s, i) => s + i.taDeducted, 0);
                const totalDA = submitStatus.deductions.items.reduce((s, i) => s + i.daDeducted, 0);
                return (
                  <div className="rounded-none border border-amber-300 overflow-hidden shadow-2xs">
                    {/* Card Header */}
                    <div className="bg-amber-600 px-3 py-1.5 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span className="text-white text-[10px] font-black uppercase tracking-wider">
                        Policy Deduction Applied
                      </span>
                    </div>
                    {/* Leg Rows */}
                    <div className="divide-y divide-amber-100 bg-amber-50">
                      {submitStatus.deductions.items.map(item => (
                        <div key={item.leg} className="px-3 py-2">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-0.5">
                            Visit {item.leg}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-800 truncate mb-1">
                            {item.from} <span className="text-slate-400 mx-1">→</span> {item.to}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {item.taDeducted > 0 && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-none border border-rose-200 font-mono">
                                TA -₹{item.taDeducted.toFixed(0)}
                              </span>
                            )}
                            {item.daDeducted > 0 && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-none border border-rose-200 font-mono">
                                DA -₹{item.daDeducted.toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Totals Row */}
                    <div className="bg-amber-100 px-3 py-1.5 flex items-center justify-between border-t border-amber-200">
                      <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Total Deducted</span>
                      <span className="text-[11px] font-black text-rose-700 font-mono">
                        -₹{(totalTA + totalDA).toFixed(0)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* CTA Button */}
              <button
                type="button"
                onClick={() => {
                  setSubmitStatus(null);
                }}
                className={`w-full py-2.5 px-4 rounded-none text-xs font-black uppercase tracking-wider transition-all border cursor-pointer shadow-2xs flex items-center justify-center gap-2 ${
                  submitStatus.type === "success"
                    ? submitStatus.title === "Auto Approved!"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                    : "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
                }`}
              >
                {submitStatus.type === "success" ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>DONE, GO TO DASHBOARD</span>
                  </>
                ) : (
                  <span>CLOSE</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= LIMIT APPROVAL DIALOG ================= */}
      {showApprovalModal && (() => {
        // Check if user already submitted a limit extension for this type this month
        const hasExistingRequest = exceededType === "KM" ? !!existingKmReq : !!existingAutoReq;
        const existingReq = exceededType === "KM" ? existingKmReq : existingAutoReq;
        return (
          <div className="modal-lte-overlay z-[99999]">
            <div className="modal-lte-content max-w-md">
              <h3 className="text-sm font-extrabold uppercase tracking-wider border-b border-gray-200 pb-3 text-red-600 text-left flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Monthly Reimbursement Limit Exceeded
              </h3>

              <div className="space-y-4 mt-4 text-left text-xs font-semibold">
                <p className="leading-relaxed font-medium text-gray-600">
                  The current claim exceeds your monthly {exceededType} allowance. You must request a temporary extension from your Level 1 Manager to submit this claim.
                </p>

                <div className="p-3 bg-red-50 border border-red-150 text-red-800 rounded font-bold">
                  Exceeded Overflow: {excess.toFixed(1)} {exceededType === "KM" ? "KM" : "₹"}
                </div>

                {hasExistingRequest ? (
                  /* Already submitted a request this month — show status, block re-submit */
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded space-y-2">
                    <p className="font-bold text-amber-800 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      Limit Extension Already Requested This Month
                    </p>
                    <p className="text-amber-700 font-medium leading-relaxed">
                      You have already submitted a limit extension request for {exceededType} this month. You can only submit one request per month.
                    </p>
                    {existingReq && (
                      <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${
                        existingReq.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                        existingReq.status === "Rejected" ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        Status: {existingReq.status === "Approved" ? "✓ Approved" :
                                 existingReq.status === "Rejected" ? "❌ Rejected" :
                                 "⏳ Pending"} — Requested: +{existingReq.requested_value} {exceededType === "KM" ? "KM" : "₹"}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-500 font-medium italic">
                      Your extension request will reset next month.
                    </p>
                  </div>
                ) : (
                  /* Allow new request */
                  <div className="space-y-1.5">
                    <label className="label-lte">Requested Additional {exceededType}</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={reqAdditional}
                      onChange={(e) => setReqAdditional(e.target.value)}
                      className="input-lte font-bold"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(false)}
                    className="btn-lte-secondary"
                    disabled={sendingRequest}
                  >
                    {hasExistingRequest ? "Close" : "Cancel"}
                  </button>
                  {!hasExistingRequest && (
                    <button
                      type="button"
                      onClick={sendApprovalRequest}
                      disabled={sendingRequest}
                      className="btn-lte-primary px-5 py-2 flex items-center justify-center gap-1.5 border-0"
                    >
                      {sendingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Send Request</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= CUSTOM VALIDATION WARNING MODAL ================= */}
      {validationModal.show && (
        <div className="modal-lte-overlay z-[99999]">
          <div className="modal-lte-content max-w-md w-full bg-white sharp-card rounded-none shadow-2xl p-5 border border-red-100 transform transition-all duration-300 scale-100 flex flex-col gap-4">
            {/* Header Icon + Title */}
            <div className="flex items-center gap-3 pb-2 border-b border-red-50">
              <span className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center text-lg shrink-0">
                ⚠️
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  {validationModal.title}
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Attention Required</p>
              </div>
            </div>

            {/* Error Message Text */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold bg-slate-50/70 p-3 rounded-xl border border-slate-100/50 whitespace-pre-line">
              {validationModal.message}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setValidationModal({ show: false, title: "", message: "" })}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-200 border-0 cursor-pointer text-center"
              >
                Okay, I Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DETAILS MODAL (ClaimDetailsModal - DITTO COPY OF HOME PAGE) ================= */}
      <ClaimDetailsModal
        sourceMode="expense"
        open={showDetailsModal}
        claimDetails={selectedClaim}
        user={user}
        comments=""
        setComments={() => {}}
        actionLoading={false}
        handleApprove={() => {}}
        handleReject={() => {}}
        handleDeleteClaim={handleDeleteClaim}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedClaim(null);
        }}
        navigate={navigate}
        setLightboxImage={(url) => setLightboxImage(url)}
        getStatusBadgeClass={(status) => {
          if (status === "approved" || status === "auto_approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
          if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
          return "bg-amber-50 text-amber-700 border-amber-200";
        }}
        getStatusLabel={(status) => {
          if (status === "auto_approved") return "Auto Approved";
          if (status === "approved") return "Approved";
          if (status === "rejected") return "Rejected";
          return "Pending";
        }}
      />
      {false && (
        <Modal
          open={showDetailsModal}
        destroyOnClose={true}
        onCancel={() => {
          setShowDetailsModal(false);
          setSelectedClaim(null);
          document.body.style.overflow = '';
          document.body.style.pointerEvents = '';
          document.body.style.touchAction = '';
          document.documentElement.style.overflow = '';
          document.documentElement.style.pointerEvents = '';
          document.documentElement.style.touchAction = '';
        }}
        className="app-redesigned-modal"
        wrapClassName="my-claims-modal-wrap"
        footer={
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <Space className="gap-2">
              {selectedClaim && selectedClaim.category !== "Limit Request" && ["draft", "submitted", "returned_to_draft"].includes(selectedClaim.status?.toLowerCase()) && (
                <>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => handleEditFromModal(selectedClaim.id)}
                    className="bg-amber-500 hover:bg-amber-600 font-bold text-xs border-0"
                  >
                    Edit Claim
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      handleDeleteClaim(selectedClaim.id);
                      setShowDetailsModal(false);
                      setSelectedClaim(null);
                    }}
                    className="font-bold text-xs"
                  >
                    Cancel Claim
                  </Button>
                </>
              )}
            </Space>
            <Button
              onClick={() => { setShowDetailsModal(false); setSelectedClaim(null); document.body.style.overflow = ''; }}
              className="font-bold text-xs"
            >
              Close
            </Button>
          </div>
        }
        width={1000}
        centered
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileTextOutlined className="text-blue-600 text-lg" />
            <span className="font-extrabold uppercase tracking-wide text-xs text-slate-800 m-0 flex items-center gap-2">
              Claim Details {selectedClaim ? `— ${selectedClaim.expense_code}` : ""}
              {selectedClaim && <DistrictBadge districtType={selectedClaim.districtType} />}
            </span>
          </div>
        }
      >
        <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-1">
              {detailsLoading || !selectedClaim ? (
                <Loader message="Loading claim details..." />
              ) : (
                <>
                  {/* Summary Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 bg-slate-50/80 rounded-xl space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase block tracking-wider">Submitted By</span>
                      <span className="font-extrabold text-slate-900 block text-xs">{selectedClaim.submitter_name || user.name || "Sunil Vishnoi"}</span>
                      <span className="text-xs text-slate-500 font-mono block font-semibold">{selectedClaim.submitter_code || user.user_id || "E1704"}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50/80 rounded-xl space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase block tracking-wider">Travel Date</span>
                      <span className="font-extrabold text-slate-900 block text-xs">{selectedClaim.date || selectedClaim.itinerary}</span>
                      <span className="text-xs text-slate-500 block font-semibold">{selectedClaim.month} {selectedClaim.year}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50/80 rounded-xl space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase block tracking-wider">Submitted At</span>
                      <span className="font-extrabold text-slate-900 block text-xs">{formatDateTime(selectedClaim.created_at)}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50/80 rounded-xl space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase block tracking-wider">Status</span>
                      <div className="mt-1">
                        {renderAntdStatusTag(selectedClaim.status)}
                      </div>
                    </div>
                  </div>

                  {selectedClaim.original_amount > selectedClaim.amount && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 text-xs text-amber-850 shadow-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold uppercase tracking-wider text-[10px] text-amber-700">Policy Deductions Applied</p>
                        <p className="mt-1 leading-relaxed">
                          A total deduction of <span className="font-bold text-rose-600">₹{(selectedClaim.original_amount - selectedClaim.amount).toFixed(0)}</span> was applied to this claim in accordance with the base location policy.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Purpose & Total */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div>
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Purpose:</span>
                      <span className="font-semibold text-gray-800 ml-1">{selectedClaim.purpose || selectedClaim.description || "Field visits"}</span>
                    </div>
                    <div className="text-right">
                      {selectedClaim.category === "Limit Request" ? (
                        <div className="space-y-1">
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase block">Requested Limit</span>
                            <span className="text-xs font-bold text-gray-600 font-mono">
                              {selectedClaim.travel_mode === "KM" ? `${selectedClaim.requested_value || selectedClaim.total_km} KM` : `₹${(selectedClaim.requested_value || selectedClaim.amount).toLocaleString()}`}
                            </span>
                          </div>
                          {selectedClaim.status.toLowerCase() === "approved" && (
                            <div>
                              <span className="text-[9px] text-emerald-600 font-extrabold uppercase block">Approved Limit</span>
                              <span className="text-sm font-black text-emerald-700 font-mono">
                                {selectedClaim.travel_mode === "KM" ? `${selectedClaim.approved_value ?? (selectedClaim.requested_value || selectedClaim.total_km)} KM` : `₹${(selectedClaim.approved_value ?? (selectedClaim.requested_value || selectedClaim.amount)).toLocaleString()}`}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="text-[9px] text-gray-500 font-bold uppercase block">Total</span>
                          <span className="text-lg font-black text-blue-700 font-mono">
                            ₹{selectedClaim.amount.toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Deduction Amount Badge & Approver Remark Section */}
                  {(() => {
                    let rawDeduction = selectedClaim.deduction_amount;
                    if (rawDeduction === undefined || rawDeduction === null) {
                      if (selectedClaim.original_amount && selectedClaim.amount && parseFloat(selectedClaim.original_amount) > parseFloat(selectedClaim.amount)) {
                        rawDeduction = parseFloat(selectedClaim.original_amount) - parseFloat(selectedClaim.amount);
                      } else {
                        rawDeduction = 0;
                      }
                    }
                    const deductionAmt = typeof rawDeduction === "number" ? rawDeduction : parseFloat(rawDeduction || 0);
                    const hasDeduction = deductionAmt > 0;

                    let remarkText = (selectedClaim.approver_remark || selectedClaim.remark || selectedClaim.deduction_remark || "").trim();
                    if (!remarkText && selectedClaim.approvals && Array.isArray(selectedClaim.approvals)) {
                      const appWithComment = selectedClaim.approvals.find((a: any) => (a.comments || a.remark || "").trim());
                      if (appWithComment) {
                        remarkText = (appWithComment.comments || appWithComment.remark || "").trim();
                      }
                    }

                    if (!hasDeduction && !remarkText) return null;

                    return (
                      <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-lg space-y-2 text-xs text-amber-950 shadow-2xs">
                        {hasDeduction && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded font-black text-xs bg-rose-600 text-white shadow-2xs uppercase tracking-wider">
                              Deduction: ₹{deductionAmt.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {remarkText && (
                          <div className="space-y-1 pt-0.5">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-900 block opacity-85">
                              Remark:
                            </span>
                            <p className="font-semibold text-xs text-slate-800 leading-relaxed bg-white p-2.5 rounded border border-amber-200 shadow-2xs">
                              "{remarkText}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Legs Table */}
                  {selectedClaim.category !== "Limit Request" && selectedClaim.itineraries && selectedClaim.itineraries.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Visit Legs Details</h4>
                      </div>
                      
                      {/* Desktop View Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50">
                              <th className="py-2 px-3 text-center w-10">#</th>
                              <th className="py-2 px-3">Route</th>
                              <th className="py-2 px-3">Mode</th>
                              <th className="py-2 px-3 text-right">KM</th>
                              <th className="py-2 px-3 text-right">TA / Fare</th>
                              <th className="py-2 px-3 text-right">DA</th>
                              <th className="py-2 px-3 text-right">Hotel</th>
                              <th className="py-2 px-3 text-right">Local Purchase</th>
                              <th className="py-2 px-3">Other / Misc</th>
                              <th className="py-2 px-3">Metrics</th>
                              <th className="py-2 px-3 text-right font-bold">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedClaim.itineraries.map((leg: any, idx: number) => {
                              const travelCost = leg.amount || 0;
                              const subCost = leg.sub_amount || 0;
                              const daCost = leg.da || 0;
                              const hotelCost = leg.hotel || 0;
                              const lpCost = leg.local_purchase || 0;
                              const otherCost = leg.oth_amount || 0;
                              
                              const origTA = parseFloat(leg.original_amount ?? leg.amount ?? 0);
                              const origSub = parseFloat(leg.original_sub_amount ?? leg.sub_amount ?? 0);
                              const origDA = parseFloat(leg.original_da ?? leg.da ?? 0);

                              const taDeducted = (origTA - travelCost) + (origSub - subCost);
                              const daDeducted = origDA - daCost;

                              const legTotal = travelCost + subCost + daCost + hotelCost + lpCost + otherCost;
                              const origTotal = origTA + origSub + origDA + hotelCost + lpCost + otherCost;

                              let actDetails: any = null;
                              try {
                                if (leg.activity_details) {
                                  actDetails = typeof leg.activity_details === "string" ? JSON.parse(leg.activity_details) : leg.activity_details;
                                }
                              } catch (e) {
                                console.error("Error parsing activity details", e);
                              }

                              const callsList = actDetails?.calls_list || [];
                              const pmsList = actDetails?.pms_list || [];
                              const assetsList = actDetails?.assets_list || [];
                              const selectedActs = actDetails?.selected_activities || leg.selected_activities || [];
                              const mobiliseCount = parseInt(actDetails?.mobilise_asset_count || leg.mobilise_asset_count || "0") || 0;
                              const calibrationCount = parseInt(actDetails?.calibration_count || leg.calibration_count || "0") || 0;
                              const activityOtherDesc = actDetails?.activity_other_desc || leg.activity_other_desc || "";

                              const hasActivities = selectedActs.length > 0 || callsList.length > 0 || pmsList.length > 0 || assetsList.length > 0;

                              return (
                                <React.Fragment key={idx}>
                                  <tr className="hover:bg-gray-50 transition-colors">
                                    <td className="py-2.5 px-3 text-center font-bold text-gray-400">{leg.leg}</td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-bold text-gray-800">{leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}</span>
                                      <span className="text-[10px] text-gray-400 block">{leg.from || "Start"} → {leg.to || "End"}</span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{leg.mode}</span>
                                      {leg.sub_mode && <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 ml-1">+{leg.sub_mode}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-650">{leg.km || 0} KM</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-650">
                                      <div className="flex flex-col items-end">
                                        <span>₹{(travelCost + subCost).toLocaleString()}</span>
                                        {taDeducted > 0 && (
                                          <span className="text-[8px] font-bold text-rose-500 line-through" title="Claimed before policy deduction">
                                            ₹{(origTA + origSub).toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                      <div className="flex flex-col items-end">
                                        <span className="text-gray-650">₹{daCost.toLocaleString()}</span>
                                        {daDeducted > 0 && (
                                          <span className="text-[8px] font-bold text-rose-500 line-through" title="Claimed before policy deduction">
                                            ₹{origDA.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{hotelCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{lpCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-mono font-bold">₹{otherCost.toLocaleString()}</span>
                                      {leg.oth_desc && <span className="text-[9px] text-gray-400 block truncate max-w-[100px]" title={leg.oth_desc}>{leg.oth_desc}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] text-gray-500">
                                      <span>Call Attended: {leg.ws_assigned||0}</span> <span className="text-green-600 font-bold">Call Closed: {leg.ws_closed||0}</span> <span>P:{leg.ws_pms||0}</span> <span>A:{leg.ws_asset||0}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold font-mono text-gray-900">
                                      <div className="flex flex-col items-end">
                                        <span>₹{legTotal.toLocaleString()}</span>
                                        {origTotal > legTotal && (
                                          <span className="text-[8px] font-bold text-rose-500 line-through" title="Claimed before policy deduction">
                                            ₹{origTotal.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  
                                  {hasActivities && (
                                    <tr className="bg-slate-50/50">
                                      <td colSpan={11} className="py-2.5 px-4 border-t border-gray-150">
                                        <div className="flex flex-col gap-2.5">
                                          <div className="flex flex-wrap gap-2">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase mr-2 mt-0.5">Activities:</span>
                                            {selectedActs.map((act: string, actIdx: number) => (
                                              <span key={actIdx} className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[8px] font-bold text-gray-700 uppercase">
                                                {act}
                                              </span>
                                            ))}
                                          </div>

                                          {/* Sub-table for Calls */}
                                          {selectedActs.includes("Calls") && callsList.length > 0 && (
                                            <div className="space-y-1.5 max-w-full">
                                              <div className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Support Calls Logs</div>
                                              <div className="flex flex-wrap gap-2">
                                                {callsList.map((c: any, cIdx: number) => (
                                                  <div key={cIdx} className="bg-white border border-gray-300 p-2.5 shadow-xs text-[10px] w-full sm:w-[220px] flex flex-col justify-between hover:border-indigo-400 transition-colors">
                                                    <div className="flex justify-between items-center border-b border-gray-100 pb-1 mb-1">
                                                      <span className="font-mono font-bold text-indigo-650">{c.barcode}</span>
                                                      <span className="px-1.5 py-0.2 rounded-sm font-black text-[7px] uppercase bg-blue-50 text-blue-700 border border-blue-100">{c.status || "Attend"}</span>
                                                    </div>
                                                    <div className="space-y-0.5 flex-1">
                                                      <p className="font-bold text-gray-800 line-clamp-1">{c.asset_details?.equipment_name || "—"}</p>
                                                      <p className="text-gray-555 truncate">{c.asset_details?.hospital_name || "—"}</p>
                                                      <p className="text-gray-400 text-[8px] uppercase tracking-wider">{c.asset_details?.district_name || "—"} | {c.type || "Support"}</p>
                                                    </div>
                                                    {c.photo_url && (
                                                      <button 
                                                        onClick={() => setLightboxImage(formatImageUrl(c.photo_url))}
                                                        className="mt-1.5 w-full bg-slate-50 hover:bg-slate-100 py-1 text-center font-bold text-slate-700 rounded border border-gray-300 cursor-pointer text-[8px] uppercase"
                                                      >
                                                        View Photo
                                                      </button>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Sub-table for PMS */}
                                          {selectedActs.includes("PMS") && pmsList.length > 0 && (
                                            <div className="space-y-1.5 max-w-full">
                                              <div className="text-[9px] font-black text-amber-700 uppercase tracking-wider">PMS Service Logs</div>
                                              <div className="flex flex-wrap gap-2">
                                                {pmsList.map((p: any, pIdx: number) => (
                                                  <div key={pIdx} className="bg-white border border-gray-300 p-2.5 shadow-xs text-[10px] w-full sm:w-[220px] flex flex-col justify-between hover:border-amber-400 transition-colors">
                                                    <div className="flex justify-between items-center border-b border-gray-100 pb-1 mb-1">
                                                      <span className="font-mono font-bold text-amber-600">{p.barcode}</span>
                                                      <span className="px-1.5 py-0.2 rounded-sm font-black text-[7px] uppercase bg-green-50 text-green-700 border border-green-205">{p.asset_details?.inventory_status || "Active"}</span>
                                                    </div>
                                                    <div className="space-y-0.5 flex-1">
                                                      <p className="font-bold text-gray-800 line-clamp-1">{p.asset_details?.equipment_name || "—"}</p>
                                                      <p className="text-gray-500 truncate">{p.asset_details?.hospital_name || "—"}</p>
                                                      <p className="text-gray-400 text-[8px] uppercase tracking-wider">{p.asset_details?.district_name || "—"} | Freq: {p.frequency || "3M"}</p>
                                                    </div>
                                                    {p.photo_url && (
                                                      <button 
                                                        onClick={() => setLightboxImage(formatImageUrl(p.photo_url))}
                                                        className="mt-1.5 w-full bg-slate-50 hover:bg-slate-100 py-1 text-center font-bold text-slate-700 rounded border border-gray-300 cursor-pointer text-[8px] uppercase"
                                                      >
                                                        View Photo
                                                      </button>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Sub-table for Asset Tagging */}
                                          {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                            <div className="space-y-1.5 max-w-full">
                                              <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Asset Tagging Records</div>
                                              <div className="flex flex-wrap gap-2">
                                                {assetsList.map((a: any, aIdx: number) => {
                                                  const selectedEq = assetValueMaster.find(eq => eq.equipment_name === a.equipment_name);
                                                  const costPerUnit = selectedEq ? (selectedEq.asset_value || selectedEq.rmsc_tender_cost || 0) : 0;
                                                  const qty = parseInt(a.quantity || "0") || 0;
                                                  const totalCost = qty * costPerUnit;
                                                  
                                                  const isEngineer = (user.designation || "").toLowerCase().trim() === "engineer" || 
                                                                     (user.role || "").toLowerCase().trim() === "engineer";
                                                  const isSubmitter = (selectedClaim.user_id === user.id) || (selectedClaim.submitter_code === user.user_id);
                                                  const hideCost = isEngineer || isSubmitter;
                                                  
                                                  return (
                                                    <div key={aIdx} className="bg-white border border-gray-300 p-2.5 shadow-xs text-[10px] w-full sm:w-[220px] flex flex-col justify-between hover:border-emerald-400 transition-colors">
                                                      <div className="space-y-0.5">
                                                        <p className="font-bold text-gray-800 line-clamp-1">{a.equipment_name}</p>
                                                        <span className="text-[7px] text-gray-400 uppercase tracking-wider">Asset Tagged</span>
                                                      </div>
                                                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                                                        <div>
                                                          <span className="text-[8px] text-gray-400 block">QTY</span>
                                                          <span className="font-extrabold text-gray-700">{qty} units</span>
                                                        </div>
                                                        {!hideCost && (
                                                          <div className="text-right">
                                                            <span className="text-[8px] text-gray-400 block">COST (₹{costPerUnit})</span>
                                                            <span className="font-bold text-emerald-700">₹{totalCost.toLocaleString()}</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}

                                          {/* Quantities for Mobilise, Calibration or Other */}
                                          <div className="flex flex-wrap gap-4 text-[10px] text-gray-600 bg-white p-2 rounded border border-gray-100 max-w-3xl">
                                            {selectedActs.includes("Mobilise Asset Update") && (
                                              <div>
                                                <span className="font-bold text-gray-400 uppercase text-[8px] block">Mobilise Qty</span>
                                                <span className="font-bold text-indigo-700">{mobiliseCount} units</span>
                                              </div>
                                            )}
                                            {selectedActs.includes("Calibration") && (
                                              <div>
                                                <span className="font-bold text-gray-400 uppercase text-[8px] block">Calibration Qty</span>
                                                <span className="font-bold text-purple-700">{calibrationCount} units</span>
                                              </div>
                                            )}
                                            {selectedActs.includes("Other") && activityOtherDesc && (
                                              <div className="w-full mt-2 bg-amber-50 border-2 border-amber-300 rounded-lg p-2.5 shadow-xs">
                                                <span className="font-black text-amber-900 uppercase text-[9px] block mb-1 tracking-wider flex items-center gap-1">
                                                  <span>✏️</span> OTHER ACTIVITY REMARK / PURPOSE:
                                                </span>
                                                <span className="font-black text-amber-950 text-xs leading-relaxed block bg-white/90 p-2 rounded border border-amber-200">
                                                  {activityOtherDesc}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View Card List */}
                      <div className="block lg:hidden space-y-3 p-3 bg-gray-50/30">
                        {selectedClaim.itineraries.map((leg: any, idx: number) => {
                          const travelCost = leg.amount || 0;
                          const subCost = leg.sub_amount || 0;
                          const daCost = leg.da || 0;
                          const hotelCost = leg.hotel || 0;
                          const lpCost = leg.local_purchase || 0;
                          const otherCost = leg.oth_amount || 0;

                          const origTA = parseFloat(leg.original_amount ?? leg.amount ?? 0);
                          const origSub = parseFloat(leg.original_sub_amount ?? leg.sub_amount ?? 0);
                          const origDA = parseFloat(leg.original_da ?? leg.da ?? 0);

                          const taDeducted = (origTA - travelCost) + (origSub - subCost);
                          const daDeducted = origDA - daCost;

                          const legTotal = travelCost + subCost + daCost + hotelCost + lpCost + otherCost;
                          const origTotal = origTA + origSub + origDA + hotelCost + lpCost + otherCost;

                          let actDetails: any = null;
                          try {
                            if (leg.activity_details) {
                              actDetails = typeof leg.activity_details === "string" ? JSON.parse(leg.activity_details) : leg.activity_details;
                            }
                          } catch (e) {
                            console.error("Error parsing activity details", e);
                          }

                          const callsList = actDetails?.calls_list || [];
                          const pmsList = actDetails?.pms_list || [];
                          const assetsList = actDetails?.assets_list || [];
                          const selectedActs = actDetails?.selected_activities || leg.selected_activities || [];
                          const mobiliseCount = parseInt(actDetails?.mobilise_asset_count || leg.mobilise_asset_count || "0") || 0;
                          const calibrationCount = parseInt(actDetails?.calibration_count || leg.calibration_count || "0") || 0;
                          const activityOtherDesc = actDetails?.activity_other_desc || leg.activity_other_desc || "";

                          const hasActivities = selectedActs.length > 0 || callsList.length > 0 || pmsList.length > 0 || assetsList.length > 0;

                          return (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 shadow-xs text-xs">
                              {/* Card Header */}
                              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                <span className="font-extrabold text-blue-600 font-mono text-xs">Facility Visit {leg.leg}</span>
                                <div className="flex flex-col items-end">
                                  <span className="font-extrabold text-gray-900 text-sm">₹{legTotal.toLocaleString()}</span>
                                  {origTotal > legTotal && (
                                    <span className="text-[8px] font-bold text-rose-500 line-through">₹{origTotal.toLocaleString()}</span>
                                  )}
                                </div>
                              </div>

                              {/* Route & Mode */}
                              <div className="space-y-1.5 text-left">
                                <div>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Route</span>
                                  <span className="font-bold text-gray-800 text-[11px]">
                                    {leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}
                                  </span>
                                  <span className="text-[10px] text-gray-500 block">
                                    {leg.from || "Start"} → {leg.to || "End"}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                    {leg.mode}
                                  </span>
                                  {leg.sub_mode && (
                                    <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                                      +{leg.sub_mode}
                                    </span>
                                  )}
                                  {leg.km > 0 && (
                                    <span className="text-[9px] font-bold uppercase bg-gray-50 text-gray-650 px-1.5 py-0.5 rounded border border-gray-200 font-mono">
                                      {leg.km} KM
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Breakdown of costs */}
                              <div className="grid grid-cols-2 gap-2.5 bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 text-[10px] font-bold text-left">
                                <div>
                                  <span className="text-gray-400 text-[8px] uppercase block">TA / Fare</span>
                                  <span className="text-gray-700 font-mono">₹{(travelCost + subCost).toLocaleString()}</span>
                                  {taDeducted > 0 && (
                                    <span className="text-[8px] font-bold text-rose-500 line-through block">₹{(origTA + origSub).toLocaleString()}</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-[8px] uppercase block">DA</span>
                                  <span className="text-gray-700 font-mono">₹{daCost.toLocaleString()}</span>
                                  {daDeducted > 0 && (
                                    <span className="text-[8px] font-bold text-rose-500 line-through block">₹{origDA.toLocaleString()}</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-gray-400 text-[8px] uppercase block">Hotel</span>
                                  <span className="text-gray-700 font-mono">₹{hotelCost.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 text-[8px] uppercase block">Local Purc.</span>
                                  <span className="text-gray-700 font-mono">₹{lpCost.toLocaleString()}</span>
                                </div>
                                {otherCost > 0 && (
                                  <div className="col-span-2 border-t border-gray-100 pt-1.5 mt-0.5">
                                    <span className="text-gray-400 text-[8px] uppercase block">Other/Misc (₹{otherCost.toLocaleString()})</span>
                                    <span className="text-gray-655 block text-[9px] font-normal italic">{leg.oth_desc || "No description"}</span>
                                  </div>
                                )}
                              </div>

                              {/* Work Summary */}
                              <div className="text-[10px] text-gray-500 bg-gray-50/50 px-2.5 py-1.5 rounded border border-gray-100 flex justify-between font-bold">
                                <span>Call Attended: {leg.ws_assigned||0}</span>
                                <span className="text-green-600">Call Closed: {leg.ws_closed||0}</span>
                                <span>PMS: {leg.ws_pms||0}</span>
                                <span>Asset: {leg.ws_asset||0}</span>
                              </div>

                              {/* Activities & Sub logs */}
                              {hasActivities && (
                                <div className="border-t border-gray-100 pt-2.5 space-y-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {selectedActs.map((act: string, actIdx: number) => (
                                      <span key={actIdx} className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[8px] font-bold text-gray-700 uppercase">
                                        {act}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Calls card list */}
                                  {selectedActs.includes("Calls") && callsList.length > 0 && (
                                    <div className="space-y-2.5 w-full">
                                      <div className="text-xs font-black text-blue-800 uppercase tracking-wider text-left">Support Calls Logs</div>
                                      {callsList.map((c: any, cIdx: number) => (
                                        <div key={cIdx} className="bg-blue-50/50 rounded-xl p-3.5 space-y-2.5 text-xs text-left w-full">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <span className="font-black text-slate-900 text-sm block">{c.asset_details?.equipment_name || "—"}</span>
                                              <span className="text-xs text-slate-600 font-medium">{c.asset_details?.hospital_name || "—"}</span>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full font-black text-xs uppercase bg-blue-600 text-white shadow-2xs">
                                              {c.status || "Attend"}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-blue-100/70 font-semibold text-slate-700">
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">District</span>
                                              <span className="font-bold text-slate-900">{c.asset_details?.district_name || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Model</span>
                                              <span className="font-bold text-slate-900">{c.asset_details?.model_name || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Barcode</span>
                                              <span className="font-mono font-bold text-blue-700">{c.barcode || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Call Type</span>
                                              <span className={`font-black uppercase ${
                                                (c.type || c.call_type || "").toLowerCase().includes("online") ? "text-purple-700" : "text-blue-700"
                                              }`}>
                                                {c.type || c.call_type || (c.is_online ? "Online Call" : "Support Call")}
                                              </span>
                                            </div>
                                          </div>
                                          {c.photo_url && (
                                            <div className="pt-2">
                                              <span className="text-slate-500 text-xs uppercase font-bold block mb-1.5">Attachment Photo</span>
                                              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700 min-h-[220px] max-h-[360px] flex items-center justify-center p-2">
                                                <img
                                                  src={formatImageUrl(c.photo_url)}
                                                  alt="Call verification"
                                                  className="w-full h-full object-contain cursor-pointer"
                                                  onClick={() => setLightboxImage(formatImageUrl(c.photo_url))}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setLightboxImage(formatImageUrl(c.photo_url))}
                                                  className="absolute bottom-2 right-2 bg-slate-900/80 text-white font-extrabold text-xs px-3 py-1 rounded-lg cursor-pointer border border-white/20 backdrop-blur-md"
                                                >
                                                  Full View
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* PMS card list */}
                                  {selectedActs.includes("PMS") && pmsList.length > 0 && (
                                    <div className="space-y-2.5 w-full">
                                      <div className="text-xs font-black text-amber-800 uppercase tracking-wider text-left">PMS Service Logs</div>
                                      {pmsList.map((p: any, pIdx: number) => (
                                        <div key={pIdx} className="bg-amber-50/50 rounded-xl p-3.5 space-y-2.5 text-xs text-left w-full">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <span className="font-black text-slate-900 text-sm block">{p.asset_details?.equipment_name || "—"}</span>
                                              <span className="text-xs text-slate-600 font-medium">{p.asset_details?.hospital_name || "—"}</span>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full font-black text-xs uppercase bg-emerald-600 text-white shadow-2xs">
                                              {p.frequency || "3 month"}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-amber-100/70 font-semibold text-slate-700">
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">District</span>
                                              <span className="font-bold text-slate-900">{p.asset_details?.district_name || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Model</span>
                                              <span className="font-bold text-slate-900">{p.asset_details?.model_name || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Barcode</span>
                                              <span className="font-mono font-bold text-amber-800">{p.barcode || "—"}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-400 text-xs block uppercase">Status</span>
                                              <span className="font-bold text-slate-900">{p.asset_details?.inventory_status || "Active"}</span>
                                            </div>
                                          </div>
                                          {p.photo_url && (
                                            <div className="pt-2">
                                              <span className="text-slate-500 text-xs uppercase font-bold block mb-1.5">Attachment Verification Photo</span>
                                              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700 min-h-[220px] max-h-[360px] flex items-center justify-center p-2">
                                                <img
                                                  src={p.photo_url ? formatImageUrl(p.photo_url) : undefined}
                                                  alt="PMS verification"
                                                  className="w-full h-full object-contain cursor-pointer"
                                                  onClick={() => setLightboxImage(`${API_BASE}${p.photo_url}`)}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setLightboxImage(`${API_BASE}${p.photo_url}`)}
                                                  className="absolute bottom-2 right-2 bg-slate-900/80 text-white font-extrabold text-xs px-3 py-1 rounded-lg cursor-pointer border border-white/20 backdrop-blur-md"
                                                >
                                                  Full View
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Asset Tagging list */}
                                  {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-[9px] font-bold text-emerald-700 uppercase text-left">Asset Tagging Records</div>
                                      {assetsList.map((a: any, aIdx: number) => {
                                        const selectedEq = assetValueMaster.find(eq => eq.equipment_name === a.equipment_name);
                                        const costPerUnit = selectedEq ? (selectedEq.asset_value || selectedEq.rmsc_tender_cost || 0) : 0;
                                        const qty = parseInt(a.quantity || "0") || 0;
                                        const totalCost = qty * costPerUnit;
                                        
                                        const isEngineer = (user.designation || "").toLowerCase().trim() === "engineer" || 
                                                           (user.role || "").toLowerCase().trim() === "engineer";
                                        const isSubmitter = (selectedClaim.user_id === user.id) || (selectedClaim.submitter_code === user.user_id);
                                        const hideCost = isEngineer || isSubmitter;
                                        return (
                                          <div key={aIdx} className="bg-emerald-50/30 border border-emerald-100 rounded-lg p-2.5 space-y-1.5 text-[10px] text-left">
                                            <div className="flex justify-between items-center">
                                              <span className="font-extrabold text-gray-800">{a.equipment_name}</span>
                                              <span className="px-2 py-0.5 rounded bg-white border border-emerald-250 text-gray-700 font-bold font-mono">Qty: {qty}</span>
                                            </div>
                                            {!hideCost && (
                                              <div className="flex justify-between text-[9px] text-gray-505 font-bold border-t border-emerald-100/50 pt-1">
                                                <span>Tender Rate: ₹{costPerUnit.toLocaleString()}</span>
                                                <span className="text-emerald-700 font-extrabold">Total Cost: ₹{totalCost.toLocaleString()}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Quantities for Mobilise, Calibration or Other */}
                                  {(selectedActs.includes("Mobilise Asset Update") || selectedActs.includes("Calibration") || (selectedActs.includes("Other") && activityOtherDesc)) && (
                                    <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 text-[10px] font-bold space-y-1 text-left">
                                      {selectedActs.includes("Mobilise Asset Update") && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-550">Mobilise Qty:</span>
                                          <span className="text-indigo-700 font-extrabold">{mobiliseCount} units</span>
                                        </div>
                                      )}
                                      {selectedActs.includes("Calibration") && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-550">Calibration Qty:</span>
                                          <span className="text-purple-700 font-extrabold">{calibrationCount} units</span>
                                        </div>
                                      )}
                                      {selectedActs.includes("Other") && activityOtherDesc && (
                                        <div className="border-t border-gray-100 pt-1.5 mt-1 font-normal text-left">
                                          <span className="text-gray-455 text-[8px] uppercase block font-bold">Other Activity Description</span>
                                          <span className="italic text-gray-700 block">{activityOtherDesc}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cumulative stats for Limit Requests */}
                  {selectedClaim.category === "Limit Request" && selectedClaim.user_monthly_stats && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Requester's Current Monthly Statistics
                        </h4>
                        <span className="text-[10px] text-gray-500 font-bold">Month: {selectedClaim.month} {selectedClaim.year}</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg">
                          <span className="text-[9px] text-blue-500 font-extrabold uppercase tracking-wider block mb-1">Bike/Car Cumulative Distance</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-blue-700 font-mono">{(selectedClaim.user_monthly_stats.total_bike_km || 0).toFixed(1)}</span>
                            <span className="text-[10px] text-blue-600 font-extrabold">KM Used</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block mt-2 font-semibold">
                            Total Approved Limit: {(selectedClaim.user_monthly_stats.max_km || 2000).toFixed(1)} KM
                          </span>
                        </div>

                        <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-lg">
                          <span className="text-[9px] text-purple-500 font-extrabold uppercase tracking-wider block mb-1">Local Conveyance (Auto)</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-purple-700 font-mono">₹{(selectedClaim.user_monthly_stats.total_auto || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-purple-600 font-extrabold">Spent</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block mt-2 font-semibold">
                            Total Approved Limit: ₹{(selectedClaim.user_monthly_stats.max_auto || 1000).toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                          <span className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-wider block mb-1">Total Verified Field Work</span>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px] text-gray-600 font-bold">
                            <div>Calls: <span className="text-emerald-700 font-mono">{selectedClaim.user_monthly_stats.calls_completed || 0}</span></div>
                            <div>PMS: <span className="text-emerald-700 font-mono">{selectedClaim.user_monthly_stats.pms_count || 0}</span></div>
                            <div>Tagging: <span className="text-emerald-700 font-mono">{selectedClaim.user_monthly_stats.asset_tagging || 0}</span></div>
                            <div>Calibration: <span className="text-emerald-700 font-mono">{selectedClaim.user_monthly_stats.calibration_count || 0}</span></div>
                            <div className="col-span-2">Mobilise Verif: <span className="text-emerald-700 font-mono">{selectedClaim.user_monthly_stats.mobilise_count || 0}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {getAttachmentsArray(selectedClaim.attachments).length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Attachments / Receipts</h4>
                      </div>
                      <div className="p-3 flex flex-wrap gap-2">
                        {getAttachmentsArray(selectedClaim.attachments).map((url: string, attIdx: number) => {
                          const filename = url.split("/").pop() || "Receipt";
                          let cleanType = "Receipt";
                          if (url.includes("_Bike_")) cleanType = "Bike Fuel";
                          else if (url.includes("_Car_")) cleanType = "Car Fuel";
                          else if (url.includes("_Auto_")) cleanType = "Auto Fare";
                          else if (url.includes("_Bus_")) cleanType = "Bus Ticket";
                          else if (url.includes("_Train_")) cleanType = "Train Ticket";
                          else if (url.includes("_Hotel_")) cleanType = "Hotel Invoice";
                          else if (url.includes("_Communication_Mail_")) cleanType = "Approval Mail";
                          else if (url.includes("_Other_Expense_")) cleanType = "Purchase Bill";
                          const fullUrl = formatImageUrl(url);
                          return (
                            <div key={attIdx} className="inline-flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                              <span className="font-bold text-gray-700">{cleanType}</span>
                              <button type="button" onClick={() => setLightboxImage(fullUrl)} className="text-blue-600 hover:text-blue-800 font-bold border-0 bg-transparent cursor-pointer text-[10px] underline">Preview</button>
                              <a href={fullUrl} download={filename} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 font-bold text-[10px] underline">Download</a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Approval Logs - Simple Table */}
                  {selectedClaim.approvals && selectedClaim.approvals.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Approval Review History</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50">
                              <th className="py-2 px-3 w-12">Level</th>
                              <th className="py-2 px-3">Reviewer</th>
                              <th className="py-2 px-3">Role</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3">Comments</th>
                              <th className="py-2 px-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedClaim.approvals.map((app: any, appIdx: number) => {
                              const statusClass = app.status === "approved" ? "bg-green-50 border-green-200 text-green-700" 
                                : app.status === "rejected" ? "bg-red-50 border-red-200 text-red-700"
                                : app.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-gray-50 border-gray-200 text-gray-500";
                              return (
                                <tr key={appIdx} className="hover:bg-gray-50">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-500">L{app.level_number}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-800">{app.approver_name}</span>
                                    <span className="text-[9px] text-gray-400 font-mono block">{app.approver_code}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-500">{app.approver_role || "Reviewer"}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>{app.status}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-600 italic whitespace-normal break-words min-w-[150px] max-w-[250px]" title={app.comments || ""}>{app.comments || "—"}</td>
                                  <td className="py-2.5 px-3 text-right text-gray-500 font-mono text-[10px]">
                                    {app.status !== "waiting" && app.status !== "pending" && app.status !== "cancelled" ? formatDateTime(app.updated_at) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Detailed Edit Logs & Change History */}
                  {selectedClaim.edit_history && selectedClaim.edit_history.length > 0 && (
                    <div className="border border-amber-200 rounded overflow-hidden mt-4">
                      <div className="px-3 py-2 bg-amber-50/50 border-b border-amber-200">
                        <h4 className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Adjustment & Edit Log History</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-amber-200 text-[9px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50/20">
                              <th className="py-2 px-3 w-12">Leg</th>
                              <th className="py-2 px-3">Field Edited</th>
                              <th className="py-2 px-3">Original Value</th>
                              <th className="py-2 px-3">Updated Value</th>
                              <th className="py-2 px-3">Reason / Remark</th>
                              <th className="py-2 px-3">Edited By</th>
                              <th className="py-2 px-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {selectedClaim.edit_history.map((log: any, logIdx: number) => {
                              const cleanField = log.field_name === "travel_amount" ? "Travel Amount"
                                : log.field_name === "sub_amount" ? "Local Conveyance"
                                : log.field_name === "hotel_amount" ? "Hotel stay"
                                : log.field_name === "other_amount" ? "Other / Misc"
                                : log.field_name === "distance_km" ? "Distance KM"
                                : log.field_name === "da_amount" ? "DA Amount"
                                : log.field_name === "local_purchase" ? "Local Purchase"
                                : log.field_name;
                              return (
                                <tr key={logIdx} className="hover:bg-amber-50/10 text-slate-700 bg-white">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-500">Facility Visit {log.leg_number}</td>
                                  <td className="py-2.5 px-3 font-semibold text-gray-800">{cleanField}</td>
                                  <td className="py-2.5 px-3 font-mono text-gray-500">{log.field_name === "distance_km" ? `${log.old_value} KM` : `₹${parseFloat(log.old_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{log.field_name === "distance_km" ? `${log.new_value} KM` : `₹${parseFloat(log.new_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2.5 px-3 italic text-gray-600 whitespace-normal break-words min-w-[150px] max-w-[250px]" title={log.comment}>{log.comment || "—"}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    {log.editor_name} <span className="text-[8px] text-amber-600 font-bold block">{log.editor_role}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-500 font-mono text-[10px]">{formatDateTime(log.created_at)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
      </Modal>
      )}

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      {lightboxImage && createPortal(
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          style={{ zIndex: 99999999 }}
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white border border-gray-300 rounded p-4 flex flex-col items-center justify-center select-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center w-full mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-800">Image Preview</span>
              <div className="flex gap-2 items-center">
                <a 
                  href={displayImageUrl || lightboxImage} 
                  target="_blank"
                  rel="noopener noreferrer"
                  download="attachment_image.png" 
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold no-underline"
                >
                  ⬇ Download Image
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-750 text-white rounded text-[10px] font-bold border-0 cursor-pointer transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            {isLoadingPdf ? (
              <div className="text-slate-700 flex flex-col items-center justify-center gap-3 p-12 select-none">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <span className="text-sm font-bold tracking-wide">Loading PDF Document...</span>
              </div>
            ) : isConvertingHeic ? (
              <div className="text-white flex flex-col items-center justify-center gap-3 p-8 rounded bg-slate-900/50 border border-slate-700/50 shadow-lg select-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <span className="text-sm font-bold tracking-wide">Converting Apple HEIC image...</span>
              </div>
            ) : (lightboxImage?.toLowerCase().endsWith(".pdf") || lightboxImage?.toLowerCase().includes(".pdf?")) ? (
              <iframe 
                src={displayImageUrl || lightboxImage} 
                title="Receipt Document Preview"
                className="w-[85vw] h-[65vh] max-w-4xl border border-gray-200 bg-white"
              />
            ) : imageLoadError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded border border-gray-200 max-w-md my-4 select-none">
                <span className="text-amber-500 text-3xl font-bold mb-2">⚠️</span>
                <p className="text-sm font-bold text-gray-800 mb-1">Image Preview Unavailable</p>
                <p className="text-xs text-gray-500 mb-4">Click below to open or download the attachment file directly.</p>
                <a
                  href={displayImageUrl || lightboxImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold no-underline"
                >
                  Open File in New Tab ↗
                </a>
              </div>
            ) : (
              <img 
                src={displayImageUrl || lightboxImage} 
                alt="Receipt Invoice Lightbox" 
                className="max-w-full max-h-[70vh] border border-gray-200 object-contain"
                onError={() => setImageLoadError(true)}
              />
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 📹 Inline Camera Capture Modal */}
      {(activeCameraTarget || activeActivityCameraTarget) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 999999 }}>
          <div className="bg-white border-t-4 border-t-blue-500 rounded shadow-lg max-w-md w-full overflow-hidden animate-scaleIn pointer-events-auto">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-gray-700">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600 animate-pulse" />
                Live Camera Capture
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCameraTarget(null);
                  setActiveActivityCameraTarget(null);
                }}
                className="text-red-600 hover:text-red-800 bg-transparent border-0 cursor-pointer font-black"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 flex flex-col items-center gap-3">
              {/* Video element */}
              <div className="w-full bg-slate-900 aspect-video rounded overflow-hidden relative shadow-inner border border-gray-300">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Camera Switch options */}
              <div className="flex justify-center gap-4 w-full">
                <button
                  type="button"
                  onClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")}
                  className="px-3 py-1 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  Switch Camera ({facingMode === "environment" ? "Back" : "Front"})
                </button>
              </div>
            </div>
            
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveCameraTarget(null);
                  setActiveActivityCameraTarget(null);
                }}
                className="btn-lte-secondary border border-gray-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="btn-lte-primary px-5 font-bold"
              >
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Calls & Open Complaints Selection Modal */}
      {openCallsModalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-blue-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-5 py-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide uppercase text-white">Active Calls & Complaint History</h3>
                  <p className="text-[10px] text-blue-100 font-semibold">
                    Barcode #{openCallsModalData.barcode} • {openCallsModalData.hospitalName}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setOpenCallsModalData(null)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Sub-header instruction */}
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-amber-800 flex items-center gap-1.5">
                <span className="text-amber-600">⚡</span> Select an existing open complaint to re-attend / close, or create a new call entry:
              </span>
              <span className="text-[9px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                {openCallsModalData.openCalls.length} Found
              </span>
            </div>

            {/* List of Open Calls */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-50/50 max-h-[60vh]">
              {openCallsModalData.openCalls.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm hover:border-blue-300 transition-all flex flex-col gap-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded border border-blue-200">
                        {item.complaint_id}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700">
                        Type: {item.call_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                        item.status === 'Close' || item.status === 'Closed'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        ● Status: {item.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[8px]">Last Attended By:</span>
                      <span className="font-extrabold text-slate-800">{item.attended_by}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[8px]">Last Visit Date:</span>
                      <span className="font-bold text-slate-700">{item.attended_date || '—'}</span>
                    </div>
                    {item.action_taken && (
                      <div className="col-span-1 sm:col-span-2">
                        <span className="font-bold text-slate-500 uppercase block text-[8px]">Last Action / Remark:</span>
                        <p className="font-semibold text-slate-800 text-[10px] italic bg-white p-1.5 rounded border border-slate-200 mt-0.5">
                          "{item.action_taken}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Photo Preview Link */}
                  {item.photo_url && (
                    <div className="flex items-center justify-between bg-blue-50/50 p-2 rounded border border-blue-100 text-[10px]">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        📷 Service Report Photo Available
                      </span>
                      <button
                        type="button"
                        onClick={() => setLightboxImage(formatImageUrl(item.photo_url!))}
                        className="text-[9px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition-all shadow-xs"
                      >
                        View Service Report
                      </button>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        handleItineraryChange(openCallsModalData.legNum, "calls_complaint_id", item.complaint_id);
                        handleItineraryChange(openCallsModalData.legNum, "calls_type", item.call_type || "Support Call");
                        handleItineraryChange(openCallsModalData.legNum, "calls_status", item.status || "Attend");
                        setOpenCallsModalData(null);
                        toast.success(`Selected Complaint ID ${item.complaint_id}. You can now update status, remark & service report photo.`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-4 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                    >
                      ✓ Select & Continue Complaint #{item.complaint_id} ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[9px] text-slate-500 font-semibold">
                Note: Multiple engineers can log actions against the same Complaint ID over time.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenCallsModalData(null)}
                  className="px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg transition-all"
                >
                  Close Modal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenCallsModalData(null);
                    toast("Started new call entry. Please enter Complaint ID.");
                  }}
                  className="px-3.5 py-1.5 text-[10px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
                >
                  + Create New Complaint ID
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
