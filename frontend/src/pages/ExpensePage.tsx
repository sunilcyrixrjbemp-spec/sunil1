import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import { expenseService } from "../services/expenseService";
import { 
  Trash2, Pencil, Plus, Calendar, 
  AlertTriangle, Check, Loader2,
  TrendingUp,
  Bookmark,
  Info,
  MapPin,
  User,
  FileText,
  DollarSign,
  Navigation,
  X,
  ChevronDown
} from "lucide-react";

interface ItineraryLeg {
  leg: number;
  travel_type: "In-District" | "Outdoor";
  district_from: string;
  district: string; // to_district
  from: string;
  to: string;
  mode: string;
  km: string;
  amount: string;
  sub_mode: string;
  sub_km: string;
  sub_amount: string;
  da: string; // Leg 1 only
  hotel: string; // Leg 1 only
  oth_desc: string;
  oth_amount: string;
  ws_assigned: string;
  ws_closed: string;
  ws_pms: string;
  ws_asset: string;
  visit_purpose: string;
  show_sub_leg?: boolean;
  from_custom?: boolean;
  to_custom?: boolean;
}

interface LegFiles {
  main_bill: File | null;
  sub_bill: File | null;
  comm_mail: File | null;
  oth_bill: File | null;
  hotel_bill?: File | null; // Leg 1 only
}

