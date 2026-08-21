import React, { useState } from "react";
import {
  Send,
  X,
  Truck
} from "lucide-react";
import { trcService, TRCMachine } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Partial<TRCMachine>;
  onSuccess: () => void;
}

export default function DispatchModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: DispatchModalProps) {
  const [courierName, setCourierName] = useState<string>("Cyrix Logistics Logistics Van / Handover");
  const [trackingNumber, setTrackingNumber] = useState<string>(
    `TRC-DSP-${Date.now().toString(36).toUpperCase()}`
  );
  const [destination, setDestination] = useState<string>(
    machine.hospital_name ? `${machine.hospital_name}, ${machine.district}` : ""
  );
  const [dispatchDate, setDispatchDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState<string>(
    "Machine repaired, QC tested and securely packaged for transit back to hospital."
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine.id) return;

    setIsSubmitting(true);
    try {
      const res = await trcService.dispatchMachine({
        trc_id: machine.id,
        courier_name: courierName.trim(),
        tracking_number: trackingNumber.trim(),
        destination: destination.trim(),
        dispatch_date: dispatchDate,
        remarks: remarks.trim(),
      });

      if (res.success) {
        toast.success("Machine marked as Dispatched from TRC!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Dispatch failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Dispatch failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-none shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-[#4A6A8A] text-white flex items-center justify-between border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-none bg-white/15 text-white flex items-center justify-center font-bold border border-white/20">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Step 9 — Warehouse Dispatch Handover
              </h3>
              <p className="text-[10px] text-white/80 font-medium">
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
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="label-lte">Carrier / Handover Person *</label>
            <input
              type="text"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-lte">Gate Pass / Tracking No. *</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-mono font-bold text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="label-lte">Dispatch Date *</label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="label-lte">Destination Facility *</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="input-lte rounded-none border-slate-300 shadow-2xs font-semibold text-xs text-slate-900"
              required
            />
          </div>

          <div>
            <label className="label-lte">Transit Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-none p-2.5 text-xs font-semibold text-slate-900 focus:border-[#4A6A8A] outline-none shadow-2xs leading-relaxed"
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
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Dispatching..." : "Confirm Warehouse Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
