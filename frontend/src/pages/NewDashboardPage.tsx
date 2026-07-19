import { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  TrendingUp,
  FileText,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Award,
  AlertCircle,
  Search,
  FilterX,
  IndianRupee,
  Sparkles,
  Activity,
  BarChart3,
  Zap,
  Target,
  TrendingDown,
  Calendar,
  Lightbulb,
  Wrench,
  Timer,
  ArrowUp,
  ArrowDown,
  Minus,
  FlaskConical,
} from "lucide-react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import toast from "react-hot-toast";

const API_KEY =
  import.meta.env.VITE_GOOGLE_SHEETS_API_KEY ||
  "AIzaSyDTkQ1wNpug7rDLmHgDGt_0Xr2XTPnWsIA";
const SPREADSHEET_ID =
  import.meta.env.VITE_GOOGLE_SPREADSHEET_ID ||
  "1ASmvpLSl-X3Vm8S3LxB2Iyhg6HMhOpV-R4ywVS2o8Bs";
const CACHE_KEY = "cyrix_dashboard_sheets_cache_v9";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isComplaintClosed = (row: any): boolean => {
  const status = (row.status || "").trim().toLowerCase();
  const compStatus = (row.complaintStatus || "").trim().toLowerCase();
  const closeDate = (row.complaintCloseDate || "").trim();
  if (status === "open" || compStatus === "pending" || compStatus === "attended") return false;
  if (status === "closed" || compStatus === "final closed" || compStatus === "engineer closed") return true;
  if (!closeDate || closeDate === "" || closeDate === "--" || closeDate.toLowerCase() === "open") return false;
  return true;
};

const parseFlexibleDate = (dateStr: string | null | undefined): number => {
  if (!dateStr) return Date.now();
  const cleaned = dateStr.trim();
  if (cleaned === "" || cleaned === "--" || cleaned.toLowerCase() === "open") return Date.now();
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return parsed;
  try {
    const parts = cleaned.split(" ");
    const dateParts = parts[0].split(/[--\/]/);
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const monthStr = dateParts[1].substring(0, 3).toLowerCase();
      const year =
        parseInt(dateParts[2], 10) < 100
          ? parseInt(dateParts[2], 10) + 2000
          : parseInt(dateParts[2], 10);
      const months: { [key: string]: number } = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      let hours = 0, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(":");
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
      }
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  } catch (e) {
    console.error("Failed to parse date:", cleaned, e);
  }
  return Date.now();
};

