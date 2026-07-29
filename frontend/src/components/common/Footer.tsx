import React from "react";
import { Sparkles, ShieldCheck, Code2 } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-8 mb-20 lg:mb-6 pt-5 pb-5 px-4 md:px-6 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 transition-all">
      {/* Developer Branding */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
          <Code2 className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-500 text-[11px]">Developed by</span>
          <a
            href="https://sunilbishnoi.co.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/60 transition-all no-underline flex items-center gap-1"
          >
            <span>Sunil Bishnoi</span>
            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
          </a>
        </div>
      </div>

      {/* System Status & Protection Badges */}
      <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-wrap justify-center">
        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200/80 font-mono font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secured Enterprise Platform
        </span>
        <span className="hidden md:inline-block text-slate-300">•</span>
        <span className="font-mono text-slate-400">© {new Date().getFullYear()} All Rights Reserved</span>
      </div>
    </footer>
  );
};

export default Footer;
