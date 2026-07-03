import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";
import api from "../services/api";

const LteSpinner = () => (
  <span className="spinner-lte mr-1.5"></span>
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
  const [photoLoading, setPhotoLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

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
      <div className="space-y-4 pb-20 text-gray-800 text-xs animate-fadeIn">
        {/* Profile Card Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-650"></div>
          {/* Avatar */}
          <div className="relative h-20 w-20 mx-auto mb-3.5">
            <label htmlFor="profile-photo-input-mob" className="cursor-pointer block relative h-full w-full rounded-full overflow-hidden border-2 border-indigo-100 shadow-sm select-none">
              {photoLoading ? (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white z-10">
                  <i className="fas fa-sync-alt animate-spin text-sm"></i>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/0 active:bg-black/45 flex flex-col items-center justify-center text-white opacity-0 active:opacity-100 transition-all z-10">
                  <i className="fas fa-camera text-xs mb-0.5"></i>
                  <span className="text-[7px] font-bold uppercase tracking-wider">Edit</span>
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
                <div className="h-full w-full bg-indigo-50 text-indigo-650 flex items-center justify-center font-black text-2xl uppercase">
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
              className="text-[9px] text-red-505 font-extrabold uppercase tracking-wider bg-transparent border-0 cursor-pointer flex items-center gap-1 mx-auto"
              disabled={photoLoading}
            >
              <i className="fas fa-trash-alt"></i>
              <span>Remove Photo</span>
            </button>
          )}

          <h3 className="text-sm font-bold text-gray-900 mt-2">{user.name || "Employee"}</h3>
          <p className="text-[10px] text-indigo-650 font-bold uppercase tracking-wider mt-0.5">{user.designation || "Staff"}</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 border border-slate-200 text-slate-650">
            {user.role}
          </span>
        </div>

        {/* Accordion List Options */}
        <div className="space-y-2.5 text-left">
          {/* Section 1: Personal Details */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setActiveMobileSection(activeMobileSection === "personal" ? "" : "personal")}
              className="w-full px-4 py-3.5 flex items-center justify-between border-0 bg-white font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-user text-indigo-600"></i> Contact & Personal Info
              </span>
              <i className={`fas fa-chevron-${activeMobileSection === "personal" ? "up" : "down"} text-gray-400 text-[10px]`}></i>
            </button>

            {activeMobileSection === "personal" && (
              <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-gray-100 animate-fadeIn text-left">
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-400 font-bold">Login ID</span>
                  <span className="font-mono font-bold text-gray-850">{user.user_id}</span>
                </div>
                
                {/* Email address field */}
                <div className="border-b border-gray-50 pb-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400 font-bold">Email Address</span>
                    {!isEditingEmail && (
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(true)}
                        className="text-indigo-600 font-extrabold uppercase bg-transparent border-0 cursor-pointer text-[10px]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingEmail ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        className="input-lte text-xs font-semibold"
                        placeholder="Enter email"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={handleCancelEmail}
                          className="btn-lte-outline px-3 py-1 text-[10px] min-h-0"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEmail}
                          disabled={emailLoading}
                          className="btn-lte-primary px-3 py-1 text-[10px] min-h-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-gray-800 mt-1">{user.mail_id || "Not configured"}</p>
                  )}
                </div>

                {/* Mobile number field */}
                <div className="pb-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-450 font-bold">Mobile Number</span>
                    {!isEditingMobile && (
                      <button
                        type="button"
                        onClick={() => setIsEditingMobile(true)}
                        className="text-indigo-600 font-extrabold uppercase bg-transparent border-0 cursor-pointer text-[10px]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditingMobile ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={tempMobile}
                        onChange={(e) => setTempMobile(e.target.value)}
                        className="input-lte text-xs font-semibold"
                        placeholder="Enter mobile"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={handleCancelMobile}
                          className="btn-lte-outline px-3 py-1 text-[10px] min-h-0"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveMobile}
                          disabled={mobileLoading}
                          className="btn-lte-primary px-3 py-1 text-[10px] min-h-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-gray-800 mt-1">{user.mobile_number || "Not configured"}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Security & Password */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setActiveMobileSection(activeMobileSection === "security" ? "" : "security")}
              className="w-full px-4 py-3.5 flex items-center justify-between border-0 bg-white font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-lock text-indigo-600"></i> Security & Password
              </span>
              <i className={`fas fa-chevron-${activeMobileSection === "security" ? "up" : "down"} text-gray-400 text-[10px]`}></i>
            </button>

            {activeMobileSection === "security" && (
              <div className="px-4 pb-4 pt-1.5 border-t border-gray-100 animate-fadeIn text-left">
                {passNotice && (
                  <div className={`mb-3 p-2.5 border rounded text-[11px] font-bold ${
                    passNotice.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {passNotice.text}
                  </div>
                )}
                <form onSubmit={handlePasswordChange} className="space-y-3 text-left">
                  <div>
                    <label className="label-lte text-[9px]">Current Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="input-lte text-xs font-semibold"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="label-lte text-[9px]">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-lte text-xs font-semibold"
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div>
                    <label className="label-lte text-[9px]">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-lte text-xs font-semibold"
                      placeholder="Repeat new password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passLoading}
                    className="w-full btn-lte-primary py-2 text-xs uppercase font-extrabold mt-4"
                  >
                    {passLoading ? "Updating..." : "Change Password"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Section 3: System & Hierarchy Details */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setActiveMobileSection(activeMobileSection === "permissions" ? "" : "permissions")}
              className="w-full px-4 py-3.5 flex items-center justify-between border-0 bg-white font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-shield-alt text-[#0f172a]"></i> System & Hierarchy Details
              </span>
              <i className={`fas fa-chevron-${activeMobileSection === "permissions" ? "up" : "down"} text-gray-400 text-[10px]`}></i>
            </button>

            {activeMobileSection === "permissions" && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3.5 animate-fadeIn text-left">
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-400 font-bold">Employee Code</span>
                  <span className="font-bold text-gray-855">{user.e_code || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-400 font-bold">Grade</span>
                  <span className="font-bold text-gray-855">{user.grade || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-400 font-bold">Zone</span>
                  <span className="font-bold text-gray-855">{user.zone || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-455 font-bold">District</span>
                  <span className="font-bold text-gray-855">{user.district || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-400 font-bold">Reporting Manager</span>
                  <span className="font-bold text-gray-855">{user.manager || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-450 font-bold">Zonal Manager</span>
                  <span className="font-bold text-gray-855">{user.zonal_manager || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2">
                  <span className="text-gray-450 font-bold">Coordinator</span>
                  <span className="font-bold text-gray-855">{user.coordinator || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-455 font-bold">Device / Upkaran ID</span>
                  <span className="font-bold text-gray-855">{user.e_upkaran_id || "—"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
          <div className="card-lte-primary p-6 text-center lg:sticky lg:top-20 bg-white shadow-sm">
            {/* Circle avatar with interactive upload */}
            <div className="relative h-24 w-24 mx-auto group mb-4">
              <label htmlFor="profile-photo-input" className="cursor-pointer block relative h-full w-full rounded-full overflow-hidden border-2 border-blue-100 shadow-md select-none group-hover:border-blue-400 transition-all">
                {photoLoading ? (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white z-10">
                    <i className="fas fa-sync-alt animate-spin text-lg"></i>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all z-10">
                    <i className="fas fa-camera text-base mb-0.5"></i>
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
                  <div className="h-full w-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-3xl uppercase">
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
                className="mt-1 text-[10px] text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer font-bold uppercase tracking-wider flex items-center gap-1 mx-auto hover:underline"
                disabled={photoLoading}
              >
                <i className="fas fa-trash-alt text-xs"></i>
                <span>Remove Photo</span>
              </button>
            )}
            
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
          <div className="card-lte border-t-3 border-t-[#17a2b8] flex flex-col min-h-[500px] bg-white shadow-sm">
            
            {/* Header Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 flex flex-row items-stretch">
              <button
                onClick={() => {
                  setNotice(null);
                  handleTabChange("info");
                }}
                className={`flex-1 py-2.5 px-3 sm:py-3 sm:px-6 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 bg-transparent ${
                  activeTab === "info"
                    ? "bg-white text-blue-600 border-b-2 border-b-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <i className="fas fa-user"></i>
                <span>Info</span>
              </button>
              <button
                onClick={() => {
                  setPassNotice(null);
                  handleTabChange("password");
                }}
                className={`flex-1 py-2.5 px-3 sm:py-3 sm:px-6 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-l border-gray-200 cursor-pointer border-0 bg-transparent ${
                  activeTab === "password"
                    ? "bg-white text-blue-600 border-b-2 border-b-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <i className="fas fa-lock text-blue-600"></i>
                <span>Security</span>
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
                      <i className="fas fa-user text-blue-600"></i>
                      Contact & Personal Info
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Email Address (Editable Inline) */}
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded flex flex-col justify-between text-xs gap-2 min-h-[62px] hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2.5">
                            <i className="fas fa-envelope text-blue-600 shrink-0"></i>
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
                              <i className="fas fa-edit"></i>
                            </button>
                          )}
                        </div>
                        {isEditingEmail ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full animate-fadeIn mt-1">
                            <input
                              type="email"
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              className="input-lte h-8 flex-1"
                              disabled={emailLoading}
                              autoFocus
                            />
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={handleSaveEmail}
                                disabled={emailLoading}
                                className="px-3.5 h-8 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border-0 cursor-pointer shadow-sm"
                                title="Save changes"
                              >
                                {emailLoading ? <LteSpinner /> : <i className="fas fa-check"></i>}
                                <span>Save</span>
                              </button>
                              <button
                                onClick={handleCancelEmail}
                                disabled={emailLoading}
                                className="px-3.5 h-8 rounded bg-white hover:bg-gray-150 text-gray-600 border border-gray-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                                title="Cancel editing"
                              >
                                <i className="fas fa-times"></i>
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-805 font-semibold truncate pl-[26px]">{user.mail_id || "-"}</span>
                        )}
                      </div>
                      {/* Mobile Number (Editable Inline) */}
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded flex flex-col justify-between text-xs gap-2 min-h-[62px] hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <i className="fas fa-phone text-blue-600 shrink-0"></i>
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
                              <i className="fas fa-edit"></i>
                            </button>
                          )}
                        </div>
                        {isEditingMobile ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full animate-fadeIn mt-1">
                            <input
                              type="tel"
                              value={tempMobile}
                              onChange={(e) => setTempMobile(e.target.value)}
                              className="input-lte h-8 flex-1"
                              disabled={mobileLoading}
                              autoFocus
                            />
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={handleSaveMobile}
                                disabled={mobileLoading}
                                className="px-3.5 h-8 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border-0 cursor-pointer shadow-sm"
                                title="Save changes"
                              >
                                {mobileLoading ? <LteSpinner /> : <i className="fas fa-check"></i>}
                                <span>Save</span>
                              </button>
                              <button
                                onClick={handleCancelMobile}
                                disabled={mobileLoading}
                                className="px-3.5 h-8 rounded bg-white hover:bg-gray-150 text-gray-600 border border-gray-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                                title="Cancel editing"
                              >
                                <i className="fas fa-times"></i>
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-805 font-semibold truncate pl-[26px]">{user.mobile_number || "-"}</span>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <DetailRow
                        label="Date of Birth"
                        value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-GB") : "-"}
                        icon={
                          <i className="fas fa-calendar-alt"></i>
                        }
                      />
                    </div>
                  </div>

                  {/* Category 2: Employment details */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 border-b border-gray-200 pb-2 mb-3.5 flex items-center gap-2">
                      <i className="fas fa-briefcase text-blue-600"></i>
                      Employment & Systems Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Employee Code */}
                      <DetailRow
                        label="Employee Code"
                        value={user.e_code || "-"}
                        icon={
                          <i className="fas fa-database"></i>
                        }
                      />

                      {/* Grade */}
                      <DetailRow
                        label="Grade"
                        value={user.grade || "-"}
                        icon={
                          <i className="fas fa-award"></i>
                        }
                      />

                      {/* Date of Joining */}
                      <DetailRow
                        label="Date of Joining"
                        value={user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString("en-GB") : "-"}
                        icon={
                          <i className="fas fa-calendar-alt"></i>
                        }
                      />

                      {/* Device / Upkaran ID */}
                      <DetailRow
                        label="Device / Upkaran ID"
                        value={user.e_upkaran_id || "-"}
                        icon={
                          <i className="fas fa-desktop"></i>
                        }
                      />
                    </div>
                  </div>

                  {/* Category 3: Reporting hierarchy */}
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 border-b border-gray-200 pb-2 mb-3.5 flex items-center gap-2">
                      <i className="fas fa-users text-blue-600"></i>
                      Reporting Hierarchy & Region
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* Reporting Manager */}
                      <DetailRow
                        label="Reporting Manager"
                        value={user.manager || "-"}
                        icon={
                          <i className="fas fa-user-tie"></i>
                        }
                      />

                      {/* Zonal Manager */}
                      <DetailRow
                        label="Zonal Manager"
                        value={user.zonal_manager || "-"}
                        icon={
                          <i className="fas fa-user-shield"></i>
                        }
                      />

                      {/* Coordinator */}
                      <DetailRow
                        label="Coordinator"
                        value={user.coordinator || "-"}
                        icon={
                          <i className="fas fa-users"></i>
                        }
                      />

                      {/* Zone */}
                      <DetailRow
                        label="Zone"
                        value={user.zone || "-"}
                        icon={
                          <i className="fas fa-compass"></i>
                        }
                      />

                      {/* District */}
                      <DetailRow
                        label="District"
                        value={user.district || "-"}
                        icon={
                          <i className="fas fa-map-marker-alt"></i>
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
                      <i className="fas fa-lock text-blue-600"></i> Update Credentials
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
                            <i className="fas fa-eye-slash"></i>
                          ) : (
                            <i className="fas fa-eye"></i>
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
                    <span className="spinner-lte"></span>
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
