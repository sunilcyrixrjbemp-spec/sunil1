import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import { authService } from "../services/authService";
import Loader from "../components/common/Loader";

// Register Chart.js components
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, AreaChart, Area, PieChart as RePieChart, Pie as RePie } from "recharts";

const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

interface ChartItem {
  name: string;
  penalty: number;
}

interface HospitalItem {
  name: string;
  penalty: number;
  count: number;
}

interface WarrantyItem {
  status: string;
  penalty: number;
}

interface HospTypeItem {
  type: string;
  penalty: number;
}

interface ActivityItem {
  day: string;
  count: number;
}

interface DashboardData {
  success: boolean;
  message?: string;
  filter_options?: {
    districts: string[];
    coordinators: string[];
    zones: string[];
    months: string[];
    equipments: string[];
  };
  summary?: {
    total_calls: number;
    closed_calls: number;
    ftfr_percentage: number;
    total_attend_penalty: number;
    total_delay_penalty: number;
    total_penalty: number;
    total_per_day_penalty: number;
    avg_downtime_days: number;
    attend_breach_count: number;
    delay_breach_count: number;
    avg_attend_tat_days: number;
    avg_close_tat_days: number;
  };
  daily_activity?: {
    logged: ActivityItem[];
    closed: ActivityItem[];
  };
  breakdown?: {
    equipment: ChartItem[];
    district: ChartItem[];
    coordinator: ChartItem[];
    zone: ChartItem[];
    hospital: HospitalItem[];
    warranty: WarrantyItem[];
    hospital_type: HospTypeItem[];
    vendor: ChartItem[];
    monthly_trend: { month: string; penalty: number }[];
    di: ChartItem[];
    monthly_tat: { month: string; avg_attend_tat_days: number; avg_close_tat_days: number }[];
    coordinator_workload: { coordinator: string; month: string; total_calls: number; closed_calls: number }[];
    daywise_penalties: { day: string; attend_penalty: number; delay_penalty: number }[];
  };
}

const CustomMoneyTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none">
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Penalty:
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
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].payload.day || payload[0].name}</p>
        <div className="space-y-1">
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}:
              </span>
              <span className="font-mono font-bold text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function MISReportPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user details
  const currentUser = authService.getCurrentUser();
  const userRole = currentUser?.role?.trim() || "";
  const userZone = currentUser?.zone || "";

  // The 5 zones
  const zones = ["All", "Ajmer", "Bikaner", "Jodhpur", "Udaipur"];
  const allowedZones = userRole === "Zonal Manager" 
    ? [userZone.replace(" Zone", "").trim()] 
    : zones;

  // Selected zone tab
  const [activeTab, setActiveTab] = useState(() => {
    if (userRole === "Zonal Manager") {
      return userZone.replace(" Zone", "").trim();
    }
    return "All";
  });

  // Filters State
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("");

  // Sync activeTab with selectedZone
  useEffect(() => {
    setSelectedZone(activeTab === "All" ? "" : activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedZone, selectedDistrict, selectedCoordinator, selectedMonth, selectedEquipment]);

  const fetchDashboardData = async () => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsUpdating(true);
    }
    try {
      const queryParams = new URLSearchParams();
      if (selectedZone) queryParams.append("zone", selectedZone);
      if (selectedDistrict) queryParams.append("district", selectedDistrict);
      if (selectedCoordinator) queryParams.append("coordinator", selectedCoordinator);
      if (selectedMonth) queryParams.append("month", selectedMonth);
      if (selectedEquipment) queryParams.append("equipment", selectedEquipment);

      const response = await api.get(`/reports/mis-dashboard?${queryParams.toString()}`);
      setData(response.data);
      if (response.data.success === false) {
        toast.error(response.data.message || "Failed to load dashboard statistics.");
      }
    } catch (err) {
      toast.error("Failed to retrieve live MIS analytics.");
    } finally {
      setLoading(false);
      setIsUpdating(false);
      setIsInitialLoad(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedZone(activeTab === "All" ? "" : activeTab);
    setSelectedDistrict("");
    setSelectedCoordinator("");
    setSelectedMonth("");
    setSelectedEquipment("");
    toast.success("Filters cleared successfully.");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setSyncProgress(25);
    setSyncStatusText("Uploading Excel sheet to server...");
    
    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Processing upload & syncing penalty logs... This will take a few moments.");
    
    try {
      setSyncProgress(50);
      setSyncStatusText("Database is comparing and syncing new complaints...");
      
      const response = await api.post("/reports/upload-penalties", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      
      setSyncProgress(100);
      if (response.data.success) {
        toast.success(response.data.message || "Sync completed successfully!", { id: toastId });
        fetchDashboardData();
      } else {
        toast.error(response.data.message || "Failed to sync spreadsheet.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed. Ensure the file matches the Penalty File structure.", { id: toastId });
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const stats = data?.summary;
  const breakdown = data?.breakdown;
  const activity = data?.daily_activity;
  const options = data?.filter_options;

  const formatLabelDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}`;
      }
      return `${parts[0]}-${parts[1]}`;
    }
    return dateStr;
  };

  const dailyLoggedData = activity?.logged ? [...activity.logged].reverse() : [];
  const dailyClosedData = activity?.closed ? [...activity.closed].reverse() : [];

  const isActiveTab = (tabName: string) => {
    if (tabName === "All") return activeTab === "All";
    return activeTab.toLowerCase().includes(tabName.toLowerCase());
  };

  return (
    <div className="space-y-6 text-slate-800 font-sans">
      
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            MIS Report Dashboard
            {isUpdating && <i className="fas fa-sync-alt text-blue-500 animate-spin text-sm"></i>}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Downtime SLA penalties, FTFR, zone allocations, and coordinator analytics metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xlsm" 
            className="hidden" 
          />
          <button
            onClick={triggerFileSelect}
            disabled={syncing}
            className="px-3 py-1.5 bg-[#28a745] hover:bg-[#218838] disabled:bg-slate-300 text-white text-xs font-bold uppercase rounded cursor-pointer flex items-center gap-1 shadow-sm transition-all border-0"
          >
            <i className="fas fa-upload"></i>
            {syncing ? "Syncing..." : "Sync Excel"}
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all cursor-pointer flex items-center justify-center h-8 w-8"
            title="Reload data"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {syncing && (
        <div className="bg-white border border-slate-200 border-l-4 border-l-[#28a745] rounded shadow-sm p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 animate-pulse">
              <i className="fas fa-database text-[#28a745]"></i>
              {syncStatusText}
            </span>
            <span className="font-bold text-slate-950">{syncProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-[#28a745] h-full transition-all duration-300 rounded-full" 
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 max-w-2xl shadow-sm border border-slate-200">
        {allowedZones.map((z) => (
          <button
            key={z}
            onClick={() => setActiveTab(z)}
            className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition-all duration-300 border-0 cursor-pointer ${
              isActiveTab(z)
                ? "bg-white text-blue-600 shadow-md transform scale-102"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50 bg-transparent"
            }`}
          >
            {z === "All" ? "All Zones" : `${z} Zone`}
          </button>
        ))}
      </div>

      <div className="card-lte-primary bg-white shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fas fa-filter text-blue-500"></i>
            Filter Operations (Cascading Dropdowns)
          </h3>
          {(selectedZone || selectedDistrict || selectedCoordinator || selectedMonth || selectedEquipment) && (
            <button 
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 uppercase transition-all bg-transparent border-0 cursor-pointer"
            >
              <i className="fas fa-times"></i> Clear Filters
            </button>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="label-lte">Zone</label>
            <select 
              value={selectedZone} 
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setSelectedDistrict(""); 
              }}
              disabled={userRole === "Zonal Manager"}
              className="input-lte focus:border-blue-500"
            >
              <option value="">All Zones ({options?.zones.length || 0})</option>
              {options?.zones.map(z => <option key={z} value={z}>{z} Zone</option>)}
            </select>
          </div>

          <div>
            <label className="label-lte">District / DI</label>
            <select 
              value={selectedDistrict} 
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={userRole === "Engineer"}
              className="input-lte focus:border-blue-500"
            >
              <option value="">All Districts ({options?.districts.length || 0})</option>
              {options?.districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="label-lte">Coordinator</label>
            <select 
              value={selectedCoordinator} 
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              disabled={userRole === "Coordinator"}
              className="input-lte focus:border-blue-500"
            >
              <option value="">All Coordinators ({options?.coordinators.length || 0})</option>
              {options?.coordinators.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label-lte">Billing Month</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-lte focus:border-blue-500"
            >
              <option value="">All Months ({options?.months.length || 0})</option>
              {options?.months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="label-lte">Equipment</label>
            <select 
              value={selectedEquipment} 
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="input-lte focus:border-blue-500"
            >
              <option value="">All Equipments ({options?.equipments.length || 0})</option>
              {options?.equipments.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-16">
          <Loader message="Recalculating business analytics matrices..." />
        </div>
      ) : data?.success === false || !stats ? (
        <div className="card-lte p-12 text-center space-y-4 bg-white shadow-sm" style={{ borderTopColor: "#dc3545" }}>
          <i className="fas fa-exclamation-triangle text-amber-500 fa-2x mx-auto"></i>
          <h3 className="text-sm font-bold uppercase text-slate-700 tracking-wider">No Matching Records</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
            No rows found matching the selected combination of filters. Please clear filters to reload statistics.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="card-lte p-5 bg-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Calls Logged & Closed</span>
                <h3 className="text-2xl font-black text-slate-800 font-mono">
                  {stats.closed_calls} <span className="text-xs font-normal text-slate-400">/ {stats.total_calls}</span>
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                  {stats.total_calls ? ((stats.closed_calls * 100) / stats.total_calls).toFixed(1) : 0}% Completion Rate
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <i className="fas fa-chart-line fa-lg"></i>
              </div>
            </div>

            <div className="card-lte p-5 bg-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Attended TAT (Days)</span>
                <h3 className="text-2xl font-black text-slate-800 font-mono">
                  {stats.avg_attend_tat_days || 0} <span className="text-xs font-normal text-slate-400">Days</span>
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">Avg time to attend complaints</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <i className="fas fa-clock fa-lg"></i>
              </div>
            </div>

            <div className="card-lte p-5 bg-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Closed TAT (Downtime)</span>
                <h3 className="text-2xl font-black text-slate-800 font-mono">
                  {stats.avg_close_tat_days || 0} <span className="text-xs font-normal text-slate-400">Days</span>
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1">Avg time to close complaints</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <i className="fas fa-chart-line fa-lg"></i>
              </div>
            </div>

            <div className="card-lte p-5 bg-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Total SLA Penalty</span>
                <h3 className="text-2xl font-black text-red-600 font-mono">
                  ₹{stats.total_penalty.toLocaleString()}
                </h3>
                <span className="text-[10px] text-red-500 font-bold block mt-1">
                  {stats.attend_breach_count + stats.delay_breach_count} Breach Incidents
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                <i className="fas fa-rupee-sign fa-lg"></i>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border border-slate-205 rounded-lg p-5">
            <div className="card-lte p-4 bg-white shadow-sm flex items-center gap-3">
              <span className="p-3 bg-orange-50 text-orange-500 rounded-lg">
                <i className="fas fa-exclamation-circle fa-lg"></i>
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Response Breaches</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.attend_breach_count.toLocaleString()} Calls</span>
                <span className="text-[9px] font-bold text-orange-500 uppercase block mt-1">Breached response SLA</span>
              </div>
            </div>

            <div className="card-lte p-4 bg-white shadow-sm flex items-center gap-3">
              <span className="p-3 bg-red-50 text-red-500 rounded-lg">
                <i className="fas fa-exclamation-triangle fa-lg"></i>
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolution Breaches</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.delay_breach_count.toLocaleString()} Calls</span>
                <span className="text-[9px] font-bold text-red-500 uppercase block mt-1">Breached resolution SLA</span>
              </div>
            </div>

            <div className="card-lte p-4 bg-white shadow-sm flex items-center gap-3">
              <span className="p-3 bg-green-50 text-green-500 rounded-lg">
                <i className="fas fa-shield-alt fa-lg"></i>
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First Time Fix Rate (FTFR)</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.ftfr_percentage}%</span>
                <span className="text-[9px] font-bold text-green-500 uppercase block mt-1">Resolved within 24 Hours</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="card-lte bg-white shadow-sm md:col-span-2">
              <div className="px-4 py-3 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-chart-line text-blue-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Daily Logged vs Closed Calls (Area Chart)</h4>
              </div>
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyLoggedData.map((d) => {
                    const match = dailyClosedData.find(c => c.day === d.day);
                    return {
                      day: formatLabelDate(d.day),
                      Logged: d.count,
                      Closed: match ? match.count : 0
                    };
                  })} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorLogged" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2f5bb7" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2f5bb7" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2b7d50" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2b7d50" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <RechartsTooltip content={<CustomCountTooltip />} />
                    <RechartsLegend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Area name="Logged" type="monotone" dataKey="Logged" stroke="#2f5bb7" strokeWidth={2} fill="url(#colorLogged)" />
                    <Area name="Closed" type="monotone" dataKey="Closed" stroke="#2b7d50" strokeWidth={2} fill="url(#colorClosed)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <Clock className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Monthly Average TAT (Days)</h4>
              </div>
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={breakdown?.monthly_tat || []} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorAttendTAT" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2f5bb7" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2f5bb7" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorCloseTAT" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2b7d50" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2b7d50" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <RechartsTooltip content={<CustomCountTooltip />} />
                    <RechartsLegend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    <Area name="Attend TAT" type="monotone" dataKey="avg_attend_tat_days" stroke="#2f5bb7" strokeWidth={2} fill="url(#colorAttendTAT)" />
                    <Area name="Close TAT" type="monotone" dataKey="avg_close_tat_days" stroke="#2b7d50" strokeWidth={2} fill="url(#colorCloseTAT)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm md:col-span-2">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-rupee-sign text-red-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Day-wise Attended vs Delay Penalties (Stacked)</h4>
              </div>
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...(breakdown?.daywise_penalties || [])].reverse()} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} tickFormatter={formatLabelDate} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomMoneyTooltip />} />
                    <RechartsLegend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Bar name="Attend Penalty" dataKey="attend_penalty" stackId="a" fill="#2f5bb7" />
                    <Bar name="Delay Penalty" dataKey="delay_penalty" stackId="a" fill="#d83b01" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-layer-group text-purple-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">DI-wise Penalties</h4>
              </div>
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown?.di || []} margin={{ left: 5, right: 5, top: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="penalty" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {(breakdown?.di || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-layer-group text-red-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Equipment Penalties</h4>
              </div>
              <div className="p-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown?.equipment.map((e) => ({
                    name: e.name.length > 20 ? e.name.slice(0, 18) + ".." : e.name,
                    penalty: e.penalty
                  })) || []} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} vertical={true} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={80} />
                    <RechartsTooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="penalty" radius={[0, 6, 6, 0]} maxBarSize={16}>
                      {(breakdown?.equipment || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-map-marker-alt text-[#28a745]"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">District Penalties</h4>
              </div>
              <div className="p-4 h-60">
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <RePie
                        data={breakdown?.district.map(d => ({
                          name: d.name,
                          value: d.penalty
                        })) || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {(breakdown?.district || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                        ))}
                      </RePie>
                      <RechartsTooltip content={<CustomMoneyTooltip />} />
                      <RechartsLegend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-calendar-alt text-purple-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Monthly Penalty Trend</h4>
              </div>
              <div className="p-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={breakdown?.monthly_trend.map(m => ({
                    month: m.month,
                    penalty: m.penalty
                  })) || []} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#854aa5" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#854aa5" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<CustomMoneyTooltip />} />
                    <Area type="monotone" dataKey="penalty" stroke="#854aa5" strokeWidth={2} fill="url(#colorMonthly)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-lte bg-white shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <i className="fas fa-briefcase text-teal-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Vendor Penalties</h4>
              </div>
              <div className="p-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown?.vendor.map((v) => ({
                    name: v.name.length > 20 ? v.name.slice(0, 18) + ".." : v.name,
                    penalty: v.penalty
                  })) || []} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} vertical={true} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={80} />
                    <RechartsTooltip content={<CustomMoneyTooltip />} />
                    <Bar dataKey="penalty" radius={[0, 6, 6, 0]} maxBarSize={16}>
                      {(breakdown?.vendor || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="card-lte bg-white shadow-sm overflow-hidden mt-6">
            <div className="px-4 py-3 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <i className="fas fa-user-check text-blue-500"></i>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Coordinator Workload Analysis (Monthly)</h4>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                    <th className="px-4 py-3 text-[10px]">Coordinator</th>
                    <th className="px-4 py-3 text-[10px]">Month</th>
                    <th className="px-4 py-3 text-[10px] text-center">Total Assigned</th>
                    <th className="px-4 py-3 text-[10px] text-center">Closed Calls</th>
                    <th className="px-4 py-3 text-[10px] text-center">Pending / Open</th>
                    <th className="px-4 py-3 text-[10px] text-center">Closure Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {breakdown?.coordinator_workload && breakdown.coordinator_workload.length > 0 ? (
                    breakdown.coordinator_workload.map((row, index) => {
                      const pending = row.total_calls - row.closed_calls;
                      const rate = row.total_calls ? (row.closed_calls * 100 / row.total_calls).toFixed(1) : "0.0";
                      return (
                        <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">{row.coordinator}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono">{row.month}</td>
                          <td className="px-4 py-3 font-mono font-bold text-center">{row.total_calls}</td>
                          <td className="px-4 py-3 font-mono text-emerald-600 font-bold text-center">{row.closed_calls}</td>
                          <td className="px-4 py-3 font-mono text-amber-600 font-bold text-center">{pending}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono ${
                              parseFloat(rate) >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                              parseFloat(rate) >= 55 ? "bg-amber-50 text-amber-600 border border-amber-200" :
                              "bg-red-50 text-red-600 border border-red-200"
                            }`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">No workload records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden mt-6">
            <div className="px-4 py-3 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
              <Table className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Regional SLA Penalty Details</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="px-4 py-3">District / DI Name</th>
                    <th className="px-4 py-3 text-center">Assessed Penalties</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdown?.district.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 font-semibold text-slate-700 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'][idx % 8] }}></span>
                        {d.name}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        ₹{d.penalty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${d.penalty > 1000000 ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-green-50 text-green-500 border border-green-200'}`}>
                          {d.penalty > 1000000 ? 'High Penalty Load' : 'SLA Compliant'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
