import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { adminService, UserCreatePayload, UserEditPayload, ApprovalHierarchyResponse } from "../services/adminService";
import { authService } from "../services/authService";
import { Search, UploadCloud, Pencil, Trash2, Plus, LogOut, Download } from "lucide-react";
import Loader from "../components/common/Loader";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const LteSpinner = () => (
  <span className="spinner-lte mr-1.5"></span>
);

const CustomCountTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-xl p-3 text-xs min-w-[120px] font-sans pointer-events-none">
        <p className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider mb-1.5">{payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Employees:
          </span>
          <span className="font-mono font-bold text-white">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

const getErrorMessage = (err: any, fallback: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => {
      if (typeof d === "string") return d;
      return `${d.loc?.join(".") || "error"}: ${d.msg || JSON.stringify(d)}`;
    }).join(", ");
  }
  return typeof detail === "object" ? JSON.stringify(detail) : String(detail);
};

const GALLERY_COLORS = ["#2f5bb7", "#2b7d50", "#d28b2a", "#854aa5", "#d83b01", "#00a2ad", "#e81123"];

const ALL_WINDOWS = [
  { id: "home", name: "Home" },
  { id: "admin", name: "Admin Panel" },
  { id: "approval", name: "Approval Center" },
  { id: "expense", name: "Submit Expense" },
  { id: "analysis", name: "Analysis" },
  { id: "report", name: "Month Report" },
  { id: "mis_report", name: "MIS Report" },
  { id: "kpi", name: "KPI Dashboard" },
  { id: "upload_data", name: "Upload Data" },
  { id: "asset_upload", name: "Asset Inventory" },
  { id: "penalty_report", name: "Penalty Report" },
  { id: "consolidated_report", name: "Consolidated Report" },
  { id: "help", name: "Help Center" },
  { id: "profile", name: "Profile" }
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "approvals" | "analytics">((() => {
    return (localStorage.getItem("admin_active_tab") as "users" | "approvals" | "analytics") || "users";
  }));

  const handleTabChange = (tab: "users" | "approvals" | "analytics") => {
    setActiveTab(tab);
    localStorage.setItem("admin_active_tab", tab);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [chartRoleFilter, setChartRoleFilter] = useState<string>("all");
  const [chartZoneFilter, setChartZoneFilter] = useState<string>("all");
  const ITEMS_PER_PAGE = 25;

  // Modals visibility
  const [showSingleUserModal, setShowSingleUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  // Bulk Hierarchy Import Form state
  const [showBulkHierarchyModal, setShowBulkHierarchyModal] = useState(false);
  const [hierarchyCsvText, setHierarchyCsvText] = useState("");
  const [bulkHierarchyLoading, setBulkHierarchyLoading] = useState(false);
  const [bulkHierarchyResult, setBulkHierarchyResult] = useState<any>(null);

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
  const [allowedWindows, setAllowedWindows] = useState<string[]>([
    "home", "approval", "expense", "analysis", "report", "help", "profile"
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
  const [editAllowedWindows, setEditAllowedWindows] = useState<string[]>([]);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (role === "Engineer") {
      setAllowedWindows(["home", "expense", "help", "profile"]);
    } else if (role === "Manager") {
      setAllowedWindows(["home", "approval", "expense", "help", "profile"]);
    } else {
      setAllowedWindows(["home", "approval", "expense", "analysis", "report", "help", "profile"]);
    }
  }, [role]);

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
      const [u, dd, hqs] = await Promise.all([
        adminService.getUsers(),
        authService.getDropdowns(),
        adminService.getHierarchies()
      ]);
      setUsers(u);
      localStorage.setItem("cache_admin_users", JSON.stringify(u));
      
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
      !grade || !zone || !district || !manager || !zonalManager ||
      !coordinator || !mobileNumber.trim() || !mailId.trim() || !userType ||
      !dateOfJoining || !dateOfBirth || !eUpkaranId.trim()
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
      setDateOfJoining("");
      setDateOfBirth("");
      setAllowedWindows(["home", "approval", "expense", "analysis", "report", "help", "profile"]);
      
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
    setEditDateOfJoining(u.date_of_joining || "");
    setEditDateOfBirth(u.date_of_birth || "");
    setEditEUpkaranId(u.e_upkaran_id || "");
    setEditAllowedWindows(
      u.allowed_windows ? u.allowed_windows.split(",") : []
    );
    
    setEditUserError(null);
    setShowEditUserModal(true);
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError(null);
    
    // Verify compulsory edits
    if (
      !editName.trim() || !editRole || !editDesignation || !editGrade || 
      !editZone || !editDistrict || !editManager || !editZonalManager ||
      !editCoordinator || !editMobileNumber.trim() || !editMailId.trim() || 
      !editUserType || !editDateOfJoining || !editDateOfBirth || !editEUpkaranId.trim()
    ) {
      setEditUserError("All input details corresponding to user profile columns are compulsory.");
      return;
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
      allowed_windows: editAllowedWindows.join(",")
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

    const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^["']|["']$/g, ""));
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
          allowed_windows: record.role?.trim().toLowerCase() === "engineer"
            ? "home,expense,help,profile"
            : record.role?.trim().toLowerCase() === "manager"
            ? "home,approval,expense,help,profile"
            : "home,approval,expense,analysis,report,help,profile"
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
      formattedApprovers.push({
        level_number: row.level,
        approver_id: appVal
      });
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

  const eligibleApprovers = safeUsers;

  const filteredUsers = safeUsers.filter(u => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      u.name.toLowerCase().includes(term) ||
      u.user_id.toLowerCase().includes(term) ||
      (u.e_code && u.e_code.toLowerCase().includes(term)) ||
      u.role.toLowerCase().includes(term) ||
      (u.designation && u.designation.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Helper to filter users for charts
  const getFilteredUsersForCharts = () => {
    return safeUsers.filter(u => {
      if (chartRoleFilter !== "all" && u.role?.toLowerCase() !== chartRoleFilter.toLowerCase()) return false;
      if (chartZoneFilter !== "all" && u.zone?.toLowerCase() !== chartZoneFilter.toLowerCase()) return false;
      return true;
    });
  };

  // 1. Calculate District-wise distribution
  const getDistrictData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const dist = u.district?.trim() || "N/A";
      counts[dist] = (counts[dist] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  // 2. Calculate Designation-wise distribution
  const getDesignationData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const desg = u.designation?.trim() || "N/A";
      counts[desg] = (counts[desg] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  // 3. Calculate Zone-wise distribution
  const getZoneData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const zone = u.zone?.trim() || "N/A";
      counts[zone] = (counts[zone] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  // 4. Calculate Manager-wise distribution
  const getManagerData = () => {
    const counts: Record<string, number> = {};
    getFilteredUsersForCharts().forEach(u => {
      const mng = u.manager?.trim() || "N/A";
      counts[mng] = (counts[mng] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const mList = getEligibleManagers();
  const zmList = getEligibleZonalManagers();
  const cList = getEligibleCoordinators();

  return (
    <>
      <div className="space-y-6 text-[#212529] animate-fadeIn">
        {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
            Control Panel
          </h2>
          <p className="text-gray-500 text-xs mt-1">Configure screen permissions, assign hierarchy approval level mappings, and manage users.</p>
        </div>

        {/* Tab Selection - Premium Segmented Control */}
        <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-1 shrink-0 shadow-sm">
          <button
            onClick={() => handleTabChange("users")}
            className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-md transition-all cursor-pointer border-0 ${
              activeTab === "users"
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Users List
          </button>
          <button
            onClick={() => handleTabChange("approvals")}
            className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-md transition-all cursor-pointer border-0 ${
              activeTab === "approvals"
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Role Mappings
          </button>
          <button
            onClick={() => handleTabChange("analytics")}
            className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-md transition-all cursor-pointer border-0 ${
              activeTab === "analytics"
                ? "bg-white text-blue-600 shadow-sm"
                : "bg-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Dashboard Charts
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 rounded text-xs text-red-700 font-semibold shadow-sm">
          {error}
        </div>
      )}

      {activeTab === "users" ? (
        /* ================= USERS LIST TAB ================= */
        <div className="card-lte-primary">
          {/* Filters & Actions Bar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by Employee Code, Name, Role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-lte-icon"
              />
            </div>

            {/* User Controls */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => {
                  setSingleUserError(null);
                  setShowSingleUserModal(true);
                }}
                className="btn-lte-primary uppercase tracking-wider font-bold"
              >
                + Single User
              </button>
              <button
                onClick={() => {
                  setCsvText("");
                  setBulkResult(null);
                  setShowBulkUploadModal(true);
                }}
                className="btn-lte-outline uppercase tracking-wider font-bold"
              >
                Bulk CSV Import
              </button>
              <button
                onClick={handleForceLogoutAll}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 border-0 cursor-pointer"
                title="Log out all active users from their current devices"
              >
                <LogOut className="w-3.5 h-3.5" />
                Force Logout All
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <Loader message="Loading employees..." />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-xs uppercase tracking-wider text-gray-500 font-semibold">
                No users found.
              </div>
            ) : (
              <>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Emp Code</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Mobile / Email</th>
                      <th className="py-3 px-4">District / Zone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{u.e_code || "-"}</td>
                        <td className="py-3 px-4 font-semibold text-gray-800">{u.name}</td>
                        <td className="py-3 px-4 text-gray-600">{u.designation || "-"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-100 border border-gray-200 text-gray-600">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="font-semibold text-gray-800">{u.mobile_number || "-"}</div>
                          <div className="text-gray-500 text-[10px]">{u.mail_id || "-"}</div>
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="font-semibold text-gray-800">{u.district || "-"}</div>
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider">{u.zone || "-"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            u.user_status === "active"
                              ? "bg-green-50 border-green-200 text-green-700"
                              : u.user_status === "locked"
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              u.user_status === "active" ? "bg-green-500" : u.user_status === "locked" ? "bg-amber-500" : "bg-red-500"
                            }`}></span>
                            {u.user_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditUserModal(u)}
                            className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-gray-700 transition-all cursor-pointer"
                            title="Edit User Config"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleForceLogoutSingle(u.user_id, u.name)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded transition-all cursor-pointer"
                            title="Force Logout Session"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs text-gray-700">
                          Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                          <span className="font-semibold">{Math.min(endIndex, filteredUsers.length)}</span> of{" "}
                          <span className="font-semibold">{filteredUsers.length}</span> employees
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
                          >
                            Previous
                          </button>
                          <span className="relative inline-flex items-center border-t border-b border-gray-300 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 font-mono">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : activeTab === "analytics" ? (
        /* ================= ANALYTICS DASHBOARD TAB ================= */
        <div className="space-y-6 animate-fadeIn">
          {/* Filters Bar */}
          <div className="bg-white border border-gray-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Dashboard Charts & Analytics</h3>
              <p className="text-gray-500 text-xs mt-1">Interactive 3D Cylinder & Pie charts with custom data filtering.</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">Role:</label>
                <select
                  value={chartRoleFilter}
                  onChange={(e) => setChartRoleFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white font-semibold text-gray-700 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="engineer">Engineer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="coordinator">Coordinator</option>
                </select>
              </div>

              {/* Zone Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">Zone:</label>
                <select
                  value={chartZoneFilter}
                  onChange={(e) => setChartZoneFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white font-semibold text-gray-700 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All Zones</option>
                  {Array.from(new Set(safeUsers.map(u => u.zone?.trim()).filter(Boolean))).map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zone-wise Chart (Donut style) */}
            <div className="bg-white border border-gray-200 rounded shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 bg-[#2f5bb7] text-white flex items-center justify-between rounded-t">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Zone-wise Distribution
                </h4>
              </div>
              <div className="p-4" style={{ height: "290px" }}>
                <div className="relative flex justify-center items-center h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getZoneData().slice(0, 5)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {getZoneData().slice(0, 5).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomCountTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Total</span>
                    <span className="text-xs font-black text-slate-800 font-mono">
                      {getZoneData().reduce((sum, item) => sum + item.value, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* District-wise Chart (Bar style) */}
            <div className="bg-white border border-gray-200 rounded shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 bg-[#2b7d50] text-white flex items-center justify-between rounded-t">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  District-wise Distribution
                </h4>
              </div>
              <div className="p-4" style={{ height: "290px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getDistrictData().slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} vertical={true} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <Tooltip content={<CustomCountTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {getDistrictData().slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Manager-wise Chart (Horizontal Bar style) */}
            <div className="bg-white border border-gray-200 rounded shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 bg-[#854aa5] text-white flex items-center justify-between rounded-t">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Manager-wise Distribution
                </h4>
              </div>
              <div className="p-4" style={{ height: "290px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getManagerData().slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 'bold' }} width={85} />
                    <Tooltip content={<CustomCountTooltip />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {getManagerData().slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Designation-wise Chart (Pie style) */}
            <div className="bg-white border border-gray-200 rounded shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3 bg-[#d28b2a] text-white flex items-center justify-between rounded-t">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Designation-wise Distribution
                </h4>
              </div>
              <div className="p-4" style={{ height: "290px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getDesignationData().slice(0, 5)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {getDesignationData().slice(0, 5).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={GALLERY_COLORS[index % GALLERY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomCountTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= ROLE MAPPINGS TAB ================= */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white border border-gray-200 rounded p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Team Hierarchy Mappings</h3>
              <p className="text-gray-500 text-xs mt-1">Add approval groups with named requesters and level-by-level approvers flow.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportHierarchies}
                className="btn-lte-outline uppercase tracking-wider font-bold flex items-center gap-1.5"
                title="Export all team hierarchies to CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Export CSV
              </button>
              <button
                onClick={() => {
                  setHierarchyCsvText("");
                  setBulkHierarchyResult(null);
                  setShowBulkHierarchyModal(true);
                }}
                className="btn-lte-outline uppercase tracking-wider font-bold flex items-center gap-1.5"
                title="Import team hierarchies from CSV"
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                Import CSV
              </button>
              <button
                onClick={() => handleOpenHierarchyModal()}
                className="btn-lte-primary uppercase tracking-wider font-bold"
              >
                + Create Team
              </button>
            </div>
          </div>

          {safeHierarchies.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded p-8 text-center text-xs uppercase tracking-wider text-gray-500 font-semibold">
              No team hierarchy configurations created. Click "Create Team" to define one.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {safeHierarchies.map((hq) => (
                <div key={hq.id} className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="p-4 space-y-4">
                    
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">{hq.name}</h4>
                        <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider block mt-0.5">
                          {hq.approvers.length} Levels approval
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenHierarchyModal(hq)}
                          className="p-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded transition-all cursor-pointer"
                          title="Edit Mappings"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteHierarchy(hq.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-600 rounded transition-all cursor-pointer"
                          title="Delete Team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Requesters Box */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Requesters ({hq.requesters.length})</span>
                      <div className="flex flex-nowrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-nowrap scrollbar-thin">
                        {hq.requesters.length === 0 ? (
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">No employees mapped</span>
                        ) : (
                          hq.requesters.map((r) => (
                            <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-medium border border-gray-300 font-mono shrink-0">
                              {r.user_name} ({r.user_code})
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Approvers Pipeline - Premium Horizontal Flow */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Approval Sequence ({hq.approvers.length} Levels)</span>
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin">
                        {hq.approvers.length === 0 ? (
                          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">No approvers mapped</span>
                        ) : (
                          hq.approvers.map((a, idx) => (
                            <React.Fragment key={a.id}>
                              {idx > 0 && (
                                <div className="hidden md:flex items-center text-gray-400 font-bold px-1 text-base shrink-0 select-none">
                                  →
                                </div>
                              )}
                              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5 shadow-xs shrink-0 border-l-4 border-l-blue-600 min-w-[200px]">
                                <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shadow-inner">
                                  L{a.level_number}
                                </span>
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-gray-800 leading-tight">
                                    {a.approver_name}
                                  </div>
                                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider leading-none">
                                    {a.approver_role} <span className="font-mono font-normal">({a.approver_code})</span>
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* ================= MODAL: CREATE SINGLE USER ================= */}
      {showSingleUserModal && (
        <div className="modal-lte-overlay z-[9999]">
          <div className="modal-lte-content max-w-4xl p-6 max-h-[90vh] flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-3 text-gray-800">
              Register New Employee
            </h3>
            
            <form onSubmit={handleCreateSingleUser} className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {singleUserError && (
                <div className="p-3 border border-red-200 bg-red-50 text-red-700 font-semibold text-xs rounded">
                  {singleUserError}
                </div>
              )}

              {/* Grid 1 - Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Employee Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. RJCYR045"
                    value={eCode}
                    onChange={(e) => setECode(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. SUBHASH YADAV"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
              </div>

              {/* Grid 2 - Role and Designations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">System Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input-lte"
                  >
                    {dropdowns?.roles?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Designation *</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="input-lte"
                  >
                    {dropdowns?.designations?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Grade *</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="input-lte"
                  >
                    {(dropdowns?.grades && dropdowns.grades.length > 0 ? dropdowns.grades : ["A", "B", "C", "D"]).map((g: string) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 3 - Zone and District */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Zone *</label>
                  <select
                    value={zone}
                    onChange={(e) => handleZoneChange(e.target.value)}
                    className="input-lte"
                  >
                    <option value="All">All</option>
                    {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">District *</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="input-lte"
                  >
                    <option value="All">All</option>
                    {zone !== "All" && dropdowns?.zones?.[zone]?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">User Type *</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="input-lte"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor</option>
                    <option value="System">System</option>
                  </select>
                </div>
              </div>

              {/* Grid 4 - Hierarchy Reporting Managers (Dynamic select dropdowns showing user names instead of text input ID strings) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Reporting Manager *</label>
                  <select
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Reporting Manager --</option>
                    {mList.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.e_code || u.user_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Zonal Manager *</label>
                  <select
                    value={zonalManager}
                    onChange={(e) => setZonalManager(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Zonal Manager --</option>
                    {zmList.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.e_code || u.user_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Coordinator *</label>
                  <select
                    value={coordinator}
                    onChange={(e) => setCoordinator(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Coordinator --</option>
                    {cList.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.e_code || u.user_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 5 - Mobile, Email, and Upkaran */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Email ID *</label>
                  <input
                    type="email"
                    placeholder="e.g. subhash@cyrix.com"
                    value={mailId}
                    onChange={(e) => setMailId(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Device / Upkaran ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. UPK-9988-XY"
                    value={eUpkaranId}
                    onChange={(e) => setEUpkaranId(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
              </div>

              {/* Grid 6 - Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-lte">Date of Joining *</label>
                  <input
                    type="date"
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    className="input-lte [color-scheme:light]"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Date of Birth *</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="input-lte [color-scheme:light]"
                    required
                  />
                </div>
              </div>

              {/* Screen permissions grid checkboxes */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                  {ALL_WINDOWS.map((win) => (
                    <label key={win.id} className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowedWindows.includes(win.id)}
                        onChange={() => handleToggleWindow(win.id, false)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                      {win.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                  type="button"
                  onClick={() => setShowSingleUserModal(false)}
                  className="btn-lte-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleUserLoading}
                  className="btn-lte-primary"
                >
                  {singleUserLoading && <LteSpinner />}
                  <span>Register Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER DETAILS ================= */}
      {showEditUserModal && editingUser && (
        <div className="modal-lte-overlay z-[9999]">
          <div className="modal-lte-content max-w-4xl p-6 max-h-[90vh] flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-3 text-gray-800">
              Update Employee: <span className="text-blue-600 font-mono font-bold">{editingUser.user_id}</span>
            </h3>
            
            <form onSubmit={handleUpdateUserSubmit} className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {editUserError && (
                <div className="p-3 border border-red-200 bg-red-50 text-red-700 font-semibold text-xs rounded">
                  {editUserError}
                </div>
              )}

              {/* Grid 1 - Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-lte">Full Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">System Status *</label>
                  <select
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value)}
                    className="input-lte"
                  >
                    <option value="active">Active</option>
                    <option value="locked">Locked</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Grid 2 - Role and Designations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">System Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="input-lte"
                  >
                    {dropdowns?.roles?.map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Designation *</label>
                  <select
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    className="input-lte"
                  >
                    {dropdowns?.designations?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">Grade *</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="input-lte"
                  >
                    {(dropdowns?.grades && dropdowns.grades.length > 0 ? dropdowns.grades : ["A", "B", "C", "D"]).map((g: string) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 3 - Zone and District */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Zone *</label>
                  <select
                    value={editZone}
                    onChange={(e) => handleEditZoneChange(e.target.value)}
                    className="input-lte"
                  >
                    <option value="All">All</option>
                    {dropdowns?.zones && Object.keys(dropdowns.zones).map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">District *</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="input-lte"
                  >
                    <option value="All">All</option>
                    {editZone !== "All" && dropdowns?.zones?.[editZone]?.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-lte">User Type *</label>
                  <select
                    value={editUserType}
                    onChange={(e) => setEditUserType(e.target.value)}
                    className="input-lte"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor</option>
                    <option value="System">System</option>
                  </select>
                </div>
              </div>

              {/* Grid 4 - Reporting Managers (Dropdown selection showing names) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Reporting Manager *</label>
                  <select
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Reporting Manager --</option>
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
                  <label className="label-lte">Zonal Manager *</label>
                  <select
                    value={editZonalManager}
                    onChange={(e) => setEditZonalManager(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Zonal Manager --</option>
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
                  <label className="label-lte">Coordinator *</label>
                  <select
                    value={editCoordinator}
                    onChange={(e) => setEditCoordinator(e.target.value)}
                    className="input-lte"
                    required
                  >
                    <option value="" disabled>-- Select Coordinator --</option>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-lte">Mobile Number *</label>
                  <input
                    type="tel"
                    value={editMobileNumber}
                    onChange={(e) => setEditMobileNumber(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Email ID *</label>
                  <input
                    type="email"
                    value={editMailId}
                    onChange={(e) => setEditMailId(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Device / Upkaran ID *</label>
                  <input
                    type="text"
                    value={editEUpkaranId}
                    onChange={(e) => setEditEUpkaranId(e.target.value)}
                    className="input-lte"
                    required
                  />
                </div>
              </div>

              {/* Grid 6 - Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-lte">Date of Joining *</label>
                  <input
                    type="date"
                    value={editDateOfJoining}
                    onChange={(e) => setEditDateOfJoining(e.target.value)}
                    className="input-lte [color-scheme:light]"
                    required
                  />
                </div>
                <div>
                  <label className="label-lte">Date of Birth *</label>
                  <input
                    type="date"
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="input-lte [color-scheme:light]"
                    required
                  />
                </div>
              </div>

              {/* Checkboxes edit */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Allowed Navigation Screens</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                  {ALL_WINDOWS.map((win) => (
                    <label key={win.id} className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editAllowedWindows.includes(win.id)}
                        onChange={() => handleToggleWindow(win.id, true)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                      {win.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="btn-lte-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserLoading}
                  className="btn-lte-primary"
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
        <div className="modal-lte-overlay z-[9999]">
          <div className="modal-lte-content max-w-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-3 text-gray-800">
              Import Employees via CSV
            </h3>

            <div className="space-y-4 mt-4">
              <div className="text-xs text-gray-500 space-y-1">
                <p>Upload a comma-separated values (.csv) file containing employee details.</p>
                <p className="font-bold text-blue-600 uppercase tracking-wider text-[9px]">
                  Required Headers: e_code, name, password, role, designation, grade, district, zone, manager, zonal_manager, coordinator, mobile_number, mail_id, type, date_of_joining, date_of_birth, e_upkaran_id
                </p>
                <p className="text-[10px] text-red-500 font-semibold">All fields are compulsory for every row.</p>
              </div>

              {/* Upload Input */}
              <div className="p-4 border-2 border-dashed border-gray-300 bg-gray-50 rounded text-center">
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
                    className="btn-lte-outline uppercase font-bold text-xs"
                  >
                    Choose CSV File
                  </button>
                  <button
                    onClick={downloadSampleCSV}
                    className="btn-lte-secondary uppercase font-bold text-xs flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download Template</span>
                  </button>
                </div>
                {csvText && (
                  <p className="text-[11px] text-green-600 mt-2 font-mono truncate max-w-md mx-auto font-semibold">
                    Loaded CSV ({csvText.split("\n").length - 1} rows)
                  </p>
                )}
              </div>

              {/* Bulk Results Summary */}
              {bulkResult && (
                <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto text-xs space-y-1.5 font-mono">
                  {bulkResult.error && <p className="text-red-600 font-bold">{bulkResult.error}</p>}
                  {bulkResult.rowErrors?.map((err: string, i: number) => (
                    <p key={i} className="text-red-500">{err}</p>
                  ))}
                  {bulkResult.status === "success" && (
                    <div className="text-green-600 font-bold space-y-0.5">
                      <p>Import Status: SUCCESS</p>
                      <p>Created: {bulkResult.created_count}</p>
                      <p>Failed: {bulkResult.failed_count}</p>
                      {bulkResult.errors.map((err: string, idx: number) => (
                        <p key={idx} className="text-amber-600 font-normal">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowBulkUploadModal(false)}
                  className="btn-lte-secondary"
                >
                  Close
                </button>
                <button
                  onClick={handleBulkUploadSubmit}
                  disabled={bulkLoading || !csvText}
                  className="btn-lte-primary disabled:opacity-50"
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
        <div className="modal-lte-overlay z-[9999]">
          <div className="modal-lte-content max-w-2xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-3 text-gray-800 text-left">
              Import Team Hierarchies via CSV
            </h3>

            <div className="space-y-4 mt-4 text-left">
              <div className="text-xs text-gray-500 space-y-1">
                <p>Upload a comma-separated values (.csv) file containing team hierarchy details.</p>
                <p className="font-bold text-blue-600 uppercase tracking-wider text-[9px]">
                  Required Headers: hierarchy_name, requester_e_codes, level_1_approver, level_2_approver, level_3_approver, level_4_approver, level_5_approver
                </p>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">
                  Note: Multiple requester employee codes can be separated by commas (e.g. &quot;E001,E002,E003&quot;). Approver fields accept a single employee code.
                </p>
              </div>

              {/* Upload Input */}
              <div className="p-4 border-2 border-dashed border-gray-300 bg-gray-50 rounded text-center">
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
                  className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded font-semibold text-xs text-gray-700 shadow-sm transition-all"
                >
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  <span>Choose CSV File</span>
                </label>
              </div>

              {/* Raw CSV Text Area */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  Or Paste Raw CSV Data:
                </label>
                <textarea
                  value={hierarchyCsvText}
                  onChange={(e) => setHierarchyCsvText(e.target.value)}
                  placeholder="hierarchy_name,requester_e_codes,level_1_approver,level_2_approver,level_3_approver,level_4_approver,level_5_approver&#10;Team Rajasthan,E001,E100,E200,E300,,&#10;Team Jodhpur,E002,E100,E200,,,"
                  rows={6}
                  className="w-full text-xs font-mono p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              {/* Bulk Results Summary */}
              {bulkHierarchyResult && (
                <div className={`p-4 rounded border text-xs font-semibold max-h-48 overflow-y-auto ${
                  bulkHierarchyResult.error 
                    ? "bg-red-50 border-red-200 text-red-700" 
                    : "bg-green-50 border-green-200 text-green-700"
                }`}>
                  {bulkHierarchyResult.error && <p className="text-red-600 font-bold mb-1">{bulkHierarchyResult.error}</p>}
                  {bulkHierarchyResult.rowErrors?.map((err: string, i: number) => (
                    <div key={i} className="text-red-500 font-mono text-[10px] mt-0.5">{err}</div>
                  ))}
                  {bulkHierarchyResult.errors?.map((err: string, i: number) => (
                    <div key={i} className="text-red-500 font-mono text-[10px] mt-0.5">{err}</div>
                  ))}
                  {!bulkHierarchyResult.error && !bulkHierarchyResult.errors && (
                    <p className="text-green-600 font-bold">Successfully imported and updated all team hierarchies!</p>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowBulkHierarchyModal(false)}
                  className="btn-lte-secondary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBulkHierarchySubmit}
                  disabled={bulkHierarchyLoading || !hierarchyCsvText}
                  className="btn-lte-primary disabled:opacity-50"
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
        <div className="modal-lte-overlay z-[9999]">
          <div className="modal-lte-content max-w-3xl p-6">
            <h3 className="text-base font-bold text-gray-850 tracking-wide border-b border-gray-200 pb-3 text-left">
              User Update Role Mapping
            </h3>

            <div className="space-y-4 mt-4 text-left">
              {hierarchyError && (
                <div className="p-3 border border-red-200 bg-red-50 text-red-700 font-semibold text-xs rounded">
                  {hierarchyError}
                </div>
              )}

              {/* Hierarchy Type Input */}
              <div>
                <label className="label-lte">Hierarchy Type</label>
                <input
                  type="text"
                  placeholder="e.g. Ajmer Team"
                  value={hierarchyName}
                  onChange={(e) => setHierarchyName(e.target.value)}
                  className="input-lte"
                />
              </div>

              {/* Requester User Container Box */}
              <div>
                <label className="label-lte">Requester User</label>
                
                {/* Chip List Container */}
                <div className="min-h-[50px] max-h-36 overflow-y-auto p-2 bg-gray-50 border border-gray-300 rounded flex flex-wrap gap-1.5 items-center">
                  {selectedRequesterIds.length === 0 ? (
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider pl-2 select-none font-semibold">
                      No employees mapped as requesters
                    </span>
                  ) : (
                    selectedRequesterIds.map((rid) => {
                      const u = safeUsers.find(userObj => userObj.id === rid);
                      return (
                        <span 
                          key={rid} 
                          className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px] font-semibold border border-gray-300 font-mono shadow-sm"
                        >
                          {u ? `${u.name} (${u.user_id})` : `User ID ${rid}`}
                          <button
                            type="button"
                            onClick={() => handleRemoveRequesterChip(rid)}
                            className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-gray-300 text-gray-500 hover:text-red-600 font-bold transition-all text-[9px] cursor-pointer border-0 p-0 leading-none bg-transparent"
                          >
                            ×
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
                  className="input-lte mt-1.5"
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
              <div className="space-y-2 pt-2">
                
                {/* Row actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddApproverRow}
                    className="btn-lte-outline p-1.5 rounded text-blue-600 font-bold cursor-pointer"
                    title="Add level row"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCheckedRows}
                    className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-600 rounded transition-all cursor-pointer"
                    title="Delete checked rows"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Table */}
                <div className="border border-gray-300 rounded overflow-hidden shadow-sm">
                  <table className="table-lte">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3 w-12 text-center">Select</th>
                        <th className="py-2 px-3 w-32">Rel Level</th>
                        <th className="py-2 px-3">Approver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {approverRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-gray-400 uppercase tracking-wider text-[10px] font-semibold">
                            No levels configured. Click '+' to add a level.
                          </td>
                        </tr>
                      ) : (
                        approverRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {/* Checkbox */}
                            <td className="py-1.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.checked}
                                onChange={() => handleRowCheckboxToggle(idx)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                              />
                            </td>
                            {/* Rel Level Number */}
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                value={row.level}
                                onChange={(e) => handleRowLevelChange(idx, e.target.value)}
                                className="w-16 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs text-gray-800 focus:outline-none"
                              />
                            </td>
                            {/* Approvers select list (Role constrained Managers, Coordinators, Project Heads) */}
                            <td className="py-1.5 px-3">
                              <select
                                value={row.approverId}
                                onChange={(e) => handleRowApproverChange(idx, e.target.value)}
                                className="w-full max-w-md px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-800 focus:outline-none"
                              >
                                <option value="">-- Select level approver --</option>
                                {eligibleApprovers.map((u) => (
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={handleSaveHierarchySubmit}
                  disabled={hierarchyLoading}
                  className="btn-lte-primary font-bold text-xs uppercase tracking-wider"
                >
                  {hierarchyLoading && <LteSpinner />}
                  <span>Save Mapping</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHierarchyModal(false);
                    setEditingHierarchy(null);
                  }}
                  className="btn-lte-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
