import { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Calendar, Search, RefreshCw, 
  Download, Users, IndianRupee, ShieldAlert, CheckCircle2 
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { expenseService } from "../services/expenseService";

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ConsolidatedReportPage() {
  const currentDate = new Date();
  const [month, setMonth] = useState<string>(MONTHS[currentDate.getMonth() + 1]);
  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    const tid = toast.loading("Fetching consolidated report data...");
    try {
      const res = await expenseService.getConsolidatedReport(month, year);
      toast.dismiss(tid);
      if (res && res.success) {
        setData(res.data || []);
        toast.success(`Loaded ${res.data?.length || 0} consolidated records!`);
      } else {
        toast.error("Failed to load report data");
      }
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.detail || "Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (data.length === 0) {
      toast.error("No data available to download");
      return;
    }

    // Build XML Spreadsheet format (Excel compatible) with styles
    let rowsHtml = "";
    
    data.forEach((r, idx) => {
      // Row index in Excel sheet starts at 2 (since row 1 is headers)
      const R = idx + 2;
      
      // Travelling Expense formula
      const travelFormula = `=(${r.bike_km || 0}*4.5)+(${r.car_km || 0}*9)+${r.auto_amount || 0}+${r.train_bus_amount || 0}`;
      
      // Total formula (Sum columns G to N)
      const totalFormula = `=SUM(G${R}:N${R})`;
      
      // Net Payable formula (Total column O minus Advance column P)
      const netPayableFormula = `=O${R}-P${R}`;

      rowsHtml += `
        <tr>
          <td>${r.zone}</td>
          <td>${r.ee_code}</td>
          <td>${r.grade}</td>
          <td>${r.cc}</td>
          <td>${r.ee_name}</td>
          <td>${r.doj}</td>
          <td style="text-align:right;">${travelFormula}</td>
          <td style="text-align:right;">${r.da_allowance > 0 ? r.da_allowance.toFixed(2) : "0.00"}</td>
          <td style="text-align:right;">${r.spare_purchase > 0 ? r.spare_purchase.toFixed(2) : "0.00"}</td>
          <td style="text-align:right;">${r.courier_charges > 0 ? r.courier_charges.toFixed(2) : "0.00"}</td>
          <td style="text-align:right;">${r.boarding_lodging > 0 ? r.boarding_lodging.toFixed(2) : "0.00"}</td>
          <td style="text-align:right;">${r.printing_stationery > 0 ? r.printing_stationery.toFixed(2) : "0.00"}</td>
          <td style="text-align:right;">0.00</td>
          <td style="text-align:right;">0.00</td>
          <td style="text-align:right; font-weight:bold;">${totalFormula}</td>
          <td style="text-align:right; color:red;">${r.advance > 0 ? r.advance.toFixed(2) : "0.00"}</td>
          <td style="text-align:right; font-weight:bold; color:green;">${netPayableFormula}</td>
          <td></td>
          <td>${r.deduction_reason}</td>
          <td></td>
          <td style="text-align:right;">${r.claimed_amount.toFixed(2)}</td>
        </tr>
      `;
    });

    // Summary row
    rowsHtml += `
      <tr style="background-color:#e8f5e9; font-weight:bold; border-top:2px solid #1b5e20;">
        <td colspan="6" style="text-align:center; font-family:'Aptos', sans-serif;">GRAND TOTAL</td>
        <td style="text-align:right;">=SUM(G2:G${data.length + 1})</td>
        <td style="text-align:right;">=SUM(H2:H${data.length + 1})</td>
        <td style="text-align:right;">=SUM(I2:I${data.length + 1})</td>
        <td style="text-align:right;">=SUM(J2:J${data.length + 1})</td>
        <td style="text-align:right;">=SUM(K2:K${data.length + 1})</td>
        <td style="text-align:right;">=SUM(L2:L${data.length + 1})</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">=SUM(O2:O${data.length + 1})</td>
        <td style="text-align:right;">=SUM(P2:P${data.length + 1})</td>
        <td style="text-align:right;">=SUM(Q2:Q${data.length + 1})</td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right;">=SUM(U2:U${data.length + 1})</td>
      </tr>
    `;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; }
          th { 
            background-color: #1b5e20; 
            color: #a5d6a7; 
            font-weight: bold; 
            border: 1px solid #1b5e20; 
            padding: 6px 8px; 
            font-family: 'Aptos', 'Segoe UI', sans-serif; 
            font-size: 11pt; 
            text-align: center;
          }
          td { 
            border: 1px solid #c8e6c9; 
            padding: 5px 6px; 
            font-family: 'Aptos', 'Segoe UI', sans-serif; 
            font-size: 10pt; 
          }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Zone</th>
              <th>EE Code</th>
              <th>Grade</th>
              <th>CC</th>
              <th>EE Name</th>
              <th>DOJ</th>
              <th>5314101 - Exp Travelling Expense</th>
              <th>5314102 - Exp Dearness Allowances</th>
              <th>5314108 - Exp Spare Purchase Cost - Non GST</th>
              <th>5314103 - Exp Courier Charges</th>
              <th>5314104 - Exp Boarding & Lodging</th>
              <th>5314105 - Exp Printing & Stationery</th>
              <th>5314106 - Exp Miscellaneous Expenses</th>
              <th>5314107 - Exp Fuel Expenses</th>
              <th>Total</th>
              <th>ADVANCE</th>
              <th>Net Payable</th>
              <th>GST Bills</th>
              <th>Reason for deduction</th>
              <th>Remarks</th>
              <th>Team member claimed amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Consolidated_Report_${month}_${year}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Excel sheet downloaded successfully!");
  };

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalClaimed = data.reduce((s, r) => s + r.claimed_amount, 0);
  const totalAdvances = data.reduce((s, r) => s + r.advance, 0);
  const totalNet = data.reduce((s, r) => s + r.net_payable, 0);

  return (
    <div className="w-full mx-auto px-1 sm:px-2 lg:px-4 space-y-6 animate-fadeIn font-sans pb-12">
      {/* AdminLTE Content Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4 bg-gray-50/10 px-1">
        <div>
          <h1 className="text-xl font-bold text-[#212529] flex items-center gap-2 tracking-tight">
            <FileSpreadsheet className="w-5.5 h-5.5 text-green-700" />
            Consolidated Monthly Report
            <span className="text-xs font-normal text-gray-500 hidden sm:inline-block ml-1">Excel Export & Reconciliation</span>
          </h1>
        </div>
        <div className="text-[11px] font-semibold text-[#6c757d] flex items-center gap-1.5">
          <Link to="/home" className="text-[#007bff] hover:underline">Home</Link>
          <span className="text-gray-400">/</span>
          <span className="text-[#6c757d]">Consolidated Report</span>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Claims */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#007bff]">
            <Users className="w-6 h-6" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Total Claims</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{data.length}</span>
            <span className="text-[9px] text-[#007bff] font-bold uppercase block mt-1">Engineers Listed</span>
          </div>
        </div>

        {/* Card 2: Claimed Amount */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#ffc107]">
            <IndianRupee className="w-6 h-6 text-white" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Claimed Amount</span>
            <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{fmt(totalClaimed)}</span>
            <span className="text-[9px] text-amber-600 font-bold uppercase block mt-1">Before Deductions</span>
          </div>
        </div>

        {/* Card 3: Total Advances */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#dc3545]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Total Advances</span>
            <span className="text-base font-extrabold text-[#dc3545] font-mono block mt-0.5">{fmt(totalAdvances)}</span>
            <span className="text-[9px] text-[#dc3545] font-bold uppercase block mt-1">Paid in Advance</span>
          </div>
        </div>

        {/* Card 4: Net Payable */}
        <div className="info-box-lte animate-fadeIn">
          <div className="info-box-icon bg-[#28a745]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="info-box-content">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Net Payable</span>
            <span className="text-base font-extrabold text-[#28a745] font-mono block mt-0.5">{fmt(totalNet)}</span>
            <span className="text-[9px] text-[#28a745] font-bold uppercase block mt-1">Net Reimbursement</span>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card border-t-3 border-primary bg-white shadow-sm border border-gray-200 rounded-sm">
        <div className="card-header border-b border-gray-150 px-4 py-2.5 flex items-center justify-between bg-gray-50/40">
          <h3 className="card-title text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Select Billing Period
          </h3>
          <button 
            onClick={fetchReport} 
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="card-body p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer">
                {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Select Year</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={fetchReport} 
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-sm shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" /> Fetch Consolidated Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="card border-t-3 border-green-500 bg-white shadow-sm border border-gray-200 rounded-sm">
        <div className="card-header border-b border-gray-150 px-4 py-3 flex items-center justify-between bg-gray-50/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {month} {year} Summary Grid
            </span>
          </div>
          <button 
            onClick={downloadExcel} 
            disabled={data.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" /> Export Consolidated Excel
          </button>
        </div>
        <div className="card-body p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400 font-semibold text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" /> Loading report data...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium italic text-xs">
              No approved claims found for this month/year.
            </div>
          ) : (
            <table className="w-full text-[11px] border-collapse min-w-[1600px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-left border-b border-gray-200">
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center font-bold">Zone</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center font-bold">EE Code</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center font-bold">Grade</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center font-bold">CC</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-left font-bold">EE Name</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-center font-bold">DOJ</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Travel Exp</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">DA</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Spare Cost</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Courier</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Hotel</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Print/Stat</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Misc</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold">Fuel</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold bg-gray-50">Total</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold text-red-700 bg-red-50/10">Advance</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-right font-bold text-green-700 bg-green-50/10">Net Payable</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-left font-bold">GST Bills</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-left font-bold max-w-[200px] truncate">Deduction Reason</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 text-left font-bold">Remarks</th>
                  <th className="py-2.5 px-3 text-right font-bold">Claimed Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {data.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors text-gray-700">
                    <td className="py-2.5 px-3 text-center font-semibold border-r border-gray-150">{r.zone || "—"}</td>
                    <td className="py-2.5 px-3 text-center border-r border-gray-150 font-mono font-bold text-blue-700 bg-blue-50/20">{r.ee_code}</td>
                    <td className="py-2.5 px-3 text-center font-medium border-r border-gray-150">{r.grade || "—"}</td>
                    <td className="py-2.5 px-3 text-center font-medium border-r border-gray-150">{r.cc || "—"}</td>
                    <td className="py-2.5 px-3 font-semibold border-r border-gray-150">{r.ee_name}</td>
                    <td className="py-2.5 px-3 text-center font-mono border-r border-gray-150">{r.doj || "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.travel_expense > 0 ? fmt(r.travel_expense) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.da_allowance > 0 ? fmt(r.da_allowance) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.spare_purchase > 0 ? fmt(r.spare_purchase) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.courier_charges > 0 ? fmt(r.courier_charges) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.boarding_lodging > 0 ? fmt(r.boarding_lodging) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{r.printing_stationery > 0 ? fmt(r.printing_stationery) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">—</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">—</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono font-bold bg-gray-50">{fmt(r.total)}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono font-bold text-red-700 bg-red-50/10">{r.advance > 0 ? fmt(r.advance) : "—"}</td>
                    <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono font-bold text-green-700 bg-green-50/10">{fmt(r.net_payable)}</td>
                    <td className="py-2.5 px-3 border-r border-gray-150">—</td>
                    <td className="py-2.5 px-3 border-r border-gray-150 max-w-[200px] truncate" title={r.deduction_reason}>{r.deduction_reason || "—"}</td>
                    <td className="py-2.5 px-3 border-r border-gray-150">—</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmt(r.claimed_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-50/50 border-t-2 border-yellow-250 text-[11px] font-bold text-gray-800">
                  <td colSpan={6} className="py-2.5 px-3 border-r border-gray-150 text-center uppercase tracking-wider text-gray-600 font-sans">
                    Grand Total
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.travel_expense, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.da_allowance, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.spare_purchase, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.courier_charges, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.boarding_lodging, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">{fmt(data.reduce((s, r) => s + r.printing_stationery, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">—</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono">—</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono bg-gray-50">{fmt(data.reduce((s, r) => s + r.total, 0))}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono text-red-700 bg-red-50/10">{fmt(totalAdvances)}</td>
                  <td className="py-2.5 px-3 text-right border-r border-gray-150 font-mono text-green-700 bg-green-50/10">{fmt(totalNet)}</td>
                  <td className="border-r border-gray-150" />
                  <td className="border-r border-gray-150" />
                  <td className="border-r border-gray-150" />
                  <td className="text-right font-mono">{fmt(totalClaimed)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
