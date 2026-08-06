import { useState, useEffect, useCallback } from "react";
import {
  Activity, Mail, AlertTriangle, Clock, TrendingUp,
  RefreshCw, FileText, Zap, DollarSign, Users, Database, HardDrive,
  ShieldCheck, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import AdminAnalyticsSkeleton from "../components/common/AdminAnalyticsSkeleton";

// ─── Interfaces ─────────────────────────────────────────────────────────────────
interface AnalyticsData {
  analytics: {
    todayEvents: number;
    activeUsersToday: number;
    errorsToday: number;
    avgResponseTimeMs: number;
  };
  weeklyEventsByType: Array<{ event_type: string; cnt: number }>;
  topEventNames: Array<{ event_name: string; cnt: number }>;
  emailStats: Array<{ status: string; cnt: number }>;
  recentAuditLog: Array<{ action: string; entity_type: string; performed_by_name: string; created_at: string }>;
  generatedAt?: string;
}

interface BillingData {
  billing: {
    month: string;
    workerRequests: { count: number; freeTier: number; cost: string };
    r2Storage: { bytes: number; gb: string; freeTierGb: number; cost: string };
    r2ClassA: { count: number; freeTier: number; cost: string };
    emailsSent: { count: number; cost: string };
    totalEstimatedCost: string;
    currency: string;
  };
  generatedAt?: string;
}

function fmtNum(n: number) {
  if (!n && n !== 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function istTime(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function AdminAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "billing" | "audit">("overview");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async (showToastNotice = false) => {
    setLoading(true);
    setError(null);
    try {
      const [anaRes, billRes] = await Promise.allSettled([
        api.get<AnalyticsData>("/admin/analytics/dashboard"),
        api.get<BillingData>("/admin/analytics/billing"),
      ]);

      if (anaRes.status === "fulfilled") {
        setAnalytics(anaRes.value.data);
      } else {
        const msg = (anaRes.reason as any)?.response?.data?.message || (anaRes.reason as any)?.message || "Failed to load analytics";
        setError(msg);
      }

      if (billRes.status === "fulfilled") {
        setBilling(billRes.value.data);
      }

      setLastRefresh(new Date());
      if (showToastNotice) toast.success("Analytics data refreshed!");
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 text-slate-800 font-sans">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Cloudflare Analytics & Live Metrics
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Enterprise Edge Analytics · D1 Telemetry · Email Queue</span>
                {lastRefresh && (
                  <span className="text-slate-400">
                    · Refreshed {lastRefresh.toLocaleTimeString("en-IN")}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 mb-6 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-xl w-fit mb-6 text-xs font-semibold">
        {[
          { id: "overview", label: "Overview Metrics", icon: Activity },
          { id: "billing", label: "Cloudflare Usage & Cost", icon: DollarSign },
          { id: "audit", label: "Security & Audit Log", icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-indigo-600 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && !analytics ? (
        <AdminAnalyticsSkeleton />
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && analytics && (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Today's API Events
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                      {fmtNum(analytics.analytics.todayEvents)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Tracked Workers Requests</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Active Users Today
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                      {analytics.analytics.activeUsersToday}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Unique active sessions</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      analytics.analytics.errorsToday > 10
                        ? "bg-rose-50 text-rose-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Errors Today
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                      {analytics.analytics.errorsToday}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {analytics.analytics.errorsToday > 10 ? "⚠ Elevated errors" : "Normal threshold"}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Avg Response Time
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                      {analytics.analytics.avgResponseTimeMs}ms
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {analytics.analytics.avgResponseTimeMs < 500 ? "🚀 High Speed" : "Normal Latency"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Type & Email Delivery Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Event Types */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Event Types Breakdown (Last 7 Days)</span>
                  </div>

                  {analytics.weeklyEventsByType.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">
                      No events logged in the last 7 days. Data will automatically appear as users navigate.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.weeklyEventsByType.map((item) => (
                        <div key={item.event_type} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{item.event_type}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (item.cnt / (analytics.weeklyEventsByType[0]?.cnt || 1)) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 w-10 text-right">
                              {fmtNum(item.cnt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email Delivery */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>Cloudflare Email Sender Delivery (Last 7 Days)</span>
                  </div>

                  {analytics.emailStats.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">
                      No email dispatches recorded in the last 7 days.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.emailStats.map((item) => {
                        const statusColors: Record<string, string> = {
                          sent: "bg-emerald-500 text-emerald-700",
                          queued: "bg-indigo-500 text-indigo-700",
                          failed: "bg-rose-500 text-rose-700",
                        };
                        return (
                          <div
                            key={item.status}
                            className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-lg border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  statusColors[item.status]?.split(" ")[0] || "bg-slate-400"
                                }`}
                              />
                              <span className="font-semibold text-slate-800 capitalize">
                                {item.status}
                              </span>
                            </div>
                            <span className="font-extrabold text-slate-900 text-sm">{item.cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Event Names */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Top API Call Names (Last 7 Days)</span>
                </div>

                {analytics.topEventNames.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No event records found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analytics.topEventNames.map((item) => (
                      <div
                        key={item.event_name}
                        className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-slate-700 truncate pr-2">
                          {item.event_name}
                        </span>
                        <span className="font-bold text-indigo-600 shrink-0">{fmtNum(item.cnt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BILLING */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              {billing ? (
                <>
                  {/* Estimated Cost Highlight Card */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
                    <div className="text-xs font-semibold text-indigo-300 tracking-wide uppercase">
                      Estimated Monthly Cloudflare Usage ({billing.billing.month})
                    </div>
                    <div className="text-4xl font-extrabold mt-2 tracking-tight">
                      ${billing.billing.totalEstimatedCost} <span className="text-lg font-medium text-slate-400">USD</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Estimates based on Workers requests, R2 storage & email telemetry. (Cloudflare Pro Plan free tier limits applied).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                        <Zap className="w-4 h-4 text-indigo-600" />
                        <span>Worker Requests</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        ${billing.billing.workerRequests.cost}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {fmtNum(billing.billing.workerRequests.count)} / {fmtNum(billing.billing.workerRequests.freeTier)} free
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                        <HardDrive className="w-4 h-4 text-emerald-600" />
                        <span>R2 Storage</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        ${billing.billing.r2Storage.cost}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {billing.billing.r2Storage.gb} GB / {billing.billing.r2Storage.freeTierGb} GB free
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                        <Database className="w-4 h-4 text-amber-600" />
                        <span>R2 Class A Ops</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        ${billing.billing.r2ClassA.cost}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {fmtNum(billing.billing.r2ClassA.count)} / {fmtNum(billing.billing.r2ClassA.freeTier)} free
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                        <Mail className="w-4 h-4 text-purple-600" />
                        <span>Emails Sent</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        ${billing.billing.emailsSent.cost}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {fmtNum(billing.billing.emailsSent.count)} dispatched
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                  Loading billing metrics...
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT */}
          {activeTab === "audit" && analytics && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Recent Audit Log Entries</span>
                </div>
                <span className="text-xs text-slate-400">Latest 20 security events</span>
              </div>

              {analytics.recentAuditLog.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No recent audit log entries found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Entity Type</th>
                        <th className="py-2.5 px-3">Performed By</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {analytics.recentAuditLog.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-100">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {log.entity_type}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {log.performed_by_name || "System"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {istTime(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
