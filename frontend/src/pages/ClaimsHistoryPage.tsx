import React, { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowLeft, Plus, RotateCcw, ChevronDown } from "lucide-react";
import { useHomeExpenses } from "../hooks/useHomeExpenses";
import { ClaimsTable } from "../components/home/ClaimsTable";
import { getEnterpriseClaimsColumns, getStatusBadgeClass, getStatusLabel } from "../components/home/claimsColumns";
import HomeSkeleton from "../components/common/HomeSkeleton";

const ClaimDetailsModal = React.lazy(() => import("../components/common/ClaimDetailsModal"));

export default function ClaimsHistoryPage() {
  const navigate = useNavigate();
  const expenses = useHomeExpenses();

  const {
    user,
    isReviewerRole,
    loadingMyExpenses,
    loadingTeamExpenses,
    safeMyExpenses,
    safeTeamExpenses,
    activeTab,
    handleTabChange,
    filterEmployee,
    setFilterEmployee,
    filterDistrict,
    setFilterDistrict,
    filterZone,
    setFilterZone,
    selectMonth,
    setSelectMonth,
    homeStatusFilter,
    setHomeStatusFilter,
    searchClaimId,
    setSearchClaimId,
    uniqueDistricts,
    uniqueEmployees,
    uniqueZones,
    filteredPersonalExpenses,
    filteredTeamExpenses,
    showDetailsModal,
    setShowDetailsModal,
    claimDetails,
    setClaimDetails,
    comments,
    setComments,
    actionLoading,
    homeClaimsPageSize,
    setHomeClaimsPageSize,
    homeTeamPageSize,
    setHomeTeamPageSize,
    handleOpenClaimDetails,
    handleDeleteClaim,
    handleApprove,
    handleReject,
  } = expenses;

  const [_lightboxImage, setLightboxImage] = useState<string | null>(null);

  const columns = useMemo(() => getEnterpriseClaimsColumns(user, activeTab), [user, activeTab]);

  const isPageLoading =
    (activeTab === "my-claims" ? loadingMyExpenses : loadingTeamExpenses) &&
    (activeTab === "my-claims" ? (safeMyExpenses?.length || 0) === 0 : (safeTeamExpenses?.length || 0) === 0);

  const activeRecords = activeTab === "my-claims" ? filteredPersonalExpenses : filteredTeamExpenses;
  const totalAmount = activeRecords.reduce((acc, curr) => acc + Number(curr.amount != null ? curr.amount : (curr.total_amount || 0)), 0);

  const isAnyFilterActive = searchClaimId || homeStatusFilter !== "all" || filterZone !== "all" || filterDistrict !== "all" || filterEmployee !== "all";

  if (!user) return null;
  if (isPageLoading) return <HomeSkeleton />;

  return (
    <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900">
      {/* ── Ambient Background Glow & Delicate Grid ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div
          className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-1"
          style={{
            background: "radial-gradient(circle, #4338CA 0%, rgba(67, 56, 202, 0) 70%)",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-2"
          style={{
            background: "radial-gradient(circle, #6366F1 0%, rgba(99, 102, 241, 0) 70%)",
            filter: "blur(130px)",
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 space-y-3 text-ink-900 font-sans antialiased max-w-7xl mx-auto pb-10">
        
        {/* ── Unified Header Card: Title + Scope Tabs + Stats + New Claim ── */}
        <div
          className="bg-white rounded-2xl border border-line/80 p-3 sm:px-4 sm:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          style={{
            boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
          }}
        >
          {/* Left: Back Arrow + Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="w-8 h-8 rounded-xl bg-surface-sunken hover:bg-slate-200/80 border border-line flex items-center justify-center text-ink-700 hover:text-ink-900 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-bold font-display text-ink-900 tracking-tight m-0 leading-none">
                Claims History & Records Register
              </h1>
              <p className="text-[10.5px] text-ink-500 font-sans mt-1 m-0 leading-none">
                Search, filter, and review all operational expense submissions
              </p>
            </div>
          </div>

          {/* Center & Right: Scope Switcher + Stats + Action Button */}
          <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
            <div className="text-[10.5px] font-mono font-semibold text-ink-500 bg-surface-sunken/80 px-2.5 py-1 rounded-xl border border-line">
              Total: <span className="font-bold text-ink-900 font-mono">₹{totalAmount.toLocaleString("en-IN")}</span> ({activeRecords.length})
            </div>

            {/* Scope Tabs */}
            <div className="flex gap-0.5 bg-surface-sunken p-1 rounded-xl border border-line h-8.5 items-center">
              <button
                type="button"
                onClick={() => handleTabChange("my-claims")}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer leading-none ${
                  activeTab === "my-claims"
                    ? "bg-white text-accent-700 shadow-xs border border-line/60 font-bold"
                    : "text-ink-500 hover:text-ink-900 bg-transparent"
                }`}
              >
                My Claims ({filteredPersonalExpenses.length})
              </button>
              {isReviewerRole && (
                <button
                  type="button"
                  onClick={() => handleTabChange("team-claims")}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer leading-none ${
                    activeTab === "team-claims"
                      ? "bg-white text-accent-700 shadow-xs border border-line/60 font-bold"
                      : "text-ink-500 hover:text-ink-900 bg-transparent"
                  }`}
                >
                  Team Claims ({filteredTeamExpenses.length})
                </button>
              )}
            </div>

            {/* New Claim Button */}
            <button
              type="button"
              onClick={() => navigate("/expense")}
              className="h-8.5 px-3.5 sm:px-4 bg-gradient-to-r from-accent-700 via-accent-600 to-accent-700 hover:brightness-110 active:scale-[0.98] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-md leading-none shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Record Expense</span>
            </button>
          </div>
        </div>

        {/* ── Main Register Card: High-Density Single-Line Filter Toolbar + Table ── */}
        <div
          className="bg-white rounded-2xl border border-line/80 overflow-hidden"
          style={{
            boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
          }}
        >
          {/* High-Density 1-Row Filter Toolbar */}
          <div className="p-2 sm:px-3 bg-surface-sunken/40 border-b border-line flex flex-wrap items-center gap-1.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[150px] max-w-[220px]">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search ID, Name, Purpose..."
                value={searchClaimId}
                onChange={(e) => setSearchClaimId(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-[11px] text-ink-900 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 transition-all placeholder:text-ink-300 shadow-2xs"
              />
            </div>

            {/* Month Selector */}
            <input
              type="month"
              value={selectMonth}
              onChange={(e) => setSelectMonth(e.target.value)}
              className="h-8 px-2.5 text-[11px] font-semibold text-ink-700 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 cursor-pointer w-[125px] shadow-2xs"
              title="Filter by Month"
            />

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={homeStatusFilter}
                onChange={(e) => setHomeStatusFilter(e.target.value as any)}
                className="h-8 pl-2.5 pr-6 text-[11px] font-semibold text-ink-700 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 cursor-pointer appearance-none w-[125px] shadow-2xs"
              >
                <option value="all">All Statuses</option>
                <option value="pending">In Review</option>
                <option value="returned">Returned / Revision</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="w-3 h-3 text-ink-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Team Filters (Zone / District / Employee) */}
            {activeTab === "team-claims" && (
              <>
                {uniqueZones.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterZone}
                      onChange={(e) => setFilterZone(e.target.value)}
                      className="h-8 pl-2.5 pr-6 text-[11px] font-semibold text-ink-700 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 cursor-pointer appearance-none w-[110px] shadow-2xs"
                    >
                      <option value="all">All Zones</option>
                      {uniqueZones.map((z: any) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-ink-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                )}

                {uniqueDistricts.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterDistrict}
                      onChange={(e) => setFilterDistrict(e.target.value)}
                      className="h-8 pl-2.5 pr-6 text-[11px] font-semibold text-ink-700 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 cursor-pointer appearance-none w-[120px] shadow-2xs"
                    >
                      <option value="all">All Districts</option>
                      {uniqueDistricts.map((d: any) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-ink-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                )}

                {uniqueEmployees.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="h-8 pl-2.5 pr-6 text-[11px] font-semibold text-ink-700 bg-white border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-400/20 focus:border-accent-600 cursor-pointer appearance-none w-[150px] shadow-2xs"
                    >
                      <option value="all">All Employees</option>
                      {uniqueEmployees.map((emp: any) => {
                        const code = typeof emp === "object" ? emp.code : emp;
                        const name = typeof emp === "object" ? emp.name : emp;
                        return (
                          <option key={code} value={code}>
                            {code} - {name}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-3 h-3 text-ink-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                )}
              </>
            )}

            {/* Reset Button (If active filters) */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchClaimId("");
                  setHomeStatusFilter("all");
                  setFilterZone("all");
                  setFilterDistrict("all");
                  setFilterEmployee("all");
                }}
                className="h-8 px-2.5 text-[10.5px] font-semibold text-accent-700 bg-accent-50 hover:bg-accent-100/80 rounded-xl border border-accent-200/60 cursor-pointer transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
                title="Reset Filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Table View */}
          <div className="p-2 sm:p-3">
            <ClaimsTable
              data={activeRecords}
              loading={isPageLoading}
              columns={columns}
              pageSize={activeTab === "my-claims" ? homeClaimsPageSize : homeTeamPageSize}
              onPageSizeChange={activeTab === "my-claims" ? setHomeClaimsPageSize : setHomeTeamPageSize}
              onRowClick={(record: any) => handleOpenClaimDetails(record.id)}
              tabType={activeTab}
            />
          </div>
        </div>
      </div>

      {/* ================= CLAIM DETAILS POPUP MODAL (LAZY) ================= */}
      <Suspense fallback={null}>
        {showDetailsModal && (
          <ClaimDetailsModal
            sourceMode="home"
            open={showDetailsModal}
            claimDetails={claimDetails}
            user={user}
            comments={comments}
            setComments={setComments}
            actionLoading={actionLoading}
            handleApprove={handleApprove}
            handleReject={handleReject}
            handleDeleteClaim={handleDeleteClaim}
            onClose={() => { setShowDetailsModal(false); setClaimDetails(null); }}
            navigate={navigate}
            setLightboxImage={setLightboxImage}
            getStatusBadgeClass={getStatusBadgeClass}
            getStatusLabel={getStatusLabel}
          />
        )}
      </Suspense>
    </div>
  );
}
