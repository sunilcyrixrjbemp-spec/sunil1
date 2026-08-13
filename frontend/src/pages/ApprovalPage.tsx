import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { 
  Table, 
  Button, 
  Modal, 
  Space, 
  Input, 
  Typography, 
  Avatar, 
  Checkbox
} from "antd";
import { approvalService } from "../services/approvalService";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import ApprovalSkeleton from "../components/common/ApprovalSkeleton";

import { prefetchManager } from "../utils/prefetchManager";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { formatImageUrl } from "../components/common/ClaimDetailsModal";
import { 
  Check, 
  X, 
  Eye, 
  Search,
  FileText, 
  Loader2,
  RotateCcw,
  CheckCircle2,
  Zap
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import ClaimDetailsModal from "../components/common/ClaimDetailsModal";

const { Text } = Typography;

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

const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`localStorage.setItem failed for key "${key}":`, e);
  }
};

export default function ApprovalPage() {
  const navigate = useNavigate();
  const [pendingApprovals, setPendingApprovals] = useState<any[]>(() => {
    const cached = localStorage.getItem("cache_pending_approvals");
    return cached ? JSON.parse(cached) : [];
  });
  const [approvalPageSize, setApprovalPageSize] = useState(25);
  const [filterEngineer, setFilterEngineer] = useState("");

  const filteredApprovals = pendingApprovals.filter((a: any) => {
    if (filterEngineer) {
      const q = filterEngineer.toLowerCase();
      const nameMatch = a.employeeName && a.employeeName.toLowerCase().includes(q);
      const codeMatch = a.eCode && a.eCode.toLowerCase().includes(q);
      const districtMatch = a.district && a.district.toLowerCase().includes(q);
      const fromDistrictMatch = a.from_district && a.from_district.toLowerCase().includes(q);
      if (!nameMatch && !codeMatch && !districtMatch && !fromDistrictMatch) return false;
    }
    return true;
  });

  const limitRequests = filteredApprovals.filter((a: any) => a.category === "Limit Request");
  const claimRequests = filteredApprovals.filter((a: any) => a.category !== "Limit Request");

  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem("cache_pending_approvals");
  });
  
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [expenseDetails, setExpenseDetails] = useState<any>(null);
  const [_loadingDetails, setLoadingDetails] = useState(false);
  const [comments, setComments] = useState("");
  const [_actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processingLimitId, setProcessingLimitId] = useState<number | null>(null);
  const [processingLimitType, setProcessingLimitType] = useState<"approve" | "reject" | null>(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComments, setReturnComments] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnExpenseId, setReturnExpenseId] = useState<number | null>(null);

  // Success popup state (replaces Modal.success for centered mobile display)
  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    isAuto: boolean;
    claimCode: string;
    empName: string;
    amount?: number;
    isBulk?: boolean;
    bulkCount?: number;
    actionType?: "approve" | "reject";
    isLimit?: boolean;
  } | null>(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userRoleLower = (currentUser.role || "").trim().toLowerCase();
  const isBulkAuthorized = Number(currentUser.can_bulk_approve) === 1 || Number(currentUser.canBulkApprove) === 1 || ["coordinator", "project head"].includes(userRoleLower);
  // Edit single itineraries state
  const [editedLegs, setEditedLegs] = useState<any[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<string[]>([]);

  // Bulk actions selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // holds selected expense_ids
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | null>(null);
  const [bulkComments, setBulkComments] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);



  // In-app Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);

  useEffect(() => {
    const hasAnyModalOpen = !!successModal?.visible || (showDetailModal && !!selectedApproval) || (showBulkModal && !!bulkActionType) || showReturnModal || !!lightboxImage;
    if (hasAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
    }
  }, [successModal, showDetailModal, selectedApproval, showBulkModal, bulkActionType, showReturnModal, lightboxImage]);

  const [_showModalScrollTop, setShowModalScrollTop] = useState(false);

  useEffect(() => {
    if (!showDetailModal) {
      setShowModalScrollTop(false);
      return;
    }

    let frameId: number | null = null;
    const handleScroll = (e: Event) => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const target = e.target as HTMLElement;
        const shouldShow = target ? target.scrollTop > 150 : false;
        setShowModalScrollTop(prev => (prev === shouldShow ? prev : shouldShow));
      });
    };

    const timer = setTimeout(() => {
      const body = document.querySelector(".approval-review-modal-wrap .ant-modal-body");
      if (body) {
        body.addEventListener("scroll", handleScroll, { passive: true });
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (frameId) cancelAnimationFrame(frameId);
      const body = document.querySelector(".approval-review-modal-wrap .ant-modal-body");
      if (body) {
        body.removeEventListener("scroll", handleScroll);
      }
    };
  }, [showDetailModal]);

  const [_showPageScrollTop, setShowPageScrollTop] = useState(false);

  useEffect(() => {
    let frameId: number | null = null;
    const handlePageScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const shouldShow = window.scrollY > 300;
        setShowPageScrollTop(prev => (prev === shouldShow ? prev : shouldShow));
      });
    };
    window.addEventListener("scroll", handlePageScroll, { passive: true });
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", handlePageScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    setImageLoadError(false);
    setIsLoadingPdf(false);

    if (!lightboxImage) {
      setDisplayImageUrl(null);
      setIsConvertingHeic(false);
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

    // Check HEIC asynchronously in background only if needed
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

  const [_assetValueMaster, setAssetValueMaster] = useState<any[]>([]);
  const [editedLimits, setEditedLimits] = useState<{[key: number]: number}>({});

  const handleEditLimitChange = (id: number, val: number) => {
    setEditedLimits(prev => ({ ...prev, [id]: val }));
  };

  const handleApproveLimit = async (expenseId: number, approvedValue: number) => {
    if (isNaN(approvedValue) || approvedValue <= 0) {
      toast.error("Please enter a valid approved value.");
      return;
    }
    
    setProcessingLimitId(expenseId);
    setProcessingLimitType("approve");
    setActionLoading(true);
    try {
      await approvalService.approveExpense(expenseId, "Approved limit extension", undefined, approvedValue);
      toast.success("Limit extension request approved successfully!");
      setPendingApprovals(prev => prev.filter((a: any) => a.expense_id !== expenseId));
      fetchPendingApprovals(true);
    } catch (err: any) {
      console.error("Failed to approve limit", err);
      toast.error(err.response?.data?.detail || "Failed to approve limit extension.");
    } finally {
      setActionLoading(false);
      setProcessingLimitId(null);
      setProcessingLimitType(null);
    }
  };

  const handleRejectLimit = async (expenseId: number) => {
    setProcessingLimitId(expenseId);
    setProcessingLimitType("reject");
    setActionLoading(true);
    try {
      await approvalService.rejectExpense(expenseId, "Limit extension rejected");
      toast.success("Limit extension request rejected.");
      setPendingApprovals(prev => prev.filter((a: any) => a.expense_id !== expenseId));
      fetchPendingApprovals(true);
    } catch (err: any) {
      console.error("Failed to reject limit", err);
      toast.error(err.response?.data?.detail || "Failed to reject limit extension.");
    } finally {
      setActionLoading(false);
      setProcessingLimitId(null);
      setProcessingLimitType(null);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    loadAssetValueMaster();
  }, []);

  const loadAssetValueMaster = async () => {
    try {
      const res = await expenseService.getAssetValueMaster();
      setAssetValueMaster(res || []);
    } catch (e) {
      console.error("Failed to load asset value master in approvals page", e);
    }
  };

  const fetchPendingApprovals = async (forceRefresh?: boolean) => {
    setSelectedIds([]);
    const cacheKey = "cache_pending_approvals";
    
    if (forceRefresh) {
      prefetchManager.invalidateApprovals(currentUser.user_id || "");
    }

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setPendingApprovals(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // Use memory-cache check to skip API calls if fresh (<30s)
      const data = await prefetchManager.getOrFetch("pending_approvals", () => approvalService.getPendingApprovals(), 30000);
      safeSetLocalStorage(cacheKey, JSON.stringify(data));
      setPendingApprovals(data);
      
      // Also update dashboard badge cache
      const currentUserStr = localStorage.getItem("user");
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        safeSetLocalStorage(`cache_approvals_count_${currentUser.user_id}`, data.length.toString());
      }
    } catch (err: any) {
      console.error("Failed to load approvals", err);
      if (!cached) {
        toast.error("Failed to load pending approvals from database.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingApprovals || pendingApprovals.length === 0) return;
    
    const rawSearch = window.location.search || (window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "");
    if (!rawSearch) return;

    const params = new URLSearchParams(rawSearch);
    const targetExpId = params.get("expense_id") || params.get("exp_id") || params.get("id");
    const targetClaimCode = params.get("claim_code") || params.get("code");

    if (targetExpId || targetClaimCode) {
      const match = pendingApprovals.find((a: any) => 
        (targetExpId && (String(a.expense_id) === String(targetExpId) || String(a.id) === String(targetExpId))) ||
        (targetClaimCode && String(a.expense_code || "").toLowerCase() === String(targetClaimCode).toLowerCase())
      );
      if (match && !showDetailModal) {
        handleOpenDetails(match);
      }
    }
  }, [pendingApprovals]);

  const handleOpenDetails = async (app: any) => {
    setSelectedApproval(app);
    setShowDetailModal(true);
    setComments("");
    setActionType(null);
    setRemovedAttachments([]);

    const initLegs = (details: any) => {
      const rawLegs = (Array.isArray(details.itineraries) && details.itineraries.length > 0)
        ? details.itineraries
        : ((Array.isArray(details.legs) && details.legs.length > 0)
            ? details.legs
            : ((Array.isArray(details.itinerary_list) && details.itinerary_list.length > 0)
                ? details.itinerary_list
                : ((Array.isArray(details.itinerary) && Array.isArray(details.itinerary)) ? details.itinerary : [])));
      
      const legsToUse = rawLegs.length > 0 ? rawLegs : [{
        leg: 1,
        from_district: details.district || details.submitter_district || details.from_district || "Base District",
        to_district: details.district || details.submitter_district || details.to_district || "Field Visit",
        from: details.from_location || details.from || "",
        to: details.to_location || details.to || "",
        mode: details.category || details.travel_mode || "Bike",
        km: details.total_km || details.km || 0,
        amount: details.amount || details.travel_amount || 0,
        sub_mode: "",
        sub_amount: 0,
        da: details.da_amount || details.da || 0,
        hotel_amount: details.hotel_amount || details.hotel || 0,
        local_purchase: details.local_purchase_amount || details.local_purchase || 0,
        oth_desc: details.other_expense_reason || "",
        other_amount: details.other_expense_amount || details.other_amount || 0,
        visit_purpose: details.purpose || details.description || "",
        ws_assigned: details.calls_assigned || 0,
        ws_closed: details.calls_completed || 0,
        ws_pms: details.pms_count || 0,
        ws_asset: details.asset_tagging || 0,
        remarks: {}
      }];

      setEditedLegs(
        legsToUse.map((leg: any, idx: number) => ({
          leg: leg.leg || leg.leg_number || (idx + 1),
          from_district: leg.from_district || leg.from_dist || "",
          to_district: leg.to_district || leg.to_dist || "",
          from: leg.from || leg.from_location || "",
          to: leg.to || leg.to_location || "",
          mode: leg.mode || leg.travel_mode || "Bike",
          km: leg.km ?? leg.distance_km ?? 0,
          travel_amount: parseFloat(leg.amount ?? leg.travel_amount ?? 0),
          sub_mode: leg.sub_mode || "",
          sub_amount: parseFloat(leg.sub_amount ?? 0),
          da: parseFloat(leg.da ?? leg.da_amount ?? 0),
          hotel_amount: parseFloat(leg.hotel ?? leg.hotel_amount ?? 0),
          local_purchase: parseFloat(leg.local_purchase ?? leg.local_purchase_amount ?? 0),
          oth_desc: leg.oth_desc || leg.other_desc || "",
          other_amount: parseFloat(leg.oth_amount ?? leg.other_amount ?? 0),
          visit_purpose: leg.visit_purpose || leg.purpose || "",
          ws_assigned: leg.ws_assigned ?? leg.calls_assigned ?? 0,
          ws_closed: leg.ws_closed ?? leg.calls_completed ?? 0,
          ws_pms: leg.ws_pms ?? leg.pms_count ?? 0,
          ws_asset: leg.ws_asset ?? leg.asset_tagging ?? 0,
          remarks: {}
        }))
      );
    };

    // 1. INSTANTLY construct initial claim details from row data for 0ms modal open speed!
    const targetId = app.expense_id ?? app.id ?? app.expense_code;
    const initialDetails = {
      id: app.id || app.expense_id,
      expense_code: app.expense_code || String(targetId),
      user_id: app.user_id || app.eCode || 0,
      submitter_name: app.employeeName || app.submitter_name || "Employee",
      submitter_code: app.eCode || app.submitter_code || "",
      month: app.date || app.month || "",
      amount: parseFloat(app.amount || 0),
      status: app.status || "submitted",
      category: app.category || app.travel_mode || "Travel",
      date: app.date || "",
      purpose: app.purpose || app.description || "",
      attachments: getAttachmentsArray(app.attachments || app.attachment_urls || app.attachments_detailed),
      itineraries: [],
      approvals: []
    };

    const cacheKey = `cache_claim_detail_${targetId}`;
    const cached = localStorage.getItem(cacheKey);
    let hasLoadedData = false;

    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        if (cachedData && Array.isArray(cachedData.itineraries) && cachedData.itineraries.length > 0) {
          setExpenseDetails(cachedData);
          initLegs(cachedData);
          setLoadingDetails(false);
          hasLoadedData = true;
        }
      } catch (e) {}
    }

    if (!hasLoadedData) {
      setExpenseDetails(initialDetails);
      initLegs(initialDetails);
      setLoadingDetails(false);
    }

    // 2. Fetch full leg breakdown asynchronously in background without blocking UI!
    try {
      const details = await expenseService.getExpenseDetails(targetId);
      if (details) {
        setExpenseDetails(details);
        initLegs(details);
        safeSetLocalStorage(cacheKey, JSON.stringify(details));
      }
    } catch (err: any) {
      console.warn("Background expense details fetch error:", err);
    }
  };

  const handleLegAmountChange = (index: number, field: string, value: string | number) => {
    const numericValue = parseFloat(String(value)) || 0;
    setEditedLegs(prev => {
      const updated = [...prev];
      const leg = updated[index] || {};
      const rawLegs = Array.isArray(expenseDetails?.itineraries) && expenseDetails.itineraries.length > 0
        ? expenseDetails.itineraries
        : (Array.isArray(expenseDetails?.legs) ? expenseDetails.legs : []);
      const targetOriginal = rawLegs[index] || {};

      let newKm = leg.km;
      let newTravelAmount = leg.travel_amount;

      if (field === "km") {
        const dbBikeRate = expenseDetails?.rate_bike || 4.5;
        const dbCarRate = expenseDetails?.rate_car || 9.0;
        const mode = leg.mode || targetOriginal.mode || targetOriginal.travel_mode;
        const defaultRate = mode === "Car" ? dbCarRate : dbBikeRate;

        let rate = defaultRate;
        if (targetOriginal.travel_amount && targetOriginal.km && targetOriginal.km > 0) {
          const computed = targetOriginal.travel_amount / targetOriginal.km;
          if (computed > 0) rate = computed;
        } else if (targetOriginal.amount && targetOriginal.km && targetOriginal.km > 0) {
          // If targetOriginal.amount is <= 15, it represents per-km rate directly
          const computed = targetOriginal.amount <= 15 ? targetOriginal.amount : (targetOriginal.amount / targetOriginal.km);
          if (computed > 0) rate = computed;
        }

        newKm = numericValue;
        newTravelAmount = parseFloat((numericValue * rate).toFixed(2));
        updated[index] = {
          ...leg,
          km: newKm,
          travel_amount: newTravelAmount
        };
      } else {
        if (field === "travel_amount") newTravelAmount = numericValue;
        updated[index] = {
          ...leg,
          [field]: numericValue
        };
      }

      return updated;
    });
  };

  const handleLegRemarkChange = (index: number, field: string, remark: string) => {
    setEditedLegs(prev => {
      const updated = [...prev];
      const leg = updated[index] || {};

      updated[index] = {
        ...leg,
        remarks: {
          ...(leg.remarks || {}),
          [field]: remark,
          ...(field === "distance_km" ? { travel_amount: remark } : {})
        }
      };

      return updated;
    });
  };

  const calculateAdjustedTotal = () => {
    return editedLegs.reduce((sum, leg) => {
      return sum + leg.travel_amount + leg.sub_amount + leg.da + leg.hotel_amount + leg.other_amount + (leg.local_purchase || 0);
    }, 0);
  };

  const handleProcessAction = async (type: "approve" | "reject") => {
    if (!selectedApproval || !expenseDetails) return;

    if (type === "reject" && !comments.trim()) {
      toast.error("Rejection remarks comments are mandatory.");
      return;
    }

    setActionType(type);
    setActionLoading(true);
    try {
      // Validate that every modified field has a corresponding mandatory remark
      if (selectedApproval.category !== "Limit Request") {
        for (let i = 0; i < editedLegs.length; i++) {
          const leg = editedLegs[i];
          const rawLegs = Array.isArray(expenseDetails?.itineraries) && expenseDetails.itineraries.length > 0
            ? expenseDetails.itineraries
            : (Array.isArray(expenseDetails?.legs) ? expenseDetails.legs : []);
          const originalLeg = rawLegs[i] || {};
          
          const isKmLeg = parseFloat(String(originalLeg.km ?? originalLeg.distance_km ?? 0)) > 0;
          const checks = [
            { field: "distance_km", keyInRemarks: ["distance_km", "km", "travel_amount"], name: "Distance (KM)", current: leg.km, original: originalLeg.km ?? originalLeg.distance_km ?? 0 },
            { field: "travel_amount", keyInRemarks: isKmLeg ? ["travel_amount", "distance_km", "km"] : ["travel_amount"], name: "Travel TA", current: leg.travel_amount, original: originalLeg.amount ?? originalLeg.travel_amount ?? 0 },
            { field: "sub_amount", keyInRemarks: ["sub_amount"], name: "Local Conveyance", current: leg.sub_amount, original: originalLeg.sub_amount ?? 0 },
            { field: "hotel_amount", keyInRemarks: ["hotel_amount"], name: "Hotel stay", current: leg.hotel_amount, original: originalLeg.hotel ?? originalLeg.hotel_amount ?? 0 },
            { field: "local_purchase", keyInRemarks: ["local_purchase"], name: "Local Purchase", current: leg.local_purchase, original: originalLeg.local_purchase ?? 0 },
            { field: "other_amount", keyInRemarks: ["other_amount"], name: "Other Exp.", current: leg.other_amount, original: originalLeg.oth_amount ?? originalLeg.other_amount ?? 0 },
            { field: "da_amount", keyInRemarks: ["da_amount", "da"], name: "Daily DA", current: leg.da, original: originalLeg.da ?? originalLeg.da_amount ?? 0 }
          ];

          for (const check of checks) {
            const isChanged = Math.abs(parseFloat(String(check.current || 0)) - parseFloat(String(check.original || 0))) > 0.01;
            if (isChanged) {
              let rMark = "";
              if (leg.remarks) {
                for (const k of check.keyInRemarks) {
                  if (leg.remarks[k] && String(leg.remarks[k]).trim()) {
                    rMark = String(leg.remarks[k]).trim();
                    break;
                  }
                }
              }
              if (!rMark) {
                toast.error(`Leg #${leg.leg}: Please enter a mandatory remark/reason for editing ${check.name}.`);
                setActionLoading(false);
                return;
              }
            }
          }
        }
      }

      const itineraryEdits = editedLegs.map(leg => ({
        leg_number: leg.leg,
        travel_amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        hotel_amount: leg.hotel_amount,
        other_amount: leg.other_amount,
        distance_km: leg.km,
        da_amount: leg.da,
        local_purchase: leg.local_purchase,
        remarks: leg.remarks || {}
      }));

      if (selectedApproval.category === "Limit Request") {
        const approvedVal = selectedApproval.expense_code.includes("KM")
          ? (editedLegs[0]?.km ?? expenseDetails?.amount ?? 0)
          : (editedLegs[0]?.travel_amount ?? expenseDetails?.amount ?? 0);

        if (type === "approve") {
          await approvalService.approveExpense(selectedApproval.expense_id, comments.trim() || "Approved limit extension", undefined, approvedVal);
          toast.success("Limit request approved successfully!");
          setSuccessModal({
            visible: true,
            isAuto: false,
            claimCode: selectedApproval.expense_code,
            empName: selectedApproval.employeeName,
            amount: approvedVal || selectedApproval.amount || 0,
            actionType: "approve",
            isLimit: true
          });
        } else {
          await approvalService.rejectExpense(selectedApproval.expense_id, comments.trim() || "Limit extension rejected");
          toast.error("Limit request rejected.");
          setSuccessModal({
            visible: true,
            isAuto: false,
            claimCode: selectedApproval.expense_code,
            empName: selectedApproval.employeeName,
            amount: selectedApproval.amount || 0,
            actionType: "reject",
            isLimit: true
          });
        }
      } else {
        if (type === "approve") {
          await approvalService.approveExpense(selectedApproval.expense_id, comments.trim(), itineraryEdits, undefined, removedAttachments);
          const isAuto = selectedApproval.is_auto_approved || selectedApproval.auto_approved || expenseDetails?.is_auto_approved || (calculateAdjustedTotal() === 0);
          setSuccessModal({
            visible: true,
            isAuto,
            claimCode: selectedApproval.expense_code,
            empName: selectedApproval.employeeName,
            amount: calculateAdjustedTotal() || selectedApproval.amount || 0,
            actionType: "approve"
          });
        } else {
          await approvalService.rejectExpense(selectedApproval.expense_id, comments.trim(), itineraryEdits, removedAttachments);
          toast.error(`Claim ${selectedApproval.expense_code} rejected.`);
          setSuccessModal({
            visible: true,
            isAuto: false,
            claimCode: selectedApproval.expense_code,
            empName: selectedApproval.employeeName,
            amount: selectedApproval.amount || 0,
            actionType: "reject"
          });
        }
      }

      setShowDetailModal(false);
      const processedId = selectedApproval.expense_id;
      setPendingApprovals(prev => {
        const filtered = prev.filter((a: any) => a.expense_id !== processedId);
        safeSetLocalStorage("cache_pending_approvals", JSON.stringify(filtered));
        const currentUserStr = localStorage.getItem("user");
        if (currentUserStr) {
          try {
            const currentUser = JSON.parse(currentUserStr);
            safeSetLocalStorage(`cache_approvals_count_${currentUser.user_id}`, filtered.length.toString());
          } catch(e) {}
        }
        return filtered;
      });
      setSelectedApproval(null);
      setExpenseDetails(null);
      setEditedLegs([]);
      setRemovedAttachments([]);
      await fetchPendingApprovals(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnToDraft = async () => {
    if (!returnExpenseId) return;
    if (!returnComments.trim()) {
      toast.error("Please provide a reason for returning this claim.");
      return;
    }

    setReturnLoading(true);
    try {
      await approvalService.returnToDraft(returnExpenseId, returnComments.trim(), removedAttachments);
      toast.success("Claim returned to engineer for corrections.");
      setShowReturnModal(false);
      setPendingApprovals(prev => {
        const filtered = prev.filter((a: any) => a.expense_id !== returnExpenseId);
        safeSetLocalStorage("cache_pending_approvals", JSON.stringify(filtered));
        const currentUserStr = localStorage.getItem("user");
        if (currentUserStr) {
          try {
            const currentUser = JSON.parse(currentUserStr);
            safeSetLocalStorage(`cache_approvals_count_${currentUser.user_id}`, filtered.length.toString());
          } catch(e) {}
        }
        return filtered;
      });
      setReturnExpenseId(null);
      setReturnComments("");
      if (selectedApproval && selectedApproval.expense_id === returnExpenseId) {
        setShowDetailModal(false);
        setSelectedApproval(null);
        setExpenseDetails(null);
        setEditedLegs([]);
        setRemovedAttachments([]);
      }
      await fetchPendingApprovals(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to return claim.");
    } finally {
      setReturnLoading(false);
    }
  };

  // Checkbox functions
  const toggleSelectAll = () => {
    if (selectedIds.length === claimRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(claimRequests.map(item => item.expense_id));
    }
  };

  const handleOpenBulkAction = (type: "approve" | "reject") => {
    if (!isBulkAuthorized) {
      toast.error("Bulk approval is restricted to Coordinator and Project Head roles only.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Please select at least one claim first.");
      return;
    }
    setBulkActionType(type);
    setBulkComments("");
    setShowBulkModal(true);
  };

  const handleBulkSubmit = async () => {
    if (!isBulkAuthorized) {
      toast.error("Bulk approval is restricted to Coordinator and Project Head roles only.");
      setShowBulkModal(false);
      return;
    }
    if (!bulkActionType) return;
    
    if (bulkActionType === "reject" && !bulkComments.trim()) {
      toast.error("Rejection remarks comments are mandatory.");
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    const bulkLabel = bulkActionType === "reject" ? "Bulk Rejection" : "Bulk Approval";
    const cleanRemark = bulkComments.trim();
    const formattedBulkComment = cleanRemark ? `${bulkLabel} :- ${cleanRemark}` : bulkLabel;

    try {
      const res = await approvalService.bulkApproveExpenses(selectedIds, bulkActionType, formattedBulkComment);
      successCount = res.successCount || selectedIds.length;
      failCount = res.failCount || 0;
    } catch (err) {
      const results = await Promise.all(selectedIds.map(async (id) => {
        try {
          if (bulkActionType === "approve") {
            await approvalService.approveExpense(id, formattedBulkComment);
          } else {
            await approvalService.rejectExpense(id, formattedBulkComment);
          }
          return { success: true };
        } catch (e) {
          return { success: false };
        }
      }));
      successCount = results.filter(r => r.success).length;
      failCount = results.filter(r => !r.success).length;
    }

    if (successCount > 0) {
      setSuccessModal({
        visible: true,
        isAuto: false,
        claimCode: "",
        empName: "",
        isBulk: true,
        bulkCount: successCount,
        actionType: bulkActionType as "approve" | "reject"
      });
      setPendingApprovals(prev => prev.filter(a => !selectedIds.includes(a.expense_id)));
      setSelectedIds([]);
    }
    if (failCount > 0) {
      toast.error(`Failed to process ${failCount} claim(s).`);
    }

    setBulkActionLoading(false);
    setShowBulkModal(false);
    setBulkActionType(null);
    setBulkComments("");
    await fetchPendingApprovals(true);
  };



  // Sum of selected amounts
  const getSelectedTotalAmount = () => {
    return pendingApprovals
      .filter(item => selectedIds.includes(item.expense_id))
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  return (
    <>
      {/* ================= ANIMATED SUCCESS MODAL (Centered on mobile) ================= */}
      <style>{`
        @keyframes ap-check-draw {
          from { stroke-dashoffset: 100; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes ap-ring-pulse {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes ap-ring-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50%       { box-shadow: 0 0 0 14px rgba(16,185,129,0); }
        }
        @keyframes ap-modal-in {
          0%   { transform: scale(0.7) translateY(30px); opacity: 0; }
          70%  { transform: scale(1.04) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes ap-float-up {
          0%   { transform: translateY(0) rotate(0deg) scale(0); opacity: 1; }
          100% { transform: translateY(-120px) rotate(720deg) scale(1); opacity: 0; }
        }
        @keyframes ap-auto-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%       { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
        }
        @keyframes ap-reject-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0.5); }
          50%       { box-shadow: 0 0 0 14px rgba(225,29,72,0); }
        }
        .ap-success-modal-content {
          animation: ap-modal-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .ap-check-ring {
          animation: ap-ring-pulse 0.5s ease-out 0.1s both, ap-ring-glow 1.4s ease-in-out 0.6s infinite;
        }
        .ap-auto-ring {
          animation: ap-ring-pulse 0.5s ease-out 0.1s both, ap-auto-ring-pulse 1.4s ease-in-out 0.6s infinite;
        }
        .ap-reject-ring {
          animation: ap-ring-pulse 0.5s ease-out 0.1s both, ap-reject-ring-pulse 1.4s ease-in-out 0.6s infinite;
        }
        .ap-check-svg path, .ap-cross-svg path {
          stroke-dasharray: 100;
          animation: ap-check-draw 0.45s ease-out 0.35s both;
        }
        .ap-particle {
          position: absolute;
          width: 8px; height: 8px;
          border-radius: 50%;
          animation: ap-float-up 1.2s ease-out forwards;
        }
      `}</style>

      {/* ================= SUCCESS / REJECTION RESULT MODAL ================= */}
      <Modal
        open={!!successModal?.visible}
        destroyOnClose={true}
        centered
        footer={null}
        closable={false}
        width={360}
        style={{ maxWidth: "92vw" }}
        onCancel={() => setSuccessModal(null)}
        bodyStyle={{ padding: 0 }}
      >
        {successModal && (
          <div className="bg-white border border-slate-400 rounded-none shadow-2xl overflow-hidden text-center">
            {/* Header Banner */}
            <div className={`px-4 py-5 text-white text-center rounded-none ${
              successModal.actionType === "reject"
                ? "bg-rose-700"
                : successModal.isAuto
                  ? "bg-[#4A6A8A]"
                  : "bg-emerald-600"
            }`}>
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-none bg-white/20 border border-white/50 flex items-center justify-center">
                  {successModal.actionType === "reject" ? (
                    <X className="w-7 h-7 text-white" />
                  ) : successModal.isAuto ? (
                    <Zap className="w-7 h-7 text-amber-300" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="font-black text-sm uppercase tracking-wider leading-tight text-white">
                {successModal.isBulk
                  ? `Bulk Claims ${successModal.actionType === "approve" ? "Approved" : "Rejected"}!`
                  : successModal.actionType === "reject"
                    ? (successModal.isLimit ? "Limit Request Rejected" : "Claim Rejected")
                    : successModal.isAuto
                      ? "Auto-Approved by Policy"
                      : (successModal.isLimit ? "Limit Request Approved" : "Claim Approved")}
              </div>
              {!successModal.isBulk && (
                <div className="text-[11px] font-bold text-white/90 mt-0.5">
                  {successModal.actionType === "reject"
                    ? "Expense claim decision logged"
                    : successModal.isAuto
                      ? "System policy auto-approval applied"
                      : "Reimbursement has been sanctioned"}
                </div>
              )}
            </div>

            {/* Body details */}
            <div className="p-4 bg-white">
              {successModal.isBulk ? (
                <div className={`p-3 border rounded-none mb-4 ${
                  successModal.actionType === "reject" ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
                }`}>
                  <div className={`text-xs font-bold ${successModal.actionType === "reject" ? "text-rose-900" : "text-emerald-900"}`}>
                    Successfully processed <span className="font-black text-base">{successModal.bulkCount}</span> claim{(successModal.bulkCount || 0) > 1 ? "s" : ""}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-300 rounded-none p-3.5 mb-4 text-left space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Claim ID</span>
                    <span className="font-mono font-extrabold text-xs text-[#4A6A8A] bg-white px-2 py-0.5 border border-slate-300">
                      {successModal.claimCode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Employee</span>
                    <span className="font-extrabold text-slate-900 text-xs">{successModal.empName}</span>
                  </div>
                  {!successModal.isAuto && (successModal.amount || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                      <span className="text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Sanctioned Amount</span>
                      <span className={`font-mono font-black text-sm ${
                        successModal.actionType === "reject" ? "text-rose-700" : "text-emerald-700"
                      }`}>
                        ₹{(successModal.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {successModal.isAuto && (
                    <div className="text-[10px] text-indigo-700 font-bold mt-1">
                      ⚡ Zero reimbursable amount — auto-approved by policy
                    </div>
                  )}
                </div>
              )}

              <Button
                type="primary"
                block
                onClick={() => setSuccessModal(null)}
                className={`font-black text-xs uppercase tracking-wider rounded-none h-9 cursor-pointer shadow-none border-0 ${
                  successModal.actionType === "reject"
                    ? "bg-rose-700 hover:bg-rose-800"
                    : "bg-[#4A6A8A] hover:bg-[#3b5570]"
                }`}
              >
                {successModal.isBulk ? "Close" : "Done ✓"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-4 animate-fadeIn text-[#212529]">
      
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">APPROVAL CENTER</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Review operational, local purchase, and travel claims submitted by staff.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white bg-[#4A6A8A] px-2.5 py-1 rounded-none border border-[#4A6A8A] font-mono">
            Pending Claims: <strong>{claimRequests.length}</strong>
          </span>
          {limitRequests.length > 0 && (
            <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-none border border-cyan-200 font-mono">
              Limit Extensions: <strong>{limitRequests.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Filters — hidden on mobile, desktop-only search bar */}
      <div className="hidden sm:block mb-4">
        <div className="bg-white border border-slate-300 rounded-none shadow-2xs p-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div style={{ flex: 1, maxWidth: 400 }}>
              <Input
                size="middle"
                value={filterEngineer}
                onChange={(e) => setFilterEngineer(e.target.value)}
                placeholder="Search by Employee Name, Code, or District..."
                prefix={<Search size={14} className="text-slate-400" />}
                className="rounded-none text-xs border-slate-300 focus:border-[#4A6A8A]"
                allowClear
              />
            </div>
            {filterEngineer && (
              <span className="text-[11px] font-bold text-slate-500">
                {filteredApprovals.length} result{filteredApprovals.length !== 1 ? "s" : ""} found
              </span>
            )}
            {/* Bulk Toolbar — Only for authorized roles */}
            {isBulkAuthorized && claimRequests.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox
                  checked={selectedIds.length > 0 && selectedIds.length === claimRequests.length}
                  onChange={toggleSelectAll}
                  className="text-xs font-bold text-slate-700"
                >
                  Select All ({selectedIds.length})
                </Checkbox>
                <Button
                  type="primary"
                  size="small"
                  style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("approve")}
                  icon={<Check size={13} />}
                  className="font-extrabold text-xs rounded-none shadow-2xs"
                >
                  Bulk Approve ({selectedIds.length})
                </Button>
                <Button
                  type="primary"
                  danger
                  size="small"
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("reject")}
                  icon={<X size={13} />}
                  className="font-extrabold text-xs rounded-none shadow-2xs"
                >
                  Bulk Reject ({selectedIds.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= LIMIT EXTENSION REQUESTS SECTION ================= */}
      {limitRequests.length > 0 && (
        <div className="border border-slate-300 rounded-none shadow-2xs mb-4 bg-white overflow-hidden">
          <div className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-blue-300 animate-pulse" />
              Limit Extension Requests ({limitRequests.length})
            </span>
          </div>
          <Table
            dataSource={limitRequests}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: "Employee Details",
                dataIndex: "employeeName",
                key: "employeeName",
                render: (name, req) => (
                  <div className="flex items-center gap-2">
                    <Avatar size="small" className="bg-[#4A6A8A] font-bold text-xs rounded-none">
                      {name ? name.charAt(0).toUpperCase() : "U"}
                    </Avatar>
                    <div>
                      <Text className="font-bold text-slate-800 block text-xs leading-tight">{name}</Text>
                      <Text className="text-[10px] text-[#4A6A8A] font-mono font-bold block">{req.eCode}</Text>
                    </div>
                  </div>
                ),
              },
              {
                title: "Limit Type",
                dataIndex: "purpose",
                key: "limit_type",
                render: (p) => (
                  <span className="font-bold text-[10px] uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-none border border-slate-300">
                    {p?.toLowerCase().includes("km") ? "KM Limit" : "Auto Limit"}
                  </span>
                ),
              },
              {
                title: "Month",
                dataIndex: "date",
                key: "date",
                align: "center" as const,
              },
              {
                title: "Purpose",
                dataIndex: "purpose",
                key: "purpose",
              },
              {
                title: "Requested Extension",
                key: "requested",
                render: (_, req) => {
                  const reqVal = req.amount;
                  const currentValue = editedLimits[req.id] !== undefined ? editedLimits[req.id] : reqVal;
                  return (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        size="small"
                        value={currentValue}
                        onChange={(e) => handleEditLimitChange(req.id, parseFloat(e.target.value))}
                        className="w-24 font-bold text-xs rounded-none border-slate-300"
                      />
                      <Text className="font-bold text-slate-500 text-xs">
                        {req.purpose?.toLowerCase().includes("km") ? "KM" : "₹"}
                      </Text>
                    </div>
                  );
                }
              },
              {
                title: "Actions",
                key: "actions",
                align: "center" as const,
                render: (_, req) => {
                  const reqVal = req.amount;
                  const currentValue = editedLimits[req.id] !== undefined ? editedLimits[req.id] : reqVal;
                  return (
                    <Space size="small" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(req)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-[10.5px] font-bold bg-[#4A6A8A] hover:bg-[#3b5570] text-white transition-colors cursor-pointer"
                      >
                        <Eye size={11} /> Review
                      </button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<Check size={12} />}
                        style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                        onClick={() => handleApproveLimit(req.expense_id, currentValue)}
                        loading={actionLoading && processingLimitId === req.expense_id && processingLimitType === "approve"}
                        className="rounded-none"
                      />
                      <Button
                        type="primary"
                        danger
                        size="small"
                        icon={<X size={12} />}
                        onClick={() => handleRejectLimit(req.expense_id)}
                        loading={actionLoading && processingLimitId === req.expense_id && processingLimitType === "reject"}
                        className="rounded-none"
                      />
                    </Space>
                  );
                }
              }
            ]}
          />
        </div>
      )}

      {/* ================= CLAIMS AWAITING ACTIONS SECTION ================= */}
      <div className="border border-slate-300 rounded-none shadow-2xs mb-4 bg-white overflow-hidden">
        <div className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-amber-400 animate-pulse" />
            CLAIMS AWAITING ACTIONS ({claimRequests.length})
          </span>
        </div>
        {loading ? (
          <ApprovalSkeleton />
        ) : claimRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-bold">
            No pending claims awaiting review.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table
                dataSource={claimRequests}
                rowKey="expense_id"
                size="small"
                pagination={{ 
                  pageSize: approvalPageSize, 
                  showSizeChanger: true, 
                  pageSizeOptions: ["10", "25", "50", "100"],
                  onChange: (_, size) => setApprovalPageSize(size),
                  onShowSizeChange: (_, size) => setApprovalPageSize(size),
                  size: "small" 
                }}
                scroll={{ x: 800 }}
                rowSelection={isBulkAuthorized ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as number[]),
                } : undefined}
                onRow={(record) => ({
                  onClick: () => handleOpenDetails(record),
                  className: "cursor-pointer hover:bg-slate-100/70"
                })}
                columns={[
                  {
                    title: "Employee Details",
                    dataIndex: "employeeName",
                    key: "employeeName",
                    render: (name, req) => (
                      <div className="flex items-center gap-2">
                        <Avatar size="small" className="bg-[#4A6A8A] font-bold text-xs rounded-none shrink-0">
                          {name ? name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div>
                          <Text className="font-extrabold text-slate-900 block text-xs leading-tight">{name}</Text>
                          <Text className="text-[10px] text-[#4A6A8A] font-mono font-bold block">{req.eCode}</Text>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Claim ID",
                    dataIndex: "expense_code",
                    key: "expense_code",
                    render: (code) => (
                      <span className="font-mono font-extrabold text-xs text-[#4A6A8A] bg-slate-100 px-2 py-0.5 rounded-none border border-slate-200">
                        {code}
                      </span>
                    ),
                  },
                  {
                    title: "Category",
                    dataIndex: "category",
                    key: "category",
                    render: (cat) => (
                      <span className="font-bold text-[10px] uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-none border border-slate-300">
                        {cat}
                      </span>
                    ),
                  },
                  {
                    title: "Date / Month",
                    dataIndex: "date",
                    key: "date",
                    align: "center" as const,
                    render: (d) => <Text className="text-slate-700 font-semibold text-xs">{d}</Text>,
                  },
                  {
                    title: "Purpose",
                    dataIndex: "purpose",
                    key: "purpose",
                    ellipsis: true,
                    render: (p) => <Text className="text-slate-700 font-semibold text-xs">{p || "—"}</Text>,
                  },
                  {
                    title: "Attachments",
                    key: "attachments",
                    align: "center" as const,
                    render: (_, req) => {
                      const atts = getAttachmentsArray(req.attachments || req.attachment_urls || req.attachments_detailed);
                      if (atts.length === 0) {
                        return <span className="text-[10px] text-slate-400 font-semibold">— No file —</span>;
                      }
                      return (
                        <div className="flex items-center justify-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {atts.slice(0, 2).map((url, i) => {
                            const fullUrl = authService.getAbsoluteImageUrl(url);
                            const isPdf = url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes("pdf");
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightboxImage(fullUrl)}
                                className={`px-2 py-0.5 rounded-none text-[9px] font-bold border cursor-pointer transition-colors ${
                                  isPdf ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                }`}
                                title={`View ${isPdf ? 'PDF Document' : 'Attachment Image'}`}
                              >
                                {isPdf ? "📄 PDF" : "📷 JPG"}
                              </button>
                            );
                          })}
                          {atts.length > 2 && (
                            <span className="text-[9px] text-slate-600 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded-none border border-slate-200">
                              +{atts.length - 2}
                            </span>
                          )}
                        </div>
                      );
                    }
                  },
                  {
                    title: "Total Amount",
                    dataIndex: "amount",
                    key: "amount",
                    align: "right" as const,
                    render: (amt) => <Text className="font-mono font-black text-slate-900 text-xs">₹{(Number(amt) || 0).toLocaleString()}</Text>,
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    align: "center" as const,
                    render: (_, req) => {
                      if (req.is_auto_approved || req.auto_approved || req.status === "auto_approved") {
                        return <span className="font-bold border border-emerald-300 bg-emerald-100 text-emerald-800 text-[9.5px] uppercase px-2 py-0.5 rounded-none">⚡ Auto Approved</span>;
                      }
                      return <span className="font-bold border border-amber-300 bg-amber-100 text-amber-900 text-[9.5px] uppercase px-2 py-0.5 rounded-none">Pending</span>;
                    }
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    align: "center" as const,
                    render: (_, req) => (
                      <Space size="small" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-[10.5px] font-bold bg-[#4A6A8A] hover:bg-[#3b5570] text-white transition-colors cursor-pointer"
                        >
                          <Eye size={11} /> Review
                        </button>
                      </Space>
                    ),
                  }
                ]}
              />
            </div>

            {/* Mobile Responsive Card List View */}
            <div className={`block md:hidden space-y-3 ${selectedIds.length > 0 ? 'pb-24' : 'pb-6'}`}>
              {claimRequests.map((req) => {
                const isChecked = selectedIds.includes(req.expense_id);
                const isAutoApproved = req.is_auto_approved || req.auto_approved || req.status === "auto_approved";
                return (
                  <div
                    key={req.expense_id || req.id}
                    onClick={() => handleOpenDetails(req)}
                    className={`p-3 border rounded-none shadow-2xs transition-colors cursor-pointer ${
                      isChecked ? "border-[#4A6A8A] bg-slate-50" : "border-slate-300 bg-white"
                    }`}
                  >
                    {/* Top row: Avatar + Name + Status Tag */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isBulkAuthorized && (
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <Checkbox
                              checked={isChecked}
                              onChange={() => {
                                setSelectedIds(prev =>
                                  prev.includes(req.expense_id)
                                    ? prev.filter(id => id !== req.expense_id)
                                    : [...prev, req.expense_id]
                                );
                              }}
                            />
                          </div>
                        )}
                        <Avatar
                          size={28}
                          className="bg-[#4A6A8A] font-bold text-xs rounded-none shrink-0"
                        >
                          {req.employeeName ? req.employeeName.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 leading-tight truncate">{req.employeeName}</div>
                          <div className="font-mono font-bold text-[10px] text-[#4A6A8A]">{req.eCode}</div>
                        </div>
                      </div>
                      {isAutoApproved ? (
                        <span className="font-bold border border-emerald-300 bg-emerald-100 text-emerald-800 text-[9px] uppercase px-1.5 py-0.5 rounded-none shrink-0">⚡ Auto</span>
                      ) : (
                        <span className="font-bold border border-amber-300 bg-amber-100 text-amber-900 text-[9px] uppercase px-1.5 py-0.5 rounded-none shrink-0">Pending</span>
                      )}
                    </div>

                    {/* Detail row: Claim ID + Category + Amount + Review button */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <div className="text-[9px] text-slate-500 font-extrabold uppercase">Claim ID</div>
                          <div className="text-xs font-extrabold font-mono text-[#4A6A8A]">
                            {req.expense_code}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500 font-extrabold uppercase">Date</div>
                          <div className="text-xs font-semibold text-slate-800">{req.date}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500 font-extrabold uppercase">Category</div>
                          <span className="text-[9.5px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 border border-slate-200">{req.category}</span>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500 font-extrabold uppercase">Amount</div>
                          <div className="text-xs font-black font-mono text-slate-900">₹{(Number(req.amount) || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenDetails(req); }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-none text-xs font-bold bg-[#4A6A8A] hover:bg-[#3b5570] text-white transition-colors cursor-pointer shrink-0"
                      >
                        <Eye size={12} /> Review
                      </button>
                    </div>

                    {req.purpose && (
                      <div className="border-t border-slate-100 mt-2 pt-1.5">
                        <div className="text-[9px] text-slate-500 font-extrabold uppercase">Purpose</div>
                        <div className="text-xs font-semibold text-slate-700 truncate">{req.purpose}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </div>

      <ClaimDetailsModal
        sourceMode="approval"
        open={showDetailModal}
        claimDetails={expenseDetails || selectedApproval}
        user={currentUser}
        comments={comments}
        setComments={setComments}
        actionLoading={actionLoading}
        handleApprove={() => handleProcessAction("approve")}
        handleReject={() => handleProcessAction("reject")}
        handleReturn={() => {
          if (selectedApproval) {
            setReturnExpenseId(selectedApproval.expense_id || selectedApproval.id);
            setShowReturnModal(true);
          }
        }}
        handleDeleteClaim={() => {}}
        editedLegs={editedLegs}
        onLegAmountChange={handleLegAmountChange}
        onLegRemarkChange={handleLegRemarkChange}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedApproval(null);
          setExpenseDetails(null);
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

      {/* ================= BATCH ACTION CONFIRMATION MODAL ================= */}
      <Modal
        open={showBulkModal && !!bulkActionType}
        destroyOnClose={true}
        centered
        onCancel={() => {
          setShowBulkModal(false);
          setBulkActionType(null);
          setBulkComments("");
        }}
        width={480}
        closeIcon={false}
        styles={{ body: { padding: 0 } }}
        footer={null}
      >
        <div className="bg-white border border-slate-400 rounded-none shadow-2xl overflow-hidden text-left">
          {/* Header Banner */}
          <div className={`px-4 py-3 text-white flex items-center justify-between rounded-none ${
            bulkActionType === "reject" ? "bg-rose-700" : "bg-[#4A6A8A]"
          }`}>
            <span className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
              {bulkActionType === "reject" ? <X className="w-4 h-4 text-white" /> : <Check className="w-4 h-4 text-emerald-300" />}
              Confirm Bulk {bulkActionType === "approve" ? "Reimbursement Approval" : "Claims Rejection"}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowBulkModal(false);
                setBulkActionType(null);
                setBulkComments("");
              }}
              className="text-white/80 hover:text-white transition-colors cursor-pointer bg-transparent border-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            <div className="bg-slate-50 border border-slate-300 rounded-none p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">Selected Claims Count</span>
                <span className="font-mono font-extrabold text-xs text-[#4A6A8A] bg-white px-2 py-0.5 border border-slate-300">
                  {selectedIds.length} Claims
                </span>
              </div>
              {bulkActionType === "approve" && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">Accumulated Total Value</span>
                  <span className="font-mono font-black text-sm text-emerald-700">
                    ₹{(Number(getSelectedTotalAmount()) || 0).toLocaleString()}
                  </span>
                </div>
              )}
              <p className="text-[10.5px] text-slate-500 font-semibold italic mt-1 leading-tight border-t border-slate-200 pt-1.5">
                Note: Bulk actions will process all selected claims sequentially as-is without any visit amount modifications.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold text-slate-700 flex justify-between tracking-wider uppercase">
                <span>Review Comments / Remarks</span>
                <span className="text-[10px] text-slate-400">
                  {bulkActionType === "reject" ? "* (Mandatory)" : "(Optional)"}
                </span>
              </label>
              <Input.TextArea
                rows={3}
                placeholder={bulkActionType === "reject" ? "State rejection reasons (mandatory)..." : "Add approval notes..."}
                value={bulkComments}
                onChange={(e) => setBulkComments(e.target.value)}
                className="rounded-none border-slate-300 focus:border-[#4A6A8A] text-xs p-2"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkActionType(null);
                  setBulkComments("");
                }}
                disabled={bulkActionLoading}
                className="px-4 py-1.5 rounded-none text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Button
                type="primary"
                danger={bulkActionType === "reject"}
                style={bulkActionType === "approve" ? { backgroundColor: "#10b981", borderColor: "#10b981" } : undefined}
                onClick={handleBulkSubmit}
                loading={bulkActionLoading}
                className={`font-black text-xs uppercase tracking-wider rounded-none h-8 px-4 border-0 cursor-pointer shadow-2xs ${
                  bulkActionType === "reject" ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                Confirm Bulk {bulkActionType === "approve" ? "Approval" : "Rejection"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ================= RECEIPT IMAGE / DOCUMENT LIGHTBOX POPUP ================= */}
      {lightboxImage && createPortal(
        <div 
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          style={{ zIndex: 99999999 }}
          onClick={() => { setLightboxImage(null); setLbZoom(1); }}
        >
          <div 
            className="relative bg-white border border-slate-400 rounded-none p-3 flex flex-col items-center justify-center select-none pointer-events-auto shadow-2xl max-w-[92vw] max-h-[92vh] overflow-hidden" 
            style={{ width: "fit-content" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex flex-wrap justify-between items-center w-full gap-3 mb-2.5 pb-2 border-b border-slate-200">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider whitespace-nowrap">
                Attachment Preview
              </span>

              {/* Zoom Controls */}
              {!(lightboxImage?.toLowerCase().endsWith(".pdf") || lightboxImage?.toLowerCase().includes(".pdf?")) && (
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 border border-slate-300 rounded-none">
                  <button
                    type="button"
                    onClick={() => setLbZoom(z => Math.max(0.2, parseFloat((z - 0.25).toFixed(2))))}
                    className="w-6 h-6 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center rounded-none cursor-pointer border-0"
                    title="Zoom Out"
                  >−</button>
                  <span className="text-[11px] font-mono font-bold text-slate-700 px-1.5 min-w-[38px] text-center select-none">
                    {Math.round(lbZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setLbZoom(z => Math.min(5, parseFloat((z + 0.25).toFixed(2))))}
                    className="w-6 h-6 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center rounded-none cursor-pointer border-0"
                    title="Zoom In"
                  >+</button>
                  <button
                    type="button"
                    onClick={() => setLbZoom(1)}
                    className="px-2 h-6 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] uppercase flex items-center justify-center rounded-none cursor-pointer border-0"
                    title="Reset Zoom"
                  >Reset</button>
                </div>
              )}

              <div className="flex gap-1.5 items-center shrink-0">
                <a 
                  href={displayImageUrl || lightboxImage} 
                  target="_blank"
                  rel="noopener noreferrer"
                  download="attachment_image.png"
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none text-[11px] font-extrabold no-underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  ⬇ Download
                </a>
                <button
                  onClick={() => { setLightboxImage(null); setLbZoom(1); }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-none text-[11px] font-extrabold border-0 cursor-pointer transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Content area fitting image tightly with full scroll support */}
            <div className="overflow-auto max-h-[80vh] max-w-[88vw] p-2 flex items-start justify-center select-text">
              {isLoadingPdf ? (
                <div className="text-slate-700 flex flex-col items-center justify-center gap-3 p-12 bg-slate-50">
                  <Loader2 className="w-10 h-10 animate-spin text-[#4A6A8A]" />
                  <span className="text-xs font-bold tracking-wide">Loading PDF Document...</span>
                </div>
              ) : isConvertingHeic ? (
                <div className="text-slate-700 flex flex-col items-center justify-center gap-3 p-8 bg-slate-50 border border-slate-200">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4A6A8A]" />
                  <span className="text-xs font-bold tracking-wide">Converting Apple HEIC image...</span>
                </div>
              ) : (lightboxImage?.toLowerCase().endsWith(".pdf") || lightboxImage?.toLowerCase().includes(".pdf?")) ? (
                <div className="w-full flex flex-col items-center">
                  <iframe 
                    src={displayImageUrl || lightboxImage} 
                    title="Document Preview"
                    className="w-[80vw] max-w-4xl h-[70vh] border border-slate-300 rounded-none bg-white"
                  />
                </div>
              ) : imageLoadError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-300 max-w-md my-2 rounded-lg">
                  <span className="text-amber-500 text-3xl font-bold mb-2">⚠️</span>
                  <p className="text-sm font-bold text-slate-800 mb-1">Attachment Photo Unavailable</p>
                  <p className="text-xs text-slate-500 mb-4">No photo was uploaded during submission or the file is no longer available on server.</p>
                  {(displayImageUrl || lightboxImage) && (displayImageUrl || lightboxImage).startsWith("http") && (
                    <a
                      href={displayImageUrl || lightboxImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white rounded text-xs font-bold no-underline"
                    >
                      Try Open File in New Tab ↗
                    </a>
                  )}
                </div>
              ) : (
                <img 
                  src={displayImageUrl || lightboxImage} 
                  alt="" 
                  style={{ 
                    width: lbZoom > 1 ? `${Math.round(lbZoom * 100)}%` : "auto",
                    maxWidth: lbZoom === 1 ? "85vw" : "none",
                    maxHeight: lbZoom === 1 ? "75vh" : "none",
                    transition: "all 0.2s ease"
                  }}
                  className="object-contain border border-slate-200 shadow-2xs block"
                  onError={() => setImageLoadError(true)}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Return to Draft Modal */}
      <Modal
        open={showReturnModal}
        destroyOnClose={true}
        onCancel={() => setShowReturnModal(false)}
        width={450}
        zIndex={2000}
        title={
          <span className="font-bold text-sm uppercase text-orange-850 flex items-center gap-2">
            <RotateCcw size={16} className="text-orange-600" />
            Return Claim to Draft
          </span>
        }
        footer={[
          <Button key="cancel" onClick={() => setShowReturnModal(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}
            disabled={returnLoading || !returnComments.trim()}
            loading={returnLoading}
            onClick={handleReturnToDraft}
            className="font-bold text-xs"
          >
            Confirm Return
          </Button>
        ]}
      >
        <div className="space-y-3 pt-2">
          <Text className="text-xs text-slate-600 block">
            This will return the expense claim back to the engineer for corrections. They can edit and resubmit it, or delete it and create a new one.
          </Text>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason / Comments *</label>
            <Input.TextArea
              value={returnComments}
              onChange={(e) => setReturnComments(e.target.value)}
              placeholder="Please explain why this claim needs corrections..."
              rows={3}
            />
          </div>
        </div>
      </Modal>


      {/* Sticky Mobile Bulk Action Bar */}
      {isBulkAuthorized && selectedIds.length > 0 && (
        <div 
          className="md:hidden fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3 z-[998] flex items-center justify-between animate-fadeIn"
          style={{ animationDuration: '0.2s' }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Bulk Actions</span>
            <span className="text-xs font-bold text-indigo-700">{selectedIds.length} Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              size="middle"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={() => handleOpenBulkAction("approve")}
              icon={<Check size={14} />}
              className="font-bold text-xs"
            >
              Approve ({selectedIds.length})
            </Button>
            <Button
              type="primary"
              danger
              size="middle"
              onClick={() => handleOpenBulkAction("reject")}
              icon={<X size={14} />}
              className="font-bold text-xs"
            >
              Reject ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
