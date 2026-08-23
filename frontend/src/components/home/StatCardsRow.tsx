import React from "react";
import { FileSpreadsheet, CheckCircle2, Clock, XCircle, Navigation, Route } from "lucide-react";
import { IconTile } from "../common/IconTile";

interface StatCardsRowProps {
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  returnedAmount?: number;
  rejectedAmount: number;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  returnedCount?: number;
  rejectedCount: number;
  allowanceStats?: any;
  statsTotalClaims: any[];
  statsApprovedClaims: any[];
  statsPendingClaims: any[];
  statsReturnedClaims?: any[];
  statsRejectedClaims: any[];
  onOpenModal: (type: "Total Claimed" | "Approved" | "Pending" | "Returned" | "Rejected", list: any[]) => void;
}

export const StatCardsRow = React.memo(function StatCardsRow({
  totalAmount,
  approvedAmount,
  pendingAmount,
  rejectedAmount,
  totalCount,
  approvedCount,
  pendingCount,
  rejectedCount,
  allowanceStats,
  statsTotalClaims,
  statsApprovedClaims,
  statsPendingClaims,
  statsRejectedClaims,
  onOpenModal,
}: StatCardsRowProps) {
  const currentKm = allowanceStats?.currentKm || 0;
  const maxKm = allowanceStats?.maxKm || 0;
  const currentAuto = allowanceStats?.currentAuto || 0;
  const maxAuto = allowanceStats?.maxAuto || 0;
  const vehicleType = allowanceStats?.vehicleType || "Bike";

  const kmPercent = maxKm > 0 ? Math.min(100, Math.round((currentKm / maxKm) * 100)) : 0;
  const autoPercent = maxAuto > 0 ? Math.min(100, Math.round((currentAuto / maxAuto) * 100)) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {/* 1. Total Claimed */}
      <div
        onClick={() => onOpenModal("Total Claimed", statsTotalClaims)}
        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors cursor-pointer shadow-2xs flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              TOTAL CLAIMED
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5 tracking-tight tabular-nums truncate">
              ₹{(totalAmount || 0).toLocaleString("en-IN")}
            </div>
          </div>
          <IconTile
            icon={FileSpreadsheet}
            gradientFrom="from-blue-500"
            gradientTo="to-indigo-600"
            shadowColor="rgba(37, 99, 235, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>{totalCount} Claims</span>
          <span className="text-[#4A6A8A] font-sans font-medium text-[10px]">Details →</span>
        </div>
      </div>

      {/* 2. Monthly KM Limit */}
      <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors shadow-2xs flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              {vehicleType.toUpperCase()} KM
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5 tracking-tight tabular-nums truncate">
              {currentKm} <span className="text-xs font-normal text-slate-400">/ {maxKm}</span>
            </div>
          </div>
          <IconTile
            icon={Route}
            gradientFrom="from-cyan-500"
            gradientTo="to-blue-600"
            shadowColor="rgba(6, 182, 212, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#4A6A8A] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(currentKm ? 5 : 0, kmPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Monthly Auto Cap */}
      <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors shadow-2xs flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              AUTO CAP
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5 tracking-tight tabular-nums truncate">
              ₹{currentAuto.toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-400">/ ₹{maxAuto.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <IconTile
            icon={Navigation}
            gradientFrom="from-amber-500"
            gradientTo="to-orange-600"
            shadowColor="rgba(245, 158, 11, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(currentAuto ? 5 : 0, autoPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Approved */}
      <div
        onClick={() => onOpenModal("Approved", statsApprovedClaims)}
        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors cursor-pointer shadow-2xs flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              APPROVED
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-[#0F7A4C] mt-0.5 tracking-tight tabular-nums truncate">
              ₹{(approvedAmount || 0).toLocaleString("en-IN")}
            </div>
          </div>
          <IconTile
            icon={CheckCircle2}
            gradientFrom="from-emerald-500"
            gradientTo="to-teal-600"
            shadowColor="rgba(16, 185, 129, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="text-[#0F7A4C] font-semibold">{approvedCount} Approved</span>
          <span className="text-[#0F7A4C] font-sans font-medium text-[10px]">Details →</span>
        </div>
      </div>

      {/* 5. Pending */}
      <div
        onClick={() => onOpenModal("Pending", statsPendingClaims)}
        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors cursor-pointer shadow-2xs flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              PENDING
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-[#B7791F] mt-0.5 tracking-tight tabular-nums truncate">
              ₹{(pendingAmount || 0).toLocaleString("en-IN")}
            </div>
          </div>
          <IconTile
            icon={Clock}
            gradientFrom="from-amber-500"
            gradientTo="to-amber-600"
            shadowColor="rgba(245, 158, 11, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="text-[#B7791F] font-semibold">{pendingCount} In Review</span>
          <span className="text-[#B7791F] font-sans font-medium text-[10px]">Details →</span>
        </div>
      </div>

      {/* 6. Rejected */}
      <div
        onClick={() => onOpenModal("Rejected", statsRejectedClaims)}
        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-lg p-3 transition-colors cursor-pointer shadow-2xs flex flex-col justify-between"
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              REJECTED
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-[#B3261E] mt-0.5 tracking-tight tabular-nums truncate">
              ₹{(rejectedAmount || 0).toLocaleString("en-IN")}
            </div>
          </div>
          <IconTile
            icon={XCircle}
            gradientFrom="from-rose-500"
            gradientTo="to-red-600"
            shadowColor="rgba(239, 68, 68, 0.25)"
          />
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="text-[#B3261E] font-semibold">{rejectedCount} Rejected</span>
          <span className="text-[#B3261E] font-sans font-medium text-[10px]">Details →</span>
        </div>
      </div>
    </div>
  );
});
