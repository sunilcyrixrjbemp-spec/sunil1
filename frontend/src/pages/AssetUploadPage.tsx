import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle,
  Loader2,
  Package,
  QrCode,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ShieldCheck,
  ShieldOff,
  IndianRupee,
  Calendar,
  Receipt,
  Filter,
  Zap
} from "lucide-react";
import { Doughnut, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, ChartLegend);
import toast from "react-hot-toast";
import api from "../services/api";
import Loader from "../components/common/Loader";

// CSV column header names (in user-provided order) — includes Equipment Type
const CSV_HEADERS = [
  "District Name", "Hospital Name", "Department Name", "Group Name",
  "Equipment Name", "Model Name", "Serial No.", "Equipment Category",
  "QR Code", "Stock Register Page No.", "Recieved Date", "Installation date",
  "Inventory Entry Date", "MOIC Verified Date", "PO Date", "PO Cost",
  "Inventory Status", "Equipment Status", "Supplier", "Warranty Details",
  "Asset Value", "DI Name", "DM Name", "Coordinator Name", "Zone Name",
  "Hospital Type", "Facility Type", "Equipment Type"
];

interface AssetRow {
  [key: string]: string;
}

interface ChartItem {
  name: string;
  value: number;
}

interface AssetStats {
  total_equipment: number;
  verified_equipment: number;
  under_warranty: number;
  out_of_warranty: number;
  total_value: number;
  verified_value: number;
  verified_out_of_warranty_value: number;
  monthly_value: number;
  arrear_billing: number;
  total_billing: number;
  charts: {
    top_types: ChartItem[];
    status_list: ChartItem[];
    warranty_list: ChartItem[];
  };
}

const defaultStats: AssetStats = {
  total_equipment: 0, verified_equipment: 0, under_warranty: 0,
  out_of_warranty: 0, total_value: 0, verified_value: 0,
  verified_out_of_warranty_value: 0, monthly_value: 0,
  arrear_billing: 0, total_billing: 0,
  charts: { top_types: [], status_list: [], warranty_list: [] }
};


const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

const fmt = (n: number) => n >= 10000000 ? `${(n / 10000000).toFixed(2)} Cr` :
  n >= 100000 ? `${(n / 100000).toFixed(2)} L` :
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString("en-IN");

const fmtRs = (n: number) => `₹${fmt(n)}`;

