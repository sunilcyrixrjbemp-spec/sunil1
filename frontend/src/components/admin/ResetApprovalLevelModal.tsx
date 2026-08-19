import React, { useState, useEffect } from "react";
import { X, RefreshCw, UserCheck, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { adminService } from "../../services/adminService";

interface ResetApprovalLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseId: number;
  expenseCode: string;
  onSuccess?: () => void;
}

interface LevelItem {
  level_number: number;
  approver_id: number;
  approver_name: string;
  approver_emp_code?: string;
  approver_role?: string;
  approver_designation?: string;
  current_status?: string;
}

export const ResetApprovalLevelModal: React.FC<ResetApprovalLevelModalProps> = ({
  isOpen,
  onClose,
  expenseId,
  expenseCode,
  onSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    expense_code: string;
    submitter?: { name: string };
    amount?: number;
    current_status?: string;
    levels: LevelItem[];
  } | null>(null);

  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [comments, setComments] = useState<string>("");

  useEffect(() => {
    if (isOpen && expenseId) {
      fetchLevels();
    } else {
      resetForm();
    }
  }, [isOpen, expenseId]);

  const resetForm = () => {
    setLoading(true);
    setSubmitting(false);
    setError(null);
    setData(null);
    setSelectedLevel(null);
    setComments("");
  };

  const fetchLevels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.getExpenseHierarchyLevels(expenseId);
      if (res && res.success) {
        setData(res);
        if (res.levels && res.levels.length > 0) {
          // Default selection: Level 1
          setSelectedLevel(res.levels[0].level_number);
        }
      } else {
        setError(res.error || "Failed to load approval hierarchy levels.");
      }
    } catch (err: any) {
      console.error("Error loading hierarchy levels:", err);
      setError(err.response?.data?.error || err.message || "Failed to load hierarchy levels.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLevel === null || selectedLevel === undefined) {
      alert("Please select a target approval level or Admin Cancel option.");
      return;
    }
    if (!comments.trim()) {
      alert("Please enter mandatory remarks/reason for this action.");
      return;
    }

    const isCancel = selectedLevel === -1;
    const selectedApprover = data?.levels.find((l) => l.level_number === selectedLevel);
    const approverText = isCancel
      ? "ADMIN CANCEL"
      : (selectedApprover ? `${selectedApprover.approver_name} (Level ${selectedLevel})` : `Level ${selectedLevel}`);

    const confirmMsg = isCancel
      ? `Are you sure you want to CANCEL claim ${expenseCode}? This will set status to Admin Cancelled and log an audit entry.`
      : `Are you sure you want to reset claim ${expenseCode} back to ${approverText}? This will re-route the claim and notify the approver.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminService.resetExpenseApprovalLevel(expenseId, selectedLevel, comments);
      if (res && res.success) {
        alert(res.message || `Claim ${expenseCode} reset to Level ${selectedLevel} successfully.`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert(res.error || "Failed to reset approval level.");
      }
    } catch (err: any) {
      console.error("Failed to reset approval level:", err);
      alert(err.response?.data?.error || err.message || "Failed to reset approval level.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Reset Approval Hierarchy Level</h3>
              <p className="text-xs text-blue-200">Re-route claim back to any approval level in the hierarchy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Fetching approval hierarchy details...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error Loading Hierarchy</p>
                <p className="text-xs opacity-90">{error}</p>
              </div>
            </div>
          ) : data ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Claim Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block">
                    Claim Code
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-base">
                    {data.expense_code}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block">
                    Submitted By
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {data.submitter?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block">
                    Current Status
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase">
                    {data.current_status || "N/A"}
                  </span>
                </div>
              </div>

              {/* Approval Hierarchy Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Select Target Approval Level to Re-route to:
                </label>
                <div className="space-y-2.5">
                  {/* Admin Cancel Option */}
                  <div
                    onClick={() => setSelectedLevel(-1)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedLevel === -1
                        ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-600 dark:border-rose-500 shadow-sm ring-1 ring-rose-600"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <input
                        type="radio"
                        name="target_level"
                        checked={selectedLevel === -1}
                        onChange={() => setSelectedLevel(-1)}
                        className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                            🚫 Admin Cancel Claim
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cancel claim completely & log audit trail record
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                        Admin Cancel
                      </span>
                    </div>
                  </div>

                  {data.levels.map((lvl) => {
                    const isSelected = selectedLevel === lvl.level_number;
                    return (
                      <div
                        key={lvl.level_number}
                        onClick={() => setSelectedLevel(lvl.level_number)}
                        className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm ring-1 ring-blue-600"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          <input
                            type="radio"
                            name="target_level"
                            checked={isSelected}
                            onChange={() => setSelectedLevel(lvl.level_number)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                Level {lvl.level_number}: {lvl.approver_name}
                              </span>
                              {lvl.approver_emp_code && (
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                  [{lvl.approver_emp_code}]
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {lvl.approver_role || lvl.approver_designation || "Approver"}
                            </p>
                          </div>
                        </div>

                        {/* Status pill */}
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              lvl.current_status === "approved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : lvl.current_status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {lvl.current_status === "approved" ? (
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                            )}
                            <span className="capitalize">{lvl.current_status || "waiting"}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mandatory Reason Textarea */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason for Resetting Level <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter reason for sending this claim back to the selected approval level..."
                  className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedLevel || !comments.trim()}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Confirm & Re-route</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ResetApprovalLevelModal;
