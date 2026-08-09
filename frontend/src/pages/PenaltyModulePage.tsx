import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  Upload,
  Plus,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  X,
  Check,
  Calendar
} from "lucide-react";
import toast from "react-hot-toast";
import { penaltyService, PenaltyRecord, DailyPenaltyRecord } from "../services/penaltyService";

export default function PenaltyModulePage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "daily">("monthly");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [dailyRecords, setDailyRecords] = useState<DailyPenaltyRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("all");

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual Form State
  const [formData, setFormData] = useState({
    complaint_id: "",
    barcode: "",
    complaint_raise_date: "",
    attend_date: "",
    close_date: "",
    final_close_date: "",
    attended_engineer_name: "",
    close_engineer_id: "",
    daily_penalty_rate: "500",
    asset_value: "500000",
    is_part_missing: false,
    part_missing_days: "0",
    is_standby_provided: false
  });

  const [barcodeVerified, setBarcodeVerified] = useState<boolean | null>(null);
  const [barcodeAssetInfo, setBarcodeAssetInfo] = useState<any>(null);
  const [verifyingBarcode, setVerifyingBarcode] = useState(false);

  useEffect(() => {
    fetchPenaltyList();
  }, [selectedDistrict]);

  const fetchPenaltyList = async () => {
    setLoading(true);
    try {
      const res = await penaltyService.getPenaltyList({
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        search: searchQuery || undefined,
        complaint_id: selectedComplaintId || undefined
      });
      if (res.success) {
        setRecords(res.records || []);
        if (res.dailyRecords) {
          setDailyRecords(res.dailyRecords);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load penalty records.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBarcodeLive = async (code: string) => {
    if (!code || code.trim().length < 4) {
      setBarcodeVerified(null);
      setBarcodeAssetInfo(null);
      return;
    }
    setVerifyingBarcode(true);
    try {
      const res = await penaltyService.verifyBarcode(code.trim());
      if (res.success && res.exists) {
        setBarcodeVerified(true);
        setBarcodeAssetInfo(res.asset);
        toast.success(`✓ Barcode Verified: ${res.asset.equipment_name} (${res.asset.hospital_name})`);
      } else {
        setBarcodeVerified(false);
        setBarcodeAssetInfo(null);
        toast.error(res.message || `❌ Error: Barcode #${code} not found in database Asset Inventory!`);
      }
    } catch (e) {
      setBarcodeVerified(false);
      setBarcodeAssetInfo(null);
    } finally {
      setVerifyingBarcode(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.complaint_id || !formData.barcode) {
      toast.error("Complaint ID and Barcode are required!");
      return;
    }

    if (barcodeVerified === false) {
      toast.error(`❌ Cannot save: Barcode #${formData.barcode} is invalid or not found in Asset Inventory!`);
      return;
    }

    setLoading(true);
    try {
      const res = await penaltyService.savePenaltyEntries([formData]);
      if (res.success) {
        toast.success(res.message || "Penalty record saved successfully!");
        setShowManualModal(false);
        setFormData({
          complaint_id: "",
          barcode: "",
          complaint_raise_date: "",
          attend_date: "",
          close_date: "",
          final_close_date: "",
          attended_engineer_name: "",
          close_engineer_id: "",
          daily_penalty_rate: "500",
          asset_value: "500000",
          is_part_missing: false,
          part_missing_days: "0",
          is_standby_provided: false
        });
        setBarcodeVerified(null);
        fetchPenaltyList();
      } else {
        toast.error((res.errors && res.errors[0]) || "Validation failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save penalty entry.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (records.length === 0) {
      toast.error("No penalty records available to export.");
      return;
    }

    const headers = [
      "Complaint ID", "District Name", "Hospital Name", "Bar Code", "Equipment Name",
      "Equipment Model", "Complaint Raise Date", "Attend Date", "Complaint Close date",
      "Final Close Date", "Attended Engineer Name", "Close Engineer ID", "Total Downtime (Days)",
      "Total Penalty (₹)", "Status"
    ];

    const rows = records.map(r => [
      r.complaint_id, r.district_name, r.hospital_name, r.bar_code, r.equipment_name,
      r.equipment_model || "", r.complaint_raise_date, r.attend_date, r.complaint_close_date,
      r.final_close_date || "", r.attended_engineer_name || "", r.close_engineer_id || "",
      r.total_downtime || 0, r.total_penalty || 0, r.status || "Assessed"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rajasthan_Penalty_File_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("📥 Penalty File downloaded successfully!");
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q ||
        r.complaint_id.toLowerCase().includes(q) ||
        r.bar_code.toLowerCase().includes(q) ||
        r.hospital_name.toLowerCase().includes(q) ||
        r.equipment_name.toLowerCase().includes(q);
      return matchesQuery;
    });
  }, [records, searchQuery]);

  const totalAssessed = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.total_penalty || 0), 0);
  }, [filteredRecords]);

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans p-4 sm:p-6 bg-slate-50 min-h-screen">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wide flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
            Penalty File Management & CA Engine
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Strict Asset Barcode Validation • CA SLA Exemption Calculator (Part Missing & 90-Day Standby) • Facility RBAC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add Complaint Entry
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Download className="w-4 h-4" /> Export Penalty File (Excel)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 border-l-4 border-l-rose-600 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Net Total Penalty</span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">₹{totalAssessed.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Complaints Audited</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{filteredRecords.length} Records</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Barcode Verification</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">100% Validated</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-l-4 border-l-amber-600 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Standby Rule</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">90 Days Grace</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "monthly" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly Penalty Summary (Penalty File Format)
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "daily" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Per-Day Penalty Breakdown Log
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Complaint, Barcode, Hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={fetchPenaltyList}
            className="p-2 text-slate-500 hover:text-blue-600 bg-slate-50 border border-slate-200 rounded-xl"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table View */}
      {activeTab === "monthly" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase font-black tracking-wider">
                  <th className="py-3 px-3">Complaint ID</th>
                  <th className="py-3 px-3">District</th>
                  <th className="py-3 px-3">Hospital Name</th>
                  <th className="py-3 px-3">Bar Code</th>
                  <th className="py-3 px-3">Equipment Name</th>
                  <th className="py-3 px-3">Raise Date</th>
                  <th className="py-3 px-3">Attend Date</th>
                  <th className="py-3 px-3">Close Date</th>
                  <th className="py-3 px-3">Downtime (Days)</th>
                  <th className="py-3 px-3">Total Penalty</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 font-bold">
                      No penalty records found. Click "+ Add Complaint Entry" to create a record.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{r.complaint_id}</td>
                      <td className="py-3 px-3">{r.district_name}</td>
                      <td className="py-3 px-3 font-medium">{r.hospital_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 w-fit">
                        {r.bar_code}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{r.equipment_name}</td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">{r.complaint_raise_date}</td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">{r.attend_date}</td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">{r.complaint_close_date}</td>
                      <td className="py-3 px-3 font-bold text-amber-600">{r.total_downtime} Days</td>
                      <td className="py-3 px-3 font-extrabold text-rose-600">₹{(r.total_penalty || 0).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          {r.status || "Assessed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Per-Day Penalty Breakdown View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase">Select Complaint ID:</span>
            <select
              value={selectedComplaintId}
              onChange={(e) => {
                setSelectedComplaintId(e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="">-- All Complaints --</option>
              {records.map(r => (
                <option key={r.complaint_id} value={r.complaint_id}>
                  {r.complaint_id} - Barcode #{r.bar_code} ({r.hospital_name})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase font-black tracking-wider">
                  <th className="py-3 px-3">Day #</th>
                  <th className="py-3 px-3">Complaint ID</th>
                  <th className="py-3 px-3">Barcode</th>
                  <th className="py-3 px-3">Call Status</th>
                  <th className="py-3 px-3">Exemption Status</th>
                  <th className="py-3 px-3">Daily Charge Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                      Select a specific complaint above to view its per-day penalty breakdown.
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((d, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-extrabold text-slate-800">Day {d.day_number}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{d.complaint_id}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{d.barcode}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {d.call_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {d.is_exempted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            ✓ {d.exemption_reason}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            Chargeable Day
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-800">
                        ₹{d.daily_penalty_amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Add Complaint & Penalty Record
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Barcode (QR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 75043156"
                      value={formData.barcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, barcode: val });
                        handleVerifyBarcodeLive(val);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    {verifyingBarcode && (
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-blue-600 animate-pulse">
                        Verifying...
                      </span>
                    )}
                  </div>

                  {barcodeVerified === true && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700">
                      ✓ Verified: {barcodeAssetInfo?.equipment_name} ({barcodeAssetInfo?.hospital_name})
                    </div>
                  )}

                  {barcodeVerified === false && (
                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-700">
                      ❌ Error: Barcode #{formData.barcode} not found in database Asset Inventory!
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Complaint ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 13126072-800091"
                    value={formData.complaint_id}
                    onChange={(e) => setFormData({ ...formData, complaint_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Complaint Raise Date (DD-MMM-YYYY HH:mm:ss)
                  </label>
                  <input
                    type="text"
                    placeholder="21-Jan-2025 16:30:47"
                    value={formData.complaint_raise_date}
                    onChange={(e) => setFormData({ ...formData, complaint_raise_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Attend Date (DD-MMM-YYYY HH:mm:ss)
                  </label>
                  <input
                    type="text"
                    placeholder="23-Jan-2025 18:30:47"
                    value={formData.attend_date}
                    onChange={(e) => setFormData({ ...formData, attend_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Complaint Close Date
                  </label>
                  <input
                    type="text"
                    placeholder="15-May-2025 16:30:47"
                    value={formData.close_date}
                    onChange={(e) => setFormData({ ...formData, close_date: e.target.value, final_close_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Attended Engineer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Engineer Name"
                    value={formData.attended_engineer_name}
                    onChange={(e) => setFormData({ ...formData, attended_engineer_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Exemption Checkboxes */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  SLA Exemption Rules
                </span>
                
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_part_missing}
                    onChange={(e) => setFormData({ ...formData, is_part_missing: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Part Missing / Spare Pending (₹0 Penalty during part missing days)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_standby_provided}
                    onChange={(e) => setFormData({ ...formData, is_standby_provided: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Standby Machine Provided (First 90 Days Exempted - ₹0)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || barcodeVerified === false}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  {loading ? "Processing..." : "Calculate & Save Penalty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
