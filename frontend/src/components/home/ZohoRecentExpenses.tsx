import React from "react";
import { Receipt, ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { renderAntdStatusTag, formatDateDDMMMYY } from "./claimsColumns";

interface ZohoRecentExpensesProps {
  claims: any[];
  onOpenClaim: (id: string | number) => void;
  activeTab?: "my-claims" | "team-claims";
}

const getCategoryIcon = (modeOrCat: string) => {
  const s = (modeOrCat || "").toLowerCase();
  if (s.includes("car")) return "🚗";
  if (s.includes("bike")) return "🏍️";
  if (s.includes("auto") || s.includes("cab")) return "🛺";
  if (s.includes("bus")) return "🚌";
  if (s.includes("train")) return "🚆";
  if (s.includes("hotel") || s.includes("stay")) return "🏨";
  if (s.includes("da") || s.includes("food") || s.includes("meal")) return "🍽️";
  if (s.includes("spare") || s.includes("purchase")) return "⚙️";
  if (s.includes("courier") || s.includes("courrier")) return "📦";
  if (s.includes("print") || s.includes("stationery")) return "🖨️";
  if (s.includes("recharge") || s.includes("mobile")) return "📱";
  return "🧾";
};

export const ZohoRecentExpenses: React.FC<ZohoRecentExpensesProps> = ({
  claims = [],
  onOpenClaim,
  activeTab = "my-claims",
}) => {
  const recentClaims = claims.slice(0, 5);

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
          <div className="w-8 h-8 rounded-[4px] bg-surface-sunken flex items-center justify-center text-accent-600 border border-line">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
              RECENT ACTIVITY LEDGER
            </h2>
            <p className="text-[10.5px] text-ink-500 font-sans mt-1 m-0 leading-none">
              Latest field submissions and claim entries
            </p>
          </div>
        </div>
        <Link
          to="/claims-history"
          className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1 transition-colors leading-none"
        >
          <span>View all claims</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Expenses Feed */}
      {recentClaims.length === 0 ? (
        <div className="py-8 text-center text-ink-400 text-xs font-semibold">
          No recent expense entries recorded for this period.
        </div>
      ) : (
        <div className="space-y-2 py-1.5 flex-1">
          {recentClaims.map((claim) => {
            const code = claim.expense_code || `#${claim.id}`;
            const desc = claim.description || claim.purpose || "Operational field visit";
            const amt = Number(claim.amount != null ? claim.amount : (claim.total_amount || 0));
            const dateStr = formatDateDDMMMYY(claim.date || claim.itinerary || claim.created_at);
            const mode = claim.travel_mode || claim.category || "Bike";
            const submitter = claim.submitter_name || claim.engineer_name || "";
            const catIcon = getCategoryIcon(mode);

            return (
              <div
                key={claim.id}
                onClick={() => onOpenClaim(claim.id)}
                className="group p-2.5 rounded-[4px] border border-line hover:border-line-strong hover:bg-surface-sunken/60 transition-all cursor-pointer flex items-center justify-between gap-2.5 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-[3px] bg-surface-sunken border border-line flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                    {catIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-accent-700 text-[11px]">
                        {code}
                      </span>
                      {activeTab === "team-claims" && submitter && (
                        <span className="text-[10.5px] font-bold text-ink-900 truncate max-w-[120px]">
                          • {submitter}
                        </span>
                      )}
                      <span className="text-[10px] text-ink-500 font-medium">
                        {dateStr}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-ink-700 font-medium truncate mt-0.5 m-0">
                      {desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-ink-900 text-[11px]">
                      ₹{amt.toLocaleString("en-IN")}
                    </span>
                    <div>{renderAntdStatusTag(claim.status)}</div>
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
          Showing 5 most recent submissions
        </span>
        <Link to="/claims-history" className="text-accent-600 font-semibold hover:underline">
          Go to full ledger →
        </Link>
      </div>
    </div>
  );
};
