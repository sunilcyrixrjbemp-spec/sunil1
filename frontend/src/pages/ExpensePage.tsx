import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Loader from "../components/common/Loader";
import { expenseService } from "../services/expenseService";
import { uploadService } from "../services/uploadService";
import { 
  Trash2, Pencil, Plus, Calendar, 
  AlertTriangle, Check, Loader2,
  TrendingUp,
  Bookmark,
  Info,
  MapPin,
  User,
  FileText,
  Navigation,
  X,
  Bike,
  Car,
  Bus
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
  local_purchase: string; // Leg 1 only
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
  activity_details?: string;
  selected_activities?: string[];
  calls_barcode?: string;
  calls_verified?: boolean;
  calls_asset_details?: any;
  calls_type?: string;
  calls_status?: string;
  calls_photo_url?: string;
  calls_photo_loading?: boolean;
  pms_barcode?: string;
  pms_verified?: boolean;
  pms_asset_details?: any;
  pms_frequency?: string;
  pms_photo_url?: string;
  pms_photo_loading?: boolean;
  asset_tagging_equipment?: string;
  asset_tagging_quantity?: string;
  mobilise_asset_count?: string;
  calibration_count?: string;
  activity_other_desc?: string;
  calls_list?: Array<{
    barcode: string;
    verified: boolean;
    type: string;
    status: string;
    asset_details: any;
    photo_url?: string;
  }>;
  pms_list?: Array<{
    barcode: string;
    verified: boolean;
    frequency: string;
    asset_details: any;
    photo_url?: string;
  }>;
  assets_list?: Array<{
    equipment_name: string;
    quantity: string;
  }>;
}

interface LegFiles {
  main_bill: File | null;
  sub_bill: File | null;
  comm_mail: File | null;
  oth_bill: File | null;
  hotel_bill?: File | null; // Leg 1 only
  local_purchase_bill?: File | null; // Leg 1 only
}

