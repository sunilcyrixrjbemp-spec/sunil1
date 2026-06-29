import { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Clock,
  RefreshCw,
  PieChart,
  Layers,
  AlertTriangle,
  UserCheck,
  Database,
  Filter,
  X,
  ShieldCheck,
  Building,
  Briefcase,
  Calendar,
  Layers3
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import Loader from "../components/common/Loader";
import BarChart3D from "../components/common/BarChart3D";
import PieChart3D from "../components/common/PieChart3D";

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
  };
}

export default function MISReportPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters State
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("");

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
    setSelectedZone("");
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
  const options = data?.filter_options;

  // Custom 3D Charts Mappers
  const equipment3DData = breakdown?.equipment.map((e, idx) => ({
    label: e.name.length > 12 ? e.name.slice(0, 10) + ".." : e.name,
    amount: Math.round(e.penalty),
    color: ['#dc3545', '#e83e8c', '#fd7e14', '#ffc107', '#28a745', '#17a2b8', '#007bff', '#6f42c1'][idx % 8]
  })) || [];

  const district3DData = breakdown?.district.map((d, idx) => ({
    label: d.name,
    amount: Math.round(d.penalty),
    color: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'][idx % 8]
  })) || [];

  const coordinator3DData = breakdown?.coordinator.map((c, idx) => ({
    label: c.name,
    amount: Math.round(c.penalty),
    color: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'][idx % 8]
  })) || [];

  const warranty3DData = breakdown?.warranty.map((w) => ({
    label: w.status,
    amount: Math.round(w.penalty),
    color: w.status.toLowerCase().includes('under') ? '#10b981' : '#dc3545'
  })) || [];

  const hospType3DData = breakdown?.hospital_type.map((h, idx) => ({
    label: h.type,
    amount: Math.round(h.penalty),
    color: ['#6f42c1', '#fd7e14', '#007bff', '#28a745', '#ffc107', '#17a2b8'][idx % 6]
  })) || [];

  const hospital3DData = breakdown?.hospital.map((h, idx) => ({
    label: h.name.length > 12 ? h.name.slice(0, 10) + ".." : h.name,
    amount: Math.round(h.penalty),
    color: ['#fd7e14', '#e83e8c', '#6f42c1', '#007bff', '#17a2b8', '#28a745', '#ffc107', '#dc3545'][idx % 8]
  })) || [];

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 rounded-lg shadow-md border-b-4 border-b-[#28a745]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#28a745]/20 text-[#28a745] rounded-md">
              <Layers3 className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
              BEMMP Rajasthan MIS Control Center
              {isUpdating && <RefreshCw className="w-4 h-4 text-[#28a745] animate-spin" />}
            </h2>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
            Live 3D operational dashboard with cascading dependent filters mapping SLA delays, coordinator logs, and regional downtime calculations.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-center">
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
            className="px-4 py-2.5 bg-[#28a745] hover:bg-[#218838] disabled:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer flex items-center gap-1.5 shadow transition-all duration-150"
          >
            <Upload className="w-3.5 h-3.5" />
            {syncing ? "Syncing..." : "Sync Penalty Spreadsheet"}
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded transition-all cursor-pointer flex items-center justify-center"
            title="Reload metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Syncing Progress Box */}
      {syncing && (
        <div className="bg-white border border-gray-200 border-l-4 border-l-[#28a745] rounded shadow-sm p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-700 flex items-center gap-1.5 animate-pulse">
              <Database className="w-4 h-4 text-[#28a745]" />
              {syncStatusText}
            </span>
            <span className="font-bold text-gray-900">{syncProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-[#28a745] h-full transition-all duration-300 rounded-full" 
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Main Grid: Sidebar Filters & Dashboard View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Cascading Filters Sidebar */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 h-fit space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-blue-500" />
              Cascading Filters
            </h3>
            {(selectedZone || selectedDistrict || selectedCoordinator || selectedMonth || selectedEquipment) && (
              <button 
                onClick={handleResetFilters}
                className="text-[10px] font-black text-red-500 hover:text-red-700 flex items-center gap-1 uppercase transition-all bg-transparent border-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Zone Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Zone
              </label>
              <select 
                value={selectedZone} 
                onChange={(e) => {
                  setSelectedZone(e.target.value);
                  setSelectedDistrict(""); // Reset dependent district
                }}
                className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">All Zones ({options?.zones.length || 0})</option>
                {options?.zones.map(z => <option key={z} value={z}>{z} Zone</option>)}
              </select>
            </div>

            {/* District / DI Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-400" /> District / DI
              </label>
              <select 
                value={selectedDistrict} 
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">All Districts ({options?.districts.length || 0})</option>
                {options?.districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Coordinator Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-slate-400" /> Coordinator
              </label>
              <select 
                value={selectedCoordinator} 
                onChange={(e) => setSelectedCoordinator(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">All Coordinators ({options?.coordinators.length || 0})</option>
                {options?.coordinators.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Month Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Billing Month
              </label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">All Months ({options?.months.length || 0})</option>
                {options?.months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Equipment Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-400" /> Equipment
              </label>
              <select 
                value={selectedEquipment} 
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">All Equipments ({options?.equipments.length || 0})</option>
                {options?.equipments.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: KPI Cards & Custom 3D Visualizations */}
        <div className="lg:col-span-3 space-y-6">
          
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-16">
              <Loader message="Recalculating 3D business intelligence models..." />
            </div>
          ) : data?.success === false || !stats ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold uppercase text-gray-700 tracking-wider">No Matching Records Found</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                The current combination of dependent filters returned zero records. Please click **Clear Filters** on the sidebar to reset the layout.
              </p>
            </div>
          ) : (
            <>
              {/* Premium KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                
                {/* Metric 1: Total Penalty */}
                <div className="bg-white border border-gray-200 border-l-4 border-l-red-500 rounded shadow-sm p-4 flex items-center gap-3">
                  <span className="p-2.5 bg-red-50 text-red-500 rounded-full">
                    <DollarSign className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Net SLA Penalty</span>
                    <span className="text-lg font-black text-slate-700 block mt-0.5">₹{stats.total_penalty.toLocaleString()}</span>
                  </div>
                </div>

                {/* Metric 2: FTFR % */}
                <div className="bg-white border border-gray-200 border-l-4 border-l-green-500 rounded shadow-sm p-4 flex items-center gap-3">
                  <span className="p-2.5 bg-green-50 text-green-500 rounded-full">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">FTFR Percentage</span>
                    <span className="text-lg font-black text-slate-700 block mt-0.5">{stats.ftfr_percentage}%</span>
                  </div>
                </div>

                {/* Metric 3: Visit Penalty */}
                <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded shadow-sm p-4 flex items-center gap-3">
                  <span className="p-2.5 bg-blue-50 text-blue-500 rounded-full">
                    <Clock className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Visit Penalty</span>
                    <span className="text-lg font-black text-slate-700 block mt-0.5">₹{stats.total_attend_penalty.toLocaleString()}</span>
                  </div>
                </div>

                {/* Metric 4: Resolution Ratio */}
                <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded shadow-sm p-4 flex items-center gap-3">
                  <span className="p-2.5 bg-amber-50 text-amber-500 rounded-full">
                    <UserCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Resolution Dispatch</span>
                    <span className="text-lg font-black text-slate-700 block mt-0.5">{stats.closed_calls} / {stats.total_calls}</span>
                  </div>
                </div>

              </div>

              {/* Secondary Stats Strip Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-gray-200 rounded-lg p-4 text-center">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Average Downtime Duration</span>
                  <span className="text-base font-black text-slate-700 block mt-1">{stats.avg_downtime_days} Days</span>
                </div>
                <div className="border-t sm:border-t-0 sm:border-l sm:border-r border-gray-200 py-3 sm:py-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Per-Day Penalty Impact</span>
                  <span className="text-base font-black text-slate-700 block mt-1">₹{stats.total_per_day_penalty.toLocaleString()}/day</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Downtime Delay Penalty</span>
                  <span className="text-base font-black text-slate-700 block mt-1">₹{stats.total_delay_penalty.toLocaleString()}</span>
                </div>
              </div>

              {/* 3D Visualizations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 3D Chart 1: Top Equipment Penalties */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-red-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <Layers className="w-4 h-4 text-red-500" />
                    Top Equipment Penalties (3D Cylinder View)
                  </h4>
                  {equipment3DData.length > 0 ? (
                    <BarChart3D data={equipment3DData} height={140} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

                {/* 3D Chart 2: Top District Penalties */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-blue-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    Top District SLA Penalties (3D Isometric View)
                  </h4>
                  {district3DData.length > 0 ? (
                    <PieChart3D data={district3DData} height={150} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

                {/* 3D Chart 3: Top Coordinator Penalties */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-green-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    Top Coordinator Penalties (3D Cylinder View)
                  </h4>
                  {coordinator3DData.length > 0 ? (
                    <BarChart3D data={coordinator3DData} height={140} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

                {/* 3D Chart 4: Warranty Status Share */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-teal-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <ShieldCheck className="w-4 h-4 text-teal-500" />
                    Warranty Status Share (3D Isometric View)
                  </h4>
                  {warranty3DData.length > 0 ? (
                    <PieChart3D data={warranty3DData} height={150} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

                {/* 3D Chart 5: Hospital Type Breakdown */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-purple-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <PieChart className="w-4 h-4 text-purple-500" />
                    Hospital Type Penalties (3D Isometric View)
                  </h4>
                  {hospType3DData.length > 0 ? (
                    <PieChart3D data={hospType3DData} height={150} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

                {/* 3D Chart 6: Top Hospital Penalties */}
                <div className="bg-white border border-gray-200 border-t-4 border-t-orange-500 rounded-lg shadow-sm p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <Building className="w-4 h-4 text-orange-500" />
                    Top Hospital Penalties (3D Cylinder View)
                  </h4>
                  {hospital3DData.length > 0 ? (
                    <BarChart3D data={hospital3DData} height={140} />
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">No data available</div>
                  )}
                </div>

              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
}
