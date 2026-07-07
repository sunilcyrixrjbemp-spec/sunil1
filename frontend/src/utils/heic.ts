let heic2anyPromise: Promise<any> | null = null;

const loadHeic2Any = (): Promise<any> => {
  if (heic2anyPromise) return heic2anyPromise;
  
  heic2anyPromise = new Promise((resolve, reject) => {
    if ((window as any).heic2any) {
      resolve((window as any).heic2any);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
    script.onload = () => resolve((window as any).heic2any);
    script.onerror = () => {
      heic2anyPromise = null; // Reset on failure
      reject(new Error("Failed to load heic2any script from CDN"));
    };
    document.head.appendChild(script);
  });
  
  return heic2anyPromise;
};

/**
 * Checks asynchronously if a string, File, or Blob represents a HEIC/HEIF image.
 * Supports fetching local blob: URLs to inspect their mime types.
 */
export const checkIsHeic = async (fileOrUrl: string | File | Blob | null | undefined): Promise<boolean> => {
  if (!fileOrUrl) return false;
  
  if (typeof fileOrUrl === "string") {
    const lower = fileOrUrl.toLowerCase();
    if (lower.endsWith(".heic") || lower.endsWith(".heif") || lower.includes(".heic?") || lower.includes(".heif?")) {
      return true;
    }
    if (fileOrUrl.startsWith("blob:")) {
      try {
        const response = await fetch(fileOrUrl);
        const blob = await response.blob();
        return blob.type === "image/heic" || blob.type === "image/heif" || 
               blob.type === "image/heic-sequence" || blob.type === "image/heif-sequence" ||
               (blob.type === "application/octet-stream" && (blob.name?.toLowerCase()?.endsWith(".heic") || false));
      } catch (_) {
        return false;
      }
    }
    return false;
  }
  
  const type = fileOrUrl.type || "";
  const name = (fileOrUrl as File).name?.toLowerCase() || "";
  return name.endsWith(".heic") || name.endsWith(".heif") || 
         type === "image/heic" || type === "image/heif";
};

/**
 * Converts a HEIC/HEIF File, Blob, or URL to a JPEG Object URL.
 */
export const convertHeicToJpegUrl = async (
  fileOrUrl: string | File | Blob,
  onProgress?: (status: 'loading_lib' | 'fetching_file' | 'converting' | 'done' | 'error') => void
): Promise<string> => {
  try {
    if (onProgress) onProgress('loading_lib');
    const heic2any = await loadHeic2Any();
    
    let blob: Blob;
    if (typeof fileOrUrl === "string") {
      if (onProgress) onProgress('fetching_file');
      const response = await fetch(fileOrUrl);
      if (!response.ok) throw new Error(`Failed to fetch image file: ${response.statusText}`);
      blob = await response.blob();
    } else {
      blob = fileOrUrl;
    }
    
    if (onProgress) onProgress('converting');
    const conversionResult = await heic2any({
      blob,
      toType: "image/jpeg",
      quality: 0.7
    });
    
    const jpegBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    const url = URL.createObjectURL(jpegBlob);
    
    if (onProgress) onProgress('done');
    return url;
  } catch (error) {
    console.error("HEIC conversion failed:", error);
    if (onProgress) onProgress('error');
    throw error;
  }
};
