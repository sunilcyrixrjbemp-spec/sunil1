import React, { useState } from "react";
import {
  Search,
  X,
  Video
} from "lucide-react";
import MediaUploadSection from "./MediaUploadSection";
import { trcService, TRCMachine } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

const ISSUE_CATEGORIES = [
  "Electrical",
  "Mechanical",
  "PCB",
  "Calibration",
  "Software",
  "Display",
  "Sensor",
  "Other",
];

const SEVERITY_LEVELS = [
  { level: "Critical", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
  { level: "High", color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
  { level: "Medium", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { level: "Low", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
];

export default function DiagnosisModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: DiagnosisModalProps) {
  const [issueCategory, setIssueCategory] = useState<string>("PCB");
  const [rootCause, setRootCause] = useState<string>("");
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [repairable, setRepairable] = useState<"Yes" | "No">("Yes");
  const [severity, setSeverity] = useState<"Critical" | "High" | "Medium" | "Low">("High");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id) return;
    if (!rootCause.trim() || !issueDescription.trim()) {
      toast.error("Please provide both Root Cause and Issue Description");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trcService.saveDiagnosis({
        trc_id: machine.id,
        issue_category: issueCategory,
        root_cause: rootCause.trim(),
        issue_description: issueDescription.trim(),
        repairable,
        severity,
        diagnosis_video_url: videoUrl || undefined,
        diagnosis_photos: photos,
      });

      if (res.success) {
        toast.success("Diagnosis submitted successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to submit diagnosis");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-none shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white shrink-0" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Step 4 — Equipment Diagnosis Form</h3>
              <p className="text-[10px] text-white/80 font-semibold tracking-wide">
                {machine.trc_number} | {machine.equipment_name} {machine.barcode ? `(${machine.barcode})` : ""}
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Issue Category & Repairable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-lte block mb-1">Issue Category *</label>
              <select
                value={issueCategory}
                onChange={(e) => setIssueCategory(e.target.value)}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-lte block mb-1">Repairable? *</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Yes", "No"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setRepairable(opt)}
                    className={`h-9 px-3 font-extrabold text-[10px] uppercase rounded-none border cursor-pointer transition-all ${
                      repairable === opt
                        ? opt === "Yes"
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                          : "bg-red-700 text-white border-red-700 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Severity Badges Selector */}
          <div>
            <label className="label-lte block mb-1.5">Issue Severity *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITY_LEVELS.map((item) => (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setSeverity(item.level as any)}
                  className={`h-9 px-3 font-extrabold text-[10px] uppercase rounded-none border text-center transition-all cursor-pointer ${
                    severity === item.level
                      ? "bg-[#4A6A8A] text-white border-[#4A6A8A] shadow-2xs ring-1 ring-[#4A6A8A]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                  }`}
                >
                  {item.level}
                </button>
              ))}
            </div>
          </div>

          {/* Root Cause */}
          <div>
            <label className="label-lte block mb-1">Root Cause *</label>
            <input
              type="text"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="e.g. Power IC U14 burnt due to high voltage surge"
              className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
              required
            />
          </div>

          {/* Issue Description (Large Text) */}
          <div>
            <label className="label-lte block mb-1">Issue Description (Comprehensive) *</label>
            <textarea
              rows={4}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Detailed technical description of faults observed, PCB traces inspected, sensor response, voltages measured..."
              className="w-full bg-white border border-slate-300 rounded-none p-2.5 text-xs font-semibold text-slate-900 focus:border-[#4A6A8A] outline-none shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Media Uploads: Diagnosis Video + Photos */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="label-lte mb-2 flex items-center gap-1.5 text-slate-800">
              <Video className="w-3.5 h-3.5 text-[#4A6A8A]" />
              Diagnosis Media (Video & Component Photos)
            </h4>
            <MediaUploadSection
              stage="Diagnosis"
              trcId={machine.id}
              trcNumber={machine.trc_number}
              videoLabel="Diagnosis Video"
              maxVideoSeconds={60}
              videoUrl={videoUrl}
              onVideoChange={setVideoUrl}
              multiplePhotos={photos}
              onMultiplePhotosChange={setPhotos}
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              className="h-9 px-5 bg-[#4A6A8A] hover:bg-[#3b5876] text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving Diagnosis..." : "Complete Diagnosis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
