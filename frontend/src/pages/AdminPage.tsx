import React, { useEffect, useState, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { adminService, UserCreatePayload, UserEditPayload, ApprovalHierarchyResponse } from "../services/adminService";
import { authService } from "../services/authService";
import { formatToIST } from "../utils/timezone";
import { safeStorageSetItem } from "../utils/safeStorage";

import { 
  UploadCloud, 
  Pencil, 
  Trash2, 
  Plus, 
  Download, 
  Zap, 
  Users, 
  ShieldCheck, 
  BarChart3, 
  Settings, 
  Building2, 
  ChevronRight, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  LogOut, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  X, 
  Check,
  Info,
  Calendar,
  DollarSign,
  Sliders,
  ArrowLeft,
  Sparkles,
  Key,
  History,
  Activity,
  ShieldAlert,
  Clock,
  LucideIcon
} from "lucide-react";
import ResetApprovalLevelModal from "../components/admin/ResetApprovalLevelModal";
import { 
  Table, 
  Popconfirm, 
  Alert, 
  Spin, 
  InputNumber,
  Switch,
  Tooltip
} from "antd";
import { SaaSDonutChart } from "../components/common/SaaSCharts";

import { 
  EditOutlined, 
  LogoutOutlined, 
  PieChartOutlined
} from "@ant-design/icons";

const LteSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-accent-600 inline-block mr-1.5 shrink-0"></span>
);

const parseSelectedLocations = (raw: string, availableOptions: string[] = []): string[] => {
  if (!raw || !raw.trim()) return [];
  const trimmedRaw = raw.trim();
  const selected: string[] = [];

  const sortedOptions = Array.from(new Set(availableOptions.filter(Boolean))).sort((a, b) => b.length - a.length);
  let remaining = trimmedRaw;

  for (const opt of sortedOptions) {
    if (!opt) continue;
    if (remaining.includes(opt)) {
      selected.push(opt);
      remaining = remaining.split(opt).join("").trim();
    }
  }

  if (remaining.replace(/,/g, "").trim().length > 0) {
    const customParts = remaining.split(",").map(s => s.trim()).filter(s => s.length > 0);
    for (const part of customParts) {
      if (!selected.includes(part)) {
        selected.push(part);
      }
    }
  }

  return Array.from(new Set(selected));
};

