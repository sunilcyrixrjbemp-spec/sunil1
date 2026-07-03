import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { approvalService } from "../services/approvalService";
import { expenseService } from "../services/expenseService";
import Loader from "../components/common/Loader";
import { 
  Check, 
  X, 
  Eye, 
  FileText, 
  User, 
  MapPin, 
  Info, 
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Square,
  CheckSquare,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  TrendingUp
} from "lucide-react";

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
  const limitRequests = pendingApprovals.filter((a: any) => a.category === "Limit Request");
  const claimRequests = pendingApprovals.filter((a: any) => a.category !== "Limit Request");

  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem("cache_pending_approvals");
  });
  const [approvalsPage, setApprovalsPage] = useState(1);
  
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [expenseDetails, setExpenseDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [comments, setComments] = useState("");
  const [_actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit single itineraries state
  const [editedLegs, setEditedLegs] = useState<any[]>([]);

  // Bulk actions selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // holds selected expense_ids
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | null>(null);
  const [bulkComments, setBulkComments] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // In-app Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
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
    
    setActionLoading(true);
    try {
      await approvalService.approveExpense(expenseId, "Approved limit extension", undefined, approvedValue);
      toast.success("Limit extension request approved successfully!");
      fetchPendingApprovals();
    } catch (err: any) {
      console.error("Failed to approve limit", err);
      toast.error(err.response?.data?.detail || "Failed to approve limit extension.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectLimit = async (expenseId: number) => {
    setActionLoading(true);
    try {
      await approvalService.rejectExpense(expenseId, "Limit extension rejected");
      toast.success("Limit extension request rejected.");
      fetchPendingApprovals();
    } catch (err: any) {
      console.error("Failed to reject limit", err);
      toast.error(err.response?.data?.detail || "Failed to reject limit extension.");
    } finally {
      setActionLoading(false);
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
            ws_asset: leg.ws_asset
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
    const API_BASE = import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com";
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
      const itineraryEdits = editedLegs.map(leg => ({
        leg_number: leg.leg,
        travel_amount: leg.travel_amount,
        sub_amount: leg.sub_amount,
        hotel_amount: leg.hotel_amount,
        other_amount: leg.other_amount,
        distance_km: leg.km,
        da_amount: leg.da,
        local_purchase: leg.local_purchase
      }));

      if (selectedApproval.category === "Limit Request") {
        const approvedVal = selectedApproval.expense_code.includes("KM")
          ? (editedLegs[0]?.km || expenseDetails?.amount || 0)
          : (editedLegs[0]?.travel_amount || expenseDetails?.amount || 0);

        if (type === "approve") {
          await approvalService.approveExpense(selectedApproval.expense_id, comments.trim() || "Approved limit extension", undefined, approvedVal);
          toast.success("Limit request approved successfully!");
        } else {
          await approvalService.rejectExpense(selectedApproval.expense_id, comments.trim() || "Limit extension rejected");
          toast.error("Limit request rejected.");
        }
      } else {
        if (type === "approve") {
          await approvalService.approveExpense(selectedApproval.expense_id, comments.trim(), itineraryEdits);
          toast.success(`Claim ${selectedApproval.expense_code} approved!`);
        } else {
          await approvalService.rejectExpense(selectedApproval.expense_id, comments.trim(), itineraryEdits);
          toast.error(`Claim ${selectedApproval.expense_code} rejected.`);
        }
      }

      setShowDetailModal(false);
      setSelectedApproval(null);
      setExpenseDetails(null);
      setEditedLegs([]);
      await fetchPendingApprovals();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Checkbox functions
  const toggleSelectClaim = (expenseId: number) => {
    setSelectedIds(prev => {
      if (prev.includes(expenseId)) {
        return prev.filter(id => id !== expenseId);
      } else {
        return [...prev, expenseId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === claimRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(claimRequests.map(item => item.expense_id));
    }
  };

  // Bulk Actions
  const handleOpenBulkAction = (type: "approve" | "reject") => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one claim first.");
      return;
    }
    setBulkActionType(type);
    setBulkComments("");
    setShowBulkModal(true);
  };

  const handleBulkSubmit = async () => {
    if (!bulkActionType) return;
    
    if (bulkActionType === "reject" && !bulkComments.trim()) {
      toast.error("Rejection remarks comments are mandatory.");
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    // Process all selected approvals concurrently
    try {
      const results = await Promise.all(selectedIds.map(async (id) => {
        try {
          if (bulkActionType === "approve") {
            await approvalService.approveExpense(id, bulkComments.trim());
          } else {
            await approvalService.rejectExpense(id, bulkComments.trim());
          }
          return { success: true };
        } catch (err) {
          console.error(`Failed to process bulk action for claim ${id}:`, err);
          return { success: false };
        }
      }));
      successCount = results.filter(r => r.success).length;
      failCount = results.filter(r => !r.success).length;
    } catch (err) {
      console.error("Bulk action failed:", err);
    }

    if (successCount > 0) {
      toast.success(`Successfully processed ${successCount} claim(s).`);
    }
    if (failCount > 0) {
      toast.error(`Failed to process ${failCount} claim(s).`);
    }

    setShowBulkModal(false);
    setBulkActionType(null);
    setBulkComments("");
    setSelectedIds([]);
    await fetchPendingApprovals();
    setBulkActionLoading(false);
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
      <div className="space-y-5 animate-fadeIn text-[#212529]">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 uppercase tracking-wide">
            Approval Center
          </h2>
          <p className="text-gray-500 text-xs mt-1">Review operational, local purchase, and travel claims submitted by staff.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
            Pending Claims: <strong>{claimRequests.length}</strong>
          </span>
          {limitRequests.length > 0 && (
            <span className="px-3 py-1.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold uppercase tracking-wider">
              Limit Extensions: <strong>{limitRequests.length}</strong>
            </span>
          )}
          {selectedIds.length > 0 && (
            <span className="px-3 py-1.5 rounded bg-amber-50 border border-amber-250 text-amber-800 text-xs font-bold uppercase tracking-wider animate-pulse">
              Selected: <strong>{selectedIds.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Pending Grid with Bulk Actions Toolbar */}
      <div className="card-lte-primary p-5 space-y-4">
        
        {/* Bulk Toolbar */}
        {claimRequests.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs shrink-0">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 font-bold text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer self-start sm:self-center"
            >
              {selectedIds.length === claimRequests.length ? (
                <CheckSquare className="w-4.5 h-4.5 text-blue-600 shrink-0" />
              ) : (
                <Square className="w-4.5 h-4.5 text-gray-400 shrink-0" />
              )}
              <span>
                {selectedIds.length === claimRequests.length ? "Deselect All" : "Select All Pending"}
              </span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleOpenBulkAction("approve")}
                disabled={selectedIds.length === 0}
                className="btn-lte-success px-4 py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-50 text-[11px]"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Bulk Approve ({selectedIds.length})
              </button>
              <button
                onClick={() => handleOpenBulkAction("reject")}
                disabled={selectedIds.length === 0}
                className="btn-lte-danger px-4 py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-50 text-[11px]"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Bulk Reject ({selectedIds.length})
              </button>
            </div>
          </div>
        )}

        {/* ================= LIMIT EXTENSION REQUESTS SECTION ================= */}
        {limitRequests.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              Limit Extension Requests
            </h3>
            <div className="overflow-x-auto border border-gray-250 rounded shadow-sm bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-250 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Employee Details</th>
                    <th className="px-4 py-3">Limit Type</th>
                    <th className="px-4 py-3 text-center">Month</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3">Requested Extension</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {limitRequests.map((req) => {
                    const reqVal = req.amount;
                    const currentValue = editedLimits[req.id] !== undefined ? editedLimits[req.id] : reqVal;
                    
                    return (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                              {req.employeeName ? req.employeeName.charAt(0) : "U"}
                            </div>
                            <div>
                              <div className="font-bold text-gray-800 leading-tight">{req.employeeName}</div>
                              <div className="text-[9px] text-blue-600 font-mono font-bold mt-0.5">{req.eCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                            req.purpose.toLowerCase().includes("km") 
                              ? "text-cyan-700 bg-cyan-50 border-cyan-200" 
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}>
                            {req.purpose.toLowerCase().includes("km") ? "KM Limit" : "Auto Limit"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-gray-600 font-medium">
                          {req.date}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 font-medium">
                          {req.purpose}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              value={currentValue}
                              onChange={(e) => handleEditLimitChange(req.id, parseFloat(e.target.value))}
                              className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 shadow-xs"
                              min="0"
                              step="any"
                            />
                            <span className="font-bold text-gray-500">
                              {req.purpose.toLowerCase().includes("km") ? "KM" : "₹"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenDetails(req)}
                              className="btn-lte-primary px-2.5 py-1 flex items-center justify-center gap-1 cursor-pointer"
                              title="Review details & monthly stats"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </button>
                            <button
                              onClick={() => handleApproveLimit(req.expense_id, currentValue)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-full bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 transition-colors shadow-xs cursor-pointer flex items-center justify-center"
                              title="Approve Request"
                            >
                              <Check className="w-4.5 h-4.5" />
                            </button>
                            <button
                              onClick={() => handleRejectLimit(req.expense_id)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors shadow-xs cursor-pointer flex items-center justify-center"
                              title="Reject Request"
                            >
                              <X className="w-4.5 h-4.5" />
                            </button>
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

        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 pt-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          Claims Awaiting Actions
        </h3>

        {loading ? (
          <Loader message="Loading pending reviews..." />
        ) : claimRequests.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs space-y-2">
            <div className="h-10 w-10 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto text-base">✓</div>
            <p className="font-bold uppercase tracking-wider text-gray-600">Great! All pending claims have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-250 rounded shadow-sm bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-250 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 w-12 text-center">Select</th>
                  <th className="px-4 py-3">Employee Details</th>
                  <th className="px-4 py-3">Claim ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Date / Month</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {claimRequests.slice((approvalsPage - 1) * 25, approvalsPage * 25).map((req) => {
                  const isChecked = selectedIds.includes(req.expense_id);
                  return (
                    <tr 
                      key={req.id} 
                      onClick={() => handleOpenDetails(req)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isChecked ? "bg-blue-50/20" : ""
                      }`}
                    >
                      {/* Checkbox column */}
                      <td 
                        className="px-4 py-3.5 text-center" 
                        onClick={(e) => { e.stopPropagation(); toggleSelectClaim(req.expense_id); }}
                      >
                        <button className="bg-transparent border-0 p-0 text-gray-400 hover:text-blue-600 cursor-pointer">
                          {isChecked ? (
                            <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                          ) : (
                            <Square className="w-4.5 h-4.5 text-gray-300" />
                          )}
                        </button>
                      </td>

                      {/* Employee details column */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {req.employeeName ? req.employeeName.charAt(0) : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800 leading-tight">{req.employeeName}</div>
                            <div className="text-[9px] text-blue-600 font-mono font-bold mt-0.5">{req.eCode}</div>
                          </div>
                        </div>
                      </td>

                      {/* Claim Code column */}
                      <td className="px-4 py-3.5 font-bold text-gray-700 font-mono">
                        {req.expense_code}
                      </td>

                      {/* Category column */}
                      <td className="px-4 py-3.5">
                        <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          {req.category}
                        </span>
                      </td>

                      {/* Date column */}
                      <td className="px-4 py-3.5 text-center text-gray-600 font-medium">
                        {req.date}
                      </td>

                      {/* Purpose column */}
                      <td className="px-4 py-3.5 text-gray-600 font-semibold max-w-[200px] truncate" title={req.purpose}>
                        {req.purpose}
                      </td>

                      {/* Amount column */}
                      <td className="px-4 py-3.5 text-right font-extrabold text-gray-900 text-sm">
                        ₹{(Number(req.amount) || 0).toLocaleString()}
                      </td>

                      {/* Review details eye button column */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetails(req)}
                          className="btn-lte-primary px-3 py-1.5 flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {claimRequests.length > 25 && (
              <div className="px-5 py-3 border-t border-gray-200 bg-slate-50 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {((approvalsPage - 1) * 25) + 1} to {Math.min(approvalsPage * 25, claimRequests.length)} of {claimRequests.length} items</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approvalsPage === 1}
                    onClick={() => setApprovalsPage(p => Math.max(p - 1, 1))}
                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={approvalsPage >= Math.ceil(claimRequests.length / 25)}
                    onClick={() => setApprovalsPage(p => Math.min(p + 1, Math.ceil(claimRequests.length / 25)))}
                    className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* ================= DETAIL SINGLE REVIEW AND EDIT MODAL ================= */}
      {showDetailModal && selectedApproval && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-5xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-800">
                  Reviewing Claim: {selectedApproval.expense_code}
                </h3>
              </div>
              <button 
                onClick={() => { setShowDetailModal(false); setSelectedApproval(null); }}
                className="text-gray-400 hover:text-gray-600 border-0 bg-transparent text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingDetails ? (
                <Loader message="Retrieving itineraries & receipts..." />
              ) : expenseDetails ? (
                <>
                  {/* Submitter details box */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 border border-gray-200 rounded text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold uppercase tracking-wider block text-[9px]">Employee Name</span>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-bold text-gray-800">{expenseDetails.submitter_name}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold uppercase tracking-wider block text-[9px]">Employee ID</span>
                      <span className="font-mono font-bold text-blue-600 uppercase">{expenseDetails.submitter_code}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold uppercase tracking-wider block text-[9px]">Claim Month / Date</span>
                      <span className="font-bold text-gray-700">{expenseDetails.month} {expenseDetails.year} ({expenseDetails.date})</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-400 font-bold uppercase tracking-wider block text-[9px]">Purpose / Description</span>
                      <span className="font-semibold text-gray-700 truncate block" title={expenseDetails.purpose}>{expenseDetails.purpose}</span>
                    </div>
                  </div>

                  {expenseDetails.user_monthly_stats && (
                    <div className="p-4 bg-blue-50/30 border border-blue-150 rounded text-xs space-y-3">
                      <h4 className="text-xs font-black uppercase text-blue-800 tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Submitter's Cumulative Monthly Summary ({expenseDetails.month} {expenseDetails.year})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">KM Used So Far</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{(expenseDetails.user_monthly_stats.km_used_so_far || 0).toFixed(1)} KM</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Approved DA</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">₹{(expenseDetails.user_monthly_stats.total_da || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Bike Distance</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{(expenseDetails.user_monthly_stats.total_bike_km || 0).toFixed(1)} KM</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Approved Auto</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">₹{(expenseDetails.user_monthly_stats.total_auto || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Approved Bus</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">₹{(expenseDetails.user_monthly_stats.total_bus || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Approved Train</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">₹{(expenseDetails.user_monthly_stats.total_train || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Total Approved Hotel</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">₹{(expenseDetails.user_monthly_stats.total_hotel || 0).toLocaleString()}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Calls Completed</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{expenseDetails.user_monthly_stats.calls_completed || 0}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">PMS Count</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{expenseDetails.user_monthly_stats.pms_count || 0}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Asset Tagging</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{expenseDetails.user_monthly_stats.asset_tagging || 0}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Mobilised Verification</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{expenseDetails.user_monthly_stats.mobilise_count || 0}</span>
                        </div>
                        <div className="bg-white p-2.5 border border-gray-150 rounded shadow-xs">
                          <span className="text-gray-400 font-bold block text-[8px] uppercase tracking-wider">Calibration Count</span>
                          <span className="text-xs font-extrabold text-gray-800 font-mono mt-0.5 block">{expenseDetails.user_monthly_stats.calibration_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* EDITABLE ITINERARY LEGS */}
                  {true && (
                    <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase text-gray-700 tracking-wider">Itinerary legs & Claimed Amounts</h4>
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[10px] text-gray-500 font-semibold">Adjust TA, Hotel and Local Purchase amounts below if needed.</span>
                      </div>
                    </div>

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
                            {/* Leg Title bar */}
                            <div className="px-4 py-2.5 bg-slate-100 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                Leg #{leg.leg}: <MapPin className="w-3.5 h-3.5 text-red-500" /> {leg.from_district} → {leg.to_district}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-500">Route: <span className="text-gray-800">{leg.from || "N/A"} to {leg.to || "N/A"}</span></span>
                                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase text-[9px]">{leg.mode} ({leg.km} KM)</span>
                                {leg.sub_mode && (
                                  <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase text-[9px]">Local: {leg.sub_mode}</span>
                                )}
                              </div>
                            </div>

                            {/* Leg inputs and details */}
                            <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
                              
                              {/* Left parameters */}
                              <div className="lg:col-span-4 grid grid-cols-2 gap-3 bg-gray-50 p-3 border border-gray-200 rounded">
                                <div>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Visit Purpose</span>
                                  <span className="font-semibold text-gray-700 leading-tight">{leg.visit_purpose || originalLeg.visit_purpose || "Field visit"}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">DA Allowance</span>
                                  <span className="font-bold text-gray-800">₹{(Number(leg.da) || 0).toLocaleString()}</span>
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
                                    {travelReceiptUrl && (
                                      <button 
                                        type="button" 
                                        onClick={() => setLightboxImage(travelReceiptUrl)} 
                                        className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                      >
                                        👁 Preview Receipt
                                      </button>
                                    )}
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
                                    {travelReceiptUrl && (
                                      <button 
                                        type="button" 
                                        onClick={() => setLightboxImage(travelReceiptUrl)} 
                                        className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                      >
                                        👁 Preview Receipt
                                      </button>
                                    )}
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
                                  {subReceiptUrl && (
                                    <button 
                                      type="button" 
                                      onClick={() => setLightboxImage(subReceiptUrl)} 
                                      className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                    >
                                      👁 Preview Receipt
                                    </button>
                                  )}
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
                                  {hotelReceiptUrl && (
                                    <button 
                                      type="button" 
                                      onClick={() => setLightboxImage(hotelReceiptUrl)} 
                                      className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                    >
                                      👁 Preview Hotel Receipt
                                    </button>
                                  )}
                                  {mailReceiptUrl && (
                                    <button 
                                      type="button" 
                                      onClick={() => setLightboxImage(mailReceiptUrl)} 
                                      className="text-[9px] text-purple-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                    >
                                      ✉ Preview Approval Mail
                                    </button>
                                  )}
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
                                  {lpReceiptUrl && (
                                    <button 
                                      type="button" 
                                      onClick={() => setLightboxImage(lpReceiptUrl)} 
                                      className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                    >
                                      👁 Preview Receipt
                                    </button>
                                  )}
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
                                  {otherReceiptUrl && (
                                    <button 
                                      type="button" 
                                      onClick={() => setLightboxImage(otherReceiptUrl)} 
                                      className="text-[9px] text-blue-600 hover:underline font-bold mt-1 block bg-transparent border-0 cursor-pointer p-0 text-left"
                                    >
                                      👁 Preview Receipt
                                    </button>
                                  )}
                                </div>
                              </div>

                            </div>

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
                                                  href={`${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${c.photo_url}`}
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
                                )}

                                {/* Sub-table for PMS */}
                                {selectedActs.includes("PMS") && pmsList.length > 0 && (
                                  <div className="border border-amber-100 rounded overflow-hidden bg-white max-w-4xl">
                                    <div className="px-2 py-1 bg-amber-50/50 border-b border-amber-100 text-[9px] font-bold text-amber-700 uppercase">PMS Service Logs</div>
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
                                                  href={`${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${p.photo_url}`}
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
                                )}

                                {/* Sub-table for Asset Tagging (Visible to approvers!) */}
                                {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                  <div className="border border-emerald-100 rounded overflow-hidden bg-white max-w-4xl">
                                    <div className="px-2 py-1 bg-emerald-50/50 border-b border-emerald-100 text-[9px] font-bold text-emerald-700 uppercase">Asset Tagging Records</div>
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
                                          const costPerUnit = selectedEq ? (selectedEq.rmsc_tender_cost || 0) : 0;
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
                    </div>
                  </div>
                  )}

                  {/* ATTACHMENTS VIEW LIST WITH LIGHTBOX */}
                  {expenseDetails.attachments && expenseDetails.attachments.length > 0 && (
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <h4 className="text-xs font-extrabold uppercase text-gray-700 tracking-wider">Uploaded Receipt Attachments</h4>
                      <div className="flex flex-wrap gap-3">
                        {expenseDetails.attachments.map((url: string, attIdx: number) => {
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

                          const API_BASE = import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com";
                          const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
                          return (
                            <button
                              key={attIdx}
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Summary bar */}
                  <div className="p-4 rounded border border-blue-200 bg-blue-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                    <div className="space-y-1 text-left">
                      <h4 className="font-extrabold text-blue-800 uppercase tracking-wide">
                        {selectedApproval.category === "Limit Request" ? "Limit Extension Request" : "Expense Total Summary"}
                      </h4>
                      <p className="text-gray-600 font-semibold">
                        {selectedApproval.category === "Limit Request" 
                          ? "This displays the requested limit extension value." 
                          : "This reflects the sum of Travel, Local Conveyance, DA, Hotel and Local Purchases."}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-bold block">REQUESTED VALUE</span>
                        <span className="text-sm font-bold text-blue-700 font-mono">
                          {selectedApproval.category === "Limit Request" 
                            ? `${expenseDetails?.amount} ${selectedApproval.expense_code.includes("KM") ? "KM" : "₹"}`
                            : `₹${(Number(expenseDetails?.amount) || 0).toLocaleString()}`}
                        </span>
                      </div>
                      {selectedApproval.category === "Limit Request" ? (
                        <>
                          <ChevronRight className="w-5 h-5 text-gray-300 hidden sm:block animate-pulse" />
                          <div className="text-right">
                            <span className="text-[10px] text-amber-700 font-extrabold block">ADJUSTED LIMIT APPROVED</span>
                            <span className="text-base font-black font-mono text-amber-600">
                              {selectedApproval.expense_code.includes("KM")
                                ? `${editedLegs[0]?.km || expenseDetails?.amount} KM`
                                : `₹${(editedLegs[0]?.travel_amount || expenseDetails?.amount || 0).toLocaleString()}`}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-5 h-5 text-gray-300 hidden sm:block animate-pulse" />
                          <div className="text-right">
                            <span className="text-[10px] text-blue-700 font-extrabold block">ADJUSTED APPROVAL TOTAL</span>
                            <span className={`text-base font-black font-mono ${isEdited() ? "text-amber-600" : "text-blue-700"}`}>
                              ₹{(Number(calculateAdjustedTotal()) || 0).toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isEdited() && (
                    <div className="p-3 bg-amber-50 border border-amber-250 rounded text-amber-800 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Warning: You have changed one or more leg amounts. Approving will override values with these adjusted rates.</span>
                    </div>
                  )}

                  {/* COMMENTS FIELD */}
                  <div className="space-y-1.5 pt-2 text-left">
                    <label className="label-lte flex justify-between">
                      <span>Approver Review Comments / Remarks</span>
                      <span className="text-[10px] text-gray-400 font-semibold">(Mandatory for rejections, optional for approvals)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Add reviewer notes or reasons for rejection here..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="input-lte resize-none"
                    />
                  </div>

                  {/* Adjustment & Edit Log History inside Approval Review Details modal */}
                  {expenseDetails.edit_history && expenseDetails.edit_history.length > 0 && (
                    <div className="border border-amber-200 rounded overflow-hidden mt-4 text-left">
                      <div className="px-3 py-2 bg-amber-50/50 border-b border-amber-200">
                        <h4 className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Adjustment & Edit Log History</h4>
                      </div>
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
                                : log.field_name === "other_amount" ? "Local purchase"
                                : log.field_name === "distance_km" ? "Distance KM"
                                : log.field_name === "da_amount" ? "DA Amount"
                                : log.field_name;
                              return (
                                <tr key={logIdx} className="hover:bg-amber-50/10 text-slate-700">
                                  <td className="py-2 px-3 font-mono font-bold text-gray-500">Leg #{log.leg_number}</td>
                                  <td className="py-2 px-3 font-semibold text-gray-800">{cleanField}</td>
                                  <td className="py-2 px-3 font-mono text-gray-500">{log.field_name === "distance_km" ? `${log.old_value} KM` : `₹${parseFloat(log.old_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-blue-600">{log.field_name === "distance_km" ? `${log.new_value} KM` : `₹${parseFloat(log.new_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2 px-3 italic text-gray-600 max-w-[150px] truncate" title={log.comment}>{log.comment || "—"}</td>
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
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-gray-400">
                  <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                  <p className="font-bold">Error: Could not retrieve claim data.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => { setShowDetailModal(false); setSelectedApproval(null); }}
                className="btn-lte-secondary px-6"
                disabled={actionLoading}
              >
                Close Window
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleProcessAction("reject")}
                  disabled={actionLoading || loadingDetails}
                  className="btn-lte-danger px-6 py-2.5 flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Reject Claim
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessAction("approve")}
                  disabled={actionLoading || loadingDetails}
                  className="btn-lte-success px-6 py-2.5 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Approve Claim
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= BATCH ACTION CONFIRMATION MODAL ================= */}
      {showBulkModal && bulkActionType && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-md">
            <h3 className="text-sm font-extrabold uppercase tracking-wider border-b border-gray-250 pb-3 text-gray-800 text-left">
              Confirm Bulk {bulkActionType === "approve" ? "Reimbursement Approval" : "Claims Rejection"}
            </h3>

            <div className="space-y-4 mt-4 text-left">
              <div className="text-xs text-gray-700 bg-gray-50 p-3 border border-gray-200 rounded space-y-1.5">
                <p>Selected claims count: <span className="font-bold text-gray-900">{selectedIds.length} Claims</span></p>
                {bulkActionType === "approve" && (
                  <p>Accumulated Total Value: <span className="font-bold text-blue-700">₹{(Number(getSelectedTotalAmount()) || 0).toLocaleString()}</span></p>
                )}
                <p className="text-[10px] text-gray-400 font-semibold italic mt-1 leading-normal">
                  Note: Bulk actions will process all selected claims sequentially as-is without any leg amount modifications.
                </p>
              </div>

              {/* Comments */}
              <div className="space-y-1.5">
                <label className="label-lte flex justify-between">
                  <span>Review Comments / Remarks</span>
                  <span className="text-[9px] text-gray-400">
                    {bulkActionType === "reject" ? "* (Mandatory)" : "(Optional)"}
                  </span>
                </label>
                <textarea
                  rows={3}
                  placeholder={bulkActionType === "reject" ? "State rejection reasons (mandatory)..." : "Add approval notes..."}
                  value={bulkComments}
                  onChange={(e) => setBulkComments(e.target.value)}
                  className="input-lte resize-none"
                  required={bulkActionType === "reject"}
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-250 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkActionType(null);
                    setBulkComments("");
                  }}
                  className="btn-lte-secondary"
                  disabled={bulkActionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={bulkActionLoading}
                  className={`px-5 py-2 rounded text-white font-bold text-xs tracking-wider uppercase transition-all shadow flex items-center gap-1.5 cursor-pointer border-0 ${
                    bulkActionType === "approve" 
                      ? "bg-[#28a745] hover:bg-[#218838]" 
                      : "bg-[#dc3545] hover:bg-[#c82333]"
                  } disabled:opacity-50`}
                >
                  {bulkActionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Bulk {bulkActionType === "approve" ? "Approval" : "Rejection"}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[60] animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center justify-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-350 text-xl font-bold bg-transparent border-0 cursor-pointer"
            >
              ✕ Close Preview
            </button>
            <img 
              src={lightboxImage} 
              alt="Receipt Invoice Lightbox" 
              className="max-w-full max-h-[80vh] rounded shadow-2xl border border-white/10 object-contain select-none pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </>
  );
}
