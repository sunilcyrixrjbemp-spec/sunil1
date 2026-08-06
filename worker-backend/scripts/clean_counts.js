import { execSync } from "child_process";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runCmd(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
  const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
  const jsonStart = output.indexOf("[");
  return JSON.parse(output.substring(jsonStart))[0]?.results || [];
}

console.log("expense_attachments GDrive count:", runCmd("SELECT COUNT(*) as cnt FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%')")[0]?.cnt);
console.log("expense_breakdown_calls GDrive count:", runCmd("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%')")[0]?.cnt);
console.log("expense_pms_calls GDrive count:", runCmd("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%')")[0]?.cnt);
console.log("expenses GDrive count:", runCmd("SELECT COUNT(*) as cnt FROM expenses WHERE (attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%')")[0]?.cnt);
console.log("expense_itineraries GDrive count:", runCmd("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE (activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%')")[0]?.cnt);
console.log("file_metadata gdrive_file_id count:", runCmd("SELECT COUNT(*) as cnt FROM file_metadata WHERE gdrive_file_id IS NOT NULL AND gdrive_file_id != ''")[0]?.cnt);
console.log("file_metadata google/gdrive r2_url count:", runCmd("SELECT COUNT(*) as cnt FROM file_metadata WHERE (r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%' OR r2_url LIKE '%gdrive%')")[0]?.cnt);
