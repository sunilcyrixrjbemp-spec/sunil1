import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import toast from "react-hot-toast";
import { prefetchManager } from "../utils/prefetchManager";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { getISTMonth } from "../utils/dateUtils";
import { hasFullAccess } from "../utils/constants";
import LocationFilters from "../components/common/LocationFilters";
import DistrictBadge from "../components/common/DistrictBadge";
import ClaimDetailsModal from "../components/common/ClaimDetailsModal";
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Row, 
  Col, 
  Alert, 
  Typography, 
  Tag
} from "antd";

const { Title, Text } = Typography;

const uniqueMonths = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  const yyyyMm = d.toISOString().substring(0, 7);
  const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return { value: yyyyMm, label };
});

const getStatusCardStyle = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s.includes("approve") || s.includes("approved")) {
    return "border-emerald-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(16,185,129,0.3),0_2px_4px_-2px_rgba(16,185,129,0.3)]";
  }
  if (s.includes("reject") || s.includes("rejected")) {
    return "border-rose-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(239,68,68,0.3),0_2px_4px_-2px_rgba(239,68,68,0.3)]";
  }
  if (s.includes("pending") || s.includes("submitted") || s.includes("return")) {
    return "border-amber-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors sharp-card shadow-[0_4px_12px_-1px_rgba(245,158,11,0.3),0_2px_4px_-2px_rgba(245,158,11,0.3)]";
  }
  return "border-slate-300 bg-[#f1f5f9] hover:bg-slate-200 cursor-pointer transition-colors shadow-sm sharp-card";
};
import { 
  FileSpreadsheet, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Users,
  Loader2,
  AlertTriangle,
  ChevronUp,
  RefreshCw,
  FileText,
  Route,
  Car
} from "lucide-react";

