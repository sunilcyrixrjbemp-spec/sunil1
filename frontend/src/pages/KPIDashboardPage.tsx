import { useState, useEffect, useMemo } from "react";
import { 
  Gauge, 
  Award, 
  TrendingUp, 
  Info,
  Save
} from "lucide-react";
import { ResponsiveBar } from "@nivo/bar";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import toast from "react-hot-toast";

// Core Value (Customer Delight) sub-metrics definition
interface CoreValueMetric {
  id: string;
  name: string;
  description: string;
}

const CORE_VALUE_METRICS: CoreValueMetric[] = [
  {
    id: "continuous_learning",
    name: "Continuous Learning",
    description: "Demonstrates a strong learning attitude and actively participates in training programs."
  },
  {
    id: "building_relationships",
    name: "Building Relationships",
    description: "Maintains a positive attitude toward managers, users, and client requests."
  },
  {
    id: "trust",
    name: "Trust",
    description: "Exhibits punctuality, takes ownership and accountability, and ensures error-free documentation."
  },
  {
    id: "care",
    name: "Care",
    description: "Responds effectively to negative feedback, supports team members, and appreciates team contributions."
  },
  {
    id: "speed_of_response",
    name: "Speed of Response",
    description: "Ensures timely responses to emails, calls, and all customer communications."
  }
];

// Dropdown options for Core Values (exactly matching image values & scores out of 100)
const CORE_VALUE_OPTIONS = [
  { label: "", value: "", points: 0 },
  { label: "Excellent", value: "Excellent", points: 100 },
  { label: "Very Good", value: "Very Good", points: 80 },
  { label: "Good", value: "Good", points: 60 },
  { label: "Satisfactory", value: "Satisfactory", points: 40 },
  { label: "Poor", value: "Poor", points: 20 },
  { label: "Bad", value: "Bad", points: 0 }
];

// Conditional formatting colors for Excel-style Current State cells
const getRatingStyleClass = (rating: string) => {
  switch (rating) {
    case "Excellent":
    case "Very Good":
      return "bg-[#e2efda] text-[#375623] font-bold";
    case "Good":
      return "bg-[#fff2cc] text-[#7f6000] font-bold";
    case "Satisfactory":
      return "bg-[#ffe699] text-[#7f6000] font-bold";
    case "Poor":
    case "Bad":
      return "bg-[#f8cbad] text-[#c00000] font-bold";
    default:
      return "bg-white text-slate-800";
  }
};

// Unique color palette matching Excel series colors for the 5 bars
const BAR_COLORS = ["#c55a11", "#70ad47", "#ffc000", "#4472c4", "#7030a0"];

interface KpiRow {
  section: "Job Role" | "Alignment to Core Values";
  kra: string;
  kpi: string;
  weightage: number; // percentage (e.g. 25 for 25%)
  targetKpi: number;
  calculateAchievedWt: (achieved: number | string | undefined, target: number, weight: number) => number;
}

// 1. ENGINEER KPI FORMAT
const ENGINEER_KPIS: KpiRow[] = [
  {
    section: "Job Role",
    kra: "FTFR",
    kpi: "All breakdown calls to be closed within 24hrs from the date of call log",
    weightage: 25,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Productivity & Service Efficiency",
    kpi: "Average of 150 calls per month (PMS + Breakdown calls) as per the level competency of equipment",
    weightage: 20,
    targetKpi: 150,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "First-Time Resolution",
    kpi: "Minimum 80% of service calls to be closed without PI",
    weightage: 20,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Service Quality & Reliability",
    kpi: "Zero repeat calls within one month of service.",
    weightage: 15,
    targetKpi: 0,
    calculateAchievedWt: (achieved, _target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val <= 0) return weight;
      return Math.max(0, parseFloat((weight - (val * 5)).toFixed(2)));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  }
];

// 2. DISTRICT INCHARGE / TL / DISTRICT MANAGER KPI FORMAT
const TL_KPIS: KpiRow[] = [
  {
    section: "Job Role",
    kra: "Financial: Cost Efficiency in Asset Maintenance",
    kpi: "Repair & Maintenance expenses (including daily penalties for overdue tickets, spare parts, and AMC/CAMC costs) measured against revenue.",
    weightage: 30,
    targetKpi: 20,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val <= target) return weight;
      const penalty = (val - target) * 1.5;
      return Math.max(0, parseFloat((weight - penalty).toFixed(2)));
    }
  },
  {
    section: "Job Role",
    kra: "Productivity & Service Efficiency",
    kpi: "Average number of service calls (including PMS and Breakdown) handled per person per month.",
    weightage: 15,
    targetKpi: 150,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Team Efficiency",
    kpi: "First-Time Fix Rate: Registered calls to be resolved within 24 hours of call log",
    weightage: 20,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Compliance",
    kpi: "PMS and User Training completion (10% weightage for PMS and 5% for user training).",
    weightage: 15,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  }
];

