import React from "react";
import { Bike, Car, Navigation, ShieldCheck } from "lucide-react";

interface AllowanceQuotaRowProps {
  allowanceStats: any;
}

export const AllowanceQuotaRow = React.memo(function AllowanceQuotaRow({
  allowanceStats,
}: AllowanceQuotaRowProps) {
  if (!allowanceStats) return null;

  const currentKm = allowanceStats.currentKm || 0;
  const maxKm = allowanceStats.maxKm || 0;
  const currentAuto = allowanceStats.currentAuto || 0;
  const maxAuto = allowanceStats.maxAuto || 0;
  const vehicleType = allowanceStats.vehicleType || "Bike";
  const rateBike = allowanceStats.rateBike || 0;
  const rateCar = allowanceStats.rateCar || 0;

  const kmPercent = maxKm > 0 ? Math.min(100, Math.round((currentKm / maxKm) * 100)) : 0;
  const autoPercent = maxAuto > 0 ? Math.min(100, Math.round((currentAuto / maxAuto) * 100)) : 0;

  const limitPillLabel = vehicleType === "None" ? "Allowances" : `${vehicleType} Limits`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full text-xs font-semibold">
      {/* Card 1: Grade Allowances */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs p-2.5 flex items-center gap-2.5 hover:border-slate-300 transition-all">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shrink-0 shadow-2xs">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            GRADE ENTITLEMENT
          </span>
          <span className="text-xs font-bold text-slate-900 leading-tight truncate">
            {vehicleType} {rateBike > 0 ? `· ₹${rateBike}/KM` : rateCar > 0 ? `· ₹${rateCar}/KM` : ""}
          </span>
          <span className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">
            Standard TA/DA rate policy
          </span>
        </div>
      </div>

      {/* Card 2: Monthly Distance Limit */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs p-2.5 flex items-center gap-2.5 hover:border-blue-300 transition-all">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
          {vehicleType === "Car" ? (
            <Car className="w-4 h-4" />
          ) : vehicleType === "Bike" ? (
            <Bike className="w-4 h-4" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            {limitPillLabel}
          </span>
          <span className="text-xs font-mono font-black text-slate-900 leading-tight">
            {currentKm} / {maxKm} KM
          </span>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden flex items-center">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(currentKm ? 5 : 0, kmPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 3: Monthly Auto Cap */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs p-2.5 flex items-center gap-2.5 hover:border-amber-300 transition-all">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
          <Navigation className="w-4 h-4" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            MONTHLY AUTO CAP
          </span>
          <span className="text-xs font-mono font-black text-slate-900 leading-tight">
            ₹{currentAuto.toLocaleString("en-IN")} / ₹{maxAuto.toLocaleString("en-IN")}
          </span>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden flex items-center">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(currentAuto ? 5 : 0, autoPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
