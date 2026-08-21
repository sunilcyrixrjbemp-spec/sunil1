import React, { useState, useRef } from "react";
import {
  Video,
  Image,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Eye,
  X
} from "lucide-react";
import { trcService } from "../../services/trcService";
import { toast } from "react-hot-toast";

interface MediaUploadSectionProps {
  stage: "Receive" | "Diagnosis" | "Spare" | "Repair" | "QC";
  trcId?: number;
  trcNumber?: string;
  videoRequired?: boolean;
  videoLabel?: string;
  maxVideoSeconds?: number;
  videoUrl?: string;
  onVideoChange?: (url: string) => void;
  photos?: { label: string; url: string; required?: boolean; key: string }[];
  onPhotoChange?: (key: string, url: string) => void;
  multiplePhotos?: string[];
  onMultiplePhotosChange?: (urls: string[]) => void;
}

export default function MediaUploadSection({
  stage,
  trcId,
  trcNumber,
  videoRequired = false,
  videoLabel = "Process Video",
  maxVideoSeconds = 60,
  videoUrl,
  onVideoChange,
  photos = [],
  onPhotoChange,
  multiplePhotos = [],
  onMultiplePhotosChange,
}: MediaUploadSectionProps) {
  const [uploadingKeys, setUploadingKeys] = useState<{ [key: string]: number }>({});
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(videoUrl || null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Handle Video Selection & Duration Validation
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file is too large (max 50MB)");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.src = localUrl;
    tempVideo.preload = "metadata";

    tempVideo.onloadedmetadata = async () => {
      window.URL.revokeObjectURL(tempVideo.src);
      const duration = Math.round(tempVideo.duration || 0);
      setVideoDuration(duration);

      if (maxVideoSeconds && duration > maxVideoSeconds) {
        toast.error(`Video duration exceeds ${maxVideoSeconds}s limit (${duration}s recorded). Please upload a shorter clip.`);
        return;
      }

      setVideoPreviewUrl(localUrl);

      // Perform upload to R2
      try {
        setUploadingKeys((prev) => ({ ...prev, video: 10 }));
        const result = await trcService.uploadMedia(
          file,
          stage,
          videoLabel,
          trcId,
          trcNumber,
          (percent) => {
            setUploadingKeys((prev) => ({ ...prev, video: percent }));
          }
        );

        if (result.success && result.url) {
          setVideoPreviewUrl(result.url);
          if (onVideoChange) onVideoChange(result.url);
          toast.success(`${videoLabel} uploaded successfully!`);
        }
      } catch (err: any) {
        toast.error("Video upload failed: " + err.message);
      } finally {
        setUploadingKeys((prev) => {
          const copy = { ...prev };
          delete copy.video;
          return copy;
        });
      }
    };
  };

  // Handle Single Named Photo Upload
  const handlePhotoSelect = async (key: string, label: string, file: File) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large (max 15MB)");
      return;
    }

    try {
      setUploadingKeys((prev) => ({ ...prev, [key]: 10 }));
      const result = await trcService.uploadMedia(
        file,
        stage,
        label,
        trcId,
        trcNumber,
        (percent) => {
          setUploadingKeys((prev) => ({ ...prev, [key]: percent }));
        }
      );

      if (result.success && result.url) {
        if (onPhotoChange) onPhotoChange(key, result.url);
        toast.success(`${label} uploaded!`);
      }
    } catch (err: any) {
      toast.error("Photo upload failed: " + err.message);
    } finally {
      setUploadingKeys((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  // Handle Multiple Generic Photos (e.g. Diagnosis / Repair Photos)
  const handleMultiplePhotosSelect = async (files: FileList) => {
    if (!files || files.length === 0) return;

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadKey = `multi_${Date.now()}_${i}`;
      try {
        setUploadingKeys((prev) => ({ ...prev, [uploadKey]: 20 }));
        const result = await trcService.uploadMedia(
          file,
          stage,
          `Photo #${(multiplePhotos?.length || 0) + i + 1}`,
          trcId,
          trcNumber,
          (percent) => {
            setUploadingKeys((prev) => ({ ...prev, [uploadKey]: percent }));
          }
        );
        if (result.success && result.url) {
          newUrls.push(result.url);
        }
      } catch (err) {
        // continue
      } finally {
        setUploadingKeys((prev) => {
          const copy = { ...prev };
          delete copy[uploadKey];
          return copy;
        });
      }
    }

    if (newUrls.length > 0 && onMultiplePhotosChange) {
      onMultiplePhotosChange([...multiplePhotos, ...newUrls]);
      toast.success(`${newUrls.length} photos uploaded successfully!`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Upload Section */}
      {videoLabel && (
        <div className="bg-white rounded-none border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
                <Video className="w-3.5 h-3.5" />
              </div>
              <div>
                <label className="label-lte mb-0 flex items-center gap-1">
                  {videoLabel}
                  {videoRequired && <span className="text-rose-600 font-bold">*</span>}
                </label>
                <p className="text-[10px] text-slate-500 font-medium">
                  {maxVideoSeconds ? `Max ${maxVideoSeconds}s video clip` : "Video documentation"} (MP4, WebM, MOV)
                </p>
              </div>
            </div>

            {videoPreviewUrl && (
              <span className="rounded-none text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Attached {videoDuration ? `(${videoDuration}s)` : ""}
              </span>
            )}
          </div>

          {/* Video Preview / Upload Area */}
          <div className="p-3">
            {videoPreviewUrl ? (
              <div className="relative rounded-none overflow-hidden bg-slate-950 aspect-video max-h-48 border border-slate-200 group">
                <video
                  src={videoPreviewUrl}
                  controls
                  className="w-full h-full object-contain rounded-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setVideoPreviewUrl(null);
                    if (onVideoChange) onVideoChange("");
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-none bg-slate-900/80 text-white hover:bg-rose-600 transition border border-white/20 shadow-xs"
                  title="Remove Video"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideoSelect}
                  className="hidden"
                  id={`video-upload-${stage}`}
                />
                <label
                  htmlFor={`video-upload-${stage}`}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 rounded-none p-4 flex flex-col items-center justify-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer transition-all text-center"
                >
                  {uploadingKeys.video ? (
                    <div className="space-y-2 w-full max-w-xs text-center">
                      <UploadCloud className="w-6 h-6 text-[#4A6A8A] mx-auto animate-bounce" />
                      <span className="text-xs font-extrabold text-slate-800 block">Uploading Video... {uploadingKeys.video}%</span>
                      <div className="w-full bg-slate-200 h-1.5 rounded-none overflow-hidden">
                        <div
                          className="bg-[#4A6A8A] h-full rounded-none transition-all duration-300"
                          style={{ width: `${uploadingKeys.video}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-0.5" />
                      <span className="text-xs font-extrabold text-slate-800">Record or Upload {videoLabel}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Click to browse or record video (Max {maxVideoSeconds}s)</span>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Named Photos Grid */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <label className="label-lte">Photo Documentation</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {photos.map((item) => {
              const isUploading = uploadingKeys[item.key] !== undefined;
              return (
                <div
                  key={item.key}
                  className="relative bg-white border border-slate-200 rounded-none overflow-hidden shadow-2xs p-2.5 text-center space-y-2"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block truncate">
                    {item.label} {item.required && <span className="text-rose-600">*</span>}
                  </span>

                  {item.url ? (
                    <div className="relative aspect-square rounded-none overflow-hidden border border-slate-200 group bg-slate-900">
                      <img
                        src={item.url}
                        alt={item.label}
                        className="w-full h-full object-cover rounded-none"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(item.url)}
                          className="p-1.5 bg-white text-slate-800 rounded-none hover:bg-slate-100 shadow-xs border border-slate-300 transition"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPhotoChange && onPhotoChange(item.key, "")}
                          className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-none shadow-xs transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        id={`photo-${item.key}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoSelect(item.key, item.label, file);
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor={`photo-${item.key}`}
                        className="aspect-square bg-slate-50 hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 rounded-none p-2 flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider shadow-2xs cursor-pointer transition-all"
                      >
                        {isUploading ? (
                          <div className="text-[10px] font-black text-[#4A6A8A] animate-pulse">
                            {uploadingKeys[item.key]}%
                          </div>
                        ) : (
                          <>
                            <Image className="w-5 h-5 text-slate-400 mb-0.5" />
                            <span className="text-[10px] font-bold text-slate-700">Upload</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multiple Photos Dropzone (for Diagnosis & Repair galleries) */}
      {onMultiplePhotosChange && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label-lte mb-0">Additional Photos & Circuit Views</label>
            <span className="rounded-none text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 border border-slate-200">
              {multiplePhotos.length} photo(s) attached
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {multiplePhotos.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-none overflow-hidden border border-slate-200 group bg-slate-900 shadow-2xs">
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover rounded-none" />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewModalUrl(url)}
                    className="p-1 bg-white text-slate-800 rounded-none hover:bg-slate-100 shadow-xs border border-slate-300 transition"
                    title="View"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = multiplePhotos.filter((_, i) => i !== idx);
                      onMultiplePhotosChange(updated);
                    }}
                    className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-none shadow-xs transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add More Photo Button */}
            <label className="aspect-square bg-slate-50 hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 rounded-none flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all shadow-2xs">
              <UploadCloud className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">+ Add</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleMultiplePhotosSelect(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white border border-slate-300 rounded-none p-1 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewModalUrl}
              alt="Full Preview"
              className="max-w-full max-h-[82vh] object-contain rounded-none"
            />
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-900 text-white rounded-none border border-slate-700 hover:bg-rose-700 transition-all font-black text-xs shadow-md"
              title="Close Preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
