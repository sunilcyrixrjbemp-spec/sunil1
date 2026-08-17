import api from "./api";

// ─── Scoring Logic (mirrors cyrix-kpi.vercel.app exactly) ─────────────────────

export const SCORE_BANDS = [
  { key: "excellent",    label: "Excellent",    min: 90, hex: { base: "#059669", soft: "#d1fae5", strong: "#064e3b" }, chipClass: "bg-emerald-100 text-emerald-800 border-emerald-200", accentClass: "text-emerald-700", barClass: "bg-emerald-500" },
  { key: "veryGood",    label: "Very Good",    min: 80, hex: { base: "#22c55e", soft: "#dcfce7", strong: "#166534" }, chipClass: "bg-green-100 text-green-800 border-green-200",   accentClass: "text-green-700",   barClass: "bg-green-500"   },
  { key: "good",        label: "Good",         min: 60, hex: { base: "#84cc16", soft: "#ecfccb", strong: "#3f6212" }, chipClass: "bg-lime-100 text-lime-800 border-lime-200",     accentClass: "text-lime-700",    barClass: "bg-lime-500"    },
  { key: "satisfactory",label: "Satisfactory", min: 40, hex: { base: "#f59e0b", soft: "#fef3c7", strong: "#92400e" }, chipClass: "bg-amber-100 text-amber-800 border-amber-200",  accentClass: "text-amber-700",  barClass: "bg-amber-500"   },
  { key: "poor",        label: "Poor",         min: -Infinity, hex: { base: "#e30613", soft: "#fde3e5", strong: "#9e0812" }, chipClass: "bg-red-100 text-red-800 border-red-200", accentClass: "text-red-700",    barClass: "bg-red-500"     },
];

export const PASS_THRESHOLD = 60; // "Good" is the pass mark

export function getBand(score: number | null | undefined) {
  if (score === null || score === undefined || isNaN(score)) return null;
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

export const SECTION_LABELS: Record<string, string> = {
  job_role:     "Job Role",
  esms:         "ESMS",
  core_values:  "Alignment To Core Values",
};

export const DEFAULT_WEIGHTS = {
  job_role:    80,
  esms:         0,
  core_values: 20,
};

export const CORE_VALUES_OPTIONS = [
  "Customer Focus",
  "Integrity",
  "Accountability",
  "Teamwork",
  "Innovation",
  "Quality",
  "Leadership",
  "Communication",
];

export const CORE_VALUE_RATINGS = [
  { value: 5, label: "Exceptional" },
  { value: 4, label: "Exceeds Expectations" },
  { value: 3, label: "Meets Expectations" },
  { value: 2, label: "Needs Improvement" },
  { value: 1, label: "Unsatisfactory" },
];

/** Get all months for a financial year (Apr–Mar) */
export function getFYMonths(fy: string): string[] {
  const endYear = parseInt(fy);
  const startYear = endYear - 1;
  const names = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
  return names.map((m, i) => `${m}-${i < 9 ? startYear : endYear}`);
}

/** Get the financial year string for a given date */
export function getFY(date = new Date()): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 3 ? String(year + 1) : String(year);
}

/** Get the current financial year */
export function currentFY(): string { return getFY(); }

/** Format a "Apr-2026" month string to "April 2026" */
export function formatMonth(m: string): string {
  if (!m) return "";
  const [mon, yr] = m.split("-");
  const full: Record<string, string> = {
    Jan: "January", Feb: "February", Mar: "March", Apr: "April",
    May: "May",     Jun: "June",     Jul: "July",   Aug: "August",
    Sep: "September", Oct: "October", Nov: "November", Dec: "December"
  };
  return `${full[mon] ?? mon} ${yr}`;
}

/** Score trend: last 2 vs prior 2 months */
export function calcTrend(scores: (number | null)[]): { direction: "up" | "down" | "flat"; delta: number } | null {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length < 3) return null;
  const last2 = valid.slice(-2);
  const prior2 = valid.slice(-4, -2);
  if (prior2.length === 0) return null;
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const delta = avg(last2) - avg(prior2);
  return {
    direction: delta > 2 ? "up" : delta < -2 ? "down" : "flat",
    delta: Math.round(delta * 10) / 10
  };
}

// ─── API Service Layer ─────────────────────────────────────────────────────────

