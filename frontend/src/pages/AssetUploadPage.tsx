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
import { SaaSHorizontalBarChart, SaaSDonutChart } from "../components/common/SaaSCharts";
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
  monthly_billing_gst?: number;
  monthly_billing_gst_inc?: number;
  arrear_billing: number;
  arrear_billing_gst?: number;
  arrear_billing_gst_inc?: number;
  total_billing: number;
  total_billing_gst?: number;
  total_billing_gst_inc?: number;
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
  monthly_billing_gst: 0, monthly_billing_gst_inc: 0,
  arrear_billing: 0, arrear_billing_gst: 0, arrear_billing_gst_inc: 0,
  total_billing: 0, total_billing_gst: 0, total_billing_gst_inc: 0,
  charts: { top_types: [], status_list: [], warranty_list: [] }
};

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
  const [uploadResult, setUploadResult] = useState<{inserted: number; updated: number; skipped: number; elapsed_ms: number} | null>(null);
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

  // State to toggle inline upload panel
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  // Tab: "inventory" | "analytics"
  const [activeTab, setActiveTab] = useState<"inventory" | "analytics">("inventory");

  // Debounce search query to prevent hammering the server on every keypress
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset to page 1 whenever debouncedSearch or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterZone, filterDistrict, filterDI, filterMonth]);

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

      if (!row.equipment_type || row.equipment_type.trim() === "" || row.equipment_type.trim() === "Biomedical" || row.equipment_type.trim() === "Others" || row.equipment_type.trim() === "Critical") {
        row.equipment_type = "Non-Biomedical";
      }
      if (!row.equipment_category || row.equipment_category.trim() === "" || row.equipment_category.trim() === "Biomedical" || row.equipment_category.trim() === "Others" || row.equipment_category.trim() === "Critical") {
        row.equipment_category = "Non-Biomedical";
      }

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

    const CHUNK_SIZE = 500;
    const totalRows = parsedRows.length;
    let uploadedCount = 0;
    let updatedCount = 0;
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
          uploadedCount += res.data.inserted || 0;
          updatedCount += res.data.updated || 0;
          skippedCountServer += (res.data.skipped !== undefined ? res.data.skipped : ((res.data.skipped_verified || 0) + (res.data.invalid_barcode || 0)));
          const pct = Math.round(((i + chunk.length) / totalRows) * 100);
          setUploadProgress(pct);
        } else {
          throw new Error(res.data.message || "Chunk upload failed");
        }
      }

      const elapsed_ms = performance.now() - startTime;
      const totalSkipped = skippedCountServer + skippedCount;
      setUploadResult({
        inserted: uploadedCount,
        updated: updatedCount,
        skipped: totalSkipped,
        elapsed_ms: Math.round(elapsed_ms)
      });
      toast.success(`${uploadedCount} inserted, ${updatedCount} updated, ${totalSkipped} skipped in ${(elapsed_ms / 1000).toFixed(1)}s!`);
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
    <div className="space-y-2.5 antialiased text-slate-800 font-sans">

      {/* ── Page Header ── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">Asset Inventory Manager</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Import equipment assets via CSV and manage inventory with billing analytics.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadPanel(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#4A6A8A] rounded-none text-xs font-bold text-white bg-[#4A6A8A] hover:bg-[#3a5a7a] transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            {showUploadPanel ? "Hide Import" : "Import CSV File"}
          </button>
          <button
            onClick={downloadSampleCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-none text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample CSV
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs px-3.5 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filters
        </span>
        <select value={filterZone} onChange={e => { setFilterZone(e.target.value); setFilterDistrict(""); setFilterDI(""); setCurrentPage(1); }}
          className="text-xs font-semibold border border-slate-200 rounded-none px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-[#4A6A8A] min-w-[120px]">
          <option value="">All Zones</option>
          {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setFilterDI(""); setCurrentPage(1); }}
          className="text-xs font-semibold border border-slate-200 rounded-none px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-[#4A6A8A] min-w-[120px]">
          <option value="">All Districts</option>
          {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterDI} onChange={e => { setFilterDI(e.target.value); setCurrentPage(1); }}
          className="text-xs font-semibold border border-slate-200 rounded-none px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-[#4A6A8A] min-w-[120px]">
          <option value="">All DI Names</option>
          {availableDIs.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
          className="text-xs font-semibold border border-slate-200 rounded-none px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-[#4A6A8A] min-w-[140px]">
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* ── Stats Row 1: Equipment Counts ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          { label: "Total Equipment", value: (stats?.total_equipment ?? 0).toLocaleString(), badge: "Units", icon: <Package className="w-4 h-4" />, grad: "from-blue-600 to-indigo-600", badgeCls: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Verified Equipment", value: (stats?.verified_equipment ?? 0).toLocaleString(), badge: "Verified", icon: <ShieldCheck className="w-4 h-4" />, grad: "from-emerald-600 to-teal-600", badgeCls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Under Warranty", value: (stats?.under_warranty ?? 0).toLocaleString(), badge: "Active", icon: <ShieldCheck className="w-4 h-4" />, grad: "from-cyan-500 to-sky-600", badgeCls: "text-cyan-700 bg-cyan-50 border-cyan-200" },
          { label: "Out of Warranty", value: (stats?.out_of_warranty ?? 0).toLocaleString(), badge: "OOW", icon: <ShieldOff className="w-4 h-4" />, grad: "from-amber-500 to-orange-500", badgeCls: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "Total Equipment Value", value: fmtRs(stats?.total_value ?? 0), badge: "Asset Value", icon: <IndianRupee className="w-4 h-4" />, grad: "from-indigo-500 to-purple-600", badgeCls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-none bg-gradient-to-br ${s.grad} flex items-center justify-center text-white shrink-0`}>{s.icon}</div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">{s.label}</span>
              <span className="text-[13px] font-mono font-extrabold text-slate-900 leading-none">{s.value}</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none border font-mono leading-none w-fit ${s.badgeCls}`}>{s.badge}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Stats Row 2: Billing ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          { label: "Verified Value", value: fmtRs(stats?.verified_value ?? 0), sub: "Verified Inventory Cost", icon: <CheckCircle className="w-4 h-4" />, grad: "from-emerald-600 to-teal-600", badgeCls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Verified OOW Value", value: fmtRs(stats?.verified_out_of_warranty_value ?? 0), sub: "OOW @ 6.08%", icon: <ShieldOff className="w-4 h-4" />, grad: "from-amber-500 to-orange-500", badgeCls: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "Monthly Billing", value: fmtRs(stats?.monthly_value ?? 0), sub: `GST Inc: ${fmtRs(stats?.monthly_billing_gst_inc ?? Math.round((stats?.monthly_value ?? 0) * 1.18))}`, icon: <Calendar className="w-4 h-4" />, grad: "from-blue-600 to-indigo-600", badgeCls: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Arrear Billing", value: fmtRs(stats?.arrear_billing ?? 0), sub: `GST Inc: ${fmtRs(stats?.arrear_billing_gst_inc ?? Math.round((stats?.arrear_billing ?? 0) * 1.18))}`, icon: <Receipt className="w-4 h-4" />, grad: "from-rose-500 to-red-600", badgeCls: "text-rose-700 bg-rose-50 border-rose-200" },
          { label: "Total Billing (GST Inc)", value: fmtRs(stats?.total_billing_gst_inc ?? Math.round((stats?.total_billing ?? 0) * 1.18)), sub: `Excl. GST: ${fmtRs(stats?.total_billing ?? 0)}`, icon: <IndianRupee className="w-4 h-4" />, grad: "from-indigo-500 to-purple-600", badgeCls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-none shadow-2xs p-2.5 flex items-center gap-2.5 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-none bg-gradient-to-br ${s.grad} flex items-center justify-center text-white shrink-0`}>{s.icon}</div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">{s.label}</span>
              <span className="text-[13px] font-mono font-extrabold text-slate-900 leading-none">{s.value}</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-none border font-mono leading-none w-fit ${s.badgeCls}`}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex items-center gap-1 px-3 py-2">
        {[
          { key: "inventory" as const, label: "View Inventory & CSV Import", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
          { key: "analytics" as const, label: "Analytics & Charts", icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); if (tab.key === "inventory") setCurrentPage(1); }}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1.5 rounded-none border whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? "bg-[#4A6A8A] text-white border-[#4A6A8A]"
                : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== Inventory & CSV Upload Combined Tab ====== */}
      {activeTab === "inventory" && (
        <div className="space-y-2.5">
          {/* Inline Collapsible CSV Upload Section */}
          {(showUploadPanel || selectedFile) && (
            <div className={selectedFile ? "grid grid-cols-1 lg:grid-cols-5 gap-2.5" : "w-full space-y-2.5"}>
              {/* Left/Main: Upload Form */}
              <div className={selectedFile ? "lg:col-span-2 bg-white border border-slate-200 rounded-none shadow-2xs p-4 space-y-3" : "bg-white border border-slate-200 rounded-none shadow-2xs p-4 space-y-3"}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#4A6A8A]" />
                    Import CSV Asset Inventory
                  </h3>
                  <button
                    onClick={() => { setShowUploadPanel(false); setSelectedFile(null); setParsedRows([]); }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drag Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-none py-4 px-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                    isDragActive ? "border-[#4A6A8A] bg-blue-50/50"
                      : selectedFile ? "border-emerald-500 bg-emerald-50/20"
                      : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                  {selectedFile ? (
                    <>
                      <FileSpreadsheet className="w-7 h-7 text-green-600 animate-bounce-slow" />
                      <p className="text-[11px] font-bold text-slate-800 break-all">{selectedFile.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {parsedRows.length} valid rows
                      </p>
                      {skippedCount > 0 && (
                        <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-none border border-amber-200 font-bold uppercase">
                          {skippedCount} rows skipped (invalid QR)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-7 h-7 text-slate-400" />
                      <p className="text-[11px] font-bold text-slate-700">Drag & drop CSV file here or click to browse</p>
                      <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-none uppercase font-bold tracking-wider">
                        Safe Upload • Chunks of 500 rows
                      </span>
                    </>
                  )}
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-1 p-2 bg-blue-50 border border-blue-200 rounded-none">
                    <div className="flex items-center justify-between text-[9px] font-bold text-[#4A6A8A] uppercase tracking-wider">
                      <span>{uploadProgressDetail}</span>
                      <span className="font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#4A6A8A] to-indigo-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload Result */}
                {uploadResult && (
                  <div className="flex items-start gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-none text-[11px] text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Upload Successful</p>
                      <p className="text-[9px] mt-0.5">
                        {uploadResult.inserted} inserted • {uploadResult.updated} updated • {uploadResult.skipped} skipped
                      </p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || parsedRows.length === 0}
                    className="flex-1 h-8 bg-[#4A6A8A] hover:bg-[#3a5a7a] disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-none font-extrabold text-[11px] flex items-center justify-center border-0 transition-colors cursor-pointer uppercase tracking-wider gap-1"
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
                      className="h-8 px-2.5 border border-slate-200 rounded-none text-slate-500 hover:bg-slate-50 bg-white text-xs font-bold cursor-pointer transition-colors"
                    ><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>

              {/* Right: Preview Table */}
              {selectedFile && (
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
                  <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      CSV Preview {parsedRows.length > 0 && `— ${parsedRows.length} rows`}
                    </span>
                    {parsedRows.length > 0 && (
                      <span className="text-[10px] font-semibold text-blue-100 bg-white/15 px-2 py-0.5 rounded-none border border-white/20 flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        {parsedRows.length} Valid QR Codes
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left text-[10px] border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 text-[9px] tracking-wider sticky top-0 z-10">
                          <th className="py-2 px-2">#</th>
                          <th className="py-2 px-2">District</th>
                          <th className="py-2 px-2">Hospital</th>
                          <th className="py-2 px-2">Equipment</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2">QR Code</th>
                          <th className="py-2 px-2">Serial No</th>
                          <th className="py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {parsedRows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-1.5 px-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1.5 px-2 text-slate-700 truncate max-w-[90px]" title={row.district_name}>{row.district_name}</td>
                            <td className="py-1.5 px-2 text-slate-700 truncate max-w-[120px]" title={row.hospital_name}>{row.hospital_name}</td>
                            <td className="py-1.5 px-2 text-slate-800 font-semibold truncate max-w-[120px]" title={row.equipment_name}>{row.equipment_name}</td>
                            <td className="py-1.5 px-2 text-slate-600 truncate max-w-[90px]" title={row.equipment_type}>{row.equipment_type || "Non-Biomedical"}</td>
                            <td className="py-1.5 px-2 font-mono text-[#4A6A8A] font-bold truncate max-w-[120px]" title={row.qr_code}>{row.qr_code}</td>
                            <td className="py-1.5 px-2 text-slate-600 font-mono">{row.serial_no}</td>
                            <td className="py-1.5 px-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded-none text-[8px] font-bold uppercase border ${
                                (row.equipment_status || "").toLowerCase().includes("functional") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-600"
                              }`}>{row.equipment_status || "N/A"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Inventory Table */}
          <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
            {/* Header */}
            <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                ASSET INVENTORY TABLE
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-100 bg-white/15 px-2 py-0.5 rounded-none border border-white/20">
                  {totalAssets.toLocaleString()} Assets
                </span>
              </div>
            </div>
            {/* Search Bar */}
            <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by equipment, QR code, serial no, hospital..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-none text-xs bg-white focus:outline-none focus:border-[#4A6A8A] font-medium"
                />
              </div>
            </div>

            {/* Table */}
            {loadingAssets ? (
              <div className="py-8">
                <Loader message="Loading inventory..." />
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Package className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-xs font-bold">No assets in inventory</p>
                <p className="text-[10px] mt-1">Click "Import CSV File" at top to upload equipment assets</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="hidden md:table w-full text-left text-[10px] border-collapse min-w-[1400px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 text-[9px] tracking-wider sticky top-0 z-10">
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
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {assets.map((a, idx) => (
                      <tr key={a.id || idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-2 px-2 text-slate-400 font-mono">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="py-2 px-2 text-slate-700 truncate max-w-[90px]" title={a.district_name}>{a.district_name}</td>
                        <td className="py-2 px-2 text-slate-700 truncate max-w-[120px]" title={a.hospital_name}>{a.hospital_name}</td>
                        <td className="py-2 px-2 text-slate-600 truncate max-w-[100px]" title={a.department_name}>{a.department_name}</td>
                        <td className="py-2 px-2 text-slate-800 font-semibold truncate max-w-[120px]" title={a.equipment_name}>{a.equipment_name}</td>
                        <td className="py-2 px-2 text-slate-600 truncate max-w-[80px]" title={a.equipment_type}>{a.equipment_type || "Non-Biomedical"}</td>
                        <td className="py-2 px-2 text-slate-600 truncate max-w-[90px]" title={a.model_name}>{a.model_name}</td>
                        <td className="py-2 px-2 font-mono text-slate-600">{a.serial_no}</td>
                        <td className="py-2 px-2 font-mono text-[#4A6A8A] font-bold truncate max-w-[120px]" title={a.qr_code}>{a.qr_code}</td>
                        <td className="py-2 px-2 text-slate-600">{a.equipment_category || "Non-Biomedical"}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded-none text-[8px] font-bold uppercase border ${
                            (a.equipment_status || "").toLowerCase().includes("functional") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-600"
                          }`}>{a.equipment_status || "N/A"}</span>
                        </td>
                        <td className="py-2 px-2 text-slate-700 font-mono">₹{a.asset_value || "0"}</td>
                        <td className="py-2 px-2 text-slate-600 truncate max-w-[90px]">{a.di_name}</td>
                        <td className="py-2 px-2 text-slate-600">{a.zone_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card List View */}
                <div className="block md:hidden space-y-2.5 p-3">
                  {assets.map((a, idx) => (
                    <div key={a.id || idx} className="bg-white border border-slate-200 rounded-none p-3 space-y-2.5 shadow-2xs text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-800 leading-tight">{a.equipment_name}</div>
                          <span className="text-[9px] font-bold text-[#4A6A8A] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-none font-mono block mt-1 w-fit">{a.qr_code}</span>
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 rounded-none text-[8px] font-bold uppercase border ${
                          (a.equipment_status || "").toLowerCase().includes("functional") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>{a.equipment_status || "N/A"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-100 pt-2">
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block">Location</span>
                          <span className="text-slate-700 font-semibold block">{a.hospital_name}</span>
                          <span className="text-slate-500 block text-[9px]">{a.district_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block">Department / Type</span>
                          <span className="text-slate-600 block">{a.department_name}</span>
                          <span className="text-slate-500 block text-[9px]">{a.equipment_type || "Non-Biomedical"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block">Model / Serial No</span>
                          <span className="text-slate-600 block">{a.model_name || "-"}</span>
                          <span className="text-slate-500 font-mono block text-[9px]">{a.serial_no}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase text-[9px] block">Asset Value / Category</span>
                          <span className="text-slate-700 font-semibold font-mono block">₹{a.asset_value || "0"}</span>
                          <span className="text-slate-500 block text-[9px]">{a.equipment_category || "Non-Biomedical"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-none bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 transition-colors cursor-pointer">
                  <ChevronLeft className="w-3 h-3" /> Prev
                </button>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-none bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 transition-colors cursor-pointer">
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== Analytics Tab (Horizontal Bar Charts) ====== */}
      {activeTab === "analytics" && (
        <>
          {/* Mobile view warning message */}
          <div className="block lg:hidden bg-white border border-slate-200 rounded-none p-8 text-center">
            <BarChart3 className="w-12 h-12 text-[#4A6A8A] mx-auto mb-3 opacity-80" />
            <p className="text-sm font-bold text-slate-700">Analytics & Charts are optimized for desktop</p>
            <p className="text-xs text-slate-500 mt-1">Please use a desktop browser to view the interactive charts and regional distribution reports.</p>
          </div>

          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Chart 1: Equipment Status Distribution (Bar Chart - avoids label overlap for 1%/2%) */}
            <div className="bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  EQUIPMENT STATUS DISTRIBUTION
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                {stats.charts.status_list.length > 0 ? (
                  <SaaSHorizontalBarChart
                    data={stats.charts.status_list}
                    valueKey="value"
                    nameKey="name"
                    height={270}
                    isCurrency={false}
                    valueFormatter={(v) => `${v.toLocaleString('en-IN')} Units`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No status data available
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Top Equipment Types (Pie / Donut Chart) */}
            <div className="bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  TOP EQUIPMENT TYPES
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                {stats.charts.top_types.length > 0 ? (
                  <SaaSDonutChart
                    data={stats.charts.top_types.map((t, idx) => ({
                      name: (t.name === "Biomedical" || t.name === "Critical" || t.name === "Others" || !t.name) ? "Non-Biomedical" : t.name,
                      value: t.value,
                      color: [
                        "#2563eb", // Blue
                        "#059669", // Emerald Green
                        "#d97706", // Amber
                        "#7c3aed", // Purple
                        "#0891b2"  // Cyan
                      ][idx % 5]
                    }))}
                    height={270}
                    centerTitle="Types"
                    valueFormatter={(v) => `${v.toLocaleString('en-IN')} Units`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No equipment type data
                  </div>
                )}
              </div>
            </div>

            {/* Chart 3: Warranty Status Breakdown (Pie / Donut Chart) */}
            <div className="bg-white border border-slate-200/80 rounded-none overflow-hidden shadow-2xs flex flex-col">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  WARRANTY STATUS BREAKDOWN
                </span>
              </div>
              <div className="p-3" style={{ height: 290 }}>
                {stats.charts.warranty_list.some(w => w.value > 0) ? (
                  <SaaSDonutChart
                    data={stats.charts.warranty_list.map((w, idx) => ({
                      name: w.name,
                      value: w.value,
                      color: idx === 0 ? "#2563eb" : "#059669"
                    }))}
                    height={270}
                    centerTitle="Warranty"
                    valueFormatter={(v) => `${v.toLocaleString('en-IN')} Units`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">
                    No warranty data available
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
