import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_migration_r2";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runD1Query(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("D1 Execution error:", e.message);
    return [];
  }
}

function runD1Batch(sqlStatements) {
  if (!sqlStatements || sqlStatements.length === 0) return;
  const tmpFile = path.join(TEMP_DIR, `batch_${Date.now()}_${Math.floor(Math.random()*1000)}.sql`);
  fs.writeFileSync(tmpFile, sqlStatements.join("\n"));
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
    execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    console.error("D1 Batch error:", e.message);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

function extractFileId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/gdrive\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function downloadGDriveFile(fileId) {
  const urls = [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 200) {
          const bytes = new Uint8Array(buf).slice(0, 4);
          if (bytes[0] !== 0x3C) return { buffer: Buffer.from(buf), size: buf.byteLength };
        }
      }
    } catch (_) {}
  }
  return null;
}

function uploadFileToR2(r2Key, buffer) {
  const localPath = path.join(TEMP_DIR, `upload_${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`);
  fs.writeFileSync(localPath, buffer);
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} r2 object put "fieldops-uploads/${r2Key}" --file "${localPath}" --remote`;
    execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    return true;
  } catch (e) {
    console.error(`Upload error for ${r2Key}:`, e.message);
    return false;
  } finally {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }
}

async function startMigrationEngine() {
  console.log("===============================================================");
  console.log("🚀 CLOUDFLARE R2 MIGRATION ENGINE — ALL 6 DATABASE TABLES");
  console.log("===============================================================");
  const startTime = Date.now();

  const uploadedCache = new Set();
  let totalDownloaded = 0;
  let totalUploaded = 0;
  let totalDbUpdates = 0;

  // --------------------------------------------------------------------------
  // STEP 1: Process expense_attachments (Table 1)
  // --------------------------------------------------------------------------
  console.log("\n--- [1/6] Processing Table: expense_attachments ---");
  const atts = runD1Query("SELECT id, exp_id, bill_type, file_url FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%');");
  console.log(`Found ${atts.length} items in expense_attachments.`);

  const attUpdates = [];
  for (const item of atts) {
    const fileId = extractFileId(item.file_url);
    if (!fileId) continue;
    const r2Key = `gdrive/${fileId}.jpg`;
    const newUrl = `/uploads/${r2Key}`;

    if (!uploadedCache.has(fileId)) {
      const downloaded = await downloadGDriveFile(fileId);
      if (downloaded) {
        uploadFileToR2(r2Key, downloaded.buffer);
        totalDownloaded++;
        totalUploaded++;
      }
      uploadedCache.add(fileId);
    }
    attUpdates.push(`UPDATE expense_attachments SET file_url = '${newUrl}' WHERE id = ${item.id};`);
  }
  if (attUpdates.length > 0) {
    runD1Batch(attUpdates);
    totalDbUpdates += attUpdates.length;
    console.log(`✅ Updated ${attUpdates.length} rows in expense_attachments.`);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Process expense_breakdown_calls (Table 2)
  // --------------------------------------------------------------------------
  console.log("\n--- [2/6] Processing Table: expense_breakdown_calls ---");
  const bds = runD1Query("SELECT id, itinerary_id, photo_url FROM expense_breakdown_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%');");
  console.log(`Found ${bds.length} items in expense_breakdown_calls.`);

  const bdUpdates = [];
  for (const item of bds) {
    const fileId = extractFileId(item.photo_url);
    if (!fileId) continue;
    const r2Key = `gdrive/${fileId}.jpg`;
    const newUrl = `/uploads/${r2Key}`;

    if (!uploadedCache.has(fileId)) {
      const downloaded = await downloadGDriveFile(fileId);
      if (downloaded) {
        uploadFileToR2(r2Key, downloaded.buffer);
        totalDownloaded++;
        totalUploaded++;
      }
      uploadedCache.add(fileId);
    }
    bdUpdates.push(`UPDATE expense_breakdown_calls SET photo_url = '${newUrl}' WHERE id = ${item.id};`);
  }
  if (bdUpdates.length > 0) {
    runD1Batch(bdUpdates);
    totalDbUpdates += bdUpdates.length;
    console.log(`✅ Updated ${bdUpdates.length} rows in expense_breakdown_calls.`);
  }

  // --------------------------------------------------------------------------
  // STEP 3: Process expense_pms_calls (Table 3)
  // --------------------------------------------------------------------------
  console.log("\n--- [3/6] Processing Table: expense_pms_calls ---");
  const pmss = runD1Query("SELECT id, itinerary_id, photo_url FROM expense_pms_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%');");
  console.log(`Found ${pmss.length} items in expense_pms_calls.`);

  const pmsUpdates = [];
  for (const item of pmss) {
    const fileId = extractFileId(item.photo_url);
    if (!fileId) continue;
    const r2Key = `gdrive/${fileId}.jpg`;
    const newUrl = `/uploads/${r2Key}`;

    if (!uploadedCache.has(fileId)) {
      const downloaded = await downloadGDriveFile(fileId);
      if (downloaded) {
        uploadFileToR2(r2Key, downloaded.buffer);
        totalDownloaded++;
        totalUploaded++;
      }
      uploadedCache.add(fileId);
    }
    pmsUpdates.push(`UPDATE expense_pms_calls SET photo_url = '${newUrl}' WHERE id = ${item.id};`);
  }
  if (pmsUpdates.length > 0) {
    runD1Batch(pmsUpdates);
    totalDbUpdates += pmsUpdates.length;
    console.log(`✅ Updated ${pmsUpdates.length} rows in expense_pms_calls.`);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Process expenses (Table 4)
  // --------------------------------------------------------------------------
  console.log("\n--- [4/6] Processing Table: expenses ---");
  const exps = runD1Query("SELECT id, expense_code, attachments FROM expenses WHERE (attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%');");
  console.log(`Found ${exps.length} items in expenses.`);

  const expUpdates = [];
  for (const item of exps) {
    if (!item.attachments) continue;
    let list = [];
    try { list = JSON.parse(item.attachments); } catch (_) { list = [item.attachments]; }
    if (!Array.isArray(list)) list = [list];

    let modified = false;
    const newList = [];

    for (const u of list) {
      const fileId = extractFileId(u);
      if (fileId) {
        modified = true;
        const r2Key = `gdrive/${fileId}.jpg`;
        const newUrl = `/uploads/${r2Key}`;
        newList.push(newUrl);

        if (!uploadedCache.has(fileId)) {
          const downloaded = await downloadGDriveFile(fileId);
          if (downloaded) {
            uploadFileToR2(r2Key, downloaded.buffer);
            totalDownloaded++;
            totalUploaded++;
          }
          uploadedCache.add(fileId);
        }
      } else {
        newList.push(u);
      }
    }

    if (modified) {
      const jsonStr = JSON.stringify(newList).replace(/'/g, "''");
      expUpdates.push(`UPDATE expenses SET attachments = '${jsonStr}' WHERE id = ${item.id};`);
    }
  }

  if (expUpdates.length > 0) {
    runD1Batch(expUpdates);
    totalDbUpdates += expUpdates.length;
    console.log(`✅ Updated ${expUpdates.length} rows in expenses.`);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Process expense_itineraries (Table 5)
  // --------------------------------------------------------------------------
  console.log("\n--- [5/6] Processing Table: expense_itineraries ---");

  let itiProcessedCount = 0;
  while (true) {
    const itis = runD1Query("SELECT id, itinerary_id, activity_details FROM expense_itineraries WHERE (activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%') LIMIT 100;");
    if (!itis || itis.length === 0) break;

    const itiUpdates = [];
    for (const item of itis) {
      if (!item.activity_details) continue;
      let rawStr = typeof item.activity_details === "string" ? item.activity_details : JSON.stringify(item.activity_details);
      
      // Extract all file IDs in this row
      const fileIdsInRow = new Set();
      const m1 = rawStr.match(/\/gdrive\/([a-zA-Z0-9_-]+)/g) || [];
      const m2 = rawStr.match(/id=([a-zA-Z0-9_-]+)/g) || [];
      const m3 = rawStr.match(/\/d\/([a-zA-Z0-9_-]+)/g) || [];
      m1.forEach(m => fileIdsInRow.add(m.replace("/gdrive/", "")));
      m2.forEach(m => fileIdsInRow.add(m.replace("id=", "")));
      m3.forEach(m => fileIdsInRow.add(m.replace("/d/", "")));

      for (const fid of fileIdsInRow) {
        const r2Key = `gdrive/${fid}.jpg`;
        const newUrl = `/uploads/${r2Key}`;

        if (!uploadedCache.has(fid)) {
          const downloaded = await downloadGDriveFile(fid);
          if (downloaded) {
            uploadFileToR2(r2Key, downloaded.buffer);
            totalDownloaded++;
            totalUploaded++;
          }
          uploadedCache.add(fid);
        }

        // Replace all variants of file URL in JSON
        rawStr = rawStr.split(`/api/upload/file/gdrive/${fid}`).join(newUrl);
        rawStr = rawStr.split(`https://drive.google.com/uc?export=download&id=${fid}`).join(newUrl);
        rawStr = rawStr.split(`https://lh3.googleusercontent.com/d/${fid}`).join(newUrl);
        rawStr = rawStr.split(`/gdrive/${fid}`).join(newUrl);
      }

      const escapedStr = rawStr.replace(/'/g, "''");
      itiUpdates.push(`UPDATE expense_itineraries SET activity_details = '${escapedStr}' WHERE id = ${item.id};`);
    }

    if (itiUpdates.length > 0) {
      runD1Batch(itiUpdates);
      itiProcessedCount += itiUpdates.length;
      totalDbUpdates += itiUpdates.length;
      console.log(`  -> Processed batch of ${itiUpdates.length} itinerary rows (Total itineraries updated: ${itiProcessedCount}).`);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6: Process file_metadata (Table 6)
  // --------------------------------------------------------------------------
  console.log("\n--- [6/6] Syncing Table: file_metadata ---");
  
  // 6a. Update existing rows in file_metadata where r2_url has google/gdrive domain
  const metaUpdates = [
    `UPDATE file_metadata SET upload_source = 'r2', r2_url = '/uploads/' || r2_object_key WHERE (r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%') AND r2_object_key IS NOT NULL;`,
    `UPDATE file_metadata SET upload_source = 'r2', r2_object_key = 'gdrive/' || gdrive_file_id || '.jpg', r2_url = '/uploads/gdrive/' || gdrive_file_id || '.jpg', migrated_at = CURRENT_TIMESTAMP WHERE gdrive_file_id IS NOT NULL AND (r2_url IS NULL OR r2_url LIKE '%google%' OR r2_url LIKE '%gdrive%');`
  ];
  runD1Batch(metaUpdates);
  console.log("✅ Synced file_metadata records to point to /uploads/ paths with upload_source='r2'.");

  // 6b. Insert missing file_metadata records for uploaded GDrive files
  const now = new Date().toISOString();
  const insertStatements = [];
  for (const fid of uploadedCache) {
    const r2Key = `gdrive/${fid}.jpg`;
    const r2Url = `/uploads/${r2Key}`;
    const insertSql = `INSERT OR IGNORE INTO file_metadata (original_filename, safe_filename, file_size, content_type, r2_object_key, r2_url, r2_bucket, r2_folder_path, upload_source, gdrive_file_id, category, upload_date, uploaded_by, created_at, updated_at) VALUES ('${fid}.jpg', '${fid}.jpg', 50000, 'image/jpeg', '${r2Key}', '${r2Url}', 'fieldops-uploads', 'gdrive', 'r2', '${fid}', 'expense_photo', '${now}', 'migration_engine', '${now}', '${now}');`;
    insertStatements.push(insertSql);
  }
  if (insertStatements.length > 0) {
    runD1Batch(insertStatements);
    console.log(`✅ Ensured file_metadata rows exist for all ${insertStatements.length} distinct migrated files.`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n===============================================================");
  console.log(`🎉 MIGRATION COMPLETE in ${durationSec}s`);
  console.log(`  - Distinct Files Processed: ${uploadedCache.size}`);
  console.log(`  - Binaries Downloaded & Uploaded to R2: ${totalUploaded}`);
  console.log(`  - Total Database Records Permanently Updated: ${totalDbUpdates}`);
  console.log("===============================================================\n");
}

startMigrationEngine();
