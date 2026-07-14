import { useEffect, useState, useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import Loader from "../components/common/Loader";


const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AnalysisPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    const roleLower = role.trim().toLowerCase();
    if (["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(roleLower) || allowed.includes("approval")) {
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
  const isReviewer = allowedWindows.includes("approval") || ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes((user?.role || "").trim().toLowerCase());

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const uId = currentUser?.user_id || "";
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const monthQueryParam = `${selectedYear}-${monthStr}`;
    
    const fetchData = async () => {
      const cacheKeyMy = `cache_my_expenses_${uId}_${monthQueryParam}`;
      const cacheKeyTeam = `cache_team_expenses_${uId}_${monthQueryParam}`;
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
        if (selectedZone === "all" || zone.toLowerCase() === selectedZone.toLowerCase()) {
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
        if (selectedZone === "all" || zone.toLowerCase() === selectedZone.toLowerCase()) {
          districts.add(dist);
        }
      }
    });

    return {
      districts: Array.from(districts),
      engineers: Array.from(engineers)
    };
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedDistrict, selectedEngineer, selectedZone]);

  const uniqueZones = useMemo(() => {
    const source = viewMode === "team" && isReviewer ? teamExpenses : myExpenses;
    const monthlyList = filterByMonth(source);
    return Array.from(
      new Set(
        monthlyList
          .filter((e): e is any => !!e && !!e.zone)
          .map(e => String(e.zone).trim())
      )
    ).sort();
  }, [viewMode, teamExpenses, myExpenses, selectedMonth, selectedYear]);

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
          return zone.toLowerCase() === selectedZone.toLowerCase();
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
    let mobiliseCount = 0;

    activeExpenses.forEach(e => {
      callsAssigned += Number(e.calls_assigned || 0);
      callsCompleted += Number(e.calls_completed || 0);
      pmsCount += Number(e.pms_count || 0);
      calibrationCount += Number(e.calibration_count || 0);
      assetTaggingCount += Number(e.asset_tagging || 0);
      mobiliseCount += Number(e.mobilise_asset_count || 0);
    });

    return {
      callsAssigned,
      callsCompleted,
      pmsCount,
      calibrationCount,
      assetTaggingCount,
      mobiliseCount
    };
  }, [activeExpenses]);

  const activityChartData = useMemo(() => {
    return [
      { name: "Calls Assigned", count: activityStats.callsAssigned },
      { name: "Calls Done", count: activityStats.callsCompleted },
      { name: "PMS Done", count: activityStats.pmsCount },
      { name: "Calibration Done", count: activityStats.calibrationCount },
      { name: "Asset Tagging", count: activityStats.assetTaggingCount },
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

  // D. Last 5 Days (date-wise spend)
  const last5DaysData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      const rawDate = e.date || e.itinerary;
      if (!rawDate) return;
      try {
        const match = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          const lbl = `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
          map[lbl] = (map[lbl] || 0) + (e.amount || 0);
        }
      } catch (ex) {}
    });
    return Object.entries(map)
      .map(([date, amount]) => ({ date, amount }))
      .slice(-5);
  }, [activeExpenses]);

  // E. Zone-wise (from user.zone database field)
  const zoneWiseData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      // Robust mapping: check e.zone first, then user's zone fallback
      let z = e.zone || user?.zone || "Bikaner";
      if (z.toLowerCase() === "all" || !z) {
        z = "Bikaner";
      }
      map[z] = (map[z] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [activeExpenses, user]);

  // F. Category-wise (travel mode breakdown)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    activeExpenses.forEach(e => {
      const mode = e.travel_mode || e.category || "Other";
      map[mode] = (map[mode] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [activeExpenses]);

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
      <div className="py-20">
        <Loader message="Loading analysis dashboard..." />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4 text-gray-800 p-3 pb-36" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Page Header */}
        <div className="flex justify-between items-center pb-1">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">Expense Analytics</h2>
            <p className="text-gray-500 text-[9px]">Mobile Dashboard & Insights</p>
          </div>
          
          {isReviewer && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={downloadCSV}
                className="px-2 py-1 text-[9px] font-black uppercase rounded border border-green-300 bg-green-50 text-green-700 cursor-pointer shadow-xs flex items-center justify-center gap-1"
                title="Download CSV Report"
              >
                <i className="fas fa-file-excel"></i> CSV
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "my" ? "team" : "my")}
                className="px-2 py-1 text-[9px] font-black uppercase rounded border border-[#a5d8e8] bg-[#a5d8e8]/10 text-slate-700 cursor-pointer shadow-xs"
              >
                {viewMode === "my" ? "Team" : "Self"}
              </button>
            </div>
          )}
        </div>

        {/* Filters — all in one compact row */}
        <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-xs">
          <div className="grid grid-cols-3 gap-1.5 w-full">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-black bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
            >
              {months.map((m, i) => (
                <option key={m} value={i}>{m.slice(0, 3)}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-black bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-black bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {viewMode === "team" && isReviewer && (
            <div className="space-y-1.5 mt-1.5">
              {user?.role === "Admin" && (
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-bold bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
                >
                  <option value="all">All Zones</option>
                  {uniqueZones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-bold bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
                >
                  <option value="all">All Districts</option>
                  {filterOptions.districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={selectedEngineer}
                  onChange={(e) => setSelectedEngineer(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-1.5 py-1 text-[9px] font-bold bg-white text-gray-800 focus:outline-none focus:border-[#a5d8e8]"
                >
                  <option value="all">All Engineers</option>
                  {filterOptions.engineers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        {count === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <span className="text-xs font-bold block mb-1">No claims in this selection</span>
            <span className="text-[10px]">Please update the month/year filter.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs mb-1">₹</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">Total Spend</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">₹{totalAmount.toLocaleString()}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs mb-1">#</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">Claims</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">{count}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xs mb-1">Avg</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">Avg Claim</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">₹{avgValue.toLocaleString()}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs mb-1">☎</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">Calls Done</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">{activityStats.callsCompleted}/{activityStats.callsAssigned}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-black text-xs mb-1">PMS</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">PMS Done</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">{activityStats.pmsCount}</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center text-center shadow-xs">
                <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs mb-1">Tag</div>
                <span className="text-[7px] uppercase tracking-wider text-gray-400 block">Tag+Calib</span>
                <span className="text-[10px] font-black font-mono leading-none block mt-0.5">{activityStats.assetTaggingCount + activityStats.calibrationCount}</span>
              </div>
            </div>

            {/* Breakdown Lists */}
            <div className="space-y-3">
              {/* Category Wise spend */}
              <div className="bg-white border border-gray-200 rounded p-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 mb-2 border-b border-gray-100 pb-1">Spend by Travel Mode</h3>
                <div className="space-y-2">
                  {categoryData.slice(0, 5).map((cat, i) => {
                    const pct = totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-700">{cat.name}</span>
                          <span className="font-mono text-gray-900">₹{cat.amount.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-150 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Districts */}
              <div className="bg-white border border-gray-200 rounded p-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 mb-2 border-b border-gray-100 pb-1">Top Districts</h3>
                <div className="space-y-2">
                  {districtWiseData.map((d, i) => {
                    const pct = totalAmount > 0 ? Math.round((d.amount / totalAmount) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-700">{d.name}</span>
                          <span className="font-mono text-gray-900">₹{d.amount.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-150 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Spenders (only in Team mode) */}
              {viewMode === "team" && userWiseData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded p-3">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 mb-2 border-b border-gray-100 pb-1">Top Spenders</h3>
                  <div className="space-y-2">
                    {userWiseData.map((usr, i) => {
                      const pct = totalAmount > 0 ? Math.round((usr.amount / totalAmount) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-gray-700 truncate max-w-[120px]">{usr.name}</span>
                            <span className="font-mono text-gray-900">₹{usr.amount.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-150 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-purple-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 text-gray-800 p-4 lg:p-6 pb-40 lg:pb-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        .custom-desktop-filters {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
          background-color: #ffffff !important;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05) !important;
        }
        .custom-desktop-filters select {
          width: auto !important;
          min-width: 110px !important;
          max-width: 180px !important;
          min-height: 28px !important;
          height: 28px !important;
          padding: 2px 8px !important;
          font-size: 11px !important;
          border-radius: 6px !important;
          border: 1px solid #cbd5e1 !important;
          display: inline-block !important;
          background-color: #ffffff !important;
          color: #1e293b !important;
        }
        .custom-desktop-filters .date-picker-wrapper {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 6px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          padding: 2px 8px !important;
          min-height: 28px !important;
          height: 28px !important;
          background-color: #ffffff !important;
          box-sizing: border-box !important;
        }
        .custom-desktop-filters .custom-date-input {
          width: 90px !important;
          min-height: 20px !important;
          height: 20px !important;
          padding: 0 !important;
          display: inline-block !important;
          border: 0 !important;
          outline: none !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          background-color: transparent !important;
        }
      `}</style>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Expense Analysis</h2>
          <p className="text-gray-500 text-[10px]">Real-time expense data visualization & insights</p>
        </div>

        {/* View Mode & Download Actions */}
        {isReviewer && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-600 rounded bg-green-50 hover:bg-green-100 text-green-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-sm border-0"
              title="Download filtered analysis data as CSV"
            >
              <i className="fas fa-file-excel text-sm"></i> Export CSV
            </button>
            <div className="flex border border-gray-300 rounded overflow-hidden text-[11px] bg-white shadow-sm">
              <button
                onClick={() => setViewMode("my")}
                className={`px-3 py-1.5 flex items-center gap-1 font-semibold transition-colors border-0 cursor-pointer ${
                  viewMode === "my" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <i className="fas fa-user text-xs"></i> My Data
              </button>
              <button
                onClick={() => setViewMode("team")}
                className={`px-3 py-1.5 flex items-center gap-1 font-semibold transition-colors border-0 cursor-pointer ${
                  viewMode === "team" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <i className="fas fa-users text-xs"></i> Team Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Compact Filter Panel Bar */}
      <div className="card-lte p-2 custom-desktop-filters">
        <div className="flex items-center gap-1 text-gray-400 font-semibold mr-1 shrink-0">
          <i className="fas fa-filter text-[10px] uppercase tracking-wider"></i>
          <span className="text-[10px] uppercase tracking-wider">Filters:</span>
        </div>
        
        {/* Team Specific Filters */}
        {viewMode === "team" && isReviewer && (
          <>
            {user?.role === "Admin" && (
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Zones</option>
                {uniqueZones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            )}

            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Districts</option>
              {filterOptions.districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Engineers</option>
              {filterOptions.engineers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        )}

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          disabled={!!startDate || !!endDate}
          className={`border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500 ${
            (!!startDate || !!endDate) ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
          }`}
        >
          {months.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          disabled={!!startDate || !!endDate}
          className={`border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500 ${
            (!!startDate || !!endDate) ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
          }`}
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-[11px] bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Date Range Picker */}
        <div className="date-picker-wrapper">
          <span className="text-[9px] text-gray-400 font-bold uppercase">From:</span>
          <input
            type="date"
            value={startDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setStartDate(e.target.value)}
            className="custom-date-input"
          />
          <span className="text-[9px] text-gray-400 font-bold uppercase">To:</span>
          <input
            type="date"
            value={endDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setEndDate(e.target.value)}
            className="custom-date-input"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded bg-transparent border-0 cursor-pointer flex items-center justify-center"
              title="Clear Dates"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex overflow-x-auto pb-1.5 lg:grid lg:grid-cols-7 gap-3 w-full scrollbar-none">
        {/* Card 1: Total Claims */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#007bff]">
            <i className="fas fa-file-excel text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Total Claims</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{count}</span>
          </div>
        </div>

        {/* Card 2: Total Amount */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#28a745]">
            <i className="fas fa-rupee-sign text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Total Amount</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 3: Average Claim */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#ffc107]">
            <i className="fas fa-chart-line text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Average Claim</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">₹{avgValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Calls Done / Assigned */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#605ca8]">
            <i className="fas fa-phone text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Calls Done / Assigned</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{activityStats.callsCompleted} / {activityStats.callsAssigned}</span>
          </div>
        </div>

        {/* Card 5: PMS Completed */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#20c997]">
            <i className="fas fa-shield-alt text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">PMS Completed</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{activityStats.pmsCount}</span>
          </div>
        </div>

        {/* Card 6: Tag & Calib Done */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#17a2b8]">
            <i className="fas fa-chart-line text-white text-sm"></i>
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Tag & Calib Done</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{activityStats.assetTaggingCount + activityStats.calibrationCount}</span>
          </div>
        </div>

        {/* Card 7: Scope */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#6f42c1]">
            {viewMode === "team" ? <i className="fas fa-users text-white text-sm"></i> : <i className="fas fa-user text-white text-sm"></i>}
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Scope</span>
            <span className="text-xs font-bold text-gray-800 block truncate mt-0.5" title={viewMode === "team" ? "Team" : "My Data"}>{viewMode === "team" ? "Team" : "My Data"}</span>
          </div>
        </div>
      </div>

      {/* No Data State */}
      {count === 0 && (
        <div className="card-lte p-10 text-center bg-white shadow-sm">
          <i className="fas fa-chart-bar fa-2x text-gray-300 mx-auto mb-3 block"></i>
          <p className="text-sm font-bold text-gray-500">No expense data found for {months[selectedMonth]} {selectedYear}</p>
          <p className="text-xs text-gray-400 mt-1">Try selecting a different month or year from the filter above</p>
        </div>
      )}

      {count > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Chart 1: Top Spenders (User-wise) */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Top Spenders — User Wise Breakdown
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Highest claim amounts by employee</p>
            </div>
              <div className="p-4" style={{ height: 280 }}>
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
                      grid: {
                        line: {
                          stroke: '#f1f5f9',
                          strokeWidth: 1
                        }
                      },
                      axis: {
                        ticks: {
                          text: {
                            fontSize: 8,
                            fontWeight: 'bold',
                            fill: '#64748b'
                          }
                        }
                      }
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
          </div>

          {/* Chart 2: Claim Status Distribution */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Claim Status Distribution
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Approved vs Pending vs Rejected amounts</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
              {statusWiseData.length > 0 ? (
                <>
                  <div className="relative flex justify-center items-center h-full" style={{ height: "210px" }}>
                    <ResponsivePie
                      data={statusWiseData.map(d => ({
                        id: d.name,
                        label: d.name,
                        value: d.value,
                        color: d.name === "Approved" ? "#2e7d32" : d.name === "Rejected" ? "#d32f2f" : "#f57c00"
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
          </div>

          {/* Chart 3: District-wise Expenditure */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                District Wise Expenditure
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Expense distribution across districts</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
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
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0,
                    format: (v) => `₹${(v / 1000).toFixed(0)}k`
                  }}
                  theme={{
                    grid: {
                      line: {
                        stroke: '#f1f5f9',
                        strokeWidth: 1
                      }
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 8,
                          fontWeight: 'bold',
                          fill: '#64748b'
                        }
                      }
                    }
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
          </div>

          {/* Chart 4: Date-wise Expense Trend */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Date Wise Expense Trend
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Daily spending pattern for last active dates</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
              {last5DaysData.length > 0 ? (
                <ResponsiveLine
                  data={[
                    {
                      id: "Amount",
                      color: "#007bff",
                      data: last5DaysData.map(d => ({ x: d.date, y: d.amount }))
                    }
                  ]}
                  margin={{ top: 15, right: 15, bottom: 35, left: 45 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                  curve="monotoneX"
                  colors={d => d.color}
                  lineWidth={2}
                  enableArea={true}
                  areaOpacity={0.12}
                  enablePoints={false}
                  useMesh={true}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0,
                    format: (v) => `₹${(v / 1000).toFixed(0)}k`
                  }}
                  theme={{
                    grid: {
                      line: {
                        stroke: '#f1f5f9',
                        strokeWidth: 1
                      }
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 8,
                          fontWeight: 'bold',
                          fill: '#64748b'
                        }
                      }
                    }
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
          </div>

          {/* Chart 5: Zone-wise Distribution */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Zone Wise Distribution
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Expenses grouped by operational zone</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
              {zoneWiseData.length > 0 ? (
                <>
                  <div className="relative flex justify-center items-center h-full" style={{ height: "210px" }}>
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
          </div>

          {/* Chart 6: Travel Mode / Category Breakdown */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Travel Mode / Category Breakdown
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Expenditure by travel mode (Bike, Car, Auto, etc.)</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
              {categoryData.length > 0 ? (
                <ResponsiveBar
                  data={categoryData}
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
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0,
                    format: (v) => `₹${(v / 1000).toFixed(0)}k`
                  }}
                  theme={{
                    grid: {
                      line: {
                        stroke: '#f1f5f9',
                        strokeWidth: 1
                      }
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 8,
                          fontWeight: 'bold',
                          fill: '#64748b'
                        }
                      }
                    }
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
                <div className="flex items-center justify-center h-full text-gray-400 text-xs">No category data</div>
              )}
            </div>
          </div>

          {/* Chart 7: Operations Activity Metrics */}
          <div className="bg-white border border-gray-200 rounded shadow-sm lg:col-span-2">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Operations Activity Metrics
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Calls, PMS, calibrations, and asset tagging totals</p>
              </div>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
                Operational KPIs
              </span>
            </div>
            <div className="p-4" style={{ height: 320 }}>
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
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  theme={{
                    grid: {
                      line: {
                        stroke: '#f1f5f9',
                        strokeWidth: 1
                      }
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 8,
                          fontWeight: 'bold',
                          fill: '#64748b'
                        }
                      }
                    }
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
          </div>

        </div>
      )}
    </div>
  );
}
