import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { 
  Input, 
  Select, 
  Modal, 
  Table, 
  Avatar
} from "antd";
import { ticketService, TicketCreatePayload } from "../services/ticketService";
import { expenseService } from "../services/expenseService";
import api from "../services/api";
import { 
  Search, 
  Plus, 
  MessageSquare, 
  CheckCircle2, 
  Send, 
  ShieldCheck, 
  RefreshCw, 
  LifeBuoy, 
  BookOpen, 
  Building2, 
  X,
  IndianRupee,
  Smartphone,
  FileText,
  Clock,
  RotateCcw,
  Check
} from "lucide-react";

// Format date strings to user-friendly local browser dates
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
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (e) {
    return String(dateVal);
  }
}

// Ensure clean CYR-RJ-0000001 sequence formatting
function getFormattedTicketCode(tkt: any): string {
  if (!tkt) return "CYR-RJ-0000001";
  if (tkt.ticket_code && tkt.ticket_code.startsWith("CYR-RJ-")) return tkt.ticket_code;
  if (tkt.ticketCode && tkt.ticketCode.startsWith("CYR-RJ-")) return tkt.ticketCode;
  const num = tkt.id || 1;
  return `CYR-RJ-${String(num).padStart(7, "0")}`;
}

// Parse comment log entries into structured chat messages
interface ParsedMessage {
  sender: string;
  time: string;
  text: string;
  isStatusChange?: boolean;
}

function parseTicketComments(rawComments?: string): ParsedMessage[] {
  if (!rawComments || !rawComments.trim()) return [];
  const lines = rawComments.split(/\n\n|\n/).map(l => l.trim()).filter(Boolean);
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    const match = line.match(/^([^\(]+)\s*\(([^\)]+)\):\s*(.*)$/);
    if (match) {
      const sender = match[1].trim();
      const time = match[2].trim();
      const text = match[3].trim();
      const isStatusChange = text.toLowerCase().startsWith("updated status to") || text.toLowerCase().startsWith("reassigned ticket to");
      messages.push({ sender, time, text, isStatusChange });
    } else {
      messages.push({ sender: "System", time: "", text: line });
    }
  }
  return messages;
}

// Compact Policy Guidelines Matrix
const POLICY_KNOWLEDGE = [
  {
    category: "Travel & Fuel Allowances",
    icon: IndianRupee,
    items: [
      {
        title: "Bike Allowance: ₹5.00 / KM",
        desc: "Standard reimbursement for all field engineers on authorized operational routes. Upload clear start and end odometer photos."
      },
      {
        title: "Car Allowance: ₹11.00 / KM",
        desc: "Applicable only for designated employees with prior approval from Project Head or Operations Coordinator."
      },
      {
        title: "Daily Allowance (DA)",
        desc: "In-District DA (₹150-₹200/day) for base district calls. Out-District DA (₹250-₹350/day) for travel outside base district."
      },
      {
        title: "Monthly KM Limit Extension",
        desc: "If travel exceeds monthly limit, request extension via Expenses page before submitting final claim."
      }
    ]
  },
  {
    category: "Hospital Calls & Equipment SOPs",
    icon: Building2,
    items: [
      {
        title: "Call Verification & Sign-off",
        desc: "Completed calls must have hospital service slips with doctor/in-charge signature and equipment operational status."
      },
      {
        title: "Equipment Barcode Tagging",
        desc: "Scan equipment barcode sticker. If damaged, capture a clear photo of the manufacturer serial number plate."
      }
    ]
  },
  {
    category: "Expense Workflow & Rejections",
    icon: FileText,
    items: [
      {
        title: "Returned to Draft",
        desc: "Allows editing claim details, bills, or remarks and resubmitting without raising a new claim."
      },
      {
        title: "Auto-Approval Eligibility",
        desc: "Claims with 0 policy deductions, verified odometer proofs, within monthly KM quota are processed automatically."
      }
    ]
  },
  {
    category: "Account & App Support",
    icon: Smartphone,
    items: [
      {
        title: "Password Reset",
        desc: "Go to Profile Center → Security & Credentials tab → enter old and new 8+ character password."
      },
      {
        title: "Receipt Upload",
        desc: "Portal automatically compresses images offline. Upload PNG or JPEG files under 10MB each."
      }
    ]
  }
];

