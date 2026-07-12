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
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  // Debounce search query to prevent hammering the server on every keypress
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    // Only fetchFilters on mount, fetchStats is triggered by filter changes (which run on mount automatically)
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filterZone, filterDistrict, filterDI, filterMonth]);

  useEffect(() => {
    if (activeTab === "inventory") {
      fetchAssets();
    }
  }, [activeTab, currentPage, debouncedSearch, filterZone, filterDistrict, filterDI, filterMonth]);

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
        setStats({
          ...defaultStats,
          ...res.data,
          charts: {
            top_types: res.data.charts?.top_types || [],
            status_list: res.data.charts?.status_list || [],
            warranty_list: res.data.charts?.warranty_list || []
          }
        });
      }
    } catch (_) {}
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const params: any = { page: currentPage, page_size: pageSize };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
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
          { label: "Total Equipment", value: (stats?.total_equipment ?? 0).toLocaleString(), icon: <Package className="w-5 h-5 text-white" />, bgColor: "bg-[#007bff]" },
          { label: "Verified Equipment", value: (stats?.verified_equipment ?? 0).toLocaleString(), icon: <ShieldCheck className="w-5 h-5 text-white" />, bgColor: "bg-[#28a745]" },
          { label: "Under Warranty", value: (stats?.under_warranty ?? 0).toLocaleString(), icon: <ShieldCheck className="w-5 h-5 text-white" />, bgColor: "bg-[#17a2b8]" },
          { label: "Out of Warranty", value: (stats?.out_of_warranty ?? 0).toLocaleString(), icon: <ShieldOff className="w-5 h-5 text-white" />, bgColor: "bg-[#ffc107]" },
          { label: "Total Equipment Value", value: fmtRs(stats?.total_value ?? 0), icon: <IndianRupee className="w-5 h-5 text-white" />, bgColor: "bg-[#605ca8]" },
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
          { label: "Verified Value", value: fmtRs(stats?.verified_value ?? 0), icon: <CheckCircle className="w-5 h-5 text-white" />, bgColor: "bg-[#28a745]" },
          { label: "Verified OOW Value", value: fmtRs(stats?.verified_out_of_warranty_value ?? 0), icon: <ShieldOff className="w-5 h-5 text-white" />, bgColor: "bg-[#fd7e14]" },
          { label: "Monthly Billing", value: fmtRs(stats?.monthly_value ?? 0), sub: "(Value × 6.08% ÷ 12)", icon: <Calendar className="w-5 h-5 text-white" />, bgColor: "bg-[#007bff]" },
          { label: "Arrear Billing", value: fmtRs(stats?.arrear_billing ?? 0), sub: "Verified in target month", icon: <Receipt className="w-5 h-5 text-white" />, bgColor: "bg-[#dc3545]" },
          { label: "Total Billing Value", value: fmtRs(stats?.total_billing ?? 0), icon: <IndianRupee className="w-5 h-5 text-white" />, bgColor: "bg-[#6f42c1]" },
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
      <div className="bg-slate-50 flex items-center justify-start p-1.5 gap-2 rounded-t-lg mb-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
        {[
          { key: "upload" as const, label: "Upload Assets", icon: <UploadCloud className="w-3.5 h-3.5" /> },
          { key: "inventory" as const, label: "View Inventory", icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: "analytics" as const, label: "Analytics & Charts", icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); if (tab.key === "inventory") setCurrentPage(1); }}
            style={{ minHeight: 'auto' }}
            className={`py-1.5 px-4 font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-0 ${
              activeTab === tab.key
                ? "bg-[#a5d8e8] text-slate-900 font-extrabold shadow-sm"
                : "text-gray-500 bg-transparent hover:text-gray-800 hover:bg-slate-100"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== Upload Tab ====== */}
      {activeTab === "upload" && (
        <div className={selectedFile ? "grid grid-cols-1 lg:grid-cols-5 gap-5 animate-fadeIn" : "max-w-[350px] mx-auto space-y-3.5 animate-fadeIn"}>
          {/* Left: Upload Form */}
          <div className={selectedFile ? "lg:col-span-2 bg-white border border-gray-200 border-t-[3px] border-t-indigo-600 rounded-lg shadow-sm p-4 space-y-4" : "bg-white border border-gray-200 border-t-[3px] border-t-indigo-600 rounded-lg shadow-sm p-4.5 space-y-4"}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Import CSV File
            </h3>

            {/* Drag Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg py-6 px-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragActive ? "border-indigo-500 bg-indigo-50/50"
                  : selectedFile ? "border-green-500 bg-green-50/20"
                  : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              {selectedFile ? (
                <>
                  <FileSpreadsheet className="w-8 h-8 text-green-600 animate-bounce-slow" />
                  <p className="text-[11px] font-bold text-gray-800 break-all">{selectedFile.name}</p>
                  <p className="text-[9px] text-gray-500 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {parsedRows.length} valid rows
                  </p>
                  {skippedCount > 0 && (
                    <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase">
                      {skippedCount} rows skipped (invalid QR)
                    </span>
                  )}
                  <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                    Ready for import
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 text-gray-400" />
                  <p className="text-[11px] font-bold text-gray-700">Drag & drop CSV file here</p>
                  <p className="text-[9px] text-gray-400">or click to browse local files</p>
                  <span className="text-[8px] bg-gray-100 text-gray-650 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                    Safe Upload • Chunks of 500 rows
                  </span>
                </>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-1 p-2.5 bg-indigo-50/30 border border-indigo-100 rounded-lg animate-pulse">
                <div className="flex items-center justify-between text-[9px] font-bold text-indigo-700 uppercase tracking-wider">
                  <span>{uploadProgressDetail}</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className="flex items-start gap-1.5 p-2.5 bg-green-50 border border-green-200 rounded text-[11px] text-green-800">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Upload Successful</p>
                  <p className="text-[9px] mt-0.5">
                    {uploadResult.inserted} assets imported • {uploadResult.skipped} skipped • {uploadResult.elapsed_ms}ms
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={handleUpload}
                disabled={uploading || parsedRows.length === 0}
                className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg font-extrabold text-[11px] flex items-center justify-center shadow-sm border-0 transition-colors cursor-pointer uppercase tracking-wider gap-1"
              >
                {uploading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                ) : (
                  <><Zap className="w-3 h-3" /> Upload {parsedRows.length > 0 ? `(${parsedRows.length} Rows)` : "Assets"}</>
                )}
              </button>
              {selectedFile && !uploading && (
                <button
                  onClick={() => { setSelectedFile(null); setParsedRows([]); setSkippedCount(0); setUploadResult(null); }}
                  className="h-9 px-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 bg-white text-xs font-bold cursor-pointer transition-colors"
                ><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            {/* Info Box */}
            <div className="p-2.5 bg-gray-50 border border-gray-150 rounded text-[9px] text-gray-400 space-y-1">
              <p className="font-bold text-gray-500 uppercase tracking-wider text-[8px]">Import Rules</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Rows with QR Code = "<span className="font-mono font-bold">--</span>" are automatically skipped</li>
                <li>Rows with empty or whitespace-only QR Code are skipped</li>
                <li>Duplicate QR codes are skipped to preserve existing data</li>
                <li>Optimized read engine operates with zero DB lookups</li>
                <li>Replicates immediately to edge and primary nodes</li>
              </ul>
            </div>
          </div>

          {/* Right: Preview Table */}
          {selectedFile && (
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
            </div>
          )}
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
              <table className="hidden md:table w-full text-left text-[10px] border-collapse min-w-[1400px]">
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

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3 p-3">
                {assets.map((a, idx) => (
                  <div
                    key={a.id || idx}
                    className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 shadow-sm text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 leading-tight">{a.equipment_name}</div>
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono block mt-1 w-fit">{a.qr_code}</span>
                      </div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                        (a.equipment_status || "").toLowerCase().includes("functional") ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-100 border-gray-200 text-gray-600"
                      }`}>{a.equipment_status || "N/A"}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-gray-100 pt-2.5">
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Location</span>
                        <span className="text-gray-700 font-semibold block">{a.hospital_name}</span>
                        <span className="text-gray-500 block text-[9px]">{a.district_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Department / Type</span>
                        <span className="text-gray-600 block">{a.department_name}</span>
                        <span className="text-gray-500 block text-[9px]">{a.equipment_type || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Model / Serial No</span>
                        <span className="text-gray-600 block">{a.model_name || "-"}</span>
                        <span className="text-gray-500 font-mono block text-[9px]">{a.serial_no}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[9px] block">Asset Value / Category</span>
                        <span className="text-gray-700 font-semibold font-mono block">₹{a.asset_value || "0"}</span>
                        <span className="text-gray-550 block text-[9px]">{a.equipment_category || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

      {activeTab === "analytics" && (
        <>
          {/* Mobile view warning message */}
          <div className="block lg:hidden card-lte p-8 text-center bg-white shadow-sm font-sans">
            <BarChart3 className="w-12 h-12 text-blue-500 mx-auto mb-3 opacity-80" />
            <p className="text-sm font-bold text-gray-700">Analytics & Charts are optimized for desktop</p>
            <p className="text-xs text-gray-500 mt-1">Please use a desktop browser to view the interactive charts and regional distribution reports.</p>
          </div>

          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                <div className="relative flex justify-center items-center h-full" style={{ height: "200px" }}>
                  <ResponsivePie
                    data={stats.charts.status_list.map((s, i) => ({ id: s.name, label: s.name, value: s.value, color: GALLERY_COLORS[i % GALLERY_COLORS.length] }))}
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    innerRadius={0.7}
                    padAngle={3}
                    colors={{ datum: 'data.color' }}
                    borderWidth={2}
                    borderColor="#ffffff"
                    enableArcLinkLabels={false}
                    enableArcLabels={false}
                    tooltip={({ datum }) => (
                      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{datum.label}</p>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: datum.color }} />
                            Units:
                          </span>
                          <span className="font-mono font-bold text-white">{datum.value}</span>
                        </div>
                      </div>
                    )}
                  />
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total</span>
                    <span className="text-xs font-black text-slate-800 font-mono">
                      {stats.charts.status_list.reduce((sum, item) => sum + item.value, 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">No Data Available</div>
              )}
              {stats.charts.status_list.length > 0 && (
                <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                  {stats.charts.status_list.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GALLERY_COLORS[i % GALLERY_COLORS.length] }} />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
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
                <ResponsiveBar
                  data={stats.charts.top_types as any}
                  keys={["value"]}
                  indexBy="name"
                  layout="horizontal"
                  margin={{ top: 15, right: 15, bottom: 35, left: 80 }}
                  padding={0.35}
                  colors={GALLERY_COLORS}
                  colorBy="indexValue"
                  borderRadius={6}
                  borderWidth={0}
                  enableLabel={false}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0
                  }}
                  theme={{
                    grid: {
                      line: {
                        stroke: '#f1f5f9',
                        strokeWidth: 1
                      }
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 8,
                          fontWeight: 'bold',
                          fill: '#64748b'
                        }
                      }
                    }
                  }}
                  tooltip={({ value, color, indexValue }) => (
                    <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                      <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{indexValue}</p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          Units:
                        </span>
                        <span className="font-mono font-bold text-white">{value}</span>
                      </div>
                    </div>
                  )}
                />
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
                <div className="relative flex justify-center items-center h-full" style={{ height: "200px" }}>
                  <ResponsivePie
                    data={stats.charts.warranty_list.map((w, i) => ({ id: w.name, label: w.name, value: w.value, color: i === 0 ? "#2b7d50" : "#d28b2a" }))}
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    innerRadius={0}
                    padAngle={1.5}
                    colors={{ datum: 'data.color' }}
                    borderWidth={2}
                    borderColor="#ffffff"
                    enableArcLinkLabels={false}
                    enableArcLabels={false}
                    tooltip={({ datum }) => (
                      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{datum.label}</p>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: datum.color }} />
                            Units:
                          </span>
                          <span className="font-mono font-bold text-white">{datum.value}</span>
                        </div>
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400 font-bold">No Data Available</div>
              )}
              {stats.charts.warranty_list.some(w => w.value > 0) && (
                <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2">
                  {stats.charts.warranty_list.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-[8px] font-bold text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? "#2b7d50" : "#d28b2a" }} />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    </div>
  );
}
