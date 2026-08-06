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

console.log("Remaining expense_attachments:", runQuery("SELECT id, file_url FROM expense_attachments WHERE file_url NOT LIKE '/uploads/%' AND (file_url LIKE '%google%' OR file_url LIKE '%gdrive%' OR file_url LIKE '%drive%')"));
console.log("Remaining expense_breakdown_calls:", runQuery("SELECT id, photo_url FROM expense_breakdown_calls WHERE photo_url NOT LIKE '/uploads/%' AND (photo_url LIKE '%google%' OR photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive%')"));
console.log("Remaining expense_pms_calls:", runQuery("SELECT id, photo_url FROM expense_pms_calls WHERE photo_url NOT LIKE '/uploads/%' AND (photo_url LIKE '%google%' OR photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive%')"));
console.log("Remaining expenses:", runQuery("SELECT id, attachments FROM expenses WHERE attachments NOT LIKE '%/uploads/%' AND (attachments LIKE '%google%' OR attachments LIKE '%gdrive%' OR attachments LIKE '%drive%')"));
console.log("Remaining expense_itineraries:", runQuery("SELECT id, activity_details FROM expense_itineraries WHERE activity_details NOT LIKE '%/uploads/%' AND (activity_details LIKE '%google%' OR activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive%') LIMIT 5"));
