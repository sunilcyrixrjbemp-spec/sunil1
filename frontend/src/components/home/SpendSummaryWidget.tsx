import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

interface SpendSummaryWidgetProps {
  expenses: any[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const SpendSummaryWidget = React.memo(function SpendSummaryWidget({
  expenses = [],
}: SpendSummaryWidgetProps) {
  const chartData = useMemo(() => {
    // Generate the last 6 months list
    const monthsMap: Record<string, { label: string; claimed: number; approved: number }> = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${yyyy}-${mm}`;
      const label = `${MONTH_NAMES[d.getMonth()]} '${String(yyyy).slice(-2)}`;
      monthsMap[key] = { label, claimed: 0, approved: 0 };
    }

    expenses.forEach((exp) => {
      const dStr = exp.date || exp.itinerary || exp.created_at || "";
      if (!dStr) return;
      const key = dStr.slice(0, 7);
      if (monthsMap[key]) {
        const amt = Number(exp.amount || exp.total_amount || 0);
        monthsMap[key].claimed += amt;
        const s = String(exp.status || "").toLowerCase();
        if (s === "approved" || s === "auto_approved") {
          monthsMap[key].approved += amt;
        }
      }
    });

    return Object.values(monthsMap);
  }, [expenses]);

  const total6MonthSpend = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.claimed, 0);
  }, [chartData]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[#4A6A8A]">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 m-0">
              SPEND SUMMARY (LAST 6 MONTHS)
            </h3>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase block leading-none">
            6M TOTAL
          </span>
          <span className="text-xs font-mono font-bold text-slate-900 leading-tight">
            ₹{total6MonthSpend.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-56 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tick={{ fontSize: 10, fill: "#64748B", fontFamily: "monospace" }}
              tickFormatter={(val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
            />
            <Tooltip
              cursor={{ fill: "#F8FAFC" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white rounded p-2 text-xs font-mono shadow-md border border-slate-800 space-y-1">
                      <p className="font-bold text-[11px] text-slate-300 m-0 pb-1 border-b border-slate-700">
                        {label}
                      </p>
                      <div className="flex items-center justify-between gap-3 text-[10.5px]">
                        <span className="text-slate-400">Claimed:</span>
                        <span className="font-bold text-white">₹{Number(payload[0]?.value || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[10.5px]">
                        <span className="text-emerald-400">Approved:</span>
                        <span className="font-bold text-emerald-300">₹{Number(payload[1]?.value || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="claimed" name="Claimed" fill="#4A6A8A" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="approved" name="Approved" fill="#0F7A4C" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 pt-2 border-t border-slate-150 text-[10.5px] font-semibold text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#4A6A8A]" />
          <span>Total Claimed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#0F7A4C]" />
          <span>Approved</span>
        </div>
      </div>
    </div>
  );
});
