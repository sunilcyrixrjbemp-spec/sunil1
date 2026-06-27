import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import { 
  Pencil, 
  Check, 
  X, 
  Lock, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Database, 
  Briefcase, 
  Award, 
  Monitor, 
  Users, 
  Navigation, 
  MapPin, 
  Eye, 
  EyeOff 
} from "lucide-react";

const LteSpinner = () => (
  <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
    <span className="absolute w-full h-full border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></span>
  </div>
);



interface DetailRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const DetailRow = ({ label, value, icon }: DetailRowProps) => (
  <div className="p-3 bg-gray-50 border border-gray-200 rounded flex items-center justify-between text-xs gap-3 hover:bg-gray-100 transition-colors">
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
      <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px] truncate">{label}</span>
    </div>
    <span className="text-gray-800 font-semibold truncate text-right pl-2 shrink-0">{value}</span>
  </div>
);

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  
  // Tab control: "info" | "password" - persisted on refresh
  const [activeTab, setActiveTab] = useState<"info" | "password">((() => {
    return (localStorage.getItem("profile_active_tab") as "info" | "password") || "info";
  }));

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
  const [showPass, setShowPass] = useState(false);
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
        text: err.response?.data?.detail || "Failed to update password. Please check your credentials."
      });
    } finally {
      setPassLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fadeIn text-[#212529]">
      {/* Header Info */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
          User Profile
        </h2>
        <p className="text-gray-500 text-xs mt-1">Manage your contact credentials and view system permissions configurations.</p>
      </div>

      {notice && (
        <div className={`p-3 border rounded text-xs flex items-center gap-2 shadow-sm animate-fadeIn ${
          notice.type === "success" 
            ? "bg-green-50 border-green-200 text-green-700 font-semibold" 
            : "bg-red-50 border-red-200 text-red-700 font-semibold"
        }`}>
          <span className="font-bold">{notice.type === "success" ? "✓" : "!"}</span>
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Main Avatar / Card */}
        <div className="lg:col-span-1">
          <div className="card-lte-primary p-6 text-center sticky top-20">
            {/* Circle avatar with 1 capitalized initial */}
            <div className="h-20 w-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-2xl mx-auto border border-blue-200 shadow-sm uppercase">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            
            <h3 className="text-base font-bold text-gray-800 mt-4 leading-tight">{user.name || "Employee"}</h3>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">{user.designation || "Staff Member"}</p>
            <span className="inline-block mt-3 px-3.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 border border-gray-200 text-gray-600">
              {user.role}
            </span>

            {/* Quick Stats/Summary in left card */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-left space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Login ID:</span>
                <span className="font-mono font-bold text-gray-850">{user.user_id}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Status:</span>
                <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 font-bold uppercase text-[9px] tracking-wider">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Employee Type:</span>
                <span className="font-semibold text-gray-800 uppercase text-[9px] tracking-wider">{user.type || "Staff"}</span>
              </div>
            </div>
          </div>
        </div>
 
        {/* Right Column - Work Area Card with Tabs */}
        <div className="lg:col-span-2">
          <div className="card-lte border-t-3 border-t-[#17a2b8] flex flex-col min-h-[500px]">
            
            {/* Header Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-stretch">
              <button
                onClick={() => {
                  setNotice(null);
                  handleTabChange("info");
                }}
                className={`flex-1 py-3 px-6 text-center sm:text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
                  activeTab === "info"
                    ? "bg-white text-blue-600 border-b-2 border-b-blue-600 sm:border-b-0 sm:border-l-2 sm:border-l-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <User className="w-4 h-4" />
                Profile Information
              </button>
              <button
                onClick={() => {
                  setPassNotice(null);
                  handleTabChange("password");
                }}
                className={`flex-1 py-3 px-6 text-center sm:text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l border-gray-200 cursor-pointer ${
                  activeTab === "password"
                    ? "bg-white text-blue-600 border-b-2 border-b-blue-600 sm:border-b-0 sm:border-l-2 sm:border-l-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Lock className="w-4 h-4 text-blue-600" />
                Security Settings
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col justify-between">
              {activeTab === "info" ? (
                /* Profile Information Grid Layout */
                <div className="p-6 space-y-6 flex-1">
                  
                  {/* Category 1: Contact details */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 border-b border-gray-200 pb-2 mb-3.5 flex items-center gap-2">
<User className="w-3.5 h-3.5 text-blue-600" />
                      Contact & Personal Info
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Email Address (Editable Inline) */}
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded flex flex-col justify-between text-xs gap-2 min-h-[62px] hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
<Mail className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px] truncate">Email Address</span>
                          </div>
                          {!isEditingEmail && (
                            <button
                              onClick={() => {
                                setTempEmail(user.mail_id || "");
                                setIsEditingEmail(true);
                                setIsEditingMobile(false);
                                setNotice(null);
                              }}
                              className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-200 transition-all shrink-0 bg-transparent border-0 outline-none"
                              title="Edit Email Address"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {isEditingEmail ? (
                          <div className="flex items-center gap-1.5 w-full animate-fadeIn mt-1">
                            <input
                              type="email"
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              className="input-lte h-7"
                              disabled={emailLoading}
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEmail}
                              disabled={emailLoading}
                              className="h-7 w-7 rounded bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center shrink-0 disabled:opacity-50 border-0 cursor-pointer"
                              title="Save"
                            >
                              {emailLoading ? <LteSpinner /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={handleCancelEmail}
                              disabled={emailLoading}
                              className="h-7 w-7 rounded bg-white hover:bg-gray-100 text-gray-500 transition-all border border-gray-350 flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-800 font-semibold truncate pl-[26px]">{user.mail_id || "-"}</span>
                        )}
                      </div>

                      {/* Mobile Number (Editable Inline) */}
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded flex flex-col justify-between text-xs gap-2 min-h-[62px] hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
<Phone className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px] truncate">Mobile Number</span>
                          </div>
                          {!isEditingMobile && (
                            <button
                              onClick={() => {
                                setTempMobile(user.mobile_number || "");
                                setIsEditingMobile(true);
                                setIsEditingEmail(false);
                                setNotice(null);
                              }}
                              className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-200 transition-all shrink-0 bg-transparent border-0 outline-none"
                              title="Edit Mobile Number"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {isEditingMobile ? (
                          <div className="flex items-center gap-1.5 w-full animate-fadeIn mt-1">
                            <input
                              type="tel"
                              value={tempMobile}
                              onChange={(e) => setTempMobile(e.target.value)}
                              className="input-lte h-7"
                              disabled={mobileLoading}
                              autoFocus
                            />
                            <button
                              onClick={handleSaveMobile}
                              disabled={mobileLoading}
                              className="h-7 w-7 rounded bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center shrink-0 disabled:opacity-50 border-0 cursor-pointer"
                              title="Save"
                            >
                              {mobileLoading ? <LteSpinner /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={handleCancelMobile}
                              disabled={mobileLoading}
                              className="h-7 w-7 rounded bg-white hover:bg-gray-100 text-gray-500 transition-all border border-gray-350 flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-800 font-semibold truncate pl-[26px]">{user.mobile_number || "-"}</span>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <DetailRow
                        label="Date of Birth"
                        value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "-"}
                        icon={
                          <Calendar className="w-4 h-4" />
                        }
                      />
                    </div>
                  </div>

                  {/* Category 2: Employment details */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 border-b border-gray-200 pb-2 mb-3.5 flex items-center gap-2">
<Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      Employment & Systems Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Employee Code */}
                      <DetailRow
                        label="Employee Code"
                        value={user.e_code || "-"}
                        icon={
                          <Database className="w-4 h-4" />
                        }
                      />

                      {/* Grade */}
                      <DetailRow
                        label="Grade"
                        value={user.grade || "-"}
                        icon={
                          <Award className="w-4 h-4" />
                        }
                      />

                      {/* Date of Joining */}
                      <DetailRow
                        label="Date of Joining"
                        value={user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "-"}
                        icon={
                          <Calendar className="w-4 h-4" />
                        }
                      />

                      {/* Device / Upkaran ID */}
                      <DetailRow
                        label="Device / Upkaran ID"
                        value={user.e_upkaran_id || "-"}
                        icon={
                          <Monitor className="w-4 h-4" />
                        }
                      />
                    </div>
                  </div>

                  {/* Category 3: Reporting hierarchy */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 border-b border-gray-200 pb-2 mb-3.5 flex items-center gap-2">
<Users className="w-3.5 h-3.5 text-blue-600" />
                      Reporting Hierarchy & Region
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Reporting Manager */}
                      <DetailRow
                        label="Reporting Manager"
                        value={user.manager || "-"}
                        icon={
                          <User className="w-4 h-4" />
                        }
                      />

                      {/* Zonal Manager */}
                      <DetailRow
                        label="Zonal Manager"
                        value={user.zonal_manager || "-"}
                        icon={
                          <User className="w-4 h-4" />
                        }
                      />

                      {/* Coordinator */}
                      <DetailRow
                        label="Coordinator"
                        value={user.coordinator || "-"}
                        icon={
                          <Users className="w-4 h-4" />
                        }
                      />

                      {/* Zone */}
                      <DetailRow
                        label="Zone"
                        value={user.zone || "-"}
                        icon={
                          <Navigation className="w-4 h-4" />
                        }
                      />

                      {/* District */}
                      <DetailRow
                        label="District"
                        value={user.district || "-"}
                        icon={
                          <MapPin className="w-4 h-4" />
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Change Password / Security Tab Content Workspace */
                <div className="p-6 space-y-6 flex-1 max-w-md mx-auto w-full animate-fadeIn">
                  <div className="text-center space-y-1 pb-2">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" /> Update Credentials
                    </h4>
                    <p className="text-[10px] text-gray-500">
                      Enter your current password and your new choice below.
                    </p>
                  </div>

                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passNotice && (
                      <div className={`p-3 border rounded text-xs font-semibold ${
                        passNotice.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                      }`}>
                        {passNotice.text}
                      </div>
                    )}

                    <div>
                      <label className="label-lte">Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="input-lte"
                        required
                      />
                    </div>

                    <div>
                      <label className="label-lte">New Password</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="input-lte pr-9"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 bg-transparent border-0 outline-none"
                        >
                          {showPass ? (
<EyeOff className="w-4 h-4" />
                          ) : (
<Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="label-lte">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-lte"
                        required
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passLoading}
                        className="btn-lte-primary w-full h-9 disabled:opacity-50"
                      >
                        {passLoading ? (
                          <>
                            <LteSpinner />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <span>Update Password</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase tracking-widest flex justify-between shrink-0">
                <span>Cyrix Healthcare Pvt. Ltd.</span>
                <span>Designed & Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer">Sunil Bishnoi</a></span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
