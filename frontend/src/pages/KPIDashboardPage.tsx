import { useState, useEffect, useMemo } from "react";
import { 
  Gauge, 
  Award, 
  TrendingUp, 
  Info
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

interface KpiRow {
  section: "Job Role" | "Alignment to Core Values";
  kra: string;
  kpi: string;
  weightage: number; // percentage (e.g. 25 for 25%)
  targetKpi: number;
  // Dynamic custom calculation function
  calculateAchievedWt: (achieved: number, target: number, weight: number) => number;
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
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Productivity & Service Efficiency",
    kpi: "Average of 150 calls per month (PMS + Breakdown calls) as per the level competency of equipment",
    weightage: 20,
    targetKpi: 150,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "First-Time Resolution",
    kpi: "Minimum 80% of service calls to be closed without PI",
    weightage: 20,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Service Quality & Reliability",
    kpi: "Zero repeat calls within one month of service.",
    weightage: 15,
    targetKpi: 0,
    calculateAchievedWt: (achieved, _target, weight) => {
      // For repeat calls, target is 0. If achieved is 0, full marks. If >0, deduct.
      if (achieved <= 0) return weight;
      return Math.max(0, parseFloat((weight - (achieved * 5)).toFixed(2)));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      return parseFloat(((achieved / target) * weight).toFixed(2));
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
      // Lower cost efficiency is better. Target is 20% or less.
      if (achieved <= target) return weight;
      const penalty = (achieved - target) * 1.5;
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
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Team Efficiency",
    kpi: "First-Time Fix Rate: Registered calls to be resolved within 24 hours of call log",
    weightage: 20,
    targetKpi: 80,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Compliance",
    kpi: "PMS and User Training completion (10% weightage for PMS and 5% for user training).",
    weightage: 15,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      return parseFloat(((achieved / target) * weight).toFixed(2));
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
      // Target is 30% or less.
      if (achieved <= target) return weight;
      const penalty = (achieved - target) * 2;
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
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Team Handling",
    kpi: "Technical Training (minimum 1 sessions)",
    weightage: 10,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Job Role",
    kra: "Customer Handling",
    kpi: "Hospital Visits: At least 3 client visits per month. MOM (Minutes of Meeting) should be documented and shared.",
    weightage: 10,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      if (achieved >= target) return weight;
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  },
  {
    section: "Alignment to Core Values",
    kra: "Customer Delight",
    kpi: "Delivers a positive customer experience through responsiveness, accountability, strong communication, and continuous improvement, while building trust and effective relationships.",
    weightage: 20,
    targetKpi: 100,
    calculateAchievedWt: (achieved, target, weight) => {
      return parseFloat(((achieved / target) * weight).toFixed(2));
    }
  }
];

export default function KPIDashboardPage() {
  const currentUser = authService.getCurrentUser();
  
  // Determine default format template based on user role
  const defaultTemplate = useMemo(() => {
    const role = (currentUser?.role || "").trim().toLowerCase();
    if (role === "engineer") return "engineer";
    if (["district incharge", "tl", "team lead", "district manager"].includes(role)) {
      return "tl";
    }
    if (["divisional manager", "division manager"].includes(role)) return "div_mgr";
    return "engineer"; // default fallback
  }, [currentUser]);

  const [activeTemplate, setActiveTemplate] = useState<"engineer" | "tl" | "div_mgr">(defaultTemplate);

  // Profile details state
  const [profile, setProfile] = useState({
    ecode: currentUser?.user_id || "EMP-001",
    name: currentUser?.name || "John Doe",
    role: currentUser?.role || "Engineer",
    zone: currentUser?.zone || "North",
    district: currentUser?.district || "Ganganagar"
  });

  // KPI Rows data mapping based on template
  const rows = useMemo(() => {
    if (activeTemplate === "engineer") return ENGINEER_KPIS;
    if (activeTemplate === "tl") return TL_KPIS;
    return DIV_MGR_KPIS;
  }, [activeTemplate]);

  // Scores state for Self and Manager assessments
  const [selfAchievedValues, setSelfAchievedValues] = useState<Record<string, number>>({});
  const [managerAchievedValues, setManagerAchievedValues] = useState<Record<string, number>>({});

  // Core Value Delight scores (Max 20 per value, sum target = 100)
  const [selfCoreValues, setSelfCoreValues] = useState<Record<string, number>>({
    continuous_learning: 0,
    building_relationships: 0,
    trust: 0,
    care: 0,
    speed_of_response: 0
  });

  const [managerCoreValues, setManagerCoreValues] = useState<Record<string, number>>({
    continuous_learning: 0,
    building_relationships: 0,
    trust: 0,
    care: 0,
    speed_of_response: 0
  });

  // Automatically update the "Customer Delight" Target Achieved score based on the sum of core values
  const selfDelightTotal = useMemo(() => {
    return Object.values(selfCoreValues).reduce((sum, v) => sum + v, 0);
  }, [selfCoreValues]);

  const managerDelightTotal = useMemo(() => {
    return Object.values(managerCoreValues).reduce((sum, v) => sum + v, 0);
  }, [managerCoreValues]);

  // Sync Delight totals back to the main KRA list state values
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

  // Reset values when switching templates
  useEffect(() => {
    const defaultSelf: Record<string, number> = {};
    const defaultManager: Record<string, number> = {};
    rows.forEach(r => {
      defaultSelf[r.kra] = 0;
      defaultManager[r.kra] = 0;
    });
    setSelfAchievedValues(defaultSelf);
    setManagerAchievedValues(defaultManager);
    
    setSelfCoreValues({
      continuous_learning: 0,
      building_relationships: 0,
      trust: 0,
      care: 0,
      speed_of_response: 0
    });
    setManagerCoreValues({
      continuous_learning: 0,
      building_relationships: 0,
      trust: 0,
      care: 0,
      speed_of_response: 0
    });
  }, [rows]);

  // Compute stats for all columns
  const tableData = useMemo(() => {
    let jobRoleSelfWtSum = 0;
    let jobRoleManagerWtSum = 0;

    let valuesSelfWtSum = 0;
    let valuesManagerWtSum = 0;

    const mapped = rows.map(r => {
      const selfVal = selfAchievedValues[r.kra] || 0;
      const managerVal = managerAchievedValues[r.kra] || 0;

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

    return {
      rows: mapped,
      jobRoleSelfWtSum,
      jobRoleManagerWtSum,
      valuesSelfWtSum,
      valuesManagerWtSum,
      totalSelfScore: jobRoleSelfWtSum + valuesSelfWtSum,
      totalManagerScore: jobRoleManagerWtSum + valuesManagerWtSum
    };
  }, [rows, selfAchievedValues, managerAchievedValues]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    return CORE_VALUE_METRICS.map(m => ({
      name: m.name,
      Self: selfCoreValues[m.id] || 0,
      Manager: managerCoreValues[m.id] || 0
    }));
  }, [selfCoreValues, managerCoreValues]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800 font-sans pb-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Gauge className="w-6 h-6 text-blue-600" />
            Performance Appraisal KPI Sheet
          </h2>
          <p className="text-slate-500 text-xs font-semibold">
            Interactive scorecard matrix configured for roles and core alignment audits.
          </p>
        </div>

        {/* Template selector tab options */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTemplate("engineer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all ${
              activeTemplate === "engineer" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Engineer KPI
          </button>
          <button
            onClick={() => setActiveTemplate("tl")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all ${
              activeTemplate === "tl" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Incharge / TL / DM
          </button>
          <button
            onClick={() => setActiveTemplate("div_mgr")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all ${
              activeTemplate === "div_mgr" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Divisional Manager
          </button>
        </div>
      </div>

      {/* METADATA EXCEL TOP BAR */}
      <div className="bg-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-bold font-mono">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">E-Code</span>
          <input 
            type="text" 
            value={profile.ecode}
            onChange={(e) => setProfile(prev => ({ ...prev, ecode: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-extrabold w-full outline-none focus:border-blue-500" 
          />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Employee Name</span>
          <input 
            type="text" 
            value={profile.name}
            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-extrabold w-full outline-none focus:border-blue-500" 
          />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Designation</span>
          <select 
            value={activeTemplate}
            onChange={(e) => {
              const val = e.target.value as "engineer" | "tl" | "div_mgr";
              setActiveTemplate(val);
              setProfile(prev => ({ 
                ...prev, 
                role: val === "engineer" ? "Engineer" : val === "tl" ? "District Incharge" : "Divisional Manager"
              }));
            }}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-extrabold w-full outline-none focus:border-blue-500"
          >
            <option value="engineer">Engineer</option>
            <option value="tl">District Incharge / TL / DM</option>
            <option value="div_mgr">Divisional Manager</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Zone</span>
          <input 
            type="text" 
            value={profile.zone}
            onChange={(e) => setProfile(prev => ({ ...prev, zone: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-extrabold w-full outline-none focus:border-blue-500" 
          />
        </div>
        <div className="space-y-1 col-span-2 md:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">District</span>
          <input 
            type="text" 
            value={profile.district}
            onChange={(e) => setProfile(prev => ({ ...prev, district: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-extrabold w-full outline-none focus:border-blue-500" 
          />
        </div>
      </div>

      {/* DYNAMIC KRA & KPI TABLE MATRIX */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              {/* Top Section Header */}
              <tr className="bg-slate-800 text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-700 text-center">
                <th colSpan={5} className="border-r border-slate-700 py-3">KPI Formulation Parameters</th>
                <th colSpan={4} className="border-r border-slate-700 py-3 bg-amber-600 text-white">Self Assessment</th>
                <th colSpan={4} className="border-r border-slate-700 py-3 bg-rose-600 text-white">Assessment by Manager</th>
                <th rowSpan={2} className="border-r border-slate-700 py-3 bg-teal-800 text-white align-middle px-2">Total KRA Wt</th>
                <th rowSpan={2} className="py-3 bg-red-800 text-white align-middle px-2">Total Wt</th>
              </tr>
              {/* Sub Columns Header */}
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-center">
                <th className="px-4 py-2 border-r border-slate-200 text-left min-w-[120px]">KRA & Weightage</th>
                <th className="px-4 py-2 border-r border-slate-200 text-left min-w-[120px]">KRA Name</th>
                <th className="px-4 py-2 border-r border-slate-200 text-left min-w-[260px]">KPI Measurable Parameter</th>
                <th className="px-2 py-2 border-r border-slate-200 w-16">Weight</th>
                <th className="px-2 py-2 border-r border-slate-200 w-16">Target</th>
                
                {/* Self */}
                <th className="px-2 py-2 border-r border-slate-200 bg-amber-50 text-amber-900 w-20">Achieved</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-amber-50 text-amber-900 w-20">Achieved Wt</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-amber-50 text-amber-900 w-16">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-amber-50 text-amber-900 w-20">Total Sum</th>

                {/* Manager */}
                <th className="px-2 py-2 border-r border-slate-200 bg-rose-50 text-rose-900 w-20">Achieved</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-rose-50 text-rose-900 w-20">Achieved Wt</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-rose-50 text-rose-900 w-16">Total Wt</th>
                <th className="px-2 py-2 border-r border-slate-200 bg-rose-50 text-rose-900 w-20">Total Sum</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-700 divide-y divide-slate-200">
              
              {/* RENDER ROW GROUP: JOB ROLE (80%) */}
              {tableData.rows.filter(r => r.section === "Job Role").map((row, idx, filteredRows) => (
                <tr key={`job-role-${idx}`} className="hover:bg-slate-50/50">
                  {/* Section Label (Merged across first block) */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-4 py-3 border-r border-slate-200 align-middle bg-slate-50/80 font-black text-slate-800 text-[11px] text-center border-b"
                    >
                      Job Role<br/>(80% Weightage)
                    </td>
                  )}
                  {/* KRA Name */}
                  <td className="px-4 py-3 border-r border-slate-200 align-top font-bold text-slate-900">
                    {row.kra}
                  </td>
                  {/* KPI Parameter */}
                  <td className="px-4 py-3 border-r border-slate-200 align-top text-[11px] leading-relaxed text-slate-500">
                    {row.kpi}
                  </td>
                  {/* Weightage */}
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.weightage}%
                  </td>
                  {/* Target KPI */}
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.targetKpi}
                  </td>

                  {/* SELF ASSESSMENT FIELDS */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center">
                    <input 
                      type="number"
                      value={row.selfAchieved || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelfAchievedValues(prev => ({ ...prev, [row.kra]: val }));
                      }}
                      className="w-full bg-white border border-amber-200 rounded px-1.5 py-0.5 text-center font-mono font-bold text-slate-800 outline-none focus:border-amber-500 shadow-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center font-mono font-bold text-amber-700">
                    {row.selfAchievedWt}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center font-mono font-bold text-amber-700">
                    {row.selfAchievedWt}%
                  </td>
                  {/* Merged self Job Role weightage sum */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-amber-100/50 text-center font-mono font-black text-amber-900 text-sm align-middle"
                    >
                      {tableData.jobRoleSelfWtSum.toFixed(2)}%
                    </td>
                  )}

                  {/* MANAGER ASSESSMENT FIELDS */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center">
                    <input 
                      type="number"
                      value={row.managerAchieved || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setManagerAchievedValues(prev => ({ ...prev, [row.kra]: val }));
                      }}
                      className="w-full bg-white border border-rose-200 rounded px-1.5 py-0.5 text-center font-mono font-bold text-slate-800 outline-none focus:border-rose-500 shadow-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center font-mono font-bold text-rose-700">
                    {row.managerAchievedWt}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center font-mono font-bold text-rose-700">
                    {row.managerAchievedWt}%
                  </td>
                  {/* Merged manager Job Role weightage sum */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-rose-100/50 text-center font-mono font-black text-rose-900 text-sm align-middle"
                    >
                      {tableData.jobRoleManagerWtSum.toFixed(2)}%
                    </td>
                  )}
                </tr>
              ))}

              {/* RENDER ROW GROUP: CORE VALUES (20%) */}
              {tableData.rows.filter(r => r.section === "Alignment to Core Values").map((row, idx, filteredRows) => (
                <tr key={`core-values-${idx}`} className="hover:bg-slate-50/50 bg-slate-50/30">
                  {/* Section Label (Merged) */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length} 
                      className="px-4 py-3 border-r border-slate-200 align-middle bg-slate-100/80 font-black text-slate-800 text-[11px] text-center"
                    >
                      Alignment To<br/>Core Values - 20%
                    </td>
                  )}
                  {/* KRA Name */}
                  <td className="px-4 py-3 border-r border-slate-200 align-top font-bold text-slate-900">
                    {row.kra}
                  </td>
                  {/* KPI Parameter */}
                  <td className="px-4 py-3 border-r border-slate-200 align-top text-[11px] leading-relaxed text-slate-500">
                    {row.kpi}
                  </td>
                  {/* Weightage */}
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.weightage}%
                  </td>
                  {/* Target KPI */}
                  <td className="px-2 py-3 border-r border-slate-200 text-center font-mono font-bold">
                    {row.targetKpi}
                  </td>

                  {/* SELF ASSESSMENT (Read-only total DELIGHT score, derived from bottom values card table) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center font-mono font-extrabold text-slate-700">
                    {row.selfAchieved}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center font-mono font-bold text-amber-700">
                    {row.selfAchievedWt}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/20 text-center font-mono font-bold text-amber-700">
                    {row.selfAchievedWt}%
                  </td>
                  {/* Merged self Core Values weightage sum */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-amber-100/50 text-center font-mono font-black text-amber-900 text-sm align-middle"
                    >
                      {tableData.valuesSelfWtSum.toFixed(2)}%
                    </td>
                  )}

                  {/* MANAGER ASSESSMENT (Read-only derived total score) */}
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center font-mono font-extrabold text-slate-700">
                    {row.managerAchieved}
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center font-mono font-bold text-rose-700">
                    {row.managerAchievedWt}%
                  </td>
                  <td className="px-2 py-3 border-r border-slate-200 bg-rose-50/20 text-center font-mono font-bold text-rose-700">
                    {row.managerAchievedWt}%
                  </td>
                  {/* Merged manager Core Values weightage sum */}
                  {idx === 0 && (
                    <td 
                      rowSpan={filteredRows.length}
                      className="px-2 py-3 border-r border-slate-200 bg-rose-100/50 text-center font-mono font-black text-rose-900 text-sm align-middle"
                    >
                      {tableData.valuesManagerWtSum.toFixed(2)}%
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {/* Totals Summary Footer */}
            <tfoot className="border-t-2 border-slate-800 text-[11px] font-black uppercase text-center bg-slate-900 text-white">
              <tr className="divide-x divide-slate-800">
                <td colSpan={5} className="py-3.5 px-4 text-left font-black tracking-wide text-xs">
                  Overall Weighted Totals Matrix
                </td>
                
                {/* Self total weighted sum */}
                <td colSpan={3} className="bg-amber-700 py-3.5 text-center font-mono text-xs">Self Score</td>
                <td className="bg-amber-800 font-mono text-sm py-3.5 px-1">{tableData.totalSelfScore.toFixed(2)}%</td>
                
                {/* Manager total weighted sum */}
                <td colSpan={3} className="bg-rose-700 py-3.5 text-center font-mono text-xs">Mgr Score</td>
                <td className="bg-rose-800 font-mono text-sm py-3.5 px-1">{tableData.totalManagerScore.toFixed(2)}%</td>

                {/* Final Total KRA Weight (Green Accent) */}
                <td className="bg-teal-900 font-mono text-sm py-3.5 px-1">
                  {tableData.totalSelfScore.toFixed(2)}%
                </td>

                {/* Final Total Weight (Red/Crimson Accent) */}
                <td className="bg-red-950 font-mono text-sm py-3.5 px-1">
                  {tableData.totalManagerScore.toFixed(2)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CORE VALUES BREAKDOWN & VISUALIZATION GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Core Values (Customer Delight) Table Scorecard */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              Core Value Assessment: Customer Delight (Max 20 Per Parameter)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Max Score Sum: 100</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                  <th className="px-4 py-2 border-r border-slate-200">Core Value Parameter</th>
                  <th className="px-4 py-2 border-r border-slate-200">Measurable Core Standard Definition</th>
                  <th className="px-2 py-2 border-r border-slate-200 text-center w-20 bg-amber-50/50 text-amber-900">Self Score</th>
                  <th className="px-2 py-2 text-center w-20 bg-rose-50/50 text-rose-900">Manager Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-semibold text-slate-600">
                {CORE_VALUE_METRICS.map((metric) => (
                  <tr key={metric.id} className="hover:bg-slate-50/30">
                    {/* Parameter name */}
                    <td className="px-4 py-3 border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                      {metric.name}
                    </td>
                    {/* Definition */}
                    <td className="px-4 py-3 border-r border-slate-200 text-[11px] leading-relaxed text-slate-500">
                      {metric.description}
                    </td>
                    
                    {/* Self score input (Max 20) */}
                    <td className="px-2 py-3 border-r border-slate-200 bg-amber-50/10 text-center">
                      <input 
                        type="number"
                        min="0"
                        max="20"
                        value={selfCoreValues[metric.id] || ""}
                        onChange={(e) => {
                          const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                          setSelfCoreValues(prev => ({ ...prev, [metric.id]: val }));
                        }}
                        className="w-16 bg-white border border-amber-200 rounded px-1.5 py-0.5 text-center font-mono font-bold text-slate-800 outline-none focus:border-amber-500 shadow-sm"
                        placeholder="0"
                      />
                    </td>

                    {/* Manager score input (Max 20) */}
                    <td className="px-2 py-3 bg-rose-50/10 text-center">
                      <input 
                        type="number"
                        min="0"
                        max="20"
                        value={managerCoreValues[metric.id] || ""}
                        onChange={(e) => {
                          const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                          setManagerCoreValues(prev => ({ ...prev, [metric.id]: val }));
                        }}
                        className="w-16 bg-white border border-rose-200 rounded px-1.5 py-0.5 text-center font-mono font-bold text-slate-800 outline-none focus:border-rose-500 shadow-sm"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-black text-slate-800">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right text-[10px] uppercase tracking-wider">
                    Total Customer Delight Score Target:
                  </td>
                  <td className="px-2 py-3 text-center bg-amber-100/50 font-mono text-sm text-amber-900 border-r border-slate-200">
                    {selfDelightTotal} / 100
                  </td>
                  <td className="px-2 py-3 text-center bg-rose-100/50 font-mono text-sm text-rose-900">
                    {managerDelightTotal} / 100
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Live Recharts Visual Graph comparison */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Core Values Performance: Self vs Manager Rating
            </h3>
          </div>
          
          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
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

      {/* FORMULA AUDIT NOTES CARD */}
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
