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
  Database
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
import { Bar, Doughnut, PolarArea } from 'react-chartjs-2';

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
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState("");
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

  // Chart 6: FTFR Radial Gauge simulation
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

          {/* Breakdown cards grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Equipment-wise Breakdown */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#dc3545] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#dc3545]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 Equipment Penalties</h4>
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
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 District (DI) Penalties</h4>
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
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 8 Coordinator Penalties</h4>
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

            {/* Zone-wise Breakdown & FTFR Gauge */}
            <div className="bg-white border border-gray-200 border-t-4 border-t-[#ffc107] rounded shadow-sm p-4 space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#ffc107]" />
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Zone breakdown & Resolution Rates</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 h-60">
                <div className="relative h-full">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-center mb-1">Zone Penalty Share</span>
                  <PolarArea 
                    data={zoneChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false }
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
