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

  const [myExpenses, setMyExpenses] = useState<any[]>(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return [];
    const cached = localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [teamExpenses, setTeamExpenses] = useState<any[]>(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return [];
    const cached = localStorage.getItem(`cache_team_expenses_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return true;
    const hasMyCache = !!localStorage.getItem(`cache_my_expenses_${currentUser.user_id}`);
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
    
    const fetchData = async () => {
      const hasCache = uId && localStorage.getItem(`cache_my_expenses_${uId}`);
      if (!hasCache) {
        setLoading(true);
      }
      try {
        if (isReviewer) {
          const [own, team] = await Promise.all([
            expenseService.getExpenses(),
            expenseService.getTeamExpenses()
          ]);
          setMyExpenses(own || []);
          setTeamExpenses(team || []);
          if (uId) {
            localStorage.setItem(`cache_my_expenses_${uId}`, JSON.stringify(own || []));
            localStorage.setItem(`cache_team_expenses_${uId}`, JSON.stringify(team || []));
          }
        } else {
          const own = await expenseService.getExpenses();
          setMyExpenses(own || []);
          if (uId) {
            localStorage.setItem(`cache_my_expenses_${uId}`, JSON.stringify(own || []));
          }
        }
      } catch (err) {
        console.error("Error fetching analysis data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isReviewer]);

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

  return (
    <div className="space-y-5 text-gray-800 p-4 lg:p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Expense Analysis</h2>
          <p className="text-gray-500 text-[10px]">Real-time expense data visualization & insights</p>
        </div>

        {/* View Mode Toggle (only for managers) */}
        {isReviewer && (
          <div className="flex border border-gray-300 rounded overflow-hidden text-[11px] bg-white self-start sm:self-auto shadow-sm">
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
        )}
      </div>

      {/* Dedicated Compact Filter Panel Bar */}
      <div className="card-lte p-2 flex flex-wrap items-center gap-2 text-xs bg-white">
        <div className="flex items-center gap-1 text-gray-400 font-semibold mr-1 shrink-0">
          <i className="fas fa-filter text-[10px] uppercase tracking-wider"></i>
          <span className="text-[10px] uppercase tracking-wider">Filters:</span>
        </div>
        
        {/* Team Specific Filters */}
        {viewMode === "team" && isReviewer && (
          <>
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
        <div className="flex items-center gap-1.5 border border-gray-300 rounded bg-white px-2 py-0.5 flex-wrap">
          <span className="text-[9px] text-gray-400 font-bold uppercase">From:</span>
          <input
            type="date"
            value={startDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-gray-700 outline-none border-0 text-[11px] w-24 cursor-pointer focus:ring-0 p-0"
          />
          <span className="text-[9px] text-gray-400 font-bold uppercase">To:</span>
          <input
            type="date"
            value={endDate}
            min={minDateStr}
            max={maxDateStr}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-gray-700 outline-none border-0 text-[11px] w-24 cursor-pointer focus:ring-0 p-0"
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userWiseData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} vertical={true} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={16}>
                      {userWiseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                      <Pie
                        data={statusWiseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {statusWiseData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#2b7d50" : i === 1 ? "#d28b2a" : "#d83b01"} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomMoneyTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total Claims</span>
                    <span className="text-[10px] font-black text-slate-800 font-mono">
                      ₹{statusWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={districtWiseData} margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {districtWiseData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last5DaysData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007bff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#007bff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Area type="monotone" dataKey="amount" stroke="#007bff" strokeWidth={2} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
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
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                      <Pie
                        data={zoneWiseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {zoneWiseData.map((_, i) => (
                          <Cell key={i} fill={GALLERY_COLORS[i % GALLERY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomMoneyTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total Zone</span>
                    <span className="text-[10px] font-black text-slate-800 font-mono">
                      ₹{zoneWiseData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData} margin={{ bottom: 15, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomCountTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {activityChartData.map((_, idx) => (
                        <Cell key={idx} fill={GALLERY_COLORS[idx % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
