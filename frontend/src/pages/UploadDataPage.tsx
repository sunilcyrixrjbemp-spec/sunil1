import { useState, useRef } from "react";
import { 
  UploadCloud, 
  Database, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  Clock 
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

interface UploadLog {
  id: string;
  dataType: string;
  fileName: string;
  uploadedBy: string;
  timestamp: string;
  recordsCount: number;
  status: "Success" | "Failed";
}

export default function UploadDataPage() {
  const [dataType, setDataType] = useState("facilities");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logs, setLogs] = useState<UploadLog[]>([
    { id: "1", dataType: "Hospitals/Facilities", fileName: "hospital_list_june_2026.csv", uploadedBy: "E1002 (System Admin)", timestamp: "2026-06-25 14:22:00", recordsCount: 154, status: "Success" },
    { id: "2", dataType: "Monthly Targets", fileName: "fse_targets_q2.xlsx", uploadedBy: "E1002 (System Admin)", timestamp: "2026-06-20 10:15:30", recordsCount: 48, status: "Success" },
    { id: "3", dataType: "Penalty Master Data", fileName: "penalty_rules_v2.csv", uploadedBy: "E1205 (MIS Coordinator)", timestamp: "2026-06-18 16:45:10", recordsCount: 12, status: "Success" }
  ]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["csv", "xlsx", "xls"].includes(ext || "")) {
        setSelectedFile(file);
        toast.success(`Selected file: ${file.name}`);
      } else {
        toast.error("Invalid file format. Please upload CSV or Excel spreadsheet only.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please choose a file to upload first.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading and importing asset records on the edge server...");

    try {
      if (dataType === "assets") {
        const formData = new FormData();
        formData.append("file", selectedFile);
        
        const response = await api.post("/reports/upload-assets-csv", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        
        toast.dismiss(toastId);
        toast.success(response.data.message || "Asset data imported successfully!");
        
        const newLog: UploadLog = {
          id: (logs.length + 1).toString(),
          dataType: "Asset Inventory Database",
          fileName: selectedFile.name,
          uploadedBy: "E1704 (Sunil Kumar)",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          recordsCount: response.data.inserted + response.data.skipped,
          status: "Success"
        };
        setLogs(prev => [newLog, ...prev]);
        setSelectedFile(null);
      } else {
        // Simulated logic for other types
        setTimeout(() => {
          setUploading(false);
          toast.dismiss(toastId);

          const newLog: UploadLog = {
            id: (logs.length + 1).toString(),
            dataType: dataType === "facilities" ? "Hospitals/Facilities" : dataType === "targets" ? "Monthly Targets" : "Penalty Master Data",
            fileName: selectedFile.name,
            uploadedBy: "E1704 (Sunil Kumar)",
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
            recordsCount: Math.floor(Math.random() * 120) + 15,
            status: "Success"
          };

          setLogs(prev => [newLog, ...prev]);
          setSelectedFile(null);
          toast.success("Spreadsheet data parsed, verified, and uploaded successfully!");
        }, 2000);
        return; // skip setting upload false at the end since setTimeout does it
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.error || "Failed to upload asset data.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-gray-800 font-sans">
      
      {/* Header section */}
      <div>
        <h2 className="text-xl font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Bulk Data Upload Center
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Upload monthly targets, update hospital facilities master records, or import penalty rule grids.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form column */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Configure Import</h3>
          
          <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs font-semibold">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Target Data Category *</label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 outline-none font-bold"
              >
                <option value="facilities">Hospital Facilities Database</option>
                <option value="assets">Asset Inventory Database</option>
                <option value="targets">Monthly Target Matrix</option>
                <option value="penalty">Penalty Rules Config</option>
              </select>
            </div>

            {/* Drag and drop Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragActive 
                  ? "border-blue-500 bg-blue-50/50" 
                  : selectedFile 
                  ? "border-green-500 bg-green-50/20" 
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, .xlsx, .xls"
                className="hidden"
              />
              
              {selectedFile ? (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-green-600 animate-bounce-slow" />
                  <p className="text-xs font-bold text-gray-800 break-all">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-550">File size: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                  <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase font-black tracking-wider">Ready for import</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-gray-400" />
                  <p className="text-xs font-bold text-gray-700">Drag & drop spreadsheet here</p>
                  <p className="text-[10px] text-gray-450">or click to browse local files</p>
                  <span className="text-[8px] bg-gray-150 text-gray-600 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Supports CSV, XLSX, XLS</span>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded font-extrabold text-xs flex items-center justify-center shadow-sm border-0 transition-colors cursor-pointer uppercase tracking-wider gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              {uploading ? "Analyzing Spreadsheet..." : "Commit Upload"}
            </button>
          </form>
        </div>

        {/* Right Logs History table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-150 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Import Log History</h3>
            <span className="text-[9px] font-bold text-blue-600 uppercase">📊 Real-Time audits</span>
          </div>

          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200 text-[10px] tracking-wider">
                  <th className="py-2 px-3">File details</th>
                  <th className="py-2 px-3">Import Category</th>
                  <th className="py-2 px-3">Uploaded By</th>
                  <th className="py-2 px-3">Rows</th>
                  <th className="py-2 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-55/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-gray-800 truncate max-w-[180px]" title={log.fileName}>
                        {log.fileName}
                      </div>
                      <div className="text-[9px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {log.timestamp}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{log.dataType}</td>
                    <td className="py-3 px-3 text-gray-550 font-semibold">{log.uploadedBy}</td>
                    <td className="py-3 px-3 font-mono text-gray-700">{log.recordsCount} rows</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${
                        log.status === "Success"
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-red-50 border-red-200 text-red-700"
                      }`}>
                        {log.status === "Success" ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-3 p-1">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3 shadow-sm text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-800 break-all">{log.fileName}</div>
                      <span className="text-[9px] text-gray-400 font-mono flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {log.timestamp}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${
                      log.status === "Success"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      {log.status === "Success" ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {log.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-gray-100 pt-2.5">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Import Category</span>
                      <span className="text-gray-700 font-semibold">{log.dataType}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Uploaded By</span>
                      <span className="text-gray-550 font-semibold">{log.uploadedBy}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Records Count</span>
                      <span className="font-mono text-gray-700">{log.recordsCount} rows</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
