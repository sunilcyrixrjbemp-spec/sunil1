let pdfJsPromise: Promise<any> | null = null;

const loadPdfJs = (): Promise<any> => {
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = () => {
      pdfJsPromise = null;
      reject(new Error("Failed to load PDF.js script from CDN"));
    };
    document.head.appendChild(script);
  });

  return pdfJsPromise;
};

export const checkIsPdf = (fileOrUrl: string | File | Blob | null | undefined): boolean => {
  if (!fileOrUrl) return false;
  if (typeof fileOrUrl === "string") {
    const lower = fileOrUrl.toLowerCase();
    return lower.endsWith(".pdf") || lower.includes(".pdf?");
  }
  const type = fileOrUrl.type || "";
  const name = (fileOrUrl as File).name?.toLowerCase() || "";
  return type === "application/pdf" || name.endsWith(".pdf");
};

/**
 * Renders all pages of a PDF File/Blob onto a high-definition canvas (scale: 2.0)
 * and converts the document into a crisp JPEG/JPG File.
 */
export const convertPdfToJpgFile = async (
  pdfFile: File | Blob,
  originalFilename?: string,
  onProgress?: (status: "loading_lib" | "rendering" | "done" | "error") => void
): Promise<File> => {
  try {
    if (onProgress) onProgress("loading_lib");
    const pdfjsLib = await loadPdfJs();

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;

    if (onProgress) onProgress("rendering");

    const pageViewports: any[] = [];
    let totalWidth = 0;
    let totalHeight = 0;

    // Render up to 5 pages vertically stacked
    const maxPages = Math.min(numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2.0 }); // High-res 2x scaling for ultra crisp text
      pageViewports.push({ page, viewport: vp });
      if (vp.width > totalWidth) totalWidth = vp.width;
      totalHeight += vp.height;
    }

    const canvas = document.createElement("canvas");
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const context = canvas.getContext("2d");

    if (context) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, totalWidth, totalHeight);
    }

    let currentY = 0;
    for (const item of pageViewports) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = item.viewport.width;
      tempCanvas.height = item.viewport.height;
      const tempContext = tempCanvas.getContext("2d");
      await item.page.render({ canvasContext: tempContext, viewport: item.viewport }).promise;

      if (context) {
        context.drawImage(tempCanvas, 0, currentY);
      }
      currentY += item.viewport.height;
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          if (onProgress) onProgress("error");
          reject(new Error("Canvas to JPG blob conversion failed"));
          return;
        }
        const baseName = (originalFilename || (pdfFile as File).name || "document.pdf").replace(/\.pdf$/i, "");
        const jpgName = `${baseName}.jpg`;
        const jpgFile = new File([blob], jpgName, { type: "image/jpeg", lastModified: Date.now() });
        if (onProgress) onProgress("done");
        resolve(jpgFile);
      }, "image/jpeg", 0.90);
    });
  } catch (err) {
    console.error("PDF to JPG conversion error:", err);
    if (onProgress) onProgress("error");
    throw err;
  }
};