export default function ExpensePage() {
  const navigate = useNavigate();
  const getProgressPercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();

  // Date State
  const [date, setDate] = useState("");

  // Init default helpers
  const createDefaultLeg = (num: number): ItineraryLeg => ({
    leg: num,
    travel_type: "In-District",
    district_from: "",
    district: "",
    from: "",
    to: "",
    mode: "",
    km: "0",
    amount: "0",
    sub_mode: "",
    sub_km: "0",
    sub_amount: "0",
    da: "0",
    hotel: "0",
    oth_desc: "",
    oth_amount: "0",
    ws_assigned: "0",
    ws_closed: "0",
    ws_pms: "0",
    ws_asset: "0",
    visit_purpose: "",
    show_sub_leg: false
  });

  const createDefaultFiles = (): LegFiles => ({
    main_bill: null,
    sub_bill: null,
    comm_mail: null,
    oth_bill: null,
    hotel_bill: null
  });

  const [itineraries, setItineraries] = useState<ItineraryLeg[]>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    let homeDistrict = "Jodhpur";
    const userVal = localStorage.getItem("user");
    if (userVal) {
      try {
        const u = JSON.parse(userVal);
        homeDistrict = u.district || u.home_district || "Jodhpur";
      } catch (e) {}
    } else if (cached) {
      try {
        const parsed = JSON.parse(cached).user || {};
        homeDistrict = parsed.district || parsed.home_district || "Jodhpur";
      } catch (e) {}
    }
    
    // We construct the default leg using the local helper
    const leg: ItineraryLeg = {
      leg: 1,
      travel_type: "In-District",
      district_from: homeDistrict,
      district: homeDistrict,
      from: "",
      to: "",
      mode: "",
      km: "0",
      amount: "0",
      sub_mode: "",
      sub_km: "0",
      sub_amount: "0",
      da: "0",
      hotel: "0",
      oth_desc: "",
      oth_amount: "0",
      ws_assigned: "0",
      ws_closed: "0",
      ws_pms: "0",
      ws_asset: "0",
      visit_purpose: "",
      show_sub_leg: false
    };
    return [leg];
  });
  const [files, setFiles] = useState<Record<number, LegFiles>>({ 1: createDefaultFiles() });

  // Init Data States
  const [user, setUser] = useState<any>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) {
      const parsed = JSON.parse(cached).user || {};
      return {
        ...parsed,
        name: parsed.name || parsed.full_name,
        district: parsed.district || parsed.home_district
      };
    }
    const userVal = localStorage.getItem("user");
    if (userVal) {
      try {
        const u = JSON.parse(userVal);
        return {
          ...u,
          name: u.name || u.full_name,
          district: u.district || u.home_district
        };
      } catch (e) {}
    }
    return {};
  });
  const [allowance, setAllowance] = useState<any>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? JSON.parse(cached).allowance : {};
  });
  const [facilities, setFacilities] = useState<Record<string, string[]>>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? JSON.parse(cached).facilities : {};
  });
  const [submittedDates, setSubmittedDates] = useState<string[]>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? (JSON.parse(cached).submitted_dates || []) : [];
  });
  const [nextExpId, setNextExpId] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    if (cached) return JSON.parse(cached).next_exp_id;
    const mm = new Date().toISOString().slice(5, 7);
    const yy = new Date().toISOString().slice(2, 4);
    return `RJ-${mm}/${yy}-PENDING`;
  });

  // Limits tracking
  const [approvedKm, setApprovedKm] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? (JSON.parse(cached).approved_km || 0) : 0;
  });
  const [approvedAuto, setApprovedAuto] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? (JSON.parse(cached).approved_auto || 0) : 0;
  });
  const [_existingKmReq, setExistingKmReq] = useState<any>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? JSON.parse(cached).existing_km_req : null;
  });
  const [_existingAutoReq, setExistingAutoReq] = useState<any>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cached = localStorage.getItem(`cache_month_limits_${currentUserId}_${monthStr}`);
    return cached ? JSON.parse(cached).existing_auto_req : null;
  });
  const [loadedMonth, setLoadedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const [activeDropdown, setActiveDropdown] = useState<{ leg: number; field: "from" | "to" } | null>(null);

  const getFacilitiesForDistrict = (districtName: string): string[] => {
    if (!districtName || !facilities) return [];
    let cleanName = districtName.trim().toLowerCase();
    
    // Normalize common naming mismatches
    if (cleanName === "ganganar") {
      cleanName = "ganganagar";
    }
    
    const matchingKey = Object.keys(facilities).find(
      k => k.trim().toLowerCase() === cleanName
    );
    return matchingKey ? facilities[matchingKey] : [];
  };

  // UI status flags
  const [initLoading, setInitLoading] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const monthStr = new Date().toISOString().slice(0, 7);
    const cacheKey = `cache_month_limits_${currentUserId}_${monthStr}`;
    return !localStorage.getItem(cacheKey);
  });
  const [submitting, setSubmitting] = useState(false);
  const [claims, setClaims] = useState<any[]>(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    const cached = localStorage.getItem(`cache_my_expenses_${currentUserId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [claimsLoading, setClaimsLoading] = useState(() => {
    const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();
    return !localStorage.getItem(`cache_my_expenses_${currentUserId}`);
  });
  
  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [exceededType, setExceededType] = useState<"KM" | "AUTO">("KM");
  const [reqAdditional, setReqAdditional] = useState("0");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [hasShownExceededModal, setHasShownExceededModal] = useState(false);

  // Read-only popup modal state (Dashboard Preview Modal)
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deletedAttachments, setDeletedAttachments] = useState<{leg: number; type: string}[]>([]);

  // Image Preview Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Edit Mode & Calendar Constraints states
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [_existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [existingAttachmentsDetailed, setExistingAttachmentsDetailed] = useState<any[]>([]);
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");

  const hasExistingFile = (legNum: number, billType: string) => {
    if (!editExpenseId) return false;
    const isDeletedLocally = deletedAttachments.some(d => d.leg === legNum && d.type === billType);
    if (isDeletedLocally) return false;
    return existingAttachmentsDetailed.some(a => {
      const parts = a.itinerary_id.split("-");
      const aLegNum = parseInt(parts[parts.length - 1]);
      return aLegNum === legNum && a.bill_type === billType;
    });
  };

  const getExistingFileUrl = (legNum: number, billType: string) => {
    if (!editExpenseId) return null;
    const found = existingAttachmentsDetailed.find(a => {
      const parts = a.itinerary_id.split("-");
      const aLegNum = parseInt(parts[parts.length - 1]);
      return aLegNum === legNum && a.bill_type === billType;
    });
    if (!found) return null;
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return `${baseUrl}${found.file_url}`;
  };

  useEffect(() => {
    setupDateRules();
    fetchClaims();

    // Check for edit parameter in query string
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
      setEditExpenseId(editId);
      loadExpenseForEdit(editId);
    }
  }, []);

  const loadExpenseForEdit = async (editId: string) => {
    setInitLoading(true);
    try {
      const data = await expenseService.getExpenseDetails(editId);
      if (data) {
        setDate(data.date);
        setupDateRules(data.date);
        setNextExpId(data.expense_code);
        setExistingAttachments(data.attachments || []);
        setExistingAttachmentsDetailed(data.attachments_detailed || []);
        setDeletedAttachments([]);

        const mappedIti = data.itineraries.map((leg: any) => ({
          leg: leg.leg,
          travel_type: leg.from_district === leg.to_district ? "In-District" : "Outdoor",
          district_from: leg.from_district,
          district: leg.to_district,
          from: leg.from || "",
          to: leg.to || "",
          mode: leg.mode || "",
          km: (leg.km || 0).toString(),
          amount: (leg.amount || 0).toString(),
          sub_mode: leg.sub_mode || "",
          sub_km: (leg.sub_km || 0).toString(),
          sub_amount: (leg.sub_amount || 0).toString(),
          da: (leg.da || 0).toString(),
          hotel: (leg.hotel || 0).toString(),
          oth_desc: leg.oth_desc || "",
          oth_amount: (leg.oth_amount || 0).toString(),
          ws_assigned: (leg.ws_assigned || 0).toString(),
          ws_closed: (leg.ws_closed || 0).toString(),
          ws_pms: (leg.ws_pms || 0).toString(),
          ws_asset: (leg.ws_asset || 0).toString(),
          visit_purpose: leg.visit_purpose || "",
          show_sub_leg: !!leg.sub_mode
        }));
        setItineraries(mappedIti);

        const initialFiles: Record<number, LegFiles> = {};
        mappedIti.forEach((leg: any) => {
          initialFiles[leg.leg] = createDefaultFiles();
        });
        setFiles(initialFiles);
      }
    } catch (err) {
      console.error("Failed to load expense for editing", err);
      toast.error("Failed to load claim details for editing.");
    } finally {
      setInitLoading(false);
    }
  };

  const setupDateRules = (referenceDate?: string) => {
    const today = referenceDate ? new Date(referenceDate) : new Date();
    
    // First day of that month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    // Last day of that month
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const pad = (n: number) => n.toString().padStart(2, "0");
    
    const minStr = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`;
    const maxStr = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
    
    setMinDate(minStr);
    setMaxDate(maxStr);

    if (!referenceDate) {
      const todayStr = today.toISOString().split("T")[0];
      setDate(todayStr);
    }
  };

  useEffect(() => {
    if (date) {
      const monthStr = date.slice(0, 7);
      if (monthStr !== loadedMonth) {
        fetchMonthLimits(monthStr, itineraries.length === 1 && !itineraries[0].from);
      }
    }
  }, [date]);

  const fetchMonthLimits = async (monthStr: string, isInitialLoad = false) => {
    const cacheKey = `cache_month_limits_${currentUserId}_${monthStr}`;
    const cached = localStorage.getItem(cacheKey);

    const applyInitData = (data: any) => {
      setLoadedMonth(monthStr);
      const normalizedUser = {
        ...data.user,
        name: data.user?.name || data.user?.full_name,
        district: data.user?.district || data.user?.home_district
      };
      setUser(normalizedUser);
      setAllowance(data.allowance);
      setFacilities(data.facilities);
      setSubmittedDates(data.submitted_dates || []);
      setNextExpId(data.next_exp_id);
      
      setApprovedKm(data.approved_km || 0);
      setApprovedAuto(data.approved_auto || 0);
      setExistingKmReq(data.existing_km_req);
      setExistingAutoReq(data.existing_auto_req);

      // Populate initial leg default values
      setItineraries(prev => {
        const hDist = (normalizedUser.district || "Jodhpur").trim();
        const updated = prev.map(leg => {
          let updatedLeg = { ...leg };
          if (leg.travel_type === "In-District") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.district = hDist === "All" ? "Jodhpur" : hDist;
          } else {
            updatedLeg.district_from = leg.district_from || (hDist === "All" ? "Jodhpur" : hDist);
          }
          return updatedLeg;
        });

        // Calculate DA for Leg 1
        const leg1 = updated.find(l => l.leg === 1);
        if (leg1) {
          const hotelAmt = parseFloat(leg1.hotel) || 0;
          const hasOutDistrictLeg = updated.some(l => {
            if (l.travel_type === "Outdoor") return true;
            if (l.district && l.district.trim() !== hDist) return true;
            return false;
          });

          const allowanceObj = data.allowance || {};
          if (hotelAmt > 0) {
            leg1.da = (allowanceObj.daily_hotel || 350).toString();
          } else if (hasOutDistrictLeg) {
            leg1.da = (allowanceObj.daily_out_district || 400).toString();
          } else {
            const hasAnyDistrict = updated.some(l => l.district);
            if (!hasAnyDistrict) {
              leg1.da = "0";
            } else {
              leg1.da = (allowanceObj.daily_in_district || 250).toString();
            }
          }
        }
        return updated;
      });
    };

    if (cached) {
      applyInitData(JSON.parse(cached));
      setInitLoading(false);
    } else if (isInitialLoad) {
      setInitLoading(true);
    }

    try {
      const data = await expenseService.getExpenseInit(currentUserId, monthStr);
      if (data.success) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        applyInitData(data);
      }
    } catch (err) {
      console.error("Failed to load month limits", err);
      if (!cached) {
        toast.error("Failed to initialize expense rules.");
      }
    } finally {
      if (isInitialLoad) setInitLoading(false);
    }
  };

  const fetchClaims = async () => {
    const cacheKey = `cache_my_expenses_${currentUserId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setClaims(JSON.parse(cached));
      setClaimsLoading(false);
    } else {
      setClaimsLoading(true);
    }

    try {
      const data = await expenseService.getExpenses();
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setClaims(data);
    } catch (err: any) {
      console.error("Failed to load claims list", err);
    } finally {
      setClaimsLoading(false);
    }
  };

  const checkExistingExpense = () => {
    if (submittedDates.includes(date)) {
      toast.error("An expense claim for this date has already been submitted.");
      setDate("");
    }
  };

  const addItinerary = () => {
    if (itineraries.length >= 10) {
      toast.error("You can add a maximum of 10 visits.");
      return;
    }
    const nextLeg = itineraries.length + 1;
    const newLeg = createDefaultLeg(nextLeg);
    const hDist = user.district || user.home_district || "Jodhpur";
    newLeg.district_from = hDist;
    newLeg.district = hDist;
    
    setItineraries(prev => [...prev, newLeg]);
    setFiles(prev => ({ ...prev, [nextLeg]: createDefaultFiles() }));
  };

  const removeItinerary = (legNum: number) => {
    if (itineraries.length === 1) return;
    
    const filteredIti = itineraries.filter(leg => leg.leg !== legNum).map((leg, index) => ({
      ...leg,
      leg: index + 1
    }));
    
    const newFiles: Record<number, LegFiles> = {};
    filteredIti.forEach(leg => {
      const originalLeg = itineraries.find(old => old.from === leg.from && old.to === leg.to)?.leg || 1;
      newFiles[leg.leg] = files[originalLeg] || createDefaultFiles();
    });

    setItineraries(filteredIti);
    setFiles(newFiles);
  };

  const handleItineraryChange = (legNum: number, field: keyof ItineraryLeg, value: any) => {
    setItineraries(prev => {
      // 1. Map to get the updated list of legs
      const updatedLegs = prev.map(leg => {
        if (leg.leg !== legNum) return leg;
        
        const updatedLeg = { ...leg, [field]: value };

        if (field === "mode") {
          updatedLeg.km = "0";
          updatedLeg.amount = "0";
          updatedLeg.sub_mode = "";
          updatedLeg.sub_amount = "0";
          updatedLeg.show_sub_leg = false;
        }

        if (field === "travel_type") {
          const hDist = user.district || user.home_district || "Jodhpur";
          if (value === "In-District") {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.district = hDist === "All" ? "Jodhpur" : hDist;
          } else {
            updatedLeg.district_from = hDist === "All" ? "Jodhpur" : hDist;
            updatedLeg.district = "";
          }
        }

        if (field === "district_from" && updatedLeg.travel_type === "In-District") {
          updatedLeg.district = value;
        }

        if (field === "km" && (updatedLeg.mode === "Bike" || updatedLeg.mode === "Car")) {
          const kmNum = parseFloat(value) || 0;
          const rate = updatedLeg.mode === "Bike" ? (allowance.rate_bike || 4.5) : (allowance.rate_car || 9.0);
          updatedLeg.amount = (kmNum * rate).toFixed(2);
        }

        if (field === "hotel" && legNum === 1) {
          const hotelAmt = parseFloat(value) || 0;
          const hotelLimit = allowance.hotel_in_state_s || 1500;
          if (hotelAmt > hotelLimit) {
            toast.error(`Maximum hotel stay allowance is ₹${hotelLimit}`);
            updatedLeg.hotel = hotelLimit.toString();
          }
        }

        return updatedLeg;
      });

      // 2. Recalculate DA for Leg 1 based on the updated list of legs
      const hDist = (user.district || user.home_district || "Jodhpur").trim();
      const hasOutDistrictLeg = updatedLegs.some(l => {
        if (l.travel_type === "Outdoor") return true;
        if (l.district && l.district.trim() !== hDist) return true;
        return false;
      });

      const leg1 = updatedLegs.find(l => l.leg === 1);
      if (leg1) {
        if (field !== "da") {
          const hotelAmt = parseFloat(leg1.hotel) || 0;
          if (hotelAmt > 0) {
            leg1.da = (allowance.daily_hotel || 350).toString();
          } else if (hasOutDistrictLeg) {
            leg1.da = (allowance.daily_out_district || 400).toString();
          } else {
            const hasAnyDistrict = updatedLegs.some(l => l.district);
            if (!hasAnyDistrict) {
              leg1.da = "0";
            } else {
              leg1.da = (allowance.daily_in_district || 250).toString();
            }
          }
        }
      }

      return updatedLegs;
    });
  };

  // Compress an image file to ≤50KB JPEG using Canvas API (fast, in-browser)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // If it's a PDF, pass through unchanged (can't compress PDFs in browser)
      if (file.type === "application/pdf") {
        resolve(file);
        return;
      }
      const TARGET_SIZE = 50 * 1024; // 50 KB
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        // Scale down large images to max 1600px on longest side
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Binary search for the right quality to hit ≤50KB
        let lo = 0.1, hi = 0.95, quality = 0.7;
        let bestBlob: Blob | null = null;
        const tryQuality = (q: number, done: (blob: Blob) => void) => {
          canvas.toBlob((blob) => {
            if (blob) done(blob);
            else resolve(file);
          }, "image/jpeg", q);
        };
        // Iterative compression — 6 passes max
        const iterate = (pass: number, lo: number, hi: number) => {
          quality = (lo + hi) / 2;
          tryQuality(quality, (blob) => {
            bestBlob = blob;
            if (pass >= 6 || Math.abs(blob.size - TARGET_SIZE) < 2048) {
              // Done — wrap blob as File
              const compressedFile = new File([bestBlob!], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else if (blob.size > TARGET_SIZE) {
              iterate(pass + 1, lo, quality);
            } else {
              iterate(pass + 1, quality, hi);
            }
          });
        };
        iterate(0, lo, hi);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  };

  const handleLegFileChange = async (legNum: number, key: keyof LegFiles, file: File | null) => {
    if (!file) {
      setFiles(prev => ({ ...prev, [legNum]: { ...prev[legNum], [key]: null } }));
      return;
    }
    
    // Validate file type (image or PDF only)
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPDF) {
      toast.error("Only image (JPG, PNG, etc.) and PDF files are allowed!");
      return;
    }
    
    let processedFile = file;
    
    if (isImage) {
      // Compress images larger than 50KB to make sure they are well under 2MB
      if (file.size > 50 * 1024) {
        const toastId = toast.loading(`Compressing image... (${Math.round(file.size / 1024)}KB)`);
        try {
          processedFile = await compressImage(file);
          toast.dismiss(toastId);
          toast.success(`Compressed to ${Math.round(processedFile.size / 1024)}KB ✓`, { duration: 2000 });
        } catch {
          toast.dismiss(toastId);
          processedFile = file;
        }
      }
    }
    
    // Validate final size (maximum 2MB)
    if (processedFile.size > 2 * 1024 * 1024) {
      if (isPDF) {
        toast.error("PDF file size cannot exceed 2MB!");
      } else {
        toast.error("Compressed image size still exceeds the 2MB limit. Please upload a smaller photo.");
      }
      return;
    }
    
    setFiles(prev => ({
      ...prev,
      [legNum]: {
        ...prev[legNum],
        [key]: processedFile
      }
    }));
  };

  const removeLegFile = (legNum: number, key: keyof LegFiles) => {
    setFiles(prev => ({
      ...prev,
      [legNum]: {
        ...prev[legNum],
        [key]: null
      }
    }));
  };



  const calculateTotals = () => {
    let totalKmVal = 0;
    let totalAmtVal = 0;
    let totalAutoVal = 0;
    let totalDAVal = 0;
    let totalHotelVal = 0;
    let totalOtherVal = 0;

    itineraries.forEach((leg, index) => {
      const legNum = index + 1;
      const legKm = parseFloat(leg.km) || 0;
      const legAmt = parseFloat(leg.amount) || 0;
      const subAmt = parseFloat(leg.sub_amount) || 0;
      const otherAmt = parseFloat(leg.oth_amount) || 0;

      if (leg.mode === "Bike" || leg.mode === "Car") {
        totalKmVal += legKm;
      }
      if (leg.mode === "Auto") {
        totalAutoVal += legAmt;
      }
      if (leg.sub_mode === "Auto") {
        totalAutoVal += subAmt;
      }

      totalAmtVal += legAmt + subAmt + otherAmt;
      totalOtherVal += otherAmt;

      if (legNum === 1) {
        const daAmt = parseFloat(leg.da) || 0;
        const hotelAmt = parseFloat(leg.hotel) || 0;
        totalAmtVal += daAmt + hotelAmt;
        totalDAVal += daAmt;
        totalHotelVal += hotelAmt;
      }
    });

    return { totalKm: totalKmVal, totalAmt: totalAmtVal, totalAuto: totalAutoVal, totalDA: totalDAVal, totalHotel: totalHotelVal, totalOther: totalOtherVal };
  };

  const { totalKm, totalAmt, totalAuto, totalDA, totalHotel, totalOther } = calculateTotals();

  const checkLimitsExceeded = () => {
    const maxKmAllowed = (allowance.max_km_per_month || 2000) + approvedKm;
    const maxAutoAllowed = (allowance.max_auto_per_month || 1000) + approvedAuto;

    let limitType: "KM" | "AUTO" | null = null;
    let excess = 0;

    if ((allowance.current_month_km + totalKm) > maxKmAllowed) {
      limitType = "KM";
      excess = (allowance.current_month_km + totalKm) - maxKmAllowed;
    } else if ((allowance.current_month_auto + totalAuto) > maxAutoAllowed) {
      limitType = "AUTO";
      excess = (allowance.current_month_auto + totalAuto) - maxAutoAllowed;
    }

    return { limitType, excess };
  };

  const { limitType, excess } = checkLimitsExceeded();
  const isLimitExceeded = limitType !== null;

  useEffect(() => {
    if (isLimitExceeded && !hasShownExceededModal) {
      setExceededType(limitType!);
      setReqAdditional(excess.toFixed(2));
      setHasShownExceededModal(true);
      setShowApprovalModal(true);
    } else if (!isLimitExceeded) {
      setHasShownExceededModal(false);
    }
  }, [isLimitExceeded, limitType, excess]);

  const validateClaim = () => {
    if (!date) {
      toast.error("Please choose a travel date first.");
      return false;
    }

    for (let idx = 0; idx < itineraries.length; idx++) {
      const leg = itineraries[idx];
      const legNum = idx + 1;

      if (!leg.from.trim()) {
        toast.error(`Leg ${legNum}: Please enter the starting location.`);
        return false;
      }
      if (!leg.to.trim()) {
        toast.error(`Leg ${legNum}: Please enter the destination location.`);
        return false;
      }
      if (!leg.mode) {
        toast.error(`Leg ${legNum}: Please select a travel mode.`);
        return false;
      }

      if (leg.mode === "Bike" || leg.mode === "Car") {
        const kmVal = parseFloat(leg.km) || 0;
        if (kmVal <= 0) {
          toast.error(`Leg ${legNum}: Please enter a distance greater than 0 KM.`);
          return false;
        }
      } else {
        const amtVal = parseFloat(leg.amount) || 0;
        if (amtVal <= 0) {
          toast.error(`Leg ${legNum}: Please enter a valid fare amount.`);
          return false;
        }
      }

      const mainBill = files[legNum]?.main_bill;
      const hasMainAttachment = mainBill || hasExistingFile(legNum, leg.mode);
      if (leg.mode === "Train" && !hasMainAttachment) {
        toast.error(`Leg ${legNum}: Please upload your train ticket receipt.`);
        return false;
      }
      if ((leg.mode === "Bus" || leg.mode === "Auto") && (parseFloat(leg.amount) || 0) >= 300 && !hasMainAttachment) {
        toast.error(`Leg ${legNum}: Please upload a receipt screenshot since the fare is ₹300 or more.`);
        return false;
      }

      if (leg.sub_mode) {
        const subAmt = parseFloat(leg.sub_amount) || 0;
        if (subAmt <= 0) {
          toast.error(`Leg ${legNum}: Please enter a valid sub-connection fare.`);
          return false;
        }
        const subBill = files[legNum]?.sub_bill;
        const hasSubAttachment = subBill || hasExistingFile(legNum, leg.sub_mode);
        if (leg.sub_mode === "Train" && !hasSubAttachment) {
          toast.error(`Leg ${legNum}: Please upload the sub-connection train ticket receipt.`);
          return false;
        }
        if ((leg.sub_mode === "Bus" || leg.sub_mode === "Auto") && subAmt >= 300 && !hasSubAttachment) {
          toast.error(`Leg ${legNum}: Please upload a sub-connection receipt screenshot since the fare is ₹300 or more.`);
          return false;
        }
      }

      if (leg.travel_type === "Outdoor") {
        if (!leg.district_from) {
          toast.error(`Leg ${legNum}: Please select the starting district.`);
          return false;
        }
        if (!leg.district) {
          toast.error(`Leg ${legNum}: Please select the destination district.`);
          return false;
        }
        if (leg.district_from === leg.district) {
          toast.error(`Leg ${legNum}: The starting and destination districts must be different for outdoor travel.`);
          return false;
        }
        const commMail = files[legNum]?.comm_mail;
        const hasCommAttachment = commMail || hasExistingFile(legNum, "Communication_Mail");
        if (!hasCommAttachment) {
          toast.error(`Leg ${legNum}: Outdoor travel requires manager approval screenshot.`);
          return false;
        }
      }

      if (legNum === 1) {
        const hotelAmt = parseFloat(leg.hotel) || 0;
        const hotelBill = files[1]?.hotel_bill;
        const hasHotelAttachment = hotelBill || hasExistingFile(1, "Hotel");
        if (hotelAmt > 0 && !hasHotelAttachment) {
          toast.error("Please upload your hotel stay receipt.");
          return false;
        }
      }

      if (leg.oth_desc.trim()) {
        const othAmt = parseFloat(leg.oth_amount) || 0;
        if (othAmt <= 0) {
          toast.error(`Leg ${legNum}: Please enter a valid amount for other expenses.`);
          return false;
        }
        const othBill = files[legNum]?.oth_bill;
        const hasOthAttachment = othBill || hasExistingFile(legNum, "Other_Expense");
        if (othAmt >= 300 && !hasOthAttachment) {
          toast.error(`Leg ${legNum}: Please upload a receipt screenshot for other expenses since the amount is ₹300 or more.`);
          return false;
        }
      }

      if (!leg.visit_purpose.trim()) {
        toast.error(`Leg ${legNum}: Please enter the purpose of this visit.`);
        return false;
      }
    }

    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClaim()) return;
    setShowConfirmModal(true);
  };

  const doSubmit = async () => {
    if (isLimitExceeded) {
      toast.error("Submission is locked due to limit overflow.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("user_id", currentUserId);
      formData.append("exp_date", date);
      formData.append("total_amount", totalAmt.toFixed(2));
      if (editExpenseId) {
        formData.append("edit_expense_id", editExpenseId);
      }
      const getLocalTimestamp = () => {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      formData.append("client_timestamp", getLocalTimestamp());

      const itinerariesData = itineraries.map((leg, index) => {
        const legNum = index + 1;
        return {
          leg: legNum,
          travel_type: leg.travel_type,
          district_from: leg.district_from || user.home_district,
          district: leg.district,
          from: leg.from,
          to: leg.to,
          mode: leg.mode,
          km: leg.km,
          amount: leg.amount,
          sub_mode: leg.sub_mode,
          sub_amount: leg.sub_amount,
          da: legNum === 1 ? leg.da : "0",
          hotel: legNum === 1 ? leg.hotel : "0",
          oth_desc: leg.oth_desc,
          oth_amount: leg.oth_amount,
          ws_assigned: leg.ws_assigned,
          ws_closed: leg.ws_closed,
          ws_pms: leg.ws_pms,
          ws_asset: leg.ws_asset,
          visit_purpose: leg.visit_purpose
        };
      });

      formData.append("itineraries", JSON.stringify(itinerariesData));

      // Append files
      itineraries.forEach((_, index) => {
        const legNum = index + 1;
        const legFiles = files[legNum];
        if (legFiles) {
          if (legFiles.main_bill) formData.append(`main_bill_${legNum}`, legFiles.main_bill);
          if (legFiles.sub_bill) formData.append(`sub_bill_${legNum}`, legFiles.sub_bill);
          if (legFiles.comm_mail) formData.append(`comm_mail_${legNum}`, legFiles.comm_mail);
          if (legFiles.oth_bill) formData.append(`oth_bill_${legNum}`, legFiles.oth_bill);
          if (legNum === 1 && legFiles.hotel_bill) formData.append("hotel_bill_1", legFiles.hotel_bill);
        }
      });
      formData.append("deleted_attachments", JSON.stringify(deletedAttachments));

      const res = await expenseService.submitItineraryExpense(formData);
      if (res.success) {
        toast.success(res.message || "Claim submitted successfully!");
        setShowConfirmModal(false);
        
        // Reset form
        setItineraries([createDefaultLeg(1)]);
        setFiles({ 1: createDefaultFiles() });
        const todayStr = new Date().toISOString().split("T")[0];
        setDate(todayStr);
        setHasShownExceededModal(false);
        setEditExpenseId(null);
        setExistingAttachments([]);
        setExistingAttachmentsDetailed([]);
        setDeletedAttachments([]);
        
        await fetchMonthLimits(todayStr.slice(0, 7), false);
        await fetchClaims();
        
        if (editExpenseId) {
          navigate("/home");
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Failed to submit claim.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendApprovalRequest = async () => {
    if (!reqAdditional || parseFloat(reqAdditional) <= 0) {
      toast.error("Please enter a valid extension amount.");
      return;
    }
    setSendingRequest(true);
    try {
      const res = await expenseService.createLimitRequest(
        currentUserId,
        exceededType,
        parseFloat(reqAdditional),
        date.slice(0, 7)
      );
      if (res.success) {
        toast.success(res.message);
        setShowApprovalModal(false);
        if (exceededType === "KM") {
          setExistingKmReq({ status: "Pending", requested_value: reqAdditional });
        } else {
          setExistingAutoReq({ status: "Pending", requested_value: reqAdditional });
        }
        await fetchMonthLimits(date.slice(0, 7), false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Failed to send request.");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleViewDetails = async (claimId: number) => {
    setSelectedClaim(null);
    setDetailsLoading(true);
    setShowDetailsModal(true);
    try {
      const details = await expenseService.getExpenseDetails(claimId);
      setSelectedClaim(details);
    } catch (err: any) {
      toast.error("Failed to load claim status details.");
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditFromModal = (claimId: number | string) => {
    const stringId = String(claimId);
    setEditExpenseId(stringId);
    loadExpenseForEdit(stringId);
    
    const newurl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?edit=${stringId}`;
    window.history.pushState({ path: newurl }, '', newurl);
    
    setShowDetailsModal(false);
    setSelectedClaim(null);
  };

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

  const handleDeleteClaim = async (claimId: number) => {
    if (!window.confirm("Are you sure you want to delete this expense claim?")) return;
    try {
      await expenseService.deleteExpense(claimId);
      toast.success("Claim deleted successfully.");
      await fetchClaims();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete claim.");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved") return "bg-green-50 border-green-200 text-green-700";
    if (s === "rejected") return "bg-red-50 border-red-200 text-red-700";
    if (s.startsWith("submitted_l")) {
      return "bg-blue-50 border-blue-200 text-blue-700";
    }
    return "bg-amber-55 border-amber-250 text-amber-800 font-bold";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "submitted") return "Pending L1";
    if (status.startsWith("submitted_l")) {
      const lvl = status.replace("submitted_l", "");
      return `Pending L${lvl}`;
    }
    return status.toUpperCase();
  };

  if (initLoading) {
    return <Loader message="Initializing Expense Builder..." />;
  }

  const limitPillLabel = allowance.vehicle_type === "None" ? "Allowances" : `${allowance.vehicle_type} Limits`;

  return (
    <>
      <div className="space-y-6 animate-fadeIn text-[#212529] pb-24 text-xs font-sans">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-3 gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800 uppercase tracking-tight flex items-center gap-1.5">
            <FileText className="w-5 h-5 text-blue-600" />
            Submit Daily Expense
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Fill out your travel details and work report for the day</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-[10px] text-gray-400 font-bold uppercase">Expense ID:</span>
          <span className="bg-blue-600 text-white font-extrabold py-1 px-3 rounded text-[11px] font-mono shadow-sm">
            {nextExpId}
          </span>
        </div>
      </div>

      {/* 4 Info-Box Widgets (Unified Mobile/Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-3.5 flex items-center">
          <div className="p-3 rounded bg-blue-50 text-blue-600 mr-3 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-1">
              Employee Profile
            </span>
            <span className="text-xs font-bold text-gray-800 block truncate" title={user.name || "—"}>
              {user.name || "—"}
            </span>
            <span className="text-[10px] text-gray-500 block truncate font-mono mt-0.5">
              Code: {user.e_code || "—"} | Grade: {user.grade || "—"}
            </span>
          </div>
        </div>

        {/* Assigned Home District Card */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-3.5 flex items-center">
          <div className="p-3 rounded bg-green-50 text-green-600 mr-3 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-1">
              Assigned District
            </span>
            <span className="text-xs font-bold text-gray-800 block">
              {user.district || "—"}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              In-District travel boundary
            </span>
          </div>
        </div>

        {/* Monthly Distance Limit Card */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-3.5 flex flex-col justify-between min-h-[70px]">
          <div className="flex items-center">
            <div className="p-2.5 rounded bg-blue-50 text-blue-600 mr-3 shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-1">
                {limitPillLabel}
              </span>
              <span className="text-xs font-bold text-gray-800 block">
                {allowance.current_month_km || 0} / {((allowance.max_km_per_month || 2000) + approvedKm)} KM
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage(allowance.current_month_km || 0, ((allowance.max_km_per_month || 2000) + approvedKm))}%` }}
            ></div>
          </div>
        </div>

        {/* Monthly Auto Cap Card */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-3.5 flex flex-col justify-between min-h-[70px]">
          <div className="flex items-center">
            <div className="p-2.5 rounded bg-amber-50 text-amber-600 mr-3 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-1">
                Monthly Auto Cap
              </span>
              <span className="text-xs font-bold text-gray-850 block">
                ₹{(allowance.current_month_auto || 0).toLocaleString()} / ₹{(1000 + approvedAuto).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 mt-2.5 overflow-hidden">
            <div 
              className="bg-amber-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage(allowance.current_month_auto || 0, (1000 + approvedAuto))}%` }}
            ></div>
          </div>
        </div>

      </div>

      {/* Main Form container supporting dual layout */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (8 cols): Date Selection & Journey visit legs */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Date Selection card */}
            <div className="card-lte-primary bg-white shadow-sm">
              <div className="bg-slate-50 border-b border-gray-200 p-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Expense Date
                </h3>
              </div>
              <div className="p-4 max-w-xs">
                <label className="label-lte">Choose Travel Date <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  required 
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    checkExistingExpense();
                  }}
                  className="input-lte font-bold"
                />
              </div>
            </div>

            {/* Visit Details Legs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-650 uppercase tracking-wider">Travel & Visit Legs</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase">(Legs: {itineraries.length} / 10)</span>
              </div>

              {itineraries.map((leg, index) => {
                const legNum = index + 1;
                const isFirst = legNum === 1;
                const rawDistOpts = Object.keys(facilities).length > 0 ? Object.keys(facilities) : [
                  "Ajmer", "Beawer", "Bhilwara", "Nagaur", "Tonk", "Bikaner", "Churu", "Ganganagar", "Hanumangarh", 
                  "Barmer", "Balotra", "Jaisalmer", "Jalore", "Jodhpur", "Pali", "Phalodi", "Sirohi", 
                  "Banswara", "Chittorgarh", "Dungarpur", "Rajsamand", "Pratapgarh", "Udaipur"
                ];
                const hDist = user.district || user.home_district || "Jodhpur";
                const distOpts = [...rawDistOpts];
                if (hDist && hDist !== "All" && !distOpts.includes(hDist)) {
                  distOpts.push(hDist);
                }

                return (
                  <div key={leg.leg} className="card-lte border-t-4 border-t-blue-600 bg-white animate-fadeIn text-xs mb-6 shadow-sm">
                    
                    {/* Leg Header */}
                    <div className="bg-slate-50 border-b border-gray-200 p-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                        <span className="bg-blue-600 text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {legNum}
                        </span>
                        Travel Leg {legNum}
                      </h3>
                      {legNum > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItinerary(leg.leg)}
                          className="text-red-600 hover:text-red-800 text-[10px] font-bold flex items-center gap-1 border-0 bg-transparent cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Leg
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      
                      {/* Travel Type select */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-150">
                        <span className="text-xs font-bold text-gray-700">Travel Category</span>
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                          <button
                            key="In-District"
                            type="button"
                            onClick={() => handleItineraryChange(leg.leg, "travel_type", "In-District")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-l-md border transition-all cursor-pointer ${
                              leg.travel_type === "In-District"
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            In-District
                          </button>
                          <button
                            key="Outdoor"
                            type="button"
                            onClick={() => handleItineraryChange(leg.leg, "travel_type", "Outdoor")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-r-md border-t border-b border-r transition-all cursor-pointer ${
                              leg.travel_type === "Outdoor"
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            Outdoor
                          </button>
                        </div>
                      </div>

                      {/* Locations Row (From and To side by side) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* From Location block */}
                        <div className="p-4 bg-slate-50 border border-gray-200 rounded-md space-y-3 shadow-xs">
                          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                            <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Starting Location (From)</span>
                          </div>
                          <div className="space-y-2.5">
                            <div>
                              <label className="label-lte">District <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <select
                                  value={leg.district_from}
                                  required
                                  disabled={leg.travel_type === "In-District"}
                                  onChange={(e) => {
                                    handleItineraryChange(leg.leg, "district_from", e.target.value);
                                    handleItineraryChange(leg.leg, "from", ""); // reset location on district change
                                  }}
                                  className="input-lte font-semibold pr-8 border-gray-305 shadow-inner disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                  <option value="">Select District</option>
                                  {distOpts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="label-lte mb-0">Facility / Location Name <span className="text-red-500">*</span></label>
                                {leg.district_from && getFacilitiesForDistrict(leg.district_from).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItineraryChange(leg.leg, "from_custom", !leg.from_custom);
                                      handleItineraryChange(leg.leg, "from", "");
                                    }}
                                    className="text-[9px] font-bold text-blue-600 hover:text-blue-800 border-0 bg-transparent cursor-pointer uppercase tracking-wider"
                                  >
                                    {leg.from_custom ? "📋 Select from list" : "✍️ Type Custom"}
                                  </button>
                                )}
                              </div>
                              {leg.district_from && getFacilitiesForDistrict(leg.district_from).length > 0 && !leg.from_custom ? (
                                <select
                                  required
                                  value={leg.from}
                                  onChange={(e) => handleItineraryChange(leg.leg, "from", e.target.value)}
                                  className="input-lte font-semibold border-gray-305"
                                >
                                  <option value="">-- Select Hospital / Location --</option>
                                  {getFacilitiesForDistrict(leg.district_from).map((f: string, fIdx: number) => (
                                    <option key={fIdx} value={f}>{f}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={leg.from}
                                  placeholder="Enter facility or location..."
                                  onChange={(e) => handleItineraryChange(leg.leg, "from", e.target.value)}
                                  className="input-lte font-semibold border-gray-305"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* To Location block */}
                        <div className="p-4 bg-slate-50 border border-gray-200 rounded-md space-y-3 shadow-xs">
                          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Destination Location (To)</span>
                          </div>
                          <div className="space-y-2.5">
                            <div>
                              <label className="label-lte">District <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <select
                                  value={leg.district}
                                  required
                                  disabled={leg.travel_type === "In-District"}
                                  onChange={(e) => {
                                    handleItineraryChange(leg.leg, "district", e.target.value);
                                    handleItineraryChange(leg.leg, "to", ""); // reset location on district change
                                  }}
                                  className="input-lte font-semibold pr-8 border-gray-305 shadow-inner disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                  <option value="">Select District</option>
                                  {distOpts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="label-lte mb-0">Facility / Location Name <span className="text-red-500">*</span></label>
                                {leg.district && getFacilitiesForDistrict(leg.district).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItineraryChange(leg.leg, "to_custom", !leg.to_custom);
                                      handleItineraryChange(leg.leg, "to", "");
                                    }}
                                    className="text-[9px] font-bold text-blue-600 hover:text-blue-800 border-0 bg-transparent cursor-pointer uppercase tracking-wider"
                                  >
                                    {leg.to_custom ? "📋 Select from list" : "✍️ Type Custom"}
                                  </button>
                                )}
                              </div>
                              {leg.district && getFacilitiesForDistrict(leg.district).length > 0 && !leg.to_custom ? (
                                <select
                                  required
                                  value={leg.to}
                                  onChange={(e) => handleItineraryChange(leg.leg, "to", e.target.value)}
                                  className="input-lte font-semibold border-gray-305"
                                >
                                  <option value="">-- Select Hospital / Location --</option>
                                  {getFacilitiesForDistrict(leg.district).map((f: string, fIdx: number) => (
                                    <option key={fIdx} value={f}>{f}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={leg.to}
                                  placeholder="Enter facility or location..."
                                  onChange={(e) => handleItineraryChange(leg.leg, "to", e.target.value)}
                                  className="input-lte font-semibold border-gray-305"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Travel Mode, KM and Amount details */}
                      <div className="border-t border-gray-150 pt-4 space-y-4">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-none">Travel Details</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <label className="label-lte mb-1 block">Travel Mode <span className="text-red-500">*</span></label>
                            <select
                              value={leg.mode}
                              required
                              onChange={(e) => handleItineraryChange(leg.leg, "mode", e.target.value)}
                              className="input-lte font-bold border-gray-300"
                            >
                              <option value="">Select Travel Mode</option>
                              {[
                                { value: "Bike", label: "Bike", visible: allowance.vehicle_type === "Bike" || allowance.vehicle_type === "Car" },
                                { value: "Car", label: "Car", visible: allowance.vehicle_type === "Car" },
                                { value: "Auto", label: "Auto", visible: true },
                                { value: "Bus", label: "Bus", visible: true },
                                { value: "Train", label: "Train", visible: true },
                              ].filter(x => x.visible).map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="label-lte">Distance {(leg.mode === "Bike" || leg.mode === "Car") && <span className="text-red-500">*</span>}</label>
                            <div className="flex rounded shadow-xs">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={leg.km}
                                disabled={leg.mode !== "Bike" && leg.mode !== "Car"}
                                placeholder="0"
                                onChange={(e) => handleItineraryChange(leg.leg, "km", e.target.value)}
                                className="input-lte rounded-none rounded-l font-mono disabled:bg-gray-100 disabled:text-gray-400 border-gray-300"
                              />
                              <span className="inline-flex items-center rounded-r border border-l-0 border-gray-305 bg-gray-50 px-2.5 text-gray-505 text-[10px] font-bold uppercase shrink-0">
                                KM
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="label-lte">Fare Amount {leg.mode !== "" && <span className="text-red-500">*</span>}</label>
                            <div className="flex rounded shadow-xs">
                              <span className="inline-flex items-center rounded-l border border-r-0 border-gray-305 bg-gray-50 px-2.5 text-gray-505 text-xs font-semibold shrink-0">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={leg.amount}
                                disabled={leg.mode === "Bike" || leg.mode === "Car"}
                                placeholder="0"
                                onChange={(e) => handleItineraryChange(leg.leg, "amount", e.target.value)}
                                className="input-lte rounded-none rounded-r font-mono disabled:bg-gray-100 disabled:text-gray-400 border-gray-305"
                              />
                            </div>
                          </div>
                        </div>

                        {/* File upload for main mode */}
                        {leg.mode !== "" && leg.mode !== "Bike" && leg.mode !== "Car" && (
                          <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-md">
                            <label className="label-lte block mb-1.5">
                              Upload Ticket / Receipt Image
                              {leg.mode === "Train" && <span className="text-red-500"> *</span>}
                              {(leg.mode === "Bus" || leg.mode === "Auto") && (parseFloat(leg.amount) || 0) >= 300 && <span className="text-red-500"> *</span>}
                            </label>
                            {!files[leg.leg]?.main_bill && !hasExistingFile(leg.leg, leg.mode) ? (
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                onChange={(e) => handleLegFileChange(leg.leg, "main_bill", e.target.files ? e.target.files[0] : null)}
                                className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-305 file:text-[10px] file:font-bold file:uppercase file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
                              />
                            ) : files[leg.leg]?.main_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-blue-700 truncate max-w-[200px]">{files[leg.leg]?.main_bill?.name}</span>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => files[leg.leg]?.main_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].main_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.main_bill ? URL.createObjectURL(files[leg.leg].main_bill!) : ""} download={files[leg.leg]?.main_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "main_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-green-700">✓ Existing receipt retained</span>
                                <div className="flex gap-2">
                                  {getExistingFileUrl(leg.leg, leg.mode) && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, leg.mode) || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, leg.mode) || ""} download={`receipt_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: leg.mode }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* File upload for manager approval email (Outdoor Only) */}
                        {leg.travel_type === "Outdoor" && (
                          <div className="p-3 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-md">
                            <label className="label-lte block mb-1.5">
                              Upload Manager Approval Screenshot <span className="text-red-500">*</span>
                            </label>
                            {!files[leg.leg]?.comm_mail && !hasExistingFile(leg.leg, "Communication_Mail") ? (
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                required={!hasExistingFile(leg.leg, "Communication_Mail")}
                                onChange={(e) => handleLegFileChange(leg.leg, "comm_mail", e.target.files ? e.target.files[0] : null)}
                                className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-indigo-300 file:text-[10px] file:font-bold file:uppercase file:bg-white file:text-indigo-700 hover:file:bg-indigo-50 cursor-pointer"
                              />
                            ) : files[leg.leg]?.comm_mail ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-blue-700 truncate max-w-[200px]">{files[leg.leg]?.comm_mail?.name}</span>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => files[leg.leg]?.comm_mail && setLightboxImage(URL.createObjectURL(files[leg.leg].comm_mail!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.comm_mail ? URL.createObjectURL(files[leg.leg].comm_mail!) : ""} download={files[leg.leg]?.comm_mail?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "comm_mail")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-1.5 rounded text-xs">
                                <span className="font-semibold text-green-700">✓ Existing approval screenshot retained</span>
                                <div className="flex gap-2">
                                  {getExistingFileUrl(leg.leg, "Communication_Mail") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Communication_Mail") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Communication_Mail") || ""} download={`approval_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Communication_Mail" }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sub-connections details */}
                      <div className="border-t border-gray-150 pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-none">Sub-connections & Conveyance</h4>
                          {!(leg.mode === "Bus" || leg.mode === "Train") && (
                            <span className="text-[9px] text-gray-400 italic">Available for Bus/Train legs only</span>
                          )}
                          {(leg.mode === "Bus" || leg.mode === "Train") && !leg.show_sub_leg && (
                            <button
                              type="button"
                              onClick={() => handleItineraryChange(leg.leg, "show_sub_leg", true)}
                              className="text-blue-605 hover:underline border-0 bg-transparent text-[10px] font-bold p-0 cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 animate-pulse" /> Add Extra Sub-Connection (Auto / Bus / Train)
                            </button>
                          )}
                        </div>

                        {leg.show_sub_leg && (
                          <div className="p-4 bg-slate-50/50 rounded border border-gray-200 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <span className="font-bold text-[10px] text-gray-600 uppercase tracking-wide">Extra Sub-leg detail</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleItineraryChange(leg.leg, "show_sub_leg", false);
                                  handleItineraryChange(leg.leg, "sub_mode", "");
                                  handleItineraryChange(leg.leg, "sub_amount", "0");
                                  removeLegFile(leg.leg, "sub_bill");
                                }}
                                className="text-red-600 hover:text-red-800 text-[10px] font-bold border-0 bg-transparent cursor-pointer"
                              >
                                Remove connection
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="label-lte mb-1 block">Mode <span className="text-red-500">*</span></label>
                                <select
                                  value={leg.sub_mode}
                                  required
                                  onChange={(e) => handleItineraryChange(leg.leg, "sub_mode", e.target.value)}
                                  className="input-lte font-bold"
                                >
                                  <option value="">Select Mode</option>
                                  <option value="Auto">Auto</option>
                                  <option value="Bus">Bus</option>
                                  <option value="Train">Train</option>
                                </select>
                              </div>
                              <div>
                                <label className="label-lte">Amount (₹) <span className="text-red-500">*</span></label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={leg.sub_amount}
                                  onChange={(e) => handleItineraryChange(leg.leg, "sub_amount", e.target.value)}
                                  className="input-lte font-bold"
                                />
                              </div>
                              <div>
                                <label className="label-lte">
                                  Ticket Upload 
                                  {leg.sub_mode === "Train" && <span className="text-red-500"> *</span>}
                                  {(leg.sub_mode === "Bus" || leg.sub_mode === "Auto") && (parseFloat(leg.sub_amount) || 0) >= 300 && <span className="text-red-500"> *</span>}
                                </label>
                                {!files[leg.leg]?.sub_bill && !hasExistingFile(leg.leg, leg.sub_mode) ? (
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf,.pdf"
                                    onChange={(e) => handleLegFileChange(leg.leg, "sub_bill", e.target.files ? e.target.files[0] : null)}
                                    className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer w-full mt-1.5"
                                  />
                                ) : files[leg.leg]?.sub_bill ? (
                                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                    <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.sub_bill?.name}</span>
                                    <div className="flex gap-1.5">
                                      <button type="button" onClick={() => files[leg.leg]?.sub_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].sub_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={files[leg.leg]?.sub_bill ? URL.createObjectURL(files[leg.leg].sub_bill!) : ""} download={files[leg.leg]?.sub_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                      <button type="button" onClick={() => removeLegFile(leg.leg, "sub_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                    <span className="font-semibold text-green-700">✓ Retained</span>
                                    <div className="flex gap-1.5">
                                      {getExistingFileUrl(leg.leg, leg.sub_mode) && (
                                        <>
                                          <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, leg.sub_mode) || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                          <a href={getExistingFileUrl(leg.leg, leg.sub_mode) || ""} download={`sub_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                        </>
                                      )}
                                      <button 
                                        type="button" 
                                        onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: leg.sub_mode }])} 
                                        className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* DA and Hotel fields (Leg #1 Only) */}
                      {isFirst && (
                        <div className="border-t border-gray-150 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/30 p-3 rounded border">
                          <div>
                            <label className="label-lte" title={`Grade Allowances. Daily district: ₹${allowance.daily_in_district}. Daily out-district: ₹${allowance.daily_out_district}. Daily hotel: ₹${allowance.daily_hotel}. Daily out-state: ₹${allowance.daily_out_state}.`}>
                              Daily Allowance (DA) <Info className="w-3 h-3 inline text-blue-500 mb-0.5" />
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={leg.da}
                              readOnly
                              className="input-lte font-bold bg-gray-100 text-gray-500 cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="label-lte" title={`Outstation Hotel Limit: max ₹${allowance.hotel_in_state_s} per night.`}>
                              Hotel Charges <Info className="w-3 h-3 inline text-blue-500 mb-0.5" />
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={leg.hotel}
                              onChange={(e) => handleItineraryChange(leg.leg, "hotel", e.target.value)}
                              className="input-lte font-bold"
                            />
                          </div>

                          <div>
                            <label className="label-lte">Hotel Bill Attachment</label>
                            {!files[leg.leg]?.hotel_bill && !hasExistingFile(leg.leg, "Hotel") ? (
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                onChange={(e) => handleLegFileChange(leg.leg, "hotel_bill", e.target.files ? e.target.files[0] : null)}
                                className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer w-full mt-1.5"
                              />
                            ) : files[leg.leg]?.hotel_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.hotel_bill?.name}</span>
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={() => files[leg.leg]?.hotel_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].hotel_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.hotel_bill ? URL.createObjectURL(files[leg.leg].hotel_bill!) : ""} download={files[leg.leg]?.hotel_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "hotel_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                <div className="flex gap-1.5">
                                  {getExistingFileUrl(leg.leg, "Hotel") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Hotel") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Hotel") || ""} download={`hotel_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Hotel" }])} 
                                    className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Other expenses details */}
                      <div className="border-t border-gray-150 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/10 p-3 rounded border border-dashed">
                        <div className="sm:col-span-2">
                          <label className="label-lte">Other Purchases / Misc Description</label>
                          <input
                            type="text"
                            value={leg.oth_desc}
                            placeholder="Detail outstation toll tax, stationery, local components purchase..."
                            onChange={(e) => handleItineraryChange(leg.leg, "oth_desc", e.target.value)}
                            className="input-lte"
                          />
                        </div>
                        <div>
                          <label className="label-lte">Other Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={leg.oth_amount}
                            onChange={(e) => handleItineraryChange(leg.leg, "oth_amount", e.target.value)}
                            className="input-lte font-bold"
                          />
                        </div>
                        <div className="sm:col-span-3 border-t border-gray-100 pt-2 flex items-center justify-between">
                          <label className="label-lte block">Misc Bill Attachment Indicator</label>
                          <div className="flex items-center gap-2">
                            {!files[leg.leg]?.oth_bill && !hasExistingFile(leg.leg, "Other") ? (
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                onChange={(e) => handleLegFileChange(leg.leg, "oth_bill", e.target.files ? e.target.files[0] : null)}
                                className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                              />
                            ) : files[leg.leg]?.oth_bill ? (
                              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px]">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.oth_bill?.name}</span>
                                <button type="button" onClick={() => files[leg.leg]?.oth_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].oth_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                <a href={files[leg.leg]?.oth_bill ? URL.createObjectURL(files[leg.leg].oth_bill!) : ""} download={files[leg.leg]?.oth_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                <button type="button" onClick={() => removeLegFile(leg.leg, "oth_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px]">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                {getExistingFileUrl(leg.leg, "Other") && (
                                  <>
                                    <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Other") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                    <a href={getExistingFileUrl(leg.leg, "Other") || ""} download={`oth_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                  </>
                                )}
                                <button 
                                  type="button" 
                                  onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Other" }])} 
                                  className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Work Metrics section */}
                      <div className="border-t border-gray-150 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="label-lte" title="Work assignments logged in CRM">Calls Assigned</label>
                          <input
                            type="number"
                            min="0"
                            value={leg.ws_assigned}
                            onChange={(e) => handleItineraryChange(leg.leg, "ws_assigned", e.target.value)}
                            className="input-lte font-mono"
                          />
                        </div>
                        <div>
                          <label className="label-lte" title="Customer tasks successfully closed">Calls Completed</label>
                          <input
                            type="number"
                            min="0"
                            value={leg.ws_closed}
                            onChange={(e) => handleItineraryChange(leg.leg, "ws_closed", e.target.value)}
                            className="input-lte font-mono"
                          />
                        </div>
                        <div>
                          <label className="label-lte" title="Planned maintenance runs">PMS Done</label>
                          <input
                            type="number"
                            min="0"
                            value={leg.ws_pms}
                            onChange={(e) => handleItineraryChange(leg.leg, "ws_pms", e.target.value)}
                            className="input-lte font-mono"
                          />
                        </div>
                        <div>
                          <label className="label-lte" title="Asset tags completed">Asset Tagging</label>
                          <input
                            type="number"
                            min="0"
                            value={leg.ws_asset}
                            onChange={(e) => handleItineraryChange(leg.leg, "ws_asset", e.target.value)}
                            className="input-lte font-mono"
                          />
                        </div>
                      </div>

                      {/* Visit Purpose */}
                      <div className="border-t border-gray-150 pt-4">
                        <label className="label-lte">Purpose of Leg Visit <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={leg.visit_purpose}
                          placeholder="State purpose: e.g. Biomedical machine calibration at Govt Hospital..."
                          onChange={(e) => handleItineraryChange(leg.leg, "visit_purpose", e.target.value)}
                          className="input-lte font-semibold"
                        />
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add leg trigger */}
            <button
              type="button"
              onClick={addItinerary}
              className="btn-lte-outline w-full py-2.5 flex items-center justify-center gap-1.5 border-dashed border-2 hover:bg-gray-50 border-blue-200 text-blue-700 font-bold mb-6 cursor-pointer"
            >
              <Plus className="w-4 h-4 animate-bounce" /> Add Itinerary leg visit
            </button>

          </div>

          {/* Right Column (4 cols): User Info Stats & Totals Summary Panel (Desktop Only) */}
          <div className="lg:col-span-4 space-y-6 sticky top-20">
            
            {/* Desktop User Allowance & Limits Card */}
            <div className="hidden lg:block bg-white border border-gray-250 border-t-4 border-t-blue-600 rounded shadow-sm p-4 space-y-4 text-xs font-semibold">
              <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide border-b border-gray-150 pb-2">
                Monthly Limits & Allowances
              </h3>
              <div className="grid grid-cols-2 gap-3 text-[11px] pb-3 border-b border-gray-150">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-0.5">Employee Name</span>
                  <span className="text-gray-800 block truncate">{user.name || "—"}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-0.5">Employee ID</span>
                  <span className="font-mono text-gray-800 block">{user.e_code || "—"}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-0.5">Grade Level</span>
                  <span className="text-gray-800 block">{user.grade || "—"}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-0.5">Home District</span>
                  <span className="text-gray-800 block">{user.district || "—"}</span>
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-gray-500 uppercase">{limitPillLabel}</span>
                    <span className="font-extrabold text-blue-700">{allowance.current_month_km || 0} / {((allowance.max_km_per_month || 2000) + approvedKm)} KM</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(allowance.current_month_km || 0, ((allowance.max_km_per_month || 2000) + approvedKm))}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-gray-500 uppercase">Monthly Auto Cap</span>
                    <span className="font-extrabold text-amber-700">₹{(allowance.current_month_auto || 0).toLocaleString()} / ₹{(1000 + approvedAuto).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(allowance.current_month_auto || 0, (1000 + approvedAuto))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Claims Totals & Submissions block */}
            <div className="bg-white border border-gray-250 border-t-4 border-t-green-600 rounded shadow-sm p-4 space-y-4 text-xs font-semibold">
              <h3 className="text-xs font-extrabold uppercase text-gray-700 tracking-wide border-b border-gray-150 pb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Claim Summary
              </h3>

              <div className="space-y-3 font-semibold text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 uppercase text-[9px]">TRAVEL DATE</span>
                  <span className="text-gray-800">{date || "No date selected"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 uppercase text-[9px]">DISTANCE</span>
                  <span className="text-gray-800 font-mono">{totalKm.toFixed(1)} KM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 uppercase text-[9px]">AUTO COST</span>
                  <span className="text-gray-800 font-mono">₹{totalAuto.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-150 text-xs">
                  <span className="text-gray-900 font-black uppercase text-[10px]">TOTAL AMOUNT</span>
                  <span className="text-blue-700 font-black font-mono text-sm">₹{totalAmt.toLocaleString()}</span>
                </div>
              </div>

              {/* Warnings and Limit Extension panel */}
              {isLimitExceeded && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded space-y-1.5 text-[10px] mt-2">
                  <div className="flex items-start gap-1 font-bold leading-tight">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>Monthly Cap Exceeded</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    You have exceeded your monthly limit by <strong>{excess.toFixed(1)} {limitType === "KM" ? "KM" : "₹"}</strong>. Please request a limit extension increase from your manager.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-lte-warning py-1 px-3 w-full rounded text-[9px] font-extrabold uppercase shrink-0 cursor-pointer"
                  >
                    Request Limit Extension
                  </button>
                </div>
              )}

              {/* Actions triggers (Desktop Only - Mobile uses fixed bottom bar below) */}
              <div className="hidden lg:flex flex-col gap-2 pt-2 border-t border-gray-150">
                <button
                  type="submit"
                  disabled={isLimitExceeded || submitting}
                  className="btn-lte-success py-2 w-full font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-0 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editExpenseId ? "Update Claim" : "Submit Claim"}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/home")}
                  className="btn-lte-outline py-2 w-full font-bold uppercase tracking-wider text-center cursor-pointer"
                >
                  Cancel &amp; Go Home
                </button>
              </div>

            </div>

          </div>

        </div>
      </form>

      {/* Mobile view bottom docked bar (positioned bottom-14 to sit exactly above the dashboard navigation bar, and z-30 to prevent overlay overlap issues) */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] p-3 z-30 flex items-center justify-between px-4">
        <div>
          <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider leading-none mb-0.5">Total Amount</span>
          <span className="text-blue-700 font-extrabold text-sm font-mono">₹{totalAmt.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          {isLimitExceeded && (
            <button
              type="button"
              onClick={() => setShowApprovalModal(true)}
              className="btn-lte-warning py-1.5 px-3 rounded text-[10px] font-extrabold uppercase shrink-0 cursor-pointer"
            >
              Extend
            </button>
          )}
          <button
            type="button"
            disabled={isLimitExceeded || submitting}
            onClick={() => {
              if (!date) {
                toast.error("Please select date first!");
                return;
              }
              if (!validateClaim()) {
                return;
              }
              setShowConfirmModal(true);
            }}
            className="btn-lte-success py-1.5 px-5 font-bold uppercase tracking-wider text-xs border-0 cursor-pointer"
          >
            {submitting ? "Submitting..." : editExpenseId ? "Update" : "Submit"}
          </button>
        </div>
      </div>

      {/* Full Width Bottom Section: Recent Submissions table */}
      <div className="bg-white border border-gray-250 rounded shadow-sm overflow-hidden flex flex-col mt-6">
        <div className="px-5 py-3.5 border-b border-gray-200 bg-slate-50">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">My Claims</h3>
        </div>

        <div className="overflow-x-auto p-4">
          {claimsLoading ? (
            <Loader message="Loading claims list..." />
          ) : claims.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs font-semibold">
              No submitted claims found.
            </div>
          ) : (
            <table className="table-lte">
              <thead>
                <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50/50">
                  <th className="py-2.5 px-3">Claim ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Travel Mode</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((exp) => (
                  <tr 
                    key={exp.id} 
                    onClick={() => handleViewDetails(exp.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold font-mono text-blue-600 uppercase">{exp.expense_code}</td>
                    <td className="py-3 px-3 text-slate-500">{exp.itinerary}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 truncate max-w-[200px]" title={exp.description}>{exp.description}</td>
                    <td className="py-3 px-3 text-slate-500">{exp.travel_mode}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">₹{exp.amount.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(exp.status)}`}>
                        {getStatusLabel(exp.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(exp.status === "draft" || exp.status === "submitted") && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditFromModal(exp.id); }}
                              className="p-1.5 text-amber-600 hover:text-amber-800 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 cursor-pointer transition-all active:scale-95"
                              title="Edit Claim"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteClaim(exp.id); }}
                              className="p-1.5 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer transition-all active:scale-95"
                              title="Delete Claim Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>

      {/* ================= STEP 3 CONFIRMATION SUBMIT DIALOG ================= */}
      {showConfirmModal && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-md">
            <h3 className="text-sm font-extrabold uppercase tracking-wider border-b border-gray-200 pb-3 text-gray-800 text-left">
              Confirm Reimbursement Submission
            </h3>

            <div className="space-y-4 mt-4 text-left text-xs font-semibold">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-1.5">
                <p>Date of Travel: <span className="font-bold text-gray-900">{date}</span></p>
                {totalKm > 0 && (
                  <p>Total Distance: <span className="font-bold text-gray-900">{totalKm.toFixed(1)} KM</span></p>
                )}
                {totalAuto > 0 && (
                  <p>Auto / Rickshaw Fare: <span className="font-bold text-gray-900">₹{totalAuto.toLocaleString()}</span></p>
                )}
                {totalDA > 0 && (
                  <p>Daily Allowance (DA): <span className="font-bold text-emerald-700">₹{totalDA.toLocaleString()}</span></p>
                )}
                {totalHotel > 0 && (
                  <p>Hotel Stay: <span className="font-bold text-indigo-700">₹{totalHotel.toLocaleString()}</span></p>
                )}
                {totalOther > 0 && (
                  <p>Other Expenses: <span className="font-bold text-amber-700">₹{totalOther.toLocaleString()}</span></p>
                )}
                <p className="border-t border-gray-200 pt-1.5 mt-1.5">Total Claim Amount: <span className="font-black text-blue-700">₹{totalAmt.toLocaleString()}</span></p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded flex items-start gap-1.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  By clicking Confirm, you verify that this travel log and all attached invoice screenshots are genuine. The claim will be forwarded to your mapped manager.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="btn-lte-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doSubmit}
                  disabled={submitting}
                  className="btn-lte-success px-5 py-2 flex items-center justify-center gap-1.5 border-0"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Submit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= LIMIT APPROVAL DIALOG ================= */}
      {showApprovalModal && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-md">
            <h3 className="text-sm font-extrabold uppercase tracking-wider border-b border-gray-200 pb-3 text-red-600 text-left flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Monthly Reimbursement Limit Exceeded
            </h3>

            <div className="space-y-4 mt-4 text-left text-xs font-semibold">
              <p className="leading-relaxed font-medium text-gray-600">
                The current claim exceeds your monthly {exceededType} allowance. You must request a temporary extension from your Level 1 Manager to submit this claim.
              </p>

              <div className="p-3 bg-red-50 border border-red-150 text-red-800 rounded font-bold">
                Exceeded Overflow: {excess.toFixed(1)} {exceededType === "KM" ? "KM" : "₹"}
              </div>

              <div className="space-y-1.5">
                <label className="label-lte">Requested Additional {exceededType}</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={reqAdditional}
                  onChange={(e) => setReqAdditional(e.target.value)}
                  className="input-lte font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="btn-lte-secondary"
                  disabled={sendingRequest}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendApprovalRequest}
                  disabled={sendingRequest}
                  className="btn-lte-primary px-5 py-2 flex items-center justify-center gap-1.5 border-0"
                >
                  {sendingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send Request</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DETAILS MODAL ================= */}
      {showDetailsModal && (
        <div className="modal-lte-overlay">
          <div className="modal-lte-content max-w-5xl max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-blue-600" />
                Claim Details {selectedClaim ? `— ${selectedClaim.expense_code}` : ""}
              </h3>
              <button 
                onClick={() => { setShowDetailsModal(false); setSelectedClaim(null); }}
                className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500 hover:text-gray-800 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailsLoading || !selectedClaim ? (
                <div className="flex justify-center p-12 text-gray-400 font-bold">Loading...</div>
              ) : (
                <>
                  {/* Summary Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Submitted By</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{selectedClaim.submitter_name || user.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{selectedClaim.submitter_code || user.user_id}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Travel Date</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{selectedClaim.date || selectedClaim.itinerary}</span>
                      <span className="text-[10px] text-gray-500">{selectedClaim.month} {selectedClaim.year}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Submitted At</span>
                      <span className="font-bold text-gray-800 block mt-0.5">{formatDateTime(selectedClaim.created_at)}</span>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Status</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider mt-1 ${getStatusBadgeClass(selectedClaim.status)}`}>
                        {getStatusLabel(selectedClaim.status)}
                      </span>
                    </div>
                  </div>

                  {/* Purpose & Total */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div>
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Purpose:</span>
                      <span className="font-semibold text-gray-800 ml-1">{selectedClaim.purpose || selectedClaim.description || "Field visits"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-gray-500 font-bold uppercase block">Total</span>
                      <span className="text-lg font-black text-blue-700 font-mono">₹{selectedClaim.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Legs Table */}
                  {selectedClaim.itineraries && selectedClaim.itineraries.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Visit Legs Details</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50">
                              <th className="py-2 px-3 text-center w-10">#</th>
                              <th className="py-2 px-3">Route</th>
                              <th className="py-2 px-3">Mode</th>
                              <th className="py-2 px-3 text-right">KM</th>
                              <th className="py-2 px-3 text-right">DA</th>
                              <th className="py-2 px-3 text-right">Hotel</th>
                              <th className="py-2 px-3">Other</th>
                              <th className="py-2 px-3">Metrics</th>
                              <th className="py-2 px-3 text-right font-bold">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedClaim.itineraries.map((leg: any, idx: number) => {
                              const travelCost = leg.amount || 0;
                              const subCost = leg.sub_amount || 0;
                              const daCost = leg.da || 0;
                              const hotelCost = leg.hotel || 0;
                              const otherCost = leg.oth_amount || 0;
                              const legTotal = travelCost + subCost + daCost + hotelCost + otherCost;
                              return (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2.5 px-3 text-center font-bold text-gray-400">{leg.leg}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-800">{leg.from_district === leg.to_district ? leg.to_district : `${leg.from_district} → ${leg.to_district}`}</span>
                                    <span className="text-[10px] text-gray-400 block">{leg.from || "Start"} → {leg.to || "End"}</span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{leg.mode}</span>
                                    {leg.sub_mode && <span className="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 ml-1">+{leg.sub_mode}</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-600">{leg.km || 0} KM</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{daCost.toLocaleString()}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{hotelCost.toLocaleString()}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-mono font-bold">₹{otherCost.toLocaleString()}</span>
                                    {leg.oth_desc && <span className="text-[9px] text-gray-400 block truncate max-w-[100px]" title={leg.oth_desc}>{leg.oth_desc}</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-[10px] text-gray-500">
                                    <span>W:{leg.ws_assigned||0}</span> <span className="text-green-600">D:{leg.ws_closed||0}</span> <span>P:{leg.ws_pms||0}</span> <span>A:{leg.ws_asset||0}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold font-mono text-gray-900">₹{legTotal.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {selectedClaim.attachments && selectedClaim.attachments.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Attachments / Receipts</h4>
                      </div>
                      <div className="p-3 flex flex-wrap gap-2">
                        {selectedClaim.attachments.map((url: string, attIdx: number) => {
                          const filename = url.split("/").pop() || "Receipt";
                          let cleanType = "Receipt";
                          if (url.includes("_Bike_")) cleanType = "Bike Fuel";
                          else if (url.includes("_Car_")) cleanType = "Car Fuel";
                          else if (url.includes("_Auto_")) cleanType = "Auto Fare";
                          else if (url.includes("_Bus_")) cleanType = "Bus Ticket";
                          else if (url.includes("_Train_")) cleanType = "Train Ticket";
                          else if (url.includes("_Hotel_")) cleanType = "Hotel Invoice";
                          else if (url.includes("_Communication_Mail_")) cleanType = "Approval Mail";
                          else if (url.includes("_Other_Expense_")) cleanType = "Purchase Bill";
                          const API_BASE = import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com";
                          const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
                          return (
                            <div key={attIdx} className="inline-flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                              <span className="font-bold text-gray-700">{cleanType}</span>
                              <button type="button" onClick={() => setLightboxImage(fullUrl)} className="text-blue-600 hover:text-blue-800 font-bold border-0 bg-transparent cursor-pointer text-[10px] underline">Preview</button>
                              <a href={fullUrl} download={filename} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 font-bold text-[10px] underline">Download</a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Approval Logs - Simple Table */}
                  {selectedClaim.approvals && selectedClaim.approvals.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <h4 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Approval Review History</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-gray-200 text-[9px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50">
                              <th className="py-2 px-3 w-12">Level</th>
                              <th className="py-2 px-3">Reviewer</th>
                              <th className="py-2 px-3">Role</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3">Comments</th>
                              <th className="py-2 px-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedClaim.approvals.map((app: any, appIdx: number) => {
                              const statusClass = app.status === "approved" ? "bg-green-50 border-green-200 text-green-700" 
                                : app.status === "rejected" ? "bg-red-50 border-red-200 text-red-700"
                                : app.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-gray-50 border-gray-200 text-gray-500";
                              return (
                                <tr key={appIdx} className="hover:bg-gray-50">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-500">L{app.level_number}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-gray-800">{app.approver_name}</span>
                                    <span className="text-[9px] text-gray-400 font-mono block">{app.approver_code}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-500">{app.approver_role || "Reviewer"}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>{app.status}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-gray-600 italic max-w-[200px] truncate" title={app.comments || ""}>{app.comments || "—"}</td>
                                  <td className="py-2.5 px-3 text-right text-gray-500 font-mono text-[10px]">
                                    {app.status !== "waiting" && app.status !== "pending" && app.status !== "cancelled" ? formatDateTime(app.updated_at) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                {selectedClaim && ["draft", "submitted"].includes(selectedClaim.status?.toLowerCase()) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEditFromModal(selectedClaim.id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteClaim(selectedClaim.id);
                        setShowDetailsModal(false);
                        setSelectedClaim(null);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowDetailsModal(false); setSelectedClaim(null); }}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-bold transition-all cursor-pointer border-0"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= RECEIPT IMAGE LIGHTBOX POPUP ================= */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[60] animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white border border-gray-300 rounded p-4 flex flex-col items-center justify-center select-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center w-full mb-2 pb-2 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-800">Image Preview</span>
              <div className="flex gap-2">
                <a 
                  href={lightboxImage} 
                  download="receipt_image.png" 
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold no-underline"
                >
                  Download
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-bold border-0 cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <img 
              src={lightboxImage} 
              alt="Receipt Invoice Lightbox" 
              className="max-w-full max-h-[70vh] border border-gray-200 object-contain"
            />
          </div>
        </div>
      )}

    </>
  );
}
