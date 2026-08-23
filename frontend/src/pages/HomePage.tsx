import React, { Suspense, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import HomeSkeleton from "../components/common/HomeSkeleton";
import { Button, Table, Modal } from "antd";
import { 
  FileText, 
  ChevronUp, 
  ArrowRight
} from "lucide-react";
import { checkIsHeic, convertHeicToJpegUrl } from "../utils/heic";

import { useHomeExpenses } from "../hooks/useHomeExpenses";
import { ZohoHeader } from "../components/home/ZohoHeader";
import { ZohoKpiRow } from "../components/home/ZohoKpiRow";
import { ZohoSpendChart } from "../components/home/ZohoSpendChart";
import { ZohoCategoryChart } from "../components/home/ZohoCategoryChart";
import { ZohoPendingTasks } from "../components/home/ZohoPendingTasks";
import { ZohoRecentExpenses } from "../components/home/ZohoRecentExpenses";
import { ZohoExecutiveComparison } from "../components/home/ZohoExecutiveComparison";
import { ZohoSubmissionComplianceWidget } from "../components/home/ZohoSubmissionComplianceWidget";
import { getStatusBadgeClass, getStatusLabel, renderAntdStatusTag } from "../components/home/claimsColumns";

const ClaimDetailsModal = React.lazy(() => import("../components/common/ClaimDetailsModal"));

// ─── Inline Spinner (Ditto Login Page) ───────────────────────────────────────
const Spinner = () => (
  <span
    className="inline-block shrink-0 animate-spin"
    style={{
      width: 15,
      height: 15,
      border: "2px solid rgba(67, 56, 202, 0.35)",
      borderTopColor: "#4338CA",
      borderRadius: "50%",
    }}
  />
);

export default function HomePage() {
  const navigate = useNavigate();
  const expenses = useHomeExpenses();

  const {
    user,
    isReviewerRole,
    pendingApprovalsCount,
    pendingLimitRequestsCount,
    loadingMyExpenses,
    loadingTeamExpenses,
    safeMyExpenses,
    safeTeamExpenses,
    activeTab,
    handleTabChange,
    selectMonth,
    setSelectMonth,
    filterZone,
    setFilterZone,
    uniqueZones,
    filterDistrict,
    setFilterDistrict,
    uniqueDistricts,
    filterEmployee,
    setFilterEmployee,
    uniqueEmployees,
    filteredPersonalExpenses,
    filteredTeamExpenses,
    statsTotalClaims,
    statsApprovedClaims,
    statsPendingClaims,
    statsReturnedClaims,
    statsRejectedClaims,
    totalAmount,
    approvedAmount,
    pendingAmount,
    returnedAmount,
    rejectedAmount,
    showDetailsModal,
    setShowDetailsModal,
    claimDetails,
    setClaimDetails,
    comments,
    setComments,
    actionLoading,
    showStatsModal,
    setShowStatsModal,
    statsModalType,
    statsModalClaims,
    setStatsModalClaims,
    homeModalPageSize,
    setHomeModalPageSize,
    showPageScrollTop,
    handleOpenClaimDetails,
    handleDeleteClaim,
    handleApprove,
    handleReject,
    handleOpenStatsModal,
  } = expenses;

  // ── In-app Lightbox State ──────────────────────────────────────────────────
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);

  useEffect(() => {
    if (lightboxImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.pointerEvents = '';
      document.documentElement.style.touchAction = '';
    }
  }, [lightboxImage]);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    if (!lightboxImage) {
      setDisplayImageUrl(null);
      setIsConvertingHeic(false);
      return;
    }

    checkIsHeic(lightboxImage).then(isHeicImg => {
      if (!active) return;
      if (isHeicImg) {
        setIsConvertingHeic(true);
        convertHeicToJpegUrl(lightboxImage)
          .then((url) => {
            if (!active) { URL.revokeObjectURL(url); return; }
            localUrl = url;
            setDisplayImageUrl(url);
            setIsConvertingHeic(false);
          })
          .catch(() => {
            if (active) {
              setDisplayImageUrl(lightboxImage);
              setIsConvertingHeic(false);
            }
          });
      } else {
        setDisplayImageUrl(lightboxImage);
      }
    });

    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [lightboxImage]);

    const isComparativeExpenseAllowed = React.useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return (
      r.includes("coordinator") ||
      r.includes("admin") ||
      r.includes("account") ||
      r.includes("travel") ||
      r.includes("mis") ||
      r.includes("director") ||
      r.includes("vp") ||
      r.includes("project head") ||
      r.includes("project_head")
    );
  }, [user?.role]);

  const activeClaims = activeTab === "my-claims" ? filteredPersonalExpenses : filteredTeamExpenses;
  const isPageLoading = (activeTab === "my-claims" ? loadingMyExpenses : loadingTeamExpenses) &&
    (activeTab === "my-claims" ? (safeMyExpenses?.length || 0) === 0 : (safeTeamExpenses?.length || 0) === 0);

  if (!user) return null;
  if (isPageLoading) return <HomeSkeleton />;

  return (
    <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900">
      {/* ══════════════════════════════════════════════════════════════════
          CLEAN SUBTLE AMBIENT CANVAS (Ditto Login Page)
      ══════════════════════════════════════════════════════════════════ */}
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

      {/* Delicate Architectural Grid (Ditto Login Page) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 space-y-3 text-ink-900 font-sans antialiased max-w-7xl mx-auto pb-10">
        
        {/* ── 1. Compact Zoho Header: Greeting + Scope Tabs + Dropdown Filters + Actions ─ */}
        <ZohoHeader
          user={user}
          isReviewerRole={isReviewerRole}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          myExpensesCount={filteredPersonalExpenses.length}
          teamExpensesCount={filteredTeamExpenses.length}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingLimitRequestsCount={pendingLimitRequestsCount}
          selectMonth={selectMonth}
          onSelectMonth={setSelectMonth}
          filterZone={filterZone}
          onFilterZoneChange={setFilterZone}
          uniqueZones={uniqueZones}
          filterDistrict={filterDistrict}
          onFilterDistrictChange={setFilterDistrict}
          uniqueDistricts={uniqueDistricts}
          filterEmployee={filterEmployee}
          onFilterEmployeeChange={setFilterEmployee}
          uniqueEmployees={uniqueEmployees}
        />

        {/* ── 2. Compact Zoho Summary KPI Cards Row (5 Status Cards) ──── */}
        <ZohoKpiRow
          totalAmount={totalAmount}
          approvedAmount={approvedAmount}
          pendingAmount={pendingAmount}
          returnedAmount={returnedAmount}
          rejectedAmount={rejectedAmount}
          totalCount={statsTotalClaims.length}
          approvedCount={statsApprovedClaims.length}
          pendingCount={statsPendingClaims.length}
          returnedCount={statsReturnedClaims.length}
          rejectedCount={statsRejectedClaims.length}
          statsTotalClaims={statsTotalClaims}
          statsApprovedClaims={statsApprovedClaims}
          statsPendingClaims={statsPendingClaims}
          statsReturnedClaims={statsReturnedClaims}
          statsRejectedClaims={statsRejectedClaims}
          onOpenModal={handleOpenStatsModal}
        />

        {/* ── 2.5 Executive Comparative Analytics (Last Month vs Current Month) ── */}
        {isComparativeExpenseAllowed && (
          <ZohoExecutiveComparison
            currentClaims={activeClaims}
            user={user}
            isReviewerRole={isReviewerRole}
            activeTab={activeTab}
            selectMonth={selectMonth}
            filterZone={filterZone}
            filterDistrict={filterDistrict}
            filterEmployee={filterEmployee}
          />
        )}

        {/* ── 3 & 4. Analytics Widgets (Spend Trend + Category Donut) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-7 min-h-[280px]">
            <ZohoSpendChart expenses={activeClaims} selectMonth={selectMonth} />
          </div>
          <div className="lg:col-span-5 min-h-[280px]">
            <ZohoCategoryChart expenses={activeClaims} />
          </div>
        </div>

        {/* ── 5 & 6. Actionable & Activity Widgets ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 min-h-[260px]">
            <ZohoPendingTasks
              myClaims={safeMyExpenses}
              teamClaims={safeTeamExpenses}
              isReviewer={isReviewerRole}
              onOpenClaim={handleOpenClaimDetails}
            />
          </div>
          <div className="lg:col-span-7 min-h-[260px]">
            <ZohoRecentExpenses
              claims={activeClaims}
              onOpenClaim={handleOpenClaimDetails}
              activeTab={activeTab}
            />
          </div>
        </div>

        {/* ── 6.5 Engineer Daily Submission Compliance & Defaulter Tracker ── */}
        {isComparativeExpenseAllowed && (
          <ZohoSubmissionComplianceWidget
            user={user}
            activeTab={activeTab}
            expenses={activeTab === "team-claims" ? safeTeamExpenses : safeMyExpenses}
            selectMonth={selectMonth}
            filterZone={filterZone}
            filterDistrict={filterDistrict}
            filterEmployee={filterEmployee}
            uniqueEmployees={uniqueEmployees}
          />
        )}

        {/* ── 7. Compact Ledger Banner ────────────────────────────────── */}
        <div
          className="px-4 py-3 bg-white border border-line rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs"
          style={{
            boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-ink-700">
              Need to search older historical records, filter by district, or export Excel reports?
            </span>
          </div>
          <Link
            to="/claims-history"
            className="px-3 py-1.5 rounded-lg bg-surface-sunken hover:bg-slate-200/70 text-accent-700 font-semibold border border-line transition-colors flex items-center gap-1.5 shrink-0 text-xs"
          >
            <span>Open Complete Claims Register</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
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

      {/* ================= STATS CLAIMS POPUP MODAL ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-ink-900 font-display font-bold text-sm">
            <FileText className="w-4 h-4 text-accent-600" />
            <span>{statsModalType} Claims ({statsModalClaims.length})</span>
          </div>
        }
        open={showStatsModal}
        onCancel={() => { setShowStatsModal(false); setStatsModalClaims([]); }}
        width={950}
        footer={[
          <Button key="stats-close" onClick={() => { setShowStatsModal(false); setStatsModalClaims([]); }} className="rounded-lg text-xs font-semibold">
            Close
          </Button>
        ]}
        bodyStyle={{ 
          maxHeight: "70vh", 
          overflowY: "auto", 
          padding: "16px",
          background: "#ffffff"
        }}
      >
        {statsModalClaims.length === 0 ? (
          <div className="py-12 text-center text-ink-400 text-xs">
            <p className="font-semibold">No claims found in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl">
            <Table
              dataSource={statsModalClaims}
              rowKey="id"
              pagination={{ 
                pageSize: homeModalPageSize, 
                showSizeChanger: true, 
                pageSizeOptions: ["10", "25", "50", "100"],
                onChange: (_, size) => setHomeModalPageSize(size),
                onShowSizeChange: (_, size) => setHomeModalPageSize(size),
                size: "small" 
              }}
              size="small"
              sticky={true}
              scroll={{ x: "max-content", y: 380 }}
              onRow={(record) => ({
                onClick: () => {
                  setShowStatsModal(false);
                  handleOpenClaimDetails(record.id);
                },
                className: "cursor-pointer hover:bg-surface-sunken/60"
              })}
              columns={[
                ...(activeTab === "team-claims" ? [{
                  title: "Employee",
                  key: "employee",
                  width: 140,
                  render: (_: any, record: any) => (
                    <div>
                      <span className="font-bold text-ink-900 block leading-tight text-xs">{record.submitter_name}</span>
                      <span className="text-[10px] font-mono uppercase block mt-0.5 text-accent-700 font-semibold">{record.submitter_code}</span>
                    </div>
                  )
                }] : []),
                {
                  title: "Claim ID",
                  dataIndex: "expense_code",
                  key: "expense_code",
                  width: 140,
                  render: (text) => <span className="font-mono font-bold text-accent-700 text-xs">{text}</span>,
                },
                {
                  title: "Date",
                  dataIndex: "date",
                  key: "date",
                  width: 100,
                  render: (_, record) => <span className="font-mono text-ink-700 text-xs">{record.itinerary || record.date}</span>,
                },
                {
                  title: "Purpose",
                  dataIndex: "description",
                  key: "description",
                  width: 180,
                  ellipsis: true,
                  render: (text, record) => <span className="text-ink-700 text-xs">{text || record.purpose || "—"}</span>,
                },
                {
                  title: "Travel Mode",
                  dataIndex: "travel_mode",
                  key: "travel_mode",
                  width: 100,
                  render: (text, record) => <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-sunken text-ink-700 border border-line">{text || record.category || "Bike"}</span>,
                },
                {
                  title: "Amount",
                  dataIndex: "amount",
                  key: "amount",
                  width: 100,
                  align: "right",
                  render: (val) => <span className="font-mono font-bold text-ink-900 text-xs">₹{(val || 0).toLocaleString()}</span>,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  width: 110,
                  align: "right",
                  render: (status) => renderAntdStatusTag(status),
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      <Modal
        open={!!lightboxImage}
        destroyOnClose={true}
        zIndex={99999999}
        footer={null}
        onCancel={() => {
          setLightboxImage(null);
          setLbZoom(1);
          document.body.style.overflow = '';
          document.body.style.pointerEvents = '';
          document.body.style.touchAction = '';
          document.documentElement.style.overflow = '';
          document.documentElement.style.pointerEvents = '';
          document.documentElement.style.touchAction = '';
        }}
        width={750}
        bodyStyle={{ padding: 0, background: "#12151A", borderRadius: "16px", overflow: "hidden" }}
        className="lightbox-modal"
        closeIcon={
          <div className="bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm border border-white/20 transition-colors font-bold">✕</div>
        }
        centered
        afterClose={() => setLbZoom(1)}
      >
        <div className="flex items-center justify-center gap-2 p-2.5 bg-black/40 backdrop-blur-md border-b border-white/10">
          <button
            onClick={() => setLbZoom((z: number) => Math.max(0.2, parseFloat((z - 0.25).toFixed(2))))}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition cursor-pointer border border-white/15"
            title="Zoom Out"
          >−</button>
          <span className="text-xs font-mono font-bold text-white min-w-[50px] text-center">{Math.round(lbZoom * 100)}%</span>
          <button
            onClick={() => setLbZoom((z: number) => Math.min(5, parseFloat((z + 0.25).toFixed(2))))}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition cursor-pointer border border-white/15"
            title="Zoom In"
          >+</button>
          <button
            onClick={() => setLbZoom(1)}
            className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer border border-white/15"
            title="Reset Zoom"
          >Reset</button>
        </div>
        <div className="bg-[#12151A] overflow-auto max-h-[78vh] flex items-center justify-center p-4">
          {isConvertingHeic ? (
            <div className="flex flex-col items-center gap-3 py-12 text-white">
              <Spinner />
              <span className="text-xs font-medium text-ink-300">Converting Apple HEIC image...</span>
            </div>
          ) : (
            <img
              src={displayImageUrl || lightboxImage || undefined}
              alt="Receipt Invoice Lightbox"
              style={{ transform: `scale(${lbZoom})`, transformOrigin: "top center", transition: "transform 0.2s", maxWidth: "100%", display: "block", borderRadius: 8 }}
            />
          )}
        </div>
      </Modal>

      {showPageScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-6 bottom-20 w-9 h-9 rounded-full bg-accent-600 hover:bg-accent-700 text-white shadow-md flex items-center justify-center cursor-pointer z-50 hover:scale-105 active:scale-95 transition-all"
        >
          <ChevronUp className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
}
