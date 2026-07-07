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
  ResponsiveContainer
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

// Dropdown options for Core Values
const CORE_VALUE_OPTIONS = [
  { label: "-- Select Rating --", value: "", points: 0 },
  { label: "Excellent (20 pts)", value: "Excellent", points: 20 },
  { label: "Very Good (16 pts)", value: "Very Good", points: 16 },
  { label: "Good (12 pts)", value: "Good", points: 12 },
  { label: "Satisfactory (8 pts)", value: "Satisfactory", points: 8 },
  { label: "Poor (4 pts)", value: "Poor", points: 4 },
  { label: "Bad (0 pts)", value: "Bad", points: 0 }
];

interface KpiRow {
  section: "Job Role" | "Alignment to Core Values";
  kra: string;
  kpi: string;
  weightage: number; // percentage (e.g. 25 for 25%)
  targetKpi: number;
  calculateAchievedWt: (achieved: number | string | undefined, target: number, weight: number) => number | string;
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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
      if (achieved === undefined || achieved === "") return "";
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

  // Check if at least one core rating is set
  const isAnySelfRatingSet = useMemo(() => {
    return Object.values(selfCoreRatings).some(v => v !== "");
  }, [selfCoreRatings]);

  const isAnyManagerRatingSet = useMemo(() => {
    return Object.values(managerCoreRatings).some(v => v !== "");
  }, [managerCoreRatings]);

  // Dynamic sum of core value points
  const selfDelightTotal = useMemo(() => {
    if (!isAnySelfRatingSet) return "";
    return Object.values(selfCoreRatings).reduce((sum, r) => sum + getPointsFromRating(r), 0);
  }, [selfCoreRatings, isAnySelfRatingSet]);

  const managerDelightTotal = useMemo(() => {
    if (!isAnyManagerRatingSet) return "";
    return Object.values(managerCoreRatings).reduce((sum, r) => sum + getPointsFromRating(r), 0);
  }, [managerCoreRatings, isAnyManagerRatingSet]);

  // Synchronize Core Values rating totals to Customer Delight KRA
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
    let hasAnyJobSelf = false;
    let hasAnyJobManager = false;

    let valuesSelfWtSum = 0;
    let valuesManagerWtSum = 0;
    let hasAnyValSelf = false;
    let hasAnyValManager = false;

    const mapped = rows.map(r => {
      const selfVal = selfAchievedValues[r.kra];
      const managerVal = managerAchievedValues[r.kra];

      const selfWt = r.calculateAchievedWt(selfVal, r.targetKpi, r.weightage);
      const managerWt = r.calculateAchievedWt(managerVal, r.targetKpi, r.weightage);

      if (r.section === "Job Role") {
        if (selfWt !== "") {
          jobRoleSelfWtSum += parseFloat(String(selfWt)) || 0;
          hasAnyJobSelf = true;
        }
        if (managerWt !== "") {
          jobRoleManagerWtSum += parseFloat(String(managerWt)) || 0;
          hasAnyJobManager = true;
        }
      } else {
        if (selfWt !== "") {
          valuesSelfWtSum += parseFloat(String(selfWt)) || 0;
          hasAnyValSelf = true;
        }
        if (managerWt !== "") {
          valuesManagerWtSum += parseFloat(String(managerWt)) || 0;
          hasAnyValManager = true;
        }
      }

      return {
        ...r,
        selfAchieved: selfVal,
        selfAchievedWt: selfWt,
        managerAchieved: managerVal,
        managerAchievedWt: managerWt
      };
    });

    const overallSelf = (hasAnyJobSelf || hasAnyValSelf) ? (jobRoleSelfWtSum + valuesSelfWtSum) : "";
    const overallManager = (hasAnyJobManager || hasAnyValManager) ? (jobRoleManagerWtSum + valuesManagerWtSum) : "";

