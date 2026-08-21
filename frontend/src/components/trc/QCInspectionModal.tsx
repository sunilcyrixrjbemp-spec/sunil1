import React, { useState } from "react";
import {
  ShieldCheck,
  X,
  Video,
  Check,
  PackageCheck
} from "lucide-react";
import MediaUploadSection from "./MediaUploadSection";
import { trcService, TRCMachine } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface QCInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

export default function QCInspectionModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: QCInspectionModalProps) {
  const [powerOn, setPowerOn] = useState<boolean>(true);
  const [selfTestPassed, setSelfTestPassed] = useState<boolean>(true);
  const [calibrationPassed, setCalibrationPassed] = useState<boolean>(true);
  const [displayOk, setDisplayOk] = useState<boolean>(true);
  const [accessoriesWorking, setAccessoriesWorking] = useState<boolean>(true);
  const [finalFunctionalTest, setFinalFunctionalTest] = useState<boolean>(true);

  const [qcVideoUrl, setQcVideoUrl] = useState<string>("");
  const [qcRemarks, setQcRemarks] = useState<string>(
    "Equipment passed all 6 QA verification parameters. Ready for warehouse staging and dispatch."
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const allPassed =
    powerOn &&
    selfTestPassed &&
    calibrationPassed &&
    displayOk &&
    accessoriesWorking &&
    finalFunctionalTest;

  const checkItems = [
    { key: "powerOn", label: "Power ON & Stability Test", value: powerOn, setVal: setPowerOn, desc: "Machine boots smoothly without auxiliary power anomalies" },
    { key: "selfTestPassed", label: "Internal Self-Test Passed", value: selfTestPassed, setVal: setSelfTestPassed, desc: "Microcontroller POST diagnostics verify OK" },
    { key: "calibrationPassed", label: "Calibration Verified", value: calibrationPassed, setVal: setCalibrationPassed, desc: "Accuracy benchmarks match OEM technical standard" },
    { key: "displayOk", label: "Display & Touchscreen OK", value: displayOk, setVal: setDisplayOk, desc: "No dead pixels, clear contrast, responsive controls" },
    { key: "accessoriesWorking", label: "Accessories & Probes Tested", value: accessoriesWorking, setVal: setAccessoriesWorking, desc: "Cables, sensors, adapters functioning normally" },
    { key: "finalFunctionalTest", label: "Final Functional Performance Test", value: finalFunctionalTest, setVal: setFinalFunctionalTest, desc: "Simulated load runs 30+ minutes without failure" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id) return;

    setIsSubmitting(true);
    try {
      const res = await trcService.saveQC({
        trc_id: machine.id,
        power_on: powerOn,
        self_test_passed: selfTestPassed,
        calibration_passed: calibrationPassed,
        display_ok: displayOk,
        accessories_working: accessoriesWorking,
        final_functional_test: finalFunctionalTest,
        qc_video_url: qcVideoUrl || undefined,
        qc_remarks: qcRemarks.trim(),
      });

      if (res.success) {
        toast.success("Quality Check completed successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to save QC");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "QC submission failed");
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
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Step 7 — 6-Point Quality Check (QC)
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Status Indicator Banner */}
          <div
            className={`p-3 rounded-none border flex items-center justify-between gap-3 shadow-2xs ${
              allPassed
                ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                : "bg-amber-50/80 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-none flex items-center justify-center text-white font-bold shrink-0 ${
                  allPassed ? "bg-emerald-700" : "bg-amber-600"
                }`}
              >
                {allPassed ? <Check className="w-4 h-4 stroke-[3]" /> : "!"}
              </div>
              <div>
                <span className="font-extrabold text-xs uppercase tracking-wide block">
                  {allPassed ? "QC Certification Passed" : "Partial Inspection (Action Needed)"}
                </span>
                <span className="text-[10px] text-slate-600 font-medium block">
                  {allPassed
                    ? "Machine meets all specifications & qualifies for Ready for Warehouse Dispatch."
                    : "Some parameters failed or unverified."}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPowerOn(true);
                setSelfTestPassed(true);
                setCalibrationPassed(true);
                setDisplayOk(true);
                setAccessoriesWorking(true);
                setFinalFunctionalTest(true);
              }}
              className="h-7 px-2.5 text-[9px] font-extrabold uppercase bg-white text-slate-700 hover:text-slate-900 rounded-none border border-slate-300 shadow-2xs shrink-0 cursor-pointer transition-all hover:bg-slate-50"
            >
              Select All Pass
            </button>
          </div>

          {/* 6-Point Checklist */}
          <div className="space-y-2">
            <label className="label-lte block">
              Inspection Checklist Parameters *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {checkItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => item.setVal(!item.value)}
                  className={`p-3 rounded-none border transition-all cursor-pointer flex items-start gap-2.5 select-none shadow-2xs ${
                    item.value
                      ? "bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50"
                      : "bg-slate-50 border-slate-200 opacity-75 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-none flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      item.value
                        ? "bg-emerald-700 text-white"
                        : "border border-slate-300 bg-white"
                    }`}
                  >
                    {item.value && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">{item.label}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5 font-medium">
                      {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="label-lte">Quality Inspector Remarks *</label>
            <textarea
              rows={2}
              value={qcRemarks}
              onChange={(e) => setQcRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-none p-2.5 text-xs font-semibold text-slate-900 focus:border-[#4A6A8A] outline-none shadow-2xs leading-relaxed"
              required
            />
          </div>

          {/* Upload QC Video */}
          <div className="border-t border-slate-200 pt-3">
            <h4 className="label-lte mb-2 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-[#4A6A8A]" />
              QC Demonstration Video (Final verification recording)
            </h4>
            <MediaUploadSection
              stage="QC"
              trcId={machine.id}
              trcNumber={machine.trc_number}
              videoLabel="QC Video"
              maxVideoSeconds={60}
              videoUrl={qcVideoUrl}
              onVideoChange={setQcVideoUrl}
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
              className="h-9 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              {isSubmitting ? "Certifying QC..." : "Certify QC & Mark Ready for Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
