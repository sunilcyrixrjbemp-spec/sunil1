import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldAlert, RefreshCw, Download, TrendingUp,
  Zap, Activity, Building2,
  ChevronDown, ChevronUp, Search, Filter,
  Repeat2, MapPin, Star, BarChart3, Target, Flame,
  ChevronLeft, ChevronRight,
  FileSpreadsheet, Eye, HelpCircle,
  X, Check, ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  penaltyLiveService,
  LivePenaltySummaryResponse,
  LivePenaltyRecordsResponse,
  LivePenaltyRepeatersResponse,
  LivePenaltyStandbyWaiversResponse,
  DistrictPenaltyStat,
  RepeaterCallEntry,
  ComplaintPenaltyRecord,
  CoordinatorPenaltyStat,
  ZonePenaltyStat
} from "../services/penaltyLiveService";
import { SaaSBarChart, SaaSDonutChart } from "../components/common/SaaSCharts";

const INR = "\u20b9";

const fmtINR = (n: number) => {
  if (n >= 1_00_00_000) return `${INR}${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${INR}${(n / 1_00_00_000 * 100).toFixed(2)} L`;
  if (n >= 1_000) return `${INR}${(n / 1_000).toFixed(1)} K`;
  return `${INR}${n.toLocaleString("en-IN")}`;
};

