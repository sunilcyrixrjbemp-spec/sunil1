import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  X,
  RefreshCw,
  Barcode
} from "lucide-react";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
}: BarcodeScannerModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [manualInput, setManualInput] = useState<string>("");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start Camera Stream
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setHasCamera(true);
      } else {
        setHasCamera(false);
        setCameraError("Camera device or MediaDevices API not accessible in this environment.");
      }
    } catch (err: any) {
      setHasCamera(false);
      setCameraError(err.message || "Failed to initialize camera.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      onClose();
    }
  };

  const selectPresetBarcode = (code: string) => {
    onScan(code);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Live Barcode / QR Scanner</h3>
              <p className="text-[11px] text-slate-400">Align barcode inside the viewfinder box</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewfinder Area */}
        <div className="relative aspect-square sm:aspect-video bg-black flex items-center justify-center overflow-hidden">
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Reticle Scanner Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="relative w-64 h-44 border-2 border-blue-400/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Corner Highlights */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                  {/* Animated laser line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-bounce top-1/2" />
                </div>
              </div>

              {/* Camera Switcher Controls */}
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"))
                  }
                  className="px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-xs font-semibold text-white border border-slate-700 hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Flip Camera
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-400">
              <Camera className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-300 font-medium">Camera viewfinder unavailable</p>
              <p className="text-[11px] text-slate-500 mt-1">{cameraError || "Use direct text input or sample test barcode below."}</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Input & Presets */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Or enter barcode / serial number..."
                className="w-full bg-slate-800/90 text-white pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-700 focus:outline-hidden focus:border-blue-500 font-mono"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
            >
              Verify
            </button>
          </form>

          {/* Quick Demo Barcode Buttons */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
              Quick Test Barcodes:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["800489061567", "40323789", "CYRIX-ECG-2026", "VENT-098234", "BC-AJMER-1001"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => selectPresetBarcode(code)}
                  className="text-[11px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg border border-slate-700/80 transition"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
