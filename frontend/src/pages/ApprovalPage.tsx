import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Modal, 
  Alert, 
  Space, 
  Input, 
  Typography, 
  Avatar, 
  Checkbox,
  Descriptions,
  Tooltip
} from "antd";
import {
  FileTextOutlined,
  UserOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  RedoOutlined,
  PaperClipOutlined,
  HistoryOutlined
} from "@ant-design/icons";
import { approvalService } from "../services/approvalService";
import { expenseService } from "../services/expenseService";
import Loader from "../components/common/Loader";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { 
  Check, 
  X, 
  Eye, 
  Search,
  FileText, 
  AlertTriangle,
  ExternalLink,
  Loader2,
  RotateCcw
} from "lucide-react";

import api from "../services/api";

const { Text, Title } = Typography;
const API_BASE = (api.defaults.baseURL || "").replace(/\/api$/, "");

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

const formatDateTime = (dateVal: any) => {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Just now";
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()} ${hours}:${minutes}:${seconds}`;
  } catch (_) {
    return "—";
  }
};

export default function ApprovalPage() {
  const [pendingApprovals, setPendingApprovals] = useState<any[]>(() => {
    const cached = localStorage.getItem("cache_pending_approvals");
    return cached ? JSON.parse(cached) : [];
  });
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
  const [loadingDetails, setLoadingDetails] = useState(false);
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
  } | null>(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userRoleLower = (currentUser.role || "").trim().toLowerCase();
  const isBulkAuthorized = ["coordinator", "project head"].includes(userRoleLower);
  const isCoordinator = ["coordinator", "admin", "project head"].includes(userRoleLower);

  // Edit single itineraries state
  const [editedLegs, setEditedLegs] = useState<any[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<string[]>([]);

  const renderAttachmentControls = (receiptUrl: string | null | undefined, previewLabel: string = "👁 Preview Receipt") => {
    if (!receiptUrl) return null;
    const isRemoved = removedAttachments.includes(receiptUrl);
    if (isRemoved) {
      return (
        <div className="flex items-center gap-1.5 mt-1 bg-red-50 border border-red-250 rounded px-1.5 py-0.5 w-max">
          <span className="text-[9px] text-red-600 font-extrabold uppercase tracking-wide">🗑 Removed</span>
          <button
            type="button"
            onClick={() => setRemovedAttachments(prev => prev.filter(url => url !== receiptUrl))}
            className="text-[9px] text-green-700 hover:text-green-800 hover:underline font-extrabold bg-transparent border-0 cursor-pointer p-0"
          >
            Undo
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 mt-1">
        <button 
          type="button" 
          onClick={() => setLightboxImage(receiptUrl)} 
          className="text-[9px] text-blue-600 hover:text-blue-800 hover:underline font-bold bg-transparent border-0 cursor-pointer p-0 text-left"
        >
          {previewLabel}
        </button>
        <button
          type="button"
          onClick={() => setRemovedAttachments(prev => [...prev, receiptUrl])}
          className="text-[9px] text-red-600 hover:text-red-750 hover:underline font-bold bg-transparent border-0 cursor-pointer p-0"
          title="Remove this attachment"
        >
          🗑 Remove
        </button>
      </div>
    );
  };

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

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    if (!lightboxImage) {
      setDisplayImageUrl(null);
      setIsConvertingHeic(false);
      return;
    }

    checkIsHeic(lightboxImage).then(isHeicImg => {
      if (!active) return;
      if (isHeicImg) {
        setIsConvertingHeic(true);
        convertHeicToJpegUrl(lightboxImage)
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
              setDisplayImageUrl(lightboxImage);
              setIsConvertingHeic(false);
            }
          });
      } else {
        setDisplayImageUrl(lightboxImage);
      }
    });

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [lightboxImage]);

  const [assetValueMaster, setAssetValueMaster] = useState<any[]>([]);
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
      fetchPendingApprovals();
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
      fetchPendingApprovals();
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

  const fetchPendingApprovals = async () => {
    setSelectedIds([]);
    const cacheKey = "cache_pending_approvals";
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setPendingApprovals(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await approvalService.getPendingApprovals();
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setPendingApprovals(data);
      
      // Also update dashboard badge cache
      const currentUserStr = localStorage.getItem("user");
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        localStorage.setItem(`cache_approvals_count_${currentUser.user_id}`, data.length.toString());
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

  const handleOpenDetails = async (app: any) => {
    setSelectedApproval(app);
    setShowDetailModal(true);
    setComments("");
    setActionType(null);
    setRemovedAttachments([]);

    const initLegs = (details: any) => {
      if (details.itineraries) {
        setEditedLegs(
          details.itineraries.map((leg: any) => ({
            leg: leg.leg,
            from_district: leg.from_district,
            to_district: leg.to_district,
            from: leg.from,
            to: leg.to,
            mode: leg.mode,
            km: leg.km,
            travel_amount: leg.amount || 0,
            sub_mode: leg.sub_mode,
            sub_amount: leg.sub_amount || 0,
            da: leg.da || 0,
            hotel_amount: leg.hotel || 0,
            local_purchase: leg.local_purchase || 0,
            oth_desc: leg.oth_desc,
            other_amount: leg.oth_amount || 0,
            visit_purpose: leg.visit_purpose,
            ws_assigned: leg.ws_assigned,
            ws_closed: leg.ws_closed,
            ws_pms: leg.ws_pms,
            ws_asset: leg.ws_asset,
            remarks: {}
          }))
        );
      }
    };

    // SWR: load from cache instantly, then refresh in background
    const cacheKey = `cache_claim_detail_${app.expense_id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      setExpenseDetails(cachedData);
      initLegs(cachedData);
      setLoadingDetails(false);
      // Background refresh (silent)
      expenseService.getExpenseDetails(app.expense_id)
        .then(data => {
          setExpenseDetails(data);
          initLegs(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        })
        .catch(() => {});
    } else {
      setLoadingDetails(true);
      try {
        const details = await expenseService.getExpenseDetails(app.expense_id);
        setExpenseDetails(details);
        initLegs(details);
        localStorage.setItem(cacheKey, JSON.stringify(details));
      } catch (err) {
        toast.error("Failed to load expense itinerary details.");
        setShowDetailModal(false);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const getLegAttachmentUrl = (legNum: number, billType: string) => {
    if (!expenseDetails?.attachments_detailed) return null;
    const found = expenseDetails.attachments_detailed.find((a: any) => {
      if (!a.itinerary_id) return false;
      const parts = a.itinerary_id.split("-");
      const aLegNum = parseInt(parts[parts.length - 1]);
      return aLegNum === legNum && a.bill_type === billType;
    });
    if (!found) return null;
    return found.file_url.startsWith("http") ? found.file_url : `${API_BASE}${found.file_url}`;
  };

  const handleLegAmountChange = (index: number, field: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setEditedLegs(prev => {
      const updated = [...prev];
      const leg = updated[index];
      if (field === "km") {
        const originalLeg = expenseDetails?.itineraries?.[index] || {};
        const dbBikeRate = expenseDetails?.rate_bike || 4.5;
        const dbCarRate = expenseDetails?.rate_car || 9.0;
        const fallbackRate = leg.mode === "Car" ? dbCarRate : dbBikeRate;
        const rate = (originalLeg.km && originalLeg.km > 0) ? ((originalLeg.amount || 0) / originalLeg.km) : fallbackRate;
        updated[index] = {
          ...leg,
          km: numericValue,
          travel_amount: parseFloat((numericValue * rate).toFixed(2))
        };
      } else {
        updated[index] = {
          ...leg,
          [field]: numericValue
        };
      }
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
      // Validate that every modified field has a corresponding remark
      if (selectedApproval.category !== "Limit Request") {
        for (let i = 0; i < editedLegs.length; i++) {
          const leg = editedLegs[i];
          const originalLeg = expenseDetails?.itineraries?.[i] || {};
          
          const checks = [
            { field: "distance_km", name: "Distance KM", current: leg.km, original: originalLeg.km || 0 },
            { field: "travel_amount", name: "Travel Amount", current: leg.travel_amount, original: originalLeg.amount || 0 },
            { field: "sub_amount", name: "Local Conveyance", current: leg.sub_amount, original: originalLeg.sub_amount || 0 },
            { field: "hotel_amount", name: "Hotel stay", current: leg.hotel_amount, original: originalLeg.hotel || 0 },
            { field: "local_purchase", name: "Local Purchase", current: leg.local_purchase, original: originalLeg.local_purchase || 0 },
            { field: "other_amount", name: "Other / Misc", current: leg.other_amount, original: originalLeg.oth_amount || 0 },
            { field: "da_amount", name: "DA Amount", current: leg.da, original: originalLeg.da || 0 }
          ];

          for (const check of checks) {
            // If Bike/Car is active, only require distance_km remark, skip travel_amount remark
            if (check.field === "travel_amount" && ["Bike", "Car"].includes(leg.mode)) {
              continue;
            }
            if (check.current !== check.original) {
              const rMark = leg.remarks?.[check.field] || "";
              if (!rMark.trim()) {
                toast.error(`Visit ${leg.leg}: Please enter a reason/remark for modifying ${check.name}.`);
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
        } else {
          await approvalService.rejectExpense(selectedApproval.expense_id, comments.trim() || "Limit extension rejected");
          toast.error("Limit request rejected.");
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
        }
      }

      setShowDetailModal(false);
      const processedId = selectedApproval.expense_id;
      setPendingApprovals(prev => {
        const filtered = prev.filter((a: any) => a.expense_id !== processedId);
        localStorage.setItem("cache_pending_approvals", JSON.stringify(filtered));
        const currentUserStr = localStorage.getItem("user");
        if (currentUserStr) {
          try {
            const currentUser = JSON.parse(currentUserStr);
            localStorage.setItem(`cache_approvals_count_${currentUser.user_id}`, filtered.length.toString());
          } catch(e) {}
        }
        return filtered;
      });
      setSelectedApproval(null);
      setExpenseDetails(null);
      setEditedLegs([]);
      setRemovedAttachments([]);
      await fetchPendingApprovals();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReturnModal = (expenseId: number) => {
    setReturnExpenseId(expenseId);
    setReturnComments("");
    setShowReturnModal(true);
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
        localStorage.setItem("cache_pending_approvals", JSON.stringify(filtered));
        const currentUserStr = localStorage.getItem("user");
        if (currentUserStr) {
          try {
            const currentUser = JSON.parse(currentUserStr);
            localStorage.setItem(`cache_approvals_count_${currentUser.user_id}`, filtered.length.toString());
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
      await fetchPendingApprovals();
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

    try {
      const res = await approvalService.bulkApproveExpenses(selectedIds, bulkActionType, bulkComments.trim());
      successCount = res.successCount || selectedIds.length;
      failCount = res.failCount || 0;
    } catch (err) {
      const results = await Promise.all(selectedIds.map(async (id) => {
        try {
          if (bulkActionType === "approve") {
            await approvalService.approveExpense(id, bulkComments.trim());
          } else {
            await approvalService.rejectExpense(id, bulkComments.trim());
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
    await fetchPendingApprovals();
  };

  const isEdited = () => {
    if (!expenseDetails || !expenseDetails.itineraries) return false;
    return editedLegs.some((leg, index) => {
      const original = expenseDetails.itineraries[index];
      if (!original) return false;
      return (
        leg.travel_amount !== (original.amount || 0) ||
        leg.sub_amount !== (original.sub_amount || 0) ||
        leg.hotel_amount !== (original.hotel || 0) ||
        leg.other_amount !== (original.oth_amount || 0) ||
        leg.local_purchase !== (original.local_purchase || 0)
      );
    });
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
        .ap-success-modal-content {
          animation: ap-modal-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .ap-check-ring {
          animation: ap-ring-pulse 0.5s ease-out 0.1s both, ap-ring-glow 1.4s ease-in-out 0.6s infinite;
        }
        .ap-auto-ring {
          animation: ap-ring-pulse 0.5s ease-out 0.1s both, ap-auto-ring-pulse 1.4s ease-in-out 0.6s infinite;
        }
        .ap-check-svg path {
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

      <Modal
        open={!!successModal?.visible}
        centered
        footer={null}
        closable={false}
        width={340}
        style={{ maxWidth: "92vw" }}
        onCancel={() => setSuccessModal(null)}
        styles={{ body: { padding: 0, borderRadius: 16, overflow: "hidden" } }}
      >
        {successModal && (
          <div className="ap-success-modal-content" style={{ borderRadius: 16, overflow: "hidden", background: "#fff", textAlign: "center" }}>
            {/* Gradient header */}
            <div style={{
              background: successModal.isAuto
                ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              padding: "32px 24px 24px",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Confetti particles */}
              {[
                { color: "#fde68a", left: "12%", delay: "0.4s" },
                { color: "#a5f3fc", left: "28%", delay: "0.5s" },
                { color: "#fca5a5", left: "44%", delay: "0.3s" },
                { color: "#bbf7d0", left: "60%", delay: "0.6s" },
                { color: "#ddd6fe", left: "76%", delay: "0.45s" },
                { color: "#fde68a", left: "88%", delay: "0.35s" },
                { color: "#a5f3fc", left: "20%", delay: "0.7s" },
                { color: "#fca5a5", left: "70%", delay: "0.55s" },
              ].map((p, i) => (
                <div key={i} className="ap-particle" style={{
                  background: p.color,
                  left: p.left,
                  bottom: "10px",
                  animationDelay: p.delay,
                  animationDuration: `${1.1 + i * 0.1}s`
                }} />
              ))}

              {/* Animated icon ring */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <div
                  className={successModal.isAuto ? "ap-auto-ring" : "ap-check-ring"}
                  style={{
                    width: 80, height: 80,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    border: "3px solid rgba(255,255,255,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(4px)"
                  }}
                >
                  {successModal.isAuto ? (
                    <span style={{ fontSize: 38, lineHeight: 1 }}>⚡</span>
                  ) : successModal.isBulk ? (
                    <span style={{ fontSize: 38, lineHeight: 1 }}>
                      {successModal.actionType === "approve" ? "✅" : "❌"}
                    </span>
                  ) : (
                    <svg className="ap-check-svg" width="44" height="44" viewBox="0 0 52 52" fill="none">
                      <path
                        d="M14 27 L23 36 L38 18"
                        stroke="white"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Title */}
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "0.01em", lineHeight: 1.3 }}>
                {successModal.isBulk
                  ? `Bulk ${successModal.actionType === "approve" ? "Approval" : "Rejection"} Done!`
                  : successModal.isAuto
                    ? "Auto-Approved! ⚡"
                    : "Claim Approved! 🎉"}
              </div>
              {!successModal.isBulk && (
                <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                  {successModal.isAuto ? "System policy auto-approval applied" : "Reimbursement has been sanctioned"}
                </div>
              )}
            </div>

            {/* Body details */}
            <div style={{ padding: "20px 24px" }}>
              {successModal.isBulk ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                    Successfully processed <span style={{ fontSize: 22, fontWeight: 900, color: "#059669" }}>{successModal.bulkCount}</span> claim{(successModal.bulkCount || 0) > 1 ? "s" : ""}
                  </div>
                </div>
              ) : (
                <div style={{ background: successModal.isAuto ? "#eef2ff" : "#f0fdf4", border: `1px solid ${successModal.isAuto ? "#c7d2fe" : "#bbf7d0"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, textAlign: "left" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>Claim ID</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: successModal.isAuto ? "#4f46e5" : "#059669" }}>
                        {successModal.claimCode}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>Employee</span>
                      <span style={{ fontWeight: 700, color: "#111827" }}>{successModal.empName}</span>
                    </div>
                    {!successModal.isAuto && (successModal.amount || 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280", fontWeight: 600 }}>Amount</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#059669", fontSize: 14 }}>
                          ₹{(successModal.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {successModal.isAuto && (
                      <div style={{ fontSize: 11, color: "#4338ca", fontWeight: 600, marginTop: 2 }}>
                        ℹ️ Zero reimbursable amount — auto-approved by policy
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="primary"
                block
                size="large"
                onClick={() => setSuccessModal(null)}
                style={{
                  background: successModal.isAuto
                    ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                    : "linear-gradient(135deg, #059669, #10b981)",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 14,
                  height: 46,
                  boxShadow: successModal.isAuto
                    ? "0 4px 14px rgba(79,70,229,0.35)"
                    : "0 4px 14px rgba(16,185,129,0.35)"
                }}
              >
                {successModal.isBulk ? "Close" : "Done ✓"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-4 animate-fadeIn text-[#212529]">
      
      {/* Header Info Card */}
      <Card size="small" className="border border-gray-200 shadow-xs mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-indigo-650 font-extrabold text-[9px] uppercase tracking-widest block">Operational Review</span>
            <Title level={4} style={{ margin: 0, fontSize: "18px", color: "#1F2937" }} className="uppercase font-bold tracking-wider flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              Approval Center
            </Title>
            <Text type="secondary" className="text-xs">Review operational, local purchase, and travel claims submitted by staff.</Text>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tag color="processing" className="font-bold border-0 bg-indigo-50 text-indigo-700 px-3 py-1 text-xs">
              Pending Claims: <strong>{claimRequests.length}</strong>
            </Tag>
            {limitRequests.length > 0 && (
              <Tag color="cyan" className="font-bold border-0 bg-cyan-50 text-cyan-700 px-3 py-1 text-xs">
                Limit Extensions: <strong>{limitRequests.length}</strong>
              </Tag>
            )}
            {!isBulkAuthorized && (
              <Tag color="warning" className="font-bold border-0 bg-amber-50 text-amber-800 px-3 py-1 text-xs">
                Role: {currentUser.role || "Staff"} (Individual Approvals Only)
              </Tag>
            )}
          </div>
        </div>
      </Card>

      {/* Filters — hidden on mobile, desktop-only search bar */}
      <div className="hidden sm:block mb-4">
        <Card size="small" className="border border-gray-200 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div style={{ flex: 1, maxWidth: 400 }}>
              <Input
                size="large"
                value={filterEngineer}
                onChange={(e) => setFilterEngineer(e.target.value)}
                placeholder="🔍  Search by Name or District..."
                prefix={<Search size={14} className="text-gray-400" />}
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
              />
            </div>
            {filterEngineer && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {filteredApprovals.length} result{filteredApprovals.length !== 1 ? "s" : ""} found
              </Typography.Text>
            )}
            {/* Bulk Toolbar — Only for authorized roles */}
            {isBulkAuthorized && claimRequests.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox
                  checked={selectedIds.length > 0 && selectedIds.length === claimRequests.length}
                  onChange={toggleSelectAll}
                  className="text-xs font-bold text-gray-700"
                >
                  Select All ({selectedIds.length})
                </Checkbox>
                <Button
                  type="primary"
                  size="middle"
                  style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("approve")}
                  icon={<Check size={14} />}
                  className="font-bold text-xs"
                >
                  Bulk Approve ({selectedIds.length})
                </Button>
                <Button
                  type="primary"
                  danger
                  size="middle"
                  disabled={selectedIds.length === 0}
                  onClick={() => handleOpenBulkAction("reject")}
                  icon={<X size={14} />}
                  className="font-bold text-xs"
                >
                  Bulk Reject ({selectedIds.length})
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ================= LIMIT EXTENSION REQUESTS SECTION ================= */}
      {limitRequests.length > 0 && (
        <Card size="small" className="border border-gray-200 shadow-xs mb-4" title={
          <span className="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            Limit Extension Requests ({limitRequests.length})
          </span>
        }>
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
                    <Avatar size="small" className="bg-blue-600 font-bold text-xs">
                      {name ? name.charAt(0).toUpperCase() : "U"}
                    </Avatar>
                    <div>
                      <Text className="font-bold text-gray-800 block text-xs leading-tight">{name}</Text>
                      <Text className="text-[9px] text-blue-600 font-mono font-bold block">{req.eCode}</Text>
                    </div>
                  </div>
                ),
              },
              {
                title: "Limit Type",
                dataIndex: "purpose",
                key: "limit_type",
                render: (p) => (
                  <Tag color={p?.toLowerCase().includes("km") ? "cyan" : "gold"} className="font-bold text-[10px]">
                    {p?.toLowerCase().includes("km") ? "KM Limit" : "Auto Limit"}
                  </Tag>
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
                        className="w-24 font-bold text-xs"
                      />
                      <Text className="font-bold text-gray-500 text-xs">
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
                      <Button
                        type="default"
                        size="small"
                        icon={<Eye size={12} />}
                        onClick={() => handleOpenDetails(req)}
                        className="text-[10px] font-bold"
                      >
                        Review
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<Check size={12} />}
                        style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                        onClick={() => handleApproveLimit(req.expense_id, currentValue)}
                        loading={actionLoading && processingLimitId === req.expense_id && processingLimitType === "approve"}
                      />
                      <Button
                        type="primary"
                        danger
                        size="small"
                        icon={<X size={12} />}
                        onClick={() => handleRejectLimit(req.expense_id)}
                        loading={actionLoading && processingLimitId === req.expense_id && processingLimitType === "reject"}
                      />
                    </Space>
                  );
                }
              }
            ]}
          />
        </Card>
      )}

      {/* ================= CLAIMS AWAITING ACTIONS SECTION ================= */}
      <Card size="small" className="border border-gray-200 shadow-xs mb-4" title={
        <span className="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          Claims Awaiting Actions ({claimRequests.length})
        </span>
      }>
        {loading ? (
          <Loader message="Loading pending reviews..." />
        ) : claimRequests.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs font-bold">
            No pending claims awaiting review.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table
                dataSource={claimRequests}
                rowKey="expense_id"
                size="small"
                pagination={{ pageSize: 25, size: "small" }}
                scroll={{ x: 800 }}
                rowSelection={isBulkAuthorized ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as number[]),
                } : undefined}
                onRow={(record) => ({
                  onClick: () => handleOpenDetails(record),
                  className: "cursor-pointer hover:bg-indigo-50/15"
                })}
                columns={[
                  {
                    title: "Employee Details",
                    dataIndex: "employeeName",
                    key: "employeeName",
                    render: (name, req) => (
                      <div className="flex items-center gap-2">
                        <Avatar size="small" className="bg-indigo-600 font-bold text-xs">
                          {name ? name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div>
                          <Text className="font-bold text-gray-800 block text-xs leading-tight">{name}</Text>
                          <Text className="text-[9px] text-indigo-600 font-mono font-bold block">{req.eCode}</Text>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Claim ID",
                    dataIndex: "expense_code",
                    key: "expense_code",
                    render: (code) => <Text className="font-mono font-bold text-indigo-600 text-xs">{code}</Text>,
                  },
                  {
                    title: "Category",
                    dataIndex: "category",
                    key: "category",
                    render: (cat) => <Tag color="blue" className="font-bold text-[10px]">{cat}</Tag>,
                  },
                  {
                    title: "Date / Month",
                    dataIndex: "date",
                    key: "date",
                    align: "center" as const,
                    render: (d) => <Text className="text-gray-600 font-semibold text-xs">{d}</Text>,
                  },
                  {
                    title: "Purpose",
                    dataIndex: "purpose",
                    key: "purpose",
                    ellipsis: true,
                    render: (p) => <Text className="text-gray-700 font-semibold text-xs">{p || "—"}</Text>,
                  },
                  {
                    title: "Total Amount",
                    dataIndex: "amount",
                    key: "amount",
                    align: "right" as const,
                    render: (amt) => <Text className="font-mono font-bold text-gray-900 text-xs">₹{(Number(amt) || 0).toLocaleString()}</Text>,
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    align: "center" as const,
                    render: (_, req) => {
                      if (req.is_auto_approved || req.auto_approved || req.status === "auto_approved") {
                        return <Tag color="success" className="font-bold border-0 bg-emerald-100 text-emerald-800 text-[9px]">⚡ Auto Approved</Tag>;
                      }
                      return <Tag color="warning" className="font-bold border-0 bg-amber-50 text-amber-700 text-[9px]">Pending</Tag>;
                    }
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    align: "center" as const,
                    render: (_, req) => (
                      <Space size="small" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="default"
                          size="small"
                          icon={<Eye size={12} />}
                          onClick={() => handleOpenDetails(req)}
                          className="text-[10px] font-bold"
                        >
                          Review
                        </Button>
                      </Space>
                    ),
                  }
                ]}
              />
            </div>

            {/* Mobile Responsive Card List View — antd Card based, one card per claim */}
            <div className="block md:hidden space-y-3 pb-6">
              {claimRequests.map((req) => {
                const isChecked = selectedIds.includes(req.expense_id);
                const isAutoApproved = req.is_auto_approved || req.auto_approved || req.status === "auto_approved";
                return (
                  <Card
                    key={req.expense_id || req.id}
                    size="small"
                    onClick={() => handleOpenDetails(req)}
                    style={{
                      border: isChecked ? "1.5px solid #6366f1" : "1px solid #e5e7eb",
                      background: isChecked ? "#f5f3ff" : "#ffffff",
                      borderRadius: 12,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      cursor: "pointer"
                    }}
                    bodyStyle={{ padding: "12px 14px" }}
                  >
                    {/* Top row: Avatar + Name + Status Tag */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isBulkAuthorized && (
                          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
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
                          style={{ backgroundColor: "#4f46e5", fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                        >
                          {req.employeeName ? req.employeeName.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div className="min-w-0">
                          <div style={{ fontWeight: 700, fontSize: 12, color: "#1f2937", lineHeight: 1.3 }} className="truncate">{req.employeeName}</div>
                          <div style={{ fontWeight: 700, fontSize: 10, color: "#4f46e5", fontFamily: "monospace" }}>{req.eCode}</div>
                        </div>
                      </div>
                      {isAutoApproved ? (
                        <Tag color="success" style={{ margin: 0, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>⚡ Auto</Tag>
                      ) : (
                        <Tag color="warning" style={{ margin: 0, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Pending</Tag>
                      )}
                    </div>

                    {/* Detail row: Claim ID + Category + Amount + Review button */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Claim ID</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>{req.expense_code}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Date</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{req.date}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Category</div>
                          <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>{req.category}</Tag>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Amount</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", fontFamily: "monospace" }}>₹{(Number(req.amount) || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      <Button
                        type="default"
                        size="middle"
                        icon={<Eye size={14} />}
                        onClick={(e) => { e.stopPropagation(); handleOpenDetails(req); }}
                        style={{ fontWeight: 700, fontSize: 11, flexShrink: 0 }}
                      >
                        Review
                      </Button>
                    </div>

                    {req.purpose && (
                      <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 8, paddingTop: 6 }}>
                        <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.purpose}</div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </Card>
      </div>

      {/* ================= DETAIL SINGLE REVIEW AND EDIT MODAL ================= */}
      <Modal
        open={showDetailModal && !!selectedApproval}
        onCancel={() => { setShowDetailModal(false); setSelectedApproval(null); }}
        width={950}
        style={{ maxWidth: "96vw", top: 16 }}
        className="approval-review-modal"
        wrapClassName="approval-review-modal-wrap"
        destroyOnClose
        bodyStyle={{
          maxHeight: "70vh",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px",
          background: "#ffffff",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          touchAction: "pan-y"
        }}
        title={
          <Space>
            <FileTextOutlined style={{ color: "#4f46e5", fontSize: 16 }} />
            <span style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Reviewing Claim: {selectedApproval?.expense_code}
            </span>
          </Space>
        }
        footer={
          <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", flexWrap: "nowrap", overflowX: "auto" }}>
            <Button
              onClick={() => { setShowDetailModal(false); setSelectedApproval(null); }}
              disabled={actionLoading}
              icon={<CloseOutlined />}
              size="small"
              style={{ fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Close
            </Button>
            <div style={{ flex: 1 }} />
            <Button
              danger
              type="primary"
              onClick={() => handleProcessAction("reject")}
              disabled={actionLoading || loadingDetails}
              loading={actionLoading && _actionType === "reject"}
              icon={<CloseCircleOutlined />}
              size="small"
              style={{ fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Reject
            </Button>
            {isCoordinator && selectedApproval && selectedApproval.category !== "Limit Request" && (
              <Button
                onClick={() => handleOpenReturnModal(selectedApproval.expense_id)}
                disabled={actionLoading || loadingDetails}
                icon={<RedoOutlined />}
                size="small"
                style={{ backgroundColor: "#fa8c16", borderColor: "#fa8c16", color: "#fff", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Return
              </Button>
            )}
            <Button
              type="primary"
              onClick={() => handleProcessAction("approve")}
              disabled={actionLoading || loadingDetails}
              loading={actionLoading && _actionType === "approve"}
              icon={<CheckOutlined />}
              size="small"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Approve
            </Button>
          </div>
        }
      >
        {loadingDetails ? (
          <Loader message="Retrieving itineraries & receipts..." />
        ) : expenseDetails ? (
          <div className="space-y-4">

            {/* ── SUBMITTER DETAILS SECTION ── */}
            <Card
              size="small"
              style={{ borderColor: "#e5e7eb", borderRadius: 8, background: "#fafafa" }}
              bodyStyle={{ padding: "12px 14px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Space>
                  <UserOutlined style={{ color: "#4f46e5" }} />
                  <Typography.Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#374151" }}>
                    Submitter Details & Information
                  </Typography.Text>
                </Space>
                <Tag color="processing" style={{ fontWeight: 700, fontSize: 10, fontFamily: "monospace" }}>
                  {selectedApproval?.expense_code}
                </Tag>
              </div>
              <Descriptions
                column={1}
                size="small"
                labelStyle={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", width: 140 }}
                contentStyle={{ fontWeight: 700, fontSize: 12, color: "#111827" }}
              >
                <Descriptions.Item label={<Space size={4}><UserOutlined />Employee Name</Space>}>
                  {expenseDetails?.submitter_name || selectedApproval?.employeeName || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Employee ID">
                  <Typography.Text code style={{ fontSize: 12, color: "#2563eb" }}>
                    {expenseDetails?.submitter_code || selectedApproval?.eCode || "—"}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Claim Month / Date">
                  {selectedApproval?.date || expenseDetails?.date || "—"}
                </Descriptions.Item>
                {(expenseDetails?.purpose || selectedApproval?.purpose) && (
                  <Descriptions.Item label="Purpose / Description">
                    {expenseDetails?.purpose || selectedApproval?.purpose}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* ── AUTO-APPROVED BANNER ── */}
            {(expenseDetails.is_auto_approved || expenseDetails.auto_approved || expenseDetails.status === "auto_approved" || selectedApproval?.is_auto_approved) && (
              <Alert
                message={<span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚡ Claim Auto-Approved by Policy</span>}
                description="This claim satisfies automatic approval parameters (e.g. 0 reimbursable total or corporate auto-pass rules)."
                type="success"
                showIcon
                style={{ borderRadius: 8 }}
              />
            )}

                  {/* EDITABLE ITINERARY LEGS */}
                  {selectedApproval?.category !== "Limit Request" && (
                    <div className="space-y-3">
                    {/* Facility Visits Card Header with antd Card + Tooltip */}
                    <Card
                      size="small"
                      style={{ borderColor: "#e5e7eb", borderRadius: 8 }}
                      bodyStyle={{ padding: 0 }}
                      title={
                        <Space>
                          <EnvironmentOutlined style={{ color: "#ef4444" }} />
                          <Typography.Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Facility Visits & Claimed Amounts
                          </Typography.Text>
                          <Tooltip title="Adjust TA, Hotel and Local Purchase amounts below if needed.">
                            <InfoCircleOutlined style={{ color: "#6366f1", cursor: "help", fontSize: 13 }} />
                          </Tooltip>
                        </Space>
                      }
                    >

                    <div className="space-y-4">
                      {editedLegs.map((leg, index) => {
                        const originalLeg = expenseDetails.itineraries[index] || {};
                        const travelModified = leg.travel_amount !== (originalLeg.amount || 0);
                        const subModified = leg.sub_amount !== (originalLeg.sub_amount || 0);
                        const hotelModified = leg.hotel_amount !== (originalLeg.hotel || 0);
                        const lpModified = leg.local_purchase !== (originalLeg.local_purchase || 0);
                        const otherModified = leg.other_amount !== (originalLeg.oth_amount || 0);

                        const travelReceiptUrl = getLegAttachmentUrl(leg.leg, leg.mode);
                        const subReceiptUrl = leg.sub_mode ? getLegAttachmentUrl(leg.leg, leg.sub_mode) : null;
                        const hotelReceiptUrl = getLegAttachmentUrl(leg.leg, "Hotel");
                        const mailReceiptUrl = getLegAttachmentUrl(leg.leg, "Communication_Mail");
                        const lpReceiptUrl = getLegAttachmentUrl(leg.leg, "Local_Purchase");
                        const otherReceiptUrl = getLegAttachmentUrl(leg.leg, "Other");

                        let actDetails: any = null;
                        try {
                          if (originalLeg.activity_details) {
                            actDetails = typeof originalLeg.activity_details === "string" ? JSON.parse(originalLeg.activity_details) : originalLeg.activity_details;
                          }
                        } catch (e) {
                          console.error("Error parsing activity details", e);
                        }

                        const callsList = actDetails?.calls_list || [];
                        const pmsList = actDetails?.pms_list || [];
                        const assetsList = actDetails?.assets_list || [];
                        const selectedActs = actDetails?.selected_activities || originalLeg.selected_activities || [];
                        const mobiliseCount = parseInt(actDetails?.mobilise_asset_count || originalLeg.mobilise_asset_count || "0") || 0;
                        const calibrationCount = parseInt(actDetails?.calibration_count || originalLeg.calibration_count || "0") || 0;
                        const activityOtherDesc = actDetails?.activity_other_desc || originalLeg.activity_other_desc || "";

                        const hasActivities = selectedActs.length > 0 || callsList.length > 0 || pmsList.length > 0 || assetsList.length > 0;
                        
                        return (
                          <div key={index} className="border border-gray-250 bg-white rounded shadow-sm overflow-hidden text-xs">
                    {/* Facility Visit Item header row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                              <Space size={4}>
                                <EnvironmentOutlined style={{ color: "#ef4444", fontSize: 13 }} />
                                <Typography.Text strong style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#374151" }}>
                                  Facility Visit {leg.leg}
                                </Typography.Text>
                              </Space>
                              <Space size={4}>
                                <Tag color="blue" style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", margin: 0 }}>{leg.mode} ({leg.km} KM)</Tag>
                                {leg.sub_mode && (
                                  <Tag color="purple" style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", margin: 0 }}>Local: {leg.sub_mode}</Tag>
                                )}
                              </Space>
                            </div>
                            <div className="bg-slate-50 border-b border-gray-200 p-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="bg-white p-2.5 border border-gray-200 rounded-lg flex flex-col justify-between">
                                  <div>
                                    <span className="text-[8px] text-gray-400 font-extrabold uppercase block tracking-wider mb-1">From Location (District)</span>
                                    <p className="font-extrabold text-gray-800 text-xs leading-normal">{leg.from_district || "—"}</p>
                                  </div>
                                  <div className="mt-1.5 pt-1.5 border-t border-gray-50">
                                    <span className="text-[7px] text-gray-400 font-extrabold uppercase block tracking-wider">Facility / Area name</span>
                                    <p className="text-gray-600 font-bold text-[10px] leading-normal">{leg.from || "—"}</p>
                                  </div>
                                </div>
                                <div className="bg-white p-2.5 border border-gray-200 rounded-lg flex flex-col justify-between">
                                  <div>
                                    <span className="text-[8px] text-gray-400 font-extrabold uppercase block tracking-wider mb-1">To Location (District)</span>
                                    <p className="font-extrabold text-gray-800 text-xs leading-normal">{leg.to_district || "—"}</p>
                                  </div>
                                  <div className="mt-1.5 pt-1.5 border-t border-gray-50">
                                    <span className="text-[7px] text-gray-400 font-extrabold uppercase block tracking-wider">Facility / Area name</span>
                                    <p className="text-gray-600 font-bold text-[10px] leading-normal">{leg.to || "—"}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Leg inputs and details */}
                            <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
                              <div className="lg:col-span-4 grid grid-cols-2 gap-3 bg-gray-50 p-3 border border-gray-200 rounded">
                                <div>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Visit Purpose</span>
                                  <span className="font-semibold text-gray-700 leading-tight">{leg.visit_purpose || originalLeg.visit_purpose || "Field visit"}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">DA Allowance</span>
                                  <div className="relative mt-1">
                                      <span className="absolute left-2 top-0.5 text-gray-400 font-bold text-xs">₹</span>
                                      <input
                                        type="number"
                                        value={leg.da}
                                        onChange={(e) => handleLegAmountChange(index, "da", e.target.value)}
                                        className="input-lte pl-5 pr-1 py-0.5 text-xs font-bold w-20 h-6 border-amber-300 bg-amber-50/10"
                                      />
                                    </div>
                                </div>
                                <div className="col-span-2 border-t border-gray-200 pt-2 grid grid-cols-4 gap-1 text-center font-bold">
                                  <div>
                                    <span className="text-[8px] text-gray-500 uppercase block" title="Calls Assigned">Calls</span>
                                    <span className="text-gray-800">{leg.ws_assigned || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-gray-500 uppercase block" title="Calls Completed">Done</span>
                                    <span className="text-green-600">{leg.ws_closed || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-gray-500 uppercase block" title="PMS Count">PMS</span>
                                    <span className="text-gray-850">{leg.ws_pms || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-gray-500 uppercase block" title="Asset Tagging">Asset</span>
                                    <span className="text-gray-800">{leg.ws_asset || 0}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Middle: Editable Amounts */}
                              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-5 gap-3">
                                {/* Distance KM / Travel Amount based on mode */}
                                {["Bike", "Car"].includes(leg.mode) ? (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                      <span>Distance (KM)</span>
                                      {leg.km !== (originalLeg.km || 0) && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={leg.km}
                                        onChange={(e) => handleLegAmountChange(index, "km", e.target.value)}
                                        className={`input-lte px-2 py-1.5 text-xs font-bold ${leg.km !== (originalLeg.km || 0) ? "border-amber-450 bg-amber-50/10" : ""}`}
                                      />
                                    </div>
                                    <span className="text-[9px] text-gray-500 block font-semibold">Amt: ₹{leg.travel_amount} (Orig: {originalLeg.km || 0} KM)</span>
                                    {renderAttachmentControls(travelReceiptUrl)}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                      <span>Travel Amount</span>
                                      {travelModified && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-2 text-gray-400 font-bold">₹</span>
                                      <input
                                        type="number"
                                        value={leg.travel_amount}
                                        onChange={(e) => handleLegAmountChange(index, "travel_amount", e.target.value)}
                                        className={`input-lte pl-6 pr-2 py-1.5 text-xs font-bold ${travelModified ? "border-amber-450 bg-amber-50/10" : ""}`}
                                      />
                                    </div>
                                    <span className="text-[9px] text-gray-455 block font-semibold">Original: ₹{originalLeg.amount || 0}</span>
                                    {renderAttachmentControls(travelReceiptUrl)}
                                  </div>
                                )}

                                {/* Sub Amount */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                    <span>Local Conveyance</span>
                                    {subModified && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-gray-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      value={leg.sub_amount}
                                      onChange={(e) => handleLegAmountChange(index, "sub_amount", e.target.value)}
                                      className={`input-lte pl-6 pr-2 py-1.5 text-xs font-bold ${subModified ? "border-amber-450 bg-amber-50/10" : ""}`}
                                      disabled={!leg.sub_mode}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-455 block font-semibold">Original: ₹{originalLeg.sub_amount || 0}</span>
                                  {renderAttachmentControls(subReceiptUrl)}
                                </div>

                                {/* Hotel stay amount */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                    <span>Hotel stay</span>
                                    {hotelModified && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-gray-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      value={leg.hotel_amount}
                                      onChange={(e) => handleLegAmountChange(index, "hotel_amount", e.target.value)}
                                      className={`input-lte pl-6 pr-2 py-1.5 text-xs font-bold ${hotelModified ? "border-amber-450 bg-amber-50/10" : ""}`}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-455 block font-semibold">Original: ₹{originalLeg.hotel || 0}</span>
                                  {renderAttachmentControls(hotelReceiptUrl, "👁 Preview Hotel Receipt")}
                                  {renderAttachmentControls(mailReceiptUrl, "✉ Preview Approval Mail")}
                                </div>

                                {/* Local purchase */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                    <span>Local Purchase</span>
                                    {lpModified && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-gray-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      value={leg.local_purchase}
                                      onChange={(e) => handleLegAmountChange(index, "local_purchase", e.target.value)}
                                      className={`input-lte pl-6 pr-2 py-1.5 text-xs font-bold ${lpModified ? "border-amber-450 bg-amber-50/10" : ""}`}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-455 block font-semibold">Original: ₹{originalLeg.local_purchase || 0}</span>
                                  {renderAttachmentControls(lpReceiptUrl)}
                                </div>

                                {/* Other / Misc amount */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block flex justify-between">
                                    <span>Other / Misc</span>
                                    {otherModified && <span className="text-[9px] text-amber-600 font-extrabold uppercase animate-pulse">Adjusted</span>}
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-gray-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      value={leg.other_amount}
                                      onChange={(e) => handleLegAmountChange(index, "other_amount", e.target.value)}
                                      className={`input-lte pl-6 pr-2 py-1.5 text-xs font-bold ${otherModified ? "border-amber-450 bg-amber-50/10" : ""}`}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-455 block font-semibold truncate" title={leg.oth_desc || "No Description"}>
                                    Orig: ₹{originalLeg.oth_amount || 0} ({leg.oth_desc || "Other"})
                                  </span>
                                  {renderAttachmentControls(otherReceiptUrl)}
                                </div>
                              </div>

                            </div>

                            {/* Verification / Edit remark card for modified fields in this leg */}
                            {((leg.km !== (originalLeg.km || 0)) ||
                              (leg.travel_amount !== (originalLeg.amount || 0)) ||
                              (leg.sub_amount !== (originalLeg.sub_amount || 0)) ||
                              (leg.hotel_amount !== (originalLeg.hotel || 0)) ||
                              (leg.local_purchase !== (originalLeg.local_purchase || 0)) ||
                              (leg.other_amount !== (originalLeg.oth_amount || 0)) ||
                              (leg.da !== (originalLeg.da || 0))) && (
                              <div className="mx-4 mb-4 p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2.5 text-left">
                                <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-[10px] uppercase tracking-wider">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Reason(s) Required for Facility Visit {leg.leg} Modifications</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  {leg.km !== (originalLeg.km || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Distance KM Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.distance_km || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, distance_km: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Shortest path taken, route mapping error"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-450 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.travel_amount !== (originalLeg.amount || 0) && !["Bike", "Car"].includes(leg.mode) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Travel Amount Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.travel_amount || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, travel_amount: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Actual fare paid was higher/lower"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.sub_amount !== (originalLeg.sub_amount || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Local Conveyance Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.sub_amount || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, sub_amount: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Adjusted according to local rates"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.hotel_amount !== (originalLeg.hotel || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Hotel Stay Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.hotel_amount || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, hotel_amount: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Approved out of state limit exceeded"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.local_purchase !== (originalLeg.local_purchase || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Local Purchase Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.local_purchase || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, local_purchase: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Item cost validation from supplier"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.other_amount !== (originalLeg.oth_amount || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">Other / Misc Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.other_amount || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, other_amount: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Missing receipt penalty adjustment"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}

                                  {leg.da !== (originalLeg.da || 0) && (
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-amber-700 uppercase block">DA Allowance Reason *</label>
                                      <input
                                        type="text"
                                        value={leg.remarks?.da_amount || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedLegs(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              remarks: { ...updated[index].remarks, da_amount: val }
                                            };
                                            return updated;
                                          });
                                        }}
                                        placeholder="e.g., Company guest house stay, DA adjusted"
                                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 bg-white rounded font-medium text-amber-900 placeholder-amber-455 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* New Detailed Activities section */}
                            {hasActivities && (
                              <div className="border-t border-gray-150 p-4 bg-slate-50/50 flex flex-col gap-2.5 text-left">
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[9px] font-bold text-gray-500 uppercase mr-2 mt-0.5">Activities / Tasks:</span>
                                  {selectedActs.map((act: string, actIdx: number) => (
                                    <span key={actIdx} className="px-1.5 py-0.5 rounded bg-gray-200 border border-gray-300 text-[8px] font-bold text-gray-700 uppercase">
                                      {act}
                                    </span>
                                  ))}
                                </div>

                                {/* Sub-table for Calls */}
                                {selectedActs.includes("Calls") && callsList.length > 0 && (
                                  <div className="border border-blue-100 rounded overflow-hidden bg-white max-w-4xl">
                                    <div className="px-2 py-1 bg-blue-50/50 border-b border-blue-100 text-[9px] font-bold text-blue-700 uppercase">Support Calls Logs</div>
                                    
                                    {/* Desktop View Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                        <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                          <tr>
                                            <th className="py-1 px-2 text-left">District Name</th>
                                            <th className="py-1 px-2 text-left">Hospital Name</th>
                                            <th className="py-1 px-2 text-left">Equipment Name</th>
                                            <th className="py-1 px-2 text-left">Model</th>
                                            <th className="py-1 px-2 text-left font-mono">Bar Code</th>
                                            <th className="py-1 px-2 text-left">Inventory Status</th>
                                            <th className="py-1 px-2 text-left">Call Type</th>
                                            <th className="py-1 px-2 text-left">Call Status</th>
                                            <th className="py-1 px-2 text-center w-12">Photo</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {callsList.map((c: any, cIdx: number) => (
                                            <tr key={cIdx}>
                                              <td className="py-1 px-2 text-gray-700">{c.asset_details?.district_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-700">{c.asset_details?.hospital_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-855 font-bold">{c.asset_details?.equipment_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-700">{c.asset_details?.model_name || "—"}</td>
                                              <td className="py-1 px-2 font-mono font-bold text-gray-700">{c.barcode}</td>
                                              <td className="py-1 px-2">
                                                <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-green-50 text-green-700 border border-green-200">
                                                  {c.asset_details?.inventory_status || "Active"}
                                                </span>
                                              </td>
                                              <td className="py-1 px-2 text-gray-650">{c.type || "Support Call"}</td>
                                              <td className="py-1 px-2">
                                                <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                                  {c.status || "Attend"}
                                                </span>
                                              </td>
                                              <td className="py-1 px-2 text-center">
                                                {c.photo_url ? (
                                                  <a
                                                    href={`${API_BASE}${c.photo_url}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 font-bold hover:underline"
                                                  >
                                                    View
                                                  </a>
                                                ) : (
                                                  <span className="text-[10px] text-gray-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mobile View Card List */}
                                    <div className="block lg:hidden space-y-2 p-2.5 bg-gray-50/20">
                                      {callsList.map((c: any, cIdx: number) => (
                                        <div key={cIdx} className="bg-white border border-gray-150 rounded-lg p-2.5 space-y-2">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <span className="font-extrabold text-gray-805 block">{c.asset_details?.equipment_name || "—"}</span>
                                              <span className="text-[9px] text-gray-500">{c.asset_details?.hospital_name || "—"}</span>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[8px] uppercase bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                                              {c.status || "Attend"}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-gray-600 font-bold border-t border-gray-100 pt-1.5">
                                            <div>District: <span className="text-gray-800">{c.asset_details?.district_name || "—"}</span></div>
                                            <div>Model: <span className="text-gray-800">{c.asset_details?.model_name || "—"}</span></div>
                                            <div>Barcode: <span className="text-gray-800 font-mono">{c.barcode}</span></div>
                                            <div>Type: <span className="text-gray-800">{c.type || "Support Call"}</span></div>
                                          </div>
                                          {c.photo_url && (
                                            <div className="pt-2">
                                              <div className="relative rounded overflow-hidden border border-blue-100 bg-white">
                                                <img
                                                  src={`${API_BASE}${c.photo_url}`}
                                                  alt="Call verification"
                                                  className="w-full h-auto object-cover max-h-48 cursor-pointer"
                                                  onClick={() => setLightboxImage(`${API_BASE}${c.photo_url}`)}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setLightboxImage(`${API_BASE}${c.photo_url}`)}
                                                  className="absolute bottom-1 right-1 bg-black/60 text-white font-bold text-[8px] px-2 py-0.5 rounded cursor-pointer border-0"
                                                >
                                                  Full View
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Sub-table for PMS */}
                                {selectedActs.includes("PMS") && pmsList.length > 0 && (
                                  <div className="border border-amber-100 rounded overflow-hidden bg-white max-w-4xl">
                                    <div className="px-2 py-1 bg-amber-50/50 border-b border-amber-100 text-[9px] font-bold text-amber-700 uppercase">PMS Service Logs</div>
                                    
                                    {/* Desktop View Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                        <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                          <tr>
                                            <th className="py-1 px-2 text-left">District Name</th>
                                            <th className="py-1 px-2 text-left">Hospital Name</th>
                                            <th className="py-1 px-2 text-left">Equipment Name</th>
                                            <th className="py-1 px-2 text-left">Model</th>
                                            <th className="py-1 px-2 text-left font-mono">Bar Code</th>
                                            <th className="py-1 px-2 text-left">Inventory Status</th>
                                            <th className="py-1 px-2 text-left">PMS Frequency Period</th>
                                            <th className="py-1 px-2 text-center w-12">Photo</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {pmsList.map((p: any, pIdx: number) => (
                                            <tr key={pIdx}>
                                              <td className="py-1 px-2 text-gray-700">{p.asset_details?.district_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-700">{p.asset_details?.hospital_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-855 font-bold">{p.asset_details?.equipment_name || "—"}</td>
                                              <td className="py-1 px-2 text-gray-700">{p.asset_details?.model_name || "—"}</td>
                                              <td className="py-1 px-2 font-mono font-bold text-gray-700">{p.barcode}</td>
                                              <td className="py-1 px-2">
                                                <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-green-50 text-green-700 border border-green-200">
                                                  {p.asset_details?.inventory_status || "Active"}
                                                </span>
                                              </td>
                                              <td className="py-1 px-2 text-gray-650">{p.frequency || "3 month"}</td>
                                              <td className="py-1 px-2 text-center">
                                                {p.photo_url ? (
                                                  <a
                                                    href={`${API_BASE}${p.photo_url}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 font-bold hover:underline"
                                                  >
                                                    View
                                                  </a>
                                                ) : (
                                                  <span className="text-[10px] text-gray-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mobile View Card List */}
                                    <div className="block lg:hidden space-y-2 p-2.5 bg-gray-50/20">
                                      {pmsList.map((p: any, pIdx: number) => (
                                        <div key={pIdx} className="bg-white border border-gray-150 rounded-lg p-2.5 space-y-2">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <span className="font-extrabold text-gray-855 block">{p.asset_details?.equipment_name || "—"}</span>
                                              <span className="text-[9px] text-gray-500">{p.asset_details?.hospital_name || "—"}</span>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded font-extrabold text-[8px] uppercase bg-green-50 text-green-700 border border-green-200 shrink-0">
                                              {p.frequency || "3 month"}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-gray-600 font-bold border-t border-gray-100 pt-1.5">
                                            <div>District: <span className="text-gray-800">{p.asset_details?.district_name || "—"}</span></div>
                                            <div>Model: <span className="text-gray-800">{p.asset_details?.model_name || "—"}</span></div>
                                            <div>Barcode: <span className="text-gray-800 font-mono">{p.barcode}</span></div>
                                            <div>Status: <span className="text-gray-800">{p.asset_details?.inventory_status || "Active"}</span></div>
                                          </div>
                                          {p.photo_url && (
                                            <div className="pt-2">
                                              <div className="relative rounded overflow-hidden border border-amber-100 bg-white">
                                                <img
                                                  src={`${API_BASE}${p.photo_url}`}
                                                  alt="PMS verification"
                                                  className="w-full h-auto object-cover max-h-48 cursor-pointer"
                                                  onClick={() => setLightboxImage(`${API_BASE}${p.photo_url}`)}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setLightboxImage(`${API_BASE}${p.photo_url}`)}
                                                  className="absolute bottom-1 right-1 bg-black/60 text-white font-bold text-[8px] px-2 py-0.5 rounded cursor-pointer border-0"
                                                >
                                                  Full View
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Sub-table for Asset Tagging (Visible to approvers!) */}
                                {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                  <div className="border border-emerald-100 rounded overflow-hidden bg-white max-w-4xl">
                                    <div className="px-2 py-1 bg-emerald-50/50 border-b border-emerald-100 text-[9px] font-bold text-emerald-700 uppercase">Asset Tagging Records</div>
                                    
                                    {/* Desktop View Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                        <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                          <tr>
                                            <th className="py-1 px-2 text-left">Equipment Name</th>
                                            <th className="py-1 px-2 text-center w-20">Quantity</th>
                                            <th className="py-1 px-2 text-right w-28">Tender Rate</th>
                                            <th className="py-1 px-2 text-right w-28">Total Cost</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {assetsList.map((a: any, aIdx: number) => {
                                            const selectedEq = assetValueMaster.find(eq => eq.equipment_name === a.equipment_name);
                                            const costPerUnit = selectedEq ? (selectedEq.asset_value || selectedEq.rmsc_tender_cost || 0) : 0;
                                            const qty = parseInt(a.quantity || "0") || 0;
                                            const totalCost = qty * costPerUnit;
                                            return (
                                              <tr key={aIdx}>
                                                <td className="py-1 px-2 font-semibold text-gray-700">{a.equipment_name}</td>
                                                <td className="py-1 px-2 text-center text-gray-600">{qty}</td>
                                                <td className="py-1 px-2 text-right text-gray-500">₹{costPerUnit.toLocaleString()}</td>
                                                <td className="py-1 px-2 text-right font-bold text-emerald-700">₹{totalCost.toLocaleString()}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mobile View Card List */}
                                    <div className="block lg:hidden space-y-2 p-2.5 bg-gray-50/20">
                                      {assetsList.map((a: any, aIdx: number) => {
                                        const selectedEq = assetValueMaster.find(eq => eq.equipment_name === a.equipment_name);
                                        const costPerUnit = selectedEq ? (selectedEq.asset_value || selectedEq.rmsc_tender_cost || 0) : 0;
                                        const qty = parseInt(a.quantity || "0") || 0;
                                        const totalCost = qty * costPerUnit;
                                        return (
                                          <div key={aIdx} className="bg-white border border-gray-150 rounded-lg p-2.5 space-y-1.5">
                                            <div className="flex justify-between items-center">
                                              <span className="font-extrabold text-gray-800 text-[10px]">{a.equipment_name}</span>
                                              <span className="px-2 py-0.5 rounded bg-white border border-emerald-250 text-gray-700 font-bold font-mono">Qty: {qty}</span>
                                            </div>
                                            <div className="flex justify-between text-[9px] text-gray-500 font-bold border-t border-gray-100 pt-1">
                                              <span>Tender Rate: ₹{costPerUnit.toLocaleString()}</span>
                                              <span className="text-emerald-700 font-extrabold">Total Cost: ₹{totalCost.toLocaleString()}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Quantities for Mobilise, Calibration or Other */}
                                <div className="flex flex-wrap gap-4 text-[10px] text-gray-600 bg-white p-2 rounded border border-gray-100 max-w-4xl">
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
                                    <div className="flex-1">
                                      <span className="font-bold text-gray-400 uppercase text-[8px] block">Other Activity Description</span>
                                      <span className="italic text-gray-700">{activityOtherDesc}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>{/* end space-y-4 leg list */}
                    </Card>{/* end Facility Visits Card */}
                  </div>
                  )}

                  {/* ATTACHMENTS VIEW LIST WITH LIGHTBOX */}
                  {getAttachmentsArray(expenseDetails.attachments).length > 0 && (
                    <Card
                      size="small"
                      style={{ borderColor: "#e5e7eb", borderRadius: 8 }}
                      bodyStyle={{ padding: "12px 14px" }}
                      title={
                        <Space>
                          <PaperClipOutlined style={{ color: "#6366f1" }} />
                          <Typography.Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Uploaded Receipt Attachments
                          </Typography.Text>
                        </Space>
                      }
                    >
                      <div className="flex flex-wrap gap-3">
                        {getAttachmentsArray(expenseDetails.attachments).map((url: string, attIdx: number) => {
                          const filename = url.split("/").pop() || "Receipt";
                          let cleanType = "Receipt Bill";
                          if (url.includes("_Bike_")) cleanType = "Bike Fuel Receipt";
                          else if (url.includes("_Car_")) cleanType = "Car Fuel Receipt";
                          else if (url.includes("_Auto_")) cleanType = "Auto Fare Bill";
                          else if (url.includes("_Bus_")) cleanType = "Bus Ticket";
                          else if (url.includes("_Train_")) cleanType = "Train Ticket";
                          else if (url.includes("_Hotel_")) cleanType = "Hotel Stay Invoice";
                          else if (url.includes("_Communication_Mail_")) cleanType = "Approval Mail Screenshot";
                          else if (url.includes("_Other_Expense_")) cleanType = "Local Purchase Invoice";

                          const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
                          const isRemoved = removedAttachments.includes(url);
                          if (isRemoved) {
                            return (
                              <div key={attIdx} className="inline-flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs font-bold shadow-sm">
                                <span className="text-[9px] text-red-600 font-extrabold uppercase">Removed</span>
                                <button
                                  type="button"
                                  onClick={() => setRemovedAttachments(prev => prev.filter(item => item !== url))}
                                  className="text-[9px] text-green-700 hover:underline font-extrabold bg-transparent border-0 cursor-pointer p-0"
                                >
                                  Undo
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div key={attIdx} className="relative">
                              <button
                                type="button"
                                onClick={() => setLightboxImage(fullUrl)}
                                className="inline-flex items-center gap-2 p-2 bg-gray-50 border border-gray-205 rounded text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm cursor-pointer border-0"
                              >
                                <div className="h-6 w-6 bg-red-100 text-red-600 rounded flex items-center justify-center text-[10px] font-extrabold shrink-0">IMG</div>
                                <div className="text-left leading-tight pr-1">
                                  <p className="text-gray-800 text-[10px] font-bold">{cleanType}</p>
                                  <span className="text-[8px] text-gray-400 font-mono truncate block max-w-[130px]">{filename}</span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemovedAttachments(prev => [...prev, url])}
                                className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 text-white rounded-full flex items-center justify-center text-[9px] font-extrabold shadow cursor-pointer border border-white"
                                style={{ backgroundColor: "#dc2626" }}
                                title="Remove this attachment"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Dynamic Summary bar — antd Card */}
                  <Card
                    size="small"
                    style={{ background: "#eff6ff", borderColor: "#bfdbfe", borderRadius: 8 }}
                    bodyStyle={{ padding: "12px 14px" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <Typography.Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e40af" }}>
                          {selectedApproval?.category === "Limit Request" ? "Limit Extension Request" : "Expense Total Summary"}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 10, display: "block", marginTop: 2 }}>
                          {selectedApproval?.category === "Limit Request"
                            ? "This displays the requested limit extension value."
                            : "This reflects the sum of Travel, Local Conveyance, DA, Hotel and Local Purchases."}
                        </Typography.Text>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                        <div>
                          <Typography.Text type="secondary" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>Requested Value</Typography.Text>
                          <Typography.Text strong style={{ fontSize: 16, color: "#1d4ed8", fontFamily: "monospace" }}>
                            {selectedApproval?.category === "Limit Request"
                              ? `${expenseDetails?.amount} ${selectedApproval?.expense_code?.includes("KM") ? "KM" : "₹"}`
                              : `₹${(Number(expenseDetails?.amount) || 0).toLocaleString()}`}
                          </Typography.Text>
                        </div>
                        {selectedApproval?.category === "Limit Request" ? (
                          <div>
                            <Typography.Text style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#92400e", display: "block" }}>Adjusted Limit Approved</Typography.Text>
                            <Typography.Text strong style={{ fontSize: 16, color: "#d97706", fontFamily: "monospace" }}>
                              {selectedApproval?.expense_code?.includes("KM")
                                ? `${editedLegs[0]?.km || expenseDetails?.amount} KM`
                                : `₹${(editedLegs[0]?.travel_amount || expenseDetails?.amount || 0).toLocaleString()}`}
                            </Typography.Text>
                          </div>
                        ) : (
                          <div>
                            <Typography.Text style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#1e40af", display: "block" }}>Adjusted Approval Total</Typography.Text>
                            <Typography.Text strong style={{ fontSize: 16, fontFamily: "monospace", color: isEdited() ? "#d97706" : "#1d4ed8" }}>
                              ₹{(Number(calculateAdjustedTotal()) || 0).toLocaleString()}
                            </Typography.Text>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {isEdited() && (
                    <div className="p-3 bg-amber-50 border border-amber-250 rounded text-amber-800 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Warning: You have changed one or more visit amounts. Approving will override values with these adjusted rates.</span>
                    </div>
                  )}

                  {/* Comments field — antd Input.TextArea */}
                  <div className="space-y-1.5 pt-2 text-left">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Typography.Text strong style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "#374151" }}>
                        Approver Review Comments / Remarks
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                        (Mandatory for rejections, optional for approvals)
                      </Typography.Text>
                    </div>
                    <Input.TextArea
                      rows={3}
                      placeholder="Add reviewer notes or reasons for rejection here..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      style={{ fontSize: 12, borderRadius: 6 }}
                    />
                  </div>

                  {/* Adjustment & Edit Log History — antd Card wrapper */}
                  {expenseDetails.edit_history && expenseDetails.edit_history.length > 0 && (
                    <Card
                      size="small"
                      style={{ borderColor: "#fde68a", background: "#fffbeb", borderRadius: 8 }}
                      bodyStyle={{ padding: 0 }}
                      title={
                        <Space>
                          <HistoryOutlined style={{ color: "#92400e" }} />
                          <Typography.Text strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#92400e" }}>
                            Adjustment & Edit Log History
                          </Typography.Text>
                        </Space>
                      }
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="border-b border-amber-200 uppercase font-bold tracking-wider text-amber-700 bg-amber-50/20">
                              <th className="py-2 px-3 w-12">Leg</th>
                              <th className="py-2 px-3">Field Edited</th>
                              <th className="py-2 px-3">Original Value</th>
                              <th className="py-2 px-3">Updated Value</th>
                              <th className="py-2 px-3">Reason / Remark</th>
                              <th className="py-2 px-3">Edited By</th>
                              <th className="py-2 px-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 bg-white">
                            {expenseDetails.edit_history.map((log: any, logIdx: number) => {
                              const cleanField = log.field_name === "travel_amount" ? "Travel Amount"
                                : log.field_name === "sub_amount" ? "Local Conveyance"
                                : log.field_name === "hotel_amount" ? "Hotel stay"
                                : log.field_name === "other_amount" ? "Other / Misc"
                                : log.field_name === "distance_km" ? "Distance KM"
                                : log.field_name === "da_amount" ? "DA Amount"
                                : log.field_name === "local_purchase" ? "Local Purchase"
                                : log.field_name;
                              return (
                                <tr key={logIdx} className="hover:bg-amber-50/10 text-slate-700">
                                  <td className="py-2 px-3 font-mono font-bold text-gray-500">Facility Visit {log.leg_number}</td>
                                  <td className="py-2 px-3 font-semibold text-gray-800">{cleanField}</td>
                                  <td className="py-2 px-3 font-mono text-gray-500">{log.field_name === "distance_km" ? `${log.old_value} KM` : `₹${parseFloat(log.old_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-blue-600">{log.field_name === "distance_km" ? `${log.new_value} KM` : `₹${parseFloat(log.new_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2 px-3 italic text-gray-600 whitespace-normal break-words min-w-[150px] max-w-[250px]" title={log.comment}>{log.comment || "—"}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    {log.editor_name} <span className="text-[8px] text-amber-600 font-bold block">{log.editor_role}</span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-500 font-mono text-[9px]">{formatDateTime(log.created_at)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-gray-400">
                  <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                  <p className="font-bold">Error: Could not retrieve claim data.</p>
                </div>
              )}
      </Modal>

      {/* ================= BATCH ACTION CONFIRMATION MODAL ================= */}
      <Modal
        open={showBulkModal && !!bulkActionType}
        onCancel={() => {
          setShowBulkModal(false);
          setBulkActionType(null);
          setBulkComments("");
        }}
        width={500}
        title={
          <span className="font-bold text-sm uppercase">
            Confirm Bulk {bulkActionType === "approve" ? "Reimbursement Approval" : "Claims Rejection"}
          </span>
        }
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setShowBulkModal(false);
              setBulkActionType(null);
              setBulkComments("");
            }}
            disabled={bulkActionLoading}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger={bulkActionType === "reject"}
            style={bulkActionType === "approve" ? { backgroundColor: "#10b981", borderColor: "#10b981" } : undefined}
            onClick={handleBulkSubmit}
            loading={bulkActionLoading}
            className="font-bold text-xs"
          >
            Confirm Bulk {bulkActionType === "approve" ? "Approval" : "Rejection"}
          </Button>
        ]}
      >
        <div className="space-y-4 pt-2 text-left">
          <div className="text-xs text-gray-700 bg-gray-50 p-3 border border-gray-200 rounded space-y-1.5">
            <p>Selected claims count: <span className="font-bold text-gray-900">{selectedIds.length} Claims</span></p>
            {bulkActionType === "approve" && (
              <p>Accumulated Total Value: <span className="font-bold text-blue-700">₹{(Number(getSelectedTotalAmount()) || 0).toLocaleString()}</span></p>
            )}
            <p className="text-[10px] text-gray-400 font-semibold italic mt-1 leading-normal">
              Note: Bulk actions will process all selected claims sequentially as-is without any visit amount modifications.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex justify-between">
              <span>Review Comments / Remarks</span>
              <span className="text-[10px] text-gray-400">
                {bulkActionType === "reject" ? "* (Mandatory)" : "(Optional)"}
              </span>
            </label>
            <Input.TextArea
              rows={3}
              placeholder={bulkActionType === "reject" ? "State rejection reasons (mandatory)..." : "Add approval notes..."}
              value={bulkComments}
              onChange={(e) => setBulkComments(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          style={{ zIndex: 9999999 }}
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center justify-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-350 text-xl font-bold bg-transparent border-0 cursor-pointer"
            >
              ✕ Close Preview
            </button>
            {isConvertingHeic ? (
              <div className="text-white flex flex-col items-center justify-center gap-3 p-8 rounded bg-slate-900/50 border border-slate-700/50 shadow-lg select-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <span className="text-sm font-bold tracking-wide">Converting Apple HEIC image...</span>
              </div>
            ) : (
              <img 
                src={displayImageUrl || lightboxImage} 
                alt="Receipt Invoice Lightbox" 
                className="max-w-full max-h-[80vh] rounded shadow-2xl border border-white/10 object-contain select-none pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}

      {/* Return to Draft Modal */}
      <Modal
        open={showReturnModal}
        onCancel={() => setShowReturnModal(false)}
        width={450}
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

    </>
  );
}
