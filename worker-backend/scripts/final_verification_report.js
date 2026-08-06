import { execSync } from "child_process";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runQuery(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = output.indexOf("[");
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("Query error:", e.message);
    return [];
  }
}

async function runFinalReport() {
  console.log("=========================================================================");
  console.log("📊 FINAL DATABASE AUDIT & VERIFICATION REPORT (ALL 6 TABLES)");
  console.log("=========================================================================\n");

  // Table 1: expense_attachments
  const t1Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM expense_attachments WHERE (file_url LIKE '%/gdrive/%' AND file_url NOT LIKE '/uploads/%') OR file_url LIKE '%drive.google.com%' OR file_url LIKE '%script.google.com%' OR file_url LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t1Clean = runQuery("SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '/uploads/%'")[0]?.cnt || 0;
  const t1Total = runQuery("SELECT COUNT(*) as cnt FROM expense_attachments")[0]?.cnt || 0;

  // Table 2: expense_breakdown_calls
  const t2Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE (photo_url LIKE '%/gdrive/%' AND photo_url NOT LIKE '/uploads/%') OR photo_url LIKE '%drive.google.com%' OR photo_url LIKE '%script.google.com%' OR photo_url LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t2Clean = runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE photo_url LIKE '/uploads/%'")[0]?.cnt || 0;
  const t2Total = runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls")[0]?.cnt || 0;

  // Table 3: expense_pms_calls
  const t3Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE (photo_url LIKE '%/gdrive/%' AND photo_url NOT LIKE '/uploads/%') OR photo_url LIKE '%drive.google.com%' OR photo_url LIKE '%script.google.com%' OR photo_url LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t3Clean = runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE photo_url LIKE '/uploads/%'")[0]?.cnt || 0;
  const t3Total = runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls")[0]?.cnt || 0;

  // Table 4: expenses
  const t4Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM expenses WHERE (attachments LIKE '%/gdrive/%' AND attachments NOT LIKE '%/uploads/%') OR attachments LIKE '%drive.google.com%' OR attachments LIKE '%script.google.com%' OR attachments LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t4Clean = runQuery("SELECT COUNT(*) as cnt FROM expenses WHERE attachments LIKE '%/uploads/%'")[0]?.cnt || 0;
  const t4Total = runQuery("SELECT COUNT(*) as cnt FROM expenses")[0]?.cnt || 0;

  // Table 5: expense_itineraries
  const t5Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE (activity_details LIKE '%/gdrive/%' AND activity_details NOT LIKE '%/uploads/%') OR activity_details LIKE '%drive.google.com%' OR activity_details LIKE '%script.google.com%' OR activity_details LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t5Clean = runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE activity_details LIKE '%/uploads/%'")[0]?.cnt || 0;
  const t5Total = runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries")[0]?.cnt || 0;

  // Table 6: file_metadata
  const t6Unmigrated = runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE (r2_url LIKE '%/gdrive/%' AND r2_url NOT LIKE '/uploads/%') OR r2_url LIKE '%drive.google.com%' OR r2_url LIKE '%script.google.com%' OR r2_url LIKE '%googleusercontent.com%'")[0]?.cnt || 0;
  const t6Clean = runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE r2_url LIKE '/uploads/%'")[0]?.cnt || 0;
  const t6Total = runQuery("SELECT COUNT(*) as cnt FROM file_metadata")[0]?.cnt || 0;

  console.log(`1. expense_attachments:      [Total: ${t1Total}] | Clean R2 (/uploads/): ${t1Clean} | Unmigrated Google: ${t1Unmigrated}`);
  console.log(`2. expense_breakdown_calls:  [Total: ${t2Total}] | Clean R2 (/uploads/): ${t2Clean} | Unmigrated Google: ${t2Unmigrated}`);
  console.log(`3. expense_pms_calls:        [Total: ${t3Total}] | Clean R2 (/uploads/): ${t3Clean} | Unmigrated Google: ${t3Unmigrated}`);
  console.log(`4. expenses:                 [Total: ${t4Total}] | Clean R2 (/uploads/): ${t4Clean} | Unmigrated Google: ${t4Unmigrated}`);
  console.log(`5. expense_itineraries:      [Total: ${t5Total}] | Clean R2 (/uploads/): ${t5Clean} | Unmigrated Google: ${t5Unmigrated}`);
  console.log(`6. file_metadata:            [Total: ${t6Total}] | Clean R2 (/uploads/): ${t6Clean} | Unmigrated Google: ${t6Unmigrated}`);

  const totalMigrated = t1Clean + t2Clean + t3Clean + t4Clean + t5Clean + t6Clean;
  const totalUnmigrated = t1Unmigrated + t2Unmigrated + t3Unmigrated + t4Unmigrated + t5Unmigrated + t6Unmigrated;

  console.log("\n-------------------------------------------------------------------------");
  console.log(`GRAND TOTAL CLEAN R2 PATHS IN DATABASE : ${totalMigrated}`);
  console.log(`GRAND TOTAL UNMIGRATED GOOGLE LINKS     : ${totalUnmigrated}`);
  console.log("-------------------------------------------------------------------------");

  if (totalUnmigrated === 0) {
    console.log("\n🎉 SUCCESS: 100% OF Candidate Database Links Have Been Permanently Migrated to Cloudflare R2! 🎉");
  } else {
    console.log(`\n⚠️ Warning: ${totalUnmigrated} unmigrated links remain.`);
  }
}

runFinalReport();
