import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tokenPersistence } from "../utils/persistence";
import LoginForm from "../components/auth/LoginForm";
import ForgotPassword from "../components/auth/ForgotPassword";
import UnlockAccount from "../components/auth/UnlockAccount";
import { ExternalLink, ArrowUpRight, Volume2, VolumeX } from "lucide-react";

type AuthMode = "login" | "forgot" | "unlock";

// ─── 5 Official Business Verticals (Official Links & Logo/Photo Assets from cyrixhealthcare.com) ─────
const CYRIX_VERTICALS = [
  {
    id: "care360",
    logoImg: "/logo-care360.png",
    bgImg: "/photo-care360.jpg",
    link: "https://cyrixhealthcare.com/services/medical-equipment-servicing",
    desc: "Rapid, Reliable Maintenance Services to keep all your medical technologies flawlessly functional — any make, anywhere.",
  },
  {
    id: "ciyan",
    logoImg: "/logo-ciyan.png",
    bgImg: "/photo-ciyan.jpg",
    link: "https://cyrixhealthcare.com/products/cyrix-ciyan",
    desc: "Affordable, high-quality medical technology Solutions, Accessories & Consumables.",
  },
  {
    id: "aurum",
    logoImg: "/logo-aurum.png",
    bgImg: "/photo-aurum.jpg",
    link: "https://cyrixhealthcare.com/products/cyrix-aurum",
    desc: "Widest range of renewed, cost- effective medical equipment from leading OEMs for greater accessibility.",
  },
  {
    id: "academy",
    logoImg: "/logo-academy.png",
    bgImg: "/photo-academy.jpg",
    link: "https://cyrixhealthcare.com/academy/biomedical-equipment-training-program",
    desc: "Comprehensive hands-on training in biomedical equipment, BLS, ACLS, NABH, emergency codes, and safety.",
  },
  {
    id: "revivelab",
    logoImg: "/logo-revivelab.png",
    bgImg: "/photo-revivelab.jpg",
    link: "https://cyrixhealthcare.com/services/medical-device-repair",
    desc: "Advanced board-level repairs that extend equipment life while reducing replacement costs.",
  },
];

