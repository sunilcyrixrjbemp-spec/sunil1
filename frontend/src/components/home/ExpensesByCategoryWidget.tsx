import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";

interface ExpensesByCategoryWidgetProps {
  expenses: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Bike / Car TA": "#4A6A8A",
  "Daily Allowance (DA)": "#0F7A4C",
  "Hotel / Lodging": "#6366F1",
  "Auto / Cab": "#B7791F",
  "Local Purchase / Spares": "#8B5CF6",
  "Other Expenses": "#94A3B8",
};

export const ExpensesByCategoryWidget = React.memo(function ExpensesByCategoryWidget({
  expenses = [],
}: ExpensesByCategoryWidgetProps) {
  const categoryData = useMemo(() => {
    let bikeCarAmt = 0;
    let daAmt = 0;
    let hotelAmt = 0;
    let autoAmt = 0;
    let localPurchAmt = 0;
    let otherAmt = 0;

    expenses.forEach((exp) => {
      // If detailed itineraries exist, aggregate precisely
      if (Array.isArray(exp.itineraries) && exp.itineraries.length > 0) {
        exp.itineraries.forEach((leg: any) => {
          const mode = (leg.mode || "").toLowerCase();
          const fare = Number(leg.fare || 0);
          if (mode === "bike" || mode === "car") {
            bikeCarAmt += fare;
          } else if (mode === "auto" || mode === "cab" || mode === "taxi") {
            autoAmt += fare;
          } else {
            otherAmt += fare;
          }

          daAmt += Number(leg.da || 0);
          hotelAmt += Number(leg.hotel || 0);
          localPurchAmt += Number(leg.local_purchase || 0);
          otherAmt += Number(leg.other || 0);
        });
      } else {
        // Fallback to top-level fields
        const total = Number(exp.amount || exp.total_amount || 0);
        const mode = (exp.travel_mode || exp.category || "").toLowerCase();
        if (mode.includes("bike") || mode.includes("car")) {
          bikeCarAmt += total;
        } else if (mode.includes("auto") || mode.includes("cab")) {
          autoAmt += total;
        } else if (mode.includes("hotel") || mode.includes("stay")) {
          hotelAmt += total;
        } else if (mode.includes("da") || mode.includes("allowance")) {
          daAmt += total;
        } else {
          otherAmt += total;
        }
      }
    });

    const items = [
      { name: "Bike / Car TA", value: bikeCarAmt, color: CATEGORY_COLORS["Bike / Car TA"] },
      { name: "Daily Allowance (DA)", value: daAmt, color: CATEGORY_COLORS["Daily Allowance (DA)"] },
      { name: "Hotel / Lodging", value: hotelAmt, color: CATEGORY_COLORS["Hotel / Lodging"] },
      { name: "Auto / Cab", value: autoAmt, color: CATEGORY_COLORS["Auto / Cab"] },
      { name: "Local Purchase / Spares", value: localPurchAmt, color: CATEGORY_COLORS["Local Purchase / Spares"] },
      { name: "Other Expenses", value: otherAmt, color: CATEGORY_COLORS["Other Expenses"] },
    ].filter((item) => item.value > 0);

    const total = items.reduce((acc, curr) => acc + curr.value, 0);

    return { items, total };
  }, [expenses]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-lg p-4 shadow-2xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-150 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[#4A6A8A]">
            <PieIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 m-0">
              EXPENSES BY CATEGORY
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase">
          {categoryData.items.length} CATEGORIES
        </span>
      </div>

      {categoryData.items.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs font-semibold">
          No category spend data available.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Donut Chart */}
          <div className="sm:col-span-5 h-44 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.items}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={66}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.items.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const pct = categoryData.total > 0
                        ? ((Number(data.value) / categoryData.total) * 100).toFixed(1)
                        : "0";
                      return (
                        <div className="bg-slate-900 text-white rounded p-2 text-xs font-mono shadow-md border border-slate-800">
                          <p className="font-bold text-[11px] text-slate-300 m-0 pb-0.5">{data.name}</p>
                          <div className="flex items-center justify-between gap-2 text-[10.5px]">
                            <span className="text-white font-bold">₹{Number(data.value).toLocaleString("en-IN")}</span>
                            <span className="text-slate-400">({pct}%)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-mono uppercase text-slate-400 font-bold leading-none">TOTAL</span>
              <span className="text-xs font-bold font-mono text-slate-900 leading-tight">
                ₹{categoryData.total >= 100000 ? `${(categoryData.total / 100000).toFixed(1)}L` : categoryData.total.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Category List Breakdown */}
          <div className="sm:col-span-7 space-y-2 pr-1">
            {categoryData.items.map((cat) => {
              const pct = categoryData.total > 0
                ? Math.round((cat.value / categoryData.total) * 100)
                : 0;
              return (
                <div key={cat.name} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-700 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10.5px] shrink-0">
                      <span className="font-bold text-slate-900">₹{cat.value.toLocaleString("en-IN")}</span>
                      <span className="text-slate-400 w-8 text-right">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
