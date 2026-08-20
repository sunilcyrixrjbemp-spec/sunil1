import { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Calendar, Search, RefreshCw, 
  Download, Users, IndianRupee, ShieldAlert, CheckCircle2,
  BookOpen, Info, ChevronDown, ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
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

  const downloadExcel = async () => {
    if (data.length === 0) {
      toast.error("No data available to download");
      return;
    }

    const tid = toast.loading("Generating styled Excel report with cell notes...");

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Cyrix Field Connect";
      workbook.lastModifiedBy = "Cyrix Field Connect";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Consolidated Report", {
        views: [{ state: "frozen", ySplit: 1 }]
      });

      worksheet.columns = [
        { header: "Sl No", key: "sl_no", width: 8 },
        { header: "Submitted Date", key: "submitted_date", width: 15 },
        { header: "Mail / Hard Copy", key: "mail_hard_copy", width: 16 },
        { header: "EE Code", key: "ee_code", width: 12 },
        { header: "Grade", key: "grade", width: 10 },
        { header: "Designation", key: "designation", width: 26 },
        { header: "CC", key: "cc", width: 14 },
        { header: "EE Name", key: "ee_name", width: 28 },
        { header: "5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)", key: "pvt_travel", width: 24 },
        { header: "5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)", key: "pub_travel", width: 24 },
        { header: "5314102 - Exp Daily Allowances", key: "da_allowance", width: 18 },
        { header: "5314108 - Exp Spare Purchase Cost - Non GST", key: "spare_purchase", width: 22 },
        { header: "5314103 - Exp Courier Charges", key: "courier_charges", width: 18 },
        { header: "5314104 - Exp Boarding & Lodging", key: "boarding_lodging", width: 20 },
        { header: "5314105 - Exp Printing & Stationery", key: "printing_stationery", width: 20 },
        { header: "5314106 - Exp Miscellaneous Expenses", key: "misc_expenses", width: 20 },
        { header: "5314107 - Exp Fuel Expenses", key: "fuel", width: 16 },
        { header: "Total", key: "total", width: 16 },
        { header: "Advances", key: "advance", width: 14 },
        { header: "Net Payable", key: "net_payable", width: 16 },
        { header: "GST Bills", key: "gst_bills", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Reason for deduction", key: "deduction_reason", width: 45 },
        { header: "Month", key: "month", width: 14 },
        { header: "Hold Reson", key: "hold_reason", width: 12 },
        { header: "Remarks", key: "remarks", width: 20 },
        { header: "Manager", key: "manager", width: 22 },
        { header: "State", key: "state", width: 14 },
        { header: "total claimed amount", key: "claimed_amount", width: 20 },
        { header: "differenece", key: "diff", width: 16 }
      ];

      // Style Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1B5E20" } // Dark Green
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF1B5E20" } },
          bottom: { style: "thin", color: { argb: "FF1B5E20" } },
          left: { style: "thin", color: { argb: "FF1B5E20" } },
          right: { style: "thin", color: { argb: "FF1B5E20" } }
        };
      });

      // Add Data Rows
      data.forEach((r, idx) => {
        const rowNum = idx + 2;
        const bikeKm = parseFloat(r.bike_km || 0);
        const carKm = parseFloat(r.car_km || 0);
        const autoAmt = parseFloat(r.auto_amount || 0);
        const trainBusAmt = parseFloat(r.train_bus_amount || 0);

        const row = worksheet.addRow({
          sl_no: idx + 1,
          submitted_date: r.submitted_date || "",
          mail_hard_copy: r.mail_hard_copy || "Soft Copy",
          ee_code: r.ee_code,
          grade: r.grade || "",
          designation: r.designation || "",
          cc: r.cc || "",
          ee_name: r.ee_name || "",
          pvt_travel: { formula: `(${bikeKm.toFixed(2)}*4.5)+(${carKm.toFixed(2)}*9)` },
          pub_travel: { formula: `${autoAmt.toFixed(2)}+${trainBusAmt.toFixed(2)}` },
          da_allowance: r.da_allowance || 0,
          spare_purchase: r.spare_purchase || 0,
          courier_charges: r.courier_charges || 0,
          boarding_lodging: r.boarding_lodging || 0,
          printing_stationery: r.printing_stationery || 0,
          misc_expenses: r.misc_expenses || 0,
          fuel: 0,
          total: { formula: `SUM(I${rowNum}:Q${rowNum})` },
          advance: r.advance || 0,
          net_payable: { formula: `R${rowNum}-S${rowNum}` },
          gst_bills: "",
          status: "Approved",
          deduction_reason: r.deduction_reason || "",
          month: r.month || "",
          hold_reason: r.hold_reason || "No",
          remarks: "",
          manager: r.manager || "",
          state: r.state || "Rajasthan",
          claimed_amount: r.claimed_amount || 0,
          diff: { formula: `AC${rowNum}-R${rowNum}` }
        });

        row.height = 20;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 9.5 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFC8E6C9" } },
            bottom: { style: "thin", color: { argb: "FFC8E6C9" } },
            left: { style: "thin", color: { argb: "FFC8E6C9" } },
            right: { style: "thin", color: { argb: "FFC8E6C9" } }
          };

          if ([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 29, 30].includes(colNumber)) {
            cell.numFmt = "#,##0.00";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else if (colNumber === 1 || colNumber === 4 || colNumber === 5) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          if (colNumber === 18) {
            cell.font = { name: "Segoe UI", size: 9.5, bold: true };
          } else if (colNumber === 19) {
            cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FFD32F2F" } };
          } else if (colNumber === 20) {
            cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF2E7D32" } };
          } else if (colNumber === 30) {
            cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFD32F2F" } };
          }
        });

        // Hover / Click Note on Misc Cell (Column P / col 16)
        if (r.miscItemList && Array.isArray(r.miscItemList) && r.miscItemList.length > 0) {
          const miscCell = row.getCell(16);
          miscCell.note = r.miscItemList.map((m: any) => `${m.date}: ₹${m.amount} (${m.desc})`).join("\n");
        }
      });

      // Add Grand Total Summary Row
      const grandTotalRowNum = data.length + 2;
      const grandTotalRow = worksheet.addRow({
        sl_no: "GRAND TOTAL",
        pvt_travel: { formula: `SUM(I2:I${grandTotalRowNum - 1})` },
        pub_travel: { formula: `SUM(J2:J${grandTotalRowNum - 1})` },
        da_allowance: { formula: `SUM(K2:K${grandTotalRowNum - 1})` },
        spare_purchase: { formula: `SUM(L2:L${grandTotalRowNum - 1})` },
        courier_charges: { formula: `SUM(M2:M${grandTotalRowNum - 1})` },
        boarding_lodging: { formula: `SUM(N2:N${grandTotalRowNum - 1})` },
        printing_stationery: { formula: `SUM(O2:O${grandTotalRowNum - 1})` },
        misc_expenses: { formula: `SUM(P2:P${grandTotalRowNum - 1})` },
        fuel: { formula: `SUM(Q2:Q${grandTotalRowNum - 1})` },
        total: { formula: `SUM(R2:R${grandTotalRowNum - 1})` },
        advance: { formula: `SUM(S2:S${grandTotalRowNum - 1})` },
        net_payable: { formula: `SUM(T2:T${grandTotalRowNum - 1})` },
        claimed_amount: { formula: `SUM(AC2:AC${grandTotalRowNum - 1})` },
        diff: { formula: `SUM(AD2:AD${grandTotalRowNum - 1})` }
      });

      worksheet.mergeCells(`A${grandTotalRowNum}:H${grandTotalRowNum}`);
      grandTotalRow.height = 24;

      grandTotalRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F5E9" } // Light Green
        };
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF1B5E20" } };
        cell.border = {
          top: { style: "medium", color: { argb: "FF1B5E20" } },
          bottom: { style: "medium", color: { argb: "FF1B5E20" } }
        };
        if (colNumber >= 9) {
          cell.numFmt = "#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Consolidated_Report_${month}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.dismiss(tid);
      toast.success("Excel report downloaded successfully!");
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error("Failed to generate Excel: " + (err?.message || "Unknown error"));
    }
  };

  const fmt = (v: number) => (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalClaimed = data.reduce((s, r) => s + (r.claimed_amount || 0), 0);
  const totalAdvances = data.reduce((s, r) => s + (r.advance || 0), 0);
  const totalApprovedSum = data.reduce((s, r) => {
    const pvt = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
    const pub = (r.auto_amount || 0) + (r.train_bus_amount || 0);
    return s + (pvt + pub + (r.da_allowance || 0) + (r.spare_purchase || 0) + (r.courier_charges || 0) + (r.boarding_lodging || 0) + (r.printing_stationery || 0) + (r.misc_expenses || 0));
  }, 0);
  const totalNet = totalApprovedSum - totalAdvances;

  return (
    <div className="w-full space-y-4 animate-fadeIn font-sans pb-12 text-[#212529]">
      {/* Header Info Bar */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#1B5E20] flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">CONSOLIDATED MONTHLY REPORT</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Excel export, claims audit matrix, and company expense policy rules.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white bg-[#1B5E20] px-2.5 py-1 rounded-none border border-[#1B5E20] font-mono">
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
          <div className="w-9 h-9 rounded-none bg-[#1B5E20] flex items-center justify-center text-white shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Claims</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{data.length}</span>
            <span className="text-[9px] text-[#1B5E20] font-bold uppercase block mt-0.5">Engineers Listed</span>
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
          className="bg-[#1B5E20] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none cursor-pointer transition-colors"
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
                  className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1B5E20] cursor-pointer bg-white"
                >
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex items-center gap-2 text-[#1B5E20] bg-slate-50 p-2 border border-slate-200">
                <Info className="w-4 h-4 shrink-0 text-[#1B5E20]" />
                <p className="text-[10.5px] font-bold leading-relaxed text-slate-700 m-0">
                  Showing active rules loaded dynamically from Allowance Master. Claimed amounts exceeding these limits are auto-flagged and subject to deduction.
                </p>
              </div>
            </div>

            {loadingPolicies ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-[#1B5E20]" /> Loading allowances...
              </div>
            ) : !selectedPolicy ? (
              <div className="text-center py-6 text-slate-400 font-bold uppercase tracking-wider text-xs">
                No policy rules configured for this grade.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-fadeIn">
                {/* 1. Daily Allowance In-District */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">DA (In-District)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_in_district || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance inside headquarters district.</p>
                </div>

                {/* 2. Daily Allowance Out-District */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">DA (Out-District)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_out_district || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance outside headquarters district.</p>
                </div>

                {/* 3. Daily Allowance Hotel */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">DA (Hotel Stay)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_hotel || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance when staying at a hotel.</p>
                </div>

                {/* 4. Daily Allowance Out-State */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">DA (Out-of-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.daily_out_state || 0).toFixed(2)}</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Daily allowance outside parent state.</p>
                </div>

                {/* 5. In-State Hotel Room Rent */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">Hotel Rent (In-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.hotel_in_state_s || 0).toFixed(2)} / Night</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Max reimbursement per night for in-state hotel.</p>
                </div>

                {/* 6. Out-of-State Hotel Room Rent */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">Hotel Rent (Out-State)</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.hotel_out_state_s || 0).toFixed(2)} / Night</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Max reimbursement per night for out-state hotel.</p>
                </div>

                {/* 7. Bike Rate */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">Bike Travel Rate</span>
                  <span className="text-sm font-black text-slate-900 block mb-1 font-mono">₹{(selectedPolicy.rate_bike || 4.5).toFixed(2)} / KM</span>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-snug m-0">Rate per kilometer when using personal bike.</p>
                </div>

                {/* 8. Car Rate */}
                <div className="p-3 bg-white border border-slate-300 rounded-none shadow-2xs">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#1B5E20] block mb-0.5">Car Travel Rate</span>
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
            <Calendar className="w-4 h-4 text-[#1B5E20]" />
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
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1B5E20] cursor-pointer bg-white"
            >
              {MONTHS.slice(1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Year</label>
            <select 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-slate-300 rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1B5E20] cursor-pointer bg-white"
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={fetchReport} 
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[#1B5E20] hover:bg-[#154a19] text-white text-xs font-extrabold uppercase rounded-none cursor-pointer border-0 shadow-2xs transition-colors disabled:opacity-60 h-[32px]"
            >
              <Search className="w-3.5 h-3.5" /> Fetch Consolidated Data
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="border border-slate-300 rounded-none shadow-2xs bg-white overflow-hidden">
        <div className="bg-[#1B5E20] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center justify-between rounded-none flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>
              {month} {year} Summary Grid <span className="text-emerald-300 font-mono">({data.length} records)</span>
            </span>
          </div>
          <button 
            onClick={downloadExcel} 
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-none bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold uppercase tracking-wider border border-emerald-400/30 cursor-pointer shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Export Consolidated Excel (.xlsx)
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 font-bold text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1B5E20]" /> Loading report data...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-extrabold text-xs uppercase tracking-wider">
              No approved claims found for this month/year.
            </div>
          ) : (
            <table className="w-full text-[10px] border-collapse min-w-[2200px] border border-slate-300">
              <thead>
                <tr className="bg-[#1B5E20] text-white text-[10px] font-extrabold uppercase tracking-wider text-left border-b border-emerald-800">
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Sl No</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Submitted Date</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Mail / Hard Copy</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">EE Code</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Grade</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Designation</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">CC</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-left">EE Name</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314101 - Exp Private Transport</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314101 - Exp Public Transport</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314102 - Exp DA</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314108 - Exp Spare Purchase</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314103 - Exp Courier</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314104 - Exp Boarding &amp; Lodging</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314105 - Exp Printing</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314106 - Exp Misc</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">5314107 - Fuel</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right bg-emerald-950/40">Total</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right bg-rose-700/40">Advances</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right bg-emerald-700/40">Net Payable</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-left">GST Bills</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Status</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-left min-w-[150px]">Reason for Deduction</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Month</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">Hold Reason</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-left">Remarks</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-left">Manager</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-center">State</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">Total Claimed</th>
                  <th className="py-2 px-1.5 border border-emerald-700/60 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {data.map((r, idx) => {
                  const privateTravel = (r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0;
                  const publicTravel = (r.auto_amount || 0) + (r.train_bus_amount || 0);
                  const rowTotal = privateTravel + publicTravel + (r.da_allowance || 0) + (r.spare_purchase || 0) + (r.courier_charges || 0) + (r.boarding_lodging || 0) + (r.printing_stationery || 0) + (r.misc_expenses || 0);
                  const rowNet = rowTotal - (r.advance || 0);
                  const rowDiff = (r.claimed_amount || 0) - rowTotal;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors text-slate-800 border-b border-slate-200">
                      <td className="py-2 px-1.5 text-center font-mono font-bold border border-slate-200 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-1.5 text-center font-mono border border-slate-200 whitespace-nowrap">{r.submitted_date || ""}</td>
                      <td className="py-2 px-1.5 text-center font-semibold border border-slate-200">{r.mail_hard_copy || "Soft Copy"}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-mono font-extrabold text-[#1B5E20] bg-slate-50">{r.ee_code}</td>
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
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-bold text-slate-700">{fmt(r.misc_expenses)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono text-slate-400">0.00</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black bg-slate-100">{fmt(rowTotal)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black text-rose-700 bg-rose-50/40">{fmt(r.advance)}</td>
                      <td className="py-2 px-1.5 text-right border border-slate-200 font-mono font-black text-emerald-700 bg-emerald-50/40">{fmt(rowNet)}</td>
                      <td className="py-2 px-1.5 border border-slate-200"></td>
                      <td className="py-2 px-1.5 text-center font-extrabold text-emerald-700 border border-slate-200 uppercase">Approved</td>
                      <td className="py-2 px-1.5 border border-slate-200 min-w-[150px] whitespace-normal break-words font-semibold text-slate-700" title={r.deduction_reason}>{r.deduction_reason || ""}</td>
                      <td className="py-2 px-1.5 text-center border border-slate-200 font-mono font-bold text-[#1B5E20]">{r.month || ""}</td>
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
                <tr className="bg-emerald-50/60 border-t-2 border-[#1B5E20] text-xs font-black text-slate-900 font-mono">
                  <td colSpan={8} className="py-2.5 px-2 border border-emerald-200 text-center uppercase tracking-wider text-[#1B5E20] font-sans font-extrabold">
                    Grand Total Summary
                  </td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + ((r.bike_km || 0) * 4.5 + (r.car_km || 0) * 9.0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + ((r.auto_amount || 0) + (r.train_bus_amount || 0)), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.da_allowance || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.spare_purchase || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.courier_charges || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.boarding_lodging || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.printing_stationery || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">{fmt(data.reduce((s, r) => s + (r.misc_expenses || 0), 0))}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono">0.00</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono bg-emerald-100/60 font-black">{fmt(totalApprovedSum)}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono text-rose-800 bg-rose-100/60">{fmt(totalAdvances)}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono text-emerald-800 bg-emerald-100/80 font-black">{fmt(totalNet)}</td>
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200 text-center font-sans font-bold text-slate-700">{data.length} Staff</td>
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200" />
                  <td className="border border-emerald-200" />
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono font-black">{fmt(totalClaimed)}</td>
                  <td className="py-2.5 px-2 text-right border border-emerald-200 font-mono font-black text-rose-800 bg-rose-100/60">{fmt(totalClaimed - totalApprovedSum)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
