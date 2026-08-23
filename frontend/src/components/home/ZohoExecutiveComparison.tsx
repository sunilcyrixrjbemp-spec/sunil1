import React, { useState, useEffect, useMemo } from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Calendar, 
  Sparkles, 
  BarChart3, 
  LineChart, 
  Wallet, 
  Scale 
} from "lucide-react";
import { expenseService } from "../../services/expenseService";
import { swrFetch } from "../../utils/dataCache";

interface ZohoExecutiveComparisonProps {
  currentClaims: any[];
  user: any;
  isReviewerRole: boolean;
  activeTab: "my-claims" | "team-claims";
  selectMonth: string; // e.g. "2026-08"
  filterZone?: string;
  filterDistrict?: string;
  filterEmployee?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

export const ZohoExecutiveComparison: React.FC<ZohoExecutiveComparisonProps> = ({
  currentClaims = [],
  user,
  isReviewerRole,
  activeTab,
  selectMonth,
  filterZone = "all",
  filterDistrict = "all",
  filterEmployee = "all",
}) => {
  const [chartMode, setChartMode] = useState<"daily" | "category">("daily");
  const [prevRawClaims, setPrevRawClaims] = useState<any[]>(() => {
    const uId = user?.user_id || "";
    const [yStr, mStr] = (selectMonth || "2026-08").split("-");
    const currY = parseInt(yStr) || new Date().getFullYear();
    const currM = parseInt(mStr) || (new Date().getMonth() + 1);
    const prevDate = new Date(currY, currM - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const cacheKey = `cache_comp_${activeTab}_${uId}_${prevMonthStr}`;
    try {
      const stored = localStorage.getItem(cacheKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [_loadingPrev, setLoadingPrev] = useState(false);

  // Parse current and previous month labels
  const { currLabel, prevLabel, prevMonthStr } = useMemo(() => {
    const [yStr, mStr] = (selectMonth || "2026-08").split("-");
    const currY = parseInt(yStr) || new Date().getFullYear();
    const currM = parseInt(mStr) || (new Date().getMonth() + 1);
    
    const currMonthName = MONTH_NAMES[currM - 1] || "Current";
    const currLabel = `${currMonthName.slice(0, 3)} ${currY}`;

    const prevDate = new Date(currY, currM - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    const prevMonthName = MONTH_NAMES[prevM - 1] || "Previous";
    const prevLabel = `${prevMonthName.slice(0, 3)} ${prevY}`;
    const prevMonthStr = `${prevY}-${String(prevM).padStart(2, "0")}`;

    return { currLabel, prevLabel, prevMonthStr };
  }, [selectMonth]);

  // Fetch previous month claims in background with SWR cache
  useEffect(() => {
    let isMounted = true;
    const uId = user?.user_id || "";
    const cacheKey = `cache_comp_${activeTab}_${uId}_${prevMonthStr}`;

    const loadPrevData = async () => {
      setLoadingPrev(true);
      try {
        const fetcher = async () => {
          if (activeTab === "team-claims" && isReviewerRole) {
            return await expenseService.getTeamExpenses(prevMonthStr);
          } else {
            return await expenseService.getExpenses(prevMonthStr);
          }
        };

        const res = await swrFetch(cacheKey, fetcher, {
          ttl: 5 * 60 * 1000,
          onCached: (cached) => {
            if (isMounted && Array.isArray(cached)) {
              setPrevRawClaims(cached);
              setLoadingPrev(false);
            }
          }
        });

        if (isMounted && Array.isArray(res)) {
          setPrevRawClaims(res);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch (_) {}
        }
      } catch (err) {
        console.error("Failed to load previous month comparison data:", err);
      } finally {
        if (isMounted) setLoadingPrev(false);
      }
    };

    loadPrevData();
    return () => { isMounted = false; };
  }, [activeTab, isReviewerRole, prevMonthStr, user?.user_id]);

  // Filter previous month claims matching current active filters
  const filteredPrevClaims = useMemo(() => {
    return (prevRawClaims || []).filter((c: any) => {
      if (!c) return false;
      if (c.category === "Limit Request" || c.request_type === "limit") return false;

      if (filterZone !== "all") {
        const cZone = cleanZone(c.zone || "");
        if (cZone !== cleanZone(filterZone)) return false;
      }

      if (filterDistrict !== "all") {
        const cDist = c.district || c.submitter_district || c.work_location || c.city || "";
        if (cDist.toLowerCase() !== filterDistrict.toLowerCase()) return false;
      }

      if (filterEmployee !== "all") {
        const cEmp = c.user_id || c.employee_code || c.e_code || c.submitter_code || "";
        if (String(cEmp).trim().toLowerCase() !== String(filterEmployee).trim().toLowerCase()) return false;
      }

      return true;
    });
  }, [prevRawClaims, filterZone, filterDistrict, filterEmployee]);

  // Financial aggregates
  const currStats = useMemo(() => {
    const total = currentClaims.reduce((s, c) => s + Number(c.amount != null ? c.amount : (c.total_amount || 0)), 0);
    const count = currentClaims.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [currentClaims]);

  const prevStats = useMemo(() => {
    const total = filteredPrevClaims.reduce((s, c) => s + Number(c.amount != null ? c.amount : (c.total_amount || 0)), 0);
    const count = filteredPrevClaims.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, avg };
  }, [filteredPrevClaims]);

  const deltaAmount = currStats.total - prevStats.total;
  const percentageDelta = prevStats.total > 0 
    ? ((currStats.total - prevStats.total) / prevStats.total) * 100 
    : (currStats.total > 0 ? 100 : 0);
  const isGrowth = deltaAmount > 0;

  // Data Scientist Grade: Day-by-Day Comparative Run-Rate (Day 1 to 31)
  const dailyComparisonData = useMemo(() => {
    const dayMap: Record<number, { day: number; current: number; previous: number }> = {};
    for (let i = 1; i <= 31; i++) {
      dayMap[i] = { day: i, current: 0, previous: 0 };
    }

    currentClaims.forEach((c) => {
      const dStr = c.date || c.itinerary || c.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      const dayNum = !isNaN(d.getTime()) ? d.getDate() : 0;
      if (dayNum >= 1 && dayNum <= 31) {
        dayMap[dayNum].current += Number(c.amount != null ? c.amount : (c.total_amount || 0));
      }
    });

    filteredPrevClaims.forEach((c) => {
      const dStr = c.date || c.itinerary || c.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      const dayNum = !isNaN(d.getTime()) ? d.getDate() : 0;
      if (dayNum >= 1 && dayNum <= 31) {
        dayMap[dayNum].previous += Number(c.amount != null ? c.amount : (c.total_amount || 0));
      }
    });

    return Object.values(dayMap);
  }, [currentClaims, filteredPrevClaims]);

  // Data Scientist Grade: Category-wise Spend Variance
  const categoryComparisonData = useMemo(() => {
    const categories = ["Travel", "Daily Allowance", "Hotel/Stay", "Courier", "Spares", "Others"];
    const catMap: Record<string, { name: string; current: number; previous: number }> = {};
    categories.forEach(cat => {
      catMap[cat] = { name: cat, current: 0, previous: 0 };
    });

    const normalizeCat = (raw: string) => {
      const s = (raw || "").toLowerCase();
      if (s.includes("bike") || s.includes("car") || s.includes("bus") || s.includes("train") || s.includes("travel") || s.includes("auto") || s.includes("fuel")) return "Travel";
      if (s.includes("da") || s.includes("food") || s.includes("meal") || s.includes("allowance")) return "Daily Allowance";
      if (s.includes("hotel") || s.includes("stay") || s.includes("lodge") || s.includes("accommodation")) return "Hotel/Stay";
      if (s.includes("courier") || s.includes("courrier") || s.includes("postage")) return "Courier";
      if (s.includes("spare") || s.includes("part") || s.includes("purchase") || s.includes("repair")) return "Spares";
      return "Others";
    };

    currentClaims.forEach((c) => {
      const cat = normalizeCat(c.travel_mode || c.category || "");
      if (catMap[cat]) {
        catMap[cat].current += Number(c.amount != null ? c.amount : (c.total_amount || 0));
      }
    });

    filteredPrevClaims.forEach((c) => {
      const cat = normalizeCat(c.travel_mode || c.category || "");
      if (catMap[cat]) {
        catMap[cat].previous += Number(c.amount != null ? c.amount : (c.total_amount || 0));
      }
    });

    return Object.values(catMap);
  }, [currentClaims, filteredPrevClaims]);

  return (
    <div
      className="bg-white rounded-[4px] border border-line/80 p-3 sm:p-3.5 space-y-3 shadow-xs"
      style={{
        boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
      }}
    >
      {/* ── Compact Header matching Zoho Widgets ── */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[4px] bg-surface-sunken flex items-center justify-center text-accent-600 border border-line shrink-0">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
                MONTHLY EXPENSE VARIANCE ANALYSIS
              </h2>
              <span className="text-[10px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded border border-accent-200 font-mono leading-none">
                {prevLabel} vs {currLabel}
              </span>
            </div>
            <p className="text-[10px] text-ink-500 font-sans mt-0.5 m-0 leading-none">
              Comparative executive analytics model (Coordinator, Admin, Accountant, Travel Desk, MIS)
            </p>
          </div>
        </div>

        {/* Toggle between Daily and Category */}
        <div className="flex items-center bg-surface-sunken border border-line rounded-[4px] p-0.5 text-2xs font-bold">
          <button
            type="button"
            onClick={() => setChartMode("daily")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10.5px] font-bold transition-all cursor-pointer border-0 ${
              chartMode === "daily"
                ? "bg-white text-ink-900 shadow-2xs"
                : "bg-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <LineChart className="w-3 h-3 text-accent-600" />
            <span>Daily Run-Rate</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode("category")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10.5px] font-bold transition-all cursor-pointer border-0 ${
              chartMode === "category"
                ? "bg-white text-ink-900 shadow-2xs"
                : "bg-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <BarChart3 className="w-3 h-3 text-teal-600" />
            <span>Category Delta</span>
          </button>
        </div>
      </div>

      {/* ── 4 Compact KPI Cards (100% Ditto ZohoKpiRow 82px Height Tokens) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Card 1: Last Month */}
        <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-teal-600 p-2.5 transition-all duration-200 flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-teal-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-teal-800 font-sans">
              {prevLabel.toUpperCase()} TOTAL SPEND
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <Calendar className="w-2.5 h-2.5" />
            </div>
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-teal-900 leading-tight">
              ₹{(prevStats.total || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-teal-700/80 font-medium leading-none mt-0.5 block truncate">
              {prevStats.count} Claims • Avg ₹{prevStats.avg.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Card 2: Current Month */}
        <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-2.5 transition-all duration-200 flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-accent-800 font-sans">
              {currLabel.toUpperCase()} TOTAL SPEND
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200">
              <Wallet className="w-2.5 h-2.5" />
            </div>
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-accent-900 leading-tight">
              ₹{(currStats.total || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-accent-700/80 font-medium leading-none mt-0.5 block truncate">
              {currStats.count} Claims • Avg ₹{currStats.avg.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Card 3: Net Variance Delta */}
        <div className={`group bg-white rounded-[4px] border border-[#4f4f4f]/30 p-2.5 transition-all duration-200 flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs ${
          isGrowth ? 'hover:border-rose-600' : 'hover:border-emerald-600'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-[2px] ${isGrowth ? 'bg-rose-500' : 'bg-emerald-600'}`} />
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-bold uppercase tracking-wider font-sans ${isGrowth ? 'text-rose-800' : 'text-emerald-800'}`}>
              {isGrowth ? "SPEND INCREASE" : deltaAmount < 0 ? "COST SAVINGS" : "NET VARIANCE"}
            </span>
            <div className={`w-5 h-5 rounded-[3px] flex items-center justify-center border ${
              isGrowth ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isGrowth ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            </div>
          </div>
          <div>
            <div className={`text-sm sm:text-base font-bold font-mono leading-tight ${isGrowth ? 'text-rose-700' : 'text-emerald-700'}`}>
              {percentageDelta > 0 ? `+${percentageDelta.toFixed(1)}%` : `${percentageDelta.toFixed(1)}%`}
            </div>
            <span className={`text-[10px] font-medium leading-none mt-0.5 block truncate font-mono ${isGrowth ? 'text-rose-600/90' : 'text-emerald-600/90'}`}>
              {deltaAmount >= 0 ? `+₹${Math.abs(Math.round(deltaAmount)).toLocaleString('en-IN')}` : `-₹${Math.abs(Math.round(deltaAmount)).toLocaleString('en-IN')}`} net variance
            </span>
          </div>
        </div>

        {/* Card 4: Run-Rate Velocity */}
        <div className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-indigo-600 p-2.5 transition-all duration-200 flex flex-col justify-between h-[78px] relative overflow-hidden shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-800 font-sans">
              RUN-RATE RATIO
            </span>
            <div className="w-5 h-5 rounded-[3px] bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Activity className="w-2.5 h-2.5" />
            </div>
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold font-mono text-indigo-900 leading-tight">
              {prevStats.total > 0 ? `${(currStats.total / prevStats.total).toFixed(2)}x` : '1.00x'} Spend
            </div>
            <span className="text-[10px] text-indigo-600/80 font-medium leading-none mt-0.5 block truncate font-mono">
              {prevStats.count > 0 ? `${(currStats.count / prevStats.count).toFixed(2)}x` : '1.00x'} Claim Volume
            </span>
          </div>
        </div>
      </div>

      {/* ── Interactive Comparative Chart ── */}
      <div className="bg-surface-sunken/30 border border-line rounded-[4px] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-800 font-display flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-accent-600" />
            {chartMode === "daily" ? `Day-by-Day Burn-Rate (${prevLabel} vs ${currLabel})` : `Category-wise Expenditure (${prevLabel} vs ${currLabel})`}
          </span>
          <span className="text-[10px] text-ink-500 font-sans">Hover points for detailed delta metrics</span>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "daily" ? (
              <AreaChart data={dailyComparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4338CA" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4338CA" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 9, fill: "#64748B" }} 
                  tickFormatter={(d) => `D${d}`}
                  stroke="#CBD5E1"
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: "#64748B" }} 
                  tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
                  stroke="#CBD5E1"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const curr = Number(payload.find(p => p.dataKey === "current")?.value || 0);
                      const prev = Number(payload.find(p => p.dataKey === "previous")?.value || 0);
                      const diff = curr - prev;
                      return (
                        <div className="bg-white p-2 rounded-[4px] border border-line shadow-md text-xs space-y-1 font-sans">
                          <div className="font-bold text-ink-900 border-b border-line pb-0.5 text-[11px]">
                            Day {label} Comparison
                          </div>
                          <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                            <span className="text-accent-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4338CA]" />
                              {currLabel}:
                            </span>
                            <span className="font-black text-ink-900">₹{curr.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                            <span className="text-teal-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                              {prevLabel}:
                            </span>
                            <span className="font-black text-ink-900">₹{prev.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="border-t border-line pt-0.5 flex items-center justify-between gap-3 text-[10px] font-bold">
                            <span className="text-ink-500">Day Delta:</span>
                            <span className={diff >= 0 ? "text-rose-600 font-mono" : "text-emerald-600 font-mono"}>
                              {diff >= 0 ? `+₹${diff.toLocaleString("en-IN")}` : `-₹${Math.abs(diff).toLocaleString("en-IN")}`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={22} 
                  formatter={(val) => (
                    <span className="text-[10px] font-bold text-ink-700">
                      {val === "current" ? `${currLabel} (Current)` : `${prevLabel} (Last Month)`}
                    </span>
                  )}
                />
                <Area 
                  type="monotone" 
                  dataKey="previous" 
                  stroke="#0D9488" 
                  strokeDasharray="4 4"
                  strokeWidth={1.8} 
                  fillOpacity={1} 
                  fill="url(#colorPrev)" 
                  name="previous"
                />
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#4338CA" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorCurr)" 
                  name="current"
                />
              </AreaChart>
            ) : (
              <BarChart data={categoryComparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: "#64748B" }} 
                  stroke="#CBD5E1"
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: "#64748B" }} 
                  tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
                  stroke="#CBD5E1"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const curr = Number(payload.find(p => p.dataKey === "current")?.value || 0);
                      const prev = Number(payload.find(p => p.dataKey === "previous")?.value || 0);
                      const diff = curr - prev;
                      return (
                        <div className="bg-white p-2 rounded-[4px] border border-line shadow-md text-xs space-y-1 font-sans">
                          <div className="font-bold text-ink-900 border-b border-line pb-0.5 text-[11px]">
                            {label} Category Variance
                          </div>
                          <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                            <span className="text-accent-700 font-bold">{currLabel}:</span>
                            <span className="font-black text-ink-900">₹{curr.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                            <span className="text-teal-700 font-bold">{prevLabel}:</span>
                            <span className="font-black text-ink-900">₹{prev.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="border-t border-line pt-0.5 flex items-center justify-between gap-3 text-[10px] font-bold">
                            <span className="text-ink-500">Category Delta:</span>
                            <span className={diff >= 0 ? "text-rose-600 font-mono" : "text-emerald-600 font-mono"}>
                              {diff >= 0 ? `+₹${diff.toLocaleString("en-IN")}` : `-₹${Math.abs(diff).toLocaleString("en-IN")}`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={22} 
                  formatter={(val) => (
                    <span className="text-[10px] font-bold text-ink-700">
                      {val === "current" ? `${currLabel} (Current)` : `${prevLabel} (Last Month)`}
                    </span>
                  )}
                />
                <Bar dataKey="previous" fill="#0D9488" radius={[2, 2, 0, 0]} name="previous" />
                <Bar dataKey="current" fill="#4338CA" radius={[2, 2, 0, 0]} name="current" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
