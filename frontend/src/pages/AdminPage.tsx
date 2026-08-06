import React, { useEffect, useState, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { adminService, UserCreatePayload, UserEditPayload, ApprovalHierarchyResponse } from "../services/adminService";
import { authService } from "../services/authService";
import { formatToIST } from "../utils/timezone";

import { UploadCloud, Pencil, Trash2, Plus, Download, Zap } from "lucide-react";
import { 
  Table, 
  Popconfirm, 
  Alert, 
  Spin, 
  InputNumber,
  Switch
} from "antd";
import { SaaSDonutChart } from "../components/common/SaaSCharts";

import { 
  PlusOutlined, 
  EditOutlined, 
  LogoutOutlined, 
  ControlOutlined,
  FileExcelOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SettingOutlined,
  BarChartOutlined,
  PieChartOutlined,
  ReloadOutlined
} from "@ant-design/icons";

const LteSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-blue-600 inline-block mr-1.5 shrink-0"></span>
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
        className="w-full flex items-center justify-between input-lte text-left cursor-pointer bg-white min-h-[38px] px-3 py-1.5 border border-gray-300 rounded shadow-sm focus:outline-none"
      >
        <span className="block truncate text-xs font-semibold text-gray-700">
          {cleanSelected.length > 0 ? cleanSelected.join(", ") : placeholder}
        </span>
        <span className="ml-2 flex items-center pointer-events-none text-gray-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-y-auto py-1 text-xs">
          {cleanOptions.map((opt) => (
            <label
              key={opt}
              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer select-none text-gray-700 font-medium"
            >
              <input
                type="checkbox"
                checked={cleanSelected.includes(opt)}
                onChange={() => handleToggle(opt)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mr-2"
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

const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

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
  { id: "asset_upload", name: "Asset Inventory" },
  { id: "penalty_report", name: "Penalty Report" },
  { id: "consolidated_report", name: "Consolidated Report" },
  { id: "help", name: "Help Center" },
  { id: "profile", name: "Profile" }
];

export default function AdminPage() {
  const [adminUserPageSize, setAdminUserPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState<"users" | "approvals" | "analytics" | "settings">((() => {
    return (localStorage.getItem("admin_active_tab") as "users" | "approvals" | "analytics" | "settings") || "users";
  }));

  const handleTabChange = (tab: "users" | "approvals" | "analytics" | "settings") => {
    setActiveTab(tab);
    localStorage.setItem("admin_active_tab", tab);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (tab === "settings") {
      fetchRejectedClaims("");
      fetchAllowanceRates();
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

  // Rejected claims state
  const [rejectedSearch, setRejectedSearch] = useState("");
  const [rejectedClaims, setRejectedClaims] = useState<any[]>([]);
  const [loadingRejected, setLoadingRejected] = useState(false);
  const [actioningClaimId, setActioningClaimId] = useState<number | null>(null);

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



  // No auto-population of allowedWindows by role. By default no window is mapped unless explicitly checked.

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
      const [u, dd, hqs, settingsRes] = await Promise.all([
        adminService.getUsers(),
        authService.getDropdowns(),
        adminService.getHierarchies(),
        adminService.getSettings()
      ]);
      setUsers(u);
      localStorage.setItem("cache_admin_users", JSON.stringify(u));

      if (settingsRes && settingsRes.success) {
        setSettings(settingsRes.settings);
      }
      
      setDropdowns(dd);
      localStorage.setItem("cache_dropdowns", JSON.stringify(dd));
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
      localStorage.setItem("cache_hierarchies", JSON.stringify(hqs));
    } catch (err: any) {
      if (!cachedUsers) {
        setError(getErrorMessage(err, "Failed to retrieve configuration details from database."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      await adminService.saveSettings(settings);
      alert("System Settings saved successfully!");
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to save system settings."));
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchRejectedClaims = async (queryStr = "") => {
    setLoadingRejected(true);
    try {
      const res = await adminService.searchRejectedExpenses(queryStr);
      if (res && res.success) {
        setRejectedClaims(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load rejected claims", err);
    } finally {
      setLoadingRejected(false);
    }
  };

  const handleResubmitClaim = async (claimId: number) => {
    if (!confirm("Are you sure you want to reset the status of this claim to Submitted? This will route it back to Level 1 approval.")) {
      return;
    }
    setActioningClaimId(claimId);
    try {
      const res = await adminService.resubmitRejectedExpense(claimId);
      if (res && res.success) {
        alert(res.message || "Claim status reset to Submitted successfully.");
        // Reload list
        fetchRejectedClaims(rejectedSearch);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || "Failed to reset claim status.");
    } finally {
      setActioningClaimId(null);
    }
  };

  // Filter eligible managers, zonal managers, and coordinators dynamically from the database users
  const getEligibleManagers = () => {
    return users;
  };

  const getEligibleZonalManagers = () => {
    return users;
  };

  const getEligibleCoordinators = () => {
    return users;
  };

  // Handle Zone Change to update District
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
    if (!window.confirm("Are you sure you want to force logout ALL users in the system? They will be logged out instantly on their next action.")) return;
    try {
      await adminService.logoutAllUsers();
      toast.success("All active user sessions have been invalidated successfully.");
    } catch (err: any) {
      toast.error("Failed to force logout all users.");
    }
  };

  const handleForceLogoutSingle = async (userCode: string, name: string) => {
    if (!window.confirm(`Are you sure you want to force logout user '${name}' (${userCode})?`)) return;
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

  // CSV parser for compulsory fields
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
    if (!window.confirm("Are you sure you want to delete this approval hierarchy team configuration?")) return;
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

  const availableUserZones = useMemo(() => {
    const zones = new Set<string>();
    safeUsers.forEach(u => {
      if (u.zone && u.zone.trim() && u.zone.trim().toLowerCase() !== "all") {
        zones.add(u.zone.trim());
      }
    });
    return Array.from(zones).sort();
  }, [safeUsers]);

  const availableUserDistricts = useMemo(() => {
    const districts = new Set<string>();
    safeUsers.forEach(u => {
      if (userZoneFilter !== "all" && (u.zone || "").trim().toLowerCase() !== userZoneFilter.trim().toLowerCase()) {
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

  const filteredUsers = useMemo(() => {
    return safeUsers.filter(u => {
      if (userZoneFilter !== "all" && (u.zone || "").trim().toLowerCase() !== userZoneFilter.trim().toLowerCase()) return false;
      if (userDistrictFilter !== "all" && (u.district || "").trim().toLowerCase() !== userDistrictFilter.trim().toLowerCase()) return false;
      if (userManagerFilter !== "all" && (u.manager || "").trim().toLowerCase() !== userManagerFilter.trim().toLowerCase() && (u.zonal_manager || "").trim().toLowerCase() !== userManagerFilter.trim().toLowerCase()) return false;
      if (userRoleFilter !== "all" && (u.role || "").trim().toLowerCase() !== userRoleFilter.trim().toLowerCase()) return false;
      if (userStatusFilter !== "all" && (u.user_status || "active").trim().toLowerCase() !== userStatusFilter.trim().toLowerCase()) return false;
      if (userSearchTerm.trim()) {
        const q = userSearchTerm.trim().toLowerCase();
        const nameMatch = (u.name || "").toLowerCase().includes(q);
        const codeMatch = (u.user_id || u.e_code || "").toLowerCase().includes(q);
        const mobileMatch = (u.mobile_number || "").toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !mobileMatch) return false;
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



  // Helper to filter users for charts
  const getFilteredUsersForCharts = () => {
    return safeUsers.filter(u => {
      if (chartRoleFilter !== "all" && u.role?.toLowerCase() !== chartRoleFilter.toLowerCase()) return false;
      if (chartZoneFilter !== "all" && u.zone?.toLowerCase() !== chartZoneFilter.toLowerCase()) return false;
      if (chartDistrictFilter !== "all" && u.district?.toLowerCase() !== chartDistrictFilter.toLowerCase()) return false;
      return true;
    });
  };

  // Districts available for the currently selected zone (for the filter dropdown)
  const chartZoneDistricts = Array.from(
    new Set(safeUsers
      .filter(u => chartZoneFilter === "all" || u.zone?.trim().toLowerCase() === chartZoneFilter.toLowerCase())
      .map(u => u.district?.trim()).filter(Boolean))
  ).sort((a, b) => a!.localeCompare(b!));

  // Helper to group long distribution lists into Top N + "Others" to prevent label overlapping
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

  // 1. Calculate District-wise distribution
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

  // 2. Calculate Designation-wise distribution
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

  // 3. Calculate Zone-wise distribution
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

  // 4. Calculate Manager-wise distribution
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

  return (
    <>
      <div className="space-y-4 text-[#212529] animate-fadeIn p-2 sm:p-4 pb-32 sm:pb-24 lg:pb-8 max-w-[1600px] mx-auto min-h-screen font-sans">
        
        {/* Compact Actionable Governance Quick Metrics & Controls Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          
          {/* Card 1: Total & Active Roster */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-sm transition-all">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block leading-none">Total Employees</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm sm:text-base font-mono font-black text-slate-900 leading-none">{users.length}</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {users.filter(u => u.user_status === 'active' || !u.user_status).length} Active
                </span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <UserOutlined className="text-xs" />
            </div>
          </div>

          {/* Card 2: Field vs Office Staff */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-sm transition-all">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block leading-none">Role Breakdown</span>
              <div className="flex items-center gap-1 mt-1 text-[10.5px] font-extrabold font-mono text-slate-800">
                <span className="text-emerald-700 bg-emerald-50 px-1 rounded">{users.filter(u => u.role?.toLowerCase().includes('engineer')).length} Eng</span>
                <span>·</span>
                <span className="text-cyan-700 bg-cyan-50 px-1 rounded">{users.filter(u => u.role?.toLowerCase().includes('manager')).length} Mng</span>
                <span>·</span>
                <span className="text-amber-700 bg-amber-50 px-1 rounded">{users.filter(u => u.role?.toLowerCase().includes('admin')).length} Adm</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <TeamOutlined className="text-xs" />
            </div>
          </div>

          {/* Card 3: Regional Coverage */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-sm transition-all">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block leading-none">Regional Matrix</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs sm:text-sm font-mono font-black text-slate-900 leading-none">{availableUserZones.length} Zones</span>
                <span className="text-[10px] text-slate-500 font-bold">({availableUserDistricts.length} Districts)</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
              <DatabaseOutlined className="text-xs" />
            </div>
          </div>

          {/* Card 4: Unmapped Routing Audit & Quick Sync */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-sm transition-all">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block leading-none">Hierarchy Rules</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs sm:text-sm font-mono font-black text-slate-900 leading-none">{hierarchies.length} Mapped</span>
                {users.filter(u => !u.manager || u.manager === 'N/A').length > 0 && (
                  <span className="text-[8.5px] font-extrabold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                    {users.filter(u => !u.manager || u.manager === 'N/A').length} Pending
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchInitialData();
                toast.success("Refreshed Governance Data!");
              }}
              className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold shrink-0 cursor-pointer border-0 shadow-2xs transition-all active:scale-95"
              title="Sync D1 Database"
            >
              <ReloadOutlined className="text-xs text-white" />
            </button>
          </div>

        </div>

        {/* Enterprise Ultra-Compact Segmented Tab Switcher Bar */}
        <div className="bg-slate-200/70 p-1 rounded-xl flex flex-wrap sm:flex-nowrap gap-1 border border-slate-300/60 shadow-inner">
          <button
            type="button"
            onClick={() => handleTabChange("users")}
            className={`flex-1 py-1.5 px-2.5 text-[11px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "users"
                ? "bg-white text-[#1e3a8a] shadow-xs scale-[1.01]"
                : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <TeamOutlined className="text-xs" />
            <span>Users Directory ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("approvals")}
            className={`flex-1 py-1.5 px-2.5 text-[11px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "approvals"
                ? "bg-white text-[#1e3a8a] shadow-xs scale-[1.01]"
                : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <SafetyCertificateOutlined className="text-xs" />
            <span>Role Mappings ({hierarchies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("analytics")}
            className={`flex-1 py-1.5 px-2.5 text-[11px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "analytics"
                ? "bg-white text-[#1e3a8a] shadow-xs scale-[1.01]"
                : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <BarChartOutlined className="text-xs" />
            <span>Dashboard Charts</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("settings")}
            className={`flex-1 py-1.5 px-2.5 text-[11px] font-black uppercase tracking-wider border-0 cursor-pointer transition-all rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-white text-[#1e3a8a] shadow-xs scale-[1.01]"
                : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <SettingOutlined className="text-xs" />
            <span>System Settings</span>
          </button>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon className="rounded-xl font-bold" />
        )}

        {activeTab === "users" ? (
          /* ================= USERS LIST TAB ================= */
          <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
            {/* Ultra-Compact High-Density Filters & Actions Bar */}
            <div className="p-2 sm:p-2.5 border-b border-slate-200/90 bg-slate-50/90 space-y-2">
              {/* Row 1: High-Density Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                {/* Search Input */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Search</span>
                  <input
                    type="text"
                    placeholder="Name, Code, Mobile..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full px-2 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7 leading-none"
                  />
                </div>

                {/* Zone Filter */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Zone</span>
                  <select
                    value={userZoneFilter}
                    onChange={(e) => {
                      setUserZoneFilter(e.target.value);
                      setUserDistrictFilter("all");
                    }}
                    className="w-full px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none cursor-pointer shadow-2xs h-7 leading-none"
                  >
                    <option value="all">All Zones ({availableUserZones.length})</option>
                    {availableUserZones.map((z: string) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                {/* District Filter */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">District</span>
                  <select
                    value={userDistrictFilter}
                    onChange={(e) => setUserDistrictFilter(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none cursor-pointer shadow-2xs h-7 leading-none"
                  >
                    <option value="all">All Districts ({availableUserDistricts.length})</option>
                    {availableUserDistricts.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Manager Filter */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Manager</span>
                  <select
                    value={userManagerFilter}
                    onChange={(e) => setUserManagerFilter(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none cursor-pointer shadow-2xs h-7 leading-none"
                  >
                    <option value="all">All Managers ({availableUserManagers.length})</option>
                    {availableUserManagers.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Role Filter */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Role</span>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none cursor-pointer shadow-2xs h-7 leading-none"
                  >
                    <option value="all">All Roles ({availableUserRoles.length})</option>
                    {availableUserRoles.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter & Reset */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 leading-none">Status</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none cursor-pointer shadow-2xs h-7 leading-none"
                    >
                      <option value="all">All Status</option>
                      {availableUserStatuses.map((st: string) => (
                        <option key={st} value={st}>{st.toUpperCase()}</option>
                      ))}
                    </select>
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
                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-extrabold uppercase rounded-lg border border-slate-300 h-7 cursor-pointer transition-colors shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Actions & Count Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80">
                <div className="text-[10.5px] font-mono font-extrabold text-slate-600">
                  Showing <span className="text-blue-700">{filteredUsers.length}</span> of {safeUsers.length} Employees
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={handleExportUsersExcel}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg border-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-all h-7"
                  >
                    <FileExcelOutlined className="text-xs" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={() => {
                      setSingleUserError(null);
                      setShowSingleUserModal(true);
                    }}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg border-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-all h-7"
                  >
                    <PlusOutlined className="text-xs" />
                    <span>+ Single User</span>
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
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg border-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-all h-7"
                    >
                      <LogoutOutlined className="text-xs" />
                      <span>Force Logout All</span>
                    </button>
                  </Popconfirm>
                </div>
              </div>
            </div>

          {/* Ant Design Table Container */}
          <div className="p-3">
            {selectedUserIds.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 flex flex-wrap items-center justify-between gap-2 animate-fadeIn mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-600 text-white font-extrabold text-xs px-2 py-0.5 font-mono">
                    {selectedUserIds.length} SELECTED
                  </span>
                  <span className="text-xs font-bold text-slate-700">Batch Bulk Approval Actions:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBatchToggleBulkApproval(true)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  >
                    <span>⚡ Grant Bulk Approval Access</span>
                  </button>
                  <button
                    onClick={() => handleBatchToggleBulkApproval(false)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  >
                    <span>🔒 Revoke Bulk Approval Access</span>
                  </button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center bg-white border border-slate-300 rounded-none">
                <Spin size="large" tip="Loading system employees database..." />
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
                    render: (code: string) => (
                      <span className="bg-slate-100 text-slate-800 font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border border-slate-200/90 shadow-2xs">
                        {code || "—"}
                      </span>
                    )
                  },
                  {
                    title: "FULL NAME",
                    dataIndex: "name",
                    key: "name",
                    render: (name: string, record: any) => (
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight">{name}</div>
                        <div className="text-[10px] font-extrabold text-slate-500 bg-slate-100/80 px-1.5 py-0.2 rounded w-fit mt-0.5 border border-slate-200/60 leading-none">
                          {record.designation || "Engineer"}
                        </div>
                      </div>
                    )
                  },
                  {
                    title: "ROLE",
                    dataIndex: "role",
                    key: "role",
                    render: (roleStr: string) => {
                      const r = (roleStr || "").toLowerCase();
                      let style = "bg-slate-100 text-slate-700 border-slate-200";
                      if (r.includes("engineer")) style = "bg-teal-50 text-teal-700 border-teal-200";
                      else if (r.includes("manager") || r.includes("zm")) style = "bg-blue-50 text-blue-700 border-blue-200";
                      else if (r.includes("admin") || r.includes("mis")) style = "bg-amber-50 text-amber-700 border-amber-200";
                      else if (r.includes("coordinator")) style = "bg-purple-50 text-purple-700 border-purple-200";

                      return (
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border ${style}`}>
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
                        <div className="font-extrabold text-slate-800 font-mono text-[11.5px]">{record.mobile_number || "—"}</div>
                        <div className="text-slate-400 font-mono text-[10px] truncate max-w-[170px]">{record.mail_id || "—"}</div>
                      </div>
                    )
                  },
                  {
                    title: "DISTRICT / ZONE",
                    key: "location",
                    render: (_: any, record: any) => (
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-slate-900 text-xs leading-tight">{record.district || "—"}</div>
                        <span className="inline-block px-1.5 py-0.2 text-[8.5px] font-extrabold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 leading-none">
                          {record.zone || "NO ZONE"}
                        </span>
                      </div>
                    )
                  },
                  {
                    title: "STATUS",
                    dataIndex: "user_status",
                    key: "user_status",
                    render: (status: string) => {
                      const st = (status || "active").toLowerCase();
                      if (st === "active") {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> ACTIVE
                          </span>
                        );
                      }
                      if (st === "locked") {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> LOCKED
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider rounded-full bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> INACTIVE
                        </span>
                      );
                    }
                  },
                  {
                    title: "ACTIONS",
                    key: "actions",
                    align: "right",
                    render: (_: any, record: any) => (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditUserModal(record)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
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
                          okButtonProps={{ danger: true }}
                        >
                          <button
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
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
      ) : activeTab === "analytics" ? (
        /* ================= ANALYTICS DASHBOARD TAB ================= */
        <div className="space-y-4 animate-fadeIn">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-300 rounded-none p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider m-0">Dashboard Charts &amp; Analytics</h3>
              <p className="text-slate-500 text-[10px] mt-0.5 font-bold">Interactive distribution charts with real-time zone &amp; role filtering.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-600">Role:</label>
                <select
                  value={chartRoleFilter}
                  onChange={(e) => setChartRoleFilter(e.target.value)}
                  className="px-2 py-1 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none cursor-pointer h-8"
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
                <label className="text-[10px] font-extrabold uppercase text-slate-600">Zone:</label>
                <select
                  value={chartZoneFilter}
                  onChange={(e) => { setChartZoneFilter(e.target.value); setChartDistrictFilter("all"); }}
                  className="px-2 py-1 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none cursor-pointer h-8"
                >
                  <option value="all">All Zones</option>
                  {Array.from(new Set(safeUsers.map(u => u.zone?.trim()).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)).map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              {/* District Filter (dependent on Zone) */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-600">District:</label>
                <select
                  value={chartDistrictFilter}
                  onChange={(e) => setChartDistrictFilter(e.target.value)}
                  disabled={chartZoneFilter === "all"}
                  className={`px-2 py-1 text-xs font-extrabold bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none h-8 ${
                    chartZoneFilter === "all" ? "text-slate-400 cursor-not-allowed opacity-60" : "text-slate-900 cursor-pointer"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Zone-wise Donut Chart (Analysis Page Style) */}
            <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  ZONE DISTRIBUTION
                </span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 font-bold">
                  {getZoneData().reduce((s, x) => s + x.value, 0)} Total
                </span>
              </div>
              <div className="p-3 flex flex-col justify-between" style={{ minHeight: 310 }}>
                <SaaSDonutChart
                  data={getZoneData().map((z, i) => ({
                    name: z.name,
                    value: z.value,
                    count: z.value,
                    color: GALLERY_COLORS[i % GALLERY_COLORS.length]
                  }))}
                  height={290}
                  centerTitle="Total Users"
                  valueFormatter={(v) => `${v.toLocaleString()} Users`}
                />
              </div>
            </div>

            {/* District-wise Donut Chart (Analysis Page Style) */}
            <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  DISTRICT DISTRIBUTION
                </span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 font-bold">
                  {getDistrictData().reduce((s, x) => s + x.value, 0)} Total
                </span>
              </div>
              <div className="p-3 flex flex-col justify-between" style={{ minHeight: 310 }}>
                <SaaSDonutChart
                  data={getDistrictData().map((d, i) => ({
                    name: d.name,
                    value: d.value,
                    count: d.value,
                    color: GALLERY_COLORS[i % GALLERY_COLORS.length]
                  }))}
                  height={290}
                  centerTitle="Total Users"
                  valueFormatter={(v) => `${v.toLocaleString()} Users`}
                />
              </div>
            </div>

            {/* Manager-wise Donut Chart (Analysis Page Style) */}
            <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  MANAGER DISTRIBUTION
                </span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 font-bold">
                  {getManagerData().reduce((s, x) => s + x.value, 0)} Total
                </span>
              </div>
              <div className="p-3 flex flex-col justify-between" style={{ minHeight: 310 }}>
                <SaaSDonutChart
                  data={getManagerData().map((m, i) => ({
                    name: m.name,
                    value: m.value,
                    count: m.value,
                    color: GALLERY_COLORS[i % GALLERY_COLORS.length]
                  }))}
                  height={290}
                  centerTitle="Total Users"
                  valueFormatter={(v) => `${v.toLocaleString()} Users`}
                />
              </div>
            </div>

            {/* Designation-wise Donut Chart (Analysis Page Style) */}
            <div className="bg-white border border-slate-300 rounded-none shadow-2xs overflow-hidden">
              <div className="bg-[#4A6A8A] text-white px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2">
                  <PieChartOutlined style={{ fontSize: 13 }} />
                  DESIGNATION DISTRIBUTION
                </span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 font-bold">
                  {getDesignationData().reduce((s, x) => s + x.value, 0)} Total
                </span>
              </div>
              <div className="p-3 flex flex-col justify-between" style={{ minHeight: 310 }}>
                <SaaSDonutChart
                  data={getDesignationData().map((d, i) => ({
                    name: d.name,
                    value: d.value,
                    count: d.value,
                    color: GALLERY_COLORS[i % GALLERY_COLORS.length]
                  }))}
                  height={290}
                  centerTitle="Total Users"
                  valueFormatter={(v) => `${v.toLocaleString()} Users`}
                />
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "approvals" ? (
        /* ================= ROLE MAPPINGS TAB ================= */
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3 shadow-2xs gap-2">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider leading-none m-0">Team Hierarchy Mappings</h3>
              <p className="text-slate-500 text-[10px] mt-0.5 font-semibold leading-none">Add approval groups with named requesters and level-by-level approvers flow.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={handleExportHierarchies}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider rounded-lg border border-slate-200 cursor-pointer transition-all flex items-center gap-1 h-7"
                title="Export all team hierarchies to CSV"
              >
                <Download className="w-3 h-3 text-[#4A6A8A]" />
                Export CSV
              </button>
              <button
                onClick={() => handleOpenHierarchyModal()}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-lg border-0 cursor-pointer shadow-2xs transition-all flex items-center gap-1 h-7"
              >
                + Create Team
              </button>
            </div>
          </div>

          {safeHierarchies.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 text-center text-xs uppercase tracking-wider text-slate-400 font-extrabold shadow-2xs">
              No team hierarchy configurations created. Click "+ Create Team" to define one.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {safeHierarchies.map((hq) => (
                <div key={hq.id} className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs hover:shadow-sm transition-all space-y-2">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-xs sm:text-sm m-0 uppercase tracking-wide">{hq.name}</h4>
                      <span className="text-[9.5px] text-blue-700 bg-blue-50 px-2 py-0.2 rounded-full font-bold font-mono border border-blue-200">
                        {hq.approvers.length} Levels Approval Sequence
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenHierarchyModal(hq)}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                        title="Edit Mappings"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHierarchy(hq.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Requesters Box */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Mapped Requesters ({hq.requesters.length}):</span>
                    {hq.requesters.length === 0 ? (
                      <span className="text-[10px] text-slate-400 font-semibold italic">No employees mapped</span>
                    ) : (
                      hq.requesters.map((r) => (
                        <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-extrabold font-mono border border-slate-200/90">
                          {r.user_name} <span className="text-slate-400 ml-1">({r.user_code})</span>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Approvers Pipeline Flow */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1.5 border-t border-slate-100">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Approval Sequence:</span>
                    {hq.approvers.length === 0 ? (
                      <span className="text-[10px] text-slate-400 font-semibold italic">No approvers mapped</span>
                    ) : (
                      hq.approvers.map((a, idx) => (
                        <React.Fragment key={a.id}>
                          {idx > 0 && <span className="text-slate-300 font-bold px-0.5 select-none font-mono">→</span>}
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-0.5 shadow-2xs">
                            <span className="h-4.5 px-1.5 rounded bg-blue-600 text-white flex items-center justify-center text-[9.5px] font-mono font-black">
                              L{a.level_number}
                            </span>
                            <div className="text-[11px] font-extrabold text-slate-800 leading-none">
                              {a.approver_name} <span className="text-[9.5px] text-slate-500 font-normal">({a.approver_code})</span>
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
      ) : (
        /* ================= SYSTEM SETTINGS TAB ================= */
        <div className="space-y-4 animate-fadeIn max-w-5xl">
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs p-3.5 space-y-3">
            <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-900 m-0 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <ControlOutlined className="text-blue-600" /> Global System Settings &amp; Policies
                </h2>
                <p className="text-slate-500 text-[10px] mt-0.5 font-semibold leading-none">
                  Configure global expense submission windows, monthly cutoff dates, auto-approval rules, and grade allowance rates.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3">
              
              {/* Section 1: Expense Submission Policies */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/90 space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-700 block border-b border-slate-200 pb-1 font-mono leading-none">
                  1. Expense Submission Window &amp; Cutoff Policies
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Allowed Past Days Submission Window *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={settings.max_past_days_limit || "15"}
                      onChange={(e) => setSettings({ ...settings, max_past_days_limit: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5"
                      placeholder="e.g. 15"
                    />
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      Past calendar days allowed for engineers to log claims.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Monthly Cutoff Day (of next month) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      required
                      value={settings.monthly_cutoff_day || "3"}
                      onChange={(e) => setSettings({ ...settings, monthly_cutoff_day: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5"
                      placeholder="e.g. 3"
                    />
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      Day of month after which previous month claims are blocked.
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Auto-Expiry & Approval System Rules */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/90 space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-700 block border-b border-slate-200 pb-1 font-mono leading-none">
                  2. Auto-Approval / Expiry Rules &amp; Routing Levels
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Pending Days Threshold *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={settings.pending_auto_expiry_days || "5"}
                      onChange={(e) => setSettings({ ...settings, pending_auto_expiry_days: e.target.value })}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5"
                      placeholder="e.g. 5"
                    />
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      Days pending before system auto-action triggers (0 = disabled).
                    </span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Auto-Expiry Action Type *
                    </label>
                    <select
                      value={settings.pending_auto_action || "approve"}
                      onChange={(e) => setSettings({ ...settings, pending_auto_action: e.target.value })}
                      className="w-full px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5 cursor-pointer"
                    >
                      <option value="approve">⚡ Auto Approve Current Level</option>
                      <option value="reject">❌ Auto Reject Claim</option>
                      <option value="disabled">🚫 Disabled (Manual Action Only)</option>
                    </select>
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      System behavior when threshold days are reached without manager action.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Auto-Approve Target Routing Level
                    </label>
                    <select
                      value={settings.auto_approve_target_level || "next_level"}
                      onChange={(e) => setSettings({ ...settings, auto_approve_target_level: e.target.value })}
                      className="w-full px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5 cursor-pointer"
                    >
                      <option value="next_level">⏩ Forward to Next Manager Level (L1 → L2)</option>
                      <option value="l1_only">1️⃣ Auto-Approve L1 Only</option>
                      <option value="full_final">✅ Complete Final Auto-Approval (All Levels)</option>
                    </select>
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      Target destination level when auto-approved.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                      Rejection Fallback Routing Level
                    </label>
                    <select
                      value={settings.rejection_fallback_level || "creator"}
                      onChange={(e) => setSettings({ ...settings, rejection_fallback_level: e.target.value })}
                      className="w-full px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5 cursor-pointer"
                    >
                      <option value="creator">↩️ Return to Submitter / Drafts (For Edit &amp; Re-submit)</option>
                      <option value="previous_level">◀️ Return to Previous Manager Level</option>
                      <option value="final_reject">🛑 Permanent Rejection (Closed)</option>
                    </select>
                    <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 block leading-tight">
                      Target destination when a claim is rejected.
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Allowance Master TA/DA Rates & Hotel Caps */}
              <div className="bg-slate-50 p-3 rounded-none border border-slate-300 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#4A6A8A] block font-mono">
                    3. Allowance Master — TA / DA Rates &amp; Hotel Caps
                  </span>
                  <button
                    type="button"
                    disabled={savingRates}
                    onClick={handleSaveAllowanceRates}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors disabled:opacity-60"
                  >
                    {savingRates ? "Saving..." : "Save Allowance Rates"}
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-none">
                  <Table
                    dataSource={allowanceRates}
                    rowKey="id"
                    loading={loadingRates}
                    pagination={false}
                    size="small"
                    className="ant-table-sharp"
                    columns={[
                      {
                        title: "GRADE / LEVEL",
                        key: "grade_level",
                        render: (_: any, r: any) => (
                          <div className="space-y-0.5">
                            <span className="px-1.5 py-0.5 bg-[#4A6A8A]/10 text-[#4A6A8A] border border-[#4A6A8A]/20 font-extrabold text-[10px] uppercase rounded-none inline-block font-mono">
                              {r.grade ? `Grade ${r.grade}` : (r.level || "—")}
                            </span>
                            <div className="text-[10px] text-slate-500 font-extrabold">{r.category || ""}</div>
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
                            className="px-2 py-1 text-xs font-extrabold border border-slate-300 rounded-none bg-white text-slate-900 cursor-pointer h-8"
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
                            className="w-20 font-mono font-bold text-xs rounded-none border-slate-300"
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
                            className="w-20 font-mono font-bold text-xs rounded-none border-slate-300"
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
                            className="w-20 font-mono font-bold text-xs rounded-none border-slate-300"
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
                            className="w-20 font-mono font-bold text-xs rounded-none border-slate-300"
                          />
                        )
                      },
                      {
                        title: "HOTEL CAP IN-STATE S/D (₹)",
                        key: "hotel_in_state",
                        render: (_: any, r: any, idx: number) => (
                          <div className="flex gap-1">
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
                              className="w-16 font-mono font-bold text-xs rounded-none border-slate-300"
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
                              className="w-16 font-mono font-bold text-xs rounded-none border-slate-300"
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
                            className="w-20 font-mono font-bold text-xs rounded-none border-slate-300"
                          />
                        )
                      }
                    ]}
                  />
                </div>
              </div>

              {/* Modern Enterprise Submit Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/90 mt-4">
                <span className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Settings Auto-Applied Globally Across All Workflows
                </span>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs uppercase tracking-wider rounded-xl py-2.5 px-6 shadow-md hover:shadow-lg transition-all active:scale-95 border border-blue-400/30 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>{savingSettings ? "Saving Settings..." : "Save System Settings"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Override Rejected Claims Panel */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs p-3 space-y-2.5">
            <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider m-0 flex items-center gap-1.5 font-mono">
                  <span className="text-rose-600">↩</span> Override / Re-submit Rejected Claims
                </h3>
                <p className="text-slate-500 text-[10px] mt-0.5 font-semibold leading-none">
                  Reset rejected claims back to 'Submitted' and re-initialize approval routing from L1.
                </p>
              </div>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={rejectedSearch}
                onChange={(e) => setRejectedSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    fetchRejectedClaims(rejectedSearch);
                  }
                }}
                className="flex-1 px-2.5 py-1 text-xs font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-2xs h-7.5"
                placeholder="Search by Claim Code, Employee Code, or Name..."
              />
              <button
                type="button"
                onClick={() => fetchRejectedClaims(rejectedSearch)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[11px] font-extrabold uppercase tracking-wider cursor-pointer border-0 shadow-2xs h-7.5 transition-all"
              >
                Search
              </button>
            </div>

            {loadingRejected ? (
              <div className="text-center py-4 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                Loading rejected claims...
              </div>
            ) : rejectedClaims.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 rounded-lg">
                No rejected claims found matching search criteria.
              </div>
            ) : (
              <div className="border border-slate-200/90 rounded-lg overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white border-b border-slate-700">
                      <th className="p-2 font-black text-white text-[9.5px] uppercase font-mono">Claim Code</th>
                      <th className="p-2 font-black text-white text-[9.5px] uppercase">Employee</th>
                      <th className="p-2 font-black text-white text-[9.5px] uppercase font-mono">Expense Date</th>
                      <th className="p-2 font-black text-white text-[9.5px] uppercase font-mono">Amount</th>
                      <th className="p-2 font-black text-white text-[9.5px] uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedClaims.map((claim) => (
                      <tr key={claim.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                        <td className="p-2 font-mono font-extrabold text-slate-900 text-xs">{claim.expense_code}</td>
                        <td className="p-2">
                          <div className="font-extrabold text-slate-900 text-xs leading-none">{claim.employee_name}</div>
                          <div className="text-[9.5px] text-slate-400 font-mono font-bold mt-0.5">{claim.employee_code}</div>
                        </td>
                        <td className="p-2 text-slate-600 font-mono font-bold text-xs">{claim.expense_date}</td>
                        <td className="p-2 font-mono font-extrabold text-slate-900 text-xs">₹{parseFloat(claim.amount).toLocaleString()}</td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            disabled={actioningClaimId === claim.id}
                            onClick={() => handleResubmitClaim(claim.id)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider cursor-pointer border-0 shadow-2xs disabled:opacity-60 transition-all"
                          >
                            {actioningClaimId === claim.id ? "Resetting..." : "Reset to Submitted"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ================= MODAL: CREATE SINGLE USER ================= */}
      {showSingleUserModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Solid Enterprise Header Bar */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 flex items-center gap-2 font-mono">
                <span>Register New Employee</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSingleUserModal(false)}
                className="text-white hover:text-slate-200 text-lg font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateSingleUser} className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {singleUserError && (
                <div className="p-3 border border-rose-300 bg-rose-50 text-rose-800 font-extrabold text-xs rounded-none">
                  {singleUserError}
                </div>
              )}

              {/* Grid 1 - Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. RJCYR045"
                    value={eCode}
                    onChange={(e) => setECode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. SUBHASH YADAV"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Grid 2 - Role and Designations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">System Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    {dropdowns?.roles?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Designation *</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    {dropdowns?.designations?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Grade *</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Zone *</label>
                  <select
                    value={zone}
                    onChange={(e) => handleZoneChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="All">All</option>
                    {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">District *</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="All">All</option>
                    {zone !== "All" && dropdowns?.zones?.[zone]?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">User Type *</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Reporting Manager</label>
                  <select
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="">-- None / Select Reporting Manager --</option>
                    {mList.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.e_code || u.user_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Zonal Manager</label>
                  <select
                    value={zonalManager}
                    onChange={(e) => setZonalManager(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Coordinator</label>
                  <select
                    value={coordinator}
                    onChange={(e) => setCoordinator(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Email ID *</label>
                  <input
                    type="email"
                    placeholder="e.g. subhash@cyrix.com"
                    value={mailId}
                    onChange={(e) => setMailId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Device / Upkaran ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. UPK-9988-XY"
                    value={eUpkaranId}
                    onChange={(e) => setEUpkaranId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Base Reporting Location Section */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Base Reporting Location(s) *</label>
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
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                )}
              </div>

              {/* Grid 6 - Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Date of Joining *</label>
                  <input
                    type="date"
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 [color-scheme:light]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 [color-scheme:light]"
                    required
                  />
                </div>
              </div>

              {/* Screen permissions grid checkboxes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-none border border-slate-200">
                  {ALL_WINDOWS.map((win) => (
                    <label key={win.id} className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowedWindows.includes(win.id)}
                        onChange={() => handleToggleWindow(win.id, false)}
                        className="rounded-none border-slate-300 text-[#4A6A8A] focus:ring-[#4A6A8A] h-4 w-4 cursor-pointer"
                      />
                      {win.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSingleUserModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={singleUserLoading}
                className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {singleUserLoading && <LteSpinner />}
                <span>Register Employee</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
              {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Solid Enterprise Header Bar */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 flex items-center gap-2 font-mono">
                <span>Update Employee:</span>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  title="Click to change ID/Code/Password"
                  className="bg-white/20 hover:bg-white/30 text-white font-mono font-extrabold px-2 py-0.5 rounded-none cursor-pointer border-0"
                >
                  {editingUser.user_id}
                </button>
              </h3>
              {!isSensitiveSectionUnlocked ? (
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase px-2.5 py-1 rounded-none border-0 cursor-pointer shadow-2xs transition-colors"
                >
                  🔒 Unlock Credentials
                </button>
              ) : (
                <span className="text-[10px] bg-emerald-600 text-white font-extrabold uppercase px-2.5 py-1 rounded-none shadow-2xs">
                  🔓 Unlocked
                </span>
              )}
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {editUserError && (
                <div className="p-3 border border-rose-300 bg-rose-50 text-rose-800 font-extrabold text-xs rounded-none">
                  {editUserError}
                </div>
              )}

              {/* Sensitive Fields (User ID, Employee Code, Password) — Shown only when unlocked */}
              {isSensitiveSectionUnlocked && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-none space-y-3 text-left">
                  <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider block">🔓 Edit Credentials (Unlocked)</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">User ID *</label>
                      <input
                        type="text"
                        value={editUserId}
                        onChange={(e) => setEditUserId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Employee Code *</label>
                      <input
                        type="text"
                        value={editECode}
                        onChange={(e) => setEditECode(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">New Password (Leave blank to keep current password)</label>
                    <input
                      type="password"
                      value={editUserPassword}
                      onChange={(e) => setEditUserPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                      placeholder="Enter new password for this user"
                    />
                  </div>
                </div>
              )}

              {/* Grid 1 - Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">System Status *</label>
                  <select
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">System Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    {dropdowns?.roles?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Designation *</label>
                  <select
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    {dropdowns?.designations?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Grade *</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Zone *</label>
                  <select
                    value={editZone}
                    onChange={(e) => handleEditZoneChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="All">All</option>
                    {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">District *</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="All">All</option>
                    {editZone !== "All" && dropdowns?.zones?.[editZone]?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">User Type *</label>
                  <select
                    value={editUserType}
                    onChange={(e) => setEditUserType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor</option>
                    <option value="System">System</option>
                  </select>
                </div>
              </div>

              {/* Grid 4 - Reporting Managers (Dropdown selection showing names) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Reporting Manager</label>
                  <select
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
                  >
                    <option value="">-- None / Clear Reporting Manager --</option>
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Zonal Manager</label>
                  <select
                    value={editZonalManager}
                    onChange={(e) => setEditZonalManager(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Coordinator</label>
                  <select
                    value={editCoordinator}
                    onChange={(e) => setEditCoordinator(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer"
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
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    value={editMobileNumber}
                    onChange={(e) => setEditMobileNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Email ID *</label>
                  <input
                    type="email"
                    value={editMailId}
                    onChange={(e) => setEditMailId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Device / Upkaran ID *</label>
                  <input
                    type="text"
                    value={editEUpkaranId}
                    onChange={(e) => setEditEUpkaranId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                </div>
              </div>

              {/* Base Reporting Location Section */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Base Reporting Location(s) *</label>
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
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                    required
                  />
                )}
              </div>

              {/* Grid 6 - Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Date of Joining *</label>
                  <input
                    type="date"
                    value={editDateOfJoining}
                    onChange={(e) => setEditDateOfJoining(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 [color-scheme:light]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 [color-scheme:light]"
                    required
                  />
                </div>
              </div>

              {/* Checkboxes edit */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-none border border-slate-200">
                  {ALL_WINDOWS.map((win) => (
                    <label key={win.id} className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editAllowedWindows.includes(win.id)}
                        onChange={() => handleToggleWindow(win.id, true)}
                        className="rounded-none border-slate-300 text-[#4A6A8A] focus:ring-[#4A6A8A] h-4 w-4 cursor-pointer"
                      />
                      {win.name}
                    </label>
                  ))}
                </div>

                {/* Bulk Approval Rights Governance - ONLY shown if Approval Center window is assigned or user has approver role */}
                {(editAllowedWindows.includes("approval") || ["manager", "zonal head", "state head", "project head", "coordinator", "approver", "admin"].includes((editRole || "").toLowerCase().trim())) && (
                  <div className="mt-4">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <Zap size={14} className={editCanBulkApprove ? "text-emerald-600" : "text-slate-400"} />
                      <span>Bulk Approval Permission Governance</span>
                    </label>

                    <div className={`p-3 rounded-none border transition-all flex flex-wrap items-center justify-between gap-3 ${
                      editCanBulkApprove
                        ? "bg-emerald-50/90 border-emerald-400 shadow-2xs"
                        : "bg-rose-50/90 border-rose-300 shadow-2xs"
                    }`}>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-black uppercase tracking-wide px-2 py-0.5 rounded-none font-mono ${
                            editCanBulkApprove
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
                          }`}>
                            {editCanBulkApprove ? "⚡ ENABLED — BULK ACCESS GRANTED" : "🔒 DISABLED — INDIVIDUAL ONLY"}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-800 mt-1">
                          {editCanBulkApprove
                            ? "User HAS permission to select multiple claims and bulk approve/reject in 1-click."
                            : "User DOES NOT have bulk approval rights. Access is restricted to single claim review only."}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-none border border-slate-300 shadow-2xs">
                        <span className={`text-xs font-black ${editCanBulkApprove ? "text-emerald-700" : "text-rose-700"}`}>
                          {editCanBulkApprove ? "ON (Granted)" : "OFF (Revoked)"}
                        </span>
                        <Switch
                          checked={editCanBulkApprove}
                          onChange={(checked: boolean) => setEditCanBulkApprove(checked)}
                          checkedChildren="ON"
                          unCheckedChildren="OFF"
                          style={{ backgroundColor: editCanBulkApprove ? "#10b981" : "#ef4444" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowEditUserModal(false);
                  setEditingUser(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editUserLoading}
                className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-60"
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
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Solid Enterprise Header Bar */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 font-mono">
                Import Employees via CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkUploadModal(false)}
                className="text-white hover:text-slate-200 text-lg font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold">Upload a comma-separated values (.csv) file containing employee details.</p>
                  <p className="font-bold text-[#4A6A8A] uppercase tracking-wider text-[10px] font-mono">
                    Required Headers: e_code, name, password, role, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, type, date_of_joining, date_of_birth, e_upkaran_id
                  </p>
                  <p className="text-[10px] text-rose-600 font-extrabold">All fields are compulsory for every row.</p>
                </div>

                {/* Upload Input */}
                <div className="p-4 border-2 border-dashed border-slate-300 bg-slate-50 rounded-none text-center">
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCSVFileSelect}
                    className="hidden"
                  />
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
                    >
                      Choose CSV File
                    </button>
                    <button
                      onClick={downloadSampleCSV}
                      className="px-4 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template</span>
                    </button>
                  </div>
                  {csvText && (
                    <p className="text-[11px] text-emerald-700 mt-2 font-mono truncate max-w-md mx-auto font-bold">
                      Loaded CSV ({csvText.split("\n").length - 1} rows)
                    </p>
                  )}
                </div>

                {/* Bulk Results Summary */}
                {bulkResult && (
                  <div className="p-3 bg-slate-50 rounded-none border border-slate-300 max-h-48 overflow-y-auto text-xs space-y-1.5 font-mono">
                    {bulkResult.error && <p className="text-rose-600 font-bold">{bulkResult.error}</p>}
                    {bulkResult.rowErrors?.map((err: string, i: number) => (
                      <p key={i} className="text-rose-600">{err}</p>
                    ))}
                    {bulkResult.status === "success" && (
                      <div className="text-emerald-700 font-bold space-y-0.5">
                        <p>Import Status: SUCCESS</p>
                        <p>Created: {bulkResult.created_count}</p>
                        <p>Failed: {bulkResult.failed_count}</p>
                        {bulkResult.errors.map((err: string, idx: number) => (
                          <p key={idx} className="text-amber-700 font-normal">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBulkUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBulkUploadSubmit}
                  disabled={bulkLoading || !csvText}
                  className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-60"
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
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Solid Enterprise Header Bar */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 font-mono">
                Import Team Hierarchies via CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkHierarchyModal(false)}
                className="text-white hover:text-slate-200 text-lg font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold">Upload a comma-separated values (.csv) file containing team hierarchy details.</p>
                  <p className="font-bold text-[#4A6A8A] uppercase tracking-wider text-[10px] font-mono">
                    Required Headers: hierarchy_name, requester_e_codes, level_1_approver, level_2_approver, level_3_approver, level_4_approver, level_5_approver
                  </p>
                  <p className="text-[10px] text-slate-500 font-extrabold">
                    Note: Multiple requester employee codes can be separated by commas (e.g. &quot;E001,E002,E003&quot;). Approver fields accept a single employee code.
                  </p>
                </div>

                {/* Upload Input */}
                <div className="p-4 border-2 border-dashed border-slate-300 bg-slate-50 rounded-none text-center">
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
                    className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 shadow-2xs transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-[#4A6A8A]" />
                    <span>Choose CSV File</span>
                  </label>
                </div>

                {/* Raw CSV Text Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    Or Paste Raw CSV Data:
                  </label>
                  <textarea
                    value={hierarchyCsvText}
                    onChange={(e) => setHierarchyCsvText(e.target.value)}
                    placeholder="hierarchy_name,requester_e_codes,level_1_approver,level_2_approver,level_3_approver,level_4_approver,level_5_approver&#10;Team Rajasthan,E001,E100,E200,E300,,&#10;Team Jodhpur,E002,E100,E200,,,"
                    rows={6}
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-none focus:outline-none focus:border-[#4A6A8A] shadow-2xs bg-white resize-y"
                  />
                </div>

                {/* Bulk Results Summary */}
                {bulkHierarchyResult && (
                  <div className={`p-4 rounded-none border text-xs font-bold font-mono max-h-48 overflow-y-auto ${
                    bulkHierarchyResult.error 
                      ? "bg-rose-50 border-rose-300 text-rose-800" 
                      : "bg-emerald-50 border-emerald-300 text-emerald-800"
                  }`}>
                    {bulkHierarchyResult.error && <p className="text-rose-700 font-extrabold mb-1">{bulkHierarchyResult.error}</p>}
                    {bulkHierarchyResult.rowErrors?.map((err: string, i: number) => (
                      <div key={i} className="text-rose-600 text-[10px] mt-0.5">{err}</div>
                    ))}
                    {bulkHierarchyResult.errors?.map((err: string, i: number) => (
                      <div key={i} className="text-rose-600 text-[10px] mt-0.5">{err}</div>
                    ))}
                    {!bulkHierarchyResult.error && !bulkHierarchyResult.errors && (
                      <p className="text-emerald-700 font-extrabold">Successfully imported and updated all team hierarchies!</p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBulkHierarchyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBulkHierarchySubmit}
                  disabled={bulkHierarchyLoading || !hierarchyCsvText}
                  className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {bulkHierarchyLoading && <LteSpinner />}
                  <span>Start Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: USER UPDATE ROLE MAPPING (HIERARCHY CONFIG) ================= */}
      {showHierarchyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Solid Enterprise Header Bar */}
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 font-mono">
                User Update Role Mapping
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowHierarchyModal(false);
                  setEditingHierarchy(null);
                }}
                className="text-white hover:text-slate-200 text-lg font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {hierarchyError && (
                  <div className="p-3 border border-rose-300 bg-rose-50 text-rose-800 font-extrabold text-xs rounded-none">
                    {hierarchyError}
                  </div>
                )}

                {/* Hierarchy Type Input */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Hierarchy Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Bikaner Zone DI"
                    value={hierarchyName}
                    onChange={(e) => setHierarchyName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                  />
                </div>

                {/* Requester User Container Box */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">Requester User</label>
                  
                  {/* Chip List Container */}
                  <div className="min-h-[50px] max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-300 rounded-none flex flex-wrap gap-1.5 items-center">
                    {selectedRequesterIds.length === 0 ? (
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider pl-1 select-none font-bold">
                        No employees mapped as requesters
                      </span>
                    ) : (
                      selectedRequesterIds.map((rid) => {
                        const u = safeUsers.find(userObj => userObj.id === rid);
                        return (
                          <span 
                            key={rid} 
                            className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-none bg-slate-200 text-slate-900 text-xs font-extrabold border border-slate-300 font-mono shadow-2xs"
                          >
                            {u ? `${u.name} (${u.user_id})` : `User ID ${rid}`}
                            <button
                              type="button"
                              onClick={() => handleRemoveRequesterChip(rid)}
                              className="h-4 w-4 rounded-none flex items-center justify-center hover:bg-rose-200 text-slate-600 hover:text-rose-800 font-bold transition-all text-xs cursor-pointer border-0 p-0 leading-none bg-transparent"
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
                    className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9 cursor-pointer mt-1.5"
                  >
                    <option value="" disabled>-- Select an employee to map as requester --</option>
                    {getEligibleRequesters().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.user_id}) | {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checkbox / Rel Level / Approvers Table */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  
                  {/* Row actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddApproverRow}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors flex items-center gap-1.5"
                      title="Add level row"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#4A6A8A]" />
                      Add Level
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCheckedRows}
                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold uppercase tracking-wider rounded-none border border-rose-300 cursor-pointer transition-colors flex items-center gap-1.5"
                      title="Delete checked rows"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      Delete Selected
                    </button>
                  </div>

                  {/* Table */}
                  <div className="border border-slate-300 rounded-none overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#4A6A8A] text-white border-b border-slate-300 font-extrabold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3 w-12 text-center text-white font-mono">SELECT</th>
                          <th className="py-2.5 px-3 w-32 text-white font-mono">REL LEVEL</th>
                          <th className="py-2.5 px-3 text-white font-mono">APPROVER</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {approverRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-slate-400 uppercase tracking-wider text-[10px] font-extrabold">
                              No levels configured. Click 'Add Level' to add a level.
                            </td>
                          </tr>
                        ) : (
                          approverRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              {/* Checkbox */}
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.checked}
                                  onChange={() => handleRowCheckboxToggle(idx)}
                                  className="rounded-none border-slate-300 text-[#4A6A8A] focus:ring-[#4A6A8A] h-4 w-4 cursor-pointer"
                                />
                              </td>
                              {/* Rel Level Number */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  value={row.level}
                                  onChange={(e) => handleRowLevelChange(idx, e.target.value)}
                                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-none text-xs font-mono font-bold text-slate-900 focus:border-[#4A6A8A] outline-none"
                                />
                              </td>
                              {/* Approvers select list */}
                              <td className="py-2 px-3">
                                <select
                                  value={row.approverId}
                                  onChange={(e) => handleRowApproverChange(idx, e.target.value)}
                                  className="w-full max-w-md px-2 py-1 bg-white border border-slate-300 rounded-none text-xs font-extrabold text-slate-900 focus:border-[#4A6A8A] outline-none h-8 cursor-pointer"
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowHierarchyModal(false);
                    setEditingHierarchy(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveHierarchySubmit}
                  disabled={hierarchyLoading}
                  className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-60"
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
          <div className="bg-white border border-slate-300 rounded-none shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#4A6A8A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-300">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0 font-mono">
                Enter Admin Security Password
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockPassword("");
                }}
                className="text-white hover:text-slate-200 text-lg font-bold bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUnlockSensitiveSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  Admin Security Password *
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-none focus:border-[#4A6A8A] outline-none shadow-2xs h-9"
                  placeholder="Enter security password to unlock fields"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockPassword("");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-none border border-slate-300 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4A6A8A] hover:bg-[#3b5570] text-white font-extrabold text-xs uppercase tracking-wider rounded-none border-0 cursor-pointer shadow-2xs transition-colors"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
