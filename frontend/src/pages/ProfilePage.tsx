import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import api from "../services/api";
import { adminService } from "../services/adminService";
import toast from "react-hot-toast";
import { 
  Card, 
  Button, 
  Tabs, 
  Input, 
  Typography, 
  Row, 
  Col, 
  Space, 
  Alert, 
  Tag, 
  Modal as AntdModal,
  Segmented
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
  Smartphone
} from "lucide-react";

const { Text } = Typography;




interface DetailRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const DetailRow = ({ label, value, icon }: DetailRowProps) => (
  <Card 
    size="small" 
    className="border border-slate-100 hover:border-indigo-150 transition-all rounded-xl shadow-xs"
    bodyStyle={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}
  >
    <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100/75 flex items-center justify-center text-slate-500 shrink-0">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <Text type="secondary" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }} className="block leading-none">{label}</Text>
      <Text strong style={{ fontSize: 11 }} className="text-gray-800 block mt-1 truncate" title={value}>
        {value}
      </Text>
    </div>
  </Card>
);

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  // Tab control: "info" | "password" - persisted on refresh
  
  // Tab control: "info" | "password" - persisted on refresh
  const [activeTab, setActiveTab] = useState<"info" | "password">((() => {
    return (localStorage.getItem("profile_active_tab") as "info" | "password") || "info";
  })());

  const handleTabChange = (tab: "info" | "password") => {
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
    }

    // Fetch fresh details from backend to resolve manager/zonal manager/coordinator names
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
      // Save to localstorage
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
      // Save to localstorage
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

  // Handler: Run DB Migrations (Admin only)
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

  // Handler: Run Retroactive Base Location Policy adjustments (Admin only)
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
    } finally {
      setPassLoading(false);
    }
  };

  if (!user) return null;

  const renderPersonalInfo = () => (
    <div className="space-y-4">
      {/* Category 1: Contact & Personal Info */}
      <Card
        size="small"
        title={
          <Space>
            <User className="w-4 h-4 text-indigo-605" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-805">Contact & Personal Info</span>
          </Space>
        }
        className="border border-slate-100 rounded-2xl shadow-xs"
        bodyStyle={{ padding: "16px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Address */}
          <Card 
            size="small" 
            className="border border-slate-100 hover:border-indigo-150 transition-all rounded-xl shadow-xs"
            bodyStyle={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}
          >
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <Text type="secondary" style={{ fontSize: 9, fontWeight: 705, textTransform: "uppercase", letterSpacing: "0.04em" }} className="block leading-none">Email Address</Text>
                {!isEditingEmail && (
                  <Button
                    type="text"
                    size="small"
                    icon={<span className="text-[10px] text-indigo-600 font-bold hover:underline">Edit</span>}
                    onClick={() => {
                      setTempEmail(user.mail_id || "");
                      setIsEditingEmail(true);
                      setIsEditingMobile(false);
                      setNotice(null);
                    }}
                    style={{ height: "auto", padding: 0 }}
                  />
                )}
              </div>
              {isEditingEmail ? (
                <div className="flex items-center gap-1.5 w-full mt-1.5">
                  <Input
                    type="email"
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    size="small"
                    disabled={emailLoading}
                    autoFocus
                    className="flex-1"
                    style={{ fontSize: 11 }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleSaveEmail}
                    loading={emailLoading}
                    style={{ fontSize: 10 }}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={handleCancelEmail}
                    disabled={emailLoading}
                    style={{ fontSize: 10 }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Text strong style={{ fontSize: 11 }} className="text-gray-800 block mt-1 truncate" title={user.mail_id || "-"}>
                  {user.mail_id || "-"}
                </Text>
              )}
            </div>
          </Card>

          {/* Mobile Number */}
          <Card 
            size="small" 
            className="border border-slate-100 hover:border-indigo-150 transition-all rounded-xl shadow-xs"
            bodyStyle={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}
          >
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <Text type="secondary" style={{ fontSize: 9, fontWeight: 705, textTransform: "uppercase", letterSpacing: "0.04em" }} className="block leading-none">Mobile Number</Text>
                {!isEditingMobile && (
                  <Button
                    type="text"
                    size="small"
                    icon={<span className="text-[10px] text-indigo-600 font-bold hover:underline">Edit</span>}
                    onClick={() => {
                      setTempMobile(user.mobile_number || "");
                      setIsEditingMobile(true);
                      setIsEditingEmail(false);
                      setNotice(null);
                    }}
                    style={{ height: "auto", padding: 0 }}
                  />
                )}
              </div>
              {isEditingMobile ? (
                <div className="flex items-center gap-1.5 w-full mt-1.5">
                  <Input
                    type="tel"
                    value={tempMobile}
                    onChange={(e) => setTempMobile(e.target.value)}
                    size="small"
                    disabled={mobileLoading}
                    autoFocus
                    className="flex-1"
                    style={{ fontSize: 11 }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleSaveMobile}
                    loading={mobileLoading}
                    style={{ fontSize: 10 }}
                  >
                    Save
                  </Button>
                  <Button
                    size="small"
                    onClick={handleCancelMobile}
                    disabled={mobileLoading}
                    style={{ fontSize: 10 }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Text strong style={{ fontSize: 11 }} className="text-gray-800 block mt-1 truncate" title={user.mobile_number || "-"}>
                  {user.mobile_number || "-"}
                </Text>
              )}
            </div>
          </Card>

          {/* Date of Birth */}
          <DetailRow
            label="Date of Birth"
            value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "-"}
            icon={<Calendar className="w-4 h-4 text-rose-500" />}
          />
        </div>
      </Card>

      {/* Category 2: Employment & Systems Details */}
      <Card
        size="small"
        title={
          <Space>
            <Briefcase className="w-4 h-4 text-indigo-605" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-805">Employment & Systems Details</span>
          </Space>
        }
        className="border border-slate-100 rounded-2xl shadow-xs"
        bodyStyle={{ padding: "16px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow
            label="Employee Code"
            value={user.e_code || "-"}
            icon={<CreditCard className="w-4 h-4 text-blue-500" />}
          />
          <DetailRow
            label="Grade"
            value={user.grade || "-"}
            icon={<Award className="w-4 h-4 text-purple-500" />}
          />
          <DetailRow
            label="Date of Joining"
            value={user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "-"}
            icon={<Calendar className="w-4 h-4 text-orange-500" />}
          />
          <DetailRow
            label="Device / Upkaran ID"
            value={user.e_upkaran_id || "-"}
            icon={<Smartphone className="w-4 h-4 text-slate-500" />}
          />
        </div>
      </Card>

      {/* Category 3: Reporting Hierarchy & Region */}
      <Card
        size="small"
        title={
          <Space>
            <Users className="w-4 h-4 text-indigo-655" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-805">Reporting Hierarchy & Region</span>
          </Space>
        }
        className="border border-slate-100 rounded-2xl shadow-xs"
        bodyStyle={{ padding: "16px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow
            label="Reporting Manager"
            value={user.manager || "-"}
            icon={<User className="w-4 h-4 text-indigo-500" />}
          />
          <DetailRow
            label="Zonal Manager"
            value={user.zonal_manager || "-"}
            icon={<Shield className="w-4 h-4 text-blue-600" />}
          />
          <DetailRow
            label="Coordinator"
            value={user.coordinator || "-"}
            icon={<Users className="w-4 h-4 text-cyan-500" />}
          />
          <DetailRow
            label="Zone"
            value={user.zone || "-"}
            icon={<MapPin className="w-4 h-4 text-amber-500" />}
          />
          <DetailRow
            label="District"
            value={user.district || "-"}
            icon={<MapPin className="w-4 h-4 text-rose-500" />}
          />
        </div>
      </Card>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-4">
      <Card
        size="small"
        title={
          <Space>
            <Lock className="w-4 h-4 text-indigo-605" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-805">Update Credentials</span>
          </Space>
        }
        className="border border-slate-100 rounded-2xl shadow-xs max-w-md mx-auto"
        bodyStyle={{ padding: "20px" }}
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passNotice && (
            <Alert
              message={passNotice.text}
              type={passNotice.type === "success" ? "success" : "error"}
              showIcon
              className="mb-4 text-xs"
            />
          )}

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Current Password</label>
            <Input.Password
              placeholder="Enter current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">New Password</label>
            <Input.Password
              placeholder="Enter new password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Confirm New Password</label>
            <Input.Password
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={passLoading}
            block
            className="bg-indigo-650 hover:bg-indigo-700 border-indigo-655 text-xs font-bold uppercase tracking-wider h-9 mt-2"
          >
            Update Password
          </Button>
        </form>

        {user && user.role === "Admin" && (
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">System Maintenance (Admin Only)</span>
              <p className="text-[9px] text-slate-400 mt-1">Rebuild performance indexes, run DB migrations, and apply base travel policy deductions.</p>
            </div>

            <div className="space-y-3">
              <div>
                <Button
                  type="primary"
                  danger
                  block
                  icon={<Database className="w-3.5 h-3.5" />}
                  loading={migrationLoading}
                  onClick={handleRunMigrations}
                  className="text-xs font-bold uppercase tracking-wide h-9"
                >
                  Run DB Migrations
                </Button>
                {migrationResult && (
                  <div className={`mt-1.5 p-2 rounded text-[9px] font-mono text-center border ${
                    migrationResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {migrationResult.message}
                  </div>
                )}
              </div>

              <div>
                <Button
                  type="primary"
                  danger
                  block
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  loading={policyLoading}
                  onClick={handleRunPolicyAdjustment}
                  className="text-xs font-bold uppercase tracking-wide h-9"
                >
                  Run Policy Adjustments
                </Button>
                {policyResult && (
                  <div className={`mt-1.5 p-2 rounded text-[9px] font-mono text-center border ${
                    policyResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {policyResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 animate-fadeIn text-[#212529]">
      {notice && (
        <Alert
          message={notice.text}
          type={notice.type === "success" ? "success" : "error"}
          showIcon
          closable
          onClose={() => setNotice(null)}
          className="mb-4 text-xs font-semibold"
        />
      )}

      {isMobile ? (
        // Mobile Layout
        <div className="space-y-4">
          {/* Mobile Profile Card Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50 rounded-2xl shadow-xl p-6 text-center relative overflow-hidden">
            {/* Avatar Circle */}
            <div className="relative h-24 w-24 mx-auto mb-3">
              <div className="h-full w-full rounded-full overflow-hidden border-4 border-slate-800 shadow-md select-none bg-slate-800 text-indigo-300 flex items-center justify-center font-bold text-3xl uppercase">
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

            <h3 className="text-base font-extrabold text-white mt-2 leading-tight">{user.name || "Employee"}</h3>
            <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-0.5">{user.designation || "Staff"}</p>
            
            <Tag color="geekblue" className="mt-2.5 uppercase font-bold text-[8px] tracking-wide px-3 rounded-full border border-indigo-400/30">
              {user.role}
            </Tag>
          </div>

          {/* Segmented Control Selector */}
          <Segmented
            block
            size="large"
            value={activeMobileSection}
            onChange={(val) => setActiveMobileSection(val as string)}
            options={[
              { label: 'Personal Info', value: 'personal' },
              { label: 'Security & Password', value: 'security' }
            ]}
            className="shadow-xs border border-slate-100 p-1 bg-white rounded-xl"
          />

          {/* Mobile Tab Content */}
          <div className="mt-2">
            {activeMobileSection === "personal" ? renderPersonalInfo() : renderSecurity()}
          </div>
        </div>
      ) : (
        // Desktop Layout
        <Row gutter={[24, 24]}>
          {/* Left Column - Sidebar profile summary */}
          <Col xs={24} lg={8}>
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50 rounded-2xl p-6 text-center lg:sticky lg:top-20 shadow-xl overflow-hidden">
              {/* Avatar Circle */}
              <div className="relative h-28 w-28 mx-auto mb-4">
                <div className="h-full w-full rounded-full overflow-hidden border-4 border-slate-700/30 shadow-md select-none bg-slate-800 text-indigo-300 flex items-center justify-center font-bold text-4xl uppercase">
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

              <h3 className="text-lg font-black text-white mt-4 leading-tight">{user.name || "Employee"}</h3>
              <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-1">{user.designation || "Staff Member"}</p>
              
              <Tag color="geekblue" className="mt-3 uppercase font-bold text-[8px] tracking-wide px-3 rounded-full border border-indigo-400/30">
                {user.role}
              </Tag>

              {/* Quick Details List in sidebar */}
              <div className="mt-6 pt-6 border-t border-slate-800 text-left space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Login ID:</span>
                  <span className="font-mono font-bold text-slate-200">{user.user_id}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Status:</span>
                  <Tag color="success" className="m-0 border-0 uppercase font-black text-[8px] tracking-wide">
                    Active
                  </Tag>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Employee Type:</span>
                  <span className="font-bold text-slate-250 uppercase text-[9px] tracking-wider">{user.type || "Staff"}</span>
                </div>
              </div>
            </div>
          </Col>

          {/* Right Column - Work Area Card with Tabs */}
          <Col xs={24} lg={16}>
            <Card 
              className="border border-slate-100 rounded-3xl shadow-sm min-h-[500px] overflow-hidden"
              bodyStyle={{ padding: "24px", display: "flex", flexDirection: "column", minHeight: "500px" }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={(key) => handleTabChange(key as "info" | "password")}
                className="flex-1 flex flex-col"
                items={[
                  {
                    key: "info",
                    label: (
                      <Space>
                        <User className="w-4 h-4" />
                        <span>Personal Info</span>
                      </Space>
                    ),
                    children: <div className="pt-2">{renderPersonalInfo()}</div>
                  },
                  {
                    key: "password",
                    label: (
                      <Space>
                        <Lock className="w-4 h-4" />
                        <span>Security & Password</span>
                      </Space>
                    ),
                    children: <div className="pt-2">{renderSecurity()}</div>
                  }
                ]}
              />

              {/* Footer */}
              <div className="mt-auto pt-6 border-t border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                <span>Cyrix Healthcare Pvt. Ltd.</span>
                <span>Designed &amp; Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-605 hover:underline">Sunil Bishnoi</a></span>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Profile Photo Crop & Adjust Modal */}
      <AntdModal
        title={
          <span className="font-bold text-sm uppercase text-gray-800 tracking-wide">
            Adjust Profile Photo
          </span>
        }
        open={showCropModal}
        onCancel={() => { setShowCropModal(false); setSelectedPhotoFile(null); setPreviewSrc(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setShowCropModal(false); setSelectedPhotoFile(null); setPreviewSrc(null); }} disabled={photoLoading}>
            Cancel
          </Button>,
          <Button key="upload" type="primary" onClick={handleUploadCropped} loading={photoLoading} className="bg-indigo-650 border-indigo-650">
            Confirm & Upload
          </Button>
        ]}
        width={380}
        centered
        destroyOnClose
      >
        <div className="py-4 flex flex-col items-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">
            Drag to position • Slide to Zoom
          </p>

          <div 
            className="relative w-60 h-60 bg-slate-100 rounded-lg overflow-hidden border border-gray-200 cursor-move select-none shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <img 
                src={previewSrc || ""} 
                alt="Crop Preview" 
                className="origin-center"
                onLoad={handleImageLoad}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  width: `${getDisplaySize().width}px`,
                  height: `${getDisplaySize().height}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  display: 'block'
                }}
              />
            </div>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <svg className="w-full h-full">
                <defs>
                  <mask id="circle-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    <circle cx="50%" cy="50%" r="90" fill="black" />
                  </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="black" fillOpacity="0.5" mask="url(#circle-mask)" />
                <circle cx="50%" cy="50%" r="90" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 2" />
              </svg>
            </div>
          </div>

          <div className="w-full max-w-xs mt-6 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              <span>Zoom</span>
              <span className="font-mono">{zoom.toFixed(1)}x</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="3" 
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-650"
            />
          </div>
        </div>
      </AntdModal>
    </div>
  );
}
