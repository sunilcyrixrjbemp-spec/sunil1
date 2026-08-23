import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { expenseService } from "../services/expenseService";
import { approvalService } from "../services/approvalService";
import toast from "react-hot-toast";
import { prefetchManager } from "../utils/prefetchManager";
import { safeStorageSetItem } from "../utils/safeStorage";
import { getISTMonth } from "../utils/dateUtils";
import { hasFullAccess } from "../utils/constants";

const cleanZone = (z: string) => (z || "").trim().replace(/\s*[Zz]one\s*$/i, "").toLowerCase();

export function useHomeExpenses() {
  const navigate = useNavigate();

  // ── Auth / User ───────────────────────────────────────────────────────────
  const [user, setUser] = useState<any>(() => JSON.parse(localStorage.getItem("user") || "null"));

  // ── Expenses data ─────────────────────────────────────────────────────────
  const [myExpenses, setMyExpenses] = useState<any[]>(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return [];
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_my_expenses_${u.user_id}_${curMonth}`) || localStorage.getItem(`cache_my_expenses_${u.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });

  const [historicalExpenses, setHistoricalExpenses] = useState<any[]>(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return [];
    const cached = localStorage.getItem(`cache_historical_expenses_${u.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });

  const [teamExpenses, setTeamExpenses] = useState<any[]>(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return [];
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_team_expenses_${u.user_id}_${curMonth}`) || localStorage.getItem(`cache_team_expenses_${u.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });

  const [historicalTeamExpenses, setHistoricalTeamExpenses] = useState<any[]>(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return [];
    const cached = localStorage.getItem(`cache_historical_team_expenses_${u.user_id}`);
    return cached ? JSON.parse(cached) : [];
  });

  const [allowanceStats, setAllowanceStats] = useState<any>(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return null;
    const curMonth = getISTMonth();
    const cached = localStorage.getItem(`cache_allowance_stats_${u.user_id}_${curMonth}`) || localStorage.getItem(`cache_allowance_stats_${u.user_id}`);
    return cached ? JSON.parse(cached) : null;
  });

  const [loadingMyExpenses, setLoadingMyExpenses] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return false;
    const curMonth = getISTMonth();
    return !localStorage.getItem(`cache_my_expenses_${u.user_id}_${curMonth}`) && !localStorage.getItem(`cache_my_expenses_${u.user_id}`);
  });

  const [loadingTeamExpenses, setLoadingTeamExpenses] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return false;
    const curMonth = getISTMonth();
    return !localStorage.getItem(`cache_team_expenses_${u.user_id}_${curMonth}`) && !localStorage.getItem(`cache_team_expenses_${u.user_id}`);
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"my-claims" | "team-claims">(() => {
    const saved = localStorage.getItem("dashboard_active_tab");
    if (saved === "my-claims" || saved === "team-claims") return saved;
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (u && hasFullAccess(u.role)) return "team-claims";
    return "my-claims";
  });

  const handleTabChange = useCallback((tab: "my-claims" | "team-claims") => {
    setActiveTab(tab);
    localStorage.setItem("dashboard_active_tab", tab);
  }, []);

  // ── Approvals counts ──────────────────────────────────────────────────────
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return 0;
    const cached = localStorage.getItem(`cache_approvals_count_${u.user_id}`);
    return cached ? parseInt(cached) || 0 : 0;
  });
  const [pendingLimitRequestsCount, setPendingLimitRequestsCount] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (!u) return 0;
    const cached = localStorage.getItem(`cache_limit_approvals_count_${u.user_id}`);
    return cached ? parseInt(cached) || 0 : 0;
  });

  // ── Modal / lightbox states ───────────────────────────────────────────────
  const [_selectedClaimId, setSelectedClaimId] = useState<number | string | null>(null);
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [_loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [comments, setComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalType, setStatsModalType] = useState<"Total Claimed" | "Approved" | "Pending" | "Returned" | "Rejected">("Total Claimed");
  const [statsModalClaims, setStatsModalClaims] = useState<any[]>([]);

  const [homeClaimsPageSize, setHomeClaimsPageSize] = useState(25);
  const [homeTeamPageSize, setHomeTeamPageSize] = useState(25);
  const [homeModalPageSize, setHomeModalPageSize] = useState(15);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showPageScrollTop, setShowPageScrollTop] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterZone, setFilterZone] = useState<string>("all");
  const [selectMonth, setSelectMonth] = useState<string>(() => getISTMonth());
  const [homeStatusFilter, setHomeStatusFilter] = useState<"all" | "pending" | "returned" | "approved" | "rejected">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchClaimId, setSearchClaimId] = useState<string>("");

  // ── Lazy team-fetch gate ──────────────────────────────────────────────────
  const teamFetchedRef = useRef(false);

  // Reset filter pages when filters change
  const [_teamPage, setTeamPage] = useState<number>(1);
  const [_personalPage, setPersonalPage] = useState<number>(1);

  useEffect(() => {
    setTeamPage(1);
    setPersonalPage(1);
  }, [filterEmployee, filterDistrict, selectMonth, homeStatusFilter, filterZone]);

  useEffect(() => { setFilterDistrict("all"); setFilterEmployee("all"); }, [filterZone]);
  useEffect(() => { setFilterEmployee("all"); }, [filterDistrict]);

  // ── Scroll-to-top button ──────────────────────────────────────────────────
  useEffect(() => {
    let frameId: number | null = null;
    const handlePageScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const shouldShow = window.scrollY > 300;
        setShowPageScrollTop(prev => prev === shouldShow ? prev : shouldShow);
      });
    };
    window.addEventListener("scroll", handlePageScroll, { passive: true });
    return () => { if (frameId) cancelAnimationFrame(frameId); window.removeEventListener("scroll", handlePageScroll); };
  }, []);

  // ── Role helpers (derived from user) ──────────────────────────────────────
  const allowedWindows = useMemo(() => {
    return user?.allowed_windows
      ? user.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
      : ["home", "profile", "help"];
  }, [user]);

  const userRoleLower = (user?.role || "").trim().toLowerCase();
  const isSpecialViewRole = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(userRoleLower);
  const isReviewerRole = useMemo(() => allowedWindows.includes("approval") || isSpecialViewRole, [allowedWindows, isSpecialViewRole]);

  // ── Safe arrays ───────────────────────────────────────────────────────────
  const safeMyExpenses = useMemo(() => Array.isArray(myExpenses) ? myExpenses : [], [myExpenses]);
  const safeTeamExpenses = useMemo(() => Array.isArray(teamExpenses) ? teamExpenses : [], [teamExpenses]);

  // ── Search matcher (stable function) ─────────────────────────────────────
  const matchClaimSearch = useCallback((exp: any, searchStr: string): boolean => {
    if (!searchStr || !searchStr.trim()) return true;
    const q = searchStr.trim().toLowerCase();
    const code = String(exp.expense_code || exp.claim_id || exp.id || "").toLowerCase();
    if (code.includes(q)) return true;
    const codeDigitsOnly = code.replace(/\D/g, "");
    const qDigitsOnly = q.replace(/\D/g, "");
    if (qDigitsOnly && codeDigitsOnly.includes(qDigitsOnly)) return true;
    const parts = code.split(/[-/]/);
    const lastPart = parts[parts.length - 1] || "";
    if (lastPart.includes(q)) return true;
    if (lastPart.replace(/^0+/, "").includes(q.replace(/^0+/, ""))) return true;
    const name = String(exp.submitter_name || exp.user_name || exp.engineer_name || "").toLowerCase();
    if (name.includes(q)) return true;
    const empCode = String(exp.submitter_code || exp.emp_code || exp.user_code || "").toLowerCase();
    if (empCode.includes(q)) return true;
    const desc = String(exp.description || exp.purpose || "").toLowerCase();
    if (desc.includes(q)) return true;
    return false;
  }, []);

  // ── MEMOIZED filtered lists ───────────────────────────────────────────────
  const filteredPersonalExpenses = useMemo(() => {
    return safeMyExpenses
      .filter(exp => {
        if (!exp) return false;
        const rawDate = exp.itinerary || exp.date;
        if (!(rawDate && rawDate.startsWith(selectMonth))) return false;
        if (fromDate && rawDate < fromDate) return false;
        if (toDate && rawDate > toDate) return false;
        if (!matchClaimSearch(exp, searchClaimId)) return false;
        if (homeStatusFilter !== "all") {
          const s = (exp.status || "").toLowerCase();
          if (homeStatusFilter === "pending" && !(s.startsWith("submitted") || s === "pending" || s === "draft" || s === "under_review")) return false;
          if (homeStatusFilter === "returned" && !(s.includes("return") || s === "revision" || s === "need_revision" || s === "send_back")) return false;
          if (homeStatusFilter === "approved" && !(s === "approved" || s === "auto_approved" || s === "paid")) return false;
          if (homeStatusFilter === "rejected" && !(s === "rejected" || s.includes("reject"))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.itinerary || a.date || a.created_at || "";
        const dateB = b.itinerary || b.date || b.created_at || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
  }, [safeMyExpenses, selectMonth, fromDate, toDate, searchClaimId, homeStatusFilter, matchClaimSearch]);

  const filteredTeamExpenses = useMemo(() => {
    return safeTeamExpenses
      .filter(exp => {
        const rawDate = exp.date || exp.itinerary;
        if (rawDate && !rawDate.startsWith(selectMonth)) return false;
        if (fromDate && rawDate < fromDate) return false;
        if (toDate && rawDate > toDate) return false;
        if (!matchClaimSearch(exp, searchClaimId)) return false;
        if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
        if (filterDistrict !== "all") {
          const expDist = String(exp.district || exp.submitter_district || exp.home_district || exp.from_district || "").trim();
          if (expDist.toLowerCase() !== filterDistrict.trim().toLowerCase()) return false;
        }
        if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
        if (homeStatusFilter !== "all") {
          const s = (exp.status || "").toLowerCase();
          if (homeStatusFilter === "pending" && !(s.startsWith("submitted") || s === "pending" || s === "draft" || s === "under_review")) return false;
          if (homeStatusFilter === "returned" && !(s.includes("return") || s === "revision" || s === "need_revision" || s === "send_back")) return false;
          if (homeStatusFilter === "approved" && !(s === "approved" || s === "auto_approved" || s === "paid")) return false;
          if (homeStatusFilter === "rejected" && !(s === "rejected" || s.includes("reject"))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.itinerary || a.date || a.created_at || "";
        const dateB = b.itinerary || b.date || b.created_at || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
  }, [safeTeamExpenses, selectMonth, fromDate, toDate, searchClaimId, filterZone, filterDistrict, filterEmployee, homeStatusFilter, matchClaimSearch]);

  // ── MEMOIZED stats (no status filter, just date/zone/emp) ────────────────
  const statsBasePersonalExpenses = useMemo(() => safeMyExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.itinerary || exp.date;
    if (fromDate && rawDate && rawDate < fromDate) return false;
    if (toDate && rawDate && rawDate > toDate) return false;
    if (!fromDate && !toDate && selectMonth && rawDate && !rawDate.startsWith(selectMonth)) return false;
    if (!matchClaimSearch(exp, searchClaimId)) return false;
    return true;
  }), [safeMyExpenses, fromDate, toDate, selectMonth, searchClaimId, matchClaimSearch]);

  const statsBaseTeamExpenses = useMemo(() => safeTeamExpenses.filter(exp => {
    if (!exp) return false;
    const rawDate = exp.date || exp.itinerary;
    if (fromDate && rawDate && rawDate < fromDate) return false;
    if (toDate && rawDate && rawDate > toDate) return false;
    if (!fromDate && !toDate && selectMonth && rawDate && !rawDate.startsWith(selectMonth)) return false;
    if (filterZone !== "all" && cleanZone(exp.zone) !== cleanZone(filterZone)) return false;
    if (filterDistrict !== "all") {
      const expDist = String(exp.district || exp.submitter_district || exp.home_district || exp.from_district || "").trim();
      if (expDist.toLowerCase() !== filterDistrict.trim().toLowerCase()) return false;
    }
    if (filterEmployee !== "all" && String(exp.submitter_code || "").trim().toLowerCase() !== filterEmployee.trim().toLowerCase()) return false;
    if (!matchClaimSearch(exp, searchClaimId)) return false;
    return true;
  }), [safeTeamExpenses, fromDate, toDate, selectMonth, filterZone, filterDistrict, filterEmployee, searchClaimId, matchClaimSearch]);

  const statsClaimsList = activeTab === "my-claims" ? statsBasePersonalExpenses : statsBaseTeamExpenses;

  const statsTotalClaims = statsClaimsList;
  const statsApprovedClaims = useMemo(() => statsClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s === "approved" || s === "auto_approved" || s === "paid";
  }), [statsClaimsList]);
  const statsRejectedClaims = useMemo(() => statsClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s === "rejected" || s.includes("reject");
  }), [statsClaimsList]);
  const statsPendingClaims = useMemo(() => statsClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s.startsWith("submitted") || s === "pending" || s === "draft" || s === "under_review";
  }), [statsClaimsList]);
  const statsReturnedClaims = useMemo(() => statsClaimsList.filter(c => {
    const s = c.status?.toLowerCase() || "";
    return s.includes("return") || s === "revision" || s === "need_revision" || s === "send_back";
  }), [statsClaimsList]);

  const getStatsSums = useCallback((list: any[]) =>
    list.filter(c => c.category !== "Limit Request")
      .reduce((sum, c) => sum + (parseFloat(c.amount || c.total_amount || c.approved_amount || 0) || 0), 0),
  []);

  const totalAmount = useMemo(() => getStatsSums(statsTotalClaims), [statsTotalClaims, getStatsSums]);
  const approvedAmount = useMemo(() => getStatsSums(statsApprovedClaims), [statsApprovedClaims, getStatsSums]);
  const pendingAmount = useMemo(() => getStatsSums(statsPendingClaims), [statsPendingClaims, getStatsSums]);
  const returnedAmount = useMemo(() => getStatsSums(statsReturnedClaims), [statsReturnedClaims, getStatsSums]);
  const rejectedAmount = useMemo(() => getStatsSums(statsRejectedClaims), [statsRejectedClaims, getStatsSums]);

  // ── MEMOIZED zone/district/employee filter options ────────────────────────
  const uniqueDistricts = useMemo(() => {
    const districtsSet = new Set<string>();
    safeTeamExpenses.forEach(exp => {
      if (!exp) return;
      const expZone = exp.zone || "";
      if (filterZone === "all" || cleanZone(expZone) === cleanZone(filterZone)) {
        const d = exp.district || exp.submitter_district || exp.home_district || exp.from_district || "";
        const cleanDist = String(d).trim();
        if (cleanDist && cleanDist.toLowerCase() !== "unknown") districtsSet.add(cleanDist);
      }
    });
    return Array.from(districtsSet).sort((a, b) => a.localeCompare(b));
  }, [safeTeamExpenses, filterZone]);

  const uniqueEmployees = useMemo(() => {
    const empMap = new Map<string, string>();
    safeTeamExpenses.forEach(exp => {
      if (!exp || !exp.submitter_code || !exp.submitter_name) return;
      const expZone = exp.zone || "";
      const expDist = exp.district || exp.submitter_district || exp.home_district || exp.from_district || "";
      const matchesZone = filterZone === "all" || cleanZone(expZone) === cleanZone(filterZone);
      const matchesDistrict = filterDistrict === "all" || String(expDist).trim().toLowerCase() === filterDistrict.trim().toLowerCase();
      if (matchesZone && matchesDistrict) empMap.set(String(exp.submitter_code), String(exp.submitter_name));
    });
    return Array.from(empMap.entries())
      .map(([code, name]) => ({ code: String(code), name: String(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [safeTeamExpenses, filterZone, filterDistrict]);

  const uniqueZones = useMemo(() => {
    const currentUserObj = JSON.parse(localStorage.getItem("user") || "null") || user;
    const effectiveRole = (currentUserObj?.role || "").trim().toLowerCase();
    const isGlobalAdmin = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(effectiveRole);
    const userZoneRaw = currentUserObj?.zone || "";
    const userZonesList = userZoneRaw ? userZoneRaw.split(",").map((z: string) => cleanZone(z)).filter(Boolean) : [];
    const allPossibleZones = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Udaipur"];
    const dataZones = Array.from(new Set(safeTeamExpenses.map(e => {
      const raw = (e.zone || "").trim();
      return raw ? raw.replace(/\s*[Zz]one\s*$/i, "") : "Unassigned Zone";
    }).filter(Boolean)));
    const allAvailableZones = Array.from(new Set([...allPossibleZones, ...dataZones])).sort((a, b) => a.localeCompare(b));
    if (!isGlobalAdmin && userZonesList.length > 0) {
      const filtered = allAvailableZones.filter(z => userZonesList.includes(cleanZone(z)));
      return filtered.length > 0 ? filtered : userZonesList;
    }
    return allAvailableZones;
  }, [safeTeamExpenses, user]);

  // ── normalizeClaimObject helper ───────────────────────────────────────────
  const normalizeClaimObject = useCallback((raw: any, basicClaim?: any) => {
    if (!raw) return null;
    let legs: any[] = [];
    const parseCandidate = (cand: any) => {
      if (!cand) return [];
      if (Array.isArray(cand)) return cand;
      if (typeof cand === "string") {
        const trimmed = cand.trim();
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          try {
            let p = JSON.parse(trimmed);
            if (typeof p === "string") try { p = JSON.parse(p); } catch (e) {}
            if (Array.isArray(p)) return p;
            if (p && typeof p === "object") {
              if (Array.isArray(p.legs)) return p.legs;
              if (Array.isArray(p.itineraries)) return p.itineraries;
              return [p];
            }
          } catch (e) {}
        }
      }
      if (cand && typeof cand === "object") {
        if (Array.isArray(cand.legs)) return cand.legs;
        if (Array.isArray(cand.itineraries)) return cand.itineraries;
        return [cand];
      }
      return [];
    };

    const sources = [raw.itineraries, raw.legs, raw.itinerary_list, raw.itinerary, basicClaim?.itineraries, basicClaim?.legs, basicClaim?.itinerary_list, basicClaim?.itinerary];
    for (const src of sources) {
      const res = parseCandidate(src);
      if (res.length > 0) {
        legs = res;
        break;
      }
    }

    const rawDate = raw.date || basicClaim?.date || (typeof raw.itinerary === "string" && !raw.itinerary.trim().startsWith("[") && !raw.itinerary.trim().startsWith("{") ? raw.itinerary : "");

    return {
      ...raw,
      submitter_name: raw.submitter_name || basicClaim?.submitter_name || user?.name || "",
      submitter_code: raw.submitter_code || basicClaim?.submitter_code || user?.user_id || "",
      zone: raw.zone || raw.submitter_zone || raw.user_zone || basicClaim?.zone || basicClaim?.submitter_zone || "",
      home_district: raw.home_district || raw.district || raw.submitter_district || basicClaim?.submitter_district || basicClaim?.home_district || "",
      designation: raw.designation || raw.submitter_designation || basicClaim?.submitter_designation || basicClaim?.designation || "",
      category: raw.category || raw.travel_mode || basicClaim?.category || "Travel",
      date: rawDate,
      purpose: raw.purpose || raw.description || basicClaim?.purpose || "",
      itineraries: legs,
      legs: legs,
      itinerary: raw.itinerary || basicClaim?.itinerary || legs,
      edit_history: raw.edit_history || raw.editHistory || raw.edit_logs || raw.logs || basicClaim?.edit_history || [],
    };
  }, [user]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const refreshDashboardData = useCallback(async (forceTeam = false) => {
    const currentUser = authService.getCurrentUser() || user;
    if (!currentUser) return;
    const uId = currentUser.user_id;
    const allowedW = currentUser.allowed_windows
      ? currentUser.allowed_windows.split(",").map((w: string) => w.trim().toLowerCase())
      : ["home", "profile", "help"];
    const roleLower = (currentUser.role || "").trim().toLowerCase();
    const isSpecial = ["admin", "project head", "mis", "travel desk", "travel tesk", "vp", "accountant", "hr"].includes(roleLower);
    const isReviewer = allowedW.includes("approval") || isSpecial;

    // Instant cache hydration for selected month
    const cachedMy = localStorage.getItem(`cache_my_expenses_${uId}_${selectMonth}`);
    if (cachedMy) {
      try {
        const parsed = JSON.parse(cachedMy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMyExpenses(parsed);
          setLoadingMyExpenses(false);
        }
      } catch {}
    }
    const cachedTeam = localStorage.getItem(`cache_team_expenses_${uId}_${selectMonth}`);
    if (cachedTeam) {
      try {
        const parsed = JSON.parse(cachedTeam);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTeamExpenses(parsed);
          setLoadingTeamExpenses(false);
        }
      } catch {}
    }

    // My expenses
    prefetchManager.getOrFetch(`my_expenses_${uId}_${selectMonth}`, () => expenseService.getExpenses(selectMonth), 30000)
      .then(myData => {
        if (Array.isArray(myData)) {
          setMyExpenses(myData);
          safeStorageSetItem(`cache_my_expenses_${uId}_${selectMonth}`, JSON.stringify(myData));
          safeStorageSetItem(`cache_my_expenses_${uId}`, JSON.stringify(myData));
        }
        setLoadingMyExpenses(false);
      })
      .catch(() => setLoadingMyExpenses(false));

    // Parallel Background prefetch for Last Month for 0ms instant click
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    if (selectMonth !== lastMonthKey) {
      prefetchManager.getOrFetch(`my_expenses_${uId}_${lastMonthKey}`, () => expenseService.getExpenses(lastMonthKey), 60000)
        .then(lastMyData => {
          if (Array.isArray(lastMyData)) {
            safeStorageSetItem(`cache_my_expenses_${uId}_${lastMonthKey}`, JSON.stringify(lastMyData));
          }
        }).catch(() => {});

      if (isReviewer) {
        prefetchManager.getOrFetch(`team_expenses_${uId}_${lastMonthKey}`, () => expenseService.getTeamExpenses(lastMonthKey), 60000)
          .then(lastTeamData => {
            if (Array.isArray(lastTeamData)) {
              safeStorageSetItem(`cache_team_expenses_${uId}_${lastMonthKey}`, JSON.stringify(lastTeamData));
            }
          }).catch(() => {});
      }
    }

    // Fetch full historical expenses across all months for the 6-month spend chart
    prefetchManager.getOrFetch(`all_historical_expenses_${uId}`, () => expenseService.getExpenses(""), 60000)
      .then(allData => {
        if (Array.isArray(allData)) {
          setHistoricalExpenses(allData);
          safeStorageSetItem(`cache_historical_expenses_${uId}`, JSON.stringify(allData));
        }
      })
      .catch(() => {});

    if (isReviewer) {
      prefetchManager.getOrFetch(`all_team_historical_${uId}`, () => expenseService.getTeamExpenses(""), 60000)
        .then(allTeamData => {
          if (Array.isArray(allTeamData)) {
            setHistoricalTeamExpenses(allTeamData);
            safeStorageSetItem(`cache_historical_team_expenses_${uId}`, JSON.stringify(allTeamData));
          }
        })
        .catch(() => {});
    }
    prefetchManager.getOrFetch(`allowance_stats_${uId}_${selectMonth}`, () => expenseService.getExpenseInit(uId, selectMonth), 30000)
      .then(initData => {
        if (initData?.allowance) {
          const stats = {
            policy_missing: !!initData.allowance.policy_missing || initData.allowance.daily_in_district === null || initData.allowance.daily_in_district === undefined,
            currentKm: initData.allowance.current_month_km || 0,
            maxKm: (initData.allowance.max_km_per_month || 0) + (initData.approved_km || 0),
            currentAuto: initData.allowance.current_month_auto || 0,
            maxAuto: (initData.allowance.max_auto_per_month || 0) + (initData.approved_auto || 0),
            vehicleType: initData.allowance.vehicle_type || "Bike",
            rateBike: initData.allowance.rate_bike || 0,
            rateCar: initData.allowance.rate_car || 0,
          };
          setAllowanceStats(stats);
          safeStorageSetItem(`cache_allowance_stats_${uId}_${selectMonth}`, JSON.stringify(stats));
          safeStorageSetItem(`cache_allowance_stats_${uId}`, JSON.stringify(stats));
        }
      })
      .catch(() => {});

    if (isReviewer) {
      // Pending approvals count
      prefetchManager.getOrFetch("pending_approvals", () => approvalService.getPendingApprovals(), 30000)
        .then(appData => {
          if (Array.isArray(appData)) {
            const limitCount = appData.filter((a: any) => a.category === "Limit Request").length;
            const standardCount = appData.filter((a: any) => a.category !== "Limit Request").length;
            setPendingApprovalsCount(standardCount);
            setPendingLimitRequestsCount(limitCount);
            safeStorageSetItem(`cache_approvals_count_${uId}`, standardCount.toString());
            safeStorageSetItem(`cache_limit_approvals_count_${uId}`, limitCount.toString());
          }
        })
        .catch(() => {});

      // LAZY team fetch — only if team tab is active OR forced (e.g. pull-to-refresh)
      if (forceTeam || activeTab === "team-claims" || teamFetchedRef.current) {
        prefetchManager.getOrFetch(`team_expenses_${uId}_${selectMonth}`, () => expenseService.getTeamExpenses(selectMonth), 30000)
          .then(teamData => {
            if (Array.isArray(teamData)) {
              setTeamExpenses(teamData);
              teamFetchedRef.current = true;
              safeStorageSetItem(`cache_team_expenses_${uId}_${selectMonth}`, JSON.stringify(teamData));
              safeStorageSetItem(`cache_team_expenses_${uId}`, JSON.stringify(teamData));
            }
            setLoadingTeamExpenses(false);
          })
          .catch(() => setLoadingTeamExpenses(false));
      } else {
        setLoadingTeamExpenses(false);
      }
    }
  }, [user, selectMonth, activeTab]);

  // Trigger lazy team fetch when tab switches to team-claims for the first time
  useEffect(() => {
    if (activeTab === "team-claims" && !teamFetchedRef.current && isReviewerRole) {
      const currentUser = authService.getCurrentUser() || user;
      if (!currentUser) return;
      const uId = currentUser.user_id;
      setLoadingTeamExpenses(true);
      prefetchManager.getOrFetch(`team_expenses_${uId}_${selectMonth}`, () => expenseService.getTeamExpenses(selectMonth), 30000)
        .then(teamData => {
          if (Array.isArray(teamData)) {
            setTeamExpenses(teamData);
            teamFetchedRef.current = true;
            safeStorageSetItem(`cache_team_expenses_${uId}_${selectMonth}`, JSON.stringify(teamData));
            safeStorageSetItem(`cache_team_expenses_${uId}`, JSON.stringify(teamData));
          }
          setLoadingTeamExpenses(false);
        })
        .catch(() => setLoadingTeamExpenses(false));
    }
  }, [activeTab, isReviewerRole, selectMonth, user]);

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) { navigate("/login"); return; }
    setUser(currentUser);
    const uId = currentUser.user_id;

    const cachedMy = localStorage.getItem(`cache_my_expenses_${uId}_${selectMonth}`);
    if (cachedMy) { try { setMyExpenses(JSON.parse(cachedMy)); setLoadingMyExpenses(false); } catch (e) {} }

    const cachedTeam = localStorage.getItem(`cache_team_expenses_${uId}_${selectMonth}`);
    if (cachedTeam) { try { setTeamExpenses(JSON.parse(cachedTeam)); setLoadingTeamExpenses(false); teamFetchedRef.current = true; } catch (e) {} }

    const cachedStats = localStorage.getItem(`cache_allowance_stats_${uId}_${selectMonth}`);
    if (cachedStats) { try { setAllowanceStats(JSON.parse(cachedStats)); } catch (e) {} }

    refreshDashboardData();
  }, [navigate, selectMonth]);

  useEffect(() => {
    const handleProfileSync = () => {
      const freshUser = authService.getCurrentUser();
      if (freshUser) { setUser(freshUser); refreshDashboardData(); }
    };
    window.addEventListener("user-profile-synced", handleProfileSync);
    return () => window.removeEventListener("user-profile-synced", handleProfileSync);
  }, [refreshDashboardData]);

  useEffect(() => {
    const handlePullRefresh = () => {
      const currentUser = authService.getCurrentUser() || user;
      if (currentUser) {
        const uId = currentUser.user_id;
        localStorage.removeItem(`cache_approvals_count_${uId}`);
        localStorage.removeItem(`cache_team_expenses_${uId}`);
        localStorage.removeItem(`cache_my_expenses_${uId}`);
        localStorage.removeItem(`cache_allowance_stats_${uId}`);
        teamFetchedRef.current = false;
      }
      refreshDashboardData(true);
    };
    window.addEventListener("app-pull-to-refresh", handlePullRefresh);
    return () => window.removeEventListener("app-pull-to-refresh", handlePullRefresh);
  }, [user, refreshDashboardData]);

  // ── Claim detail modal actions ────────────────────────────────────────────
  const handleOpenClaimDetails = useCallback(async (claimId: number | string) => {
    setSelectedClaimId(claimId);
    setShowDetailsModal(true);
    const listExpenses = [...(Array.isArray(myExpenses) ? myExpenses : []), ...(Array.isArray(teamExpenses) ? teamExpenses : [])];
    const basicClaim = listExpenses.find(e => e && (String(e.id) === String(claimId) || String(e.expense_code) === String(claimId) || String(e.expense_id) === String(claimId)));
    if (basicClaim) setClaimDetails(normalizeClaimObject(basicClaim));
    else setClaimDetails(null);

    const cacheKey = `cache_claim_detail_${claimId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setClaimDetails(normalizeClaimObject(JSON.parse(cached), basicClaim)); setLoadingDetails(false); } catch (e) {}
      expenseService.getExpenseDetails(claimId)
        .then(data => {
          if (data) {
            const norm = normalizeClaimObject(data, basicClaim);
            setClaimDetails(norm);
            localStorage.setItem(cacheKey, JSON.stringify(norm));
          }
        })
        .catch(() => {});
    } else {
      setLoadingDetails(true);
      try {
        const data = await expenseService.getExpenseDetails(claimId);
        if (data) {
          const norm = normalizeClaimObject(data, basicClaim);
          setClaimDetails(norm);
          localStorage.setItem(cacheKey, JSON.stringify(norm));
        }
      } catch (err) {
        if (!basicClaim) { toast.error("Failed to load expense details."); setShowDetailsModal(false); }
      } finally {
        setLoadingDetails(false);
      }
    }
  }, [myExpenses, teamExpenses, normalizeClaimObject]);

  const handleDeleteClaim = useCallback(async (claimId: number) => {
    if (!window.confirm("Are you sure you want to delete this expense claim? This action is irreversible.")) return;
    try {
      await expenseService.deleteExpense(claimId);
      toast.success("Expense claim deleted successfully.");
      setShowDetailsModal(false);
      setClaimDetails(null);
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete expense claim.");
    }
  }, [refreshDashboardData]);

  const handleApprove = useCallback(async () => {
    if (!claimDetails) return;
    setActionLoading(true);
    try {
      await approvalService.approveExpense(claimDetails.id, comments.trim());
      toast.success(`Claim ${claimDetails.expense_code} approved!`);
      setShowDetailsModal(false);
      setClaimDetails(null);
      prefetchManager.invalidateApprovals(user?.user_id || "");
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  }, [claimDetails, comments, user, refreshDashboardData]);

  const handleReject = useCallback(async () => {
    if (!claimDetails) return;
    if (!comments.trim()) { toast.error("Rejection remarks comments are mandatory."); return; }
    setActionLoading(true);
    try {
      await approvalService.rejectExpense(claimDetails.id, comments.trim());
      toast.error(`Claim ${claimDetails.expense_code} rejected.`);
      setShowDetailsModal(false);
      setClaimDetails(null);
      prefetchManager.invalidateApprovals(user?.user_id || "");
      await refreshDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  }, [claimDetails, comments, user, refreshDashboardData]);

  const handleOpenStatsModal = useCallback((type: "Total Claimed" | "Approved" | "Pending" | "Returned" | "Rejected", list: any[]) => {
    setStatsModalType(type);
    setStatsModalClaims(list);
    setShowStatsModal(true);
  }, []);

  return {
    // User
    user, isReviewerRole, pendingLimitRequestsCount, pendingApprovalsCount,
    // Data
    myExpenses, teamExpenses, allowanceStats,
    historicalExpenses, historicalTeamExpenses,
    loadingMyExpenses, loadingTeamExpenses,
    safeMyExpenses, safeTeamExpenses,
    // Tabs
    activeTab, handleTabChange,
    // Filters
    filterEmployee, setFilterEmployee,
    filterDistrict, setFilterDistrict,
    filterZone, setFilterZone,
    selectMonth, setSelectMonth,
    homeStatusFilter, setHomeStatusFilter,
    fromDate, setFromDate,
    toDate, setToDate,
    searchClaimId, setSearchClaimId,
    // Filter options
    uniqueDistricts, uniqueEmployees, uniqueZones,
    // Filtered lists (memoized)
    filteredPersonalExpenses, filteredTeamExpenses,
    // Stats (memoized)
    statsTotalClaims, statsApprovedClaims, statsPendingClaims, statsReturnedClaims, statsRejectedClaims,
    totalAmount, approvedAmount, pendingAmount, returnedAmount, rejectedAmount,
    // Modal state
    showDetailsModal, setShowDetailsModal,
    claimDetails, setClaimDetails,
    comments, setComments,
    actionLoading,
    showStatsModal, setShowStatsModal,
    statsModalType, statsModalClaims, setStatsModalClaims,
    homeClaimsPageSize, setHomeClaimsPageSize,
    homeTeamPageSize, setHomeTeamPageSize,
    homeModalPageSize, setHomeModalPageSize,
    lightboxImage, setLightboxImage,
    showPageScrollTop,
    // Actions
    handleOpenClaimDetails,
    handleDeleteClaim,
    handleApprove,
    handleReject,
    handleOpenStatsModal,
    refreshDashboardData,
    // Helpers
    matchClaimSearch,
  };
}
