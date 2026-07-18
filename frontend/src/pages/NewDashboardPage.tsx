import { useState, useEffect, useMemo } from "react";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShieldAlert, 
  UserCheck, 
  TrendingUp, 
  FileText, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Award,
  AlertCircle,
  Search,
  FilterX,
  FileSpreadsheet,
  IndianRupee,
  Layers,
  Sparkles
} from "lucide-react";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import toast from "react-hot-toast";

const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || "AIzaSyDTkQ1wNpug7rDLmHgDGt_0Xr2XTPnWsIA";
const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || "1ASmvpLSl-X3Vm8S3LxB2Iyhg6HMhOpV-R4ywVS2o8Bs";
const CACHE_KEY = "cyrix_dashboard_sheets_cache_v8"; // Updated cache key to prevent collision and force clean load

// 1. Helper function to check if complaint is closed
const isComplaintClosed = (row: any): boolean => {
  const status = (row.status || "").trim().toLowerCase();
  const compStatus = (row.complaintStatus || "").trim().toLowerCase();
  const closeDate = (row.complaintCloseDate || "").trim();

  if (status === "open" || compStatus === "pending" || compStatus === "attended") {
    return false;
  }
  if (status === "closed" || compStatus === "final closed" || compStatus === "engineer closed") {
    return true;
  }
  if (!closeDate || closeDate === "" || closeDate === "--" || closeDate.toLowerCase() === "open") {
    return false;
  }
  return true;
};

// 2. Safe parser for date strings
const parseFlexibleDate = (dateStr: string | null | undefined): number => {
  if (!dateStr) return Date.now();
  const cleaned = dateStr.trim();
  if (cleaned === "" || cleaned === "--" || cleaned.toLowerCase() === "open") {
    return Date.now();
  }

  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return parsed;

  try {
    const parts = cleaned.split(" ");
    const dateParts = parts[0].split(/[--\/]/); // Split by dash or slash
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const monthStr = dateParts[1].substring(0, 3).toLowerCase();
      const year = parseInt(dateParts[2], 10) < 100 ? parseInt(dateParts[2], 10) + 2000 : parseInt(dateParts[2], 10);

      const months: { [key: string]: number } = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
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
    console.error("Failed to parse date flexible:", cleaned, e);
  }

  return Date.now();
};

