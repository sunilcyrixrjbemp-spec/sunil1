/**
 * 🤖 PRODUCTION-GRADE AUTONOMOUS PDF BILL ATTACHMENT GENERATOR & FIXER
 * Enterprise Resilient Pipeline for indrae.in Expense PDF Reports
 */

// ─── UTILITY 1: Fallback Canvas Placeholder Generator ────────────────────────
export const generatePlaceholderImage = (fileName = "", reason = "Unable to load file attachment"): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Warning Header Box
  ctx.fillStyle = "#fef2f2";
  ctx.fillRect(22, 22, canvas.width - 44, 70);
  ctx.strokeStyle = "#fecaca";
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, canvas.width - 44, 70);

  ctx.fillStyle = "#991b1b";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("📄 ATTACHMENT FILE NOT ACCESSIBLE", canvas.width / 2, 65);

  // Message
  ctx.fillStyle = "#334155";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText(fileName || "Bill Receipt Attachment", canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = "15px Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(reason, canvas.width / 2, canvas.height / 2 + 20);
  ctx.fillText("(Check network permissions, CORS origin, or original file storage)", canvas.width / 2, canvas.height / 2 + 50);

  // Footer Audit Timestamp
  ctx.font = "12px monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Audit System Timestamp: ${new Date().toISOString()}`, canvas.width / 2, canvas.height - 40);

  return canvas.toDataURL("image/jpeg", 0.85);
};

// ─── UTILITY 2: PDF to JPEG Converter via pdf.js ──────────────────────────────
export const convertPdfBlobToJpegBase64 = async (pdfBlob: Blob, fileName = ""): Promise<string> => {
  try {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      console.warn("pdfjsLib not loaded on window, using placeholder for PDF:", fileName);
      return generatePlaceholderImage(fileName, "PDF.js engine loading error");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    if (!pdfDoc || pdfDoc.numPages === 0) {
      return generatePlaceholderImage(fileName, "PDF document contains 0 pages");
    }

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // High-Res Retina scaling

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");

    if (!context) return generatePlaceholderImage(fileName, "Canvas 2D Context initialization failed");

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (e: any) {
    console.error(`🔴 PDF rendering failed for ${fileName}:`, e?.message || e);
    return generatePlaceholderImage(fileName, `PDF Render Error: ${e?.message || "Corrupted File"}`);
  }
};

// ─── FIX #1: Robust Bill Fetcher with Retry & Exponential Backoff ─────────────
export const fetchBillWithRetry = async (
  fileUrl: string,
  fileName = "",
  maxRetries = 3,
  timeoutMs = 15000
): Promise<string> => {
  if (!fileUrl) return generatePlaceholderImage(fileName, "No file URL provided");
  if (fileUrl.startsWith("data:image/")) return fileUrl;

  const getAbsoluteUrl = (u: string) => {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
    return `${window.location.origin}${u.startsWith("/") ? "" : "/"}${u}`;
  };

  const targetUrl = getAbsoluteUrl(fileUrl);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`📥 [Attempt ${attempt}/${maxRetries}] Fetching bill: ${fileName} (${targetUrl.substring(0, 70)}...)`);

      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timerId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const blob = await response.blob();

      console.log(`✅ [Success] Fetched ${fileName}: Type=${blob.type || contentType}, Size=${(blob.size / 1024).toFixed(1)}KB`);

      if (contentType.includes("pdf") || blob.type.includes("pdf") || targetUrl.toLowerCase().includes(".pdf")) {
        return await convertPdfBlobToJpegBase64(blob, fileName);
      }

      // Convert image blob to Base64
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          if (res && res.startsWith("data:image/")) resolve(res);
          else resolve(generatePlaceholderImage(fileName, "FileReader produced invalid image format"));
        };
        reader.onerror = () => reject(new Error("FileReader error reading image blob"));
        reader.readAsDataURL(blob);
      });
    } catch (err: any) {
      clearTimeout(timerId);
      console.warn(`⚠️ [Attempt ${attempt}/${maxRetries} Failed] ${fileName}: ${err?.message || err}`);

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms, 2000ms
        console.log(`⏳ Backing off for ${backoffMs}ms before retry...`);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

  console.error(`🔴 Permanent failure fetching bill: ${fileName}`);
  return generatePlaceholderImage(fileName, `Failed after ${maxRetries} retry attempts`);
};

// ─── FIX #3: Batched Parallel Base64 Pre-fetcher (Concurrency Control) ────────
export const batchPreFetchBills = async (
  billItems: { url: string; fileName: string; billType?: string; date?: string }[],
  concurrencyLimit = 5
): Promise<{ url: string; fileName: string; base64: string; status: "success" | "placeholder" }[]> => {
  const results: { url: string; fileName: string; base64: string; status: "success" | "placeholder" }[] = [];

  console.log(`🚀 Starting Batched Bill Pre-fetch: ${billItems.length} total items (Concurrency = ${concurrencyLimit})`);

  for (let i = 0; i < billItems.length; i += concurrencyLimit) {
    const batch = billItems.slice(i, i + concurrencyLimit);
    console.log(`📦 Processing batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(billItems.length / concurrencyLimit)}...`);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const base64 = await fetchBillWithRetry(item.url, item.fileName);
        const isPlaceholder = base64.includes("📄 ATTACHMENT FILE NOT ACCESSIBLE") || base64.includes("Bill Attachment Not Available");
        return {
          url: item.url,
          fileName: item.fileName,
          base64: base64,
          status: (isPlaceholder ? "placeholder" : "success") as "success" | "placeholder"
        };
      })
    );

    results.push(...batchResults);
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const placeholderCount = results.filter((r) => r.status === "placeholder").length;
  console.log(`🎉 Batched Pre-fetch Complete! Success: ${successCount}, Placeholders: ${placeholderCount}`);

  return results;
};
