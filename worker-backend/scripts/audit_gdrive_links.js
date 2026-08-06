import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runD1Query(sql) {
  try {
    const sanitizedSql = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitizedSql}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("D1 Query Error:", e.message);
    return [];
  }
}

async function audit() {
  console.log("=== AUDITING ALL 6 TABLES FOR GDRIVE / GPHOTOS / GAS LINKS ===");

  // 1. expense_attachments
  const att = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%googleusercontent%' OR file_url LIKE '%photos.app%' THEN 1 ELSE 0 END) as gdrive_cnt,
    SUM(CASE WHEN file_url LIKE '%/uploads/%' OR file_url LIKE '%/r2/%' THEN 1 ELSE 0 END) as r2_cnt
    FROM expense_attachments`);
  console.log("1. expense_attachments:", att[0]);

  // 2. expense_breakdown_calls
  const bd = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%' OR photo_url LIKE '%photos.app%' THEN 1 ELSE 0 END) as gdrive_cnt,
    SUM(CASE WHEN photo_url LIKE '%/uploads/%' OR photo_url LIKE '%/r2/%' THEN 1 ELSE 0 END) as r2_cnt
    FROM expense_breakdown_calls`);
  console.log("2. expense_breakdown_calls:", bd[0]);

  // 3. expense_pms_calls
  const pms = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%' OR photo_url LIKE '%photos.app%' THEN 1 ELSE 0 END) as gdrive_cnt,
    SUM(CASE WHEN photo_url LIKE '%/uploads/%' OR photo_url LIKE '%/r2/%' THEN 1 ELSE 0 END) as r2_cnt
    FROM expense_pms_calls`);
  console.log("3. expense_pms_calls:", pms[0]);

  // 4. expenses
  const exp = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%googleusercontent%' OR attachments LIKE '%photos.app%' THEN 1 ELSE 0 END) as gdrive_cnt,
    SUM(CASE WHEN attachments LIKE '%/uploads/%' OR attachments LIKE '%/r2/%' THEN 1 ELSE 0 END) as r2_cnt
    FROM expenses`);
  console.log("4. expenses:", exp[0]);

  // 5. expense_itineraries
  const iti = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%googleusercontent%' OR activity_details LIKE '%photos.app%' THEN 1 ELSE 0 END) as gdrive_cnt,
    SUM(CASE WHEN activity_details LIKE '%/uploads/%' OR activity_details LIKE '%/r2/%' THEN 1 ELSE 0 END) as r2_cnt
    FROM expense_itineraries`);
  console.log("5. expense_itineraries:", iti[0]);

  // 6. file_metadata
  const fm = runD1Query(`SELECT COUNT(*) as total,
    SUM(CASE WHEN gdrive_file_id IS NOT NULL AND gdrive_file_id != '' THEN 1 ELSE 0 END) as gdrive_id_cnt,
    SUM(CASE WHEN r2_url IS NOT NULL AND r2_url != '' THEN 1 ELSE 0 END) as r2_url_cnt
    FROM file_metadata`);
  console.log("6. file_metadata:", fm[0]);
}

audit();