export default function HelpPage() {
  const [currentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "null");
  });

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
    return !localStorage.getItem(`cache_support_tickets_${currentUserId}`);
  });
  const [refreshing, setRefreshing] = useState(false);
  const [raising, setRaising] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"tickets" | "policies" | "assigned">((() => {
    return (localStorage.getItem("help_active_tab") as any) || "tickets";
  }));

  const handleTabChange = (tab: "tickets" | "policies" | "assigned") => {
    setActiveTab(tab);
    localStorage.setItem("help_active_tab", tab);
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Raise Ticket Modal State
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [concernType, setConcernType] = useState<string>("Expense");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
  const [priority, setPriority] = useState<string>("Medium");
  const [assignedToName, setAssignedToName] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Selected ticket for live chat & complaint management modal
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // WebSocket & Live Sync states
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

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
      setTickets(ticketList || []);
      setMyExpenses(expenseList || []);
      localStorage.setItem(`cache_support_tickets_${currentUserId}`, JSON.stringify(ticketList || []));
      localStorage.setItem(`cache_my_expenses_${currentUserId}`, JSON.stringify(expenseList || []));
    } catch (err) {
      console.error("Failed to load help center tickets", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── REAL-TIME LIVE SYNC (Fast polling + WebSocket) ──
  useEffect(() => {
    if (!selectedTicket?.id) return;

    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Active live polling interval (every 2.5s while ticket chat is open)
    const pollTimer = setInterval(async () => {
      try {
        const latest = await ticketService.getTicketById(selectedTicket.id);
        if (latest) {
          if (
            latest.comments !== selectedTicket.comments ||
            latest.status !== selectedTicket.status ||
            latest.assignedToName !== selectedTicket.assignedToName ||
            latest.assigned_to_name !== selectedTicket.assigned_to_name
          ) {
            setSelectedTicket(latest);
            setTickets(prev => prev.map(t => t.id === latest.id ? latest : t));
          }
        }
      } catch (e) {
        // silent polling catch
      }
    }, 2500);

    return () => clearInterval(pollTimer);
  }, [selectedTicket?.id, selectedTicket?.comments, selectedTicket?.status]);

  // WebSocket connection for active ticket typing indicator & instant push
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

    try {
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
          }
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };

      ws.onclose = () => {
        setSocket(null);
        setTypingUser(null);
      };

      return () => {
        try { ws.close(); } catch(e) {}
      };
    } catch (e) {
      console.warn("WebSocket init error:", e);
    }
  }, [selectedTicket?.id, currentUser?.user_id]);

  const handleInputChange = (val: string) => {
    setNewComment(val);

    if (socket && socket.readyState === WebSocket.OPEN) {
      if (!isTypingState) {
        setIsTypingState(true);
        socket.send(JSON.stringify({ 
          type: "typing", 
          is_typing: true, 
          user_id: currentUser?.user_id,
          user_name: currentUser?.name || "User" 
        }));
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        setIsTypingState(false);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ 
            type: "typing", 
            is_typing: false, 
            user_id: currentUser?.user_id,
            user_name: currentUser?.name || "User" 
          }));
        }
      }, 2000);
    }
  };

  const handleCreateTicket = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!description.trim()) {
      toast.error("Please enter a description for your concern.");
      return;
    }

    setRaising(true);
    try {
      const payload: TicketCreatePayload = {
        concern_type: concernType,
        priority: priority,
        description: description.trim(),
        assigned_to_name: assignedToName || currentUser?.coordinator || currentUser?.manager || "Operations Coordinator",
        expense_id: selectedExpenseId ? Number(selectedExpenseId) : undefined
      };

      const newTkt = await ticketService.createTicket(payload);
      toast.success("Support ticket created successfully!");
      setTickets(prev => [newTkt, ...prev]);
      setDescription("");
      setSelectedExpenseId("");
      setConcernType("Expense");
      setIsRaiseModalOpen(false);
      setActiveTab("tickets");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create support ticket.");
    } finally {
      setRaising(false);
    }
  };

  const handleAddComment = async (customText?: string) => {
    const textToSend = customText || newComment;
    if (!textToSend.trim() || !selectedTicket) return;
    setCommenting(true);
    try {
      const updated = await ticketService.addComment(selectedTicket.id, textToSend.trim());
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      setNewComment("");
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send message.");
    } finally {
      setCommenting(false);
    }
  };

  const handleStatusChange = async (newStatus: string, commentRemark?: string) => {
    if (!selectedTicket) return;
    setStatusUpdating(true);
    try {
      const updated = await ticketService.updateTicketStatus(selectedTicket.id, newStatus, commentRemark);
      toast.success(`Ticket status updated to ${newStatus}`);
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleReassign = async (newAssigneeName: string) => {
    if (!selectedTicket || !newAssigneeName) return;
    try {
      const updated = await ticketService.assignTicket(selectedTicket.id, newAssigneeName);
      toast.success(`Ticket reassigned to ${newAssigneeName}`);
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err: any) {
      toast.error("Failed to reassign ticket.");
    }
  };

  const isCoordinatorOrAdmin = ["admin", "coordinator", "project head", "manager", "mis", "travel desk"].includes((currentUser?.role || "").toLowerCase());

  // Ticket Lists
  const myTickets = tickets.filter(t => {
    const createdBy = String(t.createdById || t.created_by_id || t.createdByCode || t.created_by_code || "").trim().toLowerCase();
    const myId = String(currentUser?.user_id || "").trim().toLowerCase();
    const matchesUser = createdBy === myId || !t.createdById;
    if (!matchesUser) return false;

    if (statusFilter !== "all" && (t.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (categoryFilter !== "all" && (t.concernType || t.concern_type || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const code = getFormattedTicketCode(t).toLowerCase();
      const desc = String(t.description || "").toLowerCase();
      const cat = String(t.concernType || t.concern_type || "").toLowerCase();
      if (!code.includes(q) && !desc.includes(q) && !cat.includes(q)) return false;
    }
    return true;
  });

  const assignedTickets = tickets.filter(t => {
    if (statusFilter !== "all" && (t.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (categoryFilter !== "all" && (t.concernType || t.concern_type || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const code = getFormattedTicketCode(t).toLowerCase();
      const desc = String(t.description || "").toLowerCase();
      const name = String(t.createdByName || t.created_by_name || "").toLowerCase();
      if (!code.includes(q) && !desc.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  // KPI Metrics
  const openCount = myTickets.filter(t => (t.status || "").toLowerCase() === "open").length;
  const inProgressCount = myTickets.filter(t => (t.status || "").toLowerCase() === "in progress").length;
  const resolvedCount = myTickets.filter(t => ["resolved", "closed", "final closed"].includes((t.status || "").toLowerCase())).length;

  const parsedMessages = selectedTicket ? parseTicketComments(selectedTicket.comments) : [];

  return (
    <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900 font-sans antialiased text-ink-900">
      
      {/* Subtle Zoho Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 space-y-3 max-w-7xl mx-auto pb-12 px-2 sm:px-4 pt-2">

        {/* ── 1. Compact Zoho Header Card ──────────────────────────────────── */}
        <div 
          className="bg-white border border-line rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
        >
          {/* Title & Stats */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <LifeBuoy size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-ink-900 leading-tight">
                  Help &amp; Support Desk
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {openCount} Open
                </span>
                {inProgressCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {inProgressCount} In Progress
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {resolvedCount} Resolved
                </span>
              </div>
              <p className="text-[11px] text-ink-500 font-medium mt-0.5">
                Support tickets, operational guidelines, and real-time coordinator communication
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setRefreshing(true); fetchInitialData(); }}
              disabled={refreshing}
              className="h-8 px-2.5 rounded-lg bg-surface-sunken hover:bg-white text-ink-700 font-bold text-xs border border-line flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-accent-600" : "text-ink-500"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsRaiseModalOpen(true)}
              className="h-8 px-3.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>Raise Ticket</span>
            </button>
          </div>
        </div>

        {/* ── 2. Compact Zoho Tabs & Filter Bar ────────────────────────────── */}
        <div className="bg-white border border-line rounded-xl p-2 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs">
          
          {/* Segmented Tab Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => handleTabChange("tickets")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === "tickets"
                  ? "bg-accent-600 text-white shadow-2xs"
                  : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
              }`}
            >
              <MessageSquare size={13} />
              <span>My Tickets ({myTickets.length})</span>
            </button>

            <button
              onClick={() => handleTabChange("policies")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === "policies"
                  ? "bg-accent-600 text-white shadow-2xs"
                  : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
              }`}
            >
              <BookOpen size={13} />
              <span>Policy &amp; Guidelines</span>
            </button>

            {isCoordinatorOrAdmin && (
              <button
                onClick={() => handleTabChange("assigned")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === "assigned"
                    ? "bg-accent-600 text-white shadow-2xs"
                    : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
                }`}
              >
                <ShieldCheck size={13} />
                <span>Coordinator Queue ({assignedTickets.length})</span>
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="w-44 sm:w-56">
              <Input
                size="small"
                placeholder="Search ticket code, issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                prefix={<Search size={13} className="text-ink-400 mr-1" />}
                className="rounded-lg text-xs border-line bg-surface-sunken"
                allowClear
              />
            </div>

            <Select
              size="small"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              className="w-24 text-xs"
              options={[
                { label: "All Status", value: "all" },
                { label: "Open", value: "open" },
                { label: "In Progress", value: "in progress" },
                { label: "Resolved", value: "resolved" },
                { label: "Closed", value: "closed" }
              ]}
            />

            <Select
              size="small"
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              className="w-28 text-xs"
              options={[
                { label: "All Categories", value: "all" },
                { label: "Expense", value: "expense" },
                { label: "Technical", value: "technical" },
                { label: "Hospital", value: "hospital calls" },
                { label: "Asset Tagging", value: "asset tagging" }
              ]}
            />
          </div>
        </div>

        {/* ── 3. High-Density Main Content Area ────────────────────────────── */}
        
        {/* ── TAB 1: MY TICKETS TABLE ── */}
        {activeTab === "tickets" && (
          <div className="bg-white border border-line rounded-xl overflow-hidden shadow-2xs">
            {loading ? (
              <div className="py-12 text-center text-ink-400 space-y-1.5">
                <RefreshCw size={20} className="animate-spin text-accent-600 mx-auto" />
                <div className="text-xs font-bold text-ink-700">Loading tickets...</div>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="py-12 text-center text-ink-400 space-y-2">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto opacity-70" />
                <div className="text-xs font-bold text-ink-700">No support tickets found</div>
                <div className="text-[11px] text-ink-400">Click "+ Raise Ticket" above to submit a new support request.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table
                  dataSource={myTickets}
                  rowKey="id"
                  size="middle"
                  className="custom-zoho-table"
                  pagination={{ pageSize: 15, size: "small", className: "px-3 py-1.5" }}
                  onRow={(record) => ({
                    onClick: () => setSelectedTicket(record),
                    className: "cursor-pointer hover:bg-slate-50/80 transition-colors text-xs"
                  })}
                  columns={[
                    {
                      title: "Ticket Code",
                      key: "code",
                      width: 140,
                      render: (_, tkt) => (
                        <span className="font-mono font-bold text-[11px] text-accent-700 bg-surface-sunken px-2 py-0.5 rounded border border-line">
                          {getFormattedTicketCode(tkt)}
                        </span>
                      )
                    },
                    {
                      title: "Category",
                      dataIndex: "concernType",
                      key: "concernType",
                      width: 120,
                      render: (cat, tkt) => (
                        <span className="font-bold text-[10px] uppercase bg-slate-100 text-ink-700 px-2 py-0.5 rounded border border-slate-200">
                          {cat || tkt.concern_type || "Expense"}
                        </span>
                      )
                    },
                    {
                      title: "Description",
                      dataIndex: "description",
                      key: "description",
                      ellipsis: true,
                      render: (d) => <span className="text-xs font-medium text-ink-800">{d}</span>
                    },
                    {
                      title: "Priority",
                      dataIndex: "priority",
                      key: "priority",
                      width: 90,
                      align: "center" as const,
                      render: (pri) => {
                        const p = (pri || "Medium").toLowerCase();
                        if (p === "urgent" || p === "high") {
                          return <span className="font-bold text-[9.5px] uppercase bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">High</span>;
                        }
                        if (p === "medium") {
                          return <span className="font-bold text-[9.5px] uppercase bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">Medium</span>;
                        }
                        return <span className="font-bold text-[9.5px] uppercase bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">Low</span>;
                      }
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      width: 110,
                      align: "center" as const,
                      render: (stat) => {
                        const s = (stat || "Open").toLowerCase();
                        if (s === "closed" || s === "final closed") {
                          return <span className="font-bold text-[10px] uppercase bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">Closed</span>;
                        }
                        if (s === "resolved") {
                          return <span className="font-bold text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Resolved</span>;
                        }
                        if (s === "in progress") {
                          return <span className="font-bold text-[10px] uppercase bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">In Progress</span>;
                        }
                        return <span className="font-bold text-[10px] uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">Open</span>;
                      }
                    },
                    {
                      title: "Date",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      width: 130,
                      align: "center" as const,
                      render: (dt, tkt) => <span className="text-[11px] text-ink-500 font-medium">{formatDateTime(dt || tkt.created_at)}</span>
                    },
                    {
                      title: "Action",
                      key: "action",
                      width: 80,
                      align: "center" as const,
                      render: (_, tkt) => (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedTicket(tkt); }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-accent-600 hover:bg-accent-700 text-white cursor-pointer shadow-2xs"
                        >
                          Chat
                        </button>
                      )
                    }
                  ]}
                />
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: POLICY & GUIDELINES ACCORDION ── */}
        {activeTab === "policies" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {POLICY_KNOWLEDGE.map((cat, cIdx) => (
              <div key={cIdx} className="bg-white border border-line rounded-xl p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 border-b border-line pb-2">
                  <div className="w-6 h-6 rounded-md bg-accent-50 text-accent-700 border border-accent-100 flex items-center justify-center">
                    <cat.icon size={13} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-ink-900">
                    {cat.category}
                  </h3>
                </div>

                <div className="space-y-2">
                  {cat.items.map((item, iIdx) => (
                    <div key={iIdx} className="p-2.5 bg-[#FAFAF9] rounded-lg border border-line/60 space-y-0.5">
                      <div className="text-xs font-bold text-ink-900">{item.title}</div>
                      <div className="text-[11px] text-ink-600 leading-relaxed font-medium">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB 3: COORDINATOR QUEUE ── */}
        {activeTab === "assigned" && isCoordinatorOrAdmin && (
          <div className="bg-white border border-line rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <Table
                dataSource={assignedTickets}
                rowKey="id"
                size="small"
                className="custom-zoho-table"
                pagination={{ pageSize: 20, size: "small", className: "px-3 py-1.5" }}
                onRow={(record) => ({
                  onClick: () => setSelectedTicket(record),
                  className: "cursor-pointer hover:bg-slate-50/80 transition-colors text-xs"
                })}
                columns={[
                  {
                    title: "Ticket Code",
                    key: "code",
                    width: 140,
                    render: (_, tkt) => (
                      <span className="font-mono font-bold text-[11px] text-accent-700 bg-surface-sunken px-2 py-0.5 rounded border border-line">
                        {getFormattedTicketCode(tkt)}
                      </span>
                    )
                  },
                  {
                    title: "Employee",
                    dataIndex: "createdByName",
                    key: "createdByName",
                    width: 160,
                    render: (name, tkt) => (
                      <div className="flex items-center gap-1.5">
                        <Avatar size={22} className="bg-accent-100 text-accent-700 font-bold text-[10px]">
                          {name ? name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                        <div>
                          <div className="font-bold text-xs text-ink-900 leading-tight">{name || "Employee"}</div>
                          <div className="font-mono text-[9.5px] text-accent-700">{tkt.createdByCode || tkt.created_by_code}</div>
                        </div>
                      </div>
                    )
                  },
                  {
                    title: "Category",
                    dataIndex: "concernType",
                    key: "concernType",
                    width: 110,
                    render: (cat, tkt) => (
                      <span className="font-bold text-[9.5px] uppercase bg-slate-100 text-ink-700 px-1.5 py-0.5 rounded border border-slate-200">
                        {cat || tkt.concern_type || "Expense"}
                      </span>
                    )
                  },
                  {
                    title: "Description",
                    dataIndex: "description",
                    key: "description",
                    ellipsis: true,
                    render: (d) => <span className="text-xs font-medium text-ink-800">{d}</span>
                  },
                  {
                    title: "Status Update",
                    key: "status_update",
                    width: 120,
                    render: (_, tkt) => (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={tkt.status || "Open"}
                          onChange={async (newStat) => {
                            try {
                              const updated = await ticketService.updateTicketStatus(tkt.id, newStat);
                              toast.success(`Status updated to ${newStat}`);
                              setTickets(prev => prev.map(x => x.id === tkt.id ? updated : x));
                            } catch(e) {
                              toast.error("Failed to update status");
                            }
                          }}
                          size="small"
                          className="w-28 text-xs font-bold"
                          options={[
                            { label: "🟡 Open", value: "Open" },
                            { label: "🟣 In Progress", value: "In Progress" },
                            { label: "🟢 Resolved", value: "Resolved" },
                            { label: "⚫ Closed", value: "Closed" }
                          ]}
                        />
                      </div>
                    )
                  }
                ]}
              />
            </div>
          </div>
        )}

      </div>

      {/* ── 4. Compact Raise Ticket Modal ─────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-sm font-black text-ink-900">
            <Plus size={16} className="text-accent-600" />
            <span>Raise Support Ticket</span>
          </div>
        }
        open={isRaiseModalOpen}
        onCancel={() => setIsRaiseModalOpen(false)}
        footer={null}
        destroyOnClose={true}
        centered
        width={480}
      >
        <form onSubmit={handleCreateTicket} className="space-y-3 pt-2 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">Category *</label>
            <Select
              value={concernType}
              onChange={(val) => setConcernType(val)}
              className="w-full text-xs"
              options={[
                { label: "💳 Expense & Reimbursement Deduction", value: "Expense" },
                { label: "⚙️ App Glitch / Technical Issue", value: "Technical" },
                { label: "🏥 Hospital Calls & Sign-off Slips", value: "Hospital Calls" },
                { label: "🏷️ Equipment Barcode & Asset Tagging", value: "Asset Tagging" },
                { label: "📄 Other Concern", value: "Other" }
              ]}
            />
          </div>

          {concernType === "Expense" && myExpenses.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">Linked Expense Claim</label>
              <Select
                value={selectedExpenseId}
                onChange={(val) => setSelectedExpenseId(val)}
                placeholder="Select expense claim (optional)..."
                className="w-full text-xs"
                allowClear
                options={myExpenses.map(exp => ({
                  label: `${exp.expense_code || exp.id} — ${exp.date || exp.month || ''} (₹${exp.amount || 0})`,
                  value: String(exp.id || exp.expense_id)
                }))}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">Assign To *</label>
            <Select
              value={assignedToName || (currentUser?.coordinator || currentUser?.manager || "Operations Coordinator")}
              onChange={(val) => setAssignedToName(val)}
              className="w-full text-xs"
              options={[
                { label: `🛡️ Coordinator ${currentUser?.coordinator ? `(${currentUser.coordinator})` : ''}`, value: currentUser?.coordinator || "Operations Coordinator" },
                { label: `👤 Reporting Manager ${currentUser?.manager ? `(${currentUser.manager})` : ''}`, value: currentUser?.manager || "Reporting Manager" },
                ...(currentUser?.zonal_manager ? [{ label: `🏛️ Zonal Manager (${currentUser.zonal_manager})`, value: currentUser.zonal_manager }] : []),
                { label: "⚙️ System Admin / Tech Desk", value: "System Admin" }
              ]}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {["Low", "Medium", "High"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    priority === p
                      ? "bg-accent-600 text-white border-accent-600"
                      : "bg-surface-sunken border-line text-ink-600 hover:bg-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">Description *</label>
            <Input.TextArea
              rows={3}
              placeholder="Explain the issue clearly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg text-xs"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRaiseModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-sunken text-ink-600 hover:bg-white border border-line cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={raising}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-accent-600 hover:bg-accent-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
            >
              {raising ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              <span>{raising ? "Submitting..." : "Submit Ticket"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 5. Enterprise Live Complaint Chat & Lifecycle Drawer Modal ──── */}
      <Modal
        open={!!selectedTicket}
        destroyOnClose={true}
        onCancel={() => setSelectedTicket(null)}
        width={560}
        centered
        footer={null}
        styles={{ body: { padding: 0 } }}
      >
        {selectedTicket && (
          <div className="bg-white rounded-xl overflow-hidden text-left flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-[#F8FAFC] border-b border-line px-4 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-accent-700 bg-white px-2 py-0.5 rounded border border-line">
                    {getFormattedTicketCode(selectedTicket)}
                  </span>
                  <span className="font-bold text-[10px] uppercase bg-slate-100 text-ink-700 px-2 py-0.5 rounded border border-slate-200">
                    {selectedTicket.concernType || selectedTicket.concern_type}
                  </span>
                  <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                    (selectedTicket.status || "").toLowerCase() === "resolved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : (selectedTicket.status || "").toLowerCase() === "in progress"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : (selectedTicket.status || "").toLowerCase() === "closed"
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}>
                    ● {selectedTicket.status || "Open"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
                  <span>By <b>{selectedTicket.createdByName || selectedTicket.created_by_name || "Employee"}</b></span>
                  <span>•</span>
                  <span>Assigned: <b>{selectedTicket.assignedToName || selectedTicket.assigned_to_name || "Coordinator"}</b></span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="w-7 h-7 rounded-lg bg-surface-sunken hover:bg-slate-200 text-ink-600 flex items-center justify-center cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Complaint Lifecycle Action Toolbar */}
            <div className="px-4 py-2 bg-[#F1F5F9] border-b border-line flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* In Progress button */}
                {(selectedTicket.status === "Open" || selectedTicket.status === "Re-opened") && (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange("In Progress")}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Clock size={12} />
                    <span>Start Investigation</span>
                  </button>
                )}

                {/* Resolve button */}
                {selectedTicket.status !== "Resolved" && selectedTicket.status !== "Closed" && (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange("Resolved", "Issue resolved as per verification.")}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check size={12} />
                    <span>Mark Resolved</span>
                  </button>
                )}

                {/* Close button */}
                {selectedTicket.status !== "Closed" && (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange("Closed", "Ticket closed.")}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Close</span>
                  </button>
                )}

                {/* Reopen button */}
                {(selectedTicket.status === "Closed" || selectedTicket.status === "Resolved") && (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange("Re-opened", "Ticket reopened by user for clarification.")}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw size={12} />
                    <span>Reopen Ticket</span>
                  </button>
                )}
              </div>

              {/* Reassign dropdown (for Coordinators / Admins) */}
              {isCoordinatorOrAdmin && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-ink-500 uppercase">Reassign:</span>
                  <Select
                    size="small"
                    value={selectedTicket.assignedToName || selectedTicket.assigned_to_name || "Coordinator"}
                    onChange={(val) => handleReassign(val)}
                    className="w-32 text-xs"
                    options={[
                      { label: "Coordinator", value: "Coordinator" },
                      { label: "Reporting Manager", value: "Reporting Manager" },
                      { label: "System Admin", value: "System Admin" }
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Description Box */}
            <div className="p-3 bg-[#FAFAF9] border-b border-line">
              <span className="text-[10px] font-bold uppercase text-ink-400 block mb-0.5">Issue Description</span>
              <p className="text-xs font-semibold text-ink-800 leading-relaxed bg-white p-2.5 rounded-lg border border-line shadow-2xs">
                {selectedTicket.description}
              </p>
            </div>

            {/* Quick Resolution Response Chips */}
            <div className="px-3 py-1.5 bg-white border-b border-line flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider shrink-0">Quick Reply:</span>
              <button
                type="button"
                onClick={() => handleAddComment("✅ Issue verified and updated in system.")}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-surface-sunken hover:bg-accent-50 text-ink-700 hover:text-accent-800 border border-line whitespace-nowrap cursor-pointer"
              >
                ✅ Verified &amp; Updated
              </button>
              <button
                type="button"
                onClick={() => handleAddComment("📸 Please re-upload clear odometer reading photo.")}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-surface-sunken hover:bg-accent-50 text-ink-700 hover:text-accent-800 border border-line whitespace-nowrap cursor-pointer"
              >
                📸 Re-upload Photo
              </button>
              <button
                type="button"
                onClick={() => handleAddComment("📏 Monthly KM Limit extension sanctioned.")}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-surface-sunken hover:bg-accent-50 text-ink-700 hover:text-accent-800 border border-line whitespace-nowrap cursor-pointer"
              >
                📏 Limit Sanctioned
              </button>
            </div>

            {/* Message Thread (WhatsApp / Zoho Desk Bubble Stream) */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/70 min-h-[180px] max-h-[300px]">
              {parsedMessages.length > 0 ? (
                parsedMessages.map((msg, idx) => {
                  if (msg.isStatusChange) {
                    return (
                      <div key={idx} className="flex justify-center my-1">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300">
                          ℹ️ {msg.sender}: {msg.text} {msg.time ? `(${msg.time})` : ''}
                        </span>
                      </div>
                    );
                  }

                  const isMe = msg.sender.toLowerCase() === (currentUser?.name || "").toLowerCase() ||
                               msg.sender.toLowerCase().includes(String(currentUser?.user_id || "").toLowerCase());

                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1 mb-0.5 px-1">
                        <span className="text-[10.5px] font-bold text-ink-700">{msg.sender}</span>
                        {msg.time && <span className="text-[9.5px] text-ink-400">({msg.time})</span>}
                      </div>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-2xs ${
                        isMe 
                          ? "bg-accent-600 text-white font-medium rounded-tr-xs" 
                          : "bg-white border border-line text-ink-900 rounded-tl-xs"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-ink-400">
                  No comments yet. Type a reply below to update this complaint.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUser && (
              <div className="px-3 py-1 text-[10px] text-accent-700 italic bg-accent-50/70 border-t border-accent-100">
                ✍️ {typingUser} is typing...
              </div>
            )}

            {/* Input Box */}
            <div className="p-2.5 bg-white border-t border-line flex items-center gap-2">
              <Input
                size="middle"
                placeholder="Type a message or response..."
                value={newComment}
                onChange={(e) => handleInputChange(e.target.value)}
                onPressEnter={() => handleAddComment()}
                disabled={commenting}
                className="rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddComment()}
                disabled={commenting || !newComment.trim()}
                className="h-8 px-3.5 rounded-lg bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
              >
                {commenting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Send</span>
              </button>
            </div>

          </div>
        )}
      </Modal>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-line text-xs font-medium text-ink-400 text-center">
        <span>Designed &amp; Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer" className="text-accent-700 font-bold hover:underline">Sunil Bishnoi</a></span>
      </div>

    </div>
  );
}
