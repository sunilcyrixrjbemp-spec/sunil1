import { ShieldCheck, Activity, Zap, Fingerprint, MapPin, CheckCircle2 } from "lucide-react";

export default function FloatingAuthVisuals() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 hidden lg:block">
      {/* ── Left Side Floating Animated Widgets ──────────────────────────── */}
      <div className="absolute left-[4%] xl:left-[8%] top-[22%] w-[260px] animate-mesh-blob-1">
        <div className="bg-white/85 backdrop-blur-md p-4 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all duration-300 transform -rotate-1 hover:rotate-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold font-mono tracking-wider text-emerald-700 uppercase">
                FIELD OPS ACTIVE
              </span>
            </div>
            <Activity size={14} className="text-emerald-600 animate-pulse" />
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display font-extrabold text-2xl text-ink-900 tracking-tight">142</span>
            <span className="text-xs font-medium text-ink-500">Engineers on Field</span>
          </div>

          {/* Animated Mini Pulse Bars */}
          <div className="flex items-end gap-1 h-5 mt-2.5 pt-1">
            <div className="w-1.5 bg-accent-600/70 rounded-full h-3 animate-pulse" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 bg-accent-600 rounded-full h-5 animate-pulse" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 bg-accent-600/80 rounded-full h-4 animate-pulse" style={{ animationDelay: "300ms" }} />
            <div className="w-1.5 bg-accent-600/60 rounded-full h-2.5 animate-pulse" style={{ animationDelay: "450ms" }} />
            <div className="w-1.5 bg-accent-600 rounded-full h-4.5 animate-pulse" style={{ animationDelay: "600ms" }} />
            <div className="w-1.5 bg-accent-600/90 rounded-full h-3.5 animate-pulse" style={{ animationDelay: "750ms" }} />
            <div className="w-1.5 bg-emerald-500 rounded-full h-5 animate-pulse" style={{ animationDelay: "900ms" }} />
            <span className="text-[10px] text-ink-400 font-mono ml-auto">99.98% Sync</span>
          </div>
        </div>
      </div>

      <div className="absolute left-[5%] xl:left-[9%] bottom-[20%] w-[250px] animate-mesh-blob-3">
        <div className="bg-white/85 backdrop-blur-md p-3.5 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all duration-300 transform rotate-1 hover:rotate-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-50 border border-accent-100 flex items-center justify-center text-accent-600 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink-900 m-0">Cloudflare Edge</h4>
              <p className="text-[11px] text-ink-500 m-0 mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-500" />
                Zero-Trust Protected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Side Floating Animated Widgets ─────────────────────────── */}
      <div className="absolute right-[4%] xl:right-[8%] top-[20%] w-[260px] animate-mesh-blob-2">
        <div className="bg-white/85 backdrop-blur-md p-4 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all duration-300 transform rotate-1 hover:rotate-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Zap size={13} />
              </div>
              <span className="text-[11px] font-bold font-mono tracking-wider text-ink-800 uppercase">
                INSTANT SYNC
              </span>
            </div>
            <span className="text-[10px] font-mono text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded font-bold">
              LIVE
            </span>
          </div>

          <p className="text-xs text-ink-600 leading-snug m-0">
            Real-time field claims, approvals, and route audit trails synced automatically.
          </p>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-line/60 text-[11px] text-ink-500">
            <MapPin size={12} className="text-accent-600" />
            <span>Coverage Across All Districts</span>
          </div>
        </div>
      </div>

      <div className="absolute right-[5%] xl:right-[9%] bottom-[22%] w-[250px] animate-mesh-blob-1">
        <div className="bg-white/85 backdrop-blur-md p-3.5 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all duration-300 transform -rotate-1 hover:rotate-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Fingerprint size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink-900 m-0">Biometric & SSO</h4>
              <p className="text-[11px] text-ink-500 m-0 mt-0.5">
                Hardware security token & biometrics
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
