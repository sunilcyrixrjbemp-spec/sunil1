import React, { useEffect, useState, useMemo } from "react";
import { expenseService } from "../services/expenseService";
import toast from "react-hot-toast";
import { getISTMonth } from "../utils/dateUtils";
import LocationFilters from "../components/common/LocationFilters";
import ClaimDetailsModal from "../components/common/ClaimDetailsModal";
import ResetApprovalLevelModal from "../components/admin/ResetApprovalLevelModal";
import HomeSkeleton from "../components/common/HomeSkeleton";
import { 
  FileText, 
  Route, 
  Car, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RefreshCw, 
  RotateCcw,
  Search
} from "lucide-react";

// Reusable Apple iOS / Meta AI style soft gradient IconTile component (Matches HomePage 1:1)
const IconTile = ({ 
  icon: Icon, 
  gradientFrom, 
  gradientTo, 
  shadowColor = "rgba(0, 0, 0, 0.12)" 
}: { 
  icon: React.ElementType; 
  gradientFrom: string; 
  gradientTo: string; 
  shadowColor?: string;
}) => (
  <div 
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white shrink-0`}
    style={{ boxShadow: `0 2px 6px -1px ${shadowColor}` }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

export default function ClaimLevelResetPage() {
  const [user] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [claims, setClaims] = useState<any[]>([]);

  // Month selector (default current IST month YYYY-MM)
  const [selectMonth, setSelectMonth] = useState<string>(() => getISTMonth());
  
  // Filters matching HomePage
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const availableZones = useMemo(() => Array.from(new Set(claims.map(c => c.zone || c.user_zone).filter(Boolean))), [claims]);
  const availableDistricts = useMemo(() => Array.from(new Set(claims.map(c => c.district || c.user_district).filter(Boolean))), [claims]);
  const availableEngineers = useMemo(() => {
    const map = new Map();
    claims.forEach(c => {
      const code = String(c.submitter_code || c.user_id || c.userId || "");
      const name = c.submitter_name || c.employee_name || c.user_name || c.engineer_name || "Unknown";
      if (code && !map.has(code)) {
        map.set(code, { code, name });
      }
    });
    return Array.from(map.values());
  }, [claims]);

  // ClaimDetailsModal state
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);

  // ResetApprovalLevelModal state
  const [resetModalState, setResetModalState] = useState<{
    isOpen: boolean;
    expenseId: number;
    expenseCode: string;
  }>({
    isOpen: false,
    expenseId: 0,
    expenseCode: "",
  });

  const loadAllClaims = async () => {
    setLoading(true);
    try {
      // Fetch all claims for selected month from approval & expense services
      const res = await expenseService.getTeamExpenses(selectMonth);
      if (Array.isArray(res)) {
        setClaims(res);
      } else {
        setClaims([]);
      }
    } catch (err: any) {
      console.error("Failed to load claims:", err);
      toast.error("Failed to load claims for selected month.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllClaims();
  }, [selectMonth]);

  // Clean zone helper
  const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

  // Filtered claims list
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // 1. Zone filter
      if (filterZone !== "all") {
        const cZone = cleanZone(claim.zone || claim.user_zone || claim.district_zone || "");
        if (cZone !== cleanZone(filterZone)) return false;
      }

      // 2. District filter
      if (filterDistrict !== "all") {
        const cDist = (claim.district || claim.hq || claim.user_district || "").toLowerCase().trim();
        if (cDist !== filterDistrict.toLowerCase().trim()) return false;
      }

      // 3. Employee filter
      if (filterEmployee !== "all") {
        const uId = String(claim.submitter_code || claim.user_id || claim.userId || "");
        if (uId !== filterEmployee) return false;
      }

      // 4. Status filter
      if (statusFilter !== "all") {
        const st = (claim.status || "").toLowerCase();
        if (statusFilter === "approved" && st !== "approved") return false;
        if (statusFilter === "rejected" && st !== "rejected") return false;
        if (statusFilter === "pending" && !st.includes("submitted") && st !== "pending" && st !== "draft") return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (claim.expense_code || claim.code || claim.id || "").toString().toLowerCase();
        const empName = (claim.submitter_name || claim.employee_name || claim.user_name || claim.engineer_name || "").toLowerCase();
        const empCode = (claim.submitter_code || claim.employee_code || claim.user_code || "").toLowerCase();
        const desc = (claim.description || claim.purpose || "").toLowerCase();
        if (!code.includes(q) && !empName.includes(q) && !empCode.includes(q) && !desc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [claims, filterZone, filterDistrict, filterEmployee, statusFilter, searchQuery]);

  // Executive Micro-Stats (Matching HomePage Datacards 1:1)
  const statsTotalClaims = filteredClaims;
  const statsApprovedClaims = filteredClaims.filter(c => (c.status || "").toLowerCase() === "approved");
  const statsRejectedClaims = filteredClaims.filter(c => (c.status || "").toLowerCase() === "rejected");
  const statsPendingClaims = filteredClaims.filter(c => {
    const s = (c.status || "").toLowerCase();
    return s.includes("submitted") || s === "pending" || s === "draft";
  });

  const getStatsSums = (list: any[]) => list.reduce((sum, c) => sum + (parseFloat(c.amount || c.total_amount || c.approved_amount || 0) || 0), 0);
  const totalAmount = getStatsSums(statsTotalClaims);
  const approvedAmount = getStatsSums(statsApprovedClaims);
  const pendingAmount = getStatsSums(statsPendingClaims);
  const rejectedAmount = getStatsSums(statsRejectedClaims);

  const activeValidClaims = filteredClaims.filter(c => {
    const s = (c.status || "").toLowerCase();
    return s !== "cancelled" && s !== "admin_cancelled" && s !== "rejected";
  });

  const totalKm = activeValidClaims.reduce((sum, e) => sum + (parseFloat(e.total_km || e.distance_km || e.distance || 0) || 0), 0);
  const totalAuto = activeValidClaims.reduce((sum, e) => sum + (parseFloat(e.total_auto || e.auto_amount || e.sub_amount || 0) || 0), 0);

  const handleOpenResetModal = (e: React.MouseEvent, id: number, code: string) => {
    e.stopPropagation();
    setResetModalState({
      isOpen: true,
      expenseId: id,
      expenseCode: code,
    });
  };

  const handleRowClick = (claim: any) => {
    setSelectedClaim(claim);
    setShowClaimModal(true);
  };

  if (loading && claims.length === 0) {
    return <HomeSkeleton />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 animate-fadeIn text-[#212529] p-0 sm:p-2 md:p-4 w-full max-w-none font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Darker Slate-Blue Enterprise Header Bar (Identical to HomePage) */}
      <div className="bg-[#4A6A8A] text-white rounded-lg px-3 py-2 flex items-center justify-between shadow-2xs mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
            <RotateCcw className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight m-0 flex items-center gap-2">
              <span>CLAIM LEVEL RESET & RE-ROUTING CENTER</span>
              <span className="text-[9px] font-semibold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider text-white">
                ADMIN ACCESS
              </span>
            </h1>
            <p className="text-[10.5px] text-white/80 m-0">
              Select any claim to view approval hierarchy, reset levels, or re-route approvers dynamically
            </p>
          </div>
        </div>

        <button
          onClick={loadAllClaims}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-md text-[11px] font-medium transition-all cursor-pointer border-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Compact High-Density Stat Cards (Identical to HomePage 1:1) */}
      <div className="space-y-1 mb-2">
        <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-normal text-white uppercase">
            CLAIM SUMMARY METRICS
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] font-medium text-white/80 tracking-normal">MONTH:</span>
            <input 
              type="month"
              value={selectMonth}
              onChange={(e) => setSelectMonth(e.target.value)}
              className="bg-white/20 text-white border-0 rounded px-2 py-0.5 text-[10.5px] font-semibold cursor-pointer focus:outline-none"
            />
          </div>
        </div>
        
        {/* Ultra-Slim Datacard Micro-Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {/* Card 1: Total Claimed */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={FileText} gradientFrom="from-blue-500" gradientTo="to-indigo-600" shadowColor="rgba(37, 99, 235, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL CLAIMED</span>
                  <span className="text-[8px] font-medium text-slate-600 bg-slate-100/80 px-1 py-0.5 rounded border border-slate-200/80 leading-none shrink-0">{statsTotalClaims.length} Claims</span>
                </div>
                <span className="text-[13px] font-mono font-bold text-slate-900 leading-none mt-1 whitespace-nowrap">₹{(totalAmount || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total KM */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={Route} gradientFrom="from-amber-500" gradientTo="to-amber-600" shadowColor="rgba(245, 158, 11, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL KM</span>
                <span className="text-[13px] font-mono font-bold text-amber-900 leading-none mt-1 whitespace-nowrap">{(totalKm || 0).toFixed(1)} KM</span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Auto */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={Car} gradientFrom="from-purple-500" gradientTo="to-indigo-600" shadowColor="rgba(147, 51, 234, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">TOTAL AUTO</span>
                <span className="text-[13px] font-mono font-bold text-purple-950 leading-none mt-1 whitespace-nowrap">₹{(totalAuto || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Approved */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={CheckCircle2} gradientFrom="from-emerald-500" gradientTo="to-teal-600" shadowColor="rgba(16, 185, 129, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">APPROVED</span>
                  <span className="text-[8px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60 leading-none shrink-0">{statsApprovedClaims.length} Claims</span>
                </div>
                <span className="text-[13px] font-mono font-bold text-emerald-800 leading-none mt-1 whitespace-nowrap">₹{(approvedAmount || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Card 5: Pending */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={Clock} gradientFrom="from-orange-500" gradientTo="to-amber-600" shadowColor="rgba(249, 115, 22, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">PENDING</span>
                  <span className="text-[8px] font-medium text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/60 leading-none shrink-0">{statsPendingClaims.length} Claims</span>
                </div>
                <span className="text-[13px] font-mono font-bold text-amber-800 leading-none mt-1 whitespace-nowrap">₹{(pendingAmount || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Card 6: Rejected */}
          <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-11">
            <div className="flex items-center gap-2 min-w-0 w-full">
              <IconTile icon={XCircle} gradientFrom="from-rose-500" gradientTo="to-red-600" shadowColor="rgba(239, 68, 68, 0.25)" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">REJECTED</span>
                  <span className="text-[8px] font-medium text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200/60 leading-none shrink-0">{statsRejectedClaims.length} Claims</span>
                </div>
                <span className="text-[13px] font-mono font-bold text-rose-800 leading-none mt-1 whitespace-nowrap">₹{(rejectedAmount || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER WORKSPACE & MAIN TABLE (Matches HomePage 1:1) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-3">
        
        {/* Location Dropdown Filters & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
          <LocationFilters
            selectedZone={filterZone}
            onZoneChange={setFilterZone}
            zones={availableZones}
            selectedDistrict={filterDistrict}
            onDistrictChange={setFilterDistrict}
            districts={availableDistricts}
            selectedEngineer={filterEmployee}
            onEngineerChange={setFilterEmployee}
            engineers={availableEngineers}
          />

          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: "all", label: "ALL", bg: "bg-indigo-600 text-white" },
              { id: "pending", label: "PENDING", bg: "bg-orange-500 text-white" },
              { id: "approved", label: "APPROVED", bg: "bg-emerald-600 text-white" },
              { id: "rejected", label: "REJECTED", bg: "bg-red-600 text-white" }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id as any)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border-0 ${
                  statusFilter === st.id ? `${st.bg} shadow-2xs` : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, emp, name..."
              className="w-full text-[11px] font-medium pl-8 pr-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Claims Table */}
        <div className="border border-slate-200/90 rounded-lg overflow-x-auto shadow-2xs">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loading Claims Workspace...
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              No claims found matching selected month and filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white border-b border-slate-700">
                  <th className="p-2.5 font-mono font-bold uppercase text-[10px]">Claim Code</th>
                  <th className="p-2.5 font-bold uppercase text-[10px]">Employee / Submitter</th>
                  <th className="p-2.5 font-mono font-bold uppercase text-[10px]">Expense Date</th>
                  <th className="p-2.5 font-mono font-bold uppercase text-[10px]">Amount</th>
                  <th className="p-2.5 font-bold uppercase text-[10px]">Status</th>
                  <th className="p-2.5 font-bold uppercase text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClaims.map((claim) => {
                  const st = (claim.status || "").toLowerCase();
                  const claimId = claim.id || claim.expense_id;
                  const claimCode = claim.expense_code || claim.code || `EXP-${claimId}`;
                  const empName = claim.submitter_name || claim.employee_name || claim.user_name || claim.engineer_name || claim.name || "Unknown";
                  const empCode = claim.submitter_code || claim.employee_code || claim.user_code || (claim.user_id ? `ID: ${claim.user_id}` : "");
                  const expDate = claim.expense_date || claim.date || (claim.created_at ? new Date(claim.created_at).toLocaleDateString("en-IN") : "—");
                  const claimAmt = parseFloat(claim.amount || claim.total_amount || 0);

                  return (
                    <tr
                      key={claimId}
                      onClick={() => handleRowClick(claim)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-2.5 font-mono font-extrabold text-slate-900 text-xs">
                        {claimCode}
                      </td>
                      <td className="p-2.5">
                        <div className="font-extrabold text-slate-900 text-xs leading-none">
                          {empName}
                        </div>
                        <div className="text-[9.5px] text-slate-400 font-mono font-bold mt-0.5">
                          {empCode} • {claim.zone || claim.user_zone || "Base"}
                        </div>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-600 text-xs">
                        {expDate}
                      </td>
                      <td className="p-2.5 font-mono font-extrabold text-slate-900 text-xs">
                        ₹{claimAmt.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-wider ${
                            st === "approved"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : st.includes("submitted") || st === "pending"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : st === "rejected"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-slate-100 text-slate-800 border border-slate-300"
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => handleOpenResetModal(e, claimId, claimCode)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10.5px] font-black uppercase tracking-wider cursor-pointer border-0 shadow-2xs transition-all"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Level</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Claim Details Modal (Opens on row click) */}
      {selectedClaim && (
        <ClaimDetailsModal
          open={showClaimModal}
          onClose={() => {
            setShowClaimModal(false);
            setSelectedClaim(null);
          }}
          claimDetails={selectedClaim}
          user={user}
          sourceMode="approval"
        />
      )}

      {/* Reset Approval Level Modal (Opens on Reset Level button click) */}
      <ResetApprovalLevelModal
        isOpen={resetModalState.isOpen}
        onClose={() => setResetModalState({ isOpen: false, expenseId: 0, expenseCode: "" })}
        expenseId={resetModalState.expenseId}
        expenseCode={resetModalState.expenseCode}
        onSuccess={loadAllClaims}
      />
    </div>
  );
}
