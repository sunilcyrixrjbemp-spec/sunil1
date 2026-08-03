import React from "react";
import toast, { ToastOptions } from "react-hot-toast";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

interface CustomToastProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export const CustomToast: React.FC<CustomToastProps> = ({ type, message }) => {
  const borderColors = {
    success: "border-l-approved bg-approved-bg text-approved-text border-approved-border",
    warning: "border-l-pending bg-pending-bg text-pending-text border-pending-border",
    error: "border-l-rejected bg-rejected-bg text-rejected-text border-rejected-border",
    info: "border-l-accent-600 bg-accent-subtle text-accent-700 border-accent-100",
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-approved shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-pending shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rejected shrink-0" />,
    info: <Info className="w-5 h-5 text-accent-600 shrink-0" />,
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-surface-0 border border-border border-l-4 ${borderColors[type]} rounded-md shadow-md text-sm font-medium animate-slide-in-right max-w-md`}
    >
      {icons[type]}
      <span className="text-ink-900 leading-snug">{message}</span>
    </div>
  );
};

export const showToast = {
  success: (msg: string, opts?: ToastOptions) =>
    toast.custom(<CustomToast type="success" message={msg} />, opts),
  error: (msg: string, opts?: ToastOptions) =>
    toast.custom(<CustomToast type="error" message={msg} />, opts),
  warning: (msg: string, opts?: ToastOptions) =>
    toast.custom(<CustomToast type="warning" message={msg} />, opts),
  info: (msg: string, opts?: ToastOptions) =>
    toast.custom(<CustomToast type="info" message={msg} />, opts),
};

export default showToast;
