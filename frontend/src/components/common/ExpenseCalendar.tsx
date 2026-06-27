import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter } from "lucide-react";

interface CalendarExpenseItem {
  date: string; // e.g. "2026-06-27"
  amount: number;
  label: string;
  submitter?: string;
  status: string;
}

interface ExpenseCalendarProps {
  expenses: any[]; // Raw backend claims list
  isTeamView?: boolean;
  selectMonth?: string; // Toggled parent filter month e.g. "2026-06"
}

export default function ExpenseCalendar({ expenses, isTeamView = false, selectMonth }: ExpenseCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Sync selected month from parent filter selector changes
  useEffect(() => {
    if (selectMonth) {
      const [y, m] = selectMonth.split("-");
      setCurrentDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  }, [selectMonth]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper to format date keys
  const getDayKey = (dayNum: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(dayNum).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // Process claims list to map sums and details per date
  const dateMap: Record<string, { total: number; list: CalendarExpenseItem[] }> = {};
  
  expenses.forEach(e => {
    // Backend returns 'itinerary' for personal expense model list, and 'date' for team expense list
    const rawDate = e.itinerary || e.date;
    if (!rawDate) return;
    
    // Extract date from standard "YYYY-MM-DD" format
    const match = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    const key = `${match[1]}-${match[2]}-${match[3]}`;
    
    if (!dateMap[key]) {
      dateMap[key] = { total: 0, list: [] };
    }

    const item: CalendarExpenseItem = {
      date: key,
      amount: e.amount || 0,
      label: e.expense_code || "Claim",
      submitter: e.submitter_name,
      status: e.status || "Open"
    };

    // Filter by status if selected
    if (filterStatus !== "all" && item.status.toLowerCase() !== filterStatus.toLowerCase()) {
      return;
    }

    dateMap[key].total += item.amount;
    dateMap[key].list.push(item);
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week index (0-6)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar cells grid
  const daysGrid: Array<{ day: number | null; key: string | null }> = [];
  // Empty spaces for previous month overflow
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push({ day: null, key: null });
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push({ day: d, key: getDayKey(d) });
  }

  return (
    <div className="bg-white border border-gray-200 border-t-4 border-t-blue-600 rounded shadow-sm overflow-hidden flex flex-col font-sans text-gray-800">
      
      {/* Title & Filter Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-255 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-gray-700">
          <CalendarIcon className="w-4 h-4 text-blue-600" />
          {isTeamView ? "Team Expense Calendar" : "My Expense Calendar"}
        </h3>
        
        {/* Quick Filter */}
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[9px] font-black focus:outline-none"
          >
            <option value="all">ALL CLAIMS</option>
            <option value="approved">APPROVED ONLY</option>
            <option value="pending">PENDING ONLY</option>
            <option value="rejected">REJECTED ONLY</option>
          </select>
        </div>
      </div>

      {/* Date Controls Navigator */}
      <div className="p-3 border-b border-gray-150 flex items-center justify-between bg-white shrink-0">
        <button 
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 rounded border border-gray-200 text-gray-650 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-black uppercase tracking-wider text-gray-800">
          {monthNames[month]} {year}
        </span>
        <button 
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded border border-gray-200 text-gray-650 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid Cells */}
      <div className="p-3 bg-gray-50/50">
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid layout */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysGrid.map((cell, idx) => {
            if (!cell.day) {
              return <div key={idx} className="aspect-square bg-transparent rounded border border-transparent"></div>;
            }
            
            const dayKey = cell.key || "";
            const dataEntry = dateMap[dayKey];
            const hasData = dataEntry && dataEntry.total > 0;

            return (
              <div 
                key={idx}
                className={`aspect-square relative rounded border flex flex-col items-center justify-between p-1 transition-all ${
                  hasData 
                    ? "bg-blue-50 border-blue-200 text-blue-800" 
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                {/* Day number */}
                <span className="text-[10px] font-bold self-start">{cell.day}</span>
                
                {/* Sum badge */}
                {hasData && (
                  <span className="text-[7.5px] font-black truncate max-w-full font-mono mt-auto text-blue-700">
                    ₹{dataEntry.total.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
