import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Target, FileText, History, Users, CheckSquare,
  Trash2, MessageCircle, Settings, ChevronRight, Plus, Edit3,
  Check, X, Send, AlertTriangle, TrendingUp, TrendingDown,
  Minus, RefreshCw, Save, Clock, Award
} from "lucide-react";
import toast from "react-hot-toast";
import {
  kpiService, currentFY, getFYMonths, formatMonth,
  calcTrend, SECTION_LABELS, CORE_VALUES_OPTIONS,
  CORE_VALUE_RATINGS
} from "../services/kpiService";
import {
  ScoreBadge, ScoreNumber, KpiStatusBadge, KpiAssignmentBadge,
  KraAttainmentBar, ScoreTrendChart, ScoreHero, StatCard, ActionAlert
} from "../components/kpi/KpiComponents";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KRA {
  name: string;
  target: string;
  weight: number;
  section: "job_role" | "esms" | "core_values";
}

interface KpiAssignment {
  id: number;
  status: string;
  financial_year: string;
  job_role_weight: number;
  esms_weight: number;
  core_values_weight: number;
  starts_from: string | null;
  kras: KRA[] | string | null;
  rejection_reason?: string;
}

interface KpiSubmission {
  id: number;
  status: string;
  period_month: string;
  financial_year: string;
  self_data: any;
  manager_scores: any;
  core_values_ratings: any;
  anything_to_add?: string;
  final_total_score?: number;
  final_job_score?: number;
  final_esms_score?: number;
  final_core_score?: number;
  return_reason?: string;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard",    label: "Dashboard",          icon: LayoutDashboard },
  { id: "my-kpi",      label: "My KPI",              icon: Target },
  { id: "submission",  label: "Monthly Submission",  icon: FileText },
  { id: "history",     label: "Assessments",         icon: History },
  { id: "team",        label: "My Team",             icon: Users,       managerOnly: true },
  { id: "approvals",   label: "Approvals",           icon: CheckSquare, managerOnly: true },
  { id: "deletions",   label: "Deletion Requests",   icon: Trash2,      managerOnly: true },
  { id: "queries",     label: "Score Queries",       icon: MessageCircle },
  { id: "setup",       label: "KPI Setup",           icon: Settings },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJSON<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(val); } catch { return fallback; }
}

function getCurrentReportingMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]}-${now.getFullYear()}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KPIDashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [_user, setUser] = useState<any>(null);
  const [isManager, setIsManager] = useState(false);
  const [fy] = useState(currentFY());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentReportingMonth());

  // Data state
  const [assignment, setAssignment] = useState<KpiAssignment | null>(null);
  const [submission, setSubmission] = useState<KpiSubmission | null>(null);
  const [history, setHistory] = useState<KpiSubmission[]>([]);
  const [yearAnalytics, setYearAnalytics] = useState<any>(null);
  const [attainment, setAttainment] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fyMonths = getFYMonths(fy);

  useEffect(() => {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assignRes, yearRes, attRes, notifRes] = await Promise.allSettled([
        kpiService.getAssignment(fy),
        kpiService.getYearAnalytics(fy),
        kpiService.getAttainment(fy),
        kpiService.getNotifications(),
      ]);

      if (assignRes.status === "fulfilled") setAssignment(assignRes.value.assignment);
      if (yearRes.status === "fulfilled") setYearAnalytics(yearRes.value);
      if (attRes.status === "fulfilled") setAttainment(attRes.value.attainment || []);
      if (notifRes.status === "fulfilled") {
        const n = notifRes.value.notifications || [];
        setNotifications(n);
        const hasTeam = n.some((x: any) => ["kpi_approvals","submissions_to_score","deletion_requests"].includes(x.kind));
        setIsManager(hasTeam);
      }
    } catch (e) {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadSubmission = useCallback(async () => {
    try {
      const res = await kpiService.getSubmission(selectedMonth, fy);
      setSubmission(res.submission);
    } catch { setSubmission(null); }
  }, [selectedMonth, fy]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await kpiService.getHistory(fy);
      setHistory(res.submissions || []);
    } catch { setHistory([]); }
  }, [fy]);

  const loadTeam = useCallback(async () => {
    try {
      const res = await kpiService.getTeam(fy, selectedMonth);
      setTeamData(res);
    } catch { }
  }, [fy, selectedMonth]);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await kpiService.getPendingApprovals(fy);
      setPendingApprovals(res.pending || []);
    } catch { }
  }, [fy]);

  const loadDeletions = useCallback(async () => {
    try {
      const res = await kpiService.getDeletions();
      setDeletions(res.deletions || []);
    } catch { }
  }, []);

  const loadQueries = useCallback(async () => {
    try {
      const res = await kpiService.getQueries();
      setQueries(res.queries || []);
    } catch { }
  }, []);

  useEffect(() => {
    if (activeTab === "submission") loadSubmission();
    if (activeTab === "history") loadHistory();
    if (activeTab === "team") loadTeam();
    if (activeTab === "approvals") loadApprovals();
    if (activeTab === "deletions") loadDeletions();
    if (activeTab === "queries") loadQueries();
  }, [activeTab, loadSubmission, loadHistory, loadTeam, loadApprovals, loadDeletions, loadQueries]);

  const notifCount = notifications.length;
  const trendFromAnalytics: {month: string; score: number | null}[] = yearAnalytics?.monthly_scores?.map((ms: any) => ({ month: ms.month, score: ms.score })) || [];
  const trend = calcTrend(trendFromAnalytics.map((p) => p.score));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAFAF9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-line border-t-accent-600" />
          <p className="text-xs font-mono font-semibold text-ink-500">Loading Performance Analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-ink-900 font-sans pb-16">
      {/* ── Zoho Header Context Bar ── */}
      <div className="sticky top-0 z-20 border-b border-line bg-white shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-50 border border-accent-100 flex items-center justify-center text-accent-700">
                <Award className="h-4.5 w-4.5 shrink-0" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold font-heading text-ink-900 tracking-tight">KPI Performance Scorecard</h1>
                  <span className="rounded-full bg-accent-50 border border-accent-200 px-2.5 py-0.5 text-[10px] font-mono font-bold text-accent-700">
                    FY {fy}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 font-mono hidden sm:block">Monthly KRA Tracking, Self-Assessments & Review Console</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={loadAll}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-sunken transition-all shadow-2xs cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-ink-500" />
                <span className="hidden sm:inline">Sync Data</span>
              </button>
              {notifCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 text-[10px] font-bold text-white font-mono shadow-xs">
                  {notifCount} Action{notifCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Zoho Inset Pill Tab Nav (Matching HomePage Tabs) */}
          <div className="pb-3 overflow-x-auto scrollbar-none">
            <nav className="inline-flex items-center gap-1 p-1 bg-surface-sunken border border-line rounded-xl">
              {TABS.filter((t) => !t.managerOnly || isManager).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const badgeCount = tab.id === "approvals"
                  ? notifications.find((n: any) => n.kind === "kpi_approvals")?.n
                  : tab.id === "deletions"
                  ? notifications.find((n: any) => n.kind === "deletion_requests")?.n
                  : tab.id === "team"
                  ? notifications.find((n: any) => n.kind === "submissions_to_score")?.n
                  : 0;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-accent-700 shadow-xs border border-line font-bold"
                        : "text-ink-500 hover:text-ink-900 hover:bg-white/50 border border-transparent font-medium"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-accent-600" : "text-ink-400"}`} />
                    {tab.label}
                    {badgeCount > 0 && (
                      <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white font-mono leading-none">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && (
          <DashboardTab
            assignment={assignment}
            yearAnalytics={yearAnalytics}
            attainment={attainment}
            notifications={notifications}
            trendPoints={trendFromAnalytics}
            trend={trend}
            isManager={isManager}
            teamData={teamData}
            fy={fy}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === "my-kpi" && (
          <MyKpiTab assignment={assignment} fy={fy} onNavigate={setActiveTab} />
        )}
        {activeTab === "submission" && (
          <SubmissionTab
            assignment={assignment}
            submission={submission}
            month={selectedMonth}
            fy={fy}
            fyMonths={fyMonths}
            onMonthChange={(m: string) => { setSelectedMonth(m); }}
            onRefresh={loadSubmission}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab
            history={history}
            trendPoints={trendFromAnalytics}
            fy={fy}
            onRefresh={loadHistory}
          />
        )}
        {activeTab === "team" && (
          <TeamTab
            teamData={teamData}
            fy={fy}
            month={selectedMonth}
            fyMonths={fyMonths}
            onMonthChange={setSelectedMonth}
            onRefresh={loadTeam}
          />
        )}
        {activeTab === "approvals" && (
          <ApprovalsTab
            pending={pendingApprovals}
            onRefresh={() => { loadApprovals(); loadAll(); }}
          />
        )}
        {activeTab === "deletions" && (
          <DeletionsTab
            deletions={deletions}
            isManager={isManager}
            onRefresh={loadDeletions}
          />
        )}
        {activeTab === "queries" && (
          <QueriesTab
            queries={queries}
            isManager={isManager}
            onRefresh={loadQueries}
          />
        )}
        {activeTab === "setup" && (
          <SetupTab
            assignment={assignment}
            fy={fy}
            fyMonths={fyMonths}
            onRefresh={() => { loadAll(); }}
          />
        )}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Dashboard Tab (Zoho Executive Hub) ───────────────────────────────
// ════════════════════════════════════════════════════════════════════
function DashboardTab({ assignment, yearAnalytics, attainment, notifications: _notifications, trendPoints, trend, isManager, teamData, fy, onNavigate }: any) {
  const assignmentStatus = assignment?.status ?? null;
  const avgScore = yearAnalytics?.avg_total_score ?? null;
  const monthsScored = yearAnalytics?.months_scored ?? 0;
  const avgJob = yearAnalytics?.avg_job_role_score;
  const avgCore = yearAnalytics?.avg_core_values_score;

  const belowGood = (attainment || []).filter((a: any) => a.attainment_pct !== null && a.attainment_pct < 60);

  return (
    <div className="space-y-6">
      {/* Executive Hero */}
      <ScoreHero
        title="Performance Analytics Hub"
        subtitle={`Financial Year ${fy} · Cumulative Performance Assessment`}
        score={avgScore}
        scoreLabel="YTD Performance Score"
      >
        {trend && (
          <div className="flex items-center gap-2 text-xs font-mono">
            {trend.direction === "up" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
            {trend.direction === "down" && <TrendingDown className="h-4 w-4 text-rose-400" />}
            {trend.direction === "flat" && <Minus className="h-4 w-4 text-white/40" />}
            <span className={
              trend.direction === "up" ? "text-emerald-300 font-bold" :
              trend.direction === "down" ? "text-rose-300 font-bold" : "text-white/50"
            }>
              {trend.direction === "up" ? `Improving +${trend.delta} pts` :
               trend.direction === "down" ? `Declining -${trend.delta} pts` : "Consistent Baseline"}
            </span>
            <span className="text-white/40">vs prior 4 months</span>
          </div>
        )}
      </ScoreHero>

      {/* Action alerts */}
      {!assignmentStatus && (
        <ActionAlert
          eyebrow="Setup Required"
          title="Your FY KPI Scorecard is not configured yet"
          body="Define your Job Role KRAs and target weights to begin monthly submissions."
          cta="Configure KPI Setup"
          onClick={() => onNavigate("setup")}
          variant="info"
        />
      )}
      {assignmentStatus === "rejected" && (
        <ActionAlert
          eyebrow="Action Required"
          title="Your manager returned your KPI setup for revisions"
          body={assignment?.rejection_reason ? `Manager remarks: "${assignment.rejection_reason}"` : "Please revise your weight distribution and resubmit."}
          cta="Revise Setup"
          onClick={() => onNavigate("setup")}
          variant="warning"
        />
      )}
      {assignmentStatus === "pending_approval" && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4.5 shadow-2xs">
          <Clock className="h-5 w-5 shrink-0 text-accent-600 mt-0.5" />
          <div>
            <p className="font-bold text-accent-900 text-sm">KPI Setup Awaiting Manager Approval</p>
            <p className="text-xs text-accent-700 mt-0.5">Your reporting hierarchy has received your setup. Monthly submissions unlock once approved.</p>
          </div>
        </div>
      )}

      {/* Zoho 4-Metric Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard 
          label="Assignment Status" 
          value={<KpiAssignmentBadge status={assignmentStatus} />} 
          accent="indigo"
        />
        <StatCard 
          label="Assessed Months" 
          value={`${monthsScored} / 12`} 
          sub={`FY ${fy} Completed`}
          accent="emerald"
        />
        <StatCard
          label="Job Role Score"
          value={avgJob != null ? `${avgJob.toFixed(1)}%` : "—"}
          sub={`Target Weight: ${assignment?.job_role_weight ?? 80}%`}
          accent="amber"
        />
        <StatCard
          label="Core Values Score"
          value={avgCore != null ? `${avgCore.toFixed(1)}%` : "—"}
          sub={`Target Weight: ${assignment?.core_values_weight ?? 20}%`}
          accent="indigo"
        />
      </div>

      {/* Zoho Trend Chart Card */}
      {trendPoints.length > 0 && (
        <div className="rounded-xl border border-line bg-white p-5 sm:p-6 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900 font-heading">Performance Progression Trend</h2>
              <p className="text-xs text-ink-400 font-mono">Monthly finalized score distribution across FY {fy}</p>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-surface-sunken border border-line rounded text-ink-500">
              100 Pt Standard Scale
            </span>
          </div>
          <ScoreTrendChart points={trendPoints} height={200} />
        </div>
      )}

      {/* Benchmark Attention Area */}
      {belowGood.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="flex items-center gap-2 text-xs font-bold font-mono text-amber-900 uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Focus Areas Below Benchmark (&lt;60%)
            </h2>
            <span className="text-[10px] font-mono text-amber-700">{belowGood.length} KRA(s) Requiring Attention</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {belowGood.slice(0, 4).map((a: any) => (
              <KraAttainmentBar
                key={`${a.section}-${a.kra}`}
                kraName={a.kra}
                attainmentPct={a.attainment_pct}
                section={SECTION_LABELS[a.section]}
                weight={a.weight}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manager Quick Team Card */}
      {isManager && teamData && (
        <div className="rounded-xl border border-line bg-white p-5 sm:p-6 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-accent-600" />
              <h2 className="text-sm font-bold text-ink-900 font-heading">Subordinate Team Performance</h2>
            </div>
            <button
              onClick={() => onNavigate("team")}
              className="text-xs font-semibold text-accent-600 hover:text-accent-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Open Team Matrix <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Direct Reportees" value={teamData.team?.length ?? 0} accent="indigo" />
            <StatCard label="Awaiting Scoring" value={teamData.scoring ?? 0} sub="Pending review" accent="amber" />
            <StatCard label="Setup Approvals" value={teamData.approvals ?? 0} sub="Pending approval" accent="rose" />
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── My KPI Tab ──────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function MyKpiTab({ assignment, fy: _fy, onNavigate }: any) {
  if (!assignment) {
    return (
      <div className="space-y-4">
        <ActionAlert
          eyebrow="Configuration Pending"
          title="No Approved KPI Setup Found"
          body="Please set up your Job Role KRAs, Core Values, and target weights to activate your scorecard."
          cta="Configure KPI Setup"
          onClick={() => onNavigate("setup")}
          variant="info"
        />
      </div>
    );
  }

  const kras: KRA[] = parseJSON(assignment.kras, []);
  const jobKras = kras.filter((k) => k.section === "job_role");
  const esmsKras = kras.filter((k) => k.section === "esms");
  const coreKras = kras.filter((k) => k.section === "core_values");

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-400">Scorecard Assignment Status</p>
          <div className="mt-1.5"><KpiAssignmentBadge status={assignment.status as any} /></div>
          {assignment.rejection_reason && (
            <p className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-mono">
              Remarks: "{assignment.rejection_reason}"
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <span className="rounded-lg bg-surface-sunken border border-line px-3 py-1.5 text-ink-700">
            Job Role: <strong className="text-accent-700">{assignment.job_role_weight}%</strong>
          </span>
          {assignment.esms_weight > 0 && (
            <span className="rounded-lg bg-surface-sunken border border-line px-3 py-1.5 text-ink-700">
              ESMS: <strong className="text-accent-700">{assignment.esms_weight}%</strong>
            </span>
          )}
          <span className="rounded-lg bg-surface-sunken border border-line px-3 py-1.5 text-ink-700">
            Core Values: <strong className="text-accent-700">{assignment.core_values_weight}%</strong>
          </span>
        </div>
      </div>

      {/* Job Role KRAs */}
      {jobKras.length > 0 && (
        <KraSection title="Job Role KRAs" badge={`${assignment.job_role_weight}% Weight`} kras={jobKras} />
      )}

      {/* ESMS KRAs */}
      {esmsKras.length > 0 && (
        <KraSection title="ESMS & Safety KRAs" badge={`${assignment.esms_weight}% Weight`} kras={esmsKras} />
      )}

      {/* Core Values */}
      {coreKras.length > 0 && (
        <KraSection title="Organizational Core Values" badge={`${assignment.core_values_weight}% Weight`} kras={coreKras} />
      )}

      {/* Actions */}
      {(assignment.status === "draft" || assignment.status === "rejected") && (
        <button
          onClick={() => onNavigate("setup")}
          className="flex items-center gap-2 rounded-lg bg-accent-600 hover:bg-accent-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Edit3 className="h-4 w-4" />
          Edit & Resubmit Setup
        </button>
      )}
    </div>
  );
}

function KraSection({ title, badge, kras }: { title: string; badge: string; kras: KRA[] }) {
  return (
    <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3.5">
        <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">{title}</h2>
        <span className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[10px] font-bold font-mono text-accent-700">{badge}</span>
      </div>
      <div className="divide-y divide-line">
        {kras.map((kra, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-surface-sunken/40 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-ink-900">{kra.name}</p>
              {kra.target && <p className="mt-0.5 text-xs text-ink-500 font-sans leading-relaxed">{kra.target}</p>}
            </div>
            <span className="shrink-0 rounded-md bg-accent-50 border border-accent-200 px-2.5 py-1 text-xs font-mono font-bold text-accent-700">
              {kra.weight}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Monthly Submission Tab ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function SubmissionTab({ assignment, submission, month, fy, fyMonths, onMonthChange, onRefresh }: any) {
  const [selfData, setSelfData] = useState<Record<string, string>>({});
  const [coreRatings, setCoreRatings] = useState<Record<string, number>>({});
  const [anythingToAdd, setAnythingToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const kras: KRA[] = assignment ? parseJSON(assignment.kras, []) : [];
  const currentSub = submission;
  const isEditable = !currentSub || currentSub.status === "draft" || currentSub.status === "returned";

  useEffect(() => {
    if (currentSub) {
      setSelfData(parseJSON(currentSub.self_data, {}));
      setCoreRatings(parseJSON(currentSub.core_values_ratings, {}));
      setAnythingToAdd(currentSub.anything_to_add || "");
    } else {
      setSelfData({});
      setCoreRatings({});
      setAnythingToAdd("");
    }
  }, [currentSub]);

  const handleSave = async () => {
    if (!assignment) return toast.error("No active KPI assignment");
    setSaving(true);
    try {
      await kpiService.saveSubmission({ period_month: month, financial_year: fy, self_data: selfData, core_values_ratings: coreRatings, anything_to_add: anythingToAdd });
      toast.success("Assessment Draft Saved");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save draft");
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!currentSub) { await handleSave(); }
    if (!currentSub?.id) return toast.error("Please save draft first");
    setSubmitting(true);
    try {
      await kpiService.submitSubmission(currentSub.id);
      toast.success("Submitted for Manager Scoring!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Month Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono font-bold text-ink-500 uppercase tracking-wider">Assessment Cycle:</label>
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-xs font-mono font-bold text-ink-900 shadow-2xs focus:border-accent-600 focus:outline-none"
          >
            {fyMonths.map((m: string) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
        {currentSub && <KpiStatusBadge status={currentSub.status as any} />}
      </div>

      {/* Returned notice */}
      {currentSub?.status === "returned" && currentSub.return_reason && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm">Returned for Revision by Manager</p>
            <p className="mt-1 text-xs italic text-amber-800 font-mono">"{currentSub.return_reason}"</p>
          </div>
        </div>
      )}

      {/* Finalized Score Box */}
      {currentSub?.status === "finalized" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="text-left">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800">Final Assessment Score</p>
              <ScoreNumber score={currentSub.final_total_score} size="xl" showOutOf />
              <div className="mt-1"><ScoreBadge score={currentSub.final_total_score} size="md" /></div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 min-w-[240px]">
              <StatCard label="Job Role Score" value={`${currentSub.final_job_score?.toFixed(1) ?? "—"}%`} accent="emerald" />
              <StatCard label="Core Values Score" value={`${currentSub.final_core_score?.toFixed(1) ?? "—"}%`} accent="emerald" />
            </div>
          </div>
        </div>
      )}

      {!assignment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 font-mono">
          No active KPI assignment found for FY {fy}. Please complete KPI Setup first.
        </div>
      )}

      {assignment && kras.length > 0 && (
        <div className="space-y-5">
          {/* Job Role KRAs self-assessment */}
          {kras.filter((k) => k.section === "job_role").length > 0 && (
            <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3.5">
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">Job Role Self-Assessment</h2>
                <span className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[10px] font-bold font-mono text-accent-700">
                  {assignment.job_role_weight}% Weight
                </span>
              </div>
              <div className="divide-y divide-line">
                {kras.filter((k) => k.section === "job_role").map((kra, i) => {
                  const rawVal: any = selfData[kra.name];
                  const savedObj = (rawVal && typeof rawVal === 'object') ? rawVal : { notes: typeof rawVal === 'string' ? rawVal : "", achievedPct: 100 };
                  const currentAchieved: number = typeof savedObj.achievedPct === 'number' ? savedObj.achievedPct : 100;
                  const currentNotes: string = typeof savedObj.notes === 'string' ? savedObj.notes : "";

                  const updateSelf = (field: 'notes' | 'achievedPct', val: any) => {
                    setSelfData((prev: any) => {
                      const prevRaw = prev[kra.name];
                      const prevObj = (prevRaw && typeof prevRaw === 'object') ? prevRaw : { notes: typeof prevRaw === 'string' ? prevRaw : "", achievedPct: 100 };
                      return {
                        ...prev,
                        [kra.name]: {
                          ...prevObj,
                          [field]: val
                        }
                      };
                    });
                  };

                  return (
                    <div key={i} className="p-5 space-y-3.5 hover:bg-surface-sunken/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-[10px] font-mono font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <p className="font-bold text-sm text-ink-900">{kra.name}</p>
                          </div>
                          {kra.target && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-600 font-mono bg-surface-sunken px-2.5 py-1 rounded-md border border-line inline-flex">
                              <span className="font-bold text-accent-700">Target:</span> {kra.target}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md bg-accent-50 border border-accent-200 px-2.5 py-1 text-xs font-mono font-bold text-accent-700">
                          {kra.weight}% Weight
                        </span>
                      </div>

                      {/* Dual Target vs Achieved Attainment Box */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-sunken/70 p-3.5 rounded-lg border border-line">
                        <div className="sm:col-span-1">
                          <label className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-wider block mb-1">
                            Self-Attainment Score:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="150"
                              value={currentAchieved}
                              onChange={(e) => updateSelf('achievedPct', Math.max(0, Math.min(150, parseInt(e.target.value) || 0)))}
                              disabled={!isEditable}
                              className="w-20 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-accent-700 text-center focus:border-accent-600 focus:outline-none disabled:bg-surface-sunken"
                            />
                            <span className="text-xs font-mono font-bold text-ink-600">% achieved</span>
                          </div>
                        </div>

                        <div className="sm:col-span-2 flex flex-col justify-center">
                          <div className="flex justify-between text-[10px] font-mono font-semibold text-ink-500 mb-1">
                            <span>Attainment Gauge</span>
                            <span className={currentAchieved >= 90 ? "text-emerald-600 font-bold" : currentAchieved >= 60 ? "text-accent-600 font-bold" : "text-rose-600 font-bold"}>
                              {currentAchieved >= 90 ? "Outstanding" : currentAchieved >= 60 ? "On Track" : "Needs Focus"}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-line rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                currentAchieved >= 90 ? "bg-emerald-500" : currentAchieved >= 60 ? "bg-accent-600" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, currentAchieved)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-mono font-bold text-ink-500 uppercase tracking-wider block mb-1">
                          Monthly Achievements & Evidences:
                        </label>
                        <textarea
                          value={currentNotes}
                          onChange={(e) => updateSelf('notes', e.target.value)}
                          disabled={!isEditable}
                          rows={2}
                          placeholder="Detail specific numbers, hospitals visited, tickets resolved, or deliverables completed..."
                          className="w-full rounded-lg border border-line p-3 text-xs text-ink-900 placeholder:text-ink-300 focus:border-accent-600 focus:ring-2 focus:ring-accent-500/20 focus:outline-none disabled:bg-surface-sunken disabled:text-ink-400 resize-none font-sans"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Core Values ratings */}
          <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3.5">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">Organizational Core Values (Self-Rating)</h2>
              <span className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[10px] font-bold font-mono text-accent-700">
                {assignment.core_values_weight}% Weight
              </span>
            </div>
            <div className="divide-y divide-line">
              {CORE_VALUES_OPTIONS.map((cv) => (
                <div key={cv} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 hover:bg-surface-sunken/40 transition-colors">
                  <p className="text-xs font-semibold text-ink-800">{cv}</p>
                  <select
                    value={coreRatings[cv] || ""}
                    onChange={(e) => setCoreRatings((prev) => ({ ...prev, [cv]: parseInt(e.target.value) || 0 }))}
                    disabled={!isEditable}
                    className="rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-xs font-mono font-semibold text-ink-800 focus:border-accent-600 focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Select rating benchmark</option>
                    {CORE_VALUE_RATINGS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Anything to add */}
          <div className="rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
            <h2 className="mb-2 text-xs font-mono font-bold uppercase tracking-wider text-ink-700">Additional Remarks / Highlights</h2>
            <textarea
              value={anythingToAdd}
              onChange={(e) => setAnythingToAdd(e.target.value)}
              disabled={!isEditable}
              rows={3}
              placeholder="Provide any additional operational challenges, exceptional highlights, or support needed..."
              className="w-full rounded-lg border border-line p-3 text-xs text-ink-900 placeholder:text-ink-300 focus:border-accent-600 focus:ring-2 focus:ring-accent-500/20 focus:outline-none disabled:bg-surface-sunken resize-none font-sans"
            />
          </div>

          {/* Action buttons */}
          {isEditable && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-line bg-white px-5 py-2.5 text-xs font-bold text-ink-700 hover:bg-surface-sunken shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || saving}
                className="flex items-center gap-2 rounded-lg bg-accent-600 hover:bg-accent-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit for Manager Scoring"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── History Tab ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function HistoryTab({ history, trendPoints, fy: _fy2, onRefresh: _onRefresh2 }: any) {
  const fy = _fy2;
  return (
    <div className="space-y-6">
      {/* Trend chart */}
      <div className="rounded-xl border border-line bg-white p-5 sm:p-6 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
        <h2 className="text-sm font-bold text-ink-900 font-heading">Historical Performance Trajectory</h2>
        <p className="mb-4 text-xs text-ink-400 font-mono">Monthly finalized scores plotted with standard benchmark ranges</p>
        <ScoreTrendChart points={trendPoints} height={220} />
      </div>

      {/* Month-by-month table */}
      <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
        <div className="border-b border-line bg-surface-sunken px-5 py-3.5">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">Assessment History — FY {fy}</h2>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs font-mono text-ink-400">
            No assessment records found for FY {fy}.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {history.map((s: KpiSubmission) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-sunken/40 transition-colors">
                <div>
                  <p className="font-bold text-sm text-ink-900 font-mono">{formatMonth(s.period_month)}</p>
                  <div className="mt-1"><KpiStatusBadge status={s.status as any} /></div>
                </div>
                <div className="flex items-center gap-4">
                  {s.final_total_score !== null && s.final_total_score !== undefined ? (
                    <div className="text-right">
                      <ScoreNumber score={s.final_total_score} size="md" />
                      <div className="mt-0.5"><ScoreBadge score={s.final_total_score} size="sm" /></div>
                    </div>
                  ) : (
                    <span className="text-ink-300 text-xs font-mono">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Team Tab (Manager Console) ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function TeamTab({ teamData, fy: _fyTeam, month, fyMonths, onMonthChange, onRefresh }: any) {
  const team = teamData?.team || [];
  const submissions = teamData?.submissions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-mono font-bold text-ink-500 uppercase tracking-wider">Review Cycle:</h2>
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-xs font-mono font-bold text-ink-900 shadow-2xs focus:border-accent-600 focus:outline-none"
          >
            {fyMonths.map((m: string) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-sunken transition-all shadow-2xs cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5 text-ink-500" /> Refresh Team
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatCard label="Direct Reportees" value={team.length} accent="indigo" />
        <StatCard label="Submitted Claims" value={submissions.filter((s: any) => s.status !== "draft").length} sub={`for ${formatMonth(month)}`} accent="emerald" />
        <StatCard label="Pending Manager Scoring" value={teamData?.scoring ?? 0} accent="amber" />
      </div>

      {/* Team list */}
      <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
        <div className="border-b border-line bg-surface-sunken px-5 py-3.5">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">Team Performance Directory — {formatMonth(month)}</h2>
        </div>
        {team.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs font-mono text-ink-400">No mapped reportees found.</div>
        ) : (
          <div className="divide-y divide-line">
            {team.map((member: any) => {
              const sub = submissions.find((s: any) => s.user_id === member.user_id);
              return (
                <div key={member.user_id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-sunken/40 transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-ink-900 truncate">{member.name}</p>
                    <p className="text-xs text-ink-400 font-mono mt-0.5">{member.role} · {member.district}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sub ? (
                      <>
                        <KpiStatusBadge status={sub.status} />
                        {sub.final_total_score != null && <ScoreNumber score={sub.final_total_score} size="sm" />}
                      </>
                    ) : (
                      <KpiStatusBadge status={null} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Approvals Tab ───────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function ApprovalsTab({ pending, onRefresh }: any) {
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejReason, setRejReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async (id: number) => {
    setBusy(true);
    try {
      await kpiService.approveAssignment(id);
      toast.success("KPI Setup Approved!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to approve");
    } finally { setBusy(false); }
  };

  const handleReject = async (id: number) => {
    if (!rejReason.trim()) return toast.error("Please enter revision remarks");
    setBusy(true);
    try {
      await kpiService.rejectAssignment(id, rejReason);
      toast.success("KPI Setup Returned for Revision");
      setActionId(null);
      setRejReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to return setup");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-700">Pending Setup Approvals</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-sunken transition-all shadow-2xs cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5 text-ink-500" /> Refresh
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white py-16 text-center shadow-2xs">
          <CheckSquare className="h-8 w-8 text-emerald-500 mb-2.5" />
          <p className="font-bold text-ink-800 text-sm">All Setups Reviewed</p>
          <p className="text-xs text-ink-400 font-mono mt-1">No employee KPI setups are currently awaiting approval.</p>
        </div>
      ) : (
        pending.map((item: any) => {
          const kras: KRA[] = parseJSON(item.kras, []);
          const isRejecting = actionId === item.id;
          return (
            <div key={item.id} className="rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-bold text-base text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-400 font-mono mt-0.5">{item.role} · {item.district} · FY {item.financial_year}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => { setActionId(item.id); setRejReason(""); }}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-xs font-bold text-ink-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" /> Return
                  </button>
                </div>
              </div>

              {/* KRA preview */}
              {kras.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                  {kras.slice(0, 5).map((k, i) => (
                    <span key={i} className="rounded-md bg-surface-sunken border border-line px-2.5 py-1 text-xs font-mono text-ink-700">
                      {k.name} · <strong className="text-accent-700">{k.weight}%</strong>
                    </span>
                  ))}
                  {kras.length > 5 && <span className="rounded-md bg-surface-sunken border border-line px-2.5 py-1 text-xs font-mono text-ink-500">+{kras.length - 5} more</span>}
                </div>
              )}

              {/* Rejection form */}
              {isRejecting && (
                <div className="space-y-3 border-t border-line pt-4">
                  <textarea
                    value={rejReason}
                    onChange={(e) => setRejReason(e.target.value)}
                    placeholder="Enter specific revision feedback for the employee..."
                    rows={2}
                    className="w-full rounded-lg border border-line p-3 text-xs text-ink-900 placeholder:text-ink-300 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={busy}
                      className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Confirm Return
                    </button>
                    <button
                      onClick={() => { setActionId(null); setRejReason(""); }}
                      className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-surface-sunken cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Deletions Tab ───────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function DeletionsTab({ deletions, isManager, onRefresh }: any) {
  const [busy, setBusy] = useState(false);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setBusy(true);
    try {
      if (action === "approve") await kpiService.approveDeletion(id);
      else await kpiService.rejectDeletion(id);
      toast.success(action === "approve" ? "Deletion approved" : "Deletion rejected");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Action failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-700">Deletion Requests</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-sunken shadow-2xs cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5 text-ink-500" /> Refresh
        </button>
      </div>

      {deletions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white py-16 text-center shadow-2xs">
          <Trash2 className="h-8 w-8 text-ink-300 mb-2.5" />
          <p className="font-bold text-ink-700 text-sm">No Pending Deletion Requests</p>
        </div>
      ) : (
        deletions.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                {d.name && <p className="font-bold text-sm text-ink-900">{d.name}</p>}
                <p className="text-xs text-ink-400 font-mono mt-0.5">{formatMonth(d.period_month)} · FY {d.financial_year}</p>
                <p className="mt-2 text-xs text-ink-700 font-sans">Reason: <span className="italic">"{d.reason}"</span></p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold border
                ${d.status === "pending" ? "bg-amber-50 text-amber-800 border-amber-200" :
                  d.status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  "bg-rose-50 text-rose-800 border-rose-200"}`}>
                {d.status}
              </span>
            </div>
            {isManager && d.status === "pending" && (
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <button
                  onClick={() => handleAction(d.id, "approve")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleAction(d.id, "reject")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── Queries Tab ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function QueriesTab({ queries, isManager, onRefresh }: any) {
  const [responseMap, setResponseMap] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const handleRespond = async (id: number) => {
    const text = responseMap[id];
    if (!text?.trim()) return toast.error("Please enter a response");
    setBusy(id);
    try {
      await kpiService.respondToQuery(id, text);
      toast.success("Query response dispatched");
      setResponseMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to respond");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-700">Performance Score Queries</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-sunken shadow-2xs cursor-pointer">
          <RefreshCw className="h-3.5 w-3.5 text-ink-500" /> Refresh
        </button>
      </div>

      {queries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white py-16 text-center shadow-2xs">
          <MessageCircle className="h-8 w-8 text-ink-300 mb-2.5" />
          <p className="font-bold text-ink-700 text-sm">No Active Queries</p>
          <p className="text-xs text-ink-400 font-mono mt-1">Queries raised regarding finalized scores appear here.</p>
        </div>
      ) : (
        queries.map((q: any) => (
          <div key={q.id} className="rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {q.name && <p className="font-bold text-sm text-ink-900">{q.name}</p>}
                <p className="text-xs text-ink-400 font-mono mt-0.5">{formatMonth(q.period_month)} · FY {q.financial_year}</p>
                <p className="mt-2 text-xs text-ink-800 font-sans leading-relaxed">{q.query_text}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold border
                ${q.status === "open" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-surface-sunken text-ink-500 border-line"}`}>
                {q.status}
              </span>
            </div>
            {q.response_text && (
              <div className="rounded-lg bg-surface-sunken p-3 text-xs text-ink-800 border-l-3 border-accent-600 font-sans">
                <p className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-wider mb-1">Manager Response</p>
                {q.response_text}
              </div>
            )}
            {isManager && q.status === "open" && (
              <div className="space-y-2 border-t border-line pt-3">
                <textarea
                  value={responseMap[q.id] || ""}
                  onChange={(e) => setResponseMap((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Draft your response to the employee..."
                  rows={2}
                  className="w-full rounded-lg border border-line p-3 text-xs text-ink-900 placeholder:text-ink-300 focus:border-accent-600 focus:outline-none resize-none font-sans"
                />
                <button
                  onClick={() => handleRespond(q.id)}
                  disabled={busy === q.id}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {busy === q.id ? "Sending…" : "Send Response"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── KPI Setup Tab (Zoho KRA Builder) ─────────────────────────────────
// ════════════════════════════════════════════════════════════════════

// ─── Standard Role KRA Templates ──────────────────────────────────────────────
const KRA_TEMPLATES: Record<string, { label: string; kras: KRA[] }> = {
  field_engineer: {
    label: "Field Service Engineer (Medical Equipment)",
    kras: [
      { name: "Preventative Maintenance (PM) Visits Compliance", target: "100% scheduled PM visits completed within month", weight: 25, section: "job_role" },
      { name: "Breakdown Call Resolution within SLA", target: "≥95% breakdown calls resolved within 24-48 hours SLA", weight: 25, section: "job_role" },
      { name: "Equipment Uptime across Assigned Installations", target: "≥98% operational uptime across assigned hospital sites", weight: 15, section: "job_role" },
      { name: "Daily Activity & Expense Submission Compliance", target: "100% on-time daily logs and zero delayed expense submissions", weight: 15, section: "job_role" },
    ]
  },
  biomedical: {
    label: "Bio-Medical / Quality Specialist",
    kras: [
      { name: "Quality Calibration & Safety Testing", target: "100% calibration certificates issued with zero non-conformances", weight: 30, section: "job_role" },
      { name: "Critical Spares & Inventory Management", target: "Zero equipment downtime caused by unmanaged parts inventory", weight: 25, section: "job_role" },
      { name: "Clinical Staff Training & Handover", target: "Minimum 4 hospital training sessions conducted per quarter", weight: 25, section: "job_role" },
    ]
  },
  coordinator: {
    label: "Service Coordinator / Operations",
    kras: [
      { name: "Call Dispatch & SLA Allocation Efficiency", target: "100% incoming service calls dispatched within 15 minutes", weight: 30, section: "job_role" },
      { name: "Monthly MIS & Claim Audit Reconciliations", target: "100% team expenses and service reports audited by 3rd of month", weight: 30, section: "job_role" },
      { name: "Customer Satisfaction & Feedback Score", target: "≥90% positive feedback across all closed service tickets", weight: 20, section: "job_role" },
    ]
  }
};

function SetupTab({ assignment, fy: _fy, fyMonths, onRefresh }: any) {
  const [kras, setKras] = useState<KRA[]>([]);
  const [startsFrom, setStartsFrom] = useState("");
  const fy = _fy;
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (assignment) {
      setKras(parseJSON(assignment.kras, []));
      setStartsFrom(assignment.starts_from || "");
    } else {
      setKras([{ name: "", target: "", weight: 10, section: "job_role" }]);
      setStartsFrom("");
    }
  }, [assignment]);

  const addKra = () => setKras((prev) => [...prev, { name: "", target: "", weight: 10, section: "job_role" }]);
  const removeKra = (i: number) => setKras((prev) => prev.filter((_, idx) => idx !== i));
  const updateKra = (i: number, field: keyof KRA, value: any) =>
    setKras((prev) => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k));

  const totalWeight = kras.filter((k) => k.section === "job_role").reduce((sum, k) => sum + Number(k.weight || 0), 0);
  const isWeightOk = totalWeight <= 80;

  const handleSave = async () => {
    if (!isWeightOk) return toast.error("Job Role KRA weights cannot exceed 80%");
    if (kras.some((k) => !k.name.trim())) return toast.error("All KRAs must have a descriptive title");
    setSaving(true);
    try {
      await kpiService.saveAssignment({ financial_year: fy, kras, starts_from: startsFrom || undefined });
      toast.success("KPI Setup Draft Saved");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save draft");
    } finally { setSaving(false); }
  };

  const handleSubmitForApproval = async () => {
    await handleSave();
    if (!assignment?.id) { toast.error("Please save draft first"); return; }
    setSubmitting(true);
    try {
      await kpiService.submitAssignment(assignment.id);
      toast.success("Submitted for Manager Approval!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to submit for approval");
    } finally { setSubmitting(false); }
  };

  const isLocked = assignment?.status === "active" || assignment?.status === "pending_approval";

  return (
    <div className="space-y-6">
      {/* Status */}
      {assignment && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-5 py-4 shadow-2xs">
          <KpiAssignmentBadge status={assignment.status} />
          {assignment.status === "pending_approval" && (
            <p className="text-xs text-ink-500 font-mono">KPI Setup is under review with your manager.</p>
          )}
          {assignment.status === "active" && (
            <p className="text-xs text-ink-500 font-mono">KPI Setup is approved and active for FY {fy}.</p>
          )}
        </div>
      )}

      {/* Quick 1-Click Role Templates (If not locked) */}
      {!isLocked && (
        <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-accent-900">1-Click Industry KRA Templates</h2>
              <p className="text-[11px] text-accent-700 font-sans mt-0.5">Pre-fill standard medical equipment service & operational targets with pre-calculated weights</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(KRA_TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {
                  setKras(t.kras);
                  toast.success(`Applied ${t.label} template!`);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-accent-300 bg-white hover:bg-accent-50 px-3.5 py-2 text-xs font-semibold text-accent-900 shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-accent-600" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Starts From */}
      <div className="rounded-xl border border-line bg-white p-5 shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)]">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-700 mb-2">Effective Joining / Scorecard Month</h2>
        <select
          value={startsFrom}
          onChange={(e) => setStartsFrom(e.target.value)}
          disabled={isLocked}
          className="rounded-lg border border-line bg-surface-sunken px-3 py-2 text-xs font-mono font-semibold text-ink-900 focus:border-accent-600 focus:outline-none disabled:opacity-60"
        >
          <option value="">April (Full Financial Year)</option>
          {fyMonths.map((m: string) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-ink-400 font-sans">
          Select April if you were active for the full year, or choose your official company induction month.
        </p>
      </div>

      {/* KRA Editor */}
      <div className="rounded-xl border border-line bg-white shadow-[0_10px_30px_-5px_rgba(30,27,75,0.03)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3.5">
          <div>
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-ink-700">Job Role KRAs Configuration</h2>
            <p className="text-[11px] text-ink-400 font-mono mt-0.5">Cumulative Allocated Weight: <span className={isWeightOk ? "text-accent-700 font-bold" : "text-rose-600 font-bold"}>{totalWeight}% / 80% Max</span></p>
          </div>
          {!isLocked && (
            <button
              onClick={addKra}
              className="flex items-center gap-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add KRA
            </button>
          )}
        </div>

        <div className="divide-y divide-line">
          {kras.filter((k) => k.section === "job_role").map((kra, i) => (
            <div key={i} className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={kra.name}
                  onChange={(e) => updateKra(i, "name", e.target.value)}
                  disabled={isLocked}
                  placeholder="KRA Name (e.g. Machine Uptime & Preventative Maintenance)"
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-900 focus:border-accent-600 focus:ring-2 focus:ring-accent-500/20 focus:outline-none disabled:bg-surface-sunken"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={kra.weight}
                    onChange={(e) => updateKra(i, "weight", Math.max(1, Math.min(80, parseInt(e.target.value) || 1)))}
                    disabled={isLocked}
                    className="w-16 rounded-lg border border-line px-2 py-2 text-xs text-center font-mono font-bold text-ink-900 focus:border-accent-600 focus:outline-none disabled:bg-surface-sunken"
                  />
                  <span className="text-xs text-ink-400 font-mono font-bold">%</span>
                </div>
                {!isLocked && (
                  <button
                    onClick={() => removeKra(i)}
                    className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                value={kra.target}
                onChange={(e) => updateKra(i, "target", e.target.value)}
                disabled={isLocked}
                placeholder="Target milestone / description (e.g. 98% uptime across all assigned installations)..."
                className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink-600 placeholder:text-ink-300 focus:border-accent-600 focus:outline-none disabled:bg-surface-sunken"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {!isLocked && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving || submitting}
            className="flex items-center gap-2 rounded-lg border border-line bg-white px-5 py-2.5 text-xs font-bold text-ink-700 hover:bg-surface-sunken shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={handleSubmitForApproval}
            disabled={saving || submitting}
            className="flex items-center gap-2 rounded-lg bg-accent-600 hover:bg-accent-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit for Manager Approval"}
          </button>
        </div>
      )}
    </div>
  );
}
