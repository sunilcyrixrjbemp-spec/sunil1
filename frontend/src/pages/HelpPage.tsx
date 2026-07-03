import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { ticketService, TicketCreatePayload } from "../services/ticketService";
import { expenseService } from "../services/expenseService";
import Loader from "../components/common/Loader";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

// Helper to format date strings to user-friendly local browser dates
function formatDateTime(dateVal: any) {
  if (!dateVal) return "—";
  try {
    // Check if it matches 'DD-MMM-YYYY HH:MM:SS' format from backend comments
    const match = String(dateVal).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    let d: Date;
    if (match) {
      const day = parseInt(match[1]);
      const monthStr = match[2];
      const year = parseInt(match[3]);
      const hours = parseInt(match[4]);
      const minutes = parseInt(match[5]);
      const seconds = parseInt(match[6]);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIdx = months.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      d = new Date(year, monthIdx !== -1 ? monthIdx : 0, day, hours, minutes, seconds);
    } else {
      d = new Date(dateVal);
    }
    
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
}

// Helper to format hours duration into Jira-style string (e.g. 1d 4h 12m)
function formatDuration(totalHours: number) {
  if (isNaN(totalHours) || totalHours <= 0) return "N/A";
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  const hours = Math.floor(remainingHours);
  const minutes = Math.round((remainingHours - hours) * 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none">
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].payload.label || payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Concerns:
          </span>
          <span className="font-mono font-bold text-white">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function HelpPage() {

  // Auth User
  const [currentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });

  // Check screen size for mobile view
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [tickets, setTickets] = useState<any[]>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const cached = localStorage.getItem(`cache_support_tickets_${currentUserId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [myExpenses, setMyExpenses] = useState<any[]>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const cached = localStorage.getItem(`cache_my_expenses_${currentUserId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const hasTicketsCache = !!localStorage.getItem(`cache_support_tickets_${currentUserId}`);
    return !hasTicketsCache;
  });
  const [raising, setRaising] = useState(false);

  // Form states
  const [concernType, setConcernType] = useState<string>("Expense");
  const [otherCategory, setOtherCategory] = useState<string>("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
  const [assignedToName, setAssignedToName] = useState<string>("");
  const [priority, setPriority] = useState<string>("Medium");
  const [description, setDescription] = useState<string>("");

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<"raise" | "my-tickets" | "assigned-tickets">((() => {
    return (localStorage.getItem("help_active_tab") as "raise" | "my-tickets" | "assigned-tickets") || "my-tickets";
  }));

  const handleTabChange = (tab: "raise" | "my-tickets" | "assigned-tickets") => {
    setActiveTab(tab);
    localStorage.setItem("help_active_tab", tab);
  };

  const [filterFollowup, setFilterFollowup] = useState<"all" | "flagged" | "normal">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  
  // Selected ticket for details view
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  // WebSocket states & refs
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!selectedTicket || !selectedTicket.id) {
      setSocket(null);
      setTypingUser(null);
      return;
    }

    let apiHost = import.meta.env.VITE_API_URL || window.location.origin;
    apiHost = apiHost.replace(/^https?:\/\//, "");
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("access_token") || "";
    const wsUrl = `${wsProto}//${apiHost}/api/ticket/ws/${selectedTicket.id}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    setSocket(ws);
    setTypingUser(null);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "typing") {
          if (data.is_typing && data.user_id !== currentUser?.user_id) {
            setTypingUser(data.user_name);
          } else if (!data.is_typing) {
            setTypingUser(prev => prev === data.user_name ? null : prev);
          }
        } else if (data.type === "message") {
          // Update selected ticket details
          setSelectedTicket((prev: any) => {
            if (!prev || prev.id !== data.ticket_id) return prev;
            return { ...prev, comments: data.comments, status: data.status };
          });
          // Update ticket in listing
          setTickets((prevList) =>
            prevList.map((t) =>
              t.id === data.ticket_id
                ? { ...t, comments: data.comments, status: data.status }
                : t
            )
          );
        }
      } catch (err) {
        console.error("Websocket parse error:", err);
      }
    };

    ws.onclose = () => {
      setSocket(null);
      setTypingUser(null);
    };

    return () => {
      ws.close();
    };
  }, [selectedTicket?.id, currentUser?.user_id]);

  const handleInputChange = (val: string) => {
    setNewComment(val);

    if (socket && socket.readyState === WebSocket.OPEN) {
      if (!isTypingState) {
        setIsTypingState(true);
        socket.send(JSON.stringify({ type: "typing", is_typing: true }));
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingState(false);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "typing", is_typing: false }));
        }
      }, 2000);
    }
  };

  const fetchInitialData = async () => {
    const currentUserId = currentUser?.user_id || "Admin";
    const hasCache = !!localStorage.getItem(`cache_support_tickets_${currentUserId}`);
    if (!hasCache) {
      setLoading(true);
    }
    try {
      // Fetch tickets and expenses concurrently for faster load
      const [ticketList, expenseList] = await Promise.all([
        ticketService.getTickets(),
        currentUser ? expenseService.getExpenses() : Promise.resolve([])
      ]);
      setTickets(ticketList);
      setMyExpenses(expenseList);
      localStorage.setItem(`cache_support_tickets_${currentUserId}`, JSON.stringify(ticketList));
      if (currentUser) {
        localStorage.setItem(`cache_my_expenses_${currentUserId}`, JSON.stringify(expenseList));
      }
    } catch (e) {
      console.error("Failed to load help center tickets", e);
      if (!hasCache) {
        toast.error("Failed to load support tickets.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Autofill assigned name based on concern type
  useEffect(() => {
    if (!currentUser) return;
    if (concernType === "Profile") {
      setAssignedToName("Admin System");
    } else {
      setAssignedToName(currentUser.manager || "Admin System");
    }
  }, [concernType, currentUser]);

  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please explain your concern description.");
      return;
    }

    // Determine category name
    let finalCategory = concernType;
    if (concernType === "Other") {
      const cat = otherCategory.trim();
      if (!cat) {
        toast.error("Please specify your custom category category name.");
        return;
      }
      finalCategory = cat;
    }

    setRaising(true);
    try {
      const selectedExp = myExpenses.find(x => String(x.id) === selectedExpenseId);
      
      const payload: TicketCreatePayload = {
        concern_type: finalCategory,
        priority,
        description: description.trim(),
        assigned_to_name: concernType === "Profile" ? "Admin System" : assignedToName,
        expense_id: concernType === "Expense" && selectedExpenseId ? Number(selectedExpenseId) : null,
        expense_code: concernType === "Expense" && selectedExp ? selectedExp.expense_code : null
      };

      const newTkt = await ticketService.createTicket(payload);
      toast.success(`Support ticket raised successfully! ID: ${newTkt.ticket_code}`);
      
      // Reset form
      setDescription("");
      setSelectedExpenseId("");
      setOtherCategory("");
      
      // Reload tickets
      const updated = await ticketService.getTickets();
      setTickets(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to raise support ticket.");
    } finally {
      setRaising(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    setCommenting(true);
    try {
      const updated = await ticketService.addComment(selectedTicket.id, newComment.trim());
      toast.success("Comment sent.");
      setNewComment("");
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add reply.");
    } finally {
      setCommenting(false);
    }
  };

  const handleSendCommentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text: newComment.trim() }));
      
      // Reset typing indicator state
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setIsTypingState(false);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
      setNewComment("");
    } else {
      // HTTP API Fallback
      await handleAddComment(e);
    }
  };

  const handleCloseTicket = async (ticketId: number) => {
    if (!window.confirm("Are you sure you want to resolve and close this ticket?")) return;
    try {
      const updated = await ticketService.closeTicket(ticketId);
      toast.success(`Ticket ${updated.ticket_code} has been resolved.`);
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updated);
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to close ticket.");
    }
  };

  const handleReopenTicket = async (ticketId: number) => {
    try {
      const updated = await ticketService.reopenTicket(ticketId);
      toast.success(`Ticket ${updated.ticket_code} has been reopened successfully.`);
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updated);
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to reopen ticket.");
    }
  };

  const handleToggleFollowup = async (e: React.MouseEvent, ticketId: number) => {
    e.stopPropagation(); // Prevent opening ticket details
    try {
      const updated = await ticketService.toggleFollowup(ticketId);
      if (updated.needs_followup) {
        toast.success(`Ticket flagged for follow-up.`);
      } else {
        toast.success(`Follow-up flag removed.`);
      }
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(updated);
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
    } catch (err: any) {
      toast.error("Failed to toggle follow-up flag.");
    }
  };

  const canReopen = (tkt: any) => {
    if (tkt.status !== "Closed") return false;
    if (tkt.created_by_code !== currentUser?.user_id) return false;
    if (!tkt.closed_at) return true;
    
    const closedTime = new Date(tkt.closed_at).getTime();
    const now = new Date().getTime();
    const diffHours = (now - closedTime) / (1000 * 60 * 60);
    return diffHours <= 36;
  };

  // Filter list based on tabs & active filters
  const myRaisedTickets = tickets.filter(t => t.created_by_code === currentUser?.user_id);
  const assignedTickets = tickets.filter(t => {
    const isAssignee = t.assigned_to_name === currentUser?.name;
    const isRoleMatched = t.assigned_to_role === currentUser?.role;
    const isAdminProfile = currentUser?.role === "Admin" && t.concern_type === "Profile";
    return isAssignee || isRoleMatched || isAdminProfile;
  });

  // Turn Around Time (TAT) Calculations
  const getTicketAnalytics = () => {
    // Filter analytics calculation based on the active tab's list of tickets
    const activeAnalyticsList = activeTab === "my-tickets" ? myRaisedTickets : assignedTickets;

    const closedTkts = activeAnalyticsList.filter(t => (t.status === "Closed" || t.status === "Final Closed") && t.closed_at);
    let totalTatHours = 0;
    
    closedTkts.forEach(t => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.closed_at).getTime();
      const diffHours = (end - start) / (1000 * 60 * 60);
      totalTatHours += diffHours;
    });

    const avgTat = closedTkts.length > 0 ? (totalTatHours / closedTkts.length) : 0;
    const formattedAvgTat = closedTkts.length > 0 ? formatDuration(avgTat) : "0m";
    
    // Priority counts
    const priorityCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    // Category counts (mapped to standard buckets)
    const categoryCounts: Record<string, number> = { Expense: 0, Profile: 0, "TA/DA": 0, Other: 0 };
    // Status counts
    const statusCounts: Record<string, number> = { Open: 0, "Re-opened": 0, Updated: 0, Closed: 0, "Final Closed": 0 };

    activeAnalyticsList.forEach(t => {
      if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
      
      const normCat = ["Expense", "Profile", "TA/DA"].includes(t.concern_type) ? t.concern_type : "Other";
      if (categoryCounts[normCat] !== undefined) {
        categoryCounts[normCat]++;
      } else {
        categoryCounts["Other"]++;
      }

      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status]++;
      } else {
        statusCounts["Open"]++;
      }
    });

    const categoryChart = [
      { label: "Expense Claims", amount: categoryCounts["Expense"], color: "#3b82f6" },
      { label: "Profile Settings", amount: categoryCounts["Profile"], color: "#ec4899" },
      { label: "TA/DA Allowances", amount: categoryCounts["TA/DA"], color: "#f59e0b" },
      { label: "Other Category", amount: categoryCounts["Other"], color: "#8b5cf6" }
    ];

    const priorityChart = [
      { label: "Low Priority", amount: priorityCounts["Low"], color: "#10b981" },
      { label: "Medium Priority", amount: priorityCounts["Medium"], color: "#6366f1" },
      { label: "High Priority", amount: priorityCounts["High"], color: "#a855f7" },
      { label: "Critical Priority", amount: priorityCounts["Critical"], color: "#ef4444" }
    ];

    const statusChart = [
      { label: "Open Concern", amount: statusCounts["Open"], color: "#eab308" },
      { label: "Re-opened", amount: statusCounts["Re-opened"], color: "#a855f7" },
      { label: "Updated Res", amount: statusCounts["Updated"], color: "#3b82f6" },
      { label: "Closed Resolution", amount: statusCounts["Closed"] + statusCounts["Final Closed"], color: "#22c55e" }
    ];

    return {
      formattedAvgTat,
      closedCount: closedTkts.length,
      openCount: activeAnalyticsList.length - closedTkts.length,
      categoryChart,
      priorityChart,
      statusChart
    };
  };

  const analytics = getTicketAnalytics();

  const baseList = activeTab === "my-tickets" ? myRaisedTickets : assignedTickets;

  // Apply sub-filters
  const filteredList = baseList.filter(tkt => {
    // 1. Follow-up filter
    if (filterFollowup === "flagged" && !tkt.needs_followup) return false;
    if (filterFollowup === "normal" && tkt.needs_followup) return false;

    // 2. Status filter
    if (filterStatus !== "all" && tkt.status !== filterStatus) return false;

    // 3. Category filter
    if (filterCategory !== "all") {
      const normCat = ["Expense", "Profile", "TA/DA"].includes(tkt.concern_type) ? tkt.concern_type : "Other";
      if (filterCategory === "Other" && normCat !== "Other") return false;
      if (filterCategory !== "Other" && tkt.concern_type !== filterCategory) return false;
    }

    return true;
  });

  const getPriorityBadgeClass = (pri: string) => {
    if (pri === "Critical") return "bg-red-50 border-red-200 text-red-700 font-extrabold";
    if (pri === "High") return "bg-purple-50 border-purple-200 text-purple-700 font-bold";
    if (pri === "Medium") return "bg-blue-50 border-blue-200 text-blue-700 font-semibold";
    return "bg-gray-50 border-gray-200 text-gray-500";
  };

  const getStatusBadgeClass = (stat: string) => {
    if (stat === "Open") return "bg-yellow-50 border-yellow-255 text-yellow-700 font-bold";
    if (stat === "Re-opened") return "bg-purple-50 border-purple-200 text-purple-700 font-bold";
    if (stat === "Updated") return "bg-blue-50 border-blue-200 text-blue-700 font-bold";
    if (stat === "Closed") return "bg-green-55 border-green-200 text-green-700 font-bold";
    return "bg-slate-100 border-slate-300 text-slate-500 font-normal text-[9px]"; // Final Closed
  };

  const hasAccessToAssignedTab = currentUser?.role === "Admin" || 
    currentUser?.role === "Manager" || 
    currentUser?.role === "Coordinator" || 
    currentUser?.role === "Division Manager" || 
    currentUser?.role === "Project Head" || 
    currentUser?.role === "VP";

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <i className="fas fa-headset text-blue-600 animate-pulse"></i>
            FieldOps Help Desk
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Log technical concerns, track Turn Around Time (TAT), and manage resolution logs with supervisor mapping.
          </p>
        </div>
        <button
          onClick={fetchInitialData}
          className="px-3 py-1.5 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded border border-gray-300 cursor-pointer flex items-center gap-1.5 self-start transition-all"
        >
          <i className="fas fa-sync-alt"></i>
          Refresh desk
        </button>
      </div>

      {/* Analytics block */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart 1: Category */}
        <div className="card-lte-primary p-4 bg-white shadow-sm">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Category</span>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categoryChart} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 9 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={16}>
                  {analytics.categoryChart.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart 2: Priority */}
        <div className="card-lte-primary p-4 bg-white shadow-sm" style={{ borderTopColor: "#6610f2" }}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Priority</span>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.priorityChart} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 9 }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={16}>
                  {analytics.priorityChart.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart 3: Status */}
        <div className="card-lte-warning p-4 bg-white shadow-sm">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Status</span>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.statusChart} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 9 }} width={85} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={16}>
                  {analytics.statusChart.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Standalone Mobile Tab Selector */}
      <div className="xl:hidden border-b border-gray-250 bg-white p-1 flex rounded-xl gap-1 shadow-xs mb-3">
        <button
          type="button"
          onClick={() => { handleTabChange("my-tickets"); setSelectedTicket(null); }}
          className={`flex-1 py-2 text-center font-bold text-[10px] uppercase rounded-lg border-0 cursor-pointer transition-all ${
            activeTab === "my-tickets"
              ? "bg-[#a5d8e8] text-slate-800 shadow-xs font-extrabold"
              : "bg-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          My Tickets ({myRaisedTickets.length})
        </button>
        <button
          type="button"
          onClick={() => { handleTabChange("raise"); setSelectedTicket(null); }}
          className={`flex-1 py-2 text-center font-bold text-[10px] uppercase rounded-lg border-0 cursor-pointer transition-all ${
            activeTab === "raise"
              ? "bg-[#a5d8e8] text-slate-800 shadow-xs font-extrabold"
              : "bg-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          File Ticket
        </button>
        {hasAccessToAssignedTab && (
          <button
            type="button"
            onClick={() => { handleTabChange("assigned-tickets"); setSelectedTicket(null); }}
            className={`flex-1 py-2 text-center font-bold text-[10px] uppercase rounded-lg border-0 cursor-pointer transition-all ${
              activeTab === "assigned-tickets"
                ? "bg-[#a5d8e8] text-slate-800 shadow-xs font-extrabold"
                : "bg-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Assigned ({assignedTickets.length})
          </button>
        )}
      </div>

      {/* Main Workspace layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left column: Raise ticket Form */}
        <div className={`xl:col-span-1 space-y-6 ${activeTab === "raise" ? "block" : "hidden xl:block"}`}>
                    <div className="card-lte-success p-5 space-y-4 bg-white shadow-sm">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <i className="fas fa-ticket-alt text-green-600"></i>
              File Support Ticket
            </h3>

            <form onSubmit={handleRaiseTicket} className="space-y-4 text-xs font-medium">
              
              {/* Concern type dropdown */}
              <div>
                <label className="label-lte">Concern Field *</label>
                <select
                  value={concernType}
                  onChange={(e) => setConcernType(e.target.value)}
                  className="input-lte focus:border-green-600 focus:ring-green-600/50"
                >
                  <option value="Expense">Expense Claim Reference</option>
                  <option value="TA/DA">TA / DA Allowance Cap</option>
                  <option value="Profile">Profile Mappings</option>
                  <option value="Other">Other / Custom Issue</option>
                </select>
              </div>

              {/* Custom Other category name input */}
              {concernType === "Other" && (
                <div className="animate-fadeIn">
                  <label className="label-lte">Specify custom category *</label>
                  <input
                    type="text"
                    placeholder="e.g. System Crash, Fuel Rates, Sim Card"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    className="input-lte focus:border-green-600 focus:ring-green-600/50"
                    required
                  />
                </div>
              )}

              {/* Select Expense Claim Dropdown (visible only if Expense selected) */}
              {concernType === "Expense" && (
                <div className="animate-fadeIn">
                  <label className="label-lte">Select Claim Reference *</label>
                  <select
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    className="input-lte focus:border-green-600 focus:ring-green-600/50"
                    required
                  >
                    <option value="" disabled>-- Select Related Expense Claim --</option>
                    {myExpenses.map(exp => (
                      <option key={exp.id} value={exp.id}>
                        {exp.expense_code} — {exp.itinerary} (₹{exp.amount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Select Assignee (Manager or Zonal Coordinator) */}
              {concernType !== "Profile" ? (
                <div>
                  <label className="label-lte">Assign Concern Target *</label>
                  <select
                    value={assignedToName}
                    onChange={(e) => setAssignedToName(e.target.value)}
                    className="input-lte focus:border-green-600 focus:ring-green-600/50"
                    required
                  >
                    {currentUser?.manager && (
                      <option value={currentUser.manager}>Reporting Manager: {currentUser.manager}</option>
                    )}
                    {currentUser?.coordinator && (
                      <option value={currentUser.coordinator}>Zonal Coordinator: {currentUser.coordinator}</option>
                    )}
                    {(!currentUser?.manager && !currentUser?.coordinator) && (
                      <option value="Admin System">Admin System</option>
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label-lte">Assign Concern Target</label>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-gray-550 flex items-center gap-1.5 font-bold">
                    <i className="fas fa-lock text-gray-400"></i>
                    Locked to Admin System
                  </div>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="label-lte">Priority Level *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-lte focus:border-green-600 focus:ring-green-600/50"
                >
                  <option value="Low">Low (General Query)</option>
                  <option value="Medium">Medium (Delay/Discrepancy)</option>
                  <option value="High">High (Urgent Action)</option>
                  <option value="Critical">Critical (System Lockout)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="label-lte">Detailed Remarks / Concern Description *</label>
                <textarea
                  rows={3}
                  placeholder="Explain your concern with details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-800 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/50 resize-none font-sans font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={raising}
                className="w-full h-9 rounded bg-[#28a745] hover:bg-[#218838] disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs flex items-center justify-center shadow-sm border-0 transition-all cursor-pointer uppercase tracking-wider"
              >
                {raising ? "Filing support request..." : "Raise Ticket"}
              </button>

            </form>
          </div>

        </div>

        {/* Right column: Filter headers, listing tabs, and chat timeline logs */}
        <div className={`xl:col-span-2 space-y-6 ${activeTab === "raise" ? "hidden xl:block" : "block"}`}>
          
          {/* Support Ticket Listing container */}
          <div className="card-lte flex flex-col bg-white">
                    {/* List Tab Headers */}
            <div className="hidden xl:flex border-b border-gray-200 bg-gray-50 items-center justify-between px-4">
              <div className="flex">
                <button
                  onClick={() => { handleTabChange("my-tickets"); setSelectedTicket(null); }}
                  className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === "my-tickets"
                      ? "border-[#a5d8e8] text-slate-800 bg-[#a5d8e8]/20 font-extrabold"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  My Raised Tickets ({myRaisedTickets.length})
                </button>
                
                {hasAccessToAssignedTab && (
                  <button
                    onClick={() => { handleTabChange("assigned-tickets"); setSelectedTicket(null); }}
                    className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeTab === "assigned-tickets"
                        ? "border-[#a5d8e8] text-slate-800 bg-[#a5d8e8]/20 font-extrabold"
                        : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Assigned Concerns ({assignedTickets.length})
                  </button>
                )}
              </div>
            </div>

            {/* Structured filters block */}
            <div className="p-3 bg-slate-100 border-b border-gray-250 flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase overflow-x-auto whitespace-nowrap scrollbar-none">
              
              {/* Filter Follow-up flag */}
              <div className="flex items-center gap-1.5 shrink-0">
                <i className="fas fa-filter text-gray-400"></i>
                <span className="text-gray-700">Follow-up:</span>
                <select
                  value={filterFollowup}
                  onChange={(e: any) => setFilterFollowup(e.target.value)}
                  className="bg-white border border-gray-300 rounded-none px-2 py-1 text-[10px] text-gray-800 font-black focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Concerns</option>
                  <option value="flagged">Flagged Only</option>
                  <option value="normal">Unflagged Only</option>
                </select>
              </div>

              {/* Filter Status */}
              <div className="flex items-center gap-1.5 border-l border-gray-300 pl-4 shrink-0">
                <span className="text-gray-700">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e: any) => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-300 rounded-none px-2 py-1 text-[10px] text-gray-800 font-black focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Re-opened">Re-opened</option>
                  <option value="Updated">Updated</option>
                  <option value="Closed">Closed</option>
                  <option value="Final Closed">Final Closed</option>
                </select>
              </div>

              {/* Filter Category */}
              <div className="flex items-center gap-1.5 border-l border-gray-300 pl-4 shrink-0">
                <span className="text-gray-700">Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e: any) => setFilterCategory(e.target.value)}
                  className="bg-white border border-gray-300 rounded-none px-2 py-1 text-[10px] text-gray-800 font-black focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Categories</option>
                  <option value="Expense">Expense</option>
                  <option value="TA/DA">TA / DA</option>
                  <option value="Profile">Profile</option>
                  <option value="Other">Other Category</option>
                </select>
              </div>

            </div>

            {/* Content List */}
            {loading ? (
              <div className="p-12 text-center">
                <Loader message="Loading support desk..." />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-xs">
                <i className="fas fa-exclamation-circle fa-2x mx-auto mb-2 text-gray-300 animate-pulse"></i>
                <p className="font-bold uppercase tracking-wider text-[10px]">No support concerns matched these filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto">
                {filteredList.map(tkt => {
                  const isSelected = selectedTicket && selectedTicket.id === tkt.id;
                  
                  return (
                    <div 
                      key={tkt.id} 
                      onClick={() => setSelectedTicket(tkt)}
                      className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-[3px] ${
                        isSelected 
                          ? "bg-blue-50/10 border-l-blue-600" 
                          : "bg-white hover:bg-gray-50 border-l-transparent"
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          {/* Followup star flag button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFollowup(e, tkt.id)}
                            className="p-0.5 hover:bg-gray-100 rounded border-0 bg-transparent cursor-pointer"
                            title="Toggle follow-up flag"
                          >
                            <i className={`fas fa-bookmark text-xs transition-all ${
                              tkt.needs_followup ? "text-amber-500" : "text-gray-300"
                            }`}></i>
                          </button>
                          
                          <span className="font-mono font-bold text-blue-600 uppercase tracking-wider">{tkt.ticket_code}</span>
                          <span className="font-bold text-gray-300">•</span>
                          <span className="font-bold text-gray-600 uppercase bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-[8px]">{tkt.concern_type}</span>
                          <span className="font-bold text-gray-300">•</span>
                          <span className="text-gray-400 font-semibold">{new Date(tkt.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <h4 className="text-xs font-bold text-gray-800 truncate pr-6 font-sans" title={tkt.description}>
                          {tkt.description}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2 text-[9px] text-gray-500 font-bold uppercase">
                          <span>By: {tkt.created_by_name} ({tkt.created_by_code})</span>
                          <span>•</span>
                          <span>Assigned To: {tkt.assigned_to_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] uppercase tracking-wider ${getPriorityBadgeClass(tkt.priority)}`}>
                          {tkt.priority}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] uppercase tracking-wider ${getStatusBadgeClass(tkt.status)}`}>
                          {tkt.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ticket Thread detail panel */}
          {selectedTicket && (
            isMobile ? (
              <div className="fixed inset-0 bg-black/60 z-[2000] flex items-end justify-center animate-fadeIn" onClick={() => setSelectedTicket(null)}>
                <div className="bg-white rounded-t-[24px] w-full max-h-[90vh] flex flex-col shadow-xl animate-slideUp text-xs overflow-hidden" onClick={e => e.stopPropagation()}>
                  
                  {/* Top Drag Handle Indicator */}
                  <div className="w-12 h-1.5 bg-gray-350 rounded-full mx-auto my-3 cursor-pointer" onClick={() => setSelectedTicket(null)}></div>
                  
                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-4 text-left">
                    {/* Detail Header */}
                    <div className="flex items-start justify-between border-b border-gray-150 pb-3 pt-1">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-955 font-mono flex items-center gap-1.5">
                            {selectedTicket.ticket_code}
                            <i className={`fas fa-bookmark text-xs ${
                              selectedTicket.needs_followup ? "text-amber-500" : "text-gray-300"
                            }`}></i>
                          </h3>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          Category: <span className="text-indigo-650">{selectedTicket.concern_type}</span>
                          {selectedTicket.expense_code && ` (Claim Code: ${selectedTicket.expense_code})`}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {["Open", "Updated", "Re-opened"].includes(selectedTicket.status) && (
                          <button
                            onClick={() => handleCloseTicket(selectedTicket.id)}
                            className="bg-red-650 hover:bg-red-700 text-white px-2.5 py-1 text-[9px] min-h-0 uppercase tracking-wider font-extrabold flex items-center gap-1 border-0 rounded cursor-pointer"
                          >
                            <i className="fas fa-check-circle"></i> Resolve
                          </button>
                        )}
                        {canReopen(selectedTicket) && (
                          <button
                            onClick={() => handleReopenTicket(selectedTicket.id)}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 text-[9px] min-h-0 uppercase tracking-wider font-extrabold flex items-center gap-1 border-0 rounded cursor-pointer"
                          >
                            <i className="fas fa-undo"></i> Reopen
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTicket(null)}
                          className="bg-gray-100 hover:bg-gray-250 border border-gray-300 text-gray-700 font-extrabold px-2.5 py-1 text-[9px] rounded uppercase tracking-wider cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Status and Priority Info Cards */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 border border-gray-150 rounded-lg bg-gray-50/50">
                        <span className="text-gray-400 block font-bold uppercase text-[8px] tracking-wider mb-0.5">Status</span>
                        <span className={`inline-block px-2 py-0.5 rounded border ${getStatusBadgeClass(selectedTicket.status)}`}>
                          {selectedTicket.status}
                        </span>
                      </div>
                      <div className="p-2 border border-gray-150 rounded-lg bg-gray-50/50">
                        <span className="text-gray-450 block font-bold uppercase text-[8px] tracking-wider mb-0.5">Priority</span>
                        <span className={`inline-block px-2 py-0.5 rounded border ${getPriorityBadgeClass(selectedTicket.priority)}`}>
                          {selectedTicket.priority}
                        </span>
                      </div>
                    </div>

                    {/* Ticket Description / Remarks */}
                    <div className="bg-gray-50 border border-gray-150 rounded-xl p-3">
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Issue Description</span>
                      <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </p>
                      {selectedTicket.closed_at && (
                        <div className="mt-2.5 pt-2 border-t border-gray-150 flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase">
                          <span>Resolved In:</span>
                          <span className="font-mono text-indigo-650">
                            {formatDuration((new Date(selectedTicket.closed_at).getTime() - new Date(selectedTicket.created_at).getTime()) / (1000 * 60 * 60))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Discussion logs */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Discussion Logs & Updates</h4>
                        <span className="text-[9px] font-bold text-gray-400 uppercase select-none">💬 Live Chat</span>
                      </div>
                      
                      <div 
                        className="rounded-lg p-4 min-h-[220px] max-h-[320px] overflow-y-auto flex flex-col gap-3 relative shadow-inner border border-gray-250"
                        style={{
                          backgroundColor: "#efeae2",
                          backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 1px)",
                          backgroundSize: "16px 16px"
                        }}
                      >
                        {!selectedTicket.comments || !selectedTicket.comments.trim() ? (
                          <div className="my-auto text-center py-6 text-gray-450 font-bold uppercase text-[9px] tracking-wider">
                            No log comments recorded
                          </div>
                        ) : (
                          selectedTicket.comments.split("\n").map((cmt: string, cIdx: number) => {
                            if (!cmt.trim()) return null;
                            const isSystem = cmt.startsWith("[SYSTEM]");
                            const isEmployee = cmt.startsWith("[EMPLOYEE]");
                            const cleanText = cmt.replace(/^\[SYSTEM\]\s*|^\[EMPLOYEE\]\s*/, "");
                            return (
                              <div
                                key={cIdx}
                                className={`p-2 rounded-lg text-xs leading-normal border shadow-2xs ${
                                  isSystem
                                    ? "bg-amber-50/60 border-amber-100/70 text-gray-700"
                                    : isEmployee
                                    ? "bg-indigo-50/60 border-indigo-100/70 text-indigo-950"
                                    : "bg-white border-gray-150 text-gray-800"
                                }`}
                              >
                                <p className="font-medium whitespace-pre-wrap">{cleanText}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Chat Reply Form */}
                    {selectedTicket.status !== "Final Closed" && (
                      <div className="pt-2 border-t border-gray-100 pb-20">
                        <form onSubmit={handleSendCommentMessage} className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-full border border-gray-200">
                          <input
                            type="text"
                            placeholder={selectedTicket.status === "Closed" ? "Ticket is closed. Reopen to chat..." : "Type reply message..."}
                            value={newComment}
                            onChange={(e) => handleInputChange(e.target.value)}
                            disabled={selectedTicket.status === "Closed" || commenting}
                            className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium h-9"
                            required
                          />
                          <button
                            type="submit"
                            disabled={selectedTicket.status === "Closed" || commenting || !newComment.trim()}
                            className="h-9 w-9 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-full flex items-center justify-center shadow-md shrink-0 border-0 transition-colors cursor-pointer"
                            title="Send message"
                          >
                            <i className="fas fa-paper-plane text-xs"></i>
                          </button>
                        </form>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            ) : (
              <div className="card-lte-primary p-5 space-y-4 bg-white shadow-md animate-scaleIn text-xs">
                
                {/* Detail Header */}
                <div className="flex items-start justify-between border-b border-gray-150 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-955 font-mono flex items-center gap-1.5">
                        {selectedTicket.ticket_code}
                        <i className={`fas fa-bookmark text-xs ${
                          selectedTicket.needs_followup ? "text-amber-500" : "text-gray-300"
                        }`}></i>
                      </h3>
                      
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[8px] uppercase font-bold tracking-wider ${getStatusBadgeClass(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-gray-550 font-bold uppercase">
                      Category: <span className="text-gray-800">{selectedTicket.concern_type}</span>
                      {selectedTicket.expense_code && ` (Claim Code: ${selectedTicket.expense_code})`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Close ticket button */}
                    {["Open", "Updated", "Re-opened"].includes(selectedTicket.status) && (
                      <button
                        onClick={() => handleCloseTicket(selectedTicket.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer border-0 shadow-sm transition-colors flex items-center gap-1"
                      >
                        <i className="fas fa-check-circle"></i>
                        Resolve Concern
                      </button>
                    )}

                    {/* Re-open ticket button */}
                    {canReopen(selectedTicket) && (
                      <button
                        onClick={() => handleReopenTicket(selectedTicket.id)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer border-0 shadow-sm transition-colors flex items-center gap-1"
                      >
                        <i className="fas fa-redo fa-spin-slow"></i>
                        Re-open (36h limit)
                      </button>
                    )}
                  </div>
                </div>

                {/* Concern details card */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded text-xs space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase">
                    <span>Concern remarks</span>
                    <span className={selectedTicket.priority === "Critical" ? "text-red-600 font-black" : ""}>Priority: {selectedTicket.priority}</span>
                  </div>
                  <p className="text-gray-700 font-bold leading-relaxed">
                    {selectedTicket.description}
                  </p>

                  {/* Show individual TAT if closed */}
                  {selectedTicket.closed_at && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 flex items-center gap-1.5 text-[9px] text-gray-400 font-bold uppercase">
                      <i className="fas fa-clock text-gray-450"></i>
                      <span>Resolution TAT:</span>
                      <span className="text-blue-700 font-mono">
                        {formatDuration(
                          (new Date(selectedTicket.closed_at).getTime() - new Date(selectedTicket.created_at).getTime()) / (1000 * 60 * 60)
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Discussion logs */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Discussion Logs & Updates</h4>
                    <span className="text-[9px] font-bold text-gray-400 uppercase select-none">💬 Live Chat</span>
                  </div>
                  
                  <div 
                    className="rounded-lg p-4 min-h-[320px] max-h-[420px] overflow-y-auto flex flex-col gap-3 relative shadow-inner border border-gray-250"
                    style={{
                      backgroundColor: "#efeae2",
                      backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 1px)",
                      backgroundSize: "16px 16px"
                    }}
                  >
                    {!selectedTicket.comments || !selectedTicket.comments.trim() ? (
                      <div className="my-auto text-center py-6 text-gray-450 font-bold uppercase text-[10px] tracking-wider select-none bg-white/70 rounded p-4 mx-4 shadow-sm border border-gray-200">
                        No replies logged yet. Type a message below to start the discussion thread.
                      </div>
                    ) : (
                      selectedTicket.comments.split("\n").map((cmt: string, cIdx: number) => {
                        if (!cmt.trim()) return null;
                        
                        const openParenIdx = cmt.indexOf(" (");
                        const closeParenIdx = cmt.indexOf("): ");
                        let senderName = "System";
                        let dateTime = "";
                        let content = cmt;

                        if (openParenIdx !== -1 && closeParenIdx !== -1 && openParenIdx < closeParenIdx) {
                          senderName = cmt.substring(0, openParenIdx).trim();
                          const rawTime = cmt.substring(openParenIdx + 2, closeParenIdx).trim();
                          content = cmt.substring(closeParenIdx + 3).trim();
                          
                          try {
                            dateTime = formatDateTime(rawTime);
                          } catch (e) {
                            dateTime = rawTime;
                          }
                        }
                        
                        const isSystem = senderName === "System" || cmt.startsWith("System:") || !cmt.includes("): ");
                        if (isSystem) {
                          return (
                            <div key={cIdx} className="flex justify-center my-1">
                              <span className="bg-white/90 border border-gray-200/60 text-gray-500 text-[9px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-2xs select-none">
                                {content}
                              </span>
                            </div>
                          );
                        }

                        const isOwn = senderName.toLowerCase() === currentUser?.name?.toLowerCase() || 
                                      senderName.toLowerCase().startsWith(currentUser?.name?.toLowerCase().substring(0, 5));

                        return (
                          <div key={cIdx} className={`flex w-full ${isOwn ? "justify-end" : "justify-start"}`}>
                            <div 
                              className={`px-3 py-2 rounded-lg max-w-[85%] sm:max-w-[70%] shadow-xs relative flex flex-col gap-0.5 ${
                                isOwn 
                                  ? "bg-[#d9fdd3] text-gray-800 rounded-tr-none border border-[#c1e9bb]" 
                                  : "bg-white text-gray-800 rounded-tl-none border border-gray-200"
                              }`}
                            >
                              {!isOwn && (
                                <span className="font-extrabold text-[10px] text-green-600 block leading-none select-none">
                                  {senderName}
                                </span>
                              )}
                              <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap text-gray-850 break-words">
                                {content}
                              </p>
                              <span className="text-[8px] text-gray-400 font-bold select-none text-right block leading-none mt-1">
                                {dateTime} {isOwn && <span className="text-blue-500 ml-0.5">✓✓</span>}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {typingUser && (
                    <div className="px-4 py-1 text-[10px] text-gray-500 italic bg-[#efeae2] border-t border-gray-200 shrink-0 text-left font-semibold">
                      {typingUser} is typing...
                    </div>
                  )}

                  {/* Input area (WhatsApp style) */}
                  <form onSubmit={handleAddComment} className="flex items-center gap-2 p-3 bg-[#f0f2f5] border-t border-gray-200 shrink-0">
                    <input
                      type="text"
                      placeholder={selectedTicket.status === "Closed" ? "This ticket is closed" : "Type a reply..."}
                      value={newComment}
                      onChange={(e) => handleInputChange(e.target.value)}
                      disabled={selectedTicket.status === "Closed" || commenting}
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none font-medium h-9"
                      required
                    />
                    <button
                      type="submit"
                      disabled={selectedTicket.status === "Closed" || commenting || !newComment.trim()}
                      className="h-9 w-9 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-full flex items-center justify-center shadow-md shrink-0 border-0 transition-colors cursor-pointer"
                      title="Send message"
                    >
                      <i className="fas fa-paper-plane text-xs"></i>
                    </button>
                  </form>
                </div>
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
