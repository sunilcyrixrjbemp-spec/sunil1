import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  Plus,
  Download,
  Upload,
  Clock,
  FileSpreadsheet,
  X,
  FileText,
  TrendingDown,
  BarChart3,
  PieChart,
  Repeat,
  Layers,
  UserCheck,
  Zap,
  Lock,
  Loader2,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2 as ApprovedIcon,
  XCircle,
  Building2
} from "lucide-react";
import toast from "react-hot-toast";
import { penaltyService, PenaltyRecord, DailyPenaltyRecord } from "../services/penaltyService";
import {
  SaaSBarChart,
  SaaSHorizontalBarChart,
  SaaSDonutChart,
  SaaS3DHybridTrendChart
} from "../components/common/SaaSCharts";

export default function PenaltyModulePage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "dashboard" | "daily" | "repeated">("monthly");
  const [subTab, setSubTab] = useState<"all" | "medical" | "dh" | "chc">("all");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [dailyRecords, setDailyRecords] = useState<DailyPenaltyRecord[]>([]);

  // Multi-Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedDI, setSelectedDI] = useState("all");
  const [selectedHospital, setSelectedHospital] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Bulk Upload State with High-Speed Progress Engine
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    totalRows: 0,
    processedRows: 0,
    savedRows: 0,
    skippedClosedRows: 0,
    errorsCount: 0,
    percentage: 0,
    startTime: 0,
    elapsedSeconds: 0,
    currentChunk: 0,
    totalChunks: 0
  });
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

    const startTime = Date.now();

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
        const allEntries: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map(c => c.replace(/^"|"$/g, "").trim());
          if (cols.length < 2) continue;

          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || "";
          });

          allEntries.push({
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

        const CHUNK_SIZE = 2000;
        const totalRows = allEntries.length;
        const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

        let processedRows = 0;
        let savedRows = 0;
        let skippedClosedRows = 0;
        let totalErrors = 0;
        const combinedErrors: any[] = [];

        setUploadProgress({
          totalRows,
          processedRows: 0,
          savedRows: 0,
          skippedClosedRows: 0,
          errorsCount: 0,
          percentage: 0,
          startTime,
          elapsedSeconds: 0,
          currentChunk: 0,
          totalChunks
        });

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const chunkEntries = allEntries.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
          
          try {
            const res = await penaltyService.savePenaltyEntries(chunkEntries);
            processedRows += chunkEntries.length;
            savedRows += (res.saved || 0);
            skippedClosedRows += (res.skippedFinalClosed || 0);
            totalErrors += (res.errorsCount || 0);

            if (res.errors && res.errors.length > 0) {
              combinedErrors.push(...res.errors.map((e: any) => ({
                row: (chunkIdx * CHUNK_SIZE) + e.row,
                error: e.error
              })));
            }
          } catch (e: any) {
            totalErrors += chunkEntries.length;
            combinedErrors.push({ row: (chunkIdx * CHUNK_SIZE) + 1, error: e.message || "Chunk request failed" });
          }

          const elapsedSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
          const pct = Math.round((processedRows / totalRows) * 100);

          setUploadProgress({
            totalRows,
            processedRows,
            savedRows,
            skippedClosedRows,
            errorsCount: totalErrors,
            percentage: pct,
            startTime,
            elapsedSeconds: elapsedSec,
            currentChunk: chunkIdx + 1,
            totalChunks
          });
        }

        const totalElapsedSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
        const finalReport = {
          success: true,
          totalRows,
          savedRows,
          skippedClosedRows,
          errorsCount: totalErrors,
          errors: combinedErrors,
          elapsedSeconds: totalElapsedSec
        };

        setUploadReport(finalReport);
        toast.success(`⚡ High-Speed Upload Completed in ${totalElapsedSec}s! ${savedRows.toLocaleString()} Saved, ${skippedClosedRows.toLocaleString()} Final Closed Skipped.`);
        fetchPenaltyList();
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
        idx + 1, r.district_name || "", r.hospital_type || "", r.hospital_name || "", r.bar_code,
        r.equipment_name || "", r.equipment_model || "", r.complaint_id, r.complaint_raise_date,
        r.complaint_close_date, r.status || "Final Closed", (r.total_downtime || 0) * 24,
        r.asset_value || 0, r.chargeable_days || 0, r.final_close_date || r.complaint_close_date,
        r.attend_date, 0, r.total_penalty || 0, r.total_penalty || 0, "No",
        "Cyrix Healthcare", r.attended_engineer_name || "", r.close_engineer_id || ""
      ]);
    } else {
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
        rowArr[1] = r.district_name || "";
        rowArr[2] = r.hospital_type || "";
        rowArr[3] = r.hospital_name || "";
        rowArr[4] = r.bar_code;
        rowArr[5] = r.equipment_name || "";
        rowArr[6] = r.equipment_model || "";
        rowArr[7] = r.complaint_id;
        rowArr[8] = r.complaint_raise_date;
        rowArr[9] = r.complaint_close_date;
        rowArr[10] = r.status || "Final Closed";
        rowArr[11] = (r.total_downtime || 0) * 24;
        rowArr[12] = r.asset_value || 0;
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
        rowArr[24] = r.hospital_type || "";
        rowArr[25] = r.equipment_type || "Non-Critical";
        rowArr[26] = r.asset_value || 0;
        rowArr[36] = r.penalty_slab_amount || 0;
        rowArr[39] = r.total_penalty || 0;
        rowArr[43] = r.standby_status || "";
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

  // Filter Options
  const filterOptions = useMemo(() => {
    const districts = Array.from(new Set(records.map(r => r.district_name).filter(Boolean))).sort();
    const hospitals = Array.from(new Set(records.map(r => r.hospital_name).filter(Boolean))).sort();
    const equipmentList = Array.from(new Set(records.map(r => r.equipment_name).filter(Boolean))).sort();
    const dis = Array.from(new Set(records.map(r => r.attended_engineer_name || r.di_name).filter(Boolean))).sort();
    return { districts, hospitals, equipmentList, dis };
  }, [records]);

  // Multi-Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q ||
        r.complaint_id.toLowerCase().includes(q) ||
        r.bar_code.toLowerCase().includes(q) ||
        (r.hospital_name || "").toLowerCase().includes(q) ||
        (r.equipment_name || "").toLowerCase().includes(q);

      const matchesMonth = selectedMonth === "all" || (r.complaint_raise_date || "").toLowerCase().includes(selectedMonth.toLowerCase());
      const matchesZone = selectedZone === "all" || (r.zone_name || r.district_name || "").toLowerCase().includes(selectedZone.toLowerCase());
      const matchesDistrict = selectedDistrict === "all" || r.district_name === selectedDistrict;
      const matchesDI = selectedDI === "all" || (r.attended_engineer_name === selectedDI || r.di_name === selectedDI);
      const matchesHospital = selectedHospital === "all" || r.hospital_name === selectedHospital;
      const matchesEquipment = selectedEquipment === "all" || r.equipment_name === selectedEquipment;
      const matchesStatus = selectedStatus === "all" || (r.status || "").toLowerCase().includes(selectedStatus.toLowerCase());

      const matchesSubTab = subTab === "all" ||
        (subTab === "medical" && (r.hospital_type || "").toLowerCase().includes("medical")) ||
        (subTab === "dh" && (r.hospital_type || "").toLowerCase().includes("dh")) ||
        (subTab === "chc" && ((r.hospital_type || "").toLowerCase().includes("chc") || (r.hospital_type || "").toLowerCase().includes("phc")));

      return matchesQuery && matchesMonth && matchesZone && matchesDistrict && matchesDI && matchesHospital && matchesEquipment && matchesStatus && matchesSubTab;
    });
  }, [records, searchQuery, selectedMonth, selectedZone, selectedDistrict, selectedDI, selectedHospital, selectedEquipment, selectedStatus, subTab]);

  // KPI Computations
  const totalAuditedPenalty = useMemo(() => filteredRecords.reduce((sum, r) => sum + (r.total_penalty || 0), 0), [filteredRecords]);
  const totalDowntimeDays = useMemo(() => filteredRecords.reduce((sum, r) => sum + (r.total_downtime || 0), 0), [filteredRecords]);
  const standbyExemptedCount = useMemo(() => filteredRecords.filter(r => (r.standby_status || "").toLowerCase().includes("provided")).length, [filteredRecords]);
  const partMissingCount = useMemo(() => filteredRecords.filter(r => (r.exemption_reason || "").toLowerCase().includes("part")).length, [filteredRecords]);
  const criticalCount = useMemo(() => filteredRecords.filter(r => (r.equipment_type || "").toLowerCase().includes("critical")).length, [filteredRecords]);
  const criticalPenalty = useMemo(() => filteredRecords.filter(r => (r.equipment_type || "").toLowerCase().includes("critical")).reduce((sum, r) => sum + (r.total_penalty || 0), 0), [filteredRecords]);

  // Analytics Chart Data Computations
  const districtChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const d = r.district_name || "Unassigned District";
      map[d] = (map[d] || 0) + (r.total_penalty || 0);
    });
    return Object.keys(map).map(k => ({ name: k, amount: map[k] }));
  }, [filteredRecords]);

  const zoneChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const z = r.zone_name || (r.district_name ? `${r.district_name} Zone` : "Unassigned Zone");
      map[z] = (map[z] || 0) + (r.total_penalty || 0);
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredRecords]);

  const equipmentChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const eq = r.equipment_name || "Unspecified Equipment";
      map[eq] = (map[eq] || 0) + (r.total_penalty || 0);
    });
    return Object.keys(map).slice(0, 10).map(k => ({ name: k, amount: map[k] }));
  }, [filteredRecords]);

  const hospitalChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const h = r.hospital_name || "Unspecified Hospital";
      map[h] = (map[h] || 0) + (r.total_penalty || 0);
    });
    return Object.keys(map).slice(0, 10).map(k => ({ name: k, amount: map[k] }));
  }, [filteredRecords]);

  const diChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const di = r.attended_engineer_name || r.di_name || "Unassigned DI";
      map[di] = (map[di] || 0) + (r.total_penalty || 0);
    });
    return Object.keys(map).map(k => ({ name: k, amount: map[k] }));
  }, [filteredRecords]);

  const dayTrendData = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    filteredRecords.forEach(r => {
      const dayStr = (r.complaint_raise_date || "").slice(0, 11) || "Date";
      if (!map[dayStr]) map[dayStr] = { amount: 0, count: 0 };
      map[dayStr].amount += r.total_penalty || 0;
      map[dayStr].count += 1;
    });
    return Object.keys(map).map(k => ({ x: k, y: map[k].amount, count: map[k].count }));
  }, [filteredRecords]);

  // Repeated Calls Frequency Data
  const repeatedBarcodeData = useMemo(() => {
    const map: Record<string, { barcode: string; equipment: string; hospital: string; district: string; count: number; totalPenalty: number; complaints: string[] }> = {};
    filteredRecords.forEach(r => {
      const bc = r.bar_code || "N/A";
      if (!map[bc]) {
        map[bc] = {
          barcode: bc,
          equipment: r.equipment_name || "-",
          hospital: r.hospital_name || "-",
          district: r.district_name || "-",
          count: 0,
          totalPenalty: 0,
          complaints: []
        };
      }
      map[bc].count += 1;
      map[bc].totalPenalty += r.total_penalty || 0;
      map[bc].complaints.push(r.complaint_id);
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  return (
    <div className="space-y-4 animate-fadeIn text-slate-800 font-sans p-3 sm:p-4 bg-slate-100 min-h-screen">
      
      {/* 1. TOP GREETING BANNER (Matching Overview / Expense Page Aesthetic) */}
      <div className="bg-[#486581] text-white px-4 py-2.5 rounded-none shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-extrabold flex items-center justify-center text-xs">
            S
          </div>
          <span className="text-xs font-extrabold tracking-wide">
            Good Evening, System Administrator 👋 <span className="opacity-75 font-normal">(Admin)</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSVTemplate}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-none font-bold text-[11px] border border-white/20 transition-all"
          >
            <FileText className="w-3.5 h-3.5" /> CSV Template
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-none font-bold text-[11px] shadow-2xs transition-all"
          >
            <Upload className="w-3.5 h-3.5" /> High-Speed Import
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-bold text-[11px] shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </button>
          <button
            onClick={() => handleExportExcel("23_columns")}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-none font-bold text-[11px] transition-all"
          >
            <Download className="w-3.5 h-3.5" /> 23-Col Export
          </button>
          <button
            onClick={() => handleExportExcel("53_columns")}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-bold text-[11px] transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> 53-Col Export
          </button>
        </div>
      </div>

      {/* 2. SUMMARY STRIP HEADER (Matching Overview / Expense Page Header) */}
      <div className="bg-[#345168] text-white px-4 py-2 rounded-none flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider">
          CONTRACT PENALTY AUDIT SUMMARY
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">MONTH:</span>
          <div className="bg-white text-slate-800 px-2.5 py-0.5 rounded-none text-xs font-bold flex items-center gap-1">
            <span>August, 2026</span>
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* 3. 6 SIDE-BY-SIDE COMPACT DATA CARDS (Exact Replica of Overview Expense Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Card 1: Total Audited Penalty */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">TOTAL AUDITED PENALTY</span>
            <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-none bg-slate-100 text-slate-600 border border-slate-200">
              {filteredRecords.length} Calls
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-blue-600 text-white rounded-none shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-slate-900 font-mono tracking-tight truncate">
              ₹{totalAuditedPenalty.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Card 2: Total Downtime */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">TOTAL DOWNTIME</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-none shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-slate-900 font-mono tracking-tight truncate">
              {totalDowntimeDays} DAYS
            </span>
          </div>
        </div>

        {/* Card 3: Standby Exempted */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">STANDBY EXEMPTED</span>
            <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-none bg-purple-100 text-purple-700 border border-purple-200">
              {standbyExemptedCount} Calls
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-purple-600 text-white rounded-none shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-purple-700 font-mono tracking-tight truncate">
              ₹0 PENALTY
            </span>
          </div>
        </div>

        {/* Card 4: Part Missing Free */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">PART MISSING FREE</span>
            <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-none bg-emerald-100 text-emerald-700 border border-emerald-200">
              {partMissingCount} Claims
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-emerald-600 text-white rounded-none shrink-0">
              <ApprovedIcon className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-emerald-600 font-mono tracking-tight truncate">
              ₹0 PENALTY
            </span>
          </div>
        </div>

        {/* Card 5: Critical Surcharges */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">CRITICAL SURCHARGED</span>
            <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-none bg-amber-100 text-amber-800 border border-amber-200">
              {criticalCount} Calls
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-amber-600 text-white rounded-none shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-amber-700 font-mono tracking-tight truncate">
              ₹{criticalPenalty.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Card 6: Net Audited SLA Cap */}
        <div className="bg-white rounded-none p-3 border border-slate-200 shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">NET PAYABLE PENALTY</span>
            <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-none bg-rose-100 text-rose-700 border border-rose-200">
              Capped
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="p-1.5 bg-rose-600 text-white rounded-none shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-rose-600 font-mono tracking-tight truncate">
              ₹{totalAuditedPenalty.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* 4. SUB-TAB PILL BUTTONS (Matching Overview Claims Switcher) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSubTab("all")}
          className={`px-4 py-1.5 text-xs font-black transition-all ${
            subTab === "all" ? "bg-[#345168] text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
          }`}
        >
          All Complaints ({records.length})
        </button>

        <button
          onClick={() => setSubTab("medical")}
          className={`px-4 py-1.5 text-xs font-bold transition-all ${
            subTab === "medical" ? "bg-[#345168] text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
          }`}
        >
          Medical Colleges (12h SLA)
        </button>

        <button
          onClick={() => setSubTab("dh")}
          className={`px-4 py-1.5 text-xs font-bold transition-all ${
            subTab === "dh" ? "bg-[#345168] text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
          }`}
        >
          DH / SDH (24h SLA)
        </button>

        <button
          onClick={() => setSubTab("chc")}
          className={`px-4 py-1.5 text-xs font-bold transition-all ${
            subTab === "chc" ? "bg-[#345168] text-white shadow-2xs" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
          }`}
        >
          CHC / PHC (24h SLA)
        </button>
      </div>

      {/* 5. DARK SLATE BLUE FILTER BAR (Exact Replica of Overview Filter Container) */}
      <div className="bg-[#345168] p-3 rounded-none text-white space-y-2 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {/* Month */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">MONTH</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="Aug 2026">Aug 2026</option>
              <option value="Jul 2026">Jul 2026</option>
              <option value="Jun 2026">Jun 2026</option>
              <option value="all">All Months</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">FROM DATE</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">TO DATE</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            />
          </div>

          {/* Search Complaint ID */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">SEARCH COMPLAINT ID</label>
            <input
              type="text"
              placeholder="Search RJ-08 / Claim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            />
          </div>

          {/* Zone */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">ZONE</label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Zones</option>
              <option value="Ajmer">Ajmer Zone</option>
              <option value="Jaipur">Jaipur Zone</option>
              <option value="Jodhpur">Jodhpur Zone</option>
              <option value="Udaipur">Udaipur Zone</option>
              <option value="Kota">Kota Zone</option>
              <option value="Bikaner">Bikaner Zone</option>
            </select>
          </div>

          {/* District */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">DISTRICT</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Districts</option>
              {filterOptions.districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Engineer / DI */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">ENGINEER / DI</label>
            <select
              value={selectedDI}
              onChange={(e) => setSelectedDI(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Engineers</option>
              {filterOptions.dis.map(di => (
                <option key={di} value={di}>{di}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">STATUS</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Assessed">Assessed</option>
              <option value="Final Closed">Final Closed</option>
            </select>
          </div>

          {/* Hospital */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">HOSPITAL</label>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Hospitals</option>
              {filterOptions.hospitals.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-300 mb-0.5">EQUIPMENT</label>
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full px-2 py-1 bg-white text-slate-800 text-xs font-bold rounded-none focus:outline-none"
            >
              <option value="all">All Equipment</option>
              {filterOptions.equipmentList.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 6. MAIN CONTENT TABLE & CHARTS SWITCHER */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
        {/* Table View Tab Header */}
        <div className="bg-slate-200 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "monthly" ? "bg-[#345168] text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Monthly Penalty Audit Table
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "dashboard" ? "bg-[#345168] text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Analytics & Charts
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "daily" ? "bg-[#345168] text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Per-Day Breakdown
            </button>
            <button
              onClick={() => setActiveTab("repeated")}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "repeated" ? "bg-[#345168] text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Repeated Calls Audit
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-600">
            Showing <span className="font-extrabold text-slate-900">{filteredRecords.length}</span> Records
          </span>
        </div>

        {/* TAB 1: MONTHLY AUDIT TABLE (Exact Replica of Overview Expense Table) */}
        {activeTab === "monthly" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#345168] text-white text-[10.5px] uppercase font-extrabold tracking-wider">
                  <th className="py-2.5 px-3">ENGINEER / DI</th>
                  <th className="py-2.5 px-3">COMPLAINT ID</th>
                  <th className="py-2.5 px-3">RAISE DATE</th>
                  <th className="py-2.5 px-3">HOSPITAL & DISTRICT</th>
                  <th className="py-2.5 px-3">BARCODE & EQUIPMENT</th>
                  <th className="py-2.5 px-3">DOWNTIME</th>
                  <th className="py-2.5 px-3 text-right">SLAB AMOUNT</th>
                  <th className="py-2.5 px-3">EXEMPTION</th>
                  <th className="py-2.5 px-3 text-right">TOTAL PENALTY</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                      No penalty records found matching selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      {/* Engineer / DI */}
                      <td className="py-2.5 px-3">
                        <span className="font-extrabold text-slate-900 block">{r.attended_engineer_name || r.di_name || "Unassigned DI"}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">{r.coordinator_name || "Cyrix Engineer"}</span>
                      </td>

                      {/* Complaint ID */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-blue-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          {r.complaint_id}
                        </span>
                      </td>

                      {/* Raise Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {r.complaint_raise_date}
                      </td>

                      {/* Hospital & District */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block truncate max-w-[200px]">{r.hospital_name || "-"}</span>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">
                          {r.district_name || "-"} ({r.hospital_type || "CHC"})
                        </span>
                      </td>

                      {/* Barcode & Equipment */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{r.equipment_name || "-"}</span>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-none border border-slate-200 inline-block">
                          {r.bar_code}
                        </span>
                      </td>

                      {/* Downtime */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 font-bold">
                        {r.chargeable_days || 0} Days
                      </td>

                      {/* Slab Amount */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-right">
                        ₹{r.penalty_slab_amount || 0}
                      </td>

                      {/* Exemption */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 text-[9.5px] font-black uppercase rounded-none bg-amber-100 text-amber-800 border border-amber-200">
                          {r.exemption_reason || "None"}
                        </span>
                      </td>

                      {/* Total Penalty */}
                      <td className="py-2.5 px-3 font-mono font-black text-rose-600 text-base text-right">
                        ₹{(r.total_penalty || 0).toLocaleString("en-IN")}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 text-[9.5px] font-black uppercase rounded-none bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {r.status || "Final Closed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: ANALYTICS & CHARTS */}
        {activeTab === "dashboard" && (
          <div className="p-4 space-y-4 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 border border-slate-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> District-Wise Penalty Assessed
                </h3>
                <SaaSBarChart data={districtChartData} height={250} />
              </div>

              <div className="bg-white p-4 border border-slate-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-600" /> Zone-Wise Penalty Distribution
                </h3>
                <SaaSDonutChart data={zoneChartData} height={250} />
              </div>

              <div className="bg-white p-4 border border-slate-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-600" /> Top 10 Equipment-Wise Penalty
                </h3>
                <SaaSHorizontalBarChart data={equipmentChartData} height={260} />
              </div>

              <div className="bg-white p-4 border border-slate-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-600" /> DI-Wise (Engineer) Penalty Summary
                </h3>
                <SaaSBarChart data={diChartData} height={260} />
              </div>

              <div className="bg-white p-4 border border-slate-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-cyan-600" /> Top 10 Hospital-Wise Penalty
                </h3>
                <SaaSHorizontalBarChart data={hospitalChartData} height={260} />
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-300">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-600" /> Day-Wise Penalty Trajectory
              </h3>
              <SaaS3DHybridTrendChart data={dayTrendData} height={280} />
            </div>
          </div>
        )}

        {/* TAB 3: PER-DAY BREAKDOWN */}
        {activeTab === "daily" && (
          <div className="p-4 space-y-3 bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 uppercase">Select Complaint ID:</span>
              <select
                value={selectedComplaintId}
                onChange={(e) => setSelectedComplaintId(e.target.value)}
                className="px-3 py-1 bg-white border border-slate-300 text-xs font-bold text-slate-800"
              >
                <option value="">-- All Complaints --</option>
                {records.map(r => (
                  <option key={r.complaint_id} value={r.complaint_id}>
                    {r.complaint_id} - Barcode #{r.bar_code} ({r.hospital_name || "Hospital"})
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto border border-slate-300 bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#345168] text-white text-[10.5px] uppercase font-extrabold tracking-wider">
                    <th className="py-2.5 px-3">Day #</th>
                    <th className="py-2.5 px-3">Complaint ID</th>
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3">Call Status</th>
                    <th className="py-2.5 px-3">Exemption Reason</th>
                    <th className="py-2.5 px-3 text-right">Daily Charge Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
                  {dailyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-bold">
                        Select a specific complaint above to view its per-day penalty breakdown.
                      </td>
                    </tr>
                  ) : (
                    dailyRecords.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">Day {d.day_number}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{d.complaint_id}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{d.barcode}</td>
                        <td className="py-2.5 px-3">{d.call_status}</td>
                        <td className="py-2.5 px-3">
                          {d.is_exempted ? (
                            <span className="px-2 py-0.5 text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ {d.exemption_reason}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Chargeable Day
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 text-right">₹{d.daily_penalty_amount.toLocaleString("en-IN")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: REPEATED CALLS AUDIT */}
        {activeTab === "repeated" && (
          <div className="p-4 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Repeat className="w-4 h-4 text-rose-600" />
                Repeated Barcode Call Log Frequency (Asset Degradation Audit)
              </h3>
            </div>

            <div className="overflow-x-auto border border-slate-300 bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#345168] text-white text-[10.5px] uppercase font-extrabold tracking-wider">
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3">Equipment Name</th>
                    <th className="py-2.5 px-3">Hospital Name</th>
                    <th className="py-2.5 px-3">District</th>
                    <th className="py-2.5 px-3">Total Calls Logged</th>
                    <th className="py-2.5 px-3">Associated Complaint IDs</th>
                    <th className="py-2.5 px-3 text-right">Total Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
                  {repeatedBarcodeData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                        No repeat calls found in the current selection.
                      </td>
                    </tr>
                  ) : (
                    repeatedBarcodeData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {item.barcode}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.equipment}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.hospital}</td>
                        <td className="py-2.5 px-3">{item.district}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 text-[9.5px] font-black ${
                            item.count > 1 ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-slate-100 text-slate-700"
                          }`}>
                            {item.count} Calls Logged
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-blue-600 truncate max-w-xs">
                          {item.complaints.join(", ")}
                        </td>
                        <td className="py-2.5 px-3 font-black text-rose-600 text-right">
                          ₹{item.totalPenalty.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* HIGH-SPEED CSV IMPORT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-none shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden">
            <div className="bg-[#345168] p-4 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Ultra-Fast Complaint CSV Import Engine
              </h3>
              {!uploading && (
                <button onClick={() => setShowUploadModal(false)} className="text-slate-300 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {!uploading && !uploadReport && (
                <div className="border-2 border-dashed border-slate-300 rounded-none p-6 text-center hover:bg-slate-50 transition-colors">
                  <Upload className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-800 mb-1">
                    Upload filled CSV file matching standard format
                  </p>
                  <p className="text-[11px] text-slate-500 mb-3">
                    (Complaint ID, Barcode, Hospital Type, Raise Date, Attend Date, Close Date, Final Close Date, Standby, Part Miss)
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              )}

              {/* LIVE ANIMATED UPLOAD PROGRESS BAR */}
              {uploading && (
                <div className="p-4 bg-slate-50 border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-xs font-black text-slate-900 uppercase">
                        Importing Batch {uploadProgress.currentChunk} of {uploadProgress.totalChunks}...
                      </span>
                    </div>
                    <span className="text-sm font-mono font-black text-blue-600">
                      {uploadProgress.percentage}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-3 rounded-none overflow-hidden p-0.5">
                    <div
                      className="bg-blue-600 h-full rounded-none transition-all duration-200"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-white p-2 border border-slate-300">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Processed</span>
                      <span className="text-sm font-mono font-black text-slate-800">
                        {uploadProgress.processedRows.toLocaleString()} / {uploadProgress.totalRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white p-2 border border-slate-300">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Final Closed Skipped</span>
                      <span className="text-sm font-mono font-black text-amber-600 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> {uploadProgress.skippedClosedRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white p-2 border border-slate-300">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Speed & Time</span>
                      <span className="text-sm font-mono font-black text-emerald-600">
                        {uploadProgress.elapsedSeconds}s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* UPLOAD REPORT SUMMARY */}
              {uploadReport && !uploading && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <ApprovedIcon className="w-4 h-4 text-emerald-600" />
                      Upload Complete in {uploadReport.elapsedSeconds} seconds!
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2 border border-emerald-200">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Total Saved</span>
                      <span className="text-sm font-mono font-black text-emerald-700">
                        {uploadReport.savedRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white p-2 border border-emerald-200">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Final Closed Skipped</span>
                      <span className="text-sm font-mono font-black text-amber-600">
                        {uploadReport.skippedClosedRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white p-2 border border-emerald-200">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Errors</span>
                      <span className={uploadReport.errorsCount > 0 ? "text-sm font-mono font-black text-rose-600" : "text-sm font-mono font-black text-slate-700"}>
                        {uploadReport.errorsCount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadCSVTemplate}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:underline disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" /> Download Sample CSV Template
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadReport(null);
                    }}
                    disabled={uploading}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-none"
                  >
                    Close
                  </button>
                  {!uploadReport && (
                    <button
                      type="button"
                      onClick={handleCSVImportUpload}
                      disabled={uploading || !uploadFile}
                      className="px-5 py-2 bg-[#345168] hover:bg-[#283e50] disabled:opacity-50 text-white font-black text-xs rounded-none shadow-2xs"
                    >
                      {uploading ? "Processing..." : "Process & Import CSV"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-none shadow-2xl max-w-2xl w-full border border-slate-300 overflow-hidden">
            <div className="bg-[#345168] p-4 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Add Complaint & Calculate SLA Penalty
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    {verifyingBarcode && (
                      <span className="absolute right-3 top-2 text-[10px] font-bold text-blue-600 animate-pulse">
                        Verifying...
                      </span>
                    )}
                  </div>

                  {barcodeVerified === true && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                      ✓ Verified: {barcodeAssetInfo?.equipment_name} ({barcodeAssetInfo?.hospital_name})
                    </div>
                  )}

                  {barcodeVerified === false && (
                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-800">
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Hospital Type (SLA Period)
                  </label>
                  <select
                    value={formData.hospital_type}
                    onChange={(e) => setFormData({ ...formData, hospital_type: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-bold text-slate-800 focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-bold text-slate-800 focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-medium text-slate-800 font-mono focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-medium text-slate-800 font-mono focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-medium text-slate-800 font-mono focus:outline-none"
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
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-none text-xs font-medium text-slate-800 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Exemption & Critical Checkboxes */}
              <div className="bg-slate-50 p-3.5 border border-slate-200 space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Contract SLA Exemption Rules & Criticality
                </span>
                
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_part_missing}
                    onChange={(e) => setFormData({ ...formData, is_part_missing: e.target.checked })}
                    className="rounded-none text-blue-600"
                  />
                  <span>Part Missing / Spare Pending (₹0 Penalty for part missing days)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_standby_provided}
                    onChange={(e) => setFormData({ ...formData, is_standby_provided: e.target.checked })}
                    className="rounded-none text-blue-600"
                  />
                  <span>Standby Machine Provided (First 90 Days EXEMPTED - ₹0 Penalty)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_critical}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData({ ...formData, is_critical: checked, equipment_type: checked ? "Critical" : "Non-Critical" });
                    }}
                    className="rounded-none text-rose-600"
                  />
                  <span className="text-rose-700 font-extrabold">Critical Equipment (110% Surcharge applies if SLA missed)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || barcodeVerified === false}
                  className="px-5 py-2 bg-[#345168] hover:bg-[#283e50] disabled:bg-slate-400 text-white font-extrabold text-xs rounded-none shadow-2xs"
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
