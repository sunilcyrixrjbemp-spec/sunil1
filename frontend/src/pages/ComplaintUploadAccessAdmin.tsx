import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  ArrowLeft
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { complaintService, ComplaintPermissionUser } from "../services/complaintService";

export default function ComplaintUploadAccessAdmin() {
  const [user] = useState<any>(() => JSON.parse(localStorage.getItem("user") || "null"));
  const isAdmin = (user?.role || user?.designation || "").trim().toLowerCase() === "admin";

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ComplaintPermissionUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [permissionFilter, setPermissionFilter] = useState<"all" | "granted" | "revoked">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await complaintService.listPermissions();
      setUsers(list);
    } catch (err: any) {
      console.error("Failed to load users for permission management:", err);
      toast.error(err.response?.data?.error || "Failed to load user permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleToggle = async (targetUser: ComplaintPermissionUser) => {
    const nextState = targetUser.has_permission !== 1;
    const userIdentifier = targetUser.employee_code || String(targetUser.id);
    setTogglingId(userIdentifier);

    try {
      await complaintService.togglePermission(userIdentifier, nextState);
      toast.success(
        nextState
          ? `Upload access granted to ${targetUser.name}`
          : `Upload access revoked for ${targetUser.name}`
      );
      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          (u.employee_code === targetUser.employee_code || u.id === targetUser.id)
            ? {
                ...u,
                has_permission: nextState ? 1 : 0,
                granted_by: nextState ? String(user?.user_id || "admin") : u.granted_by,
                granted_at: nextState ? new Date().toISOString() : u.granted_at
              }
            : u
        )
      );
    } catch (err: any) {
      console.error("Failed to toggle permission:", err);
      toast.error(err.response?.data?.error || "Failed to update permission");
    } finally {
      setTogglingId(null);
    }
  };

  // Distinct roles for filter
  const distinctRoles = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.role).filter(Boolean)));
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.employee_code && u.employee_code.toLowerCase().includes(q)) ||
        (u.district && u.district.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (roleFilter !== "all" && u.role !== roleFilter) return false;

      if (permissionFilter === "granted" && u.has_permission !== 1) return false;
      if (permissionFilter === "revoked" && u.has_permission === 1) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, permissionFilter]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-rose-200 rounded-lg shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-2">
          Administrator Access Required
        </h2>
        <p className="text-xs text-slate-600 mb-6">
          Only system administrators can manage complaint upload access permissions.
        </p>
        <Link
          to="/complaint-upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          Return to Complaint Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/complaint-upload"
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
            title="Back to Upload Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Manage Complaint Upload Access
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Grant or revoke complaint dataset upload permissions for system users
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, employee code, district, email..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Roles</option>
            {distinctRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Permission Status Filter */}
          <select
            value={permissionFilter}
            onChange={(e) => setPermissionFilter(e.target.value as any)}
            className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Permissions</option>
            <option value="granted">Access Granted Only</option>
            <option value="revoked">Access Revoked Only</option>
          </select>
        </div>
      </div>

      {/* Users Permissions Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading user access list...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            No users match your selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="p-3">User / Employee</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Upload Access</th>
                  <th className="p-3">Granted By</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.map((u) => {
                  const hasAccess = u.has_permission === 1 || u.role?.toLowerCase() === "admin";
                  const isUserAdmin = u.role?.toLowerCase() === "admin";
                  const isToggling = togglingId === (u.employee_code || String(u.id));

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[10.5px] text-slate-500 font-mono">
                          {u.employee_code || `User #${u.id}`}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role || "User"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {u.district || "—"}
                      </td>
                      <td className="p-3">
                        {hasAccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {isUserAdmin ? "Admin (Implicit)" : "Granted"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            No Access
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {isUserAdmin ? "System Default" : u.granted_by || "—"}
                      </td>
                      <td className="p-3 text-right">
                        {isUserAdmin ? (
                          <span className="text-[10px] text-slate-400 font-semibold italic">
                            Admin Role
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggle(u)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded text-[10.5px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs disabled:opacity-50 ${
                              hasAccess
                                ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                : "bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700"
                            }`}
                          >
                            {isToggling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : hasAccess ? (
                              "Revoke Access"
                            ) : (
                              "Grant Access"
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
