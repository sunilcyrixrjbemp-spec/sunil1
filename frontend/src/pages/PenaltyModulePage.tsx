import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  Plus,
  Download,
  Upload,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  RefreshCw,
  X,
  FileText,
  Building2,
  CheckCircle2,
  TrendingDown
} from "lucide-react";
import toast from "react-hot-toast";
import { penaltyService, PenaltyRecord, DailyPenaltyRecord } from "../services/penaltyService";

export default function PenaltyModulePage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "daily">("monthly");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [dailyRecords, setDailyRecords] = useState<DailyPenaltyRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedHospitalType, setSelectedHospitalType] = useState("all");

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Bulk Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<any>(null);

  // Manual Form State
  const [formData, setFormData] = useState({
    complaint_id: "",
    barcode: "",
    hospital_type: "CHC",
    equipment_type: "Non-Critical",
    is_critical: false,
    complaint_raise_date: "",
    attend_date: "",
    close_date: "",
    final_close_date: "",
    condemnation_date: "",
    attended_engineer_name: "",
    close_engineer_id: "",
    daily_penalty_rate: "500",
    asset_value: "500000",
    is_part_missing: false,
    part_missing_days: "0",
    is_standby_provided: false
  });

  const [barcodeVerified, setBarcodeVerified] = useState<boolean | null>(null);
  const [barcodeAssetInfo, setBarcodeAssetInfo] = useState<any>(null);
  const [verifyingBarcode, setVerifyingBarcode] = useState(false);

  useEffect(() => {
    fetchPenaltyList();
  }, [selectedDistrict]);

  const fetchPenaltyList = async () => {
    setLoading(true);
    try {
      const res = await penaltyService.getPenaltyList({
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        search: searchQuery || undefined,
        complaint_id: selectedComplaintId || undefined
      });
      if (res.success) {
        setRecords(res.records || []);
        if (res.dailyRecords) {
          setDailyRecords(res.dailyRecords);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load penalty records.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBarcodeLive = async (code: string) => {
    if (!code || code.trim().length < 4) {
      setBarcodeVerified(null);
      setBarcodeAssetInfo(null);
      return;
    }
    setVerifyingBarcode(true);
    try {
      const res = await penaltyService.verifyBarcode(code.trim());
      if (res.success && res.valid) {
        setBarcodeVerified(true);
        setBarcodeAssetInfo(res.asset);
        toast.success(`✓ Barcode Verified: ${res.asset.equipment_name} (${res.asset.hospital_name})`);
      } else {
        setBarcodeVerified(false);
        setBarcodeAssetInfo(null);
        toast.error(res.error || `❌ Error: Barcode #${code} not found in database Asset Inventory!`);
      }
    } catch (e) {
      setBarcodeVerified(false);
      setBarcodeAssetInfo(null);
    } finally {
      setVerifyingBarcode(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.complaint_id || !formData.barcode) {
      toast.error("Complaint ID and Barcode are required!");
      return;
    }

    if (barcodeVerified === false) {
      toast.error(`❌ Error: Barcode #${formData.barcode} not found in Asset Inventory! Entry Rejected.`);
      return;
    }

    setLoading(true);
    try {
      const res = await penaltyService.savePenaltyEntries([formData]);
      if (res.success) {
        toast.success(res.message || "Penalty record saved successfully!");
        setShowManualModal(false);
        setFormData({
          complaint_id: "",
          barcode: "",
          hospital_type: "CHC",
          equipment_type: "Non-Critical",
          is_critical: false,
          complaint_raise_date: "",
          attend_date: "",
          close_date: "",
          final_close_date: "",
          condemnation_date: "",
          attended_engineer_name: "",
          close_engineer_id: "",
          daily_penalty_rate: "500",
          asset_value: "500000",
          is_part_missing: false,
          part_missing_days: "0",
          is_standby_provided: false
        });
        setBarcodeVerified(null);
        fetchPenaltyList();
      } else {
        toast.error((res.errors && res.errors[0]?.error) || "Validation failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save penalty entry.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSVTemplate = () => {
    const templateHeaders = [
      "Complaint ID", "Barcode", "Hospital Type", "Complaint Raise Date",
      "Attend Date", "Close Date", "Final Close Date",
      "Is Standby Provided", "Is Part Missing"
    ];

    const sampleRow1 = [
      "13126072-800091", "75043156", "CHC", "21-Jan-2025 16:30:47",
      "23-Jan-2025 18:30:47", "15-May-2025 16:30:47", "15-May-2025 16:30:47",
      "Yes", "No"
    ];

    const sampleRow2 = [
      "SCRJ1234", "800489061567", "Medical College", "20-Jun-2025 10:07:15",
      "20-Jun-2025 10:30:00", "20-Jun-2025 16:22:49", "20-Jun-2025 16:22:49",
      "No", "Yes"
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [
      templateHeaders.join(","),
      sampleRow1.map(x => `"${x}"`).join(","),
      sampleRow2.map(x => `"${x}"`).join(",")
    ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Complaint_Import_CSV_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("📥 CSV Import Template downloaded successfully!");
  };

  const handleCSVImportUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a CSV file to upload.");
      return;
    }

    setUploading(true);
    setUploadReport(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast.error("CSV file contains no data rows.");
          setUploading(false);
          return;
        }

        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
        const entries: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map(c => c.replace(/^"|"$/g, "").trim());
          if (cols.length < 2) continue;

          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || "";
          });

          entries.push({
            complaint_id: rowObj["complaint id"] || rowObj["complaint_id"] || cols[0],
            barcode: rowObj["barcode"] || rowObj["bar code"] || cols[1],
            hospital_type: rowObj["hospital type"] || rowObj["hospital_type"] || cols[2] || "CHC",
            complaint_raise_date: rowObj["complaint raise date"] || rowObj["raise_date"] || cols[3],
            attend_date: rowObj["attend date"] || rowObj["attend_date"] || cols[4],
            close_date: rowObj["close date"] || rowObj["close_date"] || cols[5],
            final_close_date: rowObj["final close date"] || rowObj["final_close_date"] || cols[6] || rowObj["close date"] || cols[5],
            is_standby_provided: (rowObj["is standby provided"] || rowObj["standby"] || cols[7] || "").toLowerCase() === "yes",
            is_part_missing: (rowObj["is part missing"] || rowObj["part_missing"] || cols[8] || "").toLowerCase() === "yes"
          });
        }

        const res = await penaltyService.savePenaltyEntries(entries);
        setUploadReport(res);
        if (res.success) {
          toast.success(res.message || `✓ ${res.processed} Complaints imported successfully!`);
          fetchPenaltyList();
        } else {
          toast.error(`⚠️ Uploaded ${res.processed} complaints with ${res.errorsCount} error(s).`);
        }
      } catch (err: any) {
        toast.error("Failed to parse CSV file: " + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(uploadFile);
  };

  const handleExportExcel = (type: "23_columns" | "53_columns" = "23_columns") => {
    if (records.length === 0) {
      toast.error("No penalty records available to export.");
      return;
    }

    let headers: string[] = [];
    let rows: any[][] = [];

    if (type === "23_columns") {
      headers = [
        "S.No.", "District Name", "Hospital Type", "Hospital Name", "Bar Code",
        "Equipment Name", "Equipment Model", "Complaint ID", "Complaint Raise Date",
        "Complaint Close Date", "Complaint Status", "Total Downtime (Hours)", "Estimated Cost",
        "Penalty Days", "Complaint Final Close", "Attend Date", "Attend Penalty",
        "Delay Penalty", "Total Penalty (Attend+Delay)", "Is Under Warranty",
        "Service Provider Name", "Attended Service Engg ID", "Closing Service Engg ID"
      ];

      rows = records.map((r, idx) => [
        idx + 1, r.district_name, r.hospital_type || "CHC", r.hospital_name, r.bar_code,
        r.equipment_name, r.equipment_model || "", r.complaint_id, r.complaint_raise_date,
        r.complaint_close_date, r.status || "Final Closed", (r.total_downtime || 0) * 24,
        r.asset_value || 10000, r.chargeable_days || 0, r.final_close_date || r.complaint_close_date,
        r.attend_date, 0, r.total_penalty || 0, r.total_penalty || 0, "No",
        "Cyrix Healthcare", r.attended_engineer_name || "", r.close_engineer_id || ""
      ]);
    } else {
      // 53-Column Full Export matching Rajasthan-July-26.xlsx
      headers = Array.from({ length: 53 }, (_, i) => `Col_${i + 1}`);
      headers[0] = "S.No.";
      headers[1] = "District Name";
      headers[2] = "Hospital Type";
      headers[3] = "Hospital Name";
      headers[4] = "Bar Code";
      headers[5] = "Equipment Name";
      headers[6] = "Equipment Model";
      headers[7] = "Complaint ID";
      headers[8] = "Complaint Raise Date";
      headers[9] = "Complaint Close date";
      headers[10] = "Complaint Status";
      headers[11] = "Total Downtime";
      headers[12] = "Estimated Cost";
      headers[13] = "Penalty Days";
      headers[14] = "Complaint Final Close";
      headers[15] = "Attend Date";
      headers[16] = "Attend Penalty";
      headers[17] = "Delay Penalty";
      headers[18] = "Total Penalty (Attend+Delay)";
      headers[19] = "Is Under Warranty";
      headers[20] = "Service Provider Name";
      headers[21] = "Attended Service Engg ID";
      headers[22] = "Closing Service Engg ID";
      headers[23] = "Status";
      headers[24] = "Hospital Type";
      headers[25] = "Equipment Type";
      headers[26] = "Asset Value";
      headers[36] = "Penalty Slab";
      headers[39] = "Total Penalty";
      headers[43] = "Standby By Status";

      rows = records.map((r, idx) => {
        const rowArr = Array(53).fill("");
        rowArr[0] = idx + 1;
        rowArr[1] = r.district_name;
        rowArr[2] = r.hospital_type || "CHC";
        rowArr[3] = r.hospital_name;
        rowArr[4] = r.bar_code;
        rowArr[5] = r.equipment_name;
        rowArr[6] = r.equipment_model || "";
        rowArr[7] = r.complaint_id;
        rowArr[8] = r.complaint_raise_date;
        rowArr[9] = r.complaint_close_date;
        rowArr[10] = r.status || "Final Closed";
        rowArr[11] = (r.total_downtime || 0) * 24;
        rowArr[12] = r.asset_value || 10000;
        rowArr[13] = r.chargeable_days || 0;
        rowArr[14] = r.final_close_date || r.complaint_close_date;
        rowArr[15] = r.attend_date;
        rowArr[16] = 0;
        rowArr[17] = r.total_penalty || 0;
        rowArr[18] = r.total_penalty || 0;
        rowArr[19] = "No";
        rowArr[20] = "Cyrix Healthcare";
        rowArr[21] = r.attended_engineer_name || "";
        rowArr[22] = r.close_engineer_id || "";
        rowArr[23] = "Closed";
        rowArr[24] = r.hospital_type || "CHC";
        rowArr[25] = r.equipment_type || "Non-Critical";
        rowArr[26] = r.asset_value || 10000;
        rowArr[36] = r.penalty_slab_amount || 500;
        rowArr[39] = r.total_penalty || 0;
        rowArr[43] = r.standby_status || "Not Provided";
        return rowArr;
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rajasthan_Penalty_File_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`📥 Penalty File (${type === "23_columns" ? "23-Column Core" : "53-Column Full"}) exported!`);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q ||
        r.complaint_id.toLowerCase().includes(q) ||
        r.bar_code.toLowerCase().includes(q) ||
        r.hospital_name.toLowerCase().includes(q) ||
        r.equipment_name.toLowerCase().includes(q);

      const matchesHosp = selectedHospitalType === "all" || (r.hospital_type || "").toLowerCase().includes(selectedHospitalType.toLowerCase());

      return matchesQuery && matchesHosp;
    });
  }, [records, searchQuery, selectedHospitalType]);

  // Derived KPI Analytics
  const totalAssessed = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.total_penalty || 0), 0);
  }, [filteredRecords]);

  const medicalCollegeCount = useMemo(() => {
    return filteredRecords.filter(r => (r.hospital_type || "").toLowerCase().includes("medical")).length;
  }, [filteredRecords]);

  const standbyExemptedCount = useMemo(() => {
    return filteredRecords.filter(r => (r.standby_status || "").toLowerCase().includes("provided") || (r.exemption_reason || "").toLowerCase().includes("standby")).length;
  }, [filteredRecords]);

  const partMissingCount = useMemo(() => {
    return filteredRecords.filter(r => (r.exemption_reason || "").toLowerCase().includes("part")).length;
  }, [filteredRecords]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800 font-sans p-4 sm:p-6 bg-slate-50/80 min-h-screen">
      
      {/* Premium Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  Penalty Audit & SLA Engine
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                  BEMMP Rajasthan Contract
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Strict Barcode Verification</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-blue-500" /> Medical College (12h) vs DH/CHC (24h) SLAs</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Standby 90-Day Grace & Part Miss ₹0</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            onClick={handleDownloadCSVTemplate}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs transition-all border border-slate-200 shadow-2xs"
            title="Download Standard 9-Column CSV Template"
          >
            <FileText className="w-4 h-4 text-blue-600" /> CSV Template
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs"
          >
            <Upload className="w-4 h-4" /> Import CSV File
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Complaint Entry
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={() => handleExportExcel("23_columns")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs"
          >
            <Download className="w-4 h-4" /> Export 23-Col Core
          </button>

          <button
            onClick={() => handleExportExcel("53_columns")}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-extrabold text-xs transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export 53-Col Full
          </button>
        </div>
      </div>

      {/* 4 PROPER HIGH-IMPACT DATA CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Net Audited Penalty */}
        <div className="bg-gradient-to-br from-white to-rose-50/30 rounded-3xl p-5 border border-rose-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-600/80">Net Audited Penalty</span>
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              ₹{totalAssessed.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-rose-700">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Calculated under CA SLA Slabs & Caps</span>
            </div>
          </div>
        </div>

        {/* Card 2: Complaints Audited */}
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-3xl p-5 border border-blue-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600/80">Complaints Audited</span>
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              {filteredRecords.length} <span className="text-sm font-bold text-slate-500">Records</span>
            </span>
            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-slate-600">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold">{medicalCollegeCount} Medical Coll.</span>
              <span>• {filteredRecords.length - medicalCollegeCount} DH/CHC</span>
            </div>
          </div>
        </div>

        {/* Card 3: Barcode Verification Status */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl p-5 border border-emerald-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600/80">Barcode Validation</span>
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-emerald-600 tracking-tight">100%</span>
              <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Verified
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 mt-2">
              All entries validated against Master Inventory
            </p>
          </div>
        </div>

        {/* Card 4: SLA Exemptions Breakdown */}
        <div className="bg-gradient-to-br from-white to-amber-50/30 rounded-3xl p-5 border border-amber-100 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600/80">Exemptions Applied</span>
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {standbyExemptedCount + partMissingCount} <span className="text-sm font-bold text-slate-500">Exempt Calls</span>
            </span>
            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-amber-800">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{standbyExemptedCount} Standby 90D</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{partMissingCount} Part Miss</span>
            </div>
          </div>
        </div>

      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "monthly" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly Penalty Summary (23 Core Columns)
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === "daily" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Per-Day Penalty Breakdown Log
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Districts</option>
            <option value="Ajmer">Ajmer</option>
            <option value="Jaipur">Jaipur</option>
            <option value="Jodhpur">Jodhpur</option>
            <option value="Udaipur font-bold">Udaipur</option>
            <option value="Kota">Kota</option>
            <option value="Bikaner">Bikaner</option>
          </select>

          <select
            value={selectedHospitalType}
            onChange={(e) => setSelectedHospitalType(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Hospital Types</option>
            <option value="Medical College">Medical Colleges (12h SLA)</option>
            <option value="DH">District Hospitals (24h SLA)</option>
            <option value="CHC">CHC / PHC (24h SLA)</option>
          </select>

          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search Complaint ID, Barcode, Hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={fetchPenaltyList}
            className="p-2.5 text-slate-500 hover:text-blue-600 bg-slate-50 border border-slate-200 rounded-xl transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table View */}
      {activeTab === "monthly" ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase font-black tracking-wider">
                  <th className="py-3.5 px-4">Complaint ID</th>
                  <th className="py-3.5 px-4">District</th>
                  <th className="py-3.5 px-4">Hospital Type</th>
                  <th className="py-3.5 px-4">Hospital Name</th>
                  <th className="py-3.5 px-4">Bar Code</th>
                  <th className="py-3.5 px-4">Equipment Name</th>
                  <th className="py-3.5 px-4">Raise Date (IST)</th>
                  <th className="py-3.5 px-4">Attend Date</th>
                  <th className="py-3.5 px-4">Close Date</th>
                  <th className="py-3.5 px-4">Chargeable Days</th>
                  <th className="py-3.5 px-4">Penalty Slab</th>
                  <th className="py-3.5 px-4">Total Penalty</th>
                  <th className="py-3.5 px-4">Exemption</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 font-bold">
                      <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      No penalty records found. Click "+ Add Complaint Entry" or "Import CSV File" to populate data.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{r.complaint_id}</td>
                      <td className="py-3.5 px-4 font-bold">{r.district_name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                          (r.hospital_type || "").toLowerCase().includes("medical")
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {r.hospital_type || "CHC"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{r.hospital_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                          {r.bar_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{r.equipment_name}</td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">{r.complaint_raise_date}</td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">{r.attend_date}</td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">{r.complaint_close_date}</td>
                      <td className="py-3.5 px-4 font-black text-amber-600">{r.chargeable_days || 0} Days</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">₹{r.penalty_slab_amount || 500}</td>
                      <td className="py-3.5 px-4 font-black text-rose-600 text-sm">₹{(r.total_penalty || 0).toLocaleString()}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                          {r.exemption_reason || "None"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Per-Day Penalty Breakdown View */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-600 uppercase">Select Complaint ID:</span>
            <select
              value={selectedComplaintId}
              onChange={(e) => {
                setSelectedComplaintId(e.target.value);
              }}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="">-- All Complaints --</option>
              {records.map(r => (
                <option key={r.complaint_id} value={r.complaint_id}>
                  {r.complaint_id} - Barcode #{r.bar_code} ({r.hospital_name})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase font-black tracking-wider">
                  <th className="py-3.5 px-4">Day #</th>
                  <th className="py-3.5 px-4">Complaint ID</th>
                  <th className="py-3.5 px-4">Barcode</th>
                  <th className="py-3.5 px-4">Call Status</th>
                  <th className="py-3.5 px-4">Exemption Reason</th>
                  <th className="py-3.5 px-4">Daily Charge Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      Select a specific complaint above to view its per-day penalty breakdown.
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((d, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">Day {d.day_number}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{d.complaint_id}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{d.barcode}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {d.call_status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {d.is_exempted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ {d.exemption_reason}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            Chargeable Day
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        ₹{d.daily_penalty_amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                Import Complaints CSV File
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center hover:bg-slate-50 transition-colors">
                <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-black text-slate-800 mb-1">
                  Upload filled CSV file matching standard format
                </p>
                <p className="text-[11px] text-slate-400 mb-4">
                  (Complaint ID, Barcode, Hospital Type, Raise Date, Attend Date, Close Date, Final Close Date, Standby, Part Miss)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-2xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {uploadReport && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs font-semibold">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Processed: {uploadReport.processed} Records</span>
                    <span className={uploadReport.errorsCount > 0 ? "text-rose-600" : "text-emerald-600"}>
                      Errors: {uploadReport.errorsCount}
                    </span>
                  </div>

                  {uploadReport.errors && uploadReport.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] font-mono text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
                      {uploadReport.errors.map((errItem: any, idx: number) => (
                        <div key={idx}>Row #{errItem.row}: {errItem.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadCSVTemplate}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:underline"
                >
                  <FileText className="w-4 h-4" /> Download Sample CSV Template
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleCSVImportUpload}
                    disabled={uploading || !uploadFile}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-2xl shadow-xs"
                  >
                    {uploading ? "Importing..." : "Process & Import CSV"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Add Complaint & Calculate SLA Penalty
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Barcode (QR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 75043156"
                      value={formData.barcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, barcode: val });
                        handleVerifyBarcodeLive(val);
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    {verifyingBarcode && (
                      <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-blue-600 animate-pulse">
                        Verifying...
                      </span>
                    )}
                  </div>

                  {barcodeVerified === true && (
                    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] font-bold text-emerald-800">
                      ✓ Verified: {barcodeAssetInfo?.equipment_name} ({barcodeAssetInfo?.hospital_name})
                    </div>
                  )}

                  {barcodeVerified === false && (
                    <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[10px] font-bold text-rose-800">
                      ❌ Error: Barcode #{formData.barcode} not found in database Asset Inventory! Entry Rejected.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Complaint ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 13126072-800091"
                    value={formData.complaint_id}
                    onChange={(e) => setFormData({ ...formData, complaint_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Hospital Type (SLA Period)
                  </label>
                  <select
                    value={formData.hospital_type}
                    onChange={(e) => setFormData({ ...formData, hospital_type: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="Medical College">Medical College & Associated Hospital (12h Period, SLA 1h/6h)</option>
                    <option value="DH">DH / SDH / SH (24h Period, SLA 24h/48h)</option>
                    <option value="CHC">CHC / PHC (24h Period, SLA 24h/72h)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Equipment Asset Value (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="500000"
                    value={formData.asset_value}
                    onChange={(e) => setFormData({ ...formData, asset_value: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                    <span>Raise Date (IST)</span>
                    <span className="text-blue-600 font-bold">DD-MMM-YYYY HH:mm:ss</span>
                  </label>
                  <input
                    type="text"
                    placeholder="21-Jan-2025 16:30:47"
                    value={formData.complaint_raise_date}
                    onChange={(e) => setFormData({ ...formData, complaint_raise_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                    <span>Attend Date (IST)</span>
                    <span className="text-blue-600 font-bold">DD-MMM-YYYY HH:mm:ss</span>
                  </label>
                  <input
                    type="text"
                    placeholder="23-Jan-2025 18:30:47"
                    value={formData.attend_date}
                    onChange={(e) => setFormData({ ...formData, attend_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                    <span>Close Date (IST)</span>
                    <span className="text-blue-600 font-bold">DD-MMM-YYYY HH:mm:ss</span>
                  </label>
                  <input
                    type="text"
                    placeholder="15-May-2025 16:30:47"
                    value={formData.close_date}
                    onChange={(e) => setFormData({ ...formData, close_date: e.target.value, final_close_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Condemnation Date (Optional - Penalty Stops)
                  </label>
                  <input
                    type="text"
                    placeholder="10-May-2025 12:00:00"
                    value={formData.condemnation_date}
                    onChange={(e) => setFormData({ ...formData, condemnation_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Exemption & Critical Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Contract SLA Exemption Rules & Criticality
                </span>
                
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_part_missing}
                    onChange={(e) => setFormData({ ...formData, is_part_missing: e.target.checked })}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  <span>Part Missing / Spare Pending (₹0 Penalty for part missing days)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_standby_provided}
                    onChange={(e) => setFormData({ ...formData, is_standby_provided: e.target.checked })}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  <span>Standby Machine Provided (First 90 Days EXEMPTED - ₹0 Penalty)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_critical}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData({ ...formData, is_critical: checked, equipment_type: checked ? "Critical" : "Non-Critical" });
                    }}
                    className="rounded text-rose-600 w-4 h-4"
                  />
                  <span className="text-rose-700 font-extrabold">Critical Equipment (110% Surcharge applies if SLA missed)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || barcodeVerified === false}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-2xl shadow-xs"
                >
                  {loading ? "Calculating..." : "Calculate & Save Audit Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