const fmtFull = (n: number) =>
  `${INR}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function PenaltyModulePage() {
  // ─── Master View Tabs ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"overview" | "districts" | "standby" | "repeaters" | "ledger">("overview");

  // ─── Data State ─────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<LivePenaltySummaryResponse | null>(null);
  const [records, setRecords] = useState<LivePenaltyRecordsResponse | null>(null);
  const [repeaters, setRepeaters] = useState<LivePenaltyRepeatersResponse | null>(null);
  const [waivers, setWaivers] = useState<LivePenaltyStandbyWaiversResponse | null>(null);

  // ─── Loading Flags ──────────────────────────────────────────────────────────
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const [loadingWaivers, setLoadingWaivers] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ─── Quick Preset Filter ────────────────────────────────────────────────────
  const [quickPreset, setQuickPreset] = useState<"all" | "incurring" | "critical" | "mch" | "standby" | "unattended">("all");

  // ─── Ledger Multi-Filter State ──────────────────────────────────────────────
  const [recSearch, setRecSearch] = useState("");
  const [recDistrict, setRecDistrict] = useState("");
  const [recZone, setRecZone] = useState("");
  const [recHospType, setRecHospType] = useState<"" | "MCH" | "Others">("");
  const [recStatus, setRecStatus] = useState<"" | "open" | "closed">("");
  const [recCritical, setRecCritical] = useState<"" | "yes" | "no">("");
  const [recStandby, setRecStandby] = useState<"" | "yes" | "no">("");
  const [recWarranty, setRecWarranty] = useState<"" | "yes" | "no">("");
  const [recOnlyPenalty, setRecOnlyPenalty] = useState(false);
  const [recPage, setRecPage] = useState(1);
  const REC_LIMIT = 50;

  // ─── Repeater Filters ───────────────────────────────────────────────────────
  const [repMinCount, setRepMinCount] = useState(2);
  const [repDistrict, setRepDistrict] = useState("");
  const [expandedRepeaters, setExpandedRepeaters] = useState<Set<string>>(new Set());

  // ─── Standby Tab State ──────────────────────────────────────────────────────
  const [standbyTypeFilter, setStandbyTypeFilter] = useState<"all" | "standby" | "warranty">("all");
  const [standbyInputId, setStandbyInputId] = useState("");
  const [togglingStandby, setTogglingStandby] = useState(false);

  // ─── District Sort ──────────────────────────────────────────────────────────
  const [distSort, setDistSort] = useState<"penalty" | "perday" | "calls" | "waived">("penalty");

  // ─── CA Calculation Inspector Modal ─────────────────────────────────────────
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<ComplaintPenaltyRecord | null>(null);
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);

  // ─── Live Clock ─────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async (force = false) => {
    setLoadingSummary(true);
    try {
      const data = await penaltyLiveService.getSummary({ force });
      setSummary(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      toast.error("Failed to load live summary: " + (e.message || "error"));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchRecords = useCallback(async (page = 1) => {
    setLoadingRecords(true);
    try {
      const data = await penaltyLiveService.getRecords({
        page,
        limit: REC_LIMIT,
        search: recSearch || undefined,
        district: recDistrict || undefined,
        zone: recZone || undefined,
        hospital_type: recHospType || undefined,
        status: recStatus || "all",
        critical: recCritical || undefined,
        standby: recStandby || undefined,
        warranty: recWarranty || undefined,
        only_penalty: recOnlyPenalty || undefined,
      });
      setRecords(data);
      setRecPage(page);
    } catch (e: any) {
      toast.error("Failed to load records: " + (e.message || "error"));
    } finally {
      setLoadingRecords(false);
    }
  }, [recSearch, recDistrict, recZone, recHospType, recStatus, recCritical, recStandby, recWarranty, recOnlyPenalty]);

  const fetchRepeaters = useCallback(async () => {
    setLoadingRepeaters(true);
    try {
      const data = await penaltyLiveService.getRepeaters({
        group_by: "equipment",
        min_count: repMinCount,
        district: repDistrict || undefined,
        limit: 100,
      });
      setRepeaters(data);
    } catch (e: any) {
      toast.error("Failed to load repeaters: " + (e.message || "error"));
    } finally {
      setLoadingRepeaters(false);
    }
  }, [repMinCount, repDistrict]);

  const fetchWaivers = useCallback(async () => {
    setLoadingWaivers(true);
    try {
      const data = await penaltyLiveService.getStandbyWaivers({
        type: standbyTypeFilter,
        limit: 100,
      });
      setWaivers(data);
    } catch (e: any) {
      toast.error("Failed to load waiver records: " + (e.message || "error"));
    } finally {
      setLoadingWaivers(false);
    }
  }, [standbyTypeFilter]);

  // Initial Load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Tab-based Lazy Loading
  useEffect(() => {
    if (activeTab === "ledger" && !records) {
      fetchRecords(1);
    } else if (activeTab === "repeaters" && !repeaters) {
      fetchRepeaters();
    } else if (activeTab === "standby" && !waivers) {
      fetchWaivers();
    }
  }, [activeTab, records, repeaters, waivers, fetchRecords, fetchRepeaters, fetchWaivers]);

  // Re-fetch triggers
  useEffect(() => {
    if (activeTab === "repeaters") fetchRepeaters();
  }, [repMinCount, repDistrict, activeTab, fetchRepeaters]);

  useEffect(() => {
    if (activeTab === "standby") fetchWaivers();
  }, [standbyTypeFilter, activeTab, fetchWaivers]);

  const handleRefreshAll = () => {
    fetchSummary(true);
    if (activeTab === "ledger") fetchRecords(recPage);
    if (activeTab === "repeaters") fetchRepeaters();
    if (activeTab === "standby") fetchWaivers();
    toast.success("Live NIB-825 penalty calculations refreshed!");
  };

  // ─── Quick Preset Handlers ──────────────────────────────────────────────────
  const applyQuickPreset = (preset: "all" | "incurring" | "critical" | "mch" | "standby" | "unattended") => {
    setQuickPreset(preset);
    setActiveTab("ledger");

    if (preset === "all") {
      setRecOnlyPenalty(false);
      setRecCritical("");
      setRecHospType("");
      setRecStandby("");
      setRecStatus("");
    } else if (preset === "incurring") {
      setRecOnlyPenalty(true);
      setRecCritical("");
      setRecHospType("");
      setRecStandby("");
      setRecStatus("open");
    } else if (preset === "critical") {
      setRecOnlyPenalty(false);
      setRecCritical("yes");
      setRecHospType("");
      setRecStandby("");
      setRecStatus("open");
    } else if (preset === "mch") {
      setRecOnlyPenalty(false);
      setRecCritical("");
      setRecHospType("MCH");
      setRecStandby("");
      setRecStatus("open");
    } else if (preset === "standby") {
      setRecOnlyPenalty(false);
      setRecCritical("");
      setRecHospType("");
      setRecStandby("yes");
      setRecStatus("");
    } else if (preset === "unattended") {
      setRecOnlyPenalty(false);
      setRecCritical("");
      setRecHospType("");
      setRecStandby("");
      setRecStatus("open");
    }
    fetchRecords(1);
  };

  // ─── Toggle Standby Action ──────────────────────────────────────────────────
  const handleQuickStandbyToggle = async (complaintId: string) => {
    if (!complaintId.trim()) {
      toast.error("Please enter a valid Complaint ID");
      return;
    }
    setTogglingStandby(true);
    try {
      const res = await penaltyLiveService.toggleStandby(complaintId.trim(), "toggle");
      if (res.is_standby) {
        toast.success(`✓ Standby Provided for #${complaintId}! Delay penalty waived.`);
      } else {
        toast.success(`Standby removed for #${complaintId}. Penalty resumed.`);
      }
      setStandbyInputId("");
      fetchSummary(true);
      fetchWaivers();
      if (records) fetchRecords(recPage);
    } catch (err: any) {
      toast.error(err.message || "Failed to update standby status");
    } finally {
      setTogglingStandby(false);
    }
  };

  // ─── Export to Excel ────────────────────────────────────────────────────────
  const handleExportFull = async () => {
    const tid = toast.loading("Exporting complete CA forensic audit ledger...");
    try {
      const all = await penaltyLiveService.getRecords({ page: 1, limit: 99999, status: "all" });
      const rows = all.records.map((r: ComplaintPenaltyRecord, i: number) => ({
        "S.No": i + 1,
        "Complaint ID": r.complaint_id,
        "District": r.district_name,
        "Zone": r.zone_name,
        "Hospital Name": r.hospital_name,
        "Facility Category": r.hospital_type,
        "Equipment Name": r.equipment_name,
        "Barcode": r.bar_code,
        "Complaint Status": r.complaint_status,
        "Critical (ICU/OT)": r.is_critical ? "Yes (+10% Surcharge)" : "No",
        "Estimated Asset Value (₹)": r.asset_value,
        "Contractual Penalty Slab (₹/day)": r.penalty_slab,
        "Complaint Raise Date (IST)": r.complaint_raise_date,
        "Engineer Attend Date (IST)": r.attend_date,
        "Complaint Close Date (IST)": r.complaint_close_date,
        "Attend SLA (Hours)": r.attend_sla_hours || (r.hospital_type === "MCH" ? 1 : 24),
        "Attend Time Taken (Hours)": r.attend_hour_diff,
        "Attendance Penalty (₹)": r.attend_penalty,
        "Total Downtime (Days)": r.penalty_down_days,
        "Resolution Grace SLA (Hours)": r.grace_hours || (r.hospital_type === "MCH" ? 6 : 48),
        "Standby Machine Provided": r.standby,
        "Under OEM Warranty": r.is_under_warranty,
        "Exemption Applied": r.waiver_type || (r.standby === "Yes" ? "Standby" : r.is_under_warranty === "Yes" ? "Warranty" : "None"),
        "Waived Delay Penalty (₹)": r.waived_penalty || 0,
        "Payable Delay Penalty (₹)": r.delay_penalty,
        "Final Net Payable Penalty (₹)": r.total_penalty,
        "Active Daily Burn Rate (₹/day)": r.total_per_day,
        "District In-Charge (DI)": r.di_name,
        "Zonal Coordinator": r.coordinator_name,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RMSCL BEMMP Penalty Audit");
      XLSX.writeFile(wb, `RMSCL_BEMMP_Penalty_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.dismiss(tid);
      toast.success(`Exported ${rows.length.toLocaleString()} verified audit records!`);
    } catch {
      toast.dismiss(tid);
      toast.error("Export failed");
    }
  };

  // ─── Derived Data ───────────────────────────────────────────────────────────
  const kpis = summary?.kpis;
  const districts = useMemo(() => {
    return [...(summary?.districts || [])].sort((a: DistrictPenaltyStat, b: DistrictPenaltyStat) => {
      if (distSort === "penalty") return b.total_penalty - a.total_penalty;
      if (distSort === "perday") return b.per_day_penalty - a.per_day_penalty;
      if (distSort === "waived") return (b.waived_penalty || 0) - (a.waived_penalty || 0);
      return b.open_tickets - a.open_tickets;
    });
  }, [summary?.districts, distSort]);

  const maxDistPenalty = Math.max(...districts.map((d: DistrictPenaltyStat) => d.total_penalty), 1);

  const distBarData = useMemo(() => {
    return districts.slice(0, 10).map((d: DistrictPenaltyStat) => ({
      name: d.district.length > 9 ? d.district.slice(0, 8) + "\u2026" : d.district,
      amount: d.total_penalty,
    }));
  }, [districts]);

  const zoneDonutData = useMemo(() => {
    return (summary?.zones || []).map((z: ZonePenaltyStat) => ({
      name: z.zone || "Unassigned",
      value: z.total_penalty,
    }));
  }, [summary?.zones]);

  const coordList = useMemo(() => {
    return [...(summary?.coordinators || [])].sort((a: CoordinatorPenaltyStat, b: CoordinatorPenaltyStat) => b.total_penalty - a.total_penalty).slice(0, 6);
  }, [summary?.coordinators]);

  const toggleRepeater = (key: string) => {
    setExpandedRepeaters((prev: Set<string>) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  // ─── Status Badge Helper ────────────────────────────────────────────────────
  const StatusBadge = ({ s }: { s: string }) => {
    const lc = (s || "").toLowerCase();
    const cls =
      lc.includes("engineer closed") ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
      lc.includes("final") ? "bg-slate-100 text-slate-700 border-slate-300" :
      lc.includes("open") || lc.includes("pending") ? "bg-rose-100 text-rose-700 border-rose-300 font-black" :
      lc.includes("re-open") ? "bg-amber-100 text-amber-800 border-amber-300 font-black" :
      "bg-blue-100 text-blue-800 border-blue-300";
    return <span className={`px-2 py-0.5 text-[9px] font-black uppercase border rounded ${cls}`}>{s}</span>;
  };

  return (
    <div className="space-y-3 animate-fadeIn text-slate-800 font-sans p-3 sm:p-4 bg-[#f8fafc] min-h-screen">

      {/* ══════════════════════════════════════════════════════════════════════
          1. ENTERPRISE TELEMETRY HEADER & COMMAND BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-600 to-red-700 text-white rounded-lg shadow-md shadow-rose-900/40">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black tracking-wider uppercase text-white">
                BEMMP Rajasthan Contractual Penalty & SLA Audit Suite
              </h1>
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-mono font-bold rounded border border-rose-500/30">
                RMSCL NIB-825 Certified
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Engine Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
              <span>IST Clock: <strong className="text-slate-200 font-mono">{currentTime.toLocaleTimeString("en-IN")}</strong></span>
              <span>·</span>
              <span>Total Tracked Database Calls: <strong className="text-slate-200 font-mono">{kpis ? kpis.total_complaints.toLocaleString() : "..."}</strong></span>
              {lastRefresh && (
                <>
                  <span>·</span>
                  <span>Last Computed: <strong className="text-slate-300 font-mono">{lastRefresh.toLocaleTimeString("en-IN")}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFormulaGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-slate-600"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            CA Rules & Slabs
          </button>
          <button
            onClick={() => handleRefreshAll()}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loadingSummary ? "animate-spin" : ""}`} />
            Recalculate Live
          </button>
          <button
            onClick={handleExportFull}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-md shadow-emerald-950 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CA Audit (Excel)
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. QUICK PRESET FILTER CHIPS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
        <span className="text-[10px] font-black uppercase text-slate-400 mr-1 shrink-0 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" /> Quick Focus:
        </span>

        {[
          { id: "all", label: "All Complaints", count: kpis?.total_complaints, color: "bg-slate-800 text-white" },
          { id: "incurring", label: "🚨 Incurring Penalty (> ₹0)", count: kpis?.open_penalty_tickets, color: "bg-rose-600 text-white" },
          { id: "critical", label: "⚡ Critical ICU/OT Open", count: kpis?.critical_open_count, color: "bg-purple-600 text-white" },
          { id: "mch", label: "🏥 MCH High-Priority (12h)", count: kpis?.mch_open_count, color: "bg-emerald-600 text-white" },
          { id: "standby", label: "🛡️ Standby Exempted", count: kpis?.standby_count, color: "bg-teal-600 text-white" },
          { id: "unattended", label: "⏳ Open Tickets Pending", count: kpis?.open_tickets, color: "bg-blue-600 text-white" },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => applyQuickPreset(p.id as any)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
              quickPreset === p.id
                ? `${p.color} border-transparent shadow-xs font-black`
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>{p.label}</span>
            {p.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${quickPreset === p.id ? "bg-black/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {p.count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. EXECUTIVE DENSE KPI METRICS GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {/* Card 1: Total Accumulated Penalty */}
        <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs border-t-4 border-t-rose-600 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>Total Penalty</span>
            <Flame className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg font-black font-mono text-rose-700 mt-1 truncate">
            {kpis ? fmtINR(kpis.total_accumulated_penalty) : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Attend: {kpis ? fmtINR(kpis.total_attend_penalty) : "—"}</span>
            <span>Delay: {kpis ? fmtINR(kpis.total_delay_penalty) : "—"}</span>
          </div>
        </div>

        {/* Card 2: Daily Burn Rate */}
        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs border-t-4 border-t-amber-500 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>Daily Burn Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-black font-mono text-amber-700 mt-1 truncate">
            {kpis ? fmtINR(kpis.total_per_day_penalty) : "—"}
          </div>
          <div className="text-[10px] text-amber-600 font-bold mt-0.5 truncate">
            {kpis ? `30-Day Proj: ${fmtINR(kpis.total_per_day_penalty * 30)}` : "Live accumulating"}
          </div>
        </div>

        {/* Card 3: Open Tickets */}
        <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs border-t-4 border-t-blue-600 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>Open Tickets</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-black font-mono text-slate-900 mt-1 truncate">
            {kpis ? kpis.open_tickets.toLocaleString() : "—"}
          </div>
          <div className="text-[10px] text-rose-600 font-bold mt-0.5 truncate">
            {kpis ? `${kpis.open_penalty_tickets} incurring live penalty` : ""}
          </div>
        </div>

        {/* Card 4: Critical Open */}
        <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs border-t-4 border-t-purple-600 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>Critical ICU/OT</span>
            <Star className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-lg font-black font-mono text-purple-800 mt-1 truncate">
            {kpis ? kpis.critical_open_count.toLocaleString() : "—"}
          </div>
          <div className="text-[10px] text-purple-600 font-bold mt-0.5 truncate">
            +10% Surcharge Applied
          </div>
        </div>

        {/* Card 5: MCH Daily Burn */}
        <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs border-t-4 border-t-emerald-600 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>MCH Burn / Day</span>
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-700 mt-1 truncate">
            {kpis ? fmtINR(kpis.mch_per_day_penalty) : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {kpis ? `${kpis.mch_open_count} MCH open (12h SLA × 2)` : ""}
          </div>
        </div>

        {/* Card 6: Others Daily Burn */}
        <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs border-t-4 border-t-indigo-600 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>DH / CHC Burn / Day</span>
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-lg font-black font-mono text-indigo-700 mt-1 truncate">
            {kpis ? fmtINR(kpis.others_per_day_penalty) : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {kpis ? `${kpis.others_open_count} open (24h SLA)` : ""}
          </div>
        </div>

        {/* Card 7: Standby Savings / Waived */}
        <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-xs border-t-4 border-t-teal-600 col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase">
            <span>Standby Savings</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg font-black font-mono text-teal-700 mt-1 truncate">
            {kpis ? fmtINR(kpis.standby_waived_penalty || 0) : "—"}
          </div>
          <div className="text-[10px] text-teal-600 font-bold mt-0.5 truncate">
            {kpis ? `${kpis.standby_count || 0} standby machines active` : ""}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. ENTERPRISE NAVIGATION SUITE TABS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex items-center gap-1 shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
            activeTab === "overview"
              ? "bg-[#0f172a] text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4 text-rose-400" />
          1. Executive Operations & Risk Heatmap
        </button>

        <button
          onClick={() => setActiveTab("districts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
            activeTab === "districts"
              ? "bg-[#0f172a] text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <MapPin className="w-4 h-4 text-blue-400" />
          2. District & Territory Performance ({districts.length})
        </button>

        <button
          onClick={() => setActiveTab("standby")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
            activeTab === "standby"
              ? "bg-[#0f172a] text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          3. Standby & Waiver Protection Center
          {kpis?.standby_count ? (
            <span className="ml-1 px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full text-[10px] font-mono">
              {kpis.standby_count}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("repeaters")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
            activeTab === "repeaters"
              ? "bg-[#0f172a] text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Repeat2 className="w-4 h-4 text-amber-400" />
          4. Asset Degradation & Chronic Repeaters
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
            activeTab === "ledger"
              ? "bg-[#0f172a] text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          5. Forensic CA Audit Ledger
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: EXECUTIVE OPERATIONS & RISK HEATMAP
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {/* Top 10 Districts Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Top 10 High-Exposure Districts (Total Accumulated Penalty)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Live Contract Engine</span>
              </div>
              {distBarData.length > 0 ? (
                <SaaSBarChart data={distBarData} height={210} />
              ) : (
                <div className="h-[210px] flex items-center justify-center text-slate-400 text-xs font-bold">
                  {loadingSummary ? "Calculating live penalty..." : "No data available"}
                </div>
              )}
            </div>

            {/* Zone Distribution Donut */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">
                    Zonal Penalty Distribution
                  </h3>
                </div>
                {zoneDonutData.length > 0 ? (
                  <SaaSDonutChart data={zoneDonutData} height={140} />
                ) : (
                  <div className="h-[140px] flex items-center justify-center text-slate-400 text-xs font-bold">
                    {loadingSummary ? "Loading..." : "No data"}
                  </div>
                )}
              </div>

              {/* Coordinator Ranking */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Top Coordinators by Exposure</span>
                {coordList.slice(0, 3).map((c: CoordinatorPenaltyStat, i: number) => (
                  <div key={c.coordinator} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-bold truncate max-w-[140px]">
                      <span className="text-slate-400 font-mono mr-1">#{i + 1}</span>
                      {c.coordinator}
                    </span>
                    <span className="font-mono font-black text-rose-600 text-[11px]">{fmtINR(c.total_penalty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CA SLA Rules & Contract Slabs Reference */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-[#0f172a] text-white px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                RMSCL NIB-825 Contractual SLA & Penalty Slab Matrix
              </span>
              <span className="text-[10px] text-slate-300 font-mono">Government Contract Rules</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-900 uppercase text-[11px]">Medical College Hospitals (MCH)</span>
                  <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 text-[9px] font-black rounded">12h Period</span>
                </div>
                <div className="text-slate-700 space-y-1 text-[11px]">
                  <div>• <strong>Attend SLA:</strong> 1 Hour (₹500/day after 1h)</div>
                  <div>• <strong>Resolution Grace:</strong> 6 Hours</div>
                  <div>• <strong>Delay Slab:</strong> 2x Daily Rate (2 periods/day)</div>
                  <div>• <strong>Critical Surcharge:</strong> +10% on ICU/OT</div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-blue-900 uppercase text-[11px]">District Hospitals (DH / SDH)</span>
                  <span className="px-1.5 py-0.5 bg-blue-200 text-blue-900 text-[9px] font-black rounded">24h Period</span>
                </div>
                <div className="text-slate-700 space-y-1 text-[11px]">
                  <div>• <strong>Attend SLA:</strong> 24 Hours (₹500/day after 24h)</div>
                  <div>• <strong>Resolution Grace:</strong> 48 Hours</div>
                  <div>• <strong>Delay Slab:</strong> 1x Daily Rate (1 period/day)</div>
                  <div>• <strong>Critical Surcharge:</strong> +10% on ICU/OT</div>
                </div>
              </div>

              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-purple-900 uppercase text-[11px]">Community Centers (CHC / PHC)</span>
                  <span className="px-1.5 py-0.5 bg-purple-200 text-purple-900 text-[9px] font-black rounded">24h Period</span>
                </div>
                <div className="text-slate-700 space-y-1 text-[11px]">
                  <div>• <strong>Attend SLA:</strong> 24 Hours</div>
                  <div>• <strong>Resolution Grace:</strong> 72 Hours</div>
                  <div>• <strong>Standby Waiver:</strong> ₹0 Delay Penalty if standby given</div>
                  <div>• <strong>Warranty Exemption:</strong> ₹0 if under OEM warranty</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 2: DISTRICT & TERRITORY PERFORMANCE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "districts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
          <div className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-black uppercase tracking-wider">Territory Performance & Zonal Leaderboard</h3>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400 mr-1 font-bold">Sort By:</span>
              {(["penalty", "perday", "calls", "waived"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setDistSort(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all ${
                    distSort === s ? "bg-white text-slate-900 shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {s === "penalty" ? "Total Penalty" : s === "perday" ? "Daily Burn" : s === "waived" ? "Standby Waived" : "Open Calls"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Zone</th>
                  <th className="py-2.5 px-3">Coordinator / DI</th>
                  <th className="py-2.5 px-3 text-center">Open Calls</th>
                  <th className="py-2.5 px-3 text-center">Pen. Calls</th>
                  <th className="py-2.5 px-3 text-right">MCH / Day</th>
                  <th className="py-2.5 px-3 text-right">DH/CHC / Day</th>
                  <th className="py-2.5 px-3 text-right">Standby Waived</th>
                  <th className="py-2.5 px-3 text-right">Total Penalty</th>
                  <th className="py-2.5 px-3 text-right">Daily Burn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {districts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                      {loadingSummary ? "Calculating territory statistics..." : "No district data available"}
                    </td>
                  </tr>
                ) : (
                  districts.map((d: DistrictPenaltyStat, idx: number) => (
                    <tr key={d.district} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-black text-slate-900">{d.district}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black rounded">
                          {d.zone || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium truncate max-w-[130px]">
                        {d.coordinator || d.di_name || "—"}
                      </td>
                      <td className="py-2 px-3 text-center font-black" style={{ color: d.open_tickets > 0 ? "#e11d48" : "#94a3b8" }}>
                        {d.open_tickets}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-amber-600">
                        {d.open_penalty_tickets}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                        {d.mch_per_day > 0 ? fmtINR(d.mch_per_day) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-700 font-bold">
                        {d.others_per_day > 0 ? fmtINR(d.others_per_day) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-teal-700 font-bold">
                        {d.waived_penalty && d.waived_penalty > 0 ? fmtINR(d.waived_penalty) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="font-mono font-black text-rose-700">{fmtINR(d.total_penalty)}</div>
                        <MiniBar value={d.total_penalty} max={maxDistPenalty} color="#e11d48" />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-amber-700">
                        {d.per_day_penalty > 0 ? fmtINR(d.per_day_penalty) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {districts.length > 0 && (
                <tfoot className="sticky bottom-0 bg-[#0f172a] text-white text-xs font-black z-10">
                  <tr>
                    <td className="py-3 px-3" colSpan={4}>TOTAL ({districts.length} Districts)</td>
                    <td className="py-3 px-3 text-center">{districts.reduce((s: number, d: DistrictPenaltyStat) => s + d.open_tickets, 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-center">{districts.reduce((s: number, d: DistrictPenaltyStat) => s + d.open_penalty_tickets, 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-300">{fmtINR(districts.reduce((s: number, d: DistrictPenaltyStat) => s + d.mch_per_day, 0))}</td>
                    <td className="py-3 px-3 text-right font-mono text-blue-300">{fmtINR(districts.reduce((s: number, d: DistrictPenaltyStat) => s + d.others_per_day, 0))}</td>
                    <td className="py-3 px-3 text-right font-mono text-teal-300">{fmtINR(districts.reduce((s: number, d: DistrictPenaltyStat) => s + (d.waived_penalty || 0), 0))}</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-300">{fmtINR(kpis?.total_accumulated_penalty ?? 0)}</td>
                    <td className="py-3 px-3 text-right font-mono text-amber-300">{fmtINR(kpis?.total_per_day_penalty ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 3: STANDBY & WAIVER PROTECTION CENTER
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "standby" && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Quick Register / Standby Tool */}
          <div className="bg-white rounded-xl border border-teal-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-teal-50/60 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-teal-900">Standby Equipment Protection & Waiver System</h3>
                <p className="text-[11px] text-slate-500">
                  Providing a working Standby Machine legally waives delay penalty accumulation (₹0 Delay Penalty).
                </p>
              </div>
            </div>

            {/* Quick Standby Form */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter Complaint ID (e.g. 13126072-800091)"
                value={standbyInputId}
                onChange={e => setStandbyInputId(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 w-64 bg-white"
              />
              <button
                onClick={() => handleQuickStandbyToggle(standbyInputId)}
                disabled={togglingStandby || !standbyInputId.trim()}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-black rounded-lg shadow-xs transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {togglingStandby ? "Updating..." : "Toggle Standby"}
              </button>
            </div>
          </div>

          {/* Standby Summary Strip */}
          {waivers?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Total Waived Complaints</span>
                <span className="text-lg font-mono font-black text-slate-900">{waivers.summary.total_exempt_complaints.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-teal-200 text-center">
                <span className="text-[10px] font-black uppercase text-teal-600 block">Standby Machines Provided</span>
                <span className="text-lg font-mono font-black text-teal-700">{waivers.summary.standby_count.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-200 text-center">
                <span className="text-[10px] font-black uppercase text-blue-600 block">Under Warranty Assets</span>
                <span className="text-lg font-mono font-black text-blue-700">{waivers.summary.warranty_count.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-black uppercase text-emerald-600 block">Total Penalty Saved</span>
                <span className="text-lg font-mono font-black text-emerald-700">{fmtINR(waivers.summary.total_waived_penalty)}</span>
              </div>
            </div>
          )}

          {/* Waivers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-[#0f172a] text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Standby & Warranty Waiver Audit Ledger</h3>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                {(["all", "standby", "warranty"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setStandbyTypeFilter(t)}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                      standbyTypeFilter === t ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {t === "all" ? "All Exemptions" : t === "standby" ? "Standby Only" : "Warranty Only"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Complaint ID</th>
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3">Hospital · District</th>
                    <th className="py-2.5 px-3">Equipment</th>
                    <th className="py-2.5 px-3 text-center">Waiver Type</th>
                    <th className="py-2.5 px-3 text-center">Downtime</th>
                    <th className="py-2.5 px-3 text-right">Delay Pen. (Waived)</th>
                    <th className="py-2.5 px-3 text-right">Saved Penalty</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {loadingWaivers ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                        Loading waiver audit ledger...
                      </td>
                    </tr>
                  ) : (waivers?.records || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                        No standby or warranty exempted complaints found.
                      </td>
                    </tr>
                  ) : (
                    (waivers?.records || []).map((r: ComplaintPenaltyRecord) => (
                      <tr key={r.complaint_id} className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-2 px-3 font-mono font-black text-blue-600">{r.complaint_id}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{r.bar_code}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 truncate max-w-[180px]">{r.hospital_name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{r.district_name}</div>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-[150px]">{r.equipment_name}</td>
                        <td className="py-2 px-3 text-center">
                          {r.standby === "Yes" ? (
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 border border-teal-300 text-[9px] font-black rounded">
                              ✓ STANDBY PROVIDED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 text-[9px] font-black rounded">
                              ✓ UNDER WARRANTY
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                          {r.penalty_down_days} Days
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400 line-through">
                          {fmtFull(r.unwaived_delay_penalty || r.delay_penalty || 0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">
                          {fmtFull(r.waived_penalty || 0)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setSelectedAuditRecord(r)}
                            className="p-1 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Inspect CA Calculation"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 4: ASSET DEGRADATION & CHRONIC REPEATERS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "repeaters" && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Repeater Header Bar */}
          <div className="bg-[#0f172a] text-white px-4 py-3 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Repeat2 className="w-4 h-4 text-rose-400" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider">Chronic Failure & Machine Breakdown Analysis</h3>
                <span className="text-[10px] text-slate-400">1 Barcode = 1 Physical Machine Tracked Across Complete Lifetime</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 font-bold">Min Failures:</span>
                {[2, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setRepMinCount(n)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${
                      repMinCount === n ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {n}+
                  </button>
                ))}
              </div>

              <select
                value={repDistrict}
                onChange={e => setRepDistrict(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none"
              >
                <option value="">All Districts</option>
                {districts.map((d: DistrictPenaltyStat) => <option key={d.district} value={d.district}>{d.district}</option>)}
              </select>
            </div>
          </div>

          {/* Repeater KPI Strip */}
          {repeaters?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Repeater Assets</span>
                <span className="text-lg font-mono font-black text-rose-700">{repeaters.summary.total_repeater_groups.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Total Repeat Calls</span>
                <span className="text-lg font-mono font-black text-amber-700">{repeaters.summary.total_repeater_complaints.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Currently Open</span>
                <span className="text-lg font-mono font-black text-blue-700">{repeaters.summary.active_repeaters.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Repeater Penalty</span>
                <span className="text-lg font-mono font-black text-rose-700">{fmtINR(repeaters.summary.total_repeater_penalty)}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Repeater Daily Burn</span>
                <span className="text-lg font-mono font-black text-amber-700">{fmtINR(repeaters.summary.total_repeater_per_day)}</span>
              </div>
            </div>
          )}

          {/* Repeater List Cards */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {loadingRepeaters ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">Loading chronic breakdown records...</div>
            ) : (repeaters?.repeaters || []).length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                No repeater machines found with {repMinCount}+ complaints{repDistrict ? ` in ${repDistrict}` : ""}
              </div>
            ) : (
              (repeaters?.repeaters || []).map((item: RepeaterCallEntry) => {
                const isExp = expandedRepeaters.has(item.group_key);
                const badgeColor =
                  item.complaint_count >= 10 ? "bg-rose-600 text-white" :
                  item.complaint_count >= 5 ? "bg-amber-500 text-white" :
                  "bg-slate-200 text-slate-700";

                return (
                  <div key={item.group_key} className="hover:bg-slate-50/70 transition-colors">
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-3"
                      onClick={() => toggleRepeater(item.group_key)}
                    >
                      <span className={`px-2.5 py-0.5 text-xs font-mono font-black rounded-full shrink-0 ${badgeColor}`}>
                        {item.complaint_count}x Calls
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-xs">{item.equipment_name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 border border-slate-200 text-slate-600 rounded">
                            #{item.bar_code}
                          </span>
                          {item.is_critical && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-black rounded">
                              CRITICAL
                            </span>
                          )}
                          <span className="text-[11px] text-slate-600">{item.hospital_name}</span>
                          <span className="text-[10px] text-slate-400">· {item.district_name}</span>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px]">
                          <span className="text-rose-700 font-black font-mono">{fmtINR(item.total_penalty)} total penalty</span>
                          {item.per_day_penalty > 0 && (
                            <span className="text-amber-700 font-black font-mono">+{fmtINR(item.per_day_penalty)}/day</span>
                          )}
                          <span className="text-slate-500 font-medium">
                            {item.total_downtime_days} days total downtime · {item.open_count} open · {item.closed_count} closed
                          </span>
                        </div>
                      </div>

                      {isExp ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </button>

                    {isExp && (
                      <div className="px-4 pb-3 bg-slate-50/70 border-t border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-400 mt-2 mb-1.5 block">
                          Complaint Breakdown History for Barcode #{item.bar_code} ({item.recent_complaints.length} calls)
                        </span>
                        <div className="space-y-1">
                          {item.recent_complaints.map((rc) => (
                            <div key={rc.complaint_id} className="flex items-center gap-3 text-xs bg-white px-3 py-1.5 border border-slate-200 rounded-lg">
                              <span className="font-mono font-black text-blue-600 text-[11px]">{rc.complaint_id}</span>
                              <StatusBadge s={rc.status} />
                              <span className="text-slate-500 text-[11px]">Raised: {rc.raise_date?.slice(0, 11)}</span>
                              <span className="text-slate-500 text-[11px]">Closed: {rc.close_date ? rc.close_date.slice(0, 11) : "Still Open"}</span>
                              <span className="font-black font-mono text-rose-700 ml-auto">{fmtFull(rc.total_penalty)}</span>
                              {rc.per_day > 0 && (
                                <span className="text-amber-700 font-bold font-mono text-[11px]">{fmtINR(rc.per_day)}/d</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 5: FORENSIC CA AUDIT LEDGER WITH MULTI-FILTER BAR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Forensic CA Complaint Audit Ledger
                {records && (
                  <span className="ml-2 bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-mono border border-cyan-400/30">
                    {records.total_records.toLocaleString()} Verified Records
                  </span>
                )}
              </h3>
            </div>
            {loadingRecords && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
          </div>

          {/* Full Multi-Filter Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
            {/* Search */}
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Complaint ID / Barcode / Hospital..."
                  value={recSearch}
                  onChange={e => setRecSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && fetchRecords(1)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            {/* District */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">District</label>
              <select
                value={recDistrict}
                onChange={e => setRecDistrict(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Districts</option>
                {districts.map((d: DistrictPenaltyStat) => <option key={d.district} value={d.district}>{d.district}</option>)}
              </select>
            </div>

            {/* Zone */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Zone</label>
              <select
                value={recZone}
                onChange={e => setRecZone(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Zones</option>
                {(summary?.zones || []).map((z: ZonePenaltyStat) => <option key={z.zone} value={z.zone}>{z.zone}</option>)}
              </select>
            </div>

            {/* Hospital Type */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Facility Type</label>
              <select
                value={recHospType}
                onChange={e => setRecHospType(e.target.value as any)}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Types</option>
                <option value="MCH">MCH (12h SLA)</option>
                <option value="Others">DH / CHC / PHC</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Call Status</label>
              <select
                value={recStatus}
                onChange={e => setRecStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Status</option>
                <option value="open">Open / Pending</option>
                <option value="closed">Closed / Final</option>
              </select>
            </div>

            {/* Critical */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Equipment</label>
              <select
                value={recCritical}
                onChange={e => setRecCritical(e.target.value as any)}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Equipment</option>
                <option value="yes">Critical (+10%)</option>
                <option value="no">Non-Critical</option>
              </select>
            </div>

            {/* Standby / Warranty */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">Standby / Warranty</label>
              <select
                value={recStandby ? "standby_yes" : recWarranty ? "warranty_yes" : ""}
                onChange={e => {
                  const val = e.target.value;
                  if (val === "standby_yes") {
                    setRecStandby("yes");
                    setRecWarranty("");
                  } else if (val === "warranty_yes") {
                    setRecStandby("");
                    setRecWarranty("yes");
                  } else {
                    setRecStandby("");
                    setRecWarranty("");
                  }
                }}
                className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none bg-white"
              >
                <option value="">All Records</option>
                <option value="standby_yes">Standby Provided</option>
                <option value="warranty_yes">Under Warranty</option>
              </select>
            </div>

            {/* Apply & Penalty Only Button */}
            <div className="flex items-end gap-1">
              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer mb-1 mr-1">
                <input
                  type="checkbox"
                  checked={recOnlyPenalty}
                  onChange={e => setRecOnlyPenalty(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Penalty &gt; 0
              </label>
              <button
                onClick={() => fetchRecords(1)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0 shadow-xs"
              >
                <Filter className="w-3 h-3" /> Apply
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Complaint ID</th>
                  <th className="py-2.5 px-3">Facility · District</th>
                  <th className="py-2.5 px-3">Equipment · Barcode</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Slab</th>
                  <th className="py-2.5 px-3 text-center">Downtime</th>
                  <th className="py-2.5 px-3 text-right">Attend Pen.</th>
                  <th className="py-2.5 px-3 text-right">Delay Pen.</th>
                  <th className="py-2.5 px-3 text-right">Net Penalty</th>
                  <th className="py-2.5 px-3 text-right">Per Day</th>
                  <th className="py-2.5 px-3 text-center">Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {loadingRecords ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                      Loading complaint audit ledger...
                    </td>
                  </tr>
                ) : (records?.records || []).length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                      No complaint records match selected filters.
                    </td>
                  </tr>
                ) : (
                  (records?.records || []).map((r: ComplaintPenaltyRecord, idx: number) => {
                    const rowNum = ((recPage - 1) * REC_LIMIT) + idx + 1;
                    return (
                      <tr key={r.complaint_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{rowNum}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setSelectedAuditRecord(r)}
                            className="font-mono font-black text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            {r.complaint_id}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 truncate max-w-[180px]">{r.hospital_name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">
                            {r.district_name} ({r.hospital_type})
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-800 truncate max-w-[150px]">{r.equipment_name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-[10px] bg-slate-100 px-1 border border-slate-200 text-slate-600 rounded">
                              {r.bar_code}
                            </span>
                            {r.is_critical && (
                              <span className="px-1 py-0.1 bg-purple-100 text-purple-800 text-[8.5px] font-black rounded">
                                CRIT
                              </span>
                            )}
                            {r.standby === "Yes" && (
                              <span className="px-1 py-0.1 bg-teal-100 text-teal-800 text-[8.5px] font-black rounded">
                                STANDBY
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusBadge s={r.complaint_status} />
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                          {INR}{r.penalty_slab}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                          {r.penalty_down_days} d
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                          {r.attend_penalty > 0 ? fmtFull(r.attend_penalty) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                          {r.delay_penalty > 0 ? fmtFull(r.delay_penalty) : (r.standby === "Yes" ? <span className="text-teal-600 text-[10px]">Waived</span> : "—")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-rose-700">
                          {r.total_penalty > 0 ? fmtFull(r.total_penalty) : `${INR}0`}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-amber-700">
                          {r.total_per_day > 0 ? fmtINR(r.total_per_day) : "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setSelectedAuditRecord(r)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                            title="Inspect CA Forensic Calculation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {records && records.total_pages > 1 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page <strong className="text-slate-900">{recPage}</strong> of <strong className="text-slate-900">{records.total_pages}</strong> · {records.total_records.toLocaleString()} total audited records
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchRecords(recPage - 1)}
                  disabled={recPage <= 1 || loadingRecords}
                  className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 py-1 bg-[#0f172a] text-white font-mono font-black text-xs rounded-lg">
                  {recPage}
                </span>
                <button
                  onClick={() => fetchRecords(recPage + 1)}
                  disabled={recPage >= records.total_pages || loadingRecords}
                  className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CA FORENSIC CALCULATION INSPECTOR MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedAuditRecord && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-300 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600 text-white rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    CA Forensic Calculation Inspector (NIB-825 Audit)
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Complaint ID: {selectedAuditRecord.complaint_id} · Barcode: {selectedAuditRecord.bar_code}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Asset & Hospital Profile */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Equipment Name</span>
                  <span className="font-bold text-slate-900">{selectedAuditRecord.equipment_name || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Hospital & District</span>
                  <span className="font-bold text-slate-900">{selectedAuditRecord.hospital_name} ({selectedAuditRecord.district_name})</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Hospital Category & SLA Period</span>
                  <span className="font-bold text-slate-900">
                    {selectedAuditRecord.hospital_type} ({selectedAuditRecord.hospital_type === "MCH" ? "12-Hour Period (2x daily rate)" : "24-Hour Period (1x daily rate)"})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Estimated Asset Value & Tender Slab</span>
                  <span className="font-bold text-slate-900">
                    {fmtFull(selectedAuditRecord.asset_value)} · <strong>{INR}{selectedAuditRecord.penalty_slab} / Slab</strong>
                  </span>
                </div>
              </div>

              {/* Step 1: Attendance SLA Audit */}
              <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-black text-blue-900 uppercase">
                  <span>Step 1: Attendance SLA Audit</span>
                  <span className="font-mono text-xs text-blue-800">
                    Penalty: {fmtFull(selectedAuditRecord.attend_penalty)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 space-y-1">
                  <div>• <strong>Raise Date:</strong> {selectedAuditRecord.complaint_raise_date || "—"}</div>
                  <div>• <strong>Attend Date:</strong> {selectedAuditRecord.attend_date || "Not Yet Attended (Active)"}</div>
                  <div>• <strong>Time Taken to Attend:</strong> {selectedAuditRecord.attend_hour_diff} Hours (SLA: {selectedAuditRecord.hospital_type === "MCH" ? "1 Hour" : "24 Hours"})</div>
                  <div>• <strong>Attend Rule:</strong> {selectedAuditRecord.attend_penalty > 0 ? "SLA Missed → ₹500/day charged" : "Attended within SLA or Exempted → ₹0 Attend Penalty"}</div>
                </div>
              </div>

              {/* Step 2: Downtime & Resolution SLA Audit */}
              <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-black text-purple-900 uppercase">
                  <span>Step 2: Downtime & Resolution SLA Audit</span>
                  <span className="font-mono text-xs text-purple-800">
                    Delay Penalty: {fmtFull(selectedAuditRecord.delay_penalty)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 space-y-1">
                  <div>• <strong>Close Date:</strong> {selectedAuditRecord.complaint_close_date || "Still Open (Live accumulating)"}</div>
                  <div>• <strong>Total Downtime:</strong> {selectedAuditRecord.penalty_down_days} Days</div>
                  <div>• <strong>Resolution Grace SLA:</strong> {selectedAuditRecord.hospital_type === "MCH" ? "6 Hours" : "48 - 72 Hours"}</div>
                  <div>• <strong>Formula Applied:</strong> {selectedAuditRecord.hospital_type === "MCH" ? `Slab (${INR}${selectedAuditRecord.penalty_slab}) × ${selectedAuditRecord.penalty_down_days} days × 2 (12h period)` : `Slab (${INR}${selectedAuditRecord.penalty_slab}) × ${selectedAuditRecord.penalty_down_days} days × 1`}</div>
                </div>
              </div>

              {/* Step 3: Exemptions & Standby Check */}
              <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-black text-teal-900 uppercase">
                  <span>Step 3: Exemption & Standby Machine Audit</span>
                  <span className="font-mono text-xs text-teal-800">
                    Waived Amount: {fmtFull(selectedAuditRecord.waived_penalty || 0)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 space-y-1">
                  <div>• <strong>Standby Provided:</strong> {selectedAuditRecord.standby}</div>
                  <div>• <strong>Under OEM Warranty:</strong> {selectedAuditRecord.is_under_warranty}</div>
                  <div>• <strong>Critical Surcharge:</strong> {selectedAuditRecord.is_critical ? "Yes (+10% applied)" : "No"}</div>
                  <div>• <strong>Exemption Status:</strong> {selectedAuditRecord.standby === "Yes" ? "Delay Penalty WAIVED (₹0)" : selectedAuditRecord.is_under_warranty === "Yes" ? "Warranty Exemption WAIVED (₹0)" : "No Exemption Applicable"}</div>
                </div>
              </div>

              {/* Final Summary Card */}
              <div className="p-4 bg-[#0f172a] text-white rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Final Certified Penalty</span>
                  <span className="text-xl font-black font-mono text-rose-400">{fmtFull(selectedAuditRecord.total_penalty)}</span>
                </div>
                {selectedAuditRecord.total_per_day > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-amber-400 block">Active Daily Burn Rate</span>
                    <span className="text-sm font-black font-mono text-amber-300">+{fmtINR(selectedAuditRecord.total_per_day)} / day</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="px-4 py-2 bg-slate-900 text-white font-black text-xs rounded-lg hover:bg-black"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CA RULES & SLAB GUIDE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showFormulaGuide && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-300 overflow-hidden">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                BEMMP Rajasthan Contract (NIB-825) CA Rules & Penalty Slabs
              </h3>
              <button onClick={() => setShowFormulaGuide(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <h4 className="font-black uppercase text-slate-900 mb-2">1. Equipment Asset Value Penalty Slabs</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border border-slate-200">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase">
                      <tr>
                        <th className="p-2 border">Asset Value Range</th>
                        <th className="p-2 border">Penalty Slab Rate</th>
                        <th className="p-2 border">MCH (12h Period)</th>
                        <th className="p-2 border">DH/CHC (24h Period)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      <tr>
                        <td className="p-2 border">Up to ₹10,000</td>
                        <td className="p-2 border font-bold">₹500 / period</td>
                        <td className="p-2 border font-mono">₹1,000 / day</td>
                        <td className="p-2 border font-mono">₹500 / day</td>
                      </tr>
                      <tr>
                        <td className="p-2 border">₹10,001 to ₹1,00,000</td>
                        <td className="p-2 border font-bold">₹1,000 / period</td>
                        <td className="p-2 border font-mono">₹2,000 / day</td>
                        <td className="p-2 border font-mono">₹1,000 / day</td>
                      </tr>
                      <tr>
                        <td className="p-2 border">₹1,00,001 to ₹10,00,000</td>
                        <td className="p-2 border font-bold">₹2,000 / period</td>
                        <td className="p-2 border font-mono">₹4,000 / day</td>
                        <td className="p-2 border font-mono">₹2,000 / day</td>
                      </tr>
                      <tr>
                        <td className="p-2 border">Above ₹10,00,000</td>
                        <td className="p-2 border font-bold">₹3,000 / period</td>
                        <td className="p-2 border font-mono">₹6,000 / day</td>
                        <td className="p-2 border font-mono">₹3,000 / day</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-black uppercase text-slate-900 mb-1">2. Critical Equipment Surcharge</h4>
                <p className="text-slate-600 leading-relaxed">
                  Equipments categorized as Critical (ICU, OT, Ventilators, Anesthesia, etc.) incur a mandatory <strong>+10% surcharge (1.10x multiplier)</strong> on both Attendance and Downtime penalty calculations.
                </p>
              </div>

              <div>
                <h4 className="font-black uppercase text-slate-900 mb-1">3. Standby & Warranty Exemption Clause</h4>
                <p className="text-slate-600 leading-relaxed">
                  When a working <strong>Standby Machine</strong> is provided to the hospital, or if the asset is officially under <strong>OEM Warranty</strong>, the contractual Delay Penalty is waived (<strong>₹0 Delay Penalty</strong>).
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowFormulaGuide(false)}
                className="px-4 py-2 bg-slate-900 text-white font-black text-xs rounded-lg hover:bg-black"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
