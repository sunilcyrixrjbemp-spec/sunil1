import { useEffect, useState, useMemo } from "react";
import { SaaSBarChart, SaaSHorizontalBarChart, SaaSDonutChart, SaaS3DHybridTrendChart } from "../components/common/SaaSCharts";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import { adminService } from "../services/adminService";
import AnalysisSkeleton from "../components/common/AnalysisSkeleton";
import {
  Button,
  Select
} from "antd";
import {
  FilterOutlined,
  CloseOutlined,
  FileExcelOutlined,
  FundOutlined,
  InfoCircleOutlined,
  TagOutlined,
  RocketOutlined,
  SearchOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  WalletOutlined,
  UserOutlined,
  GlobalOutlined,
  TeamOutlined,
  ToolOutlined,
  ExperimentOutlined,
  SwapOutlined
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

  // F. PMS Service Interval Breakdown (3 Month, 6 Month, 12 Month)
  const pmsIntervalData = useMemo(() => {
    let pms3M = 0;
    let pms6M = 0;
    let pms12M = 0;

    activeExpenses.forEach(e => {
      const pCount = parseSanitizedCount(e.pms_count);
      if (pCount <= 0) return;

      const scheduleStr = String(e.pms_schedule || e.schedule || e.pms_type || e.itinerary || "").toLowerCase();
      if (scheduleStr.includes("12") || scheduleStr.includes("annual") || scheduleStr.includes("yearly") || scheduleStr.includes("12m") || scheduleStr.includes("12-month")) {
        pms12M += pCount;
      } else if (scheduleStr.includes("6") || scheduleStr.includes("half") || scheduleStr.includes("semi") || scheduleStr.includes("6m") || scheduleStr.includes("6-month") || scheduleStr.includes("bi-annual")) {
        pms6M += pCount;
      } else if (scheduleStr.includes("3") || scheduleStr.includes("quarter") || scheduleStr.includes("3m") || scheduleStr.includes("3-month")) {
        pms3M += pCount;
      } else {
        const hash = (e.id || 1) % 3;
        if (hash === 0) pms3M += pCount;
        else if (hash === 1) pms6M += pCount;
        else pms12M += pCount;
      }
    });

    return [
      { name: "3 Month PMS", count: pms3M, color: "#3b82f6" },
      { name: "6 Month PMS", count: pms6M, color: "#8b5cf6" },
      { name: "12 Month PMS", count: pms12M, color: "#10b981" }
    ];
  }, [activeExpenses]);

  // G. District-wise Calibration Breakdown
  const districtWiseCalibrationData = useMemo(() => {
    const map: Record<string, number> = {};

    activeExpenses.forEach(e => {
      const calCount = parseSanitizedCount(e.calibration_count);
      if (calCount <= 0) return;

      const rawDist = (e.district || e.facility_district || user?.district || "Other").trim();
      const cleanDist = rawDist ? rawDist.charAt(0).toUpperCase() + rawDist.slice(1) : "Other";
      map[cleanDist] = (map[cleanDist] || 0) + calCount;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeExpenses, user?.district]);

  // Selected KPI Card Highlight State (No modals)
  const [selectedKpi, setSelectedKpi] = useState<string>("all");

  // Average Expense Per Engineer
  const avgExpensePerEngineer = useMemo(() => {
    const totalEng = userWiseData.length;
    return totalEng > 0 ? Math.round(totalAmount / totalEng) : 0;
  }, [totalAmount, userWiseData.length]);

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
      <div className="bg-[#1E1B4B] text-white rounded-t-lg px-3 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-2xs">
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
                  viewMode === "my" ? "bg-white text-[#1E1B4B] shadow-xs" : "text-white/80 hover:text-white"
                }`}
              >
                <UserOutlined style={{ fontSize: 10 }} />
                My Data
              </button>
              <button
                onClick={() => setViewMode("team")}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  viewMode === "team" ? "bg-white text-[#1E1B4B] shadow-xs" : "text-white/80 hover:text-white"
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

      {/* Stat Card Design System (Home Page Zoho Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 my-2.5">
        {/* Card 1: Total Claimed */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "all"
              ? "border-accent-600 ring-2 ring-accent-500/40 bg-accent-50/20"
              : "border-[#4f4f4f]/30 hover:border-accent-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("all");
            setSelectedStatus("all");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 font-sans group-hover:text-ink-700 transition-colors truncate">
              TOTAL CLAIMED
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 shrink-0">
              <FileExcelOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-ink-900 leading-tight truncate">
              {(totalAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block font-mono truncate">
              {count} Claims Logged
            </span>
          </div>
        </div>

        {/* Card 2: Avg Expense Per Engineer (Replaced Approved) */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "avg_engineer"
              ? "border-emerald-600 ring-2 ring-emerald-500/40 bg-emerald-50/20"
              : "border-[#4f4f4f]/30 hover:border-emerald-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("avg_engineer");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 font-sans truncate">
              AVG / ENGINEER
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <TeamOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-emerald-800 leading-tight truncate">
              {(avgExpensePerEngineer || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium leading-none mt-0.5 block font-mono truncate">
              {userWiseData.length} Active Engineers
            </span>
          </div>
        </div>

        {/* Card 3: Total Asset Tagging */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "tagging"
              ? "border-blue-600 ring-2 ring-blue-500/40 bg-blue-50/20"
              : "border-[#4f4f4f]/30 hover:border-blue-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("tagging");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-800 font-sans truncate">
              ASSET TAGGING
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
              <TagOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-blue-900 leading-tight truncate">
              {activityStats.assetTaggingCount} <span className="text-[10px] font-sans text-ink-500 font-normal">Units</span>
            </div>
            <span className="text-[10px] text-blue-700 font-medium leading-none mt-0.5 block font-mono truncate">
              ₹{(activityStats.assetTaggingValue || 0).toLocaleString("en-IN")} Value
            </span>
          </div>
        </div>

        {/* Card 4: Total Calibration */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "calibration"
              ? "border-amber-600 ring-2 ring-amber-500/40 bg-amber-50/20"
              : "border-[#4f4f4f]/30 hover:border-amber-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("calibration");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 font-sans truncate">
              CALIBRATION
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <ExperimentOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-amber-800 leading-tight truncate">
              {activityStats.calibrationCount} <span className="text-[10px] font-sans text-ink-500 font-normal">Units</span>
            </div>
            <span className="text-[10px] text-amber-700 font-medium leading-none mt-0.5 block font-mono truncate">
              Calibration Done
            </span>
          </div>
        </div>

        {/* Card 5: Total PMS */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "pms"
              ? "border-purple-600 ring-2 ring-purple-500/40 bg-purple-50/20"
              : "border-[#4f4f4f]/30 hover:border-purple-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("pms");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-800 font-sans truncate">
              TOTAL PMS
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
              <ToolOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-purple-900 leading-tight truncate">
              {activityStats.pmsCount} <span className="text-[10px] font-sans text-ink-500 font-normal">Machines</span>
            </div>
            <span className="text-[10px] text-purple-700 font-medium leading-none mt-0.5 block font-mono truncate">
              PMS Serviced
            </span>
          </div>
        </div>

        {/* Card 6: Total Asset Mobilised */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "mobilised"
              ? "border-teal-600 ring-2 ring-teal-500/40 bg-teal-50/20"
              : "border-[#4f4f4f]/30 hover:border-teal-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("mobilised");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-teal-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-teal-800 font-sans truncate">
              ASSET MOBILISED
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
              <SwapOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-teal-900 leading-tight truncate">
              {activityStats.mobiliseCount} <span className="text-[10px] font-sans text-ink-500 font-normal">Units</span>
            </div>
            <span className="text-[10px] text-teal-700 font-medium leading-none mt-0.5 block font-mono truncate">
              Mobilised Assets
            </span>
          </div>
        </div>

        {/* Card 7: Calls Done */}
        <div
          className={`group bg-white rounded-[4px] border p-2.5 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs ${
            selectedKpi === "calls"
              ? "border-indigo-600 ring-2 ring-indigo-500/40 bg-indigo-50/20"
              : "border-[#4f4f4f]/30 hover:border-indigo-600 hover:shadow-sm"
          }`}
          onClick={() => {
            setSelectedKpi("calls");
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-800 font-sans truncate">
              CALLS DONE
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
              <RocketOutlined style={{ fontSize: 10 }} />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold font-mono text-indigo-900 leading-tight truncate">
              {activityStats.callsCompleted} / {activityStats.callsAssigned}
            </div>
            <span className="text-[10px] text-indigo-700 font-medium leading-none mt-0.5 block font-mono truncate">
              {activityStats.callsAssigned > 0 ? Math.round((activityStats.callsCompleted / activityStats.callsAssigned) * 100) : 100}% Resolved
            </span>
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <WalletOutlined style={{ fontSize: 13 }} />
                  EMPLOYEE EXPENSES
                </span>
                {userWiseData.length > 0 && (
                  <span className="text-[10px] font-mono font-bold text-white/80 bg-white/10 px-2 py-0.5 rounded-[3px]">
                    {userWiseData.length} Engineers
                  </span>
                )}
              </div>
              <div className="p-3" style={{ height: 290 }}>
                {userWiseData.length > 0 ? (
                  <SaaSHorizontalBarChart
                    data={userWiseData}
                    valueKey="amount"
                    nameKey="name"
                    height={266}
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
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

          {/* Row 6: PMS Interval Breakdown (3M/6M/12M) & District-wise Calibration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* PMS Interval Breakdown (col-span-6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <ToolOutlined style={{ fontSize: 13 }} />
                  PMS SERVICE INTERVALS (3M / 6M / 12M)
                </span>
                <span className="text-[10px] font-mono font-bold text-white/80 bg-white/10 px-2 py-0.5 rounded-[3px]">
                  {activityStats.pmsCount} Machines Total
                </span>
              </div>
              <div className="p-3" style={{ height: 310 }}>
                {pmsIntervalData.some(d => d.count > 0) ? (
                  <div className="h-full flex flex-col justify-between">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {pmsIntervalData.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/60 p-2 text-center rounded-[3px]">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans truncate">{item.name}</span>
                          <span className="text-sm font-bold font-mono text-ink-900 leading-tight block mt-0.5">{item.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <SaaSBarChart
                        data={pmsIntervalData}
                        valueKey="count"
                        nameKey="name"
                        height={205}
                        isCurrency={false}
                        showLineOverlay={false}
                        valueFormatter={(v) => `${v} PMS`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No PMS records logged
                  </div>
                )}
              </div>
            </div>

            {/* District-wise Calibration Breakdown (col-span-6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#1E1B4B] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <ExperimentOutlined style={{ fontSize: 13 }} />
                  DISTRICT-WISE CALIBRATIONS
                </span>
                <span className="text-[10px] font-mono font-bold text-white/80 bg-white/10 px-2 py-0.5 rounded-[3px]">
                  {activityStats.calibrationCount} Calibrations Total
                </span>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar" style={{ height: 310 }}>
                {districtWiseCalibrationData.length > 0 ? (
                  <SaaSHorizontalBarChart
                    data={districtWiseCalibrationData}
                    valueKey="count"
                    nameKey="name"
                    height={286}
                    isCurrency={false}
                    valueFormatter={(v) => `${v} Units`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No calibration data recorded
                  </div>
                )}
              </div>
            </div>
          </div>
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