// ─── Official Social Media Links (Circular White Buttons Matching Website Design) ─────
const SOCIAL_LINKS = [
  {
    id: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/cyrix-healthcare?originalSubdomain=in",
    element: <span className="font-black text-[13px] tracking-tighter leading-none select-none">in</span>,
  },
  {
    id: "facebook",
    label: "Facebook",
    url: "https://www.facebook.com/cyrixhealthcarepvtltd",
    element: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M14 13.5h2.5l1-4H14V7.5c0-.88.16-1.5 1.5-1.5H17V2.14C16.32 2.06 15.17 2 14.07 2 11.23 2 9.5 3.73 9.5 7.15V9.5H6.5v4h3v9.5h4.5v-9.5z"/>
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/cyrixhealthcare?igshid=YmMyMTA2M2Y%3D",
    element: (
      <svg className="w-4 h-4 fill-none stroke-current stroke-[2.2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
    ),
  },
  {
    id: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@cyrixhealthcarepvtltd",
    element: (
      <svg className="w-4 h-4 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9"/>
        <polygon points="10,8 16,12 10,16" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "pinterest",
    label: "Pinterest",
    url: "https://in.pinterest.com/cyrixhealthcare/",
    element: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    url: "https://x.com/cyrixhealthcare",
    element: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [isMuted, setIsMuted] = useState(true);

  // ── UNTOUCHED auth navigation ──────────────────────────────────────────────
  useEffect(() => {
    if (tokenPersistence.isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  return (
    <div
      className="h-screen max-h-screen w-full flex flex-col lg:flex-row antialiased bg-slate-50 overflow-hidden"
    >
      {/* ══════════════════════════════════════════════════════════════════
          LEFT PANEL — Official Cyrix Business Verticals (Desktop Only)
          App Enterprise Palette (#4A6A8A & Slate 900 #0f172a Background)
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col h-full relative overflow-y-auto custom-scrollbar text-white shrink-0 border-r border-slate-800"
        style={{
          flex: "0 0 58%",
          background: "radial-gradient(ellipse at 15% 15%, rgba(74, 106, 138, 0.35) 0%, transparent 65%), radial-gradient(ellipse at 85% 85%, rgba(37, 99, 235, 0.2) 0%, transparent 70%), #0f172a",
          padding: "32px 36px",
        }}
      >
        {/* Subtle dark ambient grid pattern */}
        <div
          style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.08,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        {/* Native Local HTML5 Video Player with Interactive Sound Toggle */}
        <div className="relative z-10 mb-4 rounded-xl overflow-hidden shadow-2xl bg-black w-full aspect-video shrink-0 group">
          <video
            src="/cyrix-video.mp4"
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Interactive Glassmorphic Sound Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className="absolute bottom-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 rounded-full text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
            title={isMuted ? "Click to Unmute Audio" : "Click to Mute Audio"}
          >
            {isMuted ? (
              <>
                <VolumeX size={15} className="text-rose-400" />
                <span>Sound Off</span>
              </>
            ) : (
              <>
                <Volume2 size={15} className="text-emerald-400 animate-pulse" />
                <span>Sound On</span>
              </>
            )}
          </button>
        </div>

        {/* Hero Narrative below Video */}
        <div className="relative z-10 mb-4 space-y-1.5 px-0.5 shrink-0">
          <h1
            className="m-0 text-xl xl:text-2xl font-extrabold tracking-tight text-white leading-tight"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
          >
            Total MedTech Management Ecosystem
          </h1>
          <p className="m-0 text-xs font-bold text-sky-300 leading-snug">
            Managing healthcare technology across its entire lifecycle — any product, any brand.
          </p>
          <p className="m-0 text-[11px] text-slate-300 font-medium leading-relaxed">
            Cyrix Healthcare delivers Total MedTech Management Solutions through a unified ecosystem, designed to replace fragmented service models with one integrated partner — responsible for performance across the entire medical technology lifecycle.
          </p>
        </div>

        {/* 5 Official Cards Container (2-Column Grid with Dedicated Vertical Links) */}
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-3.5 mb-6">
          {CYRIX_VERTICALS.map((v, index) => {
            const cardJSX = (
              <a
                href={v.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[160px] w-full bg-white rounded-lg shadow-sm border border-slate-200/80 overflow-hidden relative group hover:shadow-xl hover:border-[#4A6A8A] transition-all cursor-pointer no-underline"
                title={`Visit ${v.id} on Cyrix Healthcare`}
              >
                {/* Left Official Photo directly from cyrixhealthcare.com */}
                <div className="w-[120px] xl:w-[130px] h-full shrink-0 relative overflow-hidden bg-slate-100 border-r border-slate-100">
                  <img
                    src={v.bgImg}
                    alt={v.id}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Right Content Area with Official Logo Image */}
                <div className="flex-1 p-3.5 xl:p-4 flex flex-col justify-between relative bg-white">
                  {/* Official Logo Image from cyrixhealthcare.com */}
                  <div className="pr-4 mb-1.5 flex items-center h-9 xl:h-10">
                    <img
                      src={v.logoImg}
                      alt={`${v.id} logo`}
                      className="max-h-9 xl:max-h-10 w-auto max-w-[180px] object-contain object-left"
                    />
                  </div>

                  {/* Description Text */}
                  <p className="m-0 text-[11px] xl:text-xs text-slate-600 font-medium leading-relaxed pr-7 pb-1">
                    {v.desc}
                  </p>

                  {/* Bottom Right Solid Red Square Button with Arrow */}
                  <div className="w-8 h-8 xl:w-9 xl:h-9 bg-[#E50914] text-white flex items-center justify-center absolute bottom-0 right-0 rounded-tl-sm shadow-xs font-black group-hover:bg-red-700 transition-colors">
                    <ArrowUpRight size={18} className="stroke-[3]" />
                  </div>
                </div>
              </a>
            );

            if (index === 4) {
              return (
                <div key={v.id} className="xl:col-span-2 flex justify-center w-full">
                  <div className="w-full xl:w-[calc(50%-0.4375rem)]">
                    {cardJSX}
                  </div>
                </div>
              );
            }

            return <div key={v.id}>{cardJSX}</div>;
          })}
        </div>

        {/* Footer info with Circular White Official Social Media Icons */}
        <div className="relative z-10 mt-auto pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <a
            href="https://cyrixhealthcare.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white font-semibold no-underline flex items-center gap-1.5 transition-colors"
          >
            <span>© 2026 Cyrix Healthcare Pvt Ltd</span>
            <ExternalLink size={12} className="text-sky-400" />
          </a>

          {/* Official Circular Social Icons Row matching website */}
          <div className="flex items-center gap-2.5">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Follow Cyrix Healthcare on ${s.label}`}
                className="w-8 h-8 rounded-full bg-white text-slate-900 border border-slate-300 flex items-center justify-center hover:bg-[#4A6A8A] hover:text-white hover:border-[#4A6A8A] transition-all shadow-xs hover:scale-105 cursor-pointer no-underline shrink-0"
              >
                {s.element}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT PANEL — Clean Auth Form Container (Login / Forgot / Unlock)
          STRICTLY FIXED & CENTERED WITH FULL SCROLL SAFETY
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-slate-50 shrink-0">
        <div className="min-h-full w-full flex flex-col items-center justify-center p-6 sm:p-10">
          {/* Main Auth Form Card Container */}
          <div
            className="w-full shadow-lg border border-slate-200 bg-white rounded-none my-auto"
            style={{ maxWidth: 420 }}
          >
            {mode === "login" && (
              <LoginForm
                onForgotPassword={() => setMode("forgot")}
                onUnlockAccount={() => setMode("unlock")}
              />
            )}
            {mode === "forgot" && (
              <ForgotPassword onBackToLogin={() => setMode("login")} />
            )}
            {mode === "unlock" && (
              <UnlockAccount onBackToLogin={() => setMode("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
