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

const rows = runQuery("SELECT id, activity_details FROM expense_itineraries WHERE activity_details LIKE '%/uploads/gdrive/%' LIMIT 3;");
console.log("Sample expense_itineraries activity_details with /uploads/gdrive/:");
rows.forEach(r => console.log(`ID ${r.id}:`, r.activity_details));

const unmigratedRows = runQuery("SELECT id, activity_details FROM expense_itineraries WHERE activity_details LIKE '%/api/upload/file/gdrive/%' OR activity_details LIKE '%drive.google.com%' OR activity_details LIKE '%lh3.googleusercontent.com%' LIMIT 3;");
console.log("\nSample UNMIGRATED expense_itineraries activity_details:");
console.log(unmigratedRows);