// Reusable Apple iOS / Meta AI style soft gradient IconTile component
const IconTile = ({ 
  icon: Icon, 
  gradientFrom, 
  gradientTo, 
  shadowColor = "rgba(0, 0, 0, 0.12)" 
}: { 
  icon: React.ElementType; 
  gradientFrom: string; 
  gradientTo: string; 
  shadowColor?: string;
}) => (
  <div 
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white shrink-0`}
    style={{ boxShadow: `0 2px 6px -1px ${shadowColor}` }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

export default function HomePage() {

  const navigate = useNavigate();
  const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();
  const [user, setUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });
  
  // Dashboard stats & lists states
  const [_pendingApprovalsCount, setPendingApprovalsCount] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return 0;
    const cached = localStorage.getItem(`cache_approvals_count_${currentUser.user_id}`);
    return cached ? parseInt(cached) || 0 : 0;
  });
  const [pendingLimitRequestsCount, setPendingLimitRequestsCount] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return 0;
    const cached = localStorage.getItem(`cache_limit_approvals_count_${currentUser.user_id}`);
    return cached ? parseInt(cached) || 0 : 0;
  });
  const [myExpenses, setMyExpenses] = useState<any[]>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return [];
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_my_expenses_${currentUser.user_id}_${curMonth}`) || localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [teamExpenses, setTeamExpenses] = useState<any[]>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return [];
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_team_expenses_${currentUser.user_id}_${curMonth}`) || localStorage.getItem(`cache_team_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loadingMyExpenses, setLoadingMyExpenses] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return false;
    const curMonth = getISTMonth();
    return !localStorage.getItem(`cache_my_expenses_${currentUser.user_id}_${curMonth}`) && !localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
  });
  const [loadingTeamExpenses, setLoadingTeamExpenses] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return false;
    const curMonth = getISTMonth();
    return !localStorage.getItem(`cache_team_expenses_${currentUser.user_id}_${curMonth}`) && !localStorage.getItem(`cache_team_expenses_${currentUser.user_id}`);
  });
  const [allowanceStats, setAllowanceStats] = useState<any>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return null;
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_allowance_stats_${currentUser.user_id}_${curMonth}`) || localStorage.getItem(`cache_allowance_stats_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : null;
  });

  // Tabs state - persisted on refresh
  const [activeTab, setActiveTab] = useState<"my-claims" | "team-claims">((() => {
    const saved = localStorage.getItem("dashboard_active_tab");
    if (saved === "my-claims" || saved === "team-claims") return saved;
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (currentUser) {
      if (hasFullAccess(currentUser.role)) {
        return "team-claims";
      }
    }
    return "my-claims";
  }));

  const handleTabChange = (tab: "my-claims" | "team-claims") => {
    setActiveTab(tab);
    localStorage.setItem("dashboard_active_tab", tab);
  };

  // Read-only Details Modal states
  const [_selectedClaimId, setSelectedClaimId] = useState<number | string | null>(null);
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [_loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [comments, setComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchClaimId, setSearchClaimId] = useState<string>("");

  // Popup modal for clicked stats card
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalType, _setStatsModalType] = useState<"Total Claimed" | "Approved" | "Pending" | "Rejected">("Total Claimed");
  const [statsModalClaims, setStatsModalClaims] = useState<any[]>([]);
  const [homeClaimsPageSize, setHomeClaimsPageSize] = useState(25);
  const [homeTeamPageSize, setHomeTeamPageSize] = useState(25);
  const [homeModalPageSize, setHomeModalPageSize] = useState(15);

  // In-app Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);

  useEffect(() => {
    if (lightboxImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
    }
  }, [lightboxImage]);


  const [showPageScrollTop, setShowPageScrollTop] = useState(false);

  useEffect(() => {
    let frameId: number | null = null;
    const handlePageScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const shouldShow = window.scrollY > 300;
        setShowPageScrollTop(prev => prev === shouldShow ? prev : shouldShow);
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

  // Filters state for team claims tab
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [teamPage, setTeamPage] = useState<number>(1);
  const [personalPage, setPersonalPage] = useState<number>(1);

  const [selectMonth, setSelectMonth] = useState<string>(() => {
    return getISTMonth(); // Default current month YYYY-MM in IST
  });
  const [homeStatusFilter, setHomeStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    setTeamPage(1);
    setPersonalPage(1);
  }, [filterEmployee, filterDistrict, selectMonth, homeStatusFilter, filterZone]);

  useEffect(() => {
    setFilterDistrict("all");
    setFilterEmployee("all");
  }, [filterZone]);

  useEffect(() => {
    setFilterEmployee("all");
  }, [filterDistrict]);

  const refreshDashboardData = async () => {
    const currentUser = authService.getCurrentUser() || user;
    if (!currentUser) return;

    const uId = currentUser.user_id;
    const allowedWindows = currentUser.allowed_windows
      ? currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
      : ["home", "profile", "help"];
    const userRoleLower = (currentUser.role || "").trim().toLowerCase();
    const isSpecialViewRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
    const isReviewer = allowedWindows.includes("approval") || isSpecialViewRole;

    // 1. My Expenses - memory cached / prefetch optimized
    prefetchManager.getOrFetch(`my_expenses_${uId}_${selectMonth}`, () => expenseService.getExpenses(selectMonth), 30000)
      .then((myData) => {
        if (Array.isArray(myData)) {
          setMyExpenses(myData);
          localStorage.setItem(`cache_my_expenses_${uId}_${selectMonth}`, JSON.stringify(myData));
          localStorage.setItem(`cache_my_expenses_${uId}`, JSON.stringify(myData));
        }
        setLoadingMyExpenses(false);
      })
      .catch((err) => {
        console.error("Error fetching my expenses:", err);
        setLoadingMyExpenses(false);
      });

    // 2. Allowance Stats - memory cached / prefetch optimized
    prefetchManager.getOrFetch(`allowance_stats_${uId}_${selectMonth}`, () => expenseService.getExpenseInit(uId, selectMonth), 30000)
      .then((initData) => {
        if (initData && initData.allowance) {
          const stats = {
            policy_missing: !!initData.allowance.policy_missing || initData.allowance.daily_in_district === null || initData.allowance.daily_in_district === undefined,
            currentKm: initData.allowance.current_month_km || 0,
            maxKm: (initData.allowance.max_km_per_month || 0) + (initData.approved_km || 0),
            currentAuto: initData.allowance.current_month_auto || 0,
            maxAuto: (initData.allowance.max_auto_per_month || 0) + (initData.approved_auto || 0),
            vehicleType: initData.allowance.vehicle_type || "Bike",
            rateBike: initData.allowance.rate_bike || 0,
            rateCar: initData.allowance.rate_car || 0
          };
          setAllowanceStats(stats);
          localStorage.setItem(`cache_allowance_stats_${uId}_${selectMonth}`, JSON.stringify(stats));
          localStorage.setItem(`cache_allowance_stats_${uId}`, JSON.stringify(stats));
        }
      })
      .catch((err) => console.error("Error fetching allowance stats:", err));

    if (isReviewer) {
      // 3. Pending Approvals & Extension Count - memory cached / prefetch optimized
      prefetchManager.getOrFetch("pending_approvals", () => approvalService.getPendingApprovals(), 30000)
        .then((appData) => {
          if (Array.isArray(appData)) {
            const limitCount = appData.filter((a: any) => a.category === "Limit Request").length;
            const standardCount = appData.filter((a: any) => a.category !== "Limit Request").length;
            setPendingApprovalsCount(standardCount);
            setPendingLimitRequestsCount(limitCount);
            localStorage.setItem(`cache_approvals_count_${uId}`, standardCount.toString());
            localStorage.setItem(`cache_limit_approvals_count_${uId}`, limitCount.toString());
          }
        })
        .catch((err) => console.error("Error fetching approvals count:", err));

      // 4. Team Expenses - memory cached / prefetch optimized
      prefetchManager.getOrFetch(`team_expenses_${uId}_${selectMonth}`, () => expenseService.getTeamExpenses(selectMonth), 30000)
        .then((teamData) => {
          if (Array.isArray(teamData)) {
            setTeamExpenses(teamData);
            localStorage.setItem(`cache_team_expenses_${uId}_${selectMonth}`, JSON.stringify(teamData));
            localStorage.setItem(`cache_team_expenses_${uId}`, JSON.stringify(teamData));
          }
          setLoadingTeamExpenses(false);
        })
        .catch((err) => {
          console.error("Error fetching team expenses:", err);
          setLoadingTeamExpenses(false);
        });
    }
  };

  const handleApprove = async () => {
    if (!claimDetails) return;
    setActionLoading(true);
    try {
      await approvalService.approveExpense(claimDetails.id, comments.trim());
      toast.success(`Claim ${claimDetails.expense_code} approved!`);
      setShowDetailsModal(false);
      setClaimDetails(null);
      // Invalidate memory cache on action success
      prefetchManager.invalidateApprovals(user?.user_id || "");
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!claimDetails) return;
    if (!comments.trim()) {
      toast.error("Rejection remarks comments are mandatory.");
      return;
    }
    setActionLoading(true);
    try {
      await approvalService.rejectExpense(claimDetails.id, comments.trim());
      toast.error(`Claim ${claimDetails.expense_code} rejected.`);
      setShowDetailsModal(false);
      setClaimDetails(null);
      // Invalidate memory cache on action success
      prefetchManager.invalidateApprovals(user?.user_id || "");
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate("/login");
      return;
    }
    setUser(currentUser);

    const uId = currentUser.user_id;
    const cachedMy = localStorage.getItem(`cache_my_expenses_${uId}_${selectMonth}`);
    if (cachedMy) {
      try {
        setMyExpenses(JSON.parse(cachedMy));
        setLoadingMyExpenses(false);
      } catch (e) {}
    }
    const cachedTeam = localStorage.getItem(`cache_team_expenses_${uId}_${selectMonth}`);
    if (cachedTeam) {
      try {
        setTeamExpenses(JSON.parse(cachedTeam));
        setLoadingTeamExpenses(false);
      } catch (e) {}
    }
    const cachedStats = localStorage.getItem(`cache_allowance_stats_${uId}_${selectMonth}`);
    if (cachedStats) {
      try {
        setAllowanceStats(JSON.parse(cachedStats));
      } catch (e) {}
    }

    refreshDashboardData();
  }, [navigate, selectMonth]);

  useEffect(() => {
    const handleProfileSync = () => {
      console.log("[HomePage] User profile synced, refreshing data...");
      const freshUser = authService.getCurrentUser();
      if (freshUser) {
        setUser(freshUser);
        refreshDashboardData();
      }
    };
    window.addEventListener("user-profile-synced", handleProfileSync);
    return () => window.removeEventListener("user-profile-synced", handleProfileSync);
  }, []);

  useEffect(() => {
    const handlePullRefresh = () => {
      const currentUser = authService.getCurrentUser() || user;
      if (currentUser) {
        const uId = currentUser.user_id;
        localStorage.removeItem(`cache_approvals_count_${uId}`);
        localStorage.removeItem(`cache_team_expenses_${uId}`);
        localStorage.removeItem(`cache_my_expenses_${uId}`);
        localStorage.removeItem(`cache_allowance_stats_${uId}`);
      }
      refreshDashboardData();
    };

    window.addEventListener("app-pull-to-refresh", handlePullRefresh);
    return () => window.removeEventListener("app-pull-to-refresh", handlePullRefresh);
  }, [user]);

  if (!user) return null;

  const allowedWindows = user.allowed_windows
    ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
    : ["home", "profile", "help"];
  const userRoleLower = (user?.role || "").trim().toLowerCase();
  const isSpecialViewRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
  const isReviewerRole = allowedWindows.includes("approval") || isSpecialViewRole;



  const getStatusBadgeClass = (status: string, record?: any) => {
    const s = (status || "").toLowerCase();
    if (s === "auto_approved" || record?.is_auto_approved || record?.auto_approved) {
      return "bg-emerald-100 border-emerald-300 text-emerald-900 font-extrabold";
    }
    if (s === "approved") {
      return "bg-emerald-50 border-emerald-300 text-emerald-800 font-extrabold";
    }
    if (s === "rejected") {
      return "bg-rose-50 border-rose-300 text-rose-700 font-extrabold";
    }
    if (s === "returned_to_draft") {
      return "bg-amber-100 border-amber-300 text-amber-900 font-extrabold";
    }
    // Level-specific distinct pending colors:
    if (s === "submitted" || s === "submitted_l1" || s === "pending_l1") {
      return "bg-amber-50 border-amber-300 text-amber-900 font-black";
    }
    if (s === "submitted_l2" || s === "pending_l2") {
      return "bg-purple-50 border-purple-300 text-purple-900 font-black";
    }
    if (s === "submitted_l3" || s === "pending_l3" || s.startsWith("submitted_l") || s.startsWith("pending_l")) {
      return "bg-indigo-50 border-indigo-300 text-indigo-900 font-black";
    }
    if (s === "draft") {
      return "bg-slate-100 border-slate-300 text-slate-700 font-bold";
    }
    return "bg-slate-50 border-slate-200 text-slate-700 font-bold";
  };

  const getStatusLabel = (status: string, record?: any) => {
    const s = (status || "").toLowerCase();
    if (s === "auto_approved" || record?.is_auto_approved || record?.auto_approved) return "⚡ Auto Approved";
    if (s === "approved") return "Approved";
    if (s === "rejected") return "Rejected";
    if (s === "returned_to_draft") return "Returned";
    if (s === "submitted" || s === "submitted_l1") return "Pending L1";
    if (s.startsWith("submitted_l")) {
      const lvl = s.replace("submitted_l", "");
      return `Pending L${lvl.toUpperCase()}`;
    }
    if (s.startsWith("pending_l")) {
      const lvl = s.replace("pending_l", "");
      return `Pending L${lvl.toUpperCase()}`;
    }
    if (s === "draft") return "Draft";
    if (s === "pending") return "Pending L1";
    return (status || "").toUpperCase();
  };

  const normalizeClaimObject = (raw: any, basicClaim?: any) => {
    if (!raw) return null;
    return {
      ...raw,
      submitter_name: raw.submitter_name || basicClaim?.submitter_name || user?.name || "",
      submitter_code: raw.submitter_code || basicClaim?.submitter_code || user?.user_id || "",
      zone: raw.zone || raw.submitter_zone || raw.user_zone || basicClaim?.zone || basicClaim?.submitter_zone || "",
      home_district: raw.home_district || raw.district || raw.submitter_district || basicClaim?.submitter_district || basicClaim?.home_district || "",
      designation: raw.designation || raw.submitter_designation || basicClaim?.submitter_designation || basicClaim?.designation || "",
      category: raw.category || raw.travel_mode || basicClaim?.category || "Travel",
      date: raw.date || raw.itinerary || basicClaim?.date || "",
      purpose: raw.purpose || raw.description || basicClaim?.purpose || "",
      itineraries: (raw.itineraries && raw.itineraries.length > 0)
        ? raw.itineraries
        : (raw.legs || basicClaim?.itineraries || []),
      edit_history: raw.edit_history || raw.editHistory || raw.edit_logs || raw.logs || basicClaim?.edit_history || []
    };
  };

  const handleOpenClaimDetails = async (claimId: number | string) => {
    setSelectedClaimId(claimId);
    setShowDetailsModal(true);
    const listExpenses = [
      ...(Array.isArray(myExpenses) ? myExpenses : []),
      ...(Array.isArray(teamExpenses) ? teamExpenses : [])
    ];
    const basicClaim = listExpenses.find(e => e && (String(e.id) === String(claimId) || String(e.expense_code) === String(claimId) || String(e.expense_id) === String(claimId)));
    if (basicClaim) {
      setClaimDetails(normalizeClaimObject(basicClaim));
    } else {
      setClaimDetails(null);
    }

    const cacheKey = `cache_claim_detail_${claimId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setClaimDetails(normalizeClaimObject(JSON.parse(cached), basicClaim));
        setLoadingDetails(false);
      } catch (e) {}
      expenseService.getExpenseDetails(claimId)
        .then(data => {
          if (data) {
            const norm = normalizeClaimObject(data, basicClaim);
            setClaimDetails(norm);
            localStorage.setItem(cacheKey, JSON.stringify(norm));
          }
        })
        .catch(() => {});
    } else {
      setLoadingDetails(true);
      try {
        const data = await expenseService.getExpenseDetails(claimId);
        if (data) {
          const norm = normalizeClaimObject(data, basicClaim);
          setClaimDetails(norm);
          localStorage.setItem(cacheKey, JSON.stringify(norm));
        }
      } catch (err) {
        if (!basicClaim) {
          toast.error("Failed to load expense details.");
          setShowDetailsModal(false);
        }
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleDeleteClaim = async (claimId: number) => {
    if (!window.confirm("Are you sure you want to delete this expense claim? This action is irreversible.")) return;
    try {
      await expenseService.deleteExpense(claimId);
      toast.success("Expense claim deleted successfully.");
      setShowDetailsModal(false);
      setClaimDetails(null);
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete expense claim.");
    }
  };


  const safeMyExpenses = Array.isArray(myExpenses) ? myExpenses : [];
  const safeTeamExpenses = Array.isArray(teamExpenses) ? teamExpenses : [];

  const uniqueDistricts = React.useMemo(() => {
    const districtsSet = new Set<string>();
    safeTeamExpenses.forEach(exp => {
      if (!exp) return;
      const expZone = exp.zone || "";
      if (filterZone === "all" || cleanZone(expZone) === cleanZone(filterZone)) {
        const d = exp.district || exp.submitter_district || exp.home_district || exp.from_district || "";
        const cleanDist = String(d).trim();
        if (cleanDist && cleanDist.toLowerCase() !== "unknown") {
          districtsSet.add(cleanDist);
        }
      }
    });
    return Array.from(districtsSet).sort((a, b) => a.localeCompare(b));
  }, [safeTeamExpenses, filterZone]);

  const uniqueEmployees = React.useMemo(() => {
    const empMap = new Map<string, string>();
    safeTeamExpenses.forEach(exp => {
      if (!exp || !exp.submitter_code || !exp.submitter_name) return;
      const expZone = exp.zone || "";
      const expDist = exp.district || exp.submitter_district || exp.home_district || exp.from_district || "";
      
      const matchesZone = filterZone === "all" || cleanZone(expZone) === cleanZone(filterZone);
      const matchesDistrict = filterDistrict === "all" || String(expDist).trim().toLowerCase() === filterDistrict.trim().toLowerCase();
      
      if (matchesZone && matchesDistrict) {
        empMap.set(String(exp.submitter_code), String(exp.submitter_name));
      }
    });
    return Array.from(empMap.entries())
      .map(([code, name]) => ({ code: String(code), name: String(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [safeTeamExpenses, filterZone, filterDistrict]);

  // Role-based zone restrictions for filter dropdown
  const currentUserObj = JSON.parse(localStorage.getItem("user") || "null") || user;
  const effectiveUserRoleLower = (currentUserObj?.role || "").trim().toLowerCase();
  const isGlobalAdminRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(effectiveUserRoleLower);
  
  const userZoneRaw = currentUserObj?.zone || "";
  const userZonesList = userZoneRaw
    ? userZoneRaw.split(",").map((z: string) => cleanZone(z)).filter(Boolean)
    : [];

  const allPossibleZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];
  const dataZones = Array.from(
    new Set(
      safeTeamExpenses
        .map(e => {
          const raw = (e.zone || "").trim();
          return raw ? raw.replace(/\s*[Zz]one\s*$/i, "") : "Unassigned Zone";
        })
        .filter(Boolean)
    )
  );
  const allAvailableZones = Array.from(new Set([...allPossibleZones, ...dataZones])).sort((a, b) => a.localeCompare(b));
  let uniqueZones = allAvailableZones;

  if (!isGlobalAdminRole && userZonesList.length > 0) {
    uniqueZones = allAvailableZones.filter(z => userZonesList.includes(cleanZone(z)));
    if (uniqueZones.length === 0) {
      uniqueZones = userZonesList;
    }
  }

  // Zone Mapping Audit Check: verify total claims count equals sum across all zones
  useEffect(() => {
    if (!safeTeamExpenses || safeTeamExpenses.length === 0) return;
    const totalClaims = safeTeamExpenses.length;
    const zoneCounts: Record<string, number> = {};
    let unassignedCount = 0;

    safeTeamExpenses.forEach(exp => {
      let z = (exp.zone || "").trim();
      if (!z || z.toLowerCase() === "unknown") z = "Unassigned Zone";
      else z = z.replace(/\s*[Zz]one\s*$/i, "");
      
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      if (z === "Unassigned Zone") unassignedCount++;
    });

    const sumCounts = Object.values(zoneCounts).reduce((a, b) => a + b, 0);
    if (sumCounts !== totalClaims || unassignedCount > 0) {
      console.warn(
        `[Zone Mapping Audit Check] Total claims: ${totalClaims}, Sum across zones: ${sumCounts}. Unassigned claims: ${unassignedCount}`,
        zoneCounts
      );
    }
  }, [safeTeamExpenses]);


  const matchClaimSearch = (exp: any, searchStr: string): boolean => {
    if (!searchStr || !searchStr.trim()) return true;
    const q = searchStr.trim().toLowerCase();
    
    // 1. Raw expense code / claim ID match (e.g. "RJ-08/26-000094")
    const code = String(exp.expense_code || exp.claim_id || exp.id || "").toLowerCase();
    if (code.includes(q)) return true;

    // 2. Match digits sequence (e.g. "0826000094" includes "094" or "94")
    const codeDigitsOnly = code.replace(/\D/g, "");
    const qDigitsOnly = q.replace(/\D/g, "");
    if (qDigitsOnly && codeDigitsOnly.includes(qDigitsOnly)) return true;

    // 3. Match last segment of claim ID (e.g. "000094" -> "094" or "94")
    const parts = code.split(/[-/]/);
    const lastPart = parts[parts.length - 1] || "";
    if (lastPart.includes(q)) return true;
    if (lastPart.replace(/^0+/, "").includes(q.replace(/^0+/, ""))) return true;

    // 4. Submitter / Engineer Name
    const name = String(exp.submitter_name || exp.user_name || exp.engineer_name || "").toLowerCase();
    if (name.includes(q)) return true;

    // 5. Employee Code (e.g. E1812)
    const empCode = String(exp.submitter_code || exp.emp_code || exp.user_code || "").toLowerCase();
    if (empCode.includes(q)) return true;

    // 6. Purpose / Description
    const desc = String(exp.description || exp.purpose || "").toLowerCase();
    if (desc.includes(q)) return true;

    return false;
  };

  // Filter personal claims to match currently selected selectMonth (YYYY-MM format), Date Range & Claim ID search
  const getFilteredPersonalExpenses = () => {
    return safeMyExpenses.filter(exp => {
      if (!exp) return false;
      const rawDate = exp.itinerary || exp.date;
      if (!(rawDate && rawDate.startsWith(selectMonth))) return false;
      if (fromDate && rawDate < fromDate) return false;
      if (toDate && rawDate > toDate) return false;
      if (!matchClaimSearch(exp, searchClaimId)) return false;
      if (homeStatusFilter !== "all") {
        const s = (exp.status || "").toLowerCase();
        if (homeStatusFilter === "pending") {
          if (!(s.startsWith("submitted") || s === "pending" || s === "draft" || s === "returned_to_draft")) return false;
        } else if (homeStatusFilter === "approved") {
          if (s !== "approved") return false;
        } else if (homeStatusFilter === "rejected") {
          if (s !== "rejected") return false;
        }
      }
      return true;
    });
  };

  const filteredPersonalExpenses = getFilteredPersonalExpenses();
  const paginatedPersonalExpenses = filteredPersonalExpenses.slice((personalPage - 1) * homeClaimsPageSize, personalPage * homeClaimsPageSize);

  const getFilteredTeamExpenses = () => {
    return safeTeamExpenses.filter(exp => {
      const rawDate = exp.date || exp.itinerary;
      if (rawDate && !rawDate.startsWith(selectMonth)) return false;
      if (fromDate && rawDate < fromDate) return false;
      if (toDate && rawDate > toDate) return false;
      if (!matchClaimSearch(exp, searchClaimId)) return false;
      if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
      if (filterDistrict !== "all") {
        const expDist = String(exp.district || exp.submitter_district || exp.home_district || exp.from_district || "").trim();
        if (expDist.toLowerCase() !== filterDistrict.trim().toLowerCase()) return false;
      }
      if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
      if (homeStatusFilter !== "all") {
        const s = (exp.status || "").toLowerCase();
        if (homeStatusFilter === "pending") {
          if (!(s.startsWith("submitted") || s === "pending" || s === "draft" || s === "returned_to_draft")) return false;
        } else if (homeStatusFilter === "approved") {
          if (s !== "approved") return false;
        } else if (homeStatusFilter === "rejected") {
          if (s !== "rejected") return false;
        }
      }
      return true;
    });
  };

  const filteredTeamExpenses = getFilteredTeamExpenses();
  const paginatedTeamExpenses = filteredTeamExpenses.slice((teamPage - 1) * homeTeamPageSize, teamPage * homeTeamPageSize);

  // ----------------------------------------------------
  // ENTERPRISE DATA-GRID TABLE COLUMNS & FORMATTERS
  // ----------------------------------------------------
  const formatDateDDMMMYY = (dateStr: string) => {
    if (!dateStr) return "—";
    const cleanStr = String(dateStr).trim().split(" ")[0].split("T")[0];
    const parts = cleanStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const year = parts[0].slice(-2);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parts[2].padStart(2, "0");
        if (monthIdx >= 0 && monthIdx < 12) return `${day}-${months[monthIdx]}-${year}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        const year = parts[2].slice(-2);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parts[0].padStart(2, "0");
        if (monthIdx >= 0 && monthIdx < 12) return `${day}-${months[monthIdx]}-${year}`;
      }
    }
    
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    }
    return dateStr;
  };

  const checkIsOutDistrict = (record: any): boolean => {
    if (record.districtType === "outstation" || record.is_outstation || record.travel_type === "outstation" || record.is_out_district) return true;
    if (record.from_district && record.to_district && record.from_district.trim().toLowerCase() !== record.to_district.trim().toLowerCase()) return true;
    if (record.category && record.category.toLowerCase().includes("outstation")) return true;
    return false;
  };

  const getEnterpriseClaimsColumns = () => [
    // 1. ENGINEER
    {
      title: "ENGINEER",
      key: "engineer",
      width: "14%",
      render: (_: any, record: any) => {
        const name = record.submitter_name || record.user_name || record.engineer_name || user?.name || "Engineer";
        const code = record.submitter_code || record.user_code || record.emp_code || "";
        const actualDesignation = record.designation || record.submitter_designation || record.user_designation || record.role_name || record.submitter_role || record.role || (code === user?.user_id ? user?.designation : "") || "";

        return (
          <div className="flex flex-col justify-center py-0.5 leading-tight">
            <span className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={name}>
              {name}
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5 max-w-[130px]" title={actualDesignation}>
              {code ? `${code}${actualDesignation ? ` · ${actualDesignation}` : ""}` : (actualDesignation || "—")}
            </span>
          </div>
        );
      }
    },

    // 2. CLAIM ID
    {
      title: "CLAIM ID",
      dataIndex: "expense_code",
      key: "expense_code",
      width: "11%",
      render: (text: string, record: any) => {
        const code = text || record.claim_id || `#${record.id}`;
        const isOut = checkIsOutDistrict(record);

        return (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span 
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOut ? "bg-amber-600 shadow-2xs" : "bg-blue-600 shadow-2xs"}`} 
              title={isOut ? "Out-District Travel" : "In-District Travel"}
            />
            <span className={`font-mono text-[10.5px] font-extrabold px-1 py-0.5 rounded border ${
              isOut 
                ? "text-[#C2410C] bg-amber-50/90 border-amber-200/90" 
                : "text-[#2563EB] bg-blue-50/90 border-blue-200/90"
            }`}>
              {code}
            </span>
          </div>
        );
      }
    },

    // 3. CLAIM DATE
    {
      title: "CLAIM DATE",
      key: "claim_date",
      width: "9%",
      render: (_: any, record: any) => {
        const dateVal = record.date || record.itinerary || record.created_at;
        return (
          <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
            {formatDateDDMMMYY(dateVal)}
          </span>
        );
      }
    },

    // 4. PURPOSE
    {
      title: "PURPOSE",
      dataIndex: "description",
      key: "purpose",
      width: "18%",
      render: (text: string, record: any) => {
        let desc = text || record.purpose || "Field visit & operational claim";
        const callsComp = record.calls_completed ?? record.calls ?? 0;
        
        if (callsComp === 0) {
          if (desc.includes("Calls")) {
            desc = desc.replace("Activities: Calls, ", "Activities: ")
                       .replace("Activities: Calls", "Activities: Other")
                       .replace("Calls, ", "")
                       .replace("Calls", "").trim();
            if (desc === "Activities:" || !desc) desc = "Field visit";
          }
        }

        return (
          <div className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight pr-1" title={desc}>
            {desc}
          </div>
        );
      }
    },

    // 5. TRAVEL MODE(S)
    {
      title: "TRAVEL MODE",
      key: "travel_modes",
      width: "11%",
      render: (_: any, record: any) => {
        const rawModes = record.travel_mode || record.travel_modes || record.category || "Bike";
        const modesList = typeof rawModes === "string" 
          ? rawModes.split(",").map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(rawModes) ? rawModes : [String(rawModes)];

        const getChipColor = (m: string) => {
          const lower = m.toLowerCase();
          if (lower.includes("bike") || lower.includes("two")) return "bg-cyan-50 text-cyan-800 border-cyan-200/90";
          if (lower.includes("car") || lower.includes("four")) return "bg-indigo-50 text-indigo-800 border-indigo-200/90";
          if (lower.includes("auto") || lower.includes("rickshaw")) return "bg-amber-50 text-amber-800 border-amber-200/90";
          if (lower.includes("bus") || lower.includes("train")) return "bg-emerald-50 text-emerald-800 border-emerald-200/90";
          return "bg-slate-100 text-slate-700 border-slate-200";
        };

        return (
          <div className="flex flex-wrap gap-1 items-center">
            {modesList.map((mode: string, idx: number) => (
              <span
                key={idx}
                className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-tight border ${getChipColor(mode)} shadow-2xs whitespace-nowrap`}
              >
                {mode}
              </span>
            ))}
          </div>
        );
      }
    },

    // 6. TOTAL TA
    {
      title: "TOTAL TA",
      key: "total_ta",
      width: "8%",
      align: "right" as const,
      render: (_: any, record: any) => {
        const ta = record.total_ta != null ? record.total_ta : (record.total_auto || 0) + ((record.total_km || 0) * 3.5);
        return (
          <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
            {ta > 0 ? `₹${Math.round(ta).toLocaleString()}` : "—"}
          </span>
        );
      }
    },

    // 7. TOTAL DA
    {
      title: "TOTAL DA",
      key: "total_da",
      width: "7%",
      align: "right" as const,
      render: (_: any, record: any) => {
        const da = record.total_da != null ? record.total_da : (record.da_amount || 0);
        return (
          <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
            {da > 0 ? `₹${Math.round(da).toLocaleString()}` : "—"}
          </span>
        );
      }
    },

    // 8. TASK TYPE / ACTIVITY BOXES (Distinct Colored Boxes for Calls, PMS, etc.)
    {
      title: "WORK DONE",
      key: "task_type",
      width: "13%",
      render: (_: any, record: any) => {
        const boxes: React.ReactNode[] = [];

        // 1. Calls Box (Blue)
        const callsComp = record.calls_completed ?? record.calls ?? 0;
        let callsAssign = record.calls_assigned ?? 0;
        if (callsComp === 0) callsAssign = 0;

        if (callsAssign > 0 || callsComp > 0) {
          const text = callsAssign > 0 ? `${callsComp}/${callsAssign} Calls` : `${callsComp} Calls`;
          boxes.push(
            <span
              key="calls"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs whitespace-nowrap"
            >
              📞 {text}
            </span>
          );
        }

        // 2. PMS Box (Emerald Green)
        const pmsComp = record.pms_completed ?? record.pms_count ?? record.pms ?? 0;
        const pmsAssign = record.pms_assigned ?? 0;
        if (pmsAssign > 0 || pmsComp > 0) {
          const text = pmsAssign > 0 ? `${pmsComp}/${pmsAssign} PMS` : `${pmsComp} PMS`;
          boxes.push(
            <span
              key="pms"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs whitespace-nowrap"
            >
              🔧 {text}
            </span>
          );
        }

        // 3. Dynamic Task Types (Calibration, Installation, Breakdown, etc.)
        const rawTasks = record.task_type || record.work_type || record.tasks || record.call_types || "";
        if (rawTasks) {
          const taskList = typeof rawTasks === "string"
            ? rawTasks.split(",").map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(rawTasks) ? rawTasks : [String(rawTasks)];

          taskList.forEach((task: string, idx: number) => {
            const lower = task.toLowerCase();
            let colorClass = "bg-purple-50 text-purple-700 border-purple-200/90";
            let prefix = "⚡";

            if (lower.includes("calib")) {
              colorClass = "bg-purple-50 text-purple-700 border-purple-200/90";
              prefix = "🎯";
            } else if (lower.includes("install")) {
              colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200/90";
              prefix = "⚙️";
            } else if (lower.includes("breakdown") || lower.includes("repair")) {
              colorClass = "bg-rose-50 text-rose-700 border-rose-200/90";
              prefix = "🚨";
            } else if (lower.includes("call") || lower.includes("pms")) {
              return; // Already rendered with exact counts above
            }

            boxes.push(
              <span
                key={`task-${idx}`}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold border shadow-2xs whitespace-nowrap ${colorClass}`}
              >
                {prefix} {task}
              </span>
            );
          });
        }

        // Fallback if no specific call/pms/task found
        if (boxes.length === 0) {
          boxes.push(
            <span
              key="general"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 whitespace-nowrap"
            >
              Field Visit
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1 items-center">
            {boxes}
          </div>
        );
      }
    },

    // 9. TOTAL AMOUNT
    {
      title: "TOTAL AMOUNT",
      dataIndex: "amount",
      key: "total_amount",
      width: "9%",
      align: "right" as const,
      render: (val: number, record: any) => {
        const amt = val != null ? val : record.total_amount || 0;
        return (
          <span className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
            ₹{amt.toLocaleString()}
          </span>
        );
      }
    },

    // 10. STATUS
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "10%",
      align: "center" as const,
      render: (status: string, record: any) => (
        <span className={`inline-block px-1.5 py-0.5 rounded border text-[9.5px] font-black uppercase tracking-tight whitespace-nowrap shadow-2xs ${getStatusBadgeClass(status, record)}`}>
          {getStatusLabel(status, record)}
        </span>
      )
    }
  ];

  // Stats calculations based on current active tab, respecting zone, employee, and mode filters, but NOT the status tab filter
  const statsBasePersonalExpenses = safeMyExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.itinerary || exp.date;
    if (fromDate && rawDate && rawDate < fromDate) return false;
    if (toDate && rawDate && rawDate > toDate) return false;
    if (!fromDate && !toDate && selectMonth && rawDate && !rawDate.startsWith(selectMonth)) return false;
    if (!matchClaimSearch(exp, searchClaimId)) return false;
    return true;
  });

  const statsBaseTeamExpenses = safeTeamExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.date || exp.itinerary;
    if (fromDate && rawDate && rawDate < fromDate) return false;
    if (toDate && rawDate && rawDate > toDate) return false;
    if (!fromDate && !toDate && selectMonth && rawDate && !rawDate.startsWith(selectMonth)) return false;
    if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
    if (filterDistrict !== "all") {
      const expDist = String(exp.district || exp.submitter_district || exp.home_district || exp.from_district || "").trim();
      if (expDist.toLowerCase() !== filterDistrict.trim().toLowerCase()) return false;
    }
    if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
    if (!matchClaimSearch(exp, searchClaimId)) return false;
    return true;
  });

  const statsClaimsList = activeTab === "my-claims" ? statsBasePersonalExpenses : statsBaseTeamExpenses;

  const statsTotalClaims = statsClaimsList;
  const statsApprovedClaims = statsClaimsList.filter(c => c.status?.toLowerCase() === "approved");
  const statsRejectedClaims = statsClaimsList.filter(c => c.status?.toLowerCase() === "rejected");
  const statsPendingClaims = statsClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s.startsWith("submitted") || s === "pending" || s === "draft" || s === "returned_to_draft";
  });

  const getStatsSums = (list: any[]) => list.filter(c => c.category !== "Limit Request").reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalAmount = getStatsSums(statsTotalClaims);
  const approvedAmount = getStatsSums(statsApprovedClaims);
  const pendingAmount = getStatsSums(statsPendingClaims);
  const rejectedAmount = getStatsSums(statsRejectedClaims);

  // KM and Auto totals respect active tab and all filters
  const statsNonLimitList = statsClaimsList.filter(e => e.category !== "Limit Request");
  const totalFilteredKmStats = statsNonLimitList.reduce((sum, e) => sum + (e.total_km || 0), 0);
  const totalFilteredAutoStats = statsNonLimitList.reduce((sum, e) => sum + (e.total_auto || 0), 0);

  // const handleOpenStatsModal = (type: "Total Claimed" | "Approved" | "Pending" | "Rejected", list: any[]) => {
  //   setStatsModalType(type);
  //   setStatsModalClaims(list);
  //   setShowStatsModal(true);
  // };

  return (
    <>
      <style>{`
        @keyframes wave-animation {
          0% { transform: rotate(0.0deg) }
          10% { transform: rotate(14.0deg) }
          20% { transform: rotate(-8.0deg) }
          30% { transform: rotate(14.0deg) }
          40% { transform: rotate(-4.0deg) }
          50% { transform: rotate(10.0deg) }
          60% { transform: rotate(0.0deg) }
          100% { transform: rotate(0.0deg) }
        }
        .animate-wave {
          animation: wave-animation 2.5s infinite;
          transform-origin: 70% 70%;
          display: inline-block;
        }
        .status-segmented-all .ant-segmented-item-selected {
          background-color: #4f46e5 !important;
        }
        .status-segmented-all .ant-segmented-item-selected * {
          color: white !important;
        }
        .status-segmented-pending .ant-segmented-item-selected {
          background-color: #f97316 !important;
        }
        .status-segmented-pending .ant-segmented-item-selected * {
          color: white !important;
        }
        .status-segmented-approved .ant-segmented-item-selected {
          background-color: #10b981 !important;
        }
        .status-segmented-approved .ant-segmented-item-selected * {
          color: white !important;
        }
        .status-segmented-rejected .ant-segmented-item-selected {
          background-color: #ef4444 !important;
        }
        .status-segmented-rejected .ant-segmented-item-selected * {
          color: white !important;
        }
        .rounded-none-modal,
        .rounded-none-modal .ant-modal-content,
        .rounded-none-modal * {
          border-radius: 0px !important;
        }
        .sharp-card,
        .sharp-card * {
          border-radius: 0px !important;
        }
        /* Complete reset for Ant Design Select input field to avoid global styles collision */
        .ant-select-selector input,
        .ant-select-selection-search input,
        .ant-select-selection-search-input {
          min-height: unset !important;
          height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .ant-select-selector {
          height: 32px !important;
          min-height: 32px !important;
          padding: 0 8px !important;
          border-radius: 4px !important;
          border: 1px solid #cbd5e1 !important;
          background-color: #ffffff !important;
          display: flex !important;
          align-items: center !important;
        }
        .ant-select-selection-item {
          line-height: 30px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
        }
      `}</style>
      <div className="space-y-3 sm:space-y-4 animate-fadeIn text-[#212529] p-0 sm:p-2 md:p-4 w-full max-w-none">
        
        {/* Darker Slate-Blue Enterprise Header Bar (#4A6A8A) */}
        <div className="bg-[#4A6A8A] text-white rounded-lg px-3 py-1.5 flex items-center justify-between shadow-2xs mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/15 text-white font-semibold text-xs flex items-center justify-center shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white tracking-normal">
                {(() => {
                  const hour = new Date().getHours();
                  if (hour < 12) return "Good Morning";
                  if (hour < 17) return "Good Afternoon";
                  return "Good Evening";
                })()}, {user?.name || "User"}
              </span>
              <span className="animate-wave text-xs select-none">👋</span>
              {user?.role && (
                <span className="text-white/60 text-[10px] font-normal leading-none ml-1">
                  ({user.role})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button 
              onClick={() => refreshDashboardData()}
              className="bg-white/10 hover:bg-white/20 text-white border-0 font-medium text-[10px] h-6 px-2 rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} className="text-white" />
              Refresh
            </Button>
          </div>
        </div>

        {allowanceStats?.policy_missing && (
          <Alert
            message={<strong>Policy Data Missing</strong>}
            description="Policy data load नहीं हुआ, कृपया page reload करें"
            type="error"
            showIcon
            icon={<AlertTriangle className="text-red-600 shrink-0" size={14} />}
            className="mb-2 py-0.5 px-2 rounded bg-red-50 border-red-200 text-xs"
          />
        )}

        {isReviewerRole && pendingLimitRequestsCount > 0 && (
          <Alert
            message={<strong>Pending Limit Extension Requests</strong>}
            description={`You have ${pendingLimitRequestsCount} pending limit request${pendingLimitRequestsCount > 1 ? 's' : ''} from your team awaiting your review.`}
            type="warning"
            showIcon
            icon={<AlertTriangle className="text-amber-600 shrink-0" size={14} />}
            className="mb-2 py-0.5 px-2 rounded bg-amber-50/70 border-amber-200 text-xs"
            action={
              <Button size="small" type="primary" className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-medium h-5 px-1.5 rounded" onClick={() => navigate("/approval-center")}>
                Review Now
              </Button>
            }
          />
        )}

        {/* Compact High-Density Stat Cards */}
        <div className="space-y-1 mb-2">
          <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-normal text-white uppercase">
              {activeTab === "my-claims" ? "MY EXPENSE SUMMARY" : "TEAM EXPENSE SUMMARY"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium text-white/80 tracking-normal">MONTH:</span>
              <input 
                type="month"
                value={selectMonth}
                onChange={(e) => setSelectMonth(e.target.value)}
                className="bg-white/15 text-white border-0 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer focus:outline-none"
              />
            </div>
          </div>
          
          {/* Ultra-Slim Datacard Micro-Bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
            {/* Card 1: Total Claimed */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={FileText} gradientFrom="from-blue-500" gradientTo="to-indigo-600" shadowColor="rgba(37, 99, 235, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL CLAIMED</span>
                    <span className="text-[8px] font-medium text-slate-600 bg-slate-100/80 px-1 py-0.5 rounded border border-slate-200/80 leading-none shrink-0">{statsTotalClaims.length} Claims</span>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-slate-900 leading-none mt-1 whitespace-nowrap">₹{(totalAmount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total KM */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={Route} gradientFrom="from-amber-500" gradientTo="to-amber-600" shadowColor="rgba(245, 158, 11, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL KM</span>
                  <span className="text-[13px] font-mono font-bold text-amber-900 leading-none mt-1 whitespace-nowrap">{(totalFilteredKmStats || 0).toFixed(1)} KM</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Auto */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={Car} gradientFrom="from-purple-500" gradientTo="to-indigo-600" shadowColor="rgba(147, 51, 234, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL AUTO</span>
                  <span className="text-[13px] font-mono font-bold text-purple-950 leading-none mt-1 whitespace-nowrap">₹{(totalFilteredAutoStats || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Approved */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={CheckCircle2} gradientFrom="from-emerald-500" gradientTo="to-teal-600" shadowColor="rgba(16, 185, 129, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">APPROVED</span>
                    <span className="text-[8px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60 leading-none shrink-0">{statsApprovedClaims.length} Claims</span>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-emerald-800 leading-none mt-1 whitespace-nowrap">₹{(approvedAmount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 5: Pending */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={Clock} gradientFrom="from-orange-500" gradientTo="to-amber-600" shadowColor="rgba(249, 115, 22, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">PENDING</span>
                    <span className="text-[8px] font-medium text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/60 leading-none shrink-0">{statsPendingClaims.length} Claims</span>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-amber-800 leading-none mt-1 whitespace-nowrap">₹{(pendingAmount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 6: Rejected */}
            <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
              <div className="flex items-center gap-2 min-w-0 w-full">
                <IconTile icon={XCircle} gradientFrom="from-rose-500" gradientTo="to-red-600" shadowColor="rgba(239, 68, 68, 0.25)" />
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">REJECTED</span>
                    <span className="text-[8px] font-medium text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200/60 leading-none shrink-0">{statsRejectedClaims.length} Claims</span>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-rose-800 leading-none mt-1 whitespace-nowrap">₹{(rejectedAmount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Main Grid Content - Full Width Claims Workspace */}
        <Row gutter={[16, 16]}>
          
          {/* Main Workspace Area: Tab list and Claims Table (Full Width) */}
          <Col span={24} className="space-y-4">

            {/* TAB SYSTEM & SLATE-BLUE FILTER WORKSPACE */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 md:p-3 shadow-2xs space-y-2.5">
              {/* Ultra-Compact Slate-Blue Tabs Header */}
              <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5 mb-1">
                <button
                  onClick={() => handleTabChange("my-claims")}
                  className={`px-3 py-1 text-xs font-bold transition-all rounded-md cursor-pointer ${
                    activeTab === "my-claims"
                      ? "bg-[#4A6A8A] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  My Claims ({filteredPersonalExpenses.length})
                </button>
                {isReviewerRole && (
                  <button
                    onClick={() => handleTabChange("team-claims")}
                    className={`px-3 py-1 text-xs font-bold transition-all rounded-md cursor-pointer ${
                      activeTab === "team-claims"
                        ? "bg-[#4A6A8A] text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    Team Claims ({filteredTeamExpenses.length})
                  </button>
                )}
              </div>

              {/* Tab Content 1: My Claims */}
              {activeTab === "my-claims" && (
                <div className="space-y-3 pt-0.5">
                  {/* Slate-Blue Filter Bar (#4A6A8A) */}
                  <div className="bg-[#4A6A8A] rounded-lg p-2 px-2.5 text-white shadow-2xs">
                    <Row gutter={[6, 6]} align="middle" className="w-full">
                      <Col xs={12} sm={6} md={3} lg={3}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">MONTH</span>
                          <input 
                            type="month"
                            value={selectMonth}
                            onChange={(e) => setSelectMonth(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={3}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">FROM DATE</span>
                          <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={3}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">TO DATE</span>
                          <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={3.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">SEARCH CLAIM ID</span>
                          <input 
                            type="text"
                            placeholder="Search RJ-08 / Claim..."
                            value={searchClaimId}
                            onChange={(e) => setSearchClaimId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={8.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">STATUS</span>
                          <select 
                            value={homeStatusFilter} 
                            onChange={(e) => setHomeStatusFilter(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </Col>
                    </Row>
                  </div>

                  {/* Claims Listing Table */}
                  {filteredPersonalExpenses.length === 0 && !loadingMyExpenses ? (
                    <div className="py-12 text-center text-gray-400 text-xs">
                      <Compass className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="font-bold">No expense claims found for this month.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Enterprise Data-Grid Table */}
                      <div className="hidden md:block border border-slate-200/90 rounded-lg overflow-hidden shadow-2xs bg-white">
                        <div className="overflow-x-auto">
                          <Table
                            loading={loadingMyExpenses && filteredPersonalExpenses.length === 0}
                            dataSource={filteredPersonalExpenses}
                            rowKey="id"
                            rowClassName={(_, idx) => 
                              idx % 2 === 0 
                                ? "bg-white hover:bg-slate-100/90 transition-colors cursor-pointer border-b border-slate-150/70" 
                                : "bg-slate-50/60 hover:bg-slate-100/90 transition-colors cursor-pointer border-b border-slate-150/70"
                            }
                            components={{
                              header: {
                                cell: (props: any) => (
                                  <th 
                                    {...props} 
                                    style={{ 
                                      backgroundColor: "#4A6A8A", 
                                      color: "#FFFFFF", 
                                      whiteSpace: "nowrap", 
                                      fontSize: "9.5px", 
                                      fontWeight: 800, 
                                      textTransform: "uppercase", 
                                      letterSpacing: "0.04em", 
                                      borderBottom: "2px solid #364F6B", 
                                      padding: "7px 6px" 
                                    }} 
                                  />
                                )
                              }
                            }}
                            pagination={{ 
                              pageSize: homeClaimsPageSize, 
                              showSizeChanger: true, 
                              pageSizeOptions: ["25", "50", "100", "200", "500", "1000"],
                              showTotal: (total, range) => {
                                const totalPages = Math.ceil(total / homeClaimsPageSize) || 1;
                                const currentPage = Math.ceil(range[1] / homeClaimsPageSize) || 1;
                                return (
                                  <span className="text-xs font-bold text-slate-700 mr-1.5">
                                    Page {currentPage} of {totalPages} (Total {total} claims)
                                  </span>
                                );
                              },
                              itemRender: (_page, type, originalElement) => {
                                if (type === "prev") {
                                  return (
                                    <span className="px-2 py-0.5 border border-slate-300 rounded text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 shadow-2xs cursor-pointer select-none">
                                      Prev
                                    </span>
                                  );
                                }
                                if (type === "next") {
                                  return (
                                    <span className="px-2 py-0.5 border border-slate-300 rounded text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 shadow-2xs cursor-pointer select-none">
                                      Next
                                    </span>
                                  );
                                }
                                return originalElement;
                              },
                              onChange: (page, size) => { setPersonalPage(page); setHomeClaimsPageSize(size); },
                              onShowSizeChange: (_, size) => setHomeClaimsPageSize(size),
                              size: "small" 
                            }}
                            size="small"
                            onRow={(record) => ({
                              onClick: () => handleOpenClaimDetails(record.id),
                            })}
                            columns={getEnterpriseClaimsColumns()}
                          />
                        </div>
                      </div>

                      {/* Mobile Card List View */}
                      <div className="block md:hidden space-y-3 pb-6 touch-pan-y overscroll-y-contain">
                        {paginatedPersonalExpenses.map((exp) => (
                          <Card
                            key={exp.id}
                            onClick={() => handleOpenClaimDetails(exp.id)}
                            className={`border ${getStatusCardStyle(exp.status)}`}
                            size="small"
                          >
                            <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                              <Text strong className="font-mono text-primary-600 text-xs whitespace-nowrap">{exp.expense_code}</Text>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                {getStatusLabel(exp.status)}
                              </span>
                            </div>
                            
                            <Row gutter={[4, 4]} className="text-[11px] pt-2">
                              <Col span={8}>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">Date</span>
                                <span className="text-gray-700 font-semibold">{exp.itinerary || exp.date}</span>
                              </Col>
                              <Col span={8}>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">Travel Mode</span>
                                <Tag color="blue" style={{ margin: 0, fontSize: "9px" }} className="uppercase font-bold">{exp.travel_mode || exp.category}</Tag>
                              </Col>
                              <Col span={8}>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">Calls Logs</span>
                                <span className="text-emerald-700 font-bold">{exp.calls_assigned > 0 ? `${exp.calls_completed || 0}/${exp.calls_assigned}` : "—"}</span>
                              </Col>
                              <Col span={12} className="mt-1.5">
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                                <span className="text-gray-700 font-semibold">
                                  {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}{exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                                </span>
                              </Col>
                              <Col span={12} className="mt-1.5">
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">Total Amount</span>
                                <span className="text-primary-600 font-black">₹{exp.amount.toLocaleString()}</span>
                              </Col>
                            </Row>
                            
                            {exp.description && (
                              <div className="border-t border-gray-100 mt-2.5 pt-2 text-[10px]">
                                <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                                <p className="text-gray-600 font-semibold mt-0.5 truncate">{exp.description}</p>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab Content 2: Team Claims */}
              {activeTab === "team-claims" && isReviewerRole && (
                <div className="space-y-3 pt-0.5">
                  {/* Slate-Blue Filter Bar (#4A6A8A) */}
                  <div className="bg-[#4A6A8A] rounded-lg p-2 px-2.5 text-white shadow-2xs">
                    <Row gutter={[6, 6]} align="middle" className="w-full">
                      <Col xs={12} sm={6} md={3} lg={2.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">MONTH</span>
                          <select 
                            value={selectMonth} 
                            onChange={(e) => setSelectMonth(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          >
                            {uniqueMonths.map(m => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={2.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">FROM DATE</span>
                          <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={2.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">TO DATE</span>
                          <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          />
                        </div>
                      </Col>

                      <Col xs={12} sm={6} md={3} lg={3.5}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">SEARCH CLAIM ID</span>
                          <input 
                            type="text"
                            placeholder="Search RJ-08 / Claim..."
                            value={searchClaimId}
                            onChange={(e) => setSearchClaimId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                          />
                        </div>
                      </Col>

                      <LocationFilters
                        showZone={isReviewerRole}
                        isGlobalAdmin={isGlobalAdminRole}
                        selectedZone={filterZone}
                        onZoneChange={setFilterZone}
                        zones={uniqueZones}
                        selectedDistrict={filterDistrict}
                        onDistrictChange={setFilterDistrict}
                        districts={uniqueDistricts}
                        selectedEngineer={filterEmployee}
                        onEngineerChange={setFilterEmployee}
                        engineers={uniqueEmployees}
                        colProps={{ xs: 12, sm: 6, md: 3, lg: 3 }}
                        labelClassName="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap"
                        selectStyle={{ minHeight: "28px", height: "28px" }}
                      />

                      <Col xs={12} sm={6} md={3} lg={3}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider whitespace-nowrap">STATUS</span>
                          <select 
                            value={homeStatusFilter} 
                            onChange={(e) => setHomeStatusFilter(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-7"
                          >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </Col>
                    </Row>
                  </div>

                        {/* Team Claims Listing Table */}
                        {safeTeamExpenses.length === 0 && !loadingTeamExpenses ? (
                          <div className="py-12 text-center text-gray-400 text-xs">
                            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-bold">No claims submitted by your team members yet.</p>
                          </div>
                        ) : (
                          <>
                            {/* Desktop View Enterprise Data-Grid Table */}
                            <div className="hidden md:block border border-slate-200/90 rounded-lg overflow-hidden shadow-2xs bg-white">
                              <div className="overflow-x-auto">
                                <Table
                                  loading={loadingTeamExpenses && safeTeamExpenses.length === 0}
                                  dataSource={filteredTeamExpenses}
                                  rowKey="id"
                                  rowClassName={(_, idx) => 
                                    idx % 2 === 0 
                                      ? "bg-white hover:bg-slate-100/90 transition-colors cursor-pointer border-b border-slate-150/70" 
                                      : "bg-slate-50/60 hover:bg-slate-100/90 transition-colors cursor-pointer border-b border-slate-150/70"
                                  }
                                  components={{
                                    header: {
                                      cell: (props: any) => (
                                        <th 
                                          {...props} 
                                          style={{ 
                                            backgroundColor: "#4A6A8A", 
                                            color: "#FFFFFF", 
                                            whiteSpace: "nowrap", 
                                            fontSize: "9.5px", 
                                            fontWeight: 800, 
                                            textTransform: "uppercase", 
                                            letterSpacing: "0.04em", 
                                            borderBottom: "2px solid #364F6B", 
                                            padding: "7px 6px" 
                                          }} 
                                        />
                                      )
                                    }
                                  }}
                                  pagination={{ 
                                    pageSize: homeTeamPageSize, 
                                    showSizeChanger: true, 
                                    pageSizeOptions: ["25", "50", "100", "200", "500", "1000"],
                                    showTotal: (total, range) => {
                                      const totalPages = Math.ceil(total / homeTeamPageSize) || 1;
                                      const currentPage = Math.ceil(range[1] / homeTeamPageSize) || 1;
                                      return (
                                        <span className="text-xs font-bold text-slate-700 mr-1.5">
                                          Page {currentPage} of {totalPages} (Total {total} claims)
                                        </span>
                                      );
                                    },
                                    itemRender: (_page, type, originalElement) => {
                                      if (type === "prev") {
                                        return (
                                          <span className="px-2 py-0.5 border border-slate-300 rounded text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 shadow-2xs cursor-pointer select-none">
                                            Prev
                                          </span>
                                        );
                                      }
                                      if (type === "next") {
                                        return (
                                          <span className="px-2 py-0.5 border border-slate-300 rounded text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 shadow-2xs cursor-pointer select-none">
                                            Next
                                          </span>
                                        );
                                      }
                                      return originalElement;
                                    },
                                    onChange: (page, size) => { setTeamPage(page); setHomeTeamPageSize(size); },
                                    onShowSizeChange: (_, size) => setHomeTeamPageSize(size),
                                    size: "small" 
                                  }}
                                  size="small"
                                  onRow={(record) => ({
                                    onClick: () => handleOpenClaimDetails(record.id),
                                  })}
                                  columns={getEnterpriseClaimsColumns()}
                                />
                              </div>
                            </div>

                            {/* Mobile Card List View */}
                            <div className="block md:hidden space-y-3 pb-2">
                              {paginatedTeamExpenses.map((exp) => (
                                <Card
                                  key={exp.id}
                                  onClick={() => handleOpenClaimDetails(exp.id)}
                                  className={`border ${getStatusCardStyle(exp.status)}`}
                                  size="small"
                                >
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                                    <div>
                                      <Text strong className="text-xs leading-none text-gray-900 block">{exp.submitter_name}</Text>
                                      <span className="text-[8px] font-mono font-bold uppercase block mt-0.5 text-primary-600">{exp.submitter_code}</span>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                      {getStatusLabel(exp.status)}
                                    </span>
                                  </div>
                                  
                                  <Row gutter={[4, 4]} className="text-[11px] pt-2">
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Claim ID / Date</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-gray-700 font-semibold">{exp.expense_code} ({exp.date || exp.itinerary})</span>
                                        <DistrictBadge districtType={exp.districtType} />
                                      </div>
                                    </Col>
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Mode / Calls</span>
                                      <div className="flex items-center gap-1.5">
                                        <Tag color="blue" style={{ margin: 0, fontSize: "9px" }} className="uppercase font-bold">{exp.category || exp.travel_mode}</Tag>
                                        {exp.calls_assigned > 0 && (
                                          <span className="text-emerald-700 font-bold text-[10px]">📞 {exp.calls_completed || 0}/{exp.calls_assigned}</span>
                                        )}
                                      </div>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                                      <span className="text-gray-700 font-semibold">
                                        {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}{exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                                      </span>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Amount</span>
                                      <span className="text-primary-600 font-black">₹{exp.amount.toLocaleString()}</span>
                                    </Col>
                                  </Row>
                                  
                                  {exp.purpose && (
                                    <div className="border-t border-gray-100 mt-2.5 pt-2 text-[10px]">
                                      <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                                      <p className="text-gray-600 font-semibold mt-0.5 truncate">{exp.purpose}</p>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Col>
        </Row>
      </div>

      {/* ================= CLAIM DETAILS POPUP MODAL ================= */}
      <ClaimDetailsModal
        sourceMode="home"
        open={showDetailsModal}
        claimDetails={claimDetails}
        user={user}
        comments={comments}
        setComments={setComments}
        actionLoading={actionLoading}
        handleApprove={handleApprove}
        handleReject={handleReject}
        handleDeleteClaim={handleDeleteClaim}
        onClose={() => { setShowDetailsModal(false); setClaimDetails(null); }}
        navigate={navigate}
        setLightboxImage={setLightboxImage}
        getStatusBadgeClass={getStatusBadgeClass}
        getStatusLabel={getStatusLabel}
      />

      {/* ================= STATS CLAIMS POPUP MODAL ================= */}
      <Modal
        title={
          <Title level={5} style={{ margin: 0 }} className="flex items-center gap-2 text-gray-805">
            <FileSpreadsheet className="w-4 h-4 text-primary-600" />
            <span>{statsModalType} Claims ({statsModalClaims.length})</span>
          </Title>
        }
        open={showStatsModal}
        onCancel={() => { setShowStatsModal(false); setStatsModalClaims([]); }}
        width={950}
        footer={[
          <Button key="stats-close" onClick={() => { setShowStatsModal(false); setStatsModalClaims([]); }}>
            Close List
          </Button>
        ]}
        bodyStyle={{ 
          maxHeight: "70vh", 
          overflowY: "auto", 
          padding: "12px",
          background: "#ffffff"
        }}
      >
        {statsModalClaims.length === 0 ? (
          <div className="py-12 text-center text-gray-455 text-xs">
            <p className="font-bold">No claims found in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              dataSource={statsModalClaims}
              rowKey="id"
              pagination={{ 
                pageSize: homeModalPageSize, 
                showSizeChanger: true, 
                pageSizeOptions: ["10", "25", "50", "100"],
                onChange: (_, size) => setHomeModalPageSize(size),
                onShowSizeChange: (_, size) => setHomeModalPageSize(size),
                size: "small" 
              }}
              size="small"
              sticky={true}
              scroll={{ x: "max-content", y: 380 }}
              onRow={(record) => ({
                onClick: () => {
                  setShowStatsModal(false);
                  handleOpenClaimDetails(record.id);
                },
                className: "cursor-pointer hover:bg-indigo-50/15"
              })}
              columns={[
                ...(activeTab === "team-claims" ? [{
                  title: "Employee",
                  key: "employee",
                  width: 140,
                  render: (_: any, record: any) => (
                    <div>
                      <Text strong className="text-gray-900 block leading-none">{record.submitter_name}</Text>
                      <span className="text-[8px] font-mono uppercase block mt-0.5 text-blue-605 font-bold">{record.submitter_code}</span>
                    </div>
                  )
                }] : []),
                {
                  title: "Claim ID",
                  dataIndex: "expense_code",
                  key: "expense_code",
                  width: 140,
                  render: (text) => <Text className="font-mono font-bold text-indigo-600">{text}</Text>,
                },
                {
                  title: "Date",
                  dataIndex: "date",
                  key: "date",
                  width: 100,
                  render: (_, record) => record.itinerary || record.date,
                },
                {
                  title: "Purpose",
                  dataIndex: "description",
                  key: "description",
                  width: 160,
                  ellipsis: true,
                  render: (text, record) => <Text className="font-semibold text-gray-750">{text || record.purpose || "—"}</Text>,
                },
                {
                  title: "Travel Mode",
                  dataIndex: "travel_mode",
                  key: "travel_mode",
                  width: 100,
                  render: (text, record) => <Tag color="blue">{text || record.category}</Tag>,
                },
                {
                  title: "Distance",
                  dataIndex: "total_km",
                  key: "total_km",
                  width: 90,
                  align: "right" as const,
                  render: (val) => val ? `${val.toFixed(1)} KM` : "—",
                },
                {
                  title: "Auto Fare",
                  dataIndex: "total_auto",
                  key: "total_auto",
                  width: 95,
                  align: "right" as const,
                  render: (val) => val ? `₹${val.toLocaleString()}` : "—",
                },
                {
                  title: "Amount",
                  dataIndex: "amount",
                  key: "amount",
                  width: 100,
                  align: "right" as const,
                  render: (val) => <Text className="font-bold text-gray-900">₹{(val || 0).toLocaleString()}</Text>,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  width: 100,
                  align: "right" as const,
                  render: (status) => (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  ),
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      <Modal
        open={!!lightboxImage}
        destroyOnClose={true}
        zIndex={99999999}
        footer={null}
        onCancel={() => {
          setLightboxImage(null);
          setLbZoom(1);
          document.body.style.overflow = '';
          document.body.style.pointerEvents = '';
          document.body.style.touchAction = '';
          document.documentElement.style.overflow = '';
          document.documentElement.style.pointerEvents = '';
          document.documentElement.style.touchAction = '';
        }}
        width={750}
        bodyStyle={{ padding: 0, background: "#ffffff", borderRadius: "0 0 8px 8px", overflow: "hidden" }}
        className="lightbox-modal"
        closeIcon={
          <div className="bg-white hover:bg-slate-100 text-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-sm border border-slate-300 transition-colors shadow font-bold">✕</div>
        }
        centered
        afterClose={() => setLbZoom(1)}
      >
        {/* Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <button
            onClick={() => setLbZoom(z => Math.max(0.2, parseFloat((z - 0.25).toFixed(2))))}
            style={{ background: "#334155", color: "#fff", border: "none", borderRadius: 6, width: 32, height: 32, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}
            title="Zoom Out"
          >−</button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", minWidth: 44, textAlign: "center" }}>{Math.round(lbZoom * 100)}%</span>
          <button
            onClick={() => setLbZoom(z => Math.min(5, parseFloat((z + 0.25).toFixed(2))))}
            style={{ background: "#334155", color: "#fff", border: "none", borderRadius: 6, width: 32, height: 32, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}
            title="Zoom In"
          >+</button>
          <button
            onClick={() => setLbZoom(1)}
            style={{ background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 6, padding: "0 10px", height: 32, fontSize: 11, cursor: "pointer", fontWeight: 700 }}
            title="Reset Zoom"
          >Reset</button>
        </div>
        {/* Image Area */}
        <div style={{ background: "#ffffff", overflow: "auto", maxHeight: "78vh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 12 }}>
          {isConvertingHeic ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 32 }}>
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Converting Apple HEIC image...</span>
            </div>
          ) : (
            <img
              src={displayImageUrl || lightboxImage || undefined}
              alt="Receipt Invoice Lightbox"
              style={{ transform: `scale(${lbZoom})`, transformOrigin: "top center", transition: "transform 0.2s", maxWidth: "100%", display: "block", borderRadius: 4 }}
            />
          )}
        </div>
      </Modal>

      {showPageScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            right: "24px",
            bottom: "80px",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            border: "none",
            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 999
          }}
          className="hover:scale-110 active:scale-95 transition-all"
        >
          <ChevronUp className="w-6 h-6 text-white" />
        </button>
      )}
    </>
  );
}
