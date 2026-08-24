import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, FilePlus, CheckSquare, User, LayoutGrid } from "lucide-react";

export interface MobileBottomNavProps {
  activePath?: string;
  unreadCount?: number;
  onOpenMoreMenu?: () => void;
  allowedWindows?: string[];
  isAdmin?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenMoreMenu,
  allowedWindows = ["home", "expense", "help", "profile"],
  isAdmin = false,
}) => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-1 px-2 flex items-center justify-around lg:hidden shadow-lg select-none pb-[env(safe-area-inset-bottom)]">
      {(isAdmin || allowedWindows.includes("home")) && (
        <Link
          to="/home"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            location.pathname === "/home" || location.pathname === "/"
              ? "text-blue-600 bg-blue-50"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>
      )}

      {(isAdmin || allowedWindows.includes("expense")) && (
        <Link
          to="/submit-expense"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            location.pathname.startsWith("/submit-expense")
              ? "text-emerald-600 bg-emerald-50"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FilePlus className="w-4 h-4" />
          <span>Expense</span>
        </Link>
      )}

      {(isAdmin || allowedWindows.includes("approval")) && (
        <Link
          to="/approval-center"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            location.pathname.startsWith("/approval-center")
              ? "text-amber-600 bg-amber-50"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Approval</span>
        </Link>
      )}

      {(isAdmin || allowedWindows.includes("profile")) && (
        <Link
          to="/profile"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
            location.pathname.startsWith("/profile")
              ? "text-purple-600 bg-purple-50"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </Link>
      )}

      {/* 9-Dot Bento Grid "More" Button to Open All Menus */}
      <button
        type="button"
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-slate-600 hover:text-slate-900 border-0 bg-transparent"
        title="All Menus & Services"
      >
        <LayoutGrid className="w-4 h-4 stroke-[2.5]" />
        <span>More</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