const formatMonthLabel = (m: string) => {
  const [year, month] = m.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

// Robust quote-aware CSV line splitter to prevent column shifting when cells contain commas
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export default function AssetUploadPage() {

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressDetail, setUploadProgressDetail] = useState("");
  const [parsedRows, setParsedRows] = useState<AssetRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [uploadResult, setUploadResult] = useState<{inserted: number; skipped: number; elapsed_ms: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & pagination for existing assets
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<any[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [stats, setStats] = useState<AssetStats>(defaultStats);
  const pageSize = 50;

  // Filters
  const [filterZone, setFilterZone] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterDI, setFilterDI] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  
  // Dependent combinations from backend
  const [combinations, setCombinations] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  // Tab: "upload" | "inventory" | "analytics"
  const [activeTab, setActiveTab] = useState<"upload" | "inventory" | "analytics">("upload");

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filterZone, filterDistrict, filterDI, filterMonth]);

  useEffect(() => {
    if (activeTab === "inventory") {
      fetchAssets();
    }
  }, [activeTab, currentPage, searchQuery, filterZone, filterDistrict, filterDI, filterMonth]);

  const fetchFilters = async () => {
    try {
      const res = await api.get("/reports/assets-filters");
      if (res.data.success) {
        setCombinations(res.data.combinations || []);
        setMonths(res.data.months || []);
      }
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const params: any = {};
      if (filterZone) params.zone = filterZone;
      if (filterDistrict) params.district = filterDistrict;
      if (filterDI) params.di = filterDI;
      if (filterMonth) params.month = filterMonth;
      const res = await api.get("/reports/assets-stats", { params });
      if (res.data.success) {
        setStats(res.data);
      }
    } catch (_) {}
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const params: any = { page: currentPage, page_size: pageSize };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterZone) params.zone = filterZone;
      if (filterDistrict) params.district = filterDistrict;
      if (filterDI) params.di = filterDI;
      if (filterMonth) params.month = filterMonth;
      const res = await api.get("/reports/assets-inventory", { params });
      if (res.data.success) {
        setAssets(res.data.assets);
        setTotalAssets(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssets(false);
    }
  };

  // ====== Dependent filter choices computation ======
  const availableZones = Array.from(new Set(combinations.map(c => c.zone).filter(Boolean))).sort();

  const availableDistricts = Array.from(
    new Set(
      combinations
        .filter(c => !filterZone || c.zone === filterZone)
        .map(c => c.district)
        .filter(Boolean)
    )
  ).sort();

  const availableDIs = Array.from(
    new Set(
      combinations
        .filter(c => !filterZone || c.zone === filterZone)
        .filter(c => !filterDistrict || c.district === filterDistrict)
        .map(c => c.di)
        .filter(Boolean)
    )
  ).sort();

  // ====== CSV Parser (client-side preview only) ======
  const parseCSVPreview = (text: string): AssetRow[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headerLine = parseCSVLine(lines[0], delimiter);

    const API_KEYS = [
      "district_name", "hospital_name", "department_name", "group_name",
      "equipment_name", "model_name", "serial_no", "equipment_category",
      "qr_code", "stock_register_page_no", "received_date", "installation_date",
      "inventory_entry_date", "moic_verified_date", "po_date", "po_cost",
      "inventory_status", "equipment_status", "supplier", "warranty_details",
      "asset_value", "di_name", "dm_name", "coordinator_name", "zone_name",
      "hospital_type", "facility_type", "equipment_type"
    ];

    const colIndexMap: { csvIndex: number; apiKey: string }[] = [];
    headerLine.forEach((header, csvIdx) => {
      const normalizedHeader = header.toLowerCase().replace(/[.\s]+/g, " ").trim();
      const matchIndex = CSV_HEADERS.findIndex(h =>
        h.toLowerCase().replace(/[.\s]+/g, " ").trim() === normalizedHeader
      );
      if (matchIndex !== -1) {
        colIndexMap.push({ csvIndex: csvIdx, apiKey: API_KEYS[matchIndex] });
      }
    });

    const rows: AssetRow[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCSVLine(line, delimiter);
      const row: AssetRow = {};
      colIndexMap.forEach(({ csvIndex, apiKey }) => {
        row[apiKey] = parts[csvIndex] || "";
      });

      const qr = (row.qr_code || "").trim();
      if (!qr || qr === "--") {
        skipped++;
        continue;
      }
      row.qr_code = qr;
      rows.push(row);
    }

    setSkippedCount(skipped);
    return rows;
  };

  // ====== File Handlers ======
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      toast.error("Only CSV files are supported.");
      return;
    }
    setSelectedFile(file);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSVPreview(text);
      setParsedRows(rows);
      if (rows.length > 0) {
        toast.success(`Parsed ${rows.length} valid assets from CSV`);
      } else {
        toast.error("No valid rows found. Check column headers and QR Code values.");
      }
    };
    reader.readAsText(file);
  };

  // ====== CHUNKED JSON Upload (optimized with 5000 row chunks to complete in < 10 seconds) ======
  const handleUpload = async () => {
    if (parsedRows.length === 0) {
      toast.error("No valid rows to upload.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadProgressDetail("Initializing...");
    setUploadResult(null);

    const CHUNK_SIZE = 5000;
    const totalRows = parsedRows.length;
    let uploadedCount = 0;
    let skippedCountServer = 0;
    const startTime = performance.now();

    try {
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        const isFirst = i === 0;

        setUploadProgressDetail(`Uploading rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, totalRows)} of ${totalRows}...`);

        const res = await api.post("/reports/upload-assets-chunk", {
          rows: chunk,
          clear_first: isFirst
        });

        if (res.data.success) {
          uploadedCount += res.data.inserted;
          skippedCountServer += res.data.skipped;
          const pct = Math.round(((i + chunk.length) / totalRows) * 100);
          setUploadProgress(pct);
        } else {
          throw new Error(res.data.message || "Chunk upload failed");
        }
      }

      const elapsed_ms = performance.now() - startTime;
      setUploadResult({
        inserted: uploadedCount,
        skipped: skippedCountServer + skippedCount,
        elapsed_ms: Math.round(elapsed_ms)
      });
      toast.success(`${uploadedCount} assets imported successfully in ${(elapsed_ms / 1000).toFixed(1)}s!`);
      setSelectedFile(null);
      setParsedRows([]);
      setSkippedCount(0);
      fetchStats();
      fetchFilters();
      if (activeTab === "inventory") fetchAssets();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Upload failed during transmission.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadProgressDetail("");
    }
  };

  // ====== Export sample CSV ======
  const downloadSampleCSV = () => {
    const header = CSV_HEADERS.join(",");
    const sampleRow = [
      "Bikaner", "Akkasar Phc Bikaner", "Other-Akkasar PHC",
      "Cardio Vascular Surgery Equipment and Instrument", "Oxygen Concentrator",
      "Model Not Available", "Ma21041060075", "Biomedical",
      "(8004890615671) 40083265", "117", "17-May-2021", "21-May-2021",
      "26-Feb-2022", "15-Jun-2026", "--", "1", "New Inventory", "Functional Installed",
      "Others", "17-May-2021 to 17-May-2022", "36000", "Abhilash A",
      "Vinod Jain", "Sunil Vishnoi", "Bikaner", "PHC", "Others", "Biomedical"
    ].join(",");

    const csvContent = `${header}\n${sampleRow}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asset_inventory_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sample CSV downloaded!");
  };

  const clearFilters = () => {
    setFilterZone("");
    setFilterDistrict("");
    setFilterDI("");
    setFilterMonth("");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalAssets / pageSize);
  const hasFilters = filterZone || filterDistrict || filterDI || filterMonth;

  return (
    <div className="space-y-4 animate-fadeIn text-gray-800 font-sans">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Asset Inventory Manager
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Import equipment assets via CSV and manage inventory with billing analytics.
          </p>
        </div>
        <button
          onClick={downloadSampleCSV}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 rounded text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 cursor-pointer transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Download Sample CSV
        </button>
      </div>

      {/* ===== Filters Row (Dependent Dropdowns) ===== */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters
          </span>
          <select value={filterZone} onChange={e => { setFilterZone(e.target.value); setFilterDistrict(""); setFilterDI(""); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All Zones</option>
            {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setFilterDI(""); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All Districts</option>
            {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterDI} onChange={e => { setFilterDI(e.target.value); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All DI Names</option>
            {availableDIs.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[140px]">
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters}
              className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer bg-transparent border-0">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ===== Stats Dashboard (AdminLTE Theme Grid) ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Equipment", value: stats.total_equipment.toLocaleString(), icon: <Package className="w-5 h-5 text-white" />, bgColor: "bg-[#007bff]" },
          { label: "Verified Equipment", value: stats.verified_equipment.toLocaleString(), icon: <ShieldCheck className="w-5 h-5 text-white" />, bgColor: "bg-[#28a745]" },
          { label: "Under Warranty", value: stats.under_warranty.toLocaleString(), icon: <ShieldCheck className="w-5 h-5 text-white" />, bgColor: "bg-[#17a2b8]" },
          { label: "Out of Warranty", value: stats.out_of_warranty.toLocaleString(), icon: <ShieldOff className="w-5 h-5 text-white" />, bgColor: "bg-[#ffc107]" },
          { label: "Total Equipment Value", value: fmtRs(stats.total_value), icon: <IndianRupee className="w-5 h-5 text-white" />, bgColor: "bg-[#605ca8]" },
        ].map((s, i) => (
          <div key={i} className="info-box-lte animate-fadeIn">
            <div className={`info-box-icon ${s.bgColor}`}>
              {s.icon}
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">{s.label}</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
        {[
          { label: "Verified Value", value: fmtRs(stats.verified_value), icon: <CheckCircle className="w-5 h-5 text-white" />, bgColor: "bg-[#28a745]" },
          { label: "Verified OOW Value", value: fmtRs(stats.verified_out_of_warranty_value), icon: <ShieldOff className="w-5 h-5 text-white" />, bgColor: "bg-[#fd7e14]" },
          { label: "Monthly Billing", value: fmtRs(stats.monthly_value), sub: "(Value × 6.08% ÷ 12)", icon: <Calendar className="w-5 h-5 text-white" />, bgColor: "bg-[#007bff]" },
          { label: "Arrear Billing", value: fmtRs(stats.arrear_billing), sub: "Verified in target month", icon: <Receipt className="w-5 h-5 text-white" />, bgColor: "bg-[#dc3545]" },
          { label: "Total Billing Value", value: fmtRs(stats.total_billing), icon: <IndianRupee className="w-5 h-5 text-white" />, bgColor: "bg-[#6f42c1]" },
        ].map((s, i) => (
          <div key={i} className="info-box-lte animate-fadeIn">
            <div className={`info-box-icon ${s.bgColor}`}>
              {s.icon}
            </div>
            <div className="info-box-content">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">{s.label}</span>
              <span className="text-base font-extrabold text-gray-800 font-mono block mt-0.5">{s.value}</span>
              {"sub" in s && s.sub && <span className="text-[7px] text-gray-450 font-semibold block mt-0.5 leading-none">{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-0 border-b border-gray-200">
        {[
          { key: "upload" as const, label: "Upload Assets", icon: <UploadCloud className="w-3.5 h-3.5" /> },
          { key: "inventory" as const, label: "View Inventory", icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: "analytics" as const, label: "Analytics & Charts", icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key === "inventory") setCurrentPage(1); }}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer bg-transparent ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== Upload Tab ====== */}
      {activeTab === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Upload Form */}
          <div className="lg:col-span-2 bg-white border border-gray-200 border-t-[3px] border-t-indigo-600 rounded shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Import CSV File
            </h3>

            {/* Drag Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                isDragActive ? "border-indigo-500 bg-indigo-50/50"
                  : selectedFile ? "border-green-500 bg-green-50/20"
                  : "border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              {selectedFile ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-green-600" />
                  <p className="text-xs font-bold text-gray-800 break-all">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {parsedRows.length} valid rows
                  </p>
                  {skippedCount > 0 && (
                    <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase">
                      {skippedCount} rows skipped (invalid QR)
                    </span>
                  )}
                  <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase font-black tracking-wider">
                    Ready for import
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-12 h-12 text-gray-400" />
                  <p className="text-xs font-bold text-gray-700">Drag & drop CSV file here</p>
                  <p className="text-[10px] text-gray-455">or click to browse local files</p>
                  <span className="text-[8px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    Safe Upload • Chunks of 5000 rows
                  </span>
                </>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-1.5 p-3 bg-indigo-50/30 border border-indigo-100 rounded-lg animate-pulse">
                <div className="flex items-center justify-between text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  <span>{uploadProgressDetail}</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Upload Successful</p>
                  <p className="text-[10px] mt-0.5">
                    {uploadResult.inserted} assets imported • {uploadResult.skipped} skipped • {uploadResult.elapsed_ms}ms
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading || parsedRows.length === 0}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-extrabold text-xs flex items-center justify-center shadow-sm border-0 transition-colors cursor-pointer uppercase tracking-wider gap-1.5"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Upload {parsedRows.length > 0 ? `(${parsedRows.length} Rows)` : "Assets"}</>
                )}
              </button>
              {selectedFile && !uploading && (
                <button
                  onClick={() => { setSelectedFile(null); setParsedRows([]); setSkippedCount(0); setUploadResult(null); }}
                  className="h-10 px-3 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 bg-white text-xs font-bold cursor-pointer transition-colors"
                ><X className="w-4 h-4" /></button>
              )}
            </div>

            {/* Info Box */}
            <div className="p-3 bg-gray-50 border border-gray-150 rounded text-[10px] text-gray-500 space-y-1">
              <p className="font-bold text-gray-600 uppercase tracking-wider text-[9px]">Import Rules</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Rows with QR Code = "<span className="font-mono font-bold">--</span>" are automatically skipped</li>
                <li>Rows with empty or whitespace-only QR Code are skipped</li>
                <li>Duplicate QR codes are overwritten (latest wins)</li>
                <li>Sequential chunk uploads protect against network timeouts</li>
                <li>Previous data is fully replaced on each import</li>
              </ul>
            </div>
          </div>

          {/* Right: Preview Table */}
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV Preview {parsedRows.length > 0 && `(${parsedRows.length} rows)`}
              </h3>
              {parsedRows.length > 0 && (
                <span className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                  <QrCode className="w-3 h-3" />
                  {parsedRows.length} Valid QR Codes
                </span>
              )}
            </div>

            {parsedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <FileSpreadsheet className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-xs font-bold">No CSV loaded yet</p>
                <p className="text-[10px] mt-1">Upload a CSV file to preview asset data</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-[10px] border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200 text-[9px] tracking-wider sticky top-0 z-10">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">District</th>
                      <th className="py-2 px-2">Hospital</th>
                      <th className="py-2 px-2">Equipment</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">QR Code</th>
                      <th className="py-2 px-2">Serial No</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {parsedRows.slice(0, 200).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-1.5 px-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-2 text-gray-700 truncate max-w-[100px]" title={row.district_name}>{row.district_name}</td>
                        <td className="py-1.5 px-2 text-gray-700 truncate max-w-[130px]" title={row.hospital_name}>{row.hospital_name}</td>
                        <td className="py-1.5 px-2 text-gray-800 font-semibold truncate max-w-[130px]" title={row.equipment_name}>{row.equipment_name}</td>
                        <td className="py-1.5 px-2 text-gray-600 truncate max-w-[90px]" title={row.equipment_type}>{row.equipment_type || "-"}</td>
                        <td className="py-1.5 px-2 font-mono text-indigo-600 font-bold truncate max-w-[130px]" title={row.qr_code}>{row.qr_code}</td>
                        <td className="py-1.5 px-2 text-gray-600 font-mono">{row.serial_no}</td>
                        <td className="py-1.5 px-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                            (row.equipment_status || "").toLowerCase().includes("functional") ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-100 border-gray-200 text-gray-600"
                          }`}>{row.equipment_status || "N/A"}</span>
                        </td>
                        <td className="py-1.5 px-2 text-gray-700 font-mono">₹{row.asset_value || "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 200 && (
                  <div className="p-2 text-center text-[10px] text-gray-400 font-bold bg-gray-50 border-t border-gray-200">
                    Showing first 200 of {parsedRows.length} rows
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== Inventory Tab ====== */}
      {activeTab === "inventory" && (
        <div className="bg-white border border-gray-200 border-t-[3px] border-t-indigo-600 rounded shadow-sm overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by equipment, QR code, serial no, hospital..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-indigo-400 font-medium"
              />
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {totalAssets.toLocaleString()} total assets
            </div>
          </div>

          {/* Table */}
          {loadingAssets ? (
            <div className="py-8">
              <Loader message="Loading inventory..." />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <Package className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-xs font-bold">No assets in inventory</p>
              <p className="text-[10px] mt-1">Upload a CSV file to populate the database</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200 text-[9px] tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-2">District</th>
                    <th className="py-2.5 px-2">Hospital</th>
                    <th className="py-2.5 px-2">Department</th>
                    <th className="py-2.5 px-2">Equipment</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2">Model</th>
                    <th className="py-2.5 px-2">Serial No</th>
                    <th className="py-2.5 px-2">QR Code</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2">Value</th>
                    <th className="py-2.5 px-2">DI Name</th>
                    <th className="py-2.5 px-2">Zone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {assets.map((a, idx) => (
                    <tr key={a.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2 px-2 text-gray-400 font-mono">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-2 px-2 text-gray-700 truncate max-w-[90px]" title={a.district_name}>{a.district_name}</td>
                      <td className="py-2 px-2 text-gray-700 truncate max-w-[120px]" title={a.hospital_name}>{a.hospital_name}</td>
                      <td className="py-2 px-2 text-gray-600 truncate max-w-[100px]" title={a.department_name}>{a.department_name}</td>
                      <td className="py-2 px-2 text-gray-800 font-semibold truncate max-w-[120px]" title={a.equipment_name}>{a.equipment_name}</td>
                      <td className="py-2 px-2 text-gray-600 truncate max-w-[80px]" title={a.equipment_type}>{a.equipment_type || "-"}</td>
                      <td className="py-2 px-2 text-gray-600 truncate max-w-[90px]" title={a.model_name}>{a.model_name}</td>
                      <td className="py-2 px-2 font-mono text-gray-600">{a.serial_no}</td>
                      <td className="py-2 px-2 font-mono text-indigo-600 font-bold truncate max-w-[120px]" title={a.qr_code}>{a.qr_code}</td>
                      <td className="py-2 px-2 text-gray-600">{a.equipment_category}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                          (a.equipment_status || "").toLowerCase().includes("functional") ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-100 border-gray-200 text-gray-600"
                        }`}>{a.equipment_status || "N/A"}</span>
                      </td>
                      <td className="py-2 px-2 text-gray-700 font-mono">₹{a.asset_value || "0"}</td>
                      <td className="py-2 px-2 text-gray-600 truncate max-w-[90px]">{a.di_name}</td>
                      <td className="py-2 px-2 text-gray-600">{a.zone_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Page {currentPage} of {totalPages}
              </span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====== Analytics Tab (AdminLTE Bootstrap Theme Grid) ====== */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Chart 1: Status Breakdown */}
          <div className="bg-white border border-gray-200 border-t-[3px] border-t-primary rounded shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Equipment Status Distribution
              </h3>
            </div>
            <div className="w-full h-64 p-4">
              {stats.charts.status_list.length > 0 ? (
                <div style={{ height: 180 }} className="relative flex justify-center items-center">
                  <Doughnut
                    data={{
                      labels: stats.charts.status_list.map(s => s.name),
                      datasets: [
                        {
                          data: stats.charts.status_list.map(s => s.value),
                          backgroundColor: GALLERY_COLORS.slice(0, stats.charts.status_list.length),
                          borderColor: '#ffffff',
                          borderWidth: 2
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom' as const,
                          labels: {
                            boxWidth: 8,
                            padding: 6,
                            font: { size: 9, weight: 'bold' }
                          }
                        }
                      },
                      cutout: '60%'
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">No Data Available</div>
              )}
            </div>
          </div>

          {/* Chart 2: Top Equipment Types */}
          <div className="bg-white border border-gray-200 border-t-[3px] border-t-success rounded shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                Top 5 Equipment Types
              </h3>
            </div>
            <div className="w-full h-64 p-4">
              {stats.charts.top_types.length > 0 ? (
                <div style={{ height: 180 }} className="relative flex justify-center items-center">
                  <Bar
                    data={{
                      labels: stats.charts.top_types.map(t => t.name),
                      datasets: [
                        {
                          label: 'Units',
                          data: stats.charts.top_types.map(t => t.value),
                          backgroundColor: '#2b7d50',
                          borderRadius: 4
                        }
                      ]
                    }}
                    options={{
                      indexAxis: 'y' as const,
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false }
                      },
                      scales: {
                        x: { ticks: { font: { size: 8 } }, grid: { display: false } },
                        y: { ticks: { font: { size: 8 } }, grid: { display: false } }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">No Data Available</div>
              )}
            </div>
          </div>

          {/* Chart 3: Warranty Breakdown */}
          <div className="bg-white border border-gray-200 border-t-[3px] border-t-warning rounded shadow-sm flex flex-col">
            <div className="p-3 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                Warranty Status Breakdown
              </h3>
            </div>
            <div className="w-full h-64 p-4">
              {stats.charts.warranty_list.some(w => w.value > 0) ? (
                <div style={{ height: 180 }} className="relative flex justify-center items-center">
                  <Pie
                    data={{
                      labels: stats.charts.warranty_list.map(w => w.name),
                      datasets: [
                        {
                          data: stats.charts.warranty_list.map(w => w.value),
                          backgroundColor: ['#2b7d50', '#d28b2a'],
                          borderColor: '#ffffff',
                          borderWidth: 2
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom' as const,
                          labels: {
                            boxWidth: 8,
                            padding: 6,
                            font: { size: 9, weight: 'bold' }
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">No Data Available</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
