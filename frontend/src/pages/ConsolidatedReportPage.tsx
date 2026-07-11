import { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Calendar, Search, RefreshCw, 
  Download, Users, IndianRupee, ShieldAlert, CheckCircle2,
  BookOpen, Info, ChevronDown, ChevronUp
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
  const [selectedPolicyGrade, setSelectedPolicyGrade] = useState<string>("Grade A");
  const [policyRules, setPolicyRules] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState<boolean>(false);
  const [showPolicyPanel, setShowPolicyPanel] = useState<boolean>(false);

  const fetchPolicies = async () => {
    setLoadingPolicies(true);
    try {
      const res = await expenseService.getPolicyRules(selectedPolicyGrade);
      if (res && res.success) {
        setPolicyRules(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load policy rules", err);
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    if (showPolicyPanel) {
      fetchPolicies();
    }
  }, [selectedPolicyGrade, showPolicyPanel]);

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
      
      // Travelling Expense formulas
      const privateTravelFormula = `=(${r.bike_km || 0}*4.5)+(${r.car_km || 0}*9)`;
      const publicTravelFormula = `=${r.auto_amount || 0}+${r.train_bus_amount || 0}`;
      
      // Total formula (Sum columns I to Q)
      const totalFormula = `=SUM(I${R}:Q${R})`;
      
      // Net Payable formula (Total Column R minus Advance Column S)
      const netPayableFormula = `=R${R}-S${R}`;

      // Difference formula (Claimed Column AC minus Approved Total Column R)
      const diffFormula = `=AC${R}-R${R}`;

      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${r.submitted_date || ""}</td>
          <td>${r.mail_hard_copy || "Soft Copy"}</td>
          <td style="mso-number-format:'\\@';">${r.ee_code}</td>
          <td>${r.grade || ""}</td>
          <td>${r.designation || ""}</td>
          <td>${r.cc || ""}</td>
          <td>${r.ee_name || ""}</td>
          <td style="text-align:right;">${privateTravelFormula}</td>
          <td style="text-align:right;">${publicTravelFormula}</td>
          <td style="text-align:right;">${(r.da_allowance || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(r.spare_purchase || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(r.courier_charges || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(r.boarding_lodging || 0).toFixed(2)}</td>
          <td style="text-align:right;">${(r.printing_stationery || 0).toFixed(2)}</td>
          <td style="text-align:right;">0.00</td>
          <td style="text-align:right;">0.00</td>
          <td style="text-align:right; font-weight:bold;">${totalFormula}</td>
          <td style="text-align:right; color:red;">${(r.advance || 0).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:green;">${netPayableFormula}</td>
          <td></td>
          <td>Approved</td>
          <td>${r.deduction_reason || ""}</td>
          <td>${r.month || ""}</td>
          <td>${r.hold_reason || "No"}</td>
          <td>${r.remarks || ""}</td>
          <td>${r.manager || ""}</td>
          <td>${r.state || "Rajasthan"}</td>
          <td style="text-align:right;">${(r.claimed_amount || 0).toFixed(2)}</td>
          <td style="text-align:right; font-weight:bold; color:red;">${diffFormula}</td>
        </tr>
      `;
    });

    // Summary row
    rowsHtml += `
      <tr style="background-color:#e8f5e9; font-weight:bold; border-top:2px solid #1b5e20;">
        <td colspan="8" style="text-align:center; font-family:'Aptos', sans-serif;">GRAND TOTAL</td>
        <td style="text-align:right;">=SUM(I2:I${data.length + 1})</td>
        <td style="text-align:right;">=SUM(J2:J${data.length + 1})</td>
        <td style="text-align:right;">=SUM(K2:K${data.length + 1})</td>
        <td style="text-align:right;">=SUM(L2:L${data.length + 1})</td>
        <td style="text-align:right;">=SUM(M2:M${data.length + 1})</td>
        <td style="text-align:right;">=SUM(N2:N${data.length + 1})</td>
        <td style="text-align:right;">=SUM(O2:O${data.length + 1})</td>
        <td style="text-align:right;">=SUM(P2:P${data.length + 1})</td>
        <td style="text-align:right;">=SUM(Q2:Q${data.length + 1})</td>
        <td style="text-align:right;">=SUM(R2:R${data.length + 1})</td>
        <td style="text-align:right;">=SUM(S2:S${data.length + 1})</td>
        <td style="text-align:right;">=SUM(T2:T${data.length + 1})</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align:right;">=SUM(AC2:AC${data.length + 1})</td>
        <td style="text-align:right;">=SUM(AD2:AD${data.length + 1})</td>
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
            color: #ffffff; 
            font-weight: bold; 
            border: 1px solid #1b5e20; 
            padding: 6px 8.5px; 
            font-family: 'Aptos', 'Segoe UI', sans-serif; 
            font-size: 10.5pt; 
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
              <th>Sl No</th>
              <th>Submitted Date</th>
              <th>Mail / Hard Copy</th>
              <th>EE Code</th>
              <th>Grade</th>
              <th>Designation</th>
              <th>CC</th>
              <th>EE Name</th>
              <th>5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)</th>
              <th>5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)</th>
              <th>5314102 - Exp Daily Allowances</th>
              <th>5314108 - Exp Spare Purchase Cost - Non GST</th>
              <th>5314103 - Exp Courier Charges</th>
              <th>5314104 - Exp Boarding & Lodging</th>
              <th>5314105 - Exp Printing & Stationery</th>
              <th>5314106 - Exp Miscellaneous Expenses</th>
              <th>5314107 - Exp Fuel Expenses</th>
              <th>Total</th>
              <th>Advances</th>
              <th>Net Payable</th>
              <th>GST Bills</th>
              <th>Status</th>
              <th>Reason for deduction</th>
              <th>Month</th>
              <th>Hold Reson</th>
              <th>Remarks</th>
              <th>Manager</th>
              <th>State</th>
              <th>total claimed amount</th>
              <th>differenece</th>
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

  const fmt = (v: number) => (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalClaimed = data.reduce((s, r) => s + r.claimed_amount, 0);
  const totalAdvances = data.reduce((s, r) => s + r.advance, 0);
  const totalNet = data.reduce((s, r) => s + r.net_payable, 0);

  return (
    <div className="w-full mx-auto px-1 sm:px-2 lg:px-4 space-y-6 animate-fadeIn font-sans pb-12">
      {/* AdminLTE Content Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 px-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
            <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-650" />
            Consolidated Monthly Report
            <span className="text-xs font-normal text-slate-400 hidden sm:inline-block ml-1">Excel Export & Reconciliation</span>
          </h1>
        </div>
        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <Link to="/home" className="text-indigo-600 hover:underline">Home</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Consolidated Report</span>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Claims */}
        <div className="group bg-white border border-slate-100 rounded-3xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-300 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Total Claims</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block mt-0.5">{data.length}</span>
            <span className="text-[9px] text-indigo-600 font-extrabold uppercase block mt-1">Engineers Listed</span>
          </div>
        </div>

        {/* Card 2: Claimed Amount */}
        <div className="group bg-white border border-slate-100 rounded-3xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-300 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600 shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Claimed Amount</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block mt-0.5">₹{fmt(totalClaimed)}</span>
            <span className="text-[9px] text-amber-600 font-extrabold uppercase block mt-1">Before Deductions</span>
          </div>
        </div>

        {/* Card 3: Total Advances */}
        <div className="group bg-white border border-slate-100 rounded-3xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-300 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Total Advances</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block mt-0.5">₹{fmt(totalAdvances)}</span>
            <span className="text-[9px] text-rose-650 font-extrabold uppercase block mt-1">Paid in Advance</span>
          </div>
        </div>

        {/* Card 4: Net Payable */}
        <div className="group bg-white border border-slate-100 rounded-3xl p-4 flex items-center gap-4 hover:shadow-md transition-all duration-300 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Net Payable</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block mt-0.5">₹{fmt(totalNet)}</span>
            <span className="text-[9px] text-emerald-650 font-extrabold uppercase block mt-1">Net Reimbursement</span>
          </div>
        </div>
      </div>

      {/* Policy Guide Panel */}
      <div className="card border border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden">
        <div 
          onClick={() => setShowPolicyPanel(!showPolicyPanel)}
          className="card-header border-b border-slate-100 px-5 py-3.5 flex items-center justify-between bg-slate-50/20 cursor-pointer hover:bg-slate-50/40 transition-colors"
        >
          <h3 className="card-title text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-650" />
            Company Expense Policies (Non-AI Policy Guide)
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-semibold sm:inline hidden">Quick policy limits lookup</span>
            {showPolicyPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
        
        {showPolicyPanel && (
          <div className="card-body p-5 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="w-full sm:w-1/3 max-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Select Grade</label>
                <select 
                  value={selectedPolicyGrade} 
                  onChange={(e) => setSelectedPolicyGrade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {["Grade A", "Grade B", "Grade C", "Grade D", "Grade E"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-2 text-indigo-600 bg-indigo-50/50 p-2.5 rounded-2xl border border-indigo-100/30">
                <Info className="w-4 h-4 shrink-0 text-indigo-500" />
                <p className="text-[10px] font-semibold leading-relaxed text-slate-650">
                  Select a grade to see the active reimbursement limits and rates. Claims that exceed these thresholds are flagged for audit and may be automatically deducted.
                </p>
              </div>
            </div>

            {loadingPolicies ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Loading policies...
              </div>
            ) : policyRules.length === 0 ? (
              <div className="text-center py-6 text-slate-400 font-medium italic text-xs">
                No policy rules configured for this grade.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {policyRules.map((rule) => {
                  const isKmRate = rule.expense_type.includes("Transport");
                  const displayLimit = isKmRate 
                    ? `₹${rule.limit_amount.toFixed(2)} / KM` 
                    : `₹${rule.limit_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Max`;
                  return (
                    <div key={rule.id} className="p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100/70 rounded-2xl transition-all duration-200">
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-650 block mb-0.5">{rule.expense_type}</span>
                      <span className="text-sm font-extrabold text-slate-800 block mb-1 font-mono">{displayLimit}</span>
                      <p className="text-[9.5px] text-slate-450 leading-normal font-medium">{rule.description || "No description provided."}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Card */}
      <div className="card border border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden">
        <div className="card-header border-b border-slate-100 px-5 py-3.5 flex items-center justify-between bg-slate-50/20">
          <h3 className="card-title text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Select Billing Period
          </h3>
          <button 
            onClick={fetchReport} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60 transform hover:-translate-y-0.5 active:translate-y-0 duration-200"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="card-body p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Select Month</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer">
                {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Select Year</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={fetchReport} 
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-850 text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-60 cursor-pointer min-h-[38px] transform hover:-translate-y-0.5 active:translate-y-0 duration-200"
              >
                <Search className="w-3.5 h-3.5" /> Fetch Consolidated Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="card border-t-3 border-green-500 bg-white shadow-sm border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden">
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-650 hover:from-emerald-700 hover:to-green-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 duration-205"
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
            <table className="w-full text-[10px] border-collapse min-w-[2200px] border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-left">
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Sl No</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Submitted Date</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Mail / Hard Copy</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">EE Code</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Grade</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Designation</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">CC</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-left font-bold">EE Name</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314102 - Exp Daily Allowances</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314108 - Exp Spare Purchase Cost - Non GST</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314103 - Exp Courier Charges</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314104 - Exp Boarding & Lodging</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314105 - Exp Printing & Stationery</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314106 - Exp Miscellaneous Expenses</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">5314107 - Exp Fuel Expenses</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold bg-slate-50">Total</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold text-red-700 bg-red-50/10">Advances</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold text-green-700 bg-green-50/10">Net Payable</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-left font-bold">GST Bills</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Status</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-left font-bold max-w-[200px] truncate">Reason for deduction</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Month</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">Hold Reson</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-left font-bold">Remarks</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-left font-bold">Manager</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-center font-bold">State</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">total claimed amount</th>
                  <th className="py-1.5 px-1.5 border border-slate-200 text-right font-bold">differenece</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((r, idx) => {
                  const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
                  const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
                  const rowDiff = r.claimed_amount - r.total;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                      <td className="py-1.5 px-1.5 text-center font-semibold border border-slate-200">{idx + 1}</td>
                      <td className="py-1.5 px-1.5 text-center font-mono border border-slate-200 whitespace-nowrap">{r.submitted_date || ""}</td>
                      <td className="py-1.5 px-1.5 text-center font-medium border border-slate-200">{r.mail_hard_copy || ""}</td>
                      <td className="py-1.5 px-1.5 text-center border border-slate-200 font-mono font-bold text-blue-700 bg-blue-50/20">{r.ee_code}</td>
                      <td className="py-1.5 px-1.5 text-center font-medium border border-slate-200">{r.grade || ""}</td>
                      <td className="py-1.5 px-1.5 font-medium border border-slate-200 truncate max-w-[150px]" title={r.designation}>{r.designation || ""}</td>
                      <td className="py-1.5 px-1.5 text-center font-medium border border-slate-200">{r.cc || ""}</td>
                      <td className="py-1.5 px-1.5 font-semibold border border-slate-200">{r.ee_name || ""}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(privateTravel)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(publicTravel)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(r.da_allowance)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(r.spare_purchase)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(r.courier_charges)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(r.boarding_lodging)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">{fmt(r.printing_stationery)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">0.00</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono">0.00</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono font-bold bg-slate-50">{fmt(r.total)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono font-bold text-red-700 bg-red-50/10">{fmt(r.advance)}</td>
                      <td className="py-1.5 px-1.5 text-right border border-slate-200 font-mono font-bold text-green-700 bg-green-50/10">{fmt(r.net_payable)}</td>
                      <td className="py-1.5 px-1.5 border border-slate-200"></td>
                      <td className="py-1.5 px-1.5 text-center font-bold text-green-600 border border-slate-200">Approved</td>
                      <td className="py-1.5 px-1.5 border border-slate-200 max-w-[200px] truncate" title={r.deduction_reason}>{r.deduction_reason || ""}</td>
                      <td className="py-1.5 px-1.5 text-center border border-slate-200 font-mono">{r.month || ""}</td>
                      <td className="py-1.5 px-1.5 text-center border border-slate-200 font-semibold text-slate-500">{r.hold_reason || "No"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-200">{r.remarks || ""}</td>
                      <td className="py-1.5 px-1.5 border border-slate-200 truncate max-w-[120px]" title={r.manager}>{r.manager || ""}</td>
                      <td className="py-1.5 px-1.5 text-center border border-slate-200">{r.state || "Rajasthan"}</td>
                      <td className="py-1.5 px-1.5 border border-slate-200 text-right font-mono font-semibold">{fmt(r.claimed_amount)}</td>
                      <td className="py-1.5 px-1.5 border border-slate-200 text-right font-mono font-semibold text-red-650 bg-red-50/5">{fmt(rowDiff)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50/30 border-t-2 border-slate-200 text-[10px] font-bold text-slate-800">
                  <td colSpan={8} className="py-1.5 px-2 border border-slate-200 text-center uppercase tracking-wider text-slate-650 font-sans">
                    Grand Total
                  </td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + ((r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0), 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + ((r.auto_amount || 0) + (r.train_bus_amount || 0)), 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + r.da_allowance, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + r.spare_purchase, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + r.courier_charges, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + r.boarding_lodging, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(data.reduce((s, r) => s + r.printing_stationery, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">0.00</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">0.00</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono bg-slate-50">{fmt(data.reduce((s, r) => s + r.total, 0))}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono text-red-700 bg-red-50/10">{fmt(totalAdvances)}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono text-green-700 bg-green-50/10">{fmt(totalNet)}</td>
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono">{fmt(totalClaimed)}</td>
                  <td className="py-1.5 px-2 text-right border border-slate-200 font-mono text-red-700">{fmt(totalClaimed - data.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
