import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Target, FileText, History, Users, CheckSquare,
  Trash2, MessageCircle, Settings, ChevronRight, Plus, Edit3,
  Check, X, Send, AlertTriangle, TrendingUp, TrendingDown,
  Minus, RefreshCw, Save, Clock, Award, BarChart2
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
      // Check manager status — if they have reportees
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
      // Silent — not logged in or no KPI data yet
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-800" />
          <p className="text-sm text-gray-500">Loading KPI data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-3 py-3">
            <Award className="h-5 w-5 text-red-600 shrink-0" />
            <h1 className="text-base font-bold text-gray-900">KPI Dashboard</h1>
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              FY {fy}
            </span>
            {notifCount > 0 && (
              <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
                {notifCount}
              </span>
            )}
          </div>

          {/* Tab nav */}
          <nav className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-hide">
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
                  className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors
                    ${isActive
                      ? "border-b-2 border-gray-900 text-gray-900"
                      : "border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                  {badgeCount > 0 && (
                    <span className="ml-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white leading-none">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24">
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
// ─── Dashboard Tab ───────────────────────────────────────────────────
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
      {/* Hero */}
      <ScoreHero
        title={`Performance Overview`}
        subtitle={`FY ${fy} · Year-to-date`}
        score={avgScore}
        scoreLabel="Year Average"
      >
        {trend && (
          <div className="flex items-center gap-2 text-sm">
            {trend.direction === "up" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
            {trend.direction === "down" && <TrendingDown className="h-4 w-4 text-red-400" />}
            {trend.direction === "flat" && <Minus className="h-4 w-4 text-white/40" />}
            <span className={
              trend.direction === "up" ? "text-emerald-300" :
              trend.direction === "down" ? "text-red-300" : "text-white/50"
            }>
              {trend.direction === "up" ? `Improving +${trend.delta}pts` :
               trend.direction === "down" ? `Declining ${trend.delta}pts` : "Steady"}
            </span>
            <span className="text-white/30">over last 4 months</span>
          </div>
        )}
      </ScoreHero>

      {/* Action alerts */}
      {!assignmentStatus && (
        <ActionAlert
          eyebrow="KPI Not Set Up"
          title="Your KPI for this year is not in place yet"
          body="Define your Job Role KRAs and submit for your manager's approval."
          cta="Set Up My KPI"
          onClick={() => onNavigate("setup")}
        />
      )}
      {assignmentStatus === "rejected" && (
        <ActionAlert
          eyebrow="Sent Back"
          title="Your manager returned your KPI setup"
          body={assignment?.rejection_reason ? `"${assignment.rejection_reason}"` : "Make changes and resubmit."}
          cta="Make Changes"
          onClick={() => onNavigate("setup")}
          variant="warning"
        />
      )}
      {assignmentStatus === "pending_approval" && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Clock className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900">KPI with your manager for approval</p>
            <p className="text-sm text-blue-700 mt-0.5">You can start monthly submissions once approved.</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assignment" value={<KpiAssignmentBadge status={assignmentStatus} />} />
        <StatCard label={`Months Scored`} value={monthsScored} sub={`of 12 in FY ${fy}`} />
        <StatCard
          label="Job Role Avg"
          value={avgJob != null ? `${avgJob.toFixed(1)}%` : "—"}
          sub={`of ${assignment?.job_role_weight ?? 80}%`}
        />
        <StatCard
          label="Core Values Avg"
          value={avgCore != null ? `${avgCore.toFixed(1)}%` : "—"}
          sub={`of ${assignment?.core_values_weight ?? 20}%`}
        />
      </div>

      {/* Score trend chart */}
      {trendPoints.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">My Score — Month by Month</h2>
          <p className="mb-4 text-xs text-gray-400">Final score for each assessed month, on the 100-point scale.</p>
          <ScoreTrendChart points={trendPoints} height={200} />
        </div>
      )}

      {/* Areas needing attention */}
      {belowGood.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Areas Below Good
          </h2>
          <div className="space-y-3">
            {belowGood.slice(0, 5).map((a: any) => (
              <KraAttainmentBar
                key={`${a.section}-${a.kra}`}
                kraName={a.kra}
                attainmentPct={a.attainment_pct}
                section={SECTION_LABELS[a.section]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manager section */}
      {isManager && teamData && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="h-4 w-4 text-gray-500" />
            My Team
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Team Members" value={teamData.team?.length ?? 0} />
            <StatCard label="Awaiting Scoring" value={teamData.scoring ?? 0} sub="submitted this month" />
            <StatCard label="KPIs to Approve" value={teamData.approvals ?? 0} sub="pending setup review" />
          </div>
          {teamData.scoring > 0 && (
            <button
              onClick={() => {}}
              className="mt-4 flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              Score Submissions
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
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
          eyebrow="No KPI Set Up"
          title="Define your KRAs for this financial year"
          body="Go to KPI Setup to add your Job Role KRAs, Core Values, and submit to your manager."
          cta="Set Up My KPI"
          onClick={() => onNavigate("setup")}
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">KPI Assignment Status</p>
          <div className="mt-2"><KpiAssignmentBadge status={assignment.status as any} /></div>
          {assignment.rejection_reason && (
            <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 italic">
              "{assignment.rejection_reason}"
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium">
            Job Role: <strong>{assignment.job_role_weight}%</strong>
          </span>
          {assignment.esms_weight > 0 && (
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium">
              ESMS: <strong>{assignment.esms_weight}%</strong>
            </span>
          )}
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium">
            Core Values: <strong>{assignment.core_values_weight}%</strong>
          </span>
        </div>
      </div>

      {/* Job Role KRAs */}
      {jobKras.length > 0 && (
        <KraSection title="Job Role KRAs" badge={`${assignment.job_role_weight}%`} kras={jobKras} />
      )}

      {/* ESMS KRAs */}
      {esmsKras.length > 0 && (
        <KraSection title="ESMS KRAs" badge={`${assignment.esms_weight}%`} kras={esmsKras} />
      )}

      {/* Core Values */}
      {coreKras.length > 0 && (
        <KraSection title="Core Values" badge={`${assignment.core_values_weight}%`} kras={coreKras} />
      )}

      {/* Actions */}
      {(assignment.status === "draft" || assignment.status === "rejected") && (
        <button
          onClick={() => onNavigate("setup")}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
        >
          <Edit3 className="h-4 w-4" />
          Edit KPI Setup
        </button>
      )}
    </div>
  );
}

function KraSection({ title, badge, kras }: { title: string; badge: string; kras: KRA[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">{badge}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {kras.map((kra, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">{kra.name}</p>
              {kra.target && <p className="mt-0.5 text-sm text-gray-500">{kra.target}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
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
      toast.success("Saved");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!currentSub) { await handleSave(); }
    if (!currentSub?.id) return toast.error("Save first");
    setSubmitting(true);
    try {
      await kpiService.submitSubmission(currentSub.id);
      toast.success("Submitted for manager scoring!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-gray-700">Select Month</label>
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-gray-400 focus:outline-none"
        >
          {fyMonths.map((m: string) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        {currentSub && <KpiStatusBadge status={currentSub.status as any} />}
      </div>

      {/* Returned notice */}
      {currentSub?.status === "returned" && currentSub.return_reason && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Returned by Manager</p>
            <p className="mt-1 text-sm italic text-amber-800">"{currentSub.return_reason}"</p>
          </div>
        </div>
      )}

      {/* Finalized display */}
      {currentSub?.status === "finalized" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Final Score</p>
              <ScoreNumber score={currentSub.final_total_score} size="xl" showOutOf />
              <ScoreBadge score={currentSub.final_total_score} size="md" />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <StatCard label="Job Role" value={`${currentSub.final_job_score?.toFixed(1) ?? "—"}%`} />
              <StatCard label="Core Values" value={`${currentSub.final_core_score?.toFixed(1) ?? "—"}%`} />
            </div>
          </div>
        </div>
      )}

      {!assignment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No active KPI assignment for FY {fy}. Set up your KPI first.
        </div>
      )}

      {assignment && kras.length > 0 && (
        <div className="space-y-4">
          {/* Job Role KRAs self-assessment */}
          {kras.filter((k) => k.section === "job_role").length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-800">Job Role KRAs — Self Assessment</h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                  {assignment.job_role_weight}%
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {kras.filter((k) => k.section === "job_role").map((kra, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{kra.name}</p>
                        {kra.target && <p className="text-sm text-gray-400">{kra.target}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
                        {kra.weight}%
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">What did you achieve?</label>
                      <textarea
                        value={selfData[kra.name] || ""}
                        onChange={(e) => setSelfData((prev) => ({ ...prev, [kra.name]: e.target.value }))}
                        disabled={!isEditable}
                        rows={2}
                        placeholder="Describe your achievement for this KRA..."
                        className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 placeholder:text-gray-300 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Core Values ratings */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-800">Core Values — Self Rating</h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                {assignment.core_values_weight}%
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {CORE_VALUES_OPTIONS.map((cv) => (
                <div key={cv} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-800">{cv}</p>
                  <select
                    value={coreRatings[cv] || ""}
                    onChange={(e) => setCoreRatings((prev) => ({ ...prev, [cv]: parseInt(e.target.value) || 0 }))}
                    disabled={!isEditable}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select rating</option>
                    {CORE_VALUE_RATINGS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Anything to add */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Anything Else to Add?</h2>
            <textarea
              value={anythingToAdd}
              onChange={(e) => setAnythingToAdd(e.target.value)}
              disabled={!isEditable}
              rows={3}
              placeholder="Any additional context, achievements, or notes for your manager..."
              className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 placeholder:text-gray-300 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* Action buttons */}
          {isEditable && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || saving}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit for Scoring"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── History / Score Trend Tab ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function HistoryTab({ history, trendPoints, fy: _fy2, onRefresh: _onRefresh2 }: any) {
  const fy = _fy2;
  return (
    <div className="space-y-6">
      {/* Trend chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-800">Score Trend</h2>
        <p className="mb-4 text-xs text-gray-400">Monthly final scores plotted on a 100-point scale with band regions.</p>
        <ScoreTrendChart points={trendPoints} height={220} />
      </div>

      {/* Month-by-month table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Month-by-Month Assessment History</h2>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No assessments recorded yet for FY {fy}.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((s: KpiSubmission) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{formatMonth(s.period_month)}</p>
                  <div className="mt-1"><KpiStatusBadge status={s.status as any} /></div>
                </div>
                <div className="flex items-center gap-4">
                  {s.final_total_score !== null && s.final_total_score !== undefined ? (
                    <div className="text-right">
                      <ScoreNumber score={s.final_total_score} size="md" />
                      <ScoreBadge score={s.final_total_score} size="sm" />
                    </div>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
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
// ─── Team Tab ────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
function TeamTab({ teamData, fy: _fyTeam, month, fyMonths, onMonthChange, onRefresh }: any) {
  const team = teamData?.team || [];
  const submissions = teamData?.submissions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Viewing Month</h2>
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-gray-400 focus:outline-none"
        >
          {fyMonths.map((m: string) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Team Size" value={team.length} />
        <StatCard label="Submitted" value={submissions.filter((s: any) => s.status !== "draft").length} sub={`for ${formatMonth(month)}`} />
        <StatCard label="Awaiting Scoring" value={teamData?.scoring ?? 0} />
      </div>

      {/* Team list */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Team Members — {formatMonth(month)}</h2>
        </div>
        {team.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No team members found.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {team.map((member: any) => {
              const sub = submissions.find((s: any) => s.user_id === member.user_id);
              return (
                <div key={member.user_id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-400">{member.role} · {member.district}</p>
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
      toast.success("KPI approved!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to approve");
    } finally { setBusy(false); }
  };

  const handleReject = async (id: number) => {
    if (!rejReason.trim()) return toast.error("Enter a reason");
    setBusy(true);
    try {
      await kpiService.rejectAssignment(id, rejReason);
      toast.success("KPI returned to employee");
      setActionId(null);
      setRejReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to reject");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Pending KPI Approvals</h2>
        <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 py-16 text-center">
          <CheckSquare className="h-8 w-8 text-emerald-500 mb-3" />
          <p className="font-medium text-gray-700">All clear!</p>
          <p className="text-sm text-gray-400 mt-1">No KPI setups are waiting for your approval.</p>
        </div>
      ) : (
        pending.map((item: any) => {
          const kras: KRA[] = parseJSON(item.kras, []);
          const isRejecting = actionId === item.id;
          return (
            <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-400">{item.role} · {item.district}</p>
                  <p className="mt-1 text-xs text-gray-400">Submitted · FY {item.financial_year}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => { setActionId(item.id); setRejReason(""); }}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Return
                  </button>
                </div>
              </div>

              {/* KRA preview */}
              {kras.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {kras.slice(0, 5).map((k, i) => (
                    <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {k.name} · {k.weight}%
                    </span>
                  ))}
                  {kras.length > 5 && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">+{kras.length - 5} more</span>}
                </div>
              )}

              {/* Rejection form */}
              {isRejecting && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  <textarea
                    value={rejReason}
                    onChange={(e) => setRejReason(e.target.value)}
                    placeholder="Reason for returning (required)..."
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:border-gray-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={busy}
                      className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Confirm Return
                    </button>
                    <button
                      onClick={() => { setActionId(null); setRejReason(""); }}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
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
        <h2 className="text-sm font-semibold text-gray-800">Deletion Requests</h2>
        <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {deletions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 py-16 text-center">
          <Trash2 className="h-8 w-8 text-gray-300 mb-3" />
          <p className="font-medium text-gray-500">No deletion requests</p>
        </div>
      ) : (
        deletions.map((d: any) => (
          <div key={d.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                {d.name && <p className="font-semibold text-gray-900">{d.name}</p>}
                <p className="text-sm text-gray-500">{formatMonth(d.period_month)} · FY {d.financial_year}</p>
                <p className="mt-2 text-sm text-gray-700">Reason: <span className="italic">"{d.reason}"</span></p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold border
                ${d.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                  d.status === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  "bg-red-100 text-red-700 border-red-200"}`}>
                {d.status}
              </span>
            </div>
            {isManager && d.status === "pending" && (
              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleAction(d.id, "approve")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleAction(d.id, "reject")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
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
    if (!text?.trim()) return toast.error("Enter a response");
    setBusy(id);
    try {
      await kpiService.respondToQuery(id, text);
      toast.success("Response saved");
      setResponseMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to respond");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Score Queries</h2>
        <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {queries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 py-16 text-center">
          <MessageCircle className="h-8 w-8 text-gray-300 mb-3" />
          <p className="font-medium text-gray-500">No queries raised</p>
          <p className="text-sm text-gray-400 mt-1">Score queries from finalized months appear here.</p>
        </div>
      ) : (
        queries.map((q: any) => (
          <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {q.name && <p className="font-semibold text-gray-900">{q.name}</p>}
                <p className="text-xs text-gray-400">{formatMonth(q.period_month)} · FY {q.financial_year}</p>
                <p className="mt-2 text-sm text-gray-800">{q.query_text}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold border
                ${q.status === "open" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                {q.status}
              </span>
            </div>
            {q.response_text && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 border-l-4 border-gray-300">
                <p className="text-xs font-semibold text-gray-400 mb-1">Manager Response</p>
                {q.response_text}
              </div>
            )}
            {isManager && q.status === "open" && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <textarea
                  value={responseMap[q.id] || ""}
                  onChange={(e) => setResponseMap((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Write your response..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:border-gray-400 focus:outline-none"
                />
                <button
                  onClick={() => handleRespond(q.id)}
                  disabled={busy === q.id}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
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
// ─── KPI Setup Tab ───────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
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
    if (kras.some((k) => !k.name.trim())) return toast.error("All KRAs must have a name");
    setSaving(true);
    try {
      await kpiService.saveAssignment({ financial_year: fy, kras, starts_from: startsFrom || undefined });
      toast.success("KPI saved as draft");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleSubmitForApproval = async () => {
    await handleSave();
    if (!assignment?.id) { toast.error("Save first"); return; }
    setSubmitting(true);
    try {
      await kpiService.submitAssignment(assignment.id);
      toast.success("Submitted for manager approval!");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const isLocked = assignment?.status === "active" || assignment?.status === "pending_approval";

  return (
    <div className="space-y-6">
      {/* Status */}
      {assignment && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <KpiAssignmentBadge status={assignment.status} />
          {assignment.status === "pending_approval" && (
            <p className="text-sm text-gray-500">KPI is with your manager for approval. You cannot edit it now.</p>
          )}
          {assignment.status === "active" && (
            <p className="text-sm text-gray-500">KPI is approved and active. Contact your manager to make changes.</p>
          )}
        </div>
      )}

      {/* Starts From */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">When does your KPI start?</h2>
        <select
          value={startsFrom}
          onChange={(e) => setStartsFrom(e.target.value)}
          disabled={isLocked}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-gray-400 focus:outline-none disabled:bg-gray-50"
        >
          <option value="">April (whole year)</option>
          {fyMonths.map((m: string) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-400">
          Select April if you were here for the whole year, otherwise pick your joining month.
        </p>
      </div>

      {/* KRA Editor */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Job Role KRAs</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total weight: <span className={isWeightOk ? "text-gray-600 font-semibold" : "text-red-600 font-semibold"}>{totalWeight}% / 80%</span></p>
          </div>
          {!isLocked && (
            <button
              onClick={addKra}
              className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add KRA
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-50">
          {kras.filter((k) => k.section === "job_role").map((kra, i) => (
            <div key={i} className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={kra.name}
                  onChange={(e) => updateKra(i, "name", e.target.value)}
                  disabled={isLocked}
                  placeholder="KRA Name (e.g. Customer Satisfaction)"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none disabled:bg-gray-50"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={kra.weight}
                    onChange={(e) => updateKra(i, "weight", Math.max(1, Math.min(80, parseInt(e.target.value) || 1)))}
                    disabled={isLocked}
                    className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-sm text-center font-bold text-gray-800 focus:border-gray-400 focus:outline-none disabled:bg-gray-50"
                  />
                  <span className="text-xs text-gray-400 font-medium">%</span>
                </div>
                {!isLocked && (
                  <button
                    onClick={() => removeKra(i)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                value={kra.target}
                onChange={(e) => updateKra(i, "target", e.target.value)}
                disabled={isLocked}
                placeholder="Target / description for this KRA..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-300 focus:border-gray-400 focus:outline-none disabled:bg-gray-50"
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
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={handleSubmitForApproval}
            disabled={saving || submitting}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit for Manager Approval"}
          </button>
        </div>
      )}
    </div>
  );
}
