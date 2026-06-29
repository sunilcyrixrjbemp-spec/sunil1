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
  UserCheck,
  Database,
  Filter,
  X,
  ShieldCheck,
  Building
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
  Legend
} from 'chart.js';
import { Bar, Doughnut, PolarArea, Pie } from 'react-chartjs-2';

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
  Legend
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
  const activity = data?.daily_activity;
  const options = data?.filter_options;

  // Chart 1: Daily Activity Config
  const dailyLoggedData = activity?.logged ? [...activity.logged].reverse() : [];
  const dailyClosedData = activity?.closed ? [...activity.closed].reverse() : [];
  
  const dailyActivityChartData = {
    labels: dailyLoggedData.map(d => d.day.slice(5)),
    datasets: [
      {
        label: 'Logged Calls',
        data: dailyLoggedData.map(d => d.count),
        backgroundColor: '#007bff',
        borderColor: '#0056b3',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'Closed Calls',
        data: dailyLoggedData.map(d => {
          const match = dailyClosedData.find(c => c.day === d.day);
          return match ? match.count : 0;
        }),
        backgroundColor: '#28a745',
        borderColor: '#1e7e34',
        borderWidth: 1,
        borderRadius: 3,
      }
    ]
  };

  // Chart 2: Equipment wise penalty (Horizontal bar chart)
  const equipmentChartData = {
    labels: breakdown?.equipment.map(e => e.name.length > 25 ? e.name.slice(0, 22) + "..." : e.name) || [],
    datasets: [
      {
        label: 'Total Penalty Amount (₹)',
        data: breakdown?.equipment.map(e => e.penalty) || [],
        backgroundColor: 'rgba(220, 53, 69, 0.85)',
        borderColor: '#dc3545',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  // Chart 3: District/DI wise penalty (Doughnut chart)
  const districtChartData = {
    labels: breakdown?.district.map(d => d.name) || [],
    datasets: [
      {
        data: breakdown?.district.map(d => d.penalty) || [],
        backgroundColor: [
          '#28a745', '#17a2b8', '#ffc107', '#007bff',
          '#6610f2', '#e83e8c', '#fd7e14', '#20c997'
        ],
        hoverOffset: 6
      }
    ]
  };

  // Chart 4: Coordinator wise penalty (Vertical Bar)
  const coordinatorChartData = {
    labels: breakdown?.coordinator.map(c => c.name) || [],
    datasets: [
      {
        label: 'Coordinator Penalty (₹)',
        data: breakdown?.coordinator.map(c => c.penalty) || [],
        backgroundColor: 'rgba(0, 123, 255, 0.85)',
        borderColor: '#007bff',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  // Chart 5: Zone wise penalty (Polar Area)
  const zoneChartData = {
    labels: breakdown?.zone.map(z => z.name + " Zone") || [],
    datasets: [
      {
        data: breakdown?.zone.map(z => z.penalty) || [],
        backgroundColor: [
          'rgba(255, 193, 7, 0.8)',
          'rgba(23, 162, 184, 0.8)',
          'rgba(40, 167, 69, 0.8)',
          'rgba(220, 53, 69, 0.8)',
          'rgba(0, 123, 255, 0.8)',
          'rgba(111, 66, 193, 0.8)'
        ]
      }
    ]
  };

  // Chart 6: FTFR Radial Gauge
  const ftfrGaugeChartData = {
    labels: ['FTFR %', 'Remaining'],
    datasets: [
      {
        data: [stats?.ftfr_percentage || 0, 100 - (stats?.ftfr_percentage || 0)],
        backgroundColor: ['#28a745', '#e9ecef'],
        borderWidth: 0,
      }
    ]
  };

  // Chart 7: Warranty Status Penalty breakdown (New - Pie)
  const warrantyChartData = {
    labels: breakdown?.warranty.map(w => w.status) || [],
    datasets: [
      {
        data: breakdown?.warranty.map(w => w.penalty) || [],
        backgroundColor: ['#17a2b8', '#dc3545'],
        hoverOffset: 4
      }
    ]
  };

  // Chart 8: Top Hospital Penalties (New - Vertical Bar)
  const hospitalChartData = {
    labels: breakdown?.hospital.map(h => h.name.length > 20 ? h.name.slice(0, 17) + "..." : h.name) || [],
    datasets: [
      {
        label: 'Hospital Penalty (₹)',
        data: breakdown?.hospital.map(h => h.penalty) || [],
        backgroundColor: 'rgba(253, 126, 20, 0.85)',
        borderColor: '#fd7e14',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  // Chart 9: Hospital Type breakdown (New - Doughnut)
  const hospTypeChartData = {
    labels: breakdown?.hospital_type.map(h => h.type) || [],
    datasets: [
      {
        data: breakdown?.hospital_type.map(h => h.penalty) || [],
        backgroundColor: [
          '#6f42c1', '#fd7e14', '#007bff', '#28a745', '#ffc107', '#17a2b8'
        ]
      }
    ]
  };

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#28a745]" />
            Rajasthan BEMMP Penalty Analytics Dashboard
            {isUpdating && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
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
            disabled={syncing}
            className="px-4 py-2 bg-[#28a745] hover:bg-[#218838] disabled:bg-gray-300 text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            {syncing ? "Syncing..." : "Sync Penalty Excel"}
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
          <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
            <div 
              className="bg-[#28a745] h-full transition-all duration-300 rounded-full" 
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Multi-Dimensional Filter Box */}
      <div className="bg-white border border-gray-200 border-t-4 border-t-blue-500 rounded shadow-sm p-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-blue-500" />
            Operational Dashboard Filter Engine
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Zone Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Zone</label>
            <select 
              value={selectedZone} 
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Zones</option>
              {options?.zones.map(z => <option key={z} value={z}>{z} Zone</option>)}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">District / DI</label>
            <select 
              value={selectedDistrict} 
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Districts</option>
              {options?.districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Coordinator Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Coordinator</label>
            <select 
              value={selectedCoordinator} 
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Coordinators</option>
              {options?.coordinators.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Billing Month</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Months</option>
              {options?.months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Equipment Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Equipment</label>
            <select 
              value={selectedEquipment} 
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">All Equipments</option>
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
        <div className="card-lte-primary p-12 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold uppercase text-gray-700 tracking-wider">No Filter Matches</h3>
          <p className="text-gray-500 text-xs max-w-md mx-auto leading-relaxed">
            No rows found matching the selected combination of filters. Please click **Clear Filters** to restore dashboard analytics.
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

          {/* Secondary Stats Strip Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 border border-gray-200 rounded p-4 text-center">
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Average Downtime Duration</span>
              <span className="text-lg font-black text-gray-700 block mt-1">{stats.avg_downtime_days} Days</span>
            </div>
            <div className="border-t sm:border-t-0 sm:border-l sm:border-r border-gray-200 py-3 sm:py-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Per-Day Penalty Impact</span>
              <span className="text-lg font-black text-gray-700 block mt-1">₹{stats.total_per_day_penalty.toLocaleString()}/day</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Resolution Delay Penalty</span>
              <span className="text-lg font-black text-gray-700 block mt-1">₹{stats.total_delay_penalty.toLocaleString()}</span>
            </div>
          </div>

          {/* Daily Activity Chart Card */}
          <div className="bg-white border border-gray-200 border-t-4 border-t-[#007bff] rounded shadow-sm p-4 space-y-4">
            <div className="border-b border-gray-200 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#007bff]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Daily Complaint Logged vs Closed (Last 15 Days)</h4>
              </div>
            </div>

            <div className="h-64 relative">
              <Bar 
                data={dailyActivityChartData} 
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

          {/* 3x3 Grid for All Breakdown charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Equipment-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#dc3545] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#dc3545]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top Equipment Penalties</h4>
              </div>
              <div className="h-60 relative">
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

            {/* District-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#28a745] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#28a745]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top District (DI) Penalties</h4>
              </div>
              <div className="h-60 flex justify-center items-center relative">
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

            {/* Coordinator-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#007bff] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#007bff]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top Coordinator Penalties</h4>
              </div>
              <div className="h-60 relative">
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

            {/* Hospital-wise Breakdown (New) */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-orange-500 rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top Hospital Penalties</h4>
              </div>
              <div className="h-60 relative">
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

            {/* Warranty Status share (New) */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-info-500 rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#17a2b8]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Warranty Status Penalty Share</h4>
              </div>
              <div className="h-60 flex justify-center items-center relative">
                <Pie 
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

            {/* Hospital Type share (New) */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-purple-500 rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Hospital Type Penalties</h4>
              </div>
              <div className="h-60 flex justify-center items-center relative">
                <Doughnut 
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

            {/* Zone breakdown & FTFR Gauge */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#ffc107] rounded shadow-sm p-4 space-y-4 md:col-span-2 lg:col-span-3">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#ffc107]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Zone breakdown & Resolution Rates</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                <div className="relative h-full">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-center mb-1">Zone Penalty Share</span>
                  <PolarArea 
                    data={zoneChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 9 } } }
                      }
                    }} 
                  />
                </div>
                <div className="relative h-full flex flex-col justify-center items-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-center mb-2">First Time Fix Rate</span>
                  <div className="w-32 h-32 relative">
                    <Doughnut 
                      data={ftfrGaugeChartData} 
                      options={{
                        rotation: -90,
                        circumference: 180,
                        cutout: '75%',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: { enabled: false }
                        }
                      }} 
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
                      <span className="text-lg font-black text-gray-800">{stats?.ftfr_percentage || 0}%</span>
                      <span className="text-[8px] font-bold text-[#28a745] uppercase tracking-wider">FTFR Rate</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
