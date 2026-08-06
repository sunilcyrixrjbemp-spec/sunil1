import { execSync } from "child_process";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runQuery(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
  const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
  const jsonStart = output.indexOf("[");
  return JSON.parse(output.substring(jsonStart))[0]?.results || [];
}

console.log("expense_attachments R2 sample:", runQuery("SELECT file_url FROM expense_attachments WHERE file_url LIKE '%/uploads/%' OR file_url LIKE '%/r2/%' OR file_url LIKE '%http%' LIMIT 5"));
console.log("expense_breakdown_calls R2 sample:", runQuery("SELECT photo_url FROM expense_breakdown_calls WHERE photo_url LIKE '%/uploads/%' OR photo_url LIKE '%/r2/%' LIMIT 5"));
console.log("expense_pms_calls R2 sample:", runQuery("SELECT photo_url FROM expense_pms_calls WHERE photo_url LIKE '%/uploads/%' OR photo_url LIKE '%/r2/%' LIMIT 5"));
console.log("file_metadata R2 sample:", runQuery("SELECT r2_url, r2_object_key FROM file_metadata WHERE r2_url IS NOT NULL LIMIT 5"));
console.log("expense_itineraries activity_details sample:", runQuery("SELECT activity_details FROM expense_itineraries WHERE activity_details LIKE '%drive.google%' OR activity_details LIKE '%gdrive%' LIMIT 2"));