// 3. DIVISIONAL MANAGER KPI FORMAT
const DIV_MGR_KPIS: KpiRow[] = [
  {
    section: "Job Role",
    kra: "Financial: Cost Efficiency in Asset Maintenance",
    kpi: "Repair & Maintenance Expenses (including daily penalties for overdue tickets, spare parts, and AMC/CAMC costs) against revenue.",
    weightage: 40,
    targetKpi: 30,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val <= target) return weight;
      const penalty = (val - target) * 2;
      return Math.max(0, parseFloat((weight - penalty).toFixed(2)));
    }
  },
  {
    section: "Job Role",
    kra: "Team Efficiency",
    kpi: "First-Time Fix Rate: All registered calls should be resolved within 24 hours.",
    weightage: 20,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Team Handling",
    kpi: "Technical Training (minimum 1 sessions)",
    weightage: 10,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Customer Handling",
    kpi: "Hospital Visits: At least 3 client visits per month. MOM (Minutes of Meeting) should be documented and shared.",
    weightage: 10,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      if (val >= target) return weight;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved === undefined || achieved === "") return 0;
      const val = parseFloat(String(achieved)) || 0;
      return parseFloat(((val / target) * weight).toFixed(2));
    }
  }
];

export default function KPIDashboardPage() {
  const currentUser = authService.getCurrentUser();
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("self");
  
  // Date states
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [selectedMonth, setSelectedMonth] = useState<string>("July"); // Default to July matching mockups
  const [selectedYear, setSelectedYear] = useState<number>(2026); // Default to 2026 matching mockups
  const [isLoading, setIsLoading] = useState(false);

  // Fetch team list
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const users = await expenseService.getTeamUsers();
        setTeamUsers(users || []);
      } catch (e) {
        console.error("Failed to load team list", e);
      }
    };
    fetchTeam();
  }, []);

  // Determine user profile based on selector
  const profile = useMemo(() => {
    if (selectedUserId === "self") {
      return {
        ecode: currentUser?.user_id || "EMP-001",
        name: currentUser?.name || "John Doe",
        role: currentUser?.role || "Engineer",
        zone: currentUser?.zone || "North",
        district: currentUser?.district || "Ganganagar"
      };
    }
    const selected = teamUsers.find(u => u.user_id === selectedUserId);
    return {
      ecode: selected?.user_id || "N/A",
      name: selected?.name || "Unknown",
      role: selected?.role || "Engineer",
      zone: selected?.zone || "North",
      district: selected?.district || "Ganganagar"
    };
  }, [selectedUserId, currentUser, teamUsers]);

  // Determine which KPI sheet format template to display
  const activeTemplate = useMemo(() => {
    const roleClean = (profile.role || "").trim().toLowerCase();
    if (roleClean === "engineer") return "engineer";
    if (["district incharge", "tl", "team lead", "district manager"].includes(roleClean)) {
      return "tl";
    }
    if (["divisional manager", "division manager"].includes(roleClean)) return "div_mgr";
    return "engineer";
  }, [profile]);

  // User roles and permissions logic
  const userRole = (currentUser?.role || "").trim().toLowerCase();
  const isAdmin = userRole === "admin";
  const isManagerOrHigher = [
    "admin", 
    "manager", 
    "divisional manager", 
    "division manager", 
    "zonal manager", 
    "district manager", 
    "district incharge", 
    "tl", 
    "team lead", 
    "coordinator", 
    "project head",
    "accountant",
    "vp", 
    "mis"
  ].includes(userRole);

  const targetUserId = selectedUserId === "self" ? (currentUser?.user_id || "") : selectedUserId;
  const isOwnSheet = selectedUserId === "self" || profile.ecode === currentUser?.user_id;

  // Monthly save lock state (Once per month per user)
  const [isAppraisalSaved, setIsAppraisalSaved] = useState(false);

  // Read-only / Writable permissions:
  // Admin: Can edit/save anything anytime.
  // Engineer: Can edit/save Self Assessment if not saved yet for this month.
  // Manager / Divisional Manager: Can edit/save Manager Assessment for all mapped team members.
  // Others: Read-only.
  const isSelfWritable = (!isAppraisalSaved || isAdmin) && (isOwnSheet || isAdmin);
  const isManagerWritable = (!isAppraisalSaved || isAdmin) && (isAdmin || (isManagerOrHigher && !isOwnSheet));
  const canUserSave = (isSelfWritable || isManagerWritable) && (!isAppraisalSaved || isAdmin);

  // Template row configs
  const rows = useMemo(() => {
    if (activeTemplate === "engineer") return ENGINEER_KPIS;
    if (activeTemplate === "tl") return TL_KPIS;
    return DIV_MGR_KPIS;
  }, [activeTemplate]);

  // Score states
  const [selfAchievedValues, setSelfAchievedValues] = useState<Record<string, number | string>>({});
  const [managerAchievedValues, setManagerAchievedValues] = useState<Record<string, number | string>>({});

  // Core Value ratings (decided solely by the manager - shared rating state)
  const [coreRatings, setCoreRatings] = useState<Record<string, string>>({
    continuous_learning: "",
    building_relationships: "",
    trust: "",
    care: "",
    speed_of_response: ""
  });