const MultiSelectDropdown = ({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder = "Select locations..." 
}: { 
  options: string[], 
  selectedValues: string[], 
  onChange: (vals: string[]) => void, 
  placeholder?: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanOptions = useMemo(() => Array.from(new Set(options.filter(Boolean))), [options]);
  const cleanSelected = useMemo(() => Array.from(new Set(selectedValues.filter(Boolean))), [selectedValues]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (val: string) => {
    if (cleanSelected.includes(val)) {
      onChange(cleanSelected.filter(v => v !== val));
    } else {
      onChange([...cleanSelected, val]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between input-lte text-left cursor-pointer bg-surface min-h-[36px] px-3 py-1.5 border border-line rounded-md shadow-none focus:border-accent-600 focus:outline-none"
      >
        <span className="block truncate text-xs font-semibold text-ink-700">
          {cleanSelected.length > 0 ? cleanSelected.join(", ") : placeholder}
        </span>
        <span className="ml-2 flex items-center pointer-events-none text-ink-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-surface shadow-md border border-line max-h-60 overflow-y-auto py-1 text-xs animate-scale-up">
          {cleanOptions.map((opt) => (
            <label
              key={opt}
              className="flex items-center px-3 py-2 hover:bg-surface-sunken cursor-pointer select-none text-ink-700 font-medium transition-colors"
            >
              <input
                type="checkbox"
                checked={cleanSelected.includes(opt)}
                onChange={() => handleToggle(opt)}
                className="rounded border-line text-accent-600 focus:ring-accent-600 h-4 w-4 mr-2.5 cursor-pointer"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const getErrorMessage = (err: any, fallback: string): string => {
  const serverMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail;
  if (serverMsg) {
    if (typeof serverMsg === "string") return serverMsg;
    if (Array.isArray(serverMsg)) {
      return serverMsg.map(d => {
        if (typeof d === "string") return d;
        return `${d.loc?.join(".") || "error"}: ${d.msg || JSON.stringify(d)}`;
      }).join(", ");
    }
    return typeof serverMsg === "object" ? JSON.stringify(serverMsg) : String(serverMsg);
  }
  return err.message || fallback;
};

const normalizeDateToYYYYMMDD = (dateStr: any): string => {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (!s) return "";

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Handle YYYY/MM/DD
  const matchY = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (matchY) {
    const year = matchY[1];
    const month = matchY[2].padStart(2, "0");
    const day = matchY[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return s;
};

const getInitials = (name: string) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const LEDGER_CHART_COLORS = ["#4338CA", "#0F7A4C", "#B7791F", "#7C3AED", "#0E7490", "#B3261E", "#3B82F6"];

const ALL_WINDOWS = [
  { id: "home", name: "Home" },
  { id: "admin", name: "Admin Panel" },
  { id: "approval", name: "Approval Center" },
  { id: "expense", name: "Submit Expense" },
  { id: "attendance", name: "Attendance Roster" },
  { id: "analysis", name: "Analysis" },
  { id: "report", name: "Month Report" },
  { id: "mis_report", name: "MIS Report" },
  { id: "kpi", name: "KPI Dashboard" },
  { id: "new_dashboard", name: "New Dashboard" },
  { id: "complaint_upload", name: "Complaint Upload" },
  { id: "claim_level_reset", name: "Claim Level Reset" },
  { id: "asset_upload", name: "Asset Inventory" },
  { id: "penalty_report", name: "Penalty Report" },
  { id: "consolidated_report", name: "Consolidated Report" },
  { id: "help", name: "Help Center" },
  { id: "profile", name: "Profile" }
];

type AdminTab = "users" | "approvals" | "permissions" | "analytics" | "settings" | "facilities" | "audit";

interface NavItemConfig {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { 
    id: "users", 
    label: "Users Directory", 
    icon: Users,
    title: "Users Directory & Employee Roster",
    subtitle: "Manage employee roster, credential updates, bulk approvals, and account access."
  },
  { 
    id: "approvals", 
    label: "Team Hierarchy", 
    icon: ShieldCheck,
    title: "Team Hierarchy & Approval Sequences",
    subtitle: "Configure team approval sequences, requester bindings, and multi-tier routing lines."
  },
  { 
    id: "permissions", 
    label: "Roles & Permissions", 
    icon: Key,
    title: "System Roles & Access Privileges Matrix",
    subtitle: "Comprehensive matrix of system privileges, authorization levels, and role capabilities."
  },
  { 
    id: "analytics", 
    label: "Analytics Dashboard", 
    icon: BarChart3,
    title: "Workforce Analytics & Distributions",
    subtitle: "Interactive distribution charts and governance KPIs with real-time filters."
  },
  { 
    id: "settings", 
    label: "System Settings", 
    icon: Settings,
    title: "System Settings & Policy Hub",
    subtitle: "Configure submission windows, monthly cutoff rules, auto-expiry logic, and TA/DA rates."
  },
  { 
    id: "facilities", 
    label: "Facilities & No TA/DA", 
    icon: Building2,
    title: "Facilities & Policy Locations",
    subtitle: "Manage official expense claim locations and zero daily allowance exception hospitals."
  },
  { 
    id: "audit", 
    label: "Activity & Audit Log", 
    icon: History,
    title: "Live System Activity & Governance Audit Trail",
    subtitle: "Real-time chronological ledger of administrative events, roster updates, and policy changes."
  },
];

export default function AdminPage() {
  const [adminUserPageSize, setAdminUserPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState<AdminTab>((() => {
    return (localStorage.getItem("admin_active_tab") as AdminTab) || "users";
  }));

  const [isSyncing, setIsSyncing] = useState(false);

  const [standardFacilities, setStandardFacilities] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  const fetchAuditLogs = async (search?: string) => {
    setAuditLoading(true);
    try {
      const res = await adminService.getAuditLogs(search);
      if (res && res.success) {
        setAuditLogs(res.logs || []);
      }
    } catch (e: any) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportFacilitiesExcel = () => {
    const list = facilitySubTab === "expense" ? standardFacilities : noTaDaHospitals;
    if (list.length === 0) {
      toast.error("No facilities to export.");
      return;
    }
    const exportData = list.map((f: any) => ({
      "ID": f.id || "—",
      "Facility / Hospital Name": f.facility_name || f.hospital_name || "—",
      "District": f.district_name || "—",
      "Type": f.facility_type || "Standard",
      "Zone": f.zone_name || "Rajasthan",
      "Incharge": f.facility_incharge || "N/A",
      "DM Name": f.dm_name || "N/A",
      "Coordinator": f.coordinator_name || "N/A",
      "Category": facilitySubTab === "expense" ? "Expense Facility (facility_details)" : "No TA/DA Exception (no_ta_da_hospitals)"
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, facilitySubTab === "expense" ? "Expense Facilities" : "No TA DA Exceptions");
    XLSX.writeFile(workbook, `facilities_${facilitySubTab}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Facilities exported to Excel!");
  };
  const [noTaDaHospitals, setNoTaDaHospitals] = useState<any[]>([]);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState("");
  const [facilitySubTab, setFacilitySubTab] = useState<"expense" | "notada">("expense");
  const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityDistrict, setNewFacilityDistrict] = useState("");
  const [newFacilityIncharge, setNewFacilityIncharge] = useState("");
  const [newFacilityDmName, setNewFacilityDmName] = useState("");
  const [newFacilityCoordinatorName, setNewFacilityCoordinatorName] = useState("");
  const [newFacilityType, setNewFacilityType] = useState("District Hospital (DH)");
  const [newFacilityZone, setNewFacilityZone] = useState("Zone Jaipur");
  const [newFacilityTargetTable, setNewFacilityTargetTable] = useState<"standard" | "no_ta_da">("standard");
  const [isEditFacilityModalOpen, setIsEditFacilityModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any | null>(null);
  const [facilityZoneFilter, setFacilityZoneFilter] = useState("all");
  const [facilityDistrictFilter, setFacilityDistrictFilter] = useState("all");

  const fetchFacilities = async () => {
    setFacilityLoading(true);
    try {
      const res = await adminService.getFacilities();
      if (res) {
        setStandardFacilities(res.standard_facilities || []);
        setNoTaDaHospitals(res.no_ta_da_hospitals || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load facilities");
    } finally {
      setFacilityLoading(false);
    }
  };

  const handleCreateFacility = async () => {
    if (!newFacilityName.trim() || !newFacilityDistrict.trim()) {
      toast.error("Facility Name and District Name are required!");
      return;
    }
    try {
      const res = await adminService.saveFacility({
        facility_name: newFacilityName.trim(),
        district_name: newFacilityDistrict.trim(),
        target_table: newFacilityTargetTable,
        facility_incharge: newFacilityIncharge.trim() || "N/A",
        dm_name: newFacilityDmName.trim() || "N/A",
        coordinator_name: newFacilityCoordinatorName.trim() || "N/A",
        facility_type: newFacilityType.trim() || "District Hospital (DH)",
        zone_name: newFacilityZone.trim() || "Zone Jaipur",
      });
      toast.success(res.message || "Facility added successfully!");
      setIsAddFacilityModalOpen(false);
      setNewFacilityName("");
      setNewFacilityDistrict("");
      setNewFacilityIncharge("");
      setNewFacilityDmName("");
      setNewFacilityCoordinatorName("");
      fetchFacilities();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to add facility");
    }
  };

  const openEditFacilityModal = (fac: any, type: "standard" | "no_ta_da") => {
    setEditingFacility({ ...fac, target_table: type });
    setNewFacilityName(fac.facility_name || fac.hospital_name || "");
    setNewFacilityDistrict(fac.district_name || "");
    setNewFacilityIncharge(fac.facility_incharge || "");
    setNewFacilityDmName(fac.dm_name || "");
    setNewFacilityCoordinatorName(fac.coordinator_name || "");
    setNewFacilityType(fac.facility_type || "District Hospital (DH)");
    setNewFacilityZone(fac.zone_name || "Zone Jaipur");
    setNewFacilityTargetTable(type);
    setIsEditFacilityModalOpen(true);
  };

  const handleEditFacilitySubmit = async () => {
    if (!editingFacility) return;
    if (!newFacilityName.trim() || !newFacilityDistrict.trim()) {
      toast.error("Facility Name and District Name are required!");
      return;
    }
    try {
      const idToUpdate = editingFacility.id || editingFacility.facility_name || editingFacility.hospital_name;
      const res = await adminService.updateFacility(idToUpdate, {
        facility_name: newFacilityName.trim(),
        district_name: newFacilityDistrict.trim(),
        target_table: newFacilityTargetTable,
        facility_incharge: newFacilityIncharge.trim() || "N/A",
        dm_name: newFacilityDmName.trim() || "N/A",
        coordinator_name: newFacilityCoordinatorName.trim() || "N/A",
        facility_type: newFacilityType.trim() || "District Hospital (DH)",
        zone_name: newFacilityZone.trim() || "Zone Jaipur",
      });
      toast.success(res.message || "Facility updated successfully!");
      setIsEditFacilityModalOpen(false);
      setEditingFacility(null);
      fetchFacilities();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Failed to update facility");
    }
  };

  const handleDeleteFacility = async (id: number | string, type: "standard" | "no_ta_da") => {
    try {
      const res = await adminService.deleteFacility(id, type);
      toast.success(res.message || "Facility removed");
      fetchFacilities();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete facility");
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    localStorage.setItem("admin_active_tab", tab);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (tab === "settings") {
      fetchAllowanceRates();
    } else if (tab === "facilities") {
      fetchFacilities();
    } else if (tab === "audit") {
      fetchAuditLogs();
    }
  };

  const [users, setUsers] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cache_admin_users");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [dropdowns, setDropdowns] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cache_dropdowns");
      return cached ? JSON.parse(cached) : null;
    } catch (_) {}
    return null;
  });
  
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem("cache_admin_users") || !localStorage.getItem("cache_dropdowns");
    } catch (_) {}
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userZoneFilter, setUserZoneFilter] = useState<string>("all");
  const [userDistrictFilter, setUserDistrictFilter] = useState<string>("all");
  const [userManagerFilter, setUserManagerFilter] = useState<string>("all");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");

  // Section 3: Allowance Master state
  const [allowanceRates, setAllowanceRates] = useState<any[]>([]);
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const [savingRates, setSavingRates] = useState<boolean>(false);

  const [chartRoleFilter, setChartRoleFilter] = useState<string>("all");
  const [chartZoneFilter, setChartZoneFilter] = useState<string>("all");
  const [chartDistrictFilter, setChartDistrictFilter] = useState<string>("all");

  // Modals visibility
  const [showSingleUserModal, setShowSingleUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  // Bulk Hierarchy Import Form state
  const [showBulkHierarchyModal, setShowBulkHierarchyModal] = useState(false);
  const [hierarchyCsvText, setHierarchyCsvText] = useState("");
  const [bulkHierarchyLoading, setBulkHierarchyLoading] = useState(false);
  const [bulkHierarchyResult, setBulkHierarchyResult] = useState<any>(null);

  // System Settings state
  const [settings, setSettings] = useState<any>({
    max_past_days_limit: "15",
    monthly_cutoff_day: "3",
    pending_auto_expiry_days: "5",
    pending_auto_action: "reject",
    rejection_fallback_level: "creator"
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<"home" | "submission" | "automation" | "allowances">("home");

  const [resetModalState, setResetModalState] = useState<{ isOpen: boolean; expenseId: number; expenseCode: string }>({
    isOpen: false,
    expenseId: 0,
    expenseCode: "",
  });

  // Single User Create Form state
  const [eCode, setECode] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Engineer");
  const [designation, setDesignation] = useState("");
  const [grade, setGrade] = useState(() => {
    try {
      const cached = localStorage.getItem("cache_dropdowns");
      if (cached) {
        const dd = JSON.parse(cached);
        return dd.grades?.[0] || "";
      }
    } catch (e) {}
    return "A";
  });
  const [zone, setZone] = useState("");
  const [district, setDistrict] = useState("");
  const [manager, setManager] = useState("");
  const [zonalManager, setZonalManager] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mailId, setMailId] = useState("");
  const [userType, setUserType] = useState("Employee");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [eUpkaranId, setEUpkaranId] = useState("");
  const [baseReportingLocation, setBaseReportingLocation] = useState("");
  const [allowedWindows, setAllowedWindows] = useState<string[]>([
    "home", "expense", "help", "profile"
  ]);
  const [singleUserLoading, setSingleUserLoading] = useState(false);
  const [singleUserError, setSingleUserError] = useState<string | null>(null);

  // Edit User Form state
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("Engineer");
  const [editDesignation, setEditDesignation] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editManager, setEditManager] = useState("");
  const [editZonalManager, setEditZonalManager] = useState("");
  const [editCoordinator, setEditCoordinator] = useState("");
  const [editMobileNumber, setEditMobileNumber] = useState("");
  const [editMailId, setEditMailId] = useState("");
  const [editUserStatus, setEditUserStatus] = useState("active");
  const [editUserType, setEditUserType] = useState("Employee");
  const [editDateOfJoining, setEditDateOfJoining] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editEUpkaranId, setEditEUpkaranId] = useState("");
  const [editBaseReportingLocation, setEditBaseReportingLocation] = useState("");
  const [editAllowedWindows, setEditAllowedWindows] = useState<string[]>([]);
  const [editCanBulkApprove, setEditCanBulkApprove] = useState<boolean>(false);
  const [selectedUserIds, setSelectedUserIds] = useState<React.Key[]>([]);
  const [editUserId, setEditUserId] = useState("");
  const [editECode, setEditECode] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isSensitiveSectionUnlocked, setIsSensitiveSectionUnlocked] = useState(false);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Bulk Upload Form state
  const [csvText, setCsvText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hierarchy Team Approvals state
  const [hierarchies, setHierarchies] = useState<ApprovalHierarchyResponse[]>(() => {
    try {
      const cached = localStorage.getItem("cache_hierarchies");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [showHierarchyModal, setShowHierarchyModal] = useState(false);
  const [editingHierarchy, setEditingHierarchy] = useState<any>(null);
  const [hierarchyName, setHierarchyName] = useState("");
  const [selectedRequesterIds, setSelectedRequesterIds] = useState<number[]>([]);
  const [approverRows, setApproverRows] = useState<Array<{
    checked: boolean;
    level: number;
    approverId: string;
  }>>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const cachedUsers = localStorage.getItem("cache_admin_users");
    const cachedDropdowns = localStorage.getItem("cache_dropdowns");
    
    if (cachedUsers && cachedDropdowns) {
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [u, dd, hqs, settingsRes, facRes, ratesRes] = await Promise.all([
        adminService.getUsers(),
        authService.getDropdowns(),
        adminService.getHierarchies(),
        adminService.getSettings(),
        adminService.getFacilities().catch(() => null),
        adminService.getAllowanceRates().catch(() => null)
      ]);
      setUsers(u);
      safeStorageSetItem("cache_admin_users", JSON.stringify(u));

      if (settingsRes && settingsRes.success) {
        setSettings(settingsRes.settings);
      }
      if (facRes) {
        setStandardFacilities(facRes.standard_facilities || []);
        setNoTaDaHospitals(facRes.no_ta_da_hospitals || []);
      }
      if (Array.isArray(ratesRes)) {
        setAllowanceRates(ratesRes);
      }
      
      setDropdowns(dd);
      safeStorageSetItem("cache_dropdowns", JSON.stringify(dd));
      if (dd?.zones) {
        const firstZone = Object.keys(dd.zones)[0];
        setZone(prev => prev || firstZone || "");
        if (dd.zones[firstZone]) {
          setDistrict(prev => prev || dd.zones[firstZone][0] || "");
        }
      }
      if (dd?.designations) {
        setDesignation(prev => prev || dd.designations[0] || "");
      }
      if (dd?.grades && dd.grades.length > 0) {
        const grades = dd.grades;
        setGrade((current: string) => (grades.includes(current) ? current : grades[0]));
      }
      
      setHierarchies(hqs);
      safeStorageSetItem("cache_hierarchies", JSON.stringify(hqs));
    } catch (err: any) {
      if (!cachedUsers) {
        setError(getErrorMessage(err, "Failed to retrieve configuration details from database."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await fetchInitialData();
      if (activeTab === "facilities") {
        await fetchFacilities();
      } else if (activeTab === "settings") {
        await fetchAllowanceRates();
      }
      toast.success("✓ Governance data synchronized with D1 database!");
    } catch (e: any) {
      toast.error("Failed to sync data: " + (e.message || "Unknown error"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      await adminService.saveSettings(settings);
      toast.success("System Settings saved successfully!");
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to save system settings."));
    } finally {
      setSavingSettings(false);
    }
  };

  const getEligibleManagers = () => {
    return users;
  };

  const getEligibleZonalManagers = () => {
    return users;
  };

  const getEligibleCoordinators = () => {
    return users;
  };

  const handleZoneChange = (zName: string) => {
    setZone(zName);
    if (zName === "All") {
      setDistrict("All");
    } else if (dropdowns?.zones?.[zName]) {
      setDistrict(dropdowns.zones[zName][0] || "All");
    }
  };

  const handleEditZoneChange = (zName: string) => {
    setEditZone(zName);
    if (zName === "All") {
      setEditDistrict("All");
    } else if (dropdowns?.zones?.[zName]) {
      setEditDistrict(dropdowns.zones[zName][0] || "All");
    }
  };

  const handleCreateSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleUserError(null);

    // Verify all fields are compulsory
    if (
      !eCode.trim() || !userName.trim() || !password.trim() || !role || !designation ||
      !grade || !zone || !district || !mobileNumber.trim() || !mailId.trim() || !userType ||
      !dateOfJoining || !dateOfBirth || !eUpkaranId.trim() || !baseReportingLocation.trim()
    ) {
      setSingleUserError("All input details corresponding to user profile columns are compulsory.");
      return;
    }

    setSingleUserLoading(true);
    const payload: UserCreatePayload = {
      e_code: eCode.trim(),
      name: userName.trim(),
      password: password,
      role: role,
      designation: designation,
      grade: grade,
      district: district,
      zone: zone,
      manager: manager,
      zonal_manager: zonalManager,
      coordinator: coordinator,
      mobile_number: mobileNumber.trim(),
      mail_id: mailId.trim(),
      type: userType,
      date_of_joining: dateOfJoining,
      date_of_birth: dateOfBirth,
      e_upkaran_id: eUpkaranId.trim(),
      base_reporting_location: baseReportingLocation.trim(),
      allowed_windows: allowedWindows.join(",")
    };

    try {
      await adminService.createUser(payload);
      toast.success(`User '${userName}' created successfully!`);
      setShowSingleUserModal(false);
      
      // Reset form
      setECode("");
      setUserName("");
      setPassword("");
      setManager("");
      setZonalManager("");
      setCoordinator("");
      setMobileNumber("");
      setMailId("");
      setEUpkaranId("");
      setBaseReportingLocation("");
      setDateOfJoining("");
      setDateOfBirth("");
      setAllowedWindows(["home", "expense", "help", "profile"]);
      
      await fetchInitialData();
    } catch (err: any) {
      setSingleUserError(getErrorMessage(err, "Failed to create user. Verify code is unique."));
    } finally {
      setSingleUserLoading(false);
    }
  };

  const handleForceLogoutAll = async () => {
    try {
      await adminService.logoutAllUsers();
      toast.success("All active user sessions have been invalidated successfully.");
    } catch (err: any) {
      toast.error("Failed to force logout all users.");
    }
  };

  const handleForceLogoutSingle = async (userCode: string, name: string) => {
    try {
      await adminService.logoutSingleUser(userCode);
      toast.success(`User '${name}' session has been invalidated.`);
    } catch (err: any) {
      toast.error(`Failed to force logout user '${name}'.`);
    }
  };

  const handleOpenEditUserModal = (u: any) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditRole(u.role || "Engineer");
    setEditDesignation(u.designation || "");
    setEditGrade(u.grade || "");
    setEditZone(u.zone || "");
    setEditDistrict(u.district || "");
    setEditManager(u.manager || "");
    setEditZonalManager(u.zonal_manager || "");
    setEditCoordinator(u.coordinator || "");
    setEditMobileNumber(u.mobile_number || "");
    setEditMailId(u.mail_id || "");
    setEditUserStatus(u.user_status || "active");
    setEditUserType(u.type || "Employee");
    setEditDateOfJoining(normalizeDateToYYYYMMDD(u.date_of_joining));
    setEditDateOfBirth(normalizeDateToYYYYMMDD(u.date_of_birth));
    setEditEUpkaranId(u.e_upkaran_id || "");
    setEditBaseReportingLocation(u.base_reporting_location || "");
    setEditAllowedWindows(
      u.allowed_windows ? u.allowed_windows.split(",") : []
    );
    const isUserBulkApproved = Number(u.can_bulk_approve) === 1 || ["coordinator", "project head"].includes((u.role || "").toLowerCase().trim());
    setEditCanBulkApprove(isUserBulkApproved);
    setEditUserId(u.user_id || "");
    setEditECode(u.e_code || "");
    setEditUserPassword("");
    setEditAdminPassword("");
    setShowUnlockModal(false);
    setUnlockPassword("");
    setIsSensitiveSectionUnlocked(false);
    
    setEditUserError(null);
    setShowEditUserModal(true);
  };

  const handleUnlockSensitiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPassword.trim().length > 0) {
      setIsSensitiveSectionUnlocked(true);
      setEditAdminPassword(unlockPassword.trim());
      setShowUnlockModal(false);
      setUnlockPassword("");
      toast.success("Credential update section unlocked!");
    } else {
      toast.error("Please enter the Admin Security Password.");
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError(null);
    
    // Verify compulsory edits
    if (
      !editName.trim() || !editRole || !editDesignation || !editGrade || 
      !editZone || !editDistrict || !editMobileNumber.trim() || !editMailId.trim() || 
      !editUserType || !editDateOfJoining || !editDateOfBirth || !editEUpkaranId.trim() ||
      !editBaseReportingLocation.trim() || !editUserId.trim() || !editECode.trim()
    ) {
      setEditUserError("All input details corresponding to user profile columns are compulsory.");
      return;
    }

    const isUserIdModified = editUserId.trim() !== editingUser.user_id;
    const isECodeModified = editECode.trim() !== (editingUser.e_code || "");
    const isPasswordModified = editUserPassword.trim() !== "";

    if (isUserIdModified || isECodeModified || isPasswordModified) {
      if (!editAdminPassword.trim()) {
        setEditUserError("Changing User ID, Employee Code, or Password requires the Admin Security Password.");
        return;
      }
    }

    setEditUserLoading(true);
    const payload: UserEditPayload = {
      name: editName.trim(),
      role: editRole,
      designation: editDesignation,
      grade: editGrade,
      district: editDistrict,
      zone: editZone,
      manager: editManager,
      zonal_manager: editZonalManager,
      coordinator: editCoordinator,
      mobile_number: editMobileNumber.trim(),
      mail_id: editMailId.trim(),
      user_status: editUserStatus,
      type: editUserType,
      date_of_joining: editDateOfJoining,
      date_of_birth: editDateOfBirth,
      e_upkaran_id: editEUpkaranId.trim(),
      base_reporting_location: editBaseReportingLocation.trim(),
      allowed_windows: editAllowedWindows.join(","),
      can_bulk_approve: editCanBulkApprove ? 1 : 0,
      new_user_id: isUserIdModified ? editUserId.trim() : undefined,
      new_e_code: isECodeModified ? editECode.trim() : undefined,
      password: isPasswordModified ? editUserPassword.trim() : undefined,
      admin_update_password: (isUserIdModified || isECodeModified || isPasswordModified) ? editAdminPassword.trim() : undefined
    };

    try {
      await adminService.updateUser(editingUser.user_id, payload);
      toast.success("User updated successfully!");
      setShowEditUserModal(false);
      setEditingUser(null);
      await fetchInitialData();
    } catch (err: any) {
      setEditUserError(getErrorMessage(err, "Failed to update user details."));
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleBatchToggleBulkApproval = async (grant: boolean) => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one employee from the table.");
      return;
    }
    const actionLabel = grant ? "Granting" : "Revoking";
    const tid = toast.loading(`${actionLabel} Bulk Approval access for ${selectedUserIds.length} employee(s)...`);
    try {
      const userTargets = selectedUserIds.map(id => String(id));
      await adminService.toggleBulkApproval(userTargets, grant ? 1 : 0);
      toast.success(`Successfully ${grant ? "GRANTED" : "REVOKED"} Bulk Approval access for ${selectedUserIds.length} employee(s)!`);
      setSelectedUserIds([]);
      await fetchInitialData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update bulk approval permissions");
    } finally {
      toast.dismiss(tid);
    }
  };

  const handleSingleToggleBulkApproval = async (record: any, grant: boolean) => {
    const targetCode = record.user_id || record.e_code || String(record.id);
    const tid = toast.loading(`Updating Bulk Approval access for ${record.name}...`);
    try {
      await adminService.toggleBulkApproval([targetCode], grant ? 1 : 0);
      toast.success(`Bulk Approval access ${grant ? "GRANTED to" : "REVOKED from"} ${record.name}`);
      await fetchInitialData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to toggle bulk approval permission");
    } finally {
      toast.dismiss(tid);
    }
  };
  void handleSingleToggleBulkApproval;

  const downloadSampleCSV = () => {
    const headers = "e_code,name,password,role,designation,grade,district,zone,manager,zonal_manager,coordinator,mobile_number,mail_id,type,date_of_joining,date_of_birth,e_upkaran_id\n";
    const sampleRow = "E12345,Sunil Kumar,password123,Engineer,Developer,A,Bhopal,Madhya Pradesh,Manager Name,Zonal Manager Name,Coordinator Name,9876543210,sunil@example.com,Employee,2026-06-26,2000-01-01,UP123456\n";
    const csvContent = headers + sampleRow;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "employee_upload_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const handleBulkUploadSubmit = async () => {
    if (!csvText.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);

    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) {
      setBulkResult({ error: "Empty CSV file provided." });
      setBulkLoading(false);
      return;
    }

    const HEADER_NORMALIZATION_MAP: { [key: string]: string } = {
      "e_code": "e_code",
      "employee code": "e_code",
      "employee_code": "e_code",
      "ecode": "e_code",
      "code": "e_code",
      "name": "name",
      "employee name": "name",
      "user name": "name",
      "username": "name",
      "password": "password",
      "pass": "password",
      "role": "role",
      "user role": "role",
      "designation": "designation",
      "desig": "designation",
      "grade": "grade",
      "district": "district",
      "dist": "district",
      "zone": "zone",
      "region": "zone",
      "manager": "manager",
      "reporting manager": "manager",
      "manager name": "manager",
      "zonal_manager": "zonal_manager",
      "zonal manager": "zonal_manager",
      "zonal_manager_name": "zonal_manager",
      "coordinator": "coordinator",
      "zonal coordinator": "coordinator",
      "mobile_number": "mobile_number",
      "mobile number": "mobile_number",
      "mobile": "mobile_number",
      "phone": "mobile_number",
      "contact": "mobile_number",
      "mail_id": "mail_id",
      "mail id": "mail_id",
      "email": "mail_id",
      "email id": "mail_id",
      "email_id": "mail_id",
      "type": "type",
      "employee type": "type",
      "user type": "type",
      "date_of_joining": "date_of_joining",
      "date of joining": "date_of_joining",
      "joining date": "date_of_joining",
      "doj": "date_of_joining",
      "date_of_birth": "date_of_birth",
      "date of birth": "date_of_birth",
      "dob": "date_of_birth",
      "birth date": "date_of_birth",
      "e_upkaran_id": "e_upkaran_id",
      "e-upkaran id": "e_upkaran_id",
      "e upkaran id": "e_upkaran_id",
      "upkaran id": "e_upkaran_id",
      "upkaran_id": "e_upkaran_id",
      "e_upkaran": "e_upkaran_id"
    };

    const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => {
      const clean = h.trim().replace(/^["']|["']$/g, "").toLowerCase();
      return HEADER_NORMALIZATION_MAP[clean] || clean;
    });
    const payload: UserCreatePayload[] = [];
    const missingFieldsErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^["']|["']$/g, ""));
      const record: any = {};
      headers.forEach((header, index) => {
        if (header) {
          record[header] = values[index] || "";
        }
      });

      const compulsoryKeys = [
        "e_code", "name", "password", "role", "designation", "grade", "district",
        "zone", "manager", "zonal_manager", "coordinator", "mobile_number", 
        "mail_id", "type", "date_of_joining", "date_of_birth", "e_upkaran_id"
      ];

      const userExists = safeUsers.some(u => 
        (u.e_code && u.e_code.trim().toLowerCase() === record.e_code?.trim().toLowerCase()) || 
        (u.user_id && u.user_id.trim().toLowerCase() === record.e_code?.trim().toLowerCase())
      );

      let isRowValid = true;
      if (!userExists) {
        // Enforce compulsory keys for new users
        for (const key of compulsoryKeys) {
          if (!record[key] || record[key].trim() === "") {
            missingFieldsErrors.push(`Row ${i + 1} (${record.e_code || "New"}): Missing mandatory column '${key}'`);
            isRowValid = false;
            break;
          }
        }
      } else {
        // For existing users, only e_code is mandatory
        if (!record.e_code || record.e_code.trim() === "") {
          missingFieldsErrors.push(`Row ${i + 1}: Missing Employee Code`);
          isRowValid = false;
        }
      }

      if (isRowValid) {
        payload.push({
          e_code: record.e_code,
          name: record.name,
          password: record.password,
          role: record.role,
          designation: record.designation,
          grade: record.grade,
          district: record.district,
          zone: record.zone,
          manager: record.manager,
          zonal_manager: record.zonal_manager,
          coordinator: record.coordinator,
          mobile_number: record.mobile_number,
          mail_id: record.mail_id,
          type: record.type,
          date_of_joining: record.date_of_joining,
          date_of_birth: record.date_of_birth,
          e_upkaran_id: record.e_upkaran_id,
          allowed_windows: record.allowed_windows || ""
        });
      }
    }

    if (payload.length === 0) {
      setBulkResult({
        error: "Validation Failed. No valid rows were found to import.",
        rowErrors: missingFieldsErrors
      });
      setBulkLoading(false);
      return;
    }

    try {
      const res = await adminService.bulkCreateUsers(payload);
      const combinedErrors = [...missingFieldsErrors, ...(res.errors || [])];
      setBulkResult({
        ...res,
        errors: combinedErrors,
        failed_count: combinedErrors.length
      });
      if (res.created_count > 0) {
        toast.success(`Successfully uploaded/updated ${res.created_count} users!`);
      }
      if (combinedErrors.length > 0) {
        toast.error(`${combinedErrors.length} records were skipped due to errors.`);
      }
      await fetchInitialData();
    } catch (err: any) {
      setBulkResult({ 
        error: getErrorMessage(err, "Bulk import failed. Please check CSV formatting."),
        rowErrors: missingFieldsErrors
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportHierarchies = async () => {
    try {
      const blob = await adminService.exportHierarchies();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "team_hierarchies.csv");
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success("Team hierarchies exported successfully!");
    } catch (err: any) {
      toast.error("Failed to export hierarchies: " + getErrorMessage(err, "Network error"));
    }
  };

  const handleBulkHierarchySubmit = async () => {
    if (!hierarchyCsvText.trim()) {
      toast.error("CSV text cannot be empty");
      return;
    }
    setBulkHierarchyLoading(true);
    setBulkHierarchyResult(null);

    try {
      const lines = hierarchyCsvText.split("\n");
      if (lines.length <= 1) {
        toast.error("CSV must contain at least a header row and one data row");
        setBulkHierarchyLoading(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows: any[] = [];
      const validationErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map(p => p.trim());
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = parts[index] || "";
        });

        if (!record.hierarchy_name) {
          validationErrors.push(`Row ${i + 1}: Missing 'hierarchy_name'`);
          continue;
        }

        rows.push({
          hierarchy_name: record.hierarchy_name,
          requester_e_codes: record.requester_e_codes || "",
          level_1_approver: record.level_1_approver || "",
          level_2_approver: record.level_2_approver || "",
          level_3_approver: record.level_3_approver || "",
          level_4_approver: record.level_4_approver || "",
          level_5_approver: record.level_5_approver || ""
        });
      }

      if (validationErrors.length > 0) {
        setBulkHierarchyResult({
          error: "Validation failed.",
          rowErrors: validationErrors
        });
        setBulkHierarchyLoading(false);
        return;
      }

      const response = await adminService.bulkImportHierarchies(rows);
      toast.success(response.message || "Team hierarchies imported successfully!");
      setHierarchyCsvText("");
      setShowBulkHierarchyModal(false);
      
      const freshHierarchies = await adminService.getHierarchies();
      setHierarchies(freshHierarchies);
    } catch (err: any) {
      const errMsg = getErrorMessage(err, "Failed to import hierarchies");
      setBulkHierarchyResult({
        error: errMsg
      });
    } finally {
      setBulkHierarchyLoading(false);
    }
  };

  const handleToggleWindow = (id: string, isEdit: boolean = false) => {
    if (isEdit) {
      if (editAllowedWindows.includes(id)) {
        setEditAllowedWindows(editAllowedWindows.filter(w => w !== id));
      } else {
        setEditAllowedWindows([...editAllowedWindows, id]);
      }
    } else {
      if (allowedWindows.includes(id)) {
        setAllowedWindows(allowedWindows.filter(w => w !== id));
      } else {
        setAllowedWindows([...allowedWindows, id]);
      }
    }
  };

  // --- Hierarchy Mapping Configuration Dialog ---
  const handleOpenHierarchyModal = (hq?: any) => {
    setHierarchyError(null);
    if (hq) {
      setEditingHierarchy(hq);
      setHierarchyName(hq.name);
      setSelectedRequesterIds(hq.requesters.map((r: any) => r.user_id));
      
      const rows = hq.approvers.map((a: any) => ({
        checked: false,
        level: a.level_number,
        approverId: String(a.approver_id)
      }));
      setApproverRows(rows);
    } else {
      setEditingHierarchy(null);
      setHierarchyName("");
      setSelectedRequesterIds([]);
      setApproverRows([{ checked: false, level: 1, approverId: "" }]);
    }
    setShowHierarchyModal(true);
  };

  const handleAddApproverRow = () => {
    const nextLvl = approverRows.length > 0 ? Math.max(...approverRows.map(r => r.level)) + 1 : 1;
    setApproverRows([...approverRows, { checked: false, level: nextLvl, approverId: "" }]);
  };

  const handleDeleteCheckedRows = () => {
    const remaining = approverRows.filter(r => !r.checked);
    const adjusted = remaining.map((r, i) => ({
      ...r,
      level: i + 1
    }));
    setApproverRows(adjusted);
  };

  const handleRowCheckboxToggle = (idx: number) => {
    const updated = [...approverRows];
    updated[idx].checked = !updated[idx].checked;
    setApproverRows(updated);
  };

  const handleRowLevelChange = (idx: number, val: string) => {
    const num = parseInt(val) || 0;
    const updated = [...approverRows];
    updated[idx].level = num;
    setApproverRows(updated);
  };

  const handleRowApproverChange = (idx: number, val: string) => {
    const updated = [...approverRows];
    updated[idx].approverId = val;
    setApproverRows(updated);
  };

  const handleAddRequesterChip = (val: string) => {
    const id = parseInt(val);
    if (!id || selectedRequesterIds.includes(id)) return;
    setSelectedRequesterIds([...selectedRequesterIds, id]);
  };

  const handleRemoveRequesterChip = (id: number) => {
    setSelectedRequesterIds(selectedRequesterIds.filter(rid => rid !== id));
  };

  const handleSaveHierarchySubmit = async () => {
    setHierarchyError(null);
    const nameClean = hierarchyName.trim();
    if (!nameClean) {
      setHierarchyError("Hierarchy team name is required.");
      return;
    }

    const formattedApprovers: any[] = [];
    for (const row of approverRows) {
      const appVal = parseInt(row.approverId);
      if (!appVal) {
        setHierarchyError(`Approver is not assigned for Level ${row.level}.`);
        return;
      }
      if (selectedRequesterIds.includes(appVal)) {
        const u = safeUsers.find(userObj => userObj.id === appVal);
        setHierarchyError(`Self-approval error: ${u ? u.name : 'User'} is mapped as a requester and cannot approve their own requests.`);
        return;
      }
      formattedApprovers.push({
        level_number: row.level,
        approver_id: appVal
      });
    }

    // Check for duplicate consecutive level approvers
    for (let i = 0; i < formattedApprovers.length - 1; i++) {
      if (formattedApprovers[i].approver_id === formattedApprovers[i + 1].approver_id) {
        setHierarchyError(`Duplicate level error: The same user cannot be mapped as approver for both Level ${formattedApprovers[i].level_number} and Level ${formattedApprovers[i + 1].level_number}.`);
        return;
      }
    }

    setHierarchyLoading(true);
    const payload: any = {
      name: nameClean,
      requester_ids: selectedRequesterIds,
      approvers: formattedApprovers
    };

    if (editingHierarchy) {
      payload.id = editingHierarchy.id;
    }

    try {
      await adminService.saveHierarchy(payload);
      toast.success("Hierarchy mappings saved successfully!");
      setShowHierarchyModal(false);
      setEditingHierarchy(null);
      await fetchInitialData();
    } catch (err: any) {
      setHierarchyError(getErrorMessage(err, "Failed to save hierarchy team mappings."));
    } finally {
      setHierarchyLoading(false);
    }
  };

  const handleDeleteHierarchy = async (hqId: number) => {
    try {
      await adminService.deleteHierarchy(hqId);
      toast.success("Hierarchy deleted successfully.");
      await fetchInitialData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed to delete hierarchy."));
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeHierarchies = Array.isArray(hierarchies) ? hierarchies : [];

  const getEligibleRequesters = () => {
    return safeUsers.filter(u => {
      const isAlreadyRequester = safeHierarchies.some(h => {
        if (editingHierarchy && h.id === editingHierarchy.id) return false;
        return h.requesters.some(r => r.user_id === u.id);
      });
      return !isAlreadyRequester;
    });
  };

  const getUsersByRole = (allowedRoles: string[]) => {
    const rolesLower = allowedRoles.map(r => r.toLowerCase());
    return safeUsers.filter(u => {
      const r = (u.role || "").trim().toLowerCase();
      const d = (u.designation || "").trim().toLowerCase();
      return rolesLower.includes(r) || rolesLower.some(ar => d.includes(ar));
    });
  };

  const normalizeZoneName = (zone?: string) => {
    if (!zone) return "";
    let clean = zone.trim().replace(/^zone\s+/i, "").trim();
    if (!clean) return "";
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const availableUserZones = useMemo(() => {
    const zones = new Set<string>();
    safeUsers.forEach(u => {
      const z = normalizeZoneName(u.zone);
      if (z && z.toLowerCase() !== "all") {
        zones.add(z);
      }
    });
    return Array.from(zones).sort();
  }, [safeUsers]);

  const availableUserDistricts = useMemo(() => {
    const districts = new Set<string>();
    safeUsers.forEach(u => {
      if (userZoneFilter !== "all" && normalizeZoneName(u.zone).toLowerCase() !== normalizeZoneName(userZoneFilter).toLowerCase()) {
        return;
      }
      if (u.district && u.district.trim() && u.district.trim().toLowerCase() !== "all") {
        districts.add(u.district.trim());
      }
    });
    return Array.from(districts).sort();
  }, [safeUsers, userZoneFilter]);

  const availableUserManagers = useMemo(() => {
    const managers = new Set<string>();
    safeUsers.forEach(u => {
      if (u.manager && u.manager.trim()) managers.add(u.manager.trim());
      if (u.zonal_manager && u.zonal_manager.trim()) managers.add(u.zonal_manager.trim());
    });
    return Array.from(managers).sort();
  }, [safeUsers]);

  const availableUserRoles = useMemo(() => {
    const roles = new Set<string>();
    safeUsers.forEach(u => {
      if (u.role && u.role.trim()) {
        roles.add(u.role.trim());
      }
    });
    return Array.from(roles).sort();
  }, [safeUsers]);

  const availableUserStatuses = useMemo(() => {
    const statuses = new Set<string>();
    safeUsers.forEach(u => {
      const st = u.user_status ? u.user_status.trim().toLowerCase() : "active";
      if (st) statuses.add(st);
    });
    return Array.from(statuses).sort();
  }, [safeUsers]);

  // Dedicated dynamic deduplicated zones for Facilities Master
  const availableFacilityZones = useMemo(() => {
    const zones = new Set<string>();
    standardFacilities.forEach(f => {
      const z = normalizeZoneName(f.zone_name);
      if (z && z.toLowerCase() !== "all") {
        zones.add(z);
      }
    });
    return Array.from(zones).sort();
  }, [standardFacilities]);

  const availableFacilityDistricts = useMemo(() => {
    const districts = new Set<string>();
    const list = facilitySubTab === "expense" ? standardFacilities : noTaDaHospitals;
    list.forEach(f => {
      if (f.district_name && f.district_name.trim() && f.district_name.trim().toLowerCase() !== "all") {
        districts.add(f.district_name.trim());
      }
    });
    return Array.from(districts).sort();
  }, [standardFacilities, noTaDaHospitals, facilitySubTab]);

  // State for Hierarchy Search
  const [hierarchySearch, setHierarchySearch] = useState("");
  const [hierarchyUnmappedOnly, setHierarchyUnmappedOnly] = useState(false);

  const filteredHierarchies = useMemo(() => {
    return safeHierarchies.filter(hq => {
      if (hierarchyUnmappedOnly && hq.requesters.length > 0) return false;
      if (!hierarchySearch.trim()) return true;
      const q = hierarchySearch.toLowerCase().trim();
      const hqMatch = (hq.name || "").toLowerCase().includes(q);
      const reqMatch = hq.requesters.some((r: any) => 
        (r.user_name || "").toLowerCase().includes(q) || (r.user_code || "").toLowerCase().includes(q)
      );
      const appMatch = hq.approvers.some((a: any) => 
        (a.approver_name || "").toLowerCase().includes(q) || (a.approver_code || "").toLowerCase().includes(q)
      );
      return hqMatch || reqMatch || appMatch;
    });
  }, [safeHierarchies, hierarchySearch, hierarchyUnmappedOnly]);

  const filteredUsers = useMemo(() => {
    return safeUsers.filter(u => {
      if (userZoneFilter !== "all" && normalizeZoneName(u.zone).toLowerCase() !== normalizeZoneName(userZoneFilter).toLowerCase()) return false;
      if (userDistrictFilter !== "all" && (u.district || "").trim().toLowerCase() !== userDistrictFilter.trim().toLowerCase()) return false;
      if (userManagerFilter !== "all" && (u.manager || "").trim().toLowerCase() !== userManagerFilter.trim().toLowerCase() && (u.zonal_manager || "").trim().toLowerCase() !== userManagerFilter.trim().toLowerCase()) return false;
      if (userRoleFilter !== "all" && (u.role || "").trim().toLowerCase() !== userRoleFilter.trim().toLowerCase()) return false;
      if (userStatusFilter !== "all" && (u.user_status || "active").trim().toLowerCase() !== userStatusFilter.trim().toLowerCase()) return false;
      if (userSearchTerm.trim()) {
        const q = userSearchTerm.trim().toLowerCase();
        const nameMatch = (u.name || "").toLowerCase().includes(q);
        const codeMatch = (u.user_id || u.e_code || "").toLowerCase().includes(q);
        const mobileMatch = (u.mobile_number || "").toLowerCase().includes(q);
        const emailMatch = (u.mail_id || u.email || "").toLowerCase().includes(q);
        const desgMatch = (u.designation || "").toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !mobileMatch && !emailMatch && !desgMatch) return false;
      }
      return true;
    });
  }, [safeUsers, userZoneFilter, userDistrictFilter, userManagerFilter, userRoleFilter, userStatusFilter, userSearchTerm]);

  const handleExportUsersExcel = () => {
    if (filteredUsers.length === 0) {
      toast.error("No employees to export.");
      return;
    }
    const exportData = filteredUsers.map(u => ({
      "Employee Code": u.e_code || u.user_id || "—",
      "Name": u.name || "—",
      "Designation": u.designation || "Engineer",
      "Grade": u.grade || "—",
      "Zone": u.zone || "—",
      "District": u.district || "—",
      "Manager": u.manager || "—",
      "Zonal Manager": u.zonal_manager || "—",
      "Coordinator": u.coordinator || "—",
      "Mobile": u.mobile_number || "—",
      "Role": u.role || "Engineer",
      "Status": (u.user_status || "active").toUpperCase(),
      "Created Date": formatToIST(u.created_at)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    const dateTag = new Date().toISOString().split("T")[0];
    const filterTag = userZoneFilter !== "all" ? userZoneFilter : "all";
    XLSX.writeFile(workbook, `users_export_${filterTag}_${dateTag}.xlsx`);
    toast.success(`Exported ${filteredUsers.length} employees to Excel!`);
  };

  const fetchAllowanceRates = async () => {
    setLoadingRates(true);
    try {
      const data = await adminService.getAllowanceRates();
      setAllowanceRates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching allowance rates:", e);
    } finally {
      setLoadingRates(false);
    }
  };

  const handleSaveAllowanceRates = async () => {
    setSavingRates(true);
    try {
      await adminService.saveAllowanceRates(allowanceRates);
      toast.success("Allowance rates updated successfully!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to update allowance rates");
    } finally {
      setSavingRates(false);
    }
  };

  const getFilteredUsersForCharts = () => {
    return safeUsers.filter(u => {
      if (chartRoleFilter !== "all" && u.role?.toLowerCase() !== chartRoleFilter.toLowerCase()) return false;
      if (chartZoneFilter !== "all" && u.zone?.toLowerCase() !== chartZoneFilter.toLowerCase()) return false;
      if (chartDistrictFilter !== "all" && u.district?.toLowerCase() !== chartDistrictFilter.toLowerCase()) return false;
      return true;
    });
  };

  const chartZoneDistricts = Array.from(
    new Set(safeUsers
      .filter(u => chartZoneFilter === "all" || u.zone?.trim().toLowerCase() === chartZoneFilter.toLowerCase())
      .map(u => u.district?.trim()).filter(Boolean))
  ).sort((a, b) => a!.localeCompare(b!));

  const groupTopItems = (list: { name: string; value: number }[], topN: number = 6) => {
    if (list.length <= topN) return list;
    const top = list.slice(0, topN);
    const rest = list.slice(topN);
    const othersVal = rest.reduce((sum, item) => sum + item.value, 0);
    if (othersVal > 0) {
      top.push({ name: "Others", value: othersVal });
    }
    return top;
  };

  const getDistrictData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const dist = u.district?.trim() || "N/A";
      counts[dist] = (counts[dist] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return groupTopItems(sorted, 6);
  };

  const getDesignationData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const desg = u.designation?.trim() || "N/A";
      counts[desg] = (counts[desg] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return groupTopItems(sorted, 6);
  };

  const getZoneData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const zone = u.zone?.trim() || "N/A";
      counts[zone] = (counts[zone] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return groupTopItems(sorted, 6);
  };

  const getManagerData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const mng = u.manager?.trim() || "N/A";
      counts[mng] = (counts[mng] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return groupTopItems(sorted, 6);
  };

  const mList = getEligibleManagers();
  const zmList = getEligibleZonalManagers();
  const cList = getEligibleCoordinators();

  const currentTabConfig = NAV_ITEMS.find(n => n.id === activeTab) || NAV_ITEMS[0];

  const getNavCount = (tabId: AdminTab) => {
    if (tabId === "users") return users.length;
    if (tabId === "approvals") return hierarchies.length;
    if (tabId === "facilities") return standardFacilities.length + noTaDaHospitals.length;
    if (tabId === "audit") return auditLogs.length || undefined;
    return undefined;
  };

  return (
    <>
      <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900 pb-16">
        {/* Subtle Ambient Background Mesh */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div
            className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, #4338CA 0%, rgba(67, 56, 202, 0) 70%)",
              filter: "blur(100px)",
            }}
          />
          <div
            className="absolute -bottom-[10%] -right-[10%] w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, #6366F1 0%, rgba(99, 102, 241, 0) 70%)",
              filter: "blur(110px)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1680px] mx-auto px-3 sm:px-5 pt-3 space-y-3 text-ink-900 font-sans antialiased">
          
          {/* ── 1. Slim Unified Top Header (Compact & Clean) ──────────────── */}
          <header className="bg-surface border border-line rounded-2xl px-4 py-2.5 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#4338CA] text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                AD
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-ink-900 tracking-tight m-0 font-display">
                  Admin Console
                </h1>
                <span className="text-ink-400">/</span>
                <span className="text-xs font-bold text-accent-700 bg-accent-50 px-2.5 py-0.5 rounded-full border border-accent-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent-600" />
                  {currentTabConfig.label}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncData}
                disabled={isSyncing}
                className="btn-lte-outline text-xs h-8 px-3 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-white shadow-2xs"
                title="Refresh All Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-accent-600 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{isSyncing ? "Refreshing..." : "Refresh"}</span>
              </button>

              {activeTab === "users" && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkUploadModal(true)}
                    className="btn-lte-outline text-xs h-8 px-3 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-white shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-accent-600" />
                    <span className="hidden sm:inline">Bulk CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSingleUserModal(true)}
                    className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white text-xs h-8 px-3.5 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl shadow-xs hover:shadow-md transition-all border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add User</span>
                  </button>
                </>
              )}

              {activeTab === "approvals" && (
                <>
                  <button
                    type="button"
                    onClick={handleExportHierarchies}
                    className="btn-lte-outline text-xs h-8 px-3 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-white shadow-2xs"
                    title="Export Hierarchy CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-ink-600" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkHierarchyModal(true)}
                    className="btn-lte-outline text-xs h-8 px-3 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-white shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-accent-600" />
                    <span className="hidden sm:inline">Bulk Import</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenHierarchyModal()}
                    className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white text-xs h-8 px-3.5 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl shadow-xs hover:shadow-md transition-all border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Create Team</span>
                  </button>
                </>
              )}

              {activeTab === "facilities" && (
                <>
                  <button
                    type="button"
                    onClick={handleExportFacilitiesExcel}
                    className="btn-lte-outline text-xs h-8 px-3 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-white shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Export Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFacilityTargetTable(facilitySubTab === "expense" ? "standard" : "no_ta_da");
                      setNewFacilityName("");
                      setNewFacilityDistrict("");
                      setNewFacilityIncharge("");
                      setNewFacilityDmName("");
                      setNewFacilityCoordinatorName("");
                      setIsAddFacilityModalOpen(true);
                    }}
                    className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white text-xs h-8 px-3.5 flex items-center gap-1.5 font-bold cursor-pointer rounded-xl shadow-xs hover:shadow-md transition-all border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Location</span>
                  </button>
                </>
              )}
            </div>
          </header>

          {/* ================= MOBILE NAVIGATION PILLS (<768px) ================= */}
          <nav className="block md:hidden bg-surface border border-line rounded-2xl p-1.5 overflow-x-auto no-scrollbar shadow-xs">
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const count = getNavCount(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white border-transparent shadow-xs"
                        : "bg-surface text-ink-700 border-line hover:bg-surface-sunken"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-surface-sunken text-ink-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ================= MAIN TWO-COLUMN WORKSPACE ================= */}
          <div className="flex flex-col md:flex-row gap-3.5 items-start">
            {/* Tablet 52px Collapsed Icon Rail (768px–1024px) */}
            <aside className="hidden md:block lg:hidden w-13 shrink-0 bg-surface border border-line rounded-2xl py-2.5 shadow-xs sticky top-3">
              <div className="flex flex-col items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleTabChange(item.id)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border-0 ${
                          isActive
                            ? "bg-accent-50 text-accent-700 font-bold"
                            : "bg-transparent text-ink-500 hover:bg-surface-sunken hover:text-ink-900"
                        }`}
                        title={item.label}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                      <div className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-ink-900 text-white text-xs font-semibold rounded-lg shadow-md whitespace-nowrap hidden group-hover:block z-50 pointer-events-none">
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Desktop 230px Zoho Left Sidebar (≥1024px) */}
            <aside className="hidden lg:block w-56 shrink-0 bg-surface border border-line rounded-2xl p-2 shadow-xs sticky top-3">
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const count = getNavCount(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full h-9 px-3 flex items-center justify-between text-xs rounded-xl transition-all cursor-pointer border-0 ${
                        isActive
                          ? "bg-[#EEF0FF] text-[#4338CA] font-bold shadow-2xs"
                          : "bg-transparent text-ink-700 hover:bg-surface-sunken hover:text-ink-900 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#4338CA]" : "text-ink-500"}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {count !== undefined && (
                        <span className={`px-2 py-0.5 text-2xs font-mono font-bold rounded-full ${
                          isActive
                            ? "bg-accent-100 text-accent-700 border border-accent-300/40"
                            : "bg-surface-sunken text-ink-500"
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content Workspace */}
            <main className="flex-1 min-w-0">
              {error && (
                <div className="mb-3">
                  <Alert message={error} type="error" showIcon className="rounded-xl font-semibold border-rose-200" />
                </div>
              )}

            {/* ================= SECTION 1: USERS DIRECTORY ================= */}
            {activeTab === "users" && (
              <div className="space-y-3 animate-fadeIn">
                {/* Search & 5-Dropdown Filter Bar */}
                <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs">
                  {/* Clean Horizontal Filter Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search name, emp code, mobile, email..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="input-lte pl-8.5 h-8.5 text-xs w-full rounded-xl bg-white"
                      />
                      {userSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setUserSearchTerm("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5 border-0 bg-transparent cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Zone Filter */}
                    <select
                      value={userZoneFilter}
                      onChange={(e) => {
                        setUserZoneFilter(e.target.value);
                        setUserDistrictFilter("all");
                      }}
                      className="input-lte h-8.5 text-xs font-semibold py-1 px-3 rounded-xl cursor-pointer min-w-[125px] bg-white"
                    >
                      <option value="all">All Zones ({availableUserZones.length})</option>
                      {availableUserZones.map((z: string) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>

                    {/* District Filter */}
                    <select
                      value={userDistrictFilter}
                      onChange={(e) => setUserDistrictFilter(e.target.value)}
                      className="input-lte h-8.5 text-xs font-semibold py-1 px-3 rounded-xl cursor-pointer min-w-[125px] bg-white"
                    >
                      <option value="all">All Districts ({availableUserDistricts.length})</option>
                      {availableUserDistricts.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    {/* Manager Filter */}
                    <select
                      value={userManagerFilter}
                      onChange={(e) => setUserManagerFilter(e.target.value)}
                      className="input-lte h-8.5 text-xs font-semibold py-1 px-3 rounded-xl cursor-pointer min-w-[130px] bg-white"
                    >
                      <option value="all">All Managers ({availableUserManagers.length})</option>
                      {availableUserManagers.map((m: string) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    {/* Role Filter */}
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="input-lte h-8.5 text-xs font-semibold py-1 px-3 rounded-xl cursor-pointer min-w-[115px] bg-white"
                    >
                      <option value="all">All Roles ({availableUserRoles.length})</option>
                      {availableUserRoles.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="input-lte h-8.5 text-xs font-semibold py-1 px-3 rounded-xl cursor-pointer min-w-[110px] bg-white"
                    >
                      <option value="all">All Status</option>
                      {availableUserStatuses.map((st: string) => (
                        <option key={st} value={st}>{st.toUpperCase()}</option>
                      ))}
                    </select>

                    {/* Reset Filters Pill Button */}
                    {(userSearchTerm || userZoneFilter !== "all" || userDistrictFilter !== "all" || userManagerFilter !== "all" || userRoleFilter !== "all" || userStatusFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserSearchTerm("");
                          setUserZoneFilter("all");
                          setUserDistrictFilter("all");
                          setUserManagerFilter("all");
                          setUserRoleFilter("all");
                          setUserStatusFilter("all");
                        }}
                        className="bg-accent-50 hover:bg-accent-100 text-accent-700 border border-accent-200 h-8.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Clear all filters"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Summary Count & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-line">
                    <span className="text-xs font-mono text-ink-500 font-semibold flex items-center gap-1.5">
                      <span>Showing</span>
                      <span className="bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full font-bold border border-accent-200">
                        {filteredUsers.length}
                      </span>
                      <span>of {safeUsers.length} Employees</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportUsersExcel}
                        className="bg-white hover:bg-surface-sunken text-ink-700 hover:text-ink-900 border border-line text-xs font-semibold px-3 h-8 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Export Excel</span>
                      </button>
                      <Popconfirm
                        title="Force Logout All Users?"
                        description="This will instantly invalidate session tokens for all users (except yourself)."
                        onConfirm={handleForceLogoutAll}
                        okText="Yes, Logout All"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true, size: "small" }}
                      >
                        <button
                          type="button"
                          className="bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-semibold px-3 h-8 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Force Logout All</span>
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>

                {/* Batch Bulk Approval Actions Banner */}
                {selectedUserIds.length > 0 && (
                  <div className="bg-pending-bg border border-pending-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <span className="bg-pending text-white font-bold text-2xs px-2 py-0.5 rounded font-mono">
                        {selectedUserIds.length} SELECTED
                      </span>
                      <span className="text-xs font-bold text-pending-text">
                        Batch Bulk Approval Permissions:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleBatchToggleBulkApproval(true)}
                        className="btn-lte-primary text-xs h-7.5 px-3 flex items-center gap-1 bg-[#0F7A4C] hover:bg-[#0B5C39] cursor-pointer"
                      >
                        <span>⚡ Grant Bulk Approval Access</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchToggleBulkApproval(false)}
                        className="btn-lte-secondary text-xs h-7.5 px-3 flex items-center gap-1 cursor-pointer"
                      >
                        <span>🔒 Revoke Bulk Approval Access</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* High-Density Users Data Table */}
                <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-none">
                  {loading ? (
                    <div className="py-16 text-center bg-surface">
                      <Spin size="large" tip="Loading employees database..." />
                    </div>
                  ) : (
                    <Table
                      dataSource={filteredUsers}
                      rowKey={(record) => record.user_id || record.e_code || record.id}
                      rowSelection={{
                        selectedRowKeys: selectedUserIds,
                        onChange: (keys) => setSelectedUserIds(keys)
                      }}
                      pagination={{
                        pageSize: adminUserPageSize,
                        onChange: (_, size) => setAdminUserPageSize(size),
                        onShowSizeChange: (_, size) => setAdminUserPageSize(size),
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "25", "50", "100"],
                        showTotal: (total, range) => `Showing ${range[0]}-${range[1]} of ${total} employees`
                      }}
                      className="ant-table-striped"
                      scroll={{ x: 850 }}
                      columns={[
                        {
                          title: "EMP CODE",
                          dataIndex: "e_code",
                          key: "e_code",
                          width: 120,
                          render: (code: string) => (
                            <span className="font-mono text-xs font-bold text-ink-900 bg-surface-sunken px-2 py-0.5 rounded border border-line tabular-nums inline-block">
                              {code || "—"}
                            </span>
                          )
                        },
                        {
                          title: "FULL NAME",
                          dataIndex: "name",
                          key: "name",
                          render: (name: string, record: any) => (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-700 font-bold text-xs flex items-center justify-center shrink-0 border border-accent-400/20">
                                {getInitials(name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-ink-900 text-xs sm:text-sm leading-tight truncate">{name}</div>
                                <div className="text-2xs text-ink-500 font-medium truncate mt-0.5">
                                  {record.designation || "Engineer"}
                                </div>
                              </div>
                            </div>
                          )
                        },
                        {
                          title: "ROLE",
                          dataIndex: "role",
                          key: "role",
                          width: 130,
                          render: (roleStr: string) => {
                            const r = (roleStr || "").toLowerCase();
                            let badgeClass = "bg-surface-sunken text-ink-700 border-line";
                            if (r.includes("engineer")) badgeClass = "bg-teal-50 text-teal-800 border-teal-200";
                            else if (r.includes("manager") || r.includes("zm")) badgeClass = "bg-accent-50 text-accent-700 border-accent-100";
                            else if (r.includes("admin") || r.includes("mis")) badgeClass = "bg-amber-50 text-amber-800 border-amber-200";
                            else if (r.includes("coordinator")) badgeClass = "bg-purple-50 text-purple-800 border-purple-200";

                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 text-2xs font-semibold rounded-full border ${badgeClass}`}>
                                {roleStr || "—"}
                              </span>
                            );
                          }
                        },
                        {
                          title: "MOBILE / EMAIL",
                          key: "contact",
                          render: (_: any, record: any) => (
                            <div className="space-y-0.5 text-xs">
                              <div className="font-mono text-xs font-bold text-ink-700 tabular-nums">{record.mobile_number || "—"}</div>
                              <div className="font-mono text-2xs text-ink-500 truncate max-w-[170px]">{record.mail_id || "—"}</div>
                            </div>
                          )
                        },
                        {
                          title: "DISTRICT / ZONE",
                          key: "location",
                          render: (_: any, record: any) => (
                            <div className="space-y-0.5">
                              <div className="font-bold text-ink-900 text-xs leading-tight">{record.district || "—"}</div>
                              <span className="inline-block px-1.5 py-0.2 text-2xs font-bold uppercase rounded bg-surface-sunken text-ink-600 border border-line leading-none">
                                {record.zone || "NO ZONE"}
                              </span>
                            </div>
                          )
                        },
                        {
                          title: "STATUS",
                          dataIndex: "user_status",
                          key: "user_status",
                          width: 110,
                          render: (status: string) => {
                            const st = (status || "active").toLowerCase();
                            if (st === "active") {
                              return (
                                <span className="badge-status badge-approved text-2xs inline-flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#0F7A4C]" /> ACTIVE
                                </span>
                              );
                            }
                            if (st === "locked") {
                              return (
                                <span className="badge-status badge-pending text-2xs inline-flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#B7791F]" /> LOCKED
                                </span>
                              );
                            }
                            return (
                              <span className="badge-status badge-rejected text-2xs inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#B3261E]" /> INACTIVE
                              </span>
                            );
                          }
                        },
                        {
                          title: "ACTIONS",
                          key: "actions",
                          align: "right",
                          width: 90,
                          render: (_: any, record: any) => (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUserModal(record)}
                                className="p-1.5 bg-surface hover:bg-surface-sunken text-ink-700 hover:text-accent-600 border border-line rounded-md transition-all cursor-pointer"
                                title="Edit User Profile"
                              >
                                <EditOutlined className="text-xs" />
                              </button>
                              <Popconfirm
                                title="Force logout user?"
                                description={`Log out ${record.name} from active session?`}
                                onConfirm={() => handleForceLogoutSingle(record.user_id, record.name)}
                                okText="Logout"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true, size: "small" }}
                              >
                                <button
                                  type="button"
                                  className="p-1.5 bg-surface hover:bg-rose-50 text-ink-500 hover:text-rose-600 border border-line rounded-md transition-all cursor-pointer"
                                  title="Force Logout Session"
                                >
                                  <LogoutOutlined className="text-xs" />
                                </button>
                              </Popconfirm>
                            </div>
                          )
                        }
                      ]}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ================= SECTION 2: ROLE MAPPINGS (APPROVAL HIERARCHY) ================= */}
            {activeTab === "approvals" && (
              <div className="space-y-3 animate-fadeIn">
                {/* Search & Filter Toolbar */}
                <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search HQ team, employee name, or approver..."
                        value={hierarchySearch}
                        onChange={(e) => setHierarchySearch(e.target.value)}
                        className="input-lte pl-8.5 h-8.5 text-xs w-full rounded-xl bg-white"
                      />
                      {hierarchySearch && (
                        <button
                          type="button"
                          onClick={() => setHierarchySearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5 border-0 bg-transparent cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setHierarchyUnmappedOnly(!hierarchyUnmappedOnly)}
                      className={`h-8.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        hierarchyUnmappedOnly
                          ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                          : "bg-white text-ink-600 border-line hover:bg-surface-sunken"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${hierarchyUnmappedOnly ? "bg-amber-500" : "bg-ink-300"}`} />
                      <span>Unmapped Only</span>
                    </button>

                    {(hierarchySearch || hierarchyUnmappedOnly) && (
                      <button
                        type="button"
                        onClick={() => {
                          setHierarchySearch("");
                          setHierarchyUnmappedOnly(false);
                        }}
                        className="bg-accent-50 hover:bg-accent-100 text-accent-700 border border-accent-200 h-8.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-mono text-ink-500 font-semibold flex items-center gap-1">
                    <span>Showing</span>
                    <strong className="text-accent-700 bg-accent-50 px-2 py-0.5 rounded-full border border-accent-200">
                      {filteredHierarchies.length}
                    </strong>
                    <span>of {safeHierarchies.length} HQ Teams</span>
                  </span>
                </div>

                {filteredHierarchies.length === 0 ? (
                  <div className="bg-surface border border-line rounded-2xl p-8 text-center text-xs text-ink-400 font-bold">
                    No team hierarchy configurations match your search filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredHierarchies.map((hq) => (
                      <div key={hq.id} className="bg-surface border border-line hover:border-accent-300/60 rounded-2xl p-4 space-y-3 transition-all shadow-xs">
                        {/* Card Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-line">
                          <div className="flex items-center gap-2.5">
                            <h4 className="font-bold text-ink-900 text-sm tracking-tight m-0">{hq.name}</h4>
                            <span className="badge-status badge-approved text-2xs font-mono">
                              {hq.approvers.length} Levels Approval Flow
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHierarchyModal(hq)}
                              className="p-1.5 bg-surface hover:bg-surface-sunken text-ink-700 hover:text-accent-600 border border-line rounded-md transition-all cursor-pointer"
                              title="Edit Team Mappings"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <Popconfirm
                              title="Delete Approval Team?"
                              description={`Delete hierarchy configuration for '${hq.name}'?`}
                              onConfirm={() => handleDeleteHierarchy(hq.id)}
                              okText="Delete"
                              cancelText="Cancel"
                              okButtonProps={{ danger: true, size: "small" }}
                            >
                              <button
                                type="button"
                                className="p-1.5 bg-surface hover:bg-rose-50 text-ink-500 hover:text-rose-600 border border-line rounded-md transition-all cursor-pointer"
                                title="Delete Team"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Popconfirm>
                          </div>
                        </div>

                        {/* Requesters Box */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 shrink-0 mr-1">
                            Mapped Requesters ({hq.requesters.length}):
                          </span>
                          {hq.requesters.length === 0 ? (
                            <span className="text-xs text-ink-400 italic">No employees mapped</span>
                          ) : (
                            hq.requesters.map((r) => (
                              <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-sunken text-ink-700 text-xs font-semibold border border-line font-mono">
                                {r.user_name} <span className="text-ink-400 ml-1">({r.user_code})</span>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Approvers Pipeline Flow */}
                        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-line">
                          <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 shrink-0 mr-1">
                            Approval Sequence:
                          </span>
                          {hq.approvers.length === 0 ? (
                            <span className="text-xs text-ink-400 italic">No approvers mapped</span>
                          ) : (
                            hq.approvers.map((a, idx) => (
                              <React.Fragment key={a.id}>
                                {idx > 0 && <span className="text-ink-300 font-bold px-0.5 select-none font-mono">→</span>}
                                <div className="inline-flex items-center gap-1.5 bg-surface-sunken border border-line rounded-md px-2.5 py-1">
                                  <span className="h-4 px-1.5 rounded bg-accent-600 text-white flex items-center justify-center text-2xs font-mono font-bold">
                                    L{a.level_number}
                                  </span>
                                  <div className="text-xs font-bold text-ink-900 leading-none">
                                    {a.approver_name} <span className="text-2xs text-ink-500 font-normal">({a.approver_code})</span>
                                  </div>
                                </div>
                              </React.Fragment>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= SECTION 3: ANALYTICS DASHBOARD ================= */}
            {activeTab === "analytics" && (
              <div className="space-y-4 animate-fadeIn">
                {/* 4 KPI Governance Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-surface border border-line rounded-lg p-3.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 block">Total Employees</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold font-mono text-ink-900 tabular-nums">{users.length}</span>
                      <span className="badge-status badge-approved text-2xs">
                        {users.filter(u => u.user_status === 'active' || !u.user_status).length} Active
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface border border-line rounded-lg p-3.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 block">Role Breakdown</span>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold font-mono text-ink-700">
                      <span className="text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
                        {users.filter(u => u.role?.toLowerCase().includes('engineer')).length} Eng
                      </span>
                      <span>·</span>
                      <span className="text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded border border-accent-200/60">
                        {users.filter(u => u.role?.toLowerCase().includes('manager')).length} Mng
                      </span>
                      <span>·</span>
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                        {users.filter(u => u.role?.toLowerCase().includes('admin')).length} Adm
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface border border-line rounded-lg p-3.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 block">Regional Matrix</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-2xl font-bold font-mono text-ink-900 tabular-nums">{availableUserZones.length}</span>
                      <span className="text-xs text-ink-500 font-medium">Zones ({availableUserDistricts.length} Districts)</span>
                    </div>
                  </div>

                  <div className="bg-surface border border-line rounded-lg p-3.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-500 block">Hierarchy Rules</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold font-mono text-ink-900 tabular-nums">{hierarchies.length}</span>
                      {users.filter(u => !u.manager || u.manager === 'N/A').length > 0 ? (
                        <span className="badge-status badge-pending text-2xs">
                          {users.filter(u => !u.manager || u.manager === 'N/A').length} Pending
                        </span>
                      ) : (
                        <span className="badge-status badge-approved text-2xs">100% Mapped</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="bg-surface border border-line rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none">
                  <div>
                    <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider m-0">Dashboard Charts &amp; Analytics</h4>
                    <p className="text-ink-500 text-2xs mt-0.5 font-medium">Interactive distribution charts with real-time zone &amp; role filtering.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Role Filter */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-2xs font-bold uppercase text-ink-600">Role:</label>
                      <select
                        value={chartRoleFilter}
                        onChange={(e) => setChartRoleFilter(e.target.value)}
                        className="input-lte h-8 text-xs py-0.5 px-2 cursor-pointer"
                      >
                        <option value="all">All Roles</option>
                        <option value="engineer">Engineer</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="coordinator">Coordinator</option>
                      </select>
                    </div>

                    {/* Zone Filter */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-2xs font-bold uppercase text-ink-600">Zone:</label>
                      <select
                        value={chartZoneFilter}
                        onChange={(e) => { setChartZoneFilter(e.target.value); setChartDistrictFilter("all"); }}
                        className="input-lte h-8 text-xs py-0.5 px-2 cursor-pointer"
                      >
                        <option value="all">All Zones</option>
                        {Array.from(new Set(safeUsers.map(u => u.zone?.trim()).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)).map(zone => (
                          <option key={zone} value={zone}>{zone}</option>
                        ))}
                      </select>
                    </div>

                    {/* District Filter (dependent on Zone) */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-2xs font-bold uppercase text-ink-600">District:</label>
                      <select
                        value={chartDistrictFilter}
                        onChange={(e) => setChartDistrictFilter(e.target.value)}
                        disabled={chartZoneFilter === "all"}
                        className={`input-lte h-8 text-xs py-0.5 px-2 ${
                          chartZoneFilter === "all" ? "text-ink-300 cursor-not-allowed opacity-60" : "text-ink-900 cursor-pointer"
                        }`}
                      >
                        <option value="all">{chartZoneFilter === "all" ? "Select Zone first" : "All Districts"}</option>
                        {chartZoneDistricts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4 Donut Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Zone Distribution */}
                  <div className="bg-surface border border-line rounded-lg shadow-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
                        <PieChartOutlined className="text-accent-600" />
                        ZONE DISTRIBUTION
                      </span>
                      <span className="text-2xs font-mono font-bold bg-surface-sunken px-2 py-0.5 rounded border border-line text-ink-700">
                        {getZoneData().reduce((s, x) => s + x.value, 0)} Total
                      </span>
                    </div>
                    <div className="p-4 flex flex-col justify-between" style={{ minHeight: 310 }}>
                      <SaaSDonutChart
                        data={getZoneData().map((z, i) => ({
                          name: z.name,
                          value: z.value,
                          count: z.value,
                          color: LEDGER_CHART_COLORS[i % LEDGER_CHART_COLORS.length]
                        }))}
                        height={280}
                        centerTitle="Total Users"
                        valueFormatter={(v) => `${v.toLocaleString()} Users`}
                      />
                    </div>
                  </div>

                  {/* District Distribution */}
                  <div className="bg-surface border border-line rounded-lg shadow-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
                        <PieChartOutlined className="text-accent-600" />
                        DISTRICT DISTRIBUTION
                      </span>
                      <span className="text-2xs font-mono font-bold bg-surface-sunken px-2 py-0.5 rounded border border-line text-ink-700">
                        {getDistrictData().reduce((s, x) => s + x.value, 0)} Total
                      </span>
                    </div>
                    <div className="p-4 flex flex-col justify-between" style={{ minHeight: 310 }}>
                      <SaaSDonutChart
                        data={getDistrictData().map((d, i) => ({
                          name: d.name,
                          value: d.value,
                          count: d.value,
                          color: LEDGER_CHART_COLORS[i % LEDGER_CHART_COLORS.length]
                        }))}
                        height={280}
                        centerTitle="Total Users"
                        valueFormatter={(v) => `${v.toLocaleString()} Users`}
                      />
                    </div>
                  </div>

                  {/* Manager Distribution */}
                  <div className="bg-surface border border-line rounded-lg shadow-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
                        <PieChartOutlined className="text-accent-600" />
                        MANAGER DISTRIBUTION
                      </span>
                      <span className="text-2xs font-mono font-bold bg-surface-sunken px-2 py-0.5 rounded border border-line text-ink-700">
                        {getManagerData().reduce((s, x) => s + x.value, 0)} Total
                      </span>
                    </div>
                    <div className="p-4 flex flex-col justify-between" style={{ minHeight: 310 }}>
                      <SaaSDonutChart
                        data={getManagerData().map((m, i) => ({
                          name: m.name,
                          value: m.value,
                          count: m.value,
                          color: LEDGER_CHART_COLORS[i % LEDGER_CHART_COLORS.length]
                        }))}
                        height={280}
                        centerTitle="Total Users"
                        valueFormatter={(v) => `${v.toLocaleString()} Users`}
                      />
                    </div>
                  </div>

                  {/* Designation Distribution */}
                  <div className="bg-surface border border-line rounded-lg shadow-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
                        <PieChartOutlined className="text-accent-600" />
                        DESIGNATION DISTRIBUTION
                      </span>
                      <span className="text-2xs font-mono font-bold bg-surface-sunken px-2 py-0.5 rounded border border-line text-ink-700">
                        {getDesignationData().reduce((s, x) => s + x.value, 0)} Total
                      </span>
                    </div>
                    <div className="p-4 flex flex-col justify-between" style={{ minHeight: 310 }}>
                      <SaaSDonutChart
                        data={getDesignationData().map((d, i) => ({
                          name: d.name,
                          value: d.value,
                          count: d.value,
                          color: LEDGER_CHART_COLORS[i % LEDGER_CHART_COLORS.length]
                        }))}
                        height={280}
                        centerTitle="Total Users"
                        valueFormatter={(v) => `${v.toLocaleString()} Users`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 4: SYSTEM SETTINGS & ALLOWANCE MASTER ================= */}
            {activeTab === "settings" && (
              <div className="space-y-4 animate-fadeIn max-w-5xl">
                {/* Settings Sub-Navigation Header (Zoho pattern) */}
                <div className="bg-surface border border-line rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab("home")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        settingsSubTab === "home"
                          ? "bg-accent-600 text-white shadow-xs"
                          : "text-ink-600 hover:bg-slate-100 hover:text-ink-900"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Settings Overview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab("submission")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        settingsSubTab === "submission"
                          ? "bg-accent-600 text-white shadow-xs"
                          : "text-ink-600 hover:bg-slate-100 hover:text-ink-900"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>1. Submission Policy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab("automation")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        settingsSubTab === "automation"
                          ? "bg-accent-600 text-white shadow-xs"
                          : "text-ink-600 hover:bg-slate-100 hover:text-ink-900"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>2. Approval Automation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab("allowances")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        settingsSubTab === "allowances"
                          ? "bg-accent-600 text-white shadow-xs"
                          : "text-ink-600 hover:bg-slate-100 hover:text-ink-900"
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>3. Allowance Rates</span>
                    </button>
                  </div>
                  {settingsSubTab !== "home" && (
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab("home")}
                      className="text-xs text-accent-600 hover:text-accent-800 font-bold flex items-center gap-1 cursor-pointer px-2 py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Overview</span>
                    </button>
                  )}
                </div>

                {/* --- SUB-VIEW 0: SETTINGS HOME GRID (Landing Page) --- */}
                {settingsSubTab === "home" && (
                  <div className="space-y-4">
                    {/* Settings Overview Banner */}
                    <div className="bg-gradient-to-r from-accent-900 via-accent-800 to-accent-700 text-white rounded-xl p-5 shadow-xs border border-accent-900/20">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-2xs font-bold uppercase tracking-wider mb-2">
                            <Sliders className="w-3 h-3 text-indigo-300" />
                            Enterprise Policy Engine
                          </div>
                          <h3 className="text-base font-bold text-white mb-1">
                            System Settings &amp; Financial Allowance Hub
                          </h3>
                          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
                            Configure expense cutoff dates, past-day logging limits, automated approval escalations, and official TA/DA travel allowance rates across all employee grades.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs px-3.5 py-2.5 rounded-xl border border-white/15 shrink-0">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <div className="text-xs">
                            <div className="font-bold text-white">Policies Active</div>
                            <div className="text-2xs text-white/70 font-mono">Live Across All Workflows</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3 Interactive Grid Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Card 1 */}
                      <div 
                        onClick={() => setSettingsSubTab("submission")}
                        className="bg-surface border border-line rounded-xl p-5 hover:border-accent-400 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center group-hover:bg-accent-600 group-hover:text-white transition-colors shadow-xs">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-ink-900 group-hover:text-accent-600 transition-colors flex items-center justify-between">
                              <span>1. Submission Policy</span>
                              <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
                            </h4>
                            <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                              Cutoffs &amp; date windows for claim submission. Controls how far back engineers can log past expenses.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-2xs font-mono">
                          <span className="text-ink-500">Window: <strong className="text-ink-900 font-bold">{settings.max_past_days_limit || "15"} Days</strong></span>
                          <span className="text-ink-500">Cutoff: <strong className="text-ink-900 font-bold">Day {settings.monthly_cutoff_day || "3"}</strong></span>
                        </div>
                      </div>

                      {/* Card 2 */}
                      <div 
                        onClick={() => setSettingsSubTab("automation")}
                        className="bg-surface border border-line rounded-xl p-5 hover:border-accent-400 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-xs">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-ink-900 group-hover:text-accent-600 transition-colors flex items-center justify-between">
                              <span>2. Approval Automation</span>
                              <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
                            </h4>
                            <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                              Auto-approve &amp; expiry rules when manager approval is pending beyond the threshold limit.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-2xs font-mono">
                          <span className="text-ink-500">Threshold: <strong className="text-ink-900 font-bold">{settings.pending_auto_expiry_days || "5"} Days</strong></span>
                          <span className="text-ink-500">Action: <strong className="text-ink-900 font-bold uppercase">{settings.pending_auto_action || "reject"}</strong></span>
                        </div>
                      </div>

                      {/* Card 3 */}
                      <div 
                        onClick={() => setSettingsSubTab("allowances")}
                        className="bg-surface border border-line rounded-xl p-5 hover:border-accent-400 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-xs">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-ink-900 group-hover:text-accent-600 transition-colors flex items-center justify-between">
                              <span>3. Allowance Rates</span>
                              <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
                            </h4>
                            <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                              TA/DA rates, vehicle mileage per km, in/out district daily allowance, and hotel caps per employee grade.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-2xs font-mono">
                          <span className="text-ink-500">Master Tiers:</span>
                          <span className="text-accent-700 font-bold">{allowanceRates?.length || 0} Grades Configured</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- SUB-VIEW 1: SUBMISSION POLICIES FORM --- */}
                {(settingsSubTab === "submission" || settingsSubTab === "home") && (
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="bg-surface border border-line rounded-xl p-5 space-y-4 shadow-xs">
                      <div className="border-b border-line pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center text-xs font-bold">1</span>
                          <h4 className="text-sm font-bold text-ink-900 m-0">
                            Expense Submission Window &amp; Cutoff Policies
                          </h4>
                        </div>
                        <p className="text-xs text-ink-500 mt-1 ml-8">
                          Controls how far back employees can log expenses, and when a month closes for editing.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>How many past days can employees log a claim for? *</span>
                            <Tooltip title="Example: if set to 15, an employee submitting a claim today can date it back up to 15 days ago.">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={settings.max_past_days_limit || "15"}
                            onChange={(e) => setSettings({ ...settings, max_past_days_limit: e.target.value })}
                            className="input-lte h-9 text-xs font-mono font-bold w-full rounded-lg"
                            placeholder="e.g. 15"
                          />
                          <span className="text-xs text-ink-500 font-medium block">
                            Past calendar days allowed for engineers to log expenses.
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>Lock previous month's claims after this day *</span>
                            <Tooltip title="Example: if set to 3, all submissions for the previous month are locked after the 3rd of the current month.">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            required
                            value={settings.monthly_cutoff_day || "3"}
                            onChange={(e) => setSettings({ ...settings, monthly_cutoff_day: e.target.value })}
                            className="input-lte h-9 text-xs font-mono font-bold w-full rounded-lg"
                            placeholder="e.g. 3"
                          />
                          <span className="text-xs text-ink-500 font-medium block">
                            Day of month after which previous month claims are blocked.
                          </span>
                        </div>
                      </div>

                      {settingsSubTab === "submission" && (
                        <div className="flex items-center justify-between pt-3 border-t border-line">
                          <span className="text-2xs text-ink-500 font-mono">
                            Auto-applied globally to all employees
                          </span>
                          <button
                            type="submit"
                            disabled={savingSettings}
                            className="btn-lte-primary text-xs h-9 px-5 flex items-center gap-2 cursor-pointer font-bold disabled:opacity-60 rounded-lg"
                          >
                            <Zap className="w-4 h-4" />
                            <span>{savingSettings ? "Saving Settings..." : "Save Submission Policies"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                )}

                {/* --- SUB-VIEW 2: APPROVAL AUTOMATION FORM --- */}
                {(settingsSubTab === "automation" || settingsSubTab === "home") && (
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="bg-surface border border-line rounded-xl p-5 space-y-4 shadow-xs">
                      <div className="border-b border-line pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center text-xs font-bold">2</span>
                          <h4 className="text-sm font-bold text-ink-900 m-0">
                            Auto-Approval / Expiry Rules &amp; Routing Levels
                          </h4>
                        </div>
                        <p className="text-xs text-ink-500 mt-1 ml-8">
                          Configures automatic escalation, forwarding, or rejection when approvers do not take action in time.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>Auto-action after claim is pending this many days *</span>
                            <Tooltip title="Example: if set to 5, any claim waiting for approval for more than 5 days will trigger the automatic action below (0 = disabled).">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={settings.pending_auto_expiry_days || "5"}
                            onChange={(e) => setSettings({ ...settings, pending_auto_expiry_days: e.target.value })}
                            className="input-lte h-9 text-xs font-mono font-bold w-full rounded-lg"
                            placeholder="e.g. 5"
                          />
                          <span className="text-xs text-ink-500 font-medium block">
                            Days pending before system auto-action triggers (0 = disabled).
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>What happens automatically when threshold is reached? *</span>
                            <Tooltip title="Choose whether overdue claims should be automatically approved, rejected, or left for manual review.">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <select
                            value={settings.pending_auto_action || "approve"}
                            onChange={(e) => setSettings({ ...settings, pending_auto_action: e.target.value })}
                            className="input-lte h-9 text-xs font-semibold w-full cursor-pointer py-1 px-2.5 rounded-lg"
                          >
                            <option value="approve">⚡ Auto Approve Current Level</option>
                            <option value="reject">❌ Auto Reject Claim</option>
                            <option value="disabled">🚫 Disabled (Manual Action Only)</option>
                          </select>
                          <span className="text-xs text-ink-500 font-medium block">
                            System behavior when threshold days are reached without manager action.
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>Which approval level gets auto-approved?</span>
                            <Tooltip title="Determines whether auto-approval advances the claim to the next manager level or completes all levels.">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <select
                            value={settings.auto_approve_target_level || "next_level"}
                            onChange={(e) => setSettings({ ...settings, auto_approve_target_level: e.target.value })}
                            className="input-lte h-9 text-xs font-semibold w-full cursor-pointer py-1 px-2.5 rounded-lg"
                          >
                            <option value="next_level">⏩ Forward to Next Manager Level (L1 → L2)</option>
                            <option value="l1_only">1️⃣ Auto-Approve L1 Only</option>
                            <option value="full_final">✅ Complete Final Auto-Approval (All Levels)</option>
                          </select>
                          <span className="text-xs text-ink-500 font-medium block">
                            Target destination level when auto-approved.
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>Where does a rejected claim go?</span>
                            <Tooltip title="Defines whether a rejected claim returns to the submitter as a draft for correction or is closed permanently.">
                              <Info className="w-3.5 h-3.5 text-ink-400 hover:text-accent-600 cursor-help" />
                            </Tooltip>
                          </label>
                          <select
                            value={settings.rejection_fallback_level || "creator"}
                            onChange={(e) => setSettings({ ...settings, rejection_fallback_level: e.target.value })}
                            className="input-lte h-9 text-xs font-semibold w-full cursor-pointer py-1 px-2.5 rounded-lg"
                          >
                            <option value="creator">↩️ Return to Submitter / Drafts (For Edit &amp; Re-submit)</option>
                            <option value="previous_level">◀️ Return to Previous Manager Level</option>
                            <option value="final_reject">🛑 Permanent Rejection (Closed)</option>
                          </select>
                          <span className="text-xs text-ink-500 font-medium block">
                            Target destination when a claim is rejected.
                          </span>
                        </div>
                      </div>

                      {settingsSubTab === "automation" && (
                        <div className="flex items-center justify-between pt-3 border-t border-line">
                          <span className="text-2xs text-ink-500 font-mono">
                            Auto-applied globally across all workflows
                          </span>
                          <button
                            type="submit"
                            disabled={savingSettings}
                            className="btn-lte-primary text-xs h-9 px-5 flex items-center gap-2 cursor-pointer font-bold disabled:opacity-60 rounded-lg"
                          >
                            <Zap className="w-4 h-4" />
                            <span>{savingSettings ? "Saving Settings..." : "Save Approval Rules"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                )}

                {/* --- SUB-VIEW 3: ALLOWANCE MASTER TABLE --- */}
                {(settingsSubTab === "allowances" || settingsSubTab === "home") && (
                  <div className="bg-surface border border-line rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center text-xs font-bold">3</span>
                          <h4 className="text-sm font-bold text-ink-900 m-0">
                            Allowance Master — TA / DA Rates &amp; Hotel Caps
                          </h4>
                        </div>
                        <p className="text-xs text-ink-500 mt-1 ml-8">
                          Master rate table for mileage, daily allowance (DA), and lodging caps configured by employee grade.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingRates}
                        onClick={handleSaveAllowanceRates}
                        className="btn-lte-primary text-xs h-8 px-3.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 rounded-lg shrink-0"
                      >
                        {savingRates ? <LteSpinner /> : <Check className="w-3.5 h-3.5" />}
                        <span>Save Allowance Rates</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-line rounded-xl">
                      <Table
                        dataSource={allowanceRates}
                        rowKey="id"
                        loading={loadingRates}
                        pagination={false}
                        size="small"
                        className="ant-table-striped"
                        columns={[
                          {
                            title: "GRADE / LEVEL",
                            key: "grade_level",
                            render: (_: any, r: any) => (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 bg-accent-50 text-accent-700 border border-accent-100 font-bold text-2xs uppercase rounded font-mono inline-block">
                                  {r.grade ? `Grade ${r.grade}` : (r.level || "—")}
                                </span>
                                <div className="text-2xs text-ink-500 font-semibold">{r.category || ""}</div>
                              </div>
                            )
                          },
                          {
                            title: "VEHICLE",
                            key: "vehicle_type",
                            render: (_: any, r: any, idx: number) => (
                              <select
                                value={r.vehicle_type || "Bike"}
                                onChange={(e) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].vehicle_type = e.target.value;
                                  setAllowanceRates(updated);
                                }}
                                className="input-lte h-7.5 text-xs py-0.5 px-2 cursor-pointer rounded-md"
                              >
                                <option value="Bike">Bike</option>
                                <option value="Car">Car</option>
                                <option value="Public">Public</option>
                              </select>
                            )
                          },
                          {
                            title: "RATE / KM (₹)",
                            key: "rate_per_km",
                            render: (_: any, r: any, idx: number) => (
                              <InputNumber
                                min={0}
                                step={0.1}
                                size="small"
                                value={r.rate_per_km}
                                onChange={(val) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].rate_per_km = val || 0;
                                  setAllowanceRates(updated);
                                }}
                                className="w-20 font-mono font-bold text-xs rounded-md"
                              />
                            )
                          },
                          {
                            title: "IN-DIST DA (₹)",
                            key: "daily_in_district",
                            render: (_: any, r: any, idx: number) => (
                              <InputNumber
                                min={0}
                                size="small"
                                value={r.daily_in_district}
                                onChange={(val) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].daily_in_district = val || 0;
                                  setAllowanceRates(updated);
                                }}
                                className="w-20 font-mono font-bold text-xs rounded-md"
                              />
                            )
                          },
                          {
                            title: "OUT-DIST DA (₹)",
                            key: "daily_out_district",
                            render: (_: any, r: any, idx: number) => (
                              <InputNumber
                                min={0}
                                size="small"
                                value={r.daily_out_district}
                                onChange={(val) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].daily_out_district = val || 0;
                                  setAllowanceRates(updated);
                                }}
                                className="w-20 font-mono font-bold text-xs rounded-md"
                              />
                            )
                          },
                          {
                            title: "HOTEL DA (₹)",
                            key: "daily_hotel",
                            render: (_: any, r: any, idx: number) => (
                              <InputNumber
                                min={0}
                                size="small"
                                value={r.daily_hotel}
                                onChange={(val) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].daily_hotel = val || 0;
                                  setAllowanceRates(updated);
                                }}
                                className="w-20 font-mono font-bold text-xs rounded-md"
                              />
                            )
                          },
                          {
                            title: "HOTEL CAP IN-STATE S/D (₹)",
                            key: "hotel_in_state",
                            render: (_: any, r: any, idx: number) => (
                              <div className="flex gap-1.5">
                                <InputNumber
                                  min={0}
                                  size="small"
                                  placeholder="Single"
                                  value={r.hotel_in_state_s}
                                  onChange={(val) => {
                                    const updated = [...allowanceRates];
                                    updated[idx].hotel_in_state_s = val || 0;
                                    setAllowanceRates(updated);
                                  }}
                                  className="w-18 font-mono font-bold text-xs rounded-md"
                                />
                                <InputNumber
                                  min={0}
                                  size="small"
                                  placeholder="Double"
                                  value={r.hotel_in_state_d}
                                  onChange={(val) => {
                                    const updated = [...allowanceRates];
                                    updated[idx].hotel_in_state_d = val || 0;
                                    setAllowanceRates(updated);
                                  }}
                                  className="w-18 font-mono font-bold text-xs rounded-md"
                                />
                              </div>
                            )
                          },
                          {
                            title: "MAX KM / MO",
                            key: "max_km_per_month",
                            render: (_: any, r: any, idx: number) => (
                              <InputNumber
                                min={0}
                                size="small"
                                value={r.max_km_per_month}
                                onChange={(val) => {
                                  const updated = [...allowanceRates];
                                  updated[idx].max_km_per_month = val || 0;
                                  setAllowanceRates(updated);
                                }}
                                className="w-20 font-mono font-bold text-xs rounded-md"
                              />
                            )
                          }
                        ]}
                      />
                    </div>
                  </div>
                )}

                {/* Global Save Action Bar on Home view */}
                {settingsSubTab === "home" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
                    <span className="text-2xs font-bold text-ink-500 flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-approved animate-pulse" />
                      Settings Auto-Applied Globally Across All Workflows
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="btn-lte-primary text-xs h-9 px-5 flex items-center gap-2 cursor-pointer font-bold disabled:opacity-60 rounded-lg shadow-xs"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{savingSettings ? "Saving Settings..." : "Save All System Settings"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ================= SECTION 5: FACILITIES & POLICY LOCATIONS ================= */}
            {activeTab === "facilities" && (
              <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs animate-fadeIn">
                {/* Clean Integrated Header Bar: Sub-Tabs + Filters + Quick Actions */}
                <div className="p-3 sm:p-3.5 border-b border-line bg-surface flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
                  {/* Left: Clean Segmented Sub-Tab Switcher */}
                  <div className="bg-surface-sunken p-1 rounded-xl flex items-center gap-1 border border-line shrink-0">
                    <button
                      type="button"
                      onClick={() => setFacilitySubTab("expense")}
                      className={`py-1.5 px-3 text-xs font-bold border-0 cursor-pointer transition-all rounded-lg flex items-center gap-1.5 whitespace-nowrap ${
                        facilitySubTab === "expense"
                          ? "bg-white text-accent-700 shadow-xs border border-line"
                          : "bg-transparent text-ink-600 hover:text-ink-900"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Expense Facilities</span>
                      <span className="bg-accent-100 text-accent-700 px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold">
                        {standardFacilities.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFacilitySubTab("notada")}
                      className={`py-1.5 px-3 text-xs font-bold border-0 cursor-pointer transition-all rounded-lg flex items-center gap-1.5 whitespace-nowrap ${
                        facilitySubTab === "notada"
                          ? "bg-white text-rose-700 shadow-xs border border-line"
                          : "bg-transparent text-ink-600 hover:text-ink-900"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>No TA/DA Exceptions</span>
                      <span className="bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold">
                        {noTaDaHospitals.length}
                      </span>
                    </button>
                  </div>

                  {/* Right: Search & Filters with proper flex layout */}
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    {/* Flexible Search Box */}
                    <div className="relative flex-1 min-w-[150px] max-w-[280px]">
                      <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search facility, incharge, manager..."
                        value={facilitySearch}
                        onChange={(e) => setFacilitySearch(e.target.value)}
                        className="input-lte pl-8 h-8 text-xs w-full rounded-xl bg-white border border-line focus:border-accent-400"
                      />
                      {facilitySearch && (
                        <button
                          type="button"
                          onClick={() => setFacilitySearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5 border-0 bg-transparent cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Zone Dropdown */}
                    <select
                      value={facilityZoneFilter}
                      onChange={(e) => setFacilityZoneFilter(e.target.value)}
                      className="input-lte h-8 text-xs font-semibold py-0.5 px-2.5 rounded-xl cursor-pointer w-28 sm:w-32 bg-white shrink-0 border border-line"
                    >
                      <option value="all">All Zones ({availableFacilityZones.length})</option>
                      {availableFacilityZones.map((z: string) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>

                    {/* District Dropdown */}
                    <select
                      value={facilityDistrictFilter}
                      onChange={(e) => setFacilityDistrictFilter(e.target.value)}
                      className="input-lte h-8 text-xs font-semibold py-0.5 px-2.5 rounded-xl cursor-pointer w-32 sm:w-36 bg-white shrink-0 border border-line"
                    >
                      <option value="all">All Districts ({availableFacilityDistricts.length})</option>
                      {availableFacilityDistricts.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    {/* Reset Button */}
                    {(facilitySearch || facilityZoneFilter !== "all" || facilityDistrictFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setFacilitySearch("");
                          setFacilityZoneFilter("all");
                          setFacilityDistrictFilter("all");
                        }}
                        className="bg-accent-50 hover:bg-accent-100 text-accent-700 border border-accent-200 h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                        title="Clear all filters"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Tab 1: Standard Facilities Table */}
                {facilitySubTab === "expense" && (
                  <div>
                    {facilityLoading ? (
                      <div className="p-12 text-center text-ink-500 font-bold text-xs flex flex-col items-center justify-center gap-3">
                        <LteSpinner />
                        <span>Loading Facilities...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-surface-sunken text-ink-700 border-b border-line font-bold text-2xs uppercase tracking-wider">
                              <th className="py-2.5 px-3"># ID</th>
                              <th className="py-2.5 px-4">Facility Name</th>
                              <th className="py-2.5 px-3">District</th>
                              <th className="py-2.5 px-3">Facility Type</th>
                              <th className="py-2.5 px-3">Zone</th>
                              <th className="py-2.5 px-3">Facility Incharge</th>
                              <th className="py-2.5 px-3">Divisional Manager</th>
                              <th className="py-2.5 px-3">Coordinator</th>
                              <th className="py-2.5 px-3 text-right min-w-[90px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line text-ink-900 font-medium">
                            {standardFacilities
                              .filter((f) => {
                                if (facilityZoneFilter !== "all" && normalizeZoneName(f.zone_name).toLowerCase() !== normalizeZoneName(facilityZoneFilter).toLowerCase()) return false;
                                if (facilityDistrictFilter !== "all" && (f.district_name || "").toLowerCase() !== facilityDistrictFilter.toLowerCase()) return false;
                                if (!facilitySearch.trim()) return true;
                                const q = facilitySearch.toLowerCase();
                                return (
                                  (f.facility_name || "").toLowerCase().includes(q) ||
                                  (f.district_name || "").toLowerCase().includes(q) ||
                                  (f.facility_incharge || "").toLowerCase().includes(q) ||
                                  (f.dm_name || "").toLowerCase().includes(q) ||
                                  (f.coordinator_name || "").toLowerCase().includes(q) ||
                                  (f.facility_type || "").toLowerCase().includes(q) ||
                                  (f.zone_name || "").toLowerCase().includes(q)
                                );
                              })
                              .map((f, idx) => (
                                <tr key={f.id || idx} className="hover:bg-accent-50/20 transition-colors">
                                  <td className="py-2 px-3 font-mono text-ink-500 font-semibold">#{f.id}</td>
                                  <td className="py-2 px-4 font-bold text-ink-900">{f.facility_name}</td>
                                  <td className="py-2 px-3 font-bold text-accent-700">{f.district_name}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-2 py-0.5 bg-surface-sunken text-ink-700 rounded border border-line text-2xs font-semibold">
                                      {f.facility_type || "Hospital"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-ink-600">{f.zone_name || "Rajasthan"}</td>
                                  <td className="py-2 px-3 text-ink-700">{f.facility_incharge || "—"}</td>
                                  <td className="py-2 px-3 text-ink-700 font-medium">{f.dm_name || "—"}</td>
                                  <td className="py-2 px-3 text-ink-700">{f.coordinator_name || "—"}</td>
                                  <td className="py-2 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openEditFacilityModal(f, "standard")}
                                        className="p-1.5 bg-surface hover:bg-accent-50 text-ink-600 hover:text-accent-700 rounded-lg border border-line text-2xs font-bold cursor-pointer transition-all shadow-2xs"
                                        title="Edit Facility"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <Popconfirm
                                        title="Delete Facility?"
                                        description="Are you sure you want to remove this facility?"
                                        onConfirm={() => handleDeleteFacility(f.id || f.facility_name, "standard")}
                                        okText="Delete"
                                        cancelText="Cancel"
                                        okButtonProps={{ danger: true, size: "small" }}
                                      >
                                        <button
                                          type="button"
                                          className="p-1.5 bg-surface hover:bg-rose-50 text-ink-400 hover:text-rose-600 rounded-lg border border-line text-2xs font-bold cursor-pointer transition-all shadow-2xs"
                                          title="Delete Facility"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </Popconfirm>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {standardFacilities.length === 0 && (
                              <tr>
                                <td colSpan={9} className="py-8 text-center text-ink-400 font-medium">
                                  No Expense Facilities found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Tab 2: No TA/DA Exceptions Table */}
                {facilitySubTab === "notada" && (
                  <div>
                    {facilityLoading ? (
                      <div className="p-12 text-center text-ink-500 font-bold text-xs flex flex-col items-center justify-center gap-3">
                        <LteSpinner />
                        <span>Loading Exception Hospitals...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-surface-sunken text-ink-700 border-b border-line font-bold text-2xs uppercase tracking-wider">
                              <th className="py-2.5 px-3"># ID</th>
                              <th className="py-2.5 px-4">Hospital Name</th>
                              <th className="py-2.5 px-4">District</th>
                              <th className="py-2.5 px-4">Policy Rule</th>
                              <th className="py-2.5 px-3 text-right min-w-[90px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line text-ink-900 font-medium">
                            {noTaDaHospitals
                              .filter((f) => {
                                if (facilityDistrictFilter !== "all" && (f.district_name || "").toLowerCase() !== facilityDistrictFilter.toLowerCase()) return false;
                                if (!facilitySearch.trim()) return true;
                                const q = facilitySearch.toLowerCase();
                                return (
                                  (f.hospital_name || f.facility_name || "").toLowerCase().includes(q) ||
                                  (f.district_name || "").toLowerCase().includes(q)
                                );
                              })
                              .map((f, idx) => (
                                <tr key={f.id || idx} className="hover:bg-rose-50/20 transition-colors">
                                  <td className="py-2 px-3 font-mono text-ink-500 font-semibold">#{f.id || idx + 1}</td>
                                  <td className="py-2 px-4 font-bold text-ink-900 text-xs">
                                    {f.hospital_name || f.facility_name}
                                  </td>
                                  <td className="py-2 px-4 font-bold text-rose-700 font-mono">
                                    {f.district_name}
                                  </td>
                                  <td className="py-2 px-4 text-2xs font-semibold text-rose-600">
                                    <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                      ₹0 Daily Allowance
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openEditFacilityModal(f, "no_ta_da")}
                                        className="p-1.5 bg-surface hover:bg-rose-50 text-ink-600 hover:text-rose-700 rounded-lg border border-line text-2xs font-bold cursor-pointer transition-all shadow-2xs"
                                        title="Edit Hospital"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <Popconfirm
                                        title="Remove Exception?"
                                        description="Are you sure you want to remove this hospital from No TA/DA exception list?"
                                        onConfirm={() => handleDeleteFacility(f.id || f.hospital_name, "no_ta_da")}
                                        okText="Delete"
                                        cancelText="Cancel"
                                        okButtonProps={{ danger: true, size: "small" }}
                                      >
                                        <button
                                          type="button"
                                          className="p-1.5 bg-surface hover:bg-rose-50 text-ink-400 hover:text-rose-600 rounded-lg border border-line text-2xs font-bold cursor-pointer transition-all shadow-2xs"
                                          title="Delete Hospital"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </Popconfirm>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {noTaDaHospitals.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-ink-400 font-medium">
                                  No Exception Hospitals found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================= SECTION: ROLES & PERMISSIONS MATRIX ================= */}
            {activeTab === "permissions" && (
              <div className="space-y-4 animate-fadeIn">
                {/* Header Overview Banner */}
                <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center font-black shrink-0 border border-accent-200 shadow-xs">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-accent-600 text-white text-2xs font-mono font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
                          SYSTEM SECURITY GOVERNANCE
                        </span>
                        <span className="text-2xs font-mono font-bold text-approved bg-approved-bg px-2 py-0.5 border border-approved-border rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> 8 ENFORCED ROLES
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-ink-900 mt-1.5 mb-0 font-display">
                        Roles &amp; Permissions Authorization Matrix
                      </h3>
                      <p className="text-xs text-ink-500 font-medium m-0 mt-0.5">
                        Documented system capabilities, route-level authorization guards, and administrative access privileges configured across Cyrix FieldOps.
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-sunken border border-line p-3 rounded-xl text-right shrink-0">
                    <span className="text-2xs font-mono font-bold text-ink-500 uppercase tracking-wider block">ACCESS ENFORCEMENT</span>
                    <span className="text-xs font-mono font-bold text-accent-700 flex items-center gap-1.5 justify-end mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-accent-600 animate-pulse" />
                      STRICT JWT &amp; D1 ROUTE GUARDS
                    </span>
                  </div>
                </div>

                {/* Matrix Table Card */}
                <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-accent-200" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">
                        Enterprise Privilege Cross-Reference Matrix
                      </span>
                    </div>
                    <span className="text-2xs font-mono bg-white/10 px-2.5 py-1 rounded-full text-accent-100 font-bold border border-white/10">
                      10 Capabilities × 8 Roles
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-surface-sunken text-ink-700 border-b border-line font-bold text-2xs uppercase tracking-wider">
                          <th className="py-3 px-4 min-w-[200px]">System Capability / Module</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Admin</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Project Head</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Div Manager</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Manager</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Coordinator</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">MIS</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Accountant</th>
                          <th className="py-3 px-3 text-center min-w-[90px]">Engineer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-ink-900 font-medium">
                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">📝 Submit Daily Expense Claims</div>
                            <div className="text-2xs text-ink-500 font-normal">Log daily claims, meal DA, travel legs and receipts</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🚗 Vehicle Odometer Logs</div>
                            <div className="text-2xs text-ink-500 font-normal">Record opening &amp; closing km with meter photo proofs</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🔍 L1 Claim Review &amp; Policy Checks</div>
                            <div className="text-2xs text-ink-500 font-normal">Review first-tier team claims and verify attachments</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🛡️ L2 / L3 Multi-Tier Approval</div>
                            <div className="text-2xs text-ink-500 font-normal">Grant executive second and third tier approvals</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">⚡ Bulk Claim Approvals</div>
                            <div className="text-2xs text-ink-500 font-normal">One-click batch approve claims for assigned sub-teams</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🏥 Facilities &amp; No TA/DA Master</div>
                            <div className="text-2xs text-ink-500 font-normal">Add, edit, or delete expense facilities and hospital exceptions</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">⚙️ System Cutoffs &amp; Allowance Rates</div>
                            <div className="text-2xs text-ink-500 font-normal">Configure monthly cutoff dates, past-days limits, and TA/DA rates</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🔑 Unlock Sensitive Fields &amp; Reset Credentials</div>
                            <div className="text-2xs text-ink-500 font-normal">Authorize sensitive vehicle edits, unlock locked submissions, and reset passwords</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">📊 MIS Reports &amp; Data Export</div>
                            <div className="text-2xs text-ink-500 font-normal">Access financial summaries, month reports, and download Excel ledgers</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>

                        <tr className="hover:bg-accent-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink-900">🎫 Help Center Ticket Handling</div>
                            <div className="text-2xs text-ink-500 font-normal">Resolve employee complaints, assign tickets, and close support queries</div>
                          </td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                          <td className="py-3 px-3 text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 font-bold">—</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role Responsibility Scope Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className="bg-surface border border-line rounded-xl p-4 shadow-xs space-y-1.5">
                    <span className="px-2 py-0.5 bg-accent-50 text-accent-700 font-bold text-2xs uppercase rounded-full font-mono border border-accent-100">
                      ADMIN / SUPER ADMIN
                    </span>
                    <h4 className="text-xs font-bold text-ink-900 m-0">Full Console Authority</h4>
                    <p className="text-2xs text-ink-500 font-medium m-0 leading-relaxed">
                      Complete administrative access across roster CRUD, security parameters, system-wide cutoffs, and D1 database migrations.
                    </p>
                  </div>

                  <div className="bg-surface border border-line rounded-xl p-4 shadow-xs space-y-1.5">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-2xs uppercase rounded-full font-mono border border-indigo-100">
                      PROJECT HEAD &amp; DM
                    </span>
                    <h4 className="text-xs font-bold text-ink-900 m-0">Regional Governance</h4>
                    <p className="text-2xs text-ink-500 font-medium m-0 leading-relaxed">
                      Multi-tier approval authority (L2/L3), bulk approval permissions, and zone-level expenditure monitoring.
                    </p>
                  </div>

                  <div className="bg-surface border border-line rounded-xl p-4 shadow-xs space-y-1.5">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-2xs uppercase rounded-full font-mono border border-emerald-100">
                      MIS &amp; ACCOUNTANT
                    </span>
                    <h4 className="text-xs font-bold text-ink-900 m-0">Financial Controllers</h4>
                    <p className="text-2xs text-ink-500 font-medium m-0 leading-relaxed">
                      Auditing expense claims, checking policy deviations, verifying hotel tariffs, and exporting monthly financial disbursements.
                    </p>
                  </div>

                  <div className="bg-surface border border-line rounded-xl p-4 shadow-xs space-y-1.5">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-2xs uppercase rounded-full font-mono border border-amber-100">
                      COORDINATOR &amp; ENGINEER
                    </span>
                    <h4 className="text-xs font-bold text-ink-900 m-0">Field Operations</h4>
                    <p className="text-2xs text-ink-500 font-medium m-0 leading-relaxed">
                      Daily field asset maintenance, hospital visits, odometer logging, and initial receipt submissions.
                    </p>
                  </div>
                </div>
              </div>
            )}


            {/* ================= SECTION: ACTIVITY & AUDIT LOG ================= */}
            {activeTab === "audit" && (
              <div className="space-y-4 animate-fadeIn">
                {/* Header Overview Banner */}
                <div className="bg-surface border border-line rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center font-black shrink-0 border border-accent-200 shadow-xs">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-accent-600 text-white text-2xs font-mono font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
                          LIVE GOVERNANCE LEDGER
                        </span>
                        <span className="text-2xs font-mono font-bold text-approved bg-approved-bg px-2 py-0.5 border border-approved-border rounded-full flex items-center gap-1">
                          <Activity className="w-3 h-3 animate-pulse" /> REAL-TIME D1 AUDIT
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-ink-900 mt-1.5 mb-0 font-display">
                        System Activity &amp; Audit Trail
                      </h3>
                      <p className="text-xs text-ink-500 font-medium m-0 mt-0.5">
                        Chronological, tamper-evident record of administrative changes, user credential updates, facility edits, and approval resets.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fetchAuditLogs(auditSearch)}
                      disabled={auditLoading}
                      className="btn-lte-outline text-xs h-9 px-3.5 flex items-center gap-2 font-bold cursor-pointer rounded-xl bg-white"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-accent-600 ${auditLoading ? "animate-spin" : ""}`} />
                      <span>{auditLoading ? "Refreshing..." : "Refresh Audit Log"}</span>
                    </button>
                  </div>
                </div>

                {/* Audit Toolbar */}
                <div className="bg-surface border border-line rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by actor, action, or entity..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs(auditSearch)}
                      className="input-lte pl-9 h-9 text-xs w-full rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-2xs font-mono font-bold text-ink-500">
                    <span>Showing recent {auditLogs.length} audit trail records</span>
                  </div>
                </div>

                {/* Audit List Table Card */}
                <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent-200" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">
                        Activity Events Stream
                      </span>
                    </div>
                    <span className="text-2xs font-mono bg-white/10 px-2.5 py-1 rounded-full text-accent-100 font-bold border border-white/10">
                      {auditLogs.length} Events Recorded
                    </span>
                  </div>

                  {auditLoading ? (
                    <div className="p-12 text-center text-ink-500 font-bold text-xs bg-surface flex flex-col items-center justify-center gap-3">
                      <LteSpinner />
                      <span>Loading governance audit trail...</span>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="p-12 text-center text-ink-400 font-medium bg-surface">
                      <History className="w-8 h-8 text-ink-300 mx-auto mb-2 opacity-50" />
                      <p className="m-0 text-xs font-bold text-ink-700">No activity audit logs recorded yet.</p>
                      <p className="m-0 text-2xs text-ink-400 mt-1">Actions taken across the Admin Console will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-surface-sunken text-ink-700 border-b border-line font-bold text-2xs uppercase tracking-wider">
                            <th className="py-3 px-4 min-w-[150px]">Timestamp (IST)</th>
                            <th className="py-3 px-4 min-w-[160px]">Actor / Performed By</th>
                            <th className="py-3 px-3 min-w-[140px]">Action Event</th>
                            <th className="py-3 px-3 min-w-[130px]">Target Entity</th>
                            <th className="py-3 px-4 min-w-[220px]">Value Change / Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line text-ink-900">
                          {auditLogs.map((log: any, idx: number) => {
                            
                            return (
                              <tr key={log.id || idx} className="hover:bg-accent-50/30 transition-colors">
                                <td className="py-2.5 px-4 font-mono text-2xs font-bold text-ink-500 whitespace-nowrap">
                                  {formatToIST(log.created_at)}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-bold text-2xs shrink-0">
                                      {getInitials(log.actor_name || "Admin")}
                                    </div>
                                    <div>
                                      <div className="font-bold text-ink-900 text-xs">{log.actor_name || "System Admin"}</div>
                                      <span className="text-2xs text-accent-700 font-mono font-semibold">
                                        {log.actor_role || "Admin"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 bg-accent-50 text-accent-700 border border-accent-200 font-bold text-2xs uppercase rounded-full font-mono inline-block">
                                    {log.action || "UPDATE"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-2xs font-bold text-ink-700">
                                    {log.entity_type || "System"}: {log.entity_id || "—"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-2xs text-ink-700 font-mono">
                                  {log.old_value || log.new_value ? (
                                    <div className="space-y-0.5">
                                      {log.old_value && (
                                        <div className="text-rose-600 line-through truncate max-w-xs">
                                          Old: {String(log.old_value).slice(0, 60)}
                                        </div>
                                      )}
                                      {log.new_value && (
                                        <div className="text-emerald-700 font-semibold truncate max-w-xs">
                                          New: {String(log.new_value).slice(0, 60)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-ink-400 italic">No value change recorded</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>


          {/* Footer attribution matching HomePage */}
          <footer className="pt-8 pb-4 border-t border-line text-center text-xs text-ink-500 font-medium">
            <p className="m-0 flex items-center justify-center gap-1">
              <span>Cyrix Field Operations &amp; Expense Governance Suite • Designed &amp; Developed by</span>
              <a
                href="https://sunilbishnoi.co.in/"
                target="_blank"
                rel="noreferrer"
                className="text-accent-600 hover:text-accent-800 font-bold hover:underline"
              >
                Sunil Bishnoi
              </a>
            </p>
          </footer>
        </div>
      </div>

      {/* ================= MODAL: ADD FACILITY / NO TA DA HOSPITAL ================= */}
      {isAddFacilityModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-md overflow-hidden animate-scale-up flex flex-col">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  {newFacilityTargetTable === "standard" ? "Add Expense Facility" : "Add No TA/DA Hospital"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFacilityModalOpen(false)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateFacility();
              }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="label-lte text-2xs block mb-1">
                    Target Master Table *
                  </label>
                  <select
                    value={newFacilityTargetTable}
                    onChange={(e) => setNewFacilityTargetTable(e.target.value as any)}
                    className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                  >
                    <option value="standard">Standard Expense Facility (Selectable in claims)</option>
                    <option value="no_ta_da">No TA/DA Exception Location (Zero daily allowance)</option>
                  </select>
                </div>

                <div>
                  <label className="label-lte text-2xs block mb-1">
                    {newFacilityTargetTable === "standard" ? "Facility Name (facility_name) *" : "Hospital Name (hospital_name) *"}
                  </label>
                  <input
                    type="text"
                    value={newFacilityName}
                    onChange={(e) => setNewFacilityName(e.target.value)}
                    className="input-lte w-full h-8 text-xs font-semibold"
                    placeholder="e.g. Mathura Das Mathur Hospital"
                    required
                  />
                </div>

                <div>
                  <label className="label-lte text-2xs block mb-1">
                    District Name (district_name) *
                  </label>
                  <select
                    value={newFacilityDistrict}
                    onChange={(e) => setNewFacilityDistrict(e.target.value)}
                    className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    required
                  >
                    <option value="">-- Select District --</option>
                    {["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {newFacilityTargetTable === "standard" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label-lte text-2xs block mb-1">
                          Facility Type
                        </label>
                        <select
                          value={newFacilityType}
                          onChange={(e) => setNewFacilityType(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                        >
                          <option value="District Hospital (DH)">District Hospital (DH)</option>
                          <option value="Sub-District Hospital (SDH)">Sub-District Hospital (SDH)</option>
                          <option value="Medical College / Hospital">Medical College / Hospital</option>
                          <option value="Community Health Centre (CHC)">Community Health Centre (CHC)</option>
                          <option value="Primary Health Centre (PHC)">Primary Health Centre (PHC)</option>
                          <option value="Base Working Location / Hub">Base Working Location / Hub</option>
                          <option value="Other Facility">Other Facility</option>
                        </select>
                      </div>

                      <div>
                        <label className="label-lte text-2xs block mb-1">
                          Zone Name
                        </label>
                        <select
                          value={newFacilityZone}
                          onChange={(e) => setNewFacilityZone(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                        >
                          <option value="Zone Jaipur">Zone Jaipur</option>
                          <option value="Zone Jodhpur">Zone Jodhpur</option>
                          <option value="Zone Bikaner">Zone Bikaner</option>
                          <option value="Zone Ajmer">Zone Ajmer</option>
                          <option value="Zone Udaipur">Zone Udaipur</option>
                          <option value="Zone Kota">Zone Kota</option>
                          <option value="Zone Bharatpur">Zone Bharatpur</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label-lte text-2xs block mb-1">
                        Facility Incharge
                      </label>
                      <input
                        type="text"
                        value={newFacilityIncharge}
                        onChange={(e) => setNewFacilityIncharge(e.target.value)}
                        className="input-lte w-full h-8 text-xs font-semibold"
                        placeholder="e.g. Dr. R. K. Sharma / MoIC"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label-lte text-2xs block mb-1">
                          DM Name
                        </label>
                        <input
                          type="text"
                          value={newFacilityDmName}
                          onChange={(e) => setNewFacilityDmName(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-semibold"
                          placeholder="District Manager"
                        />
                      </div>

                      <div>
                        <label className="label-lte text-2xs block mb-1">
                          Coordinator Name
                        </label>
                        <input
                          type="text"
                          value={newFacilityCoordinatorName}
                          onChange={(e) => setNewFacilityCoordinatorName(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-semibold"
                          placeholder="Coordinator Name"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddFacilityModalOpen(false)}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold"
                >
                  Save Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT FACILITY / NO TA DA HOSPITAL ================= */}
      {isEditFacilityModalOpen && editingFacility && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-surface border border-line rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up flex flex-col">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center font-bold border border-accent-200 shadow-2xs">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900 m-0">
                    {newFacilityTargetTable === "standard" ? "Edit Expense Facility" : "Edit No TA/DA Hospital"}
                  </h3>
                  <p className="text-2xs text-ink-500 m-0 font-mono">ID: #{editingFacility.id || "New"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditFacilityModalOpen(false)}
                className="p-1 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditFacilitySubmit();
              }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="label-lte text-2xs block mb-1">Category *</label>
                  <select
                    value={newFacilityTargetTable}
                    onChange={(e) => setNewFacilityTargetTable(e.target.value as any)}
                    className="input-lte h-9 text-xs font-bold w-full rounded-xl"
                  >
                    <option value="standard">Standard Expense Facility (Selectable in claims)</option>
                    <option value="no_ta_da">No TA/DA Exception Location (Zero daily allowance)</option>
                  </select>
                </div>

                <div>
                  <label className="label-lte text-2xs block mb-1">Facility / Hospital Name *</label>
                  <input
                    type="text"
                    required
                    value={newFacilityName}
                    onChange={(e) => setNewFacilityName(e.target.value)}
                    placeholder="e.g. SMS Hospital Jaipur"
                    className="input-lte h-9 text-xs font-bold w-full rounded-xl"
                  />
                </div>

                <div>
                  <label className="label-lte text-2xs block mb-1">District Name *</label>
                  <input
                    type="text"
                    required
                    value={newFacilityDistrict}
                    onChange={(e) => setNewFacilityDistrict(e.target.value)}
                    placeholder="e.g. Jaipur"
                    className="input-lte h-9 text-xs font-bold w-full rounded-xl font-mono"
                  />
                </div>

                {newFacilityTargetTable === "standard" && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="label-lte text-2xs block mb-1">Facility Type</label>
                        <select
                          value={newFacilityType}
                          onChange={(e) => setNewFacilityType(e.target.value)}
                          className="input-lte h-9 text-xs font-semibold w-full rounded-xl cursor-pointer"
                        >
                          <option value="District Hospital (DH)">District Hospital (DH)</option>
                          <option value="Community Health Centre (CHC)">CHC</option>
                          <option value="Primary Health Centre (PHC)">PHC</option>
                          <option value="Sub District Hospital (SDH)">SDH</option>
                          <option value="Medical College">Medical College</option>
                          <option value="Hospital">Hospital</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="label-lte text-2xs block mb-1">Zone Name</label>
                        <select
                          value={newFacilityZone}
                          onChange={(e) => setNewFacilityZone(e.target.value)}
                          className="input-lte h-9 text-xs font-semibold w-full rounded-xl cursor-pointer"
                        >
                          {dropdowns?.zones && Object.keys(dropdowns.zones).map((z: string) => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                          {!dropdowns?.zones && (
                            <>
                              <option value="Zone Jaipur">Zone Jaipur</option>
                              <option value="Zone Jodhpur">Zone Jodhpur</option>
                              <option value="Zone Udaipur">Zone Udaipur</option>
                              <option value="Zone Kota">Zone Kota</option>
                              <option value="Zone Bikaner">Zone Bikaner</option>
                              <option value="Zone Ajmer">Zone Ajmer</option>
                              <option value="Zone Bharatpur">Zone Bharatpur</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label-lte text-2xs block mb-1">Facility Incharge</label>
                      <input
                        type="text"
                        value={newFacilityIncharge}
                        onChange={(e) => setNewFacilityIncharge(e.target.value)}
                        placeholder="e.g. Dr. Sharma"
                        className="input-lte h-9 text-xs font-medium w-full rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="label-lte text-2xs block mb-1">Divisional Manager (DM)</label>
                        <input
                          type="text"
                          value={newFacilityDmName}
                          onChange={(e) => setNewFacilityDmName(e.target.value)}
                          placeholder="e.g. Sunil Bishnoi"
                          className="input-lte h-9 text-xs font-medium w-full rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="label-lte text-2xs block mb-1">Coordinator Name</label>
                        <input
                          type="text"
                          value={newFacilityCoordinatorName}
                          onChange={(e) => setNewFacilityCoordinatorName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="input-lte h-9 text-xs font-medium w-full rounded-xl"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="bg-surface-sunken border-t border-line px-5 py-3.5 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditFacilityModalOpen(false)}
                  className="btn-lte-secondary h-9 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#1E1B4B] to-[#4338CA] text-white h-9 px-5 text-xs font-bold rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all border-0"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE SINGLE USER ================= */}
      {showSingleUserModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  Register New Employee
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSingleUserModal(false)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSingleUser} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                {singleUserError && (
                  <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 font-bold text-xs rounded-lg">
                    {singleUserError}
                  </div>
                )}

                {/* Grid 1 - Core Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Employee Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. RJCYR045"
                      value={eCode}
                      onChange={(e) => setECode(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. SUBHASH YADAV"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Password *</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold"
                      required
                    />
                  </div>
                </div>

                {/* Grid 2 - Role and Designations */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">System Role *</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {dropdowns?.roles?.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Designation *</label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {dropdowns?.designations?.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Grade *</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {(dropdowns?.grades && dropdowns.grades.length > 0 ? dropdowns.grades : ["A", "B", "C", "D"]).map((g: string) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid 3 - Zone and District */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Zone *</label>
                    <select
                      value={zone}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="All">All</option>
                      {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">District *</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="All">All</option>
                      {zone !== "All" && dropdowns?.zones?.[zone]?.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">User Type *</label>
                    <select
                      value={userType}
                      onChange={(e) => setUserType(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="Employee">Employee</option>
                      <option value="Contractor">Contractor</option>
                      <option value="System">System</option>
                    </select>
                  </div>
                </div>

                {/* Grid 4 - Hierarchy Reporting Managers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Reporting Manager</label>
                    <select
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Select Manager --</option>
                      {mList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Zonal Manager</label>
                    <select
                      value={zonalManager}
                      onChange={(e) => setZonalManager(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Select Zonal Manager --</option>
                      {zmList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Coordinator</label>
                    <select
                      value={coordinator}
                      onChange={(e) => setCoordinator(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Select Coordinator --</option>
                      {cList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid 5 - Mobile, Email, and Upkaran */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Email ID *</label>
                    <input
                      type="email"
                      placeholder="e.g. subhash@cyrix.com"
                      value={mailId}
                      onChange={(e) => setMailId(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Device / Upkaran ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. UPK-9988-XY"
                      value={eUpkaranId}
                      onChange={(e) => setEUpkaranId(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                {/* Base Reporting Location Section */}
                <div className="space-y-1">
                  <label className="label-lte text-2xs block mb-1">Base Reporting Location(s) *</label>
                  {dropdowns?.facilities?.[district] && dropdowns.facilities[district].length > 0 ? (
                    <MultiSelectDropdown
                      options={dropdowns.facilities[district]}
                      selectedValues={parseSelectedLocations(baseReportingLocation, dropdowns.facilities[district] || [])}
                      onChange={(vals) => setBaseReportingLocation(vals.join(", "))}
                      placeholder="-- Select Base Reporting Location(s) --"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. PHC Location or custom hospital"
                      value={baseReportingLocation}
                      onChange={(e) => setBaseReportingLocation(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold"
                      required
                    />
                  )}
                </div>

                {/* Grid 6 - Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Date of Joining *</label>
                    <input
                      type="date"
                      value={dateOfJoining}
                      onChange={(e) => setDateOfJoining(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold [color-scheme:light]"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold [color-scheme:light]"
                      required
                    />
                  </div>
                </div>

                {/* Screen permissions grid checkboxes */}
                <div className="space-y-1.5 pt-2 border-t border-line">
                  <span className="text-2xs font-bold text-ink-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-sunken rounded-lg border border-line">
                    {ALL_WINDOWS.map((win) => (
                      <label key={win.id} className="flex items-center gap-2 text-xs font-semibold text-ink-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allowedWindows.includes(win.id)}
                          onChange={() => handleToggleWindow(win.id, false)}
                          className="rounded border-line text-accent-600 focus:ring-accent-600 h-4 w-4 cursor-pointer"
                        />
                        {win.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSingleUserModal(false)}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleUserLoading}
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {singleUserLoading && <LteSpinner />}
                  <span>Register Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER PROFILE ================= */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink-900 m-0">Update Employee:</h3>
                  <span className="font-mono text-xs font-bold text-accent-700 bg-accent-50 px-2 py-0.5 rounded border border-accent-100">
                    {editingUser.user_id}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isSensitiveSectionUnlocked ? (
                  <button
                    type="button"
                    onClick={() => setShowUnlockModal(true)}
                    className="btn-lte-secondary text-2xs h-7 px-2.5 flex items-center gap-1 text-rose-700 hover:text-rose-800 font-bold border-rose-200 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Unlock Credentials</span>
                  </button>
                ) : (
                  <span className="text-2xs bg-approved-bg text-approved font-bold uppercase px-2 py-0.5 rounded border border-approved-border flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> Unlocked
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                {editUserError && (
                  <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 font-bold text-xs rounded-lg">
                    {editUserError}
                  </div>
                )}

                {/* Sensitive Credentials Unlocked Warning Card */}
                {isSensitiveSectionUnlocked && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="text-2xs font-bold text-amber-900 uppercase tracking-wider">
                        Sensitive Credentials Modification (Unlocked)
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label-lte text-2xs block mb-1">User ID *</label>
                        <input
                          type="text"
                          value={editUserId}
                          onChange={(e) => setEditUserId(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="label-lte text-2xs block mb-1">Employee Code *</label>
                        <input
                          type="text"
                          value={editECode}
                          onChange={(e) => setEditECode(e.target.value)}
                          className="input-lte w-full h-8 text-xs font-mono font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label-lte text-2xs block mb-1">New Password (Leave blank to keep current password)</label>
                      <input
                        type="password"
                        value={editUserPassword}
                        onChange={(e) => setEditUserPassword(e.target.value)}
                        className="input-lte w-full h-8 text-xs font-bold"
                        placeholder="Enter new password for this user"
                      />
                    </div>
                  </div>
                )}

                {/* Grid 1 - Core Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">System Status *</label>
                    <select
                      value={editUserStatus}
                      onChange={(e) => setEditUserStatus(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="active">Active</option>
                      <option value="locked">Locked</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                {/* Grid 2 - Role and Designations */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">System Role *</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {dropdowns?.roles?.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Designation *</label>
                    <select
                      value={editDesignation}
                      onChange={(e) => setEditDesignation(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {dropdowns?.designations?.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Grade *</label>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      {(dropdowns?.grades && dropdowns.grades.length > 0 ? dropdowns.grades : ["A", "B", "C", "D"]).map((g: string) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid 3 - Zone and District */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Zone *</label>
                    <select
                      value={editZone}
                      onChange={(e) => handleEditZoneChange(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="All">All</option>
                      {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">District *</label>
                    <select
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="All">All</option>
                      {editZone !== "All" && dropdowns?.zones?.[editZone]?.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">User Type *</label>
                    <select
                      value={editUserType}
                      onChange={(e) => setEditUserType(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="Employee">Employee</option>
                      <option value="Contractor">Contractor</option>
                      <option value="System">System</option>
                    </select>
                  </div>
                </div>

                {/* Grid 4 - Reporting Managers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Reporting Manager</label>
                    <select
                      value={editManager}
                      onChange={(e) => setEditManager(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Clear Manager --</option>
                      {mList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                      {editManager && !mList.some((m) => m.name === editManager) && (
                        <option value={editManager}>{editManager}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Zonal Manager</label>
                    <select
                      value={editZonalManager}
                      onChange={(e) => setEditZonalManager(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Clear Zonal Manager --</option>
                      {zmList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                      {editZonalManager && !zmList.some((zm) => zm.name === editZonalManager) && (
                        <option value={editZonalManager}>{editZonalManager}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Coordinator</label>
                    <select
                      value={editCoordinator}
                      onChange={(e) => setEditCoordinator(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                    >
                      <option value="">-- None / Clear Coordinator --</option>
                      {cList.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.e_code || u.user_id})
                        </option>
                      ))}
                      {editCoordinator && !cList.some((c) => c.name === editCoordinator) && (
                        <option value={editCoordinator}>{editCoordinator}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Grid 5 - Mobile, Email, and Device */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      value={editMobileNumber}
                      onChange={(e) => setEditMobileNumber(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Email ID *</label>
                    <input
                      type="email"
                      value={editMailId}
                      onChange={(e) => setEditMailId(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Device / Upkaran ID *</label>
                    <input
                      type="text"
                      value={editEUpkaranId}
                      onChange={(e) => setEditEUpkaranId(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                </div>

                {/* Base Reporting Location Section */}
                <div className="space-y-1">
                  <label className="label-lte text-2xs block mb-1">Base Reporting Location(s) *</label>
                  {dropdowns?.facilities?.[editDistrict] && dropdowns.facilities[editDistrict].length > 0 ? (
                    <MultiSelectDropdown
                      options={[
                        ...(dropdowns.facilities[editDistrict] || []),
                        ...parseSelectedLocations(editBaseReportingLocation, dropdowns.facilities[editDistrict] || [])
                      ]}
                      selectedValues={parseSelectedLocations(editBaseReportingLocation, dropdowns.facilities[editDistrict] || [])}
                      onChange={(vals) => setEditBaseReportingLocation(vals.join(", "))}
                      placeholder="-- Select Base Reporting Location(s) --"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. PHC Location or custom hospital"
                      value={editBaseReportingLocation}
                      onChange={(e) => setEditBaseReportingLocation(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold"
                      required
                    />
                  )}
                </div>

                {/* Grid 6 - Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-lte text-2xs block mb-1">Date of Joining *</label>
                    <input
                      type="date"
                      value={editDateOfJoining}
                      onChange={(e) => setEditDateOfJoining(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold [color-scheme:light]"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-lte text-2xs block mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      value={editDateOfBirth}
                      onChange={(e) => setEditDateOfBirth(e.target.value)}
                      className="input-lte w-full h-8 text-xs font-bold [color-scheme:light]"
                      required
                    />
                  </div>
                </div>

                {/* Checkboxes edit */}
                <div className="space-y-1.5 pt-2 border-t border-line">
                  <span className="text-2xs font-bold text-ink-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-sunken rounded-lg border border-line">
                    {ALL_WINDOWS.map((win) => (
                      <label key={win.id} className="flex items-center gap-2 text-xs font-semibold text-ink-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editAllowedWindows.includes(win.id)}
                          onChange={() => handleToggleWindow(win.id, true)}
                          className="rounded border-line text-accent-600 focus:ring-accent-600 h-4 w-4 cursor-pointer"
                        />
                        {win.name}
                      </label>
                    ))}
                  </div>

                  {/* Bulk Approval Rights Governance */}
                  {(editAllowedWindows.includes("approval") || ["manager", "zonal head", "state head", "project head", "coordinator", "approver", "admin"].includes((editRole || "").toLowerCase().trim())) && (
                    <div className="mt-3.5">
                      <label className="text-2xs font-bold text-ink-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                        <Zap size={14} className={editCanBulkApprove ? "text-approved" : "text-ink-400"} />
                        <span>Bulk Approval Permission Governance</span>
                      </label>

                      <div className={`p-3 rounded-lg border transition-all flex flex-wrap items-center justify-between gap-3 ${
                        editCanBulkApprove
                          ? "bg-approved-bg border-approved-border"
                          : "bg-surface-sunken border-line"
                      }`}>
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-2xs font-bold uppercase tracking-wide px-2 py-0.5 rounded font-mono ${
                              editCanBulkApprove
                                ? "bg-approved text-white"
                                : "bg-ink-700 text-white"
                            }`}>
                              {editCanBulkApprove ? "⚡ ENABLED — BULK ACCESS GRANTED" : "🔒 DISABLED — INDIVIDUAL ONLY"}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-ink-800 mt-1">
                            {editCanBulkApprove
                              ? "User HAS permission to select multiple claims and bulk approve/reject in 1-click."
                              : "User DOES NOT have bulk approval rights. Access is restricted to single claim review only."}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-md border border-line">
                          <span className={`text-xs font-bold ${editCanBulkApprove ? "text-approved" : "text-ink-500"}`}>
                            {editCanBulkApprove ? "ON" : "OFF"}
                          </span>
                          <Switch
                            checked={editCanBulkApprove}
                            onChange={(checked: boolean) => setEditCanBulkApprove(checked)}
                            checkedChildren="ON"
                            unCheckedChildren="OFF"
                            style={{ backgroundColor: editCanBulkApprove ? "#0F7A4C" : "#6B7280" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserLoading}
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {editUserLoading && <LteSpinner />}
                  <span>Save Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CSV BULK IMPORT ================= */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  Import Employees via CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkUploadModal(false)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div className="text-xs text-ink-600 space-y-1">
                  <p className="font-semibold text-ink-800">Upload a comma-separated values (.csv) file containing employee details.</p>
                  <p className="font-mono text-2xs text-accent-700 bg-accent-50 p-2 rounded border border-accent-100 leading-relaxed">
                    Required Headers: e_code, name, password, role, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, type, date_of_joining, date_of_birth, e_upkaran_id
                  </p>
                  <p className="text-2xs text-rose-600 font-bold">All fields are compulsory for every row.</p>
                </div>

                {/* Upload Input Box */}
                <div className="p-5 border-2 border-dashed border-line bg-surface-sunken rounded-lg text-center space-y-3">
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCSVFileSelect}
                    className="hidden"
                  />
                  <div className="flex justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer font-semibold"
                    >
                      Choose CSV File
                    </button>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template</span>
                    </button>
                  </div>
                  {csvText && (
                    <p className="text-2xs text-approved font-mono truncate max-w-md mx-auto font-bold mt-2">
                      ✓ Loaded CSV ({csvText.split("\n").length - 1} rows)
                    </p>
                  )}
                </div>

                {/* Bulk Results Summary */}
                {bulkResult && (
                  <div className="p-3.5 bg-surface-sunken rounded-lg border border-line max-h-48 overflow-y-auto text-xs space-y-1.5 font-mono">
                    {bulkResult.error && <p className="text-rose-600 font-bold">{bulkResult.error}</p>}
                    {bulkResult.rowErrors?.map((err: string, i: number) => (
                      <p key={i} className="text-rose-600">{err}</p>
                    ))}
                    {bulkResult.status === "success" && (
                      <div className="text-approved font-bold space-y-0.5">
                        <p>Import Status: SUCCESS</p>
                        <p>Created / Updated: {bulkResult.created_count}</p>
                        <p>Failed: {bulkResult.failed_count}</p>
                        {bulkResult.errors?.map((err: string, idx: number) => (
                          <p key={idx} className="text-amber-700 font-normal">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line -mx-5 -mb-5 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBulkUploadModal(false)}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBulkUploadSubmit}
                  disabled={bulkLoading || !csvText}
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {bulkLoading && <LteSpinner />}
                  <span>Start Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CSV BULK HIERARCHY IMPORT ================= */}
      {showBulkHierarchyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  Import Team Hierarchies via CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkHierarchyModal(false)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div className="text-xs text-ink-600 space-y-1">
                  <p className="font-semibold text-ink-800">Upload a comma-separated values (.csv) file containing team hierarchy details.</p>
                  <p className="font-mono text-2xs text-accent-700 bg-accent-50 p-2 rounded border border-accent-100 leading-relaxed">
                    Required Headers: hierarchy_name, requester_e_codes, level_1_approver, level_2_approver, level_3_approver, level_4_approver, level_5_approver
                  </p>
                  <p className="text-2xs text-ink-500 font-medium">
                    Note: Multiple requester employee codes can be separated by commas (e.g. "E001,E002,E003"). Approver fields accept a single employee code.
                  </p>
                </div>

                {/* Upload Input Box */}
                <div className="p-5 border-2 border-dashed border-line bg-surface-sunken rounded-lg text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setHierarchyCsvText(event.target?.result as string || "");
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="hidden"
                    id="hierarchy-file-upload"
                  />
                  <label
                    htmlFor="hierarchy-file-upload"
                    className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer font-semibold inline-flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-accent-600" />
                    <span>Choose CSV File</span>
                  </label>
                </div>

                {/* Raw CSV Text Area */}
                <div className="space-y-1">
                  <label className="label-lte text-2xs block">
                    Or Paste Raw CSV Data:
                  </label>
                  <textarea
                    value={hierarchyCsvText}
                    onChange={(e) => setHierarchyCsvText(e.target.value)}
                    placeholder="hierarchy_name,requester_e_codes,level_1_approver,level_2_approver,level_3_approver,level_4_approver,level_5_approver&#10;Team Rajasthan,E001,E100,E200,E300,,&#10;Team Jodhpur,E002,E100,E200,,,"
                    rows={5}
                    className="input-lte w-full text-xs font-mono p-2.5 resize-y h-auto"
                  />
                </div>

                {/* Bulk Results Summary */}
                {bulkHierarchyResult && (
                  <div className={`p-3.5 rounded-lg border text-xs font-bold font-mono max-h-48 overflow-y-auto ${
                    bulkHierarchyResult.error 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-approved-bg border-approved-border text-approved"
                  }`}>
                    {bulkHierarchyResult.error && <p className="text-rose-700 font-bold mb-1">{bulkHierarchyResult.error}</p>}
                    {bulkHierarchyResult.rowErrors?.map((err: string, i: number) => (
                      <div key={i} className="text-rose-600 text-2xs mt-0.5">{err}</div>
                    ))}
                    {bulkHierarchyResult.errors?.map((err: string, i: number) => (
                      <div key={i} className="text-rose-600 text-2xs mt-0.5">{err}</div>
                    ))}
                    {!bulkHierarchyResult.error && !bulkHierarchyResult.errors && (
                      <p className="text-approved font-bold">Successfully imported and updated all team hierarchies!</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line -mx-5 -mb-5 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBulkHierarchyModal(false)}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBulkHierarchySubmit}
                  disabled={bulkHierarchyLoading || !hierarchyCsvText}
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {bulkHierarchyLoading && <LteSpinner />}
                  <span>Start Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ROLE MAPPING (HIERARCHY CONFIG) ================= */}
      {showHierarchyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Standardized Header */}
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center font-bold border border-accent-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  {editingHierarchy ? "Edit Role Mapping Flow" : "Create New Role Mapping Team"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHierarchyModal(false);
                  setEditingHierarchy(null);
                }}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {hierarchyError && (
                  <div className="p-3 border border-rose-200 bg-rose-50 text-rose-800 font-bold text-xs rounded-lg">
                    {hierarchyError}
                  </div>
                )}

                {/* Hierarchy Team Name Input */}
                <div>
                  <label className="label-lte text-2xs block mb-1">Hierarchy Team Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Bikaner Zone DI Team"
                    value={hierarchyName}
                    onChange={(e) => setHierarchyName(e.target.value)}
                    className="input-lte w-full h-8 text-xs font-bold"
                  />
                </div>

                {/* Requester User Chips List */}
                <div className="space-y-1.5">
                  <label className="label-lte text-2xs block">Mapped Requesters (Employees)</label>
                  
                  <div className="min-h-[46px] max-h-36 overflow-y-auto p-2 bg-surface-sunken border border-line rounded-lg flex flex-wrap gap-1.5 items-center">
                    {selectedRequesterIds.length === 0 ? (
                      <span className="text-2xs text-ink-400 font-semibold select-none pl-1">
                        No employees mapped as requesters
                      </span>
                    ) : (
                      selectedRequesterIds.map((rid) => {
                        const u = safeUsers.find(userObj => userObj.id === rid);
                        return (
                          <span 
                            key={rid} 
                            className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md bg-surface text-ink-800 text-xs font-bold border border-line font-mono shadow-none"
                          >
                            {u ? `${u.name} (${u.user_id})` : `User ID ${rid}`}
                            <button
                              type="button"
                              onClick={() => handleRemoveRequesterChip(rid)}
                              className="h-4 w-4 rounded flex items-center justify-center hover:bg-rose-50 text-ink-400 hover:text-rose-600 font-bold transition-all text-xs cursor-pointer border-0 p-0 leading-none bg-transparent"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown to add requesters */}
                  <select
                    value=""
                    onChange={(e) => {
                      handleAddRequesterChip(e.target.value);
                      e.target.value = "";
                    }}
                    className="input-lte w-full h-8 text-xs font-semibold cursor-pointer py-0.5 px-2"
                  >
                    <option value="" disabled>-- Select an employee to add as requester --</option>
                    {getEligibleRequesters().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.user_id}) | {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Approver Sequence Table */}
                <div className="space-y-2 pt-2 border-t border-line">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold text-ink-700 uppercase tracking-wider">
                      Level-by-Level Approver Flow
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddApproverRow}
                        className="btn-lte-secondary text-xs h-7 px-2.5 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-accent-600" />
                        <span>Add Level</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCheckedRows}
                        className="btn-lte-danger text-xs h-7 px-2.5 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected</span>
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-line rounded-lg overflow-hidden shadow-none">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-surface-sunken text-ink-500 border-b border-line font-bold text-2xs uppercase tracking-wider">
                          <th className="py-2.5 px-3 w-12 text-center">SELECT</th>
                          <th className="py-2.5 px-3 w-28">LEVEL</th>
                          <th className="py-2.5 px-3">APPROVER</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-surface">
                        {approverRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-ink-400 uppercase tracking-wider text-2xs font-bold">
                              No levels configured. Click 'Add Level' to add an approval step.
                            </td>
                          </tr>
                        ) : (
                          approverRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-surface-sunken transition-colors">
                              {/* Checkbox */}
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.checked}
                                  onChange={() => handleRowCheckboxToggle(idx)}
                                  className="rounded border-line text-accent-600 focus:ring-accent-600 h-4 w-4 cursor-pointer"
                                />
                              </td>
                              {/* Rel Level Number */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  value={row.level}
                                  onChange={(e) => handleRowLevelChange(idx, e.target.value)}
                                  className="input-lte w-16 h-7.5 text-xs font-mono font-bold text-center"
                                />
                              </td>
                              {/* Approvers select list */}
                              <td className="py-2 px-3">
                                <select
                                  value={row.approverId}
                                  onChange={(e) => handleRowApproverChange(idx, e.target.value)}
                                  className="input-lte w-full max-w-md h-7.5 text-xs font-semibold cursor-pointer py-0.5 px-2"
                                >
                                  <option value="">-- Select level approver --</option>
                                  {getUsersByRole(["Manager", "Zonal Manager", "Coordinator", "VP", "Project Head", "MIS", "Admin"]).map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.user_id}) | {u.role}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line -mx-5 -mb-5 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowHierarchyModal(false);
                    setEditingHierarchy(null);
                  }}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveHierarchySubmit}
                  disabled={hierarchyLoading}
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {hierarchyLoading && <LteSpinner />}
                  <span>Save Mapping</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: UNLOCK SENSITIVE FIELDS ================= */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="bg-surface border border-line rounded-xl shadow-md w-full max-w-md overflow-hidden animate-scale-up flex flex-col">
            <div className="bg-surface border-b border-line px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold border border-amber-200">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-ink-900 m-0">
                  Enter Admin Security Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockPassword("");
                }}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-sunken transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUnlockSensitiveSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 space-y-3">
                <p className="text-xs text-ink-600 font-medium m-0">
                  Editing sensitive employee credentials (User ID, Employee Code, or Password) requires authorization.
                </p>
                <div>
                  <label className="label-lte text-2xs block mb-1">
                    Admin Security Password *
                  </label>
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    className="input-lte w-full h-9 text-xs font-bold"
                    placeholder="Enter security password to unlock fields"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Sunken Footer */}
              <div className="bg-surface-sunken border-t border-line px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockPassword("");
                  }}
                  className="btn-lte-secondary text-xs h-8 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-lte-primary text-xs h-8 px-4 cursor-pointer font-bold"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Approval Level Modal */}
      <ResetApprovalLevelModal
        isOpen={resetModalState.isOpen}
        onClose={() => setResetModalState({ isOpen: false, expenseId: 0, expenseCode: "" })}
        expenseId={resetModalState.expenseId}
        expenseCode={resetModalState.expenseCode}
        onSuccess={() => {}}
      />
    </>
  );
}
