import React from "react";
import { AlertTriangle, ArrowRight, RotateCcw, XCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateDDMMMYY } from "./claimsColumns";

interface NeedsAttentionWidgetProps {
  myClaims: any[];
  teamClaims: any[];
  isReviewer: boolean;
  onOpenClaim: (id: string | number) => void;
}

export const NeedsAttentionWidget = React.memo(function NeedsAttentionWidget({
  myClaims = [],
  teamClaims = [],
  isReviewer,
  onOpenClaim,
}: NeedsAttentionWidgetProps) {
  // 1. Returned claims (Action required: fix & resubmit)
  const returnedMyClaims = myClaims.filter((c) => {
    const s = String(c.status || "").toLowerCase();
    return s === "returned_to_draft" || s === "returned";
  });

  // 2. Recent rejected claims (last 7 days)
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  const recentRejectedMyClaims = myClaims.filter((c) => {
    const s = String(c.status || "").toLowerCase();
    if (!s.includes("reject")) return false;
    const dStr = c.date || c.itinerary || c.created_at;
    if (!dStr) return true;
    const d = new Date(dStr);
    return !isNaN(d.getTime()) ? d >= oneWeekAgo : true;
  });

  // 3. Pending approvals for reviewers
  const pendingReviewTeamClaims = isReviewer
    ? teamClaims.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s.startsWith("submitted") || s === "pending";
      })
    : [];

  const combinedItems: any[] = [
    ...returnedMyClaims.map((c) => ({
      ...c,
      itemType: "returned",
      typeLabel: "Returned",
      typeColor: "bg-amber-50 text-[#B7791F] border-amber-200",
      reasonText: c.return_reason || c.return_remark || c.comments || "Correction requested",
      icon: RotateCcw,
    })),
    ...recentRejectedMyClaims.map((c) => ({
      ...c,
      itemType: "rejected",
      typeLabel: "Rejected",
      typeColor: "bg-rose-50 text-[#B3261E] border-rose-200",
      reasonText: c.rejection_reason || c.rejection_remark || "Claim rejected by approver",
      icon: XCircle,
    })),
    ...pendingReviewTeamClaims.map((c) => ({
      ...c,
      itemType: "pending_review",
      typeLabel: "Review Needed",
      typeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      reasonText: `Submitted by ${c.submitter_name || c.employeeName || "Engineer"}`,
      icon: Clock,
    })),
  ].slice(0, 5);

  return (
    <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-amber-50 flex items-center justify-center text-[#B7791F]">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 m-0">
              NEEDS ATTENTION ({combinedItems.length})
            </h3>
          </div>
        </div>
        <Link
          to={isReviewer ? "/approval-center" : "/claims-history"}
          className="text-[11px] font-semibold text-[#4A6A8A] hover:text-[#3b5570] flex items-center gap-1 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Items List */}
      {combinedItems.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-xs font-semibold">
          🎉 All caught up! No claims currently require attention.
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {combinedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => onOpenClaim(item.id)}
                className="p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {item.expense_code || `#${item.id}`}
                      </span>
                      <span className={`text-[9.5px] font-bold uppercase px-1.5 py-0.2 rounded border ${item.typeColor}`}>
                        {item.typeLabel}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5 m-0">
                      {item.reasonText}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-slate-900 text-xs">
                    ₹{Number(item.amount || item.total_amount || 0).toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {formatDateDDMMMYY(item.date || item.itinerary || item.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
