const fs = require('fs');
const file = './src/components/common/RajasthanMapChart.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update 8 KPI Summary Stat Cards Block
const sMarker = `{/* Statewide / Zone KPI Summary Bar (8 Live Metrics) */}`;
const eMarker = `{/* Map Content Body */}`;

const sIdx = content.indexOf(sMarker);
const eIdx = content.indexOf(eMarker);

if (sIdx !== -1 && eIdx !== -1) {
  const newKpiBlock = `{/* Statewide / Zone KPI Summary Bar (8 Live Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 p-2.5 sm:p-3.5 bg-slate-50/90 border-b border-slate-200">
        {/* 1. Total Facilities */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Facilities</span>
              <span className="text-[7.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Locations</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-slate-900 leading-none block truncate">{summaryStats.totalFacilities}</span>
          </div>
        </div>

        {/* 2. Total Calls */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Calls</span>
              <span className="text-[7.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Assigned</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-slate-900 leading-none block truncate">{summaryStats.totalCallsAssigned}</span>
          </div>
        </div>

        {/* 3. Closed Calls */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Closed Calls</span>
              <span className="text-[7.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Completed</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-emerald-700 leading-none block truncate">{summaryStats.totalCallsCompleted}</span>
          </div>
        </div>

        {/* 4. PMS Count */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">PMS Done</span>
              <span className="text-[7.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">PMS Calls</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-indigo-700 leading-none block truncate">{summaryStats.totalPms}</span>
          </div>
        </div>

        {/* 5. Calibration */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Calibration</span>
              <span className="text-[7.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Calibrations</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-purple-700 leading-none block truncate">{summaryStats.totalCalibration}</span>
          </div>
        </div>

        {/* 6. Engineers */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Engineers</span>
              <span className="text-[7.5px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Field Staff</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-slate-900 leading-none block truncate">{summaryStats.totalEngineers}</span>
          </div>
        </div>

        {/* 7. Managers */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Managers</span>
              <span className="text-[7.5px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Team Leads</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-slate-900 leading-none block truncate">{summaryStats.totalManagers}</span>
          </div>
        </div>

        {/* 8. Avg Expense per Staff */}
        <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">Avg / Staff</span>
              <span className="text-[7.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded font-mono shrink-0 truncate">Per Staff</span>
            </div>
            <span className="text-xs sm:text-base font-mono font-extrabold text-amber-800 leading-none block truncate">
              ₹{summaryStats.avgExpensePerEngineer.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      `;

  content = content.slice(0, sIdx) + newKpiBlock + content.slice(eIdx);
  fs.writeFileSync(file, content, 'utf8');
  console.log('RAJASTHAN MAP KPI CARDS FIXED SUCCESSFULLY');
} else {
  console.log('KPI MARKERS NOT FOUND', { sIdx, eIdx });
}
