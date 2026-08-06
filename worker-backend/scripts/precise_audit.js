import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_audit";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runQuery(sql) {
  const tmpFile = path.join(TEMP_DIR, `query_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    return JSON.parse(output.substring(jsonStart))[0]?.results || [];
  } catch (e) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.error("Query Error:", e.message);
    return [];
  }
}

async function audit() {
  console.log("=== PRECISE AUDIT OF ALL 6 DB TABLES ===");

  const t1 = runQuery("SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%googleusercontent%'");
  console.log("1. expense_attachments GDrive count:", t1[0]?.cnt);

  const t2 = runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'");
  console.log("2. expense_breakdown_calls GDrive count:", t2[0]?.cnt);

  const t3 = runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'");
  console.log("3. expense_pms_calls GDrive count:", t3[0]?.cnt);

  const t4 = runQuery("SELECT COUNT(*) as cnt FROM expenses WHERE attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%googleusercontent%'");
  console.log("4. expenses GDrive count:", t4[0]?.cnt);

  const t5 = runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%googleusercontent%'");
  console.log("5. expense_itineraries GDrive count:", t5[0]?.cnt);

  const t6a = runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE gdrive_file_id IS NOT NULL AND gdrive_file_id != ''");
  console.log("6a. file_metadata gdrive_file_id count:", t6a[0]?.cnt);

  const t6b = runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%' OR r2_url LIKE '%gdrive%'");
  console.log("6b. file_metadata google/gdrive r2_url count:", t6b[0]?.cnt);
}

audit();