export default function ExpensePage() {
  const navigate = useNavigate();
  const getProgressPercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const currentUserId = (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.user_id || "Admin"; } catch(e) { return "Admin"; } })().trim();

  // Date State
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv'));

  // Init default helpers
  const createDefaultLeg = (num: number): ItineraryLeg => {
    const isCalib = (() => {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        return (u.designation || "").toLowerCase().includes("calibration");
      } catch (e) { return false; }
    })();
    return {
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
      local_purchase: "0",
      oth_desc: "",
      oth_amount: "0",
      ws_assigned: "0",
      ws_closed: "0",
      ws_pms: "0",
      ws_asset: "0",
      visit_purpose: "",
      show_sub_leg: false,
      activity_details: "",
      selected_activities: isCalib ? ["Calibration"] : [],
      calls_barcode: "",
      calls_verified: false,
      calls_asset_details: null,
      calls_type: "Support Call",
      calls_status: "Attend",
      pms_barcode: "",
      pms_verified: false,
      pms_asset_details: null,
      pms_frequency: "3 month",
      asset_tagging_equipment: "",
      asset_tagging_quantity: "0",
      mobilise_asset_count: "0",
      calibration_count: "0",
      activity_other_desc: "",
      calls_list: [],
      pms_list: [],
      assets_list: []
    };
  };

  const createDefaultFiles = (): LegFiles => ({
    main_bill: null,
    sub_bill: null,
    comm_mail: null,
    oth_bill: null,
    hotel_bill: null,
    local_purchase_bill: null
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
    
    const isCalib = (() => {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        return (u.designation || "").toLowerCase().includes("calibration");
      } catch (e) { return false; }
    })();
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
      local_purchase: "0",
      oth_desc: "",
      oth_amount: "0",
      ws_assigned: "0",
      ws_closed: "0",
      ws_pms: "0",
      ws_asset: "0",
      visit_purpose: "",
      show_sub_leg: false,
      activity_details: "",
      selected_activities: isCalib ? ["Calibration"] : [],
      calls_barcode: "",
      calls_verified: false,
      calls_asset_details: null,
      calls_type: "Support Call",
      calls_status: "Attend",
      pms_barcode: "",
      pms_verified: false,
      pms_asset_details: null,
      pms_frequency: "3 month",
      asset_tagging_equipment: "",
      asset_tagging_quantity: "0",
      mobilise_asset_count: "0",
      calibration_count: "0",
      activity_other_desc: "",
      calls_list: [],
      pms_list: [],
      assets_list: []
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
  const [myClaimsPage, setMyClaimsPage] = useState(1);
  
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
  const [assetValueMaster, setAssetValueMaster] = useState<{equipment_name: string; rmsc_tender_cost: number}[]>([]);

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

    const fetchAssetMaster = async () => {
      try {
        const data = await expenseService.getAssetValueMaster();
        setAssetValueMaster(data || []);
      } catch (e) {
        console.error("Error loading asset value master list", e);
      }
    };
    fetchAssetMaster();

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

        const mappedIti = data.itineraries.map((leg: any) => {
          let activityObj: any = {};
          try {
            if (leg.activity_details) {
              activityObj = JSON.parse(leg.activity_details);
            }
          } catch (e) {
            console.error("Error parsing activity_details", e);
          }

          const isCalib = (user?.designation || "").toLowerCase().includes("calibration");

          return {
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
            local_purchase: (leg.local_purchase || 0).toString(),
            oth_desc: leg.oth_desc || "",
            oth_amount: (leg.oth_amount || 0).toString(),
            ws_assigned: (leg.ws_assigned || 0).toString(),
            ws_closed: (leg.ws_closed || 0).toString(),
            ws_pms: (leg.ws_pms || 0).toString(),
            ws_asset: (leg.ws_asset || 0).toString(),
            visit_purpose: leg.visit_purpose || "",
            show_sub_leg: !!leg.sub_mode,

            // Activity fields
            activity_details: leg.activity_details || "",
            selected_activities: activityObj.selected_activities || (isCalib ? ["Calibration"] : []),
            calls_barcode: activityObj.calls_barcode || "",
            calls_verified: !!activityObj.calls_verified,
            calls_asset_details: activityObj.calls_asset_details || null,
            calls_type: activityObj.calls_type || "Support Call",
            calls_status: activityObj.calls_status || "Attend",
            pms_barcode: activityObj.pms_barcode || "",
            pms_verified: !!activityObj.pms_verified,
            pms_asset_details: activityObj.pms_asset_details || null,
            pms_frequency: activityObj.pms_frequency || "3 month",
            asset_tagging_equipment: activityObj.asset_tagging_equipment || "",
            asset_tagging_quantity: activityObj.asset_tagging_quantity || "0",
            mobilise_asset_count: activityObj.mobilise_asset_count || "0",
            calibration_count: activityObj.calibration_count || "0",
            activity_other_desc: activityObj.activity_other_desc || "",
            calls_list: activityObj.calls_list || [],
            pms_list: activityObj.pms_list || [],
            assets_list: activityObj.assets_list || []
          };
        });
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

  const verifyLegBarcode = async (legNum: number, activityType: "Calls" | "PMS") => {
    const leg = itineraries.find(l => l.leg === legNum);
    if (!leg) return;
    
    const barcode = activityType === "Calls" ? leg.calls_barcode : leg.pms_barcode;
    if (!barcode || barcode.length !== 8) {
      toast.error("Barcode must be exactly 8 digits.");
      return;
    }

    const currentList = activityType === "Calls" ? (leg.calls_list || []) : (leg.pms_list || []);
    if (currentList.some(item => item.barcode === barcode)) {
      toast.error("This barcode has already been added to this leg.");
      return;
    }

    try {
      const res = await expenseService.verifyBarcode(barcode);
      if (res.success && res.data) {
        const hospitalName = res.data.hospital_name;
        // Check matching with From/To
        const fromMatch = (leg.from || "").toLowerCase().trim() === hospitalName.toLowerCase().trim();
        const toMatch = (leg.to || "").toLowerCase().trim() === hospitalName.toLowerCase().trim();
        
        if (!fromMatch && !toMatch) {
          toast.error(`Verification Failed: This barcode belongs to "${hospitalName}", which does not match either the Starting Location (From) or Destination Location (To) facility of this leg!`);
          return;
        }

        // Successfully matched!
        toast.success("Barcode verified successfully! You can now click '+' to add it.");
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          if (activityType === "Calls") {
            return {
              ...l,
              calls_verified: true,
              calls_asset_details: res.data
            };
          } else {
            return {
              ...l,
              pms_verified: true,
              pms_asset_details: res.data
            };
          }
        }));
      } else {
        toast.error(res.message || "Barcode not found in assets inventory.");
      }
    } catch (e) {
      console.error("Barcode verification error", e);
      toast.error("Error during barcode verification.");
    }
  };

  const addVerifiedBarcode = (legNum: number, activityType: "Calls" | "PMS") => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      if (activityType === "Calls") {
        if (!l.calls_verified || !l.calls_asset_details) {
          toast.error("Please verify the barcode first.");
          return l;
        }
        const newItem = {
          barcode: l.calls_barcode || "",
          verified: true,
          type: l.calls_type || "Support Call",
          status: l.calls_status || "Attend",
          asset_details: l.calls_asset_details,
          photo_url: l.calls_photo_url || ""
        };
        return {
          ...l,
          calls_list: [...(l.calls_list || []), newItem],
          calls_barcode: "",
          calls_verified: false,
          calls_asset_details: null,
          calls_photo_url: ""
        };
      } else {
        if (!l.pms_verified || !l.pms_asset_details) {
          toast.error("Please verify the barcode first.");
          return l;
        }
        const newItem = {
          barcode: l.pms_barcode || "",
          verified: true,
          frequency: l.pms_frequency || "3 month",
          asset_details: l.pms_asset_details,
          photo_url: l.pms_photo_url || ""
        };
        return {
          ...l,
          pms_list: [...(l.pms_list || []), newItem],
          pms_barcode: "",
          pms_verified: false,
          pms_asset_details: null,
          pms_photo_url: ""
        };
      }
    }));
  };

  const removeBarcode = (legNum: number, activityType: "Calls" | "PMS", index: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      if (activityType === "Calls") {
        return {
          ...l,
          calls_list: (l.calls_list || []).filter((_, idx) => idx !== index)
        };
      } else {
        return {
          ...l,
          pms_list: (l.pms_list || []).filter((_, idx) => idx !== index)
        };
      }
    }));
  };

  const uploadActivityPhoto = async (legNum: number, activityType: "Calls" | "PMS", file: File) => {
    // Validate file type
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      toast.error("Only image files are allowed for Call/PMS photos!");
      return;
    }

    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      return activityType === "Calls" 
        ? { ...l, calls_photo_loading: true }
        : { ...l, pms_photo_loading: true };
    }));

    try {
      let processedFile = file;
      
      // Compress image if larger than 50KB
      if (file.size > 50 * 1024) {
        const toastId = toast.loading(`Compressing photo... (${Math.round(file.size / 1024)}KB)`);
        try {
          processedFile = await compressImage(file);
          toast.dismiss(toastId);
          toast.success(`Compressed to ${Math.round(processedFile.size / 1024)}KB ✓`, { duration: 2000 });
        } catch {
          toast.dismiss(toastId);
          processedFile = file;
        }
      }

      // Validate final size (maximum 2MB)
      if (processedFile.size > 2 * 1024 * 1024) {
        toast.error("Photo size exceeds the 2MB limit. Please upload a smaller photo.");
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          return activityType === "Calls"
            ? { ...l, calls_photo_loading: false }
            : { ...l, pms_photo_loading: false };
        }));
        return;
      }

      const data = await uploadService.uploadReceipt(processedFile);
      if (data && data.url) {
        setItineraries(prev => prev.map(l => {
          if (l.leg !== legNum) return l;
          return activityType === "Calls"
            ? { ...l, calls_photo_url: data.url, calls_photo_name: file.name, calls_photo_loading: false }
            : { ...l, pms_photo_url: data.url, pms_photo_name: file.name, pms_photo_loading: false };
        }));
        toast.success("Photo uploaded successfully.");
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (e) {
      console.error("Photo upload error", e);
      toast.error("Failed to upload photo.");
      setItineraries(prev => prev.map(l => {
        if (l.leg !== legNum) return l;
        return activityType === "Calls"
          ? { ...l, calls_photo_loading: false }
          : { ...l, pms_photo_loading: false };
      }));
    }
  };

  const addAssetTag = (legNum: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      const eq = l.asset_tagging_equipment;
      const qty = l.asset_tagging_quantity || "0";
      if (!eq) {
        toast.error("Please select an equipment first.");
        return l;
      }
      if (parseInt(qty) <= 0) {
        toast.error("Please enter a valid quantity greater than 0.");
        return l;
      }
      
      const currentList = l.assets_list || [];
      if (currentList.some(item => item.equipment_name === eq)) {
        toast.error("This equipment has already been added to this leg.");
        return l;
      }

      return {
        ...l,
        assets_list: [...currentList, { equipment_name: eq, quantity: qty }],
        asset_tagging_equipment: "",
        asset_tagging_quantity: "0"
      };
    }));
  };

  const removeAssetTag = (legNum: number, index: number) => {
    setItineraries(prev => prev.map(l => {
      if (l.leg !== legNum) return l;
      return {
        ...l,
        assets_list: (l.assets_list || []).filter((_, idx) => idx !== index)
      };
    }));
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
    let totalLocalPurchaseVal = 0;
    let totalBikeCarKmVal = 0;
    let totalBikeCarAmtVal = 0;

    itineraries.forEach((leg, index) => {
      const legNum = index + 1;
      const legKm = parseFloat(leg.km) || 0;
      const legAmt = parseFloat(leg.amount) || 0;
      const subAmt = parseFloat(leg.sub_amount) || 0;
      const otherAmt = parseFloat(leg.oth_amount) || 0;

      if (leg.mode === "Bike" || leg.mode === "Car") {
        totalKmVal += legKm;
        totalBikeCarKmVal += legKm;
        totalBikeCarAmtVal += legAmt;
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
        const lpAmt = parseFloat(leg.local_purchase) || 0;
        totalAmtVal += daAmt + hotelAmt + lpAmt;
        totalDAVal += daAmt;
        totalHotelVal += hotelAmt;
        totalLocalPurchaseVal += lpAmt;
      }
    });

    return { 
      totalKm: totalKmVal, 
      totalAmt: totalAmtVal, 
      totalAuto: totalAutoVal, 
      totalDA: totalDAVal, 
      totalHotel: totalHotelVal, 
      totalOther: totalOtherVal,
      totalLocalPurchase: totalLocalPurchaseVal,
      totalBikeCarKm: totalBikeCarKmVal,
      totalBikeCarAmt: totalBikeCarAmtVal
    };
  };

  const { totalKm, totalAmt, totalAuto, totalDA, totalHotel, totalOther, totalLocalPurchase, totalBikeCarKm, totalBikeCarAmt } = calculateTotals();

  // Compute aggregate visit metrics across all itineraries
  const totalCallsAttended = itineraries.reduce((sum, leg) => {
    return sum + (leg.calls_list || []).filter(c => c.status === "Attend" || c.status === "Attend & Close").length;
  }, 0);

  const totalCallsClosed = itineraries.reduce((sum, leg) => {
    return sum + (leg.calls_list || []).filter(c => c.status === "Close" || c.status === "Attend & Close").length;
  }, 0);

  const totalPmsDone = itineraries.reduce((sum, leg) => {
    return sum + (leg.pms_list || []).length;
  }, 0);

  const totalAssetsTagged = itineraries.reduce((sum, leg) => {
    return sum + (leg.assets_list || []).reduce((s, item) => s + (parseInt(item.quantity || "0") || 0), 0);
  }, 0);

  const totalMobiliseAsset = itineraries.reduce((sum, leg) => {
    return sum + (parseInt(leg.mobilise_asset_count || "0") || 0);
  }, 0);

  const totalCalibration = itineraries.reduce((sum, leg) => {
    return sum + (parseInt(leg.calibration_count || "0") || 0);
  }, 0);

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

  const validateClaim = (customItineraries?: ItineraryLeg[]) => {
    const listToValidate = customItineraries || itineraries;
    if (!date) {
      toast.error("Please choose a travel date first.");
      return false;
    }

    for (let idx = 0; idx < listToValidate.length; idx++) {
      const leg = listToValidate[idx];
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

        const lpAmt = parseFloat(leg.local_purchase) || 0;
        const lpBill = files[1]?.local_purchase_bill;
        const hasLpAttachment = lpBill || hasExistingFile(1, "Local_Purchase");
        if (lpAmt >= 300 && !hasLpAttachment) {
          toast.error("Please upload a receipt for local purchase since the amount is ₹300 or more.");
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

      // Dynamic activities validations
      const acts = leg.selected_activities || [];
      if (acts.length === 0) {
        toast.error(`Leg ${legNum}: Please select at least one activity (Calls, PMS, Asset Tagging, etc.)`);
        return false;
      }
      
      if (acts.includes("Calls")) {
        if ((leg.calls_list || []).length === 0) {
          toast.error(`Leg ${legNum}: Please add and verify at least one barcode for Calls.`);
          return false;
        }
      }

      if (acts.includes("PMS")) {
        if ((leg.pms_list || []).length === 0) {
          toast.error(`Leg ${legNum}: Please add and verify at least one barcode for PMS.`);
          return false;
        }
      }

      if (acts.includes("Asset Tagging")) {
        if ((leg.assets_list || []).length === 0) {
          toast.error(`Leg ${legNum}: Please add at least one tagged equipment and quantity.`);
          return false;
        }
      }

      if (acts.includes("Mobilise Asset Update")) {
        const qty = parseInt(leg.mobilise_asset_count || "0") || 0;
        if (qty <= 0) {
          toast.error(`Leg ${legNum}: Please enter a valid quantity for Mobilise Asset Update.`);
          return false;
        }
      }

      if (acts.includes("Calibration")) {
        const qty = parseInt(leg.calibration_count || "0") || 0;
        if (qty <= 0) {
          toast.error(`Leg ${legNum}: Please enter a valid quantity for Calibration.`);
          return false;
        }
      }

      if (acts.includes("Other")) {
        if (!leg.activity_other_desc || !leg.activity_other_desc.trim()) {
          toast.error(`Leg ${legNum}: Please enter description for Other activity.`);
          return false;
        }
      }
    }

    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-add any unadded asset tagging equipment selection to the list
    const processedItineraries = itineraries.map(l => {
      if (l.selected_activities?.includes("Asset Tagging") && l.asset_tagging_equipment) {
        const qty = parseInt(l.asset_tagging_quantity || "0") || 0;
        if (qty > 0) {
          const currentList = l.assets_list || [];
          if (!currentList.some(item => item.equipment_name === l.asset_tagging_equipment)) {
            return {
              ...l,
              assets_list: [...currentList, { equipment_name: l.asset_tagging_equipment, quantity: qty.toString() }],
              asset_tagging_equipment: "",
              asset_tagging_quantity: "0"
            };
          }
        }
      }
      return l;
    });

    setItineraries(processedItineraries);

    if (!validateClaim(processedItineraries)) return;
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
        const acts = leg.selected_activities || [];
        
        const callsList = leg.calls_list || [];
        const pmsList = leg.pms_list || [];
        const assetsList = leg.assets_list || [];

        // Compute CRM work metrics based on list entries
        const ws_assigned = acts.includes("Calls") ? callsList.length : 0;
        const ws_closed = acts.includes("Calls") ? callsList.filter(c => c.status === "Close" || c.status === "Attend & Close").length : 0;
        const ws_pms = acts.includes("PMS") ? pmsList.length : 0;
        const ws_asset = acts.includes("Asset Tagging") ? assetsList.reduce((sum, item) => sum + (parseInt(item.quantity || "0") || 0), 0) : 0;

        const detailsObj = {
          selected_activities: acts,
          calls_barcode: leg.calls_barcode || "",
          calls_verified: !!leg.calls_verified,
          calls_asset_details: leg.calls_asset_details || null,
          calls_type: leg.calls_type || "Support Call",
          calls_status: leg.calls_status || "Attend",
          pms_barcode: leg.pms_barcode || "",
          pms_verified: !!leg.pms_verified,
          pms_asset_details: leg.pms_asset_details || null,
          pms_frequency: leg.pms_frequency || "3 month",
          asset_tagging_equipment: leg.asset_tagging_equipment || "",
          asset_tagging_quantity: leg.asset_tagging_quantity || "0",
          mobilise_asset_count: leg.mobilise_asset_count || "0",
          calibration_count: leg.calibration_count || "0",
          activity_other_desc: leg.activity_other_desc || "",
          calls_list: callsList,
          pms_list: pmsList,
          assets_list: assetsList
        };

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
          local_purchase: legNum === 1 ? leg.local_purchase : "0",
          oth_desc: leg.oth_desc,
          oth_amount: leg.oth_amount,
          ws_assigned: ws_assigned.toString(),
          ws_closed: ws_closed.toString(),
          ws_pms: ws_pms.toString(),
          ws_asset: ws_asset.toString(),
          visit_purpose: acts.length > 0 ? `Activities: ${acts.join(", ")}` : "Field visit",
          activity_details: JSON.stringify(detailsObj)
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
          if (legNum === 1 && legFiles.local_purchase_bill) formData.append("local_purchase_bill_1", legFiles.local_purchase_bill);
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
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-md">
              {allowance.vehicle_type === "Car" ? (
                <Car className="w-5 h-5" />
              ) : allowance.vehicle_type === "Bike" ? (
                <Bike className="w-5 h-5" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
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
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-md">
              <Bus className="w-5 h-5" />
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
        <div className="space-y-6">
          
          <div className="space-y-6">
            
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

                          <div>
                            <label className="label-lte">Local Purchase (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={leg.local_purchase || "0"}
                              onChange={(e) => handleItineraryChange(leg.leg, "local_purchase", e.target.value)}
                              className="input-lte font-bold"
                            />
                          </div>

                          <div>
                            <label className="label-lte">
                              Local Purchase Bill {parseFloat(leg.local_purchase) >= 300 && <span className="text-red-500">*</span>}
                            </label>
                            {!files[leg.leg]?.local_purchase_bill && !hasExistingFile(leg.leg, "Local_Purchase") ? (
                              <input
                                type="file"
                                accept="image/*,application/pdf,.pdf"
                                onChange={(e) => handleLegFileChange(leg.leg, "local_purchase_bill", e.target.files ? e.target.files[0] : null)}
                                className="text-xs file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer w-full mt-1.5"
                              />
                            ) : files[leg.leg]?.local_purchase_bill ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-blue-700 truncate max-w-[100px]">{files[leg.leg]?.local_purchase_bill?.name}</span>
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={() => files[leg.leg]?.local_purchase_bill && setLightboxImage(URL.createObjectURL(files[leg.leg].local_purchase_bill!))} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                  <a href={files[leg.leg]?.local_purchase_bill ? URL.createObjectURL(files[leg.leg].local_purchase_bill!) : ""} download={files[leg.leg]?.local_purchase_bill?.name || "download"} className="text-green-600 hover:underline font-bold">Download</a>
                                  <button type="button" onClick={() => removeLegFile(leg.leg, "local_purchase_bill")} className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Delete</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-green-50 border border-green-200 px-2 py-1 rounded text-[10px] mt-1.5">
                                <span className="font-semibold text-green-700">✓ Retained</span>
                                <div className="flex gap-1.5">
                                  {getExistingFileUrl(leg.leg, "Local_Purchase") && (
                                    <>
                                      <button type="button" onClick={() => setLightboxImage(getExistingFileUrl(leg.leg, "Local_Purchase") || "")} className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer">Preview</button>
                                      <a href={getExistingFileUrl(leg.leg, "Local_Purchase") || ""} download={`local_purchase_bill_${leg.leg}.png`} className="text-green-600 hover:underline font-bold">Download</a>
                                    </>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setDeletedAttachments(prev => [...prev, { leg: leg.leg, type: "Local_Purchase" }])} 
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
                            disabled={!leg.oth_desc.trim()}
                            className={`input-lte font-bold ${!leg.oth_desc.trim() ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
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

                      {/* Visit Activities & Tasks Section */}
                      <div className="border-t border-gray-150 pt-4 flex flex-col gap-4">
                        <div>
                          <label className="label-lte font-bold block mb-2 text-gray-700">Visit Activities / Tasks</label>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 bg-gray-50/50 p-2.5 rounded border border-gray-150">
                            {/* We check if calibration user or regular */}
                            {(() => {
                              const isCalib = (user?.designation || "").toLowerCase().includes("calibration");
                              if (isCalib) {
                                return (
                                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      disabled={true}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    />
                                    <span>Calibration</span>
                                  </label>
                                );
                              }
                              
                              // Else, normal engineer options (excluding Calibration)
                              const options = [
                                { label: "Calls", val: "Calls" },
                                { label: "PMS", val: "PMS" },
                                { label: "Asset Tagging", val: "Asset Tagging" },
                                { label: "Mobilise Asset Update", val: "Mobilise Asset Update" },
                                { label: "Calibration", val: "Calibration" },
                                { label: "Other", val: "Other" }
                              ];
                              
                              return options.map(opt => {
                                const checked = (leg.selected_activities || []).includes(opt.val);
                                return (
                                  <label key={opt.val} className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const current = leg.selected_activities || [];
                                        let next: string[];
                                        if (e.target.checked) {
                                          next = [...current, opt.val];
                                        } else {
                                          next = current.filter(x => x !== opt.val);
                                        }
                                        handleItineraryChange(leg.leg, "selected_activities", next);
                                      }}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Sub-forms for active selections */}
                        <div className="grid grid-cols-1 gap-4">
                          {/* Calls Sub-Form */}
                          {(leg.selected_activities || []).includes("Calls") && (
                            <div className="bg-blue-50/20 border border-blue-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Support Calls Log</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-gray-50/50 p-2.5 rounded border border-gray-200">
                                <div className="sm:col-span-4">
                                  <label className="label-lte font-bold">8-Digit Barcode (QR Code)</label>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      maxLength={8}
                                      value={leg.calls_barcode || ""}
                                      placeholder="Enter 8 digits"
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, "");
                                        handleItineraryChange(leg.leg, "calls_barcode", cleaned);
                                        handleItineraryChange(leg.leg, "calls_verified", false);
                                        handleItineraryChange(leg.leg, "calls_asset_details", null);
                                      }}
                                      className="input-lte font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => verifyLegBarcode(leg.leg, "Calls")}
                                      disabled={!leg.calls_barcode || leg.calls_barcode.length !== 8}
                                      className="btn-lte px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded border-0 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-bold shrink-0"
                                    >
                                      Verify
                                    </button>
                                  </div>
                                </div>
                                <div className="sm:col-span-3">
                                   <label className="label-lte font-bold">Photo (Optional)</label>
                                   {leg.calls_photo_url ? (
                                     <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                       <span className="font-semibold text-blue-700 truncate max-w-[100px]">{leg.calls_photo_name || "photo.jpg"}</span>
                                       <div className="flex gap-2">
                                         <button 
                                           type="button" 
                                           onClick={() => {
                                             const fullUrl = `${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${leg.calls_photo_url}`;
                                             setLightboxImage(fullUrl);
                                           }} 
                                           className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                         >
                                           Preview
                                         </button>
                                         <a 
                                           href={`${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${leg.calls_photo_url}`} 
                                           download={leg.calls_photo_name || "download"} 
                                           className="text-green-600 hover:underline font-bold"
                                         >
                                           Download
                                         </a>
                                         <button 
                                           type="button" 
                                           onClick={() => {
                                             handleItineraryChange(leg.leg, "calls_photo_url", "");
                                             handleItineraryChange(leg.leg, "calls_photo_name", "");
                                           }} 
                                           className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                         >
                                           Delete
                                         </button>
                                       </div>
                                     </div>
                                   ) : (
                                     <div className="relative">
                                       <input
                                         type="file"
                                         accept="image/*"
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) {
                                             uploadActivityPhoto(leg.leg, "Calls", file);
                                           }
                                         }}
                                         className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-350 file:text-[10px] file:font-bold file:uppercase file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer w-full"
                                       />
                                       {leg.calls_photo_loading && <span className="text-[9px] text-blue-600 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                     </div>
                                   )}
                                 </div>
                                <div className="sm:col-span-2">
                                  <label className="label-lte font-bold">Call Type</label>
                                  <select
                                    value={leg.calls_type || "Support Call"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_type", e.target.value)}
                                    className="input-lte text-xs font-semibold py-1.5 px-2 bg-white"
                                  >
                                    <option value="Support Call">Support Call</option>
                                    <option value="Online Call">Online Call</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="label-lte font-bold">Call Status</label>
                                  <select
                                    value={leg.calls_status || "Attend"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calls_status", e.target.value)}
                                    className="input-lte text-xs font-semibold py-1.5 px-2 bg-white"
                                  >
                                    <option value="Attend">Attend</option>
                                    <option value="Close">Close</option>
                                    <option value="Attend & Close">Attend & Close</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-1 flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => addVerifiedBarcode(leg.leg, "Calls")}
                                    disabled={!leg.calls_verified}
                                    className="btn-lte w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded border-0 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                                    title="Add Verified Entry"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Verified Preview Info */}
                              {leg.calls_verified && leg.calls_asset_details && (
                                <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] p-2 rounded flex flex-wrap gap-x-4">
                                  <span><strong>Verified Asset:</strong> {leg.calls_asset_details.equipment_name} ({leg.calls_asset_details.model_name})</span>
                                  <span><strong>Hospital:</strong> {leg.calls_asset_details.hospital_name}</span>
                                  <span><strong>District:</strong> {leg.calls_asset_details.district_name}</span>
                                  <span><strong>Status:</strong> {leg.calls_asset_details.inventory_status}</span>
                                </div>
                              )}

                              {/* Added Barcodes Table */}
                              {(leg.calls_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-hidden mt-2 bg-white">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left">District Name</th>
                                        <th className="py-1.5 px-2 text-left">Hospital Name</th>
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-left">Model</th>
                                        <th className="py-1.5 px-2 text-left font-mono">Bar Code</th>
                                        <th className="py-1.5 px-2 text-left">Inventory Status</th>
                                        <th className="py-1.5 px-2 text-left">Call Type</th>
                                        <th className="py-1.5 px-2 text-left">Call Status</th>
                                        <th className="py-1.5 px-2 text-center w-12">Photo</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.calls_list || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.district_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.hospital_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700 font-bold">{item.asset_details?.equipment_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.model_name || "—"}</td>
                                          <td className="py-1.5 px-2 font-mono font-bold text-gray-800">{item.barcode}</td>
                                          <td className="py-1.5 px-2">
                                            <span className="px-1.5 py-0.5 rounded font-bold text-[8px] uppercase bg-green-50 text-green-700 border border-green-200">
                                              {item.asset_details?.inventory_status || "Active"}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-600 font-semibold">{item.type}</td>
                                          <td className="py-1.5 px-2">
                                            <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] uppercase ${
                                              item.status === "Close" ? "bg-green-50 text-green-700 border border-green-200" :
                                              item.status === "Attend & Close" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                              "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            {item.photo_url ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const fullUrl = `${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${item.photo_url}`;
                                                  setLightboxImage(fullUrl);
                                                }}
                                                className="text-xs text-blue-600 font-bold hover:underline border-0 bg-transparent cursor-pointer"
                                              >
                                                Preview
                                              </button>
                                            ) : (
                                              <span className="text-[10px] text-gray-400">—</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removeBarcode(leg.leg, "Calls", idx)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                              title="Remove Call entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* PMS Sub-Form */}
                          {(leg.selected_activities || []).includes("PMS") && (
                            <div className="bg-amber-50/20 border border-amber-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Planned Maintenance Services (PMS)</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-gray-50/50 p-2.5 rounded border border-gray-200">
                                <div className="sm:col-span-4">
                                  <label className="label-lte font-bold">8-Digit Barcode (QR Code)</label>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      maxLength={8}
                                      value={leg.pms_barcode || ""}
                                      placeholder="Enter 8 digits"
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, "");
                                        handleItineraryChange(leg.leg, "pms_barcode", cleaned);
                                        handleItineraryChange(leg.leg, "pms_verified", false);
                                        handleItineraryChange(leg.leg, "pms_asset_details", null);
                                      }}
                                      className="input-lte font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => verifyLegBarcode(leg.leg, "PMS")}
                                      disabled={!leg.pms_barcode || leg.pms_barcode.length !== 8}
                                      className="btn-lte px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded border-0 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-bold shrink-0"
                                    >
                                      Verify
                                    </button>
                                  </div>
                                </div>
                                <div className="sm:col-span-3">
                                  <label className="label-lte font-bold">Photo (Optional)</label>
                                  {leg.pms_photo_url ? (
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs">
                                      <span className="font-semibold text-blue-700 truncate max-w-[100px]">{leg.pms_photo_name || "photo.jpg"}</span>
                                      <div className="flex gap-2">
                                        <button 
                                          type="button" 
                                          onClick={() => {
                                            const fullUrl = `${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${leg.pms_photo_url}`;
                                            setLightboxImage(fullUrl);
                                          }} 
                                          className="text-blue-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                        >
                                          Preview
                                        </button>
                                        <a 
                                          href={`${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${leg.pms_photo_url}`} 
                                          download={leg.pms_photo_name || "download"} 
                                          className="text-green-600 hover:underline font-bold"
                                        >
                                          Download
                                        </a>
                                        <button 
                                          type="button" 
                                          onClick={() => {
                                            handleItineraryChange(leg.leg, "pms_photo_url", "");
                                            handleItineraryChange(leg.leg, "pms_photo_name", "");
                                          }} 
                                          className="text-rose-600 hover:underline border-0 bg-transparent font-bold cursor-pointer"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            uploadActivityPhoto(leg.leg, "PMS", file);
                                          }
                                        }}
                                        className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-350 file:text-[10px] file:font-bold file:uppercase file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer w-full"
                                      />
                                      {leg.pms_photo_loading && <span className="text-[9px] text-blue-600 font-semibold block animate-pulse mt-0.5">Uploading...</span>}
                                    </div>
                                  )}
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="label-lte font-bold">PMS Frequency Period</label>
                                  <select
                                    value={leg.pms_frequency || "3 month"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "pms_frequency", e.target.value)}
                                    className="input-lte text-xs font-semibold py-1.5 px-2 bg-white"
                                  >
                                    <option value="3 month">3 month</option>
                                    <option value="6 month">6 month</option>
                                    <option value="12 month">12 month</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-1 flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => addVerifiedBarcode(leg.leg, "PMS")}
                                    disabled={!leg.pms_verified}
                                    className="btn-lte w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded border-0 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                                    title="Add Verified Entry"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Verified Preview Info */}
                              {leg.pms_verified && leg.pms_asset_details && (
                                <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] p-2 rounded flex flex-wrap gap-x-4">
                                  <span><strong>Verified Asset:</strong> {leg.pms_asset_details.equipment_name} ({leg.pms_asset_details.model_name})</span>
                                  <span><strong>Hospital:</strong> {leg.pms_asset_details.hospital_name}</span>
                                  <span><strong>District:</strong> {leg.pms_asset_details.district_name}</span>
                                  <span><strong>Status:</strong> {leg.pms_asset_details.inventory_status}</span>
                                </div>
                              )}

                              {/* Added PMS Barcodes Table */}
                              {(leg.pms_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-hidden mt-2 bg-white">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left">District Name</th>
                                        <th className="py-1.5 px-2 text-left">Hospital Name</th>
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-left">Model</th>
                                        <th className="py-1.5 px-2 text-left font-mono">Bar Code</th>
                                        <th className="py-1.5 px-2 text-left">Inventory Status</th>
                                        <th className="py-1.5 px-2 text-left">PMS Frequency Period</th>
                                        <th className="py-1.5 px-2 text-center w-12">Photo</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.pms_list || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.district_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.hospital_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700 font-bold">{item.asset_details?.equipment_name || "—"}</td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-700">{item.asset_details?.model_name || "—"}</td>
                                          <td className="py-1.5 px-2 font-mono font-bold text-gray-800">{item.barcode}</td>
                                          <td className="py-1.5 px-2">
                                            <span className="px-1.5 py-0.5 rounded font-bold text-[8px] uppercase bg-green-50 text-green-700 border border-green-200">
                                              {item.asset_details?.inventory_status || "Active"}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-[10px] text-gray-600 font-semibold">{item.frequency}</td>
                                          <td className="py-1.5 px-2 text-center">
                                            {item.photo_url ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const fullUrl = `${import.meta.env.VITE_API_URL || "https://expense-backend-zio8.onrender.com"}${item.photo_url}`;
                                                  setLightboxImage(fullUrl);
                                                }}
                                                className="text-xs text-blue-600 font-bold hover:underline border-0 bg-transparent cursor-pointer"
                                              >
                                                Preview
                                              </button>
                                            ) : (
                                              <span className="text-[10px] text-gray-400">—</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removeBarcode(leg.leg, "PMS", idx)}
                                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                              title="Remove PMS entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Asset Tagging Sub-Form */}
                          {(leg.selected_activities || []).includes("Asset Tagging") && (
                            <div className="bg-emerald-50/20 border border-emerald-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Asset Tagging Tasks</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-gray-50/50 p-2.5 rounded border border-gray-200">
                                <div className="sm:col-span-8">
                                  <label className="label-lte font-bold">Select Equipment Name</label>
                                  <select
                                    value={leg.asset_tagging_equipment || ""}
                                    onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_equipment", e.target.value)}
                                    className="input-lte text-xs font-semibold py-1.5 px-2 bg-white"
                                  >
                                    <option value="">-- Choose Equipment --</option>
                                    {assetValueMaster.map((eq, i) => (
                                      <option key={i} value={eq.equipment_name}>
                                        {eq.equipment_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="label-lte font-bold">Quantity Tagged</label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="number"
                                      min="1"
                                      value={leg.asset_tagging_quantity || "0"}
                                      onChange={(e) => handleItineraryChange(leg.leg, "asset_tagging_quantity", e.target.value)}
                                      className="input-lte font-semibold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => addAssetTag(leg.leg)}
                                      disabled={!leg.asset_tagging_equipment || parseInt(leg.asset_tagging_quantity || "0") <= 0}
                                      className="btn-lte p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded border-0 cursor-pointer flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                      title="Add Equipment Tag"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Added Assets Table */}
                              {(leg.assets_list || []).length > 0 && (
                                <div className="border border-gray-200 rounded overflow-hidden mt-2 bg-white">
                                  <table className="table-lte text-xs w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-1.5 px-2 text-left">Equipment Name</th>
                                        <th className="py-1.5 px-2 text-center w-24">Quantity</th>
                                        <th className="py-1.5 px-2 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(leg.assets_list || []).map((item, idx) => {
                                        const qty = parseInt(item.quantity || "0") || 0;
                                        return (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="py-1.5 px-2 font-bold text-gray-800">{item.equipment_name}</td>
                                            <td className="py-1.5 px-2 text-center font-semibold text-gray-600">{qty}</td>
                                            <td className="py-1.5 px-2 text-center">
                                              <button
                                                type="button"
                                                onClick={() => removeAssetTag(leg.leg, idx)}
                                                className="p-1 text-rose-600 hover:bg-rose-50 rounded border-0 bg-transparent cursor-pointer"
                                                title="Remove equipment entry"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mobilise Asset Update Sub-Form */}
                          {(leg.selected_activities || []).includes("Mobilise Asset Update") && (
                            <div className="bg-indigo-50/20 border border-indigo-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
                                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Mobilise Asset Update</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div>
                                  <label className="label-lte">Mobilise Count (Qty)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={leg.mobilise_asset_count || "0"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "mobilise_asset_count", e.target.value)}
                                    className="input-lte font-semibold"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Calibration Sub-Form */}
                          {((leg.selected_activities || []).includes("Calibration") || (user?.designation || "").toLowerCase().includes("calibration")) && (
                            <div className="bg-purple-50/20 border border-purple-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">Calibration Tasks</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div>
                                  <label className="label-lte">Calibration Count (Qty)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={leg.calibration_count || "0"}
                                    onChange={(e) => handleItineraryChange(leg.leg, "calibration_count", e.target.value)}
                                    className="input-lte font-semibold"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Other Task Sub-Form */}
                          {(leg.selected_activities || []).includes("Other") && (
                            <div className="bg-gray-50 border border-gray-150 rounded p-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between border-b border-gray-205 pb-1.5">
                                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Other Activity Description</span>
                              </div>
                              <div>
                                <label className="label-lte">State details of work done</label>
                                <textarea
                                  value={leg.activity_other_desc || ""}
                                  onChange={(e) => handleItineraryChange(leg.leg, "activity_other_desc", e.target.value)}
                                  placeholder="Describe the miscellaneous work performed..."
                                  rows={2}
                                  className="input-lte text-xs font-semibold py-1.5 px-2 bg-white w-full"
                                />
                              </div>
                            </div>
                          )}
                        </div>
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

        </div>

        {/* Claims Totals & Submissions bar (Full width under the grid) */}
        <div className="bg-white border border-gray-250 border-t-4 border-t-green-600 rounded shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs font-semibold mt-6 w-full">
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[11px]">
            <div className="flex items-center gap-1.5 border-r border-gray-200 pr-4 md:pr-6">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-extrabold uppercase text-gray-700 tracking-wide">Claim Summary</span>
            </div>
            <div>
              <span className="text-gray-400 uppercase text-[9px] block mb-0.5">TRAVEL DATE</span>
              <span className="text-gray-800">{date || "No date selected"}</span>
            </div>
            {totalBikeCarKm > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">BIKE / CAR</span>
                <span className="text-gray-800 font-mono">{totalBikeCarKm.toFixed(1)} KM (₹{totalBikeCarAmt.toLocaleString()})</span>
              </div>
            )}
            {totalAuto > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">AUTO COST</span>
                <span className="text-gray-800 font-mono">₹{totalAuto.toLocaleString()}</span>
              </div>
            )}
            {totalDA > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">DA</span>
                <span className="text-gray-800 font-mono">₹{totalDA.toLocaleString()}</span>
              </div>
            )}
            {totalHotel > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">HOTEL</span>
                <span className="text-gray-800 font-mono">₹{totalHotel.toLocaleString()}</span>
              </div>
            )}
            {totalLocalPurchase > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">LOCAL PURCHASE</span>
                <span className="text-gray-800 font-mono">₹{totalLocalPurchase.toLocaleString()}</span>
              </div>
            )}
            {totalOther > 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">OTHER</span>
                <span className="text-gray-800 font-mono">₹{totalOther.toLocaleString()}</span>
              </div>
            )}
            {totalBikeCarKm === 0 && totalAuto === 0 && (
              <div>
                <span className="text-gray-400 uppercase text-[9px] block mb-0.5">DISTANCE</span>
                <span className="text-gray-800 font-mono">0.0 KM</span>
              </div>
            )}
            <div className="border-l border-gray-200 pl-4 md:pl-6">
              <span className="text-gray-900 font-black uppercase text-[10px] block mb-0.5">TOTAL AMOUNT</span>
              <span className="text-blue-700 font-black font-mono text-sm">₹{totalAmt.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLimitExceeded && (
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="btn-lte-warning py-1.5 px-3 rounded text-[10px] font-extrabold uppercase cursor-pointer"
              >
                Extend Limit
              </button>
            )}
            <button
              type="submit"
              disabled={isLimitExceeded || submitting}
              className="btn-lte-success py-2 px-6 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-0 cursor-pointer text-xs"
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
              className="btn-lte-outline py-2 px-4 font-bold uppercase tracking-wider text-center cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Visit Activities Metrics Summary Panel */}
        <div className="bg-slate-50 border border-gray-250 border-t-4 border-t-blue-600 rounded shadow-sm p-4 flex flex-wrap items-center gap-6 mt-4 w-full text-xs font-semibold">
          <div className="flex items-center gap-1.5 border-r border-gray-200 pr-4 md:pr-6">
            <Bookmark className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-extrabold uppercase text-gray-700 tracking-wide">Tasks Summary</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">CALLS ATTENDED</span>
            <span className="text-gray-800 font-mono font-bold text-sm">{totalCallsAttended}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">CALLS CLOSED</span>
            <span className="text-gray-800 font-mono font-bold text-sm text-green-700">{totalCallsClosed}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">PMS DONE</span>
            <span className="text-gray-800 font-mono font-bold text-sm text-amber-700">{totalPmsDone}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">ASSETS TAGGED</span>
            <span className="text-gray-800 font-mono font-bold text-sm text-emerald-700">{totalAssetsTagged}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">MOBILISE ASSETS</span>
            <span className="text-gray-800 font-mono font-bold text-sm text-indigo-700">{totalMobiliseAsset}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[9px] block mb-0.5">CALIBRATIONS</span>
            <span className="text-gray-800 font-mono font-bold text-sm text-purple-700">{totalCalibration}</span>
          </div>
        </div>

      </form>

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
                {claims.slice((myClaimsPage - 1) * 25, myClaimsPage * 25).map((exp) => (
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

        {claims.length > 25 && (
          <div className="px-5 py-3.5 border-t border-gray-200 bg-slate-50 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {((myClaimsPage - 1) * 25) + 1} to {Math.min(myClaimsPage * 25, claims.length)} of {claims.length} entries</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={myClaimsPage === 1}
                onClick={() => setMyClaimsPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={myClaimsPage >= Math.ceil(claims.length / 25)}
                onClick={() => setMyClaimsPage(p => Math.min(p + 1, Math.ceil(claims.length / 25)))}
                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
                              <th className="py-2 px-3 text-right">Local Purchase</th>
                              <th className="py-2 px-3">Other / Misc</th>
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
                              const lpCost = leg.local_purchase || 0;
                              const otherCost = leg.oth_amount || 0;
                              const legTotal = travelCost + subCost + daCost + hotelCost + lpCost + otherCost;

                              let actDetails: any = null;
                              try {
                                if (leg.activity_details) {
                                  actDetails = typeof leg.activity_details === "string" ? JSON.parse(leg.activity_details) : leg.activity_details;
                                }
                              } catch (e) {
                                console.error("Error parsing activity details", e);
                              }

                              const callsList = actDetails?.calls_list || [];
                              const pmsList = actDetails?.pms_list || [];
                              const assetsList = actDetails?.assets_list || [];
                              const selectedActs = actDetails?.selected_activities || leg.selected_activities || [];
                              const mobiliseCount = parseInt(actDetails?.mobilise_asset_count || leg.mobilise_asset_count || "0") || 0;
                              const calibrationCount = parseInt(actDetails?.calibration_count || leg.calibration_count || "0") || 0;
                              const activityOtherDesc = actDetails?.activity_other_desc || leg.activity_other_desc || "";

                              const hasActivities = selectedActs.length > 0 || callsList.length > 0 || pmsList.length > 0 || assetsList.length > 0;

                              return (
                                <React.Fragment key={idx}>
                                  <tr className="hover:bg-gray-50 transition-colors">
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
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{lpCost.toLocaleString()}</td>
                                    <td className="py-2.5 px-3">
                                      <span className="font-mono font-bold">₹{otherCost.toLocaleString()}</span>
                                      {leg.oth_desc && <span className="text-[9px] text-gray-400 block truncate max-w-[100px]" title={leg.oth_desc}>{leg.oth_desc}</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] text-gray-500">
                                      <span>W:{leg.ws_assigned||0}</span> <span className="text-green-600">D:{leg.ws_closed||0}</span> <span>P:{leg.ws_pms||0}</span> <span>A:{leg.ws_asset||0}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold font-mono text-gray-900">₹{legTotal.toLocaleString()}</td>
                                  </tr>
                                  
                                  {hasActivities && (
                                    <tr className="bg-slate-50/50">
                                      <td colSpan={9} className="py-2.5 px-4 border-t border-gray-150">
                                        <div className="flex flex-col gap-2.5">
                                          <div className="flex flex-wrap gap-2">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase mr-2 mt-0.5">Activities:</span>
                                            {selectedActs.map((act: string, actIdx: number) => (
                                              <span key={actIdx} className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[8px] font-bold text-gray-700 uppercase">
                                                {act}
                                              </span>
                                            ))}
                                          </div>

                                          {/* Sub-table for Calls */}
                                          {selectedActs.includes("Calls") && callsList.length > 0 && (
                                            <div className="border border-blue-100 rounded overflow-hidden bg-white max-w-4xl">
                                              <div className="px-2 py-1 bg-blue-50/50 border-b border-blue-100 text-[9px] font-bold text-blue-700 uppercase">Support Calls Logs</div>
                                              <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                                <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                                  <tr>
                                                    <th className="py-1 px-2 text-left">District Name</th>
                                                    <th className="py-1 px-2 text-left">Hospital Name</th>
                                                    <th className="py-1 px-2 text-left">Equipment Name</th>
                                                    <th className="py-1 px-2 text-left">Model</th>
                                                    <th className="py-1 px-2 text-left font-mono">Bar Code</th>
                                                    <th className="py-1 px-2 text-left">Inventory Status</th>
                                                    <th className="py-1 px-2 text-left">Call Type</th>
                                                    <th className="py-1 px-2 text-left">Call Status</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {callsList.map((c: any, cIdx: number) => (
                                                    <tr key={cIdx}>
                                                      <td className="py-1 px-2 text-gray-700">{c.asset_details?.district_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-700">{c.asset_details?.hospital_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-805 font-bold">{c.asset_details?.equipment_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-700">{c.asset_details?.model_name || "—"}</td>
                                                      <td className="py-1 px-2 font-mono font-bold text-gray-700">{c.barcode}</td>
                                                      <td className="py-1 px-2">
                                                        <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-green-50 text-green-700 border border-green-200">
                                                          {c.asset_details?.inventory_status || "Active"}
                                                        </span>
                                                      </td>
                                                      <td className="py-1 px-2 text-gray-650">{c.type || "Support Call"}</td>
                                                      <td className="py-1 px-2">
                                                        <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                                          {c.status || "Attend"}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}

                                          {/* Sub-table for PMS */}
                                          {selectedActs.includes("PMS") && pmsList.length > 0 && (
                                            <div className="border border-amber-100 rounded overflow-hidden bg-white max-w-4xl">
                                              <div className="px-2 py-1 bg-amber-50/50 border-b border-amber-100 text-[9px] font-bold text-amber-700 uppercase">PMS Service Logs</div>
                                              <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                                <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                                  <tr>
                                                    <th className="py-1 px-2 text-left">District Name</th>
                                                    <th className="py-1 px-2 text-left">Hospital Name</th>
                                                    <th className="py-1 px-2 text-left">Equipment Name</th>
                                                    <th className="py-1 px-2 text-left">Model</th>
                                                    <th className="py-1 px-2 text-left font-mono">Bar Code</th>
                                                    <th className="py-1 px-2 text-left">Inventory Status</th>
                                                    <th className="py-1 px-2 text-left">PMS Frequency Period</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {pmsList.map((p: any, pIdx: number) => (
                                                    <tr key={pIdx}>
                                                      <td className="py-1 px-2 text-gray-700">{p.asset_details?.district_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-700">{p.asset_details?.hospital_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-805 font-bold">{p.asset_details?.equipment_name || "—"}</td>
                                                      <td className="py-1 px-2 text-gray-700">{p.asset_details?.model_name || "—"}</td>
                                                      <td className="py-1 px-2 font-mono font-bold text-gray-700">{p.barcode}</td>
                                                      <td className="py-1 px-2">
                                                        <span className="px-1 py-0.2 rounded font-extrabold text-[7px] uppercase bg-green-50 text-green-700 border border-green-200">
                                                          {p.asset_details?.inventory_status || "Active"}
                                                        </span>
                                                      </td>
                                                      <td className="py-1 px-2 text-gray-650">{p.frequency || "3 month"}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}

                                          {/* Sub-table for Asset Tagging */}
                                          {selectedActs.includes("Asset Tagging") && assetsList.length > 0 && (
                                            <div className="border border-emerald-100 rounded overflow-hidden bg-white max-w-4xl">
                                              <div className="px-2 py-1 bg-emerald-50/50 border-b border-emerald-100 text-[9px] font-bold text-emerald-700 uppercase">Asset Tagging Records</div>
                                              <table className="min-w-full divide-y divide-gray-100 text-[10px] text-left">
                                                <thead className="bg-gray-50 text-[8px] text-gray-400 font-bold uppercase">
                                                  <tr>
                                                    <th className="py-1 px-2 text-left">Equipment Name</th>
                                                    <th className="py-1 px-2 text-center w-20">Quantity</th>
                                                    {(() => {
                                                      const isEngineer = (user.designation || "").toLowerCase().trim() === "engineer" || 
                                                                         (user.role || "").toLowerCase().trim() === "engineer";
                                                      const isSubmitter = (selectedClaim.user_id === user.id) || (selectedClaim.submitter_code === user.user_id);
                                                      const hideCost = isEngineer || isSubmitter;
                                                      return !hideCost ? (
                                                        <>
                                                          <th className="py-1 px-2 text-right w-28">Tender Rate</th>
                                                          <th className="py-1 px-2 text-right w-28">Total Cost</th>
                                                        </>
                                                      ) : null;
                                                    })()}
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {assetsList.map((a: any, aIdx: number) => {
                                                    const selectedEq = assetValueMaster.find(eq => eq.equipment_name === a.equipment_name);
                                                    const costPerUnit = selectedEq ? (selectedEq.rmsc_tender_cost || 0) : 0;
                                                    const qty = parseInt(a.quantity || "0") || 0;
                                                    const totalCost = qty * costPerUnit;
                                                    
                                                    const isEngineer = (user.designation || "").toLowerCase().trim() === "engineer" || 
                                                                       (user.role || "").toLowerCase().trim() === "engineer";
                                                    const isSubmitter = (selectedClaim.user_id === user.id) || (selectedClaim.submitter_code === user.user_id);
                                                    const hideCost = isEngineer || isSubmitter;
                                                                       
                                                    return (
                                                      <tr key={aIdx}>
                                                        <td className="py-1 px-2 font-semibold text-gray-700">{a.equipment_name}</td>
                                                        <td className="py-1 px-2 text-center text-gray-600">{qty}</td>
                                                        {!hideCost && (
                                                          <>
                                                            <td className="py-1 px-2 text-right text-gray-500">₹{costPerUnit.toLocaleString()}</td>
                                                            <td className="py-1 px-2 text-right font-bold text-emerald-700">₹{totalCost.toLocaleString()}</td>
                                                          </>
                                                        )}
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}

                                          {/* Quantities for Mobilise, Calibration or Other */}
                                          <div className="flex flex-wrap gap-4 text-[10px] text-gray-600 bg-white p-2 rounded border border-gray-100 max-w-3xl">
                                            {selectedActs.includes("Mobilise Asset Update") && (
                                              <div>
                                                <span className="font-bold text-gray-400 uppercase text-[8px] block">Mobilise Qty</span>
                                                <span className="font-bold text-indigo-700">{mobiliseCount} units</span>
                                              </div>
                                            )}
                                            {selectedActs.includes("Calibration") && (
                                              <div>
                                                <span className="font-bold text-gray-400 uppercase text-[8px] block">Calibration Qty</span>
                                                <span className="font-bold text-purple-700">{calibrationCount} units</span>
                                              </div>
                                            )}
                                            {selectedActs.includes("Other") && activityOtherDesc && (
                                              <div className="flex-1">
                                                <span className="font-bold text-gray-400 uppercase text-[8px] block">Other Activity Description</span>
                                                <span className="italic text-gray-700">{activityOtherDesc}</span>
                                              </div>
                                            )}
                                          </div>

                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
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

                  {/* Detailed Edit Logs & Change History */}
                  {selectedClaim.edit_history && selectedClaim.edit_history.length > 0 && (
                    <div className="border border-amber-200 rounded overflow-hidden mt-4">
                      <div className="px-3 py-2 bg-amber-50/50 border-b border-amber-200">
                        <h4 className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Adjustment & Edit Log History</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-lte">
                          <thead>
                            <tr className="border-b border-amber-200 text-[9px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50/20">
                              <th className="py-2 px-3 w-12">Leg</th>
                              <th className="py-2 px-3">Field Edited</th>
                              <th className="py-2 px-3">Original Value</th>
                              <th className="py-2 px-3">Updated Value</th>
                              <th className="py-2 px-3">Reason / Remark</th>
                              <th className="py-2 px-3">Edited By</th>
                              <th className="py-2 px-3 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {selectedClaim.edit_history.map((log: any, logIdx: number) => {
                              const cleanField = log.field_name === "travel_amount" ? "Travel Amount"
                                : log.field_name === "sub_amount" ? "Local Conveyance"
                                : log.field_name === "hotel_amount" ? "Hotel stay"
                                : log.field_name === "other_amount" ? "Local purchase"
                                : log.field_name === "distance_km" ? "Distance KM"
                                : log.field_name === "da_amount" ? "DA Amount"
                                : log.field_name;
                              return (
                                <tr key={logIdx} className="hover:bg-amber-50/10 text-slate-700 bg-white">
                                  <td className="py-2.5 px-3 font-mono font-bold text-gray-500">Leg #{log.leg_number}</td>
                                  <td className="py-2.5 px-3 font-semibold text-gray-800">{cleanField}</td>
                                  <td className="py-2.5 px-3 font-mono text-gray-500">{log.field_name === "distance_km" ? `${log.old_value} KM` : `₹${parseFloat(log.old_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{log.field_name === "distance_km" ? `${log.new_value} KM` : `₹${parseFloat(log.new_value || "0").toLocaleString()}`}</td>
                                  <td className="py-2.5 px-3 italic text-gray-600 max-w-[200px] truncate" title={log.comment}>{log.comment || "—"}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    {log.editor_name} <span className="text-[8px] text-amber-600 font-bold block">{log.editor_role}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-500 font-mono text-[10px]">{formatDateTime(log.created_at)}</td>
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
            {lightboxImage?.toLowerCase().includes(".pdf") || lightboxImage?.toLowerCase().includes("pdf") ? (
              <iframe 
                src={lightboxImage} 
                title="Receipt PDF Preview"
                className="w-[85vw] h-[65vh] max-w-4xl border border-gray-200"
              />
            ) : (
              <img 
                src={lightboxImage} 
                alt="Receipt Invoice Lightbox" 
                className="max-w-full max-h-[70vh] border border-gray-200 object-contain"
              />
            )}
          </div>
        </div>
      )}

    </>
  );
}
