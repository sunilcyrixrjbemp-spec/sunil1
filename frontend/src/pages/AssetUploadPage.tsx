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
import toast from "react-hot-toast";
import api from "../services/api";

// CSV column header names (in user-provided order) — now includes Equipment Type
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
}

const defaultStats: AssetStats = {
  total_equipment: 0, verified_equipment: 0, under_warranty: 0,
  out_of_warranty: 0, total_value: 0, verified_value: 0,
  verified_out_of_warranty_value: 0, monthly_value: 0,
  arrear_billing: 0, total_billing: 0
};

const fmt = (n: number) => n >= 10000000 ? `${(n / 10000000).toFixed(2)} Cr` :
  n >= 100000 ? `${(n / 100000).toFixed(2)} L` :
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString("en-IN");

const fmtRs = (n: number) => `₹${fmt(n)}`;

export default function AssetUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
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
  const [zones, setZones] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [diNames, setDINames] = useState<string[]>([]);

  // Tab: "upload" | "inventory"
  const [activeTab, setActiveTab] = useState<"upload" | "inventory">("upload");

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filterZone, filterDistrict, filterDI]);

  useEffect(() => {
    if (activeTab === "inventory") {
      fetchAssets();
    }
  }, [activeTab, currentPage, searchQuery, filterZone, filterDistrict, filterDI]);

  const fetchFilters = async () => {
    try {
      const res = await api.get("/reports/assets-filters");
      if (res.data.success) {
        setZones(res.data.zones || []);
        setDistricts(res.data.districts || []);
        setDINames(res.data.di_names || []);
      }
    } catch (_) {}
  };

  const fetchStats = async () => {
    try {
      const params: any = {};
      if (filterZone) params.zone = filterZone;
      if (filterDistrict) params.district = filterDistrict;
      if (filterDI) params.di = filterDI;
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

  // ====== CSV Parser (client-side preview only) ======
  const parseCSVPreview = (text: string): AssetRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headerLine = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));

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
      const parts = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
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

  // ====== INSTANT Upload — send raw CSV file to backend ======
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("No file selected.");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/reports/upload-assets-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        setUploadResult({
          inserted: res.data.inserted,
          skipped: res.data.skipped,
          elapsed_ms: res.data.elapsed_ms || 0
        });
        toast.success(`${res.data.inserted} assets imported in ${res.data.elapsed_ms}ms!`);
        setSelectedFile(null);
        setParsedRows([]);
        setSkippedCount(0);
        fetchStats();
        fetchFilters();
        if (activeTab === "inventory") fetchAssets();
      } else {
        throw new Error(res.data.message || "Upload failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Upload failed.");
    } finally {
      setUploading(false);
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
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalAssets / pageSize);
  const hasFilters = filterZone || filterDistrict || filterDI;

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

      {/* ===== Filters Row ===== */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters
          </span>
          <select value={filterZone} onChange={e => { setFilterZone(e.target.value); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All Zones</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All Districts</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterDI} onChange={e => { setFilterDI(e.target.value); setCurrentPage(1); }}
            className="text-[11px] font-semibold border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 min-w-[120px]">
            <option value="">All DI Names</option>
            {diNames.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters}
              className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer bg-transparent border-0">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ===== Stats Dashboard ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          { label: "Total Equipment", value: stats.total_equipment.toLocaleString(), icon: <Package className="w-4 h-4" />, bg: "bg-indigo-50 border-indigo-100 text-indigo-700" },
          { label: "Verified Equipment", value: stats.verified_equipment.toLocaleString(), icon: <ShieldCheck className="w-4 h-4" />, bg: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: "Under Warranty", value: stats.under_warranty.toLocaleString(), icon: <ShieldCheck className="w-4 h-4" />, bg: "bg-sky-50 border-sky-100 text-sky-700" },
          { label: "Out of Warranty", value: stats.out_of_warranty.toLocaleString(), icon: <ShieldOff className="w-4 h-4" />, bg: "bg-amber-50 border-amber-100 text-amber-700" },
          { label: "Total Equipment Value", value: fmtRs(stats.total_value), icon: <IndianRupee className="w-4 h-4" />, bg: "bg-purple-50 border-purple-100 text-purple-700" },
        ].map((s, i) => (
          <div key={i} className={`border rounded-lg p-2.5 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1 opacity-70">{s.icon}<span className="text-[8px] uppercase tracking-wider font-bold">{s.label}</span></div>
            <p className="text-base font-black tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          { label: "Verified Equipment Value", value: fmtRs(stats.verified_value), icon: <CheckCircle className="w-4 h-4" />, bg: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: "Verified Out-of-Warranty Value", value: fmtRs(stats.verified_out_of_warranty_value), icon: <ShieldOff className="w-4 h-4" />, bg: "bg-orange-50 border-orange-100 text-orange-700" },
          { label: "Monthly Billing", value: fmtRs(stats.monthly_value), sub: "(Value × 6.08% ÷ 12)", icon: <Calendar className="w-4 h-4" />, bg: "bg-blue-50 border-blue-100 text-blue-700" },
          { label: "Arrear Billing", value: fmtRs(stats.arrear_billing), sub: "This month verified", icon: <Receipt className="w-4 h-4" />, bg: "bg-rose-50 border-rose-100 text-rose-700" },
          { label: "Total Billing Value", value: fmtRs(stats.total_billing), icon: <IndianRupee className="w-4 h-4" />, bg: "bg-violet-50 border-violet-100 text-violet-700" },
        ].map((s, i) => (
          <div key={i} className={`border rounded-lg p-2.5 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1 opacity-70">{s.icon}<span className="text-[8px] uppercase tracking-wider font-bold">{s.label}</span></div>
            <p className="text-base font-black tabular-nums">{s.value}</p>
            {"sub" in s && s.sub && <p className="text-[8px] opacity-60 font-semibold mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-0 border-b border-gray-200">
        {[
          { key: "upload" as const, label: "Upload Assets", icon: <UploadCloud className="w-3.5 h-3.5" /> },
          { key: "inventory" as const, label: "View Inventory", icon: <BarChart3 className="w-3.5 h-3.5" /> },
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
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Instant CSV Import
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
                    Ready for instant import
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-12 h-12 text-gray-400" />
                  <p className="text-xs font-bold text-gray-700">Drag & drop CSV file here</p>
                  <p className="text-[10px] text-gray-450">or click to browse local files</p>
                  <span className="text-[8px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    Instant server-side processing • No chunking
                  </span>
                </>
              )}
            </div>

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
                disabled={uploading || !selectedFile}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-extrabold text-xs flex items-center justify-center shadow-sm border-0 transition-colors cursor-pointer uppercase tracking-wider gap-1.5"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Instant Upload {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}</>
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
                <li>CSV file is processed server-side in one shot — no chunking</li>
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
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
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
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading inventory...</span>
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

    </div>
  );
}
