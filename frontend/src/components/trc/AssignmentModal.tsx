import React, { useState, useEffect } from "react";
import {
  UserCheck,
  X,
  Send,
  Phone,
  CheckCircle2
} from "lucide-react";
import { trcService, TRCMachine, TRCEngineer } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: AssignmentModalProps) {
  const [engineers, setEngineers] = useState<TRCEngineer[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>("");
  const [assignDate, setAssignDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [assignTime, setAssignTime] = useState<string>(
    new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" })
  );
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadEngineers();
    }
  }, [isOpen]);

  const loadEngineers = async () => {
    try {
      const res = await trcService.getEngineers();
      if (res.success && res.engineers) {
        setEngineers(res.engineers);
        if (res.engineers.length > 0 && !selectedEngineerId) {
          setSelectedEngineerId(res.engineers[0].user_id);
        }
      }
    } catch {
      // fallback
    }
  };

  if (!isOpen) return null;

  const selectedEng = engineers.find((e) => e.user_id === selectedEngineerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id || !selectedEngineerId || !selectedEng) {
      toast.error("Please select an Engineer for assignment");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trcService.assignMachine({
        trc_id: machine.id,
        assigned_engineer_id: selectedEngineerId,
        assigned_engineer_name: selectedEng.name,
        assign_date: assignDate,
        assign_time: assignTime,
        notes: notes.trim(),
      });

      if (res.success) {
        toast.success(`Machine assigned to ${selectedEng.name}!`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to assign machine");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Assignment failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-none shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-white shrink-0" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Step 3 — TRC Machine Assignment</h3>
              <p className="text-[10px] text-white/80 font-semibold tracking-wide">
                {machine.trc_number} | {machine.equipment_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-none cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Rules Banner */}
          <div className="p-3 bg-slate-50 border-l-4 border-[#4A6A8A] border-y border-r border-slate-200 rounded-none text-slate-700 flex items-start gap-2 shadow-2xs">
            <UserCheck className="w-4 h-4 text-[#4A6A8A] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-snug">
              <strong className="text-slate-900 font-bold uppercase tracking-tight">Coordinator Assignment Policy:</strong> Only assigned engineer will have write access to Diagnosis and Repair execution modules for this machine.
            </div>
          </div>

          {/* Engineer Selector */}
          <div>
            <label className="label-lte block mb-1">Assign TRC Engineer *</label>
            <select
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
              required
            >
              {engineers.map((eng) => (
                <option key={eng.user_id} value={eng.user_id}>
                  {eng.name} — {eng.designation}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Engineer Quick Card */}
          {selectedEng && (
            <div className="bg-slate-50 p-3 rounded-none border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-none bg-[#4A6A8A] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {selectedEng.name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-xs uppercase tracking-tight">{selectedEng.name}</span>
                  <span className="text-[10px] text-slate-500 font-medium block">{selectedEng.designation}</span>
                  {selectedEng.mobile_number && (
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#4A6A8A]" /> {selectedEng.mobile_number}
                    </span>
                  )}
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#4A6A8A]" />
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-lte block mb-1">Assign Date *</label>
              <input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
                required
              />
            </div>
            <div>
              <label className="label-lte block mb-1">Assign Time *</label>
              <input
                type="text"
                value={assignTime}
                onChange={(e) => setAssignTime(e.target.value)}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full font-mono"
                required
              />
            </div>
          </div>

          {/* Assignment Notes */}
          <div>
            <label className="label-lte block mb-1">Assignment Instructions / Priority Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Critical ICU equipment breakdown. Fast-track component diagnosis."
              className="w-full bg-white border border-slate-300 rounded-none p-2 text-xs font-semibold text-slate-900 focus:border-[#4A6A8A] outline-none shadow-2xs resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] uppercase rounded-none border border-slate-300 cursor-pointer shadow-2xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedEng}
              className="h-9 px-5 bg-[#4A6A8A] hover:bg-[#3b5876] text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Assigning..." : "Assign & Notify Engineer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