export const kpiService = {

  // ── Assignment ────────────────────────────────────────────────────────────────

  getAssignment: async (fy?: string, userId?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    if (userId) params.set("user_id", userId);
    const res = await api.get(`/kpi/assignment?${params.toString()}`);
    return res.data;
  },

  saveAssignment: async (payload: {
    financial_year: string;
    kras: any[];
    starts_from?: string;
  }): Promise<any> => {
    const res = await api.post("/kpi/assignment", payload);
    return res.data;
  },

  submitAssignment: async (id: number): Promise<any> => {
    const res = await api.post(`/kpi/assignment/${id}/submit`);
    return res.data;
  },

  approveAssignment: async (id: number): Promise<any> => {
    const res = await api.post(`/kpi/assignment/${id}/approve`);
    return res.data;
  },

  rejectAssignment: async (id: number, reason: string): Promise<any> => {
    const res = await api.post(`/kpi/assignment/${id}/reject`, { reason });
    return res.data;
  },

  setStartsFrom: async (id: number, month: string): Promise<any> => {
    const res = await api.post(`/kpi/assignment/${id}/starts-from`, { month });
    return res.data;
  },

  // ── Submission ────────────────────────────────────────────────────────────────

  getSubmission: async (month: string, fy?: string, userId?: string): Promise<any> => {
    const params = new URLSearchParams({ month });
    if (fy) params.set("fy", fy);
    if (userId) params.set("user_id", userId);
    const res = await api.get(`/kpi/submission?${params.toString()}`);
    return res.data;
  },

  saveSubmission: async (payload: {
    period_month: string;
    financial_year: string;
    self_data: Record<string, any>;
    core_values_ratings?: Record<string, number>;
    anything_to_add?: string;
  }): Promise<any> => {
    const res = await api.post("/kpi/submission", payload);
    return res.data;
  },

  submitSubmission: async (id: number): Promise<any> => {
    const res = await api.post(`/kpi/submission/${id}/submit`);
    return res.data;
  },

  scoreSubmission: async (id: number, payload: {
    manager_scores: Record<string, number>;
    core_values_ratings?: Record<string, number>;
  }): Promise<any> => {
    const res = await api.post(`/kpi/submission/${id}/score`, payload);
    return res.data;
  },

  finalizeSubmission: async (id: number, payload: {
    final_job_score: number;
    final_esms_score?: number;
    final_core_score: number;
    manager_scores: Record<string, number>;
    core_values_ratings?: Record<string, number>;
  }): Promise<any> => {
    const res = await api.post(`/kpi/submission/${id}/finalize`, payload);
    return res.data;
  },

  returnSubmission: async (id: number, reason: string): Promise<any> => {
    const res = await api.post(`/kpi/submission/${id}/return`, { reason });
    return res.data;
  },

  // ── History ───────────────────────────────────────────────────────────────────

  getHistory: async (fy?: string, userId?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    if (userId) params.set("user_id", userId);
    const res = await api.get(`/kpi/history?${params.toString()}`);
    return res.data;
  },

  // ── Analytics ─────────────────────────────────────────────────────────────────

  getYearAnalytics: async (fy?: string, userId?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    if (userId) params.set("user_id", userId);
    const res = await api.get(`/kpi/analytics/year?${params.toString()}`);
    return res.data;
  },

  getAttainment: async (fy?: string, userId?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    if (userId) params.set("user_id", userId);
    const res = await api.get(`/kpi/analytics/attainment?${params.toString()}`);
    return res.data;
  },

  // ── Team ──────────────────────────────────────────────────────────────────────

  getTeam: async (fy?: string, month?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    if (month) params.set("month", month);
    const res = await api.get(`/kpi/team?${params.toString()}`);
    return res.data;
  },

  getTeamMembers: async (): Promise<any> => {
    const res = await api.get("/kpi/team/members");
    return res.data;
  },

  getTeamMemberSummary: async (employeeId: string, fy?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (fy) params.set("fy", fy);
    const res = await api.get(`/kpi/team/${employeeId}/summary?${params.toString()}`);
    return res.data;
  },

  // ── Approvals ─────────────────────────────────────────────────────────────────

  getPendingApprovals: async (fy?: string): Promise<any> => {
    const params = fy ? `?fy=${fy}` : "";
    const res = await api.get(`/kpi/approvals/pending${params}`);
    return res.data;
  },

  // ── Deletion Requests ─────────────────────────────────────────────────────────

  getDeletions: async (): Promise<any> => {
    const res = await api.get("/kpi/deletions");
    return res.data;
  },

  raiseDeletion: async (submissionId: number, reason: string): Promise<any> => {
    const res = await api.post("/kpi/deletions", { submission_id: submissionId, reason });
    return res.data;
  },

  approveDeletion: async (id: number, note?: string): Promise<any> => {
    const res = await api.post(`/kpi/deletions/${id}/approve`, { note });
    return res.data;
  },

  rejectDeletion: async (id: number, note?: string): Promise<any> => {
    const res = await api.post(`/kpi/deletions/${id}/reject`, { note });
    return res.data;
  },

  // ── Queries ───────────────────────────────────────────────────────────────────

  getQueries: async (): Promise<any> => {
    const res = await api.get("/kpi/queries");
    return res.data;
  },

  raiseQuery: async (submissionId: number, queryText: string): Promise<any> => {
    const res = await api.post("/kpi/queries", { submission_id: submissionId, query_text: queryText });
    return res.data;
  },

  respondToQuery: async (id: number, responseText: string): Promise<any> => {
    const res = await api.post(`/kpi/queries/${id}/respond`, { response_text: responseText });
    return res.data;
  },

  // ── Notifications ─────────────────────────────────────────────────────────────

  getNotifications: async (): Promise<any> => {
    const res = await api.get("/kpi/notifications");
    return res.data;
  },
};
