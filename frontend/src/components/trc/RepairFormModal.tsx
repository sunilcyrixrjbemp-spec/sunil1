import React, { useState } from "react";
import {
  Wrench,
  X,
  CheckCircle2,
  Video,
  Calendar,
  Clock
} from "lucide-react";
import MediaUploadSection from "./MediaUploadSection";
import { trcService, TRCMachine } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface RepairFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

export default function RepairFormModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: RepairFormModalProps) {
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState<string>("09:30");
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [endTime, setEndTime] = useState<string>("16:45");
  const [activityDescription, setActivityDescription] = useState<string>("");
  const [partsUsed, setPartsUsed] = useState<string>("");
  const [calibrationDone, setCalibrationDone] = useState<"Yes" | "No">("Yes");
  const [testingDone, setTestingDone] = useState<"Yes" | "No">("Yes");
  const [repairSummary, setRepairSummary] = useState<string>(
    "Replaced Power Supply PCB, soldered IC U14, replaced capacitor C23, tested output voltage and load stability."
  );
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id) return;
    if (!activityDescription.trim() || !repairSummary.trim()) {
      toast.error("Please fill in Activity Description and Repair Summary");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trcService.saveRepair({
        trc_id: machine.id,
        repair_start_date: startDate,
        repair_start_time: startTime,
        repair_end_date: endDate,
        repair_end_time: endTime,
        activity_description: activityDescription.trim(),
        parts_used: partsUsed.trim(),
        calibration_done: calibrationDone,
        testing_done: testingDone,
        repair_summary: repairSummary.trim(),
        repair_video_url: videoUrl || undefined,
        repair_photos: photos,
      });

      if (res.success) {
        toast.success("Repair details saved successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to save repair details");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Save failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-none shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-none bg-white/15 text-white flex items-center justify-center font-bold border border-white/20">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Step 6 — Repair Execution & Testing
              </h3>
              <p className="text-[10px] text-white/80 font-medium">
                {machine.trc_number} | {machine.equipment_name} ({machine.barcode})
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Start & End Dates/Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-none p-3 shadow-2xs space-y-2">
              <label className="label-lte flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#4A6A8A]" />
                Repair Start Time *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
                  required
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 font-mono"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-none p-3 shadow-2xs space-y-2">
              <label className="label-lte flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#4A6A8A]" />
                Repair Completion Time *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
                  required
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Activity Description */}
          <div>
            <label className="label-lte">Repair Activity Description *</label>
            <textarea
              rows={3}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="Described actions taken: Desoldered burnt components, cleaned PCB flux, replaced diode bridge and power filtering capacitor, reflowed trace pads..."
              className="w-full bg-white border border-slate-300 rounded-none p-2.5 text-xs font-semibold text-slate-900 focus:border-[#4A6A8A] outline-none shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Parts Used */}
          <div>
            <label className="label-lte">Parts & Consumables Used</label>
            <input
              type="text"
              value={partsUsed}
              onChange={(e) => setPartsUsed(e.target.value)}
              placeholder="e.g. IC U14 (TOP258PN), Capacitor 470uF 50V (C23), Fuse 3.15A 250V"
              className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
            />
          </div>

          {/* Calibration & Testing Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-none p-3 shadow-2xs">
              <label className="label-lte">Calibration Done? *</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {(["Yes", "No"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCalibrationDone(opt)}
                    className={`h-8 px-3 rounded-none font-extrabold text-[10px] uppercase border transition-all text-center cursor-pointer shadow-2xs ${
                      calibrationDone === opt
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-none p-3 shadow-2xs">
              <label className="label-lte">Bench Testing Completed? *</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {(["Yes", "No"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTestingDone(opt)}
                    className={`h-8 px-3 rounded-none font-extrabold text-[10px] uppercase border transition-all text-center cursor-pointer shadow-2xs ${
                      testingDone === opt
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Repair Summary (Large Text) */}
          <div>
            <label className="label-lte">
              Final Repair Summary (Exact actions performed) *
            </label>
            <textarea
              rows={3}
              value={repairSummary}
              onChange={(e) => setRepairSummary(e.target.value)}
              placeholder="e.g. Replaced Power Supply PCB, soldered IC U14, replaced capacitor C23, tested output voltage."
              className="w-full bg-white border border-slate-300 rounded-none p-2.5 text-xs font-semibold text-slate-900 font-mono focus:border-[#4A6A8A] outline-none shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Media: Repair Completion Video & Photos */}
          <div className="border-t border-slate-200 pt-3">
            <h4 className="label-lte mb-2 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-[#4A6A8A]" />
              Repair Completion Video & Test Photos
            </h4>
            <MediaUploadSection
              stage="Repair"
              trcId={machine.id}
              trcNumber={machine.trc_number}
              videoLabel="Repair Completion Video"
              maxVideoSeconds={60}
              videoUrl={videoUrl}
              onVideoChange={setVideoUrl}
              multiplePhotos={photos}
              onMultiplePhotosChange={setPhotos}
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
              disabled={isSubmitting}
              className="h-9 px-5 bg-[#4A6A8A] hover:bg-[#3b5876] text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? "Saving Repair..." : "Submit Repair Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
