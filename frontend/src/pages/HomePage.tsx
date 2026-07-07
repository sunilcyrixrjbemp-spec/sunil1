import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ExpenseCalendar from "../components/common/ExpenseCalendar";
import brandLogo from "../assets/images/brand.png";
import { 
  FileSpreadsheet, 
  BarChart3, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Layers,
  Users,
  Check,
  X,
  Loader2,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

const rawApiUrl = import.meta.env.VITE_API_URL || "";
const API_BASE = (rawApiUrl && !rawApiUrl.includes("onrender.com")) ? rawApiUrl : "https://fieldops-secondary-api.sunnybishnoi.workers.dev";

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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none">
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Amount:
          </span>
          <span className="font-mono font-bold text-white">₹{payload[0].value?.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function HomePage() {

  const navigate = useNavigate();
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
    return (localStorage.getItem("dashboard_active_tab") as "my-claims" | "team-claims") || "my-claims";
  }));

  const handleTabChange = (tab: "my-claims" | "team-claims") => {
    setActiveTab(tab);
    localStorage.setItem("dashboard_active_tab", tab);
  };

  // Read-only Details Modal states
  const [selectedClaimId, setSelectedClaimId] = useState<number | string | null>(null);
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [comments, setComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Popup modal for clicked stats card
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalType, setStatsModalType] = useState<"Total Claimed" | "Approved" | "Pending" | "Rejected">("Total Claimed");
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
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [selectMonth, setSelectMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // Default current month YYYY-MM
  });
  const [homeStatusFilter, setHomeStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const refreshDashboardData = async () => {
    const currentUser = authService.getCurrentUser() || user;
    if (!currentUser) return;

    const uId = currentUser.user_id;
    const allowedWindows = currentUser.allowed_windows
      ? currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
      : ["home", "profile", "help"];
    const isReviewer = allowedWindows.includes("approval");

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

  const userRole = user.role || "Engineer";
  const allowedWindows = user.allowed_windows
    ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
    : ["home", "profile", "help"];



  const isReviewerRole = userRole === "Admin" || allowedWindows.includes("approval");

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved") return "bg-green-50 border-green-200 text-green-700";
    if (s === "rejected") return "bg-red-50 border-red-200 text-red-700";
    if (s.startsWith("submitted")) return "bg-yellow-50 border-yellow-250 text-yellow-750 font-bold";
    return "bg-gray-50 border-gray-200 text-gray-600";
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

  // Unique employee list for dropdown filter
  const uniqueEmployees = Array.from(
    new Map(
      safeTeamExpenses
        .filter((e): e is any => !!e && !!e.submitter_code && !!e.submitter_name)
        .map(e => [e.submitter_code, e.submitter_name])
    ).entries()
  ).map(([code, name]) => ({ code: String(code), name: String(name) }));

  // Unique categories/modes for dropdown filter
  const uniqueModes = Array.from(
    new Set(
      safeTeamExpenses
        .filter((e): e is any => !!e && !!e.category)
        .map(e => String(e.category))
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
          if (!(s.startsWith("submitted") || s === "pending" || s === "draft")) return false;
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
      if (filterEmployee !== "all" && exp.submitter_code !== filterEmployee) return false;
      if (filterMode !== "all" && exp.category !== filterMode) return false;
      if (homeStatusFilter !== "all") {
        const s = (exp.status || "").toLowerCase();
        if (homeStatusFilter === "pending") {
          if (!(s.startsWith("submitted") || s === "pending" || s === "draft")) return false;
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

  const getTeamChartData = () => {
    const grouped: Record<string, { name: string, amount: number }> = {};
    filteredTeamExpenses.forEach(e => {
      if (e.category === "Limit Request") return;
      const code = e.submitter_code;
      if (!grouped[code]) {
        grouped[code] = { name: e.submitter_name, amount: 0 };
      }
      grouped[code].amount += e.amount;
    });
    return Object.entries(grouped)
      .map(([code, val]) => ({ code, name: val.name, amount: val.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  };

  // Stats calculations based on current active tab
  const currentClaimsList = activeTab === "my-claims" ? filteredPersonalExpenses : filteredTeamExpenses;

  const statsTotalClaims = currentClaimsList;
  const statsApprovedClaims = currentClaimsList.filter(c => c.status?.toLowerCase() === "approved");
  const statsRejectedClaims = currentClaimsList.filter(c => c.status?.toLowerCase() === "rejected");
  const statsPendingClaims = currentClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s.startsWith("submitted") || s === "pending" || s === "draft";
  });

  const getStatsSums = (list: any[]) => list.filter(c => c.category !== "Limit Request").reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalAmount = getStatsSums(statsTotalClaims);
  const approvedAmount = getStatsSums(statsApprovedClaims);
  const pendingAmount = getStatsSums(statsPendingClaims);
  const rejectedAmount = getStatsSums(statsRejectedClaims);

  const handleOpenStatsModal = (type: "Total Claimed" | "Approved" | "Pending" | "Rejected", list: any[]) => {
    setStatsModalType(type);
    setStatsModalClaims(list);
    setShowStatsModal(true);
  };

  return (
    <>
      <div className="space-y-6 animate-fadeIn text-[#212529]">
        
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-wide">
            Dashboard Home
          </h2>
          <p className="text-gray-500 text-xs mt-1">Access claims summary statistics and operations management hub.</p>
        </div>
      
        {/* Welcome Banner - AdminLTE card style with gradient border top */}
      <div className="bg-white border-2 border-blue-200 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5 flex-1">
            <span className="text-blue-600 font-extrabold text-[9px] uppercase tracking-widest block">Operations Hub</span>
            <h2 className="text-base font-extrabold text-gray-800">Hi, {user.name}</h2>
          </div>
          <img src={brandLogo} alt="Cyrix Logo" className="h-14 w-auto object-contain shrink-0 hidden sm:block bg-white p-1.5 rounded border border-gray-300 shadow-xs" />
        </div>
      </div>

      {/* ⚡ Quick Actions Navigation Bar */}
      <div className="hidden md:block bg-white border-t-4 border-t-blue-500 rounded shadow-xs p-3 mb-4">
        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-2.5 flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-blue-600" />
          Quick Actions Shortcuts
        </h4>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/submit-expense"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded no-underline shadow-sm transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Submit New Expense
          </Link>
          
          {(() => {
            const allowed = (user?.allowed_windows || "").toLowerCase();
            const isReviewer = allowed.includes("approval");
            if (isReviewer) {
              return (
                <Link
                  to="/approval-center"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3.5 py-2 rounded no-underline shadow-sm transition-all duration-200"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Approval Center
                </Link>
              );
            }
            return null;
          })()}

          {(() => {
            const allowed = (user?.allowed_windows || "").toLowerCase();
            if (allowed.includes("consolidated_report")) {
              return (
                <Link
                  to="/consolidated-report"
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-3.5 py-2 rounded no-underline shadow-sm transition-all duration-200"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Consolidated Report
                </Link>
              );
            }
            return null;
          })()}

          {(() => {
            const allowed = (user?.allowed_windows || "").toLowerCase();
            if (allowed.includes("analysis")) {
              return (
                <Link
                  to="/analysis"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded no-underline shadow-sm transition-all duration-200"
                >
                  <BarChart3 className="w-4 h-4" />
                  Analysis Dashboard
                </Link>
              );
            }
            return null;
          })()}

          {(user?.allowed_windows || "").toLowerCase().includes("admin") && (
            <Link
              to="/admin"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-3.5 py-2 rounded no-underline shadow-sm transition-all duration-200"
            >
              <Users className="w-4 h-4" />
              Admin Panel
            </Link>
          )}
        </div>
      </div>

      {isReviewerRole && pendingLimitRequestsCount > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded shadow-sm flex items-center justify-between animate-fadeIn mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Limit Extension Requests</h4>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                You have {pendingLimitRequestsCount} pending limit request{pendingLimitRequestsCount > 1 ? 's' : ''} from your team awaiting your review.
              </p>
            </div>
          </div>
          <Link 
            to="/approval-center" 
            className="btn-lte-warning px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-xs no-underline"
          >
            Review Now
          </Link>
        </div>
      )}

      {/* Navigation Quick Cards replaced by Stats Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-650 uppercase tracking-wider">
            {activeTab === "my-claims" ? "My Expense Summary" : "Team Expense Summary"}
          </h3>
          
          {/* Month selector element */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Select Month:</span>
            <input 
              type="month"
              value={selectMonth}
              onChange={(e) => setSelectMonth(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-[10px] font-bold text-gray-800 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Claimed */}
          <div 
            onClick={() => handleOpenStatsModal("Total Claimed", statsTotalClaims)}
            className="info-box-lte cursor-pointer animate-fadeIn"
          >
            <div className="info-box-icon bg-[#007bff]">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Total Claimed</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{(totalAmount || 0).toLocaleString()}</span>
              <span className="text-[9px] text-[#007bff] font-bold uppercase block mt-1">{statsTotalClaims.length} Claims Filed</span>
            </div>
          </div>

          {/* Card 2: Approved */}
          <div 
            onClick={() => handleOpenStatsModal("Approved", statsApprovedClaims)}
            className="info-box-lte cursor-pointer animate-fadeIn"
          >
            <div className="info-box-icon bg-[#28a745]">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Approved Claim</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{(approvedAmount || 0).toLocaleString()}</span>
              <span className="text-[9px] text-[#28a745] font-bold uppercase block mt-1">{statsApprovedClaims.length} Approved</span>
            </div>
          </div>

          {/* Card 3: Pending */}
          <div 
            onClick={() => handleOpenStatsModal("Pending", statsPendingClaims)}
            className="info-box-lte cursor-pointer animate-fadeIn"
          >
            <div className="info-box-icon bg-[#ffc107]">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Pending Claims</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{(pendingAmount || 0).toLocaleString()}</span>
              <span className="text-[9px] text-amber-600 font-bold uppercase block mt-1">{statsPendingClaims.length} Pending Review</span>
            </div>
          </div>

          {/* Card 4: Rejected */}
          <div 
            onClick={() => handleOpenStatsModal("Rejected", statsRejectedClaims)}
            className="info-box-lte cursor-pointer animate-fadeIn"
          >
            <div className="info-box-icon bg-[#dc3545]">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Rejected Claim</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{(rejectedAmount || 0).toLocaleString()}</span>
              <span className="text-[9px] text-[#dc3545] font-bold uppercase block mt-1">{statsRejectedClaims.length} Rejected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Area: Tab list and Limits */}
        <div className="lg:col-span-2 space-y-6">

          {/* TAB SYSTEM: My Claims vs Team Claims */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
            {/* Tab Header bar */}
            <div className="bg-[#e9eff6] flex items-center justify-start p-1.5 gap-2" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => handleTabChange("my-claims")}
                style={{
                  minHeight: 'auto',
                  backgroundColor: activeTab === "my-claims" ? "#a5d8e8" : undefined
                }}
                className={`py-1 px-4 font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-0 ${
                  activeTab === "my-claims"
                    ? "text-slate-900 font-extrabold shadow-sm"
                    : "text-slate-600 bg-transparent hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                My Claims ({filteredPersonalExpenses.length})
              </button>

              {isReviewerRole && (
                <button
                  type="button"
                  onClick={() => handleTabChange("team-claims")}
                  style={{
                    minHeight: 'auto',
                    backgroundColor: activeTab === "team-claims" ? "#a5d8e8" : undefined
                  }}
                  className={`py-1 px-4 font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-0 ${
                    activeTab === "team-claims"
                      ? "text-slate-900 font-extrabold shadow-sm"
                      : "text-slate-600 bg-transparent hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Team Claims ({filteredTeamExpenses.length})
                </button>
              )}
            </div>

            {/* Contextual Filters Row — matches ExpensePage compact filter style */}
            <div className="border-b border-gray-200 px-3 py-2.5">
              {activeTab === "my-claims" ? (
                /* My Self Tab Filters */
                <div className="bg-slate-50 border border-gray-200 rounded p-2.5 flex flex-col gap-2 text-[10px] font-bold text-gray-700">
                  {/* Row 1: Month dropdown */}
                  <div className="flex flex-col gap-1 max-w-[150px]">
                    <span className="text-[8px] font-black uppercase text-gray-400">Month</span>
                    <input 
                      type="month"
                      value={selectMonth}
                      onChange={(e) => setSelectMonth(e.target.value)}
                      className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-black text-gray-800 cursor-pointer focus:outline-none focus:border-blue-500 w-full"
                    />
                  </div>
                  {/* Row 2: Status pill buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 border-t border-gray-200/50 pt-1.5">
                    {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setHomeStatusFilter(status)}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                          homeStatusFilter === status
                            ? "bg-[#a5d8e8] text-slate-800 border-[#a5d8e8] font-extrabold shadow-sm"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-slate-100 hover:text-gray-800"
                        }`}
                      >
                        {status === "all" ? "All" : status}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Team / Engineer Claims Tab Filters */
                <div className="bg-slate-50 border border-gray-200 rounded p-2.5 flex flex-col gap-2 text-[10px] font-bold text-gray-700">
                  {/* Row 1: Month and Engineer dropdowns with labels on top */}
                  <div className="grid grid-cols-2 gap-2.5 w-full">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-gray-400">Month</span>
                      <input 
                        type="month"
                        value={selectMonth}
                        onChange={(e) => setSelectMonth(e.target.value)}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-black text-gray-800 cursor-pointer focus:outline-none focus:border-blue-500 w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-black uppercase text-gray-400">Engineer</span>
                      <select 
                        value={filterEmployee} 
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-black text-gray-800 cursor-pointer focus:outline-none focus:border-blue-500 w-full"
                      >
                        <option value="all">All Members</option>
                        {uniqueEmployees.map(emp => (
                          <option key={emp.code} value={emp.code}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Status pill buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 border-t border-gray-200/50 pt-1.5">
                    {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setHomeStatusFilter(status)}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                          homeStatusFilter === status
                            ? "bg-[#a5d8e8] text-slate-800 border-[#a5d8e8] font-extrabold shadow-sm"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-[#a5d8e8]/20 hover:text-slate-800"
                        }`}
                      >
                        {status === "all" ? "All" : status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tab Content Tables */}
            <div className="overflow-x-auto p-4 flex-1 bg-slate-50/30">
               {/* MY CLAIMS TAB */}
              {activeTab === "my-claims" && (
                loadingMyExpenses ? (
                  <Loader message="Loading your claims..." />
                ) : filteredPersonalExpenses.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-xs">
                    <Compass className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-bold">No expense claims found for this month.</p>
                  </div>
                ) : (
                  <>
                    <table className="hidden md:table table-lte">
                      <thead>
                        <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-black tracking-wider border-b border-slate-700">
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Claim ID</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Date</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Purpose</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Travel Mode</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Distance</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Auto Fare</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Amount</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredPersonalExpenses.map((exp) => (
                          <tr 
                            key={exp.id} 
                            onClick={() => handleOpenClaimDetails(exp.id)}
                            className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-3 font-semibold font-mono text-blue-600 uppercase whitespace-nowrap">{exp.expense_code}</td>
                            <td className="py-3 px-3 text-gray-550 whitespace-nowrap">{exp.itinerary}</td>
                            <td className="py-3 px-3 font-semibold text-gray-800 truncate max-w-[150px] whitespace-nowrap" title={exp.description}>{exp.description}</td>
                            <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{exp.travel_mode}</td>
                            <td className="py-3 px-3 font-mono font-semibold text-gray-650 whitespace-nowrap">{exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}</td>
                            <td className="py-3 px-3 font-mono font-semibold text-gray-650 whitespace-nowrap">{exp.total_auto ? `₹${exp.total_auto.toLocaleString()}` : "—"}</td>
                            <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">₹{exp.amount.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                {exp.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden space-y-3 pb-24">
                      {filteredPersonalExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          onClick={() => handleOpenClaimDetails(exp.id)}
                          className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-3.5 active:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                        >
                          <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                            <span className="font-bold font-mono text-blue-600 text-xs uppercase">{exp.expense_code}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                              {exp.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Date</span>
                              <span className="text-gray-700 font-semibold">{exp.itinerary || exp.date}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Travel Mode</span>
                              <span className="inline-block border border-blue-200 bg-blue-50 text-blue-700 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider mt-0.5">
                                {exp.travel_mode || exp.category}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                              <span className="text-gray-700 font-semibold">
                                {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}
                                {exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Total Amount</span>
                              <span className="text-gray-900 font-extrabold text-xs">₹{exp.amount.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          {exp.description && (
                            <div className="border-t border-gray-100 pt-2.5 text-[10px]">
                              <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                              <p className="text-gray-600 font-semibold mt-0.5 truncate">{exp.description}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}

              {/* TEAM CLAIMS TAB */}
              {activeTab === "team-claims" && (
                loadingTeamExpenses ? (
                  <Loader message="Loading team claims..." />
                ) : safeTeamExpenses.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-xs">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-bold">No claims submitted by your team members yet.</p>
                  </div>
                ) : (
                  <>
                    <table className="hidden md:table table-lte">
                      <thead>
                        <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-black tracking-wider border-b border-slate-700">
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Employee</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Claim ID</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Date</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Purpose</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Mode</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Distance</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Auto Fare</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">Amount</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredTeamExpenses.map((exp) => (
                          <tr 
                            key={exp.id} 
                            onClick={() => handleOpenClaimDetails(exp.id)}
                            className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-3 whitespace-nowrap">
                              <p className="font-bold text-gray-800 leading-none">{exp.submitter_name}</p>
                              <span className="text-[8px] font-mono uppercase text-blue-600 block mt-0.5">{exp.submitter_code}</span>
                            </td>
                            <td className="py-3 px-3 font-semibold font-mono text-blue-600 uppercase whitespace-nowrap">{exp.expense_code}</td>
                            <td className="py-3 px-3 text-gray-550 whitespace-nowrap">{exp.date}</td>
                            <td className="py-3 px-3 font-semibold text-gray-800 truncate max-w-[120px] whitespace-nowrap" title={exp.purpose}>{exp.purpose}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-block border border-blue-200 bg-blue-50 text-blue-705 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                {exp.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-gray-655 whitespace-nowrap">{exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}</td>
                            <td className="py-3 px-3 font-mono font-semibold text-gray-655 whitespace-nowrap">{exp.total_auto ? `₹${exp.total_auto.toLocaleString()}` : "—"}</td>
                            <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">₹{exp.amount.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                                {exp.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden space-y-3 pb-24">
                      {filteredTeamExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          onClick={() => handleOpenClaimDetails(exp.id)}
                          className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-3.5 active:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                        >
                          <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                            <div>
                              <p className="font-bold text-gray-800 text-xs leading-none">{exp.submitter_name}</p>
                              <span className="text-[8px] font-mono font-bold uppercase text-blue-600 block mt-1">{exp.submitter_code}</span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                              {exp.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Claim ID / Date</span>
                              <span className="text-gray-700 font-semibold">{exp.expense_code} ({exp.date || exp.itinerary})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Mode</span>
                              <span className="inline-block border border-blue-200 bg-blue-50 text-blue-705 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider mt-0.5">
                                {exp.category || exp.travel_mode}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Distance / Auto</span>
                              <span className="text-gray-700 font-semibold">
                                {exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}
                                {exp.total_auto ? ` / ₹${exp.total_auto.toLocaleString()}` : ""}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 font-bold uppercase text-[9px] block">Amount</span>
                              <span className="text-gray-900 font-extrabold text-xs">₹{exp.amount.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          {exp.purpose && (
                            <div className="border-t border-gray-100 pt-2.5 text-[10px]">
                              <span className="text-gray-400 font-bold uppercase text-[8px] block">Purpose</span>
                              <p className="text-gray-600 font-semibold mt-0.5 truncate">{exp.purpose}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}

            </div>
          </div>

        </div>

        {/* Right Sidebar: Dynamic Charts & Filters */}
        <div className="hidden lg:block space-y-4 font-sans">
          {activeTab === "my-claims" ? (
            /* PERSONAL CLAIMS CHART BOX */
            <div className="bg-white border border-gray-200 border-t-4 border-t-blue-600 rounded shadow-sm p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-blue-600 font-extrabold text-[9px] uppercase tracking-widest block">Claims Analytics</span>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-605" />
                  Personal Mode Breakdown
                </h3>
              </div>
              {safeMyExpenses.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                  No claims to analyze
                </div>
              ) : (
                <div style={{ height: 180 }} className="relative flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getPersonalChartData().map(c => ({ name: c.label, value: c.amount }))}
                        cx="50%" cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3} dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {getPersonalChartData().map((_, i) => (
                          <Cell key={i} fill={GALLERY_COLORS[i % GALLERY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total Claimed</span>
                    <span className="text-xs font-black text-slate-800 font-mono">
                      ₹{getPersonalChartData().reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TEAM CLAIMS ANALYTICS & CHART BOX */
            <div className="bg-white border border-gray-200 border-t-4 border-t-indigo-600 rounded shadow-sm p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-indigo-600 font-extrabold text-[9px] uppercase tracking-widest block">Team Performance</span>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-605" />
                  Team Claims Analytics
                </h3>
              </div>

              {/* Filters Panel */}
              <div className="space-y-3 p-3.5 bg-slate-50 rounded border border-slate-100 text-[10px] font-bold text-gray-650">
                <span className="uppercase tracking-widest text-[9px] block text-slate-500">Filter Controls</span>
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <label className="block text-[8px] uppercase tracking-wider text-gray-400">Employee</label>
                    <select 
                      value={filterEmployee} 
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1 text-[10px] font-bold text-gray-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">All Team Members</option>
                      {uniqueEmployees.map(emp => (
                        <option key={emp.code} value={emp.code}>{emp.name} ({emp.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="block text-[8px] uppercase tracking-wider text-gray-400">Travel Mode</label>
                    <select 
                      value={filterMode} 
                      onChange={(e) => setFilterMode(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1 text-[10px] font-bold text-gray-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">All Modes</option>
                      {uniqueModes.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="block text-[8px] uppercase tracking-wider text-gray-400">Claim Month</label>
                    <input 
                      type="month" 
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1 text-[10px] font-bold text-gray-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Filter Metrics box (like My Expense caps) */}
              <div className="border border-blue-150 p-3.5 bg-blue-50/20 rounded space-y-2.5">
                <h4 className="text-[9px] font-bold text-blue-800 uppercase tracking-widest leading-none">Filtered Team Totals</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white p-2.5 border border-blue-100 rounded text-center space-y-0.5 shadow-sm">
                    <span className="text-gray-400 font-bold uppercase tracking-wider block text-[7px] leading-none">Total Distance</span>
                    <span className="text-xs font-black text-blue-700 font-mono leading-none">{totalFilteredKm.toFixed(1)} KM</span>
                  </div>
                  <div className="bg-white p-2.5 border border-blue-100 rounded text-center space-y-0.5 shadow-sm">
                    <span className="text-gray-400 font-bold uppercase tracking-wider block text-[7px] leading-none">Auto Expense</span>
                    <span className="text-xs font-black text-blue-700 font-mono leading-none">₹{totalFilteredAuto.toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-white p-2 border border-blue-100 rounded text-center shadow-sm">
                  <span className="text-gray-450 font-bold uppercase tracking-wider block text-[7px] leading-none">Aggregate Reimbursement</span>
                  <span className="text-sm font-black text-indigo-700 font-mono">₹{totalFilteredAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Top Employees Chart (SVG) */}
              {filteredTeamExpenses.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                  No matching claims
                </div>
              ) : (
                <div className="space-y-2.5">
                  <h4 className="text-[9px] font-extrabold uppercase text-gray-400 tracking-wider">Top Expenditures Comparison</h4>
                  {(() => {
                    const chartData = getTeamChartData();
                    if (chartData.length === 0) return null;
                    return (
                      <div style={{ height: 180 }} className="relative flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData.map(c => ({ name: c.name, value: c.amount }))}
                              cx="50%" cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={3} dataKey="value"
                              stroke="#ffffff"
                              strokeWidth={2}
                            >
                              {chartData.map((_, i) => (
                                <Cell key={i} fill={GALLERY_COLORS[i % GALLERY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total Team</span>
                          <span className="text-xs font-black text-slate-800 font-mono">
                            ₹{chartData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Expense Calendar Tracker Section */}
          <ExpenseCalendar 
            expenses={activeTab === "my-claims" ? safeMyExpenses : filteredTeamExpenses} 
            isTeamView={activeTab !== "my-claims"}
            selectMonth={selectMonth}
          />
        </div>
      </div>
      </div>

      {/* ================= INTERACTIVE READ-ONLY CLAIM DETAILS POPUP MODAL ================= */}
      {showDetailsModal && selectedClaimId && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-5xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-gray-100 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Claim Details {claimDetails ? `— ${claimDetails.expense_code}` : ""}</span>
                {loadingDetails && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
              </h3>
              <button 
                onClick={() => { setShowDetailsModal(false); setClaimDetails(null); }}
                className="w-7 h-7 rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-all cursor-pointer flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
              {!claimDetails ? (
                <Loader message="Loading claim details..." />
              ) : (
                <>
                  {/* Summary Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Submitted By</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{claimDetails.submitter_name || user?.name || "Sunil Vishnoi"}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{claimDetails.submitter_code || user?.user_id || "E1704"}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Travel Date</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{claimDetails.date}</span>
                      <span className="text-[10px] text-gray-500">{claimDetails.month} {claimDetails.year}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Submitted At</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{formatDateTime(claimDetails.created_at)}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Status</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider mt-1 ${getStatusBadgeClass(claimDetails.status)}`}>
                        {claimDetails.status}
                      </span>
                    </div>
                  </div>

                  {/* Purpose & Total */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div>
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Purpose:</span>
                      <span className="font-semibold text-gray-800 ml-1">{claimDetails.purpose || claimDetails.description || "Field visits"}</span>
                    </div>
                    <div className="text-right">
                      {claimDetails.category === "Limit Request" ? (
                        <div className="space-y-1">
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase block">Requested Limit</span>
                            <span className="text-xs font-bold text-gray-600 font-mono">
                              {claimDetails.travel_mode === "KM" ? `${claimDetails.requested_value || claimDetails.total_km} KM` : `₹${(claimDetails.requested_value || claimDetails.amount).toLocaleString()}`}
                            </span>
                          </div>
                          {claimDetails.status.toLowerCase() === "approved" && (
                            <div>
                              <span className="text-[9px] text-emerald-600 font-extrabold uppercase block">Approved Limit</span>
                              <span className="text-sm font-black text-emerald-700 font-mono">
                                {claimDetails.travel_mode === "KM" ? `${claimDetails.approved_value ?? (claimDetails.requested_value || claimDetails.total_km)} KM` : `₹${(claimDetails.approved_value ?? (claimDetails.requested_value || claimDetails.amount)).toLocaleString()}`}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="text-[9px] text-gray-500 font-bold uppercase block">Total</span>
                          <span className="text-lg font-black text-blue-700 font-mono">
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
                              const legTotal = travelCost + subCost + daCost + hotelCost + lpCost + otherCost;

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
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{daCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{hotelCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{lpCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-mono font-bold">₹{otherCost.toLocaleString()}</span>
                                      {leg.oth_desc && <span className="text-[9px] text-gray-400 block truncate max-w-[100px]" title={leg.oth_desc}>{leg.oth_desc}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] text-gray-500">
                                      <span>W:{leg.ws_assigned||0}</span> <span className="text-green-600">D:{leg.ws_closed||0}</span> <span>P:{leg.ws_pms||0}</span> <span>A:{leg.ws_asset||0}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold font-mono text-gray-900">₹{legTotal.toLocaleString()}</td>
                                  </tr>

                                  {hasActivities && (
                                    <tr className="bg-slate-50/50">
                                      <td colSpan={10} className="py-2.5 px-4 border-t border-gray-150">
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
                          const legTotal = travelCost + subCost + daCost + hotelCost + lpCost + otherCost;

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
                                <span className="font-extrabold text-gray-900 text-sm">₹{legTotal.toLocaleString()}</span>
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
                              <div className="grid grid-cols-3 gap-2 bg-gray-50/50 p-2.5 rounded-lg border border-gray-150 text-[10px] font-bold">
                                <div>
                                  <span className="text-gray-400 text-[8px] uppercase block">DA</span>
                                  <span className="text-gray-700 font-mono">₹{daCost.toLocaleString()}</span>
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
                                  <div className="col-span-3 border-t border-gray-100 pt-1.5 mt-0.5">
                                    <span className="text-gray-400 text-[8px] uppercase block">Other/Misc (₹{otherCost.toLocaleString()})</span>
                                    <span className="text-gray-655 block text-[9px] font-normal italic">{leg.oth_desc || "No description"}</span>
                                  </div>
                                )}
                              </div>

                              {/* Work Summary */}
                              <div className="text-[10px] text-gray-500 bg-gray-50/50 px-2.5 py-1.5 rounded border border-gray-100 flex justify-between font-bold">
                                <span>Work: {leg.ws_assigned||0}</span>
                                <span className="text-green-600">Done: {leg.ws_closed||0}</span>
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
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-gray-600 font-bold border-t border-blue-100/50 pt-1.5">
                                            <div>District: <span className="text-gray-800">{c.asset_details?.district_name || "—"}</span></div>
                                            <div>Model: <span className="text-gray-800">{c.asset_details?.model_name || "—"}</span></div>
                                            <div>Barcode: <span className="text-gray-800 font-mono">{c.barcode}</span></div>
                                            <div>Type: <span className="text-gray-800">{c.type || "Support Call"}</span></div>
                                          </div>
                                          {c.photo_url && (
                                            <div className="pt-2">
                                              <span className="text-gray-400 text-[8px] uppercase block mb-1">Attachment Photo</span>
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
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-gray-600 font-bold border-t border-amber-100/50 pt-1.5">
                                            <div>District: <span className="text-gray-800">{p.asset_details?.district_name || "—"}</span></div>
                                            <div>Model: <span className="text-gray-800">{p.asset_details?.model_name || "—"}</span></div>
                                            <div>Barcode: <span className="text-gray-800 font-mono">{p.barcode}</span></div>
                                            <div>Status: <span className="text-gray-800">{p.asset_details?.inventory_status || "Active"}</span></div>
                                          </div>
                                          {p.photo_url && (
                                            <div className="pt-2">
                                              <span className="text-gray-400 text-[8px] uppercase block mb-1">Attachment Photo</span>
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

                  {/* Cumulative stats for Limit Requests */}
                  {claimDetails.category === "Limit Request" && claimDetails.user_monthly_stats && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Requester's Current Monthly Statistics
                        </h4>
                        <span className="text-[10px] text-gray-500 font-bold">Month: {claimDetails.month} {claimDetails.year}</span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg">
                          <span className="text-[9px] text-blue-500 font-extrabold uppercase tracking-wider block mb-1">Bike/Car Cumulative Distance</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-blue-700 font-mono">{(claimDetails.user_monthly_stats.total_bike_km || 0).toFixed(1)}</span>
                            <span className="text-[10px] text-blue-600 font-extrabold">KM Used</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block mt-2 font-semibold">
                            Total Approved Limit: {(claimDetails.user_monthly_stats.max_km || 2000).toFixed(1)} KM
                          </span>
                        </div>

                        <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-lg">
                          <span className="text-[9px] text-purple-500 font-extrabold uppercase tracking-wider block mb-1">Local Conveyance (Auto)</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-black text-purple-700 font-mono">₹{(claimDetails.user_monthly_stats.total_auto || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-purple-600 font-extrabold">Spent</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block mt-2 font-semibold">
                            Total Approved Limit: ₹{(claimDetails.user_monthly_stats.max_auto || 1000).toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                          <span className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-wider block mb-1">Total Verified Field Work</span>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px] text-gray-600 font-bold">
                            <div>Calls: <span className="text-emerald-700 font-mono">{claimDetails.user_monthly_stats.calls_completed || 0}</span></div>
                            <div>PMS: <span className="text-emerald-700 font-mono">{claimDetails.user_monthly_stats.pms_count || 0}</span></div>
                            <div>Tagging: <span className="text-emerald-700 font-mono">{claimDetails.user_monthly_stats.asset_tagging || 0}</span></div>
                            <div>Calibration: <span className="text-emerald-700 font-mono">{claimDetails.user_monthly_stats.calibration_count || 0}</span></div>
                            <div className="col-span-2">Mobilise Verif: <span className="text-emerald-700 font-mono">{claimDetails.user_monthly_stats.mobilise_count || 0}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {getAttachmentsArray(claimDetails.attachments).length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Attachments / Receipts</h4>
                      </div>
                      <div className="p-3 flex flex-wrap gap-2">
                        {getAttachmentsArray(claimDetails.attachments).map((url: string, attIdx: number) => {
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
                          const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
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
                  {claimDetails.approvals && claimDetails.approvals.length > 0 && (
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
                            {claimDetails.approvals.map((app: any, appIdx: number) => {
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
                                  <td className="py-2.5 px-3 text-gray-600 italic max-w-[200px] truncate" title={app.comments || ""}>{app.comments || "—"}</td>
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
                  {claimDetails.edit_history && claimDetails.edit_history.length > 0 && (
                    <div className="border border-amber-200 rounded overflow-hidden mt-4 text-left">
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
                            {claimDetails.edit_history.map((log: any, logIdx: number) => {
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
                                  <td className="py-2.5 px-3 italic text-gray-600 max-w-[200px] truncate" title={log.comment}>{log.comment || "—"}</td>
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

                  {/* Approver Decision Center */}
                  {pendingApprovalStep && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                      <div className="font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>Approver Action Center</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-600 uppercase block">
                          Remarks / Comments <span className="text-red-500 font-bold">* Required for Rejection</span>
                        </label>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Enter your review remarks or rejection reason..."
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 font-sans text-gray-800 bg-white"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleApprove}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
                        >
                          {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleReject}
                          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
                        >
                          {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                {claimDetails && (claimDetails.submitter_code === user.user_id || claimDetails.user_id === user.id) && ["draft", "submitted"].includes(claimDetails.status?.toLowerCase()) && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/submit-expense?edit=${claimDetails.id}`)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClaim(claimDetails.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1 animate-none"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowDetailsModal(false); setClaimDetails(null); }}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-bold transition-all cursor-pointer border-0"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= STATS CLAIMS POPUP MODAL ================= */}
      {showStatsModal && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-4xl max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-800">
                  {statsModalType} Claims ({statsModalClaims.length})
                </h3>
              </div>
              <button 
                onClick={() => { setShowStatsModal(false); setStatsModalClaims([]); }}
                className="text-red-600 hover:text-red-800 border-0 bg-transparent text-lg font-black cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {statsModalClaims.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-xs">
                  <p className="font-bold">No claims found in this category.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-lte">
                    <thead>
                      <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50/50">
                        {activeTab === "team-claims" && <th className="py-2.5 px-3">Employee</th>}
                        <th className="py-2.5 px-3">Claim ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Purpose</th>
                        <th className="py-2.5 px-3">Travel Mode</th>
                        <th className="py-2.5 px-3">Distance</th>
                        <th className="py-2.5 px-3">Auto Fare</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {statsModalClaims.map((exp) => (
                        <tr 
                          key={exp.id} 
                          onClick={() => {
                            setShowStatsModal(false);
                            handleOpenClaimDetails(exp.id);
                          }}
                          className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                        >
                          {activeTab === "team-claims" && (
                            <td className="py-3 px-3">
                              <p className="font-bold text-gray-800 leading-none">{exp.submitter_name}</p>
                              <span className="text-[8px] font-mono uppercase text-blue-600 block mt-0.5">{exp.submitter_code}</span>
                            </td>
                          )}
                          <td className="py-3 px-3 font-semibold font-mono text-blue-605 uppercase">{exp.expense_code}</td>
                          <td className="py-3 px-3 text-gray-500">{exp.itinerary || exp.date}</td>
                          <td className="py-3 px-3 font-semibold text-gray-800 truncate max-w-[150px]" title={exp.description || exp.purpose}>{exp.description || exp.purpose}</td>
                          <td className="py-3 px-3">
                            <span className="inline-block border border-blue-200 bg-blue-50 text-blue-705 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                              {exp.travel_mode || exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_auto ? `₹${exp.total_auto.toLocaleString()}` : "—"}</td>
                          <td className="py-3 px-3 font-bold text-gray-900">₹{(exp.amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                              {exp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setShowStatsModal(false); setStatsModalClaims([]); }}
                className="btn-lte-secondary px-6"
              >
                Close List
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[99999] animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center justify-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-red-500 hover:text-red-700 text-xl font-black bg-transparent border-0 cursor-pointer"
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

    </>
  );
}
