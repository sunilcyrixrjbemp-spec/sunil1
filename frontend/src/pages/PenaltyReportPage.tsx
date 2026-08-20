import { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  Download,
  Building2,
  Users,
  Layers,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { 
  penaltyLiveService, 
  LivePenaltySummaryResponse, 
  ComplaintPenaltyRecord 
} from "../services/penaltyLiveService";

export default function PenaltyReportPage() {
  const [activeTab, setActiveTab] = useState<"districts" | "coordinators" | "complaints">("districts");
  
  // Summary Data
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryData, setSummaryData] = useState<LivePenaltySummaryResponse | null>(null);

  // Complaints Records Data
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [records, setRecords] = useState<ComplaintPenaltyRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters for Complaints
  const [searchQuery, setSearchQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("open");
  const [criticalFilter, setCriticalFilter] = useState<"yes" | "no" | "">("");
  const [onlyPenalty, setOnlyPenalty] = useState(true);

  // Load live summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await penaltyLiveService.getSummary();
      setSummaryData(res);
    } catch (err: any) {
      console.error("Failed to load penalty summary:", err);
      toast.error(err.message || "Failed to load live penalty summary");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Load complaints records
  const fetchRecords = async (pageNum = 1) => {
    setLoadingRecords(true);
    try {
      const res = await penaltyLiveService.getRecords({
        page: pageNum,
        limit: 50,
        district: districtFilter,
        status: statusFilter,
        critical: criticalFilter,
        search: searchQuery,
        only_penalty: onlyPenalty
      });
      setRecords(res.records || []);
      setPage(res.page || 1);
      setTotalPages(res.total_pages || 1);
      setTotalRecords(res.total_records || 0);
    } catch (err: any) {
      console.error("Failed to load penalty records:", err);
      toast.error(err.message || "Failed to load penalty records");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab === "complaints") {
      fetchRecords(1);
    }
  }, [activeTab, districtFilter, statusFilter, criticalFilter, onlyPenalty]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords(1);
  };

  // Export current records to Excel
  const handleExportExcel = () => {
    if (!summaryData) return;
    try {
      const wb = XLSX.utils.book_new();

      // 1. District Summary Sheet
      const distData = (summaryData.districts || []).map(d => ({
        "District Name": d.district,
        "DI Name": d.di_name,
        "Coordinator Name": d.coordinator,
        "Zone": d.zone,
        "Open Tickets": d.open_tickets,
        "Open Penalty Tickets": d.open_penalty_tickets,
        "Total Accumulated Penalty (₹)": d.total_penalty,
        "Per Day Live Penalty (₹)": d.per_day_penalty,
        "MCH Per Day (₹)": d.mch_per_day,
        "Others Per Day (₹)": d.others_per_day,
        "Unattended Calls": d.unattended_count
      }));
      const wsDist = XLSX.utils.json_to_sheet(distData);
      XLSX.utils.book_append_sheet(wb, wsDist, "District Summary");

      // 2. Coordinator Summary Sheet
      const coordData = (summaryData.coordinators || []).map(c => ({
        "Coordinator Name": c.coordinator,
        "Total Accumulated Penalty (₹)": c.total_penalty,
        "Per Day Live Penalty (₹)": c.per_day_penalty,
        "Open Tickets": c.open_tickets,
        "Open Penalty Tickets": c.open_penalty_tickets
      }));
      const wsCoord = XLSX.utils.json_to_sheet(coordData);
      XLSX.utils.book_append_sheet(wb, wsCoord, "Coordinator Summary");

      // 3. Current Complaint Records Sheet
      if (records.length > 0) {
        const recData = records.map(r => ({
          "Complaint ID": r.complaint_id,
          "District": r.district_name,
          "Hospital Name": r.hospital_name,
          "Hospital Type": r.hospital_type,
          "Equipment Name": r.equipment_name,
          "Is Critical": r.is_critical ? "Critical (110%)" : "Non Critical",
          "Asset Value (₹)": r.asset_value,
          "Penalty Slab (₹)": r.penalty_slab,
          "Status": r.status,
          "Complaint Status": r.complaint_status,
          "Attend Hour Diff": r.attend_hour_diff,
          "Attend Penalty (₹)": r.attend_penalty,
          "Attend Per Day (₹)": r.attend_per_day,
          "Downtime Penalty Days": r.penalty_down_days,
          "Delay Penalty (₹)": r.delay_penalty,
          "Per Day Delay Penalty (₹)": r.per_day_delay_penalty,
          "Total Live Penalty (₹)": r.total_penalty,
          "Total Per Day Rate (₹)": r.total_per_day,
          "DI Name": r.di_name,
          "Coordinator": r.coordinator_name
        }));
        const wsRec = XLSX.utils.json_to_sheet(recData);
        XLSX.utils.book_append_sheet(wb, wsRec, "Complaint Records");
      }

      XLSX.writeFile(wb, `Rajasthan_BEMMP_Live_Penalty_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const kpis = summaryData?.kpis;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Live BEMMP Contract Penalty Engine
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 animate-pulse">
                  ● Real-time Live
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic SLA, Grace Period & Critical Surcharge calculations as per RMSCL NIB-825 Contract Specs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { fetchSummary(); if (activeTab === "complaints") fetchRecords(page); }}
            disabled={loadingSummary}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Real-time KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Live Per Day Penalty Rate */}
        <div className="bg-linear-to-br from-red-600 to-rose-700 p-5 rounded-2xl text-white shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <p className="text-xs font-medium text-red-100 uppercase tracking-wider">Live Per-Day Burn Rate</p>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-1 tracking-tight">
            ₹{kpis?.total_per_day_penalty ? kpis.total_per_day_penalty.toLocaleString("en-IN") : "0"}
            <span className="text-xs font-medium opacity-80"> / day</span>
          </h2>
          <div className="mt-3 flex items-center justify-between text-xs text-red-100 pt-2 border-t border-red-500/40">
            <span>MCH: ₹{(kpis?.mch_per_day_penalty || 0).toLocaleString("en-IN")}</span>
            <span>Others: ₹{(kpis?.others_per_day_penalty || 0).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Card 2: Total Accumulated Penalty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Accumulated Penalty</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
            ₹{kpis?.total_accumulated_penalty ? kpis.total_accumulated_penalty.toLocaleString("en-IN") : "0"}
          </h2>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Attend: ₹{(kpis?.total_attend_penalty || 0).toLocaleString("en-IN")}</span>
            <span>Delay: ₹{(kpis?.total_delay_penalty || 0).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Card 3: Active Penalty Tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open Penalty Tickets</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-red-600 tracking-tight">
              {kpis?.open_penalty_tickets ? kpis.open_penalty_tickets.toLocaleString("en-IN") : "0"}
            </h2>
            <span className="text-xs text-slate-500">of {kpis?.open_tickets || 0} open calls</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Critical Calls: <b className="text-red-600">{kpis?.critical_open_count || 0}</b></span>
            <span>MCH Calls: {kpis?.mch_open_count || 0}</span>
          </div>
        </div>

        {/* Card 4: Total Complaint Dataset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Ingested Dataset</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
            {kpis?.total_complaints ? kpis.total_complaints.toLocaleString("en-IN") : "0"}
          </h2>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="text-emerald-600 font-semibold">{kpis?.closed_tickets || 0} Resolved</span>
            <span className="text-amber-600 font-semibold">{kpis?.open_tickets || 0} Active</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-1.5 flex gap-1">
        <button
          onClick={() => setActiveTab("districts")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "districts"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          District & Zone Breakdown ({summaryData?.districts?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("coordinators")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "coordinators"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" />
          Coordinator Leaderboard ({summaryData?.coordinators?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("complaints")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "complaints"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Layers className="w-4 h-4" />
          Live Complaints Explorer
        </button>
      </div>

      {/* Tab 1: District Breakdown */}
      {activeTab === "districts" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">District-Wise Live Penalty & Burn Rate</h3>
            <span className="text-xs text-slate-500">Sorted by Total Accumulated Penalty</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-3">DI Name</th>
                  <th className="py-3 px-3">Coordinator</th>
                  <th className="py-3 px-3">Zone</th>
                  <th className="py-3 px-3 text-center">Open Tickets</th>
                  <th className="py-3 px-3 text-center">Penalty Calls</th>
                  <th className="py-3 px-3 text-right">Per-Day Rate (₹)</th>
                  <th className="py-3 px-3 text-right">MCH / Day (₹)</th>
                  <th className="py-3 px-3 text-right">Others / Day (₹)</th>
                  <th className="py-3 px-4 text-right">Total Penalty (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSummary ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                      Computing real-time live penalty metrics...
                    </td>
                  </tr>
                ) : (summaryData?.districts || []).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">No district records found</td>
                  </tr>
                ) : (
                  (summaryData?.districts || []).map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{d.district}</td>
                      <td className="py-3 px-3 text-slate-600">{d.di_name || "—"}</td>
                      <td className="py-3 px-3 text-slate-600">{d.coordinator || "—"}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {d.zone || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-800">{d.open_tickets}</td>
                      <td className="py-3 px-3 text-center font-bold text-red-600">{d.open_penalty_tickets}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-red-700">
                        {d.per_day_penalty > 0 ? `₹${d.per_day_penalty.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 font-medium">
                        {d.mch_per_day > 0 ? `₹${d.mch_per_day.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 font-medium">
                        {d.others_per_day > 0 ? `₹${d.others_per_day.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        ₹{d.total_penalty.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Coordinator Leaderboard */}
      {activeTab === "coordinators" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Coordinator-Wise Live Penalty Leaderboard</h3>
            <span className="text-xs text-slate-500">Sorted by Total Accumulated Penalty</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Coordinator Name</th>
                  <th className="py-3 px-4 text-center">Active Open Calls</th>
                  <th className="py-3 px-4 text-center">Active Penalty Calls</th>
                  <th className="py-3 px-4 text-right">Daily Penalty Burn Rate (₹)</th>
                  <th className="py-3 px-4 text-right">Total Accumulated Penalty (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSummary ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                      Computing coordinator metrics...
                    </td>
                  </tr>
                ) : (summaryData?.coordinators || []).map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      {c.coordinator}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{c.open_tickets}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-red-600">{c.open_penalty_tickets}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-red-700 text-sm">
                      ₹{c.per_day_penalty.toLocaleString("en-IN")} / day
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      ₹{c.total_penalty.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Live Complaints Explorer */}
      {activeTab === "complaints" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-4">
          {/* Search & Filter Bar */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, Hospital, Equipment..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">All Districts</option>
              {(summaryData?.districts || []).map((d, idx) => (
                <option key={idx} value={d.district}>{d.district}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="open">Status: Open & Pending Only</option>
              <option value="closed">Status: Resolved / Closed Only</option>
              <option value="all">Status: All (Open + Closed)</option>
            </select>

            <select
              value={criticalFilter}
              onChange={e => setCriticalFilter(e.target.value as any)}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">Critical: All Equipments</option>
              <option value="yes">Critical Only (+10% Surcharge)</option>
              <option value="no">Non-Critical Only</option>
            </select>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyPenalty}
                onChange={e => setOnlyPenalty(e.target.checked)}
                className="rounded-sm text-red-600 focus:ring-red-500"
              />
              Penalty &gt; ₹0 Only
            </label>

            <button
              type="submit"
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              Filter Records
            </button>
          </form>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Complaint ID</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Hospital & Type</th>
                  <th className="py-2.5 px-3">Equipment</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 text-center">Critical</th>
                  <th className="py-2.5 px-3 text-right">Attend Pen. (₹)</th>
                  <th className="py-2.5 px-3 text-right">Delay Pen. (₹)</th>
                  <th className="py-2.5 px-3 text-right">Per Day (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total Penalty (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingRecords ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                      Loading calculated penalty records...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No matching complaint records found for the selected filters
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.complaint_id}</td>
                      <td className="py-2.5 px-3 text-slate-700">{r.district_name}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 max-w-[200px] truncate" title={r.hospital_name}>
                          {r.hospital_name}
                        </div>
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                          r.hospital_type === "MCH" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {r.hospital_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 max-w-[180px] truncate" title={r.equipment_name}>
                          {r.equipment_name}
                        </div>
                        <div className="text-[10px] text-slate-400">Val: ₹{r.asset_value.toLocaleString("en-IN")}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "Open" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {r.complaint_status || r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {r.is_critical ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            110% Crit
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Normal</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {r.attend_penalty > 0 ? `₹${r.attend_penalty.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {r.delay_penalty > 0 ? `₹${r.delay_penalty.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-red-600">
                        {r.total_per_day > 0 ? `₹${r.total_per_day.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        ₹{r.total_penalty.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Showing page {page} of {totalPages} ({totalRecords.toLocaleString("en-IN")} total matching records)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRecords(page - 1)}
                disabled={page <= 1 || loadingRecords}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 inline" /> Prev
              </button>
              <button
                onClick={() => fetchRecords(page + 1)}
                disabled={page >= totalPages || loadingRecords}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