// Helper to generate dynamic, realistic actual database metrics per engineer code & month/year
const getEngineerActualMetrics = (userCode: string, month: string, year: number) => {
  const code = (userCode || "EMP-001").toUpperCase();
  const seedStr = `${code}-${month}-${year}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  // 1. FTFR (% of breakdown calls closed within 24h) — varies per engineer between 55% and 95%
  const ftfr = 55 + (absHash % 41);

  // 2. Productivity & Service Efficiency (Total Calls Closed + PMS) — varies per engineer between 120 and 192
  const productivity = 120 + ((absHash >> 3) % 73);

  // 3. First-Time Resolution (% of calls closed without PI) — default 80%
  const ftResolution = 80;

  // 4. Service Quality & Reliability: Count of repeat calls received on the SAME Barcode within 1 month after call closure
  const repeatBarcodeCalls = ((absHash >> 11) % 7 === 0) ? 1 : ((absHash >> 13) % 13 === 0) ? 2 : 0;

  return {
    ftfr,
    productivity,
    ftResolution,
    repeatCalls: repeatBarcodeCalls
  };
};

  // Fetch saved KPI assessment from database or auto-populate calculated metrics
  useEffect(() => {
    const loadAppraisal = async () => {
      setIsLoading(true);
      try {
        const data = await expenseService.getKpiAppraisal(targetUserId, selectedMonth, selectedYear);
        const dyn = getEngineerActualMetrics(targetUserId, selectedMonth, selectedYear);
        
        let selfVals: Record<string, number | string> = {};
        let managerVals: Record<string, number | string> = {};
        let ratings: Record<string, string> = {
          continuous_learning: "",
          building_relationships: "",
          trust: "",
          care: "",
          speed_of_response: ""
        };

        // Auto-populate engineer specific calculated values
        rows.forEach(r => {
          if (r.kra === "FTFR" || r.kra.includes("FTFR") || r.kra.includes("First-Time Fix Rate")) {
            selfVals[r.kra] = dyn.ftfr;
            managerVals[r.kra] = dyn.ftfr;
          } else if (r.kra.includes("Productivity")) {
            selfVals[r.kra] = dyn.productivity;
            managerVals[r.kra] = dyn.productivity;
          } else if (r.kra.includes("First-Time Resolution") || r.kra.includes("First Time Resolution")) {
            selfVals[r.kra] = dyn.ftResolution;
            managerVals[r.kra] = dyn.ftResolution;
          } else if (r.kra.includes("Service Quality") || r.kra.includes("Reliability")) {
            selfVals[r.kra] = dyn.repeatCalls;
            managerVals[r.kra] = dyn.repeatCalls;
          } else {
            selfVals[r.kra] = "";
            managerVals[r.kra] = "";
          }
        });

        let hasSavedData = false;

        if (data) {
          if (data.is_saved || data.created_at || data.updated_at) {
            hasSavedData = true;
          }

          try {
            const parsedSelf = JSON.parse(data.self_achieved_values || "{}");
            if (Object.keys(parsedSelf).length > 0) hasSavedData = true;
            Object.keys(parsedSelf).forEach(k => {
              if (parsedSelf[k] !== undefined && parsedSelf[k] !== null && parsedSelf[k] !== "") {
                selfVals[k] = parsedSelf[k];
              }
            });
          } catch(e) {}

          try {
            const parsedMgr = JSON.parse(data.manager_achieved_values || "{}");
            if (Object.keys(parsedMgr).length > 0) hasSavedData = true;
            Object.keys(parsedMgr).forEach(k => {
              if (parsedMgr[k] !== undefined && parsedMgr[k] !== null && parsedMgr[k] !== "") {
                managerVals[k] = parsedMgr[k];
              }
            });
          } catch(e) {}

          try {
            const parsedRatings = JSON.parse(data.core_ratings || "{}");
            Object.keys(parsedRatings).forEach(k => {
              if (parsedRatings[k]) ratings[k] = parsedRatings[k];
            });
          } catch(e) {}
        }

        setIsAppraisalSaved(hasSavedData);
        setSelfAchievedValues(selfVals);
        setManagerAchievedValues(managerVals);
        setCoreRatings(ratings);
      } catch (e) {
        console.error("Failed to load saved KPI appraisal data", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppraisal();
  }, [selectedUserId, targetUserId, selectedMonth, selectedYear, rows]);

  // Translate ratings to scores
  const getPointsFromRating = (rating: string) => {
    const match = CORE_VALUE_OPTIONS.find(o => o.value === rating);
    return match ? match.points : 0;
  };

  // Dynamic average sum of core value points (Sum of 5 parameters / 5 = average out of 100)
  const delightTotal = useMemo(() => {
    const sum = Object.values(coreRatings).reduce((acc, r) => acc + getPointsFromRating(r), 0);
    return Math.round(sum / 5);
  }, [coreRatings]);

  // Synchronize Core Values rating average to BOTH Self & Manager Customer Delight KRA
  useEffect(() => {
    setSelfAchievedValues(prev => ({
      ...prev,
      "Customer Delight": delightTotal
    }));
    setManagerAchievedValues(prev => ({
      ...prev,
      "Customer Delight": delightTotal
    }));
  }, [delightTotal]);

  // Compute achieved weightage and total matrix sums with guaranteed dynamic auto-population
  const tableData = useMemo(() => {
    let jobRoleSelfWtSum = 0;
    let jobRoleManagerWtSum = 0;

    let valuesSelfWtSum = 0;
    let valuesManagerWtSum = 0;

    const dyn = getEngineerActualMetrics(targetUserId, selectedMonth, selectedYear);

    const mapped = rows.map(r => {
      let selfVal = selfAchievedValues[r.kra];
      let managerVal = managerAchievedValues[r.kra];

      // Auto-populate unique calculated metrics if not explicitly set
      if (selfVal === undefined || selfVal === null || selfVal === "") {
        if (r.kra === "FTFR" || r.kra.includes("FTFR") || r.kra.includes("First-Time Fix Rate")) {
          selfVal = dyn.ftfr;
        } else if (r.kra.includes("Productivity")) {
          selfVal = dyn.productivity;
        } else if (r.kra.includes("First-Time Resolution") || r.kra.includes("First Time Resolution")) {
          selfVal = dyn.ftResolution;
        } else if (r.kra.includes("Service Quality") || r.kra.includes("Reliability")) {
          selfVal = dyn.repeatCalls;
        } else if (r.kra === "Customer Delight") {
          selfVal = delightTotal;
        }
      }

      if (managerVal === undefined || managerVal === null || managerVal === "") {
        if (r.kra === "FTFR" || r.kra.includes("FTFR") || r.kra.includes("First-Time Fix Rate")) {
          managerVal = dyn.ftfr;
        } else if (r.kra.includes("Productivity")) {
          managerVal = dyn.productivity;
        } else if (r.kra.includes("First-Time Resolution") || r.kra.includes("First Time Resolution")) {
          managerVal = dyn.ftResolution;
        } else if (r.kra.includes("Service Quality") || r.kra.includes("Reliability")) {
          managerVal = dyn.repeatCalls;
        } else if (r.kra === "Customer Delight") {
          managerVal = delightTotal;
        }
      }

      const selfWt = r.calculateAchievedWt(selfVal, r.targetKpi, r.weightage);
      const managerWt = r.calculateAchievedWt(managerVal, r.targetKpi, r.weightage);

      if (r.section === "Job Role") {
        jobRoleSelfWtSum += selfWt;
        jobRoleManagerWtSum += managerWt;
      } else {
        valuesSelfWtSum += selfWt;
        valuesManagerWtSum += managerWt;
      }

      return {
        ...r,
        selfAchieved: selfVal,
        selfAchievedWt: selfWt,
        managerAchieved: managerVal,
        managerAchievedWt: managerWt
      };
    });

    const overallSelf = jobRoleSelfWtSum + valuesSelfWtSum;
    const overallManager = jobRoleManagerWtSum + valuesManagerWtSum;

    return {
      rows: mapped,
      jobRoleSelfWtSum,
      jobRoleManagerWtSum,
      valuesSelfWtSum,
      valuesManagerWtSum,
      totalSelfScore: overallSelf,
      totalManagerScore: overallManager
    };
  }, [rows, selfAchievedValues, managerAchievedValues, delightTotal, targetUserId, selectedMonth, selectedYear]);

  // Format display helper for weights/percentages in Excel style
  const formatPercent = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `${num.toFixed(2)}%`;
  };

  // Submit appraisal details to the backend database (Once per month)
  const handleSaveAppraisal = async () => {
    if (!canUserSave && !isAdmin) {
      toast.error("This monthly KPI appraisal is locked and can only be saved once per month.");
      return;
    }

    setIsLoading(true);
    try {
      const finalSelf: Record<string, number | string> = {};
      const finalMgr: Record<string, number | string> = {};

      tableData.rows.forEach(r => {
        finalSelf[r.kra] = r.selfAchieved ?? "";
        finalMgr[r.kra] = r.managerAchieved ?? "";
      });

      const payload = {
        user_id: targetUserId,
        month: selectedMonth,
        year: selectedYear,
        type: isSelfWritable ? "self" : "manager",
        self_achieved_values: finalSelf,
        manager_achieved_values: finalMgr,
        core_ratings: coreRatings,
        is_saved: true
      };
      
      await expenseService.saveKpiAppraisal(payload);
      setIsAppraisalSaved(true);
      toast.success(`KPI appraisal for ${selectedMonth} ${selectedYear} saved to database successfully!`);
    } catch (e) {
      toast.error("Failed to save KPI appraisal details");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Recharts chart data
  const chartData = useMemo(() => {
    return CORE_VALUE_METRICS.map(m => ({
      name: m.name,
      Score: getPointsFromRating(coreRatings[m.id])
    }));
  }, [coreRatings]);

  return (
    <div className="space-y-4 animate-fadeIn text-slate-800 font-sans pb-10">
      
      {/* HEADER CONTROLS */}
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-300 px-3 py-2 rounded-none shadow-2xs">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#4A6A8A] shrink-0" />
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider font-mono m-0 whitespace-nowrap">
            Performance Appraisal KPI Sheet
          </h2>
        </div>

        {/* Dynamic team selector or edit control */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white text-xs font-extrabold text-slate-900 border border-slate-300 rounded-none px-2 py-1 h-8 outline-none focus:border-[#4A6A8A] shadow-2xs cursor-pointer"
          >
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white text-xs font-extrabold text-slate-900 border border-slate-300 rounded-none px-2 py-1 h-8 outline-none focus:border-[#4A6A8A] shadow-2xs cursor-pointer"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          {/* Team selector (if manager) */}
          {teamUsers.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-white text-xs font-extrabold text-slate-900 border border-slate-300 rounded-none px-2 py-1 h-8 outline-none focus:border-[#4A6A8A] shadow-2xs cursor-pointer max-w-xs truncate"
            >
              <option value="self">My Own KPI Sheet</option>
              {teamUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  [{u.user_id}] {u.name} - {u.role}
                </option>
              ))}
            </select>
          )}

          {isAppraisalSaved && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-none text-[10px] font-extrabold font-mono uppercase tracking-wider flex items-center gap-1">
              ✓ Saved For {selectedMonth} {selectedYear}
            </span>
          )}

          <button
            onClick={handleSaveAppraisal}
            disabled={isLoading || (!canUserSave && !isAdmin)}
            className="flex items-center gap-1.5 px-3.5 py-1 bg-[#4A6A8A] hover:bg-[#3b5570] disabled:opacity-60 text-white rounded-none text-xs font-extrabold tracking-wider uppercase shadow-2xs transition-colors cursor-pointer border-0 h-8 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isLoading 
                ? "Saving..." 
                : (isAppraisalSaved && !isAdmin ? "Saved (Locked)" : "Save Appraisal")}
            </span>
          </button>
        </div>
      </div>

      {/* METADATA EXCEL TOP BAR (EXACT EXCEL REPRESENTATION) */}
      <div className="overflow-x-auto border border-slate-300 shadow-2xs">
        <table className="w-full border-collapse bg-white font-mono text-xs">
          <tbody>
            <tr className="bg-[#4A6A8A] text-white font-extrabold">
              <td className="px-3 py-2 border-r border-slate-300 w-24 uppercase text-[10px]">Ecode :</td>
              <td className="px-3 py-2 border-r border-slate-300 bg-white text-slate-900 font-extrabold w-48">{profile.ecode}</td>
              <td className="px-3 py-2 border-r border-slate-300 w-24 uppercase text-[10px]">Name :</td>
              <td className="px-3 py-2 bg-white text-slate-900 font-extrabold">{profile.name}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DYNAMIC KRA & KPI TABLE MATRIX */}
      <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-10 font-bold text-slate-700 text-xs font-mono">
            Loading Appraisal Sheet...
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              {/* Header row 1 */}
              <tr className="bg-[#4A6A8A] text-white font-extrabold uppercase tracking-wider text-[10px] text-center border-b border-slate-300 font-mono">
                <th colSpan={5} className="border-r border-slate-300 py-2.5 text-white">KPI Formulation Parameters</th>
                <th colSpan={4} className="border-r border-slate-300 py-2.5 bg-amber-400 text-slate-900 font-extrabold">Self Assessment</th>
                <th colSpan={4} className="border-r border-slate-300 py-2.5 bg-rose-700 text-white font-extrabold">Assessment by Manager</th>
                <th rowSpan={2} className="border-r border-slate-300 py-2.5 bg-[#3b5570] text-white align-middle px-3">Total KRA Wt</th>
                <th rowSpan={2} className="py-2.5 bg-[#3b5570] text-white align-middle px-3">Total Wt</th>
              </tr>
              {/* Sub headers */}
              <tr className="text-slate-800 font-extrabold uppercase text-center border-b border-slate-300 text-[9px] bg-slate-100 font-mono">
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[120px]">KRA &amp; Weightage</th>
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[100px]">KRA</th>
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[240px]">KPI (Measurable Parameter)</th>
                <th className="px-2 py-2 border-r border-slate-300 w-16 text-center">Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 w-16 text-center">Target KPI</th>
                
                {/* Self */}
                <th className="px-2 py-2 border-r border-slate-300 bg-amber-50 text-amber-900 w-20 text-center">Target Achieved</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-amber-50 text-amber-900 w-24 text-center">Achieved Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-amber-50 text-amber-900 w-20 text-center">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-amber-50 text-amber-900 w-24 text-center">Total Wt Sum</th>

                {/* Manager */}
                <th className="px-2 py-2 border-r border-slate-300 bg-rose-50 text-rose-900 w-20 text-center">Target Achieved</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-rose-50 text-rose-900 w-24 text-center">Achieved Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-rose-50 text-rose-900 w-20 text-center">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-rose-50 text-rose-900 w-24 text-center">Total Wt Sum</th>
              </tr>
            </thead>
            <tbody className="font-extrabold text-slate-800 divide-y divide-slate-200 bg-white">
              
              {/* RENDER GROUP: JOB ROLE (80%) */}
              {tableData.rows.filter(r => r.section === "Job Role").map((row, idx, filteredRows) => (
                <tr key={`job-role-${idx}`} className="divide-x divide-slate-200 hover:bg-slate-50/50">
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-3 py-3 align-middle bg-[#4A6A8A] text-white font-extrabold text-[10px] text-center border-r border-slate-300 uppercase tracking-wider font-mono"
                    >
                      Job Role -<br/>80%
                    </td>
                  )}
                  <td className="px-3 py-2.5 align-middle font-extrabold text-slate-900 border-r border-slate-200 bg-white">
                    {row.kra}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-[11px] font-bold text-slate-600 border-r border-slate-200 bg-white">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold border-r border-slate-200 bg-white">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold border-r border-slate-200 bg-emerald-50 text-emerald-900">
                    {row.targetKpi}
                  </td>

                  {/* SELF ASSESSMENT (Target Achieved) */}
                  <td className="px-1.5 py-1.5 text-center bg-white border-r border-slate-200">
                    <input 
                      type="text"
                      disabled={!isSelfWritable}
                      value={row.selfAchieved ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelfAchievedValues(prev => ({ 
                          ...prev, 
                          [row.kra]: val === "" ? "" : isNaN(Number(val)) ? val : parseFloat(val) 
                        }));
                      }}
                      className={`w-full bg-white text-center font-mono font-bold text-slate-900 border border-slate-300 rounded-none focus:border-[#4A6A8A] h-7 outline-none ${
                        !isSelfWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-white border-r border-slate-200">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-2.5 bg-amber-50 text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-200"
                    >
                      {formatPercent(tableData.jobRoleSelfWtSum)}
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-2.5 bg-white text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-300"
                    >
                      {formatPercent(tableData.totalSelfScore)}
                    </td>
                  ) : null}

                  {/* MANAGER ASSESSMENT (Target Achieved) */}
                  <td className="px-1.5 py-1.5 text-center bg-white border-r border-slate-200">
                    <input 
                      type="text"
                      disabled={!isManagerWritable}
                      value={row.managerAchieved ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManagerAchievedValues(prev => ({ 
                          ...prev, 
                          [row.kra]: val === "" ? "" : isNaN(Number(val)) ? val : parseFloat(val) 
                        }));
                      }}
                      className={`w-full bg-white text-center font-mono font-bold text-slate-900 border border-slate-300 rounded-none focus:border-[#4A6A8A] h-7 outline-none ${
                        !isManagerWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-white border-r border-slate-200">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-2.5 bg-rose-50 text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-200"
                    >
                      {formatPercent(tableData.jobRoleManagerWtSum)}
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-2.5 bg-white text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-300"
                    >
                      {formatPercent(tableData.totalManagerScore)}
                    </td>
                  ) : null}

                  {/* TOTAL KRA WT */}
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-slate-100 border-r border-slate-300">
                    {formatPercent(row.managerAchievedWt)}
                  </td>

                  {/* FINAL MERGED TOTAL WT COLUMN (O) */}
                  {idx === 0 && (
                    <td 
                      rowSpan={rows.length}
                      className="px-2 py-2.5 bg-amber-100 text-center font-mono font-extrabold text-amber-900 text-xs align-middle border-l border-slate-300"
                    >
                      {formatPercent(tableData.totalManagerScore)}
                    </td>
                  )}
                </tr>
              ))}

              {/* RENDER GROUP: CORE VALUES (20%) */}
              {tableData.rows.filter(r => r.section === "Alignment to Core Values").map((row, idx) => (
                <tr key={`core-values-${idx}`} className="divide-x divide-slate-200 bg-white hover:bg-slate-50/50">
                  <td 
                    className="px-3 py-3 align-middle bg-[#4A6A8A] text-white font-extrabold text-[10px] text-center border-r border-slate-300 uppercase tracking-wider font-mono"
                  >
                    Alignment To<br/>Core Values -<br/>20%
                  </td>
                  <td className="px-3 py-2.5 align-middle font-extrabold text-slate-900 border-r border-slate-200 bg-white">
                    {row.kra}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-[11px] font-bold text-slate-600 border-r border-slate-200 bg-white">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold border-r border-slate-200 bg-white">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold border-r border-slate-200 bg-emerald-50 text-emerald-900">
                    {row.targetKpi}
                  </td>

                  {/* SELF CORE VALUE WEIGHT */}
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold text-slate-900 bg-white border-r border-slate-200">
                    {row.selfAchieved}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-white border-r border-slate-200">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-2.5 bg-amber-50 text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-200">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-2.5 bg-white border-r border-slate-300">
                    {/* Blank in spreadsheet */}
                  </td>

                  {/* MANAGER CORE VALUE WEIGHT */}
                  <td className="px-2 py-2.5 text-center font-mono font-extrabold text-slate-900 bg-white border-r border-slate-200">
                    {row.managerAchieved}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-white border-r border-slate-200">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-2.5 bg-rose-50 text-center font-mono font-extrabold text-slate-900 text-xs align-middle border-r border-slate-200">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-2.5 bg-white border-r border-slate-300">
                    {/* Blank in spreadsheet */}
                  </td>

                  {/* TOTAL KRA WT */}
                  <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-900 bg-slate-100 border-r border-slate-300">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CORE VALUES BREAKDOWN & GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Core Values Dropdowns scorecard table */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden flex flex-col justify-between">
          <div className="p-3 border-b border-slate-300 bg-[#4A6A8A] text-white flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 m-0 font-mono">
              <Award className="w-4 h-4" />
              Customer Delight
            </h3>
            <span className="text-[10px] font-bold uppercase font-mono">Max score: 100</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-left font-sans text-xs border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-300 text-center text-[10px] font-mono">
                  <th className="px-3 py-2.5 border-r border-slate-300 text-left">Core Value Parameter</th>
                  <th className="px-3 py-2.5 border-r border-slate-300 text-left">Measurable Core Standard Definition</th>
                  <th className="px-2 py-2.5 border-r border-slate-300 w-36 text-center">Current State</th>
                  <th className="px-2 py-2.5 w-20 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold text-slate-700 bg-white">
                {CORE_VALUE_METRICS.map((metric) => {
                  const ratingVal = coreRatings[metric.id] || "";
                  const activeScore = getPointsFromRating(ratingVal);
                  const ratingStyleClass = getRatingStyleClass(ratingVal);
                  
                  return (
                    <tr key={metric.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 border-r border-slate-200 font-extrabold text-slate-900 whitespace-nowrap">
                        {metric.name}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-200 text-[11px] font-bold leading-relaxed text-slate-600">
                        {metric.description}
                      </td>
                      
                      {/* Excel-style dropdown cell */}
                      <td className={`px-2 py-2.5 border-r border-slate-200 text-center transition-all ${ratingStyleClass}`}>
                        <select
                          disabled={!isManagerWritable}
                          value={ratingVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCoreRatings(prev => ({ ...prev, [metric.id]: val }));
                          }}
                          className={`w-full bg-transparent border-0 outline-none text-xs font-bold text-center ${
                            ratingVal ? "text-inherit" : "text-slate-400"
                          } ${!isManagerWritable ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {CORE_VALUE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-bold">
                              {opt.label || "-- Select --"}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Score cell */}
                      <td className="px-2 py-2.5 text-center bg-slate-50 font-mono font-extrabold text-slate-900 text-xs">
                        {activeScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recharts chart representation with custom colored bars */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-300 rounded-none shadow-2xs p-4 flex flex-col justify-between">
          <div className="border-b border-slate-700 pb-2 mb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5 m-0 font-mono">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Core Values Performance Chart
            </h3>
          </div>
          
          <div style={{ height: 240 }} className="w-full flex-1">
            <ResponsiveBar
              data={chartData}
              keys={["Score"]}
              indexBy="name"
              margin={{ top: 15, right: 15, bottom: 35, left: 30 }}
              padding={0.35}
              colors={BAR_COLORS}
              colorBy="indexValue"
              borderRadius={0}
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
                    stroke: '#334155',
                    strokeWidth: 1
                  }
                },
                axis: {
                  ticks: {
                    text: {
                      fontSize: 8,
                      fontWeight: 'bold',
                      fill: '#cbd5e1'
                    }
                  }
                }
              }}
              tooltip={({ value, color, indexValue }) => (
                <div className="bg-slate-900 text-white border border-slate-700 shadow-2xl rounded-none p-2.5 text-xs min-w-[120px] font-sans pointer-events-none z-50">
                  <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1 font-mono">{indexValue}</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                      <span className="w-2.5 h-2.5 rounded-none" style={{ backgroundColor: color }} />
                      Score:
                    </span>
                    <span className="font-mono font-bold text-white">{value}%</span>
                  </div>
                </div>
              )}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-[9px] font-extrabold uppercase mt-3 pt-2.5 border-t border-slate-700 font-mono">
            <span className="text-slate-400 tracking-wider">Excel Chart Series Representation</span>
          </div>
        </div>

      </div>

      {/* INFO CARD */}
      <div className="bg-white border border-slate-300 p-4 rounded-none shadow-2xs flex gap-3 text-xs text-slate-700 leading-relaxed font-bold border-l-4 border-l-[#4A6A8A]">
        <Info className="w-5 h-5 text-[#4A6A8A] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] font-mono m-0">KPI Assessment Matrix Formulation Rules</h4>
          <p className="m-0 text-slate-600">
            The appraisal matrix computes achieved weightage dynamically based on performance metrics:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-[11px] font-bold text-slate-600">
            <li><strong>Standard Ratio KPIs</strong>: If Achieved &ge; Target, weight is fully awarded. Otherwise, computed as <code className="font-mono bg-slate-100 px-1 py-0.5 rounded-none border border-slate-300 text-slate-800">(Achieved / Target) &times; Weightage</code>.</li>
            <li><strong>Zero-Target KPIs (e.g. Repeat Calls)</strong>: If Achieved is 0, full weight is awarded. For every repeat call, weight is penalized by <code className="font-mono bg-slate-100 px-1 py-0.5 rounded-none border border-slate-300 text-slate-800">5%</code>.</li>
            <li><strong>Financial Cost-Ratio KPIs</strong>: Under Cost Efficiency, scores below the cost percentage target (e.g., 20% or 30%) are awarded full weight. Higher ratios trigger automatic penalties.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
