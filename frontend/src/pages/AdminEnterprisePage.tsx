import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, Activity, Database, HardDrive, Mail, Users,
  AlertTriangle, Clock, RefreshCw, Zap, DollarSign, Shield,
  Settings, Layers, Server, ShieldCheck, CheckCircle2, XCircle
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

function fmtNum(n: number) {
  if (!n && n !== 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtBytes(b: number) {
  if (!b) return "0 B";
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + " GB";
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
  return (b / 1024).toFixed(0) + " KB";
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

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "database", label: "D1 Database", icon: Database },
  { id: "storage", label: "R2 Storage", icon: HardDrive },
  { id: "users", label: "Users", icon: Users },
  { id: "audit", label: "Audit Log", icon: Shield },
  { id: "billing", label: "Billing", icon: DollarSign },
  { id: "migration", label: "Migrations", icon: Layers },
];

export default function AdminEnterprisePage() {
  const [tab, setTab] = useState<string>("overview");
  const [analytics, setAnalytics] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [fileHealth, setFileHealth] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [refreshTs, setRefreshTs] = useState<Date | null>(null);

  const setLoad = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));

  const loadOverview = useCallback(async () => {
    setLoad("overview", true);
    try {
      const [anaRes, billRes] = await Promise.allSettled([
        api.get("/admin/analytics/dashboard"),
        api.get("/admin/analytics/billing"),
      ]);
      if (anaRes.status === "fulfilled") setAnalytics(anaRes.value.data);
      if (billRes.status === "fulfilled") setBilling(billRes.value.data);
      setRefreshTs(new Date());
    } catch (e: any) {
      toast.error("Failed to load overview data");
    } finally {
      setLoad("overview", false);
    }
  }, []);

  const loadStorage = useCallback(async () => {
    setLoad("storage", true);
    try {
      const [srRes, fhRes] = await Promise.allSettled([
        api.get("/admin/files/storage-report"),
        api.get("/admin/files/health"),
      ]);
      if (srRes.status === "fulfilled") setStorage(srRes.value.data);
      if (fhRes.status === "fulfilled") setFileHealth(fhRes.value.data);
    } catch (e: any) {
      toast.error("Failed to load storage report");
    } finally {
      setLoad("storage", false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoad("users", true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.users || res.data || []);
    } catch (e: any) {
      toast.error("Failed to load users list");
    } finally {
      setLoad("users", false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === "storage") loadStorage();
    if (tab === "users") loadUsers();
  }, [tab, loadStorage, loadUsers]);

  const runMigrationsV2 = async () => {
    setMigrationLoading(true);
    const tid = toast.loading("Executing V2 Enterprise Migrations...");
    try {
      const res = await api.post("/admin/run-migrations-v2");
      setMigrationResult(res.data);
      toast.dismiss(tid);
      if (res.data?.success) {
        toast.success(res.data?.message || "V2 Migrations executed successfully!");
      } else {
        toast.error("Migration encountered errors.");
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(e?.response?.data?.message || "V2 Migration failed.");
    } finally {
      setMigrationLoading(false);
    }
  };

  const repairApprovals = async () => {
    const tid = toast.loading("Repairing stuck approval workflows...");
    try {
      await api.post("/admin/approvals/repair-stuck");
      toast.dismiss(tid);
      toast.success("Stuck approvals repaired!");
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error("Failed to repair approvals.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 text-slate-800 font-sans">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Enterprise Admin Panel
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cloudflare Edge Architecture · D1 Single-Primary · R2 Storage · KV Rate Limiter
              {refreshTs && ` · ${refreshTs.toLocaleTimeString("en-IN")}`}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadOverview();
            if (tab === "storage") loadStorage();
            if (tab === "users") loadUsers();
            toast.success("Refreshed all enterprise data");
          }}
          disabled={loading.overview}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading.overview ? "animate-spin" : ""}`} />
          Refresh Panel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl w-fit mb-6 text-xs font-semibold overflow-x-auto max-w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white text-violet-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Today API Calls
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {fmtNum(analytics?.analytics?.todayEvents ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Edge events</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Users
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {analytics?.analytics?.activeUsersToday ?? 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Unique today</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Errors Today
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {analytics?.analytics?.errorsToday ?? 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Logged errors</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Avg Latency
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                  {analytics?.analytics?.avgResponseTimeMs ?? 0}ms
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Response time</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                <Activity className="w-4 h-4 text-violet-600" />
                <span>Events by Type (7 Days)</span>
              </div>
              {!analytics?.weeklyEventsByType?.length ? (
                <p className="text-xs text-slate-400 italic">No event data found.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.weeklyEventsByType.map((e: any) => (
                    <div key={e.event_type} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{e.event_type}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-violet-600 h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                (e.cnt / (analytics.weeklyEventsByType[0]?.cnt || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 w-10 text-right">
                          {fmtNum(e.cnt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>Email Delivery Log (7 Days)</span>
              </div>
              {!analytics?.emailStats?.length ? (
                <p className="text-xs text-slate-400 italic">No email logs found.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.emailStats.map((e: any) => (
                    <div
                      key={e.status}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs"
                    >
                      <span className="font-semibold text-slate-800 capitalize">{e.status}</span>
                      <span className="font-bold text-slate-900">{e.cnt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
              <Server className="w-4 h-4 text-slate-700" />
              <span>Cloudflare Architecture Subsystems</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "D1 Database", status: "Active (v2.1)", color: "text-emerald-600 bg-emerald-50" },
                { label: "R2 Storage", status: "Primary Store", color: "text-emerald-600 bg-emerald-50" },
                { label: "KV Cache", status: "Rate & OTP", color: "text-emerald-600 bg-emerald-50" },
                { label: "Email Worker", status: "CF Native Sender", color: "text-emerald-600 bg-emerald-50" },
                { label: "Upload Queue", status: "Async Process", color: "text-emerald-600 bg-emerald-50" },
                { label: "Analytics Queue", status: "Batch Logger", color: "text-emerald-600 bg-emerald-50" },
              ].map((sub) => (
                <div key={sub.label} className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg text-xs">
                  <div className="font-bold text-slate-800">{sub.label}</div>
                  <div className={`mt-1 font-semibold text-[11px] px-2 py-0.5 rounded w-fit ${sub.color}`}>
                    {sub.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DATABASE */}
      {tab === "database" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>D1 Primary Database Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg">
                <span className="text-slate-500 font-medium">Database Name:</span>
                <div className="font-mono font-bold text-slate-900 mt-1">expense_management_db</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg">
                <span className="text-slate-500 font-medium">Database ID:</span>
                <div className="font-mono font-bold text-slate-900 mt-1">
                  34e085d8-c078-4f2f-b240-9bf8f4cf9301
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Settings className="w-4 h-4 text-slate-700" />
                <span>Quick Operations</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={runMigrationsV2}
                disabled={migrationLoading}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-60 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                Run V2 SQL Schema Migrations
              </button>
              <button
                onClick={repairApprovals}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                Repair Stuck Approvals
              </button>
            </div>

            {migrationResult && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className={`font-bold ${migrationResult.success ? "text-emerald-700" : "text-rose-700"}`}>
                  {migrationResult.message}
                </div>
                {migrationResult.tableStatus && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {Object.entries(migrationResult.tableStatus).map(([t, ok]) => (
                      <div key={t} className="flex items-center gap-1.5">
                        {ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span className="font-mono text-slate-700">{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORAGE */}
      {tab === "storage" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span>R2 Storage Health & File Audit</span>
              </div>
              <button
                onClick={loadStorage}
                disabled={loading.storage}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Refresh Storage
              </button>
            </div>

            {fileHealth && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-center">
                  <div className="text-xl font-bold text-slate-900">{fileHealth.total ?? 0}</div>
                  <div className="text-[11px] text-slate-500">Checked Files</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {(fileHealth.total ?? 0) - (fileHealth.broken ?? 0)}
                  </div>
                  <div className="text-[11px] text-emerald-600">Healthy R2 Files</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-center">
                  <div className="text-xl font-bold text-rose-700">{fileHealth.broken ?? 0}</div>
                  <div className="text-[11px] text-rose-600">Broken Keys</div>
                </div>
              </div>
            )}

            {storage?.byCategory?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">Storage by Category:</div>
                <div className="divide-y divide-slate-100 text-xs">
                  {storage.byCategory.map((c: any) => (
                    <div key={c.category} className="py-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">{c.category || "General"}</span>
                      <div className="flex items-center gap-4 text-slate-600">
                        <span>{fmtNum(c.files)} files</span>
                        <span className="font-bold text-indigo-600">{fmtBytes(c.bytes)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Registered System Users ({users.length})</span>
            </div>
            <button
              onClick={loadUsers}
              disabled={loading.users}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Reload Users
            </button>
          </div>

          {!users.length ? (
            <p className="text-xs text-slate-400 italic py-4">Loading system users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">User ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Email ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.slice(0, 50).map((u: any) => (
                    <tr key={u.user_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">
                        {u.user_id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{u.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            u.user_status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {u.user_status || "active"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{u.mail_id || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length > 50 && (
                <p className="text-center text-[11px] text-slate-400 mt-3">
                  Showing 50 of {users.length} users.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* AUDIT */}
      {tab === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
            <span>Audit Log Activity</span>
          </div>

          {!analytics?.recentAuditLog?.length ? (
            <p className="text-xs text-slate-400 italic py-4">No audit logs available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entity</th>
                    <th className="py-2.5 px-3">Performed By</th>
                    <th className="py-2.5 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {analytics.recentAuditLog.map((log: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-violet-700">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-800">{log.entity_type}</td>
                      <td className="py-2.5 px-3 text-slate-600">{log.performed_by_name || "System"}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{istTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BILLING */}
      {tab === "billing" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Cloudflare Usage Summary</span>
          </div>
          {billing ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="text-lg font-bold text-slate-900">
                Total Estimated Cost: ${billing.billing.totalEstimatedCost} USD
              </div>
              <div className="text-slate-500">
                Month: {billing.billing.month} · Worker Requests: {billing.billing.workerRequests.count} · Storage: {billing.billing.r2Storage.gb} GB
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Loading billing information...</p>
          )}
        </div>
      )}

      {/* MIGRATION */}
      {tab === "migration" && (
        <div className="space-y-6">
          {/* D1 SQL Schema Migrations Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Layers className="w-4 h-4 text-violet-600" />
              <span>D1 Database SQL Schema Migrations</span>
            </div>
            <p className="text-xs text-slate-600">
              Executes V2 database table schema updates (creates all required D1 tables and indexes). Safe to run anytime.
            </p>
            <button
              onClick={runMigrationsV2}
              disabled={migrationLoading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer"
            >
              Run V2 SQL Schema Migrations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

