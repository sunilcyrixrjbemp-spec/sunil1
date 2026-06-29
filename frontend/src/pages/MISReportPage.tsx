import { useState, useEffect, useRef } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Clock,
  RefreshCw,
  PieChart,
  Activity,
  Layers,
  AlertTriangle,
  UserCheck
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import Loader from "../components/common/Loader";

interface ChartItem {
  name: string;
  penalty: number;
}

interface ActivityItem {
  day: string;
  count: number;
}

interface DashboardData {
  success: boolean;
  message?: string;
  summary?: {
    total_calls: number;
    closed_calls: number;
    ftfr_percentage: number;
    total_attend_penalty: number;
    total_delay_penalty: number;
    total_penalty: number;
    total_per_day_penalty: number;
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
  };
}

export default function MISReportPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/reports/mis-dashboard");
      setData(response.data);
      if (response.data.success === false) {
        toast.error(response.data.message || "Failed to load dashboard statistics.");
      }
    } catch (err) {
      toast.error("Failed to retrieve live MIS analytics.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    const toastId = toast.loading("Parsing & Syncing Rajasthan Penalty sheet (46k+ rows)... This will take a few moments.");
    try {
      const response = await api.post("/reports/upload-penalties", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      if (response.data.success) {
        toast.success(response.data.message || "Spreadsheet uploaded and database synced successfully!", { id: toastId });
        fetchDashboardData();
      } else {
        toast.error(response.data.message || "Failed to sync spreadsheet.", { id: toastId });
      }
    } catch (err) {
      toast.error("Failed to upload Excel sheet. Ensure the file matches the Penalty File structure.", { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const stats = data?.summary;
  const breakdown = data?.breakdown;
  const activity = data?.daily_activity;

  // Max values for breakdown scales
  const maxEquip = Math.max(...(breakdown?.equipment.map(d => d.penalty) || [1]), 1);
  const maxDistrict = Math.max(...(breakdown?.district.map(d => d.penalty) || [1]), 1);
  const maxCoord = Math.max(...(breakdown?.coordinator.map(d => d.penalty) || [1]), 1);
  const maxZone = Math.max(...(breakdown?.zone.map(d => d.penalty) || [1]), 1);

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#28a745]" />
            Rajasthan BEMMP Penalty Analytics Dashboard
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Real-time tracking of SLA downtime penalties, FTFR%, logged calls, and resource performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xlsm" 
            className="hidden" 
          />
          <button
            onClick={triggerFileSelect}
            disabled={uploading}
            className="px-4 py-2 bg-[#28a745] hover:bg-[#218838] disabled:bg-gray-300 text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Syncing..." : "Sync Penalty Excel"}
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded transition-all cursor-pointer flex items-center justify-center"
            title="Reload data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16">
          <Loader message="Loading live operational metrics..." />
        </div>
      ) : data?.success === false || !stats ? (
        <div className="card-lte-primary p-12 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold uppercase text-gray-700 tracking-wider">No Penalty Data Loaded</h3>
          <p className="text-gray-500 text-xs max-w-md mx-auto leading-relaxed">
            Database table is empty. Please click the <strong>Sync Penalty Excel</strong> button to upload the Rajasthan Penalty sheet and automatically populate the database.
          </p>
        </div>
      ) : (
        <>
          {/* Info Boxes KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Box 1: Total Penalty */}
            <div className="info-box-lte">
              <div className="info-box-icon bg-[#dc3545]">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="info-box-content">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Net Penalty Assessed</span>
                <span className="text-base font-extrabold text-gray-800 block mt-0.5">₹{stats.total_penalty.toLocaleString()}</span>
                <span className="text-[9px] text-[#dc3545] font-bold uppercase block mt-1">Total resolution delay</span>
              </div>
            </div>

            {/* Box 2: FTFR % */}
            <div className="info-box-lte">
              <div className="info-box-icon bg-[#28a745]">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="info-box-content">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">FTFR (24h Close)</span>
                <span className="text-base font-extrabold text-gray-800 block mt-0.5">{stats.ftfr_percentage}%</span>
                <span className="text-[9px] text-[#28a745] font-bold uppercase block mt-1">First Time Fix Rate</span>
              </div>
            </div>

            {/* Box 3: Attend Penalty */}
            <div className="info-box-lte">
              <div className="info-box-icon bg-[#007bff]">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="info-box-content">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Attend SLA Penalty</span>
                <span className="text-base font-extrabold text-gray-800 block mt-0.5">₹{stats.total_attend_penalty.toLocaleString()}</span>
                <span className="text-[9px] text-[#007bff] font-bold uppercase block mt-1">Visit delay violation</span>
              </div>
            </div>

            {/* Box 4: Active / Closed Calls */}
            <div className="info-box-lte">
              <div className="info-box-icon bg-[#ffc107]">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="info-box-content">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Resolution Dispatch</span>
                <span className="text-base font-extrabold text-gray-800 block mt-0.5">{stats.closed_calls.toLocaleString()} / {stats.total_calls.toLocaleString()}</span>
                <span className="text-[9px] text-amber-600 font-bold uppercase block mt-1">Total Closed calls</span>
              </div>
            </div>
          </div>

          {/* Daily Activity Chart Card */}
          <div className="bg-white border border-gray-200 border-t-4 border-t-[#007bff] rounded shadow-sm p-4 space-y-4">
            <div className="border-b border-gray-200 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#007bff]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Daily Complaint Logged vs Closed (Last 15 Days)</h4>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-xs"></span> Logged</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-xs"></span> Closed</span>
              </div>
            </div>

            {/* SVG Vertical Double Bar Chart */}
            {(!activity?.logged || activity.logged.length === 0) ? (
              <div className="h-56 flex items-center justify-center text-xs font-semibold text-gray-400 uppercase">
                No activity records found
              </div>
            ) : (
              <div className="w-full overflow-x-auto py-2">
                <div className="min-w-[700px] h-60 flex flex-col justify-between">
                  {/* Bars container */}
                  <div className="flex-1 flex items-end justify-between px-4 pb-2 border-b border-gray-200">
                    {activity.logged.map((item, idx) => {
                      const closedItem = activity.closed?.find(c => c.day === item.day) || { count: 0 };
                      const maxVal = Math.max(...(activity.logged.map(l => l.count) || [1]), ...(activity.closed?.map(c => c.count) || [1]), 1);
                      const loggedHeight = (item.count / maxVal) * 100;
                      const closedHeight = (closedItem.count / maxVal) * 100;
                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 mx-1 group relative">
                          <div className="flex items-end justify-center gap-0.5 h-44 w-full">
                            {/* Logged bar */}
                            <div 
                              className="w-3 bg-blue-500 rounded-t-xs hover:bg-blue-600 transition-all duration-300 relative cursor-pointer"
                              style={{ height: `${Math.max(loggedHeight, 2)}%` }}
                              title={`Logged: ${item.count}`}
                            ></div>
                            {/* Closed bar */}
                            <div 
                              className="w-3 bg-green-500 rounded-t-xs hover:bg-green-600 transition-all duration-300 relative cursor-pointer"
                              style={{ height: `${Math.max(closedHeight, 2)}%` }}
                              title={`Closed: ${closedItem.count}`}
                            ></div>
                          </div>
                          {/* Label */}
                          <span className="text-[8px] font-bold text-gray-500 mt-2 rotate-12">{item.day.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Breakdown cards grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Equipment-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#dc3545] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#dc3545]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 Equipment Penalties</h4>
              </div>
              <div className="space-y-3">
                {breakdown?.equipment.map((item, idx) => {
                  const pct = (item.penalty / maxEquip) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-700 truncate max-w-[70%]">{item.name}</span>
                        <span className="text-red-600 font-mono">₹{item.penalty.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-full bg-[#dc3545] rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* District-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#28a745] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#28a745]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 District (DI) Penalties</h4>
              </div>
              <div className="space-y-3">
                {breakdown?.district.map((item, idx) => {
                  const pct = (item.penalty / maxDistrict) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-green-600 font-mono">₹{item.penalty.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-full bg-[#28a745] rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coordinator-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#007bff] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#007bff]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 Coordinator Penalties</h4>
              </div>
              <div className="space-y-3">
                {breakdown?.coordinator.map((item, idx) => {
                  const pct = (item.penalty / maxCoord) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-blue-600 font-mono">₹{item.penalty.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-full bg-[#007bff] rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#ffc107] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#ffc107]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Zone-wise Penalties Breakdown</h4>
              </div>
              <div className="space-y-3">
                {breakdown?.zone.map((item, idx) => {
                  const pct = (item.penalty / maxZone) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-700">{item.name} Zone</span>
                        <span className="text-amber-600 font-mono">₹{item.penalty.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-full bg-[#ffc107] rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
