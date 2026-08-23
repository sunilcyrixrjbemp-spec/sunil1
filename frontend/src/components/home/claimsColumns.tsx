// ── Status helpers (matching ExpensePage) ─────────────────────────────────────

export const renderAntdStatusTag = (status: string) => {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "auto_approved":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">⚡ Auto Approved</span>;
    case "approved":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">Approved</span>;
    case "rejected":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 uppercase tracking-wider">Rejected</span>;
    case "returned_to_draft":
    case "returned":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200 uppercase tracking-wider">Returned</span>;
    case "submitted":
    case "pending":
    case "submitted_l1":
    case "pending_l1":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">Pending L1</span>;
    case "submitted_l2":
    case "pending_l2":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 uppercase tracking-wider">Pending L2</span>;
    case "submitted_l3":
    case "pending_l3":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase tracking-wider">Pending L3</span>;
    case "draft":
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">Draft</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">{(status || "Draft").toUpperCase()}</span>;
  }
};

export const getStatusBadgeClass = (status: string): string => {
  const s = (status || "").toLowerCase().trim();
  if (s === "approved" || s === "auto_approved") return "bg-emerald-50 border-emerald-300 text-emerald-800 font-extrabold";
  if (s === "rejected") return "bg-rose-50 border-rose-300 text-rose-700 font-extrabold";
  if (s === "returned_to_draft" || s === "returned") return "bg-amber-100 border-amber-300 text-amber-900 font-extrabold";
  if (s.startsWith("submitted") || s.startsWith("pending")) return "bg-amber-50 border-amber-300 text-amber-900 font-black";
  return "bg-slate-100 border-slate-300 text-slate-700 font-bold";
};

export const getStatusLabel = (status: string): string => {
  const s = (status || "").toLowerCase().trim();
  if (s === "auto_approved") return "⚡ Auto Approved";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "returned_to_draft" || s === "returned") return "Returned";
  if (s === "submitted" || s === "submitted_l1" || s === "pending") return "Pending L1";
  if (s.startsWith("submitted_l")) return `Pending L${s.replace("submitted_l", "").toUpperCase()}`;
  if (s.startsWith("pending_l")) return `Pending L${s.replace("pending_l", "").toUpperCase()}`;
  if (s === "draft") return "Draft";
  return (status || "").toUpperCase();
};

export const getCardStatusClass = (status: string): string => {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("approve") || s.includes("approved")) {
    return "border-l-4 border-l-emerald-600 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 cursor-pointer transition-all rounded-lg p-3.5 shadow-2xs";
  }
  if (s.includes("reject") || s.includes("rejected")) {
    return "border-l-4 border-l-rose-600 border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 cursor-pointer transition-all rounded-lg p-3.5 shadow-2xs";
  }
  if (s.includes("pending") || s.includes("submitted") || s.includes("return")) {
    return "border-l-4 border-l-amber-500 border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 cursor-pointer transition-all rounded-lg p-3.5 shadow-2xs";
  }
  return "border-l-4 border-l-slate-400 border border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 cursor-pointer transition-all rounded-lg p-3.5 shadow-2xs";
};

// ── Date formatter ────────────────────────────────────────────────────────────

export const formatDateDDMMMYY = (dateStr: string): string => {
  if (!dateStr) return "—";
  const cleanStr = String(dateStr).trim().split(" ")[0].split("T")[0];
  const parts = cleanStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parts[0].slice(-2);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, "0");
      if (monthIdx >= 0 && monthIdx < 12) return `${day}-${months[monthIdx]}-${year}`;
    } else if (parts[2].length === 4) {
      const year = parts[2].slice(-2);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[0].padStart(2, "0");
      if (monthIdx >= 0 && monthIdx < 12) return `${day}-${months[monthIdx]}-${year}`;
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()))
    return `${String(d.getDate()).padStart(2,"0")}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  return dateStr;
};

// ── Compact Enterprise Columns (Matches ExpensePage lightweight design) ──────

export const getEnterpriseClaimsColumns = (_currentUser?: any, activeTab: "my-claims" | "team-claims" = "my-claims") => {
  if (activeTab === "team-claims") {
    return [
      {
        title: "ENGINEER",
        key: "engineer",
        width: "24%",
        render: (_: any, record: any) => {
          const name = record.submitter_name || record.engineer_name || "Engineer";
          const code = record.submitter_code || record.emp_code || "";
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={name}>{name}</span>
              {code && <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0">({code})</span>}
            </div>
          );
        },
      },
      {
        title: "CLAIM ID",
        dataIndex: "expense_code",
        key: "expense_code",
        width: "16%",
        render: (text: string, record: any) => (
          <span className="font-mono font-bold text-indigo-600 text-xs tracking-tight whitespace-nowrap">
            {text || record.claim_id || `#${record.id}`}
          </span>
        ),
      },
      {
        title: "DATE",
        key: "date",
        width: "14%",
        render: (_: any, record: any) => (
          <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
            {formatDateDDMMMYY(record.date || record.itinerary || record.created_at)}
          </span>
        ),
      },
      {
        title: "DISTRICT",
        key: "district",
        width: "18%",
        render: (_: any, record: any) => {
          const dist = record.district || record.submitter_district || record.zone || "—";
          return (
            <span className="text-xs text-slate-700 font-medium truncate block max-w-[140px]" title={dist}>
              {dist}
            </span>
          );
        },
      },
      {
        title: "AMOUNT",
        key: "amount",
        width: "14%",
        align: "right" as const,
        render: (_: any, record: any) => {
          const amt = record.amount != null ? record.amount : (record.total_amount || 0);
          return (
            <span className="text-xs font-black font-mono text-blue-700 whitespace-nowrap">
              ₹{Number(amt).toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        title: "STATUS",
        dataIndex: "status",
        key: "status",
        width: "14%",
        align: "center" as const,
        render: (status: string) => renderAntdStatusTag(status),
      },
    ];
  }

  // My Claims tab columns (Clean 6 columns, same as ExpensePage)
  return [
    {
      title: "CLAIM ID",
      dataIndex: "expense_code",
      key: "expense_code",
      width: "18%",
      render: (text: string, record: any) => (
        <span className="font-mono font-bold text-indigo-600 text-xs tracking-tight whitespace-nowrap">
          {text || record.claim_id || `#${record.id}`}
        </span>
      ),
    },
    {
      title: "DATE",
      key: "date",
      width: "14%",
      render: (_: any, record: any) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {formatDateDDMMMYY(record.date || record.itinerary || record.created_at)}
        </span>
      ),
    },
    {
      title: "PURPOSE",
      dataIndex: "description",
      key: "purpose",
      width: "36%",
      render: (text: string, record: any) => {
        const desc = text || record.purpose || "Field visit & operational claim";
        return (
          <span className="text-xs font-medium text-slate-700 truncate max-w-[320px] block" title={desc}>
            {desc}
          </span>
        );
      },
    },
    {
      title: "MODE",
      key: "travel_mode",
      width: "10%",
      render: (_: any, record: any) => {
        const mode = record.travel_mode || record.category || "Bike";
        return (
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            {mode}
          </span>
        );
      },
    },
    {
      title: "AMOUNT",
      key: "amount",
      width: "11%",
      align: "right" as const,
      render: (_: any, record: any) => {
        const amt = record.amount != null ? record.amount : (record.total_amount || 0);
        return (
          <span className="text-xs font-black font-mono text-blue-700 whitespace-nowrap">
            ₹{Number(amt).toLocaleString("en-IN")}
          </span>
        );
      },
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "11%",
      align: "center" as const,
      render: (status: string) => renderAntdStatusTag(status),
    },
  ];
};
