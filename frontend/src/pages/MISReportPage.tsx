import { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Calendar, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Clock,
  RefreshCw,
  BarChart3,
  PieChart
} from "lucide-react";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";
import Loader from "../components/common/Loader";

interface MISRecord {
  id: string;
  expense_code: string;
  submitter_name: string;
  submitter_code: string;
  submitter_designation: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  category: string;
  date: string;
  purpose: string;
  total_km: number;
  total_auto: number;
  da_amount: number;
  hotel_amount: number;
  district: string;
  zone: string;
}

export default function MISReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [records, setRecords] = useState<MISRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMISData();
  }, []);

  const fetchMISData = async () => {
    setLoading(true);
    try {
      const data = await expenseService.getTeamExpenses();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to retrieve live MIS data from database.");
    } finally {
      setLoading(false);
    }
  };

  const safeRecords = Array.isArray(records) ? records : [];

  // Filter logic
  const filteredRecords = safeRecords.filter(rec => {
    if (!rec) return false;
    const matchesSearch = 
      (rec.submitter_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.submitter_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.submitter_designation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.expense_code || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || (rec.status || "").toLowerCase() === statusFilter.toLowerCase();
    
    // Month filter check
    const matchesMonth = rec.date 
      ? rec.date.startsWith(selectedMonth) 
      : `${rec.year}-${String(rec.month).padStart(2, '0')}` === selectedMonth;
      
    return matchesSearch && matchesStatus && matchesMonth;
  });

  // Calculate totals
  const totalClaimsAmt = filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalKms = filteredRecords.reduce((sum, r) => sum + (r.total_km || 0), 0);
  const approvedCount = filteredRecords.filter(r => (r.status || "").toLowerCase() === "approved").length;

  // Chart data calculations
  const getTravelModeStats = () => {
    let bike = 0, car = 0, auto = 0, hotel = 0, other = 0;
    filteredRecords.forEach(r => {
      const mode = (r.category || "").toLowerCase();
      if (mode === "bike") bike += r.amount;
      else if (mode === "car") car += r.amount;
      else if (mode === "auto") auto += r.amount;
      else if (r.hotel_amount > 0) hotel += r.hotel_amount;
      else other += r.amount;
    });
    return [
      { label: "Bike", value: bike, color: "#007bff" },
      { label: "Car", value: car, color: "#28a745" },
      { label: "Auto", value: auto, color: "#ffc107" },
      { label: "Hotel", value: hotel, color: "#dc3545" },
      { label: "Other", value: other, color: "#17a2b8" }
    ];
  };

  const getDistrictStats = () => {
    const grouped: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const dist = r.district || "Unassigned";
      grouped[dist] = (grouped[dist] || 0) + r.amount;
    });
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const modeData = getTravelModeStats();
  const maxModeValue = Math.max(...modeData.map(d => d.value), 1);

  const districtData = getDistrictStats();
  const maxDistrictValue = Math.max(...districtData.map(d => d.value), 1);

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records found for current selection.");
      return;
    }
    toast.loading("Compiling live MIS database logs...");
    setTimeout(() => {
      toast.dismiss();
      const headers = "Employee Code,Name,Designation,Date,Total Amount,KM Travelled,Auto Fare,DA Allowance,Hotel Charges,Status,District,Zone,Purpose\n";
      const rows = filteredRecords.map(r => 
        `"${r.submitter_code}","${r.submitter_name}","${r.submitter_designation}","${r.date || `${r.year}-${r.month}`}",${r.amount},${r.total_km},${r.total_auto},${r.da_amount},${r.hotel_amount},"${r.status}","${r.district}","${r.zone}","${(r.purpose || "").replace(/"/g, '""')}"`
      ).join("\n");
      
      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", `MIS_Report_Live_${selectedMonth}.csv`);
      a.click();
      toast.success("MIS Report exported successfully!");
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#28a745]" />
            MIS Report & Analytics Dashboard
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            View aggregated live field operations data, travel disbursements, and category audit analytics.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMISData}
            className="p-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded transition-all cursor-pointer flex items-center justify-center"
            title="Reload live data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-[#28a745] hover:bg-[#218838] text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Report
          </button>
        </div>
      </div>

      {/* KPI stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Box 1 */}
        <div className="info-box-lte">
          <div className="info-box-icon bg-[#007bff]">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Claims Disbursed</span>
            <span className="text-base font-extrabold text-gray-800 block mt-0.5">₹{totalClaimsAmt.toLocaleString()}</span>
            <span className="text-[9px] text-[#007bff] font-bold uppercase block mt-1">Total Active Volume</span>
          </div>
        </div>

        {/* Info Box 2 */}
        <div className="info-box-lte">
          <div className="info-box-icon bg-[#28a745]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Audit Mileage</span>
            <span className="text-base font-extrabold text-gray-800 block mt-0.5">{totalKms.toFixed(1)} KM</span>
            <span className="text-[9px] text-[#28a745] font-bold uppercase block mt-1">Bike + Car Travel</span>
          </div>
        </div>

        {/* Info Box 3 */}
        <div className="info-box-lte">
          <div className="info-box-icon bg-[#ffc107]">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Approved Claims</span>
            <span className="text-base font-extrabold text-gray-800 block mt-0.5">{approvedCount} / {filteredRecords.length} Bills</span>
            <span className="text-[9px] text-amber-600 font-bold uppercase block mt-1">Review Dispatch Ratio</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Category Breakdown */}
        <div className="bg-white border border-gray-200 border-t-4 border-t-[#007bff] rounded shadow-sm p-4 space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-[#007bff]" />
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Category Expense Distribution</h4>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-semibold text-gray-400 uppercase">
              No data to chart
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {modeData.map((d, index) => {
                const percentage = Math.round((d.value / maxModeValue) * 100) || 0;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-gray-700 uppercase">{d.label}</span>
                      <span className="text-gray-900 font-mono">₹{d.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.max(percentage, 3)}%`,
                          backgroundColor: d.color
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart 2: Top Districts */}
        <div className="bg-white border border-gray-200 border-t-4 border-t-[#28a745] rounded shadow-sm p-4 space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-200 pb-2 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#28a745]" />
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Top 5 Claiming Districts</h4>
          </div>

          {districtData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-semibold text-gray-400 uppercase">
              No data to chart
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {districtData.map((d, index) => {
                const percentage = Math.round((d.value / maxDistrictValue) * 100) || 0;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-gray-700">{d.label}</span>
                      <span className="text-gray-900 font-mono">₹{d.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="h-full bg-[#28a745] rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by Code, Employee Name, Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded pl-9 pr-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 outline-none font-semibold shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-500 uppercase">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Month:</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-750 font-bold outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-750 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Logs</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12">
              <Loader message="Fetching live operational logs..." />
            </div>
          ) : (
            <table className="table-lte">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Audit Date</th>
                  <th>Distance (KM)</th>
                  <th>Allowance (DA)</th>
                  <th>Hotel charges</th>
                  <th>Net Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      No MIS records found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-800">{rec.submitter_name}</div>
                        <div className="text-[10px] text-gray-450 font-mono mt-0.5">{rec.submitter_code}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-bold">{rec.submitter_designation}</td>
                      <td className="py-3 px-4 font-mono text-gray-500">{rec.date || `${rec.year}-${String(rec.month).padStart(2, '0')}`}</td>
                      <td className="py-3 px-4 font-mono text-gray-700">{rec.total_km ? `${rec.total_km.toFixed(1)} KM` : "—"}</td>
                      <td className="py-3 px-4 font-bold text-gray-700">₹{(rec.da_amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold text-gray-700">₹{(rec.hotel_amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-extrabold text-blue-700">₹{(rec.amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          (rec.status || "").toLowerCase() === "approved"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : (rec.status || "").toLowerCase() === "rejected"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-yellow-50 border-yellow-200 text-yellow-700"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            (rec.status || "").toLowerCase() === "approved" ? "bg-green-500" : (rec.status || "").toLowerCase() === "rejected" ? "bg-red-500" : "bg-yellow-500"
                          }`}></span>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
