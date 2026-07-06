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

/**
 * Helper to build headers for Cloudflare REST API (R2 operations)
 */
function buildR2Headers(env) {
  const token = env.PRIMARY_CLOUDFLARE_API_TOKEN;
  const email = env.PRIMARY_CLOUDFLARE_EMAIL;
  const headers = {};

  if (token.startsWith("cfk_")) {
    headers["X-Auth-Key"] = token;
    headers["X-Auth-Email"] = email || "Sunil.cyrixrjbemp@gmail.com";
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
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

  const ext = file.name.split(".").pop().toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "pdf", "heic", "heif", "webp"];
  if (!allowed.includes(ext)) {
    return jsonResponse({ error: "Only JPG, JPEG, PNG, PDF, HEIC, HEIF, and WEBP files are allowed for receipts." }, 400);
  }

  const fileBuffer = await file.arrayBuffer();
  if (fileBuffer.byteLength > 10 * 1024 * 1024) {
    return jsonResponse({ error: "File size exceeds the limit of 10MB." }, 400);
  }

  const safeName = makeSafeFilename(file.name);
  const key = `images/${safeName}`;

  // Upload to Primary Cloudflare R2 Bucket via REST API
  const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const bucketName = "fieldops-uploads";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...buildR2Headers(env),
        "Content-Type": file.type || "application/octet-stream"
      },
      body: fileBuffer
    });

    if (res.status === 200) {
      return jsonResponse({
        filename: file.name,
        url: `/api/upload/file/${key}`
      });
    } else {
      const errText = await res.text();
      console.error(`R2 Upload failed with status ${res.status}: ${errText}`);
      return jsonResponse({ error: "R2 Upload failed" }, 500);
    }
  } catch (e) {
    console.error("R2 connection error:", e);
    return jsonResponse({ error: "R2 Connection error" }, 500);
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

  const fileBuffer = await file.arrayBuffer();
  const safeName = makeSafeFilename(file.name);
  const key = `documents/${safeName}`;

  const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const bucketName = "fieldops-uploads";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...buildR2Headers(env),
        "Content-Type": file.type || "application/octet-stream"
      },
      body: fileBuffer
    });

    if (res.status === 200) {
      return jsonResponse({
        filename: file.name,
        url: `/api/upload/file/${key}`
      });
    } else {
      const errText = await res.text();
      console.error(`R2 Upload failed with status ${res.status}: ${errText}`);
      return jsonResponse({ error: "R2 Upload failed" }, 500);
    }
  } catch (e) {
    console.error("R2 connection error:", e);
    return jsonResponse({ error: "R2 Connection error" }, 500);
  }
}

/**
 * GET /api/upload/file/*
 * Serve objects from Primary R2 Bucket
 */
export async function handleServeFile(request, env, params, query, user) {
  // Extract file path from URL
  const urlObj = new URL(request.url);
  const pathPrefix = "/api/upload/file/";
  const key = decodeURIComponent(urlObj.pathname.substring(urlObj.pathname.indexOf(pathPrefix) + pathPrefix.length));

  const accountId = env.PRIMARY_CLOUDFLARE_ACCOUNT_ID;
  const bucketName = "fieldops-uploads";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: buildR2Headers(env)
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
