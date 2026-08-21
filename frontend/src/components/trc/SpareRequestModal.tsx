import React, { useState } from "react";
import {
  Cog,
  X,
  Mail,
  Send,
  Image as ImageIcon
} from "lucide-react";
import MediaUploadSection from "./MediaUploadSection";
import { trcService, TRCMachine } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface SpareRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

export default function SpareRequestModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: SpareRequestModalProps) {
  const [partName, setPartName] = useState<string>("");
  const [partNumber, setPartNumber] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [remarks, setRemarks] = useState<string>("");
  const [partPhotoUrl, setPartPhotoUrl] = useState<string>("");
  const [damagedPartPhotoUrl, setDamagedPartPhotoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showEmailPreview, setShowEmailPreview] = useState<boolean>(false);

  if (!isOpen) return null;

  const emailSubject = `TRC Spare Requirement | ${machine.district || 'Rajasthan'} | ${machine.hospital_name || 'Hospital'} | ${machine.barcode || 'N/A'}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id) return;
    if (!partName.trim()) {
      toast.error("Part Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trcService.requestSparePart({
        trc_id: machine.id,
        part_name: partName.trim(),
        part_number: partNumber.trim(),
        quantity,
        part_photo_url: partPhotoUrl || undefined,
        damaged_part_photo_url: damagedPartPhotoUrl || undefined,
        remarks: remarks.trim(),
      });

      if (res.success) {
        toast.success("Spare part requested & automated email sent!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Failed to submit spare request");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Request failed");
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
            <Cog className="w-4 h-4 text-white shrink-0" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Step 5 — Spare Part Requisition</h3>
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
          {/* Automated Notification Banner */}
          <div className="bg-slate-50 border-l-4 border-[#4A6A8A] border-y border-r border-slate-200 rounded-none p-3.5 flex items-start gap-3 shadow-2xs">
            <Mail className="w-4 h-4 text-[#4A6A8A] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-tight block">Automated Email Dispatch Trigger</span>
              <p className="text-[11px] text-slate-600 leading-snug">
                Submitting this requisition sends an automated HTML notification email to TRC Coordinator, Zonal Coordinator, Zonal Manager, Project Head, and Consignee DI.
              </p>
              <button
                type="button"
                onClick={() => setShowEmailPreview(!showEmailPreview)}
                className="text-[10px] font-extrabold uppercase text-[#4A6A8A] hover:text-[#3b5876] underline inline-block pt-1 cursor-pointer"
              >
                {showEmailPreview ? "Hide Email Preview" : "View Live Email Template Preview →"}
              </button>
            </div>
          </div>

          {/* Email Preview Accordion */}
          {showEmailPreview && (
            <div className="bg-slate-900 text-slate-100 rounded-none p-4 border border-slate-800 space-y-2.5 font-sans shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Automated Email Preview</span>
                <span className="text-[9px] text-slate-400 font-mono uppercase">5 Recipients (Auto)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                <strong className="text-white">Subject:</strong> {emailSubject}
              </p>
              <div className="bg-slate-800/80 rounded-none p-3 text-[11px] text-slate-300 space-y-1 border border-slate-700">
                <p><strong>Machine:</strong> {machine.equipment_name} ({machine.equipment_model || 'Standard'})</p>
                <p><strong>Facility:</strong> {machine.hospital_name}, {machine.district} ({machine.zone} Zone)</p>
                <p><strong>Complaint ID:</strong> {machine.complaint_id} | <strong>Barcode:</strong> {machine.barcode}</p>
                <p><strong>Requested Part:</strong> {partName || '[Enter Part Name]'} (Qty: {quantity})</p>
              </div>
            </div>
          )}

          {/* Part Name & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-lte block mb-1">Required Part Name *</label>
              <input
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="e.g. Power Supply SMPS Board 12V 5A"
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
                required
              />
            </div>

            <div>
              <label className="label-lte block mb-1">Part / Model Number</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="e.g. PCB-PSU-4032"
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full font-mono"
              />
            </div>
          </div>

          {/* Quantity & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-lte block mb-1">Quantity *</label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label-lte block mb-1">Requisition Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Immediate replacement required to restore ICU patient monitor"
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900 w-full"
              />
            </div>
          </div>

          {/* Photo Uploads: Required Part Photo & Damaged Part Photo */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="label-lte mb-2 flex items-center gap-1.5 text-slate-800">
              <ImageIcon className="w-3.5 h-3.5 text-[#4A6A8A]" />
              Spare Part Media Attachments
            </h4>
            <MediaUploadSection
              stage="Spare"
              trcId={machine.id}
              trcNumber={machine.trc_number}
              photos={[
                { key: "part_photo", label: "Required Part Photo", url: partPhotoUrl },
                { key: "damaged_part_photo", label: "Damaged Part Photo", url: damagedPartPhotoUrl },
              ]}
              onPhotoChange={(key, url) => {
                if (key === "part_photo") setPartPhotoUrl(url);
                if (key === "damaged_part_photo") setDamagedPartPhotoUrl(url);
              }}
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
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Dispatching Requisition..." : "Submit Requisition & Send Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
