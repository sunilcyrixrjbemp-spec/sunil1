import React, { useState, useEffect, useRef } from "react";
import { formatToIST, getCurrentTimeUTC } from "../utils/timezone";
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
  TagOutlined,
  FilterOutlined,
  CustomerServiceOutlined
} from "@ant-design/icons";
import { ticketService, TicketCreatePayload } from "../services/ticketService";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import { ResponsiveBar } from "@nivo/bar";
import { X } from "lucide-react";

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
        expense_code: concernType === "Expense" && selectedExp ? selectedExp.expense_code : null,
        created_at: getCurrentTimeUTC()
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
    if (currentUser?.role === "Admin") return true;
    const aName = (t.assigned_to_name || t.assignedToName || "").trim();
    const curName = (currentUser?.name || "").trim();
    const isAssignee = aName.toLowerCase() === curName.toLowerCase();
    return isAssignee;
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
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-none bg-rose-100 text-rose-700 border border-rose-300">🔥 Critical</span>;
    }
    if (pri === "High") {
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-none bg-orange-100 text-orange-700 border border-orange-300">⚡ High</span>;
    }
    if (pri === "Medium") {
      return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-none bg-amber-100 text-amber-700 border border-amber-300">⚖️ Medium</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-none bg-slate-100 text-slate-700 border border-slate-300">🔹 Low</span>;
  };

  const getStatusBadge = (stat: string) => {
    if (stat === "Open") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-none bg-amber-600 text-white shadow-2xs">🟡 Open</span>;
    }
    if (stat === "Updated" || stat === "In Progress") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-none bg-blue-600 text-white shadow-2xs">🔵 In Progress</span>;
    }
    if (stat === "Re-opened") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-none bg-purple-600 text-white shadow-2xs">🟣 Re-opened</span>;
    }
    if (stat === "Closed" || stat === "Final Closed") {
      return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-none bg-emerald-600 text-white shadow-2xs">🟢 Resolved</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-none bg-slate-600 text-white">{stat}</span>;
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
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
            >
              Close ✕
            </button>
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
              {formatToIST(selectedTicket.created_at || selectedTicket.createdAt)}
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
    <div className="space-y-4 animate-fadeIn p-2 sm:p-4 pb-32 sm:pb-24 lg:pb-8 text-[#212529] font-sans max-w-[1600px] mx-auto min-h-screen">
      
      {/* Enterprise Header Banner */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0">
            <CustomerServiceOutlined className="text-base" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-none">HELP &amp; SUPPORT DESK</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Realtime query desk, support ticket management, and discussion thread.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-none border border-emerald-200 font-mono flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Live Sync Active
          </span>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none px-3.5 py-1 border-0 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-80"
          >
            <ReloadOutlined spin={refreshing} className="text-white text-xs" />
            <span>{refreshing ? "Refreshing..." : "Refresh Desk"}</span>
          </button>
        </div>
      </div>

      {/* 4 Enterprise Quick KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-[#4A6A8A] flex items-center justify-center text-white shrink-0 font-bold">
            <TagOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Total Raised</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">{baseList.length}</span>
            <span className="text-[9px] text-[#4A6A8A] font-bold uppercase block mt-0.5">Total Tickets</span>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-amber-600 flex items-center justify-center text-white shrink-0 font-bold">
            <ClockCircleOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Open &amp; Active</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">
              {baseList.filter(t => t.status === "Open" || t.status === "Re-opened").length}
            </span>
            <span className="text-[9px] text-amber-700 font-bold uppercase block mt-0.5">Awaiting Action</span>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-blue-600 flex items-center justify-center text-white shrink-0 font-bold">
            <MessageOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">In Progress</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">
              {baseList.filter(t => t.status === "Updated").length}
            </span>
            <span className="text-[9px] text-blue-700 font-bold uppercase block mt-0.5">Under Review</span>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-none p-3 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-none bg-emerald-600 flex items-center justify-center text-white shrink-0 font-bold">
            <CheckCircleOutlined />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block leading-none">Resolved</span>
            <span className="text-sm font-black text-slate-900 font-mono block mt-1">
              {baseList.filter(t => t.status === "Closed" || t.status === "Final Closed").length}
            </span>
            <span className="text-[9px] text-emerald-700 font-bold uppercase block mt-0.5">Completed Concerns</span>
          </div>
        </div>
      </div>

      {/* Analytics Grid Cards */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Category Chart */}
        <div className="bg-white border border-slate-300 rounded-none p-3 shadow-2xs">
          <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <TagOutlined className="text-[#4A6A8A]" /> Concerns by Category
          </div>
          <div style={{ height: 150 }}>
            <ResponsiveBar
              data={analytics.categoryChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 80 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={0}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#475569' } } }
              }}
            />
          </div>
        </div>

        {/* Priority Chart */}
        <div className="bg-white border border-slate-300 rounded-none p-3 shadow-2xs">
          <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <ExclamationCircleOutlined className="text-amber-600" /> Concerns by Priority
          </div>
          <div style={{ height: 150 }}>
            <ResponsiveBar
              data={analytics.priorityChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 70 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={0}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#475569' } } }
              }}
            />
          </div>
        </div>

        {/* Status Chart */}
        <div className="bg-white border border-slate-300 rounded-none p-3 shadow-2xs">
          <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <ClockCircleOutlined className="text-emerald-600" /> Concerns by Status
          </div>
          <div style={{ height: 150 }}>
            <ResponsiveBar
              data={analytics.statusChart}
              keys={["amount"]}
              indexBy="label"
              layout="horizontal"
              margin={{ top: 10, right: 10, bottom: 25, left: 85 }}
              padding={0.35}
              colors={GALLERY_COLORS}
              colorBy="indexValue"
              borderRadius={0}
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{ tickSize: 0, tickPadding: 6 }}
              theme={{
                grid: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
                axis: { ticks: { text: { fontSize: 8, fontWeight: 'bold', fill: '#475569' } } }
              }}
            />
          </div>
        </div>
      </div>

      {/* Select Styling */}
      <style>{`
        .help-custom-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          background-size: 14px 14px !important;
          padding: 0 30px 0 10px !important;
          border-radius: 0px !important;
          min-height: 32px !important;
          height: 32px !important;
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
          border-color: #4A6A8A !important;
        }
      `}</style>

      {/* Enterprise Sharp Tab Switcher Bar */}
      <div className="bg-white border border-slate-300 rounded-none p-1.5 shadow-2xs flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => { handleTabChange("my-tickets"); setSelectedTicket(null); }}
          className={`flex-1 py-1.5 px-3 text-xs font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-colors rounded-none ${
            activeTab === "my-tickets"
              ? "bg-[#4A6A8A] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          My Raised Tickets ({myRaisedTickets.length})
        </button>
        <button
          type="button"
          onClick={() => { handleTabChange("raise"); setSelectedTicket(null); }}
          className={`flex-1 py-1.5 px-3 text-xs font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-colors rounded-none ${
            activeTab === "raise"
              ? "bg-[#4A6A8A] text-white shadow-2xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          + File Support Ticket
        </button>
        {hasAccessToAssignedTab && (
          <button
            type="button"
            onClick={() => { handleTabChange("assigned-tickets"); setSelectedTicket(null); }}
            className={`flex-1 py-1.5 px-3 text-xs font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-colors rounded-none ${
              activeTab === "assigned-tickets"
                ? "bg-[#4A6A8A] text-white shadow-2xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Assigned Concerns ({assignedTickets.length})
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      {activeTab !== "raise" && (
        <div className="bg-white border border-slate-300 rounded-none p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wider shrink-0">
              <FilterOutlined className="text-[#4A6A8A] text-sm" />
              <span>Filter Concerns:</span>
            </div>

            {/* Follow-up Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 w-full sm:w-auto">
              <span className="text-[10px] font-extrabold uppercase text-slate-500">Flag:</span>
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
              <span className="text-[10px] font-extrabold uppercase text-slate-500">Status:</span>
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
              <span className="text-[10px] font-extrabold uppercase text-slate-500">Category:</span>
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

          <button 
            onClick={() => {
              setFilterFollowup("all");
              setFilterStatus("all");
              setFilterCategory("all");
            }}
            className="px-3 py-1 border border-slate-300 bg-white text-slate-700 text-xs font-bold rounded-none hover:bg-slate-50 transition-colors cursor-pointer self-end md:self-auto"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <Row gutter={[16, 16]}>
        
        {/* Left Column: File Ticket Form */}
        <Col xs={24} lg={8} className={activeTab === "raise" ? "block pb-48 lg:pb-0" : "hidden lg:block pb-48 lg:pb-0"}>
          <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
            <div className="bg-[#4A6A8A] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 rounded-none">
              <PlusOutlined className="text-white" /> File Support Ticket
            </div>
            <div className="p-4">
              <form onSubmit={handleRaiseTicket} className="space-y-3">
                
                {/* Concern type dropdown */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Concern Field *</label>
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
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Specify Custom Category *</label>
                    <Input
                      placeholder="e.g. System Crash, Fuel Rates, Sim Card"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                      className="rounded-none border-slate-300 font-bold text-xs"
                      required
                    />
                  </div>
                )}

                {/* Select Expense Claim Dropdown */}
                {concernType === "Expense" && (
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Select Claim Reference *</label>
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
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Assign Target Supervisor *</label>
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
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Assign Target Supervisor</label>
                    <div className="bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-bold border border-slate-300 flex items-center justify-center gap-1">
                      <LockOutlined /> Locked to Admin System
                    </div>
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Priority Level *</label>
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
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Detailed Remarks / Description *</label>
                  <TextArea
                    rows={4}
                    placeholder="Explain your concern with clear details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-none border-slate-300 font-semibold text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={raising}
                  className="w-full bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none py-2.5 border-0 cursor-pointer shadow-2xs transition-colors disabled:opacity-60"
                >
                  {raising ? "Filing Support Request..." : "Submit Ticket"}
                </button>

              </form>
            </div>
          </div>
        </Col>

        {/* Right Column: Listing & Thread */}
        <Col xs={24} lg={16} className={activeTab === "raise" ? "hidden lg:block" : "block"}>
          
          <div className="space-y-3">
            
            {/* List Header Title */}
            <div className="px-3 py-2 bg-[#4A6A8A] text-white shadow-2xs rounded-none flex items-center justify-between">
              <span className="font-extrabold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                <MessageOutlined className="text-white" />
                {activeTab === "assigned-tickets" ? "Assigned Concerns Queue" : "My Support Tickets Queue"} ({filteredList.length})
              </span>
              <span className="text-[10px] font-mono text-slate-200 font-bold uppercase">Sorted: Newest First</span>
            </div>

            {/* Ticket Cards List */}
            {loading && tickets.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-300 rounded-none shadow-2xs">
                <Spin size="large" tip="Loading support desk tickets..." />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center bg-white border border-slate-300 rounded-none shadow-2xs">
                <Empty description={<Text className="font-extrabold text-slate-500 uppercase text-xs">No tickets match active filters</Text>} />
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
                      className={`bg-white border border-slate-300 rounded-none p-3 space-y-2.5 transition-all cursor-pointer group shadow-2xs hover:shadow-md ${statusBorderClass} ${
                        isSelected 
                          ? "ring-2 ring-[#4A6A8A] border-[#4A6A8A] bg-slate-50" 
                          : ""
                      }`}
                    >
                      {/* Top Header Section */}
                      <div className="border-b border-slate-200 pb-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-[#4A6A8A] text-white font-extrabold py-0.5 px-2.5 rounded-none text-xs font-mono shadow-2xs">
                            {codeDisplay}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {getPriorityBadge(tkt.priority)}
                            {getStatusBadge(tkt.status)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-100 text-[#4A6A8A] font-extrabold px-2 py-0.5 text-[10px] uppercase rounded-none border border-slate-200">
                              {tkt.concern_type || tkt.concernType}
                            </span>

                            {claimCodeStr && (
                              <span className="bg-slate-100 text-slate-800 font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-none border border-slate-200">
                                Claim: {claimCodeStr}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-500 font-bold font-mono shrink-0">
                            📅 {formatToIST(tkt.created_at || tkt.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Problem Statement Box */}
                      <div className="bg-slate-50 rounded-none p-2.5 border border-slate-200 space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">CONCERN DETAILS</span>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug m-0 whitespace-pre-wrap" title={tkt.description}>
                          {tkt.description}
                        </p>
                      </div>

                      {/* Structured Metadata Grid Chips */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-100 p-2 rounded-none border border-slate-200">
                        <div className="truncate">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">Raised By</span>
                          <span className="text-slate-900 font-black">{tkt.created_by_name || tkt.createdByName || "User"}</span>
                          <span className="text-slate-500 text-[9px]"> ({tkt.created_by_code || tkt.createdByCode || ""})</span>
                        </div>

                        <div className="truncate">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">Assigned Supervisor</span>
                          <span className="text-[#4A6A8A] font-black">{tkt.assigned_to_name || tkt.assignedToName || "Support Desk"}</span>
                        </div>

                        <div className="truncate hidden sm:block">
                          <span className="text-slate-400 font-extrabold uppercase text-[8px] block">TAT / Status</span>
                          <span className="text-slate-700 font-mono font-bold">
                            {tkt.closed_at ? "Resolved" : "In Progress"}
                          </span>
                        </div>
                      </div>

                      {/* CTA Action Button Bar */}
                      <div className="bg-[#4A6A8A] group-hover:bg-[#3b5570] text-white font-extrabold text-xs py-1.5 px-3 rounded-none flex items-center justify-between transition-colors shadow-2xs">
                        <span>Tap to View Discussion &amp; Reply</span>
                        <span className="group-hover:translate-x-1 transition-transform font-mono">→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ticket Chat Discussion Modal (Desktop & Mobile) */}
          {selectedTicket && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
              <div className="bg-white border border-slate-400 rounded-none shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
                {/* Modal Header Bar */}
                <div className="bg-[#4A6A8A] text-white px-4 py-2.5 flex items-center justify-between rounded-none shrink-0">
                  <div className="flex items-center gap-2 font-mono font-extrabold text-xs uppercase tracking-wider text-white">
                    <MessageOutlined className="text-white text-sm" />
                    <span>Ticket Chat &amp; Discussion Thread — {getFormattedTicketCode(selectedTicket)}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="text-white/80 hover:text-white transition-colors cursor-pointer border-0 bg-transparent p-1 leading-none"
                    title="Close Chat Modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                  {renderTicketDetail()}
                </div>
              </div>
            </div>
          )}

        </Col>

      </Row>
    </div>
  );
}
