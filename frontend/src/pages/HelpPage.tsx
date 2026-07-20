import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { 
  Card, 
  Button, 
  Input, 
  Tag, 
  Row, 
  Col, 
  Typography, 
  Segmented, 
  Spin, 
  Empty, 
  Drawer
} from "antd";
import { 
  ReloadOutlined, 
  PlusOutlined, 
  MessageOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  SendOutlined, 
  StarOutlined,
  StarFilled,
  LockOutlined, 
  UndoOutlined, 
  CustomerServiceOutlined,
  TagOutlined,
  FilterOutlined
} from "@ant-design/icons";
import { ticketService, TicketCreatePayload } from "../services/ticketService";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import { ResponsiveBar } from "@nivo/bar";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const GALLERY_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#ec4899"];

// Helper to format date strings to user-friendly local browser dates
function formatDateTime(dateVal: any) {
  if (!dateVal) return "—";
  try {
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

// Helper to ensure clean CYR-RJ-0000001 sequence formatting
function getFormattedTicketCode(tkt: any): string {
  if (!tkt) return "CYR-RJ-0000001";
  if (tkt.ticket_code && tkt.ticket_code.startsWith("CYR-RJ-")) return tkt.ticket_code;
  if (tkt.ticketCode && tkt.ticketCode.startsWith("CYR-RJ-")) return tkt.ticketCode;
  const num = tkt.id || 1;
  return `CYR-RJ-${String(num).padStart(7, "0")}`;
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

    let apiHost = (api.defaults.baseURL || "").replace(/\/api$/, "").replace(/^https?:\/\//, "");
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

  const [refreshing, setRefreshing] = useState(false);

  const fetchInitialData = async () => {
    const currentUserId = currentUser?.user_id || "Admin";
    const hasCache = !!localStorage.getItem(`cache_support_tickets_${currentUserId}`);
    if (!hasCache && tickets.length === 0) {
      setLoading(true);
    }
    try {
      const [ticketList, expenseList] = await Promise.all([
        ticketService.getTickets(),
        currentUser ? expenseService.getExpenses() : Promise.resolve([])
      ]);
      if (Array.isArray(ticketList)) {
        setTickets(ticketList);
        localStorage.setItem(`cache_support_tickets_${currentUserId}`, JSON.stringify(ticketList));
      }
      if (Array.isArray(expenseList)) {
        setMyExpenses(expenseList);
        if (currentUser) {
          localStorage.setItem(`cache_my_expenses_${currentUserId}`, JSON.stringify(expenseList));
        }
      }
    } catch (e) {
      console.error("Failed to load help center tickets", e);
      if (!hasCache && tickets.length === 0) {
        toast.error("Failed to load support tickets.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const currentUserId = currentUser?.user_id || "Admin";
    try {
      const [ticketList, expenseList] = await Promise.all([
        ticketService.getTickets(),
        currentUser ? expenseService.getExpenses() : Promise.resolve([])
      ]);
      if (Array.isArray(ticketList)) {
        setTickets(ticketList);
        localStorage.setItem(`cache_support_tickets_${currentUserId}`, JSON.stringify(ticketList));
      }
      if (Array.isArray(expenseList)) {
        setMyExpenses(expenseList);
        if (currentUser) {
          localStorage.setItem(`cache_my_expenses_${currentUserId}`, JSON.stringify(expenseList));
        }
      }
      toast.success("Support tickets refreshed!");
    } catch (e) {
      toast.error("Failed to refresh support tickets.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Real-time instant message sync (auto-poll every 2.5s)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const freshList = await ticketService.getTickets();
        if (Array.isArray(freshList) && freshList.length > 0) {
          setTickets(freshList);
          const currentUid = currentUser?.user_id || "Admin";
          localStorage.setItem(`cache_support_tickets_${currentUid}`, JSON.stringify(freshList));

          setSelectedTicket((currentSel: any) => {
            if (!currentSel || !currentSel.id) return currentSel;
            const updated = freshList.find((t: any) => t.id === currentSel.id);
            if (updated && (updated.comments !== currentSel.comments || updated.status !== currentSel.status)) {
              return updated;
            }
            return currentSel;
          });
        }
      } catch (err) {
        // silent sync
      }
    }, 2500);

    return () => clearInterval(syncInterval);
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
      const codeStr = newTkt.ticket_code || newTkt.ticketCode || "CYR-RJ-0000001";
      toast.success(`Support ticket raised successfully! ID: ${codeStr}`);
      
      // Reset form
      setDescription("");
      setSelectedExpenseId("");
      setOtherCategory("");
      
      // Reload tickets
      const updated = await ticketService.getTickets();
      if (Array.isArray(updated)) {
        setTickets(updated);
        const uid = currentUser?.user_id || "Admin";
        localStorage.setItem(`cache_support_tickets_${uid}`, JSON.stringify(updated));
      }
      setActiveTab("my-tickets");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || "Failed to raise support ticket.");
    } finally {
      setRaising(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    const commentText = newComment.trim();
    setNewComment("");
    setCommenting(true);

    // Optimistic UI update (0ms latency for sender)
    const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const nowStr = new Date().toLocaleString('en-GB', dateOptions).replace(/,/g, '');
    const myName = currentUser?.name || "User";
    const optimisticLine = `${myName} (${nowStr}): ${commentText}`;

    setSelectedTicket((prev: any) => {
      if (!prev) return prev;
      const existing = prev.comments || "";
      const newComms = existing ? `${existing}\n${optimisticLine}` : optimisticLine;
      return { ...prev, comments: newComms };
    });

    try {
      const updated = await ticketService.addComment(selectedTicket.id, commentText);
      if (updated && updated.id) {
        setSelectedTicket(updated);
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || "Failed to send comment.");
      fetchInitialData();
    } finally {
      setCommenting(false);
    }
  };

  const handleSendCommentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text: newComment.trim() }));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setIsTypingState(false);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
    }

    await handleAddComment(e);
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
    e.stopPropagation();
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

  const myRaisedTickets = tickets.filter(t => 
    (t.created_by_code || t.createdByCode) === currentUser?.user_id ||
    (t.created_by_id || t.createdById) === currentUser?.id ||
    (t.created_by_name || t.createdByName) === currentUser?.name
  );
  const assignedTickets = tickets.filter(t => {
    const aName = t.assigned_to_name || t.assignedToName;
    const aRole = t.assigned_to_role || t.assignedToRole;
    const cType = t.concern_type || t.concernType;
    const isAssignee = aName === currentUser?.name;
    const isRoleMatched = aRole === currentUser?.role;
    const isAdminProfile = currentUser?.role === "Admin" && cType === "Profile";
    return isAssignee || isRoleMatched || isAdminProfile;
  });

  const getTicketAnalytics = () => {
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
    
    const priorityCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    const categoryCounts: Record<string, number> = { Expense: 0, Profile: 0, "TA/DA": 0, Other: 0 };
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
      { label: "Expense Claims", amount: categoryCounts["Expense"], color: "#4f46e5" },
      { label: "Profile Settings", amount: categoryCounts["Profile"], color: "#ec4899" },
      { label: "TA/DA Allowances", amount: categoryCounts["TA/DA"], color: "#f59e0b" },
      { label: "Other Category", amount: categoryCounts["Other"], color: "#8b5cf6" }
    ];

    const priorityChart = [
      { label: "Low Priority", amount: priorityCounts["Low"], color: "#10b981" },
      { label: "Medium Priority", amount: priorityCounts["Medium"], color: "#6366f1" },
      { label: "High Priority", amount: priorityCounts["High"], color: "#a855f7" },
      { label: "Critical Priority", amount: priorityCounts["Critical"], color: "#f43f5e" }
    ];

    const statusChart = [
      { label: "Open Concern", amount: statusCounts["Open"], color: "#eab308" },
      { label: "Re-opened", amount: statusCounts["Re-opened"], color: "#a855f7" },
      { label: "Updated Res", amount: statusCounts["Updated"], color: "#3b82f6" },
      { label: "Closed Resolution", amount: statusCounts["Closed"] + statusCounts["Final Closed"], color: "#10b981" }
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

  const filteredList = baseList.filter(tkt => {
    if (filterFollowup === "flagged" && !tkt.needs_followup) return false;
    if (filterFollowup === "normal" && tkt.needs_followup) return false;
    if (filterStatus !== "all" && tkt.status !== filterStatus) return false;
    if (filterCategory !== "all") {
      const normCat = ["Expense", "Profile", "TA/DA"].includes(tkt.concern_type) ? tkt.concern_type : "Other";
      if (filterCategory === "Other" && normCat !== "Other") return false;
      if (filterCategory !== "Other" && tkt.concern_type !== filterCategory) return false;
    }
    return true;
  });

  const getPriorityBadge = (pri: string) => {
    if (pri === "Critical" || pri === "Urgent") {
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-rose-100 text-rose-700 border border-rose-300">🔥 Critical</span>;
    }
    if (pri === "High") {
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-orange-100 text-orange-700 border border-orange-300">⚡ High</span>;
    }
    if (pri === "Medium") {
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-100 text-amber-700 border border-amber-300">⚖️ Medium</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-slate-100 text-slate-700 border border-slate-300">🔹 Low</span>;
  };

  const getStatusBadge = (stat: string) => {
    if (stat === "Open") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-500 text-white shadow-xs">🟡 Open</span>;
    }
    if (stat === "Updated" || stat === "In Progress") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-600 text-white shadow-xs">🔵 In Progress</span>;
    }
    if (stat === "Re-opened") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-purple-600 text-white shadow-xs">🟣 Re-opened</span>;
    }
    if (stat === "Closed" || stat === "Final Closed") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-600 text-white shadow-xs">🟢 Resolved</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-slate-600 text-white">{stat}</span>;
  };

  const getCardTopStatusBorder = (status: string) => {
    if (status === "Closed" || status === "Final Closed") {
      return "border-slate-200/90 border-t-4 border-t-emerald-600 shadow-xs hover:border-emerald-400";
    }
    if (status === "Updated" || status === "In Progress") {
      return "border-slate-200/90 border-t-4 border-t-blue-600 shadow-xs hover:border-blue-400";
    }
    if (status === "Re-opened") {
      return "border-slate-200/90 border-t-4 border-t-purple-600 shadow-xs hover:border-purple-400";
    }
    return "border-slate-200/90 border-t-4 border-t-amber-500 shadow-xs hover:border-amber-400";
  };

  const hasAccessToAssignedTab = currentUser?.role === "Admin" || 
    currentUser?.role === "Manager" || 
    currentUser?.role === "Coordinator" || 
    currentUser?.role === "Division Manager" || 
    currentUser?.role === "Project Head" || 
    currentUser?.role === "VP";

  // Detail View Content block (used in side panel for desktop & drawer for mobile)
  const renderTicketDetail = () => {
    if (!selectedTicket) return null;
    const ticketCodeStr = getFormattedTicketCode(selectedTicket);
    const categoryName = selectedTicket.concern_type || selectedTicket.concernType || "General";
    const claimCodeStr = selectedTicket.expense_code || selectedTicket.expenseCode;

    return (
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-lg text-slate-900 bg-slate-100 px-2.5 py-1 border border-slate-300 shadow-2xs">
                {ticketCodeStr}
              </span>
              <button
                type="button"
                onClick={(e) => handleToggleFollowup(e, selectedTicket.id)}
                className="bg-transparent border-0 cursor-pointer p-1"
                title="Toggle Follow-up Star"
              >
                {(selectedTicket.needs_followup || selectedTicket.needsFollowup) ? (
                  <StarFilled className="text-amber-500 text-lg" />
                ) : (
                  <StarOutlined className="text-slate-300 hover:text-amber-500 text-lg transition-colors" />
                )}
              </button>
              {getStatusBadge(selectedTicket.status)}
              {getPriorityBadge(selectedTicket.priority)}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Category: <span className="text-indigo-600 font-extrabold">{categoryName}</span></span>
              {claimCodeStr && (
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 font-mono text-[11px] border border-indigo-200 font-extrabold">
                  Claim: {claimCodeStr}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {["Open", "Updated", "Re-opened"].includes(selectedTicket.status) && (
              <Button
                type="primary"
                danger
                size="middle"
                icon={<CheckCircleOutlined />}
                onClick={() => handleCloseTicket(selectedTicket.id)}
                className="font-extrabold text-xs uppercase tracking-wider rounded-none shadow-xs"
              >
                Resolve Ticket
              </Button>
            )}
            {canReopen(selectedTicket) && (
              <Button
                type="default"
                size="middle"
                icon={<UndoOutlined />}
                onClick={() => handleReopenTicket(selectedTicket.id)}
                className="font-extrabold text-xs border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-none"
              >
                Reopen Ticket
              </Button>
            )}
            {isMobile && (
              <Button size="middle" onClick={() => setSelectedTicket(null)} className="font-bold">
                Close
              </Button>
            )}
          </div>
        </div>

        {/* 4 Crystal Clear Detail Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 border border-slate-200 p-2.5 sharp-card">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Submitted By</span>
            <span className="text-xs font-extrabold text-slate-900 block truncate mt-0.5">
              {selectedTicket.created_by_name || selectedTicket.createdByName || "User"}
            </span>
            <span className="text-[10px] font-mono text-slate-500 font-bold block">
              ID: {selectedTicket.created_by_code || selectedTicket.createdByCode || "—"}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-2.5 sharp-card">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Target Supervisor</span>
            <span className="text-xs font-extrabold text-indigo-700 block truncate mt-0.5">
              {selectedTicket.assigned_to_name || selectedTicket.assignedToName || "Support Desk"}
            </span>
            <span className="text-[10px] text-slate-500 font-bold block">
              Role: {selectedTicket.assigned_to_role || selectedTicket.assignedToRole || "Admin"}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-2.5 sharp-card">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Date Raised</span>
            <span className="text-xs font-bold text-slate-800 block mt-0.5">
              {new Date(selectedTicket.created_at || selectedTicket.createdAt || Date.now()).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">
              {new Date(selectedTicket.created_at || selectedTicket.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-2.5 sharp-card">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Resolution TAT</span>
            <span className="text-xs font-mono font-black text-indigo-600 block mt-0.5">
              {selectedTicket.closed_at ? (
                formatDuration((new Date(selectedTicket.closed_at).getTime() - new Date(selectedTicket.created_at).getTime()) / (1000 * 60 * 60))
              ) : (
                "In Progress"
              )}
            </span>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">
              {selectedTicket.closed_at ? "Closed" : "Active Queue"}
            </span>
          </div>
        </div>

        {/* Issue Remarks Description Box */}
        <div className="bg-white border-2 border-slate-200/90 p-3.5 sharp-card shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              📋 Detailed Concern & Problem Statement
            </span>
          </div>
          <p className="text-xs text-slate-900 font-bold leading-relaxed whitespace-pre-wrap m-0">
            {selectedTicket.description}
          </p>
        </div>

        {/* Discussion Logs Stream */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              <MessageOutlined className="mr-1 text-indigo-600" /> Discussion Thread & Updates
            </Text>
            <Tag color="cyan" className="text-[9px] font-bold uppercase m-0">Live Sync</Tag>
          </div>
          
          <div 
            className="rounded-xl p-3 min-h-[220px] max-h-[360px] overflow-y-auto flex flex-col gap-2.5 shadow-inner border border-slate-200"
            style={{
              backgroundColor: "#f8fafc",
              backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
              backgroundSize: "16px 16px"
            }}
          >
            {!selectedTicket.comments || !selectedTicket.comments.trim() ? (
              <div className="my-auto text-center py-8 text-slate-400 font-bold uppercase text-[10px] tracking-wider select-none">
                No replies logged yet. Start the conversation below.
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
                      <span className="bg-white border border-slate-200 text-slate-500 text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs select-none">
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
                      className={`px-3 py-2 rounded-xl max-w-[85%] sm:max-w-[75%] shadow-2xs relative flex flex-col gap-0.5 ${
                        isOwn 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none"
                      }`}
                    >
                      {!isOwn && (
                        <Text className="font-extrabold text-[10px] text-indigo-600 block leading-none select-none mb-0.5">
                          {senderName}
                        </Text>
                      )}
                      <Paragraph className={`text-xs font-medium leading-relaxed whitespace-pre-wrap break-words m-0 ${isOwn ? "text-white" : "text-slate-800"}`}>
                        {content}
                      </Paragraph>
                      <Text className={`text-[8px] font-bold select-none text-right block leading-none mt-1 ${isOwn ? "text-indigo-200" : "text-slate-400"}`}>
                        {dateTime} {isOwn && <span className="ml-0.5 text-white">✓✓</span>}
                      </Text>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {typingUser && (
            <div className="px-3 py-1 text-[10px] text-indigo-600 italic font-semibold">
              {typingUser} is typing...
            </div>
          )}

          {/* Reply Form */}
          {selectedTicket.status !== "Final Closed" && (
            <form onSubmit={handleSendCommentMessage} className="flex gap-2 pt-2">
              <Input
                placeholder={selectedTicket.status === "Closed" ? "Ticket is closed. Reopen to reply..." : "Type reply message..."}
                value={newComment}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={selectedTicket.status === "Closed" || commenting}
                className="rounded-xl border-slate-200 font-medium"
                size="large"
              />
              <Button
                type="primary"
                htmlType="submit"
                loading={commenting}
                disabled={selectedTicket.status === "Closed" || !newComment.trim()}
                icon={<SendOutlined />}
                size="large"
                className="rounded-xl bg-indigo-600 font-bold"
              />
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn p-2 sm:p-4 pb-32 sm:pb-24 lg:pb-8 text-slate-800 font-sans max-w-[1600px] mx-auto min-h-screen">
      
      {/* Ant Design Header Banner */}
      <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-slate-800 text-white rounded-2xl shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <CustomerServiceOutlined className="text-2xl" />
            </div>
            <div>
              <Title level={4} className="text-white m-0 uppercase tracking-wide font-black flex items-center gap-2">
                Query Desk
              </Title>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag color="green" className="font-extrabold text-[10px] uppercase py-0.5 px-2 flex items-center gap-1 m-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Realtime Sync
            </Tag>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border border-indigo-500 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-80"
            >
              <ReloadOutlined spin={refreshing} className="text-white text-xs" />
              <span>{refreshing ? "Refreshing..." : "Refresh Desk"}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Quick KPI Summary Bar (Visible on Mobile & Desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 to-white shadow-2xs" bodyStyle={{ padding: "14px" }}>
          <Text className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block">Total Raised</Text>
          <div className="text-xl font-extrabold font-mono text-indigo-900 mt-1">{baseList.length}</div>
        </Card>
        <Card className="rounded-2xl border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-white shadow-2xs" bodyStyle={{ padding: "14px" }}>
          <Text className="text-[10px] font-black uppercase text-amber-600 tracking-wider block">Open & Active</Text>
          <div className="text-xl font-extrabold font-mono text-amber-700 mt-1">
            {baseList.filter(t => t.status === "Open" || t.status === "Re-opened").length}
          </div>
        </Card>
        <Card className="rounded-2xl border-blue-200/70 bg-gradient-to-br from-blue-50/80 to-white shadow-2xs" bodyStyle={{ padding: "14px" }}>
          <Text className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">Updated / In Progress</Text>
          <div className="text-xl font-extrabold font-mono text-blue-700 mt-1">
            {baseList.filter(t => t.status === "Updated").length}
          </div>
        </Card>
        <Card className="rounded-2xl border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white shadow-2xs" bodyStyle={{ padding: "14px" }}>
          <Text className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">Resolved & Closed</Text>
          <div className="text-xl font-extrabold font-mono text-emerald-700 mt-1">
            {baseList.filter(t => t.status === "Closed" || t.status === "Final Closed").length}
          </div>
        </Card>
      </div>

      {/* Analytics Grid Cards */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Category Chart */}
        <Card title={<Text className="text-xs font-black text-slate-600 uppercase tracking-wider"><TagOutlined className="mr-1 text-indigo-600" /> Concerns by Category</Text>} className="rounded-2xl border-slate-200/80 shadow-xs">
          <div style={{ height: 160 }}>
            <ResponsiveBar
              data={analytics.categoryChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 80 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={6}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
              }}
            />
          </div>
        </Card>

        {/* Priority Chart */}
        <Card title={<Text className="text-xs font-black text-slate-600 uppercase tracking-wider"><ExclamationCircleOutlined className="mr-1 text-amber-500" /> Concerns by Priority</Text>} className="rounded-2xl border-slate-200/80 shadow-xs">
          <div style={{ height: 160 }}>
            <ResponsiveBar
              data={analytics.priorityChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 70 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={6}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
              }}
            />
          </div>
        </Card>

        {/* Status Chart */}
        <Card title={<Text className="text-xs font-black text-slate-600 uppercase tracking-wider"><ClockCircleOutlined className="mr-1 text-emerald-500" /> Concerns by Status</Text>} className="rounded-2xl border-slate-200/80 shadow-xs">
          <div style={{ height: 160 }}>
            <ResponsiveBar
              data={analytics.statusChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 85 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={6}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#f1f5f9', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#64748b' } } }
              }}
            />
          </div>
        </Card>

      </div>

      {/* Ant Design Select, Custom Select and Segmented styling */}
      <style>{`
        .help-custom-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          background-size: 14px 14px !important;
          padding: 0 30px 0 12px !important;
          border-radius: 8px !important;
          min-height: 38px !important;
          height: 38px !important;
          border: 1px solid #cbd5e1 !important;
          background-color: #ffffff !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          outline: none !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .help-custom-select:focus {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1) !important;
        }
        .help-tab-segmented .ant-segmented-item-selected {
          background-color: #4f46e5 !important;
        }
        .help-tab-segmented .ant-segmented-item-selected * {
          color: #ffffff !important;
          font-weight: 800 !important;
        }
      `}</style>

      {/* Prominent Tab Switcher Bar - Always Visible at Top */}
      <Card className="rounded-2xl border-slate-200/80 shadow-2xs" bodyStyle={{ padding: "12px" }}>
        <Segmented
          value={activeTab}
          onChange={(val) => { handleTabChange(val as any); setSelectedTicket(null); }}
          options={[
            { label: `My Raised Tickets (${myRaisedTickets.length})`, value: "my-tickets" },
            { label: "File Support Ticket", value: "raise" },
            ...(hasAccessToAssignedTab ? [{ label: `Assigned Concerns (${assignedTickets.length})`, value: "assigned-tickets" }] : [])
          ]}
          block
          className="help-tab-segmented bg-slate-100/90 p-1 font-extrabold text-xs"
        />
      </Card>

      {/* Home-style Filter Toolbar */}
      {activeTab !== "raise" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-wider shrink-0">
              <FilterOutlined className="text-indigo-600 text-sm" />
              <span>Filter Concerns:</span>
            </div>

            {/* Follow-up Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase text-slate-400">Flag:</span>
              <select
                value={filterFollowup}
                onChange={(e) => setFilterFollowup(e.target.value as any)}
                className="help-custom-select w-full sm:w-36"
              >
                <option value="all">All Concerns</option>
                <option value="flagged">⭐ Flagged Only</option>
                <option value="normal">Unflagged Only</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase text-slate-400">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="help-custom-select w-full sm:w-36"
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Re-opened">Re-opened</option>
                <option value="Updated">Updated</option>
                <option value="Closed">Closed</option>
                <option value="Final Closed">Final Closed</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase text-slate-400">Category:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="help-custom-select w-full sm:w-36"
              >
                <option value="all">All Categories</option>
                <option value="Expense">Expense</option>
                <option value="TA/DA">TA / DA</option>
                <option value="Profile">Profile</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={() => {
              setFilterFollowup("all");
              setFilterStatus("all");
              setFilterCategory("all");
            }}
            className="text-xs font-bold text-slate-600 rounded-xl hover:text-indigo-600 border-slate-200 self-end md:self-auto"
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <Row gutter={[20, 20]}>
        
        {/* Left Column: File Ticket Form */}
        <Col xs={24} lg={8} className={activeTab === "raise" ? "block pb-48 lg:pb-0" : "hidden lg:block pb-48 lg:pb-0"}>
          <Card 
            title={
              <Text className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <PlusOutlined className="text-indigo-600" /> File Support Ticket
              </Text>
            } 
            className="rounded-2xl border-slate-200/80 shadow-sm"
          >
            <form onSubmit={handleRaiseTicket} className="space-y-4">
              
              {/* Concern type dropdown */}
              <div>
                <Text className="text-xs font-bold text-slate-600 block mb-1">Concern Field *</Text>
                <select
                  value={concernType}
                  onChange={(e) => setConcernType(e.target.value)}
                  className="help-custom-select w-full"
                >
                  <option value="Expense">Expense Claim Reference</option>
                  <option value="TA/DA">TA / DA Allowance Cap</option>
                  <option value="Profile">Profile Mappings</option>
                  <option value="Other">Other / Custom Issue</option>
                </select>
              </div>

              {/* Custom Category Input */}
              {concernType === "Other" && (
                <div>
                  <Text className="text-xs font-bold text-slate-600 block mb-1">Specify Custom Category *</Text>
                  <Input
                    placeholder="e.g. System Crash, Fuel Rates, Sim Card"
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    size="large"
                    required
                  />
                </div>
              )}

              {/* Select Expense Claim Dropdown */}
              {concernType === "Expense" && (
                <div>
                  <Text className="text-xs font-bold text-slate-600 block mb-1">Select Claim Reference *</Text>
                  <select
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    className="help-custom-select w-full"
                  >
                    <option value="">-- Select Related Expense Claim --</option>
                    {myExpenses.map(exp => (
                      <option key={exp.id} value={String(exp.id)}>
                        {exp.expense_code} — {exp.itinerary} (₹{exp.amount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select Assignee */}
              {concernType !== "Profile" ? (
                <div>
                  <Text className="text-xs font-bold text-slate-600 block mb-1">Assign Target Supervisor *</Text>
                  <select
                    value={assignedToName}
                    onChange={(e) => setAssignedToName(e.target.value)}
                    className="help-custom-select w-full"
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
                  <Text className="text-xs font-bold text-slate-600 block mb-1">Assign Target Supervisor</Text>
                  <Tag color="blue" className="w-full py-1.5 px-3 text-xs font-bold flex items-center justify-center gap-1">
                    <LockOutlined /> Locked to Admin System
                  </Tag>
                </div>
              )}

              {/* Priority */}
              <div>
                <Text className="text-xs font-bold text-slate-600 block mb-1">Priority Level *</Text>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="help-custom-select w-full"
                >
                  <option value="Low">Low (General Query)</option>
                  <option value="Medium">Medium (Delay/Discrepancy)</option>
                  <option value="High">High (Urgent Action)</option>
                  <option value="Critical">Critical (System Lockout)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <Text className="text-xs font-bold text-slate-600 block mb-1">Detailed Remarks / Description *</Text>
                <TextArea
                  rows={4}
                  placeholder="Explain your concern with clear details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border-slate-200 font-medium"
                  required
                />
              </div>

              <Button
                type="primary"
                htmlType="submit"
                loading={raising}
                block
                size="large"
                className="bg-emerald-600 hover:bg-emerald-700 font-extrabold text-xs uppercase tracking-wider rounded-xl h-11"
              >
                {raising ? "Filing Support Request..." : "Submit Ticket"}
              </Button>

            </form>
          </Card>
        </Col>

        {/* Right Column: Listing & Thread */}
        <Col xs={24} lg={16} className={activeTab === "raise" ? "hidden lg:block" : "block"}>
          
          <div className="space-y-4">
            
            {/* List Header Title */}
            <div className="px-4 py-3 bg-white border border-slate-200/90 shadow-2xs rounded-t-2xl flex items-center justify-between">
              <Text className="font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <MessageOutlined className="text-indigo-600" />
                {activeTab === "assigned-tickets" ? "Assigned Concerns Queue" : "My Support Tickets Queue"} ({filteredList.length})
              </Text>
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Sorted: Newest First</span>
            </div>

            {/* Ticket Cards List */}
            {loading && tickets.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/90 rounded-b-2xl shadow-xs">
                <Spin size="large" tip="Loading support desk tickets..." />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center bg-white border border-slate-200/90 rounded-b-2xl shadow-xs">
                <Empty description={<Text className="font-bold text-slate-400 uppercase text-xs">No tickets match active filters</Text>} />
              </div>
            ) : (
              <div className="space-y-3 pb-48 lg:pb-12">
                {filteredList.map(tkt => {
                  const isSelected = selectedTicket && selectedTicket.id === tkt.id;
                  const codeDisplay = getFormattedTicketCode(tkt);
                  const statusBorderClass = getCardTopStatusBorder(tkt.status);
                  const claimCodeStr = tkt.expense_code || tkt.expenseCode;
                  
                  return (
                    <div 
                      key={tkt.id} 
                      onClick={() => setSelectedTicket(tkt)}
                      className={`bg-white border rounded-xl p-3 space-y-2.5 transition-all cursor-pointer group shadow-2xs hover:shadow-md ${statusBorderClass} ${
                        isSelected 
                          ? "ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/40" 
                          : ""
                      }`}
                    >
                      {/* Top Header Section (Strict 2 Horizontal Lines) */}
                      <div className="border-b border-slate-100 pb-2 space-y-1.5">
                        {/* Horizontal Line 1: Ticket ID (Left) & Priority + Status (Right) */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-slate-900 text-white font-extrabold py-0.5 px-2.5 rounded-md text-xs font-mono shadow-2xs">
                            {codeDisplay}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {getPriorityBadge(tkt.priority)}
                            {getStatusBadge(tkt.status)}
                          </div>
                        </div>

                        {/* Horizontal Line 2: Category & Claim Ref (Left) & Submitted Date (Right) */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 text-[10px] uppercase rounded-md border border-indigo-200">
                              {tkt.concern_type || tkt.concernType}
                            </span>

                            {claimCodeStr && (
                              <span className="bg-purple-50 text-purple-700 font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-purple-200">
                                Claim: {claimCodeStr}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 font-bold font-mono shrink-0">
                            📅 {new Date(tkt.created_at || tkt.createdAt || Date.now()).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Problem Statement Box */}
                      <div className="bg-slate-50/90 rounded-md p-2.5 border border-slate-200/70 space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">CONCERN DETAILS</span>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug m-0 whitespace-pre-wrap" title={tkt.description}>
                          {tkt.description}
                        </p>
                      </div>

                      {/* Structured Metadata Grid Chips */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100/70 p-2 rounded-md border border-slate-200/60">
                        <div className="truncate">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">Raised By</span>
                          <span className="text-slate-900 font-black">{tkt.created_by_name || tkt.createdByName || "User"}</span>
                          <span className="text-slate-400 text-[9px]"> ({tkt.created_by_code || tkt.createdByCode || ""})</span>
                        </div>

                        <div className="truncate">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">Assigned Supervisor</span>
                          <span className="text-indigo-700 font-black">{tkt.assigned_to_name || tkt.assignedToName || "Support Desk"}</span>
                        </div>

                        <div className="truncate hidden sm:block">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">TAT / Status</span>
                          <span className="text-slate-700 font-mono font-bold">
                            {tkt.closed_at ? "Resolved" : "In Progress"}
                          </span>
                        </div>
                      </div>

                      {/* CTA Action Button Bar */}
                      <div className="bg-indigo-600 group-hover:bg-indigo-700 text-white font-extrabold text-xs py-1.5 px-3 rounded-md flex items-center justify-between transition-colors shadow-2xs">
                        <span>Tap to View Discussion & Reply</span>
                        <span className="group-hover:translate-x-1 transition-transform font-mono">→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ticket Discussion Thread Panel (Desktop) */}
          {selectedTicket && !isMobile && (
            <Card className="mt-6 rounded-2xl border-slate-200/80 shadow-md">
              {renderTicketDetail()}
            </Card>
          )}

          {/* Ticket Discussion Drawer (Mobile) */}
          {selectedTicket && isMobile && (
            <Drawer
              open={!!selectedTicket}
              onClose={() => setSelectedTicket(null)}
              placement="bottom"
              height="90vh"
              className="rounded-t-2xl"
              bodyStyle={{ padding: "16px", paddingBottom: "110px" }}
            >
              {renderTicketDetail()}
            </Drawer>
          )}

        </Col>

      </Row>
    </div>
  );
}