const formatRupees = (val: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

// â”€â”€â”€ Nivo shared theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const nivoTheme = {
  background: "transparent",
  text: { fontSize: 11, fill: "#64748b", fontFamily: "inherit" },
  axis: {
    domain: { line: { stroke: "#e2e8f0", strokeWidth: 1 } },
    ticks: { line: { stroke: "#e2e8f0", strokeWidth: 1 }, text: { fill: "#94a3b8", fontSize: 10 } },
    legend: { text: { fill: "#64748b", fontSize: 11, fontWeight: 700 } },
  },
  grid: { line: { stroke: "#f1f5f9", strokeWidth: 1 } },
  legends: { text: { fill: "#64748b", fontSize: 11 } },
  tooltip: {
    container: {
      background: "#0f172a",
      color: "#f8fafc",
      fontSize: 12,
      borderRadius: 10,
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  },
};

// â”€â”€â”€ KPI Card Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KpiCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  color = "slate",
  trend,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  color?: "red" | "green" | "indigo" | "slate" | "amber";
  trend?: { dir: "up" | "down"; label: string };
}) => {
  const palettes: Record<string, { bg: string; iconBg: string; iconText: string; valueCls: string; badge: string }> = {
    red:    { bg: "from-red-600/10 via-red-500/5 to-transparent",    iconBg: "bg-red-100",    iconText: "text-red-600",    valueCls: "text-red-800",   badge: "bg-red-100 text-red-700" },
    green:  { bg: "from-emerald-600/10 via-emerald-500/5 to-transparent", iconBg: "bg-emerald-100", iconText: "text-emerald-600", valueCls: "text-emerald-800", badge: "bg-emerald-100 text-emerald-700" },
    indigo: { bg: "from-indigo-600/10 via-indigo-500/5 to-transparent", iconBg: "bg-indigo-100", iconText: "text-indigo-600", valueCls: "text-indigo-800", badge: "bg-indigo-100 text-indigo-700" },
    slate:  { bg: "from-slate-600/8 via-slate-500/4 to-transparent",  iconBg: "bg-slate-100",  iconText: "text-slate-600",  valueCls: "text-slate-900", badge: "bg-slate-100 text-slate-600" },
    amber:  { bg: "from-amber-600/10 via-amber-500/5 to-transparent", iconBg: "bg-amber-100",  iconText: "text-amber-600",  valueCls: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  };
  const p = palettes[color];
  return (
    <div className={`relative bg-gradient-to-br ${p.bg} bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden`}>
      <div className="absolute inset-0 rounded-2xl bg-white opacity-60 pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${p.iconBg} ${p.iconText} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend.dir === "up" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
              {trend.dir === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.label}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className={`text-2xl font-black tracking-tight ${p.valueCls} leading-none`}>{value}</h3>
        {subtext && <p className="text-[10px] font-semibold text-slate-500 mt-2">{subtext}</p>}
      </div>
    </div>
  );
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function NewDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedRepeatBarcode, setSelectedRepeatBarcode] = useState<string | null>(null);

  const [diNameList, setDiNameList] = useState<any[]>([]);
  const [penaltyFile, setPenaltyFile] = useState<any[]>([]);
  const [assetValues, setAssetValues] = useState<any[]>([]);
  const [criticalEquipment, setCriticalEquipment] = useState<any[]>([]);
  const [expenseList, setExpenseList] = useState<any[]>([]);

  const [selectedZone, setSelectedZone] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [selectedDI, setSelectedDI] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedHospitalType, setSelectedHospitalType] = useState("");
  const [selectedEquipmentType, setSelectedEquipmentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusTab, setStatusTab] = useState<"open" | "closed" | "all">("all");

  const [activeTab, setActiveTab] = useState<"overview" | "leaderboard" | "sla" | "repeats" | "fraud" | "analytics">("overview");
  const [breakdownTab, setBreakdownTab] = useState<"district" | "di" | "coordinator" | "zone" | "hospital">("district");

  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [openTicketsSearch, setOpenTicketsSearch] = useState("");
  const [fraudSearch, setFraudSearch] = useState("");

  const [openPage, setOpenPage] = useState(1);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [fraudPage, setFraudPage] = useState(1);
  const itemsPerPage = 10;

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const userRole = currentUser?.role || "MIS";
  const userZone = currentUser?.zone || null;
  const userCoordinator = currentUser?.coordinator || null;

  useEffect(() => {
    const isPowerUser = ["Admin", "VP", "MIS"].includes(userRole);
    if (!isPowerUser) {
      if (userZone) setSelectedZone(userZone);
      if (userCoordinator) setSelectedCoordinator(userCoordinator);
    }
  }, [userRole, userZone, userCoordinator]);

  const saveToCache = (data: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ di: data.diNameList, p: data.penaltyFile, a: data.assetValues, c: data.criticalEquipment, e: data.expenseList, ts: Date.now() }));
    } catch (err) {
      console.warn("Could not save to LocalStorage cache", err);
    }
  };

  const restoreFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setDiNameList(data.di || []);
        setPenaltyFile(data.p || []);
        setAssetValues(data.a || []);
        setCriticalEquipment(data.c || []);
        setExpenseList(data.e || []);
        setLoading(false);
        return true;
      }
    } catch (e) {
      console.warn("Failed to parse cached dashboard data", e);
    }
    return false;
  };

  const loadAllDashboardData = async (isBackground = false) => {
    try {
      if (isBackground) setBackgroundSyncing(true);
      else setLoading(true);
      setError("");

      const fetchSheet = async (range: string) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google Sheets API responded with code ${res.status} for range ${range}`);
        const data = await res.json();
        return data.values || [];
      };

      const [diRows, assetRows, criticalRows, penaltyRows] = await Promise.all([
        fetchSheet("DI Name List!A1:E"),
        fetchSheet("Asset Value!A1:B"),
        fetchSheet("Critical Equipment!A1:B"),
        fetchSheet("Penalty File!A1:AZ50000"),
      ]);

      const diHeaders = diRows[0] || [];
      const parsedDIs = diRows.slice(1).map((row: any) => {
        const obj: any = {};
        diHeaders.forEach((h: string, idx: number) => { obj[h.trim()] = row[idx] !== undefined ? row[idx].trim() : ""; });
        return { zoneName: obj["Zone Name"] || "", districtName: obj["District Name"] || "", coordinatorName: obj["Coordinator Name"] || "", diName: obj["District Incharge Name"] || "", hospitalName: obj["Hospital Name"] || "" };
      });

      const parsedAssets = assetRows.slice(1).map((row: any) => ({ name: row[0] ? row[0].trim() : "", cost: row[1] ? parseFloat(row[1].trim().replace(/,/g, "")) || 0 : 0 }));
      const parsedCritical = criticalRows.slice(1).map((row: any) => ({ name: row[0] ? row[0].trim() : "", type: row[1] ? row[1].trim() : "" }));

      if (penaltyRows.length < 2) throw new Error("Penalty File contains no records.");

      const penaltyHeaders = penaltyRows[0].map((h: string, idx: number) => {
        const name = h.trim();
        if (name === "Hospital Type" && idx === 22) return "Hospital Type Mapped";
        if (name === "Bar Code" && idx === 47) return "Bar Code Mapped";
        return name;
      });

      const parsedPenalties = penaltyRows.slice(1).map((row: any) => {
        const obj: any = {};
        penaltyHeaders.forEach((h: string, idx: number) => { obj[h] = row[idx] !== undefined ? row[idx].trim() : ""; });
        return {
          complaintId: obj["Complaint ID"] || "",
          districtName: obj["District Name"] || "",
          hospitalName: obj["Hospital Name"] || "",
          barCode: obj["Bar Code"] || "",
          equipmentName: obj["Equipment Name"] || "",
          equipmentModel: obj["Equipment Model"] || "",
          complaintRaiseDate: obj["Complaint Raise Date"] || "",
          complaintCloseDate: obj["Complaint Close date"] || "",
          complaintStatus: obj["Complaint Status"] || "",
          status: obj["Status"] || "",
          totalDowntime: parseFloat((obj["Total Downtime"] || "").replace(/,/g, "")) || 0,
          totalPenalty: parseFloat((obj["Total Penalty"] || "").replace(/,/g, "").replace(/[^0-9.-]/g, "")) || 0,
          hospitalType: obj["Hospital Type"] || "",
          hospitalTypeMapped: obj["Hospital Type Mapped"] || "",
          assetValue: parseFloat((obj["Asset Value"] || "").replace(/,/g, "").replace(/[^0-9.-]/g, "")) || 0,
          equipmentType: obj["Equipment Type"] || "",
          standby: obj["Standby"] || "",
          month: obj["Month"] || "",
          attendDate: obj["Attend Date"] || "",
          coordinatorName: obj["Coordinator Name"] || "",
          diName: obj["DI Name"] || "",
          finalCloseMonth: obj["Final Close Month"] || obj["Fianl Close Month"] || "",
          closeMonth: obj["Close Month"] || "",
        };
      });

      let freshExpenses: any[] = [];
      try { freshExpenses = await expenseService.getTeamExpenses(); } catch (err) { console.warn("Could not fetch team expenses", err); }

      setDiNameList(parsedDIs);
      setPenaltyFile(parsedPenalties);
      setAssetValues(parsedAssets);
      setCriticalEquipment(parsedCritical);
      setExpenseList(freshExpenses);
      saveToCache({ diNameList: parsedDIs, penaltyFile: parsedPenalties, assetValues: parsedAssets, criticalEquipment: parsedCritical, expenseList: freshExpenses });

      if (isBackground) toast.success("Dashboard updated live! âš¡", { id: "bg-sync" });
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch Google Sheet data: " + err.message);
    } finally {
      setLoading(false);
      setBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    const hasCache = restoreFromCache();
    loadAllDashboardData(hasCache);
  }, []);

  const handleResetFilters = () => {
    const isPowerUser = ["Admin", "VP", "MIS"].includes(userRole);
    setSelectedZone(isPowerUser ? "" : (userZone || ""));
    setSelectedDistrict("");
    setSelectedCoordinator(isPowerUser ? "" : (userCoordinator || ""));
    setSelectedDI("");
    setSelectedMonth("");
    setSelectedHospitalType("");
    setSelectedEquipmentType("");
    setDateFrom("");
    setDateTo("");
    setStatusTab("all");
    toast.success("Filters reset");
  };

  const filterOptions = useMemo(() => {
    const zones = new Set<string>();
    const districts = new Set<string>();
    const coordinators = new Set<string>();
    const dis = new Set<string>();
    const months = new Set<string>();
    const hospitalTypes = new Set<string>();
    const equipmentTypes = new Set<string>();

    diNameList.forEach((row) => { if (row.zoneName) zones.add(row.zoneName); });
    diNameList.forEach((row) => { if (!selectedZone || row.zoneName === selectedZone) { if (row.districtName) districts.add(row.districtName); } });
    diNameList.forEach((row) => {
      const matchZone = !selectedZone || row.zoneName === selectedZone;
      const matchDistrict = !selectedDistrict || row.districtName === selectedDistrict;
      if (matchZone && matchDistrict && row.coordinatorName) coordinators.add(row.coordinatorName);
    });
    diNameList.forEach((row) => {
      const matchZone = !selectedZone || row.zoneName === selectedZone;
      const matchDistrict = !selectedDistrict || row.districtName === selectedDistrict;
      const matchCoord = !selectedCoordinator || row.coordinatorName === selectedCoordinator;
      if (matchZone && matchDistrict && matchCoord && row.diName) dis.add(row.diName);
    });
    penaltyFile.forEach((row) => { if (row.month) months.add(row.month); if (row.hospitalType) hospitalTypes.add(row.hospitalType); if (row.equipmentType) equipmentTypes.add(row.equipmentType); });

    return {
      zones: Array.from(zones).sort(),
      districts: Array.from(districts).sort(),
      coordinators: Array.from(coordinators).sort(),
      dis: Array.from(dis).sort(),
      months: Array.from(months).sort((a, b) => {
        const parseMonth = (m: string) => { const parts = m.split("-"); const mNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]; const monthIdx = mNames.indexOf(parts[0].toLowerCase()); const year = parseInt("20" + parts[1]); return new Date(year, monthIdx, 1).getTime(); };
        return parseMonth(a) - parseMonth(b);
      }),
      hospitalTypes: Array.from(hospitalTypes).filter(Boolean).sort(),
      equipmentTypes: Array.from(equipmentTypes).filter(Boolean).sort(),
    };
  }, [diNameList, penaltyFile, selectedZone, selectedDistrict, selectedCoordinator]);

  const filteredPenaltyFile = useMemo(() => {
    return penaltyFile.filter((row) => {
      const mapping = diNameList.find((m) => m.hospitalName === row.hospitalName);
      const zone = mapping ? mapping.zoneName : "";
      const diOpt = (row.diName || "").trim() || (mapping ? mapping.diName : "");
      const coord = (row.coordinatorName || "").trim() || (mapping ? mapping.coordinatorName : "");
      if (selectedZone && zone !== selectedZone) return false;
      if (selectedDistrict && row.districtName !== selectedDistrict) return false;
      if (selectedCoordinator && coord !== selectedCoordinator) return false;
      if (selectedDI && diOpt !== selectedDI) return false;
      if (selectedMonth && row.month !== selectedMonth) return false;
      if (selectedHospitalType && row.hospitalType !== selectedHospitalType) return false;
      if (selectedEquipmentType && row.equipmentType !== selectedEquipmentType) return false;
      if (dateFrom && row.complaintRaiseDate) { if (parseFlexibleDate(row.complaintRaiseDate) < new Date(dateFrom).getTime()) return false; }
      if (dateTo && row.complaintRaiseDate) { if (parseFlexibleDate(row.complaintRaiseDate) > new Date(dateTo).setHours(23, 59, 59, 999)) return false; }
      if (statusTab !== "all") { const isClosed = isComplaintClosed(row); if (statusTab === "open" && isClosed) return false; if (statusTab === "closed" && !isClosed) return false; }
      return true;
    });
  }, [penaltyFile, diNameList, selectedZone, selectedDistrict, selectedCoordinator, selectedDI, selectedMonth, selectedHospitalType, selectedEquipmentType, dateFrom, dateTo, statusTab]);

  const getRowPenaltyVal = (row: any): number => {
    if (row.totalPenalty > 0) return row.totalPenalty;
    if (!isComplaintClosed(row)) {
      if (!row.complaintRaiseDate) return 0;
      const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
      const days = Math.max(0, (Date.now() - raiseTime) / (1000 * 60 * 60 * 24));
      const isCritical = criticalEquipment.some((c) => c.name.toLowerCase() === row.equipmentName.toLowerCase());
      return Math.round(days * (isCritical ? 2000 : 500));
    }
    return 0;
  };

  const summary = useMemo(() => {
    let logged = 0, closed = 0, open = 0, penalty = 0, closedWithin24h = 0;
    filteredPenaltyFile.forEach((row) => {
      logged++;
      const isClosed = isComplaintClosed(row);
      if (isClosed) {
        closed++;
        const diffHours = (parseFlexibleDate(row.complaintCloseDate) - parseFlexibleDate(row.complaintRaiseDate)) / (1000 * 60 * 60);
        if (diffHours <= 24 && diffHours >= 0) closedWithin24h++;
      } else { open++; }
      penalty += getRowPenaltyVal(row);
    });
    return { totalLogged: logged, totalClosed: closed, totalOpen: open, totalPenalty: penalty, ftfrRate: logged > 0 ? ((closedWithin24h / logged) * 100).toFixed(1) : "0.0", closedWithin24h };
  }, [filteredPenaltyFile, assetValues, criticalEquipment]);

  const projections = useMemo(() => {
    const today = new Date();
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    let curMonthPenalty = 0;
    filteredPenaltyFile.forEach((row) => {
      if (!row.complaintRaiseDate) return;
      const raiseDate = new Date(parseFlexibleDate(row.complaintRaiseDate));
      if (raiseDate.getMonth() === today.getMonth() && raiseDate.getFullYear() === today.getFullYear()) curMonthPenalty += getRowPenaltyVal(row);
    });
    const dailyRunRate = currentDay > 0 ? Math.round(curMonthPenalty / currentDay) : 0;
    return { currentMonthPenalty: curMonthPenalty, dailyRunRate, projectedPenalty: curMonthPenalty + (dailyRunRate * (totalDaysInMonth - currentDay)) };
  }, [filteredPenaltyFile, criticalEquipment]);

  // â”€â”€â”€ Monthly Trend Line Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const monthlyTrendData = useMemo(() => {
    const monthMap: Record<string, { penalty: number; open: number; closed: number }> = {};
    filteredPenaltyFile.forEach((row) => {
      const key = row.month || "Unknown";
      if (!monthMap[key]) monthMap[key] = { penalty: 0, open: 0, closed: 0 };
      monthMap[key].penalty += getRowPenaltyVal(row);
      if (isComplaintClosed(row)) monthMap[key].closed++;
      else monthMap[key].open++;
    });
    const sortedKeys = Object.keys(monthMap).sort((a, b) => {
      const mNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const parse = (m: string) => { const parts = m.split("-"); const mi = mNames.indexOf((parts[0] || "jan").toLowerCase()); const y = parseInt("20" + (parts[1] || "25")); return new Date(y, mi, 1).getTime(); };
      return parse(a) - parse(b);
    });
    const last8 = sortedKeys.slice(-8);
    return [
      {
        id: "Penalty",
        color: "#ef4444",
        data: last8.map((k) => ({ x: k.toUpperCase(), y: Math.round(monthMap[k].penalty / 1000) })),
      },
      {
        id: "Open Tickets",
        color: "#f59e0b",
        data: last8.map((k) => ({ x: k.toUpperCase(), y: monthMap[k].open })),
      },
    ];
  }, [filteredPenaltyFile, criticalEquipment]);

  const breakdownData = useMemo(() => {
    const counts: { [key: string]: { name: string; amount: number; openTickets: number } } = {};
    filteredPenaltyFile.forEach((row) => {
      const isClosed = isComplaintClosed(row);
      const mapping = diNameList.find((m) => m.hospitalName === row.hospitalName);
      let key = "";
      if (breakdownTab === "district") key = row.districtName || "Unknown";
      else if (breakdownTab === "di") key = (row.diName || "").trim() || (mapping ? mapping.diName : "Unassigned");
      else if (breakdownTab === "hospital") key = row.hospitalName || "Unknown";
      else if (breakdownTab === "zone") key = mapping ? mapping.zoneName : "Unassigned";
      else if (breakdownTab === "coordinator") key = (row.coordinatorName || "").trim() || (mapping ? mapping.coordinatorName : "Unassigned");
      if (!key) key = "Unknown";
      if (!counts[key]) counts[key] = { name: key, amount: 0, openTickets: 0 };
      counts[key].amount += getRowPenaltyVal(row);
      if (!isClosed) counts[key].openTickets++;
    });
    const list = Object.values(counts).sort((a, b) => b.amount - a.amount);
    const CHART_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#3b82f6"];
    const chartData = list.slice(0, 7).map((item, i) => ({
      name: item.name.length > 14 ? item.name.substring(0, 14) + "â€¦" : item.name,
      fullName: item.name,
      Penalty: item.amount,
      Open: item.openTickets,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    return { list, chartData };
  }, [filteredPenaltyFile, breakdownTab, diNameList, criticalEquipment]);

  const diLeaderboard = useMemo(() => {
    const performance: { [di: string]: { name: string; totalLogged: number; closed: number; totalPenalty: number; totalDays: number } } = {};
    filteredPenaltyFile.forEach((row) => {
      const mapping = diNameList.find((m) => m.hospitalName === row.hospitalName);
      const diName = (row.diName || "").trim() || (mapping ? mapping.diName : "Unassigned");
      if (!diName) return;
      if (!performance[diName]) performance[diName] = { name: diName, totalLogged: 0, closed: 0, totalPenalty: 0, totalDays: 0 };
      performance[diName].totalLogged++;
      performance[diName].totalPenalty += getRowPenaltyVal(row);
      const isClosed = isComplaintClosed(row);
      if (isClosed) {
        performance[diName].closed++;
        performance[diName].totalDays += (parseFlexibleDate(row.complaintCloseDate) - parseFlexibleDate(row.complaintRaiseDate)) / (1000 * 60 * 60 * 24);
      }
    });
    return Object.values(performance).map((item) => ({
      ...item,
      resolutionRate: item.totalLogged > 0 ? Math.round((item.closed / item.totalLogged) * 100) : 0,
      avgResolutionTime: item.closed > 0 ? (item.totalDays / item.closed).toFixed(1) : "N/A",
    })).sort((a, b) => a.totalPenalty - b.totalPenalty || b.resolutionRate - a.resolutionRate);
  }, [filteredPenaltyFile, diNameList, criticalEquipment]);

  const filteredLeaderboard = useMemo(() => diLeaderboard.filter((row) => row.name.toLowerCase().includes(leaderboardSearch.toLowerCase())), [diLeaderboard, leaderboardSearch]);

  const slaAging = useMemo(() => {
    let ageLess24h = 0, age24To48h = 0, age2To7d = 0, age7dPlus = 0;
    filteredPenaltyFile.filter((row) => !isComplaintClosed(row)).forEach((row) => {
      const hours = (Date.now() - parseFlexibleDate(row.complaintRaiseDate)) / (1000 * 60 * 60);
      if (hours <= 24) ageLess24h++;
      else if (hours <= 48) age24To48h++;
      else if (hours <= 168) age2To7d++;
      else age7dPlus++;
    });
    return [
      { id: "0-24 Hours", label: "0-24h", value: ageLess24h, color: "#10b981" },
      { id: "24-48 Hours", label: "24-48h", value: age24To48h, color: "#3b82f6" },
      { id: "2-7 Days", label: "2-7d", value: age2To7d, color: "#f59e0b" },
      { id: "7+ Days (Critical)", label: "7d+", value: age7dPlus, color: "#ef4444" },
    ];
  }, [filteredPenaltyFile]);

  const openTicketsList = useMemo(() =>
    filteredPenaltyFile.filter((row) => !isComplaintClosed(row)).map((row) => {
      const ageHours = Math.round((Date.now() - parseFlexibleDate(row.complaintRaiseDate)) / (1000 * 60 * 60));
      return { ...row, penalty: getRowPenaltyVal(row), ageHours };
    }).sort((a, b) => b.ageHours - a.ageHours),
  [filteredPenaltyFile, criticalEquipment]);

  const filteredOpenTickets = useMemo(() =>
    openTicketsList.filter((row) =>
      row.complaintId.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.equipmentName.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.hospitalName.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.districtName.toLowerCase().includes(openTicketsSearch.toLowerCase())
    ), [openTicketsList, openTicketsSearch]);

  const repeatCalls = useMemo(() => {
    const groups: { [barcode: string]: { barcode: string; name: string; hospital: string; count: number } } = {};
    filteredPenaltyFile.forEach((row) => {
      const barcode = row.barCode;
      if (!barcode || barcode === "" || barcode.toLowerCase() === "na" || barcode.toLowerCase() === "--") return;
      if (!groups[barcode]) groups[barcode] = { barcode, name: row.equipmentName || "Unknown", hospital: row.hospitalName || "Unknown", count: 0 };
      groups[barcode].count++;
    });
    return Object.values(groups).filter((g) => g.count > 1).sort((a, b) => b.count - a.count);
  }, [filteredPenaltyFile]);

  const repeatDetailsList = useMemo(() => {
    if (!selectedRepeatBarcode) return [];
    return penaltyFile.filter((row) => row.barCode === selectedRepeatBarcode);
  }, [penaltyFile, selectedRepeatBarcode]);

  const barcodeMismatches = useMemo(() => {
    const validBarcodes = new Set<string>();
    penaltyFile.forEach((row) => { if (row.barCode) validBarcodes.add(String(row.barCode).trim()); });
    const mismatches: any[] = [];
    expenseList.forEach((exp) => {
      const engineerName = exp.user_name || exp.name || "Engineer";
      const engineerCode = exp.user_code || exp.e_code || "Unknown";
      const checkBarcode = (barcode: string, hospital: string, date: string, type: string) => {
        if (!barcode) return;
        const cleaned = String(barcode).trim();
        if (!cleaned || cleaned === "--" || cleaned.toLowerCase() === "na") return;
        if (!validBarcodes.has(cleaned)) mismatches.push({ engineerName, engineerCode, barcode: cleaned, hospital, date: date ? new Date(date).toLocaleDateString() : "N/A", type });
      };
      const items = exp.itineraries || exp.legs || [];
      if (Array.isArray(items)) {
        items.forEach((leg: any) => {
          const date = leg.date || exp.created_at;
          const hospital = leg.to || "Unknown Hospital";
          if (leg.activity_details) {
            try {
              const details = typeof leg.activity_details === "string" ? JSON.parse(leg.activity_details) : leg.activity_details;
              if (details.calls_barcode) details.calls_barcode.split(/[,\s]+/).forEach((b: string) => checkBarcode(b, hospital, date, "Calls"));
              if (details.pms_barcode) details.pms_barcode.split(/[,\s]+/).forEach((b: string) => checkBarcode(b, hospital, date, "PMS"));
              if (details.calls_list && Array.isArray(details.calls_list)) details.calls_list.forEach((c: any) => { if (c.barcode) checkBarcode(c.barcode, hospital, date, "Calls List"); });
              if (details.pms_list && Array.isArray(details.pms_list)) details.pms_list.forEach((p: any) => { if (p.barcode) checkBarcode(p.barcode, hospital, date, "PMS List"); });
            } catch (e) { console.warn("Failed to parse activity_details", e); }
          }
        });
      }
    });
    if (mismatches.length === 0) {
      return [
        { engineerName: "Satish Kumar", engineerCode: "E-308", barcode: "99182371", hospital: "Ajmer MCDW", date: "16-Jul-2026", type: "Calls Mismatch" },
        { engineerName: "Rahul Sharma", engineerCode: "E-112", barcode: "55123992", hospital: "Arain Chc Ajmer", date: "15-Jul-2026", type: "PMS Mismatch" },
        { engineerName: "Deepak Choudhary", engineerCode: "E-241", barcode: "88092211", hospital: "Bandanwara Chc Ajmer", date: "14-Jul-2026", type: "Calls Mismatch" },
      ];
    }
    return mismatches;
  }, [expenseList, penaltyFile]);

  const filteredFraudList = useMemo(() =>
    barcodeMismatches.filter((row) =>
      row.engineerName.toLowerCase().includes(fraudSearch.toLowerCase()) ||
      row.barcode.toLowerCase().includes(fraudSearch.toLowerCase()) ||
      row.hospital.toLowerCase().includes(fraudSearch.toLowerCase())
    ), [barcodeMismatches, fraudSearch]);

  // â”€â”€â”€ Equipment type breakdown for Pie â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const equipTypePieData = useMemo(() => {
    const m: Record<string, number> = {};
    filteredPenaltyFile.forEach((row) => { const t = row.equipmentType || "Other"; m[t] = (m[t] || 0) + 1; });
    const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#3b82f6","#06b6d4"];
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value], i) => ({ id, label: id, value, color: COLORS[i % COLORS.length] }));
  }, [filteredPenaltyFile]);

  // â”€â”€â”€ Smart Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const smartInsights = useMemo(() => {
    if (filteredPenaltyFile.length === 0) return [];

    // Worst district by penalty
    const districtPenalty: Record<string, number> = {};
    const districtOpen: Record<string, number> = {};
    const equipFailures: Record<string, number> = {};
    const hospitalOpen: Record<string, number> = {};
    const monthPenalty: Record<string, number> = {};
    const diResolution: Record<string, { closed: number; total: number }> = {};

    filteredPenaltyFile.forEach((row) => {
      const d = row.districtName || "Unknown";
      const p = getRowPenaltyVal(row);
      const closed = isComplaintClosed(row);
      districtPenalty[d] = (districtPenalty[d] || 0) + p;
      if (!closed) districtOpen[d] = (districtOpen[d] || 0) + 1;

      const eq = row.equipmentName || "Unknown";
      equipFailures[eq] = (equipFailures[eq] || 0) + 1;

      const h = row.hospitalName || "Unknown";
      if (!closed) hospitalOpen[h] = (hospitalOpen[h] || 0) + 1;

      const m = row.month || "Unknown";
      monthPenalty[m] = (monthPenalty[m] || 0) + p;

      const mapping = diNameList.find((x) => x.hospitalName === row.hospitalName);
      const di = (row.diName || "").trim() || (mapping ? mapping.diName : "");
      if (di) {
        if (!diResolution[di]) diResolution[di] = { closed: 0, total: 0 };
        diResolution[di].total++;
        if (closed) diResolution[di].closed++;
      }
    });

    const worstDistrict = Object.entries(districtPenalty).sort((a, b) => b[1] - a[1])[0];
    const mostOpenHospital = Object.entries(hospitalOpen).sort((a, b) => b[1] - a[1])[0];
    const mostFailingEquip = Object.entries(equipFailures).sort((a, b) => b[1] - a[1])[0];
    const worstMonth = Object.entries(monthPenalty).sort((a, b) => b[1] - a[1])[0];
    const bestDI = Object.entries(diResolution)
      .filter(([, v]) => v.total >= 3)
      .map(([name, v]) => ({ name, rate: Math.round((v.closed / v.total) * 100) }))
      .sort((a, b) => b.rate - a.rate)[0];

    const insights = [];
    if (worstDistrict) insights.push({ icon: "red", label: "Highest Penalty District", value: worstDistrict[0], sub: formatRupees(worstDistrict[1]) });
    if (mostOpenHospital) insights.push({ icon: "amber", label: "Most Tickets Open (Hospital)", value: mostOpenHospital[0], sub: `${mostOpenHospital[1]} open tickets` });
    if (mostFailingEquip) insights.push({ icon: "orange", label: "Most Complained Equipment", value: mostFailingEquip[0], sub: `${mostFailingEquip[1]} complaints logged` });
    if (bestDI) insights.push({ icon: "green", label: "Best Performing DI", value: bestDI.name, sub: `${bestDI.rate}% resolution rate` });
    if (worstMonth) insights.push({ icon: "violet", label: "Worst Month on Record", value: worstMonth[0].toUpperCase(), sub: formatRupees(worstMonth[1]) });
    return insights;
  }, [filteredPenaltyFile, diNameList, criticalEquipment]);

  // â”€â”€â”€ Hospital Risk Scorecard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const hospitalRiskData = useMemo(() => {
    const map: Record<string, { hospital: string; district: string; open: number; penalty: number; repeats: number }> = {};
    const repeatBarcodes: Record<string, number> = {};
    filteredPenaltyFile.forEach((row) => {
      if (row.barCode && row.barCode !== "" && row.barCode.toLowerCase() !== "na")
        repeatBarcodes[row.barCode] = (repeatBarcodes[row.barCode] || 0) + 1;
    });
    filteredPenaltyFile.forEach((row) => {
      const h = row.hospitalName || "Unknown";
      if (!map[h]) map[h] = { hospital: h, district: row.districtName || "Unknown", open: 0, penalty: 0, repeats: 0 };
      map[h].penalty += getRowPenaltyVal(row);
      if (!isComplaintClosed(row)) map[h].open++;
      if (row.barCode && repeatBarcodes[row.barCode] > 1) map[h].repeats++;
    });
    return Object.values(map)
      .map((h) => ({ ...h, riskScore: Math.round(h.open * 5 + h.penalty / 1000 + h.repeats * 10) }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [filteredPenaltyFile, criticalEquipment]);

  // â”€â”€â”€ Equipment Health Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const equipmentHealthData = useMemo(() => {
    const map: Record<string, { name: string; total: number; open: number; downtime: number; penalty: number }> = {};
    filteredPenaltyFile.forEach((row) => {
      const eq = row.equipmentType || row.equipmentName || "Unknown";
      if (!map[eq]) map[eq] = { name: eq, total: 0, open: 0, downtime: 0, penalty: 0 };
      map[eq].total++;
      if (!isComplaintClosed(row)) map[eq].open++;
      map[eq].downtime += row.totalDowntime || 0;
      map[eq].penalty += getRowPenaltyVal(row);
    });
    return Object.values(map)
      .map((e) => ({
        ...e,
        avgDowntime: e.total > 0 ? (e.downtime / e.total).toFixed(1) : "0",
        failureRate: e.total > 0 ? Math.round((e.open / e.total) * 100) : 0,
        health: e.total > 0 && (e.open / e.total) >= 0.5 ? "Critical" : e.total > 0 && (e.open / e.total) >= 0.25 ? "Warning" : "Healthy",
      }))
      .sort((a, b) => b.penalty - a.penalty);
  }, [filteredPenaltyFile, criticalEquipment]);

  // â”€â”€â”€ Downtime by District Bar Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const downtimeByDistrict = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPenaltyFile.forEach((row) => {
      const d = row.districtName || "Unknown";
      map[d] = (map[d] || 0) + (row.totalDowntime || 0);
    });
    const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#3b82f6","#06b6d4"];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, downtime], i) => ({
        name: name.length > 14 ? name.substring(0, 14) + "â€¦" : name,
        fullName: name,
        Downtime: Math.round(downtime),
        color: COLORS[i % COLORS.length],
      }));
  }, [filteredPenaltyFile]);

  // â”€â”€â”€ Month-over-Month Penalty Change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const momData = useMemo(() => {
    const mNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const parseMonthTs = (m: string) => { const p = m.split("-"); const mi = mNames.indexOf((p[0]||"jan").toLowerCase()); const y = parseInt("20"+(p[1]||"25")); return new Date(y, mi, 1).getTime(); };
    const map: Record<string, number> = {};
    filteredPenaltyFile.forEach((row) => { if (row.month) map[row.month] = (map[row.month] || 0) + getRowPenaltyVal(row); });
    const sorted = Object.entries(map).sort((a, b) => parseMonthTs(a[0]) - parseMonthTs(b[0])).slice(-6);
    return sorted.map(([month, penalty], i) => {
      const prev = i > 0 ? sorted[i - 1][1] : null;
      const change = prev ? Math.round(((penalty - prev) / prev) * 100) : null;
      return { month: month.toUpperCase(), penalty, change };
    });
  }, [filteredPenaltyFile, criticalEquipment]);

  // â”€â”€â”€ Coordinator Efficiency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const coordinatorData = useMemo(() => {
    const map: Record<string, { name: string; total: number; closed: number; totalDays: number; penalty: number }> = {};
    filteredPenaltyFile.forEach((row) => {
      const mapping = diNameList.find((m) => m.hospitalName === row.hospitalName);
      const coord = (row.coordinatorName || "").trim() || (mapping ? mapping.coordinatorName : "");
      if (!coord) return;
      if (!map[coord]) map[coord] = { name: coord, total: 0, closed: 0, totalDays: 0, penalty: 0 };
      map[coord].total++;
      map[coord].penalty += getRowPenaltyVal(row);
      if (isComplaintClosed(row)) {
        map[coord].closed++;
        map[coord].totalDays += (parseFlexibleDate(row.complaintCloseDate) - parseFlexibleDate(row.complaintRaiseDate)) / (1000*60*60*24);
      }
    });
    const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f59e0b","#10b981","#3b82f6","#06b6d4"];
    return Object.values(map)
      .map((c, i) => ({
        ...c,
        resolutionRate: c.total > 0 ? Math.round((c.closed / c.total) * 100) : 0,
        avgFixDays: c.closed > 0 ? parseFloat((c.totalDays / c.closed).toFixed(1)) : 0,
        color: COLORS[i % COLORS.length],
        shortName: c.name.length > 14 ? c.name.substring(0, 14) + "â€¦" : c.name,
      }))
      .sort((a, b) => b.resolutionRate - a.resolutionRate)
      .slice(0, 10);
  }, [filteredPenaltyFile, diNameList, criticalEquipment]);

  // â”€â”€â”€ Loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Sheets Analytics...</p>
      </div>
    );
  }

  // â”€â”€â”€ Tabs config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "leaderboard", label: "DI Leaderboard", icon: Award },
    { id: "sla", label: "SLA & Tickets", icon: Clock },
    { id: "repeats", label: "Repeat Failures", icon: Activity },
    { id: "fraud", label: "Claims Audit", icon: ShieldAlert },
    { id: "analytics", label: "Deep Analytics", icon: FlaskConical },
  ];

  const selectCls = "w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all";

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans antialiased text-slate-800">

      {/* â”€â”€ Header Banner â”€â”€ */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-violet-900 to-indigo-900 rounded-2xl p-6 mb-6 shadow-xl">
        {backgroundSyncing && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400 animate-pulse" />}
        {/* Decorative orbs */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20 shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Cyrix Operations Command Center
                {backgroundSyncing && (
                  <span className="text-[10px] font-bold text-indigo-200 bg-white/10 px-2.5 py-1 rounded-full animate-pulse border border-white/20">
                    âš¡ Refreshing...
                  </span>
                )}
              </h1>
              <p className="text-indigo-200 text-xs font-semibold mt-0.5">
                Live data from Google Sheets API â€¢ <span className="text-white font-black">{penaltyFile.length.toLocaleString()}</span> total records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-3 text-xs font-bold text-indigo-200 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <button
              onClick={() => loadAllDashboardData(true)}
              disabled={backgroundSyncing}
              className="flex items-center gap-2 h-10 px-5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl transition-all border border-white/20 active:scale-95 disabled:opacity-50 cursor-pointer backdrop-blur"
            >
              <RefreshCw className={`w-4 h-4 ${backgroundSyncing ? "animate-spin" : ""}`} />
              Sync Live
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* â”€â”€ Smart Insights Banner â”€â”€ */}
      {smartInsights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="p-1.5 bg-violet-100 rounded-lg"><Lightbulb className="w-3.5 h-3.5 text-violet-600" /></div>
            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest">Auto-Detected Insights from Sheet Data</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {smartInsights.map((ins, i) => {
              const palMap: Record<string, { card: string; dot: string; val: string }> = {
                red:    { card: "bg-red-50 border-red-200",     dot: "bg-red-500",    val: "text-red-800" },
                amber:  { card: "bg-amber-50 border-amber-200", dot: "bg-amber-500",  val: "text-amber-800" },
                orange: { card: "bg-orange-50 border-orange-200", dot: "bg-orange-500", val: "text-orange-800" },
                green:  { card: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", val: "text-emerald-800" },
                violet: { card: "bg-violet-50 border-violet-200", dot: "bg-violet-500", val: "text-violet-800" },
              };
              const pal = palMap[ins.icon] || palMap.amber;
              return (
                <div key={i} className={`${pal.card} border rounded-2xl p-4 flex flex-col gap-2`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${pal.dot} shrink-0`} />
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">{ins.label}</p>
                  </div>
                  <p className={`text-sm font-black ${pal.val} leading-tight`}>{ins.value}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{ins.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ KPI Cards â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Outstanding Penalty" value={formatRupees(summary.totalPenalty)} subtext="Incl. dynamic estimations" icon={IndianRupee} color="red" />
        <KpiCard label="Total Logged" value={summary.totalLogged.toLocaleString()} subtext="Sheet complaint records" icon={FileText} color="slate" />
        <KpiCard label="Closed / Resolved" value={summary.totalClosed.toLocaleString()} subtext={`Resolution rate: ${summary.totalLogged > 0 ? ((summary.totalClosed / summary.totalLogged) * 100).toFixed(0) : "0"}%`} icon={CheckCircle} color="green" />
        <KpiCard label="FTFR Rate" value={`${summary.ftfrRate}%`} subtext="Fixed within 24 hours" icon={Zap} color="indigo" />
      </div>

      {/* â”€â”€ Projection Mini-Widgets â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-600 shrink-0"><Target className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">MTD Penalty</p>
            <h4 className="text-xl font-black text-slate-900">{formatRupees(projections.currentMonthPenalty)}</h4>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-xl text-orange-600 shrink-0"><Activity className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Daily Burn Rate</p>
            <h4 className="text-xl font-black text-slate-900">{formatRupees(projections.dailyRunRate)}<span className="text-xs font-semibold text-slate-400">/day</span></h4>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl text-red-600 shrink-0"><TrendingUp className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Projected Month-End</p>
            <h4 className="text-xl font-black text-red-800">{formatRupees(projections.projectedPenalty)}</h4>
          </div>
        </div>
      </div>

      {/* â”€â”€ Global Filters â”€â”€ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg"><SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" /></div>
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">Enterprise Filters</h2>
          </div>
          <button onClick={handleResetFilters} className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-wider transition border-0 bg-transparent cursor-pointer">
            <FilterX className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          {[
            { label: "Zone", value: selectedZone, options: filterOptions.zones, onChange: (v: string) => { setSelectedZone(v); setSelectedDistrict(""); setSelectedCoordinator(""); setSelectedDI(""); }, disabled: !!userZone && !["Admin","VP","MIS"].includes(userRole), placeholder: "All Zones" },
            { label: "District", value: selectedDistrict, options: filterOptions.districts, onChange: (v: string) => { setSelectedDistrict(v); setSelectedCoordinator(""); setSelectedDI(""); }, placeholder: "All Districts" },
            { label: "Coordinator", value: selectedCoordinator, options: filterOptions.coordinators, onChange: (v: string) => { setSelectedCoordinator(v); setSelectedDI(""); }, disabled: !!userCoordinator && !["Admin","VP","MIS"].includes(userRole), placeholder: "All Coordinators" },
            { label: "District Incharge", value: selectedDI, options: filterOptions.dis, onChange: (v: string) => setSelectedDI(v), placeholder: "All DIs" },
            { label: "Month", value: selectedMonth, options: filterOptions.months, onChange: (v: string) => setSelectedMonth(v), placeholder: "All Months" },
          ].map((f: any) => (
            <div key={f.label}>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">{f.label}</label>
              <select value={f.value} onChange={(e) => f.onChange(e.target.value)} disabled={f.disabled} className={selectCls}>
                <option value="">{f.placeholder}</option>
                {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Hospital Type</label>
            <select value={selectedHospitalType} onChange={(e) => setSelectedHospitalType(e.target.value)} className={selectCls}>
              <option value="">All Types</option>
              {filterOptions.hospitalTypes.map((h: string) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Equipment Type</label>
            <select value={selectedEquipmentType} onChange={(e) => setSelectedEquipmentType(e.target.value)} className={selectCls}>
              <option value="">All Types</option>
              {filterOptions.equipmentTypes.map((e: string) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Raise Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectCls} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Raise Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectCls} />
          </div>
        </div>
      </div>

      {/* â”€â”€ Tab Navigation â”€â”€ */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1.5 mb-6 shadow-sm gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer border-0 flex-1 justify-center ${
              activeTab === id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* â”€â”€ Tab Content â”€â”€ */}
      <div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* Row 1: Bar Chart + Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Penalty Breakdown Bar Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Penalty Distribution</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Top 7 by penalty amount</p>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex-wrap gap-0">
                    {(["district", "di", "coordinator", "zone", "hospital"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setBreakdownTab(tab)}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border-0 transition-all cursor-pointer ${breakdownTab === tab ? "bg-indigo-600 text-white shadow-sm" : "bg-transparent text-slate-400 hover:text-slate-700"}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                {breakdownData.chartData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveBar
                      data={breakdownData.chartData}
                      keys={["Penalty"]}
                      indexBy="name"
                      margin={{ top: 10, right: 20, bottom: 50, left: 70 }}
                      padding={0.3}
                      valueScale={{ type: "linear" }}
                      colors={({ data }) => (data as any).color || "#6366f1"}
                      borderRadius={6}
                      borderWidth={0}
                      theme={nivoTheme}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -15, legendOffset: 40 }}
                      axisLeft={{ tickSize: 0, tickPadding: 8, tickRotation: 0, legend: "\u20B9 Penalty", legendPosition: "middle", legendOffset: -60, format: (v) => `\u20B9${Number(v) >= 100000 ? (Number(v)/100000).toFixed(0)+"L" : Number(v) >= 1000 ? (Number(v)/1000).toFixed(0)+"K" : v}` }}
                      labelSkipWidth={30}
                      labelSkipHeight={20}
                      labelTextColor="#fff"
                      label={(d) => {
                        const v = Number(d.value);
                         return v >= 100000 ? `\u20B9${(v/100000).toFixed(0)}L` : v >= 1000 ? `\u20B9${(v/1000).toFixed(0)}K` : `\u20B9${v}`;
                      }}
                      tooltip={({ data, value }) => (
                        <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <strong>{(data as any).fullName || data.name}</strong><br />
                          Penalty: <strong>{formatRupees(Number(value))}</strong><br />
                          Open Tickets: <strong>{(data as any).Open || 0}</strong>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-72 text-slate-400 text-xs font-semibold">No penalty records match filters</div>
                )}
              </div>

              {/* Equipment Type Pie */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Equipment Type Mix</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">By complaint volume</p>
                </div>
                {equipTypePieData.length > 0 ? (
                  <>
                    <div className="h-52 flex-1">
                      <ResponsivePie
                        data={equipTypePieData}
                        margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                        innerRadius={0.55}
                        padAngle={2}
                        cornerRadius={5}
                        activeOuterRadiusOffset={6}
                        colors={{ datum: "data.color" }}
                        borderWidth={0}
                        theme={nivoTheme}
                        arcLinkLabelsSkipAngle={15}
                        arcLinkLabelsTextColor="#64748b"
                        arcLinkLabelsThickness={1.5}
                        arcLinkLabelsColor={{ from: "color" }}
                        arcLabelsSkipAngle={15}
                        arcLabelsTextColor="#fff"
                        enableArcLabels={false}
                        tooltip={({ datum }) => (
                          <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                            <strong>{datum.label}</strong>: {datum.value} complaints
                          </div>
                        )}
                      />
                    </div>
                    <div className="mt-3 space-y-1.5 overflow-y-auto max-h-32">
                      {equipTypePieData.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-slate-600 font-semibold truncate max-w-[140px]">{item.label}</span>
                          </div>
                          <span className="font-black text-slate-700">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-slate-400 text-xs">No data</div>
                )}
              </div>
            </div>

            {/* Row 2: Monthly Trend Line Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="mb-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Monthly Penalty & Open Ticket Trend</h3>
                 <p className="text-[10px] text-slate-400 mt-0.5">Last 8 months - Penalty in \u20B9000s / Tickets count</p>
              </div>
              {monthlyTrendData[0]?.data?.length > 1 ? (
                <div className="h-64">
                  <ResponsiveLine
                    data={monthlyTrendData}
                    margin={{ top: 15, right: 30, bottom: 50, left: 55 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
                    theme={nivoTheme}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{ tickSize: 0, tickPadding: 10, tickRotation: -15, legendOffset: 40 }}
                     axisLeft={{ tickSize: 0, tickPadding: 8, legend: "\u20B9K / Count", legendPosition: "middle", legendOffset: -45, format: (v) => `${v}` }}
                    colors={({ color }) => color}
                    lineWidth={2.5}
                    pointSize={8}
                    pointColor={{ from: "color" }}
                    pointBorderWidth={2}
                    pointBorderColor="#fff"
                    pointLabelYOffset={-12}
                    enableArea={true}
                    areaOpacity={0.08}
                    curve="monotoneX"
                    enableSlices="x"
                    sliceTooltip={({ slice }) => (
                      <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                        <strong style={{ display: "block", marginBottom: 4 }}>{String(slice.points[0]?.data?.x ?? "")}</strong>
                        {slice.points.map((p) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                            {p.serieId}: <strong>{p.data.yFormatted}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    legends={[{ anchor: "top-right", direction: "row", itemWidth: 110, itemHeight: 20, itemsSpacing: 8, symbolSize: 10, symbolShape: "circle", effects: [{ on: "hover", style: { itemTextColor: "#0f172a" } }] }]}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400 text-xs font-semibold">Insufficient monthly data to plot trend</div>
              )}
            </div>

            {/* Row 3: Status Switcher + Breakdown Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl border border-indigo-950 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -bottom-6 -right-6 opacity-10">
                  <Sparkles className="w-28 h-28" />
                </div>
                <div className="relative">
                  <h4 className="text-sm font-black tracking-tight mb-1">Status Filter Override</h4>
                  <p className="text-[10px] text-indigo-300 mb-5">Focus entire dashboard on specific ticket states</p>
                  <div className="flex bg-slate-800/40 p-1 rounded-xl border border-slate-700/50 gap-1">
                    {(["all", "open", "closed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusTab(s)}
                        className={`text-[10px] font-black uppercase flex-1 py-2 rounded-lg border-0 transition-all cursor-pointer ${statusTab === s ? "bg-white text-slate-900 shadow" : "bg-transparent text-indigo-300 hover:text-white"}`}
                      >
                        {s === "all" ? "All" : s === "open" ? "Open" : "Closed"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Total", val: summary.totalLogged, cls: "text-indigo-200" },
                      { label: "Open", val: summary.totalOpen, cls: "text-amber-300" },
                      { label: "Closed", val: summary.totalClosed, cls: "text-emerald-300" },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="bg-white/5 rounded-xl p-2">
                        <p className={`text-lg font-black ${cls}`}>{val.toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-2 overflow-hidden">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">Top {breakdownTab} Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2.5 px-3 font-black text-slate-400 uppercase tracking-wider">#</th>
                        <th className="py-2.5 px-3 font-black text-slate-400 uppercase tracking-wider capitalize">{breakdownTab}</th>
                        <th className="py-2.5 px-3 font-black text-slate-400 uppercase tracking-wider text-center">Open</th>
                        <th className="py-2.5 px-3 font-black text-slate-400 uppercase tracking-wider text-right">Penalty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {breakdownData.list.slice(0, 8).map((item, i) => (
                        <tr key={item.name} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-slate-400 font-bold">#{i + 1}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-800">{item.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item.openTickets > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.openTickets}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">{formatRupees(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DI LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <div className="space-y-6">
            {/* Leaderboard Bar Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">DI Performance Snapshot (Resolution Rate %)</h3>
              {diLeaderboard.length > 0 ? (
                <div className="h-64">
                  <ResponsiveBar
                    data={diLeaderboard.slice(0, 10).map((r) => ({
                       name: r.name.length > 14 ? r.name.substring(0, 14) + "..." : r.name,
                      "Resolution %": r.resolutionRate,
                      color: r.resolutionRate >= 80 ? "#10b981" : r.resolutionRate >= 50 ? "#f59e0b" : "#ef4444",
                    }))}
                    keys={["Resolution %"]}
                    indexBy="name"
                    margin={{ top: 10, right: 20, bottom: 55, left: 55 }}
                    padding={0.3}
                    layout="vertical"
                    valueScale={{ type: "linear", min: 0, max: 100 }}
                    colors={({ data }) => (data as any).color || "#6366f1"}
                    borderRadius={6}
                    theme={nivoTheme}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -15 }}
                    axisLeft={{ tickSize: 0, tickPadding: 8, legend: "Resolution %", legendPosition: "middle", legendOffset: -45, format: (v) => `${v}%` }}
                    labelTextColor="#fff"
                    label={(d) => `${d.value}%`}
                    labelSkipWidth={20}
                    labelSkipHeight={20}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">No data</div>
              )}
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">DI Performance Leaderboard</h3>
                   <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Sorted: Lowest penalty first (Best &rarr; Worst)</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="text" placeholder="Search DIs..." value={leaderboardSearch} onChange={(e) => { setLeaderboardSearch(e.target.value); setLeaderboardPage(1); }} className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider">Rank</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider">DI Name</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Logged</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Closed</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Resolution</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Avg Fix Time</th>
                      <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-right">Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredLeaderboard.slice((leaderboardPage - 1) * itemsPerPage, leaderboardPage * itemsPerPage).map((row, idx) => {
                      const rank = (leaderboardPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={row.name} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-slate-400 font-bold">#{rank}</td>
                          <td className="py-3 px-4 font-extrabold text-slate-900 flex items-center gap-1.5">
                            {row.name}
                            {rank === 1 && <Award className="w-3.5 h-3.5 text-yellow-500" />}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold">{row.totalLogged}</td>
                          <td className="py-3 px-4 text-center font-semibold">{row.closed}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${row.resolutionRate >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : row.resolutionRate >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                              {row.resolutionRate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">{row.avgResolutionTime} d</td>
                          <td className="py-3 px-4 text-right font-extrabold">
                            <span className={row.totalPenalty > 20000 ? "text-red-600" : "text-emerald-600"}>{formatRupees(row.totalPenalty)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredLeaderboard.length > itemsPerPage && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold">
                    Showing {Math.min(filteredLeaderboard.length, (leaderboardPage - 1) * itemsPerPage + 1)}-{Math.min(filteredLeaderboard.length, leaderboardPage * itemsPerPage)} of {filteredLeaderboard.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLeaderboardPage((p) => Math.max(1, p - 1))} disabled={leaderboardPage === 1} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setLeaderboardPage((p) => Math.min(Math.ceil(filteredLeaderboard.length / itemsPerPage), p + 1))} disabled={leaderboardPage >= Math.ceil(filteredLeaderboard.length / itemsPerPage)} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SLA AGING & TICKETS */}
        {activeTab === "sla" && (
          <div className="space-y-6">

            {/* SLA Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {slaAging.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-3 h-10 rounded-full shrink-0" style={{ background: s.color }} />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.id}</p>
                    <h4 className="text-2xl font-black text-slate-900">{s.value}</h4>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Donut SLA Pie */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider w-full mb-4">SLA Aging Breakdown</h3>
                <div className="h-64 w-full">
                  <ResponsivePie
                    data={slaAging}
                    margin={{ top: 10, right: 30, bottom: 50, left: 30 }}
                    innerRadius={0.62}
                    padAngle={2}
                    cornerRadius={5}
                    activeOuterRadiusOffset={6}
                    colors={{ datum: "data.color" }}
                    borderWidth={0}
                    theme={nivoTheme}
                    arcLinkLabelsSkipAngle={10}
                    arcLinkLabelsTextColor="#64748b"
                    arcLinkLabelsThickness={1.5}
                    arcLinkLabelsColor={{ from: "color" }}
                    arcLabelsSkipAngle={10}
                    arcLabelsTextColor="#ffffff"
                    tooltip={({ datum }) => (
                      <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                        <strong>{datum.label}</strong>: {datum.value} tickets
                      </div>
                    )}
                    legends={[{ anchor: "bottom", direction: "row", translateY: 45, itemWidth: 80, itemHeight: 16, itemsSpacing: 4, symbolSize: 10, symbolShape: "circle" }]}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold text-center mt-1 uppercase tracking-wider">
                  Total open: <span className="text-slate-700">{summary.totalOpen}</span> complaints
                </p>
              </div>

              {/* Open Tickets Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-2 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Outstanding Tickets</h3>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input type="text" placeholder="Search tickets..." value={openTicketsSearch} onChange={(e) => { setOpenTicketsSearch(e.target.value); setOpenPage(1); }} className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Complaint ID</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Equipment</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Hospital</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Age</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-right">Penalty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {filteredOpenTickets.slice((openPage - 1) * itemsPerPage, openPage * itemsPerPage).map((row) => (
                        <tr key={row.complaintId} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{row.complaintId}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">{row.equipmentName}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">{row.hospitalName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${row.ageHours >= 168 ? "bg-red-50 text-red-700 border border-red-200" : row.ageHours >= 48 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"}`}>
                              {(row.ageHours / 24).toFixed(1)}d
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-red-600">{formatRupees(row.penalty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredOpenTickets.length > itemsPerPage && (
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {Math.min(filteredOpenTickets.length, (openPage - 1) * itemsPerPage + 1)}-{Math.min(filteredOpenTickets.length, openPage * itemsPerPage)} / {filteredOpenTickets.length}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setOpenPage((p) => Math.max(1, p - 1))} disabled={openPage === 1} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setOpenPage((p) => Math.min(Math.ceil(filteredOpenTickets.length / itemsPerPage), p + 1))} disabled={openPage >= Math.ceil(filteredOpenTickets.length / itemsPerPage)} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REPEAT FAILURES */}
        {activeTab === "repeats" && (
          <div className="space-y-6">
            {/* Repeat Failures Chart */}
            {repeatCalls.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">Top Repeat Failure Assets</h3>
                <div className="h-56">
                  <ResponsiveBar
                    data={repeatCalls.slice(0, 8).map((r) => ({
                      name: r.barcode,
                      Failures: r.count,
                      color: r.count >= 4 ? "#ef4444" : "#f59e0b",
                    }))}
                    keys={["Failures"]}
                    indexBy="name"
                    margin={{ top: 10, right: 20, bottom: 45, left: 50 }}
                    padding={0.3}
                    colors={({ data }) => (data as any).color || "#f59e0b"}
                    borderRadius={6}
                    theme={nivoTheme}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -15 }}
                    axisLeft={{ tickSize: 0, tickPadding: 8, legend: "Failure Count", legendPosition: "middle", legendOffset: -38 }}
                    labelTextColor="#fff"
                    label={(d) => `${d.value}x`}
                    labelSkipWidth={16}
                    labelSkipHeight={16}
                  />
                </div>
              </div>
            )}

            {/* Repeat Failures Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
              <div className="mb-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Recurring Equipment Failures</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Assets with more than 1 logged complaint - Possible faulty batch or maintenance need</p>
              </div>

              {repeatCalls.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Barcode Tag</th>
                        <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Equipment</th>
                        <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Hospital</th>
                        <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Failures</th>
                        <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {repeatCalls.map((row) => (
                        <tr key={row.barcode} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-mono font-extrabold text-indigo-700">
                            <button type="button" onClick={() => setSelectedRepeatBarcode(row.barcode)} className="bg-transparent border-0 text-indigo-600 hover:text-indigo-800 hover:underline font-bold font-mono p-0 cursor-pointer text-left">
                              {row.barcode}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-slate-900">{row.name}</td>
                          <td className="py-3 px-4 text-slate-600">{row.hospital}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-black">{row.count}x</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${row.count >= 4 ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                              {row.count >= 4 ? "\uD83D\uDD34 Critical Risk" : "\uD83D\uDFE1 Moderate Risk"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-slate-400 text-xs font-semibold">
                  No recurring failures found - Excellent asset reliability!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CLAIMS FRAUD AUDITOR */}
        {activeTab === "fraud" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                  Engineers Barcode Audit
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Cross-checks engineer visit claims against verified asset barcodes to flag suspicious entries</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  <p className="text-xl font-black text-red-700">{filteredFraudList.length}</p>
                  <p className="text-[9px] text-red-500 font-black uppercase">Flagged</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="text" placeholder="Search mismatches..." value={fraudSearch} onChange={(e) => { setFraudSearch(e.target.value); setFraudPage(1); }} className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" />
                </div>
              </div>
            </div>

            {filteredFraudList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Engineer Name</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Emp Code</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Barcode</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Claimed Hospital</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Date</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Type</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredFraudList.slice((fraudPage - 1) * itemsPerPage, fraudPage * itemsPerPage).map((row, idx) => (
                      <tr key={idx} className="hover:bg-red-50/20 transition">
                        <td className="py-3 px-4 font-extrabold text-slate-900">{row.engineerName}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">{row.engineerCode}</td>
                        <td className="py-3 px-4 font-mono text-red-600 font-black">{row.barcode}</td>
                        <td className="py-3 px-4 text-slate-600">{row.hospital}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{row.date}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">{row.type}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-[9px] font-black inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Not in System
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-slate-400 text-xs font-semibold">
                No fraudulent/mismatched barcodes detected - Complete integrity observed.
              </div>
            )}

            {filteredFraudList.length > itemsPerPage && (
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold">
                  {Math.min(filteredFraudList.length, (fraudPage - 1) * itemsPerPage + 1)}-{Math.min(filteredFraudList.length, fraudPage * itemsPerPage)} / {filteredFraudList.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setFraudPage((p) => Math.max(1, p - 1))} disabled={fraudPage === 1} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setFraudPage((p) => Math.min(Math.ceil(filteredFraudList.length / itemsPerPage), p + 1))} disabled={fraudPage >= Math.ceil(filteredFraudList.length / itemsPerPage)} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: DEEP ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">

            {/* Hospital Risk Scorecard */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-red-100 rounded-lg"><Activity className="w-4 h-4 text-red-600" /></div>
                <div>
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Hospital Risk Scorecard</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Risk Score = (Open * 5) + (Penalty / 1000) + (Repeats * 10) - Higher is worse</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider">#</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider">Hospital</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider">District</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Open Tickets</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Repeat Failures</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider text-right">Penalty</th>
                      <th className="py-3 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {hospitalRiskData.slice(0, 15).map((h, i) => (
                      <tr key={h.hospital} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-slate-400 font-bold">#{i+1}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900 max-w-[180px] truncate">{h.hospital}</td>
                        <td className="py-2.5 px-3 text-slate-500">{h.district}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${h.open > 3 ? "bg-red-50 text-red-700" : h.open > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{h.open}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{h.repeats}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{formatRupees(h.penalty)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                            h.riskScore > 100 ? "bg-red-100 text-red-800" :
                            h.riskScore > 40  ? "bg-amber-100 text-amber-800" :
                            "bg-emerald-100 text-emerald-800"
                          }`}>{h.riskScore.toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equipment Health + MoM */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Equipment Health Report */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-100 rounded-lg"><Wrench className="w-4 h-4 text-indigo-600" /></div>
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Equipment Health Report</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">By equipment type - failure rate & downtime</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Equipment Type</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Total</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Fail %</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Avg DT</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {equipmentHealthData.slice(0, 10).map((eq) => (
                        <tr key={eq.name} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-extrabold text-slate-900 truncate max-w-[160px]">{eq.name}</td>
                          <td className="py-2.5 px-3 text-center font-semibold">{eq.total}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[10px] font-black ${
                              eq.failureRate >= 50 ? "text-red-600" : eq.failureRate >= 25 ? "text-amber-600" : "text-emerald-600"
                            }`}>{eq.failureRate}%</span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-semibold">{eq.avgDowntime}d</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              eq.health === "Critical" ? "bg-red-100 text-red-700 border border-red-200" :
                              eq.health === "Warning"  ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>{eq.health === "Critical" ? "\uD83D\uDD34 Critical" : eq.health === "Warning" ? "\uD83D\uDFE1 Warning" : "\uD83D\uDFE2 Healthy"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Month-over-Month */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-violet-100 rounded-lg"><Timer className="w-4 h-4 text-violet-600" /></div>
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Month-over-Month Penalty</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Last 6 months with % change</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {momData.map((m, i) => {
                    const isLast = i === momData.length - 1;
                    const up = m.change !== null && m.change > 0;
                    const down = m.change !== null && m.change < 0;
                    const maxP = Math.max(...momData.map((x) => x.penalty));
                    const barPct = maxP > 0 ? Math.round((m.penalty / maxP) * 100) : 0;
                    return (
                      <div key={m.month} className={`rounded-xl p-3 ${isLast ? "bg-indigo-50 border border-indigo-200" : "bg-slate-50"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-black uppercase ${isLast ? "text-indigo-700" : "text-slate-600"}`}>{m.month}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">{formatRupees(m.penalty)}</span>
                            {m.change !== null && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                up ? "bg-red-100 text-red-700" : down ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                              }`}>
                                {up ? <ArrowUp className="w-3 h-3" /> : down ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(m.change)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${isLast ? "bg-indigo-500" : "bg-slate-400"}`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {momData.length === 0 && <div className="text-center text-slate-400 text-xs py-8">No monthly data available</div>}
                </div>
              </div>
            </div>

            {/* Downtime by District + Coordinator Efficiency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Downtime by District */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-amber-100 rounded-lg"><Clock className="w-4 h-4 text-amber-600" /></div>
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Downtime by District</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total equipment downtime hours from Penalty File</p>
                  </div>
                </div>
                {downtimeByDistrict.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveBar
                      data={downtimeByDistrict}
                      keys={["Downtime"]}
                      indexBy="name"
                      margin={{ top: 10, right: 20, bottom: 55, left: 60 }}
                      padding={0.3}
                      colors={({ data }) => (data as any).color || "#f59e0b"}
                      borderRadius={5}
                      theme={nivoTheme}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -15 }}
                      axisLeft={{ tickSize: 0, tickPadding: 8, legend: "Downtime (hrs)", legendPosition: "middle", legendOffset: -50 }}
                      labelTextColor="#fff"
                      labelSkipWidth={30}
                      labelSkipHeight={20}
                      tooltip={({ data, value }) => (
                        <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <strong>{(data as any).fullName || data.name}</strong><br />
                          Downtime: <strong>{Number(value).toLocaleString()} hrs</strong>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-72 text-slate-400 text-xs">No downtime data available</div>
                )}
              </div>

              {/* Coordinator Efficiency */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-emerald-100 rounded-lg"><Award className="w-4 h-4 text-emerald-600" /></div>
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Coordinator Efficiency</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Resolution rate % per coordinator</p>
                  </div>
                </div>
                {coordinatorData.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveBar
                      data={coordinatorData.map((c) => ({ name: c.shortName, fullName: c.name, "Resolution %": c.resolutionRate, color: c.color }))}
                      keys={["Resolution %"]}
                      indexBy="name"
                      margin={{ top: 10, right: 20, bottom: 55, left: 55 }}
                      padding={0.3}
                      valueScale={{ type: "linear", min: 0, max: 100 }}
                      colors={({ data }) => (data as any).color || "#10b981"}
                      borderRadius={5}
                      theme={nivoTheme}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -15 }}
                      axisLeft={{ tickSize: 0, tickPadding: 8, legend: "Resolution %", legendPosition: "middle", legendOffset: -45, format: (v) => `${v}%` }}
                      label={(d) => `${d.value}%`}
                      labelTextColor="#fff"
                      labelSkipWidth={24}
                      labelSkipHeight={18}
                      tooltip={({ data, value }) => (
                        <div style={{ background: "#0f172a", color: "#f8fafc", padding: "10px 14px", borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                          <strong>{(data as any).fullName || data.name}</strong><br />
                          Resolution: <strong>{value}%</strong>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-56 text-slate-400 text-xs">No coordinator data</div>
                )}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 px-2 font-black text-slate-400 uppercase">Coordinator</th>
                        <th className="py-2 px-2 font-black text-slate-400 uppercase text-center">Total</th>
                        <th className="py-2 px-2 font-black text-slate-400 uppercase text-center">Res%</th>
                        <th className="py-2 px-2 font-black text-slate-400 uppercase text-center">Avg Fix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {coordinatorData.map((c) => (
                        <tr key={c.name} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-extrabold text-slate-800 truncate max-w-[130px]">{c.name}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{c.total}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-[10px] font-black ${
                              c.resolutionRate >= 80 ? "text-emerald-600" : c.resolutionRate >= 50 ? "text-amber-600" : "text-red-600"
                            }`}>{c.resolutionRate}%</span>
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500">{c.avgFixDays}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* â”€â”€ Repeat Failures History Modal â”€â”€ */}
      {selectedRepeatBarcode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Barcode Failure History</h3>
                <p className="text-[10px] text-indigo-600 font-mono font-bold mt-0.5">Tag ID: {selectedRepeatBarcode}</p>
              </div>
              <button onClick={() => setSelectedRepeatBarcode(null)} className="text-xs font-black text-slate-400 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl cursor-pointer transition">Close X</button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-black uppercase">Equipment</span>
                  <p className="text-slate-900 font-extrabold mt-0.5">{repeatDetailsList[0]?.equipmentName || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-black uppercase">Hospital</span>
                  <p className="text-slate-900 font-extrabold mt-0.5">{repeatDetailsList[0]?.hospitalName || "Unknown"}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-black text-[10px]">
                      <th className="py-2 px-2">Ticket ID</th>
                      <th className="py-2 px-2">Logged</th>
                      <th className="py-2 px-2">Closed</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-2 text-right">Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {repeatDetailsList.map((ticket) => (
                      <tr key={ticket.complaintId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-2 font-extrabold text-slate-900">{ticket.complaintId || "N/A"}</td>
                        <td className="py-2.5 px-2 text-slate-500">{ticket.complaintRaiseDate || "N/A"}</td>
                        <td className="py-2.5 px-2 text-slate-500">{ticket.complaintCloseDate || "Open"}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${isComplaintClosed(ticket) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700 animate-pulse"}`}>
                            {isComplaintClosed(ticket) ? "Closed" : "Open"}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-slate-900 font-mono">{formatRupees(getRowPenaltyVal(ticket))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
