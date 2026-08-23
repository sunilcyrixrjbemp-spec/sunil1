import React from "react";
import { FileText, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { renderAntdStatusTag, formatDateDDMMMYY } from "./claimsColumns";

interface RecentClaimsWidgetProps {
  claims: any[];
  onOpenClaim: (id: string | number) => void;
  activeTab?: "my-claims" | "team-claims";
}

export const RecentClaimsWidget = React.memo(function RecentClaimsWidget({
  claims = [],
  onOpenClaim,
  activeTab = "my-claims",
}: RecentClaimsWidgetProps) {
  const recentClaims = claims.slice(0, 6);

  return (
    <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[#4A6A8A]">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 m-0">
              RECENT CLAIMS ({claims.length})
            </h3>
          </div>
        </div>
        <Link
          to="/claims-history"
          className="text-[11px] font-semibold text-[#4A6A8A] hover:text-[#3b5570] flex items-center gap-1 transition-colors"
        >
          <span>View all claims</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Claims List */}
      {recentClaims.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-xs font-semibold">
          No recent claims found.
        </div>
      ) : (
        <div className="space-y-1.5 flex-1">
          {recentClaims.map((claim) => {
            const code = claim.expense_code || `#${claim.id}`;
            const desc = claim.description || claim.purpose || "Operational claim";
            const amt = Number(claim.amount != null ? claim.amount : (claim.total_amount || 0));
            const dateStr = formatDateDDMMMYY(claim.date || claim.itinerary || claim.created_at);
            const submitter = claim.submitter_name || claim.engineer_name || "";

            return (
              <div
                key={claim.id}
                onClick={() => onOpenClaim(claim.id)}
                className="p-2.5 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 text-xs">
                        {code}
                      </span>
                      {activeTab === "team-claims" && submitter && (
                        <span className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">
                          • {submitter}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">
                        {dateStr}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5 m-0">
                      {desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    ₹{amt.toLocaleString("en-IN")}
                  </span>
                  <div>{renderAntdStatusTag(claim.status)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
