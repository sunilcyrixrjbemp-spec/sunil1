import { useEffect, useState, useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import { adminService } from "../services/adminService";
import Loader from "../components/common/Loader";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Radio,
  Progress,
  Segmented
} from "antd";
import {
  FilterOutlined,
  CloseOutlined,
  FileExcelOutlined,
  DashboardOutlined,
  FundOutlined,
  CheckOutlined,
  InfoCircleOutlined,
  TagOutlined,
  AimOutlined,
  RocketOutlined
} from "@ant-design/icons";
import { hasFullAccess } from "../utils/constants";

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

const GALLERY_COLORS = ["#4f46e5", "#8b5cf6", "#10b981", "#06b6d4", "#f59e0b", "#f43f5e", "#0ea5e9", "#14b8a6"];

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
    const key = `cache_my_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const cached = localStorage.getItem(key);
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
    const key = `cache_team_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return true;
    const savedM = localStorage.getItem("analysis_selectedMonth");
    const savedY = localStorage.getItem("analysis_selectedYear");
    const m = savedM !== null ? Number(savedM) : new Date().getMonth();
    const y = savedY !== null ? Number(savedY) : new Date().getFullYear();
    const monthStr = String(m + 1).padStart(2, "0");
    const key = `cache_my_expenses_${currentUser.user_id}_${y}-${monthStr}`;
    const hasMyCache = !!localStorage.getItem(key);
    return !hasMyCache;
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
  const [selectedZone, setSelectedZone] = useState<string>(() => {
    return localStorage.getItem("analysis_selectedZone") || "all";
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

  const [usersMap, setUsersMap] = useState<Record<string, any>>({});

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
      const cacheKeyMy = `cache_v3_my_expenses_${uId}_${monthQueryParam}`;
      const cacheKeyTeam = `cache_v3_team_expenses_${uId}_${monthQueryParam}`;
      const hasCache = uId && localStorage.getItem(cacheKeyMy);
      if (!hasCache) {
        setLoading(true);
      }
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
    const source = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const monthlyList = filterByMonth(source);
    
    // 1. Filter engineers based on selectedDistrict and selectedZone
    const engineers = new Set<string>();
    monthlyList.forEach(e => {
      const dist = e.district || e.submitter_district || e.home_district || "Ganganagar";
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
      const dist = e.district || e.submitter_district || e.home_district || "Ganganagar";
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
    const source = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    
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
          const dist = e.district || e.submitter_district || e.home_district || "Ganganagar";
          return dist.toLowerCase() === selectedDistrict.toLowerCase();
        });
      }
      if (selectedEngineer !== "all") {
        list = list.filter(e => {
          const name = e.submitter_name || "Self";
          return name.toLowerCase() === selectedEngineer.toLowerCase();
        });
      }
    }

    return list;
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedDistrict, selectedEngineer, selectedStatus, startDate, endDate, selectedZone]);

  // Date range limits based on selected month/year
  const monthStr = String(selectedMonth + 1).padStart(2, "0");
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const minDateStr = `${selectedYear}-${monthStr}-01`;
  const maxDateStr = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

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
      callsAssigned += Number(e.calls_assigned || 0);
      callsCompleted += Number(e.calls_completed || 0);
      pmsCount += Number(e.pms_count || 0);
      calibrationCount += Number(e.calibration_count || 0);
      assetTaggingCount += Number(e.asset_tagging || 0);
      assetTaggingValue += Number(e.asset_tagging_value || e.asset_tagging_val || 0);
      mobiliseCount += Number(e.mobilise_asset_count || e.mobilise_count || 0);
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

  // B. Status-wise
  const statusWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      const s = (e.status || "Pending").toLowerCase();
      const label = s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending";
      map[label] = (map[label] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [activeExpenses]);

  // C. District-wise (Top 5)
  const districtWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      // Robust mapping: check e.district first (live backend serialized field), then submitter_district, home_district, or logged-in user district
      let dist = e.district || e.submitter_district || e.home_district || user?.district || "Ganganagar";
      if (dist.toLowerCase() === "all" || !dist) {
        dist = "Ganganagar";
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader message="Loading analysis dashboard..." />
      </div>
    );
  }  return (
    <div className="space-y-3 p-1.5 md:p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
      
      {/* Page Header Card */}
      <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/40 border border-indigo-100/70 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <DashboardOutlined className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-xs sm:text-base font-bold text-gray-800 uppercase tracking-wider leading-none m-0">
                Expense Analysis
              </h1>
              <p className="text-gray-500 text-[10px] font-medium mt-1 leading-none hidden sm:block">
                Real-time expense data visualization & insights
              </p>
            </div>
          </div>

          {/* Actions Toolbar */}
          <div className="flex items-center gap-2 justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0">
            {isReviewer && (
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as "my" | "team")}
                optionType="button"
                buttonStyle="solid"
                size="small"
                className="shadow-2xs shrink-0"
              >
                <Radio.Button value="my" className="font-bold text-[10px] uppercase">
                  My Data
                </Radio.Button>
                <Radio.Button value="team" className="font-bold text-[10px] uppercase">
                  Team Data
                </Radio.Button>
              </Radio.Group>
            )}
            <Button
              type="primary"
              size="small"
              icon={<FileExcelOutlined />}
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
              onClick={downloadCSV}
              disabled={activeExpenses.length === 0}
              className="font-bold text-[10px] uppercase flex items-center justify-center shrink-0 h-6 px-3"
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Panel Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
        <Row gutter={[8, 8]} align="middle">
          {/* Header */}
          <Col xs={24} className="flex items-center gap-1.5 text-gray-400 font-bold mb-0.5">
            <FilterOutlined style={{ fontSize: 11 }} />
            <span className="text-[9px] uppercase tracking-wider">Filters</span>
          </Col>

          {/* Dynamic selectors */}
          {viewMode === "team" && isReviewer && (
            <>
              {/* Zone Filter */}
              <Col xs={12} sm={8} md={6} lg={4}>
                <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Zone</span>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="analysis-select-input"
                >
                  <option value="all">All Zones</option>
                  {uniqueZones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </Col>

              {/* District Filter */}
              <Col xs={12} sm={8} md={6} lg={4}>
                <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">District</span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="analysis-select-input"
                >
                  <option value="all">All Districts</option>
                  {filterOptions.districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Col>

              {/* Engineer Filter */}
              <Col xs={24} sm={8} md={6} lg={4}>
                <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Engineer</span>
                <select
                  value={selectedEngineer}
                  onChange={(e) => setSelectedEngineer(e.target.value)}
                  className="analysis-select-input"
                >
                  <option value="all">All Engineers</option>
                  {filterOptions.engineers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </Col>
            </>
          )}

          {/* Month Filter */}
          <Col xs={12} sm={8} md={6} lg={3}>
            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              disabled={!!startDate || !!endDate}
              className="analysis-select-input disabled:opacity-50"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </Col>

          {/* Year Filter */}
          <Col xs={12} sm={8} md={6} lg={3}>
            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={!!startDate || !!endDate}
              className="analysis-select-input disabled:opacity-50"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Col>

          {/* Status Filter */}
          <Col xs={24} md={12} lg={6}>
            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Status</span>
            <Segmented
              block
              size="small"
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val as any)}
              options={[
                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">All</span>, value: 'all' },
                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Pending</span>, value: 'pending' },
                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Approved</span>, value: 'approved' },
                { label: <span className="text-[9px] xs:text-[10px] tracking-tight">Rejected</span>, value: 'rejected' }
              ]}
              className={`font-bold text-[10px] uppercase tracking-wider ${getSegmentedClass(selectedStatus)}`}
            />
          </Col>

          {/* Date Range Filters */}
          <Col xs={24} md={12} lg={6}>
            <span className="text-[9px] font-bold text-gray-400 uppercase block mb-0.5">Custom Date Range</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                min={minDateStr}
                max={maxDateStr}
                onChange={(e) => setStartDate(e.target.value)}
                className="analysis-date-input"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                min={minDateStr}
                max={maxDateStr}
                onChange={(e) => setEndDate(e.target.value)}
                className="analysis-date-input"
              />
              {(startDate || endDate) && (
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                />
              )}
            </div>
          </Col>
        </Row>
      </div>

      {/* Key Stats Grid */}
      <Row gutter={[12, 12]}>
        {/* Card 1: Total Claims */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3.4}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Total Claims</span>}
              value={count}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<FileExcelOutlined className="text-blue-500 mr-1.5" />}
            />
          </Card>
        </Col>

        {/* Card 2: Total Amount */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3.4}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Total Spend</span>}
              value={totalAmount}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<span className="text-emerald-500 font-bold mr-1">₹</span>}
              formatter={(val) => Number(val).toLocaleString()}
            />
          </Card>
        </Col>

        {/* Card 3: Average Claim */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3.4}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Avg Claim</span>}
              value={avgValue}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<span className="text-amber-500 font-bold mr-1">₹</span>}
              formatter={(val) => Number(val).toLocaleString()}
            />
          </Card>
        </Col>

        {/* Card 4: Calls Completed / Assigned */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3.4}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Calls Done</span>}
              value={`${activityStats.callsCompleted} / ${activityStats.callsAssigned}`}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<FundOutlined className="text-indigo-500 mr-1.5" />}
            />
          </Card>
        </Col>

        {/* Card 5: PMS Completed */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3.4}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">PMS Done</span>}
              value={activityStats.pmsCount}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<CheckOutlined className="text-teal-500 mr-1.5" />}
            />
          </Card>
        </Col>

        {/* Card 6: Asset Tagging */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Asset Tagging</span>}
              value={activityStats.assetTaggingCount}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<TagOutlined className="text-cyan-500 mr-1.5" />}
              suffix={
                <div className="text-[10px] font-extrabold text-emerald-600 mt-0.5 tracking-tight font-mono">
                  Val: ₹{activityStats.assetTaggingValue.toLocaleString('en-IN')}
                </div>
              }
            />
          </Card>
        </Col>

        {/* Card 7: Calibration */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Calibration</span>}
              value={activityStats.calibrationCount}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<AimOutlined className="text-amber-500 mr-1.5" />}
            />
          </Card>
        </Col>

        {/* Card 8: Asset Mobilised */}
        <Col xs={12} sm={8} md={6} lg={4} xl={3}>
          <Card size="small" bordered={false} className="shadow-xs border border-gray-150 rounded-xl">
            <Statistic
              title={<span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Asset Mobilised</span>}
              value={activityStats.mobiliseCount}
              valueStyle={{ fontSize: "16px", fontWeight: 800, color: "#1F2937", fontFamily: "monospace" }}
              prefix={<RocketOutlined className="text-purple-500 mr-1.5" />}
            />
          </Card>
        </Col>
      </Row>

      {/* No Data State */}
      {count === 0 && (
        <Card className="text-center p-8 border border-gray-200 rounded-xl shadow-xs">
          <InfoCircleOutlined style={{ fontSize: 32, color: "#bfbfbf", marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: "bold", fontSize: 13, color: "#595959" }}>No expense data found for {months[selectedMonth]} {selectedYear}</p>
          <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#8c8c8c" }}>Try selecting a different month or year from the filters panel above</p>
        </Card>
      )}

      {count > 0 && (
        <Row gutter={[16, 16]}>
          {/* Mobile Breakdown Progress Lists (Visible only on mobile/tablet) */}
          <Col xs={24} md={0}>
            <div className="space-y-3">
              {/* Top Districts */}
              <Card 
                size="small"
                title={<span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">Top Districts</span>}
                className="border border-gray-200 rounded-xl shadow-xs"
              >
                <div className="space-y-3">
                  {districtWiseData.map((d, i) => {
                    const pct = totalAmount > 0 ? Math.round((d.amount / totalAmount) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-700">{d.name}</span>
                          <span className="font-mono text-gray-955">₹{d.amount.toLocaleString()} ({pct}%)</span>
                        </div>
                        <Progress percent={pct} strokeColor="#10b981" size="small" showInfo={false} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Top Spenders (only in Team mode) */}
              {viewMode === "team" && userWiseData.length > 0 && (
                <Card 
                  size="small"
                  title={<span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">Top Spenders (Highest Engineers)</span>}
                  className="border border-gray-200 rounded-xl shadow-xs"
                >
                  <div className="space-y-3">
                    {userWiseData.map((usr, i) => {
                      const pct = totalAmount > 0 ? Math.round((usr.amount / totalAmount) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-gray-700 truncate max-w-[120px]">{usr.name}</span>
                            <span className="font-mono text-gray-955">₹{usr.amount.toLocaleString()} ({pct}%)</span>
                          </div>
                          <Progress percent={pct} strokeColor="#8b5cf6" size="small" showInfo={false} />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          </Col>

          {/* Desktop/Tablet Nivo Charts (Visible only on md and larger) */}
          <Col xs={0} md={24}>
            <Row gutter={[16, 16]}>
              {/* Chart 1: District-wise Expenditure (Now District Wise is first!) */}
              <Col xs={24} lg={12}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">District Wise Expenditure</span>}
                  extra={<span className="text-[10px] text-gray-400">Expense distribution across districts</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 280 }}>
                    {districtWiseData.length > 0 ? (
                      <ResponsiveBar
                        data={districtWiseData}
                        keys={["amount"]}
                        indexBy="name"
                        margin={{ top: 15, right: 15, bottom: 35, left: 45 }}
                        padding={0.35}
                        colors={GALLERY_COLORS}
                        colorBy="indexValue"
                        borderRadius={6}
                        borderWidth={0}
                        enableLabel={false}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: 0 }}
                        axisLeft={{
                          tickSize: 0,
                          tickPadding: 8,
                          tickRotation: 0,
                          format: (v) => `₹${(v / 1000).toFixed(0)}k`
                        }}
                        theme={{
                          grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                          axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
                        }}
                        tooltip={({ value, color, indexValue }) => (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                            <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{indexValue}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                Amount:
                              </span>
                              <span className="font-mono font-bold text-white">₹{value.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No district data</div>
                    )}
                  </div>
                </Card>
              </Col>

              {/* Chart 2: Top Spenders / Highest Engineers (Now second!) */}
              {viewMode === "team" && (
                <Col xs={24} lg={12}>
                  <Card 
                    size="small"
                    title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Top Spenders — User Wise Breakdown</span>}
                    extra={<span className="text-[10px] text-gray-400">Highest claim amounts by employee</span>}
                    className="shadow-sm border border-gray-200 rounded-xl"
                  >
                    <div style={{ height: 280 }}>
                      {userWiseData.length > 0 ? (
                        <ResponsiveBar
                          data={userWiseData}
                          keys={["amount"]}
                          indexBy="name"
                          layout="horizontal"
                          margin={{ top: 15, right: 15, bottom: 35, left: 90 }}
                          padding={0.35}
                          colors={GALLERY_COLORS}
                          colorBy="indexValue"
                          borderRadius={6}
                          borderWidth={0}
                          enableLabel={false}
                          axisTop={null}
                          axisRight={null}
                          axisBottom={{
                            tickSize: 0,
                            tickPadding: 8,
                            tickRotation: 0,
                            format: (v) => `₹${(v / 1000).toFixed(0)}k`
                          }}
                          axisLeft={{
                            tickSize: 0,
                            tickPadding: 8,
                            tickRotation: 0
                          }}
                          theme={{
                            grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                            axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
                          }}
                          tooltip={({ value, color, indexValue }) => (
                            <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                              <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{indexValue}</p>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-300">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                  Amount:
                                </span>
                                <span className="font-mono font-bold text-white">₹{value.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">No user data</div>
                      )}
                    </div>
                  </Card>
                </Col>
              )}

              {/* Chart 3: Full Month Date-wise Expense Trend */}
              <Col xs={24} lg={viewMode === "team" ? 12 : 24}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Date Wise Expense Trend</span>}
                  extra={<span className="text-[10px] text-gray-400">Full month daily spending trend ({months[selectedMonth]} {selectedYear})</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 280 }}>
                    {fullMonthTrendData.length > 0 ? (
                      <ResponsiveLine
                        data={[
                          {
                            id: "Amount",
                            color: "#4f46e5",
                            data: fullMonthTrendData.map(d => ({ x: d.date, y: d.amount }))
                          }
                        ]}
                        margin={{ top: 15, right: 15, bottom: 35, left: 45 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 0, max: 'auto' }}
                        curve="monotoneX"
                        colors={d => d.color}
                        lineWidth={2}
                        enableArea={true}
                        areaOpacity={0.12}
                        enablePoints={fullMonthTrendData.length <= 15}
                        pointSize={5}
                        useMesh={true}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{
                          tickSize: 0,
                          tickPadding: 8,
                          tickRotation: 0,
                          format: (val) => {
                            const str = String(val);
                            const dayNum = parseInt(str);
                            if (isNaN(dayNum)) return str;
                            // Display tick label for day 1, multiples of 5, or final day
                            if (dayNum === 1 || dayNum % 5 === 0 || dayNum >= fullMonthTrendData.length - 1) {
                              return str;
                            }
                            return "";
                          }
                        }}
                        axisLeft={{
                          tickSize: 0,
                          tickPadding: 8,
                          tickRotation: 0,
                          format: (v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`
                        }}
                        theme={{
                          grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                          axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
                        }}
                        tooltip={({ point }) => (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                            <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{String(point.data.x)}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: point.color }} />
                                Amount:
                              </span>
                              <span className="font-mono font-bold text-white">₹{(point.data.y as number).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No date data</div>
                    )}
                  </div>
                </Card>
              </Col>

              {/* Chart 4: Claim Status Distribution */}
              <Col xs={24} lg={12}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Claim Status Distribution</span>}
                  extra={<span className="text-[10px] text-gray-400">Approved vs Pending vs Rejected amounts</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 280 }}>
                    {statusWiseData.length > 0 ? (
                      <>
                        <div className="relative flex justify-center items-center h-[210px]">
                          <ResponsivePie
                            data={statusWiseData.map(d => ({
                              id: d.name,
                              label: d.name,
                              value: d.value,
                              color: d.name === "Approved" ? "#10b981" : d.name === "Rejected" ? "#ef4444" : "#f97316"
                            }))}
                            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            innerRadius={0.7}
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
                            <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">Total Claims</span>
                            <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
                              ₹{statusWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                          {statusWiseData.map((item, i) => (
                            <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.name === "Approved" ? "#2e7d32" : item.name === "Rejected" ? "#d32f2f" : "#f57c00" }} />
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No status data</div>
                    )}
                  </div>
                </Card>
              </Col>

              {/* Chart 5: Zone-wise Distribution */}
              <Col xs={24} lg={12}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Zone Wise Distribution</span>}
                  extra={<span className="text-[10px] text-gray-400">Expenses grouped by operational zone</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 280 }}>
                    {zoneWiseData.length > 0 ? (
                      <>
                        <div className="relative flex justify-center items-center h-[210px]">
                          <ResponsivePie
                            data={zoneWiseData.map((z, i) => ({
                              id: z.name,
                              label: z.name,
                              value: z.value,
                              color: GALLERY_COLORS[i % GALLERY_COLORS.length]
                            }))}
                            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            innerRadius={0.7}
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
                            <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">Total Zone</span>
                            <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
                              ₹{zoneWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                          {zoneWiseData.map((item, i) => (
                            <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GALLERY_COLORS[i % GALLERY_COLORS.length] }} />
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No zone data</div>
                    )}
                  </div>
                </Card>
              </Col>

              {/* Chart 6: Coordinator-wise Distribution (Fills 4th position in 2x2 grid) */}
              <Col xs={24} lg={12}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Coordinator Wise Distribution</span>}
                  extra={<span className="text-[10px] text-gray-400">Expenses grouped by coordinator</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 280 }}>
                    {coordinatorWiseData.length > 0 ? (
                      <>
                        <div className="relative flex justify-center items-center h-[210px]">
                          <ResponsivePie
                            data={coordinatorWiseData.map((c, i) => ({
                              id: c.name,
                              label: c.name,
                              value: c.value,
                              color: GALLERY_COLORS[(i + 2) % GALLERY_COLORS.length]
                            }))}
                            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            innerRadius={0.7}
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
                            <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">Total Coordinator</span>
                            <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
                              ₹{coordinatorWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                          {coordinatorWiseData.map((item, i) => (
                            <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GALLERY_COLORS[(i + 2) % GALLERY_COLORS.length] }} />
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs">No coordinator data</div>
                    )}
                  </div>
                </Card>
              </Col>

              {/* Chart 6: Operations Activity Metrics */}
              <Col xs={24}>
                <Card 
                  size="small"
                  title={<span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Operations Activity Metrics</span>}
                  extra={<span className="text-[10px] text-gray-400 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded uppercase">Operational KPIs</span>}
                  className="shadow-sm border border-gray-200 rounded-xl"
                >
                  <div style={{ height: 300 }}>
                    {activityChartData.some(d => d.count > 0) ? (
                      <ResponsiveBar
                        data={activityChartData}
                        keys={["count"]}
                        indexBy="name"
                        margin={{ top: 15, right: 15, bottom: 35, left: 35 }}
                        padding={0.35}
                        colors={GALLERY_COLORS}
                        colorBy="indexValue"
                        borderRadius={6}
                        borderWidth={0}
                        enableLabel={false}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: 0 }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, tickRotation: 0 }}
                        theme={{
                          grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                          axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
                        }}
                        tooltip={({ value, color, indexValue }) => (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                            <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{indexValue}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                Count:
                              </span>
                              <span className="font-mono font-bold text-white">{value}</span>
                            </div>
                          </div>
                        )}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-xs font-bold">
                        No operational activities recorded in this selection
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      )}
      {/* Extra spacer at the bottom to prevent layout elements from being cut off by the navigation bar */}
      <div className="h-32 md:h-8" />
    </div>
  );
}
