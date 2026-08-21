import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  UserCheck,
  Search,
  Cog,
  Wrench,
  ShieldCheck,
  Send,
  Building,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { TRCStatus, TRCStatusHistory } from "../../services/trcService";

interface TRCTimelineProps {
  currentStatus: TRCStatus | string;
  history: TRCStatusHistory[];
  onSelectStage?: (stageKey: string) => void;
}

interface StepDefinition {
  id: number;
  status: TRCStatus;
  label: string;
  stageKey: string;
  description: string;
  icon: React.ComponentType<any>;
}

export const TRC_WORKFLOW_STEPS: StepDefinition[] = [
  { id: 1, status: "Machine Received in TRC", stageKey: "receive", label: "Machine Received in TRC", description: "Warehouse receive, barcode scan, condition & media log", icon: PackageCheck },
  { id: 2, status: "Assigned to Engineer", stageKey: "assign", label: "Assigned to Engineer", description: "TRC Coordinator assigns specialist engineer", icon: UserCheck },
  { id: 3, status: "Diagnosis Completed", stageKey: "diagnosis", label: "Diagnosis Completed", description: "Issue categorization, root cause & severity assessment", icon: Search },
  { id: 4, status: "Waiting Spare Part", stageKey: "spare", label: "Waiting Spare Part", description: "Spare part requisition & automated email dispatch", icon: Cog },
  { id: 5, status: "Repair In Progress", stageKey: "repair_in_progress", label: "Repair In Progress", description: "Spare received, component-level board repair underway", icon: Wrench },
  { id: 6, status: "Repair Completed", stageKey: "repair", label: "Repair Completed", description: "Parts replaced, circuit tested, calibration verified", icon: CheckCircle2 },
  { id: 7, status: "QC Completed", stageKey: "qc", label: "Quality Check Completed", description: "6-point checklist validation & inspector video sign-off", icon: ShieldCheck },
  { id: 8, status: "Ready for Warehouse Dispatch", stageKey: "dispatch_ready", label: "Ready for Dispatch", description: "QC certified, packaged and staged for handover", icon: PackageCheck },
  { id: 9, status: "Dispatched", stageKey: "dispatched", label: "Dispatched", description: "Logistics courier tracking & transit documentation", icon: Send },
  { id: 10, status: "Field Confirmation Pending", stageKey: "field_confirmation", label: "Field Confirmation Pending", description: "Awaiting hospital biomedical engineer verification", icon: Building },
  { id: 11, status: "Closed", stageKey: "closed", label: "Job Lifecycle Closed", description: "Final acceptance recorded, complaint resolved", icon: CheckCheck },
];

export default function TRCTimeline({ currentStatus, history = [], onSelectStage }: TRCTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const getStepIndex = (statusStr: string) => {
    const idx = TRC_WORKFLOW_STEPS.findIndex(
      (s) => s.status.toLowerCase() === (statusStr || "").toLowerCase()
    );
    return idx >= 0 ? idx : 0;
  };

  const currentIdx = getStepIndex(currentStatus);

  const getHistoryForStep = (stepStatus: string) => {
    return history.find(
      (h) => h.to_status?.toLowerCase() === stepStatus.toLowerCase()
    );
  };

  const formatISTDate = (isoStr?: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white rounded-none border border-slate-200 shadow-2xs overflow-hidden text-slate-800">
      {/* Header */}
      <div className="bg-[#4A6A8A] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-200" />
          <span className="text-[10px] font-black uppercase tracking-wider">
            11-Step Lifecycle Timeline
          </span>
        </div>
        <span className="text-[10px] font-mono font-extrabold bg-black/20 text-white px-2 py-0.5 rounded-none border border-white/20 uppercase">
          Step {Math.min(currentIdx + 1, 11)} / 11
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-none overflow-hidden border border-slate-200">
          <div
            className="bg-[#4A6A8A] h-full rounded-none transition-all duration-500 shadow-2xs"
            style={{ width: `${Math.max(8, ((currentIdx + 1) / 11) * 100)}%` }}
          />
        </div>

        {/* Step List */}
        <div className="relative space-y-2.5 pt-1">
          {TRC_WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx || (idx === 10 && currentStatus === "Closed");
            const isActive = idx === currentIdx && currentStatus !== "Closed";
            const isPending = idx > currentIdx;
            const hist = getHistoryForStep(step.status);
            const isExpanded = expandedStep === step.id;

            return (
              <div key={step.id} className="relative flex items-start gap-3 group">
                {/* Connecting Line */}
                {idx < TRC_WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-px transition-colors ${
                      isCompleted ? "bg-emerald-500" : isActive ? "bg-[#4A6A8A]" : "bg-slate-200"
                    }`}
                    style={{ height: "calc(100% - 6px)" }}
                  />
                )}

                {/* Node Icon - Sharp Square */}
                <div
                  onClick={() => onSelectStage && onSelectStage(step.stageKey)}
                  className={`relative z-10 w-7 h-7 rounded-none flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${
                    isCompleted
                      ? "bg-emerald-600 text-white font-black shadow-2xs border border-emerald-700"
                      : isActive
                      ? "bg-[#4A6A8A] text-white font-black shadow-2xs border border-[#3A5570] ring-2 ring-[#4A6A8A]/30 animate-pulse"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                  title={`Click to inspect ${step.label}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span className="text-[11px] font-black font-mono">{step.id}</span>
                  )}
                </div>

                {/* Content Card */}
                <div
                  className={`flex-1 rounded-none p-2.5 transition border ${
                    isActive
                      ? "bg-blue-50/70 border-[#4A6A8A] shadow-2xs ring-1 ring-[#4A6A8A]/20"
                      : isCompleted
                      ? "bg-slate-50/80 border-slate-200 hover:bg-slate-100/70"
                      : "bg-transparent border-slate-200/50 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-black uppercase tracking-tight ${
                          isActive ? "text-[#4A6A8A]" : isCompleted ? "text-slate-900" : "text-slate-600"
                        }`}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded-none bg-[#4A6A8A] text-white tracking-wider">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400">
                      {hist && (
                        <span className="text-[10px] text-slate-500 font-mono font-bold hidden sm:inline">
                          {formatISTDate(hist.created_at)}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">{step.description}</p>

                  {/* Expandable History Detail */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-[11px] space-y-2 animate-fadeIn">
                      {hist ? (
                        <>
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="label-lte !text-[9px] !mb-0">Executed by:</span>
                            <span className="font-bold text-slate-900 text-xs">{hist.changed_by_name || "System"}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="label-lte !text-[9px] !mb-0">Timestamp:</span>
                            <span className="font-mono text-slate-800 font-bold text-xs">{formatISTDate(hist.created_at)}</span>
                          </div>
                          {hist.remarks && (
                            <div className="bg-white p-2.5 rounded-none border border-slate-200 text-slate-700 mt-1 shadow-2xs">
                              <span className="label-lte !text-[9px] !mb-1 text-slate-500">Notes / Remarks</span>
                              <p className="m-0 text-[11px] leading-relaxed text-slate-800 font-medium">{hist.remarks}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-400 italic text-[11px] flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {isPending ? "Awaiting previous stage completion." : "No explicit status notes logged."}
                        </div>
                      )}

                      {onSelectStage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStage(step.stageKey);
                          }}
                          className="mt-2 w-full text-center py-1.5 px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#4A6A8A] hover:text-white bg-white hover:bg-[#4A6A8A] rounded-none border border-[#4A6A8A] transition shadow-2xs cursor-pointer"
                        >
                          Launch {step.label} Form →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
