import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, TrendingUp, AlertTriangle, RefreshCw, Download,
  Building2, Users, Layers, ChevronLeft, ChevronRight, Search,
  Zap, Activity, BarChart3, Repeat2, MapPin, Star, Clock,
  ArrowUpRight, CheckCircle2, Filter, Target
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  penaltyLiveService,
  LivePenaltySummaryResponse,
  ComplaintPenaltyRecord,
  RepeaterCallEntry,
  RepeaterSummary,
} from "../services/penaltyLiveService";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(2)}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(2)}L`
    : `₹${n.toLocaleString("en-IN")}`;

const fmtINRFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type TabId = "overview" | "districts" | "coordinators" | "complaints" | "repeaters";

export default function PenaltyReportPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // ── Summary State ──
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<LivePenaltySummaryResponse | null>(null);

  // ── Complaints State ──
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [records, setRecords] = useState<ComplaintPenaltyRecord[]>([]);
  const [recPage, setRecPage] = useState(1);
  const [recTotalPages, setRecTotalPages] = useState(1);
  const [recTotal, setRecTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [criticalFilter, setCriticalFilter] = useState<"yes" | "no" | "">("");
  const [onlyPenalty, setOnlyPenalty] = useState(true);

  // ── Repeaters State ──
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const [repeaters, setRepeaters] = useState<RepeaterCallEntry[]>([]);
  const [repeaterSummary, setRepeaterSummary] = useState<RepeaterSummary | null>(null);
  const [repPage, setRepPage] = useState(1);
  const [repTotalPages, setRepTotalPages] = useState(1);
  const [repTotal, setRepTotal] = useState(0);
  const [repGroupBy, setRepGroupBy] = useState<"equipment" | "hospital">("equipment");
  const [repMinCount, setRepMinCount] = useState(2);
  const [repDistFilter, setRepDistFilter] = useState("");
  const [expandedRepeater, setExpandedRepeater] = useState<string | null>(null);

  // ── Fetch Summary ──
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await penaltyLiveService.getSummary();
      setSummary(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load live penalty summary");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // ── Fetch Records ──
  const fetchRecords = useCallback(async (pageNum = 1) => {
    setLoadingRecords(true);
    try {
      const res = await penaltyLiveService.getRecords({
        page: pageNum, limit: 50,
        district: districtFilter, status: statusFilter,
        critical: criticalFilter, search: searchQuery,
        only_penalty: onlyPenalty,
      });
      setRecords(res.records || []);
      setRecPage(res.page || 1);
      setRecTotalPages(res.total_pages || 1);
      setRecTotal(res.total_records || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load complaint records");
    } finally {
      setLoadingRecords(false);
    }
  }, [districtFilter, statusFilter, criticalFilter, searchQuery, onlyPenalty]);

  // ── Fetch Repeaters ──
  const fetchRepeaters = useCallback(async (pageNum = 1) => {
    setLoadingRepeaters(true);
    try {
      const res = await penaltyLiveService.getRepeaters({
        page: pageNum, limit: 50,
        group_by: repGroupBy, min_count: repMinCount,
        district: repDistFilter,
      });
      setRepeaters(res.repeaters || []);
      setRepeaterSummary(res.summary || null);
      setRepPage(res.page || 1);
      setRepTotalPages(res.total_pages || 1);
      setRepTotal(res.total_records || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load repeater calls");
    } finally {
      setLoadingRepeaters(false);
    }
  }, [repGroupBy, repMinCount, repDistFilter]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "complaints") fetchRecords(1);
  }, [activeTab, districtFilter, statusFilter, criticalFilter, onlyPenalty]);

  useEffect(() => {
    if (activeTab === "repeaters") fetchRepeaters(1);
  }, [activeTab, repGroupBy, repMinCount, repDistFilter]);

  // ── Export Excel ──
  const handleExport = () => {
    if (!summary) return;
    try {
      const wb = XLSX.utils.book_new();
      const distData = (summary.districts || []).map(d => ({
        "District": d.district, "DI Name": d.di_name, "Coordinator": d.coordinator, "Zone": d.zone,
        "Open Tickets": d.open_tickets, "Penalty Calls": d.open_penalty_tickets,
        "Total Penalty (₹)": d.total_penalty, "Per Day (₹)": d.per_day_penalty,
        "MCH Per Day (₹)": d.mch_per_day, "Others Per Day (₹)": d.others_per_day,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(distData), "District Summary");
      const coordData = (summary.coordinators || []).map(c => ({
        "Coordinator": c.coordinator, "Open Tickets": c.open_tickets,
        "Penalty Calls": c.open_penalty_tickets, "Per Day (₹)": c.per_day_penalty,
        "Total Penalty (₹)": c.total_penalty,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coordData), "Coordinator Leaderboard");
      if (records.length > 0) {
        const recData = records.map(r => ({
          "Complaint ID": r.complaint_id, "District": r.district_name,
          "Hospital": r.hospital_name, "Type": r.hospital_type,
          "Equipment": r.equipment_name, "Critical": r.is_critical ? "Yes" : "No",
          "Status": r.complaint_status, "Asset Value (₹)": r.asset_value,
          "Attend Penalty (₹)": r.attend_penalty, "Delay Penalty (₹)": r.delay_penalty,
          "Per Day (₹)": r.total_per_day, "Total Penalty (₹)": r.total_penalty,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recData), "Complaint Records");
      }
      if (repeaters.length > 0) {
        const repData = repeaters.map(r => ({
          "Equipment / Bar Code": r.bar_code || r.equipment_name,
          "Hospital": r.hospital_name, "District": r.district_name,
          "Total Complaints": r.complaint_count, "Open": r.open_count, "Closed": r.closed_count,
          "Total Penalty (₹)": r.total_penalty, "Per Day (₹)": r.per_day_penalty,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repData), "Repeater Calls");
      }
      XLSX.writeFile(wb, `BEMMP_Live_Penalty_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const kpis = summary?.kpis;
  const districts = summary?.districts || [];
  const coordinators = summary?.coordinators || [];

  // ── Tab Config ──
  const TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: <Activity className="w-4 h-4" /> },
    { id: "districts", label: "Districts", icon: <Building2 className="w-4 h-4" />, badge: districts.length },
    { id: "coordinators", label: "Coordinators", icon: <Users className="w-4 h-4" />, badge: coordinators.length },
    { id: "complaints", label: "Complaint Records", icon: <Layers className="w-4 h-4" /> },
    { id: "repeaters", label: "Repeater Calls", icon: <Repeat2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 space-y-5 px-3 md:px-5 py-5 max-w-[1400px] mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm shadow-red-200 shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  BEMMP Contract Live Penalty Engine
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                RMSCL NIB-825 Contract · Real-time SLA & Penalty Computation · Zero DB Bloat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                fetchSummary();
                if (activeTab === "complaints") fetchRecords(recPage);
                if (activeTab === "repeaters") fetchRepeaters(repPage);
              }}
              disabled={loadingSummary}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50 border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs shadow-emerald-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export XLSX
            </button>
          </div>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="px-5 pb-0 flex gap-0.5 border-t border-slate-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all rounded-t-lg border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-red-600 border-red-500 bg-red-50/50"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* KPI Cards — Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Per Day Burn Rate */}
            <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-600 to-rose-700 rounded-2xl p-5 text-white shadow-sm shadow-red-200">
              <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -right-2 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-red-100 uppercase tracking-wider">Live Burn Rate</span>
                </div>
                <div className="text-3xl font-black tracking-tight">
                  {loadingSummary ? "—" : fmtINR(kpis?.total_per_day_penalty || 0)}
                </div>
                <div className="text-xs text-red-200 mt-0.5 font-medium">per day accruing right now</div>
                <div className="mt-4 pt-3 border-t border-red-500/50 grid grid-cols-2 gap-2 text-xs text-red-100">
                  <div>
                    <div className="font-bold text-white">{fmtINR(kpis?.mch_per_day_penalty || 0)}</div>
                    <div>MCH / day</div>
                  </div>
                  <div>
                    <div className="font-bold text-white">{fmtINR(kpis?.others_per_day_penalty || 0)}</div>
                    <div>Others / day</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Accumulated Penalty */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accumulated</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {loadingSummary ? "—" : fmtINR(kpis?.total_accumulated_penalty || 0)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">complete penalty to date</div>
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <div className="font-bold text-slate-800">{fmtINR(kpis?.total_attend_penalty || 0)}</div>
                  <div>Attend Penalty</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">{fmtINR(kpis?.total_delay_penalty || 0)}</div>
                  <div>Delay Penalty</div>
                </div>
              </div>
            </div>

            {/* Active Penalty Tickets */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Penalty Calls</span>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-red-600 tracking-tight">
                  {loadingSummary ? "—" : kpis?.open_penalty_tickets?.toLocaleString("en-IN")}
                </div>
                <div className="text-sm text-slate-400 font-medium">/ {kpis?.open_tickets || 0} open</div>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">generating live penalties now</div>
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <div className="font-bold text-red-600">{kpis?.critical_open_count || 0}</div>
                  <div>Critical (110%)</div>
                </div>
                <div>
                  <div className="font-bold text-purple-600">{kpis?.mch_open_count || 0}</div>
                  <div>MCH Calls</div>
                </div>
              </div>
            </div>

            {/* Total Dataset */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-slate-600" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dataset</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {loadingSummary ? "—" : kpis?.total_complaints?.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">ingested complaint records</div>
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <div className="font-bold text-emerald-600">{kpis?.closed_tickets?.toLocaleString("en-IN") || 0}</div>
                  <div>Resolved</div>
                </div>
                <div>
                  <div className="font-bold text-amber-600">{kpis?.open_tickets?.toLocaleString("en-IN") || 0}</div>
                  <div>Active</div>
                </div>
              </div>
            </div>
          </div>

          {/* Zone Breakdown Cards */}
          {!loadingSummary && (summary?.zones || []).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Zone-Wise Penalty Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(summary?.zones || []).map((z, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{z.zone || "Unassigned"}</span>
                    </div>
                    <div className="text-xl font-black text-slate-900">{fmtINR(z.total_penalty)}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{z.open_tickets} active</span>
                      <span className="font-semibold text-red-600">{fmtINR(z.per_day_penalty)}/day</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Districts Preview */}
          {!loadingSummary && districts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-slate-900">Top Penalty Districts (Today's Burn Rate)</span>
                </div>
                <button
                  onClick={() => setActiveTab("districts")}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  View All <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {districts.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{d.district}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{d.zone || "—"}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{d.coordinator || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-red-600">{fmtINR(d.per_day_penalty)}/day</div>
                      <div className="text-xs text-slate-500 mt-0.5">{d.open_penalty_tickets} penalty calls</div>
                    </div>
                    <div className="text-right shrink-0 hidden md:block">
                      <div className="text-sm font-black text-slate-900">{fmtINR(d.total_penalty)}</div>
                      <div className="text-[10px] text-slate-400">accumulated</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — DISTRICTS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "districts" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">District-Wise Live Penalty Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">{districts.length} districts · sorted by total accumulated penalty</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-3 py-3 text-left">District</th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">DI Name</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Coordinator</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Zone</th>
                  <th className="px-3 py-3 text-center">Open Calls</th>
                  <th className="px-3 py-3 text-center">Penalty Calls</th>
                  <th className="px-3 py-3 text-right hidden md:table-cell">MCH/Day</th>
                  <th className="px-3 py-3 text-right hidden md:table-cell">Others/Day</th>
                  <th className="px-3 py-3 text-right">Per Day (₹)</th>
                  <th className="px-4 py-3 text-right">Total Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingSummary ? (
                  <tr><td colSpan={11} className="py-16 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-2" />
                    <div className="text-sm text-slate-400">Computing real-time penalty...</div>
                  </td></tr>
                ) : districts.length === 0 ? (
                  <tr><td colSpan={11} className="py-12 text-center text-slate-400 text-sm">No district data found</td></tr>
                ) : districts.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3.5 text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-3.5">
                      <div className="font-bold text-slate-900">{d.district}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 md:hidden">{d.coordinator || "—"}</div>
                    </td>
                    <td className="px-3 py-3.5 text-slate-600 hidden md:table-cell">{d.di_name || "—"}</td>
                    <td className="px-3 py-3.5 text-slate-600 hidden lg:table-cell">{d.coordinator || "—"}</td>
                    <td className="px-3 py-3.5 hidden lg:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">{d.zone || "—"}</span>
                    </td>
                    <td className="px-3 py-3.5 text-center font-semibold text-slate-700">{d.open_tickets}</td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.open_penalty_tickets > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                        {d.open_penalty_tickets}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-medium text-purple-700 hidden md:table-cell">{fmtINR(d.mch_per_day)}</td>
                    <td className="px-3 py-3.5 text-right font-medium text-blue-600 hidden md:table-cell">{fmtINR(d.others_per_day)}</td>
                    <td className="px-3 py-3.5 text-right font-extrabold text-red-600">{fmtINR(d.per_day_penalty)}</td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">{fmtINR(d.total_penalty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — COORDINATORS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "coordinators" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Coordinator Penalty Leaderboard</h3>
              <p className="text-xs text-slate-500 mt-0.5">{coordinators.length} coordinators · sorted by total accumulated penalty</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {loadingSummary ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-2" />
                <div className="text-sm text-slate-400">Computing coordinator metrics...</div>
              </div>
            ) : coordinators.map((c, i) => {
              const maxPenalty = coordinators[0]?.total_penalty || 1;
              const pct = Math.round((c.total_penalty / maxPenalty) * 100);
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                    i === 0 ? "bg-amber-400 text-white" :
                    i === 1 ? "bg-slate-300 text-slate-700" :
                    i === 2 ? "bg-orange-300 text-white" :
                    "bg-slate-100 text-slate-500"
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">{c.coordinator}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-right shrink-0">
                    <div>
                      <div className="text-xs font-bold text-slate-700">{c.open_tickets}</div>
                      <div className="text-[10px] text-slate-400">open</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-red-600">{c.open_penalty_tickets}</div>
                      <div className="text-[10px] text-slate-400">penalty</div>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-red-700">{fmtINR(c.per_day_penalty)}</div>
                      <div className="text-[10px] text-slate-400">/ day</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-28 hidden md:block">
                    <div className="text-sm font-black text-slate-900">{fmtINR(c.total_penalty)}</div>
                    <div className="text-[10px] text-slate-400">total accumulated</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4 — COMPLAINT RECORDS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "complaints" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Complaint ID, Hospital, Equipment..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && fetchRecords(1)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all"
                />
              </div>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="">All Districts</option>
                {districts.map((d, i) => <option key={i} value={d.district}>{d.district}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="open">Open / Pending Only</option>
                <option value="closed">Resolved / Closed Only</option>
                <option value="all">All Statuses</option>
              </select>
              <select
                value={criticalFilter}
                onChange={e => setCriticalFilter(e.target.value as any)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="">All Equipment Types</option>
                <option value="yes">Critical Only (+10%)</option>
                <option value="no">Non-Critical Only</option>
              </select>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={onlyPenalty}
                    onChange={e => setOnlyPenalty(e.target.checked)}
                    className="w-3 h-3 rounded accent-red-600"
                  />
                  Penalty &gt; 0
                </label>
                <button
                  onClick={() => fetchRecords(1)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Filter className="w-3 h-3" /> Apply
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Showing {recTotal.toLocaleString("en-IN")} records · Page {recPage} of {recTotalPages}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Complaint ID</th>
                    <th className="px-3 py-3 text-left">District / Hospital</th>
                    <th className="px-3 py-3 text-left hidden md:table-cell">Equipment</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center hidden lg:table-cell">Type / Crit.</th>
                    <th className="px-3 py-3 text-right hidden lg:table-cell">Downtime Days</th>
                    <th className="px-3 py-3 text-right hidden md:table-cell">Attend (₹)</th>
                    <th className="px-3 py-3 text-right hidden md:table-cell">Delay (₹)</th>
                    <th className="px-3 py-3 text-right">Per Day (₹)</th>
                    <th className="px-4 py-3 text-right">Total Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingRecords ? (
                    <tr><td colSpan={10} className="py-16 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-2" />
                      <div className="text-sm text-slate-400">Loading complaint penalty records...</div>
                    </td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={10} className="py-12 text-center">
                      <Target className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <div className="text-sm text-slate-400">No records match the selected filters</div>
                    </td></tr>
                  ) : records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[11px]">{r.complaint_id}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800 truncate max-w-[160px]" title={r.hospital_name}>{r.hospital_name}</div>
                        <div className="text-[10px] text-slate-400">{r.district_name}</div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="font-medium text-slate-700 truncate max-w-[150px]" title={r.equipment_name}>{r.equipment_name}</div>
                        <div className="text-[10px] text-slate-400">₹{r.asset_value.toLocaleString("en-IN")} · slab ₹{r.penalty_slab}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          r.status === "Open" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>{r.complaint_status || r.status}</span>
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.hospital_type === "MCH" ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"}`}>
                            {r.hospital_type}
                          </span>
                          {r.is_critical && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">CRIT</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 hidden lg:table-cell">{r.penalty_down_days}d</td>
                      <td className="px-3 py-3 text-right text-slate-600 hidden md:table-cell">{r.attend_penalty > 0 ? fmtINRFull(r.attend_penalty) : "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-600 hidden md:table-cell">{r.delay_penalty > 0 ? fmtINRFull(r.delay_penalty) : "—"}</td>
                      <td className="px-3 py-3 text-right font-extrabold text-red-600">
                        {r.total_per_day > 0 ? fmtINRFull(r.total_per_day) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        {r.total_penalty > 0 ? fmtINRFull(r.total_penalty) : <span className="text-slate-400 font-normal">₹0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {recTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">Page {recPage} of {recTotalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchRecords(recPage - 1)}
                    disabled={recPage <= 1 || loadingRecords}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => fetchRecords(recPage + 1)}
                    disabled={recPage >= recTotalPages || loadingRecords}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5 — REPEATER CALLS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "repeaters" && (
        <div className="space-y-4">
          {/* Repeater KPI Strip */}
          {repeaterSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Repeater Groups", value: repeaterSummary.total_repeater_groups.toLocaleString("en-IN"), icon: <Repeat2 className="w-3.5 h-3.5" />, color: "text-violet-600", bg: "bg-violet-50" },
                { label: "Total Complaints", value: repeaterSummary.total_repeater_complaints.toLocaleString("en-IN"), icon: <Layers className="w-3.5 h-3.5" />, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Active Repeaters", value: repeaterSummary.active_repeaters.toLocaleString("en-IN"), icon: <Activity className="w-3.5 h-3.5" />, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Total Penalty", value: fmtINR(repeaterSummary.total_repeater_penalty), icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-red-600", bg: "bg-red-50" },
                { label: "Per Day Burn", value: fmtINR(repeaterSummary.total_repeater_per_day), icon: <Zap className="w-3.5 h-3.5" />, color: "text-red-700", bg: "bg-red-50" },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.color} shrink-0`}>{s.icon}</div>
                  <div className="min-w-0">
                    <div className={`text-base font-black ${s.color} leading-tight`}>{s.value}</div>
                    <div className="text-[10px] text-slate-500 truncate">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Group By:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              <button
                onClick={() => setRepGroupBy("equipment")}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${repGroupBy === "equipment" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Equipment / Barcode
              </button>
              <button
                onClick={() => setRepGroupBy("hospital")}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${repGroupBy === "hospital" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Hospital
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Min Complaints:</span>
              {[2, 3, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setRepMinCount(n)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${repMinCount === n ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {n}+
                </button>
              ))}
            </div>
            <select
              value={repDistFilter}
              onChange={e => setRepDistFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-200 bg-white ml-auto"
            >
              <option value="">All Districts</option>
              {districts.map((d, i) => <option key={i} value={d.district}>{d.district}</option>)}
            </select>
            <div className="text-xs text-slate-400">{repTotal.toLocaleString("en-IN")} repeater groups</div>
          </div>

          {/* Repeater Cards */}
          <div className="space-y-2.5">
            {loadingRepeaters ? (
              <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center shadow-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-2" />
                <div className="text-sm text-slate-400">Scanning for repeater patterns...</div>
              </div>
            ) : repeaters.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-500">No repeater calls found</div>
                <div className="text-xs text-slate-400 mt-1">Try lowering the minimum count filter</div>
              </div>
            ) : repeaters.map((r, i) => {
              const isExpanded = expandedRepeater === r.group_key;
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden hover:border-slate-300 transition-colors">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedRepeater(isExpanded ? null : r.group_key)}
                  >
                    {/* Repeat Count Badge */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black ${
                      r.complaint_count >= 10 ? "bg-red-600 text-white" :
                      r.complaint_count >= 5 ? "bg-amber-500 text-white" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      <span className="text-lg leading-tight">{r.complaint_count}</span>
                      <span className="text-[9px] font-semibold opacity-80">calls</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">
                          {repGroupBy === "hospital" ? r.hospital_name : (r.equipment_name || r.bar_code)}
                        </span>
                        {r.is_critical && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 shrink-0">CRITICAL</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${r.hospital_type === "MCH" ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"}`}>
                          {r.hospital_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                        {repGroupBy !== "hospital" && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {r.hospital_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {r.district_name}
                        </span>
                        {r.bar_code && repGroupBy !== "hospital" && (
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">BC: {r.bar_code}</span>
                        )}
                        {r.coordinator_name && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Users className="w-3 h-3" />
                            {r.coordinator_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-right shrink-0 hidden md:grid">
                      <div>
                        <div className="text-xs font-bold text-amber-600 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />{r.open_count}
                        </div>
                        <div className="text-[10px] text-slate-400">open now</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-red-600">{fmtINR(r.per_day_penalty)}/day</div>
                        <div className="text-[10px] text-slate-400">live burn rate</div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{fmtINR(r.total_penalty)}</div>
                        <div className="text-[10px] text-slate-400">total penalty</div>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className={`w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="md:hidden px-4 pb-3 -mt-1 flex items-center gap-4 text-xs">
                    <span className="text-amber-600 font-bold">{r.open_count} open</span>
                    <span className="text-red-600 font-extrabold">{fmtINR(r.per_day_penalty)}/day</span>
                    <span className="text-slate-900 font-black ml-auto">{fmtINR(r.total_penalty)} total</span>
                  </div>

                  {/* Expanded: Recent Complaints */}
                  {isExpanded && r.recent_complaints && r.recent_complaints.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Recent {r.recent_complaints.length} of {r.complaint_count} Complaints
                      </div>
                      <div className="space-y-1.5">
                        {r.recent_complaints.map((rc, j) => (
                          <div key={j} className="flex items-center gap-3 text-xs bg-white border border-slate-100 rounded-lg px-3 py-2">
                            <span className="font-mono font-bold text-slate-700 shrink-0">{rc.complaint_id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              rc.status === "Open" || rc.status === "Pending" || rc.status === "Attended"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>{rc.status}</span>
                            <span className="text-slate-400 hidden sm:inline shrink-0">{rc.raise_date?.slice(0, 11)}</span>
                            <span className="ml-auto font-bold text-slate-700 shrink-0">{rc.total_penalty > 0 ? fmtINRFull(rc.total_penalty) : "₹0"}</span>
                            {rc.per_day > 0 && (
                              <span className="font-extrabold text-red-600 shrink-0">+{fmtINR(rc.per_day)}/day</span>
                            )}
                            {rc.downtime_days > 0 && (
                              <span className="text-slate-400 hidden lg:inline shrink-0">{rc.downtime_days}d down</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Repeater Pagination */}
          {repTotalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
              <span className="text-xs text-slate-500">Page {repPage} of {repTotalPages} ({repTotal.toLocaleString("en-IN")} groups)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchRepeaters(repPage - 1)} disabled={repPage <= 1 || loadingRepeaters}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button onClick={() => fetchRepeaters(repPage + 1)} disabled={repPage >= repTotalPages || loadingRepeaters}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
