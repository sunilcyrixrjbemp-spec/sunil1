import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "https://expense-backend-zio8.onrender.com";

function getHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch(endpoint: string) {
  const res = await fetch(`${BASE}${endpoint}`, { headers: getHeaders() });
  return res.json();
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface Summary {
  db_reads: number; db_writes: number; kv_hits: number;
  total_requests: number; kv_savings_pct: number;
  reads_used_pct: number; writes_used_pct: number;
  daily_read_limit: number; daily_write_limit: number;
}
interface UserRow { user_id: string; user_name: string; role: string; zone: string; district: string; db_reads: number; db_writes: number; kv_hits: number; requests: number; }
interface PageRow { page_name: string; db_reads: number; db_writes: number; kv_hits: number; request_count: number; }
interface TimelineRow { date: string; db_reads: number; db_writes: number; kv_hits: number; }
interface LogRow { id: number; user_id: string; user_name: string; role: string; page_name: string; method: string; op_type: string; db_reads: number; db_writes: number; kv_hits: number; log_date: string; created_at: string; }

// ─── Tiny SVG Line Chart ─────────────────────────────────────────────────────
function LineChart({ data }: { data: TimelineRow[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No data for this period</div>;
  const w = 500, h = 160, pad = 40;
  const maxVal = Math.max(...data.flatMap(d => [d.db_reads, d.kv_hits, d.db_writes]), 1);
  const xStep = (w - pad * 2) / Math.max(data.length - 1, 1);
  const yScale = (v: number) => h - pad - (v / maxVal) * (h - pad * 2);
  const xScale = (i: number) => pad + i * xStep;
  const line = (key: keyof TimelineRow) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(d[key] as number)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
      <defs>
        {[["blue","#3b82f6"],["green","#22c55e"],["orange","#f97316"]].map(([id, c]) => (
          <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </linearGradient>
        ))}
      </defs>
      {/* Grid lines */}
      {[0,0.25,0.5,0.75,1].map(t => (
        <line key={t} x1={pad} x2={w-pad} y1={pad + t*(h-pad*2)} y2={pad + t*(h-pad*2)} stroke="#1e293b" strokeWidth="1"/>
      ))}
      {/* Lines */}
      <path d={line("db_reads")} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={line("kv_hits")} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={line("db_writes")} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* X-axis labels (show every nth) */}
      {data.filter((_,i) => i % Math.max(1, Math.floor(data.length/6)) === 0).map((d, i) => (
        <text key={i} x={xScale(data.indexOf(d))} y={h-8} textAnchor="middle" fill="#64748b" fontSize="9">{d.date?.slice(5)}</text>
      ))}
      {/* Dots */}
      {data.map((d, i) => [
        <circle key={`r${i}`} cx={xScale(i)} cy={yScale(d.db_reads)} r="3" fill="#3b82f6"><title>{`${d.date}: ${d.db_reads} DB reads`}</title></circle>,
        <circle key={`k${i}`} cx={xScale(i)} cy={yScale(d.kv_hits)} r="3" fill="#22c55e"><title>{`${d.date}: ${d.kv_hits} KV hits`}</title></circle>,
        <circle key={`w${i}`} cx={xScale(i)} cy={yScale(d.db_writes)} r="3" fill="#f97316"><title>{`${d.date}: ${d.db_writes} DB writes`}</title></circle>,
      ])}
    </svg>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function HBarChart({ data }: { data: PageRow[] }) {
  const top = data.slice(0, 10);
  const max = Math.max(...top.map(d => d.db_reads + d.kv_hits), 1);
  const colors = ["#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#ec4899","#22c55e","#f97316","#a78bfa","#14b8a6","#fb923c"];
  return (
    <div className="space-y-2">
      {top.map((d, i) => {
        const readPct = ((d.db_reads / max) * 100).toFixed(1);
        const kvPct   = ((d.kv_hits  / max) * 100).toFixed(1);
        return (
          <div key={i}>
            <div className="flex justify-between text-xs text-slate-400 mb-0.5">
              <span>{d.page_name || "Unknown"}</span>
              <span>{(d.db_reads + d.kv_hits).toLocaleString()}</span>
            </div>
            <div className="h-5 bg-slate-800 rounded-full overflow-hidden flex">
              <div style={{ width: `${readPct}%`, background: colors[i] }} className="h-full transition-all duration-700 rounded-l-full"/>
              <div style={{ width: `${kvPct}%`, background: "#22c55e" }} className="h-full opacity-70"/>
            </div>
          </div>
        );
      })}
      {!top.length && <div className="text-center text-slate-500 text-sm py-8">No data</div>}
    </div>
  );
}

// ─── Progress Ring ───────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(pct, 100);
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clamped}%`, background: color }}/>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DBMonitoringPage() {
  const today    = new Date().toISOString().slice(0, 10);
  const thisMonth= new Date().toISOString().slice(0, 7);

  const [filterDate,     setFilterDate]     = useState(today);
  const [filterMonth,    setFilterMonth]    = useState(thisMonth);
  const [filterZone,     setFilterZone]     = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterUser,     setFilterUser]     = useState("");
  const [activeFilter,   setActiveFilter]   = useState<"date"|"month">("date");

  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [users,      setUsers]      = useState<UserRow[]>([]);
  const [pages,      setPages]      = useState<PageRow[]>([]);
  const [timeline,   setTimeline]   = useState<TimelineRow[]>([]);
  const [logs,       setLogs]       = useState<LogRow[]>([]);
  const [logsTotal,  setLogsTotal]  = useState(0);
  const [logPage,    setLogPage]    = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdated,setLastUpdated]= useState("");
  const [kvRefreshing,setKvRefreshing]=useState(false);
  const [sortCol,    setSortCol]    = useState<string>("db_reads");
  const [sortAsc,    setSortAsc]    = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildQS = useCallback((extra: Record<string,string> = {}) => {
    const p: Record<string,string> = {};
    if (activeFilter === "date") p.date = filterDate;
    else p.month = filterMonth;
    if (filterZone)     p.zone     = filterZone;
    if (filterDistrict) p.district = filterDistrict;
    if (filterUser)     p.user_id  = filterUser;
    return new URLSearchParams({...p, ...extra}).toString();
  }, [activeFilter, filterDate, filterMonth, filterZone, filterDistrict, filterUser]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs       = buildQS();
      const tlQS     = new URLSearchParams({ month: thisMonth, ...(filterZone ? {zone: filterZone} : {}), ...(filterDistrict ? {district: filterDistrict} : {}), ...(filterUser ? {user_id: filterUser} : {}) }).toString();
      const logsQS   = buildQS({ page: String(logPage), page_size: "30" });
      const [s, u, p, t, l] = await Promise.all([
        apiFetch(`/api/monitoring/summary?${qs}`),
        apiFetch(`/api/monitoring/user-breakdown?${qs}`),
        apiFetch(`/api/monitoring/page-breakdown?${qs}`),
        apiFetch(`/api/monitoring/timeline?${tlQS}`),
        apiFetch(`/api/monitoring/logs?${logsQS}`),
      ]);
      if (s.success) setSummary(s);
      setUsers(u.users || []);
      setPages(p.pages || []);
      setTimeline(t.timeline || []);
      setLogs(l.logs || []);
      setLogsTotal(l.total || 0);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (e) {
      console.error("Monitoring fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [buildQS, logPage, thisMonth, filterZone, filterDistrict, filterUser]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const handleKvRefresh = async () => {
    setKvRefreshing(true);
    try {
      const res = await fetch(`${BASE}/api/auth/prefill-kv`, { method: "POST", headers: getHeaders() });
      const d = await res.json();
      alert(d.message || "KV refresh triggered!");
    } catch { alert("Failed to trigger KV refresh."); }
    finally { setKvRefreshing(false); }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const av = (a as any)[sortCol] ?? 0;
    const bv = (b as any)[sortCol] ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const kpiCards = [
    {
      label: "DB Reads Today", value: summary?.db_reads ?? 0,
      limit: summary?.daily_read_limit ?? 5_000_000, usedPct: summary?.reads_used_pct ?? 0,
      color: "#3b82f6", barColor: (summary?.reads_used_pct ?? 0) > 80 ? "#ef4444" : "#3b82f6",
      icon: "📖", suffix: "/ 5M limit",
    },
    {
      label: "DB Writes Today", value: summary?.db_writes ?? 0,
      limit: summary?.daily_write_limit ?? 100_000, usedPct: summary?.writes_used_pct ?? 0,
      color: "#f97316", barColor: (summary?.writes_used_pct ?? 0) > 80 ? "#ef4444" : "#f97316",
      icon: "✏️", suffix: "/ 100K limit",
    },
    {
      label: "KV Cache Hits", value: summary?.kv_hits ?? 0,
      limit: null, usedPct: 0, color: "#22c55e", barColor: "#22c55e",
      icon: "⚡", suffix: "served from edge",
    },
    {
      label: "KV Savings", value: `${summary?.kv_savings_pct ?? 0}%`,
      limit: null, usedPct: summary?.kv_savings_pct ?? 0,
      color: (summary?.kv_savings_pct ?? 0) >= 50 ? "#22c55e" : (summary?.kv_savings_pct ?? 0) >= 20 ? "#f59e0b" : "#ef4444",
      barColor: (summary?.kv_savings_pct ?? 0) >= 50 ? "#22c55e" : "#f59e0b",
      icon: "💰", suffix: "reads avoided",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-6 font-sans">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🗄️</span> DB & KV Operation Monitor
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time Cloudflare D1 usage tracking • Auto-refresh every 60s</p>
          {lastUpdated && <p className="text-slate-600 text-xs mt-0.5">Last updated: {lastUpdated}</p>}
        </div>
        <button
          onClick={handleKvRefresh} disabled={kvRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
        >
          {kvRefreshing ? "⏳ Refreshing..." : "🔄 Refresh KV Cache"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Filter By</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button onClick={() => setActiveFilter("date")} className={`px-3 py-1.5 text-xs font-semibold transition-all ${activeFilter==="date" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>Date</button>
            <button onClick={() => setActiveFilter("month")} className={`px-3 py-1.5 text-xs font-semibold transition-all ${activeFilter==="month" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>Month</button>
          </div>
        </div>
        {activeFilter === "date" ? (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"/>
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Month</label>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"/>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Zone</label>
          <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500">
            <option value="">All Zones</option>
            {["Ajmer","Bikaner","Jaipur","Jodhpur","Kota","Udaipur","Bharatpur"].map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">District</label>
          <input type="text" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} placeholder="Any district"
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:border-blue-500"/>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">User ID</label>
          <input type="text" value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="e.g. E2157"
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:border-blue-500"/>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all">
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((c, i) => (
          <div key={i} className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4" style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{c.icon}</span>
              <span className="text-slate-400 text-xs font-medium">{c.label}</span>
            </div>
            <div className="text-2xl font-bold mt-1" style={{ color: c.color }}>
              {loading ? <div className="h-7 w-20 bg-slate-700 rounded animate-pulse"/> : typeof c.value === "number" ? c.value.toLocaleString() : c.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{c.suffix}</div>
            {c.limit && (
              <>
                <ProgressBar pct={c.usedPct} color={c.barColor}/>
                <div className="text-xs text-slate-600 mt-1">{c.usedPct.toFixed(3)}% of daily limit used</div>
              </>
            )}
            {!c.limit && c.label === "KV Savings" && (
              <>
                <ProgressBar pct={c.usedPct} color={c.barColor}/>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">30-Day Timeline</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/>DB Reads</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/>KV Hits</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"/>DB Writes</span>
            </div>
          </div>
          {loading ? <div className="h-48 bg-slate-800 rounded-lg animate-pulse"/> : <LineChart data={timeline}/>}
        </div>
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">Top Pages by Reads</h3>
          {loading ? <div className="h-48 bg-slate-800 rounded-lg animate-pulse"/> : <HBarChart data={pages}/>}
        </div>
      </div>

      {/* Bottom Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* User Breakdown */}
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3">User Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  {[["user_id","User ID"],["user_name","Name"],["role","Role"],["db_reads","DB Reads"],["db_writes","Writes"],["kv_hits","KV Hits"]].map(([col, label]) => (
                    <th key={col} onClick={() => handleSort(col)} className="text-left py-2 px-2 cursor-pointer hover:text-white select-none font-semibold">
                      {label} {sortCol === col ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    {[...Array(6)].map((_, j) => <td key={j} className="py-2 px-2"><div className="h-3 bg-slate-700 rounded animate-pulse"/></td>)}
                  </tr>
                )) : sortedUsers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-8">No data for this period</td></tr>
                ) : sortedUsers.map((u, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-2 px-2 font-mono text-blue-400">{u.user_id}</td>
                    <td className="py-2 px-2 text-white">{u.user_name || "-"}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role?.includes("Admin") ? "bg-purple-900 text-purple-300" : "bg-slate-700 text-slate-300"}`}>{u.role || "-"}</span>
                    </td>
                    <td className="py-2 px-2 text-blue-400 font-bold">{u.db_reads.toLocaleString()}</td>
                    <td className="py-2 px-2 text-orange-400 font-bold">{u.db_writes.toLocaleString()}</td>
                    <td className="py-2 px-2 text-green-400 font-bold">{u.kv_hits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Recent Logs</h3>
            <span className="text-xs text-slate-500">{logsTotal.toLocaleString()} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2 font-semibold">Time</th>
                  <th className="text-left py-2 px-2 font-semibold">User</th>
                  <th className="text-left py-2 px-2 font-semibold">Page</th>
                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                  <th className="text-left py-2 px-2 font-semibold">DB</th>
                  <th className="text-left py-2 px-2 font-semibold">KV</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_,i) => (
                  <tr key={i} className="border-b border-slate-800">
                    {[...Array(6)].map((_,j) => <td key={j} className="py-2 px-2"><div className="h-3 bg-slate-700 rounded animate-pulse"/></td>)}
                  </tr>
                )) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-8">No logs found</td></tr>
                ) : logs.map((l, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-1.5 px-2 text-slate-500 font-mono">{l.created_at?.slice(11,19) || l.log_date}</td>
                    <td className="py-1.5 px-2 text-blue-400 font-mono">{l.user_id || "-"}</td>
                    <td className="py-1.5 px-2 text-white max-w-[120px] truncate" title={l.page_name}>{l.page_name || "-"}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${l.op_type === "read" ? "bg-blue-900/60 text-blue-300" : "bg-orange-900/60 text-orange-300"}`}>
                        {l.op_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-blue-400 font-bold">{(l.db_reads || 0) + (l.db_writes || 0)}</td>
                    <td className="py-1.5 px-2 text-green-400 font-bold">{l.kv_hits || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {logsTotal > 30 && (
              <div className="flex justify-center gap-2 mt-3">
                <button onClick={() => setLogPage(p => Math.max(1, p-1))} disabled={logPage === 1}
                  className="px-3 py-1 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded disabled:opacity-40 hover:bg-slate-700">Prev</button>
                <span className="text-xs text-slate-500 self-center">Page {logPage} / {Math.ceil(logsTotal/30)}</span>
                <button onClick={() => setLogPage(p => p+1)} disabled={logPage >= Math.ceil(logsTotal/30)}
                  className="px-3 py-1 text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded disabled:opacity-40 hover:bg-slate-700">Next</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page Details Table */}
      <div className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">All Pages - Operation Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-3 font-semibold">Page</th>
                <th className="text-right py-2 px-3 font-semibold text-blue-400">DB Reads</th>
                <th className="text-right py-2 px-3 font-semibold text-orange-400">DB Writes</th>
                <th className="text-right py-2 px-3 font-semibold text-green-400">KV Hits</th>
                <th className="text-right py-2 px-3 font-semibold">KV %</th>
                <th className="text-right py-2 px-3 font-semibold">Requests</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(5)].map((_,i) => (
                <tr key={i} className="border-b border-slate-800">
                  {[...Array(6)].map((_,j) => <td key={j} className="py-2 px-3"><div className="h-3 bg-slate-700 rounded animate-pulse"/></td>)}
                </tr>
              )) : pages.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-500 py-8">No data for this period</td></tr>
              ) : pages.map((p, i) => {
                const total = p.db_reads + p.kv_hits;
                const kvPct = total > 0 ? ((p.kv_hits / total) * 100).toFixed(1) : "0";
                return (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-white font-medium">{p.page_name || "-"}</td>
                    <td className="py-2 px-3 text-right text-blue-400 font-bold">{p.db_reads.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-orange-400 font-bold">{p.db_writes.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-green-400 font-bold">{p.kv_hits.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-bold ${parseFloat(kvPct) >= 50 ? "text-green-400" : parseFloat(kvPct) >= 20 ? "text-yellow-400" : "text-red-400"}`}>{kvPct}%</span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">{p.request_count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
