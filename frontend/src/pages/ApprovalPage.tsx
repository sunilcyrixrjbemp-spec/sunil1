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
  Loader2,
  RotateCcw,
  CheckCircle2,
  Zap,
  ShieldCheck,
  RefreshCw,
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
    if (trimmed.startsWith("[") || trimmed.startsWith('"[')) {
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

const rupee = (num: number | string) => {
  const val = Number(num) || 0;
  return "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export default function ApprovalPage() {
  const navigate = useNavigate();
  const [pendingApprovals, setPendingApprovals] = useState<any[]>(() => {
    const cached = localStorage.getItem("cache_pending_approvals");
    return cached ? JSON.parse(cached) : [];
  });
  const [approvalPageSize, setApprovalPageSize] = useState(25);
  const [filterEngineer, setFilterEngineer] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Success popup state
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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
    if (forceRefresh) setIsRefreshing(true);
    setSelectedIds([]);
    const cacheKey = "cache_pending_approvals";
    
    if (forceRefresh) {
      prefetchManager.invalidateApprovals(currentUser.user_id || "");
    }

    const cached = localStorage.getItem(cacheKey);
    if (cached && !forceRefresh) {
      setPendingApprovals(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await prefetchManager.getOrFetch("pending_approvals", () => approvalService.getPendingApprovals(), 30000);
      safeSetLocalStorage(cacheKey, JSON.stringify(data));
      setPendingApprovals(data);
      
      const currentUserStr = localStorage.getItem("user");
      if (currentUserStr) {
        const cUser = JSON.parse(currentUserStr);
        safeSetLocalStorage(`cache_approvals_count_${cUser.user_id}`, data.length.toString());
      }
    } catch (err: any) {
      console.error("Failed to load approvals", err);
      if (!cached) {
        toast.error("Failed to load pending approvals from database.");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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
        const dbBikeRate = expenseDetails?.rate_bike || 5.0;
        const dbCarRate = expenseDetails?.rate_car || 11.0;
        const mode = leg.mode || targetOriginal.mode || targetOriginal.travel_mode;
        const defaultRate = mode === "Car" ? dbCarRate : dbBikeRate;

        let rate = defaultRate;
        if (targetOriginal.travel_amount && targetOriginal.km && targetOriginal.km > 0) {
          const computed = targetOriginal.travel_amount / targetOriginal.km;
          if (computed > 0) rate = computed;
        } else if (targetOriginal.amount && targetOriginal.km && targetOriginal.km > 0) {
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
            const cUser = JSON.parse(currentUserStr);
            safeSetLocalStorage(`cache_approvals_count_${cUser.user_id}`, filtered.length.toString());
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
            const cUser = JSON.parse(currentUserStr);
            safeSetLocalStorage(`cache_approvals_count_${cUser.user_id}`, filtered.length.toString());
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

  const getSelectedTotalAmount = () => {
    return pendingApprovals
      .filter(item => selectedIds.includes(item.expense_id))
      .reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  return (
    <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900 font-sans antialiased text-ink-900">
      
      {/* Ambient Canvas Mesh & Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div
          className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-1"
          style={{
            background: "radial-gradient(circle, #4338CA 0%, rgba(67, 56, 202, 0) 70%)",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-2"
          style={{
            background: "radial-gradient(circle, #6366F1 0%, rgba(99, 102, 241, 0) 70%)",
            filter: "blur(130px)",
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 space-y-3 pb-12 pt-1 sm:pt-2">

        {/* ── 1. Zoho Approval Header Card ─────────────────────────────────── */}
        <div 
          className="bg-white border border-line rounded-xl p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5"
          style={{
            boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-ink-900 leading-tight">
                  Approval Center
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-accent-50 text-accent-700 border border-accent-200">
                  {claimRequests.length} Pending
                </span>
                {limitRequests.length > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                    {limitRequests.length} Limit Extensions
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 font-medium mt-0.5">
                Review, modify, approve, or return submitted expense claims and limit requests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Input
                size="middle"
                value={filterEngineer}
                onChange={(e) => setFilterEngineer(e.target.value)}
                placeholder="Search Employee, Code, District..."
                prefix={<Search size={14} className="text-ink-400 mr-1" />}
                className="rounded-lg text-xs border-line bg-surface-sunken hover:bg-white focus:bg-white transition-all"
                allowClear
              />
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={() => fetchPendingApprovals(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-surface-sunken text-ink-700 border border-line shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-accent-600" : "text-ink-500"} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── 2. Limit Extension Requests Section ──────────────────────────── */}
        {limitRequests.length > 0 && (
          <div 
            className="bg-white border border-cyan-200 rounded-xl overflow-hidden shadow-xs"
          >
            <div className="bg-gradient-to-r from-cyan-900 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
                Limit Extension Requests ({limitRequests.length})
              </span>
              <span className="text-[11px] font-bold text-cyan-100 bg-white/10 px-2 py-0.5 rounded-md">
                Requires Authorization
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table
                dataSource={limitRequests}
                rowKey="id"
                size="small"
                pagination={false}
                className="custom-zoho-table"
                columns={[
                  {
                    title: "Employee Details",
                    dataIndex: "employeeName",
                    key: "employeeName",
                    render: (name, req) => (
                      <div className="flex items-center gap-2.5 py-1">
                        <Avatar size={32} className="bg-cyan-600 font-bold text-xs rounded-lg shrink-0 text-white">
                          {name ? name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div>
                          <Text className="font-bold text-ink-900 block text-xs leading-tight">{name}</Text>
                          <Text className="text-[11px] text-accent-700 font-mono font-bold block">{req.eCode}</Text>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Limit Type",
                    dataIndex: "purpose",
                    key: "limit_type",
                    render: (p) => (
                      <span className="font-bold text-[10px] uppercase bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded-md border border-cyan-200">
                        {p?.toLowerCase().includes("km") ? "KM Limit" : "Auto Limit"}
                      </span>
                    ),
                  },
                  {
                    title: "Month",
                    dataIndex: "date",
                    key: "date",
                    align: "center" as const,
                    render: (d) => <span className="font-bold text-xs text-ink-700">{d}</span>
                  },
                  {
                    title: "Purpose",
                    dataIndex: "purpose",
                    key: "purpose",
                    render: (p) => <span className="text-xs font-medium text-ink-700">{p || "—"}</span>
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
                            className="w-24 font-bold text-xs rounded-lg border-line bg-surface-sunken focus:bg-white"
                          />
                          <Text className="font-bold text-ink-500 text-xs">
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye size={12} /> Review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveLimit(req.expense_id, currentValue)}
                            disabled={actionLoading && processingLimitId === req.expense_id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                            title="Approve Limit"
                          >
                            {actionLoading && processingLimitId === req.expense_id && processingLimitType === "approve" ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectLimit(req.expense_id)}
                            disabled={actionLoading && processingLimitId === req.expense_id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                            title="Reject Limit"
                          >
                            {actionLoading && processingLimitId === req.expense_id && processingLimitType === "reject" ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                          </button>
                        </Space>
                      );
                    }
                  }
                ]}
              />
            </div>
          </div>
        )}

        {/* ── 3. Main Claims Awaiting Review Section ───────────────────────── */}
        <div className="space-y-3">
          {/* Header Bar with Count and Bulk Action Toolbar */}
          <div className="bg-white border border-line rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-600 animate-pulse" />
              <span className="font-black text-sm tracking-tight text-ink-900 uppercase">
                Claims Awaiting Actions ({claimRequests.length})
              </span>
            </div>

            {/* Desktop Bulk Toolbar */}
            {isBulkAuthorized && claimRequests.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox
                  checked={selectedIds.length > 0 && selectedIds.length === claimRequests.length}
                  onChange={toggleSelectAll}
                  className="text-xs font-bold text-ink-700 select-none"
                >
                  Select All ({selectedIds.length})
                </Checkbox>
                
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("approve")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                    selectedIds.length === 0 ? "bg-emerald-200 text-white cursor-not-allowed opacity-60" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <Check size={13} />
                  <span>Bulk Approve ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("reject")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                    selectedIds.length === 0 ? "bg-rose-200 text-white cursor-not-allowed opacity-60" : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                >
                  <X size={13} />
                  <span>Bulk Reject ({selectedIds.length})</span>
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white border border-line rounded-xl p-4 sm:p-6 shadow-xs">
              <ApprovalSkeleton />
            </div>
          ) : claimRequests.length === 0 ? (
            <div className="bg-white border border-line rounded-xl py-16 text-center text-ink-400 space-y-2 shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
              <div className="text-sm font-bold text-ink-700">All caught up!</div>
              <div className="text-xs text-ink-400">No pending expense claims awaiting your review.</div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white border border-line rounded-xl overflow-hidden shadow-xs">
                <Table
                  dataSource={claimRequests}
                  rowKey="expense_id"
                  size="middle"
                  className="custom-zoho-table"
                  pagination={{ 
                    pageSize: approvalPageSize, 
                    showSizeChanger: true, 
                    pageSizeOptions: ["10", "25", "50", "100"],
                    onChange: (_, size) => setApprovalPageSize(size),
                    onShowSizeChange: (_, size) => setApprovalPageSize(size),
                    size: "small",
                    className: "px-4 py-2"
                  }}
                  scroll={{ x: 800 }}
                  rowSelection={isBulkAuthorized ? {
                    selectedRowKeys: selectedIds,
                    onChange: (keys) => setSelectedIds(keys as number[]),
                  } : undefined}
                  onRow={(record) => ({
                    onClick: () => handleOpenDetails(record),
                    className: "cursor-pointer hover:bg-slate-50/80 transition-colors"
                  })}
                  columns={[
                    {
                      title: "Employee Details",
                      dataIndex: "employeeName",
                      key: "employeeName",
                      render: (name, req) => (
                        <div className="flex items-center gap-2.5 py-1">
                          <Avatar size={34} className="bg-accent-100 text-accent-700 font-bold text-xs rounded-lg shrink-0 border border-accent-200">
                            {name ? name.charAt(0).toUpperCase() : "U"}
                          </Avatar>
                          <div className="min-w-0">
                            <Text className="font-extrabold text-ink-900 block text-xs leading-tight truncate">{name}</Text>
                            <Text className="text-[11px] text-accent-700 font-mono font-bold block">{req.eCode}</Text>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: "Claim ID",
                      dataIndex: "expense_code",
                      key: "expense_code",
                      render: (code) => (
                        <span className="font-mono font-bold text-[11px] text-accent-700 bg-surface-sunken px-2 py-1 rounded-md border border-line">
                          {code}
                        </span>
                      ),
                    },
                    {
                      title: "Category",
                      dataIndex: "category",
                      key: "category",
                      render: (cat) => (
                        <span className="font-bold text-[10px] uppercase bg-slate-100 text-ink-700 px-2 py-0.5 rounded-md border border-slate-200">
                          {cat}
                        </span>
                      ),
                    },
                    {
                      title: "Date / Month",
                      dataIndex: "date",
                      key: "date",
                      align: "center" as const,
                      render: (d) => <Text className="text-ink-700 font-semibold text-xs">{d}</Text>,
                    },
                    {
                      title: "Purpose",
                      dataIndex: "purpose",
                      key: "purpose",
                      ellipsis: true,
                      render: (p) => <Text className="text-ink-600 font-medium text-xs">{p || "—"}</Text>,
                    },
                    {
                      title: "Attachments",
                      key: "attachments",
                      align: "center" as const,
                      render: (_, req) => {
                        const atts = getAttachmentsArray(req.attachments || req.attachment_urls || req.attachments_detailed);
                        if (atts.length === 0) {
                          return <span className="text-[11px] text-ink-400 font-semibold">— No file —</span>;
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
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors ${
                                    isPdf ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" : "bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100"
                                  }`}
                                  title={`View ${isPdf ? 'PDF Document' : 'Attachment Image'}`}
                                >
                                  {isPdf ? "📄 PDF" : "📷 JPG"}
                                </button>
                              );
                            })}
                            {atts.length > 2 && (
                              <span className="text-[10px] text-ink-600 font-bold bg-surface-sunken px-1.5 py-0.5 rounded-md border border-line">
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
                      render: (amt) => <Text className="font-mono font-black text-ink-900 text-xs sm:text-sm">{rupee(amt)}</Text>,
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      align: "center" as const,
                      render: (_, req) => {
                        if (req.is_auto_approved || req.auto_approved || req.status === "auto_approved") {
                          return <span className="font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] uppercase px-2 py-0.5 rounded-full">⚡ Auto Approved</span>;
                        }
                        return <span className="font-bold border border-amber-200 bg-amber-50 text-amber-800 text-[10px] uppercase px-2 py-0.5 rounded-full">Pending</span>;
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
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye size={12} /> Review
                          </button>
                        </Space>
                      ),
                    }
                  ]}
                />
              </div>

              {/* Mobile Responsive Card List View (Directly on canvas, zero box-in-a-box) */}
              <div className={`block md:hidden space-y-2.5 ${selectedIds.length > 0 ? 'pb-24' : 'pb-6'}`}>
                {claimRequests.map((req) => {
                  const isChecked = selectedIds.includes(req.expense_id);
                  const isAutoApproved = req.is_auto_approved || req.auto_approved || req.status === "auto_approved";
                  return (
                    <div
                      key={req.expense_id || req.id}
                      onClick={() => handleOpenDetails(req)}
                      className={`p-3.5 border rounded-xl shadow-xs transition-all cursor-pointer ${
                        isChecked ? "border-accent-400 bg-accent-50/40" : "border-line bg-white hover:border-accent-300"
                      }`}
                    >
                      {/* Top row: Avatar + Name + Status Tag */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-line mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
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
                            size={32}
                            className="bg-accent-100 text-accent-700 font-bold text-xs rounded-lg shrink-0 border border-accent-200"
                          >
                            {req.employeeName ? req.employeeName.charAt(0).toUpperCase() : "U"}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-extrabold text-xs text-ink-900 leading-tight truncate">{req.employeeName}</div>
                            <div className="font-mono font-bold text-[10px] text-accent-700">{req.eCode}</div>
                          </div>
                        </div>
                        {isAutoApproved ? (
                          <span className="font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 text-[9.5px] uppercase px-2 py-0.5 rounded-full shrink-0">⚡ Auto</span>
                        ) : (
                          <span className="font-bold border border-amber-200 bg-amber-50 text-amber-800 text-[9.5px] uppercase px-2 py-0.5 rounded-full shrink-0">Pending</span>
                        )}
                      </div>

                      {/* Detail row: Claim ID + Category + Amount + Review button */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div>
                            <div className="text-[9px] text-ink-400 font-extrabold uppercase">Claim ID</div>
                            <div className="text-xs font-bold font-mono text-accent-700">
                              {req.expense_code}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-ink-400 font-extrabold uppercase">Date</div>
                            <div className="text-xs font-semibold text-ink-800">{req.date}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-ink-400 font-extrabold uppercase">Category</div>
                            <span className="text-[10px] font-bold uppercase bg-surface-sunken text-ink-700 px-1.5 py-0.5 rounded border border-line">{req.category}</span>
                          </div>
                          <div>
                            <div className="text-[9px] text-ink-400 font-extrabold uppercase">Amount</div>
                            <div className="text-xs font-black font-mono text-ink-900">{rupee(req.amount)}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenDetails(req); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          <Eye size={12} /> Review
                        </button>
                      </div>

                      {req.purpose && (
                        <div className="border-t border-line/60 mt-2.5 pt-2">
                          <div className="text-[9px] text-ink-400 font-extrabold uppercase">Purpose</div>
                          <div className="text-xs font-medium text-ink-600 truncate">{req.purpose}</div>
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

      {/* ================= CLAIM DETAILS POPUP MODAL ================= */}
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

      {/* ================= CLEAN ELEGANT SUCCESS RESULT MODAL ================= */}
      <Modal
        open={!!successModal?.visible}
        destroyOnClose={true}
        centered
        footer={null}
        closable={false}
        width={400}
        style={{ maxWidth: "92vw" }}
        onCancel={() => setSuccessModal(null)}
        bodyStyle={{ padding: 0 }}
      >
        {successModal && (
          <div className="bg-white border border-line rounded-2xl shadow-2xl overflow-hidden text-center p-6 space-y-4">
            
            {/* Celebration Icon Badge */}
            <div className="flex justify-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xs transition-transform transform hover:scale-105 ${
                successModal.actionType === "reject"
                  ? "bg-rose-50 border border-rose-200 text-rose-600"
                  : successModal.isAuto
                    ? "bg-amber-50 border border-amber-200 text-amber-600"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-600"
              }`}>
                {successModal.actionType === "reject" ? (
                  <X className="w-8 h-8" />
                ) : successModal.isAuto ? (
                  <Zap className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8" />
                )}
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="text-base font-black text-ink-900 tracking-tight">
                {successModal.isBulk
                  ? `Bulk Claims ${successModal.actionType === "approve" ? "Approved" : "Rejected"}!`
                  : successModal.actionType === "reject"
                    ? (successModal.isLimit ? "Limit Request Rejected" : "Expense Claim Rejected")
                    : successModal.isAuto
                      ? "Auto-Approved by Policy"
                      : (successModal.isLimit ? "Limit Request Approved!" : "Claim Approved Successfully!")}
              </h3>
              <p className="text-xs text-ink-500 font-medium leading-relaxed">
                {successModal.isBulk
                  ? `Processed ${successModal.bulkCount} claims sequentially.`
                  : successModal.actionType === "reject"
                    ? "Expense claim decision has been updated and logged."
                    : successModal.isAuto
                      ? "System policy auto-approval applied with zero deduction."
                      : "Reimbursement amount sanctioned and logged into the register."}
              </p>
            </div>

            {/* Detail Box */}
            {!successModal.isBulk && (
              <div className="bg-[#FAFAF9] border border-line rounded-xl p-3.5 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">Claim ID</span>
                  <span className="font-mono font-bold text-accent-700 bg-white px-2 py-0.5 rounded border border-line">
                    {successModal.claimCode}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">Employee</span>
                  <span className="font-extrabold text-ink-900">{successModal.empName}</span>
                </div>
                {!successModal.isAuto && (successModal.amount || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-line">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">Sanctioned Amount</span>
                    <span className={`font-mono font-black text-sm ${
                      successModal.actionType === "reject" ? "text-rose-700" : "text-emerald-700"
                    }`}>
                      {rupee(successModal.amount || 0)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Done Button */}
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-xs transition-colors cursor-pointer ${
                successModal.actionType === "reject"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-accent-600 hover:bg-accent-700"
              }`}
            >
              {successModal.isBulk ? "Continue" : "Done ✓"}
            </button>
          </div>
        )}
      </Modal>

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
        <div className="bg-white border border-line rounded-2xl shadow-xl overflow-hidden text-left">
          {/* Header Banner */}
          <div className={`px-4.5 py-3.5 text-white flex items-center justify-between ${
            bulkActionType === "reject" ? "bg-rose-600" : "bg-accent-700"
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
          <div className="p-4.5 space-y-4">
            <div className="bg-surface-sunken border border-line rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-600 font-extrabold uppercase text-[10px] tracking-wider">Selected Claims Count</span>
                <span className="font-mono font-extrabold text-xs text-accent-700 bg-white px-2 py-0.5 rounded border border-line">
                  {selectedIds.length} Claims
                </span>
              </div>
              {bulkActionType === "approve" && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-line">
                  <span className="text-ink-600 font-extrabold uppercase text-[10px] tracking-wider">Accumulated Total Value</span>
                  <span className="font-mono font-black text-sm text-emerald-700">
                    {rupee(getSelectedTotalAmount())}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-ink-500 font-medium italic mt-1 leading-tight border-t border-line pt-1.5">
                Note: Bulk actions will process all selected claims sequentially as-is without any visit amount modifications.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-ink-700 flex justify-between tracking-wider uppercase">
                <span>Review Comments / Remarks</span>
                <span className="text-[10px] text-ink-400">
                  {bulkActionType === "reject" ? "* (Mandatory)" : "(Optional)"}
                </span>
              </label>
              <Input.TextArea
                rows={3}
                placeholder={bulkActionType === "reject" ? "State rejection reasons (mandatory)..." : "Add approval notes..."}
                value={bulkComments}
                onChange={(e) => setBulkComments(e.target.value)}
                className="rounded-lg border-line focus:border-accent-400 text-xs p-2.5"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkActionType(null);
                  setBulkComments("");
                }}
                disabled={bulkActionLoading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-ink-700 border border-line hover:bg-surface-sunken transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={bulkActionLoading}
                className={`font-black text-xs uppercase tracking-wider rounded-lg h-9 px-4.5 border-0 cursor-pointer shadow-xs text-white transition-colors ${
                  bulkActionType === "reject" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {bulkActionLoading ? "Processing..." : `Confirm Bulk ${bulkActionType === "approve" ? "Approval" : "Rejection"}`}
              </button>
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
            className="relative bg-white border border-line rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center select-none pointer-events-auto shadow-2xl max-w-[92vw] max-h-[92vh] overflow-hidden" 
            style={{ width: "fit-content" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex flex-wrap justify-between items-center w-full gap-3 mb-2.5 pb-2 border-b border-line">
              <span className="text-xs font-extrabold text-ink-800 uppercase tracking-wider whitespace-nowrap">
                Attachment Preview
              </span>

              {/* Zoom Controls */}
              {!(lightboxImage?.toLowerCase().endsWith(".pdf") || lightboxImage?.toLowerCase().includes(".pdf?")) && (
                <div className="flex items-center gap-1 bg-surface-sunken p-0.5 border border-line rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLbZoom(z => Math.max(0.2, parseFloat((z - 0.25).toFixed(2))))}
                    className="w-6 h-6 bg-ink-700 hover:bg-ink-900 text-white font-bold text-xs flex items-center justify-center rounded cursor-pointer border-0"
                    title="Zoom Out"
                  >−</button>
                  <span className="text-[11px] font-mono font-bold text-ink-700 px-1.5 min-w-[38px] text-center select-none">
                    {Math.round(lbZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setLbZoom(z => Math.min(5, parseFloat((z + 0.25).toFixed(2))))}
                    className="w-6 h-6 bg-ink-700 hover:bg-ink-900 text-white font-bold text-xs flex items-center justify-center rounded cursor-pointer border-0"
                    title="Zoom In"
                  >+</button>
                  <button
                    type="button"
                    onClick={() => setLbZoom(1)}
                    className="px-2 h-6 bg-slate-200 hover:bg-slate-300 text-ink-800 font-bold text-[10px] uppercase flex items-center justify-center rounded cursor-pointer border-0"
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
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold no-underline flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  ⬇ Download
                </a>
                <button
                  onClick={() => { setLightboxImage(null); setLbZoom(1); }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold border-0 cursor-pointer transition-colors shadow-2xs"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Content area fitting image tightly with full scroll support */}
            <div className="overflow-auto max-h-[80vh] max-w-[88vw] p-2 flex items-start justify-center select-text">
              {isLoadingPdf ? (
                <div className="text-ink-700 flex flex-col items-center justify-center gap-3 p-12 bg-surface-sunken rounded-xl">
                  <Loader2 className="w-10 h-10 animate-spin text-accent-600" />
                  <span className="text-xs font-bold tracking-wide">Loading PDF Document...</span>
                </div>
              ) : isConvertingHeic ? (
                <div className="text-ink-700 flex flex-col items-center justify-center gap-3 p-8 bg-surface-sunken border border-line rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-accent-600" />
                  <span className="text-xs font-bold tracking-wide">Converting Apple HEIC image...</span>
                </div>
              ) : (lightboxImage?.toLowerCase().endsWith(".pdf") || lightboxImage?.toLowerCase().includes(".pdf?")) ? (
                <div className="w-full flex flex-col items-center">
                  <iframe 
                    src={displayImageUrl || lightboxImage} 
                    title="Document Preview"
                    className="w-[80vw] max-w-4xl h-[70vh] border border-line rounded-xl bg-white"
                  />
                </div>
              ) : imageLoadError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-sunken border border-line max-w-md my-2 rounded-xl">
                  <span className="text-amber-500 text-3xl font-bold mb-2">⚠️</span>
                  <p className="text-sm font-bold text-ink-900 mb-1">Attachment Photo Unavailable</p>
                  <p className="text-xs text-ink-500 mb-4">No photo was uploaded during submission or the file is no longer available on server.</p>
                  {(displayImageUrl || lightboxImage) && (displayImageUrl || lightboxImage).startsWith("http") && (
                    <a
                      href={displayImageUrl || lightboxImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-bold no-underline"
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
                  className="object-contain border border-line rounded-lg shadow-xs block"
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
        width={460}
        zIndex={2000}
        title={
          <span className="font-bold text-sm uppercase text-amber-900 flex items-center gap-2">
            <RotateCcw size={16} className="text-amber-600" />
            Return Claim to Draft
          </span>
        }
        footer={[
          <Button key="cancel" onClick={() => setShowReturnModal(false)} className="rounded-lg">
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}
            disabled={returnLoading || !returnComments.trim()}
            loading={returnLoading}
            onClick={handleReturnToDraft}
            className="font-bold text-xs rounded-lg"
          >
            Confirm Return
          </Button>
        ]}
      >
        <div className="space-y-3 pt-2">
          <Text className="text-xs text-ink-600 block leading-relaxed">
            This will return the expense claim back to the engineer for corrections. They can edit and resubmit it, or delete it and create a new one.
          </Text>
          <div>
            <label className="block text-[10px] font-bold text-ink-500 uppercase mb-1">Reason / Comments *</label>
            <Input.TextArea
              value={returnComments}
              onChange={(e) => setReturnComments(e.target.value)}
              placeholder="Please explain why this claim needs corrections..."
              rows={3}
              className="rounded-lg border-line text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Sticky Mobile Bulk Action Bar */}
      {isBulkAuthorized && selectedIds.length > 0 && (
        <div 
          className="md:hidden fixed bottom-14 left-3 right-3 bg-white/95 backdrop-blur-md border border-line rounded-2xl shadow-xl px-4 py-3 z-[998] flex items-center justify-between animate-fadeIn"
        >
          <div className="flex flex-col">
            <span className="text-[10px] text-ink-400 font-extrabold uppercase tracking-wider">Bulk Actions</span>
            <span className="text-xs font-bold text-accent-700">{selectedIds.length} Selected ({rupee(getSelectedTotalAmount())})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenBulkAction("approve")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Check size={14} /> Approve
            </button>
            <button
              type="button"
              onClick={() => handleOpenBulkAction("reject")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
