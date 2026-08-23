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
  const currentPath = location.pathname;

  const tabs = [
    {
      id: "home",
      label: "Home",
      path: "/home",
      icon: Home,
      isActive: currentPath === "/home" || currentPath === "/",
      isAction: false,
    },
    {
      id: "expense",
      label: "Expenses",
      path: "/submit-expense",
      icon: FilePlus,
      isActive: currentPath.startsWith("/submit-expense"),
      isAction: false,
    },
    {
      id: "approval",
      label: "Approvals",
      path: "/approval-center",
      icon: CheckSquare,
      isActive: currentPath.startsWith("/approval-center"),
      isAction: false,
    },
    {
      id: "profile",
      label: "Profile",
      path: "/profile",
      icon: User,
      isActive: currentPath.startsWith("/profile"),
      isAction: false,
    },
    {
      id: "menu",
      label: "Menu",
      path: "",
      icon: LayoutGrid,
      isActive: false,
      isAction: true,
    },
  ];

  const visibleTabs = tabs.filter((tab) => {
    if (isAdmin) return true;
    if (tab.id === "menu") return true;
    const DEFAULT_UNIVERSAL_TABS = ["home", "expense", "profile", "notifications", "help"];
    if (DEFAULT_UNIVERSAL_TABS.includes(tab.id.toLowerCase())) return true;
    return allowedWindows.map((w) => w.toLowerCase()).includes(tab.id.toLowerCase());
  });

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-line px-3 pb-[env(safe-area-inset-bottom)] shadow-xs flex items-center justify-around h-14 select-none"
      aria-label="Mobile Bottom Navigation"
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;

        if (tab.isAction) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={onOpenMoreMenu}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center group active:scale-90 transition-all cursor-pointer border-0 bg-transparent focus:outline-none"
              title="All Menus & Modules"
              aria-label="All Menus & Modules"
            >
              {/* Stylish Highlighted Menu Icon Pill */}
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-600 to-accent-400 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Icon className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-[9px] font-bold mt-0.5 tracking-tight text-accent-700">
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all relative focus:outline-none ${
              tab.isActive
                ? "text-accent-700 font-semibold scale-105"
                : "text-ink-500 hover:text-ink-800 font-medium"
            }`}
          >
            <Icon
              className={`w-5 h-5 stroke-[2] ${
                tab.isActive ? "text-accent-700" : "text-ink-500"
              }`}
            />
            <span className="text-[10px] mt-0.5 tracking-tight leading-tight">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
