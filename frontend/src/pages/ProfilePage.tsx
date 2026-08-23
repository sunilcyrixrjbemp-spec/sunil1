import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import api from "../services/api";
import { adminService } from "../services/adminService";
import { expenseService } from "../services/expenseService";
import { getISTMonth } from "../utils/dateUtils";
import toast from "react-hot-toast";
import { Input, Alert } from "antd";
import {
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Award,
  Shield,
  MapPin,
  Users,
  Database,
  RefreshCw,
  User,
  Briefcase,
  Smartphone,
  CheckCircle2,
  KeyRound,
  FileText,
  ShieldCheck,
  Car,
  IndianRupee,
  Lock,
  BadgeCheck
} from "lucide-react";

const rupee = (num: number | string) => {
  const val = Number(num) || 0;
  return "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

// Reusable Zoho-style Icon Tile component
const ZohoIconTile = ({ 
  icon: Icon, 
  colorClass = "bg-accent-50 text-accent-700 border-accent-100" 
}: { 
  icon: React.ElementType; 
  colorClass?: string;
}) => (
  <div 
    className={`w-8 h-8 rounded-lg ${colorClass} border flex items-center justify-center shrink-0 shadow-2xs`}
  >
    <Icon className="w-4 h-4 stroke-[2]" />
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
      fetchExpenseAllowanceInfo(currUser.user_id);
    }

    authService.getProfile()
      .then((freshUser) => {
        setUser(freshUser);
        setTempEmail(freshUser.mail_id || "");
        setTempMobile(freshUser.mobile_number || "");
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

  // Vehicle Allowance Visibility Logic
  const rawVType = (allowanceData?.vehicle_type || user?.vehicle_type || user?.allowed_vehicle || "Bike").trim();
  const vTypeLower = rawVType.toLowerCase();
  const isBikeOnly = vTypeLower.includes("bike") && !vTypeLower.includes("car") && !vTypeLower.includes("both");
  const isCarOnly = vTypeLower.includes("car") && !vTypeLower.includes("bike") && !vTypeLower.includes("both");
  const isBoth = vTypeLower.includes("both") || (vTypeLower.includes("bike") && vTypeLower.includes("car"));
  
  const showBike = !isCarOnly;
  const showCar = !isBikeOnly || isBoth;

  return (
    <div className="min-h-screen w-full relative bg-[#FAFAF9] selection:bg-accent-100 selection:text-accent-900 font-sans antialiased text-ink-900">
      
      {/* ══════════════════════════════════════════════════════════════════
          ZOHO AMBIENT CANVAS & SUBTLE GRID (Matching HomePage)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div
          className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-1"
          style={{
            background: "radial-gradient(circle, #4338CA 0%, rgba(67, 56, 202, 0) 70%)",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] rounded-full animate-mesh-blob-2"
          style={{
            background: "radial-gradient(circle, #6366F1 0%, rgba(99, 102, 241, 0) 70%)",
            filter: "blur(130px)",
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#12151A 1px, transparent 1px), linear-gradient(90deg, #12151A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 space-y-3.5 max-w-7xl mx-auto pb-12 px-2 sm:px-4 pt-2">

        {/* ── 1. Zoho Profile Header Card ──────────────────────────────────── */}
        <div 
          className="bg-white border border-line rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4"
          style={{
            boxShadow: "0 10px 30px -5px rgba(30, 27, 75, 0.04), 0 4px 12px -2px rgba(30, 27, 75, 0.02)",
          }}
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Elegant Circular Avatar with Status Badge */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-accent-100 text-accent-700 border-2 border-accent-200 flex items-center justify-center font-black text-xl sm:text-2xl uppercase shadow-xs">
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
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-2xs" title="Active Account" />
            </div>

            {/* User Details */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-ink-900 leading-tight">
                  {user.name || "Employee"}
                </h1>
                <span className="text-[10px] sm:text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-accent-50 text-accent-700 border border-accent-200">
                  {user.role || "Staff"}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-xs text-ink-500 font-medium flex-wrap">
                <span>{user.designation || "Staff"}</span>
                <span>•</span>
                <span className="font-mono font-bold text-accent-700 bg-surface-sunken px-1.5 py-0.5 rounded border border-line text-[11px]">
                  ID: {user.user_id}
                </span>
                {user.e_code && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-ink-600 text-[11px]">Code: <b>{user.e_code}</b></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Global Notices */}
        {notice && (
          <Alert
            message={notice.text}
            type={notice.type === "success" ? "success" : "error"}
            showIcon
            closable
            onClose={() => setNotice(null)}
            className="rounded-xl text-xs font-bold border-line shadow-xs py-2 px-3.5"
          />
        )}

        {/* ── 2. Zoho Tabs Header Bar (Using IndianRupee ₹ Icon) ───────────── */}
        <div className="bg-white border border-line rounded-xl p-1.5 flex items-center gap-1.5 shadow-xs overflow-x-auto">
          <button
            onClick={() => handleTabChange("info")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "info"
                ? "bg-accent-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
            }`}
          >
            <User size={14} />
            <span>Personal & Employment Info</span>
          </button>
          
          <button
            onClick={() => handleTabChange("expense")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "expense"
                ? "bg-accent-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
            }`}
          >
            <IndianRupee size={14} />
            <span>Expense & Allowance Policy</span>
          </button>
          
          <button
            onClick={() => handleTabChange("password")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "password"
                ? "bg-accent-600 text-white shadow-xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-surface-sunken"
            }`}
          >
            <KeyRound size={14} />
            <span>Security & Credentials</span>
          </button>
        </div>

        {/* ── 3. Main Workspace Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          
          {/* Left Sidebar Column (4 Cols) */}
          <div className="lg:col-span-4 space-y-3.5">
            
            {/* Quick Profile Summary Card */}
            <div 
              className="bg-white border border-line rounded-xl p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-ink-500 flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-accent-600" /> Account Summary
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-ink-500 font-medium">Employee Type</span>
                  <span className="font-bold text-ink-900">{user.type || "Permanent Staff"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-ink-500 font-medium">Zone / Region</span>
                  <span className="font-bold text-ink-900">{user.zone || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-line/60">
                  <span className="text-ink-500 font-medium">Home District</span>
                  <span className="font-bold text-ink-900">{user.district || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-500 font-medium">Employee Grade</span>
                  <span className="font-bold text-accent-700 bg-accent-50 px-2 py-0.5 rounded border border-accent-200 font-mono text-[11px]">
                    Grade {user.grade || "A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Module Access Permissions Card */}
            <div 
              className="bg-white border border-line rounded-xl p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-ink-500 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-accent-600" /> Authorized Windows
                </span>
                <span className="text-[10px] font-bold text-ink-400">
                  {allowedModulesList.length} Modules
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {allowedModulesList.map((mod: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold uppercase bg-surface-sunken text-ink-700 border border-line"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </div>

            {/* Allowance Policy Snapshot Card */}
            {allowanceData && (
              <div 
                className="bg-white border border-line rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-ink-500 flex items-center gap-1.5">
                    <IndianRupee size={14} className="text-amber-500" /> Allowance Policy
                  </span>
                  <span className="text-[10px] font-bold text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded">
                    {allowanceData.vehicle_type || "Bike"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {showBike && (
                    <div className="flex items-center justify-between py-1 border-b border-line/60">
                      <span className="text-ink-500 font-medium">Bike Rate</span>
                      <span className="font-bold text-ink-900 font-mono">₹{allowanceData.rate_bike || 0} / KM</span>
                    </div>
                  )}
                  {showCar && (
                    <div className="flex items-center justify-between py-1 border-b border-line/60">
                      <span className="text-ink-500 font-medium">Car Rate</span>
                      <span className="font-bold text-ink-900 font-mono">₹{allowanceData.rate_car || 0} / KM</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-ink-500 font-medium">Monthly Max KM</span>
                    <span className="font-bold text-amber-800 font-mono">{allowanceData.max_km_per_month || 0} KM</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Main Content Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-3.5">
            
            {/* ── TAB 1: PERSONAL & EMPLOYMENT INFO ── */}
            {activeTab === "info" && (
              <div className="space-y-3.5">
                
                {/* Contact & Communication Details Card */}
                <div 
                  className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <ZohoIconTile icon={Phone} colorClass="bg-accent-50 text-accent-700 border-accent-100" />
                      <div>
                        <h3 className="text-sm font-black text-ink-900 leading-tight">Contact & Communication</h3>
                        <p className="text-[11px] text-ink-400 font-medium">Primary email and phone number</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Email Card */}
                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] hover:bg-white hover:border-accent-200 transition-all space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                          <Mail size={12} /> Email Address
                        </span>
                        {!isEditingEmail && (
                          <button
                            onClick={() => {
                              setTempEmail(user.mail_id || "");
                              setIsEditingEmail(true);
                              setIsEditingMobile(false);
                              setNotice(null);
                            }}
                            className="text-[11px] text-accent-700 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isEditingEmail ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            type="email"
                            value={tempEmail}
                            onChange={(e) => setTempEmail(e.target.value)}
                            size="small"
                            disabled={emailLoading}
                            autoFocus
                            className="rounded-lg text-xs"
                          />
                          <button
                            onClick={handleSaveEmail}
                            disabled={emailLoading}
                            className="px-2.5 py-1 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEmail}
                            disabled={emailLoading}
                            className="px-2.5 py-1 bg-white hover:bg-surface-sunken text-ink-600 rounded-lg text-xs font-bold border border-line cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-ink-900 truncate" title={user.mail_id || "—"}>
                          {user.mail_id || "—"}
                        </div>
                      )}
                    </div>

                    {/* Mobile Card */}
                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] hover:bg-white hover:border-accent-200 transition-all space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                          <Phone size={12} /> Mobile Number
                        </span>
                        {!isEditingMobile && (
                          <button
                            onClick={() => {
                              setTempMobile(user.mobile_number || "");
                              setIsEditingMobile(true);
                              setIsEditingEmail(false);
                              setNotice(null);
                            }}
                            className="text-[11px] text-accent-700 font-bold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isEditingMobile ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            type="tel"
                            value={tempMobile}
                            onChange={(e) => setTempMobile(e.target.value)}
                            size="small"
                            disabled={mobileLoading}
                            autoFocus
                            className="rounded-lg text-xs"
                          />
                          <button
                            onClick={handleSaveMobile}
                            disabled={mobileLoading}
                            className="px-2.5 py-1 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelMobile}
                            disabled={mobileLoading}
                            className="px-2.5 py-1 bg-white hover:bg-surface-sunken text-ink-600 rounded-lg text-xs font-bold border border-line cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-ink-900 truncate" title={user.mobile_number || "—"}>
                          {user.mobile_number || "—"}
                        </div>
                      )}
                    </div>

                    {/* Date of Birth Card */}
                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Calendar size={12} /> Date of Birth
                      </span>
                      <div className="text-xs font-bold text-ink-900">
                        {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Employment & Systems Identity Card */}
                <div 
                  className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <ZohoIconTile icon={Briefcase} colorClass="bg-blue-50 text-blue-700 border-blue-100" />
                      <div>
                        <h3 className="text-sm font-black text-ink-900 leading-tight">Employment & System Identity</h3>
                        <p className="text-[11px] text-ink-400 font-medium">Company record and official equipment codes</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <CreditCard size={12} /> Employee Code
                      </span>
                      <div className="text-xs font-bold font-mono text-ink-900">{user.e_code || "—"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Award size={12} /> Staff Grade
                      </span>
                      <div className="text-xs font-bold text-ink-900">{user.grade || "Grade A"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Calendar size={12} /> Date of Joining
                      </span>
                      <div className="text-xs font-bold text-ink-900">
                        {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "—"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Smartphone size={12} /> e-Upkaran / Device ID
                      </span>
                      <div className="text-xs font-bold font-mono text-ink-900">{user.e_upkaran_id || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Reporting Hierarchy & Regional Jurisdiction Card */}
                <div 
                  className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <ZohoIconTile icon={Users} colorClass="bg-purple-50 text-purple-700 border-purple-100" />
                      <div>
                        <h3 className="text-sm font-black text-ink-900 leading-tight">Reporting Hierarchy & Region</h3>
                        <p className="text-[11px] text-ink-400 font-medium">Managers, coordinators, and operational districts</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <User size={12} /> Reporting Manager
                      </span>
                      <div className="text-xs font-bold text-ink-900">{user.manager || "—"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Shield size={12} /> Zonal Manager
                      </span>
                      <div className="text-xs font-bold text-ink-900">{user.zonal_manager || "—"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <Users size={12} /> Operations Coordinator
                      </span>
                      <div className="text-xs font-bold text-ink-900">{user.coordinator || "—"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                        <MapPin size={12} /> Operating Zone & District
                      </span>
                      <div className="text-xs font-bold text-ink-900">{user.zone || "—"} / {user.district || "—"}</div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── TAB 2: EXPENSE & ALLOWANCE INTELLIGENCE ── */}
            {activeTab === "expense" && (
              <div className="space-y-3.5">
                
                {/* Current Month Expense Metrics */}
                <div 
                  className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <ZohoIconTile icon={IndianRupee} colorClass="bg-emerald-50 text-emerald-700 border-emerald-100" />
                      <div>
                        <h3 className="text-sm font-black text-ink-900 leading-tight">Monthly Expense Overview</h3>
                        <p className="text-[11px] text-ink-400 font-medium">Active cycle metrics for {getISTMonth()}</p>
                      </div>
                    </div>
                  </div>

                  {loadingExpenseStats ? (
                    <div className="py-8 text-center text-xs text-ink-400">Loading expense summary...</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                          <FileText size={12} /> Submitted Claims
                        </span>
                        <div className="text-lg font-black font-mono text-ink-900">
                          {myExpenseStats?.total || 0} Claims
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-600" /> Approved Claims
                        </span>
                        <div className="text-lg font-black font-mono text-emerald-700">
                          {myExpenseStats?.approved || 0} Approved
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-line bg-[#FAFAF9] space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                          <IndianRupee size={12} /> Total Claim Value
                        </span>
                        <div className="text-lg font-black font-mono text-accent-700">
                          {rupee(myExpenseStats?.amount || 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Travel & Daily Allowance Policy Master Rates (Filter Car/Bike by Permission) */}
                {allowanceData && (
                  <div 
                    className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <ZohoIconTile icon={Car} colorClass="bg-indigo-50 text-indigo-700 border-indigo-100" />
                        <div>
                          <h3 className="text-sm font-black text-ink-900 leading-tight">Travel & Daily Allowance Rates</h3>
                          <p className="text-[11px] text-ink-400 font-medium">Policy sanctioned rates by employee designation grade</p>
                        </div>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 ${showBike && showCar ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                      <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] text-center space-y-1">
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-ink-400 block">IN-DISTRICT DA</span>
                        <span className="text-sm font-black font-mono text-ink-900 block">₹{allowanceData.daily_in_district || 0} / Day</span>
                      </div>

                      <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] text-center space-y-1">
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-ink-400 block">OUT-DISTRICT DA</span>
                        <span className="text-sm font-black font-mono text-ink-900 block">₹{allowanceData.daily_out_district || 0} / Day</span>
                      </div>

                      {showBike && (
                        <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] text-center space-y-1">
                          <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-ink-400 block">BIKE RATE</span>
                          <span className="text-sm font-black font-mono text-accent-700 block">₹{allowanceData.rate_bike || 0} / KM</span>
                        </div>
                      )}

                      {showCar && (
                        <div className="p-3.5 rounded-xl border border-line bg-[#FAFAF9] text-center space-y-1">
                          <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-ink-400 block">CAR RATE</span>
                          <span className="text-sm font-black font-mono text-accent-700 block">₹{allowanceData.rate_car || 0} / KM</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── TAB 3: SECURITY & CREDENTIALS ── */}
            {activeTab === "password" && (
              <div className="space-y-3.5">
                
                {/* Update Password Form Card */}
                <div 
                  className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <ZohoIconTile icon={Lock} colorClass="bg-accent-50 text-accent-700 border-accent-100" />
                      <div>
                        <h3 className="text-sm font-black text-ink-900 leading-tight">Change Password</h3>
                        <p className="text-[11px] text-ink-400 font-medium">Update your account authentication credentials</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePasswordChange} className="space-y-3.5 max-w-lg">
                    {passNotice && (
                      <Alert
                        message={passNotice.text}
                        type={passNotice.type === "success" ? "success" : "error"}
                        showIcon
                        className="rounded-lg text-xs"
                      />
                    )}

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-extrabold text-ink-700 uppercase tracking-wider block">Current Password</label>
                      <Input.Password
                        placeholder="Enter current password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="rounded-lg text-xs h-9"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-extrabold text-ink-700 uppercase tracking-wider block">New Password</label>
                      <Input.Password
                        placeholder="Enter new password (min 8 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="rounded-lg text-xs h-9"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10.5px] font-extrabold text-ink-700 uppercase tracking-wider block">Confirm New Password</label>
                      <Input.Password
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="rounded-lg text-xs h-9"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={passLoading}
                      className="px-4.5 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer mt-2"
                    >
                      <CheckCircle2 size={14} />
                      <span>{passLoading ? "Updating..." : "Update Password"}</span>
                    </button>
                  </form>
                </div>

                {/* System Maintenance for Admin */}
                {user?.role === "Admin" && (
                  <div 
                    className="bg-white border border-line rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2">
                        <ZohoIconTile icon={Database} colorClass="bg-rose-50 text-rose-700 border-rose-100" />
                        <div>
                          <h3 className="text-sm font-black text-ink-900 leading-tight">System Maintenance (Admin Only)</h3>
                          <p className="text-[11px] text-ink-400 font-medium">Database structural migrations and retroactive policy adjustments</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-ink-600 font-medium leading-relaxed">
                        Rebuild database performance indexes, execute structural migrations, and apply base location travel policy deductions across active records.
                      </p>
                      
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={handleRunMigrations} 
                          disabled={migrationLoading}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Database size={13} />
                          <span>{migrationLoading ? "Running..." : "Run DB Migrations"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRunPolicyAdjustment} 
                          disabled={policyLoading}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          <span>{policyLoading ? "Adjusting..." : "Run Policy Adjustments"}</span>
                        </button>
                      </div>

                      {migrationResult && (
                        <div className={`p-3 rounded-xl text-xs font-mono border ${migrationResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                          {migrationResult.message}
                        </div>
                      )}
                      
                      {policyResult && (
                        <div className={`p-3 rounded-xl text-xs font-mono border ${policyResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                          {policyResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

        {/* ── 4. Clean Footer ──────────────────────────────────────────────── */}
        <div className="mt-6 pt-4 border-t border-line text-xs font-medium text-ink-400 text-center">
          <span>Designed &amp; Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer" className="text-accent-700 font-bold hover:underline">Sunil Bishnoi</a></span>
        </div>

      </div>
    </div>
  );
}
