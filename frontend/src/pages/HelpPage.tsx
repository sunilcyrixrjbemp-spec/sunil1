import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  AlertCircle, 
  Send, 
  RefreshCw, 
  Lock,
  Bookmark,
  Filter,
  Clock,
  Activity,
  CheckCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { ticketService, TicketCreatePayload } from "../services/ticketService";
import { expenseService } from "../services/expenseService";
import Loader from "../components/common/Loader";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

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

export default function HelpPage() {

  // Auth User
  const [currentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });

  // Data states
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
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
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
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh desk
        </button>
      </div>      {/* Analytics block */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart 1: Category */}
        <div className="bg-white border border-gray-200 border-t-4 border-t-blue-600 rounded shadow-sm p-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Category</span>
          <div style={{ height: 160 }} className="relative flex justify-center items-center">
            <Bar
              data={{
                labels: analytics.categoryChart.map(c => c.label),
                datasets: [
                  {
                    label: 'Concerns',
                    data: analytics.categoryChart.map(c => c.amount),
                    backgroundColor: '#2f5bb7',
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                indexAxis: 'y' as const,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { ticks: { font: { size: 9 } }, grid: { display: false } },
                  y: { ticks: { font: { size: 9 } }, grid: { display: false } }
                }
              }}
            />
          </div>
        </div>

        {/* Bar Chart 2: Priority */}
        <div className="bg-white border border-gray-200 border-t-4 border-t-indigo-600 rounded shadow-sm p-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Priority</span>
          <div style={{ height: 160 }} className="relative flex justify-center items-center">
            <Bar
              data={{
                labels: analytics.priorityChart.map(c => c.label),
                datasets: [
                  {
                    label: 'Concerns',
                    data: analytics.priorityChart.map(c => c.amount),
                    backgroundColor: '#854aa5',
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                indexAxis: 'y' as const,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { ticks: { font: { size: 9 } }, grid: { display: false } },
                  y: { ticks: { font: { size: 9 } }, grid: { display: false } }
                }
              }}
            />
          </div>
        </div>

        {/* Bar Chart 3: Status */}
        <div className="bg-white border border-gray-200 border-t-4 border-t-amber-500 rounded shadow-sm p-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5 mb-2">Concerns by Status</span>
          <div style={{ height: 160 }} className="relative flex justify-center items-center">
            <Bar
              data={{
                labels: analytics.statusChart.map(c => c.label),
                datasets: [
                  {
                    label: 'Concerns',
                    data: analytics.statusChart.map(c => c.amount),
                    backgroundColor: '#d28b2a',
                    borderRadius: 4
                  }
                ]
              }}
              options={{
                indexAxis: 'y' as const,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { ticks: { font: { size: 9 } }, grid: { display: false } },
                  y: { ticks: { font: { size: 9 } }, grid: { display: false } }
                }
              }}
            />
          </div>
        </div>

      </div>

      {/* Main Workspace layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left column: Raise ticket Form */}
        <div className="xl:col-span-1 space-y-6">
          
          <div className="bg-white border border-gray-200 border-t-4 border-t-green-600 rounded shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-green-600" />
              File support Ticket
            </h3>

            <form onSubmit={handleRaiseTicket} className="space-y-4 text-xs font-medium">
              
              {/* Concern type dropdown */}
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Concern Field *</label>
                <select
                  value={concernType}
                  onChange={(e) => setConcernType(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-green-600"
                >
                  <option value="Expense">Expense Claim Claim Reference</option>
                  <option value="TA/DA">TA / DA Allowance Cap</option>
                  <option value="Profile">Profile Mappings</option>
                  <option value="Other">Other / Custom Issue</option>
                </select>
              </div>

              {/* Custom Other category name input */}
              {concernType === "Other" && (
                <div className="animate-fadeIn">
                  <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Specify custom category *</label>
                  <input
                    type="text"
                    placeholder="e.g. System Crash, Fuel Rates, Sim Card"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-green-600"
                    required
                  />
                </div>
              )}

              {/* Select Expense Claim Dropdown (visible only if Expense selected) */}
              {concernType === "Expense" && (
                <div className="animate-fadeIn">
                  <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Select Claim Reference *</label>
                  <select
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-855 focus:outline-none focus:border-green-600"
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
                  <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Assign Concern Target *</label>
                  <select
                    value={assignedToName}
                    onChange={(e) => setAssignedToName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-850 focus:outline-none focus:border-green-600"
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
                  <label className="block text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-1">Assign Concern Target</label>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-gray-550 flex items-center gap-1.5 font-bold">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    Locked to Admin System
                  </div>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Priority Level *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-855 focus:outline-none focus:border-green-600"
                >
                  <option value="Low">Low (General Query)</option>
                  <option value="Medium">Medium (Delay/Discrepancy)</option>
                  <option value="High">High (Urgent Action)</option>
                  <option value="Critical">Critical (System Lockout)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Detailed Remarks / Concern Description *</label>
                <textarea
                  rows={3}
                  placeholder="Explain your concern with details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-850 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600/20 resize-none font-sans font-medium"
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
        <div className="xl:col-span-2 space-y-6">
          
          {/* Support Ticket Listing container */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
            
            {/* List Tab Headers */}
            <div className="border-b border-gray-250 bg-gray-50 flex flex-wrap items-center justify-between px-4">
              <div className="flex">
                <button
                  onClick={() => { handleTabChange("my-tickets"); setSelectedTicket(null); }}
                  className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === "my-tickets"
                      ? "border-blue-600 text-blue-700 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  My Raised Tickets ({myRaisedTickets.length})
                </button>
                
                {hasAccessToAssignedTab && (
                  <button
                    onClick={() => { handleTabChange("assigned-tickets"); setSelectedTicket(null); }}
                    className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      activeTab === "assigned-tickets"
                        ? "border-blue-600 text-blue-700 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Assigned concerns ({assignedTickets.length})
                  </button>
                )}
              </div>
            </div>

            {/* Structured filters block */}
            <div className="p-3 bg-gray-50/50 border-b border-gray-200 flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-500 uppercase">
              
              {/* Filter Follow-up flag */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span>Follow-up:</span>
                <select
                  value={filterFollowup}
                  onChange={(e: any) => setFilterFollowup(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[10px] text-gray-700 font-bold focus:outline-none"
                >
                  <option value="all">All Concerns</option>
                  <option value="flagged">Flagged Only</option>
                  <option value="normal">Unflagged Only</option>
                </select>
              </div>

              {/* Filter Status */}
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                <span>Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e: any) => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[10px] text-gray-700 font-bold focus:outline-none"
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
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                <span>Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e: any) => setFilterCategory(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[10px] text-gray-700 font-bold focus:outline-none"
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
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300 animate-pulse" />
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
                          ? "bg-blue-50/20 border-l-blue-600" 
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
                            <Bookmark className={`w-3.5 h-3.5 transition-all ${
                              tkt.needs_followup ? "fill-amber-400 text-amber-500" : "text-gray-300"
                            }`} />
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
            <div className="bg-white border border-gray-200 border-t-3 border-t-blue-600 rounded shadow-sm p-5 space-y-4 animate-scaleIn text-xs">
              
              {/* Detail Header */}
              <div className="flex items-start justify-between border-b border-gray-150 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 font-mono flex items-center gap-1">
                      {selectedTicket.ticket_code}
                      <Bookmark className={`w-3.5 h-3.5 inline ${
                        selectedTicket.needs_followup ? "fill-amber-400 text-amber-500" : "text-gray-300"
                      }`} />
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
                      <CheckCircle className="w-3.5 h-3.5" />
                      Resolve Concern
                    </button>
                  )}

                  {/* Re-open ticket button */}
                  {canReopen(selectedTicket) && (
                    <button
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer border-0 shadow-sm transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 animate-spin-slow" />
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
                    <Clock className="w-3.5 h-3.5 text-gray-450" />
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
                    <div className="text-center my-auto py-10 text-gray-500 font-bold uppercase text-[9px] tracking-wider select-none bg-white/70 rounded p-4 mx-4 shadow-sm border border-gray-200">
                      No replies logged yet. Type a message below to start the discussion thread.
                    </div>
                  ) : (
                    selectedTicket.comments.split("\n").map((cmt: string, cIdx: number) => {
                      if (!cmt.trim()) return null;
                      
                      // Bulletproof separator for Sender name and Timestamp
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
              </div>

              {/* Comment reply form */}
              {selectedTicket.status !== "Final Closed" && (
                <div className="space-y-1">
                  {typingUser && (
                    <div className="text-[10px] text-green-600 italic font-bold pl-2 flex items-center gap-1.5 animate-pulse select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-ping"></span>
                      {typingUser} is typing...
                    </div>
                  )}

                  <form onSubmit={handleSendCommentMessage} className="flex gap-2 items-center bg-gray-100 p-2 rounded-lg border border-gray-200">
                    <input
                      type="text"
                      placeholder={selectedTicket.status === "Closed" ? "Ticket is closed. Reopen to chat..." : "Type reply message..."}
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
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
