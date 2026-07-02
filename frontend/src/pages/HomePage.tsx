import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
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
  TrendingUp,
  Layers,
  Users,
  Check,
  X,
  Loader2,
  ShieldCheck
} from "lucide-react";



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
  const [loadingAllowance, setLoadingAllowance] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return true;
    return !localStorage.getItem(`cache_allowance_stats_${currentUser.user_id}`);
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

  // Filters state for team claims tab
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [selectMonth, setSelectMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // Default current month YYYY-MM
  });

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
          setPendingApprovalsCount(data.length);
          localStorage.setItem(`cache_approvals_count_${uId}`, data.length.toString());
        })
        .catch(err => console.error("Error fetching approvals count:", err));
      
      expenseService.getTeamExpenses()
        .then(data => {
          setTeamExpenses(data);
          localStorage.setItem(`cache_team_expenses_${uId}`, JSON.stringify(data));
        })
        .catch(err => console.error("Error fetching team expenses:", err))
        .finally(() => setLoadingTeamExpenses(false));
    }

    expenseService.getExpenses()
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
            rateBike: data.allowance.rate_bike || 4.5,
            rateCar: data.allowance.rate_car || 9.0
          };
          setAllowanceStats(stats);
          localStorage.setItem(`cache_allowance_stats_${uId}`, JSON.stringify(stats));
        }
      })
      .catch(err => console.error("Error fetching allowance stats:", err))
      .finally(() => setLoadingAllowance(false));
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

  if (!user) return null;

  const userRole = user.role || "Engineer";
  const allowedWindows = user.allowed_windows
    ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
    : ["home", "profile", "help"];

  const hasAccess = (windowId: string) => {
    if (userRole === "Admin") return true;
    return allowedWindows.includes(windowId.toLowerCase());
  };

  const isReviewerRole = userRole === "Admin" || allowedWindows.includes("approval");

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved") return "bg-green-50 border-green-200 text-green-700";
    if (s === "rejected") return "bg-red-50 border-red-200 text-red-700";
    if (s.startsWith("submitted")) return "bg-yellow-50 border-yellow-250 text-yellow-750 font-bold";
    return "bg-gray-50 border-gray-200 text-gray-600";
  };

  const getProgressPercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const handleOpenClaimDetails = async (claimId: number | string) => {
    setSelectedClaimId(claimId);
    setShowDetailsModal(true);

    // SWR: load from cache instantly, then refresh in background
    const cacheKey = `cache_claim_detail_${claimId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setClaimDetails(JSON.parse(cached));
      setLoadingDetails(false);
      // Background refresh (silent)
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
        toast.error("Failed to load expense details.");
        setShowDetailsModal(false);
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
      return rawDate && rawDate.startsWith(selectMonth);
    });
  };

  const filteredPersonalExpenses = getFilteredPersonalExpenses();

  const getFilteredTeamExpenses = () => {
    return safeTeamExpenses.filter(exp => {
      const rawDate = exp.date || exp.itinerary;
      if (rawDate && !rawDate.startsWith(selectMonth)) return false;
      if (filterEmployee !== "all" && exp.submitter_code !== filterEmployee) return false;
      if (filterMode !== "all" && exp.category !== filterMode) return false;
      return true;
    });
  };

  const filteredTeamExpenses = getFilteredTeamExpenses();
  const totalFilteredKm = filteredTeamExpenses.reduce((sum, e) => sum + (e.total_km || 0), 0);
  const totalFilteredAuto = filteredTeamExpenses.reduce((sum, e) => sum + (e.total_auto || 0), 0);
  const totalFilteredAmount = filteredTeamExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingApprovalStep = claimDetails?.approvals?.find(
    (app: any) => app.approver_code === user?.user_id && app.status === "pending"
  );

  const getPersonalChartData = () => {
    let bike = 0, car = 0, auto = 0, da = 0, hotel = 0, lp = 0, other = 0;
    filteredPersonalExpenses.forEach(e => {
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

  const getStatsSums = (list: any[]) => list.reduce((sum, c) => sum + (c.amount || 0), 0);

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
      
      {/* Welcome Banner - AdminLTE card style with gradient border top */}
      <div className="bg-white border-t-4 border-t-blue-600 border-x border-b border-gray-200 rounded shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5 flex-1">
            <span className="text-blue-600 font-extrabold text-[9px] uppercase tracking-widest block">Operations Hub</span>
            <h2 className="text-base font-extrabold text-gray-800">Welcome, {user.name}!</h2>
            <p className="text-gray-500 text-[10px] leading-relaxed">
              Track and manage your field operations expenses and reimbursement claims.
            </p>
          </div>
          <img src={brandLogo} alt="Cyrix Logo" className="h-14 w-auto object-contain shrink-0 hidden sm:block bg-white p-1.5 rounded border border-gray-300 shadow-xs" />
        </div>
      </div>

      {/* ⚡ Quick Actions Navigation Bar */}
      <div className="bg-white border-t-4 border-t-blue-500 rounded shadow-xs p-3 mb-4">
        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-2.5 flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-blue-600" />
          Quick Actions Shortcuts
        </h4>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/expense"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          
          {/* Allowances Caps */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Reimbursement Allowance Status ({(() => {
                try {
                  const [y, m] = selectMonth.split("-");
                  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
                } catch(e) {
                  return "Selected Month";
                }
              })()})
            </h3>

            {loadingAllowance ? (
              <Loader message="Loading allowance status..." />
            ) : allowanceStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KM Limit */}
                <div className="border border-gray-150 p-4 bg-gray-50/50 rounded text-xs space-y-2.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-500 uppercase tracking-wide text-[9px]">{allowanceStats.vehicleType} Distance Allowance</span>
                    <span className="text-blue-700 font-mono">{allowanceStats.currentKm} / {allowanceStats.maxKm} KM</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        getProgressPercentage(allowanceStats.currentKm, allowanceStats.maxKm) > 85 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${getProgressPercentage(allowanceStats.currentKm, allowanceStats.maxKm)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                    <span>Used: {getProgressPercentage(allowanceStats.currentKm, allowanceStats.maxKm)}%</span>
                    <span>Rate: ₹{(allowanceStats.vehicleType === "Car" ? allowanceStats.rateCar : allowanceStats.rateBike).toFixed(1)}/KM</span>
                  </div>
                </div>

                {/* Auto Fare Limit */}
                <div className="border border-gray-150 p-4 bg-gray-50/50 rounded text-xs space-y-2.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-500 uppercase tracking-wide text-[9px]">Auto Fare Allowance</span>
                    <span className="text-blue-700 font-mono">₹{allowanceStats.currentAuto} / ₹{allowanceStats.maxAuto}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        getProgressPercentage(allowanceStats.currentAuto, allowanceStats.maxAuto) > 85 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${getProgressPercentage(allowanceStats.currentAuto, allowanceStats.maxAuto)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                    <span>Used: {getProgressPercentage(allowanceStats.currentAuto, allowanceStats.maxAuto)}%</span>
                    <span>Monthly Limit Cap</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-xs font-semibold">
                Could not retrieve allowance limit details. Check your grade config.
              </div>
            )}
          </div>

          {/* TAB SYSTEM: My Claims vs Team Claims */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
            
            {/* Tab Header bar */}
            <div className="border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between px-4">
              <div className="flex">
                <button
                  onClick={() => handleTabChange("my-claims")}
                  className={`py-3.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "my-claims"
                      ? "border-blue-600 text-blue-700 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  My Claims ({filteredPersonalExpenses.length})
                </button>
 
                {isReviewerRole && (
                  <button
                    onClick={() => handleTabChange("team-claims")}
                    className={`py-3.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === "team-claims"
                        ? "border-blue-600 text-blue-700 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Team Claims ({filteredTeamExpenses.length})
                  </button>
                )}
              </div>

                {activeTab === "my-claims" && hasAccess("expense") && (
                  <Link to="/submit-expense" className="hidden lg:flex btn-lte-primary py-1 px-3 items-center gap-1.5 text-[11px] font-bold">
                    <Plus className="w-3.5 h-3.5" />
                    File Claim
                  </Link>
                )}
            </div>

            {/* Tab Content Tables */}
            <div className="overflow-x-auto p-4 flex-1">
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
                  <table className="table-lte">
                    <thead>
                      <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50/50">
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
                      {filteredPersonalExpenses.map((exp) => (
                        <tr 
                          key={exp.id} 
                          onClick={() => handleOpenClaimDetails(exp.id)}
                          className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-3 font-semibold font-mono text-blue-600 uppercase">{exp.expense_code}</td>
                          <td className="py-3 px-3 text-gray-500">{exp.itinerary}</td>
                          <td className="py-3 px-3 font-semibold text-gray-800 truncate max-w-[150px]" title={exp.description}>{exp.description}</td>
                          <td className="py-3 px-3 text-gray-500">{exp.travel_mode}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_auto ? `₹${exp.total_auto.toLocaleString()}` : "—"}</td>
                          <td className="py-3 px-3 font-bold text-gray-900">₹{exp.amount.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                              {exp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="table-lte">
                    <thead>
                      <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50/50">
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Claim ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Purpose</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Distance</th>
                        <th className="py-2.5 px-3">Auto Fare</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTeamExpenses.map((exp) => (
                        <tr 
                          key={exp.id} 
                          onClick={() => handleOpenClaimDetails(exp.id)}
                          className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-3">
                            <p className="font-bold text-gray-800 leading-none">{exp.submitter_name}</p>
                            <span className="text-[8px] font-mono uppercase text-blue-600 block mt-0.5">{exp.submitter_code}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold font-mono text-blue-600 uppercase">{exp.expense_code}</td>
                          <td className="py-3 px-3 text-gray-500">{exp.date}</td>
                          <td className="py-3 px-3 font-semibold text-gray-800 truncate max-w-[120px]" title={exp.purpose}>{exp.purpose}</td>
                          <td className="py-3 px-3 text-gray-500">{exp.category}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_km ? `${exp.total_km.toFixed(1)} KM` : "—"}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-gray-650">{exp.total_auto ? `₹${exp.total_auto.toLocaleString()}` : "—"}</td>
                          <td className="py-3 px-3 font-bold text-gray-900">₹{exp.amount.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                              {exp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

            </div>
          </div>

        </div>

        {/* Right Sidebar: Dynamic Charts & Filters */}
        <div className="space-y-4 font-sans">
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
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Claim Details {claimDetails ? `— ${claimDetails.expense_code}` : ""}
              </h3>
              <button 
                onClick={() => { setShowDetailsModal(false); setClaimDetails(null); }}
                className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500 hover:text-gray-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingDetails || !claimDetails ? (
                <Loader message="Loading claim details..." />
              ) : (
                <>
                  {/* Summary Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Submitted By</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{claimDetails.submitter_name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{claimDetails.submitter_code}</span>
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
                      <span className="text-[9px] text-gray-500 font-bold uppercase block">Total</span>
                      <span className="text-lg font-black text-blue-700 font-mono">₹{claimDetails.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Legs Table */}
                  {claimDetails.itineraries && claimDetails.itineraries.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Visit Legs Details</h4>
                      </div>
                      <div className="overflow-x-auto">
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
                                      <td colSpan={9} className="py-2.5 px-4 border-t border-gray-150">
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
                                                      <td className="py-1 px-2 text-gray-805 font-bold">{c.asset_details?.equipment_name || "—"}</td>
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
                                                      <td className="py-1 px-2 text-gray-805 font-bold">{p.asset_details?.equipment_name || "—"}</td>
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

                                          {/* Sub-table for Asset Tagging - Hide cost from submitter */}
                                          {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                            <div className="border border-emerald-100 rounded overflow-hidden bg-white max-w-4xl">
                                              <div className="px-2 py-1 bg-emerald-50/50 border-b border-emerald-100 text-[9px] font-bold text-emerald-700 uppercase">Asset Tagging Records</div>
                                              <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                                <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                                  <tr>
                                                    <th className="py-1 px-2 text-left">Equipment Name</th>
                                                    <th className="py-1 px-2 text-center w-20">Quantity</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {assetsList.map((a: any, aIdx: number) => {
                                                    const qty = parseInt(a.quantity || "0") || 0;
                                                    return (
                                                      <tr key={aIdx}>
                                                        <td className="py-1 px-2 font-semibold text-gray-700">{a.equipment_name}</td>
                                                        <td className="py-1 px-2 text-center text-gray-600">{qty}</td>
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
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {claimDetails.attachments && claimDetails.attachments.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Attachments / Receipts</h4>
                      </div>
                      <div className="p-3 flex flex-wrap gap-2">
                        {claimDetails.attachments.map((url: string, attIdx: number) => {
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
                          const API_BASE = import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com";
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
                                : log.field_name === "other_amount" ? "Local purchase"
                                : log.field_name === "distance_km" ? "Distance KM"
                                : log.field_name === "da_amount" ? "DA Amount"
                                : log.field_name;
                              return (
                                <tr key={logIdx} className="hover:bg-amber-50/10 text-slate-700 bg-white">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-500">Leg #{log.leg_number}</td>
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
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-800">
                  {statsModalType} Claims ({statsModalClaims.length})
                </h3>
              </div>
              <button 
                onClick={() => { setShowStatsModal(false); setStatsModalClaims([]); }}
                className="text-gray-400 hover:text-gray-600 border-0 bg-transparent text-lg font-bold cursor-pointer"
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
                          <td className="py-3 px-3 text-gray-500">{exp.travel_mode || exp.category}</td>
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
