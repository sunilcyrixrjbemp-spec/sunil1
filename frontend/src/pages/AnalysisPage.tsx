import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie } from "recharts";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import Loader from "../components/common/Loader";


const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CustomMoneyTooltip = ({ active, payload }: any) => {
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

const CustomCountTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none">
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Count:
          </span>
          <span className="font-mono font-bold text-white">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

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
  });
  const [viewMode, setViewMode] = useState<"my" | "team">(() => {
    const saved = localStorage.getItem("analysis_viewMode");
    return (saved === "my" || saved === "team") ? saved : "my";
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
    localStorage.setItem("analysis_startDate", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("analysis_endDate", endDate);
  }, [endDate]);

  const user = authService.getCurrentUser();
  const userRole = user?.role || "Engineer";
  const allowedWindows = (user?.allowed_windows || "").split(",").map((w: string) => w.trim());
  const isReviewer = userRole === "Admin" || allowedWindows.includes("approval");

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
    
    const districts = new Set<string>();
    const engineers = new Set<string>();
    
    monthlyList.forEach(e => {
      const dist = e.district || e.submitter_district || e.home_district || "Ganganagar";
      const name = e.submitter_name || "Self";
      districts.add(dist);
      engineers.add(name);
    });

    return {
      districts: Array.from(districts),
      engineers: Array.from(engineers)
    };
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear]);

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

    // 3. Filter by district & engineer (team mode only)
    if (viewMode === "team") {
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
  }, [viewMode, myExpenses, teamExpenses, selectedMonth, selectedYear, selectedDistrict, selectedEngineer, selectedStatus, startDate, endDate]);

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
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "my" ? "team" : "my")}
              className="px-2.5 py-1 text-[9px] font-black uppercase rounded border border-[#a5d8e8] bg-[#a5d8e8]/10 text-slate-700 cursor-pointer shadow-xs"
            >
              {viewMode === "my" ? "View Team" : "View Self"}
            </button>
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
            <div className="flex gap-1.5 mt-1.5">
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
    <div className="space-y-6 text-slate-100 p-4 lg:p-8 min-h-screen bg-slate-950 pb-40 lg:pb-12" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        .custom-chart-card {
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .custom-chart-card:hover {
          border-color: rgba(99, 102, 241, 0.35) !important;
          box-shadow: 0 10px 30px -5px rgba(99, 102, 241, 0.05);
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl lg:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 uppercase tracking-wider">
            Expense Analytics
          </h2>
          <p className="text-slate-400 text-xs mt-1">Real-time expense data visualization & operational insights</p>
        </div>

        {/* View Mode Toggle */}
        {isReviewer && (
          <div className="flex border border-slate-800 rounded-xl overflow-hidden text-xs bg-slate-900/80 p-1 shadow-lg shadow-black/20 backdrop-blur-md self-start sm:self-auto">
            <button
              onClick={() => setViewMode("my")}
              className={`px-4 py-2 flex items-center gap-2 font-bold rounded-lg transition-all border-0 cursor-pointer ${
                viewMode === "my" 
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20" 
                  : "bg-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <i className="fas fa-user text-xs"></i> My Data
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={`px-4 py-2 flex items-center gap-2 font-bold rounded-lg transition-all border-0 cursor-pointer ${
                viewMode === "team" 
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20" 
                  : "bg-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <i className="fas fa-users text-xs"></i> Team Data
            </button>
          </div>
        )}
      </div>

      {/* Glass Filter Panel */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs shadow-xl shadow-black/10">
        <div className="flex items-center gap-2 text-indigo-400 font-extrabold mr-2 shrink-0">
          <i className="fas fa-filter text-xs"></i>
          <span className="text-[10px] uppercase tracking-widest">Filters</span>
        </div>
        
        {viewMode === "team" && isReviewer && (
          <>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="!min-h-0 !h-9 !py-1 !w-40 !bg-slate-900 !text-slate-200 border !border-slate-800/80 rounded-xl px-3 text-xs cursor-pointer focus:outline-none focus:border-indigo-500 transition-all font-semibold"
            >
              <option value="all">All Districts</option>
              {filterOptions.districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="!min-h-0 !h-9 !py-1 !w-44 !bg-slate-900 !text-slate-200 border !border-slate-800/80 rounded-xl px-3 text-xs cursor-pointer focus:outline-none focus:border-indigo-500 transition-all font-semibold"
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
          className={`!min-h-0 !h-9 !py-1 !w-32 !bg-slate-900 !text-slate-200 border !border-slate-800/80 rounded-xl px-3 text-xs cursor-pointer focus:outline-none focus:border-indigo-500 transition-all font-semibold ${
            (!!startDate || !!endDate) ? "opacity-40 cursor-not-allowed" : ""
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
          className={`!min-h-0 !h-9 !py-1 !w-24 !bg-slate-900 !text-slate-200 border !border-slate-800/80 rounded-xl px-3 text-xs cursor-pointer focus:outline-none focus:border-indigo-500 transition-all font-semibold ${
            (!!startDate || !!endDate) ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="!min-h-0 !h-9 !py-1 !w-36 !bg-slate-900 !text-slate-200 border !border-slate-800/80 rounded-xl px-3 text-xs cursor-pointer focus:outline-none focus:border-indigo-500 transition-all font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 border border-slate-800 rounded-xl bg-slate-900 px-3 py-1.5 flex-wrap shrink-0">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase">From:</span>
          <input
            type="date"
            value={startDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setStartDate(e.target.value)}
            className="!min-h-0 !h-6 !py-0 !w-28 !bg-transparent !text-slate-200 outline-none border-0 text-xs cursor-pointer focus:ring-0 p-0 font-semibold"
          />
          <span className="text-[10px] text-slate-400 font-extrabold uppercase">To:</span>
          <input
            type="date"
            value={endDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setEndDate(e.target.value)}
            className="!min-h-0 !h-6 !py-0 !w-28 !bg-transparent !text-slate-200 outline-none border-0 text-xs cursor-pointer focus:ring-0 p-0 font-semibold"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="p-1 text-slate-400 hover:text-rose-500 rounded bg-transparent border-0 cursor-pointer flex items-center justify-center transition-colors"
              title="Clear Dates"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="flex overflow-x-auto pb-2 lg:grid lg:grid-cols-7 gap-4 w-full scrollbar-none">
        {/* Card 1: Total Claims */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-indigo-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-file-excel text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Claims</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">{count}</span>
          </div>
        </div>

        {/* Card 2: Total Amount */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-emerald-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-rupee-sign text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Spend</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">₹{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 3: Average Claim */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-amber-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-chart-line text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Avg Claim</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">₹{avgValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Calls Completed */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-purple-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-phone text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Calls Closed</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">{activityStats.callsCompleted} / {activityStats.callsAssigned}</span>
          </div>
        </div>

        {/* Card 5: PMS Completed */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-teal-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-shield-alt text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">PMS Done</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">{activityStats.pmsCount}</span>
          </div>
        </div>

        {/* Card 6: Tag & Calib */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-cyan-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-qrcode text-lg"></i>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Tag & Calib</span>
            <span className="text-xl font-extrabold text-white font-mono block mt-0.5">{activityStats.assetTaggingCount + activityStats.calibrationCount}</span>
          </div>
        </div>

        {/* Card 7: Scope */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 min-w-[150px] shadow-lg hover:border-pink-500/40 transition-all group duration-300">
          <div className="w-11 h-11 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            {viewMode === "team" ? <i className="fas fa-users text-lg"></i> : <i className="fas fa-user text-lg"></i>}
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Scope</span>
            <span className="text-xs font-black text-white block mt-1 truncate" title={viewMode === "team" ? "Team" : "My Data"}>
              {viewMode === "team" ? "Team" : "My Data"}
            </span>
          </div>
        </div>
      </div>

      {/* No Data State */}
      {count === 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-16 text-center shadow-xl">
          <i className="fas fa-chart-bar fa-3x text-slate-700 mx-auto mb-4 block animate-pulse"></i>
          <p className="text-base font-bold text-slate-400">No expense data found for {months[selectedMonth]} {selectedYear}</p>
          <p className="text-xs text-slate-500 mt-1.5">Try selecting a different month, year, or adjust filters above</p>
        </div>
      )}

      {/* Charts Grid */}
      {count > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 1: Top Spenders */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Top Spenders — User Wise
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Highest claim amounts by engineer</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {userWiseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userWiseData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} vertical={true} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} width={90} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={16}>
                      {userWiseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 2: Claim Status Distribution */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Claim Status Distribution
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Approved, Pending, and Rejected totals</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {statusWiseData.length > 0 ? (
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                      <Pie
                        data={statusWiseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={3}
                      >
                        {statusWiseData.map((d) => {
                          const fill = d.name === "Approved" ? "#10b981" : d.name === "Rejected" ? "#f43f5e" : "#f59e0b";
                          return <Cell key={d.name} fill={fill} />;
                        })}
                      </Pie>
                      <Tooltip content={<CustomMoneyTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-slate-450 font-black uppercase tracking-widest">Total</span>
                    <span className="text-[11px] font-black text-white font-mono mt-0.5">
                      ₹{statusWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 3: District Wise Expenditure */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  District Wise Spend
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Expense distribution across operational districts</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {districtWiseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={districtWiseData} margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {districtWiseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 4: Date-wise Expense Trend */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Daily Spending Pattern
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Spend trends across last active dates</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {last5DaysData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last5DaysData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 5: Zone wise Distribution */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Zone Distribution
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Expenditure breakdown by operations zone</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {zoneWiseData.length > 0 ? (
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                      <Pie
                        data={zoneWiseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={3}
                      >
                        {zoneWiseData.map((_, i) => (
                          <Cell key={i} fill={GALLERY_COLORS[i % GALLERY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomMoneyTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-slate-450 font-black uppercase tracking-widest">Zones</span>
                    <span className="text-[11px] font-black text-white font-mono mt-0.5">
                      ₹{zoneWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 6: Category Breakdown */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Travel Mode Breakdown
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Expenditure by travel categories</p>
              </div>
            </div>
            <div className="p-5" style={{ height: 290 }}>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">No data available</div>
              )}
            </div>
          </div>

          {/* Chart 7: Operations Activity Metrics */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden custom-chart-card lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Operations Activity Metrics
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Calls closed, PMS done, calibrations, and asset tagging totals</p>
              </div>
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-3 py-1 rounded-lg">
                Operational KPIs
              </span>
            </div>
            <div className="p-5" style={{ height: 320 }}>
              {activityChartData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData} margin={{ bottom: 15, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} allowDecimals={false} />
                    <Tooltip content={<CustomCountTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {activityChartData.map((_, idx) => (
                        <Cell key={idx} fill={GALLERY_COLORS[idx % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs font-bold">
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
