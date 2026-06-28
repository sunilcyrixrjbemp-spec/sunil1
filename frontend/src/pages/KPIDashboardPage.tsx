import { useState } from "react";
import { 
  Gauge, 
  Target, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import toast from "react-hot-toast";

interface KPIMetric {
  name: string;
  value: string;
  percentage: number;
  threshold: string;
  status: "Excellent" | "Good" | "Needs Improvement" | "Critical";
  colorClass: string;
  barColor: string;
}

export default function KPIDashboardPage() {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const kpis: KPIMetric[] = [
    {
      name: "Field Calls Resolution (TAT < 24h)",
      value: "94.5%",
      percentage: 94.5,
      threshold: "Target: > 90%",
      status: "Excellent",
      colorClass: "text-green-700 bg-green-50 border-green-200",
      barColor: "bg-green-600"
    },
    {
      name: "Preventive Maintenance (PMS) compliance",
      value: "82.1%",
      percentage: 82.1,
      threshold: "Target: > 85%",
      status: "Good",
      colorClass: "text-blue-700 bg-blue-50 border-blue-200",
      barColor: "bg-blue-600"
    },
    {
      name: "Asset Code Tagging accuracy",
      value: "99.2%",
      percentage: 99.2,
      threshold: "Target: > 95%",
      status: "Excellent",
      colorClass: "text-green-700 bg-green-50 border-green-200",
      barColor: "bg-green-600"
    },
    {
      name: "Expense Claim Audit accuracy",
      value: "71.4%",
      percentage: 71.4,
      threshold: "Target: > 85%",
      status: "Needs Improvement",
      colorClass: "text-yellow-700 bg-yellow-50 border-yellow-200",
      barColor: "bg-yellow-500"
    },
    {
      name: "Mean Expense Approval time",
      value: "14.2 Hours",
      percentage: 88.0,
      threshold: "Target: < 24 Hours",
      status: "Excellent",
      colorClass: "text-green-700 bg-green-50 border-green-200",
      barColor: "bg-green-600"
    },
    {
      name: "Call Log Response TAT",
      value: "1.2 Hours",
      percentage: 92.5,
      threshold: "Target: < 2 Hours",
      status: "Excellent",
      colorClass: "text-green-700 bg-green-50 border-green-200",
      barColor: "bg-green-600"
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-600" />
            KPI Dashboard
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Key Performance Indicators, SLA compliance ratios, and operational engineering audit scores.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
          <span>Filter Zone:</span>
          <select
            value={selectedFilter}
            onChange={(e) => {
              setSelectedFilter(e.target.value);
              toast.success(`KPI zone filter switched to: ${e.target.value.toUpperCase()}`);
            }}
            className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-bold outline-none"
          >
            <option value="all">All Zones (National)</option>
            <option value="north">North Zone</option>
            <option value="south">South Zone</option>
            <option value="east">East Zone</option>
            <option value="west">West Zone</option>
          </select>
        </div>
      </div>

      {/* Grid of Gauges/KPI metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
            
            {/* Metric Header */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-xs font-extrabold text-gray-700 leading-tight pr-2">
                {kpi.name}
              </h4>
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border select-none ${kpi.colorClass}`}>
                {kpi.status}
              </span>
            </div>

            {/* Achievement Rate display */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-gray-900">{kpi.value}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{kpi.threshold}</span>
            </div>

            {/* Progress Slider bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${kpi.barColor}`} 
                  style={{ width: `${kpi.percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase">
                <span>0% Achievement</span>
                <span>{kpi.percentage}% Completed</span>
                <span>100% SLA</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed SLA Guidelines section */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider border-b border-gray-150 pb-2">
          Engineering SLA Compliance Benchmarks
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-600 leading-relaxed font-semibold">
          <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-150">
            <div className="flex items-center gap-1 text-green-600 font-bold uppercase tracking-wider text-[10px]">
              <CheckCircle className="w-4 h-4" />
              SLA Standard - Urgent Call
            </div>
            <p>
              Urgent support calls must be closed within **24 hours** from registration. Delayed resolution results in automatic system escalation.
            </p>
          </div>

          <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-150">
            <div className="flex items-center gap-1 text-blue-600 font-bold uppercase tracking-wider text-[10px]">
              <Target className="w-4 h-4" />
              PMS Cycle target
            </div>
            <p>
              Every engineering user must perform preventive maintenance (PMS) cycles at assigned hospital units every **30 days** without delay.
            </p>
          </div>

          <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-150">
            <div className="flex items-center gap-1 text-yellow-600 font-bold uppercase tracking-wider text-[10px]">
              <AlertCircle className="w-4 h-4" />
              Claim Audit Audits
            </div>
            <p>
              Mileage claims exceeding actual GPS distance audits by more than **10%** will trigger penalty assessments automatically.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
