import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_migration";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runQuery(sql) {
  const tmpFile = path.join(TEMP_DIR, `query_${Date.now()}_${Math.floor(Math.random()*1000)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.error("Query Error:", e.message);
    return [];
  }
}

console.log("Attachments count:", runQuery("SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%googleusercontent%'"));
console.log("Breakdown count:", runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'"));
console.log("PMS count:", runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'"));
console.log("Expenses count:", runQuery("SELECT COUNT(*) as cnt FROM expenses WHERE attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%googleusercontent%'"));
console.log("Itineraries count:", runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%googleusercontent%'"));
console.log("File metadata count:", runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE gdrive_file_id IS NOT NULL AND gdrive_file_id != ''"));
