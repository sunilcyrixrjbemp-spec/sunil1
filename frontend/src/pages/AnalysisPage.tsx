import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { SaaSBarChart, SaaSHorizontalBarChart, SaaSDonutChart, SaaS3DHybridTrendChart } from "../components/common/SaaSCharts";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import { adminService } from "../services/adminService";
import AnalysisSkeleton from "../components/common/AnalysisSkeleton";
import RajasthanMapChart from "../components/common/RajasthanMapChart";
import {
  Button,
  Modal,
  Table,
  Input,
  Select
} from "antd";
import {
  FilterOutlined,
  CloseOutlined,
  FileExcelOutlined,
  FundOutlined,
  CheckOutlined,
  InfoCircleOutlined,
  TagOutlined,
  RocketOutlined,
  SearchOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  RiseOutlined,
  WalletOutlined,
  UserOutlined,
  GlobalOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { hasFullAccess } from "../utils/constants";
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AnalysisPage() {
  const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

  const [myExpenses, setMyExpenses] = useState<any[]>(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return [];
    const savedM = localStorage.getItem("analysis_selectedMonth");
    const savedY = localStorage.getItem("analysis_selectedYear");
    const m = savedM !== null ? Number(savedM) : new Date().getMonth();
    const y = savedY !== null ? Number(savedY) : new Date().getFullYear();
    const monthStr = String(m + 1).padStart(2, "0");
    const keyV4 = `cache_v4_my_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const keyOld = `cache_my_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const cached = localStorage.getItem(keyV4) || localStorage.getItem(keyOld);
    return cached ? JSON.parse(cached) : [];
  });
  const [teamExpenses, setTeamExpenses] = useState<any[]>(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return [];
    const savedM = localStorage.getItem("analysis_selectedMonth");
    const savedY = localStorage.getItem("analysis_selectedYear");
    const m = savedM !== null ? Number(savedM) : new Date().getMonth();
    const y = savedY !== null ? Number(savedY) : new Date().getFullYear();
    const monthStr = String(m + 1).padStart(2, "0");
    const keyV4 = `cache_v4_team_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const keyOld = `cache_team_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const cached = localStorage.getItem(keyV4) || localStorage.getItem(keyOld);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return false;
    const savedM = localStorage.getItem("analysis_selectedMonth");
    const savedY = localStorage.getItem("analysis_selectedYear");
    const m = savedM !== null ? Number(savedM) : new Date().getMonth();
    const y = savedY !== null ? Number(savedY) : new Date().getFullYear();
    const monthStr = String(m + 1).padStart(2, "0");
    const keyV4 = `cache_v4_my_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const keyTeamV4 = `cache_v4_team_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const hasCache = !!(localStorage.getItem(keyV4) || localStorage.getItem(keyTeamV4));
    return !hasCache;
  });  const [viewMode, setViewMode] = useState<"my" | "team">(() => {
    const saved = localStorage.getItem("analysis_viewMode");
    if (saved === "my" || saved === "team") return saved;
    const currentUser = authService.getCurrentUser();
    const role = currentUser?.role || "Engineer";
    const allowed = (currentUser?.allowed_windows || "").split(",").map((w: string) => w.trim().toLowerCase());
    if (hasFullAccess(role) || allowed.includes("approval")) {
      return "team";
    }
    return "my";
  });
  
  // Filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const saved = localStorage.getItem("analysis_selectedMonth");
    return saved !== null ? Number(saved) : currentDate.getMonth();
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem("analysis_selectedYear");
    return saved !== null ? Number(saved) : currentDate.getFullYear();
  });
  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedDistrict") || "all";
  });
  const [selectedEngineer, setSelectedEngineer] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedEngineer") || "all";
  });
  const [_districtChartType, _setDistrictChartType] = useState<"bar3d" | "horizontal" | "pie">("bar3d");
  const [_employeeChartType, _setEmployeeChartType] = useState<"bar3d" | "horizontal" | "pie">("bar3d");
  const [engineerSearchQuery, _setEngineerSearchQuery] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedZone") || "all";
  });
  const [selectedCoordinator, setSelectedCoordinator] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedCoordinator") || "all";
  });
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedStatus") || "all";
  });
  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem("analysis_startDate") || "";
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem("analysis_endDate") || "";
  });
  const [activeTab, _setActiveTab] = useState<"overview" | "map" | "field" | "financial">("overview");
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  useEffect(() => {
    localStorage.setItem("analysis_viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedMonth", String(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedYear", String(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedDistrict", selectedDistrict);
  }, [selectedDistrict]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedEngineer", selectedEngineer);
  }, [selectedEngineer]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedStatus", selectedStatus);
  }, [selectedStatus]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedZone", selectedZone);
  }, [selectedZone]);

  useEffect(() => {
    localStorage.setItem("analysis_selectedCoordinator", selectedCoordinator);
  }, [selectedCoordinator]);

  useEffect(() => {
    setSelectedDistrict("all");
    setSelectedEngineer("all");
  }, [selectedZone]);

  useEffect(() => {
    localStorage.setItem("analysis_startDate", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("analysis_endDate", endDate);
  }, [endDate]);

  const user = authService.getCurrentUser();
  const allowedWindows = (user?.allowed_windows || "").split(",").map((w: string) => w.trim().toLowerCase());
  const isReviewer = allowedWindows.includes("approval") || hasFullAccess(user?.role);
  const userRole = (user?.role || "").toLowerCase();
  const isFullMapRole = 
    userRole.includes("admin") ||
    userRole.includes("account") ||
    userRole.includes("hr") ||
    userRole.includes("mis") ||
    userRole.includes("vp") ||
    userRole.includes("project head") ||
    userRole.includes("project_head") ||
    userRole.includes("director") ||
    userRole.includes("zonal_manager") ||
    userRole.includes("admin_reviewer");

  const [usersMap, setUsersMap] = useState<Record<string, any>>(() => {
    try {
      const cached = localStorage.getItem("cache_users_map");
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersList = await adminService.getUsers();
        if (Array.isArray(usersList)) {
          const map: Record<string, any> = {};
          usersList.forEach(u => {
            if (u.user_id) map[String(u.user_id).trim().toLowerCase()] = u;
            if (u.e_code) map[String(u.e_code).trim().toLowerCase()] = u;
            if (u.name) map[String(u.name).trim().toLowerCase()] = u;
            if (u.id) map[String(u.id)] = u;
          });
          setUsersMap(map);
          localStorage.setItem("cache_users_map", JSON.stringify(map));
        }
      } catch (e) {
        // Handled gracefully if not privileged
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const uId = currentUser?.user_id || "";
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const monthQueryParam = `${selectedYear}-${monthStr}`;
    
    const fetchData = async () => {
      const cacheKeyMy = `cache_v4_my_expenses_${uId}_${monthQueryParam}`;
      const cacheKeyTeam = `cache_v4_team_expenses_${uId}_${monthQueryParam}`;
      setLoading(true);
      try {
        if (isReviewer) {
          const [own, team] = await Promise.all([
            expenseService.getExpenses(monthQueryParam),
            expenseService.getTeamExpenses(monthQueryParam)
          ]);
          setMyExpenses(own || []);
          setTeamExpenses(team || []);
          if (uId) {
            localStorage.setItem(cacheKeyMy, JSON.stringify(own || []));
            localStorage.setItem(cacheKeyTeam, JSON.stringify(team || []));
          }
        } else {
          const own = await expenseService.getExpenses(monthQueryParam);
          setMyExpenses(own || []);
          if (uId) {
            localStorage.setItem(cacheKeyMy, JSON.stringify(own || []));
          }
        }
      } catch (err) {
        console.error("Error fetching analysis data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isReviewer, selectedMonth, selectedYear]);

  // Filter expenses by selected month/year
  const filterByMonth = (expenses: any[]) => {
    const monthName = months[selectedMonth];
    return expenses.filter(e => {
      const expMonth = e.month || "";
      const expYear = e.year || currentDate.getFullYear();
      return expMonth.toLowerCase() === monthName.toLowerCase() && Number(expYear) === selectedYear;
    });
  };

  // Build filter list dropdowns options
  const filterOptions = useMemo(() => {
    const rawSource = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const source = rawSource.filter(e => e && e.category !== "Limit Request" && e.request_type !== "limit");
    const monthlyList = filterByMonth(source);
    
    // 1. Filter engineers based on selectedDistrict and selectedZone
    const engineers = new Set<string>();
    monthlyList.forEach(e => {
      const dist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
      const name = e.submitter_name || "Self";
      const zone = e.zone || "";
      if (selectedDistrict === "all" || dist.toLowerCase() === selectedDistrict.toLowerCase()) {
        if (selectedZone === "all" || cleanZone(zone) === cleanZone(selectedZone)) {
          engineers.add(name);
        }
      }
    });

    // 2. Filter districts based on selectedEngineer and selectedZone
    const districts = new Set<string>();
    monthlyList.forEach(e => {
      const dist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
      const name = e.submitter_name || "Self";
      const zone = e.zone || "";
      if (selectedEngineer === "all" || name.toLowerCase() === selectedEngineer.toLowerCase()) {
        if (selectedZone === "all" || cleanZone(zone) === cleanZone(selectedZone)) {
          districts.add(dist);
        }
      }
    });

    return {
      districts: Array.from(districts).sort((a, b) => a.localeCompare(b)),
      engineers: Array.from(engineers).sort((a, b) => a.localeCompare(b))
    };
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedDistrict, selectedEngineer, selectedZone]);

  const uniqueZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];

  const coordinatorsList = useMemo(() => {
    const rawSource = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const source = rawSource.filter(e => e && e.category !== "Limit Request" && e.request_type !== "limit");
    const set = new Set<string>();
    source.forEach(e => {
      const coord = e.coordinator_name || e.coordinator || e.submitter_coordinator || e.facility_coordinator;
      if (coord && typeof coord === "string" && coord.trim() && coord !== "—") {
        set.add(coord.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [viewMode, myExpenses, teamExpenses, isReviewer]);

  // Safety resets for dependent dropdowns
  useEffect(() => {
    if (selectedEngineer !== "all" && !filterOptions.engineers.includes(selectedEngineer)) {
      setSelectedEngineer("all");
    }
  }, [selectedDistrict, filterOptions.engineers]);

  useEffect(() => {
    if (selectedDistrict !== "all" && !filterOptions.districts.includes(selectedDistrict)) {
      setSelectedDistrict("all");
    }
  }, [selectedEngineer, filterOptions.districts]);

  const activeExpenses = useMemo(() => {
    const rawSource = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const source = rawSource.filter(e => e && e.category !== "Limit Request" && e.request_type !== "limit");
    
    // 1. Filter by date range OR by month/year fallback
    let list = [];
    if (startDate || endDate) {
      list = source.filter(e => {
        const rawDate = e.date || e.itinerary || "";
        const cleanDateStr = String(rawDate).trim();
        if (!cleanDateStr) return false;
        
        if (startDate && cleanDateStr < startDate) return false;
        if (endDate && cleanDateStr > endDate) return false;
        return true;
      });
    } else {
      list = filterByMonth(source);
    }

    // 2. Filter by status
    if (selectedStatus !== "all") {
      list = list.filter(e => {
        const s = (e.status || "Pending").toLowerCase();
        if (selectedStatus === "approved") return s === "approved";
        if (selectedStatus === "rejected") return s === "rejected";
        if (selectedStatus === "pending") return s.startsWith("submitted") || s === "pending" || s === "waiting";
        return s === selectedStatus;
      });
    }

    // 3. Filter by zone, district & engineer (team mode only)
    if (viewMode === "team") {
      if (selectedZone !== "all") {
        list = list.filter(e => {
          const zone = e.zone || "";
          return cleanZone(zone) === cleanZone(selectedZone);
        });
      }
      if (selectedDistrict !== "all") {
        list = list.filter(e => {
          const dist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
          return dist.toLowerCase() === selectedDistrict.toLowerCase();
        });
      }
      if (selectedEngineer !== "all") {
        list = list.filter(e => {
          const name = e.submitter_name || "Self";
          return name.toLowerCase() === selectedEngineer.toLowerCase();
        });
      } else if (engineerSearchQuery.trim()) {
        list = list.filter(e => {
          const name = e.submitter_name || "Self";
          return name.toLowerCase().includes(engineerSearchQuery.trim().toLowerCase());
        });
      }
      if (selectedCoordinator !== "all") {
        list = list.filter(e => {
          const coord = e.coordinator_name || e.coordinator || e.submitter_coordinator || e.facility_coordinator || "";
          return coord.toLowerCase() === selectedCoordinator.toLowerCase();
        });
      }
    }

    return list;
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedDistrict, selectedEngineer, engineerSearchQuery, selectedCoordinator, selectedStatus, startDate, endDate, selectedZone]);

  // Expenses filtered by all criteria EXCEPT single district filter (so map can calculate all districts)
  const mapExpenses = useMemo(() => {
    const rawSource = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const source = rawSource.filter(e => e && e.category !== "Limit Request" && e.request_type !== "limit");
    
    let list = [];
    if (startDate || endDate) {
      list = source.filter(e => {
        const rawDate = e.date || e.itinerary || "";
        const cleanDateStr = String(rawDate).trim();
        if (!cleanDateStr) return false;
        
        if (startDate && cleanDateStr < startDate) return false;
        if (endDate && cleanDateStr > endDate) return false;
        return true;
      });
    } else {
      list = filterByMonth(source);
    }

    if (selectedStatus !== "all") {
      list = list.filter(e => {
        const s = (e.status || "Pending").toLowerCase();
        if (selectedStatus === "approved") return s === "approved";
        if (selectedStatus === "rejected") return s === "rejected";
        if (selectedStatus === "pending") return s.startsWith("submitted") || s === "pending" || s === "waiting";
        return s === selectedStatus;
      });
    }

    if (viewMode === "team") {
      if (selectedZone !== "all") {
        list = list.filter(e => {
          const zone = e.zone || "";
          return cleanZone(zone) === cleanZone(selectedZone);
        });
      }
      if (selectedEngineer !== "all") {
        list = list.filter(e => {
          const name = e.submitter_name || "Self";
          return name.toLowerCase() === selectedEngineer.toLowerCase();
        });
      }
      if (selectedCoordinator !== "all") {
        list = list.filter(e => {
          const coord = e.coordinator_name || e.coordinator || e.submitter_coordinator || e.facility_coordinator || "";
          return coord.toLowerCase() === selectedCoordinator.toLowerCase();
        });
      }
    }

    return list;
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedEngineer, selectedCoordinator, selectedStatus, startDate, endDate, selectedZone, isReviewer]);

  // Date range limits based on selected month/year
  const monthStr = String(selectedMonth + 1).padStart(2, "0");
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const minDateStr = `${selectedYear}-${monthStr}-01`;
  const maxDateStr = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Helper to extract exact Tagged Quantity and Tagged Rupee Value from any expense record
  const getAssetTaggingMetrics = (e: any) => {
    let qty = 0;
    let val = 0;

    const details = Array.isArray(e?.tagging_details) ? e.tagging_details : [];
    if (details.length > 0) {
      details.forEach((d: any) => {
        let dQty = Number(d.quantity || 1);
        let unitCost = Number(d.unit_cost || 0);
        let dVal = Number(d.total_val || (dQty * unitCost) || 0);

        // Filter out corrupted/invalid large numbers (> 100,000) stored in quantity (e.g. barcodes)
        if (dQty > 100000 || isNaN(dQty)) {
          dQty = 1;
          dVal = unitCost > 0 && unitCost < 100000000 ? unitCost : 0;
        } else if (dVal > 100000000 || isNaN(dVal)) {
          dVal = unitCost > 0 ? dQty * unitCost : 0;
        }

        qty += dQty;
        val += dVal;
      });
      return { qty, val };
    }

    const explicitQty = Number(e?.asset_tagging_qty || 0);
    const explicitVal = Number(e?.asset_tagging_value || e?.asset_tagging_val || 0);
    const rawTag = Number(e?.asset_tagging || 0);

    // Filter out corrupted/invalid large numbers (> 100,000) stored in asset_tagging column
    if (rawTag > 100000) {
      qty = explicitQty > 0 && explicitQty < 100000 ? explicitQty : 0;
      val = explicitVal > 0 && explicitVal < 100000000 ? explicitVal : 0;
      return { qty, val };
    }

    if (explicitQty > 0 && explicitQty < 100000) {
      qty = explicitQty;
      val = explicitVal || (rawTag > 0 && rawTag < 100000 ? rawTag : 0);
    } else if (rawTag > 0 && rawTag < 100000) {
      qty = rawTag;
      val = explicitVal || 0;
    } else if (explicitVal > 0 && explicitVal < 100000000) {
      val = explicitVal;
      qty = 1;
    }

    return { qty, val };
  };
  const parseSanitizedCount = (raw: any): number => {
    if (raw === null || raw === undefined || raw === "") return 0;
    const num = Number(raw);
    if (isNaN(num) || num <= 0) return 0;
    // If > 100000, raw value is an asset barcode number (e.g. 80048906156719100000) stored instead of count quantity
    if (num > 100000) return 1;
    return Math.round(num);
  };

  // Activity aggregates
  const activityStats = useMemo(() => {
    let callsAssigned = 0;
    let callsCompleted = 0;
    let pmsCount = 0;
    let calibrationCount = 0;
    let assetTaggingCount = 0;
    let assetTaggingValue = 0;
    let mobiliseCount = 0;

    activeExpenses.forEach(e => {
      callsAssigned += parseSanitizedCount(e.calls_assigned);
      callsCompleted += parseSanitizedCount(e.calls_completed);
      pmsCount += parseSanitizedCount(e.pms_count);
      calibrationCount += parseSanitizedCount(e.calibration_count);

      const { qty, val } = getAssetTaggingMetrics(e);
      assetTaggingCount += qty;
      assetTaggingValue += val;

      mobiliseCount += parseSanitizedCount(e.mobilise_asset_count || e.mobilise_count);
    });

    return {
      callsAssigned,
      callsCompleted,
      pmsCount,
      calibrationCount,
      assetTaggingCount,
      assetTaggingValue,
      mobiliseCount
    };
  }, [activeExpenses]);

  const activityChartData = useMemo(() => {
    return [
      { name: "Calls Assigned", count: activityStats.callsAssigned },
      { name: "Calls Done", count: activityStats.callsCompleted },
      { name: "PMS Done", count: activityStats.pmsCount },
      { name: "Asset Tagging", count: activityStats.assetTaggingCount },
      { name: "Calibration", count: activityStats.calibrationCount },
      { name: "Asset Mobilised", count: activityStats.mobiliseCount }
    ];
  }, [activityStats]);

  // ============= DATA GROUPINGS =============

  const totalAmount = activeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const count = activeExpenses.length;
  const avgValue = count > 0 ? Math.round(totalAmount / count) : 0;

  // A. User-wise (Top 5 spenders)
  const userWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      const name = e.submitter_name || user?.name || "Self";
      map[name] = (map[name] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [activeExpenses]);

  // Status-wise Stats (Approved, Pending, Rejected amounts & counts)
  const statusStats = useMemo(() => {
    let appAmt = 0, appCnt = 0;
    let pendAmt = 0, pendCnt = 0;
    let rejAmt = 0, rejCnt = 0;
    activeExpenses.forEach(e => {
      const s = (e.status || "pending").toLowerCase();
      const amt = Number(e.amount || 0);
      if (s === "approved" || s === "auto_approved") {
        appAmt += amt; appCnt++;
      } else if (s === "rejected") {
        rejAmt += amt; rejCnt++;
      } else {
        pendAmt += amt; pendCnt++;
      }
    });
    return { appAmt, appCnt, pendAmt, pendCnt, rejAmt, rejCnt };
  }, [activeExpenses]);

  // B. Status-wise
  const statusWiseData = useMemo(() => {
    const map: Record<string, { value: number; count: number }> = {
      Approved: { value: statusStats.appAmt, count: statusStats.appCnt },
      Pending: { value: statusStats.pendAmt, count: statusStats.pendCnt },
      Rejected: { value: statusStats.rejAmt, count: statusStats.rejCnt }
    };
    return Object.entries(map)
      .map(([name, { value, count }]) => ({ name, value, count }))
      .filter(d => d.value > 0 || d.count > 0);
  }, [statusStats]);

  // C. District-wise (Top 5)
  const districtWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      // Robust mapping: check e.district first (live backend serialized field), then submitter_district, home_district, or logged-in user district
      let dist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || user?.district || "Unassigned District";
      if (!dist || dist.toLowerCase() === "all") {
        dist = "Unassigned District";
      }
      map[dist] = (map[dist] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [activeExpenses, user]);

  // D. Full Month Date-wise Expense Trend (Chronological 1st to last day of month)
  const fullMonthTrendData = useMemo(() => {
    // Build map of YYYY-MM-DD -> total amount from activeExpenses
    const dailyAmountMap: Record<string, number> = {};
    activeExpenses.forEach(e => {
      if (!e) return;
      const rawDate = e.date || e.itinerary;
      if (!rawDate) return;
      const cleanStr = String(rawDate).trim();
      const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
        dailyAmountMap[dateKey] = (dailyAmountMap[dateKey] || 0) + (e.amount || 0);
      }
    });

    const result: { date: string; amount: number; fullDate: string }[] = [];

    if (startDate && endDate) {
      // Custom date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const curr = new Date(start);

      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const monthShort = curr.toLocaleString("en-US", { month: "short" });
        const label = `${curr.getDate()} ${monthShort}`;

        result.push({
          date: label,
          amount: dailyAmountMap[dateKey] || 0,
          fullDate: dateKey
        });

        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // Full selected month (selectedYear, selectedMonth: 0-11)
      const year = selectedYear;
      const monthIdx = selectedMonth; // 0 = Jan, 1 = Feb, etc.
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const monthShort = months[monthIdx] ? months[monthIdx].substring(0, 3) : "Jul";

      for (let day = 1; day <= daysInMonth; day++) {
        const mm = String(monthIdx + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateKey = `${year}-${mm}-${dd}`;
        const label = `${day} ${monthShort}`;

        result.push({
          date: label,
          amount: dailyAmountMap[dateKey] || 0,
          fullDate: dateKey
        });
      }
    }

    return result;
  }, [activeExpenses, selectedMonth, selectedYear, startDate, endDate]);

  // E. Date-wise Tagged Asset Value Trend (₹)
  const dayWiseAssetTaggingValueData = useMemo(() => {
    const dailyValueMap: Record<string, { value: number; count: number }> = {};

    activeExpenses.forEach(e => {
      if (!e) return;
      const rawDate = e.date || e.itinerary;
      if (!rawDate) return;
      const cleanStr = String(rawDate).trim();
      const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
        if (!dailyValueMap[dateKey]) {
          dailyValueMap[dateKey] = { value: 0, count: 0 };
        }
        const { qty, val } = getAssetTaggingMetrics(e);
        dailyValueMap[dateKey].value += val;
        dailyValueMap[dateKey].count += qty;
      }
    });

    const result: { date: string; value: number; count: number; fullDate: string }[] = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const curr = new Date(start);

      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const monthShort = curr.toLocaleString("en-US", { month: "short" });
        const label = `${curr.getDate()} ${monthShort}`;

        result.push({
          date: label,
          value: dailyValueMap[dateKey]?.value || 0,
          count: dailyValueMap[dateKey]?.count || 0,
          fullDate: dateKey
        });

        curr.setDate(curr.getDate() + 1);
      }
    } else {
      const year = selectedYear;
      const monthIdx = selectedMonth;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const monthShort = months[monthIdx] ? months[monthIdx].substring(0, 3) : "Jul";

      for (let day = 1; day <= daysInMonth; day++) {
        const mm = String(monthIdx + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateKey = `${year}-${mm}-${dd}`;
        const label = `${day} ${monthShort}`;

        result.push({
          date: label,
          value: dailyValueMap[dateKey]?.value || 0,
          count: dailyValueMap[dateKey]?.count || 0,
          fullDate: dateKey
        });
      }
    }

    return result;
  }, [activeExpenses, selectedMonth, selectedYear, startDate, endDate]);

  // State for Breakdown Modals
  const [activeModal, setActiveModal] = useState<"none" | "asset_tagging" | "pms" | "calls">("none");
  const [isTaggingModalOpen, setIsTaggingModalOpen] = useState(false);
  const [selectedTaggingDate, setSelectedTaggingDate] = useState<string | null>(null);
  const [taggingSearchQuery, setTaggingSearchQuery] = useState("");
  const [taggingPageSize, setTaggingPageSize] = useState(10);
  const [taggingMobilePage, setTaggingMobilePage] = useState(1);

  const [pmsSearchQuery, setPmsSearchQuery] = useState("");
  const [pmsPageSize, setPmsPageSize] = useState(10);
  const [pmsMobilePage, setPmsMobilePage] = useState(1);

  const [callsSearchQuery, setCallsSearchQuery] = useState("");
  const [callsPageSize, setCallsPageSize] = useState(10);
  const [callsMobilePage, setCallsMobilePage] = useState(1);

  // Helper to completely unfreeze page body and restore scrolling/clicks
  const forceUnfreezePage = () => {
    document.body.style.overflow = "";
    document.body.style.overflowY = "";
    document.body.style.pointerEvents = "";
    document.body.classList.remove("ant-scrolling-effect");
    document.documentElement.style.overflow = "";
    document.documentElement.style.overflowY = "";
    
    // Clear residual backdrop overlays if left behind
    setTimeout(() => {
      document.body.style.overflow = "";
      document.body.style.overflowY = "";
      document.body.style.pointerEvents = "";
      document.body.classList.remove("ant-scrolling-effect");
      document.documentElement.style.overflow = "";
      document.documentElement.style.overflowY = "";

      const masks = document.querySelectorAll(".ant-modal-mask, .ant-modal-wrap");
      masks.forEach(el => {
        if (el && el.parentElement && activeModal === "none" && !isTaggingModalOpen) {
          (el as HTMLElement).style.display = "none";
        }
      });
    }, 150);
  };

  useEffect(() => {
    if (activeModal === "none" && !isTaggingModalOpen) {
      forceUnfreezePage();
    }
  }, [activeModal, isTaggingModalOpen]);

  useEffect(() => {
    return () => {
      forceUnfreezePage();
    };
  }, []);

  // Flatten asset tagging details for active expenses
  const taggingBreakdownData = useMemo(() => {
    const list: {
      key: string;
      date: string;
      engineer: string;
      district: string;
      zone: string;
      hospital_name: string;
      equipment_name: string;
      barcode: string;
      quantity: number;
      unit_cost: number;
      total_val: number;
    }[] = [];

    let counter = 1;
    activeExpenses.forEach(e => {
      if (!e) return;
      const engineerName = e.submitter_name || "Self";
      const districtName = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
      const zoneName = e.zone || "Unassigned";
      const mainDate = String(e.date || e.itinerary || "").trim();
      const fallbackHospital = e.hospital_name || e.destination || e.to || e.purpose || "Base Hospital / Site";
      const fallbackBarcode = e.barcode || e.asset_code || e.serial_number || "N/A";

      const details = Array.isArray(e.tagging_details) ? e.tagging_details : [];
      if (details.length > 0) {
        details.forEach((d: any) => {
          const itemDate = d.itinerary_date || mainDate;
          let dQty = Number(d.quantity || 1);
          let unitCost = Number(d.unit_cost || 0);
          let totalVal = Number(d.total_val || (dQty * unitCost) || 0);

          if (dQty > 100000 || isNaN(dQty)) {
            dQty = 1;
            totalVal = unitCost > 0 && unitCost < 100000000 ? unitCost : 0;
          } else if (totalVal > 100000000 || isNaN(totalVal)) {
            totalVal = unitCost > 0 ? dQty * unitCost : 0;
          }

          list.push({
            key: `tag_${counter++}`,
            date: itemDate,
            engineer: engineerName,
            district: districtName,
            zone: zoneName,
            hospital_name: d.hospital_name || fallbackHospital,
            equipment_name: d.equipment_name || "Tagged Asset",
            barcode: d.barcode || d.asset_code || fallbackBarcode,
            quantity: dQty,
            unit_cost: unitCost,
            total_val: totalVal
          });
        });
      } else if (Number(e.asset_tagging || 0) > 0 || Number(e.asset_tagging_value || e.asset_tagging_val || 0) > 0) {
        const { qty, val } = getAssetTaggingMetrics(e);
        if (qty > 0 || val > 0) {
          const unitCost = qty > 0 ? Math.round(val / qty) : val;
          list.push({
            key: `tag_${counter++}`,
            date: mainDate,
            engineer: engineerName,
            district: districtName,
            zone: zoneName,
            hospital_name: fallbackHospital,
            equipment_name: "Asset Tagging",
            barcode: fallbackBarcode,
            quantity: qty,
            unit_cost: unitCost,
            total_val: val
          });
        }
      }
    });

    return list;
  }, [activeExpenses]);

  // Filter breakdown data by selected date & search query
  const filteredTaggingBreakdown = useMemo(() => {
    return taggingBreakdownData.filter(item => {
      if (selectedTaggingDate) {
        const itemDateStr = String(item.date || "").trim();
        const dateMatch = itemDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const monthIdx = parseInt(dateMatch[2], 10) - 1;
          const dayNum = parseInt(dateMatch[3], 10);
          const dateLabel = `${dayNum} ${months[monthIdx]?.substring(0, 3)}`;
          if (dateLabel !== selectedTaggingDate && itemDateStr !== selectedTaggingDate) {
            return false;
          }
        } else if (itemDateStr && itemDateStr !== selectedTaggingDate) {
          return false;
        }
      }

      if (taggingSearchQuery.trim()) {
        const q = taggingSearchQuery.trim().toLowerCase();
        const matchEng = item.engineer.toLowerCase().includes(q);
        const matchDist = item.district.toLowerCase().includes(q);
        const matchEq = item.equipment_name.toLowerCase().includes(q);
        const matchZone = item.zone.toLowerCase().includes(q);
        if (!matchEng && !matchDist && !matchEq && !matchZone) return false;
      }

      return true;
    });
  }, [taggingBreakdownData, selectedTaggingDate, taggingSearchQuery]);

  const taggingTableColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (val: string) => <span className="font-mono text-xs font-semibold text-slate-700">{val || "—"}</span>,
      sorter: (a: any, b: any) => (a.date || "").localeCompare(b.date || "")
    },
    {
      title: "Engineer Name",
      dataIndex: "engineer",
      key: "engineer",
      render: (val: string) => <span className="font-bold text-xs text-slate-900">{val}</span>,
      sorter: (a: any, b: any) => a.engineer.localeCompare(b.engineer)
    },
    {
      title: "District",
      dataIndex: "district",
      key: "district",
      width: 120,
      render: (val: string) => <span className="text-xs text-slate-600 font-medium">{val}</span>,
      sorter: (a: any, b: any) => a.district.localeCompare(b.district)
    },
    {
      title: "Equipment Name",
      dataIndex: "equipment_name",
      key: "equipment_name",
      render: (val: string) => (
        <span className="font-semibold text-xs text-slate-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          {val}
        </span>
      ),
      sorter: (a: any, b: any) => a.equipment_name.localeCompare(b.equipment_name)
    },
    {
      title: "Hospital / Location",
      dataIndex: "hospital_name",
      key: "hospital_name",
      width: 140,
      render: (val: string) => <span className="text-xs text-slate-700 font-medium">{val || "—"}</span>,
      sorter: (a: any, b: any) => (a.hospital_name || "").localeCompare(b.hospital_name || "")
    },
    {
      title: "Equipment Name",
      dataIndex: "equipment_name",
      key: "equipment_name",
      render: (val: string) => (
        <span className="font-semibold text-xs text-slate-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          {val}
        </span>
      ),
      sorter: (a: any, b: any) => a.equipment_name.localeCompare(b.equipment_name)
    },
    {
      title: "Barcode / Asset ID",
      dataIndex: "barcode",
      key: "barcode",
      width: 130,
      render: (val: string) => <span className="font-mono text-xs text-primary-700 font-bold bg-primary-50 px-1.5 py-0.5 rounded border border-primary-100">{val || "N/A"}</span>,
      sorter: (a: any, b: any) => (a.barcode || "").localeCompare(b.barcode || "")
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 95,
      align: "center" as const,
      render: (val: number) => <span className="font-mono font-extrabold text-xs text-slate-700">{val} units</span>,
      sorter: (a: any, b: any) => a.quantity - b.quantity
    },
    {
      title: "Unit Price (₹)",
      dataIndex: "unit_cost",
      key: "unit_cost",
      width: 125,
      align: "right" as const,
      render: (val: number) => <span className="font-mono text-xs text-slate-600">₹{val.toLocaleString('en-IN')}</span>,
      sorter: (a: any, b: any) => a.unit_cost - b.unit_cost
    },
    {
      title: "Total Tagged Value (₹)",
      dataIndex: "total_val",
      key: "total_val",
      width: 155,
      align: "right" as const,
      render: (val: number) => <span className="font-mono font-extrabold text-xs text-emerald-600">₹{val.toLocaleString('en-IN')}</span>,
      sorter: (a: any, b: any) => a.total_val - b.total_val
    }
  ];

  // PMS Done Breakdown Data
  const pmsBreakdownData = useMemo(() => {
    const list: {
      key: string;
      date: string;
      engineer: string;
      district: string;
      zone: string;
      hospital_name: string;
      equipment_name: string;
      barcode: string;
      pms_schedule: string;
      pms_status: string;
      pms_count: number;
      purpose: string;
    }[] = [];

    let counter = 1;
    activeExpenses.forEach(e => {
      if (!e) return;
      const pmsCount = Number(e.pms_count || 0);
      if (pmsCount <= 0) return;

      const engineerName = e.submitter_name || "Self";
      const districtName = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
      const zoneName = e.zone || "Unassigned";
      const mainDate = String(e.date || e.itinerary || "").trim();
      const hospitalName = e.hospital_name || e.destination || e.to || e.purpose || "District Hospital / Site";
      const barcodeVal = e.barcode || e.asset_code || e.serial_number || "N/A";
      const scheduleVal = e.pms_schedule || e.schedule || "Scheduled";
      const statusVal = (e.status || "Completed").toLowerCase() === "approved" ? "Approved" : "Completed";

      list.push({
        key: `pms_${counter++}`,
        date: mainDate,
        engineer: engineerName,
        district: districtName,
        zone: zoneName,
        hospital_name: hospitalName,
        equipment_name: e.equipment_name || e.equipment || "Medical Equipment",
        barcode: barcodeVal,
        pms_schedule: scheduleVal,
        pms_status: statusVal,
        pms_count: pmsCount,
        purpose: e.purpose || e.description || "Preventive Maintenance Service"
      });
    });

    return list;
  }, [activeExpenses]);

  const filteredPmsBreakdown = useMemo(() => {
    return pmsBreakdownData.filter(item => {
      if (pmsSearchQuery.trim()) {
        const q = pmsSearchQuery.trim().toLowerCase();
        const matchEng = item.engineer.toLowerCase().includes(q);
        const matchDist = item.district.toLowerCase().includes(q);
        const matchHosp = item.hospital_name.toLowerCase().includes(q);
        const matchEq = item.equipment_name.toLowerCase().includes(q);
        const matchCode = item.barcode.toLowerCase().includes(q);
        const matchZone = item.zone.toLowerCase().includes(q);
        if (!matchEng && !matchDist && !matchHosp && !matchEq && !matchCode && !matchZone) return false;
      }
      return true;
    });
  }, [pmsBreakdownData, pmsSearchQuery]);

  const pmsTableColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (val: string) => <span className="font-mono text-xs font-semibold text-slate-700">{val || "—"}</span>,
      sorter: (a: any, b: any) => (a.date || "").localeCompare(b.date || "")
    },
    {
      title: "Engineer Name",
      dataIndex: "engineer",
      key: "engineer",
      render: (val: string) => <span className="font-bold text-xs text-indigo-900">{val}</span>,
      sorter: (a: any, b: any) => a.engineer.localeCompare(b.engineer)
    },
    {
      title: "District / Zone",
      key: "district_zone",
      width: 130,
      render: (_: any, record: any) => <span className="text-xs text-slate-600 font-medium">{record.district} ({record.zone})</span>,
      sorter: (a: any, b: any) => a.district.localeCompare(b.district)
    },
    {
      title: "Hospital / Location",
      dataIndex: "hospital_name",
      key: "hospital_name",
      width: 140,
      render: (val: string) => <span className="text-xs text-slate-700 font-medium">{val}</span>
    },
    {
      title: "Equipment & Barcode",
      key: "eq_barcode",
      render: (_: any, record: any) => (
        <div>
          <span className="font-semibold text-xs text-slate-800 block">{record.equipment_name}</span>
          <span className="font-mono text-[10px] text-teal-700 font-bold">BC: {record.barcode}</span>
        </div>
      )
    },
    {
      title: "PMS Schedule",
      dataIndex: "pms_schedule",
      key: "pms_schedule",
      width: 110,
      render: (val: string) => <span className="text-xs font-semibold text-slate-600">{val}</span>
    },
    {
      title: "PMS Done",
      dataIndex: "pms_count",
      key: "pms_count",
      width: 110,
      align: "center" as const,
      render: (val: number) => <span className="font-mono font-extrabold text-xs text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">{val} Completed</span>,
      sorter: (a: any, b: any) => a.pms_count - b.pms_count
    }
  ];

  // Calls Activity Breakdown Data
  const callsBreakdownData = useMemo(() => {
    const list: {
      key: string;
      date: string;
      engineer: string;
      district: string;
      zone: string;
      hospital_name: string;
      call_type: string;
      call_status: string;
      calls_assigned: number;
      calls_completed: number;
      completion_rate: number;
      purpose: string;
    }[] = [];

    let counter = 1;
    activeExpenses.forEach(e => {
      if (!e) return;
      const assigned = Number(e.calls_assigned || 0);
      const completed = Number(e.calls_completed || 0);
      if (assigned <= 0 && completed <= 0) return;

      const engineerName = e.submitter_name || "Self";
      const districtName = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city || "Unassigned District";
      const zoneName = e.zone || "Unassigned";
      const mainDate = String(e.date || e.itinerary || "").trim();
      const hospitalName = e.hospital_name || e.destination || e.to || e.purpose || "District Hospital / Site";
      const callTypeVal = e.call_type || e.travel_mode || e.category || "Breakdown Service";
      const callStatusVal = completed > 0 ? (completed >= assigned ? "Closed" : "Attended") : "Pending";
      const rate = assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : (completed > 0 ? 100 : 0);

      list.push({
        key: `call_${counter++}`,
        date: mainDate,
        engineer: engineerName,
        district: districtName,
        zone: zoneName,
        hospital_name: hospitalName,
        call_type: callTypeVal,
        call_status: callStatusVal,
        calls_assigned: assigned,
        calls_completed: completed,
        completion_rate: rate,
        purpose: e.purpose || e.description || "Service Call"
      });
    });

    return list;
  }, [activeExpenses]);

  const filteredCallsBreakdown = useMemo(() => {
    return callsBreakdownData.filter(item => {
      if (callsSearchQuery.trim()) {
        const q = callsSearchQuery.trim().toLowerCase();
        const matchEng = item.engineer.toLowerCase().includes(q);
        const matchDist = item.district.toLowerCase().includes(q);
        const matchHosp = item.hospital_name.toLowerCase().includes(q);
        const matchType = item.call_type.toLowerCase().includes(q);
        const matchStat = item.call_status.toLowerCase().includes(q);
        const matchZone = item.zone.toLowerCase().includes(q);
        if (!matchEng && !matchDist && !matchHosp && !matchType && !matchStat && !matchZone) return false;
      }
      return true;
    });
  }, [callsBreakdownData, callsSearchQuery]);

  const callsTableColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (val: string) => <span className="font-mono text-xs font-semibold text-slate-700">{val || "—"}</span>,
      sorter: (a: any, b: any) => (a.date || "").localeCompare(b.date || "")
    },
    {
      title: "Engineer Name",
      dataIndex: "engineer",
      key: "engineer",
      render: (val: string) => <span className="font-bold text-xs text-indigo-900">{val}</span>,
      sorter: (a: any, b: any) => a.engineer.localeCompare(b.engineer)
    },
    {
      title: "District / Zone",
      key: "district_zone",
      width: 130,
      render: (_: any, record: any) => <span className="text-xs text-slate-600 font-medium">{record.district} ({record.zone})</span>,
      sorter: (a: any, b: any) => a.district.localeCompare(b.district)
    },
    {
      title: "Hospital / Location",
      dataIndex: "hospital_name",
      key: "hospital_name",
      width: 140,
      render: (val: string) => <span className="text-xs text-slate-700 font-medium">{val}</span>
    },
    {
      title: "Call Type",
      dataIndex: "call_type",
      key: "call_type",
      width: 120,
      render: (val: string) => <span className="font-bold text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-100">{val}</span>
    },
    {
      title: "Call Status",
      dataIndex: "call_status",
      key: "call_status",
      width: 110,
      align: "center" as const,
      render: (val: string) => (
        <span className={`font-extrabold text-xs px-2 py-0.5 rounded-md ${val === 'Closed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {val}
        </span>
      )
    },
    {
      title: "Calls Done / Assigned",
      key: "calls_count",
      width: 130,
      align: "center" as const,
      render: (_: any, record: any) => <span className="font-mono font-bold text-xs text-slate-800">{record.calls_completed} / {record.calls_assigned}</span>,
      sorter: (a: any, b: any) => a.calls_completed - b.calls_completed
    },
    {
      title: "Completion Rate",
      dataIndex: "completion_rate",
      key: "completion_rate",
      width: 120,
      align: "center" as const,
      render: (val: number) => (
        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${val >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {val}%
        </span>
      ),
      sorter: (a: any, b: any) => a.completion_rate - b.completion_rate
    }
  ];

  // Excel Export Handler - Exactly 10 fields in exact requested order (Issue 3)
  const handleExportToExcel = (modalType: "asset_tagging" | "pms" | "calls") => {
    const monthName = months[selectedMonth];
    const monthQuery = `${monthName}_${selectedYear}`;
    let rawList: any[] = [];
    let fileName = "";

    if (modalType === "asset_tagging") {
      rawList = filteredTaggingBreakdown;
      fileName = `Asset_Tagging_Breakdown_${monthQuery}.xlsx`;
    } else if (modalType === "pms") {
      rawList = filteredPmsBreakdown;
      fileName = `PMS_Done_Breakdown_${monthQuery}.xlsx`;
    } else if (modalType === "calls") {
      rawList = filteredCallsBreakdown;
      fileName = `Calls_Activity_Breakdown_${monthQuery}.xlsx`;
    }

    if (rawList.length === 0) return;

    const exportData = rawList.map((item) => ({
      "District Name": item.district || "",
      "Hospital Name": item.hospital_name || item.hospital || "",
      "Equipment Name": item.equipment_name || "",
      "Bar Code": item.barcode || "",
      "PMS Schedule": item.pms_schedule || item.schedule || "",
      "PMS Time": item.pms_time || item.time || "",
      "Call Type": item.call_type || item.travel_mode || "",
      "Call Date": item.date || item.call_date || "",
      "Engineer Name": item.engineer || item.submitter_name || "",
      "Call Status": item.call_status || item.pms_status || item.status || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdown");
    XLSX.writeFile(workbook, fileName);
  };

  // E. Zone-wise (from user.zone database field) - respects active filters
  // FULL_ACCESS_ROLES: single source of truth — see utils/constants.ts
  const isPrivilegedRole = hasFullAccess(user?.role);

  const zoneWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      // Use expense's actual zone from DB
      let z = (e.zone || "").trim();
      if (!z || z.toLowerCase() === "all") {
        z = isPrivilegedRole ? "Unknown" : (user?.zone || "Unknown");
      }
      map[z] = (map[z] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [activeExpenses, user, isPrivilegedRole]);

  // F. Coordinator-wise - respects active filters
  // RULE: Only group by actual coordinator names.
  //   1. Use e.coordinator from backend (submitter's coordinator DB field)
  //   2. Fallback: look up coordinator in usersMap via submitter code
  //   3. If the SUBMITTER themselves is a Coordinator role, use their name
  //   4. Otherwise: "Unassigned" — NEVER use a random submitter_name (Engineer/HR/etc.)
  const coordinatorWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      // Step 1: coordinator field from backend (comes from submitter's users.coordinator column)
      let c = (e.coordinator || e.coordinator_name || "").trim();

      // Step 2: if missing, look up in usersMap via submitter's code/name
      if (!c || c.toLowerCase() === "unknown" || c.toLowerCase() === "null") {
        const submitterCode = String(e.submitter_code || e.user_id || "").trim().toLowerCase();
        const submitterName = String(e.submitter_name || "").trim().toLowerCase();
        const matchedUser = usersMap[submitterCode] || usersMap[submitterName];

        if (matchedUser?.coordinator) {
          c = matchedUser.coordinator.trim();
        } else if (matchedUser) {
          // Step 3: if the submitter IS a Coordinator, count their own expenses under their name
          const roleClean = (matchedUser.role || "").trim().toLowerCase();
          const desigClean = (matchedUser.designation || "").trim().toLowerCase();
          if (roleClean === "coordinator" || desigClean.includes("coordinator")) {
            c = matchedUser.name;
          }
        }
        // Step 4: no fallback to submitter_name — that would add Engineers/HR/etc. as coordinators
      }

      // Validate: the resolved coordinator name must belong to an actual Coordinator in usersMap
      if (c && c.toLowerCase() !== "unknown" && c.toLowerCase() !== "null") {
        const cLower = c.trim().toLowerCase();
        const coordinatorUser = Object.values(usersMap).find(
          (u: any) => (u.name || "").trim().toLowerCase() === cLower
        ) as any;
        // If we found this person in usersMap but they're NOT a Coordinator role, skip their name
        if (coordinatorUser) {
          const cRole = (coordinatorUser.role || "").trim().toLowerCase();
          const cDesig = (coordinatorUser.designation || "").trim().toLowerCase();
          if (cRole !== "coordinator" && !cDesig.includes("coordinator")) {
            // Person exists but wrong role — do not count under their name, mark unassigned
            c = "";
          }
        }
        // If person not found in usersMap at all, still allow (name may be from legacy data)
      }

      if (!c || c.toLowerCase() === "unknown" || c.toLowerCase() === "null") {
        c = "Unassigned";
      }

      map[c] = (map[c] || 0) + (e.amount || 0);
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0 && d.name !== "Unassigned")  // hide unassigned from chart
      .sort((a, b) => b.value - a.value);
  }, [activeExpenses, usersMap]);


  // Available years from data
  const availableYears = useMemo(() => {
    const allExp = [...myExpenses, ...teamExpenses];
    const years = new Set(allExp.map(e => Number(e.year)).filter(y => y > 2000));
    if (years.size === 0) years.add(currentDate.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [myExpenses, teamExpenses]);

  // CSV Downloader
  const downloadCSV = () => {
    if (activeExpenses.length === 0) {
      alert("No data available to download");
      return;
    }

    const headers = [
      "Date", "Submitter Name", "Submitter Code", "Designation", "District", "Zone",
      "Purpose/Description", "Status", "Amount", "Category/Mode", "KM Travelled",
      "DA Amount", "Hotel Amount", "Other Amount", "Local Purchase",
      "Calls Assigned", "Calls Completed", "PMS Count", "Calibration Count", "Asset Tagging", "Asset Mobilised"
    ];

    const csvRows = [headers.join(",")];

    activeExpenses.forEach(e => {
      const purposeClean = String(e.purpose || "").replace(/"/g, '""').replace(/\n/g, " ");
      const values = [
        `"${e.date || e.created_at || ""}"`,
        `"${e.submitter_name || ""}"`,
        `"${e.submitter_code || ""}"`,
        `"${e.submitter_designation || ""}"`,
        `"${e.district || ""}"`,
        `"${e.zone || ""}"`,
        `"${purposeClean}"`,
        `"${e.status || ""}"`,
        e.amount || 0,
        `"${e.category || ""}"`,
        e.total_km || 0,
        e.da_amount || 0,
        e.hotel_amount || 0,
        e.other_expense_amount || 0,
        e.local_purchase_amount || 0,
        e.calls_assigned || 0,
        e.calls_completed || 0,
        e.pms_count || 0,
        e.calibration_count || 0,
        e.asset_tagging || 0,
        e.mobilise_count || 0
      ];
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const monthName = months[selectedMonth];
    link.setAttribute("download", `Expense_Analysis_Report_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  console.log("AnalysisPage activeExpenses:", activeExpenses);

  if (loading) {
    return <AnalysisSkeleton />;
  }  return (
    <div className="w-full space-y-2 p-1 sm:p-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        /* Polish filters style and fix conflicting global styling */
        .ant-select {
          height: 38px !important;
          width: 100% !important;
        }
        .ant-select .ant-select-selector {
          border: 1.5px solid #cbd5e1 !important;
          border-radius: 12px !important;
          height: 38px !important;
          padding: 0 12px !important;
          background-color: #ffffff !important;
          display: flex !important;
          align-items: center !important;
          box-shadow: none !important;
        }
        .ant-select-selector input,
        .ant-select-selection-search-input,
        .ant-select-selection-search-input-hidden {
          border: none !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          height: 100% !important;
          min-height: unset !important;
          border-radius: 0 !important;
        }
        .ant-select-selection-item {
          line-height: 34px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
        }
        .ant-select-selection-placeholder {
          line-height: 34px !important;
          font-size: 12px !important;
          color: #94a3b8 !important;
        }
        .ant-select-arrow {
          color: #64748b !important;
        }
        
        /* Force highly specific select overrides to prevent global 44px min-height style */
        select.analysis-select-input {
          min-height: 34px !important;
          height: 34px !important;
          border-radius: 6px !important;
          padding: 0 8px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          background-color: #ffffff !important;
          color: #1f2937 !important;
          border: 1px solid #d1d5db !important;
          width: 100% !important;
          box-sizing: border-box !important;
          outline: none !important;
          cursor: pointer !important;
        }
        select.analysis-select-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1) !important;
        }

        /* Force highly specific date input overrides to prevent global 44px style */
        input[type="date"].analysis-date-input {
          height: 34px !important;
          min-height: 34px !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          padding: 0 8px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          background-color: #ffffff !important;
          color: #1f2937 !important;
          width: 100% !important;
          box-sizing: border-box !important;
          font-family: inherit !important;
          outline: none !important;
        }
        input[type="date"].analysis-date-input:focus {
          border-color: #6366f1 !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1) !important;
        }

        /* Status Segmented control custom styling */
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

        /* Custom Radio Button switcher styles */
        .ant-radio-button-wrapper {
          color: #4b5563 !important;
          background-color: #ffffff !important;
          border-color: #d1d5db !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .ant-radio-button-wrapper span {
          color: inherit !important;
        }
        .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
          color: #ffffff !important;
          background-color: #4f46e5 !important;
          border-color: #4f46e5 !important;
        }
        .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) span {
          color: #ffffff !important;
        }
      `}</style>
      
      {/* Ultra-Compact #4A6A8A Signature Header Bar */}
      <div className="bg-[#4A6A8A] text-white rounded-t-lg px-3 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <FundOutlined className="text-white text-sm" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white tracking-normal whitespace-nowrap">
              Deep Analytics <span className="text-white/70 font-normal text-xs">({months[selectedMonth]} {selectedYear})</span>
            </span>
          </div>

          <span className="sm:hidden text-[10px] font-mono font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded shrink-0">
            {activeExpenses.length} Rec.
          </span>
        </div>

        {/* Controls & Mode Switcher */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
          {isReviewer && (
            <div className="flex items-center bg-white/15 p-0.5 rounded-md text-[11px] font-bold shrink-0">
              <button
                onClick={() => setViewMode("my")}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  viewMode === "my" ? "bg-white text-[#4A6A8A] shadow-xs" : "text-white/80 hover:text-white"
                }`}
              >
                <UserOutlined style={{ fontSize: 10 }} />
                My Data
              </button>
              <button
                onClick={() => setViewMode("team")}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  viewMode === "team" ? "bg-white text-[#4A6A8A] shadow-xs" : "text-white/80 hover:text-white"
                }`}
              >
                <TeamOutlined style={{ fontSize: 10 }} />
                Team Data
              </button>
            </div>
          )}

          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <FilterOutlined style={{ fontSize: 11 }} />
            {isFilterExpanded ? "Hide Filters" : "Filters"}
          </button>

          <Button
            type="primary"
            size="small"
            icon={<FileExcelOutlined style={{ fontSize: 11 }} />}
            style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
            onClick={downloadCSV}
            disabled={activeExpenses.length === 0}
            className="font-bold text-[11px] uppercase flex items-center justify-center shrink-0 h-7 px-2.5 cursor-pointer shadow-2xs whitespace-nowrap rounded-md"
          >
            Export CSV
          </Button>

          <span className="hidden sm:inline-block text-xs font-mono font-bold text-white/90 bg-white/20 px-2.5 py-1 rounded shrink-0 whitespace-nowrap">
            {activeExpenses.length} Records
          </span>
        </div>
      </div>

      {/* Ultra-Compact Filter Toolbar (Responsive Grid for Mobile & Desktop) */}
      {isFilterExpanded && (
        <div className="bg-white border-x border-b border-slate-200/80 p-2 shadow-2xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-nowrap items-center gap-2 w-full">
            {viewMode === "team" && isReviewer && (
              <>
                <div className="w-full">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Zone</span>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="analysis-select-input w-full text-[10.5px] px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white"
                  >
                    <option value="all">All Zones</option>
                    {uniqueZones.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">District</span>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="analysis-select-input w-full text-[10.5px] px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white"
                  >
                    <option value="all">All Districts</option>
                    {filterOptions.districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full col-span-2 sm:col-span-1">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5 flex items-center gap-0.5">
                    <SearchOutlined style={{ fontSize: 8 }} /> Engineer
                  </span>
                  <Select
                    showSearch
                    size="small"
                    value={selectedEngineer}
                    onChange={(val) => setSelectedEngineer(val)}
                    className="w-full text-[10.5px] font-semibold"
                    style={{ minHeight: "28px", height: "28px" }}
                    placeholder="Search"
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      { value: "all", label: `All Engineers (${filterOptions.engineers.length})` },
                      ...filterOptions.engineers.map((name) => ({
                        value: name,
                        label: name,
                      })),
                    ]}
                  />
                </div>

                <div className="w-full">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Coordinator</span>
                  <select
                    value={selectedCoordinator}
                    onChange={(e) => setSelectedCoordinator(e.target.value)}
                    className="analysis-select-input w-full text-[10.5px] px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white"
                  >
                    <option value="all">All Coordinators</option>
                    {coordinatorsList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="w-full">
              <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="analysis-select-input w-full text-[10.5px] font-bold text-slate-700 px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="w-full">
              <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Month</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                disabled={!!startDate || !!endDate}
                className="analysis-select-input w-full text-[10.5px] px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white disabled:opacity-50"
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>

            <div className="w-full">
              <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={!!startDate || !!endDate}
                className="analysis-select-input w-full text-[10.5px] px-1.5 py-1 h-7 leading-none rounded border border-slate-300 bg-white disabled:opacity-50"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="w-full col-span-2 sm:col-span-2 lg:w-auto shrink-0">
              <span className="text-[8px] font-extrabold text-slate-400 uppercase block leading-none mb-0.5">Custom Date Range</span>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  min={minDateStr}
                  max={maxDateStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="analysis-date-input text-[10px] w-24 px-1 py-0.5 h-7 leading-none rounded border border-slate-300 bg-white"
                />
                <span className="text-slate-400 text-[9px]">to</span>
                <input
                  type="date"
                  value={endDate}
                  min={minDateStr}
                  max={maxDateStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="analysis-date-input text-[10px] w-24 px-1 py-0.5 h-7 leading-none rounded border border-slate-300 bg-white"
                />
                {(startDate || endDate) && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<CloseOutlined style={{ fontSize: 9 }} />}
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Card Design System */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 my-2.5">
        {/* Card 1: Total Claimed */}
        <div
          className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer"
          onClick={() => setSelectedStatus("all")}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <FileExcelOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">TOTAL CLAIMED</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-slate-900 leading-none truncate">{(totalAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            <span className="text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">{count} Claims</span>
          </div>
        </div>

        {/* Card 2: Approved */}
        <div
          className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer"
          onClick={() => setSelectedStatus("approved")}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <CheckOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">APPROVED</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-emerald-800 leading-none truncate">{(statusStats.appAmt || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">{statusStats.appCnt} Claims</span>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div
          className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer"
          onClick={() => setSelectedStatus("pending")}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <InfoCircleOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">PENDING</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-amber-800 leading-none truncate">{(statusStats.pendAmt || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            <span className="text-[8px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">{statusStats.pendCnt} Claims</span>
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div
          className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md hover:border-rose-400 transition-all cursor-pointer"
          onClick={() => setSelectedStatus("rejected")}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <CloseOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">REJECTED</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-rose-800 leading-none truncate">{(statusStats.rejAmt || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            <span className="text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">{statusStats.rejCnt} Claims</span>
          </div>
        </div>

        {/* Card 5: Avg Claim */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <RiseOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">AVG CLAIM</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-indigo-900 leading-none truncate">{(avgValue || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">Per Claim</span>
          </div>
        </div>

        {/* Card 6: Calls Done */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs hover:shadow-md transition-all">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <RocketOutlined className="text-xs sm:text-sm text-white" />
          </div>
          <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 leading-none truncate">CALLS DONE</span>
            <span className="text-xs sm:text-[13px] font-mono font-extrabold text-cyan-900 leading-none truncate">{activityStats.callsCompleted}/{activityStats.callsAssigned}</span>
            <span className="text-[8px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1 py-0.2 rounded font-mono leading-none w-fit truncate">Completed</span>
          </div>
        </div>
      </div>

      {/* Dashboard Full-Bleed Grid */}
      {count === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-none p-8 text-center shadow-2xs my-4">
          <InfoCircleOutlined style={{ fontSize: 36, color: "#94a3b8", marginBottom: 12 }} />
          <h3 className="text-sm font-bold text-slate-800">No Expense Claims Recorded</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No data matched your active filters for {months[selectedMonth]} {selectedYear}. Try adjusting the zone, district, or month selection.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Main Grid: Row 1 - Spend Burn Line & Status Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Daily Spend Burn Line Chart (col-span-8) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <LineChartOutlined style={{ fontSize: 13 }} />
                  DAILY SPEND BURN
                </span>
              </div>
              <div className="p-3" style={{ height: 300 }}>
                <SaaS3DHybridTrendChart
                  data={fullMonthTrendData.map(d => ({ x: d.date, y: d.amount }))}
                  height={275}
                  mode="expense"
                  showPeakLimit={false}
                  valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                />
              </div>
            </div>

            {/* Status & Approval Ratios 3D Chart (col-span-4) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-1.5 truncate">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  CLAIM STATUS RATIOS
                </span>
              </div>
              <div className="p-2 flex flex-col justify-between" style={{ minHeight: 330 }}>
                <SaaSDonutChart
                  data={statusWiseData.map(d => ({
                    name: d.name,
                    value: d.value,
                    count: d.count,
                    color: d.name === "Approved" ? "#10b981" : d.name === "Rejected" ? "#ef4444" : "#f59e0b"
                  }))}
                  height={330}
                  centerTitle="Claims"
                  valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                />
              </div>
            </div>
          </div>



          {/* Row 3: District Expenditure & Top Spenders Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* District Expenditure Combined 3D Bar + Line Chart (col-span-6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <BarChartOutlined style={{ fontSize: 13 }} />
                  DISTRICT EXPENDITURE
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                <SaaSBarChart
                  data={districtWiseData}
                  valueKey="amount"
                  nameKey="name"
                  height={270}
                  isCurrency={true}
                  showLineOverlay={true}
                  valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                />
              </div>
            </div>

            {/* Top Employee Expenses Financial Chart (col-span-6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <WalletOutlined style={{ fontSize: 13 }} />
                  EMPLOYEE EXPENSES
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                {userWiseData.length > 0 ? (
                  <SaaSHorizontalBarChart
                    data={userWiseData.slice(0, 6)}
                    valueKey="amount"
                    nameKey="name"
                    height={270}
                    isCurrency={true}
                    valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No employee expense data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Operations Activity & Zone/Coordinator Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Operations Activity (col-span-7) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <RocketOutlined style={{ fontSize: 13 }} />
                  FIELD OPERATIONS
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                <SaaSBarChart
                  data={activityChartData}
                  valueKey="count"
                  nameKey="name"
                  height={270}
                  isCurrency={false}
                  valueFormatter={(v) => `${v.toLocaleString('en-IN')}`}
                />
              </div>
            </div>

            {/* Zone Distribution (col-span-5) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <GlobalOutlined style={{ fontSize: 13 }} />
                  ZONE DISTRIBUTION
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                <SaaSDonutChart
                  data={zoneWiseData.map((z, idx) => ({
                    name: z.name,
                    value: z.value,
                    color: [
                      "#4f46e5", // Vibrant Royal Indigo
                      "#059669", // Emerald Green
                      "#d97706", // Amber
                      "#e11d48", // Rose Red
                      "#0891b2", // Cyan
                      "#7c3aed"  // Violet
                    ][idx % 6]
                  }))}
                  height={270}
                  centerTitle="Zones"
                  valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                />
              </div>
            </div>
          </div>

          {/* Row 5: Coordinator Expenses Pie & Day-wise Asset Value Tagging Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Coordinator Expenses Pie Chart (col-span-5) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  COORDINATOR EXPENSES
                </span>
              </div>
              <div className="p-3" style={{ height: 310 }}>
                {coordinatorWiseData.length > 0 ? (
                  <SaaSDonutChart
                    data={coordinatorWiseData.map((c: any) => ({
                      name: c.name,
                      value: c.value,
                      count: (c as any).count
                    }))}
                    height={290}
                    centerTitle="Coordinators"
                    valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No coordinator expense data
                  </div>
                )}
              </div>
            </div>

            {/* Asset Value Tagging Day-wise Trend Chart (col-span-7) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <TagOutlined style={{ fontSize: 13 }} />
                  ASSET VALUE TAGGING (DAY-WISE)
                </span>
              </div>
              <div className="p-3" style={{ height: 310 }}>
                {dayWiseAssetTaggingValueData.filter(d => (d.value || 0) > 0).length > 0 ? (
                  <SaaS3DHybridTrendChart
                    data={dayWiseAssetTaggingValueData
                      .filter(d => (d.value || 0) > 0)
                      .map(d => ({
                        x: d.date,
                        y: d.value
                      }))}
                    height={285}
                    mode="asset"
                    showPeakLimit={false}
                    valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No active asset tagging recorded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Tagging Detailed Breakdown Modal */}
      <Modal
        open={isTaggingModalOpen || activeModal === "asset_tagging"}
        onCancel={() => { 
          setIsTaggingModalOpen(false); 
          setActiveModal("none"); 
          forceUnfreezePage();
        }}
        destroyOnClose={true}
        afterClose={() => {
          forceUnfreezePage();
        }}
        footer={null}
        width={950}
        centered
        style={{ maxWidth: "96vw", top: 10, maxHeight: "85vh" }}
        bodyStyle={{ padding: "12px 16px 16px 16px", maxHeight: "calc(85vh - 70px)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        className="asset-tagging-breakdown-modal"
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3 pr-6">
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <TagOutlined className="text-cyan-500" />
                Asset Tagging Detailed Breakdown
              </span>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal m-0 mt-0.5">
                {selectedTaggingDate ? `Filtered for ${selectedTaggingDate}` : `${months[selectedMonth]} ${selectedYear} — All Tagged Equipment`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                type="primary"
                icon={<FileExcelOutlined />}
                style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                onClick={() => handleExportToExcel("asset_tagging")}
                className="text-xs font-bold shadow-2xs"
              >
                Export Excel
              </Button>
              {selectedTaggingDate && (
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => setSelectedTaggingDate(null)}
                  className="text-xs text-indigo-600 font-bold"
                >
                  Clear Date Filter
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          {/* Summary Badges & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Items</span>
                <span className="text-xs font-black text-slate-800 font-mono">{filteredTaggingBreakdown.length} records</span>
              </div>
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Tagged Quantity</span>
                <span className="text-xs font-black text-cyan-600 font-mono">
                  {filteredTaggingBreakdown.reduce((sum, item) => sum + item.quantity, 0)} units
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Tagged Value</span>
                <span className="text-xs font-black text-emerald-600 font-mono">
                  ₹{filteredTaggingBreakdown.reduce((sum, item) => sum + item.total_val, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search engineer, district, or equipment..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={taggingSearchQuery}
                onChange={(e) => {
                  setTaggingSearchQuery(e.target.value);
                  setTaggingMobilePage(1);
                }}
                allowClear
                size="small"
                className="rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Mobile Cards View (<768px) */}
          <div className="block md:hidden space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredTaggingBreakdown.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-bold">
                No asset tagging records found for this selection
              </div>
            ) : (
              (() => {
                const totalMobileItems = filteredTaggingBreakdown.length;
                const slicedMobile = filteredTaggingBreakdown.slice(
                  (taggingMobilePage - 1) * taggingPageSize,
                  taggingMobilePage * taggingPageSize
                );
                const maxMobilePage = Math.ceil(totalMobileItems / taggingPageSize) || 1;

                return (
                  <>
                    <div className="space-y-2">
                      {slicedMobile.map((item) => (
                        <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-cyan-300 transition-all">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                            <span className="font-bold text-xs text-slate-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md leading-snug">
                              {item.equipment_name}
                            </span>
                            <span className="font-mono font-extrabold text-xs text-emerald-600 shrink-0">
                              ₹{item.total_val.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Engineer</span>
                              <span className="font-bold text-indigo-900">{item.engineer}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">District / Zone</span>
                              <span className="font-semibold text-slate-700">{item.district} ({item.zone})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Hospital / Location</span>
                              <span className="font-medium text-slate-800 truncate block">{item.hospital_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Barcode / Asset ID</span>
                              <span className="font-mono text-indigo-700 font-bold">{item.barcode}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Date</span>
                              <span className="font-mono text-slate-600">{item.date || "—"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Qty & Unit Price</span>
                              <span className="font-mono text-slate-700 font-semibold">{item.quantity} units @ ₹{item.unit_cost.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mobile Pagination Controls */}
                    <div className="pt-2 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {((taggingMobilePage - 1) * taggingPageSize) + 1}-{Math.min(taggingMobilePage * taggingPageSize, totalMobileItems)} of {totalMobileItems}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="small"
                          disabled={taggingMobilePage === 1}
                          onClick={() => setTaggingMobilePage(p => Math.max(1, p - 1))}
                          className="text-[11px] px-2 font-bold"
                        >
                          Prev
                        </Button>
                        <span className="font-mono text-[11px] font-bold text-slate-700 px-1">
                          {taggingMobilePage}/{maxMobilePage}
                        </span>
                        <Button
                          size="small"
                          disabled={taggingMobilePage >= maxMobilePage}
                          onClick={() => setTaggingMobilePage(p => p + 1)}
                          className="text-[11px] px-2 font-bold"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Desktop Table View (≥768px) */}
          <div className="hidden md:block admin-data-table-wrapper rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
            <Table
              columns={taggingTableColumns}
              dataSource={filteredTaggingBreakdown}
              size="small"
              pagination={{
                pageSize: taggingPageSize,
                onChange: (_, size) => setTaggingPageSize(size),
                onShowSizeChange: (_, size) => setTaggingPageSize(size),
                showSizeChanger: true,
                pageSizeOptions: ["10", "25", "50", "100"],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tagged items`
              }}
              bordered
              scroll={{ x: 750, y: 380 }}
              className="admin-data-table text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* PMS Done Detailed Breakdown Modal */}
      <Modal
        open={activeModal === "pms"}
        onCancel={() => { 
          setActiveModal("none"); 
          forceUnfreezePage();
        }}
        destroyOnClose={true}
        afterClose={() => {
          forceUnfreezePage();
        }}
        footer={null}
        width={900}
        centered
        style={{ maxWidth: "96vw", top: 10, maxHeight: "85vh" }}
        bodyStyle={{ padding: "12px 16px 16px 16px", maxHeight: "calc(85vh - 70px)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        className="pms-breakdown-modal"
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3 pr-6">
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <CheckOutlined className="text-teal-500" />
                PMS Done Detailed Breakdown
              </span>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal m-0 mt-0.5">
                {months[selectedMonth]} {selectedYear} — Preventive Maintenance Records
              </p>
            </div>
            <Button
              size="small"
              type="primary"
              icon={<FileExcelOutlined />}
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={() => handleExportToExcel("pms")}
              className="text-xs font-bold shadow-2xs self-start sm:self-auto"
            >
              Export Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          {/* Summary Badges & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Records</span>
                <span className="text-xs font-black text-slate-800 font-mono">{filteredPmsBreakdown.length} entries</span>
              </div>
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total PMS Completed</span>
                <span className="text-xs font-black text-teal-600 font-mono">
                  {filteredPmsBreakdown.reduce((sum, item) => sum + item.pms_count, 0)} PMS
                </span>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search engineer, district, or details..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={pmsSearchQuery}
                onChange={(e) => {
                  setPmsSearchQuery(e.target.value);
                  setPmsMobilePage(1);
                }}
                allowClear
                size="small"
                className="rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Mobile Cards View (<768px) */}
          <div className="block md:hidden space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredPmsBreakdown.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-bold">
                No PMS records found for this selection
              </div>
            ) : (
              (() => {
                const totalMobileItems = filteredPmsBreakdown.length;
                const slicedMobile = filteredPmsBreakdown.slice(
                  (pmsMobilePage - 1) * pmsPageSize,
                  pmsMobilePage * pmsPageSize
                );
                const maxMobilePage = Math.ceil(totalMobileItems / pmsPageSize) || 1;

                return (
                  <>
                    <div className="space-y-2">
                      {slicedMobile.map((item) => (
                        <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-teal-300 transition-all">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                            <span className="font-bold text-xs text-indigo-900">
                              {item.engineer}
                            </span>
                            <span className="font-mono font-extrabold text-xs text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md shrink-0">
                              {item.pms_count} PMS
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Hospital / Location</span>
                              <span className="font-medium text-slate-800 truncate block">{item.hospital_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Equipment / Barcode</span>
                              <span className="font-semibold text-slate-700 truncate block">{item.equipment_name} (BC: {item.barcode})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">District / Zone</span>
                              <span className="font-semibold text-slate-700">{item.district} ({item.zone})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Date & PMS Schedule</span>
                              <span className="font-mono text-slate-600">{item.date} ({item.pms_schedule})</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Purpose / Details</span>
                              <span className="text-slate-700">{item.purpose}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mobile Pagination Controls */}
                    <div className="pt-2 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {((pmsMobilePage - 1) * pmsPageSize) + 1}-{Math.min(pmsMobilePage * pmsPageSize, totalMobileItems)} of {totalMobileItems}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="small"
                          disabled={pmsMobilePage === 1}
                          onClick={() => setPmsMobilePage(p => Math.max(1, p - 1))}
                          className="text-[11px] px-2 font-bold"
                        >
                          Prev
                        </Button>
                        <span className="font-mono text-[11px] font-bold text-slate-700 px-1">
                          {pmsMobilePage}/{maxMobilePage}
                        </span>
                        <Button
                          size="small"
                          disabled={pmsMobilePage >= maxMobilePage}
                          onClick={() => setPmsMobilePage(p => p + 1)}
                          className="text-[11px] px-2 font-bold"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Desktop Table View (≥768px) */}
          <div className="hidden md:block admin-data-table-wrapper rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
            <Table
              columns={pmsTableColumns}
              dataSource={filteredPmsBreakdown}
              size="small"
              pagination={{
                pageSize: pmsPageSize,
                onChange: (_, size) => setPmsPageSize(size),
                onShowSizeChange: (_, size) => setPmsPageSize(size),
                showSizeChanger: true,
                pageSizeOptions: ["10", "25", "50", "100"],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} PMS records`
              }}
              bordered
              scroll={{ x: 700, y: 380 }}
              className="admin-data-table text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Calls Activity Detailed Breakdown Modal */}
      <Modal
        open={activeModal === "calls"}
        onCancel={() => { 
          setActiveModal("none"); 
          forceUnfreezePage();
        }}
        destroyOnClose={true}
        afterClose={() => {
          forceUnfreezePage();
        }}
        footer={null}
        width={950}
        centered
        style={{ maxWidth: "96vw", top: 10, maxHeight: "85vh" }}
        bodyStyle={{ padding: "12px 16px 16px 16px", maxHeight: "calc(85vh - 70px)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        className="calls-breakdown-modal"
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3 pr-6">
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <FundOutlined className="text-indigo-500" />
                Calls Activity Detailed Breakdown
              </span>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal m-0 mt-0.5">
                {months[selectedMonth]} {selectedYear} — Service Calls Assigned vs Completed
              </p>
            </div>
            <Button
              size="small"
              type="primary"
              icon={<FileExcelOutlined />}
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={() => handleExportToExcel("calls")}
              className="text-xs font-bold shadow-2xs self-start sm:self-auto"
            >
              Export Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          {/* Summary Badges & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Total Records</span>
                <span className="text-xs font-black text-slate-800 font-mono">{filteredCallsBreakdown.length} entries</span>
              </div>
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Calls Assigned</span>
                <span className="text-xs font-black text-slate-700 font-mono">
                  {filteredCallsBreakdown.reduce((sum, item) => sum + item.calls_assigned, 0)}
                </span>
              </div>
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Calls Completed</span>
                <span className="text-xs font-black text-indigo-700 font-mono">
                  {filteredCallsBreakdown.reduce((sum, item) => sum + item.calls_completed, 0)}
                </span>
              </div>
              <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase block">Overall Rate</span>
                <span className="text-xs font-black text-emerald-600 font-mono">
                  {(() => {
                    const totAssigned = filteredCallsBreakdown.reduce((sum, item) => sum + item.calls_assigned, 0);
                    const totDone = filteredCallsBreakdown.reduce((sum, item) => sum + item.calls_completed, 0);
                    return totAssigned > 0 ? Math.min(100, Math.round((totDone / totAssigned) * 100)) : 100;
                  })()}%
                </span>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search engineer, district, or details..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={callsSearchQuery}
                onChange={(e) => {
                  setCallsSearchQuery(e.target.value);
                  setCallsMobilePage(1);
                }}
                allowClear
                size="small"
                className="rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Mobile Cards View (<768px) */}
          <div className="block md:hidden space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredCallsBreakdown.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-bold">
                No calls activity records found for this selection
              </div>
            ) : (
              (() => {
                const totalMobileItems = filteredCallsBreakdown.length;
                const slicedMobile = filteredCallsBreakdown.slice(
                  (callsMobilePage - 1) * callsPageSize,
                  callsMobilePage * callsPageSize
                );
                const maxMobilePage = Math.ceil(totalMobileItems / callsPageSize) || 1;

                return (
                  <>
                    <div className="space-y-2">
                      {slicedMobile.map((item) => (
                        <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-indigo-300 transition-all">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                            <span className="font-bold text-xs text-indigo-900">
                              {item.engineer}
                            </span>
                            <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${item.completion_rate >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {item.completion_rate}% Rate
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Hospital / Location</span>
                              <span className="font-medium text-slate-800 truncate block">{item.hospital_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Call Type & Status</span>
                              <span className="font-bold text-indigo-700 truncate block">{item.call_type} ({item.call_status})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">District / Zone</span>
                              <span className="font-semibold text-slate-700">{item.district} ({item.zone})</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Date</span>
                              <span className="font-mono text-slate-600">{item.date || "—"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Calls Done / Assigned</span>
                              <span className="font-mono text-slate-800 font-bold">{item.calls_completed} / {item.calls_assigned}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-bold block">Purpose</span>
                              <span className="text-slate-700 truncate block">{item.purpose}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mobile Pagination Controls */}
                    <div className="pt-2 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {((callsMobilePage - 1) * callsPageSize) + 1}-{Math.min(callsMobilePage * callsPageSize, totalMobileItems)} of {totalMobileItems}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="small"
                          disabled={callsMobilePage === 1}
                          onClick={() => setCallsMobilePage(p => Math.max(1, p - 1))}
                          className="text-[11px] px-2 font-bold"
                        >
                          Prev
                        </Button>
                        <span className="font-mono text-[11px] font-bold text-slate-700 px-1">
                          {callsMobilePage}/{maxMobilePage}
                        </span>
                        <Button
                          size="small"
                          disabled={callsMobilePage >= maxMobilePage}
                          onClick={() => setCallsMobilePage(p => p + 1)}
                          className="text-[11px] px-2 font-bold"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Desktop Table View (≥768px) */}
          <div className="hidden md:block admin-data-table-wrapper rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
            <Table
              columns={callsTableColumns}
              dataSource={filteredCallsBreakdown}
              size="small"
              pagination={{
                pageSize: callsPageSize,
                onChange: (_, size) => setCallsPageSize(size),
                onShowSizeChange: (_, size) => setCallsPageSize(size),
                showSizeChanger: true,
                pageSizeOptions: ["10", "25", "50", "100"],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} calls records`
              }}
              bordered
            />
          </div>
        </div>
      </Modal>

      {/* Rajasthan GeoJSON District Analytics Interactive Map Chart (Desktop Only) */}
      {(activeTab === "map" || activeTab === "overview") && (
        <div className="mt-2 hidden md:block">
          <RajasthanMapChart
            expenses={mapExpenses}
            selectedZoneFilter={selectedZone}
            selectedDistrictFilter={!isFullMapRole && user?.district ? user.district : (selectedDistrict === "all" ? null : selectedDistrict)}
            onSelectDistrict={(dist) => {
              if (!isFullMapRole && user?.district) return;
              if (!dist) {
                setSelectedDistrict("all");
              } else {
                setSelectedDistrict(dist);
              }
            }}
          />
        </div>
      )}

      <style>{`
        .ant-modal-content {
          max-height: 85vh !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .ant-modal-body {
          max-height: calc(85vh - 70px) !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        .admin-data-table .ant-table-header th,
        .admin-data-table .ant-table-thead > tr > th {
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: 700 !important;
          border-bottom: 2px solid #cbd5e1 !important;
        }
        .admin-data-table .ant-table-tbody > tr:nth-child(even) {
          background-color: #f8fafc !important;
        }
        .admin-data-table .ant-table-tbody > tr:nth-child(odd) {
          background-color: #ffffff !important;
        }
        .admin-data-table .ant-table-tbody > tr:hover > td {
          background-color: #e0e7ff !important;
        }
        .admin-data-table .ant-table-cell {
          padding: 10px 12px !important;
          vertical-align: middle !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .admin-data-table-wrapper {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      `}</style>
    </div>
  );
}
