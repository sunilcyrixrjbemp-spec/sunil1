import { useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock 
} from "lucide-react";
import toast from "react-hot-toast";

interface PenaltyRecord {
  id: string;
  eCode: string;
  name: string;
  designation: string;
  date: string;
  category: "Delayed Call Resolution" | "Missed PMS Cycle" | "Itinerary Distance Violation" | "Late Expense Submission";
  description: string;
  amount: number;
  status: "Assessed" | "Waived" | "Deducted";
  ticketCode?: string;
  expenseCode?: string;
}

const MOCK_PENALTY_DATA: PenaltyRecord[] = [
  { 
    id: "1", 
    eCode: "E1822", 
    name: "Ramesh Sharma", 
    designation: "FSE - L1", 
    date: "2026-06-24", 
    category: "Delayed Call Resolution", 
    description: "Support ticket TKT-09312 exceeded 48h SLA response limits.", 
    amount: 500, 
    status: "Assessed", 
    ticketCode: "TKT-09312" 
  },
  { 
    id: "2", 
    eCode: "E1944", 
    name: "Vikram Singh", 
    designation: "FSE - L2", 
    date: "2026-06-20", 
    category: "Itinerary Distance Violation", 
    description: "Claim mileage exceeded GPS audited route mapping by 34 KM.", 
    amount: 153, 
    status: "Deducted", 
    expenseCode: "EXP-88319" 
  },
  { 
    id: "3", 
    eCode: "E1501", 
    name: "Amit Patel", 
    designation: "FSE - Trainee", 
    date: "2026-06-15", 
    category: "Missed PMS Cycle", 
    description: "Failed to perform monthly PMS at Jodhpur Hospital Unit-4.", 
    amount: 1000, 
    status: "Waived", 
  },
  { 
    id: "4", 
    eCode: "E1822", 
    name: "Ramesh Sharma", 
    designation: "FSE - L1", 
    date: "2026-06-10", 
    category: "Late Expense Submission", 
    description: "Expense claim submitted 12 days after itinerary completion date.", 
    amount: 200, 
    status: "Deducted", 
    expenseCode: "EXP-87291" 
  }
];

export default function PenaltyReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [records, setRecords] = useState<PenaltyRecord[]>(MOCK_PENALTY_DATA);

  // Filter records
  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.eCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || rec.category === categoryFilter;
    const matchesMonth = rec.date.startsWith(selectedMonth);
    return matchesSearch && matchesCategory && matchesMonth;
  });

  // Calculations
  const totalAssessedAmt = filteredRecords
    .filter(r => r.status !== "Waived")
    .reduce((sum, r) => sum + r.amount, 0);
  const waivedAmt = filteredRecords
    .filter(r => r.status === "Waived")
    .reduce((sum, r) => sum + r.amount, 0);
  const deductedCount = filteredRecords.filter(r => r.status === "Deducted").length;

  const handleWaivePenalty = (id: string) => {
    if (!window.confirm("Are you sure you want to waive this penalty charge?")) return;
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: "Waived" as const } : r));
    toast.success("Penalty charge has been waived successfully.");
  };

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div>
        <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-650" />
          Penalty Audit & Violation Report
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Review SLA delay penalties, mileage audits, and missed monthly preventive maintenance (PMS) cycles.
        </p>
      </div>

      {/* KPI statistics summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 border-t-4 border-t-red-600 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Penalty Assessed</span>
            <span className="text-xl font-extrabold text-red-600 block">₹{totalAssessedAmt.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-red-50 rounded text-red-650">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-t-4 border-t-green-600 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Waived amount</span>
            <span className="text-xl font-extrabold text-green-700 block">₹{waivedAmt.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-green-50 rounded text-green-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 border-t-4 border-t-blue-500 rounded shadow-sm p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Settled / Deducted</span>
            <span className="text-xl font-extrabold text-gray-800 block">{deductedCount} / {filteredRecords.length} Charges</span>
          </div>
          <div className="p-3 bg-blue-50 rounded text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-450 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search FSE Name, employee code, or ticket..."
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
            <span>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-bold focus:outline-none"
            >
              <option value="all">All Violations</option>
              <option value="Delayed Call Resolution">Delayed Call Resolution</option>
              <option value="Missed PMS Cycle">Missed PMS Cycle</option>
              <option value="Itinerary Distance Violation">Itinerary Distance Violation</option>
              <option value="Late Expense Submission">Late Expense Submission</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main logs list */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200 tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Violation Details</th>
                <th className="py-3 px-4">Claim / Ticket</th>
                <th className="py-3 px-4">Penalty Charges</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    No penalty logs found for this period.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-55/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800">{rec.name}</div>
                      <div className="text-[10px] text-gray-450 font-mono mt-0.5">{rec.eCode} ({rec.designation})</div>
                    </td>
                    <td className="py-3 px-4 pr-6 max-w-sm">
                      <div className="font-bold text-red-600 text-[10px] uppercase tracking-wider mb-0.5">{rec.category}</div>
                      <p className="text-gray-650 text-xs leading-relaxed font-semibold">{rec.description}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-750 font-bold">
                      {rec.ticketCode || rec.expenseCode || "--"}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-red-600">₹{rec.amount}</td>
                    <td className="py-3 px-4 font-mono text-gray-500">{rec.date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${
                        rec.status === "Deducted"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : rec.status === "Waived"
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-red-50 border-red-200 text-red-750"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {rec.status === "Assessed" ? (
                        <button
                          onClick={() => handleWaivePenalty(rec.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer border-0 shadow-sm transition-colors"
                        >
                          Waive charge
                        </button>
                      ) : (
                        <span className="text-[9px] text-gray-400 font-bold uppercase select-none">No actions</span>
                      )}
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
