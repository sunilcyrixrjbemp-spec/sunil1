import React from "react";
import { AlertCircle, ArrowRight, RotateCcw, XCircle, Clock, CheckCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateDDMMMYY } from "./claimsColumns";

interface ZohoPendingTasksProps {
  myClaims: any[];
  teamClaims: any[];
  isReviewer: boolean;
  onOpenClaim: (id: string | number) => void;
}

export const ZohoPendingTasks: React.FC<ZohoPendingTasksProps> = ({
  myClaims = [],
  teamClaims = [],
  isReviewer,
  onOpenClaim,
}) => {
  // 1. Returned claims (Strictly the logged-in user's own claims that need revision)
  const returnedMyClaims = myClaims.filter((c) => {
    const s = String(c.status || "").toLowerCase();
    return s === "returned_to_draft" || s === "returned" || s.includes("return") || s === "revision" || s === "need_revision" || s === "send_back";
  });

  // 2. Recent rejected claims (Logged-in user's own rejected claims)
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

  // 3. Pending reviews for reviewers/managers (Team claims awaiting review)
  const pendingReviewTeamClaims = isReviewer
    ? teamClaims.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s.startsWith("submitted") || s === "pending";
      })
    : [];

  const taskItems: any[] = isReviewer
    ? [
        ...pendingReviewTeamClaims.map((c) => ({
          ...c,
          taskType: "review",
          badge: "Review Required",
          badgeClass: "bg-accent-50 text-accent-700 border-accent-200",
          description: `Submitted by ${c.submitter_name || c.employeeName || "Engineer"} (${c.district || "Rajasthan"})`,
          icon: Clock,
          actionText: "Review Now",
        })),
        ...returnedMyClaims.map((c) => ({
          ...c,
          taskType: "returned",
          badge: "Needs Revision",
          badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
          description: c.return_reason || c.return_remark || c.comments || "Approver requested changes",
          icon: RotateCcw,
          actionText: "Fix & Resubmit",
        })),
      ].slice(0, 4)
    : [
        ...returnedMyClaims.map((c) => ({
          ...c,
          taskType: "returned",
          badge: "Needs Revision",
          badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
          description: c.return_reason || c.return_remark || c.comments || "Approver requested changes",
          icon: RotateCcw,
          actionText: "Fix & Resubmit",
        })),
        ...recentRejectedMyClaims.map((c) => ({
          ...c,
          taskType: "rejected",
          badge: "Rejected",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          description: c.rejection_reason || c.rejection_remark || "Claim was rejected",
          icon: XCircle,
          actionText: "View Reason",
        })),
      ].slice(0, 4);

  return (
    <div
      className="bg-white rounded-[4px] border border-line/80 p-3.5 sm:p-4 flex flex-col justify-between h-full"
      style={{
        boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[4px] bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200/60">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
              ACTION REQUIRED ({taskItems.length})
            </h2>
            <p className="text-[10.5px] text-ink-500 font-sans mt-1 m-0 leading-none">
              Claims needing your revision or approval
            </p>
          </div>
        </div>
        <Link
          to={isReviewer ? "/approval-center" : "/claims-history"}
          className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1 transition-colors leading-none"
        >
          <span>View all</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Task List */}
      {taskItems.length === 0 ? (
        <div className="py-8 text-center text-ink-400 flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 border border-emerald-200/60">
            <CheckCircle className="w-4.5 h-4.5" />
          </div>
          <span className="text-xs font-bold text-ink-900 leading-none">All Caught Up!</span>
          <p className="text-[10.5px] text-ink-500 font-medium mt-1 m-0 leading-none">
            No pending tasks or returned claims.
          </p>
        </div>
      ) : (
        <div className="space-y-2 py-1.5 flex-1">
          {taskItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => onOpenClaim(item.id)}
                className="group p-2.5 rounded-[4px] border border-line hover:border-line-strong hover:bg-surface-sunken/60 transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-6.5 h-6.5 rounded-[3px] bg-white border border-line flex items-center justify-center shrink-0 group-hover:border-accent-400 transition-colors">
                    <Icon className="w-3 h-3 text-ink-700 group-hover:text-accent-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-accent-700 text-[11px]">
                        {item.expense_code || `#${item.id}`}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${item.badgeClass}`}>
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-ink-700 font-medium truncate mt-0.5 m-0">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-ink-900 text-[11px]">
                      ₹{Number(item.amount || item.total_amount || 0).toLocaleString("en-IN")}
                    </div>
                    <span className="text-[9.5px] text-ink-500 font-medium block">
                      {formatDateDDMMMYY(item.date || item.itinerary || item.created_at)}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-300 group-hover:text-accent-600 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 border-t border-line flex items-center justify-between text-[10px]">
        <span className="text-ink-500 font-medium">
          {taskItems.length} active priority item{taskItems.length !== 1 ? "s" : ""}
        </span>
        <span className="text-accent-600 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Sync
        </span>
      </div>
    </div>
  );
};
