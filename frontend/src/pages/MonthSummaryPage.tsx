import toast from "react-hot-toast";
import { Calendar, FileText, Download } from "lucide-react";

interface MonthReport {
  month: string;
  year: number;
  totalClaims: number;
  totalAmount: number;
  approvedAmount: number;
  status: "Settled" | "Processing" | "Pending Release";
}

export default function MonthSummaryPage() {
  const reports: MonthReport[] = [
    { month: "June", year: 2026, totalClaims: 14, totalAmount: 45280, approvedAmount: 32830, status: "Processing" },
    { month: "May", year: 2026, totalClaims: 18, totalAmount: 58900, approvedAmount: 58900, status: "Settled" },
    { month: "April", year: 2026, totalClaims: 22, totalAmount: 71200, approvedAmount: 69400, status: "Settled" },
    { month: "March", year: 2026, totalClaims: 12, totalAmount: 38400, approvedAmount: 38400, status: "Settled" },
    { month: "February", year: 2026, totalClaims: 15, totalAmount: 49000, approvedAmount: 49000, status: "Settled" },
    { month: "January", year: 2026, totalClaims: 9, totalAmount: 28500, approvedAmount: 28500, status: "Settled" },
  ];

  const handleDownload = (monthName: string, year: number) => {
    toast.success(`Generating PDF Report for ${monthName} ${year}...`);
    setTimeout(() => {
      toast.success(`Reimbursement_Report_${monthName}_${year}.pdf downloaded!`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-[#212529]">
      {/* Header Info */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">Monthly Expense Reports</h2>
        <p className="text-gray-500 text-xs mt-1">Audit, export, and download comprehensive logs of operational expenses by month.</p>
      </div>

      {/* Overview stats */}
      <div className="p-5 bg-white border border-gray-200 border-l-4 border-l-blue-600 rounded shadow-sm flex flex-col sm:flex-row justify-between gap-6">
        <div className="space-y-1">
          <p className="text-blue-600 font-bold text-xs uppercase tracking-wider">Financial Year 2026-27</p>
          <h3 className="text-base font-bold text-gray-800">Cumulative Claim Sheet</h3>
          <p className="text-gray-500 text-xs max-w-sm">Total claims approved and paid since the start of current fiscal year.</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Claims</p>
            <p className="text-base font-bold text-gray-800">90 claims</p>
          </div>
          <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Disbursed</p>
            <p className="text-base font-bold text-blue-600">₹2,76,530</p>
          </div>
        </div>
      </div>

      {/* Reports Box */}
      <div className="card-lte-primary p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Historical Monthly Summaries
        </h3>

        <div className="overflow-x-auto">
          <table className="table-lte">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-50">
                <th className="py-2.5 px-3">Month / Year</th>
                <th className="py-2.5 px-3">Total Claims</th>
                <th className="py-2.5 px-3">Claimed Amount</th>
                <th className="py-2.5 px-3">Approved Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                  <td className="py-3 px-3 font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span>{report.month} {report.year}</span>
                  </td>
                  <td className="py-3 px-3 text-gray-550">{report.totalClaims} claims</td>
                  <td className="py-3 px-3 font-semibold text-gray-700">₹{report.totalAmount.toLocaleString()}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">₹{report.approvedAmount.toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border ${
                      report.status === "Settled"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-yellow-50 border-yellow-200 text-yellow-700"
                    }`}>
                      {report.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleDownload(report.month, report.year)}
                      className="h-7 w-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-all inline-flex border border-gray-200 cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
