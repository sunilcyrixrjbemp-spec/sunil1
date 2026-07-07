import { useState, useEffect, useMemo } from "react";
import { 
  Gauge, 
  Award, 
  TrendingUp, 
  Info,
  Save,
  Users
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
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

  // Fetch team users if manager
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

  // Read-only logic:
  // Employee can only edit Self Assessment. Manager can only edit Manager Assessment.
  const isSelfWritable = selectedUserId === "self";
  const isManagerWritable = selectedUserId !== "self";

  // Template row configs
  const rows = useMemo(() => {
    if (activeTemplate === "engineer") return ENGINEER_KPIS;
    if (activeTemplate === "tl") return TL_KPIS;
    return DIV_MGR_KPIS;
  }, [activeTemplate]);

  // Score states (undefined/empty by default!)
  const [selfAchievedValues, setSelfAchievedValues] = useState<Record<string, number | string>>({});
  const [managerAchievedValues, setManagerAchievedValues] = useState<Record<string, number | string>>({});

  // Core Value ratings (empty selection "" by default!)
  const [selfCoreRatings, setSelfCoreRatings] = useState<Record<string, string>>({
    continuous_learning: "",
    building_relationships: "",
    trust: "",
    care: "",
    speed_of_response: ""
  });

  const [managerCoreRatings, setManagerCoreRatings] = useState<Record<string, string>>({
    continuous_learning: "",
    building_relationships: "",
    trust: "",
    care: "",
    speed_of_response: ""
  });

  // Reset/Clear scoring matrices when template or active user changes
  useEffect(() => {
    const defaultVals: Record<string, number | string> = {};
    rows.forEach(r => {
      defaultVals[r.kra] = "";
    });
    setSelfAchievedValues(defaultVals);
    setManagerAchievedValues(defaultVals);
    setSelfCoreRatings({
      continuous_learning: "",
      building_relationships: "",
      trust: "",
      care: "",
      speed_of_response: ""
    });
    setManagerCoreRatings({
      continuous_learning: "",
      building_relationships: "",
      trust: "",
      care: "",
      speed_of_response: ""
    });
  }, [rows, selectedUserId]);

  // Translate ratings to scores
  const getPointsFromRating = (rating: string) => {
    const match = CORE_VALUE_OPTIONS.find(o => o.value === rating);
    return match ? match.points : 0;
  };

  // Dynamic average sum of core value points (Sum of 5 parameters / 5 = average out of 100)
  const selfDelightTotal = useMemo(() => {
    const sum = Object.values(selfCoreRatings).reduce((acc, r) => acc + getPointsFromRating(r), 0);
    return Math.round(sum / 5);
  }, [selfCoreRatings]);

  const managerDelightTotal = useMemo(() => {
    const sum = Object.values(managerCoreRatings).reduce((acc, r) => acc + getPointsFromRating(r), 0);
    return Math.round(sum / 5);
  }, [managerCoreRatings]);

  // Synchronize Core Values rating average to Customer Delight KRA
  useEffect(() => {
    setSelfAchievedValues(prev => ({
      ...prev,
      "Customer Delight": selfDelightTotal
    }));
  }, [selfDelightTotal]);

  useEffect(() => {
    setManagerAchievedValues(prev => ({
      ...prev,
      "Customer Delight": managerDelightTotal
    }));
  }, [managerDelightTotal]);

  // Compute achieved weightage and total matrix sums
  const tableData = useMemo(() => {
    let jobRoleSelfWtSum = 0;
    let jobRoleManagerWtSum = 0;

    let valuesSelfWtSum = 0;
    let valuesManagerWtSum = 0;

    const mapped = rows.map(r => {
      const selfVal = selfAchievedValues[r.kra];
      const managerVal = managerAchievedValues[r.kra];

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
  }, [rows, selfAchievedValues, managerAchievedValues]);

  // Format display helper for weights/percentages in Excel style
  const formatPercent = (val: number | string | undefined) => {
    const num = parseFloat(String(val)) || 0;
    return `${num.toFixed(2)}%`;
  };

  const handleSaveAssessment = () => {
    toast.success("KPI appraisal details saved successfully!");
  };

  // Recharts chart data (based on the active user assessment role)
  const chartData = useMemo(() => {
    const activeRatings = isSelfWritable ? selfCoreRatings : managerCoreRatings;
    return CORE_VALUE_METRICS.map(m => ({
      name: m.name,
      Score: getPointsFromRating(activeRatings[m.id])
    }));
  }, [selfCoreRatings, managerCoreRatings, isSelfWritable]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800 font-sans pb-10">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-600" />
            Performance Appraisal KPI Sheet
          </h2>
          <p className="text-slate-500 text-xs font-semibold">
            Standard corporate performance scorecards with direct Manager assessment portals.
          </p>
        </div>

        {/* Dynamic team selector or edit control */}
        <div className="flex items-center gap-3">
          {teamUsers.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Users className="w-4 h-4 text-slate-500" />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none pr-4 cursor-pointer"
              >
                <option value="self">My Own KPI Sheet</option>
                {teamUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    [{u.user_id}] {u.name} - {u.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleSaveAssessment}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide uppercase shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            Save Appraisal
          </button>
        </div>
      </div>

      {/* METADATA EXCEL TOP BAR (EXACT EXCEL REPRESENTATION) */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-slate-400 bg-white font-mono text-xs">
          <tbody>
            <tr className="bg-[#404040] text-white font-bold">
              <td className="px-3 py-1.5 border border-slate-400 w-24">Ecode :</td>
              <td className="px-3 py-1.5 border border-slate-400 bg-white text-slate-800 font-extrabold w-48">{profile.ecode}</td>
              <td className="px-3 py-1.5 border border-slate-400 w-24">Name :</td>
              <td className="px-3 py-1.5 border border-slate-400 bg-white text-slate-800 font-extrabold">{profile.name}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* DYNAMIC KRA & KPI TABLE MATRIX */}
      <div className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              {/* Header row 1 */}
              <tr className="bg-[#404040] text-white font-bold uppercase tracking-wider text-[10px] text-center border-b border-slate-400">
                <th colSpan={5} className="border-r border-slate-400 py-3">KPI Formulation Parameters</th>
                <th colSpan={4} className="border-r border-slate-400 py-3 bg-[#ffd966] text-slate-900 font-black">Self Assessment</th>
                <th colSpan={4} className="border-r border-slate-400 py-3 bg-[#c00000] text-white font-black">Assessment by Manager</th>
                <th rowSpan={2} className="border-r border-slate-400 py-3.5 bg-[#1f4e78] text-white align-middle px-3">Total KRA Wt</th>
                <th rowSpan={2} className="py-3.5 bg-[#1f4e78] text-white align-middle px-3">Total Wt</th>
              </tr>
              {/* Sub headers */}
              <tr className="text-slate-700 font-black uppercase text-center border-b border-slate-400 text-[9px]">
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[120px] bg-slate-100">KRA& Weightage</th>
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[100px] bg-slate-100">KRA</th>
                <th className="px-3 py-2 border-r border-slate-300 text-left min-w-[240px] bg-slate-100">KPI (Mesurable Parameter)</th>
                <th className="px-2 py-2 border-r border-slate-300 w-16 bg-slate-100 text-center">Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 w-16 bg-slate-100 text-center">Target KPI</th>
                
                {/* Self */}
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fff2cc] text-amber-900 w-20 text-center">Target Achieved</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fff2cc] text-amber-900 w-24 text-center">Achieved Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fff2cc] text-amber-900 w-20 text-center">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-400 bg-[#fff2cc] text-amber-900 w-24 text-center">Total Wt Sum</th>

                {/* Manager */}
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fce4d6] text-rose-900 w-20 text-center">Target Achieved</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fce4d6] text-rose-900 w-24 text-center">Achieved Weightage</th>
                <th className="px-2 py-2 border-r border-slate-300 bg-[#fce4d6] text-rose-900 w-20 text-center">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-400 bg-[#fce4d6] text-rose-900 w-24 text-center">Total Wt Sum</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-700 divide-y divide-slate-300">
              
              {/* RENDER GROUP: JOB ROLE (80%) */}
              {tableData.rows.filter(r => r.section === "Job Role").map((row, idx, filteredRows) => (
                <tr key={`job-role-${idx}`} className="divide-x divide-slate-300">
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-3 py-3 align-middle bg-[#2f3c24] text-white font-black text-[10px] text-center border-r border-slate-300"
                    >
                      Job Role -<br/>80%
                    </td>
                  )}
                  <td className="px-3 py-3 align-middle font-bold text-slate-900 border-r border-slate-300 bg-white">
                    {row.kra}
                  </td>
                  <td className="px-3 py-3 align-middle text-[11px] leading-relaxed text-slate-500 border-r border-slate-300 bg-white">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold border-r border-slate-300 bg-white">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold border-r border-slate-300 bg-[#e2efda]">
                    {row.targetKpi}
                  </td>

                  {/* SELF ASSESSMENT (Target Achieved) */}
                  <td className="px-2 py-3 text-center bg-white border-r border-slate-300">
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
                      className={`w-full bg-white text-center font-mono font-black text-slate-800 outline-none ${
                        !isSelfWritable ? "opacity-75 cursor-not-allowed" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-white border-r border-slate-300">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 bg-[#d9e1f2] text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-300"
                    >
                      {formatPercent(tableData.jobRoleSelfWtSum)}
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 bg-white text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-400"
                    >
                      {formatPercent(tableData.jobRoleSelfWtSum)}
                    </td>
                  ) : null}

                  {/* MANAGER ASSESSMENT (Target Achieved) */}
                  <td className="px-2 py-3 text-center bg-white border-r border-slate-300">
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
                      className={`w-full bg-white text-center font-mono font-black text-slate-800 outline-none ${
                        !isManagerWritable ? "opacity-75 cursor-not-allowed" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-white border-r border-slate-300">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 bg-[#d9e1f2] text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-300"
                    >
                      {formatPercent(tableData.jobRoleManagerWtSum)}
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 bg-white text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-400"
                    >
                      {formatPercent(tableData.jobRoleManagerWtSum)}
                    </td>
                  ) : null}

                  {/* TOTAL KRA WT */}
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-[#b4c6e7] border-r border-slate-400">
                    {formatPercent(row.managerAchievedWt)}
                  </td>

                  {/* FINAL MERGED TOTAL WT COLUMN (O) */}
                  {idx === 0 && (
                    <td 
                      rowSpan={rows.length}
                      className="px-2 py-3 bg-[#f8cbad] text-center font-mono font-black text-red-900 text-xs align-middle"
                    >
                      {formatPercent(tableData.totalManagerScore)}
                    </td>
                  )}
                </tr>
              ))}

              {/* RENDER GROUP: CORE VALUES (20%) */}
              {tableData.rows.filter(r => r.section === "Alignment to Core Values").map((row, idx) => (
                <tr key={`core-values-${idx}`} className="divide-x divide-slate-300 bg-white">
                  <td 
                    className="px-3 py-3 align-middle bg-[#2f3c24] text-white font-black text-[10px] text-center border-r border-slate-300"
                  >
                    Alignment To<br/>Core Values -<br/>20%
                  </td>
                  <td className="px-3 py-3 align-middle font-bold text-slate-900 border-r border-slate-300 bg-white">
                    {row.kra}
                  </td>
                  <td className="px-3 py-3 align-middle text-[11px] leading-relaxed text-slate-500 border-r border-slate-300 bg-white">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold border-r border-slate-300 bg-white">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold border-r border-slate-300 bg-[#e2efda]">
                    {row.targetKpi}
                  </td>

                  {/* SELF CORE VALUE WEIGHT */}
                  <td className="px-2 py-3 text-center font-mono font-black text-slate-800 bg-white border-r border-slate-300">
                    {row.selfAchieved}
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-white border-r border-slate-300">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-3 bg-[#d9e1f2] text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-300">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-3 bg-white border-r border-slate-400">
                    {/* Blank in spreadsheet */}
                  </td>

                  {/* MANAGER CORE VALUE WEIGHT */}
                  <td className="px-2 py-3 text-center font-mono font-black text-slate-800 bg-white border-r border-slate-300">
                    {row.managerAchieved}
                  </td>
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-white border-r border-slate-300">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-3 bg-[#d9e1f2] text-center font-mono font-black text-slate-900 text-xs align-middle border-r border-slate-300">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-3 bg-white border-r border-slate-400">
                    {/* Blank in spreadsheet */}
                  </td>

                  {/* TOTAL KRA WT */}
                  <td className="px-2 py-3 text-center font-mono font-bold text-slate-800 bg-[#b4c6e7] border-r border-slate-400">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CORE VALUES BREAKDOWN & GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Core Values Dropdowns scorecard table */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-3 border-b border-slate-300 bg-[#385723] text-white flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Customer Delight
            </h3>
            <span className="text-[10px] font-bold uppercase">Max score: 100</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-left font-sans text-xs border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-300 text-center">
                  <th className="px-3 py-2.5 border-r border-slate-300 text-left">Core Value Parameter</th>
                  <th className="px-3 py-2.5 border-r border-slate-300 text-left">Measurable Core Standard Definition</th>
                  <th className="px-2 py-2.5 border-r border-slate-300 w-36 text-center">Current State</th>
                  <th className="px-2 py-2.5 w-20 text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-semibold text-slate-600 bg-white">
                {CORE_VALUE_METRICS.map((metric) => {
                  const ratingVal = isSelfWritable ? (selfCoreRatings[metric.id] || "") : (managerCoreRatings[metric.id] || "");
                  const activeScore = getPointsFromRating(ratingVal);
                  const ratingStyleClass = getRatingStyleClass(ratingVal);
                  
                  return (
                    <tr key={metric.id} className="hover:bg-slate-50/30">
                      <td className="px-3 py-3 border-r border-slate-300 font-bold text-slate-800 whitespace-nowrap">
                        {metric.name}
                      </td>
                      <td className="px-3 py-3 border-r border-slate-300 text-[11px] leading-relaxed text-slate-500">
                        {metric.description}
                      </td>
                      
                      {/* Excel-style dropdown cell with conditional background coloring */}
                      <td className={`px-2 py-3 border-r border-slate-300 text-center transition-all ${ratingStyleClass}`}>
                        <select
                          disabled={!isSelfWritable && !isManagerWritable}
                          value={ratingVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isSelfWritable) {
                              setSelfCoreRatings(prev => ({ ...prev, [metric.id]: val }));
                            } else {
                              setManagerCoreRatings(prev => ({ ...prev, [metric.id]: val }));
                            }
                          }}
                          className={`w-full bg-transparent border-0 outline-none text-xs font-bold cursor-pointer text-center ${
                            ratingVal ? "text-inherit" : "text-slate-400"
                          }`}
                        >
                          {CORE_VALUE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-semibold">
                              {opt.label || "-- Select --"}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Score cell (default 0) */}
                      <td className="px-2 py-3 text-center bg-slate-50 font-mono font-bold text-slate-800 text-sm">
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
        <div className="lg:col-span-5 bg-[#404040] border border-slate-300 rounded shadow-sm p-4 flex flex-col justify-between">
          <div className="border-b border-[#555] pb-2 mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#ffd966]" />
              Core Values Performance Chart
            </h3>
          </div>
          
          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#555" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: "#ccc", fontSize: 7, fontWeight: 700 }}
                  axisLine={{ stroke: "#666" }}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: "#ccc", fontSize: 8, fontWeight: 700 }}
                  axisLine={{ stroke: "#666" }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#fff", fontSize: "10px", fontWeight: "bold" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "9px", fontWeight: "extrabold", textTransform: "uppercase" }}
                />
                <Bar dataKey="Score" radius={[2, 2, 0, 0]} barSize={20}>
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase mt-3 pt-3 border-t border-[#555]">
            <span className="text-white tracking-widest">Excel Chart Series Representation</span>
          </div>
        </div>

      </div>

      {/* INFO CARD */}
      <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex gap-3 text-xs text-slate-600 leading-relaxed font-semibold">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">KPI Assessment Matrix Formulation Rules</h4>
          <p>
            The appraisal matrix computes achieved weightage dynamically based on performance metrics:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1 text-[11px] font-bold text-slate-500">
            <li><strong>Standard Ratio KPIs</strong>: If Achieved &ge; Target, weight is fully awarded. Otherwise, computed as <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-700">(Achieved / Target) &times; Weightage</code>.</li>
            <li><strong>Zero-Target KPIs (e.g. Repeat Calls)</strong>: If Achieved is 0, full weight is awarded. For every repeat call, weight is penalized by <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-700">5%</code>.</li>
            <li><strong>Financial Cost-Ratio KPIs</strong>: Under Cost Efficiency, scores below the cost percentage target (e.g., 20% or 30%) are awarded full weight. Higher ratios trigger automatic penalties.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
