import React from "react";
import { Wallet, CheckCircle2, Clock, RotateCcw, XCircle, ArrowUpRight } from "lucide-react";

interface ZohoKpiRowProps {
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  returnedAmount?: number;
  rejectedAmount?: number;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  returnedCount?: number;
  rejectedCount?: number;
  statsTotalClaims: any[];
  statsApprovedClaims: any[];
  statsPendingClaims: any[];
  statsReturnedClaims?: any[];
  statsRejectedClaims?: any[];
  onOpenModal: (type: "Total Claimed" | "Approved" | "Pending" | "Returned" | "Rejected", list: any[]) => void;
}

export const ZohoKpiRow: React.FC<ZohoKpiRowProps> = ({
  totalAmount,
  approvedAmount,
  pendingAmount,
  returnedAmount = 0,
  rejectedAmount = 0,
  totalCount,
  approvedCount,
  pendingCount,
  returnedCount = 0,
  rejectedCount = 0,
  statsTotalClaims,
  statsApprovedClaims,
  statsPendingClaims,
  statsReturnedClaims = [],
  statsRejectedClaims = [],
  onOpenModal,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {/* 1. Total Claimed */}
      <div
        onClick={() => onOpenModal("Total Claimed", statsTotalClaims)}
        className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-accent-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent-600" />
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-ink-500 font-sans group-hover:text-ink-700 transition-colors">
            TOTAL CLAIMED
          </span>
          <div className="w-5.5 h-5.5 rounded-[3px] bg-accent-50 text-accent-700 flex items-center justify-center border border-accent-200 group-hover:bg-accent-100 transition-colors">
            <Wallet className="w-3 h-3" />
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold font-mono text-ink-900 leading-tight flex items-baseline justify-between">
            <span>₹{(totalAmount || 0).toLocaleString("en-IN")}</span>
            <ArrowUpRight className="w-3 h-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[10px] text-ink-500 font-medium leading-none mt-0.5 block">
            {totalCount} Claims Recorded
          </span>
        </div>
      </div>

      {/* 2. Approved */}
      <div
        onClick={() => onOpenModal("Approved", statsApprovedClaims)}
        className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-emerald-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600" />
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 font-sans">
            APPROVED
          </span>
          <div className="w-5.5 h-5.5 rounded-[3px] bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 leading-tight flex items-baseline justify-between">
            <span>₹{(approvedAmount || 0).toLocaleString("en-IN")}</span>
            <ArrowUpRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[10px] text-emerald-600/80 font-medium leading-none mt-0.5 block">
            {approvedCount} Reimbursement Ready
          </span>
        </div>
      </div>

      {/* 3. In Review */}
      <div
        onClick={() => onOpenModal("Pending", statsPendingClaims)}
        className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-amber-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 font-sans">
            IN REVIEW
          </span>
          <div className="w-5.5 h-5.5 rounded-[3px] bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:bg-amber-100 transition-colors">
            <Clock className="w-3 h-3" />
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold font-mono text-amber-800 leading-tight flex items-baseline justify-between">
            <span>₹{(pendingAmount || 0).toLocaleString("en-IN")}</span>
            <ArrowUpRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[10px] text-amber-700/80 font-medium leading-none mt-0.5 block">
            {pendingCount} Awaiting Decision
          </span>
        </div>
      </div>

      {/* 4. Returned */}
      <div
        onClick={() => onOpenModal("Returned", statsReturnedClaims)}
        className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-orange-500 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden shadow-2xs hover:shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-orange-500" />
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-orange-800 font-sans">
            RETURNED
          </span>
          <div className="w-5.5 h-5.5 rounded-[3px] bg-orange-50 text-orange-700 flex items-center justify-center border border-orange-200 group-hover:bg-orange-100 transition-colors">
            <RotateCcw className="w-3 h-3" />
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold font-mono text-orange-800 leading-tight flex items-baseline justify-between">
            <span>₹{(returnedAmount || 0).toLocaleString("en-IN")}</span>
            <ArrowUpRight className="w-3 h-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[10px] text-orange-700/80 font-medium leading-none mt-0.5 block">
            {returnedCount} Correction Needed
          </span>
        </div>
      </div>

      {/* 5. Rejected */}
      <div
        onClick={() => onOpenModal("Rejected", statsRejectedClaims)}
        className="group bg-white rounded-[4px] border border-[#4f4f4f]/30 hover:border-rose-600 p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-[82px] relative overflow-hidden col-span-2 sm:col-span-1 shadow-2xs hover:shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-600" />
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-rose-800 font-sans">
            REJECTED
          </span>
          <div className="w-5.5 h-5.5 rounded-[3px] bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 group-hover:bg-rose-100 transition-colors">
            <XCircle className="w-3 h-3" />
          </div>
        </div>
        <div>
          <div className="text-sm sm:text-base font-bold font-mono text-rose-700 leading-tight flex items-baseline justify-between">
            <span>₹{(rejectedAmount || 0).toLocaleString("en-IN")}</span>
            <ArrowUpRight className="w-3 h-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[10px] text-rose-600/80 font-medium leading-none mt-0.5 block">
            {rejectedCount} Disapproved
          </span>
        </div>
      </div>
    </div>
  );
};
