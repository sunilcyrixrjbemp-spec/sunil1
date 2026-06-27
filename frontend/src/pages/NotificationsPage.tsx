import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import { ticketService } from "../services/ticketService";
import { tokenPersistence } from "../utils/persistence";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import { 
  Bell, 
  Search, 
  Calendar, 
  CheckSquare, 
  Trash2, 
  ExternalLink,
  Filter
} from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "warning" | "success" | "error" | "info";
  read: boolean;
  link: string;
  created_at?: string;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return [];
    const cached = localStorage.getItem(`notifications_${currentUser.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!currentUser) return true;
    return !localStorage.getItem(`notifications_${currentUser.user_id}`);
  });

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return String(dateVal);
    }
  };

  const loadNotifications = async (currentUser: any) => {
    const cacheKey = `notifications_${currentUser.user_id}`;
    const hasCache = !!localStorage.getItem(cacheKey);
    if (!hasCache) {
      setLoading(true);
    }
    const list: NotificationItem[] = [];
    try {
      const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");

      const allowedWindows = currentUser.allowed_windows
        ? currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
        : ["home", "profile", "help"];
      const isApprover = currentUser.role === "Admin" || allowedWindows.includes("approval");

      let pendings: any[] = [];
      let expenses: any[] = [];
      let tickets: any[] = [];

      try {
        const promises: Promise<any>[] = [];
        if (isApprover) {
          promises.push(approvalService.getPendingApprovals().then(res => pendings = res || []).catch(() => {}));
        }
        promises.push(expenseService.getExpenses().then(res => expenses = res || []).catch(() => {}));
        
        const hasHelpAccess = allowedWindows.includes("help") || currentUser.role === "Admin";
        if (hasHelpAccess) {
          promises.push(ticketService.getTickets().then(res => tickets = res || []).catch(() => {}));
        }
        
        await Promise.all(promises);
      } catch (e) {
        console.error("Failed loading notifications concurrently", e);
      }

      // Process Pending Approvals
      pendings.forEach((p: any) => {
        const id = `approval-${p.id}`;
        list.push({
          id: id,
          title: "Pending Approval",
          description: `Expense claim from ${p.employeeName} (${p.eCode}) for "${p.purpose || p.description}" of ₹${p.amount.toLocaleString()} is waiting for your review.`,
          time: "Action Required",
          type: "warning",
          read: readNotifIds.includes(id),
          link: "/approval-center",
          created_at: p.created_at || p.updated_at
        });
      });

      // Process own expenses status changes
      expenses.forEach((e: any) => {
        const id = `claim-${e.id}`;
        if (e.status === "approved" || e.status === "rejected") {
          list.push({
            id: id,
            title: `Claim ${e.status.toUpperCase()}`,
            description: `Your claim of ₹${e.amount.toLocaleString()} for "${e.description || e.purpose}" has been ${e.status}.`,
            time: "Recent Update",
            type: e.status === "approved" ? "success" : "error",
            read: readNotifIds.includes(id),
            link: "/home",
            created_at: e.created_at || e.updated_at
          });
        } else if (e.status.startsWith("submitted")) {
          list.push({
            id: id,
            title: "Claim Submitted",
            description: `Your claim of ₹${e.amount.toLocaleString()} for "${e.description || e.purpose}" is successfully submitted and pending review.`,
            time: "Submitted",
            type: "info",
            read: readNotifIds.includes(id) || true,
            link: "/home",
            created_at: e.created_at || e.updated_at
          });
        }
      });

      // Process Support Tickets alerts
      tickets.forEach((t: any) => {
        const isCreator = t.created_by_code === currentUser.user_id;
        const isAssignee = t.assigned_to_name === currentUser.name;
        
        if (isCreator) {
          if (t.status !== "Open" && t.status !== "Final Closed") {
            const id = `ticket-status-${t.id}-${t.status}`;
            list.push({
              id: id,
              title: `Ticket ${t.status}`,
              description: `Your support ticket ${t.ticket_code} ("${t.concern_type}") has been updated to ${t.status}.`,
              time: "Ticket Update",
              type: t.status === "Closed" || t.status === "Resolved" ? "success" : "info",
              read: readNotifIds.includes(id),
              link: "/help-center",
              created_at: t.updated_at
            });
          }
        }
        
        if (isAssignee) {
          if (t.status === "Open" || t.status === "Updated") {
            const id = `ticket-action-${t.id}-${t.status}`;
            list.push({
              id: id,
              title: "Ticket Action Required",
              description: `Support ticket ${t.ticket_code} ("${t.concern_type}") raised by ${t.created_by_name} is ${t.status} and assigned to you.`,
              time: "Action Required",
              type: "warning",
              read: readNotifIds.includes(id),
              link: "/help-center",
              created_at: t.updated_at
            });
          }
        }
      });

      // 3. Add default system welcome notification
      list.push({
        id: "sys-welcome",
        title: "System Active",
        description: `Welcome to Cyrix Healthcare Expense Management System.`,
        time: "Now",
        type: "info",
        read: readNotifIds.includes("sys-welcome") || true,
        link: "/home",
        created_at: currentUser.created_at || new Date().toISOString()
      });

      // Sort notifications by date descending
      list.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setNotifications(list);
      // Sync with localStorage for Bell Dropdown caching
      localStorage.setItem(`notifications_${currentUser.user_id}`, JSON.stringify(list));
    } catch (err) {
      toast.error("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate("/login");
      return;
    }
    setUser(currentUser);
    loadNotifications(currentUser);
  }, [navigate]);

  const toggleReadStatus = (id: string) => {
    const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");
    let updatedReadIds = [...readNotifIds];

    if (readNotifIds.includes(id)) {
      updatedReadIds = updatedReadIds.filter(x => x !== id);
    } else {
      updatedReadIds.push(id);
    }
    tokenPersistence.saveReadNotificationIds(updatedReadIds);
    
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const markAllAsRead = () => {
    const readNotifIds = JSON.parse(localStorage.getItem("read_notification_ids") || "[]");
    const updatedReadIds = [...readNotifIds];

    notifications.forEach(n => {
      if (!updatedReadIds.includes(n.id)) {
        updatedReadIds.push(n.id);
      }
    });

    tokenPersistence.saveReadNotificationIds(updatedReadIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("All notifications marked as read.");
  };

  const deleteNotification = (id: string) => {
    if (id === "sys-welcome") {
      toast.error("System configuration notifications cannot be deleted.");
      return;
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success("Notification removed.");
  };

  // Filter & Search Logic
  const getFilteredNotifications = () => {
    return notifications.filter(n => {
      // 1. Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(query);
        const matchesDesc = n.description.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 2. Status Type Filter
      if (filterStatus !== "all") {
        const isApproved = n.title.toLowerCase().includes("approved") || n.type === "success";
        const isRejected = n.title.toLowerCase().includes("rejected") || n.type === "error";
        const isPending = n.title.toLowerCase().includes("pending") || n.title.toLowerCase().includes("submitted") || n.type === "warning";
        const isSystem = n.id.startsWith("sys") || n.type === "info";

        if (filterStatus === "approved" && !isApproved) return false;
        if (filterStatus === "rejected" && !isRejected) return false;
        if (filterStatus === "pending" && !isPending) return false;
        if (filterStatus === "system" && !isSystem) return false;
      }

      // 3. Date Filters
      if (n.created_at) {
        const notifDate = new Date(n.created_at).getTime();
        if (startDate) {
          const start = new Date(startDate + "T00:00:00").getTime();
          if (notifDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate + "T23:59:59").getTime();
          if (notifDate > end) return false;
        }
      }

      return true;
    });
  };

  if (!user) return null;

  const filteredNotifs = getFilteredNotifications();

  return (
    <div className="space-y-6 animate-fadeIn text-[#212529]">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600 animate-swing" />
            Alerts & Notifications
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Review detailed historical updates for expense claims, approvals, and system broadcasts.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadNotifications(user)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded border border-gray-200 cursor-pointer"
          >
            Refresh
          </button>
          <button
            onClick={markAllAsRead}
            disabled={notifications.every(n => n.read)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-transparent text-white text-xs font-bold uppercase tracking-wider rounded border-0 cursor-pointer transition-colors"
          >
            Mark all read
          </button>
        </div>
      </div>

      {/* Filters Box - AdminLTE card style */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
        <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider flex items-center gap-1 border-b border-gray-150 pb-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          Search & Filters Control
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Search Text</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-250 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-500 pl-8"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Status Type</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-white border border-gray-250 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Notifications</option>
              <option value="approved">Approved Claims</option>
              <option value="rejected">Rejected Claims</option>
              <option value="pending">Pending Review</option>
              <option value="system">System Alerts</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">Start Date</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-gray-250 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold">End Date</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-gray-250 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List Card */}
      <div className="bg-white border-t-4 border-t-blue-600 border-x border-b border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">
            Showing {filteredNotifs.length} Alerts
          </span>
        </div>

        {loading ? (
          <div className="py-12">
            <Loader message="Fetching historical alert logs..." />
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-bold uppercase tracking-wider text-[10px]">No notifications found matching current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifs.map((n) => (
              <div 
                key={n.id}
                className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  n.read ? "bg-white hover:bg-gray-50/50" : "bg-blue-50/20 hover:bg-blue-50/40 border-l-2 border-l-blue-600"
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Read indicator */}
                    <button 
                      onClick={() => toggleReadStatus(n.id)}
                      className="bg-transparent border-0 p-0 text-gray-400 hover:text-blue-600 cursor-pointer shrink-0"
                      title={n.read ? "Mark as unread" : "Mark as read"}
                    >
                      <CheckSquare className={`w-4.5 h-4.5 ${n.read ? "text-gray-300" : "text-blue-600"}`} />
                    </button>

                    {/* Badge */}
                    <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded border ${
                      n.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" :
                      n.type === "success" ? "bg-green-50 border-green-200 text-green-700" :
                      n.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"
                    }`}>
                      {n.title}
                    </span>

                    {/* Date/Time */}
                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 ml-2">
                      <Calendar className="w-3 h-3" />
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 font-medium leading-relaxed pr-4">
                    {n.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    to={n.link}
                    onClick={() => {
                      if (!n.read) toggleReadStatus(n.id);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors border border-gray-200 bg-white cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                    title="View related page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Page
                  </Link>
                  {n.id !== "sys-welcome" && (
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors border border-gray-200 bg-white cursor-pointer"
                      title="Delete alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
