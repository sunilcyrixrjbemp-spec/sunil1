import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, Search, ShieldCheck, User as UserIcon, Command } from "lucide-react";
import Badge from "./Badge";
import CommandPalette from "./CommandPalette";

interface NavbarProps {
  userName: string;
  userRole: string;
  onOpenMobileMenu: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  userName,
  userRole,
  onOpenMobileMenu,
}) => {
  const location = useLocation();
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  // Command palette key shortcut listener (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const formattedPageTitle =
    pathSegments.length > 0
      ? pathSegments[0]
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Overview";

  return (
    <>
      <header className="sticky top-0 z-30 h-10 bg-white/95 backdrop-blur-md border-b border-gray-200 px-3 md:px-4 flex items-center justify-between gap-3 shadow-2xs">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="p-1 -ml-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md lg:hidden transition-colors cursor-pointer"
            aria-label="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center text-xs md:text-sm text-gray-800 font-semibold overflow-hidden truncate">
            <span className="truncate">{formattedPageTitle}</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger Bar */}
        <button
          onClick={() => setIsCmdOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-md text-xs text-gray-500 transition-all cursor-pointer w-56 justify-between group shadow-2xs"
        >
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            <span className="text-[11px]">Search command...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-semibold text-gray-500 bg-white border border-gray-200 rounded shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center">
            <Badge variant="purple" size="sm" dot={false}>
              <ShieldCheck className="w-3 h-3 mr-1 inline" />
              {userRole}
            </Badge>
          </div>

          <Link
            to="/profile"
            className="flex items-center gap-2 pl-2 border-l border-gray-200 hover:opacity-80 transition-opacity"
          >
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-200 shadow-2xs">
              {userName ? userName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
          </Link>
        </div>
      </header>

      {/* Command Palette Overlay */}
      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
    </>
  );
};

export default Navbar;
