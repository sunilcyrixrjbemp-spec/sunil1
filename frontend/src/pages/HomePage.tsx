import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { ResponsivePie } from "@nivo/pie";
import ExpenseCalendar from "../components/common/ExpenseCalendar";
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Tabs, 
  Row, 
  Col, 
  Alert, 
  Typography, 
  Tag,
  Input,
  Segmented
} from "antd";

const { Title, Text } = Typography;
const { TextArea } = Input;

const getSegmentedClass = (status: string) => {
  switch (status) {
    case "approved":
      return "status-segmented-approved";
    case "rejected":
      return "status-segmented-rejected";
    case "pending":
      return "status-segmented-pending";
    default:
      return "status-segmented-all";
  }
};

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
  BarChart3, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Layers,
  Users,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Download
} from "lucide-react";

import api from "../services/api";

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

const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];



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
    const cached = localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [teamExpenses, setTeamExpenses] = useState<any[]>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return [];
    const cached = localStorage.getItem(`cache_team_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loadingMyExpenses, setLoadingMyExpenses] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return true;
    return !localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
  });
  const [loadingTeamExpenses, setLoadingTeamExpenses] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return true;
    return !localStorage.getItem(`cache_team_expenses_${currentUser.user_id}`);
  });
  const [allowanceStats, setAllowanceStats] = useState<any>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return null;
    const cached = localStorage.getItem(`cache_allowance_stats_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : null;
  });

  // Tabs state - persisted on refresh
  const [activeTab, setActiveTab] = useState<"my-claims" | "team-claims">((() => {
    const saved = localStorage.getItem("dashboard_active_tab");
    if (saved === "my-claims" || saved === "team-claims") return saved;
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (currentUser) {
      const roleLower = (currentUser.role || "").trim().toLowerCase();
      if (["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(roleLower)) {
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

  // Popup modal for clicked stats card
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalType, _setStatsModalType] = useState<"Total Claimed" | "Approved" | "Pending" | "Rejected">("Total Claimed");
  const [statsModalClaims, setStatsModalClaims] = useState<any[]>([]);

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

  // Filters state for team claims tab
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [teamPage, setTeamPage] = useState<number>(1);

  const [selectMonth, setSelectMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // Default current month YYYY-MM
  });
  const [homeStatusFilter, setHomeStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    setTeamPage(1);
  }, [filterEmployee, filterMode, selectMonth, homeStatusFilter, filterZone]);

  useEffect(() => {
    setFilterEmployee("all");
  }, [filterZone]);

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

    if (isReviewer) {
      approvalService.getPendingApprovals()
        .then(data => {
          const limitCount = data.filter((a: any) => a.category === "Limit Request").length;
          const standardCount = data.filter((a: any) => a.category !== "Limit Request").length;
          setPendingApprovalsCount(standardCount);
          setPendingLimitRequestsCount(limitCount);
          localStorage.setItem(`cache_approvals_count_${uId}`, standardCount.toString());
          localStorage.setItem(`cache_limit_approvals_count_${uId}`, limitCount.toString());
        })
        .catch(err => console.error("Error fetching approvals count:", err));
      
      expenseService.getTeamExpenses(selectMonth)
        .then(data => {
          setTeamExpenses(data);
          localStorage.setItem(`cache_team_expenses_${uId}`, JSON.stringify(data));
        })
        .catch(err => console.error("Error fetching team expenses:", err))
        .finally(() => setLoadingTeamExpenses(false));
    }

    expenseService.getExpenses(selectMonth)
      .then(data => {
        setMyExpenses(data);
        localStorage.setItem(`cache_my_expenses_${uId}`, JSON.stringify(data));
      })
      .catch(err => console.error("Error fetching own expenses:", err))
      .finally(() => setLoadingMyExpenses(false));

    expenseService.getExpenseInit(uId, selectMonth)
      .then(data => {
        if (data.allowance) {
          const stats = {
            currentKm: data.allowance.current_month_km || 0,
            maxKm: (data.allowance.max_km_per_month || 2000) + (data.approved_km || 0),
            currentAuto: data.allowance.current_month_auto || 0,
            maxAuto: (data.allowance.max_auto_per_month || 1000) + (data.approved_auto || 0),
            vehicleType: data.allowance.vehicle_type || "Bike",
            rateBike: data.allowance.rate_bike || 0,
            rateCar: data.allowance.rate_car || 0
          };
          setAllowanceStats(stats);
          localStorage.setItem(`cache_allowance_stats_${uId}`, JSON.stringify(stats));
        }
      })
      .catch(err => console.error("Error fetching allowance stats:", err));
  };

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return String(dateVal);
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
    refreshDashboardData();
  }, [navigate, selectMonth]);

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

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") return "bg-green-50 border-green-200 text-green-700";
    if (s === "rejected") return "bg-red-50 border-red-200 text-red-700";
    if (s === "returned_to_draft") return "bg-orange-50 border-orange-200 text-orange-700";
    if (s.startsWith("submitted")) return "bg-yellow-50 border-yellow-250 text-yellow-750 font-bold";
    return "bg-gray-50 border-gray-200 text-gray-600";
  };

  const getStatusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") return "Approved";
    if (s === "rejected") return "Rejected";
    if (s === "returned_to_draft") return "Returned";
    if (s === "submitted") return "Pending L1";
    if (s.startsWith("submitted_l")) {
      const lvl = s.replace("submitted_l", "");
      return `Pending L${lvl}`;
    }
    if (s === "draft") return "Draft";
    if (s === "pending") return "Pending";
    return (status || "").toUpperCase();
  };

  const handleOpenClaimDetails = async (claimId: number | string) => {
    setSelectedClaimId(claimId);
    setShowDetailsModal(true);

    // Pre-populate basic details from list instantly to bypass server lag
    const listExpenses = [
      ...(Array.isArray(myExpenses) ? myExpenses : []),
      ...(Array.isArray(teamExpenses) ? teamExpenses : [])
    ];
    const basicClaim = listExpenses.find(e => e && e.id === claimId);
    if (basicClaim) {
      setClaimDetails(basicClaim);
    }

    const cacheKey = `cache_claim_detail_${claimId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setClaimDetails(JSON.parse(cached));
      setLoadingDetails(false);
      expenseService.getExpenseDetails(claimId)
        .then(data => {
          setClaimDetails(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        })
        .catch(() => {});
    } else {
      setLoadingDetails(true);
      try {
        const data = await expenseService.getExpenseDetails(claimId);
        setClaimDetails(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        // If we already pre-populated from list, don't close the modal on network failure
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

  const uniqueEmployees = Array.from(
    new Map(
      safeTeamExpenses
        .filter((e): e is any => !!e && !!e.submitter_code && !!e.submitter_name)
        .filter((e) => filterZone === "all" || cleanZone(e.zone) === cleanZone(filterZone))
        .map(e => [e.submitter_code, e.submitter_name])
    ).entries()
  ).map(([code, name]) => ({ code: String(code), name: String(name) }));

  // Role-based zone restrictions for filter dropdown
  const currentUserObj = JSON.parse(localStorage.getItem("user") || "null") || user;
  const effectiveUserRoleLower = (currentUserObj?.role || "").trim().toLowerCase();
  const isGlobalAdminRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(effectiveUserRoleLower);
  
  const userZoneRaw = currentUserObj?.zone || "";
  const userZonesList = userZoneRaw
    ? userZoneRaw.split(",").map((z: string) => cleanZone(z)).filter(Boolean)
    : [];

  const allPossibleZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];
  let uniqueZones = allPossibleZones;

  if (!isGlobalAdminRole && userZonesList.length > 0) {
    uniqueZones = allPossibleZones.filter(z => userZonesList.includes(cleanZone(z)));
    if (uniqueZones.length === 0) {
      uniqueZones = userZonesList;
    }
  }

  // Unique categories/modes for dropdown filter
  const uniqueModes = Array.from(
    new Set(
      safeTeamExpenses
        .filter((e): e is any => !!e && !!e.category)
        .map(e => {
          const raw = String(e.category).trim();
          if (raw.toLowerCase() === "limit request") return "Limit Request";
          return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        })
    )
  );

  // Filter personal claims to match currently selected selectMonth (YYYY-MM format)
  const getFilteredPersonalExpenses = () => {
    return safeMyExpenses.filter(exp => {
      if (!exp) return false;
      const rawDate = exp.itinerary || exp.date;
      if (!(rawDate && rawDate.startsWith(selectMonth))) return false;
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

  const getFilteredTeamExpenses = () => {
    return safeTeamExpenses.filter(exp => {
      const rawDate = exp.date || exp.itinerary;
      if (rawDate && !rawDate.startsWith(selectMonth)) return false;
      if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
      if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
      if (filterMode !== "all" && String(exp.category || "").trim().toLowerCase() !== filterMode.trim().toLowerCase()) return false;
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
  const paginatedTeamExpenses = filteredTeamExpenses.slice((teamPage - 1) * 100, teamPage * 100);
  const totalFilteredKm = filteredTeamExpenses.filter(e => e.category !== "Limit Request").reduce((sum, e) => sum + (e.total_km || 0), 0);
  const totalFilteredAuto = filteredTeamExpenses.filter(e => e.category !== "Limit Request").reduce((sum, e) => sum + (e.total_auto || 0), 0);
  const totalFilteredAmount = filteredTeamExpenses.filter(e => e.category !== "Limit Request").reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingApprovalStep = claimDetails?.approvals?.find(
    (app: any) => app.approver_code === user?.user_id && app.status === "pending"
  );

  const getPersonalChartData = () => {
    let bike = 0, car = 0, auto = 0, da = 0, hotel = 0, lp = 0, other = 0;
    filteredPersonalExpenses.forEach(e => {
      if (e.category === "Limit Request") return;
      bike += e.bike_amount || 0;
      car += e.car_amount || 0;
      auto += e.auto_amount || 0;
      da += e.da_amount || 0;
      hotel += e.hotel_amount || 0;
      lp += e.local_purchase_amount || 0;
      other += e.other_expense_amount || 0;
    });

    const total = bike + car + auto + da + hotel + lp + other || 1;
    const isCarAllowed = allowanceStats?.vehicleType?.toLowerCase() === "car";

    const items = [
      { label: "Bike Travel", amount: bike, pct: Math.round((bike / total) * 100), colorStart: "#007bff", colorEnd: "#0056b3" },
      { label: "Car Travel", amount: car, pct: Math.round((car / total) * 100), colorStart: "#28a745", colorEnd: "#1e7e34" },
      { label: "Auto Fare", amount: auto, pct: Math.round((auto / total) * 100), colorStart: "#ffc107", colorEnd: "#d39e00" },
      { label: "Daily Allowance (DA)", amount: da, pct: Math.round((da / total) * 100), colorStart: "#20c997", colorEnd: "#17a2b8" },
      { label: "Hotel Stay", amount: hotel, pct: Math.round((hotel / total) * 100), colorStart: "#6f42c1", colorEnd: "#520dc2" },
      { label: "Local Purchase", amount: lp, pct: Math.round((lp / total) * 100), colorStart: "#e83e8c", colorEnd: "#d63384" },
      { label: "Other / Misc", amount: other, pct: Math.round((other / total) * 100), colorStart: "#dc3545", colorEnd: "#bd2130" }
    ];

    // Filter out Car Travel if not allowed
    return isCarAllowed ? items : items.filter(item => item.label !== "Car Travel");
  };

  const PRIVILEGED_ROLES_HOME = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"];
  const isPrivilegedRoleHome = PRIVILEGED_ROLES_HOME.includes((user?.role || "").trim().toLowerCase());

  // All team expenses for the selected month (no zone/employee/mode filter) — for zone chart
  const allMonthTeamExpenses = safeTeamExpenses.filter(exp => {
    const rawDate = exp.date || exp.itinerary;
    return rawDate && rawDate.startsWith(selectMonth);
  });

  const getTeamChartData = () => {
    const grouped: Record<string, { name: string, amount: number }> = {};
    allMonthTeamExpenses.forEach(e => {
      if (e.category === "Limit Request") return;
      // Use actual zone from expense DB field — show ALL zones
      let zone = (e.zone || "").trim();
      if (!zone || zone.toLowerCase() === "all") {
        zone = isPrivilegedRoleHome ? "Unknown" : (user?.zone || "Unknown");
      }
      if (!grouped[zone]) {
        grouped[zone] = { name: zone, amount: 0 };
      }
      grouped[zone].amount += e.amount;
    });
    return Object.values(grouped)
      .sort((a, b) => b.amount - a.amount);
  };

  // Stats calculations based on current active tab, respecting zone, employee, and mode filters, but NOT the status tab filter
  const statsBasePersonalExpenses = safeMyExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.itinerary || exp.date;
    return rawDate && rawDate.startsWith(selectMonth);
  });

  const statsBaseTeamExpenses = safeTeamExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.date || exp.itinerary;
    if (rawDate && !rawDate.startsWith(selectMonth)) return false;
    if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
    if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
    if (filterMode !== "all" && String(exp.category || "").trim().toLowerCase() !== filterMode.trim().toLowerCase()) return false;
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

  // const handleOpenStatsModal = (type: "Total Claimed" | "Approved" | "Pending" | "Rejected", list: any[]) => {
  //   setStatsModalType(type);
  //   setStatsModalClaims(list);
  //   setShowStatsModal(true);
  // };

  return (
    <>
      <style>{`
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
        
        {/* Welcome Banner - Clean Premium Card */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 py-3 px-4 text-white shadow-sm mb-4">
          <div className="absolute -right-8 -top-8 h-16 w-16 rounded-full bg-white/5 blur-lg"></div>
          <div className="absolute -left-8 -bottom-8 h-16 w-16 rounded-full bg-white/5 blur-lg"></div>
          
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white leading-none">Hi, {user.name} 👋</h2>
              <p className="text-indigo-200 text-[10px] font-medium mt-1">Claims summary &amp; operations center.</p>
            </div>
          </div>
        </div>

        {isReviewerRole && pendingLimitRequestsCount > 0 && (
          <Alert
            message={<strong>Pending Limit Extension Requests</strong>}
            description={`You have ${pendingLimitRequestsCount} pending limit request${pendingLimitRequestsCount > 1 ? 's' : ''} from your team awaiting your review.`}
            type="warning"
            showIcon
            icon={<AlertTriangle className="text-amber-600 shrink-0" size={18} />}
            className="mb-4 rounded-lg bg-amber-50/50 border-amber-200"
            action={
              <Button size="small" type="primary" className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => navigate("/approval-center")}>
                Review Now
              </Button>
            }
          />
        )}

        {/* Quick Stats Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Title level={5} style={{ margin: 0, fontSize: "12px", color: "#4B5563" }} className="uppercase font-bold tracking-wider">
              {activeTab === "my-claims" ? "My Expense Summary" : "Team Expense Summary"}
            </Title>
            
            <div className="flex items-center gap-2">
              <Text className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Select Month:</Text>
              <input 
                type="month"
                value={selectMonth}
                onChange={(e) => setSelectMonth(e.target.value)}
                className="bg-white border border-gray-250 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
              />
            </div>
          </div>
          
          {/* Metric Cards Grid */}
          <Row gutter={[12, 12]}>
            {/* Card 1: Total Claimed */}
            <Col xs={12} sm={6}>
              <Card 
                size="small" 
                className="border border-gray-200 border-l-4 border-l-indigo-600 shadow-xs"
                bodyStyle={{ padding: "10px" }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <Text type="secondary" className="text-[9px] uppercase font-bold tracking-wider block leading-none">Total Claimed</Text>
                    <Text strong className="text-sm font-mono block mt-1">₹{(totalAmount || 0).toLocaleString()}</Text>
                    <Text className="text-[9px] text-indigo-600 font-bold block mt-0.5">{statsTotalClaims.length} Claims</Text>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 2: Approved */}
            <Col xs={12} sm={6}>
              <Card 
                size="small" 
                className="border border-gray-205 border-l-4 border-l-green-600 shadow-xs"
                bodyStyle={{ padding: "10px" }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-50 text-green-605 rounded">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <Text type="secondary" className="text-[9px] uppercase font-bold tracking-wider block leading-none">Approved</Text>
                    <Text strong className="text-sm font-mono block mt-1">₹{(approvedAmount || 0).toLocaleString()}</Text>
                    <Text className="text-[9px] text-green-600 font-bold block mt-0.5">{statsApprovedClaims.length} Claims</Text>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 3: Pending */}
            <Col xs={12} sm={6}>
              <Card 
                size="small" 
                className="border border-gray-200 border-l-4 border-l-amber-600 shadow-xs"
                bodyStyle={{ padding: "10px" }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded">
                    <Clock size={16} />
                  </div>
                  <div>
                    <Text type="secondary" className="text-[9px] uppercase font-bold tracking-wider block leading-none">Pending Review</Text>
                    <Text strong className="text-sm font-mono block mt-1">₹{(pendingAmount || 0).toLocaleString()}</Text>
                    <Text className="text-[9px] text-amber-600 font-bold block mt-0.5">{statsPendingClaims.length} Claims</Text>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 4: Rejected */}
            <Col xs={12} sm={6}>
              <Card 
                size="small" 
                className="border border-gray-200 border-l-4 border-l-red-600 shadow-xs"
                bodyStyle={{ padding: "10px" }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-50 text-red-650 rounded">
                    <XCircle size={16} />
                  </div>
                  <div>
                    <Text type="secondary" className="text-[9px] uppercase font-bold tracking-wider block leading-none">Rejected</Text>
                    <Text strong className="text-sm font-mono block mt-1">₹{(rejectedAmount || 0).toLocaleString()}</Text>
                    <Text className="text-[9px] text-red-600 font-bold block mt-0.5">{statsRejectedClaims.length} Claims</Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        {/* Main Grid Content */}
        <Row gutter={[16, 16]}>
          
          {/* Left Area: Tab list and Limits */}
          <Col xs={24} lg={16} className="space-y-4">

            {/* TAB SYSTEM: My Claims vs Team Claims */}
            <Card size="small" className="border border-gray-200 shadow-xs">
              <Tabs 
                activeKey={activeTab} 
                onChange={(key) => handleTabChange(key as any)}
                type="card"
                items={[
                  {
                    key: "my-claims",
                    label: `My Claims (${filteredPersonalExpenses.length})`,
                    children: (
                      <div className="space-y-3 pt-2">
                        {/* Filters Row */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Text type="secondary" className="text-[10px] uppercase font-bold tracking-wider">Select Month:</Text>
                            <input 
                              type="month"
                              value={selectMonth}
                              onChange={(e) => setSelectMonth(e.target.value)}
                              className="bg-white border border-gray-200 rounded px-2.5 py-0.5 text-xs font-semibold text-gray-850 cursor-pointer w-32 focus:outline-none"
                            />
                          </div>
                          <div className="flex-1 w-full max-w-md">
                            <Segmented
                              block
                              size="small"
                              value={homeStatusFilter}
                              onChange={(val) => setHomeStatusFilter(val as any)}
                              options={[
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">All</span>, value: 'all' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Pending</span>, value: 'pending' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Approved</span>, value: 'approved' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Rejected</span>, value: 'rejected' }
                              ]}
                              className={`font-bold text-[10px] uppercase tracking-wider ${getSegmentedClass(homeStatusFilter)}`}
                            />
                          </div>
                        </div>

                        {/* Claims Listing Table */}
                        {loadingMyExpenses ? (
                          <Loader message="Loading your claims..." />
                        ) : filteredPersonalExpenses.length === 0 ? (
                          <div className="py-12 text-center text-gray-400 text-xs">
                            <Compass className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-bold">No expense claims found for this month.</p>
                          </div>
                        ) : (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden md:block border border-gray-100 rounded-lg overflow-hidden">
                              <Table
                                dataSource={filteredPersonalExpenses}
                                rowKey="id"
                                pagination={{ pageSize: 25, size: "small" }}
                                size="small"
                                onRow={(record) => ({
                                  onClick: () => handleOpenClaimDetails(record.id),
                                  className: "cursor-pointer hover:bg-indigo-50/15"
                                })}
                                columns={[
                                  {
                                    title: "Claim ID",
                                    dataIndex: "expense_code",
                                    key: "expense_code",
                                    render: (text) => <Text className="font-mono font-bold text-indigo-600">{text}</Text>,
                                  },
                                  {
                                    title: "Date",
                                    dataIndex: "itinerary",
                                    key: "itinerary",
                                  },
                                  {
                                    title: "Purpose",
                                    dataIndex: "description",
                                    key: "description",
                                    ellipsis: true,
                                    render: (text) => <Text className="font-semibold text-gray-700">{text}</Text>,
                                  },
                                  {
                                    title: "Travel Mode",
                                    dataIndex: "travel_mode",
                                    key: "travel_mode",
                                    render: (text) => <Tag color="blue">{text}</Tag>,
                                  },
                                  {
                                    title: "Distance",
                                    dataIndex: "total_km",
                                    key: "total_km",
                                    align: "right" as const,
                                    render: (val) => val ? `${val.toFixed(1)} KM` : "—",
                                  },
                                  {
                                    title: "Auto Fare",
                                    dataIndex: "total_auto",
                                    key: "total_auto",
                                    align: "right" as const,
                                    render: (val) => val ? `₹${val.toLocaleString()}` : "—",
                                  },
                                  {
                                    title: "Amount",
                                    dataIndex: "amount",
                                    key: "amount",
                                    align: "right" as const,
                                    render: (val) => <Text className="font-bold text-gray-900">₹{val.toLocaleString()}</Text>,
                                  },
                                  {
                                    title: "Status",
                                    dataIndex: "status",
                                    key: "status",
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

                            {/* Mobile Card List View */}
                            <div className="block md:hidden space-y-3 pb-20">
                              {filteredPersonalExpenses.map((exp) => (
                                <Card
                                  key={exp.id}
                                  onClick={() => handleOpenClaimDetails(exp.id)}
                                  className={`border ${getStatusCardStyle(exp.status)}`}
                                  size="small"
                                >
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                                    <Text strong className="font-mono text-indigo-650 text-xs">{exp.expense_code}</Text>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                      {getStatusLabel(exp.status)}
                                    </span>
                                  </div>
                                  
                                  <Row gutter={[4, 4]} className="text-[11px] pt-2">
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Date</span>
                                      <span className="text-gray-700 font-semibold">{exp.itinerary || exp.date}</span>
                                    </Col>
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Travel Mode</span>
                                      <Tag color="blue" style={{ margin: 0, fontSize: "9px" }} className="uppercase font-bold">{exp.travel_mode || exp.category}</Tag>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                                      <span className="text-gray-700 font-semibold">
                                        {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}{exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                                      </span>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Total Amount</span>
                                      <span className="text-indigo-655 font-black">₹{exp.amount.toLocaleString()}</span>
                                    </Col>
                                  </Row>
                                  
                                  {exp.description && (
                                    <div className="border-t border-gray-100 mt-2.5 pt-2 text-[10px]">
                                      <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                                      <p className="text-gray-655 font-semibold mt-0.5 truncate">{exp.description}</p>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  },
                  isReviewerRole ? {
                    key: "team-claims",
                    label: `Team Claims (${filteredTeamExpenses.length})`,
                    children: (
                      <div className="space-y-3 pt-2">
                        {/* Filters Row */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2 text-xs font-bold text-slate-700">
                          <Row gutter={[8, 8]} align="middle">
                            <Col xs={12} sm={6}>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Month</span>
                                <select 
                                  value={selectMonth} 
                                  onChange={(e) => setSelectMonth(e.target.value)}
                                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                  style={{ minHeight: "34px", height: "34px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.2" }}
                                >
                                  {uniqueMonths.map(m => (
                                    <option key={m.value} value={m.value}>
                                      Month: {m.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </Col>

                            {isReviewerRole && (
                              <Col xs={12} sm={6}>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Zone</span>
                                  <select 
                                    value={filterZone} 
                                    onChange={(e) => setFilterZone(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    style={{ minHeight: "34px", height: "34px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.2" }}
                                  >
                                    {isGlobalAdminRole && <option value="all">Zone: All</option>}
                                    {uniqueZones.map(z => (
                                      <option key={z} value={z}>Zone: {z}</option>
                                    ))}
                                  </select>
                                </div>
                              </Col>
                            )}

                            <Col xs={12} sm={6}>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Engineer</span>
                                <select 
                                  value={filterEmployee} 
                                  onChange={(e) => setFilterEmployee(e.target.value)}
                                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                  style={{ minHeight: "34px", height: "34px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.2" }}
                                >
                                  <option value="all">Engineer: All</option>
                                  {uniqueEmployees.map(emp => (
                                    <option key={emp.code} value={emp.code}>Engineer: {emp.name}</option>
                                  ))}
                                </select>
                              </div>
                            </Col>

                            <Col xs={12} sm={6}>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Travel Mode</span>
                                <select 
                                  value={filterMode} 
                                  onChange={(e) => setFilterMode(e.target.value)}
                                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                  style={{ minHeight: "34px", height: "34px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.2" }}
                                >
                                  <option value="all">Mode: All</option>
                                  {uniqueModes.map(m => (
                                    <option key={m} value={m.toLowerCase()}>Mode: {m}</option>
                                  ))}
                                </select>
                              </div>
                            </Col>
                          </Row>

                          <div className="border-t border-gray-200 pt-2 w-full">
                            <Segmented
                              block
                              size="small"
                              value={homeStatusFilter}
                              onChange={(val) => setHomeStatusFilter(val as any)}
                              options={[
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">All</span>, value: 'all' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Pending</span>, value: 'pending' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Approved</span>, value: 'approved' },
                                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Rejected</span>, value: 'rejected' }
                              ]}
                              className={`font-bold text-[10px] uppercase tracking-wider ${getSegmentedClass(homeStatusFilter)}`}
                            />
                          </div>
                        </div>

                        {/* Team Claims Listing Table */}
                        {loadingTeamExpenses ? (
                          <Loader message="Loading team claims..." />
                        ) : safeTeamExpenses.length === 0 ? (
                          <div className="py-12 text-center text-gray-400 text-xs">
                            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="font-bold">No claims submitted by your team members yet.</p>
                          </div>
                        ) : (
                          <>
                            {/* Desktop View Table */}
                            <div className="hidden md:block border border-gray-100 rounded-lg overflow-hidden">
                              <Table
                                dataSource={paginatedTeamExpenses}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                onRow={(record) => ({
                                  onClick: () => handleOpenClaimDetails(record.id),
                                  className: "cursor-pointer hover:bg-indigo-50/15"
                                })}
                                columns={[
                                  {
                                    title: "Employee",
                                    key: "employee",
                                    render: (_, record) => (
                                      <div>
                                        <Text strong className="text-gray-900 block leading-none">{record.submitter_name}</Text>
                                        <span className="text-[8px] font-mono uppercase block mt-0.5 text-blue-600 font-bold">{record.submitter_code}</span>
                                      </div>
                                    )
                                  },
                                  {
                                    title: "Claim ID",
                                    dataIndex: "expense_code",
                                    key: "expense_code",
                                    render: (text) => <Text className="font-mono font-bold text-indigo-600">{text}</Text>,
                                  },
                                  {
                                    title: "Date",
                                    dataIndex: "date",
                                    key: "date",
                                    render: (_, record) => record.itinerary || record.date || record.created_at,
                                  },
                                  {
                                    title: "Purpose",
                                    dataIndex: "description",
                                    key: "description",
                                    ellipsis: true,
                                    render: (text, record) => <Text className="font-semibold text-gray-700">{text || record.purpose}</Text>,
                                  },
                                  {
                                    title: "Mode",
                                    dataIndex: "travel_mode",
                                    key: "travel_mode",
                                    render: (text, record) => <Tag color="blue">{text || record.category}</Tag>,
                                  },
                                  {
                                    title: "Distance",
                                    dataIndex: "total_km",
                                    key: "total_km",
                                    align: "right" as const,
                                    render: (val) => val ? `${val.toFixed(1)} KM` : "—",
                                  },
                                  {
                                    title: "Auto Fare",
                                    dataIndex: "total_auto",
                                    key: "total_auto",
                                    align: "right" as const,
                                    render: (val) => val ? `₹${val.toLocaleString()}` : "—",
                                  },
                                  {
                                    title: "Amount",
                                    dataIndex: "amount",
                                    key: "amount",
                                    align: "right" as const,
                                    render: (val) => <Text className="font-bold text-gray-900">₹{val.toLocaleString()}</Text>,
                                  },
                                  {
                                    title: "Status",
                                    dataIndex: "status",
                                    key: "status",
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

                            {/* Mobile Card List View */}
                            <div className="block md:hidden space-y-3 pb-20">
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
                                      <span className="text-[8px] font-mono font-bold uppercase block mt-0.5 text-blue-600">{exp.submitter_code}</span>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                      {getStatusLabel(exp.status)}
                                    </span>
                                  </div>
                                  
                                  <Row gutter={[4, 4]} className="text-[11px] pt-2">
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Claim ID / Date</span>
                                      <span className="text-gray-700 font-semibold">{exp.expense_code} ({exp.date || exp.itinerary})</span>
                                    </Col>
                                    <Col span={12}>
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Mode</span>
                                      <Tag color="blue" style={{ margin: 0, fontSize: "9px" }} className="uppercase font-bold">{exp.category || exp.travel_mode}</Tag>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                                      <span className="text-gray-700 font-semibold">
                                        {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}{exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                                      </span>
                                    </Col>
                                    <Col span={12} className="mt-1.5">
                                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Amount</span>
                                      <span className="text-indigo-650 font-black">₹{exp.amount.toLocaleString()}</span>
                                    </Col>
                                  </Row>
                                  
                                  {exp.purpose && (
                                    <div className="border-t border-gray-100 mt-2.5 pt-2 text-[10px]">
                                      <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                                      <p className="text-gray-655 font-semibold mt-0.5 truncate">{exp.purpose}</p>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>

                            {/* Pagination Controls */}
                            {filteredTeamExpenses.length > 100 && (
                              <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-2.5 mt-4 mb-36 lg:mb-0 shadow-2xs">
                                <Button
                                  disabled={teamPage === 1}
                                  onClick={() => setTeamPage(prev => Math.max(prev - 1, 1))}
                                  size="small"
                                  className="font-bold text-xs"
                                >
                                  Prev
                                </Button>
                                <span className="text-xs font-bold text-slate-655">
                                  Page {teamPage} of {Math.ceil(filteredTeamExpenses.length / 100)} (Total {filteredTeamExpenses.length} claims)
                                </span>
                                <Button
                                  disabled={teamPage >= Math.ceil(filteredTeamExpenses.length / 100)}
                                  onClick={() => setTeamPage(prev => Math.min(prev + 1, Math.ceil(filteredTeamExpenses.length / 100)))}
                                  size="small"
                                  className="font-bold text-xs"
                                >
                                  Next
                                </Button>
                              </div>
                            )}

                            {/* Extra bottom spacer on mobile to keep pagination clear of bottom nav */}
                            <div className="h-20 w-full block lg:hidden" />
                          </>
                        )}
                      </div>
                    )
                  } : null
                ].filter(Boolean) as any}
              />
            </Card>
          </Col>

          {/* Right Sidebar: Dynamic Charts & Filters */}
          <Col xs={24} lg={8} className="space-y-4">
            
            <div className="hidden lg:block">
  {/* Claims Breakdown Chart Card */}
              <Card 
                size="small" 
                className="border border-gray-200 shadow-xs"
                title={
                  <div className="space-y-0.5">
                    <span className="text-indigo-650 font-extrabold text-[9px] uppercase tracking-widest block">Claims Analytics</span>
                    <Title level={5} style={{ margin: 0, fontSize: "12px", color: "#1F2937" }} className="uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <BarChart3 size={14} className="text-indigo-500" />
                      {activeTab === "my-claims" ? "Personal Mode Breakdown" : "Zone-wise Compare"}
                    </Title>
                  </div>
                }
              >
                {activeTab === "my-claims" ? (
                  safeMyExpenses.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                      No claims to analyze
                    </div>
                  ) : (
                    <>
                      <div style={{ height: 140 }} className="relative flex justify-center items-center">
                        <ResponsivePie
                          data={getPersonalChartData().map((c, i) => ({ id: c.label, label: c.label, value: c.amount, color: GALLERY_COLORS[i % GALLERY_COLORS.length] }))}
                          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                          innerRadius={0.72}
                          padAngle={3}
                          colors={{ datum: 'data.color' }}
                          borderWidth={2}
                          borderColor="#ffffff"
                          enableArcLinkLabels={false}
                          enableArcLabels={false}
                          tooltip={({ datum }) => (
                            <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                              <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{datum.label}</p>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-300">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: datum.color }} />
                                  Amount:
                                </span>
                                <span className="font-mono font-bold text-white">₹{datum.value?.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        />
                        <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                          <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">Total Claimed</span>
                          <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
                            ₹{getPersonalChartData().reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                        {getPersonalChartData().map((item, i) => (
                          <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-505">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GALLERY_COLORS[i % GALLERY_COLORS.length] }} />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  <div className="space-y-4">
                    {/* Filter Metrics Box */}
                    <div className="border border-indigo-50 p-3 bg-indigo-50/20 rounded-xl space-y-2 text-xs font-semibold text-gray-700">
                      <h4 className="text-[9px] font-black text-indigo-800 uppercase tracking-widest leading-none">Filtered Team Totals</h4>
                      <Row gutter={8}>
                        <Col span={12}>
                          <div className="bg-white p-2 border border-slate-100 rounded-lg text-center space-y-0.5 shadow-sm">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7px] leading-none">Distance</span>
                            <span className="text-xs font-black text-indigo-605 font-mono leading-none">{totalFilteredKm.toFixed(1)} KM</span>
                          </div>
                        </Col>
                        <Col span={12}>
                          <div className="bg-white p-2 border border-slate-100 rounded-lg text-center space-y-0.5 shadow-sm">
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7px] leading-none">Auto Expense</span>
                            <span className="text-xs font-black text-indigo-605 font-mono leading-none">₹{totalFilteredAuto.toLocaleString()}</span>
                          </div>
                        </Col>
                      </Row>
                      <div className="bg-white p-2 border border-slate-100 rounded-lg text-center shadow-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-wider block text-[7px] leading-none">Aggregate Reimbursement</span>
                        <span className="text-xs font-black text-indigo-750 font-mono">₹{totalFilteredAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* SVG compare chart */}
                    {filteredTeamExpenses.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                        No matching claims
                      </div>
                    ) : (
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <Text type="secondary" className="text-[9px] font-extrabold uppercase block tracking-wider text-center">Zone Expenditures Comparison</Text>
                        {(() => {
                          const chartData = getTeamChartData();
                          if (chartData.length === 0) return null;
                          return (
                            <>
                              <div style={{ height: 140 }} className="relative flex justify-center items-center">
                                <ResponsivePie
                                  data={chartData.map((c, i) => ({ id: c.name, label: c.name, value: c.amount, color: GALLERY_COLORS[i % GALLERY_COLORS.length] }))}
                                  margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                                  innerRadius={0.72}
                                  padAngle={3}
                                  colors={{ datum: 'data.color' }}
                                  borderWidth={2}
                                  borderColor="#ffffff"
                                  enableArcLinkLabels={false}
                                  enableArcLabels={false}
                                  tooltip={({ datum }) => (
                                    <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                                      <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{datum.label}</p>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-1.5 text-slate-305">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: datum.color }} />
                                          Amount:
                                        </span>
                                        <span className="font-mono font-bold text-white">₹{datum.value?.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  )}
                                />
                                <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                  <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">Total Team</span>
                                  <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
                                    ₹{chartData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1">
                                {chartData.map((item, i) => (
                                  <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-505">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GALLERY_COLORS[i % GALLERY_COLORS.length] }} />
                                    <span>{item.name}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="hidden lg:block">
  {/* Expense Calendar Tracker Section */}
              <Card size="small" className="border border-gray-200 shadow-xs p-1">
                <ExpenseCalendar 
                  expenses={activeTab === "my-claims" ? safeMyExpenses : filteredTeamExpenses} 
                  isTeamView={activeTab !== "my-claims"}
                  selectMonth={selectMonth}
                />
              </Card>
            </div>

          </Col>
        </Row>
      </div>

      {/* ================= CLAIM DETAILS POPUP MODAL ================= */}
      <Modal
        className="rounded-none-modal"
        title={
          <Title level={5} style={{ margin: 0 }} className="flex items-center gap-2 text-gray-805">
            <Layers className="w-4 h-4 text-indigo-650" />
            <span>Claim Details {claimDetails ? `— ${claimDetails.expense_code}` : ""}</span>
          </Title>
        }
        open={showDetailsModal}
        onCancel={() => { setShowDetailsModal(false); setClaimDetails(null); }}
        width={1000}
        footer={[
          <div className="flex justify-between items-center w-full" key="claim-details-footer">
            <div className="flex gap-2">
              {claimDetails && (claimDetails.submitter_code === user.user_id || claimDetails.user_id === user.id) && ["draft", "submitted", "returned_to_draft"].includes(claimDetails.status?.toLowerCase()) && (
                <>
                  <Button
                    type="primary"
                    onClick={() => navigate(`/submit-expense?edit=${claimDetails.id}`)}
                    className="bg-amber-500 hover:bg-amber-600 border-amber-655"
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    danger
                    onClick={() => handleDeleteClaim(claimDetails.id)}
                  >
                    🗑️ Delete
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => { setShowDetailsModal(false); setClaimDetails(null); }}>
              Close
            </Button>
          </div>
        ]}
        bodyStyle={{ 
          maxHeight: "70vh", 
          overflowY: "auto", 
          padding: "12px",
          background: "#ffffff"
        }}
      >
        {!claimDetails ? (
          <Loader message="Loading claim details..." />
        ) : (
          <div className="space-y-4 text-xs">
            {/* Summary Info Cards */}
            <Row gutter={[8, 8]}>
              <Col xs={12} sm={6}>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded">
                  <span className="text-[8px] text-gray-400 font-bold uppercase block">Submitted By</span>
                  <span className="font-bold text-gray-850 block mt-0.5 text-xs">{claimDetails.submitter_name || user?.name}</span>
                  <span className="text-[9px] text-gray-550 font-mono block">{claimDetails.submitter_code || user?.user_id}</span>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded">
                  <span className="text-[8px] text-gray-400 font-bold uppercase block">Travel Date</span>
                  <span className="font-bold text-gray-850 block mt-0.5 text-xs">{claimDetails.date}</span>
                  <span className="text-[9px] text-gray-550 block">{claimDetails.month} {claimDetails.year}</span>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded">
                  <span className="text-[8px] text-gray-400 font-bold uppercase block">Submitted At</span>
                  <span className="font-bold text-gray-850 block mt-0.5 text-xs">{formatDateTime(claimDetails.created_at)}</span>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded">
                  <span className="text-[8px] text-gray-400 font-bold uppercase block">Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider mt-1 ${getStatusBadgeClass(claimDetails.status)}`}>
                    {getStatusLabel(claimDetails.status)}
                  </span>
                </div>
              </Col>
            </Row>

            {claimDetails.original_amount > claimDetails.amount && (
              <Alert
                message={<strong>Policy Deductions Applied</strong>}
                description={`A total deduction of ₹ ${(claimDetails.original_amount - claimDetails.amount).toFixed(0)} was applied to this claim in accordance with the base location policy.`}
                type="warning"
                showIcon
                className="text-xs mb-2"
              />
            )}

            {/* Purpose & Total Banner */}
            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200 rounded text-xs">
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Purpose:</span>
                <span className="font-semibold text-gray-805 text-xs">{claimDetails.purpose || claimDetails.description || "Field visits"}</span>
              </div>
              <div className="text-right">
                {claimDetails.category === "Limit Request" ? (
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-gray-455 font-bold uppercase block">Requested Limit</span>
                    <span className="text-xs font-bold text-gray-655 font-mono">
                      {claimDetails.travel_mode === "KM" ? `${claimDetails.requested_value || claimDetails.total_km} KM` : `₹${(claimDetails.requested_value || claimDetails.amount).toLocaleString()}`}
                    </span>
                    {claimDetails.status.toLowerCase() === "approved" && (
                      <div className="mt-1">
                        <span className="text-[8px] text-emerald-650 font-black uppercase block">Approved Limit</span>
                        <span className="text-xs font-black text-emerald-705 font-mono">
                          {claimDetails.travel_mode === "KM" ? `${claimDetails.approved_value ?? (claimDetails.requested_value || claimDetails.total_km)} KM` : `₹${(claimDetails.approved_value ?? (claimDetails.requested_value || claimDetails.amount)).toLocaleString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="text-[8px] text-gray-455 font-bold uppercase block">Total Reimbursement</span>
                    <span className="text-base font-black text-indigo-700 font-mono">
                      ₹{claimDetails.amount.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>

{/* Legs Table */}
            {claimDetails.category !== "Limit Request" && claimDetails.itineraries && claimDetails.itineraries.length > 0 && (
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Visit Details</h4>
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
                      {claimDetails.itineraries.map((leg: any, idx: number) => {
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
                                <span className="font-bold text-gray-850">{leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}</span>
                                <span className="text-[10px] text-gray-400 block">{leg.from || "Start"} → {leg.to || "End"}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{leg.mode}</span>
                                {leg.sub_mode && <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 ml-1">+{leg.sub_mode}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-600">{leg.km || 0} KM</td>
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
                                <span>Call Attended: {leg.ws_assigned||0}</span> <span className="text-green-600">Call Closed: {leg.ws_closed||0}</span> <span>P:{leg.ws_pms||0}</span> <span>A:{leg.ws_asset||0}</span>
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
                                  <div className="flex flex-col gap-2.5 text-left">
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
                                                <span className="font-mono font-bold text-indigo-600">{c.barcode}</span>
                                                <span className="px-1.5 py-0.2 rounded-sm font-black text-[7px] uppercase bg-blue-50 text-blue-700 border border-blue-100">{c.status || "Attend"}</span>
                                              </div>
                                              <div className="space-y-0.5 flex-1">
                                                <p className="font-bold text-gray-800 line-clamp-1">{c.asset_details?.equipment_name || "—"}</p>
                                                <p className="text-gray-500 truncate">{c.asset_details?.hospital_name || "—"}</p>
                                                <p className="text-gray-400 text-[8px] uppercase tracking-wider">{c.asset_details?.district_name || "—"} | {c.type || "Support"}</p>
                                              </div>
                                              {c.photo_url && (
                                                <button 
                                                  onClick={() => setLightboxImage(`${API_BASE}${c.photo_url}`)}
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
                                                  onClick={() => setLightboxImage(`${API_BASE}${p.photo_url}`)}
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
                                            const qty = parseInt(a.quantity || "0") || 0;
                                            return (
                                              <div key={aIdx} className="bg-white border border-gray-300 p-2.5 shadow-xs text-[10px] w-full sm:w-[180px] flex items-center justify-between hover:border-emerald-400 transition-colors">
                                                <div className="space-y-0.5">
                                                  <p className="font-bold text-gray-800 line-clamp-1">{a.equipment_name}</p>
                                                  <span className="text-[7px] text-gray-400 uppercase tracking-wider">Asset Tagged</span>
                                                </div>
                                                <div className="bg-emerald-50 text-emerald-700 font-extrabold text-xs px-2.5 py-1 rounded border border-emerald-100">
                                                  {qty}
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
                  {claimDetails.itineraries.map((leg: any, idx: number) => {
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
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 shadow-xs">
                        {/* Card Header */}
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span className="font-extrabold text-blue-600 font-mono text-xs">Visit #{leg.leg}</span>
                          <div className="flex flex-col items-end">
                            <span className="font-extrabold text-gray-900 text-sm">₹{legTotal.toLocaleString()}</span>
                            {origTotal > legTotal && (
                              <span className="text-[8px] font-bold text-rose-500 line-through">₹{origTotal.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {/* Route & Mode */}
                        <div className="space-y-1.5">
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
                        <div className="grid grid-cols-2 gap-2.5 bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 text-[10px] font-bold">
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
                              <div className="space-y-2">
                                <div className="text-[9px] font-bold text-blue-700 uppercase">Support Calls Logs</div>
                                {callsList.map((c: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-blue-50/30 border border-blue-100 rounded-lg p-2.5 space-y-2 text-[10px] text-left">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-extrabold text-gray-805 block">{c.asset_details?.equipment_name || "—"}</span>
                                        <span className="text-[9px] text-gray-500">{c.asset_details?.hospital_name || "—"}</span>
                                      </div>
                                      <span className="px-1.5 py-0.5 rounded font-extrabold text-[8px] uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                        {c.status || "Attend"}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px] text-gray-500 font-bold border-t border-blue-100/50 pt-2">
                                      <div className="flex justify-between border-b border-gray-100/30 pb-0.5">
                                        <span>District:</span>
                                        <span className="text-gray-800 font-extrabold">{c.asset_details?.district_name || "—"}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-gray-100/30 pb-0.5">
                                        <span>Model:</span>
                                        <span className="text-gray-800 font-extrabold">{c.asset_details?.model_name || "—"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Barcode:</span>
                                        <span className="text-gray-800 font-mono font-extrabold">{c.barcode || "—"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Type:</span>
                                        <span className="text-gray-800 font-extrabold">{c.type || "Support"}</span>
                                      </div>
                                    </div>
                                    {c.photo_url && (
                                      <div className="pt-2">
                                        <span className="text-gray-400 text-[8px] uppercase block mb-1">Attachment Photo</span>
                                        <div className="relative rounded overflow-hidden border border-blue-100 bg-white">
                                          <img
                                            src={c.photo_url ? `${API_BASE}${c.photo_url}` : undefined}
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
                            )}

                            {/* PMS card list */}
                            {selectedActs.includes("PMS") && pmsList.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[9px] font-bold text-amber-700 uppercase">PMS Service Logs</div>
                                {pmsList.map((p: any, pIdx: number) => (
                                  <div key={pIdx} className="bg-amber-50/30 border border-amber-100 rounded-lg p-2.5 space-y-2 text-[10px] text-left">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-extrabold text-gray-850 block">{p.asset_details?.equipment_name || "—"}</span>
                                        <span className="text-[9px] text-gray-500">{p.asset_details?.hospital_name || "—"}</span>
                                      </div>
                                      <span className="px-1.5 py-0.5 rounded font-extrabold text-[8px] uppercase bg-green-50 text-green-700 border border-green-200">
                                        {p.frequency || "3 month"}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9.5px] text-gray-500 font-bold border-t border-amber-100/50 pt-2">
                                      <div className="flex justify-between border-b border-gray-100/30 pb-0.5">
                                        <span>District:</span>
                                        <span className="text-gray-800 font-extrabold">{p.asset_details?.district_name || "—"}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-gray-100/30 pb-0.5">
                                        <span>Model:</span>
                                        <span className="text-gray-800 font-extrabold">{p.asset_details?.model_name || "—"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Barcode:</span>
                                        <span className="text-gray-800 font-mono font-extrabold">{p.barcode || "—"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Status:</span>
                                        <span className="text-gray-800 font-extrabold">{p.asset_details?.inventory_status || "Active"}</span>
                                      </div>
                                    </div>
                                    {p.photo_url && (
                                      <div className="pt-2">
                                        <span className="text-gray-400 text-[8px] uppercase block mb-1">Attachment Photo</span>
                                        <div className="relative rounded overflow-hidden border border-amber-100 bg-white">
                                          <img
                                            src={p.photo_url ? `${API_BASE}${p.photo_url}` : undefined}
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
                            )}

                            {/* Asset Tagging list */}
                            {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-[9px] font-bold text-emerald-700 uppercase">Asset Tagging Records</div>
                                {assetsList.map((a: any, aIdx: number) => (
                                  <div key={aIdx} className="bg-emerald-50/30 border border-emerald-100 rounded-lg p-2.5 flex justify-between items-center text-[10px] text-left">
                                    <span className="font-extrabold text-gray-800">{a.equipment_name}</span>
                                    <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-gray-700 font-bold font-mono">Qty: {a.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Quantities for Mobilise, Calibration or Other */}
                            {(selectedActs.includes("Mobilise Asset Update") || selectedActs.includes("Calibration") || (selectedActs.includes("Other") && activityOtherDesc)) && (
                              <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 text-[10px] font-bold space-y-1">
                                {selectedActs.includes("Mobilise Asset Update") && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Mobilise Qty:</span>
                                    <span className="text-indigo-700 font-extrabold">{mobiliseCount} units</span>
                                  </div>
                                )}
                                {selectedActs.includes("Calibration") && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Calibration Qty:</span>
                                    <span className="text-purple-700 font-extrabold">{calibrationCount} units</span>
                                  </div>
                                )}
                                {selectedActs.includes("Other") && activityOtherDesc && (
                                  <div className="border-t border-gray-100 pt-1.5 mt-1 font-normal text-left">
                                    <span className="text-gray-400 text-[8px] uppercase block font-bold">Other Activity Description</span>
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

                        {/* Attachments Section */}
            {claimDetails.category !== "Limit Request" && (
              <div className="space-y-1.5">
                <Text type="secondary" className="text-[9px] uppercase font-bold tracking-wider block">Receipt Invoices &amp; Attachments</Text>
                {getAttachmentsArray(claimDetails.attachments).length === 0 ? (
                  <Text type="secondary" className="italic text-xs block pl-1">No file attachments uploaded for this claim.</Text>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {getAttachmentsArray(claimDetails.attachments).map((url: string, index: number) => {
                      const filename = url.substring(url.lastIndexOf("/") + 1) || `Receipt-${index + 1}`;
                      return (
                        <Tag 
                          key={index} 
                          color="blue" 
                          className="cursor-pointer font-medium hover:border-indigo-400 px-2 py-0.5 flex items-center gap-1.5"
                          onClick={() => setLightboxImage(url.startsWith("http") ? url : `${API_BASE}${url}`)}
                        >
                          <Download size={10} className="inline mr-1" /> {filename}
                        </Tag>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Approval History Section with Decision-Based Color Coding */}
            {claimDetails.approvals && claimDetails.approvals.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-gray-200">
                  <h4 className="text-[10.5px] font-bold uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-indigo-600" />
                    Approval History &amp; Decision Remarks
                  </h4>
                </div>
                <div className="p-3 bg-white space-y-3">
                  {claimDetails.approvals.map((app: any, idx: number) => {
                    const statusVal = (app.status || "").toLowerCase();
                    const isApproved = statusVal === "approved";
                    const isRejected = statusVal === "rejected";

                    let containerBgClass = "bg-amber-50/70 border-amber-300 border-l-4 text-amber-950";
                    let statusBadge = <Tag color="warning" className="font-bold text-[9px] uppercase tracking-wider">Pending/Returned</Tag>;
                    let remarkBgClass = "bg-amber-100/60 border-amber-300 text-amber-950";

                    if (isApproved) {
                      containerBgClass = "bg-emerald-50/70 border-emerald-400 border-l-4 text-emerald-950";
                      statusBadge = <Tag color="success" className="font-bold text-[9px] uppercase tracking-wider">Approved</Tag>;
                      remarkBgClass = "bg-emerald-100/60 border-emerald-300 text-emerald-950";
                    } else if (isRejected) {
                      containerBgClass = "bg-rose-50/70 border-rose-400 border-l-4 text-rose-950";
                      statusBadge = <Tag color="error" className="font-bold text-[9px] uppercase tracking-wider">Rejected</Tag>;
                      remarkBgClass = "bg-rose-100/60 border-rose-300 text-rose-950";
                    } else if (statusVal === "waiting") {
                      containerBgClass = "bg-slate-50 border-slate-300 border-l-4 text-slate-900";
                      statusBadge = <Tag color="default" className="font-bold text-[9px] uppercase tracking-wider">Waiting</Tag>;
                      remarkBgClass = "bg-slate-100 border-slate-200 text-slate-900";
                    }

                    const commentText = app.comments || app.remark || app.rejection_reason;

                    return (
                      <div key={idx} className={`flex gap-3 text-xs pl-3 py-2 p-3 rounded-md shadow-2xs ${containerBgClass}`}>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-gray-900 text-xs">{app.approver_name}</span>
                              <span className="text-[9.5px] text-gray-600 font-bold uppercase ml-1.5">({app.approver_role || `L${app.level_number} Approver`})</span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono font-medium">
                              {app.updated_at ? formatDateTime(app.updated_at) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 font-bold text-[9px] uppercase tracking-wider">Decision:</span>
                            {statusBadge}
                          </div>
                          {commentText && (
                            <div className={`mt-2 p-2.5 rounded-md border ${remarkBgClass}`}>
                              <span className="text-[9px] font-bold uppercase tracking-wider block opacity-80 mb-0.5">Decision Remark / Comment:</span>
                              <p className="font-semibold text-xs leading-relaxed">
                                "{commentText}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Policy Deductions & Audit Remarks Center */}
            {((claimDetails.original_amount && claimDetails.original_amount > claimDetails.amount) ||
              claimDetails.deduction_remark ||
              claimDetails.rejection_reason ||
              (claimDetails.itineraries && claimDetails.itineraries.some((leg: any) => {
                const travelCost = leg.amount || 0;
                const subCost = leg.sub_amount || 0;
                const daCost = leg.da || 0;
                const origTA = parseFloat(leg.original_amount ?? leg.amount ?? 0);
                const origSub = parseFloat(leg.original_sub_amount ?? leg.sub_amount ?? 0);
                const origDA = parseFloat(leg.original_da ?? leg.da ?? 0);
                return ((origTA - travelCost) + (origSub - subCost)) > 0 || (origDA - daCost) > 0;
              }))
            ) && (
              <div className="border border-rose-300 rounded-lg overflow-hidden bg-rose-50/40 shadow-2xs">
                <div className="px-3.5 py-2.5 bg-rose-100/80 border-b border-rose-300 flex items-center justify-between">
                  <h4 className="text-[10.5px] font-bold uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-rose-600" />
                    Policy Deductions &amp; Audit Remarks
                  </h4>
                  {claimDetails.original_amount && claimDetails.original_amount > claimDetails.amount && (
                    <span className="text-xs font-mono font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-300 shadow-2xs">
                      Total Deducted: ₹{(claimDetails.original_amount - claimDetails.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                
                <div className="p-3 space-y-3 bg-white">
                  {/* Overall Deduction / Rejection Remarks if present */}
                  {(claimDetails.deduction_remark || claimDetails.rejection_reason) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-950">
                      <span className="font-bold uppercase text-[9px] text-rose-700 block mb-0.5">Audit Remark / Deduction Reason:</span>
                      <p className="font-semibold italic">"{claimDetails.deduction_remark || claimDetails.rejection_reason}"</p>
                    </div>
                  )}

                  {/* Leg-by-leg deductions list */}
                  {claimDetails.itineraries && claimDetails.itineraries.map((leg: any, idx: number) => {
                    const travelCost = leg.amount || 0;
                    const subCost = leg.sub_amount || 0;
                    const daCost = leg.da || 0;
                    const origTA = parseFloat(leg.original_amount ?? leg.amount ?? 0);
                    const origSub = parseFloat(leg.original_sub_amount ?? leg.sub_amount ?? 0);
                    const origDA = parseFloat(leg.original_da ?? leg.da ?? 0);

                    const taDeducted = (origTA - travelCost) + (origSub - subCost);
                    const daDeducted = origDA - daCost;

                    if (taDeducted <= 0 && daDeducted <= 0) return null;

                    return (
                      <div key={idx} className="flex flex-col gap-1.5 border-l-4 border-rose-500 pl-3 py-2 bg-rose-50/30 p-2.5 text-xs rounded-md border border-rose-200">
                        <div className="flex justify-between items-center font-bold text-gray-900">
                          <span>Visit Leg #{leg.leg} ({leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`})</span>
                          <span className="text-rose-700 font-mono font-bold bg-white px-2 py-0.5 rounded border border-rose-300 shadow-2xs">
                            Deducted: ₹{(taDeducted + daDeducted).toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-1 text-[11px] text-gray-700">
                          {taDeducted > 0 && (
                            <p className="bg-white p-2 rounded border border-gray-200">
                              <strong className="text-rose-700 font-bold">Travel Fare:</strong> Deducted ₹{taDeducted.toLocaleString()} (Claimed: ₹{(origTA + origSub).toLocaleString()} | Allowed: ₹{(travelCost + subCost).toLocaleString()}). <span className="italic text-gray-600 block mt-0.5">Reasoning: Claimed travel fare exceeded location policy limits.</span>
                            </p>
                          )}
                          {daDeducted > 0 && (
                            <p className="bg-white p-2 rounded border border-gray-200">
                              <strong className="text-rose-700 font-bold">Daily Allowance (DA):</strong> Deducted ₹{daDeducted.toLocaleString()} (Claimed: ₹{origDA.toLocaleString()} | Allowed: ₹{daCost.toLocaleString()}). <span className="italic text-gray-600 block mt-0.5">Reasoning: DA claimed value exceeded daily policy grade ceilings.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audit Log / History list */}
            {claimDetails.logs && claimDetails.logs.length > 0 && (
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-[10px] font-bold uppercase text-gray-655 tracking-wider">Audit Log &amp; Workflow History</h4>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="table-lte">
                    <thead>
                      <tr className="border-b border-gray-200 text-[8.5px] uppercase font-bold tracking-wider text-gray-455 bg-gray-50">
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3">Comment / Reason Remarks</th>
                        <th className="py-2 px-3">Actor</th>
                        <th className="py-2 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                      {claimDetails.logs.map((log: any, logIdx: number) => {
                        let cleanField = (log.field_name || "").replace(/_/g, " ").toUpperCase();
                        if (cleanField === "STATUS") cleanField = "DECISION";
                        return (
                          <tr key={logIdx} className="hover:bg-gray-50 bg-white">
                            <td className="py-2 px-3 font-semibold text-gray-655">{cleanField}</td>
                            <td className="py-2 px-3 italic text-gray-600 max-w-[200px] break-words" title={log.comment}>{log.comment || "—"}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold block">{log.editor_name}</span>
                              <span className="text-[8px] text-amber-600 font-bold block">{log.editor_role}</span>
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

            {/* Approver Decision Center */}
            {pendingApprovalStep && (
              <div className="p-3 bg-amber-50 border border-amber-250 rounded space-y-3">
                <div className="font-bold text-amber-805 uppercase tracking-wide flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-605 animate-pulse" />
                  <span>Approver Decision Center</span>
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-[9px] font-bold text-gray-550 uppercase block">
                    Remarks / Decision Comments <span className="text-red-500 font-bold">* Required for Rejection</span>
                  </label>
                  <TextArea
                    value={comments}
                    onChange={(e: any) => setComments(e.target.value)}
                    placeholder="Enter approval remarks or rejection comments reason..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="primary"
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white font-bold"
                  >
                    Approve Claim
                  </Button>
                  <Button
                    danger
                    disabled={actionLoading}
                    onClick={handleReject}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 border-rose-600 text-white font-bold"
                  >
                    Reject Claim
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================= STATS CLAIMS POPUP MODAL ================= */}
      <Modal
        title={
          <Title level={5} style={{ margin: 0 }} className="flex items-center gap-2 text-gray-805">
            <FileSpreadsheet className="w-4 h-4 text-indigo-650" />
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
              pagination={{ pageSize: 15, size: "small" }}
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
                  width: 100,
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
        footer={null}
        onCancel={() => setLightboxImage(null)}
        width={750}
        bodyStyle={{ padding: 16, textAlign: "center", background: "#111827" }}
        className="lightbox-modal"
        closeIcon={
          <div className="bg-slate-800 hover:bg-slate-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm border border-slate-700 transition-colors shadow-lg font-bold">✕</div>
        }
        centered
      >
        {isConvertingHeic ? (
          <div className="text-white flex flex-col items-center justify-center gap-3 p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-bold tracking-wide">Converting Apple HEIC image...</span>
          </div>
        ) : (
          <img 
            src={displayImageUrl || lightboxImage || undefined} 
            alt="Receipt Invoice Lightbox" 
            className="max-w-full max-h-[75vh] rounded object-contain mx-auto"
          />
        )}
      </Modal>
    </>
  );
}
