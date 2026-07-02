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
  Table,
  BarChart2,
  Activity,
  Calendar,
  Briefcase,
  AlertOctagon
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import Loader from "../components/common/Loader";

// Register Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, PolarArea, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
  const activity = data?.daily_activity;
  const options = data?.filter_options;

  // Helper to format dates correctly on X-axis (extracts DD-MMM or DD-MM)
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

  // Chart 1: Daily Activity Logged vs Closed (Line Area Chart - AdminLTE style)
  const dailyLoggedData = activity?.logged ? [...activity.logged].reverse() : [];
  const dailyClosedData = activity?.closed ? [...activity.closed].reverse() : [];
  
  const dailyChartData = {
    labels: dailyLoggedData.map(d => formatLabelDate(d.day)),
    datasets: [
      {
        fill: true,
        label: 'Logged Calls',
        data: dailyLoggedData.map(d => d.count),
        backgroundColor: 'rgba(47, 91, 183, 0.15)',
        borderColor: '#2f5bb7',
        pointBorderColor: '#2f5bb7',
        pointBackgroundColor: '#2f5bb7',
        tension: 0.4
      },
      {
        fill: true,
        label: 'Closed Calls',
        data: dailyLoggedData.map(d => {
          const match = dailyClosedData.find(c => c.day === d.day);
          return match ? match.count : 0;
        }),
        backgroundColor: 'rgba(43, 125, 80, 0.15)',
        borderColor: '#2b7d50',
        pointBorderColor: '#2b7d50',
        pointBackgroundColor: '#2b7d50',
        tension: 0.4
      }
    ]
  };

  // Chart 2: Top Equipment Penalties (Horizontal Bar)
  const equipmentChartData = {
    labels: breakdown?.equipment.map(e => e.name.length > 20 ? e.name.slice(0, 18) + ".." : e.name) || [],
    datasets: [
      {
        label: 'Total Penalty Amount (₹)',
        data: breakdown?.equipment.map(e => e.penalty) || [],
        backgroundColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // Chart 3: District / DI Penalties (Doughnut Chart)
  const districtChartData = {
    labels: breakdown?.district.map(d => d.name) || [],
    datasets: [
      {
        data: breakdown?.district.map(d => d.penalty) || [],
        backgroundColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderColor: '#ffffff',
        borderWidth: 3
      }
    ]
  };

  // Chart 4: Coordinator Penalties (Vertical Bar Chart)
  const coordinatorChartData = {
    labels: breakdown?.coordinator.map(c => c.name) || [],
    datasets: [
      {
        label: 'Coordinator Penalty (₹)',
        data: breakdown?.coordinator.map(c => c.penalty) || [],
        backgroundColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // Chart 5: Hospital Type share (Pie Chart)
  const hospTypeChartData = {
    labels: breakdown?.hospital_type.map(h => h.type) || [],
    datasets: [
      {
        data: breakdown?.hospital_type.map(h => h.penalty) || [],
        backgroundColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad'],
        borderColor: '#ffffff',
        borderWidth: 3
      }
    ]
  };

  // Chart 6: Warranty share (Doughnut cutout)
  const warrantyChartData = {
    labels: breakdown?.warranty.map(w => w.status) || [],
    datasets: [
      {
        data: breakdown?.warranty.map(w => w.penalty) || [],
        backgroundColor: ['#2b7d50', '#d83b01'],
        borderColor: '#ffffff',
        borderWidth: 3
      }
    ]
  };

  // Chart 7: Top Hospital Penalties (Bar Chart)
  const hospitalChartData = {
    labels: breakdown?.hospital.map(h => h.name.length > 15 ? h.name.slice(0, 12) + ".." : h.name) || [],
    datasets: [
      {
        label: 'Hospital Penalty (₹)',
        data: breakdown?.hospital.map(h => h.penalty) || [],
        backgroundColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderColor: ['#2f5bb7', '#2b7d50', '#d28b2a', '#854aa5', '#d83b01', '#00a2ad', '#e81123'],
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // Chart 8: Zone share (Polar Area)
  const zoneChartData = {
    labels: breakdown?.zone.map(z => z.name + " Zone") || [],
    datasets: [
      {
        data: breakdown?.zone.map(z => z.penalty) || [],
        backgroundColor: [
          'rgba(255, 193, 7, 0.85)',
          'rgba(23, 162, 184, 0.85)',
          'rgba(40, 167, 69, 0.85)',
          'rgba(220, 53, 69, 0.85)',
          'rgba(0, 123, 255, 0.85)',
          'rgba(111, 66, 193, 0.85)'
        ]
      }
    ]
  };

  // Chart 9: Monthly SLA Penalty Trend (Line Chart)
  const monthlyTrendChartData = {
    labels: breakdown?.monthly_trend.map(m => m.month) || [],
    datasets: [
      {
        fill: true,
        label: 'Monthly Penalty Total (₹)',
        data: breakdown?.monthly_trend.map(m => m.penalty) || [],
        backgroundColor: 'rgba(111, 66, 193, 0.15)',
        borderColor: 'rgba(111, 66, 193, 1)',
        pointBorderColor: '#6f42c1',
        pointBackgroundColor: 'rgba(111, 66, 193, 1)',
        tension: 0.3
      }
    ]
  };

  // Chart 10: Top Service Providers / Vendors (Horizontal Bar)
  const vendorChartData = {
    labels: breakdown?.vendor.map(v => v.name.length > 20 ? v.name.slice(0, 18) + ".." : v.name) || [],
    datasets: [
      {
        label: 'Vendor Penalty Assessed (₹)',
        data: breakdown?.vendor.map(v => v.penalty) || [],
        backgroundColor: '#17a2b8',
        borderColor: '#117a8b',
        borderWidth: 1,
        borderRadius: 2
      }
    ]
  };

  return (
    <div className="space-y-6 text-slate-800 font-sans">
      
      {/* Normal Page Header */}
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            MIS Report Dashboard
            {isUpdating && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
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
            className="px-3 py-1.5 bg-[#28a745] hover:bg-[#218838] disabled:bg-slate-300 text-white text-xs font-bold uppercase rounded cursor-pointer flex items-center gap-1 shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            {syncing ? "Syncing..." : "Sync Excel"}
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded transition-all cursor-pointer flex items-center justify-center"
            title="Reload data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Syncing Progress Box */}
      {syncing && (
        <div className="bg-white border border-slate-200 border-l-4 border-l-[#28a745] rounded shadow-sm p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 animate-pulse">
              <Database className="w-4 h-4 text-[#28a745]" />
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

      {/* Dynamic Filter Controls Card (AdminLTE styled Card Box) */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-blue-500 rounded shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-blue-500" />
            Filter Operations (Cascading Dropdowns)
          </h3>
          {(selectedZone || selectedDistrict || selectedCoordinator || selectedMonth || selectedEquipment) && (
            <button 
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 uppercase transition-all bg-transparent border-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Zone Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Zone</label>
            <select 
              value={selectedZone} 
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setSelectedDistrict(""); // Reset dependent district
              }}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Zones ({options?.zones.length || 0})</option>
              {options?.zones.map(z => <option key={z} value={z}>{z} Zone</option>)}
            </select>
          </div>

          {/* District / DI Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">District / DI</label>
            <select 
              value={selectedDistrict} 
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Districts ({options?.districts.length || 0})</option>
              {options?.districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Coordinator Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Coordinator</label>
            <select 
              value={selectedCoordinator} 
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Coordinators ({options?.coordinators.length || 0})</option>
              {options?.coordinators.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Billing Month</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Months ({options?.months.length || 0})</option>
              {options?.months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Equipment Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Equipment</label>
            <select 
              value={selectedEquipment} 
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
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
        <div className="bg-white border border-slate-200 border-t-4 border-t-red-500 p-12 text-center space-y-4 rounded shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold uppercase text-slate-700 tracking-wider">No Matching Records</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
            No rows found matching the selected combination of filters. Please clear filters to reload statistics.
          </p>
        </div>
      ) : (
        <>
          {/* AdminLTE Small Boxes (KPI Strip) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Box 1: Net Penalty assessed (Red) */}
            <div className="bg-[#dc3545] text-white rounded shadow-sm overflow-hidden flex flex-col justify-between relative group p-4 h-32">
              <div>
                <span className="text-2xl font-black block">₹{stats.total_penalty.toLocaleString()}</span>
                <span className="text-xs uppercase tracking-wider block mt-1">Net SLA Penalty</span>
              </div>
              <div className="absolute right-4 top-4 text-white/10 group-hover:scale-110 transition-all duration-200 select-none">
                <DollarSign className="w-16 h-16" />
              </div>
              <div className="text-[10px] text-white/80 border-t border-white/20 pt-2 block mt-2">
                Visit + Downtime violation delay
              </div>
            </div>

            {/* Box 2: FTFR Percentage (Green) */}
            <div className="bg-[#28a745] text-white rounded shadow-sm overflow-hidden flex flex-col justify-between relative group p-4 h-32">
              <div>
                <span className="text-2xl font-black block">{stats.ftfr_percentage}%</span>
                <span className="text-xs uppercase tracking-wider block mt-1">First Time Fix Rate</span>
              </div>
              <div className="absolute right-4 top-4 text-white/10 group-hover:scale-110 transition-all duration-200 select-none">
                <TrendingUp className="w-16 h-16" />
              </div>
              <div className="text-[10px] text-white/80 border-t border-white/20 pt-2 block mt-2">
                Resolved within 24 hours SLA limit
              </div>
            </div>

            {/* Box 3: Visit Delay SLA (Blue) */}
            <div className="bg-[#007bff] text-white rounded shadow-sm overflow-hidden flex flex-col justify-between relative group p-4 h-32">
              <div>
                <span className="text-2xl font-black block">₹{stats.total_attend_penalty.toLocaleString()}</span>
                <span className="text-xs uppercase tracking-wider block mt-1">Visit Attend Penalty</span>
              </div>
              <div className="absolute right-4 top-4 text-white/10 group-hover:scale-110 transition-all duration-200 select-none">
                <Clock className="w-16 h-16" />
              </div>
              <div className="text-[10px] text-white/80 border-t border-white/20 pt-2 block mt-2">
                Initial visit SLA response delay
              </div>
            </div>

            {/* Box 4: Closed / Active Calls (Yellow) */}
            <div className="bg-[#ffc107] text-slate-800 rounded shadow-sm overflow-hidden flex flex-col justify-between relative group p-4 h-32">
              <div>
                <span className="text-2xl font-black block">{stats.closed_calls} / {stats.total_calls}</span>
                <span className="text-xs uppercase tracking-wider block mt-1">Resolution Ratio</span>
              </div>
              <div className="absolute right-4 top-4 text-slate-800/10 group-hover:scale-110 transition-all duration-200 select-none">
                <UserCheck className="w-16 h-16" />
              </div>
              <div className="text-[10px] text-slate-800/80 border-t border-slate-800/20 pt-2 block mt-2">
                Total complaint resolution status
              </div>
            </div>

          </div>

          {/* Actionable Secondary Metrics Strip (Completely Corrected & Improved) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border border-slate-200 rounded-lg p-5">
            
            {/* Metric 1: Response Breaches */}
            <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center gap-3">
              <span className="p-3 bg-orange-50 text-orange-500 rounded-lg">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Response Breaches</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.attend_breach_count.toLocaleString()} Calls</span>
                <span className="text-[9px] font-bold text-orange-500 uppercase block mt-1">Breached response SLA</span>
              </div>
            </div>

            {/* Metric 2: Resolution Breaches */}
            <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center gap-3">
              <span className="p-3 bg-red-50 text-red-500 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolution Breaches</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.delay_breach_count.toLocaleString()} Calls</span>
                <span className="text-[9px] font-bold text-red-500 uppercase block mt-1">Breached resolution SLA</span>
              </div>
            </div>

            {/* Metric 3: Avg Resolution Downtime */}
            <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center gap-3">
              <span className="p-3 bg-green-50 text-green-500 rounded-lg">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Resolution Speed</span>
                <span className="text-lg font-black text-slate-800 block mt-0.5">{stats.avg_downtime_days} Days</span>
                <span className="text-[9px] font-bold text-green-500 uppercase block mt-1">Downtime for closed calls</span>
              </div>
            </div>

          </div>

          {/* Chart 1: Daily Logged vs Closed (Line Area Chart - AdminLTE Layout style) */}
          <div className="bg-white border border-slate-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
              <Activity className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Daily Logged vs Closed Calls (Area Chart)</h4>
            </div>
            <div className="p-4 h-64 relative">
              <Line 
                data={dailyChartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { display: false } },
                    y: { ticks: { precision: 0 } }
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } }
                    }
                  }
                }} 
              />
            </div>
          </div>

          {/* 3x3 Grid for Breakdown charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Chart 2: Top Equipment Penalties */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <Layers className="w-4 h-4 text-red-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Equipment Penalties</h4>
              </div>
              <div className="p-4 h-60 relative">
                <Bar 
                  data={equipmentChartData} 
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { display: false } }
                    },
                    plugins: {
                      legend: { display: false }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 3: Top District (DI) Penalties */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <MapPin className="w-4 h-4 text-[#28a745]" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">District (DI) Penalties</h4>
              </div>
              <div className="p-4 h-60 flex justify-center items-center relative">
                <Doughnut 
                  data={districtChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { size: 9 } }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 4: Top Coordinator Penalties */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Coordinator Penalties</h4>
              </div>
              <div className="p-4 h-60 relative">
                <Bar 
                  data={coordinatorChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { display: false } }
                    },
                    plugins: {
                      legend: { display: false }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 5: Hospital Type Share */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <PieChart className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Hospital Type Penalties</h4>
              </div>
              <div className="p-4 h-60 flex justify-center items-center relative">
                <Pie 
                  data={hospTypeChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { size: 9 } }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 6: Warranty Share */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <ShieldCheck className="w-4 h-4 text-[#17a2b8]" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Warranty Status share</h4>
              </div>
              <div className="p-4 h-60 flex justify-center items-center relative">
                <Doughnut 
                  data={warrantyChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { size: 9 } }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 7: Top Hospital Penalties */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <Building className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Hospital Penalties</h4>
              </div>
              <div className="p-4 h-60 relative">
                <Bar 
                  data={hospitalChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { display: false } }
                    },
                    plugins: {
                      legend: { display: false }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 8: Zone-wise Penalty Share */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <BarChart2 className="w-4 h-4 text-[#ffc107]" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Zone-wise Penalties</h4>
              </div>
              <div className="p-4 h-60 flex justify-center items-center relative">
                <PolarArea 
                  data={zoneChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { boxWidth: 10, font: { size: 9 } }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 9: Monthly SLA Penalty Trend (NEW CHART) */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <Calendar className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Monthly Penalty Trend</h4>
              </div>
              <div className="p-4 h-60 relative">
                <Line 
                  data={monthlyTrendChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false } },
                      y: { ticks: { precision: 0 } }
                    },
                    plugins: {
                      legend: { display: false }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Chart 10: Top Service Providers/Vendors (NEW CHART) */}
            <div className="bg-white border border-slate-200 rounded shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-150 flex items-center gap-1.5 bg-slate-50/50">
                <Briefcase className="w-4 h-4 text-teal-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Top Vendor Penalties</h4>
              </div>
              <div className="p-4 h-60 relative">
                <Bar 
                  data={vendorChartData} 
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { display: false } }
                    },
                    plugins: {
                      legend: { display: false }
                    }
                  }} 
                />
              </div>
            </div>

          </div>

          {/* Interactive Detailed Analytics Table (AdminLTE Styled Table Card) */}
          <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
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
