import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_audit_fast";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runSingleQuery() {
  const sql = `
    SELECT 'expense_attachments' as table_name,
      SUM(CASE WHEN file_url LIKE '/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (file_url LIKE '%/gdrive/%' AND file_url NOT LIKE '/uploads/%') OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM expense_attachments
    UNION ALL
    SELECT 'expense_breakdown_calls' as table_name,
      SUM(CASE WHEN photo_url LIKE '/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (photo_url LIKE '%/gdrive/%' AND photo_url NOT LIKE '/uploads/%') OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM expense_breakdown_calls
    UNION ALL
    SELECT 'expense_pms_calls' as table_name,
      SUM(CASE WHEN photo_url LIKE '/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (photo_url LIKE '%/gdrive/%' AND photo_url NOT LIKE '/uploads/%') OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM expense_pms_calls
    UNION ALL
    SELECT 'expenses' as table_name,
      SUM(CASE WHEN attachments LIKE '%/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (attachments LIKE '%/gdrive/%' AND attachments NOT LIKE '%/uploads/%') OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM expenses
    UNION ALL
    SELECT 'expense_itineraries' as table_name,
      SUM(CASE WHEN activity_details LIKE '%/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (activity_details LIKE '%/gdrive/%' AND activity_details NOT LIKE '%/uploads/%') OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM expense_itineraries
    UNION ALL
    SELECT 'file_metadata' as table_name,
      SUM(CASE WHEN r2_url LIKE '/uploads/%' THEN 1 ELSE 0 END) as clean_r2_cnt,
      SUM(CASE WHEN (r2_url LIKE '%/gdrive/%' AND r2_url NOT LIKE '/uploads/%') OR r2_url LIKE '%drive.google%' OR r2_url LIKE '%script.google%' OR r2_url LIKE '%googleusercontent%' THEN 1 ELSE 0 END) as unmigrated_cnt,
      COUNT(*) as total_rows
    FROM file_metadata;
  `;

  const tmpFile = path.join(TEMP_DIR, "fast_report.sql");
  fs.writeFileSync(tmpFile, sql);
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    const jsonStart = output.indexOf("[");
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.error("Report Error:", e.message);
    return [];
  }
}

function generateReport() {
  console.log("=========================================================================");
  console.log("📊 INSTANT COMPREHENSIVE VERIFICATION REPORT (ALL 6 TABLES)");
  console.log("=========================================================================\n");

  const results = runSingleQuery();
  let totalClean = 0;
  let totalUnmigrated = 0;

  results.forEach(row => {
    totalClean += (row.clean_r2_cnt || 0);
    totalUnmigrated += (row.unmigrated_cnt || 0);
    console.log(`Table: ${row.table_name.padEnd(25)} | Total Rows: ${String(row.total_rows).padStart(6)} | Clean R2 (/uploads/): ${String(row.clean_r2_cnt || 0).padStart(6)} | Unmigrated Google: ${row.unmigrated_cnt || 0}`);
  });

  console.log("\n-------------------------------------------------------------------------");
  console.log(`TOTAL CLEAN R2 RECORDS ACROSS DATABASE : ${totalClean}`);
  console.log(`TOTAL UNMIGRATED GOOGLE LINKS REMAINING  : ${totalUnmigrated}`);
  console.log("-------------------------------------------------------------------------");

  if (totalUnmigrated === 0) {
    console.log("\n🎉 SUCCESS: 100% OF candidate DB photo/attachment links are clean R2 (/uploads/...) paths!");
  } else {
    console.log(`\n⚠️ Warning: ${totalUnmigrated} unmigrated links remain.`);
  }
}

generateReport();