    return {
      rows: mapped,
      jobRoleSelfWtSum: hasAnyJobSelf ? jobRoleSelfWtSum : "",
      jobRoleManagerWtSum: hasAnyJobManager ? jobRoleManagerWtSum : "",
      valuesSelfWtSum: hasAnyValSelf ? valuesSelfWtSum : "",
      valuesManagerWtSum: hasAnyValManager ? valuesManagerWtSum : "",
      totalSelfScore: overallSelf,
      totalManagerScore: overallManager
    };
  }, [rows, selfAchievedValues, managerAchievedValues]);

  // Format display helper for weights/percentages in Excel style
  const formatPercent = (val: number | string | undefined) => {
    if (val === undefined || val === "") return "";
    return `${parseFloat(String(val)).toFixed(2)}%`;
  };

  const handleSaveAssessment = () => {
    toast.success("KPI Sheet details saved successfully!");
  };

  // Recharts chart data
  const chartData = useMemo(() => {
    return CORE_VALUE_METRICS.map(m => ({
      name: m.name,
      Self: getPointsFromRating(selfCoreRatings[m.id]),
      Manager: getPointsFromRating(managerCoreRatings[m.id])
    }));
  }, [selfCoreRatings, managerCoreRatings]);

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

      {/* METADATA EXCEL TOP BAR */}
      <div className="bg-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-bold font-mono">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">E-Code</span>
          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-extrabold text-xs">
            {profile.ecode}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Employee Name</span>
          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-extrabold text-xs">
            {profile.name}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Designation</span>
          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-extrabold text-xs">
            {profile.role}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Zone</span>
          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-extrabold text-xs">
            {profile.zone}
          </div>
        </div>
        <div className="space-y-1 col-span-2 md:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">District</span>
          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-extrabold text-xs">
            {profile.district}
          </div>
        </div>
      </div>

      {/* DYNAMIC KRA & KPI TABLE MATRIX */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              {/* Header row 1 */}
              <tr className="bg-slate-800 text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-700 text-center">
                <th colSpan={5} className="border-r border-slate-700 py-3.5">KPI Formulation Parameters</th>
                <th colSpan={4} className="border-r border-slate-700 py-3 bg-amber-600 text-white">Self Assessment</th>
                <th colSpan={4} className="border-r border-slate-700 py-3 bg-rose-600 text-white">Assessment by Manager</th>
                <th rowSpan={2} className="border-r border-slate-700 py-3.5 bg-teal-800 text-white align-middle px-3">Total KRA Wt</th>
                <th rowSpan={2} className="py-3.5 bg-red-800 text-white align-middle px-3">Total Wt</th>
              </tr>
              {/* Sub headers */}
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-center">
                <th className="px-4 py-2.5 border-r border-slate-200 text-left min-w-[120px]">KRA & Weightage</th>
                <th className="px-4 py-2.5 border-r border-slate-200 text-left min-w-[120px]">KRA</th>
                <th className="px-4 py-2.5 border-r border-slate-200 text-left min-w-[260px]">KPI (Mesurable Parameter)</th>
                <th className="px-2 py-2.5 border-r border-slate-200 w-16">Weightage</th>
                <th className="px-2 py-2.5 border-r border-slate-200 w-16">Target KPI</th>
                
                {/* Self */}
                <th className="px-2 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-900 w-20">Target Achieved</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-900 w-24">Achieved Weightage</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-900 w-20">Total Wt</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-900 w-24">Total Wt Sum</th>

                {/* Manager */}
                <th className="px-2 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-900 w-20">Target Achieved</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-900 w-24">Achieved Weightage</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-900 w-20">Total Wt</th>
                <th className="px-2 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-900 w-24">Total Wt Sum</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-700 divide-y divide-slate-200">
              
              {/* RENDER GROUP: JOB ROLE (80%) */}
              {tableData.rows.filter(r => r.section === "Job Role").map((row, idx, filteredRows) => (
                <tr key={`job-role-${idx}`} className="hover:bg-slate-50/50">
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-4 py-3 border-r border-slate-200 align-middle bg-slate-50/80 font-black text-slate-800 text-[11px] text-center border-b"
                    >
                      Job Role -<br/>80%
                    </td>
                  )}
                  <td className="px-4 py-3 border-r border-slate-200 align-middle font-bold text-slate-900">
                    {row.kra}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200 align-middle text-[11px] leading-relaxed text-slate-500">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.targetKpi}
                  </td>

                  {/* SELF ASSESSMENT (Target Achieved) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center">
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
                      className={`w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-center font-mono font-bold text-slate-800 outline-none shadow-sm focus:border-amber-500 ${
                        !isSelfWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center font-mono font-bold text-amber-700">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center font-mono font-bold text-amber-700">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-amber-100/30 text-center font-mono font-black text-amber-950 text-xs align-middle"
                    >
                      {formatPercent(tableData.jobRoleSelfWtSum)}
                    </td>
                  )}

                  {/* MANAGER ASSESSMENT (Target Achieved) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center">
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
                      className={`w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-center font-mono font-bold text-slate-800 outline-none shadow-sm focus:border-rose-500 ${
                        !isManagerWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                      }`}
                      placeholder=""
                    />
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center font-mono font-bold text-rose-700">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center font-mono font-bold text-rose-700">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-rose-100/30 text-center font-mono font-black text-rose-950 text-xs align-middle"
                    >
                      {formatPercent(tableData.jobRoleManagerWtSum)}
                    </td>
                  )}
                </tr>
              ))}

              {/* RENDER GROUP: CORE VALUES (20%) */}
              {tableData.rows.filter(r => r.section === "Alignment to Core Values").map((row, idx, filteredRows) => (
                <tr key={`core-values-${idx}`} className="hover:bg-slate-50/50 bg-slate-50/30">
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-4 py-3 border-r border-slate-200 align-middle bg-slate-100/80 font-black text-slate-800 text-[11px] text-center"
                    >
                      Alignment To<br/>Core Values -<br/>20%
                    </td>
                  )}
                  <td className="px-4 py-3 border-r border-slate-200 align-middle font-bold text-slate-900">
                    {row.kra}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200 align-middle text-[11px] leading-relaxed text-slate-500">
                    {row.kpi}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.weightage}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.targetKpi}
                  </td>

                  {/* SELF CORE VALUE WEIGHT (derived from dropdown scorecard total) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center font-mono font-black text-slate-700">
                    {row.selfAchieved}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center font-mono font-bold text-amber-700">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center font-mono font-bold text-amber-700">
                    {formatPercent(row.selfAchievedWt)}
                  </td>
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-amber-100/30 text-center font-mono font-black text-amber-950 text-xs align-middle"
                    >
                      {formatPercent(tableData.valuesSelfWtSum)}
                    </td>
                  )}

                  {/* MANAGER CORE VALUE WEIGHT (derived) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center font-mono font-black text-slate-700">
                    {row.managerAchieved}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center font-mono font-bold text-rose-700">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/10 text-center font-mono font-bold text-rose-700">
                    {formatPercent(row.managerAchievedWt)}
                  </td>
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-rose-100/30 text-center font-mono font-black text-rose-950 text-xs align-middle"
                    >
                      {formatPercent(tableData.valuesManagerWtSum)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {/* Table total footer */}
            <tfoot className="border-t-2 border-slate-800 text-[11px] font-black uppercase text-center bg-slate-900 text-white">
              <tr className="divide-x divide-slate-800">
                <td colSpan={5} className="py-3.5 px-4 text-left font-black tracking-wide text-xs">
                  Overall Weighted Totals Matrix
                </td>
                
                {/* Self Total Weight */}
                <td colSpan={3} className="bg-amber-700 py-3.5 text-center font-mono text-xs">Self Score</td>
                <td className="bg-amber-800 font-mono text-xs py-3.5 px-1">{formatPercent(tableData.totalSelfScore)}</td>
                
                {/* Manager Total Weight */}
                <td colSpan={3} className="bg-rose-700 py-3.5 text-center font-mono text-xs">Mgr Score</td>
                <td className="bg-rose-800 font-mono text-xs py-3.5 px-1">{formatPercent(tableData.totalManagerScore)}</td>

                {/* Final Total KRA Weight (Green Accent) */}
                <td className="bg-teal-900 font-mono text-xs py-3.5 px-1">
                  {formatPercent(tableData.totalSelfScore)}
                </td>

                {/* Final Total Weight (Red/Crimson Accent) */}
                <td className="bg-red-950 font-mono text-xs py-3.5 px-1">
                  {formatPercent(tableData.totalManagerScore)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CORE VALUES BREAKDOWN & GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Core Values Dropdowns scorecard table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              Core Value Assessment: Customer Delight
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Max Score Sum: 100</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <th className="px-4 py-3 border-r border-slate-200">Core Value Parameter</th>
                  <th className="px-4 py-3 border-r border-slate-200">Measurable Core Standard Definition</th>
                  <th className="px-2 py-3 border-r border-slate-200 text-center w-40 bg-amber-50 text-amber-900">Self Score</th>
                  <th className="px-2 py-3 text-center w-40 bg-rose-50 text-rose-900">Manager Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-semibold text-slate-600">
                {CORE_VALUE_METRICS.map((metric) => (
                  <tr key={metric.id} className="hover:bg-slate-50/30">
                    <td className="px-4 py-3.5 border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                      {metric.name}
                    </td>
                    <td className="px-4 py-3.5 border-r border-slate-200 text-[11px] leading-relaxed text-slate-500">
                      {metric.description}
                    </td>
                    
                    {/* Self select dropdown */}
                    <td className="px-2 py-3.5 border-r border-slate-200 bg-amber-50/10 text-center">
                      <select
                        disabled={!isSelfWritable}
                        value={selfCoreRatings[metric.id] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelfCoreRatings(prev => ({ ...prev, [metric.id]: val }));
                        }}
                        className={`w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-amber-500 cursor-pointer ${
                          !isSelfWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                        }`}
                      >
                        {CORE_VALUE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Manager select dropdown */}
                    <td className="px-2 py-3.5 bg-rose-50/10 text-center">
                      <select
                        disabled={!isManagerWritable}
                        value={managerCoreRatings[metric.id] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManagerCoreRatings(prev => ({ ...prev, [metric.id]: val }));
                        }}
                        className={`w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-rose-500 cursor-pointer ${
                          !isManagerWritable ? "opacity-75 cursor-not-allowed bg-slate-50" : ""
                        }`}
                      >
                        {CORE_VALUE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-black text-slate-800">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right text-[10px] uppercase tracking-wider">
                    Total Customer Delight Score Target:
                  </td>
                  <td className="px-2 py-3 text-center bg-amber-100/30 font-mono text-sm text-amber-950 border-r border-slate-200">
                    {selfDelightTotal !== "" ? `${selfDelightTotal} / 100` : "-"}
                  </td>
                  <td className="px-2 py-3 text-center bg-rose-100/30 font-mono text-sm text-rose-950">
                    {managerDelightTotal !== "" ? `${managerDelightTotal} / 100` : "-"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Recharts chart representation */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Core Values Performance Chart
            </h3>
          </div>
          
          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: "#64748b", fontSize: 8, fontWeight: 700 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 20]} 
                  tick={{ fill: "#64748b", fontSize: 9, fontWeight: 700 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#fff", fontSize: "10px", fontWeight: "bold" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "9px", fontWeight: "extrabold", textTransform: "uppercase" }}
                />
                <Bar dataKey="Self" fill="#d97706" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Manager" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-600 inline-block" />
              <span>Self Rating</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-600 inline-block" />
              <span>Manager Rating</span>
            </div>
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
