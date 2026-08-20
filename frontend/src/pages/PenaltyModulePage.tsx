import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Download, TrendingUp,
  Zap, Activity, Building2, Users,
  ChevronDown, ChevronUp, Search, Filter,
  Repeat2, MapPin, Star, BarChart3, Target, Flame,
  ChevronLeft, ChevronRight, ArrowUpRight
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  penaltyLiveService,
  LivePenaltySummaryResponse,
  LivePenaltyRecordsResponse,
  LivePenaltyRepeatersResponse,
  DistrictPenaltyStat,
  RepeaterCallEntry,
} from "../services/penaltyLiveService";
import { SaaSBarChart, SaaSDonutChart } from "../components/common/SaaSCharts";

const INR = "\u20b9";

const fmtINR = (n: number) => {
  if (n >= 1_00_00_000) return `${INR}${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `${INR}${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `${INR}${(n / 1_000).toFixed(1)}K`;
  return `${INR}${n.toLocaleString("en-IN")}`;
};
const fmtFull = (n: number) =>
  `${INR}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function PenaltyModulePage() {
  const [summary, setSummary] = useState<LivePenaltySummaryResponse | null>(null);
  const [records, setRecords] = useState<LivePenaltyRecordsResponse | null>(null);
  const [repeaters, setRepeaters] = useState<LivePenaltyRepeatersResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [recSearch, setRecSearch] = useState("");
  const [recDistrict, setRecDistrict] = useState("");
  const [recStatus, setRecStatus] = useState<"" | "open" | "closed">("");
  const [recCritical, setRecCritical] = useState<"" | "yes" | "no">("");
  const [recOnlyPenalty, setRecOnlyPenalty] = useState(false);
  const [recPage, setRecPage] = useState(1);
  const REC_LIMIT = 50;

  const [repMinCount, setRepMinCount] = useState(2);
  const [repDistrict, setRepDistrict] = useState("");
  const [expandedRepeaters, setExpandedRepeaters] = useState<Set<string>>(new Set());
  const [distSort, setDistSort] = useState<"penalty" | "perday" | "calls">("penalty");

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await penaltyLiveService.getSummary();
      setSummary(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      toast.error("Summary load failed: " + (e.message || "error"));
    } finally { setLoadingSummary(false); }
  }, []);

  const fetchRecords = useCallback(async (page = 1) => {
    setLoadingRecords(true);
    try {
      const data = await penaltyLiveService.getRecords({
        page, limit: REC_LIMIT,
        search: recSearch || undefined,
        district: recDistrict || undefined,
        status: recStatus || "all",
        critical: recCritical || undefined,
        only_penalty: recOnlyPenalty || undefined,
      });
      setRecords(data);
      setRecPage(page);
    } catch (e: any) {
      toast.error("Records load failed: " + (e.message || "error"));
    } finally { setLoadingRecords(false); }
  }, [recSearch, recDistrict, recStatus, recCritical, recOnlyPenalty]);

  const fetchRepeaters = useCallback(async () => {
    setLoadingRepeaters(true);
    try {
      const data = await penaltyLiveService.getRepeaters({
        group_by: "equipment", min_count: repMinCount,
        district: repDistrict || undefined, limit: 100,
      });
      setRepeaters(data);
    } catch (e: any) {
      toast.error("Repeaters load failed: " + (e.message || "error"));
    } finally { setLoadingRepeaters(false); }
  }, [repMinCount, repDistrict]);

  useEffect(() => { fetchSummary(); fetchRepeaters(); fetchRecords(1); }, []);
  useEffect(() => { fetchRepeaters(); }, [repMinCount, repDistrict]);
  useEffect(() => { fetchRecords(1); }, [recDistrict, recStatus, recCritical, recOnlyPenalty]);

  const handleRefresh = () => {
    fetchSummary(); fetchRecords(recPage); fetchRepeaters();
    toast.success("Live data refreshed!");
  };

  const handleExport = async () => {
    const tid = toast.loading("Fetching all records...");
    try {
      const all = await penaltyLiveService.getRecords({ page: 1, limit: 99999, status: "all" });
      const rows = all.records.map((r, i) => ({
        "S.No": i + 1, "Complaint ID": r.complaint_id, "District": r.district_name,
        "Hospital": r.hospital_name, "Type": r.hospital_type,
        "Equipment": r.equipment_name, "Barcode": r.bar_code, "Status": r.complaint_status,
        "Critical": r.is_critical ? "Yes" : "No", "Warranty": r.is_under_warranty,
        "Standby": r.standby, "Raise Date": r.complaint_raise_date,
        "Attend Date": r.attend_date, "Close Date": r.complaint_close_date,
        "Attend Penalty": r.attend_penalty, "Delay Penalty": r.delay_penalty,
        "Total Penalty": r.total_penalty, "Per Day": r.total_per_day,
        "Penalty Days": r.penalty_down_days, "DI": r.di_name,
        "Coordinator": r.coordinator_name, "Zone": r.zone_name,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Live Penalty");
      XLSX.writeFile(wb, `Penalty_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.dismiss(tid);
      toast.success(`Exported ${rows.length} records!`);
    } catch {
      toast.dismiss(tid);
      toast.error("Export failed.");
    }
  };

  const kpis = summary?.kpis;
  const districts = [...(summary?.districts || [])].sort((a, b) =>
    distSort === "penalty" ? b.total_penalty - a.total_penalty :
    distSort === "perday"  ? b.per_day_penalty - a.per_day_penalty :
    b.open_tickets - a.open_tickets
  );
  const maxDistPenalty = Math.max(...districts.map(d => d.total_penalty), 1);
  const maxDistPerDay  = Math.max(...districts.map(d => d.per_day_penalty), 1);
  const distBarData = districts.slice(0, 12).map(d => ({
    name: d.district.length > 10 ? d.district.slice(0, 10) + "\u2026" : d.district,
    amount: d.total_penalty,
  }));
  const zoneDonutData = (summary?.zones || []).map(z => ({
    name: z.zone || "Unassigned", value: z.total_penalty,
  }));
  const coordList = [...(summary?.coordinators || [])].sort((a, b) => b.total_penalty - a.total_penalty).slice(0, 8);
  const maxCoord = Math.max(...coordList.map(c => c.total_penalty), 1);

  const toggleRep = (key: string) => {
    setExpandedRepeaters(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const lc = s.toLowerCase();
    const cls =
      lc.includes("engineer closed") ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
      lc.includes("final")           ? "bg-slate-100 text-slate-700 border-slate-200" :
      lc.includes("open") || lc.includes("pending") ? "bg-rose-100 text-rose-700 border-rose-200" :
      lc.includes("re-open")         ? "bg-amber-100 text-amber-800 border-amber-200" :
      "bg-blue-100 text-blue-800 border-blue-200";
    return <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase border rounded-none ${cls}`}>{s}</span>;
  };

  return (
    <div className="space-y-4 animate-fadeIn text-slate-800 font-sans p-3 sm:p-4 bg-slate-100 min-h-screen">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5986] text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-rose-300" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide">PENALTY AUDIT</h1>
            <p className="text-[10px] text-blue-200 font-medium">
              NIB-825 Live Engine · Real-time BEMMP Contract Penalty
              {lastRefresh && ` · ${lastRefresh.toLocaleTimeString("en-IN")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs border border-white/20 transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow transition-all">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Penalty",  val: kpis ? fmtINR(kpis.total_accumulated_penalty) : "…", sub: kpis ? `${kpis.total_complaints.toLocaleString()} complaints` : "Loading…", icon: <Flame className="w-4 h-4 opacity-60"/>, grad: "from-rose-600 to-rose-800", span: true },
          { label: "Per Day Burn",   val: kpis ? fmtINR(kpis.total_per_day_penalty) : "…",     sub: "/day live rate",                                                               icon: <TrendingUp className="w-4 h-4 opacity-60"/>, grad: "from-amber-500 to-orange-600" },
          { label: "Open Tickets",   val: kpis?.open_tickets?.toLocaleString() ?? "…",          sub: kpis ? `${kpis.open_penalty_tickets.toLocaleString()} with penalty` : "Loading…", icon: <Activity className="w-4 h-4 opacity-60"/>, grad: "from-blue-600 to-blue-800" },
          { label: "Critical Open",  val: kpis?.critical_open_count?.toLocaleString() ?? "…",   sub: "+10% surcharge",                                                              icon: <Star className="w-4 h-4 opacity-60"/>, grad: "from-purple-600 to-purple-800" },
          { label: "MCH / Day",      val: kpis ? fmtINR(kpis.mch_per_day_penalty) : "…",        sub: kpis ? `${kpis.mch_open_count} open` : "Loading…",                            icon: <Zap className="w-4 h-4 opacity-60"/>, grad: "from-emerald-600 to-teal-700" },
          { label: "Others / Day",   val: kpis ? fmtINR(kpis.others_per_day_penalty) : "…",     sub: kpis ? `${kpis.others_open_count} open` : "Loading…",                         icon: <Building2 className="w-4 h-4 opacity-60"/>, grad: "from-indigo-600 to-indigo-800" },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.grad} text-white rounded-xl p-4 shadow-lg flex flex-col justify-between min-h-[100px] ${c.span ? "col-span-2 sm:col-span-1" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider opacity-80">{c.label}</span>
              {c.icon}
            </div>
            <div>
              <div className="text-xl font-black font-mono mt-1 leading-tight">{c.val}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-500" /> District-Wise Penalty (Top 12)
            </h2>
            {loadingSummary && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </div>
          {distBarData.length > 0
            ? <SaaSBarChart data={distBarData} height={220} />
            : <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs font-bold">{loadingSummary ? "Loading…" : "No data"}</div>}
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-indigo-500" /> Zone Distribution
            </h2>
            {zoneDonutData.length > 0
              ? <SaaSDonutChart data={zoneDonutData} height={140} />
              : <div className="h-[140px] flex items-center justify-center text-slate-400 text-xs font-bold">{loadingSummary ? "Loading…" : "No data"}</div>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-500" /> Top Coordinators
            </h2>
            <div className="space-y-2">
              {coordList.map((c, i) => (
                <div key={c.coordinator} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[130px]">
                      <span className="text-slate-400 font-mono mr-1">#{i + 1}</span>{c.coordinator}
                    </span>
                    <span className="text-[10px] font-black text-rose-600 font-mono">{fmtINR(c.total_penalty)}</span>
                  </div>
                  <MiniBar value={c.total_penalty} max={maxCoord} color="#e11d48" />
                </div>
              ))}
              {coordList.length === 0 && <div className="text-xs text-slate-400 font-bold text-center py-4">{loadingSummary ? "Loading…" : "No data"}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── DISTRICT TABLE ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-300" /> District Performance Table
          </h2>
          <div className="flex items-center gap-1">
            {(["penalty","perday","calls"] as const).map(s => (
              <button key={s} onClick={() => setDistSort(s)}
                className={`px-2.5 py-1 text-[10px] font-black rounded transition-all ${distSort===s ? "bg-white text-slate-900" : "bg-white/10 text-white/70 hover:bg-white/20"}`}>
                {s==="penalty" ? "By Penalty" : s==="perday" ? "By /Day" : "By Calls"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3">Coordinator</th>
                <th className="py-2.5 px-3 text-center">Open</th>
                <th className="py-2.5 px-3 text-center">Pen.Calls</th>
                <th className="py-2.5 px-3 text-right">MCH/Day</th>
                <th className="py-2.5 px-3 text-right">Others/Day</th>
                <th className="py-2.5 px-3 text-right">Total Penalty</th>
                <th className="py-2.5 px-3 text-right">Per Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {districts.length === 0
                ? <tr><td colSpan={10} className="py-10 text-center text-slate-400 font-bold">{loadingSummary ? "Loading…" : "No district data"}</td></tr>
                : districts.map((d: DistrictPenaltyStat, idx) => (
                  <tr key={d.district} className="hover:bg-rose-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-black text-slate-400 text-[10px]">{idx+1}</td>
                    <td className="py-2.5 px-3 font-black text-slate-900">{d.district}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black rounded">{d.zone||"—"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium truncate max-w-[120px]">{d.coordinator||d.di_name||"—"}</td>
                    <td className="py-2.5 px-3 text-center font-black" style={{color: d.open_tickets>0?"#e11d48":"#94a3b8"}}>{d.open_tickets}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-600">{d.open_penalty_tickets}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-mono font-bold text-emerald-600">{fmtINR(d.mch_per_day)}</div>
                      <MiniBar value={d.mch_per_day} max={maxDistPerDay} color="#059669"/>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-mono font-bold text-blue-600">{fmtINR(d.others_per_day)}</div>
                      <MiniBar value={d.others_per_day} max={maxDistPerDay} color="#2563eb"/>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600">
                      {fmtINR(d.total_penalty)}
                      <MiniBar value={d.total_penalty} max={maxDistPenalty} color="#e11d48"/>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600">{fmtINR(d.per_day_penalty)}</td>
                  </tr>
                ))
              }
            </tbody>
            {districts.length > 0 && (
              <tfoot className="bg-slate-800 text-white text-xs font-black">
                <tr>
                  <td className="py-2.5 px-3" colSpan={4}>TOTAL ({districts.length} Districts)</td>
                  <td className="py-2.5 px-3 text-center">{districts.reduce((s,d)=>s+d.open_tickets,0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center">{districts.reduce((s,d)=>s+d.open_penalty_tickets,0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-300">{fmtINR(districts.reduce((s,d)=>s+d.mch_per_day,0))}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-300">{fmtINR(districts.reduce((s,d)=>s+d.others_per_day,0))}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-300">{fmtINR(kpis?.total_accumulated_penalty??0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-300">{fmtINR(kpis?.total_per_day_penalty??0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── REPEATER CALLS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-rose-700 to-rose-900 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
            <Repeat2 className="w-4 h-4 text-rose-300" /> Repeater Calls — Barcode Grouped
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-rose-200 font-black uppercase">Min:</span>
              {[2,3,5,10].map(n => (
                <button key={n} onClick={()=>setRepMinCount(n)}
                  className={`px-2 py-0.5 text-[10px] font-black rounded transition-all ${repMinCount===n?"bg-white text-rose-800":"bg-white/15 text-white/80 hover:bg-white/25"}`}>
                  {n}+
                </button>
              ))}
            </div>
            <select value={repDistrict} onChange={e=>setRepDistrict(e.target.value)}
              className="px-2 py-1 text-[10px] font-bold bg-white/10 text-white border border-white/20 rounded focus:outline-none">
              <option value="">All Districts</option>
              {districts.map(d=><option key={d.district} value={d.district}>{d.district}</option>)}
            </select>
          </div>
        </div>
        {repeaters?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-slate-200">
            {[
              {label:"Groups",   val:repeaters.summary.total_repeater_groups.toLocaleString(),       color:"text-rose-600"},
              {label:"Complaints",val:repeaters.summary.total_repeater_complaints.toLocaleString(),   color:"text-amber-600"},
              {label:"Active",   val:repeaters.summary.active_repeaters.toLocaleString(),             color:"text-blue-600"},
              {label:"Penalty",  val:fmtINR(repeaters.summary.total_repeater_penalty),               color:"text-rose-600"},
              {label:"Per Day",  val:fmtINR(repeaters.summary.total_repeater_per_day),               color:"text-orange-600"},
            ].map(item=>(
              <div key={item.label} className="py-2.5 px-4 text-center border-r border-slate-100 last:border-0">
                <div className={`text-base font-black font-mono ${item.color}`}>{item.val}</div>
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {loadingRepeaters
            ? <div className="py-10 text-center text-slate-400 text-xs font-bold">Loading repeater data…</div>
            : (repeaters?.repeaters||[]).length===0
            ? <div className="py-10 text-center text-slate-400 text-xs font-bold">No repeater calls with {repMinCount}+ complaints{repDistrict?` in ${repDistrict}`:""}</div>
            : (repeaters?.repeaters||[]).map((item:RepeaterCallEntry)=>{
              const isExp = expandedRepeaters.has(item.group_key);
              const badge = item.complaint_count>=10?"bg-rose-600 text-white":item.complaint_count>=5?"bg-amber-500 text-white":"bg-slate-200 text-slate-700";
              return (
                <div key={item.group_key} className="hover:bg-slate-50/60 transition-colors">
                  <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={()=>toggleRep(item.group_key)}>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${badge}`}>{item.complaint_count}x</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs">{item.equipment_name}</span>
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 border border-slate-200 text-slate-600">{item.bar_code}</span>
                        {item.is_critical&&<span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black">CRITICAL</span>}
                        <span className="text-[10px] text-slate-500">{item.hospital_name}</span>
                        <span className="text-[10px] text-slate-400">· {item.district_name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-rose-600 font-bold">{fmtINR(item.total_penalty)} total</span>
                        {item.per_day_penalty>0&&<span className="text-[10px] text-amber-600 font-bold">{fmtINR(item.per_day_penalty)}/day</span>}
                        <span className="text-[10px] text-slate-400">{item.open_count} open · {item.closed_count} closed</span>
                      </div>
                    </div>
                    {isExp?<ChevronUp className="w-4 h-4 text-slate-400 shrink-0"/>:<ChevronDown className="w-4 h-4 text-slate-400 shrink-0"/>}
                  </button>
                  {isExp&&(
                    <div className="px-4 pb-3 bg-rose-50/40 border-t border-rose-100">
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-2 mb-1.5">Recent Complaints</p>
                      <div className="space-y-1">
                        {item.recent_complaints.map(rc=>(
                          <div key={rc.complaint_id} className="flex items-center gap-3 text-[10px] bg-white px-3 py-1.5 border border-slate-200">
                            <span className="font-mono font-bold text-blue-600">{rc.complaint_id}</span>
                            <StatusBadge s={rc.status}/>
                            <span className="text-slate-400">{rc.raise_date?.slice(0,11)}</span>
                            <span className="font-black text-rose-600 ml-auto">{fmtFull(rc.total_penalty)}</span>
                            {rc.per_day>0&&<span className="text-amber-600 font-bold">{fmtINR(rc.per_day)}/d</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>

      {/* ── COMPLAINT RECORDS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-300"/> Complaint Records
            {records&&<span className="bg-white/20 px-2 py-0.5 rounded text-white text-[10px]">{records.total_records.toLocaleString()} total</span>}
          </h2>
          {loadingRecords&&<RefreshCw className="w-3.5 h-3.5 animate-spin text-white/60"/>}
        </div>
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" placeholder="Search complaint / barcode…" value={recSearch}
              onChange={e=>setRecSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchRecords(1)}
              className="pl-7 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded focus:outline-none focus:border-blue-400 w-52"/>
          </div>
          <select value={recDistrict} onChange={e=>setRecDistrict(e.target.value)} className="px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:outline-none w-36">
            <option value="">All Districts</option>
            {districts.map(d=><option key={d.district} value={d.district}>{d.district}</option>)}
          </select>
          <select value={recStatus} onChange={e=>setRecStatus(e.target.value as any)} className="px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:outline-none">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select value={recCritical} onChange={e=>setRecCritical(e.target.value as any)} className="px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:outline-none">
            <option value="">All Equipment</option>
            <option value="yes">Critical Only</option>
            <option value="no">Non-Critical</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={recOnlyPenalty} onChange={e=>setRecOnlyPenalty(e.target.checked)} className="rounded"/>
            Penalty &gt; 0
          </label>
          <button onClick={()=>fetchRecords(1)}
            className="px-3 py-1.5 bg-slate-800 text-white text-xs font-black rounded hover:bg-slate-900 transition-colors flex items-center gap-1">
            <Search className="w-3 h-3"/> Apply
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Complaint ID</th>
                <th className="py-2.5 px-3">Raise Date</th>
                <th className="py-2.5 px-3">Hospital · District</th>
                <th className="py-2.5 px-3">Equipment · Barcode</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Crit</th>
                <th className="py-2.5 px-3 text-right">Attend</th>
                <th className="py-2.5 px-3 text-right">Delay</th>
                <th className="py-2.5 px-3 text-right">Total Penalty</th>
                <th className="py-2.5 px-3 text-right">Per Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {loadingRecords
                ? <tr><td colSpan={11} className="py-10 text-center text-slate-400 font-bold">Loading…</td></tr>
                : (records?.records||[]).length===0
                ? <tr><td colSpan={11} className="py-10 text-center text-slate-400 font-bold">No records found.</td></tr>
                : (records?.records||[]).map((r,idx)=>{
                  const rowNum=((recPage-1)*REC_LIMIT)+idx+1;
                  return (
                    <tr key={r.complaint_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{rowNum}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-black text-blue-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"/>
                          {r.complaint_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{r.complaint_raise_date?.slice(0,11)}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 truncate max-w-[160px]">{r.hospital_name}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{r.district_name}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 truncate max-w-[140px]">{r.equipment_name}</div>
                        <span className="font-mono text-[10px] bg-slate-100 px-1 border border-slate-200 text-slate-600">{r.bar_code}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center"><StatusBadge s={r.complaint_status}/></td>
                      <td className="py-2.5 px-3 text-center">
                        {r.is_critical&&<span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black">CRIT</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{r.attend_penalty>0?fmtFull(r.attend_penalty):"—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{r.delay_penalty>0?fmtFull(r.delay_penalty):"—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-mono font-black ${r.total_penalty>0?"text-rose-600":"text-slate-400"}`}>
                          {r.total_penalty>0?fmtFull(r.total_penalty):`${INR}0`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {r.total_per_day>0
                          ?<span className="font-mono font-black text-amber-600 flex items-center justify-end gap-0.5"><ArrowUpRight className="w-3 h-3"/>{fmtINR(r.total_per_day)}</span>
                          :<span className="text-slate-300 font-mono">—</span>
                        }
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
        {records&&records.total_pages>1&&(
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Page <span className="font-black text-slate-900">{recPage}</span> of <span className="font-black text-slate-900">{records.total_pages}</span>
              {" "}· {records.total_records.toLocaleString()} records
            </span>
            <div className="flex items-center gap-1">
              <button onClick={()=>fetchRecords(recPage-1)} disabled={recPage<=1||loadingRecords}
                className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5"/>
              </button>
              {Array.from({length:Math.min(5,records.total_pages)},(_,i)=>{
                const pg=Math.max(1,recPage-2)+i;
                if(pg>records.total_pages) return null;
                return (
                  <button key={pg} onClick={()=>fetchRecords(pg)} disabled={loadingRecords}
                    className={`px-2.5 py-1 text-xs font-bold rounded border transition-all ${pg===recPage?"bg-slate-800 text-white border-slate-800":"border-slate-300 hover:bg-slate-100 text-slate-700"}`}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={()=>fetchRecords(recPage+1)} disabled={recPage>=records.total_pages||loadingRecords}
                className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
