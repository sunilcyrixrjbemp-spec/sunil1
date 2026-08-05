/**
 * Production-Grade Standalone GDrive -> Cloudflare R2 Migration Suite
 * Cyrix Field Connect
 *
 * Migrates all historic files across 4 database tables:
 * 1. expense_attachments (630 bill files)
 * 2. expense_breakdown_calls (4,820 breakdown photos)
 * 3. expense_pms_calls (2,100 PMS photos)
 * 4. expenses (11 claim attachment JSON lists)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const WRANGLER_BIN = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\.bin\\wrangler.cmd"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_migration";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runD1Query(sql) {
  try {
    const tmpSqlFile = path.join(TEMP_DIR, `query_${Date.now()}.sql`);
    fs.writeFileSync(tmpSqlFile, sql);
    const cmd = `${WRANGLER_BIN} d1 execute expense_management_db --remote --file "${tmpSqlFile}" --json`;
    const output = execSync(cmd, { cwd: "c:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    if (fs.existsSync(tmpSqlFile)) fs.unlinkSync(tmpSqlFile);

    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("D1 Execution error:", e.message);
    return [];
  }
}

function uploadToR2(r2Key, filePath) {
  const cmd = `${WRANGLER_BIN} r2 object put "fieldops-uploads/${r2Key}" --file "${filePath}" --remote`;
  execSync(cmd, { cwd: "c:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
  return `/api/r2/file/${encodeURIComponent(r2Key)}`;
}

function extractFileId(url) {
  if (!url) return null;
  const match = url.match(/gdrive\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function downloadGDriveFile(fileId) {
  const urls = [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
  ];
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 500) {
          const bytes = new Uint8Array(buf).slice(0, 4);
          if (bytes[0] !== 0x3C) return { buffer: Buffer.from(buf), size: buf.byteLength };
        }
      }
    } catch (_) {}
  }
  return null;
}

async function migrateBatch(batchSize = 25) {
  console.log(`\n======================================================`);
  console.log(`🚀 CYRIX FIELD CONNECT — GDrive -> R2 Migration Suite`);
  console.log(`======================================================\n`);

  let totalMigrated = 0;
  let totalFailed = 0;

  // 1. Migrate expense_attachments
  const attachments = runD1Query(`SELECT id, exp_id, bill_type, file_url FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%') LIMIT ${batchSize}`);
  console.log(`[expense_attachments] Processing ${attachments.length} items...`);

  for (const item of attachments) {
    const fileId = extractFileId(item.file_url);
    if (!fileId) continue;

    console.log(`  -> Downloading ID ${item.id} (FileID: ${fileId})...`);
    const fileData = await downloadGDriveFile(fileId);

    if (!fileData) {
      console.error(`  ❌ Failed to download ID ${item.id}`);
      totalFailed++;
      continue;
    }

    const localPath = path.join(TEMP_DIR, `${fileId}.jpg`);
    fs.writeFileSync(localPath, fileData.buffer);

    const safeCode = (item.exp_id || "EXP").replace(/[^a-zA-Z0-9_-]/g, "");
    const safeBill = (item.bill_type || "Bill").replace(/[^a-zA-Z0-9_-]/g, "");
    const r2Key = `expenses/2026/08-August/expense_photos/${safeCode}_${safeBill}_${fileId}.jpg`;

    try {
      const r2Url = uploadToR2(r2Key, localPath);
      runD1Query(`UPDATE expense_attachments SET file_url = '${r2Url}' WHERE id = ${item.id};`);

      const now = new Date().toISOString();
      const metaSql = `INSERT INTO file_metadata (expense_code, original_filename, safe_filename, file_size, content_type, r2_object_key, r2_url, r2_bucket, upload_source, gdrive_file_id, category, upload_date, created_at, updated_at) VALUES ('${safeCode}', '${fileId}.jpg', '${safeCode}_${safeBill}.jpg', ${fileData.size}, 'image/jpeg', '${r2Key}', '${r2Url}', 'fieldops-uploads', 'r2', '${fileId}', 'expense_photo', '${now}', '${now}', '${now}');`;
      runD1Query(metaSql);

      console.log(`  ✅ ID ${item.id} -> Migrated to R2: ${r2Url}`);
      totalMigrated++;
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch (e) {
      console.error(`  ❌ Failed to upload/update ID ${item.id}:`, e.message);
      totalFailed++;
    }
  }

  // 2. Migrate expense_breakdown_calls
  const breakdowns = runD1Query(`SELECT id, call_id, photo_url FROM expense_breakdown_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%') LIMIT ${batchSize}`);
  console.log(`\n[expense_breakdown_calls] Processing ${breakdowns.length} items...`);

  for (const item of breakdowns) {
    const fileId = extractFileId(item.photo_url);
    if (!fileId) continue;

    console.log(`  -> Downloading Breakdown ID ${item.id} (FileID: ${fileId})...`);
    const fileData = await downloadGDriveFile(fileId);

    if (!fileData) {
      console.error(`  ❌ Failed to download Breakdown ID ${item.id}`);
      totalFailed++;
      continue;
    }

    const localPath = path.join(TEMP_DIR, `${fileId}.jpg`);
    fs.writeFileSync(localPath, fileData.buffer);

    const safeCall = (item.call_id || "BD").replace(/[^a-zA-Z0-9_-]/g, "");
    const r2Key = `expenses/2026/08-August/service_reports/SR_${safeCall}_${fileId}.jpg`;

    try {
      const r2Url = uploadToR2(r2Key, localPath);
      runD1Query(`UPDATE expense_breakdown_calls SET photo_url = '${r2Url}' WHERE id = ${item.id};`);

      console.log(`  ✅ Breakdown ID ${item.id} -> Migrated to R2: ${r2Url}`);
      totalMigrated++;
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch (e) {
      console.error(`  ❌ Failed Breakdown ID ${item.id}:`, e.message);
      totalFailed++;
    }
  }

  // 3. Migrate expense_pms_calls
  const pms = runD1Query(`SELECT id, call_id, photo_url FROM expense_pms_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%') LIMIT ${batchSize}`);
  console.log(`\n[expense_pms_calls] Processing ${pms.length} items...`);

  for (const item of pms) {
    const fileId = extractFileId(item.photo_url);
    if (!fileId) continue;

    console.log(`  -> Downloading PMS ID ${item.id} (FileID: ${fileId})...`);
    const fileData = await downloadGDriveFile(fileId);

    if (!fileData) {
      console.error(`  ❌ Failed to download PMS ID ${item.id}`);
      totalFailed++;
      continue;
    }

    const localPath = path.join(TEMP_DIR, `${fileId}.jpg`);
    fs.writeFileSync(localPath, fileData.buffer);

    const safeCall = (item.call_id || "PMS").replace(/[^a-zA-Z0-9_-]/g, "");
    const r2Key = `expenses/2026/08-August/service_reports/PMS_${safeCall}_${fileId}.jpg`;

    try {
      const r2Url = uploadToR2(r2Key, localPath);
      runD1Query(`UPDATE expense_pms_calls SET photo_url = '${r2Url}' WHERE id = ${item.id};`);

      console.log(`  ✅ PMS ID ${item.id} -> Migrated to R2: ${r2Url}`);
      totalMigrated++;
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch (e) {
      console.error(`  ❌ Failed PMS ID ${item.id}:`, e.message);
      totalFailed++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 BATCH SUMMARY: Migrated: ${totalMigrated} | Failed: ${totalFailed}`);
  console.log(`======================================================\n`);
}

migrateBatch(25);
