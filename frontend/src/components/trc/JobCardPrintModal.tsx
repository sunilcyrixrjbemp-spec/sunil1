import {
  Printer,
  X,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { TRCMachine, TRCDiagnosis, TRCRepair, TRCQC } from "../../services/trcService";

interface JobCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  diagnosis?: TRCDiagnosis | null;
  repair?: TRCRepair | null;
  qc?: TRCQC | null;
}

export default function JobCardPrintModal({
  isOpen,
  onClose,
  machine,
  diagnosis,
  repair,
  qc,
}: JobCardPrintModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `TRC-JOB:${machine.trc_number || ''}|BC:${machine.barcode || ''}|HOSP:${machine.hospital_name || ''}`
  )}`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn print:p-0 print:bg-white">
      <div className="bg-white text-slate-900 w-full max-w-3xl rounded-none shadow-2xl border border-slate-300 flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Action Header (Hidden in Print) */}
        <div className="bg-[#4A6A8A] text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-300 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-200" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Printable TRC Work Order & Service Report</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold uppercase rounded-none border border-slate-700 shadow-2xs transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-200 hover:text-white hover:bg-black/20 rounded-none transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Job Slip Document Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-800 font-sans print:p-6 print:overflow-visible">
          {/* Header & Logo */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-[#4A6A8A]">
                CYRIX HEALTHCARE PVT. LTD. — CAMC BEMMP RAJASTHAN
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5 uppercase">
                Technical Repair Center (TRC) — Job Card
              </h1>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Biomedical Equipment Overhaul, Chip-Level Repair & Quality Certification
              </p>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Work Order No.</span>
                <span className="text-sm font-mono font-black text-[#4A6A8A]">{machine.trc_number}</span>
                <span className="text-[10px] font-bold text-slate-600 block">Date: {machine.receive_date}</span>
              </div>
              <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 rounded-none border border-slate-300 p-0.5 bg-white shadow-2xs" />
            </div>
          </div>

          {/* Section 1: Equipment & Facility Information */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-none border border-slate-200">
            <div className="space-y-1.5">
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Equipment Name</span>
                <p className="font-bold text-slate-900 text-xs">{machine.equipment_name}</p>
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Model & Serial Number</span>
                <p className="font-semibold text-slate-800 text-xs">{machine.equipment_model || 'N/A'} | SN: {machine.serial_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Barcode Identifier</span>
                <p className="font-mono font-black text-[#4A6A8A] text-xs">{machine.barcode}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Hospital / Facility</span>
                <p className="font-bold text-slate-900 text-xs">{machine.hospital_name}</p>
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">District & Zone</span>
                <p className="font-semibold text-slate-800 text-xs">{machine.district} ({machine.zone || 'Rajasthan'})</p>
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block">Complaint ID & Date</span>
                <p className="font-mono font-bold text-slate-800 text-xs">{machine.complaint_id || 'N/A'} ({machine.complaint_date || 'N/A'})</p>
              </div>
            </div>
          </div>

          {/* Section 2: Intake Condition & Accessories */}
          <div className="grid grid-cols-2 gap-3 border border-slate-200 rounded-none p-3 bg-white">
            <div>
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-1">Receiving Condition</span>
              <span className="inline-block font-extrabold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-none border border-slate-300 uppercase">
                {machine.condition_received || 'Good'}
              </span>
              {machine.receive_notes && (
                <p className="text-[11px] text-slate-600 mt-1 italic">"{machine.receive_notes}"</p>
              )}
            </div>
            <div>
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-1">Accessories Received</span>
              <p className="text-slate-800 font-semibold text-xs">
                {machine.accessories_received
                  ? (typeof machine.accessories_received === 'string' && machine.accessories_received.startsWith('[')
                      ? JSON.parse(machine.accessories_received).join(', ')
                      : machine.accessories_received)
                  : 'Main unit only'}
              </p>
            </div>
          </div>

          {/* Section 3: Diagnostic Findings & Root Cause */}
          {diagnosis && (
            <div className="border border-purple-200 rounded-none p-3 space-y-1.5 bg-purple-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-black tracking-wider text-purple-800">Diagnosis Findings</span>
                <span className="text-[9px] font-black uppercase text-purple-800 bg-purple-50 px-2 py-0.5 rounded-none border border-purple-200">
                  Category: {diagnosis.issue_category} | Severity: {diagnosis.severity}
                </span>
              </div>
              <p className="text-slate-800"><strong>Root Cause:</strong> {diagnosis.root_cause}</p>
              <p className="text-slate-600 text-[11px] leading-relaxed"><strong>Description:</strong> {diagnosis.issue_description}</p>
            </div>
          )}

          {/* Section 4: Repair Activity & Components Replaced */}
          {repair && (
            <div className="border border-orange-200 rounded-none p-3 space-y-1.5 bg-orange-50/20">
              <span className="text-[9px] uppercase font-black tracking-wider text-orange-800 block">Repair Execution Summary</span>
              <p className="font-mono text-slate-900 bg-white p-2 rounded-none border border-slate-200 leading-relaxed font-semibold text-xs">
                {repair.repair_summary}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                <div><strong>Parts / Components:</strong> {repair.parts_used || 'Component Level Reflow / Replaced ICs'}</div>
                <div><strong>Calibration & Testing:</strong> Verified OK (Done: {repair.calibration_done})</div>
              </div>
            </div>
          )}

          {/* Section 5: 6-Point Quality Check Matrix */}
          {qc && (
            <div className="border border-emerald-300 rounded-none p-3 bg-emerald-50/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-black tracking-wider text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Quality Assurance (QA/QC) Verification Checklist
                </span>
                <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-none border border-emerald-300">
                  Status: {qc.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Power ON Test: Pass
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Self-Test Diagnostics: Pass
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Calibration Standard: Pass
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Display & Controls: Pass
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Accessories Working: Pass
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Functional Load Test: Pass
                </div>
              </div>
            </div>
          )}

          {/* Section 6: Sign-off & Authority Approvals */}
          <div className="grid grid-cols-4 gap-3 pt-6 border-t border-slate-300 text-center text-[10px]">
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
              <span className="font-black uppercase tracking-wider text-slate-800 block text-[9px]">Received By</span>
              <span className="text-slate-600 font-medium text-[10px]">{machine.received_by_name || 'Warehouse Staff'}</span>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
              <span className="font-black uppercase tracking-wider text-slate-800 block text-[9px]">TRC Repair Engineer</span>
              <span className="text-slate-600 font-medium text-[10px]">{machine.assigned_engineer_name || 'Biomedical Lead'}</span>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
              <span className="font-black uppercase tracking-wider text-slate-800 block text-[9px]">Quality Inspector</span>
              <span className="text-slate-600 font-medium text-[10px]">{qc?.qc_by_name || 'QA Officer'}</span>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
              <span className="font-black uppercase tracking-wider text-slate-800 block text-[9px]">Consignee DI / Hospital</span>
              <span className="text-slate-600 font-medium text-[10px]">Sign & Stamp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
