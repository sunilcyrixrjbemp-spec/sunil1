import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieIcon, Layers } from "lucide-react";

interface ZohoCategoryChartProps {
  expenses: any[];
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  "Bike (TA)": { color: "#4338CA", icon: "🏍️" },
  "Car (TA)": { color: "#4F46E5", icon: "🚗" },
  "Bus Fare": { color: "#2563EB", icon: "🚌" },
  "Train Fare": { color: "#0284C7", icon: "🚆" },
  "Auto / Cab": { color: "#D97706", icon: "🛺" },
  "Daily Allowance (DA)": { color: "#0F7A4C", icon: "🍽️" },
  "Hotel / Lodging": { color: "#6366F1", icon: "🏨" },
  "Local Purchase / Spares": { color: "#8B5CF6", icon: "⚙️" },
  "Courier Charges": { color: "#EC4899", icon: "📦" },
  "Printing & Stationery": { color: "#14B8A6", icon: "🖨️" },
  "Mobile / Internet": { color: "#06B6D4", icon: "📱" },
  "Miscellaneous": { color: "#6B7280", icon: "🧾" },
};

export const ZohoCategoryChart: React.FC<ZohoCategoryChartProps> = ({ expenses = [] }) => {
  const categoryData = useMemo(() => {
    let bikeAmt = 0;
    let carAmt = 0;
    let busAmt = 0;
    let trainAmt = 0;
    let autoAmt = 0;
    let daAmt = 0;
    let hotelAmt = 0;
    let sparesAmt = 0;
    let courierAmt = 0;
    let printingAmt = 0;
    let mobileAmt = 0;
    let miscAmt = 0;

    expenses.forEach((exp) => {
      if (!exp) return;

      // Extract itineraries/legs/items safely
      let rawLegs = exp.itineraries || exp.legs || exp.items;
      if (typeof rawLegs === "string") {
        try {
          rawLegs = JSON.parse(rawLegs);
        } catch {
          rawLegs = null;
        }
      }

      if (Array.isArray(rawLegs) && rawLegs.length > 0) {
        rawLegs.forEach((leg: any) => {
          if (!leg) return;
          const mode = (leg.travel_mode || leg.mode || "").trim().toLowerCase();
          const sub_mode = (leg.sub_mode || "").trim().toLowerCase();
          const fare = Number(leg.travel_amount || leg.fare || 0);

          if (mode === "bike") {
            const dist = Number(leg.distance_km || 0);
            bikeAmt += dist > 0 ? (fare || dist * 5.0) : fare;
          } else if (mode === "car") {
            const dist = Number(leg.distance_km || 0);
            carAmt += dist > 0 ? (fare || dist * 11.0) : fare;
          } else if (mode === "bus") {
            busAmt += fare;
          } else if (mode === "train") {
            trainAmt += fare;
          } else if (mode === "auto" || mode.includes("cab") || mode.includes("uber") || mode.includes("rapido") || mode.includes("taxi")) {
            autoAmt += fare;
          }

          if (sub_mode === "auto" || sub_mode.includes("cab") || sub_mode.includes("uber") || sub_mode.includes("rapido")) {
            autoAmt += Number(leg.sub_amount || 0);
          }

          daAmt += Number(leg.da_amount || leg.da || 0);
          hotelAmt += Number(leg.hotel_amount || leg.hotel || 0);
          sparesAmt += Number(leg.local_purchase || leg.spare_purchase || leg.spare || leg.spare_cost || 0);

          const oth_desc = (leg.other_desc || leg.desc || exp.description || exp.purpose || "").trim().toLowerCase();
          const oth_amt = Number(leg.other_amount || leg.other || leg.misc || 0);

          if (oth_amt > 0) {
            if (
              oth_desc.includes("courier") ||
              oth_desc.includes("courrier") ||
              oth_desc.includes("post") ||
              oth_desc.includes("speed post") ||
              oth_desc.includes("dispatch") ||
              oth_desc.includes("parcel") ||
              oth_desc.includes("dtdc")
            ) {
              courierAmt += oth_amt;
            } else if (
              oth_desc.includes("print") ||
              oth_desc.includes("stationery") ||
              oth_desc.includes("stationery") ||
              oth_desc.includes("xerox") ||
              oth_desc.includes("paper") ||
              oth_desc.includes("photocopy") ||
              oth_desc.includes("spiral")
            ) {
              printingAmt += oth_amt;
            } else if (
              oth_desc.includes("recharge") ||
              oth_desc.includes("mobile") ||
              oth_desc.includes("sim") ||
              oth_desc.includes("internet") ||
              oth_desc.includes("wifi") ||
              oth_desc.includes("broadband") ||
              oth_desc.includes("airtel") ||
              oth_desc.includes("jio")
            ) {
              mobileAmt += oth_amt;
            } else if (
              oth_desc.includes("hotel") ||
              oth_desc.includes("stay") ||
              oth_desc.includes("lodge") ||
              oth_desc.includes("room")
            ) {
              hotelAmt += oth_amt;
            } else if (
              oth_desc.includes("spare") ||
              oth_desc.includes("purchase") ||
              oth_desc.includes("part") ||
              oth_desc.includes("battery")
            ) {
              sparesAmt += oth_amt;
            } else {
              miscAmt += oth_amt;
            }
          }
        });
      } else {
        // Flat claim fields check
        const total = Number(exp.amount != null ? exp.amount : (exp.total_amount || 0));
        const mode = String(exp.travel_mode || exp.category || "").trim().toLowerCase();
        const desc = String(exp.description || exp.purpose || "").trim().toLowerCase();

        const flatHotel = Number(exp.hotel_amount || exp.hotel || exp.boarding_lodging || 0);
        const flatDa = Number(exp.da_amount || exp.da || exp.daily_allowance || 0);
        const flatSpares = Number(exp.local_purchase || exp.spare_purchase || exp.spare_cost || exp.spare || 0);
        const flatCourier = Number(exp.courier_charges || exp.courier_amount || 0);
        const flatPrinting = Number(exp.printing_stationery || exp.printing_amount || 0);
        const flatMobile = Number(exp.mobile_recharge || 0);
        const flatMisc = Number(exp.misc_expenses || exp.other_amount || 0);

        if (flatHotel > 0 || flatDa > 0 || flatSpares > 0 || flatCourier > 0 || flatPrinting > 0 || flatMobile > 0 || flatMisc > 0) {
          hotelAmt += flatHotel;
          daAmt += flatDa;
          sparesAmt += flatSpares;
          courierAmt += flatCourier;
          printingAmt += flatPrinting;
          mobileAmt += flatMobile;
          miscAmt += flatMisc;

          const remainder = total - (flatHotel + flatDa + flatSpares + flatCourier + flatPrinting + flatMobile + flatMisc);
          if (remainder > 0) {
            if (mode.includes("bike")) bikeAmt += remainder;
            else if (mode.includes("car")) carAmt += remainder;
            else if (mode.includes("bus")) busAmt += remainder;
            else if (mode.includes("train")) trainAmt += remainder;
            else if (mode.includes("auto") || mode.includes("cab")) autoAmt += remainder;
            else miscAmt += remainder;
          }
        } else {
          if (mode.includes("bike")) {
            bikeAmt += total;
          } else if (mode.includes("car")) {
            carAmt += total;
          } else if (mode.includes("bus")) {
            busAmt += total;
          } else if (mode.includes("train")) {
            trainAmt += total;
          } else if (mode.includes("auto") || mode.includes("cab") || mode.includes("taxi")) {
            autoAmt += total;
          } else if (mode.includes("hotel") || mode.includes("stay") || mode.includes("boarding") || mode.includes("lodging") || desc.includes("hotel")) {
            hotelAmt += total;
          } else if (mode.includes("da") || mode.includes("allowance") || mode.includes("food") || mode.includes("meal") || desc.includes("da")) {
            daAmt += total;
          } else if (mode.includes("spare") || mode.includes("purchase") || desc.includes("spare") || desc.includes("purchase")) {
            sparesAmt += total;
          } else if (desc.includes("courier") || desc.includes("courrier") || mode.includes("courier")) {
            courierAmt += total;
          } else if (desc.includes("print") || desc.includes("stationery") || mode.includes("stationery")) {
            printingAmt += total;
          } else if (desc.includes("recharge") || desc.includes("mobile") || mode.includes("mobile")) {
            mobileAmt += total;
          } else {
            miscAmt += total;
          }
        }
      }
    });

    const items = [
      { name: "Bike (TA)", value: Math.round(bikeAmt * 100) / 100, color: CATEGORY_CONFIG["Bike (TA)"].color, icon: CATEGORY_CONFIG["Bike (TA)"].icon },
      { name: "Car (TA)", value: Math.round(carAmt * 100) / 100, color: CATEGORY_CONFIG["Car (TA)"].color, icon: CATEGORY_CONFIG["Car (TA)"].icon },
      { name: "Bus Fare", value: Math.round(busAmt * 100) / 100, color: CATEGORY_CONFIG["Bus Fare"].color, icon: CATEGORY_CONFIG["Bus Fare"].icon },
      { name: "Train Fare", value: Math.round(trainAmt * 100) / 100, color: CATEGORY_CONFIG["Train Fare"].color, icon: CATEGORY_CONFIG["Train Fare"].icon },
      { name: "Auto / Cab", value: Math.round(autoAmt * 100) / 100, color: CATEGORY_CONFIG["Auto / Cab"].color, icon: CATEGORY_CONFIG["Auto / Cab"].icon },
      { name: "Daily Allowance (DA)", value: Math.round(daAmt * 100) / 100, color: CATEGORY_CONFIG["Daily Allowance (DA)"].color, icon: CATEGORY_CONFIG["Daily Allowance (DA)"].icon },
      { name: "Hotel / Lodging", value: Math.round(hotelAmt * 100) / 100, color: CATEGORY_CONFIG["Hotel / Lodging"].color, icon: CATEGORY_CONFIG["Hotel / Lodging"].icon },
      { name: "Local Purchase / Spares", value: Math.round(sparesAmt * 100) / 100, color: CATEGORY_CONFIG["Local Purchase / Spares"].color, icon: CATEGORY_CONFIG["Local Purchase / Spares"].icon },
      { name: "Courier Charges", value: Math.round(courierAmt * 100) / 100, color: CATEGORY_CONFIG["Courier Charges"].color, icon: CATEGORY_CONFIG["Courier Charges"].icon },
      { name: "Printing & Stationery", value: Math.round(printingAmt * 100) / 100, color: CATEGORY_CONFIG["Printing & Stationery"].color, icon: CATEGORY_CONFIG["Printing & Stationery"].icon },
      { name: "Mobile / Internet", value: Math.round(mobileAmt * 100) / 100, color: CATEGORY_CONFIG["Mobile / Internet"].color, icon: CATEGORY_CONFIG["Mobile / Internet"].icon },
      { name: "Miscellaneous", value: Math.round(miscAmt * 100) / 100, color: CATEGORY_CONFIG["Miscellaneous"].color, icon: CATEGORY_CONFIG["Miscellaneous"].icon },
    ].filter((item) => item.value > 0);

    const total = items.reduce((acc, curr) => acc + curr.value, 0);

    return { items, total };
  }, [expenses]);

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
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-display uppercase tracking-wider text-ink-900 m-0 leading-none">
              CONSOLIDATED CATEGORIES
            </h2>
            <p className="text-[10.5px] text-ink-500 font-sans mt-1 m-0 leading-none">
              Live breakdown across all travel, DA, hotel & bills
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-bold text-ink-700 bg-surface-sunken/80 px-2.5 py-1 rounded-[4px] border border-line">
          <Layers className="w-3 h-3 text-accent-600" />
          <span>{categoryData.items.length} Active</span>
        </div>
      </div>

      {categoryData.items.length === 0 ? (
        <div className="py-12 text-center text-ink-400 text-xs font-semibold">
          No category spend data recorded for this month.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center py-2">
          {/* Donut Chart */}
          <div className="sm:col-span-5 h-40 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.items}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.items.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
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
                        <div className="bg-ink-900 text-white rounded-[4px] p-2.5 text-xs font-mono shadow-lg border border-ink-700">
                          <p className="font-bold text-[11px] text-ink-300 m-0 pb-0.5">{data.name}</p>
                          <div className="flex items-center justify-between gap-3 text-[10.5px]">
                            <span className="text-white font-bold">₹{Number(data.value).toLocaleString("en-IN")}</span>
                            <span className="text-ink-400">({pct}%)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[8px] font-mono uppercase text-ink-400 font-bold leading-none">TOTAL</span>
              <span className="text-[11.5px] font-bold font-mono text-ink-900 leading-tight mt-0.5">
                ₹{categoryData.total >= 100000 ? `${(categoryData.total / 100000).toFixed(1)}L` : categoryData.total.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Detailed Category List with smooth scroll */}
          <div className="sm:col-span-7 space-y-1.5 pr-1 max-h-44 overflow-y-auto custom-scrollbar">
            {categoryData.items.map((cat) => {
              const pct = categoryData.total > 0
                ? Math.round((cat.value / categoryData.total) * 100)
                : 0;
              return (
                <div key={cat.name} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10.5px] font-semibold leading-tight">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs shrink-0">{cat.icon}</span>
                      <span className="text-ink-700 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] shrink-0">
                      <span className="font-bold text-ink-900">₹{cat.value.toLocaleString("en-IN")}</span>
                      <span className="text-ink-400 w-7 text-right font-medium">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-surface-sunken rounded-full h-1 overflow-hidden">
                    <div
                      className="h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, pct)}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 border-t border-line flex items-center justify-between text-[10px] text-ink-500 font-mono">
        <span>Active Categories: {categoryData.items.length}</span>
        <span className="font-bold text-ink-900">₹{categoryData.total.toLocaleString("en-IN")} Month Total</span>
      </div>
    </div>
  );
};
