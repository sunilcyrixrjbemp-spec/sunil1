import {
  Cpu,
  Building2,
  MapPin,
  FileText,
  ShieldCheck,
  Tag,
  Wrench,
  Printer
} from "lucide-react";
import { TRCMachine } from "../../services/trcService";

interface MachineDetailsStickyCardProps {
  machine: Partial<TRCMachine>;
  onPrintJobCard?: () => void;
  onOpenActionModal?: (action: string) => void;
  userRole?: string;
  isCoordinator?: boolean;
}

export const getStatusBadgeStyle = (status?: string) => {
  switch (status) {
    case "Machine Received in TRC":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Assigned to Engineer":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Diagnosis Completed":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Waiting Spare Part":
      return "bg-amber-50 text-amber-800 border-amber-300 animate-pulse";
    case "Repair In Progress":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Repair Completed":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "QC Completed":
    case "Ready for Warehouse Dispatch":
      return "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold";
    case "Dispatched":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "Closed":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

export default function MachineDetailsStickyCard({
  machine,
  onPrintJobCard,
  onOpenActionModal,
  isCoordinator = false,
}: MachineDetailsStickyCardProps) {
  if (!machine || (!machine.barcode && !machine.equipment_name)) {
    return (
      <div className="bg-white rounded-none p-6 border border-slate-200 shadow-2xs text-center space-y-3">
        <div className="w-12 h-12 rounded-none bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
          <Cpu className="w-6 h-6" />
        </div>
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">No Asset Selected</h4>
        <p className="text-[11px] text-slate-500 font-medium">Select a district and enter a barcode to automatically fetch machine specifications.</p>
      </div>
    );
  }

  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    `TRC-JOB:${machine.trc_number || 'TRC-JOB'}|BC:${machine.barcode || ''}|EQ:${machine.equipment_name || ''}`
  )}`;

  return (
    <div className="bg-white rounded-none border border-slate-200 shadow-2xs sticky top-4 overflow-hidden">
      {/* LTE Header */}
      <div className="bg-[#4A6A8A] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-slate-200" />
          <span className="text-[10px] font-black uppercase tracking-wider">
            Machine Specifications
          </span>
        </div>
        <span className="text-[10px] font-mono font-extrabold bg-black/20 text-white px-2 py-0.5 rounded-none border border-white/20 uppercase">
          {machine.trc_number || "TRC WORK ORDER"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Header with status badge & QR preview */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] px-2 py-0.5 rounded-none border font-black uppercase tracking-wide flex items-center gap-1 ${getStatusBadgeStyle(
                  machine.current_status
                )}`}
              >
                <span className="w-1.5 h-1.5 rounded-none bg-current shrink-0" />
                {machine.current_status || "Machine Received in TRC"}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug uppercase">
              {machine.equipment_name || "Biomedical Equipment"}
            </h3>
            <p className="text-[11px] text-slate-600 font-semibold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="label-lte !mb-0 !inline-block text-[10px]">Model:</span>
              <span className="text-slate-900 font-bold">{machine.equipment_model || "Standard"}</span>
            </p>
          </div>

          {/* QR Code thumbnail */}
          <div className="shrink-0 text-center bg-slate-50 p-1.5 rounded-none border border-slate-200 shadow-2xs group relative cursor-pointer" title="Job QR Code">
            <img
              src={qrDataUrl}
              alt="Machine QR Code"
              className="w-14 h-14 rounded-none object-contain bg-white p-0.5 border border-slate-200"
            />
            <span className="text-[8px] text-[#4A6A8A] font-mono font-black uppercase block mt-0.5">QR Verified</span>
          </div>
        </div>

        {/* Verified Barcode & Serial Row */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-none border border-slate-200">
          <div>
            <span className="label-lte !text-[9px] !mb-0.5">Barcode</span>
            <span className="text-xs font-mono font-black text-[#4A6A8A] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {machine.barcode}
            </span>
          </div>
          <div>
            <span className="label-lte !text-[9px] !mb-0.5">Serial No.</span>
            <span className="text-xs font-mono font-bold text-slate-800 block truncate">
              {machine.serial_number || "N/A"}
            </span>
          </div>
        </div>

        {/* Hospital & Location Specs */}
        <div className="space-y-2.5 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="label-lte !text-[9px] !mb-0.5">Hospital / Facility</span>
              <span className="font-bold text-slate-900 text-xs block truncate">{machine.hospital_name || "District Hospital"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="label-lte !text-[9px] !mb-0.5">District & Zone</span>
              <span className="font-bold text-slate-800 text-xs block">
                {machine.district} {machine.zone ? `(${machine.zone} Zone)` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="label-lte !text-[9px] !mb-0.5">Complaint Ticket</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[#4A6A8A] font-black text-xs">{machine.complaint_id || "N/A"}</span>
                {machine.complaint_date && (
                  <span className="text-slate-500 text-[10px] font-medium font-mono">({machine.complaint_date})</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <div>
              <span className="label-lte !text-[9px] !mb-0.5">Consignee DI</span>
              <span className="text-xs font-bold text-slate-800 truncate block">{machine.di_name || "Consignee DI"}</span>
            </div>
            <div>
              <span className="label-lte !text-[9px] !mb-0.5">Coordinator</span>
              <span className="text-xs font-bold text-slate-800 truncate block">{machine.coordinator_name || "Zonal Lead"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="label-lte !text-[9px] !mb-0.5">OEM / Supplier</span>
              <span className="text-xs font-bold text-slate-800 truncate block">{machine.oem_name || "Manufacturer"}</span>
            </div>
            <div>
              <span className="label-lte !text-[9px] !mb-0.5">District Mgr (DM)</span>
              <span className="text-xs font-bold text-slate-800 truncate block">{machine.dm_name || "DM Office"}</span>
            </div>
          </div>
        </div>

        {/* Assigned Engineer Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-none p-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-none bg-[#4A6A8A] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
              {machine.assigned_engineer_name ? machine.assigned_engineer_name.charAt(0).toUpperCase() : "E"}
            </div>
            <div className="min-w-0">
              <span className="label-lte !text-[8px] !mb-0">Assigned TRC Lead</span>
              <span className="text-xs font-extrabold text-slate-900 block truncate">
                {machine.assigned_engineer_name || "Pending Assignment"}
              </span>
            </div>
          </div>

          {isCoordinator && onOpenActionModal && (
            <button
              type="button"
              onClick={() => onOpenActionModal("assign")}
              className="text-[10px] font-extrabold uppercase tracking-wider text-[#4A6A8A] hover:text-white bg-white hover:bg-[#4A6A8A] px-2.5 py-1 rounded-none border border-[#4A6A8A] transition shadow-2xs shrink-0 cursor-pointer"
            >
              {machine.assigned_engineer_name ? "Reassign" : "Assign"}
            </button>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
          {onPrintJobCard && (
            <button
              type="button"
              onClick={onPrintJobCard}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider rounded-none border border-slate-300 shadow-2xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Print Job Card
            </button>
          )}

          {onOpenActionModal && machine.id && (
            <button
              type="button"
              onClick={() => onOpenActionModal("diagnosis")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#4A6A8A] hover:bg-[#3d5873] text-white text-[10px] font-extrabold uppercase tracking-wider rounded-none shadow-2xs transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              Work Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