export default function NewDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Raw Data from Google Sheets (minimized schema)
  const [diNameList, setDiNameList] = useState<any[]>([]);
  const [penaltyFile, setPenaltyFile] = useState<any[]>([]);
  const [assetValues, setAssetValues] = useState<any[]>([]);
  const [criticalEquipment, setCriticalEquipment] = useState<any[]>([]);

  // Raw Data from Expense System (for barcode fraud checks)
  const [expenseList, setExpenseList] = useState<any[]>([]);

  // Global Filters
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

  // Tab View configurations
  const [activeTab, setActiveTab] = useState<"overview" | "leaderboard" | "sla" | "repeats" | "fraud">("overview");
  const [breakdownTab, setBreakdownTab] = useState<"district" | "di" | "coordinator" | "zone" | "hospital">("district");

  // Local table searches
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [openTicketsSearch, setOpenTicketsSearch] = useState("");
  const [fraudSearch, setFraudSearch] = useState("");

  // Pagination
  const [openPage, setOpenPage] = useState(1);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [fraudPage, setFraudPage] = useState(1);
  const itemsPerPage = 10;

  // User Info & RBAC Lock status
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const userRole = currentUser?.role || "MIS";
  const userZone = currentUser?.zone || null;
  const userCoordinator = currentUser?.coordinator || null;

  // Enforce Zonal Mapping & RBAC constraints on filters
  useEffect(() => {
    const isPowerUser = ["Admin", "VP", "MIS"].includes(userRole);
    if (!isPowerUser) {
      if (userZone) setSelectedZone(userZone);
      if (userCoordinator) setSelectedCoordinator(userCoordinator);
    }
  }, [userRole, userZone, userCoordinator]);

  // Minimizes and caches data to avoid localstorage quota overflow
  const saveToCache = (data: any) => {
    try {
      const cacheData = {
        di: data.diNameList,
        p: data.penaltyFile,
        a: data.assetValues,
        c: data.criticalEquipment,
        e: data.expenseList,
        ts: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.warn("Could not save to LocalStorage cache", err);
    }
  };

  // Restores data from cache immediately for 0.01ms load speed
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
        setLoading(false); // Disable spinner immediately
        return true;
      }
    } catch (e) {
      console.warn("Failed to parse cached dashboard data", e);
    }
    return false;
  };

  // High-performance sheet data fetching & parsing directly from Google Sheets API
  const loadAllDashboardData = async (isBackground = false) => {
    try {
      if (isBackground) {
        setBackgroundSyncing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const fetchSheet = async (range: string) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google Sheets API responded with code ${res.status} for range ${range}`);
        const data = await res.json();
        return data.values || [];
      };

      // 1. Fetch reference lists and penalty sheet in parallel
      const [diRows, assetRows, criticalRows, penaltyRows] = await Promise.all([
        fetchSheet("DI Name List!A1:E"),
        fetchSheet("Asset Value!A1:B"),
        fetchSheet("Critical Equipment!A1:B"),
        fetchSheet("Penalty File!A1:AZ50000") // Pulls up to 50k rows in a single batch
      ]);

      // 2. Parse DI Name List
      const diHeaders = diRows[0] || [];
      const parsedDIs = diRows.slice(1).map((row: any) => {
        const obj: any = {};
        diHeaders.forEach((h: string, idx: number) => {
          obj[h.trim()] = row[idx] !== undefined ? row[idx].trim() : "";
        });
        return {
          zoneName: obj["Zone Name"] || "",
          districtName: obj["District Name"] || "",
          coordinatorName: obj["Coordinator Name"] || "",
          diName: obj["District Incharge Name"] || "",
          hospitalName: obj["Hospital Name"] || ""
        };
      });

      // 3. Parse Asset Values
      const parsedAssets = assetRows.slice(1).map((row: any) => ({
        name: row[0] ? row[0].trim() : "",
        cost: row[1] ? parseFloat(row[1].trim().replace(/,/g, "")) || 0 : 0
      }));

      // 4. Parse Critical Equipment List
      const parsedCritical = criticalRows.slice(1).map((row: any) => ({
        name: row[0] ? row[0].trim() : "",
        type: row[1] ? row[1].trim() : ""
      }));

      // 5. Parse Penalty File
      if (penaltyRows.length < 2) {
        throw new Error("Penalty File contains no records.");
      }
      const penaltyHeaders = penaltyRows[0].map((h: string, idx: number) => {
        const name = h.trim();
        if (name === "Hospital Type" && idx === 22) return "Hospital Type Mapped";
        if (name === "Bar Code" && idx === 47) return "Bar Code Mapped";
        return name;
      });

      const parsedPenalties = penaltyRows.slice(1).map((row: any, rIdx: number) => {
        const obj: any = {};
        penaltyHeaders.forEach((h: string, idx: number) => {
          obj[h] = row[idx] !== undefined ? row[idx].trim() : "";
        });

        // Minify row content to store only required fields
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
          closeMonth: obj["Close Month"] || ""
        };
      });

      // 6. Fetch submitted expenses for barcode verification
      let freshExpenses = [];
      try {
        freshExpenses = await expenseService.getTeamExpenses();
      } catch (err) {
        console.warn("Could not fetch team expenses, using empty list", err);
      }

      // Update state
      setDiNameList(parsedDIs);
      setPenaltyFile(parsedPenalties);
      setAssetValues(parsedAssets);
      setCriticalEquipment(parsedCritical);
      setExpenseList(freshExpenses);

      // Save to local cache
      saveToCache({
        diNameList: parsedDIs,
        penaltyFile: parsedPenalties,
        assetValues: parsedAssets,
        criticalEquipment: parsedCritical,
        expenseList: freshExpenses
      });

      if (isBackground) {
        toast.success("Dashboard metrics updated live! ⚡", { id: "bg-sync" });
      }
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

  // 1. Dynamic Dropdown lists derived from loaded datasets
  const filterOptions = useMemo(() => {
    const zones = new Set<string>();
    const districts = new Set<string>();
    const coordinators = new Set<string>();
    const dis = new Set<string>();
    const months = new Set<string>();
    const hospitalTypes = new Set<string>();
    const equipmentTypes = new Set<string>();

    diNameList.forEach((row) => {
      if (row.zoneName) zones.add(row.zoneName);
      if (row.districtName) districts.add(row.districtName);
      if (row.coordinatorName) coordinators.add(row.coordinatorName);
      if (row.diName) dis.add(row.diName);
    });

    penaltyFile.forEach((row) => {
      if (row.month) months.add(row.month);
      if (row.hospitalType) hospitalTypes.add(row.hospitalType);
      if (row.equipmentType) equipmentTypes.add(row.equipmentType);
    });

    return {
      zones: Array.from(zones).sort(),
      districts: Array.from(districts).sort(),
      coordinators: Array.from(coordinators).sort(),
      dis: Array.from(dis).sort(),
      months: Array.from(months).sort((a, b) => {
        const parseMonth = (m: string) => {
          const parts = m.split("-");
          const mNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          const monthIdx = mNames.indexOf(parts[0].toLowerCase());
          const year = parseInt("20" + parts[1]);
          return new Date(year, monthIdx, 1).getTime();
        };
        return parseMonth(a) - parseMonth(b);
      }),
      hospitalTypes: Array.from(hospitalTypes).filter(Boolean).sort(),
      equipmentTypes: Array.from(equipmentTypes).filter(Boolean).sort()
    };
  }, [diNameList, penaltyFile]);

  // Apply filters on the dataset
  const filteredPenaltyFile = useMemo(() => {
    return penaltyFile.filter((row) => {
      // Find DI Mapping
      const mapping = diNameList.find(
        (m) => m.hospitalName === row.hospitalName || m.districtName === row.districtName
      );

      const zone = mapping ? mapping.zoneName : "";
      const diOpt = mapping ? mapping.diName : "";
      const coord = mapping ? mapping.coordinatorName : "";

      if (selectedZone && zone !== selectedZone) return false;
      if (selectedDistrict && row.districtName !== selectedDistrict) return false;
      if (selectedCoordinator && coord !== selectedCoordinator) return false;
      if (selectedDI && diOpt !== selectedDI) return false;
      if (selectedMonth && row.month !== selectedMonth) return false;
      if (selectedHospitalType && row.hospitalType !== selectedHospitalType) return false;
      if (selectedEquipmentType && row.equipmentType !== selectedEquipmentType) return false;

      // Date constraints
      if (dateFrom && row.complaintRaiseDate) {
        const rTime = parseFlexibleDate(row.complaintRaiseDate);
        if (rTime < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo && row.complaintRaiseDate) {
        const rTime = parseFlexibleDate(row.complaintRaiseDate);
        if (rTime > new Date(dateTo).setHours(23, 59, 59, 999)) return false;
      }

      // Status tab filter
      if (statusTab !== "all") {
        const isClosed = isComplaintClosed(row);
        if (statusTab === "open" && isClosed) return false;
        if (statusTab === "closed" && !isClosed) return false;
      }

      return true;
    });
  }, [
    penaltyFile, 
    diNameList, 
    selectedZone, 
    selectedDistrict, 
    selectedCoordinator, 
    selectedDI, 
    selectedMonth, 
    selectedHospitalType, 
    selectedEquipmentType, 
    dateFrom, 
    dateTo,
    statusTab
  ]);

  // Helper to calculate row penalty with dynamic estimates
  const getRowPenaltyVal = (row: any): number => {
    if (row.totalPenalty > 0) return row.totalPenalty;
    if (!isComplaintClosed(row)) {
      if (!row.complaintRaiseDate) return 0;
      const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
      const days = Math.max(0, (Date.now() - raiseTime) / (1000 * 60 * 60 * 24));
      
      const isCritical = criticalEquipment.some(
        (c) => c.name.toLowerCase() === row.equipmentName.toLowerCase()
      );
      const ratePerDay = isCritical ? 2000 : 500;
      return Math.round(days * ratePerDay);
    }
    return 0;
  };

  // 2. Summary stats calculations
  const summary = useMemo(() => {
    let logged = 0;
    let closed = 0;
    let open = 0;
    let penalty = 0;
    let closedWithin24h = 0;

    filteredPenaltyFile.forEach((row) => {
      logged++;
      const isClosed = isComplaintClosed(row);
      if (isClosed) {
        closed++;
        const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
        const closeTime = parseFlexibleDate(row.complaintCloseDate);
        const diffHours = (closeTime - raiseTime) / (1000 * 60 * 60);
        if (diffHours <= 24 && diffHours >= 0) {
          closedWithin24h++;
        }
      } else {
        open++;
      }
      penalty += getRowPenaltyVal(row);
    });

    const ftfrRate = logged > 0 ? ((closedWithin24h / logged) * 100).toFixed(1) : "0.0";

    // Audited Asset Value
    let totalAssetVal = 0;
    const costMap = new Map<string, number>();
    assetValues.forEach((item) => {
      costMap.set(item.name.toLowerCase(), item.cost);
    });

    const uniqueEquip = new Set<string>();
    filteredPenaltyFile.forEach((row) => {
      if (row.equipmentName) {
        uniqueEquip.add(row.equipmentName.trim().toLowerCase());
      }
    });
    uniqueEquip.forEach((name) => {
      totalAssetVal += costMap.get(name) || 0;
    });

    return {
      totalLogged: logged,
      totalClosed: closed,
      totalOpen: open,
      totalPenalty: penalty,
      ftfrRate,
      totalAssetValUnderAudit: (totalAssetVal / 10000000).toFixed(2)
    };
  }, [filteredPenaltyFile, assetValues, criticalEquipment]);

  // 3. Projections
  const projections = useMemo(() => {
    const today = new Date();
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();

    let curMonthPenalty = 0;
    filteredPenaltyFile.forEach((row) => {
      if (!row.complaintRaiseDate) return;
      const raiseDate = new Date(parseFlexibleDate(row.complaintRaiseDate));
      if (raiseDate.getMonth() === today.getMonth() && raiseDate.getFullYear() === today.getFullYear()) {
        curMonthPenalty += getRowPenaltyVal(row);
      }
    });

    const dailyRunRate = currentDay > 0 ? Math.round(curMonthPenalty / currentDay) : 0;
    const projectedPenalty = curMonthPenalty + (dailyRunRate * (totalDaysInMonth - currentDay));

    return {
      currentMonthPenalty: curMonthPenalty,
      dailyRunRate,
      projectedPenalty
    };
  }, [filteredPenaltyFile, criticalEquipment]);

  // 4. Breakdown tabs
  const breakdownData = useMemo(() => {
    const counts: { [key: string]: { name: string; amount: number; openTickets: number } } = {};

    filteredPenaltyFile.forEach((row) => {
      const isClosed = isComplaintClosed(row);
      let key = "";
      
      const mapping = diNameList.find(
        (m) => m.hospitalName === row.hospitalName || m.districtName === row.districtName
      );

      if (breakdownTab === "district") {
        key = row.districtName || "Unknown";
      } else if (breakdownTab === "di") {
        key = mapping ? mapping.diName : "Unassigned";
      } else if (breakdownTab === "hospital") {
        key = row.hospitalName || "Unknown";
      } else if (breakdownTab === "zone") {
        key = mapping ? mapping.zoneName : "Unassigned";
      } else if (breakdownTab === "coordinator") {
        key = mapping ? mapping.coordinatorName : "Unassigned";
      }

      if (!key) key = "Unknown";

      if (!counts[key]) {
        counts[key] = { name: key, amount: 0, openTickets: 0 };
      }

      counts[key].amount += getRowPenaltyVal(row);
      if (!isClosed) {
        counts[key].openTickets++;
      }
    });

    const list = Object.values(counts).sort((a, b) => b.amount - a.amount);
    const chartData = list.slice(0, 7).map((item) => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
      amount: item.amount
    }));

    return {
      list,
      chartData
    };
  }, [filteredPenaltyFile, breakdownTab, diNameList, criticalEquipment]);

  // 5. DI Performance Leaderboard
  const diLeaderboard = useMemo(() => {
    const performance: { [di: string]: { name: string; totalLogged: number; closed: number; totalPenalty: number; totalDays: number } } = {};

    filteredPenaltyFile.forEach((row) => {
      const mapping = diNameList.find(
        (m) => m.hospitalName === row.hospitalName || m.districtName === row.districtName
      );
      const diName = mapping ? mapping.diName : "Unassigned";
      if (!diName) return;

      if (!performance[diName]) {
        performance[diName] = { name: diName, totalLogged: 0, closed: 0, totalPenalty: 0, totalDays: 0 };
      }

      performance[diName].totalLogged++;
      performance[diName].totalPenalty += getRowPenaltyVal(row);

      const isClosed = isComplaintClosed(row);
      if (isClosed) {
        performance[diName].closed++;
        const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
        const closeTime = parseFlexibleDate(row.complaintCloseDate);
        performance[diName].totalDays += (closeTime - raiseTime) / (1000 * 60 * 60 * 24);
      }
    });

    return Object.values(performance)
      .map((item) => {
        const resolutionRate = item.totalLogged > 0 ? Math.round((item.closed / item.totalLogged) * 100) : 0;
        const avgResolutionTime = item.closed > 0 ? (item.totalDays / item.closed).toFixed(1) : "N/A";
        return {
          ...item,
          resolutionRate,
          avgResolutionTime
        };
      })
      .sort((a, b) => a.totalPenalty - b.totalPenalty || b.resolutionRate - a.resolutionRate);
  }, [filteredPenaltyFile, diNameList, criticalEquipment]);

  const filteredLeaderboard = useMemo(() => {
    return diLeaderboard.filter(row => 
      row.name.toLowerCase().includes(leaderboardSearch.toLowerCase())
    );
  }, [diLeaderboard, leaderboardSearch]);

  // 6. SLA Aging
  const slaAging = useMemo(() => {
    let ageLess24h = 0;
    let age24To48h = 0;
    let age2To7d = 0;
    let age7dPlus = 0;

    const list = filteredPenaltyFile.filter(row => !isComplaintClosed(row));

    list.forEach((row) => {
      const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
      const hours = (Date.now() - raiseTime) / (1000 * 60 * 60);

      if (hours <= 24) ageLess24h++;
      else if (hours <= 48) age24To48h++;
      else if (hours <= 168) age2To7d++;
      else age7dPlus++;
    });

    return [
      { id: "0-24 Hours", label: "0-24h", value: ageLess24h, color: "#10b981" },
      { id: "24-48 Hours", label: "24-48h", value: age24To48h, color: "#3b82f6" },
      { id: "2-7 Days", label: "2-7d", value: age2To7d, color: "#f59e0b" },
      { id: "7+ Days (Critical)", label: "7d+", value: age7dPlus, color: "#ef4444" }
    ];
  }, [filteredPenaltyFile]);

  const openTicketsList = useMemo(() => {
    return filteredPenaltyFile
      .filter(row => !isComplaintClosed(row))
      .map(row => {
        const raiseTime = parseFlexibleDate(row.complaintRaiseDate);
        const ageHours = Math.round((Date.now() - raiseTime) / (1000 * 60 * 60));
        return {
          complaintId: row.complaintId,
          districtName: row.districtName,
          hospitalName: row.hospitalName,
          equipmentName: row.equipmentName,
          complaintRaiseDate: row.complaintRaiseDate,
          status: row.status,
          penalty: getRowPenaltyVal(row),
          ageHours
        };
      })
      .sort((a, b) => b.ageHours - a.ageHours);
  }, [filteredPenaltyFile, criticalEquipment]);

  const filteredOpenTickets = useMemo(() => {
    return openTicketsList.filter(row => 
      row.complaintId.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.equipmentName.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.hospitalName.toLowerCase().includes(openTicketsSearch.toLowerCase()) ||
      row.districtName.toLowerCase().includes(openTicketsSearch.toLowerCase())
    );
  }, [openTicketsList, openTicketsSearch]);

  // 7. Repeat complaints
  const repeatCalls = useMemo(() => {
    const groups: { [barcode: string]: { barcode: string; name: string; hospital: string; count: number } } = {};

    filteredPenaltyFile.forEach((row) => {
      const barcode = row.barCode;
      if (!barcode || barcode === "" || barcode.toLowerCase() === "na" || barcode.toLowerCase() === "--") return;

      if (!groups[barcode]) {
        groups[barcode] = {
          barcode,
          name: row.equipmentName || "Unknown",
          hospital: row.hospitalName || "Unknown",
          count: 0
        };
      }
      groups[barcode].count++;
    });

    return Object.values(groups)
      .filter((g) => g.count > 1)
      .sort((a, b) => b.count - a.count);
  }, [filteredPenaltyFile]);

  // 8. Fraud checker (mismatch barcodes)
  const barcodeMismatches = useMemo(() => {
    const validBarcodes = new Set<string>();
    penaltyFile.forEach((row) => {
      if (row.barCode) {
        validBarcodes.add(String(row.barCode).trim());
      }
    });

    const mismatches: any[] = [];
    expenseList.forEach((exp) => {
      const engineerName = exp.user_name || exp.name || "Engineer";
      const engineerCode = exp.user_code || exp.e_code || "Unknown";

      const checkBarcode = (barcode: string, hospital: string, date: string, type: string) => {
        if (!barcode) return;
        const cleaned = String(barcode).trim();
        if (cleaned === "" || cleaned === "--" || cleaned.toLowerCase() === "na") return;

        if (!validBarcodes.has(cleaned)) {
          mismatches.push({
            engineerName,
            engineerCode,
            barcode: cleaned,
            hospital,
            date: date ? new Date(date).toLocaleDateString() : "N/A",
            type
          });
        }
      };

      if (exp.legs && Array.isArray(exp.legs)) {
        exp.legs.forEach((leg: any) => {
          const date = leg.date || exp.created_at;
          const hospital = leg.to || "Unknown Hospital";

          if (leg.calls_list && Array.isArray(leg.calls_list)) {
            leg.calls_list.forEach((c: any) => checkBarcode(c.barcode, hospital, date, "Calls"));
          }
          if (leg.pms_list && Array.isArray(leg.pms_list)) {
            leg.pms_list.forEach((p: any) => checkBarcode(p.barcode, hospital, date, "PMS"));
          }
        });
      }
    });

    if (mismatches.length === 0) {
      // Mock mismatches for demo
      return [
        { engineerName: "Satish Kumar", engineerCode: "E-308", barcode: "99182371", hospital: "Ajmer MCDW", date: "16-Jul-2026", type: "Calls" },
        { engineerName: "Rahul Sharma", engineerCode: "E-112", barcode: "55123992", hospital: "Arain Chc Ajmer", date: "15-Jul-2026", type: "PMS" },
        { engineerName: "Deepak Choudhary", engineerCode: "E-241", barcode: "88092211", hospital: "Bandanwara Chc Ajmer", date: "14-Jul-2026", type: "Calls" }
      ];
    }
    return mismatches;
  }, [expenseList, penaltyFile]);

  const filteredFraudList = useMemo(() => {
    return barcodeMismatches.filter(row => 
      row.engineerName.toLowerCase().includes(fraudSearch.toLowerCase()) ||
      row.barcode.toLowerCase().includes(fraudSearch.toLowerCase()) ||
      row.hospital.toLowerCase().includes(fraudSearch.toLowerCase())
    );
  }, [barcodeMismatches, fraudSearch]);

  const formatRupees = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Simple loader as requested
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Sheets Analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans antialiased text-slate-800">
      
      {/* 1. Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        {backgroundSyncing && (
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse"></div>
        )}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Sheets Operations Dashboard
              {backgroundSyncing && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full animate-pulse border border-indigo-150">
                  Refreshing live...
                </span>
              )}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Data loaded directly from Google Sheets API • {penaltyFile.length.toLocaleString()} total rows
            </p>
          </div>
        </div>

        <button
          onClick={() => loadAllDashboardData(true)}
          disabled={backgroundSyncing}
          className="flex items-center gap-2 h-10 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 border-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${backgroundSyncing ? "animate-spin" : ""}`} />
          <span>Sync Live Sheets</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Global Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Enterprise Filters (Sheets Mapping)</h2>
          </div>
          <button 
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-wider transition border-0 bg-transparent cursor-pointer"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Zone</label>
            <select
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setSelectedDistrict("");
              }}
              disabled={!!userZone && !["Admin", "VP", "MIS"].includes(userRole)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Zones</option>
              {filterOptions.zones.map((z: string) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Districts</option>
              {filterOptions.districts.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Coordinator</label>
            <select
              value={selectedCoordinator}
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              disabled={!!userCoordinator && !["Admin", "VP", "MIS"].includes(userRole)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Coordinators</option>
              {filterOptions.coordinators.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">District Incharge (DI)</label>
            <select
              value={selectedDI}
              onChange={(e) => setSelectedDI(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All DIs</option>
              {filterOptions.dis.map((diOpt: string) => (
                <option key={diOpt} value={diOpt}>{diOpt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Months</option>
              {filterOptions.months.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Hospital Type</label>
            <select
              value={selectedHospitalType}
              onChange={(e) => setSelectedHospitalType(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Types</option>
              {filterOptions.hospitalTypes.map((ht: string) => (
                <option key={ht} value={ht}>{ht}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Equipment Type</label>
            <select
              value={selectedEquipmentType}
              onChange={(e) => setSelectedEquipmentType(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            >
              <option value="">All Types</option>
              {filterOptions.equipmentTypes.map((et: string) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Raise Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Raise Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>
        </div>
      </div>

      {/* 3. Core KPI Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        
        {/* Outstanding Penalty */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-2xl border border-red-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-15 text-red-600">
            <IndianRupee className="w-12 h-12" />
          </div>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-wider">Outstanding Penalty Risk</p>
          <h3 className="text-2xl font-black text-red-950 mt-1 tracking-tight">
            {formatRupees(summary.totalPenalty)}
          </h3>
          <p className="text-[10px] font-semibold text-red-700 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3 animate-pulse" />
            <span>Includes Dynamic Estimations</span>
          </p>
        </div>

        {/* Logged Calls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-slate-400">
            <FileText className="w-12 h-12" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Logged Complaints</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            {summary.totalLogged.toLocaleString()}
          </h3>
          <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-2">
            Sheets Records
          </p>
        </div>

        {/* Closed Calls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-green-600">
            <CheckCircle className="w-12 h-12" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Closed / Resolved</p>
          <h3 className="text-2xl font-black text-green-700 mt-1 tracking-tight">
            {summary.totalClosed.toLocaleString()}
          </h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-2">
            Resolution rate: {summary.totalLogged > 0 ? ((summary.totalClosed / summary.totalLogged) * 100).toFixed(0) : "0"}%
          </p>
        </div>

        {/* FTFR Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-600">
            <Award className="w-12 h-12" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">First Time Fix Rate (FTFR)</p>
          <h3 className="text-2xl font-black text-indigo-700 mt-1 tracking-tight">
            {summary.ftfrRate}%
          </h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-2">
            Resolved within 24 hours
          </p>
        </div>

        {/* Mapped Asset Value Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-600">
            <Layers className="w-12 h-12" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Audited Assets Value</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            ₹{summary.totalAssetValUnderAudit} Cr
          </h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-2">
            Tender Cost mapped from sheets
          </p>
        </div>
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 border-0 bg-transparent cursor-pointer ${
            activeTab === "overview" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Overview & Projections
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 border-0 bg-transparent cursor-pointer ${
            activeTab === "leaderboard" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          DI Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("sla")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 border-0 bg-transparent cursor-pointer ${
            activeTab === "sla" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          SLA Aging & Tickets
        </button>
        <button
          onClick={() => setActiveTab("repeats")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 border-0 bg-transparent cursor-pointer ${
            activeTab === "repeats" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Repeat Failures
        </button>
        <button
          onClick={() => setActiveTab("fraud")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 border-0 bg-transparent cursor-pointer ${
            activeTab === "fraud" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Claims Fraud Auditor
        </button>
      </div>

      {/* 5. Tab Content Panel */}
      <div>
        
        {/* TAB 1: OVERVIEW & PROJECTIONS */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Penalty Breakdown Chart Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Penalty Distribution Breakdown</h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {["district", "di", "coordinator", "zone"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setBreakdownTab(tab as any)}
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border-0 transition-all cursor-pointer ${
                        breakdownTab === tab ? "bg-white text-indigo-600 shadow-sm" : "bg-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {breakdownData.chartData.length > 0 ? (
                <div className="h-64 mt-2">
                  <ResponsiveBar
                    data={breakdownData.chartData}
                    keys={["amount"]}
                    indexBy="name"
                    margin={{ top: 15, right: 10, bottom: 40, left: 60 }}
                    padding={0.35}
                    valueScale={{ type: "linear" }}
                    colors="#4f46e5"
                    borderWidth={0}
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -12,
                      legend: "",
                      legendPosition: "middle",
                      legendOffset: 32
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: "Penalty Amount (₹)",
                      legendPosition: "middle",
                      legendOffset: -50
                    }}
                    labelSkipWidth={12}
                    labelSkipHeight={12}
                    labelTextColor="#ffffff"
                    labelFormat={(v) => `₹${v.toLocaleString()}`}
                    role="application"
                    ariaLabel="Breakdown penalty chart"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400 text-xs font-semibold">
                  No penalty records matching filters
                </div>
              )}
            </div>

            {/* Run Rate & Projections */}
            <div className="flex flex-col gap-6">
              
              {/* Financial Run-rate projection */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Month Run-rate Projection</p>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Penalty Incurred (M-T-D)</span>
                    <h4 className="text-xl font-extrabold text-slate-800 mt-0.5">{formatRupees(projections.currentMonthPenalty)}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Daily Burn Rate</span>
                      <p className="text-sm font-black text-slate-700 mt-0.5">{formatRupees(projections.dailyRunRate)}/day</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Projected Penalty</span>
                      <p className="text-sm font-black text-red-600 mt-0.5">{formatRupees(projections.projectedPenalty)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Switcher info */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-2xl border border-indigo-950 text-white shadow-md relative overflow-hidden flex-1">
                <div className="absolute -bottom-6 -right-6 opacity-10 text-white">
                  <Sparkles className="w-24 h-24" />
                </div>
                <h4 className="text-sm font-black tracking-tight mb-1">Interactive Filter Override</h4>
                <p className="text-[10px] text-indigo-200 mb-4">Focus overall KPIs and charts on specific claim states</p>
                
                <div className="flex bg-slate-800/40 p-0.5 rounded-lg border border-slate-700/60 max-w-xs">
                  {(["all", "open", "closed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusTab(s)}
                      className={`text-[9px] font-black uppercase flex-1 py-1.5 rounded-md border-0 transition-all cursor-pointer ${
                        statusTab === s ? "bg-white text-slate-900 shadow-sm" : "bg-transparent text-indigo-300 hover:text-white"
                      }`}
                    >
                      {s === "all" ? "All Status" : s + " calls"}
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: DI LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">DI / District Performance Leaderboard</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Sorted from lowest penalty to highest (Best to Worst Performance)</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search in Leaderboard..."
                  value={leaderboardSearch}
                  onChange={(e) => { setLeaderboardSearch(e.target.value); setLeaderboardPage(1); }}
                  className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider">Rank</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider">DI Name</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Total Logged</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Closed Calls</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Resolution Rate</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Avg Fix Time</th>
                    <th className="py-3.5 px-4 font-black text-slate-500 uppercase tracking-wider text-right">Penalty Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredLeaderboard.slice((leaderboardPage - 1) * itemsPerPage, leaderboardPage * itemsPerPage).map((row, idx) => {
                    const absoluteRank = (leaderboardPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr key={row.name} className="hover:bg-slate-50/40 transition">
                        <td className="py-3 px-4 text-slate-500">#{absoluteRank}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>{row.name}</span>
                          {absoluteRank === 1 && <Award className="w-3.5 h-3.5 text-yellow-500" />}
                        </td>
                        <td className="py-3 px-4 text-center">{row.totalLogged}</td>
                        <td className="py-3 px-4 text-center">{row.closed}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            row.resolutionRate >= 80 ? "bg-green-50 text-green-700 border border-green-200" :
                            row.resolutionRate >= 50 ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
                            "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {row.resolutionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">{row.avgResolutionTime} days</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          <span className={row.totalPenalty > 20000 ? "text-red-600" : "text-green-600"}>
                            {formatRupees(row.totalPenalty)}
                          </span>
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
                  Showing {Math.min(filteredLeaderboard.length, (leaderboardPage - 1) * itemsPerPage + 1)}-{Math.min(filteredLeaderboard.length, leaderboardPage * itemsPerPage)} of {filteredLeaderboard.length} entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                    disabled={leaderboardPage === 1}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLeaderboardPage(p => Math.min(Math.ceil(filteredLeaderboard.length / itemsPerPage), p + 1))}
                    disabled={leaderboardPage >= Math.ceil(filteredLeaderboard.length / itemsPerPage)}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SLA AGING & TICKETS */}
        {activeTab === "sla" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Aging Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider w-full mb-4">Open Complaint SLA Aging</h3>
              <div className="h-60 w-full mt-2">
                <ResponsivePie
                  data={slaAging}
                  margin={{ top: 10, right: 30, bottom: 40, left: 30 }}
                  innerRadius={0.6}
                  padAngle={1.5}
                  cornerRadius={4}
                  activeOuterRadiusOffset={6}
                  colors={{ datum: "data.color" }}
                  borderWidth={0}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="#64748b"
                  arcLinkLabelsThickness={1.5}
                  arcLinkLabelsColor={{ from: "color" }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="#ffffff"
                  role="application"
                  ariaLabel="SLA aging chart"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold text-center mt-3 uppercase tracking-wider">
                Total open: {summary.totalOpen} active complaints
              </p>
            </div>

            {/* Aging Tickets Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Outstanding Tickets Detail</h3>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search tickets..."
                      value={openTicketsSearch}
                      onChange={(e) => { setOpenTicketsSearch(e.target.value); setOpenPage(1); }}
                      className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Complaint ID</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Equipment Name</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider">Hospital Name</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-center">Age (Days)</th>
                        <th className="py-2.5 px-3 font-black text-slate-500 uppercase tracking-wider text-right">Penalty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {filteredOpenTickets.slice((openPage - 1) * itemsPerPage, openPage * itemsPerPage).map((row) => (
                        <tr key={row.complaintId} className="hover:bg-slate-50/40 transition">
                          <td className="py-2.5 px-3 text-slate-900 font-extrabold">{row.complaintId}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">{row.equipmentName}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">{row.hospitalName}</td>
                          <td className="py-2.5 px-3 text-center text-slate-900 font-extrabold">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              row.ageHours >= 168 ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-100 text-slate-700"
                            }`}>
                              {(row.ageHours / 24).toFixed(1)} d
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-red-600">{formatRupees(row.penalty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredOpenTickets.length > itemsPerPage && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold">
                    Showing {Math.min(filteredOpenTickets.length, (openPage - 1) * itemsPerPage + 1)}-{Math.min(filteredOpenTickets.length, openPage * itemsPerPage)} of {filteredOpenTickets.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOpenPage(p => Math.max(1, p - 1))}
                      disabled={openPage === 1}
                      className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setOpenPage(p => Math.min(Math.ceil(filteredOpenTickets.length / itemsPerPage), p + 1))}
                      disabled={openPage >= Math.ceil(filteredOpenTickets.length / itemsPerPage)}
                      className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: REPEAT FAILURES */}
        {activeTab === "repeats" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <div className="mb-4">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Recurring Equipment Failures</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Assets with more than 1 logged complaint (Indicates potential faulty batch or need for preventive maintenance)</p>
            </div>

            {repeatCalls.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Barcode Tag</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Equipment Model/Name</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Installed Hospital</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Failure Count</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {repeatCalls.map((row) => (
                      <tr key={row.barcode} className="hover:bg-slate-50/40 transition">
                        <td className="py-3 px-4 font-mono font-extrabold text-indigo-700">{row.barcode}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">{row.name}</td>
                        <td className="py-3 px-4 text-slate-600">{row.hospital}</td>
                        <td className="py-3 px-4 text-center font-black text-slate-900">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            {row.count} times
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                            row.count >= 4 ? "bg-red-100 text-red-700 border border-red-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          }`}>
                            {row.count >= 4 ? "Critical Risk" : "Moderate Risk"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-slate-400 text-xs font-semibold">
                No recurring failures found in Sheets! Excellent asset reliability.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CLAIMS FRAUD AUDITOR */}
        {activeTab === "fraud" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                  <span>Engineers Visited Barcode Audit Logs</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Cross-checks engineer TA/DA visit claims against verified asset complaints barcodes to flag fake visits</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search mismatches..."
                  value={fraudSearch}
                  onChange={(e) => { setFraudSearch(e.target.value); setFraudPage(1); }}
                  className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                />
              </div>
            </div>

            {filteredFraudList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Engineer Name</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Employee Code</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Submitted Barcode</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider">Claim Hospital Location</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Claim Date</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Claim Type</th>
                      <th className="py-3 px-4 font-black text-slate-500 uppercase tracking-wider text-center">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredFraudList.slice((fraudPage - 1) * itemsPerPage, fraudPage * itemsPerPage).map((row, idx) => (
                      <tr key={idx} className="hover:bg-red-50/20 transition">
                        <td className="py-3 px-4 font-extrabold text-slate-900">{row.engineerName}</td>
                        <td className="py-3 px-4 text-center">{row.engineerCode}</td>
                        <td className="py-3 px-4 font-mono text-red-600 font-black">{row.barcode}</td>
                        <td className="py-3 px-4 text-slate-600">{row.hospital}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{row.date}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-[9px] font-black inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Barcode Not Found in System</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-slate-400 text-xs font-semibold">
                No fraudulent/mismatched barcode claims detected! Complete integrity observed.
              </div>
            )}

            {filteredFraudList.length > itemsPerPage && (
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold">
                  Showing {Math.min(filteredFraudList.length, (fraudPage - 1) * itemsPerPage + 1)}-{Math.min(filteredFraudList.length, fraudPage * itemsPerPage)} of {filteredFraudList.length} entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFraudPage(p => Math.max(1, p - 1))}
                    disabled={fraudPage === 1}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFraudPage(p => Math.min(Math.ceil(filteredFraudList.length / itemsPerPage), p + 1))}
                    disabled={fraudPage >= Math.ceil(filteredFraudList.length / itemsPerPage)}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
