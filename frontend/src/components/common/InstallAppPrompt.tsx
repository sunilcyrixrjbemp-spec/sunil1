import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Share, PlusSquare, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const InstallAppPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (navigator as any).standalone === true;
      return isStandaloneMedia || isNavStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
    setIsIOS(isIOSDevice);

    // Listen for Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsInstalledSuccess(true);
      setTimeout(() => setIsInstalledSuccess(false), 5000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // Don't render if already in standalone app mode
  if (isStandalone || isDismissed) {
    if (isInstalledSuccess) {
      return (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>App Installed Successfully!</span>
        </div>
      );
    }
    return null;
  }

  // Show if browser trigger exists OR on iOS browser
  const canShowPrompt = deferredPrompt !== null || isIOS;

  if (!canShowPrompt) return null;

  return (
    <>
      {/* Floating Bottom PWA Banner */}
      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:w-96 z-50 bg-[#0F172A]/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/pwa-192.png"
            alt="Cyrix Field Connect"
            className="w-10 h-10 rounded-xl object-cover shadow-sm shrink-0 border border-white/20 bg-white"
          />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-extrabold text-white truncate">
              Install Cyrix Field Connect
            </span>
            <span className="text-[10px] text-slate-300 truncate mt-0.5">
              Quick access from your Home Screen & Desktop
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white w-full max-w-sm rounded-2xl p-5 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <span className="font-extrabold text-sm">Install on iPhone / iPad</span>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>To install <strong className="text-white">Cyrix Field Connect</strong> on your iOS device:</p>
              <div className="flex items-start gap-2.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/50">
                <Share className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>1. Tap the <strong>Share</strong> button in your Safari menu bar (at bottom of screen).</span>
              </div>
              <div className="flex items-start gap-2.5 bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/50">
                <PlusSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>2. Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppPrompt;
