import { useState } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Calendar, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Clock 
} from "lucide-react";
import toast from "react-hot-toast";

interface MISRecord {
  id: string;
  eCode: string;
  name: string;
  designation: string;
  date: string;
  amount: number;
  km: number;
  da: number;
  hotel: number;
  status: "Approved" | "Pending" | "Rejected";
}

const MOCK_MIS_DATA: MISRecord[] = [
  { id: "1", eCode: "E1704", name: "Sunil Kumar", designation: "FSE - Senior", date: "2026-06-25", amount: 1450, km: 120, da: 250, hotel: 0, status: "Approved" },
  { id: "2", eCode: "E1822", name: "Ramesh Sharma", designation: "FSE - L1", date: "2026-06-25", amount: 2850, km: 240, da: 400, hotel: 1200, status: "Approved" },
  { id: "3", eCode: "E1944", name: "Vikram Singh", designation: "FSE - L2", date: "2026-06-26", amount: 650, km: 45, da: 250, hotel: 0, status: "Pending" },
  { id: "4", eCode: "E1704", name: "Sunil Kumar", designation: "FSE - Senior", date: "2026-06-26", amount: 3950, km: 380, da: 400, hotel: 1500, status: "Approved" },
  { id: "5", eCode: "E1501", name: "Amit Patel", designation: "FSE - Trainee", date: "2026-06-27", amount: 820, km: 85, da: 250, hotel: 0, status: "Rejected" },
  { id: "6", eCode: "E1822", name: "Ramesh Sharma", designation: "FSE - L1", date: "2026-06-27", amount: 1950, km: 150, da: 250, hotel: 0, status: "Pending" }
];

export default function MISReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [records] = useState<MISRecord[]>(MOCK_MIS_DATA);

  // Filter logic
  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.eCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.designation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || rec.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesMonth = rec.date.startsWith(selectedMonth);
    return matchesSearch && matchesStatus && matchesMonth;
  });

  // Calculate totals
  const totalClaimsAmt = filteredRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalKms = filteredRecords.reduce((sum, r) => sum + r.km, 0);
  const approvedCount = filteredRecords.filter(r => r.status === "Approved").length;

  const handleExport = () => {
    toast.loading("Compiling MIS database logs...");
    setTimeout(() => {
      toast.dismiss();
      // Generate simple CSV download
      const headers = "Employee Code,Name,Designation,Date,Total Amount,KM Travelled,DA Allowance,Hotel Charges,Status\n";
      const rows = filteredRecords.map(r => 
        `"${r.eCode}","${r.name}","${r.designation}","${r.date}",${r.amount},${r.km},${r.da},${r.hotel},"${r.status}"`
      ).join("\n");
      
      const blob = new Blob([headers + rows], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", `MIS_Report_Cyrix_${selectedMonth}.csv`);
      a.click();
      toast.success("MIS Report exported successfully!");
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            MIS Report Center
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            View aggregated field operations claims, mileage audits, and status disbursements.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-center"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV Report
        </button>
      </div>

      {/* KPI stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 border-t-4 border-t-blue-600 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Claims Disbursed</span>
            <span className="text-xl font-extrabold text-gray-800 block">₹{totalClaimsAmt.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-blue-50 rounded text-blue-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-t-4 border-t-green-600 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Audit Distance</span>
            <span className="text-xl font-extrabold text-gray-800 block">{totalKms.toLocaleString()} KM</span>
          </div>
          <div className="p-3 bg-green-50 rounded text-green-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-t-4 border-t-amber-500 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Approved Claims</span>
            <span className="text-xl font-extrabold text-gray-800 block">{approvedCount} / {filteredRecords.length} Bills</span>
          </div>
          <div className="p-3 bg-amber-50 rounded text-amber-500">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-450 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by Code, Employee Name, Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded pl-9 pr-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 uppercase">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Month:</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-bold outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-bold focus:outline-none"
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
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Audit Date</th>
                <th className="py-3 px-4">Distance (KM)</th>
                <th className="py-3 px-4">Allowance (DA)</th>
                <th className="py-3 px-4">Hotel charges</th>
                <th className="py-3 px-4">Net Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    No MIS records found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800">{rec.name}</div>
                      <div className="text-[10px] text-gray-450 font-mono mt-0.5">{rec.eCode}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{rec.designation}</td>
                    <td className="py-3 px-4 font-mono text-gray-500">{rec.date}</td>
                    <td className="py-3 px-4 font-mono text-gray-700">{rec.km} KM</td>
                    <td className="py-3 px-4 font-bold text-gray-700">₹{rec.da}</td>
                    <td className="py-3 px-4 font-bold text-gray-700">₹{rec.hotel}</td>
                    <td className="py-3 px-4 font-extrabold text-blue-700">₹{rec.amount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        rec.status === "Approved"
                          ? "bg-green-50 border-green-200 text-green-700"
                          : rec.status === "Pending"
                          ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                          : "bg-red-50 border-red-200 text-red-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          rec.status === "Approved" ? "bg-green-500" : rec.status === "Pending" ? "bg-yellow-500" : "bg-red-500"
                        }`}></span>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
