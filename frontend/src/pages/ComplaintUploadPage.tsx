import { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileText,
  Lock,
  ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import {
  complaintService,
  ComplaintUploadResult
} from "../services/complaintService";
import {
  inspectFileRowCount,
  streamParseCsv,
  streamParseXlsx
} from "../utils/complaintParser";

// Configurable threshold for Path A vs Path B
const PATH_B_ROW_THRESHOLD = 75000;
const CHUNK_SIZE = 500;

export default function ComplaintUploadPage() {
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectingFile, setInspectingFile] = useState(false);
  const [estimatedRows, setEstimatedRows] = useState<number>(0);
  const [fileType, setFileType] = useState<"csv" | "xlsx">("csv");

  // Ingestion state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPath, setUploadPath] = useState<"A" | "B">("A");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Live stats
  const [stats, setStats] = useState<{
    inserted: number;
    updated: number;
    skipped_final_closed: number;
    skipped_invalid: number;
    processed_rows: number;
    total_rows: number;
  }>({
    inserted: 0,
    updated: 0,
    skipped_final_closed: 0,
    skipped_invalid: 0,
    processed_rows: 0,
    total_rows: 0
  });

  const [completedSummary, setCompletedSummary] = useState<ComplaintUploadResult | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check upload permissions on mount
  useEffect(() => {
    async function verifyAccess() {
      setCheckingPermission(true);
      try {
        const localUser = JSON.parse(localStorage.getItem("user") || "null");
        const roleLower = (localUser?.role || localUser?.designation || "").trim().toLowerCase();
        if (roleLower === "admin") {
          setHasPermission(true);
          setIsAdmin(true);
          setCheckingPermission(false);
          return;
        }

        const res = await complaintService.checkPermission();
        setHasPermission(res.can_upload || res.is_admin);
        setIsAdmin(res.is_admin);
      } catch (err) {
        console.error("Failed to check complaint upload permissions:", err);
        const localUser = JSON.parse(localStorage.getItem("user") || "null");
        const roleLower = (localUser?.role || localUser?.designation || "").trim().toLowerCase();
        if (roleLower === "admin") {
          setHasPermission(true);
          setIsAdmin(true);
        } else {
          setHasPermission(false);
        }
      } finally {
        setCheckingPermission(false);
      }
    }
    verifyAccess();

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Please select a valid .CSV or .XLSX file");
      return;
    }

    setSelectedFile(file);
    setCompletedSummary(null);
    setInspectingFile(true);
    setStatusMessage("Inspecting file structure and estimating row count...");

    try {
      const inspect = await inspectFileRowCount(file);
      setEstimatedRows(inspect.estimatedRows);
      setFileType(inspect.fileType);

      if (inspect.estimatedRows > PATH_B_ROW_THRESHOLD) {
        setUploadPath("B");
      } else {
        setUploadPath("A");
      }
    } catch (err: any) {
      console.error("Error inspecting file:", err);
      toast.error("Failed to inspect file structure. Defaulting to standard upload.");
      setEstimatedRows(1000);
      setUploadPath("A");
    } finally {
      setInspectingFile(false);
      setStatusMessage("");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PATH A: Synchronous Chunk Ingestion (≤ 75k rows)
  // ─────────────────────────────────────────────────────────────────────────────
  const executePathA = async (file: File) => {
    setIsUploading(true);
    setProgressPercent(0);
    setStatusMessage("Starting client-side parsing and chunked stream ingestion...");

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkippedFinalClosed = 0;
    let totalSkippedInvalid = 0;
    let totalProcessed = 0;

    const onChunk = async (chunkRows: any[], pct: number) => {
      setStatusMessage(`Ingesting chunk of ${chunkRows.length.toLocaleString()} rows (${totalProcessed.toLocaleString()} processed)...`);
      try {
        const res = await complaintService.uploadChunk(chunkRows);
        totalInserted += res.inserted || 0;
        totalUpdated += res.updated || 0;
        totalSkippedFinalClosed += res.skipped_final_closed || 0;
        totalSkippedInvalid += res.skipped_invalid || 0;
        totalProcessed += chunkRows.length;

        setStats({
          inserted: totalInserted,
          updated: totalUpdated,
          skipped_final_closed: totalSkippedFinalClosed,
          skipped_invalid: totalSkippedInvalid,
          processed_rows: totalProcessed,
          total_rows: Math.max(totalProcessed, estimatedRows)
        });

        setProgressPercent(pct);
      } catch (err: any) {
        console.error("Chunk upload error:", err);
        throw new Error(err.response?.data?.error || err.message || "Chunk upload failed");
      }
    };

    const onComplete = () => {
      setIsUploading(false);
      setProgressPercent(100);
      setStatusMessage("Ingestion complete!");
      setCompletedSummary({
        status: "success",
        total_rows: totalProcessed,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped_final_closed: totalSkippedFinalClosed,
        skipped_invalid: totalSkippedInvalid
      });
      toast.success(`Successfully processed ${totalProcessed.toLocaleString()} complaint records!`);
    };

    const onError = (err: Error) => {
      setIsUploading(false);
      setStatusMessage(`Error: ${err.message}`);
      toast.error(`Ingestion failed: ${err.message}`);
    };

    if (fileType === "xlsx") {
      await streamParseXlsx(file, CHUNK_SIZE, onChunk, onComplete, onError);
    } else {
      streamParseCsv(file, CHUNK_SIZE, onChunk, onComplete, onError);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PATH B: Asynchronous Queue Ingestion (> 75k rows, up to 1M+)
  // ─────────────────────────────────────────────────────────────────────────────
  const executePathB = async (file: File) => {
    setIsUploading(true);
    setProgressPercent(5);
    setStatusMessage("Initializing scalable Cloudflare Queue ingestion session...");

    try {
      // 1. Initialize Large Upload
      const initRes = await complaintService.initLargeUpload(file.name, estimatedRows);
      const jobId = initRes.job_id;
      setActiveJobId(jobId);

      // 2. Direct upload to R2
      setStatusMessage(`Uploading raw ${fileType.toUpperCase()} file to R2 cloud storage...`);
      await complaintService.uploadFileToR2(initRes.upload_endpoint, file, (pct) => {
        setProgressPercent(Math.min(Math.round(pct * 0.4), 40)); // 0–40% for file transfer
      });

      // 3. Enqueue job
      setStatusMessage("File uploaded to R2. Enqueueing background queue worker...");
      setProgressPercent(45);
      await complaintService.enqueueJob(jobId);

      // 4. Poll progress
      setStatusMessage("Queue worker streaming file from R2 and batch-inserting into D1...");
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const job = await complaintService.getJobStatus(jobId);
          if (!job) return;

          const total = job.total_rows || estimatedRows || 1;
          const processed = job.processed_rows || 0;
          const procPct = 45 + Math.round((processed / total) * 55);
          setProgressPercent(Math.min(procPct, 99));

          setStats({
            inserted: job.inserted_rows || 0,
            updated: job.updated_rows || 0,
            skipped_final_closed: job.skipped_final_closed || 0,
            skipped_invalid: job.skipped_invalid || 0,
            processed_rows: processed,
            total_rows: total
          });

          if (job.status === "completed") {
            clearInterval(pollingIntervalRef.current);
            setIsUploading(false);
            setProgressPercent(100);
            setStatusMessage("Asynchronous ingestion completed successfully!");
            setCompletedSummary({
              status: "success",
              total_rows: job.total_rows,
              inserted: job.inserted_rows,
              updated: job.updated_rows,
              skipped_final_closed: job.skipped_final_closed,
              skipped_invalid: job.skipped_invalid
            });
            toast.success(`Completed! Ingested ${job.total_rows.toLocaleString()} complaints via Cloudflare Queue.`);
          } else if (job.status === "failed") {
            clearInterval(pollingIntervalRef.current);
            setIsUploading(false);
            setStatusMessage(`Job Failed: ${job.error_message || "Unknown error"}`);
            toast.error(`Ingestion job failed: ${job.error_message || "Unknown error"}`);
          }
        } catch (err: any) {
          console.error("Polling error:", err);
        }
      }, 2500);
    } catch (err: any) {
      setIsUploading(false);
      const msg = err.response?.data?.error || err.message || "Failed to initialize upload";
      setStatusMessage(`Error: ${msg}`);
      toast.error(msg);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) {
      toast.error("Please choose a file first");
      return;
    }
    if (uploadPath === "B") {
      executePathB(selectedFile);
    } else {
      executePathA(selectedFile);
    }
  };

  const handleReset = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setSelectedFile(null);
    setEstimatedRows(0);
    setIsUploading(false);
    setProgressPercent(0);
    setStatusMessage("");
    setCompletedSummary(null);
    setActiveJobId(null);
    setStats({
      inserted: 0,
      updated: 0,
      skipped_final_closed: 0,
      skipped_invalid: 0,
      processed_rows: 0,
      total_rows: 0
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Render Access Denied state
  if (checkingPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-slate-200">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Verifying Permissions...</h2>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-lg shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider mb-2">
          Upload Permission Required
        </h2>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          You do not currently have access to the Complaint Management Data Ingestion System.
          Please contact a System Administrator to grant your account upload permission.
        </p>
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          Return to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-lg p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-xs">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Complaint Management Data Ingestion
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                High-throughput standalone ingestion pipeline • Scalable up to 1,000,000+ records
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/admin/complaint-upload-access"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Manage Access Permissions</span>
            <ChevronRight className="w-3 h-3 text-indigo-400" />
          </Link>
        )}
      </div>

      {/* Critical Business Rule Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-lg p-4 shadow-sm border border-slate-800 flex items-start gap-3">
        <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-400 uppercase tracking-wider text-[10.5px]">🔒 Locked Business Rule Active</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            If a <code className="text-indigo-300 font-mono font-bold">Complaint ID</code> already exists with status <code className="text-amber-300 font-bold bg-amber-950/60 px-1 py-0.5 rounded">Final Closed</code> in the database, that row will be <strong>completely skipped</strong> (no fields modified). All other records will be created or updated seamlessly with incoming data.
          </p>
        </div>
      </div>

      {/* Upload Zone & Path Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: File Upload & Controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Select Complaint Dataset
              </h2>
              {selectedFile && !isUploading && (
                <button
                  onClick={handleReset}
                  className="text-[10.5px] text-rose-600 hover:text-rose-700 font-bold uppercase cursor-pointer"
                >
                  Clear File
                </button>
              )}
            </div>

            {/* Drag and Drop Zone */}
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!isUploading && e.dataTransfer.files?.[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isUploading
                  ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                  : selectedFile
                  ? "border-indigo-400 bg-indigo-50/30 cursor-pointer hover:bg-indigo-50/50"
                  : "border-slate-300 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                disabled={isUploading}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-1">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {fileType.toUpperCase()} Format
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to choose CSV/XLSX file or drag & drop here
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Accepts 22-column complaint data format (Up to 1,000,000+ rows)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Detected Stats & Path Indicator */}
            {selectedFile && (
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Detected Volume:</span>
                  <span className="font-bold text-slate-900">
                    ~{estimatedRows.toLocaleString()} Estimated Rows
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Selected Execution Mode:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-black uppercase tracking-wider ${
                      uploadPath === "A"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                    }`}
                  >
                    {uploadPath === "A" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Path A: Fast Synchronous Stream (≤ 75k rows)
                      </>
                    ) : (
                      <>
                        <Layers className="w-3 h-3 text-indigo-600" />
                        Path B: Cloudflare Queue Async Processing (&gt; 75k rows)
                      </>
                    )}
                  </span>
                </div>

                {/* Path Selector Manual Override */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Execution Strategy:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setUploadPath("A")}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        uploadPath === "A"
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Path A (Direct)
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setUploadPath("B")}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        uploadPath === "B"
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Path B (Queues)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedFile && !completedSummary && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isUploading || inspectingFile}
                  onClick={handleStartUpload}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ingesting Complaint Dataset...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Start Data Ingestion ({uploadPath === "A" ? "Path A" : "Path B"})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Progress Meter */}
            {isUploading && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    {statusMessage || "Processing data..."}
                  </span>
                  <span className="font-black text-indigo-700 text-sm">{progressPercent}%</span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {activeJobId && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    Cloudflare Queue Job Reference: {activeJobId}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Final Results Summary Card */}
          {completedSummary && (
            <div className="bg-white border border-emerald-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Ingestion Successfully Completed
                  </h3>
                </div>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 bg-slate-800 text-white rounded text-[10.5px] font-bold uppercase hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  Upload Another File
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-center">
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    New Complaints
                  </span>
                  <span className="text-xl font-black text-emerald-900">
                    {completedSummary.inserted.toLocaleString()}
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                  <span className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    Updated Complaints
                  </span>
                  <span className="text-xl font-black text-blue-900">
                    {completedSummary.updated.toLocaleString()}
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                  <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Skipped (Final Closed)
                  </span>
                  <span className="text-xl font-black text-amber-900">
                    {completedSummary.skipped_final_closed.toLocaleString()}
                  </span>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded p-3 text-center">
                  <span className="block text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                    Skipped (Invalid ID)
                  </span>
                  <span className="text-xl font-black text-rose-900">
                    {completedSummary.skipped_invalid.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Format Guidelines & Live Metrics */}
        <div className="space-y-4">
          {/* Live Ingestion Metric Feed */}
          {isUploading && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Live Ingestion Metrics
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Processed Rows:</span>
                  <span className="font-bold text-slate-900">{stats.processed_rows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-emerald-600 font-semibold">New Inserted:</span>
                  <span className="font-bold text-emerald-700">{stats.inserted.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-blue-600 font-semibold">Updated:</span>
                  <span className="font-bold text-blue-700">{stats.updated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-amber-600 font-semibold">Skipped (Final Closed):</span>
                  <span className="font-bold text-amber-700">{stats.skipped_final_closed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-rose-600 font-semibold">Skipped (Invalid):</span>
                  <span className="font-bold text-rose-700">{stats.skipped_invalid.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Expected CSV Column Format Guide */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              Fixed 22-Column Schema
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              The uploaded file must contain the standard 22 column headers in exact sequence:
            </p>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 max-h-56 overflow-y-auto font-mono text-[10px] text-slate-700 space-y-1">
              {[
                "1. District Name",
                "2. Hospital Type",
                "3. Hospital Name",
                "4. Bar Code",
                "5. Equipment Name",
                "6. Equipment Model",
                "7. Complaint ID (Unique Key)",
                "8. Complaint Raise Date",
                "9. Complaint Close date",
                "10. Complaint Status",
                "11. Total Downtime",
                "12. Estimated Cost",
                "13. Penalty Days",
                "14. Complaint Final Close",
                "15. Attend Date",
                "16. Attend Penalty",
                "17. Delay Penalty",
                "18. Total Penalty(Attend+Delay)",
                "19. Is Under Warrenty",
                "20. Service Provider Name",
                "21. Attended Service Engg ID",
                "22. Closing Service Engg ID"
              ].map((col, idx) => (
                <div key={idx} className="truncate">
                  {col}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
