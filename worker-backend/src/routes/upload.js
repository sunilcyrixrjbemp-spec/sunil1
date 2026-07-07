function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Generate a safe unique filename with random suffix
 */
function makeSafeFilename(filename) {
  const parts = filename.split(".");
  const ext = parts.pop();
  const name = parts.join("_").replace(/[^a-zA-Z0-9_]/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `${name}_${randomSuffix}.${ext}`;
}

async function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to upload file to Google Drive via Google Apps Script Web App
 */
export async function uploadToGoogleDrive(env, file, folderName, filename) {
  const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  const parentFolderId = "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu"; // Default parent folder ID from settings

  const arrayBuffer = await file.arrayBuffer();
  const base64Content = await arrayBufferToBase64(arrayBuffer);

  const payload = {
    action: "upload_file",
    folderId: parentFolderId,
    folderName: folderName,
    filename: filename,
    fileBase64: base64Content,
    mimeType: file.type || "application/octet-stream"
  };

  const response = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 200) {
    const result = await response.json();
    if (result.success) {
      return result.fileId;
    } else {
      throw new Error("GAS Upload returned failure: " + result.error);
    }
  } else {
    const errText = await response.text();
    throw new Error(`GAS Upload returned HTTP ${response.status}: ${errText}`);
  }
}

/**
 * Helper to delete file from Google Drive via Google Apps Script Web App
 */
export async function deleteFromGoogleDrive(env, fileId) {
  const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
  const payload = {
    action: "delete_file",
    fileId: fileId
  };

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (response.status === 200) {
      const result = await response.json();
      return !!result.success;
    }
  } catch (e) {
    console.error("Failed to delete from GDrive:", e);
  }
  return false;
}

/**
 * POST /api/upload/image
 */
export async function handleUploadImage(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }

  const file = formData.get("file");
  if (!file) return jsonResponse({ error: "No file uploaded" }, 400);

  // Accept any file format/extension uploaded by the client

  const fileBuffer = await file.arrayBuffer();
  if (fileBuffer.byteLength > 10 * 1024 * 1024) {
    return jsonResponse({ error: "File size exceeds the limit of 10MB." }, 400);
  }

  const safeName = makeSafeFilename(file.name);
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const yearVal = now.getFullYear();
  const folderName = `${monthName}_${yearVal}`;

  try {
    const fileId = await uploadToGoogleDrive(env, file, folderName, safeName);
    return jsonResponse({
      filename: file.name,
      url: `/api/upload/file/gdrive/${fileId}`
    });
  } catch (e) {
    console.error("GDrive Upload failed:", e);
    return jsonResponse({ error: "Google Drive Upload failed: " + e.message }, 500);
  }
}

/**
 * POST /api/upload/document
 */
export async function handleUploadDocument(request, env, params, query, user) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid multipart form data" }, 400);
  }

  const file = formData.get("file");
  if (!file) return jsonResponse({ error: "No file uploaded" }, 400);

  const safeName = makeSafeFilename(file.name);
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const yearVal = now.getFullYear();
  const folderName = `${monthName}_${yearVal}`;

  try {
    const fileId = await uploadToGoogleDrive(env, file, folderName, safeName);
    return jsonResponse({
      filename: file.name,
      url: `/api/upload/file/gdrive/${fileId}`
    });
  } catch (e) {
    console.error("GDrive Upload failed:", e);
    return jsonResponse({ error: "Google Drive Upload failed: " + e.message }, 500);
  }
}

/**
 * GET /api/upload/file/*
 * Serve objects from Google Drive or Cloudflare R2 fallback
 */
export async function handleServeFile(request, env, params, query, user) {
  // Extract file path from URL
  const urlObj = new URL(request.url);
  const pathPrefix = "/api/upload/file/";
  const key = decodeURIComponent(urlObj.pathname.substring(urlObj.pathname.indexOf(pathPrefix) + pathPrefix.length));

  // 1. Google Drive Fetch Proxy
  if (key.startsWith("gdrive/")) {
    const fileId = key.replace("gdrive/", "");
    const gasUrl = env.GAS_WEB_APP_URL || "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec";
    
    try {
      const payload = {
        action: "download_file",
        fileId: fileId
      };
      
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (response.status === 200) {
        const result = await response.json();
        if (result.success) {
          const fileBase64 = result.fileBase64;
          const contentType = result.mimeType || "application/octet-stream";
          
          // Convert base64 to binary bytes
          const binaryStr = atob(fileBase64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000"
            }
          });
        } else {
          return new Response("File not found in Google Drive: " + result.error, { status: 404 });
        }
      } else {
        return new Response("Failed to fetch from Google Drive proxy", { status: response.status });
      }
    } catch (e) {
      console.error("Error serving from Google Drive:", e);
      return new Response("Internal Server Error serving Google Drive file", { status: 500 });
    }
  }

  // 2. Cloudflare R2 serving fallback
  const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const bucketName = "fieldops-uploads";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;

  try {
    const token = env.PRIMARY_CLOUDFLARE_API_TOKEN;
    const email = env.PRIMARY_CLOUDFLARE_EMAIL;
    const headers = {};

    if (token && token.startsWith("cfk_")) {
      headers["X-Auth-Key"] = token;
      headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
    } else if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: headers
    });

    if (res.status === 200) {
      const contentType = res.headers.get("Content-Type") || "application/octet-stream";
      return new Response(res.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000"
        }
      });
    } else {
      return new Response("File not found", { status: 404 });
    }
  } catch (e) {
    console.error("Error serving R2 object:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
