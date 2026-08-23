import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { CheckCircle2, Clock, RotateCcw, XCircle, BarChart2 } from "lucide-react";

interface ZohoSpendChartProps {
  expenses: any[];
  selectMonth?: string;
}

export const ZohoSpendChart: React.FC<ZohoSpendChartProps> = ({ expenses = [] }) => {
  const { chartData, totalClaimed, approvedAmount, approvalRate } = useMemo(() => {
    let appAmt = 0;
    let appCount = 0;
    let revAmt = 0;
    let revCount = 0;
    let retAmt = 0;
    let retCount = 0;
    let rejAmt = 0;
    let rejCount = 0;

    expenses.forEach((exp) => {
      if (!exp) return;
      const amt = Number(exp.amount != null ? exp.amount : (exp.total_amount || 0));
      const s = String(exp.status || "").toLowerCase().trim();

      if (s === "approved" || s === "auto_approved" || s === "paid" || s.includes("approve")) {
        appAmt += amt;
        appCount += 1;
      } else if (
        s === "returned_to_draft" ||
        s === "returned" ||
        s.includes("return") ||
        s === "revision" ||
        s === "need_revision" ||
        s === "send_back"
      ) {
        retAmt += amt;
        retCount += 1;
      } else if (s === "rejected" || s.includes("reject") || s === "declined" || s === "cancelled") {
        rejAmt += amt;
        rejCount += 1;
      } else {
        // Pending / In Review
        revAmt += amt;
        revCount += 1;
      }
    });

    const tot = appAmt + revAmt + retAmt + rejAmt;
    const rate = tot > 0 ? ((appAmt / tot) * 100).toFixed(1) : "0";

    const data = [
      {
        name: "Approved",
        amount: appAmt,
        count: appCount,
        color: "#0F7A4C",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle2,
      },
      {
        name: "In Review",
        amount: revAmt,
        count: revCount,
        color: "#D97706",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock,
      },
      {
        name: "Returned",
        amount: retAmt,
        count: retCount,
        color: "#EA580C",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        icon: RotateCcw,
      },
      {
        name: "Rejected",
        amount: rejAmt,
        count: rejCount,
        color: "#DC2626",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: XCircle,
      },
    ];

    return {
      chartData: data,
      totalClaimed: tot,
      approvedAmount: appAmt,
      approvalRate: rate,
    };
  }, [expenses]);

  return (
    <div
      className="bg-white rounded-[4px] border border-line/80 p-3.5 sm:p-4 flex flex-col justify-between h-full"
      style={{
        boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[4px] bg-surface-sunken flex items-center justify-center text-accent-600 border border-line">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
              CLAIM STATUS DISTRIBUTION
            </h2>
            <p className="text-[10.5px] text-ink-500 font-sans mt-1 m-0 leading-none">
              Spend & volume distribution by approval status
            </p>
          </div>
        </div>

        {/* Highlight Stats Pills */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto bg-surface-sunken/80 p-1.5 px-3 rounded-[4px] border border-line">
          <div className="text-right">
            <span className="text-[8.5px] uppercase font-bold text-ink-500 block leading-none">
              TOTAL CLAIMED
            </span>
            <span className="text-[11px] font-mono font-bold text-ink-900 leading-none">
              ₹{totalClaimed.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="h-5 w-px bg-line" />
          <div className="text-right">
            <span className="text-[8.5px] uppercase font-bold text-emerald-700 block leading-none">
              APPROVAL RATE
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 leading-none">
              {approvalRate}% (₹{approvedAmount.toLocaleString("en-IN")})
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart Area */}
      <div className="w-full h-44 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E1" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: "#E7E5E1" }}
              tick={{ fontSize: 11, fill: "#3A3F47", fontWeight: 700 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: "#E7E5E1" }}
              tick={{ fontSize: 9.5, fill: "#6B7280", fontFamily: "monospace" }}
              tickFormatter={(val) => (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
            />
            <Tooltip
              cursor={{ fill: "#F4F3F1" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  const pct = totalClaimed > 0 ? ((d.amount / totalClaimed) * 100).toFixed(1) : "0";
                  return (
                    <div className="bg-ink-900 text-white rounded-[4px] p-2.5 text-xs font-mono shadow-lg border border-ink-700 space-y-1">
                      <div className="flex items-center justify-between gap-3 border-b border-ink-700 pb-1">
                        <span className="font-bold text-[11px]" style={{ color: d.color }}>{d.name}</span>
                        <span className="text-[10px] text-ink-300 font-semibold">{d.count} Claims</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[10.5px]">
                        <span className="text-ink-400">Amount:</span>
                        <span className="font-bold text-white">₹{Number(d.amount).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[10px]">
                        <span className="text-ink-400">Share:</span>
                        <span className="text-ink-300">{pct}% of Total</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Mini Status Cards Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-line">
        {chartData.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-2 px-2.5 rounded-[4px] bg-surface-sunken/60 border border-line text-[10.5px] hover:bg-surface-sunken transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="font-bold text-ink-700 truncate">{item.name}</span>
            </div>
            <div className="text-right font-mono shrink-0 pl-1">
              <span className="font-bold text-ink-900 block leading-tight">₹{item.amount >= 100000 ? `${(item.amount / 100000).toFixed(1)}L` : item.amount.toLocaleString("en-IN")}</span>
              <span className="text-[9.5px] text-ink-400 leading-none">({item.count})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
