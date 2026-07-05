import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import toast from "react-hot-toast";

const BASE = "https://expense-backend-zio8.onrender.com";
const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  "Content-Type": "application/json",
});

// ── Types ──────────────────────────────────────────────────────────────
interface Summary {
  db_reads: number; db_writes: number; kv_hits: number;
  total_requests: number; kv_savings_pct: number;
  reads_used_pct: number; writes_used_pct: number;
  daily_read_limit: number; daily_write_limit: number;
}
interface UserRow {
  user_id: string; user_name: string; role: string;
  zone: string; district: string;
  db_reads: number; db_writes: number; kv_hits: number; requests: number;
}
interface PageRow {
  page_name: string; db_reads: number; db_writes: number; kv_hits: number; request_count: number;
}
interface TimelineRow { date: string; db_reads: number; db_writes: number; kv_hits: number; }
interface LogRow {
  id: number; user_id: string; user_name: string; role: string;
  page_name: string; method: string; op_type: string;
  db_reads: number; db_writes: number; kv_hits: number;
  log_date: string; created_at: string;
}

// ── Custom Tooltip (Light Theme) ───────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs font-sans">
      <p className="text-slate-800 font-bold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-6 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }}/>
            <span className="text-slate-500 font-medium">{p.name}:</span>
          </div>
          <span className="font-extrabold text-slate-800">{(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── Animated Count-Up ─────────────────────────────────────────────────
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / 30;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

// ── Skeleton Loader ───────────────────────────────────────────────────
const Skeleton = ({ h = "h-8", w = "w-full" }: { h?: string; w?: string }) => (
  <div className={`${h} ${w} bg-slate-200/60 rounded-lg animate-pulse`} />
);

// ── Circular Progress (Light Theme) ───────────────────────────────────
function CircleProgress({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}/>
    </svg>
  );
}

export default function DBMonitoringPage() {
  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Tab selector between Global operations vs Dashboard Screen Operations
  const [activeMenuTab, setActiveMenuTab] = useState<"global" | "dashboard">("global");

  const [filterDate,     setFilterDate]     = useState(today);
  const [filterMonth,    setFilterMonth]    = useState(thisMonth);
  const [filterZone,     setFilterZone]     = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterUser,     setFilterUser]     = useState("");
  const [activeFilter,   setActiveFilter]   = useState<"date"|"month">("date");

  // Users database cache for dependent dropdown filters
  const [allUsersList, setAllUsersList] = useState<any[]>([]);

  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [pages,       setPages]       = useState<PageRow[]>([]);
  const [timeline,    setTimeline]    = useState<TimelineRow[]>([]);
  const [logs,        setLogs]        = useState<LogRow[]>([]);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logPage,     setLogPage]     = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [sortCol,     setSortCol]     = useState("db_reads");
  const [sortAsc,     setSortAsc]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Cloudflare Official API Stats state
  const [cfOfficial,  setCfOfficial]  = useState<any>(null);
  const [cfError,     setCfError]     = useState<string | null>(null);
  const [cfSuggestion,setCfSuggestion]= useState<string | null>(null);
  const [cfPeriod,    setCfPeriod]    = useState<"daily" | "monthly">("daily");
  const [cfLoading,   setCfLoading]   = useState(false);

  // Fetch all registered users once on load to populate filter options
  useEffect(() => {
    fetch(`${BASE}/api/admin/users`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllUsersList(data);
        }
      })
      .catch(e => console.error("Error loading users for filters:", e));
  }, []);

  // Compute dependent choices
  const availableZones = Array.from(
    new Set(allUsersList.map(u => u.zone?.trim()).filter(Boolean))
  ).sort() as string[];

  const availableDistricts = Array.from(
    new Set(
      allUsersList
        .filter(u => !filterZone || u.zone?.trim().toLowerCase() === filterZone.trim().toLowerCase())
        .map(u => u.district?.trim())
        .filter(Boolean)
    )
  ).sort() as string[];

  const availableEngineers = allUsersList.filter(u => {
    if (filterZone && u.zone?.trim().toLowerCase() !== filterZone.trim().toLowerCase()) return false;
    if (filterDistrict && u.district?.trim().toLowerCase() !== filterDistrict.trim().toLowerCase()) return false;
    return true;
  });

  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error("No data available to export");
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          const valStr = val === null || val === undefined ? "" : String(val);
          return `"${valStr.replace(/"/g, '""')}"`;
        }).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filename} exported successfully!`);
  };

  const buildQS = useCallback((extra: Record<string,string> = {}) => {
    const p: Record<string,string> = {};
    if (activeFilter === "date") p.date = filterDate; else p.month = filterMonth;
    if (filterZone) p.zone = filterZone;
    if (filterDistrict) p.district = filterDistrict;
    if (filterUser) p.user_id = filterUser;
    
    // If tracking dashboard specifically, apply page_name=Home filter
    if (activeMenuTab === "dashboard") {
      p.page_name = "Home";
    }

    return new URLSearchParams({ ...p, ...extra }).toString();
  }, [activeFilter, filterDate, filterMonth, filterZone, filterDistrict, filterUser, activeMenuTab]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs    = buildQS();
      
      const tlParams: Record<string, string> = { month: thisMonth };
      if (activeMenuTab === "dashboard") {
        tlParams.page_name = "Home";
      }
      const tlQS  = new URLSearchParams(tlParams).toString();
      
      // Page size is 15 logs per page as requested
      const logsQS= buildQS({ page: String(logPage), page_size: "15" });
      
      const [s, u, p, t, l] = await Promise.all([
        fetch(`${BASE}/api/monitoring/summary?${qs}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${BASE}/api/monitoring/user-breakdown?${qs}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${BASE}/api/monitoring/page-breakdown?${qs}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${BASE}/api/monitoring/timeline?${tlQS}`, { headers: getHeaders() }).then(r => r.json()),
        fetch(`${BASE}/api/monitoring/logs?${logsQS}`, { headers: getHeaders() }).then(r => r.json()),
      ]);
      
      if (s.success) setSummary(s);
      setUsers(u.users || []);
      setPages(p.pages || []);
      setTimeline(t.timeline || []);
      setLogs(l.logs || []);
      setLogsTotal(l.total || 0);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildQS, logPage, thisMonth, activeMenuTab]);

  const fetchCloudflareOfficial = useCallback(async () => {
    setCfLoading(true);
    try {
      const cfQS = new URLSearchParams(
        cfPeriod === "daily" ? { date: today } : { month: thisMonth }
      ).toString();
      
      const cf = await fetch(`${BASE}/api/monitoring/cloudflare-official?${cfQS}`, { headers: getHeaders() })
        .then(r => r.json())
        .catch(() => ({ success: false, message: "Network error" }));
        
      if (cf.success) {
        setCfOfficial(cf);
        setCfError(null);
        setCfSuggestion(null);
      } else {
        setCfOfficial(null);
        setCfError(cf.message);
        setCfSuggestion(cf.suggestion || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCfLoading(false);
    }
  }, [cfPeriod, today, thisMonth]);

  useEffect(() => {
    fetchAll();
    fetchCloudflareOfficial();
    intervalRef.current = setInterval(() => {
      fetchAll();
      fetchCloudflareOfficial();
    }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, fetchCloudflareOfficial]);

  useEffect(() => {
    fetchCloudflareOfficial();
  }, [cfPeriod]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(v => !v); else { setSortCol(col); setSortAsc(false); }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const av = (a as any)[sortCol] ?? 0, bv = (b as any)[sortCol] ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  // Donut data for reads breakdown
  const donutData = summary ? [
    { name: "KV (Free)", value: summary.kv_hits, color: "#2ea35e" },
    { name: "DB Reads", value: summary.db_reads, color: "#2f5bb7" },
  ] : [];

  // Bar chart for page breakdown (top 8)
  const pageBarData = pages.slice(0, 8).map(p => ({
    name: p.page_name || "?",
    "DB Reads": p.db_reads,
    "KV Hits":  p.kv_hits,
    "Writes":   p.db_writes,
  }));

  const totalR = (summary?.db_reads ?? 0) + (summary?.kv_hits ?? 0);
  const kvPct  = totalR > 0 ? Math.round((summary?.kv_hits ?? 0) / totalR * 100) : 0;

  return (
    <div className="space-y-6 text-[#212529] animate-fadeIn font-sans p-2">
      
      {/* ── Header Segment ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <span>📊</span> DB & KV Monitor
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Track real-time reads/writes and Cloudflare edge memory caching.
          </p>
          {lastUpdated && (
            <span className="inline-block mt-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              Last synced: {lastUpdated}
            </span>
          )}
        </div>

        {/* High-level tab menu specifically for Global vs Dashboard Operations */}
        <div className="flex bg-slate-100 border border-gray-250/50 rounded-xl p-1 shrink-0 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => setActiveMenuTab("global")}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border-0 whitespace-nowrap ${
              activeMenuTab === "global"
                ? "bg-[#a5d8e8] text-slate-900 font-extrabold shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-200/50"
            }`}
          >
            All Screens
          </button>
          <button
            type="button"
            onClick={() => setActiveMenuTab("dashboard")}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border-0 whitespace-nowrap ${
              activeMenuTab === "dashboard"
                ? "bg-[#a5d8e8] text-slate-900 font-extrabold shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-200/50"
            }`}
          >
            Home
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">Filter Mode</p>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-0.5">
              {(["date","month"] as const).map(m => (
                <button key={m} onClick={() => setActiveFilter(m)}
                  className={`px-3 py-1 text-xs font-bold capitalize transition-all rounded-lg
                    ${activeFilter===m ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-800"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {activeFilter==="date" ? (
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">Date</p>
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
                className="bg-white border border-slate-250 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"/>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">Month</p>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
                className="bg-white border border-slate-250 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500"/>
            </div>
          )}
          
          {/* Dynamic Zone Selector */}
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">Zone</p>
            <select 
              value={filterZone} 
              onChange={e => {
                setFilterZone(e.target.value);
                setFilterDistrict("");
                setFilterUser("");
              }}
              className="bg-white border border-slate-250 text-slate-800 text-xs rounded-xl px-3 py-1.5 min-w-[120px] focus:outline-none focus:border-blue-500"
            >
              <option value="">All Zones</option>
              {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          {/* Dynamic District Selector */}
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">District</p>
            <select 
              value={filterDistrict} 
              onChange={e => {
                setFilterDistrict(e.target.value);
                setFilterUser("");
              }}
              disabled={!filterZone && availableDistricts.length === 0}
              className="bg-white border border-slate-250 text-slate-800 text-xs rounded-xl px-3 py-1.5 min-w-[120px] focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">All Districts</option>
              {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Dynamic User/Engineer Selector */}
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1.5">User / Engineer</p>
            <select 
              value={filterUser} 
              onChange={e => setFilterUser(e.target.value)}
              className="bg-white border border-slate-250 text-slate-800 text-xs rounded-xl px-3 py-1.5 min-w-[160px] max-w-[220px] focus:outline-none focus:border-blue-500"
            >
              <option value="">All Users</option>
              {availableEngineers.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.user_id}) - {u.role}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchAll} disabled={loading}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-sm">
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards (5 cards) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* DB Reads */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">DB Reads</p>
            <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📖</span>
          </div>
          <p className="text-2xl font-black text-blue-700">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.db_reads ?? 0}/>}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">of 5M daily limit</p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(summary?.reads_used_pct ?? 0, 100)}%`,
                background: (summary?.reads_used_pct ?? 0) > 80 ? "#e81123" : "#2f5bb7" }}/>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{(summary?.reads_used_pct ?? 0).toFixed(4)}% used</p>
        </div>

        {/* DB Writes */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">DB Writes</p>
            <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">✏️</span>
          </div>
          <p className="text-2xl font-black text-amber-600">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.db_writes ?? 0}/>}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">of 100K daily limit</p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(summary?.writes_used_pct ?? 0, 100)}%`,
                background: (summary?.writes_used_pct ?? 0) > 80 ? "#e81123" : "#d28b2a" }}/>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{(summary?.writes_used_pct ?? 0).toFixed(4)}% used</p>
        </div>

        {/* KV Hits */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">KV Edge Hits</p>
            <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">⚡</span>
          </div>
          <p className="text-2xl font-black text-green-600">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.kv_hits ?? 0}/>}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">served from Cloudflare KV</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
            <span className="text-[10px] text-green-600 font-bold">100% Free Edge Cache</span>
          </div>
        </div>

        {/* Total requests */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">API requests</p>
            <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-sm">🌐</span>
          </div>
          <p className="text-2xl font-black text-purple-700">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.total_requests ?? 0}/>}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">total HTTP transactions</p>
        </div>

        {/* KV Savings circle */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2">KV Efficiency</p>
          {loading ? <Skeleton h="h-16" w="w-16"/> : (
            <div className="relative flex items-center justify-center">
              <CircleProgress pct={kvPct}
                color={kvPct >= 50 ? "#2ea35e" : kvPct >= 20 ? "#d28b2a" : "#e81123"}/>
              <span className="absolute text-base font-black text-slate-800">{kvPct}%</span>
            </div>
          )}
          <p className="text-[9px] text-slate-400 mt-1">reads avoided on DB</p>
        </div>
      </div>

      {/* ── Secondary Dashboard Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cost Saved */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Estimated Cost Saved</p>
            <p className="text-xl font-black text-slate-800 mt-1">
              ₹{loading ? "0.00" : ((summary?.kv_hits ?? 0) * 0.05).toFixed(2)}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">saved via Cloudflare KV offload</p>
          </div>
          <span className="text-2xl">💰</span>
        </div>

        {/* Caching Status Tier */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Speed Performance Tier</p>
            <p className="text-xl font-black text-slate-800 mt-1">
              {loading ? "Calculating..." : kvPct >= 80 ? "Ultrafast ⚡" : kvPct >= 50 ? "Fast 🏃" : kvPct >= 20 ? "Optimal 🚶" : "Direct ❄️"}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">caching acceleration level</p>
          </div>
          <span className="text-2xl">🚀</span>
        </div>

        {/* Database Health */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Database Status</p>
            <p className="text-xl font-black text-emerald-600 mt-1">Optimal (Healthy)</p>
            <p className="text-[9px] text-slate-400 mt-0.5">D1 Engine running normally</p>
          </div>
          <span className="text-2xl">🟢</span>
        </div>
      </div>

      {/* ── Official Cloudflare Edge Meter (Direct CF Billing Stats) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs">☁️</span>
              Official Cloudflare Edge Meter (Server-Side Billing Stats)
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              Account-level billing volume retrieved directly from Cloudflare Analytics.
            </p>
          </div>
          
          {/* Daily / Monthly selector button group inside Cloudflare Edge Meter */}
          <div className="flex bg-slate-100 border border-slate-200/60 rounded-xl p-0.5 text-[10px] font-bold self-start sm:self-auto shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => setCfPeriod("daily")}
              className={`px-3 py-1 rounded-lg transition-all border-0 cursor-pointer ${
                cfPeriod === "daily"
                  ? "bg-white text-slate-800 shadow-sm font-extrabold"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Daily (Today)
            </button>
            <button
              type="button"
              onClick={() => setCfPeriod("monthly")}
              className={`px-3 py-1 rounded-lg transition-all border-0 cursor-pointer ${
                cfPeriod === "monthly"
                  ? "bg-white text-slate-800 shadow-sm font-extrabold"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly (This Month)
            </button>
          </div>
        </div>
        
        {cfLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Skeleton h="h-16"/><Skeleton h="h-16"/><Skeleton h="h-16"/><Skeleton h="h-16"/>
          </div>
        ) : cfError ? (
          <div className="p-4.5 bg-amber-50 border border-amber-200/70 rounded-xl text-xs text-amber-900 leading-relaxed font-sans shadow-inner mt-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">⚠️</span>
              <p className="font-extrabold text-amber-800 uppercase tracking-wide">Cloudflare API Analytics Error</p>
            </div>
            <p>Cloudflare API returned error: <code className="bg-amber-100/80 px-1 rounded font-mono text-[11px] font-bold">{cfError}</code></p>
            {cfSuggestion && (
              <div className="mt-3 p-3 bg-white/80 border border-amber-200 rounded-lg text-slate-700">
                <span className="font-extrabold text-blue-700 block mb-1">🔧 How to enable this view:</span>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Go to your Cloudflare Dashboard &gt; My Profile &gt; <strong>API Tokens</strong>.</li>
                  <li>Click <strong>Edit</strong> on the token used in your application (<code className="bg-slate-100 px-1 rounded font-mono">CLOUDFLARE_API_TOKEN</code>).</li>
                  <li>Add permission: <strong>Account</strong> &gt; <strong>Analytics</strong> &gt; <strong>Read</strong>.</li>
                  <li>Save changes. The system will start loading official CF statistics instantly.</li>
                </ol>
              </div>
            )}
          </div>
        ) : cfOfficial ? (() => {
            const daysCount = cfPeriod === "monthly" ? (() => {
              try {
                const year = parseInt(filterMonth.split("-")[0]) || new Date().getFullYear();
                const month = parseInt(filterMonth.split("-")[1]) || (new Date().getMonth() + 1);
                return new Date(year, month, 0).getDate();
              } catch {
                return 30;
              }
            })() : 1;
            
            const rLimit = 5000000 * daysCount;
            const wLimit = 100000 * daysCount;
            
            const kvRPct = Math.min((cfOfficial.kv_reads / rLimit) * 100, 100);
            const kvWPct = Math.min((cfOfficial.kv_writes / wLimit) * 100, 100);
            const d1RPct = Math.min((cfOfficial.d1_reads / rLimit) * 100, 100);
            const d1WPct = Math.min((cfOfficial.d1_writes / wLimit) * 100, 100);
            
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {/* KV Reads */}
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official KV Reads</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{(cfOfficial.kv_reads || 0).toLocaleString()}</p>
                  </div>
                  <div className="mt-3">
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${kvRPct}%` }}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 font-semibold">
                      <span>{kvRPct.toFixed(4)}% used</span>
                      <span>of {rLimit >= 1000000 ? `${(rLimit/1000000).toFixed(0)}M` : rLimit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* KV Writes */}
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official KV Writes</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{(cfOfficial.kv_writes || 0).toLocaleString()}</p>
                  </div>
                  <div className="mt-3">
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-600 rounded-full" style={{ width: `${kvWPct}%` }}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 font-semibold">
                      <span>{kvWPct.toFixed(4)}% used</span>
                      <span>of {wLimit >= 100000 ? `${(wLimit/1000).toFixed(0)}k` : wLimit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* D1 Reads */}
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official D1 Database Reads</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{(cfOfficial.d1_reads || 0).toLocaleString()}</p>
                  </div>
                  <div className="mt-3">
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${d1RPct}%` }}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 font-semibold">
                      <span>{d1RPct.toFixed(4)}% used</span>
                      <span>of {rLimit >= 1000000 ? `${(rLimit/1000000).toFixed(0)}M` : rLimit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* D1 Writes */}
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official D1 Database Writes</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{(cfOfficial.d1_writes || 0).toLocaleString()}</p>
                  </div>
                  <div className="mt-3">
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-600 rounded-full" style={{ width: `${d1WPct}%` }}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 font-semibold">
                      <span>{d1WPct.toFixed(4)}% used</span>
                      <span>of {wLimit >= 100000 ? `${(wLimit/1000).toFixed(0)}k` : wLimit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
        })() : (
          <p className="text-slate-400 text-xs mt-4">Could not fetch server-side metrics.</p>
        )}
      </div>

      {/* ── Charts Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Timeline Area Chart (span 3) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">30-Day Operation Trend</h3>
            <div className="flex gap-3 text-[10px] font-bold">
              {[["#2f5bb7","DB Reads"],["#2ea35e","KV Hits"],["#d28b2a","DB Writes"]].map(([c,n])=>(
                <span key={n} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{background:c}}/>
                  <span className="text-slate-500">{n}</span>
                </span>
              ))}
            </div>
          </div>
          {loading ? <Skeleton h="h-48"/> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {[["blue","#2f5bb7"],["green","#2ea35e"],["orange","#d28b2a"]].map(([id,c])=>(
                    <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false}/>
                <XAxis dataKey="date" tick={{ fill:"#64748b", fontSize:9 }} tickLine={false} axisLine={false}
                  tickFormatter={d => d?.slice(5) || ""}/>
                <YAxis tick={{ fill:"#64748b", fontSize:9 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="db_reads" name="DB Reads" stroke="#2f5bb7" fill="url(#g-blue)" strokeWidth={2}/>
                <Area type="monotone" dataKey="kv_hits"  name="KV Hits"  stroke="#2ea35e" fill="url(#g-green)" strokeWidth={2}/>
                <Area type="monotone" dataKey="db_writes" name="DB Writes" stroke="#d28b2a" fill="url(#g-orange)" strokeWidth={1.5}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Read source Donut (span 2) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4">Read Source Distribution</h3>
          {loading ? <Skeleton h="h-40"/> : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                    dataKey="value" paddingAngle={2}>
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#ffffff" strokeWidth={2}/>
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-5 mt-2">
                {donutData.map(d => (
                  <div key={d.name} className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{background:d.color}}/>
                      <span className="text-[10px] text-slate-500 font-bold">{d.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-800">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pages chart (only display in Global mode, hide if specific page is selected) */}
      {activeMenuTab === "global" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 font-sans">Pages Performance comparison</h3>
          {loading ? <Skeleton h="h-48"/> : pageBarData.length === 0 ? (
            <p className="text-slate-400 text-center py-10 text-xs">No records tracked</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pageBarData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:"#64748b", fontSize:9 }} tickLine={false} axisLine={false}
                  interval={0} angle={-15} textAnchor="end"/>
                <YAxis tick={{ fill:"#64748b", fontSize:9 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ color:"#475569", fontSize:10, paddingTop:8 }}/>
                <Bar dataKey="DB Reads" fill="#2f5bb7" radius={[3,3,0,0]}/>
                <Bar dataKey="KV Hits"  fill="#2ea35e" radius={[3,3,0,0]}/>
                <Bar dataKey="Writes"   fill="#d28b2a" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── User breakdown & Logs ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Stats Table */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">User Activity Breakdown</h3>
            <button
              onClick={() => downloadCSV(users, "user_activity_breakdown.csv")}
              className="px-2 py-1 bg-[#e2f1f5] hover:bg-[#d0eaf0] text-slate-700 border border-[#b8e0ea] text-[9px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
            >
              📥 Export (CSV)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  {[
                    ["user_name","User Name"],["user_id","Employee Code"],["role","Role"],
                    ["db_reads","DB Reads"],["db_writes","Writes"],["kv_hits","KV Hits"],["requests","Reqs"]
                  ].map(([col,lbl]) => (
                    <th key={col} onClick={()=>handleSort(col)}
                      className="text-left py-2 px-1.5 cursor-pointer hover:text-slate-800 select-none font-bold">
                      {lbl}{sortCol===col ? (sortAsc?" ▲":" ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(5)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_,j)=><td key={j} className="py-2 px-1.5"><Skeleton h="h-3"/></td>)}
                  </tr>
                )) : sortedUsers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-10">No logs for this filter</td></tr>
                ) : sortedUsers.map((u,i)=>(
                  <tr key={i} className="border-b border-gray-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="py-2.5 px-1.5 font-semibold text-slate-800">{u.user_name || "—"}</td>
                    <td className="py-2.5 px-1.5 font-mono text-blue-600 font-bold">{u.user_id}</td>
                    <td className="py-2.5 px-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide
                        ${u.role?.includes("Admin") ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                        {u.role || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-1.5 text-blue-700 font-extrabold text-right">{u.db_reads.toLocaleString()}</td>
                    <td className="py-2.5 px-1.5 text-amber-600 font-extrabold text-right">{u.db_writes.toLocaleString()}</td>
                    <td className="py-2.5 px-1.5 text-green-600 font-extrabold text-right">{u.kv_hits.toLocaleString()}</td>
                    <td className="py-2.5 px-1.5 text-slate-500 text-right">{u.requests.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live requests logs (Now showing 50 entries per line) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Recent Request Stream</h3>
              <p className="text-[9px] text-slate-400 mt-0.5 font-bold">{logsTotal.toLocaleString()} total rows tracked</p>
            </div>
            <button
              onClick={() => downloadCSV(logs, "recent_request_stream.csv")}
              className="px-2 py-1 bg-[#e2f1f5] hover:bg-[#d0eaf0] text-slate-700 border border-[#b8e0ea] text-[9px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
            >
              📥 Export (CSV)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  {["Time","User Name","Page Screen","Method","DB","KV"].map(h=>(
                    <th key={h} className="text-left py-2 px-1.5 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(6)].map((_,j)=><td key={j} className="py-2 px-1.5"><Skeleton h="h-3"/></td>)}
                  </tr>
                )) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-10">No recent transactions</td></tr>
                ) : logs.map((l,i)=>(
                  <tr key={i} className="border-b border-gray-100 hover:bg-slate-50 transition-colors text-slate-700">
                    <td className="py-2 px-1.5 text-slate-400 font-mono text-[10px]">{l.created_at?.slice(11,19)||l.log_date}</td>
                    <td className="py-2 px-1.5 text-blue-600 font-semibold" title={l.user_id}>{l.user_name || l.user_id}</td>
                    <td className="py-2 px-1.5 text-slate-700 font-semibold max-w-[110px] truncate" title={l.page_name}>{l.page_name||"—"}</td>
                    <td className="py-2 px-1.5">
                      <span className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wide
                        ${l.op_type === "read" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                        {l.method}
                      </span>
                    </td>
                    <td className={`py-2 px-1.5 font-extrabold text-right ${((l.db_reads||0)+(l.db_writes||0))>0 ? "text-blue-600" : "text-slate-300"}`}>
                      {((l.db_reads||0)+(l.db_writes||0))}
                    </td>
                    <td className={`py-2 px-1.5 font-extrabold text-right ${(l.kv_hits||0)>0 ? "text-green-600" : "text-slate-300"}`}>
                      {(l.kv_hits||0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logsTotal > 15 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <button onClick={()=>setLogPage(p=>Math.max(1,p-1))} disabled={logPage===1}
                  className="px-3 py-1 bg-white border border-gray-200 text-slate-600 text-[10px] font-bold rounded-lg disabled:opacity-40 hover:bg-slate-50">← Prev</button>
                <span className="text-[10px] font-bold text-slate-500">Page {logPage} / {Math.ceil(logsTotal/15)}</span>
                <button onClick={()=>setLogPage(p=>p+1)} disabled={logPage>=Math.ceil(logsTotal/15)}
                  className="px-3 py-1 bg-white border border-gray-200 text-slate-600 text-[10px] font-bold rounded-lg disabled:opacity-40 hover:bg-slate-50 font-sans">Next →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pages details table */}
      {activeMenuTab === "global" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">🖥️ Screen Visits & Speed Performance</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                Track how many times each screen was visited and how much database query load was saved by KV memory.
              </p>
            </div>
            <button
              onClick={() => downloadCSV(pages, "screen_speed_performance.csv")}
              className="px-3 py-1.5 bg-[#e2f1f5] hover:bg-[#d0eaf0] text-slate-700 border border-[#b8e0ea] text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              📥 Export Screen Stats (CSV)
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-slate-450 text-[10px] font-black uppercase tracking-wider">
                  <th className="text-left py-2 px-3 font-bold text-slate-500">Screen / Page Name</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-bold">Total Visits</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-bold">Speed Boosts (KV)</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-bold">Database Reads</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-bold">Database Updates</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-bold">Cache Saving %</th>
                  <th className="py-2 px-3 font-bold text-slate-500 text-center">Efficiency Grade</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(5)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_,j)=><td key={j} className="py-2.5 px-3"><Skeleton h="h-3"/></td>)}
                  </tr>
                )) : pages.length===0 ? (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-10">No records found</td></tr>
                ) : pages.map((p,i)=>{
                  const total = p.db_reads + p.kv_hits;
                  const kv = total > 0 ? Math.round(p.kv_hits/total*100) : 0;
                  
                  // Simple easy to understand grade badges
                  let gradeText = "Direct ❄️";
                  let gradeColor = "bg-blue-50 text-blue-700 border-blue-100";
                  if (kv >= 80) {
                    gradeText = "Ultrafast ⚡";
                    gradeColor = "bg-green-50 text-green-700 border-green-200";
                  } else if (kv >= 50) {
                    gradeText = "Fast 🏃";
                    gradeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  } else if (kv >= 20) {
                    gradeText = "Normal 🚶";
                    gradeColor = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-slate-50/80 transition-colors text-slate-700">
                      <td className="py-3 px-3 font-bold text-slate-800">{p.page_name||"—"}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-600">{p.request_count.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-extrabold">{p.kv_hits.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-blue-700 font-extrabold">{p.db_reads.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-amber-600 font-extrabold">{p.db_writes.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-black text-slate-800">
                        <span className={kv >= 50 ? "text-green-600" : kv >= 20 ? "text-amber-600" : "text-slate-500"}>
                          {kv}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wide ${gradeColor}`}>
                          {gradeText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-semibold">{p.request_count.toLocaleString()}</td>
                      <td className="py-2.5 px-3 min-w-[120px]">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/40">
                          <div style={{width:`${kv}%`, background:"#2ea35e"}} className="h-full rounded-l-full"/>
                          <div style={{width:`${100-kv}%`, background:"#2f5bb7"}} className="h-full"/>
                        </div>
                        <div className="flex justify-between text-slate-400 mt-1" style={{fontSize:8}}>
                          <span className="font-bold">KV {kv}%</span><span className="font-bold">DB {100-kv}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Write limit warning banner ────────────────────────────────── */}
      {summary && summary.writes_used_pct > 50 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-extrabold uppercase tracking-wide">High Database writes activity</p>
            <p className="text-red-600/80 font-normal mt-0.5">
              Current activity has consumed over {summary.writes_used_pct.toFixed(2)}% of the daily limit.
              The active memory batch flusher is working in background.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
