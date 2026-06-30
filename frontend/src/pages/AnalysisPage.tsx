import { useEffect, useState, useMemo } from "react";
import { BarChart3, Filter, Users, User as UserIcon, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from "recharts";
import { expenseService } from "../services/expenseService";
import { authService } from "../services/authService";
import Loader from "../components/common/Loader";

// AdminLTE / Bootstrap color palette
const COLORS = ["#007bff", "#28a745", "#ffc107", "#dc3545", "#17a2b8", "#6f42c1", "#fd7e14", "#20c997"];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 shadow-lg rounded p-2 text-xs">
          <p className="font-bold text-gray-800">{label || payload[0].name}</p>
          <p className="text-blue-600 font-mono font-bold">₹{payload[0].value?.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  console.log("AnalysisPage activeExpenses:", activeExpenses);

  if (loading) {
    return (
      <div className="py-20">
        <Loader message="Loading analysis dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-gray-800 p-4 lg:p-6" style={{ fontFamily: "'Aptos', 'Source Sans Pro', sans-serif" }}>
      
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
              <UserIcon className="w-3 h-3" /> My Data
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={`px-3 py-1.5 flex items-center gap-1 font-semibold transition-colors border-0 cursor-pointer ${
                viewMode === "team" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Users className="w-3 h-3" /> Team Data
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Compact Filter Panel Bar */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-2 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 text-gray-400 font-semibold mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5" />
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
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
        <div className="bg-white border border-gray-200 border-t-4 border-t-blue-600 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Total Claims</p>
          <h4 className="text-xl font-extrabold text-gray-900 mt-0.5">{count}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-green-600 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Total Amount</p>
          <h4 className="text-xl font-extrabold text-gray-900 font-mono mt-0.5">₹{totalAmount.toLocaleString()}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-amber-500 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Average Claim</p>
          <h4 className="text-xl font-extrabold text-gray-900 font-mono mt-0.5">₹{avgValue.toLocaleString()}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-indigo-500 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Calls Done / Assigned</p>
          <h4 className="text-xl font-extrabold text-gray-900 mt-0.5">{activityStats.callsCompleted} / {activityStats.callsAssigned}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-emerald-500 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">PMS Completed</p>
          <h4 className="text-xl font-extrabold text-gray-900 mt-0.5">{activityStats.pmsCount}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-cyan-500 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Tag & Calib Done</p>
          <h4 className="text-xl font-extrabold text-gray-900 mt-0.5">{activityStats.assetTaggingCount + activityStats.calibrationCount}</h4>
        </div>
        <div className="bg-white border border-gray-200 border-t-4 border-t-purple-600 rounded p-3 text-center sm:text-left">
          <p className="text-[9px] font-black text-gray-450 uppercase tracking-wider">Scope</p>
          <h4 className="text-sm font-extrabold text-gray-900 truncate mt-1">{viewMode === "team" ? "Team" : "My Data"}</h4>
        </div>
      </div>

      {/* No Data State */}
      {count === 0 && (
        <div className="bg-white border border-gray-200 rounded p-10 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {userWiseData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                    <Pie
                      data={statusWiseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {statusWiseData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#28a745" : i === 1 ? "#ffc107" : "#dc3545"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {districtWiseData.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                    <Pie
                      data={zoneWiseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {zoneWiseData.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, "Count"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {activityChartData.map((_, idx) => {
                        const colors = ["#007bff", "#28a745", "#17a2b8", "#ffc107", "#6f42c1", "#e83e8c"];
                        return <Cell key={idx} fill={colors[idx % colors.length]} />;
                      })}
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
