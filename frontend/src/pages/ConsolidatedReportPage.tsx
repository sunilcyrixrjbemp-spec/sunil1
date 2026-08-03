import { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Calendar, Search, RefreshCw, 
  Download, Users, IndianRupee, ShieldAlert, CheckCircle2,
  BookOpen, Info, ChevronDown, ChevronUp
} from "lucide-react";
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
  const [selectedPolicyGrade, setSelectedPolicyGrade] = useState<string>("");
  const [allPolicies, setAllPolicies] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState<boolean>(false);
  const [showPolicyPanel, setShowPolicyPanel] = useState<boolean>(false);

  const fetchPolicies = async () => {
    setLoadingPolicies(true);
    try {
      const res = await expenseService.getPolicyRules("");
      if (res && res.success) {
        const policies = res.data || [];
        setAllPolicies(policies);
        if (policies.length > 0 && !selectedPolicyGrade) {
          setSelectedPolicyGrade(policies[0].grade || "");
        }
      }
    } catch (err) {
      console.error("Failed to load policy rules from allowance master", err);
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    if (showPolicyPanel && allPolicies.length === 0) {
      fetchPolicies();
    }
  }, [showPolicyPanel]);

  const availableGrades = Array.from(new Set(allPolicies.map((p) => p.grade))).filter(Boolean).sort();
  const selectedPolicy = allPolicies.find((p) => p.grade === selectedPolicyGrade);

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
    <div className="w-full space-y-4 animate-fadeIn font-sans pb-12 text-[#212529]">
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">CONSOLIDATED MONTHLY REPORT</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Excel export, claims audit matrix, and company expense policy rules.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white bg-[#4A6A8A] px-2.5 py-1 rounded-none border border-[#4A6A8A] font-mono">
            Claims Listed: <strong>{data.length}</strong>
          </span>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-none border border-amber-200 font-mono">
            Claimed: <strong>₹{fmt(totalClaimed)}</strong>
          </span>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-none border border-emerald-200 font-mono">
            Net Payable: <strong>₹{fmt(totalNet)}</strong>
          </span>
        </div>
      </div>

      {/* 4 Enterprise Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Claims */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Claims</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{data.length}</span>
            <span className="text-[9px] text-[#4A6A8A] font-bold uppercase block mt-0.5">Engineers Listed</span>
          </div>
        </div>

        {/* Card 2: Claimed Amount */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-amber-600 flex items-center justify-center text-white shrink-0">
            <IndianRupee className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Claimed Amount</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">₹{fmt(totalClaimed)}</span>
            <span className="text-[9px] text-amber-700 font-bold uppercase block mt-0.5">Before Deductions</span>
          </div>
        </div>

        {/* Card 3: Total Advances */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-rose-600 flex items-center justify-center text-white shrink-0">
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Advances</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">₹{fmt(totalAdvances)}</span>
            <span className="text-[9px] text-rose-700 font-bold uppercase block mt-0.5">Paid in Advance</span>
          </div>
        </div>

        {/* Card 4: Net Payable */}
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Net Payable</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">₹{fmt(totalNet)}</span>
            <span className="text-[9px] text-emerald-700 font-bold uppercase block mt-0.5">Net Reimbursement</span>
          </div>
        </div>
      </div>

      {/* Company Policy Guide Panel */}
      <div className="border border-slate-300 rounded-none bg-white shadow-2xs overflow-hidden">
        <div 
          onClick={() => setShowPolicyPanel(!showPolicyPanel)}
          className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none cursor-pointer transition-colors"
        >
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 m-0">
            <BookOpen className="w-4 h-4 text-slate-200" />
            Company Expense Policies (Non-AI Policy Guide)
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-200 font-bold sm:inline hidden">Quick policy limits lookup</span>
            {showPolicyPanel ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </div>
        </div>
        
        {showPolicyPanel && (
          <div className="p-3 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div className="w-full sm:w-1/3 max-w-[240px]">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Grade</label>
                <select 
                  value={selectedPolicyGrade} 
                  onChange={(e) => setSelectedPolicyGrade(e.target.value)}
                  className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
                >
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-2 text-[#4A6A8A] bg-slate-50 p-2 border border-slate-200">
                <Info className="w-4 h-4 shrink-0 text-[#4A6A8A]" />
                <p className="text-[10.5px] font-bold leading-relaxed text-slate-700 m-0">
                  Showing active rules loaded dynamically from Allowance Master. Claimed amounts exceeding these limits are auto-flagged and subject to deduction.
                </p>
              </div>
            </div>

            {loadingPolicies ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-[#4A6A8A]" /> Loading allowances...
              </div>
            ) : !selectedPolicy ? (
              <div className="text-center py-6 text-slate-400 font-bold uppercase tracking-wider text-xs">
                No policy rules configured for this grade.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-fadeIn">
                {/* 1. Daily Allowance In-District */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">DA (In-District)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_in_district || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance inside headquarters district.</p>
                </div>

                {/* 2. Daily Allowance Out-District */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">DA (Out-District)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_out_district || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance outside headquarters district.</p>
                </div>

                {/* 3. Daily Allowance Hotel */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">DA (Hotel Stay)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_hotel || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance when staying at a hotel.</p>
                </div>

                {/* 4. Daily Allowance Out-State */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">DA (Out-of-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_out_state || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance outside parent state.</p>
                </div>

                {/* 5. In-State Hotel Room Rent */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">Hotel Rent (In-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.hotel_in_state_s || 0).toFixed(2)} / Night</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Max reimbursement per night for in-state hotel.</p>
                </div>

                {/* 6. Out-of-State Hotel Room Rent */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">Hotel Rent (Out-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.hotel_out_state_s || 0).toFixed(2)} / Night</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Max reimbursement per night for out-state hotel.</p>
                </div>

                {/* 7. Bike Rate */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">Bike Travel Rate</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.rate_bike || 4.5).toFixed(2)} / KM</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Rate per kilometer when using personal bike.</p>
                </div>

                {/* 8. Car Rate */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4A6A8A] block mb-0.5">Car Travel Rate</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.rate_car || 9.0).toFixed(2)} / KM</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Rate per kilometer when using personal car.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Billing Period Card */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs p-3">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 m-0">
            <Calendar className="w-4 h-4 text-[#4A6A8A]" />
            Select Billing Period
          </h3>
          <button 
            onClick={fetchReport} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[10.5px] font-bold rounded-none cursor-pointer disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Month</label>
            <select 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
            >
              {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Year</label>
            <select 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#4A6A8A] cursor-pointer bg-white"
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={fetchReport} 
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[#4A6A8A] hover:bg-[#3b5570] text-white text-xs font-extrabold uppercase rounded-none cursor-pointer border-0 shadow-2xs transition-colors disabled:opacity-60 h-[32px]"
            >
              <Search className="w-3.5 h-3.5" /> Fetch Consolidated Data
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="border border-slate-300 rounded-none shadow-2xs bg-white overflow-hidden">
        <div className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-200 shrink-0" />
            <span>
              {month} {year} Summary Grid <span className="text-emerald-300 font-mono">({data.length} records)</span>
            </span>
          </div>
          <button 
            onClick={downloadExcel} 
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-extrabold uppercase tracking-wider border-0 cursor-pointer shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Export Consolidated Excel
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 font-bold text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-[#4A6A8A]" /> Loading report data...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-extrabold text-xs uppercase tracking-wider">
              No approved claims found for this month/year.
            </div>
          ) : (
            <table className="w-full text-[10px] border-collapse min-w-[2200px] border border-slate-300">
              <thead>
                <tr className="bg-[#4A6A8A] text-white text-[10px] font-extrabold uppercase tracking-wider text-left border-b border-slate-600">
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Sl No</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Submitted Date</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Mail / Hard Copy</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">EE Code</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Grade</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Designation</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">CC</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-left">EE Name</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314101 - Exp Private Transport</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314101 - Exp Public Transport</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314102 - Exp DA</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314108 - Exp Spare Purchase</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314103 - Exp Courier</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314104 - Exp Boarding &amp; Lodging</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314105 - Exp Printing</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314106 - Misc</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">5314107 - Fuel</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right bg-slate-700/40">Total</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right bg-rose-700/40">Advances</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right bg-emerald-700/40">Net Payable</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-left">GST Bills</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Status</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-left min-w-[150px]">Reason for Deduction</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Month</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">Hold Reason</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-left">Remarks</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-left">Manager</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-center">State</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">Total Claimed</th>
                  <th className="py-2 px-1.5 border border-slate-600 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {data.map((r, idx) => {
                  const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
                  const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
                  const rowDiff = r.claimed_amount - r.total;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors text-slate-800 border-b border-slate-200">
                      <td className="py-2 px-1.5 text-center font-mono font-bold border border-slate-200 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-1.5 text-center font-mono border border-slate-200 whitespace-nowrap">{r.submitted_date || ""}</td>
                      <td className="py-2 px-1.5 text-center font-semibold border border-slate-200">{r.mail_hard_copy || ""}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-mono font-extrabold text-[#4A6A8A] bg-slate-100">{r.ee_code}</td>
                      <td className="py-2 px-1.5 text-center font-semibold border border-slate-200">{r.grade || ""}</td>
                      <td className="py-2 px-1.5 font-semibold border border-slate-200 truncate max-w-[150px]" title={r.designation}>{r.designation || ""}</td>
                      <td className="py-2 px-1.5 text-center font-semibold border border-slate-200">{r.cc || ""}</td>
                      <td className="py-2 px-1.5 font-extrabold text-slate-900 border border-slate-200">{r.ee_name || ""}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(privateTravel)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(publicTravel)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(r.da_allowance)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(r.spare_purchase)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(r.courier_charges)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(r.boarding_lodging)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold">{fmt(r.printing_stationery)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono text-slate-400">0.00</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono text-slate-400">0.00</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black bg-slate-100">{fmt(r.total)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black text-rose-700 bg-rose-50/40">{fmt(r.advance)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black text-emerald-700 bg-emerald-50/40">{fmt(r.net_payable)}</td>
                      <td className="py-2 px-1.5 border border-slate-200"></td>
                      <td className="py-2 px-1.5 text-center font-extrabold text-emerald-700 border border-slate-200 uppercase">Approved</td>
                      <td className="py-2 px-1.5 border border-slate-200 min-w-[150px] whitespace-normal break-words font-semibold text-slate-700" title={r.deduction_reason}>{r.deduction_reason || ""}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-mono font-bold text-[#4A6A8A]">{r.month || ""}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-bold text-slate-500">{r.hold_reason || "No"}</td>
                      <td className="py-2 px-1.5 border border-slate-200 whitespace-normal break-words min-w-[150px] text-slate-700">{r.remarks || ""}</td>
                      <td className="py-2 px-1.5 border border-slate-200 truncate max-w-[120px] font-bold" title={r.manager}>{r.manager || ""}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-semibold">{r.state || "Rajasthan"}</td>
                      <td className="py-2 px-1.5 border border-slate-200 text-right font-mono font-bold">{fmt(r.claimed_amount)}</td>
                      <td className="py-2 px-1.5 border border-slate-200 text-right font-mono font-black text-rose-700 bg-rose-50/20">{fmt(rowDiff)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs font-black text-slate-900 font-mono">
                  <td colSpan={8} className="py-2.5 px-2 border border-slate-300 text-center uppercase tracking-wider text-slate-800 font-sans font-extrabold">
                    Grand Total Summary
                  </td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + ((r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + ((r.auto_amount || 0) + (r.train_bus_amount || 0)), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + r.da_allowance, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + r.spare_purchase, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + r.courier_charges, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + r.boarding_lodging, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">{fmt(data.reduce((s, r) => s + r.printing_stationery, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">0.00</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono">0.00</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono bg-slate-200">{fmt(data.reduce((s, r) => s + r.total, 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono text-rose-800 bg-rose-100/60">{fmt(totalAdvances)}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono text-emerald-800 bg-emerald-100/60">{fmt(totalNet)}</td>
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300 text-center font-sans font-bold text-slate-700">{data.length} Staff</td>
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono font-black">{fmt(totalClaimed)}</td>
                  <td className="py-2.5 px-2 text-right border border-slate-300 font-mono font-black text-rose-800 bg-rose-100/60">{fmt(totalClaimed - data.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
