import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

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

// ── Custom Tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e2535] border border-slate-600/50 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{(p.value || 0).toLocaleString()}</span>
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
  <div className={`${h} ${w} bg-slate-700/50 rounded-lg animate-pulse`} />
);

// ── Circular Progress ─────────────────────────────────────────────────
function CircleProgress({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2535" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}/>
    </svg>
  );
}

export default function DBMonitoringPage() {
  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [filterDate,     setFilterDate]     = useState(today);
  const [filterMonth,    setFilterMonth]    = useState(thisMonth);
  const [filterZone,     setFilterZone]     = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterUser,     setFilterUser]     = useState("");
  const [activeFilter,   setActiveFilter]   = useState<"date"|"month">("date");

  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [pages,       setPages]       = useState<PageRow[]>([]);
  const [timeline,    setTimeline]    = useState<TimelineRow[]>([]);
  const [logs,        setLogs]        = useState<LogRow[]>([]);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logPage,     setLogPage]     = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [kvBusy,      setKvBusy]      = useState(false);
  const [sortCol,     setSortCol]     = useState("db_reads");
  const [sortAsc,     setSortAsc]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const buildQS = useCallback((extra: Record<string,string> = {}) => {
    const p: Record<string,string> = {};
    if (activeFilter === "date") p.date = filterDate; else p.month = filterMonth;
    if (filterZone) p.zone = filterZone;
    if (filterDistrict) p.district = filterDistrict;
    if (filterUser) p.user_id = filterUser;
    return new URLSearchParams({ ...p, ...extra }).toString();
  }, [activeFilter, filterDate, filterMonth, filterZone, filterDistrict, filterUser]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs    = buildQS();
      const tlQS  = new URLSearchParams({ month: thisMonth }).toString();
      const logsQS= buildQS({ page: String(logPage), page_size: "30" });
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
  }, [buildQS, logPage, thisMonth]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const doKvRefresh = async () => {
    setKvBusy(true);
    try {
      const r = await fetch(`${BASE}/api/auth/prefill-kv`, { method: "POST", headers: getHeaders() });
      const d = await r.json();
      alert(d.message || "KV refresh started!");
    } catch { alert("Failed."); }
    finally { setKvBusy(false); }
  };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(v => !v); else { setSortCol(col); setSortAsc(false); }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const av = (a as any)[sortCol] ?? 0, bv = (b as any)[sortCol] ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  // Donut data for reads breakdown
  const donutData = summary ? [
    { name: "KV (Free)", value: summary.kv_hits, color: "#22c55e" },
    { name: "DB Reads", value: summary.db_reads, color: "#3b82f6" },
  ] : [];

  // Bar chart for page breakdown (top 8)
  const pageBarData = pages.slice(0, 8).map(p => ({
    name: p.page_name?.replace("Data Upload - ","Upload ") || "?",
    "DB Reads": p.db_reads,
    "KV Hits":  p.kv_hits,
    "Writes":   p.db_writes,
  }));

  const totalR = (summary?.db_reads ?? 0) + (summary?.kv_hits ?? 0);
  const kvPct  = totalR > 0 ? Math.round((summary?.kv_hits ?? 0) / totalR * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white p-4 md:p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg shadow-lg">📊</div>
            <div>
              <h1 className="text-xl font-bold text-white">DB & KV Operation Monitor</h1>
              <p className="text-slate-400 text-xs">Real-time Cloudflare D1 usage · Auto-refresh 60s</p>
            </div>
          </div>
          {lastUpdated && <p className="text-slate-600 text-xs mt-1 ml-13">Updated: {lastUpdated}</p>}
        </div>
        <button onClick={doKvRefresh} disabled={kvBusy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg
            bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 disabled:opacity-40">
          {kvBusy ? "⏳ Refreshing KV..." : "🔄 Refresh KV Cache"}
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="bg-[#141929] border border-slate-700/40 rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium">Filter Mode</p>
            <div className="flex rounded-xl overflow-hidden border border-slate-700/50">
              {(["date","month"] as const).map(m => (
                <button key={m} onClick={() => setActiveFilter(m)}
                  className={`px-4 py-2 text-xs font-bold capitalize transition-all
                    ${activeFilter===m ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-400 hover:text-slate-200"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {activeFilter==="date" ? (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Date</p>
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"/>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Month</p>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"/>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium">Zone</p>
            <select value={filterZone} onChange={e=>setFilterZone(e.target.value)}
              className="bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500">
              <option value="">All Zones</option>
              {["Ajmer","Bikaner","Jaipur","Jodhpur","Kota","Udaipur","Bharatpur"].map(z=><option key={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium">District</p>
            <input type="text" value={filterDistrict} onChange={e=>setFilterDistrict(e.target.value)} placeholder="Any"
              className="bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-xl px-3 py-2 w-32 focus:outline-none focus:border-blue-500"/>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium">User ID</p>
            <input type="text" value={filterUser} onChange={e=>setFilterUser(e.target.value)} placeholder="e.g. E2157"
              className="bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-xl px-3 py-2 w-32 focus:outline-none focus:border-blue-500"/>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all shadow-md">
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      {/* ── KPI Cards (5 cards) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* DB Reads */}
        <div className="bg-[#141929] border border-blue-500/20 rounded-2xl p-4 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-semibold">DB Reads</p>
            <span className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-base">📖</span>
          </div>
          <p className="text-2xl font-black text-blue-400">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.db_reads ?? 0}/>}
          </p>
          <p className="text-xs text-slate-500 mt-1">of 5M daily limit</p>
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(summary?.reads_used_pct ?? 0, 100)}%`,
                background: (summary?.reads_used_pct ?? 0) > 80 ? "#ef4444" : "#3b82f6" }}/>
          </div>
          <p className="text-xs text-slate-600 mt-1">{(summary?.reads_used_pct ?? 0).toFixed(3)}% used</p>
        </div>

        {/* DB Writes */}
        <div className="bg-[#141929] border border-orange-500/20 rounded-2xl p-4 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-semibold">DB Writes</p>
            <span className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-base">✏️</span>
          </div>
          <p className="text-2xl font-black text-orange-400">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.db_writes ?? 0}/>}
          </p>
          <p className="text-xs text-slate-500 mt-1">of 100K daily limit</p>
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(summary?.writes_used_pct ?? 0, 100)}%`,
                background: (summary?.writes_used_pct ?? 0) > 80 ? "#ef4444" : "#f97316" }}/>
          </div>
          <p className="text-xs text-slate-600 mt-1">{(summary?.writes_used_pct ?? 0).toFixed(3)}% used</p>
        </div>

        {/* KV Hits */}
        <div className="bg-[#141929] border border-green-500/20 rounded-2xl p-4 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-semibold">KV Hits</p>
            <span className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center text-base">⚡</span>
          </div>
          <p className="text-2xl font-black text-green-400">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.kv_hits ?? 0}/>}
          </p>
          <p className="text-xs text-slate-500 mt-1">served from edge (FREE)</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-xs text-green-400 font-semibold">Zero DB cost</span>
          </div>
        </div>

        {/* Requests */}
        <div className="bg-[#141929] border border-purple-500/20 rounded-2xl p-4 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-semibold">Requests</p>
            <span className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-base">🌐</span>
          </div>
          <p className="text-2xl font-black text-purple-400">
            {loading ? <Skeleton h="h-8" w="w-24"/> : <CountUp value={summary?.total_requests ?? 0}/>}
          </p>
          <p className="text-xs text-slate-500 mt-1">total API calls today</p>
        </div>

        {/* KV Savings Donut */}
        <div className="bg-[#141929] border border-cyan-500/20 rounded-2xl p-4 col-span-1 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-400 font-semibold mb-2">KV Savings</p>
          {loading ? <Skeleton h="h-20" w="w-20"/> : (
            <div className="relative flex items-center justify-center">
              <CircleProgress pct={kvPct}
                color={kvPct >= 50 ? "#22c55e" : kvPct >= 20 ? "#f59e0b" : "#ef4444"}/>
              <span className="absolute text-lg font-black" style={{
                color: kvPct >= 50 ? "#22c55e" : kvPct >= 20 ? "#f59e0b" : "#ef4444"
              }}>{kvPct}%</span>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">reads from cache</p>
        </div>
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Area chart (span 3) */}
        <div className="lg:col-span-3 bg-[#141929] border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">30-Day Timeline</h3>
            <div className="flex gap-4 text-xs">
              {[["#3b82f6","DB Reads"],["#22c55e","KV Hits"],["#f97316","DB Writes"]].map(([c,n])=>(
                <span key={n} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>
                  <span className="text-slate-400">{n}</span>
                </span>
              ))}
            </div>
          </div>
          {loading ? <Skeleton h="h-52"/> : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {[["blue","#3b82f6"],["green","#22c55e"],["orange","#f97316"]].map(([id,c])=>(
                    <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false}/>
                <XAxis dataKey="date" tick={{ fill:"#64748b", fontSize:10 }} tickLine={false} axisLine={false}
                  tickFormatter={d => d?.slice(5) || ""}/>
                <YAxis tick={{ fill:"#64748b", fontSize:10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="db_reads" name="DB Reads" stroke="#3b82f6" fill="url(#g-blue)" strokeWidth={2.5}/>
                <Area type="monotone" dataKey="kv_hits"  name="KV Hits"  stroke="#22c55e" fill="url(#g-green)" strokeWidth={2.5}/>
                <Area type="monotone" dataKey="db_writes" name="DB Writes" stroke="#f97316" fill="url(#g-orange)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut + reads breakdown (span 2) */}
        <div className="lg:col-span-2 bg-[#141929] border border-slate-700/40 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Read Source Breakdown</h3>
          {loading ? <Skeleton h="h-40"/> : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                    dataKey="value" paddingAngle={3}>
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent"/>
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-2">
                {donutData.map(d => (
                  <div key={d.name} className="flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full mb-1" style={{background:d.color}}/>
                    <span className="text-xs text-slate-400">{d.name}</span>
                    <span className="text-sm font-bold" style={{color:d.color}}>{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 text-xs text-slate-400">
            <span className="text-green-400 font-bold">✓ KV reads are FREE</span> — they don't count towards your 5M D1 limit.
            <span className="text-blue-400 font-bold ml-1">DB reads</span> reduce your quota.
          </div>
        </div>
      </div>

      {/* ── Page Bar Chart ─────────────────────────────────────────── */}
      <div className="bg-[#141929] border border-slate-700/40 rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-bold text-white mb-4">Operations by Page</h3>
        {loading ? <Skeleton h="h-48"/> : pageBarData.length === 0 ? (
          <p className="text-slate-500 text-center py-12 text-sm">No data for selected period</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pageBarData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" horizontal={true} vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:"#64748b", fontSize:10 }} tickLine={false} axisLine={false}
                interval={0} angle={-30} textAnchor="end"/>
              <YAxis tick={{ fill:"#64748b", fontSize:10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ color:"#94a3b8", fontSize:11, paddingTop:8 }}/>
              <Bar dataKey="DB Reads" fill="#3b82f6" radius={[4,4,0,0]}/>
              <Bar dataKey="KV Hits"  fill="#22c55e" radius={[4,4,0,0]}/>
              <Bar dataKey="Writes"   fill="#f97316" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── User Table + Logs ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* User Breakdown */}
        <div className="bg-[#141929] border border-slate-700/40 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">User-wise Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60">
                  {[
                    ["user_id","User ID"],["user_name","Name"],["role","Role"],
                    ["db_reads","DB Reads"],["db_writes","Writes"],["kv_hits","KV Hits"],["requests","Reqs"]
                  ].map(([col,lbl]) => (
                    <th key={col} onClick={()=>handleSort(col)}
                      className="text-left py-2 px-2 text-slate-400 font-semibold cursor-pointer hover:text-white select-none">
                      {lbl}{sortCol===col ? (sortAsc?" ▲":" ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(5)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-800/50">
                    {[...Array(7)].map((_,j)=><td key={j} className="py-2 px-2"><Skeleton h="h-3"/></td>)}
                  </tr>
                )) : sortedUsers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-10 text-sm">No data for this period</td></tr>
                ) : sortedUsers.map((u,i)=>(
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-2 font-mono text-blue-400 font-bold">{u.user_id}</td>
                    <td className="py-2 px-2 text-slate-200">{u.user_name || "—"}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                        ${u.role?.includes("Admin") ? "bg-purple-900/60 text-purple-300" : "bg-slate-700/60 text-slate-300"}`}>
                        {u.role || "—"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-blue-400 font-bold text-right">{u.db_reads.toLocaleString()}</td>
                    <td className="py-2 px-2 text-orange-400 font-bold text-right">{u.db_writes.toLocaleString()}</td>
                    <td className="py-2 px-2 text-green-400 font-bold text-right">{u.kv_hits.toLocaleString()}</td>
                    <td className="py-2 px-2 text-slate-400 text-right">{u.requests.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Logs */}
        <div className="bg-[#141929] border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Live Request Log</h3>
            <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-1 rounded-lg">{logsTotal.toLocaleString()} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60">
                  {["Time","User","Page","Type","DB","KV"].map(h=>(
                    <th key={h} className="text-left py-2 px-2 text-slate-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-800/40">
                    {[...Array(6)].map((_,j)=><td key={j} className="py-2 px-2"><Skeleton h="h-3"/></td>)}
                  </tr>
                )) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-10 text-sm">No logs found</td></tr>
                ) : logs.map((l,i)=>(
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    <td className="py-1.5 px-2 text-slate-500 font-mono text-xs">{l.created_at?.slice(11,19)||l.log_date}</td>
                    <td className="py-1.5 px-2 text-blue-400 font-mono font-bold">{l.user_id||"—"}</td>
                    <td className="py-1.5 px-2 text-slate-300 max-w-[110px] truncate" title={l.page_name}>{l.page_name||"—"}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs
                        ${l.op_type==="read" ? "bg-blue-900/60 text-blue-300" : "bg-orange-900/60 text-orange-300"}`}>
                        {l.op_type==="read" ? "READ" : "WRITE"}
                      </span>
                    </td>
                    <td className={`py-1.5 px-2 font-bold text-right ${(l.db_reads||0)+(l.db_writes||0)>0 ? "text-blue-400" : "text-slate-600"}`}>
                      {((l.db_reads||0)+(l.db_writes||0)).toLocaleString()}
                    </td>
                    <td className={`py-1.5 px-2 font-bold text-right ${(l.kv_hits||0)>0 ? "text-green-400" : "text-slate-600"}`}>
                      {(l.kv_hits||0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logsTotal > 30 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <button onClick={()=>setLogPage(p=>Math.max(1,p-1))} disabled={logPage===1}
                  className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700/50 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700">← Prev</button>
                <span className="text-xs text-slate-500">Page {logPage} / {Math.ceil(logsTotal/30)}</span>
                <button onClick={()=>setLogPage(p=>p+1)} disabled={logPage>=Math.ceil(logsTotal/30)}
                  className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700/50 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700">Next →</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full Page Table ────────────────────────────────────────── */}
      <div className="bg-[#141929] border border-slate-700/40 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">All Pages — Operation Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="text-left py-2 px-3 text-slate-400 font-semibold">Page</th>
                <th className="text-right py-2 px-3 text-blue-400 font-semibold">DB Reads</th>
                <th className="text-right py-2 px-3 text-orange-400 font-semibold">DB Writes</th>
                <th className="text-right py-2 px-3 text-green-400 font-semibold">KV Hits</th>
                <th className="text-right py-2 px-3 text-cyan-400 font-semibold">KV %</th>
                <th className="text-right py-2 px-3 text-slate-400 font-semibold">Requests</th>
                <th className="py-2 px-3 text-slate-400 font-semibold">Cache Bar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(6)].map((_,i)=>(
                <tr key={i} className="border-b border-slate-800/40">
                  {[...Array(7)].map((_,j)=><td key={j} className="py-2.5 px-3"><Skeleton h="h-3"/></td>)}
                </tr>
              )) : pages.length===0 ? (
                <tr><td colSpan={7} className="text-center text-slate-500 py-10 text-sm">No data for selected period</td></tr>
              ) : pages.map((p,i)=>{
                const total = p.db_reads + p.kv_hits;
                const kv = total > 0 ? Math.round(p.kv_hits/total*100) : 0;
                return (
                  <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-white font-semibold">{p.page_name||"—"}</td>
                    <td className="py-2.5 px-3 text-right text-blue-400 font-bold">{p.db_reads.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-orange-400 font-bold">{p.db_writes.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-green-400 font-bold">{p.kv_hits.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-black ${kv>=50?"text-green-400":kv>=20?"text-yellow-400":"text-red-400"}`}>{kv}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{p.request_count.toLocaleString()}</td>
                    <td className="py-2.5 px-3 min-w-[120px]">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        <div style={{width:`${kv}%`, background:"#22c55e"}} className="h-full transition-all duration-700 rounded-l-full"/>
                        <div style={{width:`${100-kv}%`, background:"#3b82f6"}} className="h-full opacity-60"/>
                      </div>
                      <div className="flex justify-between text-slate-600 mt-0.5" style={{fontSize:9}}>
                        <span>KV</span><span>DB</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Write Limit Warning ───────────────────────────────────── */}
      {summary && summary.writes_used_pct > 50 && (
        <div className="mt-4 p-4 bg-orange-900/20 border border-orange-500/40 rounded-2xl text-sm text-orange-300 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold">DB Write Warning</p>
            <p className="text-xs text-orange-400/80">You've used {summary.writes_used_pct.toFixed(1)}% of your 100K daily write limit.
              The monitoring system uses batch writes (1 write per 50 requests) to protect this limit.</p>
          </div>
        </div>
      )}
    </div>
  );
}
