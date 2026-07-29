import React from "react";
import { Sparkles, Code2 } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-6 mb-20 lg:mb-4 pt-3 pb-2 flex items-center justify-end px-2 text-[11px] text-slate-500 font-sans transition-all">
      <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
        <Code2 className="w-3 h-3 text-indigo-500" />
        <span className="font-medium text-slate-500">Developed by</span>
        <a
          href="https://sunilbishnoi.co.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-extrabold text-indigo-600 hover:text-indigo-700 transition-colors no-underline flex items-center gap-1"
        >
          <span>Sunil Bishnoi</span>
          <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;
