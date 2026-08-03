import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import api from "../services/api";
import { adminService } from "../services/adminService";
import { expenseService } from "../services/expenseService";
import { getISTMonth } from "../utils/dateUtils";
import toast from "react-hot-toast";
import { 
  Button, 
  Input, 
  Alert, 
  Tag,
  Row,
  Col
} from "antd";
import {
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Award,
  Shield,
  MapPin,
  Users,
  Lock,
  Database,
  RefreshCw,
  User,
  Briefcase,
  Smartphone,
  CheckCircle2,
  KeyRound,
  FileText,
  Printer,
  ShieldCheck,
  Zap,
  PhoneCall,
  Car,
  Route,
  Receipt
} from "lucide-react";

// Reusable Apple iOS / Meta AI style soft gradient IconTile component (Matching HomePage)
const IconTile = ({ 
  icon: Icon, 
  gradientFrom, 
  gradientTo, 
  shadowColor = "rgba(0, 0, 0, 0.12)" 
}: { 
  icon: React.ElementType; 
  gradientFrom: string; 
  gradientTo: string; 
  shadowColor?: string;
}) => (
  <div 
    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white shrink-0`}
    style={{ boxShadow: `0 2px 6px -1px ${shadowColor}` }}
  >
    <Icon className="w-3.5 h-3.5 text-white stroke-[2.2]" />
  </div>
);

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // System Maintenance (Admin)
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyResult, setPolicyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Expense Stats & Allowance init
  const [allowanceData, setAllowanceData] = useState<any>(null);
  const [myExpenseStats, setMyExpenseStats] = useState<{ total: number; amount: number; approved: number } | null>(null);
  const [loadingExpenseStats, setLoadingExpenseStats] = useState(false);

  // Tab control: "info" | "expense" | "password" - persisted on refresh
  const [activeTab, setActiveTab] = useState<"info" | "expense" | "password">((() => {
    return (localStorage.getItem("profile_active_tab") as any) || "info";
  })());

  const handleTabChange = (tab: "info" | "expense" | "password") => {
    setActiveTab(tab);
    localStorage.setItem("profile_active_tab", tab);
  };

  // Inline edit state for Email
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  
  // Inline edit state for Mobile
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [tempMobile, setTempMobile] = useState("");
  const [mobileLoading, setMobileLoading] = useState(false);

  // Inline edit state for Emergency Contact
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [tempEmergency, setTempEmergency] = useState("");
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState<string>(() => {
    return localStorage.getItem("user_emergency_contact") || "";
  });
  
  // Notices
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passNotice, setPassNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const currUser = authService.getCurrentUser();
    if (currUser) {
      setUser(currUser);
      setTempEmail(currUser.mail_id || "");
      setTempMobile(currUser.mobile_number || "");
      setTempEmergency(localStorage.getItem(`emergency_contact_${currUser.user_id}`) || currUser.emergency_contact || "");
      setEmergencyContact(localStorage.getItem(`emergency_contact_${currUser.user_id}`) || currUser.emergency_contact || "");
      fetchExpenseAllowanceInfo(currUser.user_id);
    }

    authService.getProfile()
      .then((freshUser) => {
        setUser(freshUser);
        setTempEmail(freshUser.mail_id || "");
        setTempMobile(freshUser.mobile_number || "");
        if (freshUser.emergency_contact) {
          setEmergencyContact(freshUser.emergency_contact);
          setTempEmergency(freshUser.emergency_contact);
        }
      })
      .catch((err) => {
        console.error("Failed to sync profile:", err);
      });
  }, []);

  const fetchExpenseAllowanceInfo = async (userId: string) => {
    setLoadingExpenseStats(true);
    const curMonth = getISTMonth();
    try {
      const initData = await expenseService.getExpenseInit(userId, curMonth);
      if (initData) {
        setAllowanceData(initData.allowance);
      }
    } catch (e) {
      console.warn("Could not fetch allowance stats:", e);
    }

    try {
      const expenses = await expenseService.getExpenses(curMonth);
      if (Array.isArray(expenses)) {
        const total = expenses.length;
        const amount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const approved = expenses.filter(e => (e.status || "").toLowerCase() === "approved").length;
        setMyExpenseStats({ total, amount, approved });
      }
    } catch (e) {
      console.warn("Could not fetch expense list stats:", e);
    } finally {
      setLoadingExpenseStats(false);
    }
  };

  useEffect(() => {
    if (!user || !user.profile_pic_url) {
      setAvatarUrl(null);
      setAvatarError(false);
      return;
    }
    
    setAvatarError(false);
    const cacheKey = `cached_avatar_${user.user_id || user.id || 'default'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAvatarUrl(cached);
    } else {
      setAvatarUrl(authService.getAbsoluteImageUrl(user.profile_pic_url));
    }
    
    const preloadImage = async () => {
      try {
        const absoluteUrl = authService.getAbsoluteImageUrl(user.profile_pic_url);
        if (!absoluteUrl) return;
        
        const path = absoluteUrl.replace(api.defaults.baseURL || "", "");
        const res = await api.get(path, { responseType: 'blob' });
        const blob = res.data;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          localStorage.setItem(cacheKey, base64);
          setAvatarUrl(base64);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        // Ignore background caching errors
      }
    };
    preloadImage();
  }, [user?.profile_pic_url, user?.user_id, user?.id]);

  const handleSaveEmail = async () => {
    if (!tempEmail.trim()) {
      setNotice({ type: "error", text: "Email address cannot be empty." });
      return;
    }
    setEmailLoading(true);
    setNotice(null);
    try {
      const updatedUser = await authService.updateProfile({
        mail_id: tempEmail.trim(),
        mobile_number: user.mobile_number || ""
      });
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsEditingEmail(false);
      setNotice({ type: "success", text: "Email updated successfully!" });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.detail || "Failed to update email address."
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSaveMobile = async () => {
    if (!tempMobile.trim()) {
      setNotice({ type: "error", text: "Mobile number cannot be empty." });
      return;
    }
    setMobileLoading(true);
    setNotice(null);
    try {
      const updatedUser = await authService.updateProfile({
        mail_id: user.mail_id || "",
        mobile_number: tempMobile.trim()
      });
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsEditingMobile(false);
      setNotice({ type: "success", text: "Mobile number updated successfully!" });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.detail || "Failed to update mobile number."
      });
    } finally {
      setMobileLoading(false);
    }
  };

  const handleSaveEmergency = async () => {
    if (!tempEmergency.trim()) {
      setNotice({ type: "error", text: "Emergency contact cannot be empty." });
      return;
    }
    setEmergencyLoading(true);
    setNotice(null);
    try {
      localStorage.setItem(`emergency_contact_${user.user_id}`, tempEmergency.trim());
      setEmergencyContact(tempEmergency.trim());
      setIsEditingEmergency(false);
      setNotice({ type: "success", text: "Emergency contact saved successfully!" });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice({ type: "error", text: "Failed to save emergency contact." });
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleCancelEmail = () => {
    setTempEmail(user.mail_id || "");
    setIsEditingEmail(false);
    setNotice(null);
  };

  const handleCancelMobile = () => {
    setTempMobile(user.mobile_number || "");
    setIsEditingMobile(false);
    setNotice(null);
  };

  const handleCancelEmergency = () => {
    setTempEmergency(emergencyContact);
    setIsEditingEmergency(false);
    setNotice(null);
  };

  const handlePrintProfile = () => {
    window.print();
  };

  const handleRunMigrations = async () => {
    if (!window.confirm("⚠️ Run DB Migrations?\n\nThis will update the DB schema and create/rebuild 22 performance indexes.\n\nContinue?")) return;
    setMigrationLoading(true);
    setMigrationResult(null);
    try {
      const result = await adminService.runMigrations();
      setMigrationResult({ success: true, message: result.message || "Migrations completed!" });
      toast.success("✅ DB Migrations completed successfully!");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Migration failed";
      setMigrationResult({ success: false, message: msg });
      toast.error("❌ Migration failed: " + msg);
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleRunPolicyAdjustment = async () => {
    if (!window.confirm("⚠️ Run Base Location Policy Adjustment?\n\nThis will scan all current-month active claims for users with mapped base locations and retroactively apply commute TA deductions and DA restrictions.\n\nContinue?")) return;
    setPolicyLoading(true);
    setPolicyResult(null);
    try {
      const result = await adminService.runOneTimeAdjust();
      setPolicyResult({ success: true, message: result.message || "Policy adjustments completed!" });
      toast.success("✅ Base location policy adjustments applied!");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Adjustment failed";
      setPolicyResult({ success: false, message: msg });
      toast.error("❌ Adjustment failed: " + msg);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassNotice(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassNotice({ type: "error", text: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassNotice({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPassNotice({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }

    setPassLoading(true);
    try {
      await authService.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setPassNotice({
        type: "success",
        text: "Password updated successfully!"
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassNotice({
        type: "error",
        text: err?.response?.data?.detail || "Failed to update password."
      });
    } finally {
      setPassLoading(false);
    }
  };

  if (!user) return null;

  const allowedModulesList = user?.allowed_windows
    ? user.allowed_windows.split(",").map((w: string) => w.trim())
    : ["Home", "Profile", "Help"];

  return (
    <div className="space-y-3 sm:space-y-4 animate-fadeIn text-[#212529] p-0 sm:p-2 md:p-4 w-full max-w-none">
      {/* Darker Slate-Blue Enterprise Header Bar (#4A6A8A) - HomePage Matching */}
      <div className="bg-[#4A6A8A] text-white rounded-lg px-3 py-1.5 flex items-center justify-between shadow-2xs mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/15 text-white font-semibold text-xs flex items-center justify-center shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white tracking-normal">
              {user?.name || "User"}'s Enterprise Profile
            </span>
            {user?.role && (
              <span className="text-white/60 text-[10px] font-normal leading-none ml-1">
                ({user.role})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handlePrintProfile}
            className="bg-white/15 hover:bg-white/25 text-white border-0 font-medium text-[10px] h-6 px-2 rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <Printer size={12} className="text-white" />
            Print Profile
          </Button>
          <span className="text-[9.5px] font-mono text-white/80 bg-white/15 px-2 py-0.5 rounded">
            ID: {user?.user_id}
          </span>
        </div>
      </div>

      {notice && (
        <Alert
          message={notice.text}
          type={notice.type === "success" ? "success" : "error"}
          showIcon
          closable
          onClose={() => setNotice(null)}
          className="mb-2 py-1 px-3 rounded text-xs font-semibold"
        />
      )}

      {/* Main Grid Content Layout - HomePage Inspired */}
      <Row gutter={[12, 12]}>
        {/* Left Sidebar Column - Employee Card & Module Permissions */}
        <Col xs={24} lg={8} className="space-y-3">
          {/* Main Profile Info Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            {/* Header bar */}
            <div className="bg-[#4A6A8A] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-normal text-white uppercase">
                EMPLOYEE PROFILE
              </span>
              <Tag color="blue" className="m-0 border-0 uppercase font-bold text-[9px]">
                {user.role}
              </Tag>
            </div>

            {/* Avatar and Main Info */}
            <div className="p-4 text-center border-b border-slate-200/80">
              <div className="relative h-20 w-20 mx-auto mb-2.5">
                <div className="h-full w-full rounded-full overflow-hidden border-2 border-[#4A6A8A] shadow-2xs select-none bg-slate-100 text-[#4A6A8A] flex items-center justify-center font-bold text-2xl uppercase">
                  {avatarUrl && !avatarError ? (
                    <img 
                      src={avatarUrl} 
                      alt="Avatar" 
                      className="h-full w-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    user.name ? user.name.charAt(0).toUpperCase() : "U"
                  )}
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{user.name || "Employee"}</h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-0.5">{user.designation || "Staff"}</p>
              <div className="mt-2 flex justify-center gap-1">
                <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  ACTIVE
                </span>
                <span className="inline-block px-2 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80">
                  {user.type || "Staff"}
                </span>
              </div>
            </div>

            {/* Quick Details Micro-grid */}
            <div className="p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                <span className="text-[10.5px] font-medium text-slate-500">Login ID:</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">{user.user_id}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                <span className="text-[10.5px] font-medium text-slate-500">E-Code:</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">{user.e_code || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[10.5px] font-medium text-slate-500">Zone / District:</span>
                <span className="font-bold text-slate-800 text-[10.5px]">{user.zone || "—"} / {user.district || "—"}</span>
              </div>
            </div>
          </div>

          {/* Module Access & System Permissions Widget */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-[#4A6A8A] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-white" /> MODULE PERMISSIONS
              </span>
            </div>
            <div className="p-3 space-y-2">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">AUTHORIZED WINDOWS</span>
              <div className="flex flex-wrap gap-1">
                {allowedModulesList.map((mod: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200/90"
                  >
                    {mod}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Account Status:</span>
                <span className="font-bold text-emerald-700">Verified & Authenticated</span>
              </div>
            </div>
          </div>

          {/* Vehicle Allowance Rates Summary */}
          {allowanceData && (() => {
            const rawVType = (allowanceData.vehicle_type || "Bike").trim();
            const vTypeLower = rawVType.toLowerCase();
            const isBikeOnly = vTypeLower.includes("bike") && !vTypeLower.includes("car") && !vTypeLower.includes("both");
            const isCarOnly = vTypeLower.includes("car") && !vTypeLower.includes("bike") && !vTypeLower.includes("both");

            const showBike = !isCarOnly;
            const showCar = !isBikeOnly;

            return (
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-[#4A6A8A] text-white px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                    <Zap size={13} className="text-white" /> ALLOWANCE POLICY RATES
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-[10px] font-medium text-slate-500">Vehicle Type:</span>
                    <span className="font-bold text-indigo-700">{rawVType}</span>
                  </div>
                  {showBike && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-[10px] font-medium text-slate-500">Bike Rate:</span>
                      <span className="font-bold text-slate-800">₹{allowanceData.rate_bike || 0} / KM</span>
                    </div>
                  )}
                  {showCar && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-[10px] font-medium text-slate-500">Car Rate:</span>
                      <span className="font-bold text-slate-800">₹{allowanceData.rate_car || 0} / KM</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-[10px] font-medium text-slate-500">Monthly KM Limit:</span>
                    <span className="font-mono font-bold text-amber-800">{allowanceData.max_km_per_month || 0} KM</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Col>

        {/* Right Main Column - Workspace */}
        <Col xs={24} lg={16} className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 md:p-3 shadow-2xs space-y-3">
            {/* HomePage Style Ultra-Compact Slate-Blue Tabs Header */}
            <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5">
              <button
                onClick={() => handleTabChange("info")}
                className={`px-3 py-1 text-xs font-bold transition-all rounded-md cursor-pointer ${
                  activeTab === "info"
                    ? "bg-[#4A6A8A] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Personal Info
              </button>
              <button
                onClick={() => handleTabChange("expense")}
                className={`px-3 py-1 text-xs font-bold transition-all rounded-md cursor-pointer ${
                  activeTab === "expense"
                    ? "bg-[#4A6A8A] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Expense & Allowance
              </button>
              <button
                onClick={() => handleTabChange("password")}
                className={`px-3 py-1 text-xs font-bold transition-all rounded-md cursor-pointer ${
                  activeTab === "password"
                    ? "bg-[#4A6A8A] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Security & Account
              </button>
            </div>

            {/* Tab 1: Personal Info */}
            {activeTab === "info" && (
              <div className="space-y-3">
                {/* Section 1: Contact Info */}
                <div className="space-y-1">
                  <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                      <User size={13} className="text-white" /> CONTACT & PERSONAL INFO
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-b-lg p-2 md:p-2.5 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* Email Card */}
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Mail} gradientFrom="from-blue-500" gradientTo="to-indigo-600" shadowColor="rgba(37, 99, 235, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">EMAIL ADDRESS</span>
                              {!isEditingEmail && (
                                <button
                                  onClick={() => {
                                    setTempEmail(user.mail_id || "");
                                    setIsEditingEmail(true);
                                    setIsEditingMobile(false);
                                    setIsEditingEmergency(false);
                                    setNotice(null);
                                  }}
                                  className="text-[9px] text-blue-600 font-bold hover:underline leading-none cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            {isEditingEmail ? (
                              <div className="flex items-center gap-1 mt-1">
                                <Input
                                  type="email"
                                  value={tempEmail}
                                  onChange={(e) => setTempEmail(e.target.value)}
                                  size="small"
                                  disabled={emailLoading}
                                  autoFocus
                                  className="flex-1 text-xs"
                                />
                                <Button type="primary" size="small" onClick={handleSaveEmail} loading={emailLoading} className="text-[10px] bg-[#4A6A8A]">Save</Button>
                                <Button size="small" onClick={handleCancelEmail} disabled={emailLoading} className="text-[10px]">Cancel</Button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate" title={user.mail_id || "—"}>
                                {user.mail_id || "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Phone} gradientFrom="from-emerald-500" gradientTo="to-teal-600" shadowColor="rgba(16, 185, 129, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">MOBILE NUMBER</span>
                              {!isEditingMobile && (
                                <button
                                  onClick={() => {
                                    setTempMobile(user.mobile_number || "");
                                    setIsEditingMobile(true);
                                    setIsEditingEmail(false);
                                    setIsEditingEmergency(false);
                                    setNotice(null);
                                  }}
                                  className="text-[9px] text-blue-600 font-bold hover:underline leading-none cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            {isEditingMobile ? (
                              <div className="flex items-center gap-1 mt-1">
                                <Input
                                  type="tel"
                                  value={tempMobile}
                                  onChange={(e) => setTempMobile(e.target.value)}
                                  size="small"
                                  disabled={mobileLoading}
                                  autoFocus
                                  className="flex-1 text-xs"
                                />
                                <Button type="primary" size="small" onClick={handleSaveMobile} loading={mobileLoading} className="text-[10px] bg-[#4A6A8A]">Save</Button>
                                <Button size="small" onClick={handleCancelMobile} disabled={mobileLoading} className="text-[10px]">Cancel</Button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate" title={user.mobile_number || "—"}>
                                {user.mobile_number || "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact Card */}
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={PhoneCall} gradientFrom="from-purple-500" gradientTo="to-indigo-600" shadowColor="rgba(147, 51, 234, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">EMERGENCY CONTACT</span>
                              {!isEditingEmergency && (
                                <button
                                  onClick={() => {
                                    setTempEmergency(emergencyContact);
                                    setIsEditingEmergency(true);
                                    setIsEditingEmail(false);
                                    setIsEditingMobile(false);
                                    setNotice(null);
                                  }}
                                  className="text-[9px] text-blue-600 font-bold hover:underline leading-none cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            {isEditingEmergency ? (
                              <div className="flex items-center gap-1 mt-1">
                                <Input
                                  type="text"
                                  placeholder="Emergency Name / Number"
                                  value={tempEmergency}
                                  onChange={(e) => setTempEmergency(e.target.value)}
                                  size="small"
                                  disabled={emergencyLoading}
                                  autoFocus
                                  className="flex-1 text-xs"
                                />
                                <Button type="primary" size="small" onClick={handleSaveEmergency} loading={emergencyLoading} className="text-[10px] bg-[#4A6A8A]">Save</Button>
                                <Button size="small" onClick={handleCancelEmergency} disabled={emergencyLoading} className="text-[10px]">Cancel</Button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate" title={emergencyContact || "Not Set"}>
                                {emergencyContact || "Not Set"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DOB Card */}
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Calendar} gradientFrom="from-rose-500" gradientTo="to-red-600" shadowColor="rgba(239, 68, 68, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">DATE OF BIRTH</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">
                              {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Employment Details */}
                <div className="space-y-1">
                  <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                      <Briefcase size={13} className="text-white" /> EMPLOYMENT & SYSTEMS DETAILS
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-b-lg p-2 md:p-2.5 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={CreditCard} gradientFrom="from-blue-500" gradientTo="to-indigo-600" shadowColor="rgba(37, 99, 235, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">EMPLOYEE CODE</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.e_code || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Award} gradientFrom="from-purple-500" gradientTo="to-indigo-600" shadowColor="rgba(147, 51, 234, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">GRADE</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.grade || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Calendar} gradientFrom="from-amber-500" gradientTo="to-amber-600" shadowColor="rgba(245, 158, 11, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">DATE OF JOINING</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">
                              {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Smartphone} gradientFrom="from-slate-600" gradientTo="to-slate-700" shadowColor="rgba(71, 85, 105, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">DEVICE / UPKARAN ID</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.e_upkaran_id || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Hierarchy */}
                <div className="space-y-1">
                  <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                      <Users size={13} className="text-white" /> REPORTING HIERARCHY & REGION
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-b-lg p-2 md:p-2.5 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={User} gradientFrom="from-indigo-500" gradientTo="to-indigo-600" shadowColor="rgba(99, 102, 241, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">REPORTING MANAGER</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.manager || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Shield} gradientFrom="from-blue-600" gradientTo="to-indigo-700" shadowColor="rgba(37, 99, 235, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">ZONAL MANAGER</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.zonal_manager || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={Users} gradientFrom="from-cyan-500" gradientTo="to-teal-600" shadowColor="rgba(6, 182, 212, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">COORDINATOR</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.coordinator || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={MapPin} gradientFrom="from-amber-500" gradientTo="to-amber-600" shadowColor="rgba(245, 158, 11, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">ZONE</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.zone || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-lg py-1.5 px-2 flex items-center shadow-2xs hover:border-slate-300 transition-colors h-12">
                        <div className="flex items-center gap-2 min-w-0 w-full">
                          <IconTile icon={MapPin} gradientFrom="from-rose-500" gradientTo="to-red-600" shadowColor="rgba(239, 68, 68, 0.25)" />
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <span className="text-[8.5px] font-medium uppercase tracking-normal text-slate-400 leading-none">DISTRICT</span>
                            <span className="text-[11px] font-bold text-slate-800 leading-none mt-1 truncate">{user.district || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Expense & Allowance Overview (New Feature!) */}
            {activeTab === "expense" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                      <Receipt size={13} className="text-white" /> CURRENT MONTH EXPENSE STATS
                    </span>
                    <span className="text-[9.5px] font-mono text-white/80 bg-white/15 px-2 py-0.5 rounded">
                      MONTH: {getISTMonth()}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-b-lg p-3 shadow-2xs">
                    {loadingExpenseStats ? (
                      <div className="py-4 text-center text-xs text-slate-500">Loading expense summary...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Micro-card 1 */}
                        <div className="bg-white border border-slate-200/80 rounded-lg py-2 px-3 flex items-center gap-2.5 shadow-2xs">
                          <IconTile icon={FileText} gradientFrom="from-blue-500" gradientTo="to-indigo-600" shadowColor="rgba(37, 99, 235, 0.25)" />
                          <div className="flex flex-col">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">SUBMITTED CLAIMS</span>
                            <span className="text-sm font-bold font-mono text-slate-900 mt-0.5">{myExpenseStats?.total || 0} Claims</span>
                          </div>
                        </div>

                        {/* Micro-card 2 */}
                        <div className="bg-white border border-slate-200/80 rounded-lg py-2 px-3 flex items-center gap-2.5 shadow-2xs">
                          <IconTile icon={CheckCircle2} gradientFrom="from-emerald-500" gradientTo="to-teal-600" shadowColor="rgba(16, 185, 129, 0.25)" />
                          <div className="flex flex-col">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">APPROVED CLAIMS</span>
                            <span className="text-sm font-bold font-mono text-emerald-700 mt-0.5">{myExpenseStats?.approved || 0} Approved</span>
                          </div>
                        </div>

                        {/* Micro-card 3 */}
                        <div className="bg-white border border-slate-200/80 rounded-lg py-2 px-3 flex items-center gap-2.5 shadow-2xs">
                          <IconTile icon={Receipt} gradientFrom="from-purple-500" gradientTo="to-indigo-600" shadowColor="rgba(147, 51, 234, 0.25)" />
                          <div className="flex flex-col">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">TOTAL CLAIM VALUE</span>
                            <span className="text-sm font-bold font-mono text-slate-900 mt-0.5">₹{(myExpenseStats?.amount || 0).toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Allowance Rates & Policy Summary */}
                {allowanceData && (() => {
                  const rawVType = (allowanceData.vehicle_type || "Bike").trim();
                  const vTypeLower = rawVType.toLowerCase();
                  const isBikeOnly = vTypeLower.includes("bike") && !vTypeLower.includes("car") && !vTypeLower.includes("both");
                  const isCarOnly = vTypeLower.includes("car") && !vTypeLower.includes("bike") && !vTypeLower.includes("both");

                  const showBike = !isCarOnly;
                  const showCar = !isBikeOnly;

                  return (
                    <div className="space-y-1">
                      <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                        <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                          <Car size={13} className="text-white" /> TRAVEL &amp; DAILY ALLOWANCE RATES
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200/80 rounded-b-lg p-3 shadow-2xs space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2 bg-slate-50 rounded border border-slate-200/60 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">IN-DISTRICT DA</span>
                            <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">₹{allowanceData.daily_in_district || 0} / Day</span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded border border-slate-200/60 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">OUT-DISTRICT DA</span>
                            <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">₹{allowanceData.daily_out_district || 0} / Day</span>
                          </div>
                          {showBike && (
                            <div className="p-2 bg-slate-50 rounded border border-slate-200/60 text-center">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">BIKE RATE</span>
                              <span className="text-xs font-extrabold text-indigo-700 mt-0.5 block">₹{allowanceData.rate_bike || 0} / KM</span>
                            </div>
                          )}
                          {showCar && (
                            <div className="p-2 bg-slate-50 rounded border border-slate-200/60 text-center">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">CAR RATE</span>
                              <span className="text-xs font-extrabold text-indigo-700 mt-0.5 block">₹{allowanceData.rate_car || 0} / KM</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tab 3: Password & Security */}
            {activeTab === "password" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                      <KeyRound size={13} className="text-white" /> UPDATE CREDENTIALS
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-b-lg p-3 md:p-4 shadow-2xs">
                    <form onSubmit={handlePasswordChange} className="space-y-3 max-w-md">
                      {passNotice && (
                        <Alert
                          message={passNotice.text}
                          type={passNotice.type === "success" ? "success" : "error"}
                          showIcon
                          className="py-1 px-2 text-xs"
                        />
                      )}

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">Current Password</label>
                        <Input.Password
                          placeholder="Enter current password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">New Password</label>
                        <Input.Password
                          placeholder="Enter new password (min 8 chars)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">Confirm New Password</label>
                        <Input.Password
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="text-xs h-8"
                          required
                        />
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={passLoading}
                        className="bg-[#4A6A8A] hover:bg-[#3b556f] text-white text-xs font-semibold h-7 px-4 rounded shadow-2xs flex items-center gap-1.5 cursor-pointer mt-2"
                      >
                        <CheckCircle2 size={13} /> Update Password
                      </Button>
                    </form>
                  </div>
                </div>

                {/* System Maintenance for Admin */}
                {user?.role === "Admin" && (
                  <div className="space-y-1 mt-4">
                    <div className="bg-[#4A6A8A] text-white px-3 py-1 rounded-t-lg flex items-center justify-between">
                      <span className="text-[11px] font-medium tracking-normal text-white uppercase flex items-center gap-1.5">
                        <Database size={13} className="text-white" /> SYSTEM MAINTENANCE (ADMIN ONLY)
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-b-lg p-3 shadow-2xs space-y-3">
                      <p className="text-[10.5px] text-slate-600 font-medium leading-tight">
                        Rebuild database performance indexes, execute structural migrations, and apply base location travel policy deductions.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          type="primary" 
                          danger 
                          onClick={handleRunMigrations} 
                          loading={migrationLoading}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium h-7 px-3 rounded shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Database size={12} /> Run DB Migrations
                        </Button>
                        <Button 
                          type="primary" 
                          onClick={handleRunPolicyAdjustment} 
                          loading={policyLoading}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium h-7 px-3 rounded shadow-2xs flex items-center gap-1.5 cursor-pointer border-0"
                        >
                          <RefreshCw size={12} /> Run Policy Adjustments
                        </Button>
                      </div>
                      {migrationResult && (
                        <div className={`p-2 rounded text-[10px] font-mono border ${migrationResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                          {migrationResult.message}
                        </div>
                      )}
                      {policyResult && (
                        <div className={`p-2 rounded text-[10px] font-mono border ${policyResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                          {policyResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Footer - Matching HomePage style */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
        <span>Cyrix Healthcare Pvt. Ltd.</span>
        <span>Designed &amp; Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer" className="text-[#4A6A8A] hover:underline">Sunil Bishnoi</a></span>
      </div>
    </div>
  );
}
