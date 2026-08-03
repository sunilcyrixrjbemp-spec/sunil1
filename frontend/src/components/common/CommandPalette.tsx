import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  CheckSquare,
  FilePlus,
  BarChart3,
  Calendar,
  HelpCircle,
  User,
  Settings,
  FileSpreadsheet,
  Gauge,
  UploadCloud,
  ShieldAlert,
  Package,
  Activity,
  TrendingUp,
  X,
  ArrowRight,
} from "lucide-react";

export interface CommandItem {
  id: string;
  name: string;
  category: string;
  path: string;
  icon: React.ComponentType<any>;
}

const COMMANDS: CommandItem[] = [
  { id: "home", name: "Overview Dashboard", category: "Navigation", path: "/home", icon: Home },
  { id: "new_dashboard", name: "Executive Analytics", category: "Navigation", path: "/new-dashboard", icon: TrendingUp },
  { id: "expense", name: "Submit New Claim", category: "Actions", path: "/submit-expense", icon: FilePlus },
  { id: "approval", name: "Approval Center", category: "Actions", path: "/approval-center", icon: CheckSquare },
  { id: "mis_report", name: "MIS Reports", category: "Reports", path: "/mis-report", icon: FileSpreadsheet },
  { id: "kpi", name: "KPI Metrics", category: "Reports", path: "/kpi-dashboard", icon: Gauge },
  { id: "analysis", name: "Deep Analytics", category: "Reports", path: "/analysis", icon: BarChart3 },
  { id: "report", name: "Month Summary", category: "Reports", path: "/month-report", icon: Calendar },
  { id: "consolidated_report", name: "Consolidated Reports", category: "Reports", path: "/consolidated-report", icon: FileSpreadsheet },
  { id: "penalty_report", name: "Penalty Audit", category: "Reports", path: "/penalty-report", icon: ShieldAlert },
  { id: "admin", name: "Admin Console", category: "System", path: "/admin", icon: Settings },
  { id: "db_monitor", name: "DB Health", category: "System", path: "/db-monitor", icon: Activity },
  { id: "upload_data", name: "Data Import", category: "System", path: "/upload-data", icon: UploadCloud },
  { id: "asset_upload", name: "Asset Master", category: "System", path: "/asset-upload", icon: Package },
  { id: "profile", name: "User Profile & Security", category: "Account", path: "/profile", icon: User },
  { id: "help", name: "Help & Support Center", category: "Account", path: "/help-center", icon: HelpCircle },
];

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard listeners for Ctrl+K and Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredCommands = COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-xl bg-white border border-gray-200 rounded-[20px] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-100 gap-3">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search modules..."
            autoFocus
            className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs md:text-sm font-medium transition-colors cursor-pointer ${
                    isSelected ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-[8px] ${
                        isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "opacity-0"}`} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-gray-500">
              No matching commands or pages found.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
          <span>
            Use <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-2xs font-mono text-gray-600">↑</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-2xs font-mono text-gray-600">↓</kbd> to navigate
          </span>
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-2xs font-mono text-gray-600">ESC</kbd> to exit
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
