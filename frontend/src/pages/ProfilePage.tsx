import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import api from "../services/api";
import { adminService } from "../services/adminService";
import toast from "react-hot-toast";


const LteSpinner = () => (
  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 border-t-blue-600 inline-block mr-1.5 shrink-0"></span>
);



interface DetailRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  iconBg?: string;
}

const DetailRow = ({ label, value, icon, iconBg = "bg-slate-600" }: DetailRowProps) => (
  <div className="info-box-lte animate-fadeIn">
    <div className={`info-box-icon ${iconBg} text-white flex items-center justify-center`}>
      {icon}
    </div>
    <div className="info-box-content">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">{label}</span>
      <span className="text-xs font-black text-gray-800 block mt-0.5 truncate" title={value}>
        {value}
      </span>
    </div>
  </div>
);

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // System Maintenance
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);


  // Check screen size for mobile view
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [activeMobileSection, setActiveMobileSection] = useState<string>("personal");

  // States for Profile Crop and Zoom Modal
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const TARGET_SIZE = 200 * 1024; // 200 KB
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1200; // Profile pictures don't need to be huge
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

        let lo = 0.1, hi = 0.95, quality = 0.75;
        let bestBlob: Blob | null = null;
        const tryQuality = (q: number, done: (blob: Blob) => void) => {
          canvas.toBlob((blob) => {
            if (blob) done(blob);
            else resolve(file);
          }, "image/jpeg", q);
        };
        const iterate = (pass: number, lo: number, hi: number) => {
          quality = (lo + hi) / 2;
          tryQuality(quality, (blob) => {
            bestBlob = blob;
            if (pass >= 5 || Math.abs(blob.size - TARGET_SIZE) < 4096) {
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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
  };

  const getDisplaySize = () => {
    if (!imgNaturalSize.width || !imgNaturalSize.height) {
      return { width: 256, height: 256 };
    }
    const { width, height } = imgNaturalSize;
    const aspect = width / height;
    
    if (aspect > 1) {
      return {
        width: 256 * aspect,
        height: 256
      };
    } else {
      return {
        width: 256,
        height: 256 / aspect
      };
    }
  };

  const generateCroppedImage = (): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const cropSize = 500;
        const viewportSize = 192; // Viewport size matching the circular mask diameter (r=96 => 192px)
        const ratio = cropSize / viewportSize;

        canvas.width = cropSize;
        canvas.height = cropSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(selectedPhotoFile!);
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cropSize, cropSize);

        const displaySize = getDisplaySize();
        const drawHeight = displaySize.height * ratio * zoom;
        const drawWidth = displaySize.width * ratio * zoom;

        const drawX = (cropSize - drawWidth) / 2 + position.x * ratio;
        const drawY = (cropSize - drawHeight) / 2 + position.y * ratio;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], selectedPhotoFile!.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now()
            });
            resolve(croppedFile);
          } else {
            resolve(selectedPhotoFile!);
          }
        }, "image/jpeg", 0.85);
      };
      img.src = previewSrc!;
    });
  };

  const handleUploadCropped = async () => {
    setPhotoLoading(true);
    setNotice(null);
    try {
      const cropped = await generateCroppedImage();
      const compressed = await compressImage(cropped);
      
      if (compressed.size > 2 * 1024 * 1024) {
        setNotice({ type: "error", text: "Compressed image file size must be less than 2MB." });
        setPhotoLoading(false);
        return;
      }
      
      const updatedUser = await authService.updateProfilePhoto(compressed);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const cacheKey = `cached_avatar_${updatedUser.user_id || updatedUser.id || 'default'}`;
        localStorage.setItem(cacheKey, base64);
        setAvatarUrl(base64);
        setAvatarError(false);
        window.dispatchEvent(new Event("storage"));
      };
      reader.readAsDataURL(compressed);
      
      setNotice({ type: "success", text: "Profile picture updated successfully!" });
      setShowCropModal(false);
      setSelectedPhotoFile(null);
      setPreviewSrc(null);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      console.error(err);
      setNotice({ type: "error", text: err.response?.data?.detail || "Failed to upload cropped photo to Google Drive." });
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;
    
    setPhotoLoading(true);
    setNotice(null);
    try {
      const updatedUser = await authService.deleteProfilePhoto();
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      const cacheKey = `cached_avatar_${updatedUser.user_id || updatedUser.id || 'default'}`;
      localStorage.removeItem(cacheKey);
      setAvatarUrl(null);
      setAvatarError(false);
      
      window.dispatchEvent(new Event("storage"));
      
      setNotice({ type: "success", text: "Profile picture removed successfully!" });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      console.error(err);
      setNotice({ type: "error", text: err.response?.data?.detail || "Failed to remove profile photo." });
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      setNotice({ type: "error", text: "Only JPG, JPEG, and PNG images are allowed." });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ type: "error", text: "Selected file is too large. Please choose an image smaller than 10MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewSrc(reader.result as string);
      setSelectedPhotoFile(file);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setShowCropModal(true);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };
  
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

  if (isMobile) {
    return (
      <div className="space-y-4 pb-20 text-gray-800 text-xs animate-fadeIn" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        
        {/* Profile Card Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden text-center relative p-6 animate-scaleIn">
          
          {/* Avatar Area */}
          <div className="relative h-24 w-24 mx-auto mb-3">
            <label htmlFor="profile-photo-input-mob" className="cursor-pointer block relative h-full w-full rounded-full overflow-hidden border-4 border-slate-800 shadow-md select-none bg-slate-850">
              {photoLoading ? (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white z-10">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-white inline-block"></span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 flex flex-col items-center justify-center text-white opacity-0 hover:opacity-100 transition-all z-10">
                  <i className="fas fa-camera text-sm mb-0.5 text-[#a5d8e8]"></i>
                  <span className="text-[8px] font-black uppercase tracking-wider">Change</span>
                </div>
              )}
              {avatarUrl && !avatarError ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  className="h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="h-full w-full bg-slate-800 text-[#a5d8e8] flex items-center justify-center font-black text-3xl uppercase">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
            </label>
            <input 
              type="file" 
              id="profile-photo-input-mob" 
              accept="image/jpeg,image/png,image/jpg" 
              onChange={handlePhotoChange} 
              className="hidden" 
              disabled={photoLoading}
            />
          </div>

          {avatarUrl && !avatarError && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-[9px] text-rose-400 font-extrabold uppercase tracking-wider bg-transparent border-0 cursor-pointer flex items-center gap-1 mx-auto hover:text-rose-350 transition-colors hover:underline"
              disabled={photoLoading}
            >
              <i className="fas fa-trash-alt text-[8px]"></i>
              <span>Remove Photo</span>
            </button>
          )}

          <h3 className="text-base font-extrabold text-white mt-2 leading-tight">{user.name || "Employee"}</h3>
          <p className="text-[10px] text-[#a5d8e8] font-black uppercase tracking-wider mt-0.5">{user.designation || "Staff"}</p>
          
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#a5d8e8]/20 text-[#a5d8e8] border border-[#a5d8e8]/30 shadow-sm">
            {user.role}
          </span>
        </div>

        {/* Premium Settings Segment Control (Tab Menu) */}
        <div className="flex border border-slate-200 bg-white p-1 rounded-xl shadow-sm text-[10px] font-bold text-slate-500">
          <button
            type="button"
            onClick={() => setActiveMobileSection("personal")}
            style={{
              backgroundColor: activeMobileSection === "personal" ? "#a5d8e8" : undefined
            }}
            className={`flex-1 py-2 rounded-lg border-0 transition-all cursor-pointer font-extrabold uppercase tracking-wider ${
              activeMobileSection === "personal" ? "text-slate-800 shadow-xs" : "bg-transparent text-slate-400 hover:text-slate-800"
            }`}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileSection("security")}
            style={{
              backgroundColor: activeMobileSection === "security" ? "#a5d8e8" : undefined
            }}
            className={`flex-1 py-2 rounded-lg border-0 transition-all cursor-pointer font-extrabold uppercase tracking-wider ${
              activeMobileSection === "security" ? "text-slate-800 shadow-xs" : "bg-transparent text-slate-400 hover:text-slate-800"
            }`}
          >
            Security
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileSection("permissions")}
            style={{
              backgroundColor: activeMobileSection === "permissions" ? "#a5d8e8" : undefined
            }}
            className={`flex-1 py-2 rounded-lg border-0 transition-all cursor-pointer font-extrabold uppercase tracking-wider ${
              activeMobileSection === "permissions" ? "text-slate-800 shadow-xs" : "bg-transparent text-slate-400 hover:text-slate-800"
            }`}
          >
            System Info
          </button>
        </div>

        {/* Tab Content Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 min-h-[220px]">
          
          {/* Section 1: Contact & Personal Info */}
          {activeMobileSection === "personal" && (
            <div className="grid grid-cols-1 gap-3 animate-fadeIn">
              <DetailRow
                label="Login ID / User ID"
                value={user.user_id}
                icon={<i className="fas fa-user-lock text-base"></i>}
                iconBg="bg-indigo-700"
              />
              
              {/* Email Address (Editable Inline) */}
              <div className="info-box-lte animate-fadeIn">
                <div className="info-box-icon bg-cyan-600 text-white flex items-center justify-center">
                  <i className="fas fa-envelope text-base"></i>
                </div>
                <div className="info-box-content flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Email Address</span>
                    {!isEditingEmail && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempEmail(user.mail_id || "");
                          setIsEditingEmail(true);
                          setIsEditingMobile(false);
                          setNotice(null);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all shrink-0 bg-transparent border-0 outline-none cursor-pointer"
                        title="Edit Email Address"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                    )}
                  </div>
                  {isEditingEmail ? (
                    <div className="flex items-center gap-1.5 w-full mt-1">
                      <input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        className="input-lte h-7 py-0.5 text-xs flex-1"
                        disabled={emailLoading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveEmail}
                        disabled={emailLoading}
                        className="px-2 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] border-0 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEmail}
                        disabled={emailLoading}
                        className="px-2 h-7 rounded bg-white hover:bg-slate-100 text-slate-650 border border-slate-350 font-bold text-[9px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-gray-900 block truncate mt-0.5">{user.mail_id || "-"}</span>
                  )}
                </div>
              </div>

              {/* Mobile Number (Editable Inline) */}
              <div className="info-box-lte animate-fadeIn">
                <div className="info-box-icon bg-emerald-600 text-white flex items-center justify-center">
                  <i className="fas fa-phone text-base"></i>
                </div>
                <div className="info-box-content flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Mobile Number</span>
                    {!isEditingMobile && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempMobile(user.mobile_number || "");
                          setIsEditingMobile(true);
                          setIsEditingEmail(false);
                          setNotice(null);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all shrink-0 bg-transparent border-0 outline-none cursor-pointer"
                        title="Edit Mobile Number"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                    )}
                  </div>
                  {isEditingMobile ? (
                    <div className="flex items-center gap-1.5 w-full mt-1">
                      <input
                        type="tel"
                        value={tempMobile}
                        onChange={(e) => setTempMobile(e.target.value)}
                        className="input-lte h-7 py-0.5 text-xs flex-1"
                        disabled={mobileLoading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveMobile}
                        disabled={mobileLoading}
                        className="px-2 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] transition-all border-0 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelMobile}
                        disabled={mobileLoading}
                        className="px-2 h-7 rounded bg-white hover:bg-slate-100 text-slate-655 border border-slate-350 font-bold text-[9px] transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-gray-900 block truncate mt-0.5">{user.mobile_number || "-"}</span>
                  )}
                </div>
              </div>
              
              {/* Date of Birth */}
              <DetailRow
                label="Date of Birth"
                value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "-"}
                icon={<i className="fas fa-calendar-alt text-base"></i>}
                iconBg="bg-rose-500"
              />
            </div>
          )}

          {/* Section 2: Security & Password */}
          {activeMobileSection === "security" && (
            <div className="animate-fadeIn">
              {passNotice && (
                <div className={`mb-3.5 p-2.5 border rounded text-[11px] font-bold ${
                  passNotice.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {passNotice.text}
                </div>
              )}
              <form onSubmit={handlePasswordChange} className="space-y-3.5">
                <div>
                  <label className="label-lte text-[9px]">Current Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input-lte text-xs font-semibold h-8"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="label-lte text-[9px]">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-lte text-xs font-semibold h-8"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="label-lte text-[9px]">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-lte text-xs font-semibold h-8"
                    placeholder="Repeat new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white rounded border-0 cursor-pointer font-black text-xs uppercase mt-4"
                >
                  {passLoading ? "Updating..." : "Change Password"}
                </button>
              </form>

              {user && user.role === "Admin" && (
                <div className="mt-5 pt-5 border-t border-slate-200 space-y-2.5 animate-fadeIn">
                  <div className="text-center">
                    <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <i className="fas fa-exclamation-triangle"></i> System Maintenance
                    </h5>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Update database schema and rebuild all performance indexes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunMigrations}
                    disabled={migrationLoading}
                    className="w-full h-8 rounded font-extrabold text-[10px] uppercase border-0 cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 text-white"
                    style={{
                      background: migrationLoading ? "#cbd5e1" : "linear-gradient(135deg, #e11d48, #be123c)",
                      boxShadow: migrationLoading ? "none" : "0 2px 6px rgba(225,29,72,0.25)",
                      cursor: migrationLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {migrationLoading ? (
                      <>
                        <LteSpinner />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-database text-[10px]"></i>
                        <span>Run DB Migrations</span>
                      </>
                    )}
                  </button>
                  {migrationResult && (
                    <div className={`p-2 rounded text-[10px] font-bold text-center ${
                      migrationResult.success 
                        ? "bg-green-50 border border-green-200 text-green-700" 
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}>
                      {migrationResult.success ? "✅" : "❌"} {migrationResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section 3: System & Hierarchy Details */}
          {activeMobileSection === "permissions" && (
            <div className="grid grid-cols-1 gap-3 animate-fadeIn">
              <DetailRow
                label="Employee Code"
                value={user.e_code || "-"}
                icon={<i className="fas fa-id-badge text-base"></i>}
                iconBg="bg-blue-600"
              />
              <DetailRow
                label="Grade"
                value={user.grade || "-"}
                icon={<i className="fas fa-award text-base"></i>}
                iconBg="bg-purple-600"
              />
              <DetailRow
                label="Zone"
                value={user.zone || "-"}
                icon={<i className="fas fa-compass text-base"></i>}
                iconBg="bg-amber-600"
              />
              <DetailRow
                label="District"
                value={user.district || "-"}
                icon={<i className="fas fa-map-marker-alt text-base"></i>}
                iconBg="bg-rose-500"
              />
              <DetailRow
                label="Reporting Manager"
                value={user.manager || "-"}
                icon={<i className="fas fa-user-tie text-base"></i>}
                iconBg="bg-indigo-600"
              />
              <DetailRow
                label="Zonal Manager"
                value={user.zonal_manager || "-"}
                icon={<i className="fas fa-user-shield text-base"></i>}
                iconBg="bg-blue-800"
              />
              <DetailRow
                label="Coordinator"
                value={user.coordinator || "-"}
                icon={<i className="fas fa-users text-base"></i>}
                iconBg="bg-cyan-600"
              />
              <DetailRow
                label="Device / Upkaran ID"
                value={user.e_upkaran_id || "-"}
                icon={<i className="fas fa-desktop text-base"></i>}
                iconBg="bg-slate-700"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn text-[#212529]">

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
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50 rounded-2xl p-6 text-center lg:sticky lg:top-20 shadow-xl overflow-hidden animate-scaleIn">
            
            {/* Circle avatar with interactive upload */}
            <div className="relative h-28 w-28 mx-auto group mb-4">
              <label htmlFor="profile-photo-input" className="cursor-pointer block relative h-full w-full rounded-full overflow-hidden border-4 border-slate-700/30 shadow-md select-none group-hover:border-[#a5d8e8] transition-all">
                {photoLoading ? (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white z-10">
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-white inline-block"></span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all z-10">
                    <i className="fas fa-camera text-base mb-0.5 text-[#a5d8e8]"></i>
                    <span className="text-[8px] font-bold uppercase tracking-wider">Change</span>
                  </div>
                )}
                {avatarUrl && !avatarError ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    className="h-full w-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-800 text-[#a5d8e8] flex items-center justify-center font-black text-4xl uppercase">
                    {user && user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </label>
              <input 
                type="file" 
                id="profile-photo-input" 
                accept="image/jpeg,image/png,image/jpg" 
                onChange={handlePhotoChange} 
                className="hidden" 
                disabled={photoLoading}
              />
            </div>

            {avatarUrl && !avatarError && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="mt-1 text-[10px] text-rose-450 hover:text-rose-400 bg-transparent border-0 cursor-pointer font-bold uppercase tracking-wider flex items-center gap-1 mx-auto hover:underline"
                disabled={photoLoading}
              >
                <i className="fas fa-trash-alt text-xs"></i>
                <span>Remove Photo</span>
              </button>
            )}
            
            <h3 className="text-lg font-black text-white mt-4 leading-tight">{user.name || "Employee"}</h3>
            <p className="text-[10px] text-[#a5d8e8] font-black uppercase tracking-wider mt-1">{user.designation || "Staff Member"}</p>
            
            <span className="inline-block mt-3 px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#a5d8e8]/20 text-[#a5d8e8] border border-[#a5d8e8]/30 shadow-sm">
              {user.role}
            </span>

            {/* Quick Stats/Summary in left card */}
            <div className="mt-6 pt-6 border-t border-slate-800 text-left space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Login ID:</span>
                <span className="font-mono font-bold text-slate-200">{user.user_id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold uppercase text-[8px] tracking-wider">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Employee Type:</span>
                <span className="font-bold text-slate-200 uppercase text-[9px] tracking-wider">{user.type || "Staff"}</span>
              </div>
            </div>
          </div>
        </div>
 
        {/* Right Column - Work Area Card with Tabs */}
        <div className="lg:col-span-2">
          <div className="card border border-slate-100 flex flex-col min-h-[500px] bg-white rounded-3xl shadow-sm overflow-hidden">
            
            {/* Header Tabs */}
            <div className="border-b border-slate-100 bg-slate-50/50 flex flex-row items-stretch rounded-t-3xl overflow-hidden">
              <button
                onClick={() => {
                  setNotice(null);
                  handleTabChange("info");
                }}
                className={`flex-1 py-3.5 px-6 text-center text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer border-0 bg-transparent ${
                  activeTab === "info"
                    ? "bg-white text-indigo-700 border-b-2 border-b-indigo-600 font-extrabold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <i className="fas fa-user-circle text-indigo-500"></i>
                <span>Personal Info</span>
              </button>
              <button
                onClick={() => {
                  setPassNotice(null);
                  handleTabChange("password");
                }}
                className={`flex-1 py-3.5 px-6 text-center text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer border-0 bg-transparent border-l border-slate-100 ${
                  activeTab === "password"
                    ? "bg-white text-indigo-700 border-b-2 border-b-indigo-600 font-extrabold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <i className="fas fa-key text-[#a5d8e8]"></i>
                <span>Security & Password</span>
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col justify-between">
              {activeTab === "info" ? (
                /* Profile Information Grid Layout */
                <div className="p-6 space-y-6 flex-1 bg-white">
                  
                  {/* Category 1: Contact details */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#a5d8e8] border-b border-slate-200 pb-2 mb-3.5 flex items-center gap-2">
                      <i className="fas fa-user text-slate-500"></i>
                      Contact & Personal Info
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Email Address (Editable Inline) */}
                      <div className="info-box-lte animate-fadeIn">
                        <div className="info-box-icon bg-cyan-600 text-white flex items-center justify-center">
                          <i className="fas fa-envelope text-base"></i>
                        </div>
                        <div className="info-box-content flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Email Address</span>
                            {!isEditingEmail && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTempEmail(user.mail_id || "");
                                  setIsEditingEmail(true);
                                  setIsEditingMobile(false);
                                  setNotice(null);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all shrink-0 bg-transparent border-0 outline-none cursor-pointer"
                                title="Edit Email Address"
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            )}
                          </div>
                          {isEditingEmail ? (
                            <div className="flex items-center gap-1.5 w-full mt-1">
                              <input
                                type="email"
                                value={tempEmail}
                                onChange={(e) => setTempEmail(e.target.value)}
                                className="input-lte h-7 py-0.5 text-xs flex-1"
                                disabled={emailLoading}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleSaveEmail}
                                disabled={emailLoading}
                                className="px-2 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] border-0 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEmail}
                                disabled={emailLoading}
                                className="px-2 h-7 rounded bg-white hover:bg-slate-100 text-slate-650 border border-slate-350 font-bold text-[9px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-gray-900 block truncate mt-0.5">{user.mail_id || "-"}</span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Number (Editable Inline) */}
                      <div className="info-box-lte animate-fadeIn">
                        <div className="info-box-icon bg-emerald-600 text-white flex items-center justify-center">
                          <i className="fas fa-phone text-base"></i>
                        </div>
                        <div className="info-box-content flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Mobile Number</span>
                            {!isEditingMobile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTempMobile(user.mobile_number || "");
                                  setIsEditingMobile(true);
                                  setIsEditingEmail(false);
                                  setNotice(null);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all shrink-0 bg-transparent border-0 outline-none cursor-pointer"
                                title="Edit Mobile Number"
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            )}
                          </div>
                          {isEditingMobile ? (
                            <div className="flex items-center gap-1.5 w-full mt-1">
                              <input
                                type="tel"
                                value={tempMobile}
                                onChange={(e) => setTempMobile(e.target.value)}
                                className="input-lte h-7 py-0.5 text-xs flex-1"
                                disabled={mobileLoading}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleSaveMobile}
                                disabled={mobileLoading}
                                className="px-2 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] transition-all border-0 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelMobile}
                                disabled={mobileLoading}
                                className="px-2 h-7 rounded bg-white hover:bg-slate-100 text-slate-655 border border-slate-350 font-bold text-[9px] transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-gray-900 block truncate mt-0.5">{user.mobile_number || "-"}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Date of Birth */}
                      <DetailRow
                        label="Date of Birth"
                        value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "-"}
                        icon={<i className="fas fa-calendar-alt text-base"></i>}
                        iconBg="bg-rose-500"
                      />
                    </div>
                  </div>

                  {/* Category 2: Employment details */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#a5d8e8] border-b border-slate-200 pb-2 mb-3.5 flex items-center gap-2">
                      <i className="fas fa-briefcase text-slate-500"></i>
                      Employment & Systems Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Employee Code */}
                      <DetailRow
                        label="Employee Code"
                        value={user.e_code || "-"}
                        icon={<i className="fas fa-id-badge text-base"></i>}
                        iconBg="bg-blue-600"
                      />

                      {/* Grade */}
                      <DetailRow
                        label="Grade"
                        value={user.grade || "-"}
                        icon={<i className="fas fa-award text-base"></i>}
                        iconBg="bg-purple-600"
                      />

                      {/* Date of Joining */}
                      <DetailRow
                        label="Date of Joining"
                        value={user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "-"}
                        icon={<i className="fas fa-calendar-alt text-base"></i>}
                        iconBg="bg-orange-500"
                      />

                      {/* Device / Upkaran ID */}
                      <DetailRow
                        label="Device / Upkaran ID"
                        value={user.e_upkaran_id || "-"}
                        icon={<i className="fas fa-desktop text-base"></i>}
                        iconBg="bg-slate-700"
                      />
                    </div>
                  </div>

                  {/* Category 3: Reporting hierarchy */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#a5d8e8] border-b border-slate-200 pb-2 mb-3.5 flex items-center gap-2">
                      <i className="fas fa-users text-slate-500"></i>
                      Reporting Hierarchy & Region
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Reporting Manager */}
                      <DetailRow
                        label="Reporting Manager"
                        value={user.manager || "-"}
                        icon={<i className="fas fa-user-tie text-base"></i>}
                        iconBg="bg-indigo-600"
                      />

                      {/* Zonal Manager */}
                      <DetailRow
                        label="Zonal Manager"
                        value={user.zonal_manager || "-"}
                        icon={<i className="fas fa-user-shield text-base"></i>}
                        iconBg="bg-blue-800"
                      />

                      {/* Coordinator */}
                      <DetailRow
                        label="Coordinator"
                        value={user.coordinator || "-"}
                        icon={<i className="fas fa-users text-base"></i>}
                        iconBg="bg-cyan-600"
                      />

                      {/* Zone */}
                      <DetailRow
                        label="Zone"
                        value={user.zone || "-"}
                        icon={<i className="fas fa-compass text-base"></i>}
                        iconBg="bg-amber-600"
                      />

                      {/* District */}
                      <DetailRow
                        label="District"
                        value={user.district || "-"}
                        icon={<i className="fas fa-map-marker-alt text-base"></i>}
                        iconBg="bg-rose-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Change Password / Security Tab Content Workspace */
                <div className="p-6 space-y-6 flex-1 max-w-sm mx-auto w-full animate-fadeIn bg-white">
                  <div className="text-center space-y-1 pb-2">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center justify-center gap-2">
                      <i className="fas fa-shield-alt text-[#a5d8e8]"></i> Update Credentials
                    </h4>
                    <p className="text-[10px] text-slate-400">
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
                      <label className="label-lte text-[9px] uppercase tracking-wider text-slate-400">Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="input-lte h-9 py-1 px-3 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="label-lte text-[9px] uppercase tracking-wider text-slate-400">New Password</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="input-lte h-9 py-1 px-3 text-xs pr-9"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 bg-transparent border-0 outline-none cursor-pointer"
                        >
                          {showPass ? (
                            <i className="fas fa-eye-slash text-xs"></i>
                          ) : (
                            <i className="fas fa-eye text-xs"></i>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="label-lte text-[9px] uppercase tracking-wider text-slate-400">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-lte h-9 py-1 px-3 text-xs"
                        required
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passLoading}
                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase rounded border-0 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
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

                  {user && user.role === "Admin" && (
                    <div className="mt-6 pt-6 border-t border-slate-200 space-y-3 animate-fadeIn">
                      <div className="text-center">
                        <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
                          <i className="fas fa-exclamation-triangle"></i> System Maintenance
                        </h5>
                        <p className="text-[9px] text-slate-400 mt-1">
                          Update database schema and rebuild all performance indexes.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRunMigrations}
                        disabled={migrationLoading}
                        className="w-full h-8.5 rounded font-extrabold text-[10px] uppercase border-0 cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 text-white"
                        style={{
                          background: migrationLoading ? "#cbd5e1" : "linear-gradient(135deg, #e11d48, #be123c)",
                          boxShadow: migrationLoading ? "none" : "0 2px 6px rgba(225,29,72,0.25)",
                          cursor: migrationLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {migrationLoading ? (
                          <>
                            <LteSpinner />
                            <span>Running...</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-database text-[10px]"></i>
                            <span>Run DB Migrations</span>
                          </>
                        )}
                      </button>
                      {migrationResult && (
                        <div className={`p-2 rounded text-[10px] font-bold text-center ${
                          migrationResult.success 
                            ? "bg-green-50 border border-green-200 text-green-700" 
                            : "bg-red-50 border border-red-200 text-red-700"
                        }`}>
                          {migrationResult.success ? "✅" : "❌"} {migrationResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase tracking-widest flex flex-col sm:flex-row sm:justify-between gap-1 text-center sm:text-left shrink-0">
                <span>Cyrix Healthcare Pvt. Ltd.</span>
                <span>Designed &amp; Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" rel="noopener noreferrer">Sunil Bishnoi</a></span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-gray-150 mx-4 animate-scaleIn">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Adjust Profile Photo</h3>
              <button 
                type="button" 
                onClick={() => { setShowCropModal(false); setSelectedPhotoFile(null); setPreviewSrc(null); }} 
                className="text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer p-1"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-6 flex flex-col items-center">
              <p className="text-[10px] text-gray-500 font-semibold mb-4 uppercase tracking-wider text-center">
                Drag to position • Slide to Zoom
              </p>

              <div 
                className="relative w-64 h-64 bg-slate-100 rounded-lg overflow-hidden border border-gray-200 cursor-move select-none shadow-inner"
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
                        <circle cx="50%" cy="50%" r="96" fill="black" />
                      </mask>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="black" fillOpacity="0.5" mask="url(#circle-mask)" />
                    <circle cx="50%" cy="50%" r="96" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="4 2" />
                  </svg>
                </div>
              </div>

              <div className="w-full max-w-xs mt-6 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold uppercase tracking-wider">
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
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { setShowCropModal(false); setSelectedPhotoFile(null); setPreviewSrc(null); }}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded transition-colors bg-white cursor-pointer"
                disabled={photoLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadCropped}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors shadow-sm cursor-pointer border-0 active:scale-95 flex items-center gap-1.5"
                disabled={photoLoading}
              >
                {photoLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-slate-200 border-t-white inline-block shrink-0"></span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    <span>Confirm & Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
