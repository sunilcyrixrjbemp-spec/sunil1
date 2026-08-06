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

console.log("file_metadata columns:", runQuery("PRAGMA table_info(file_metadata);"));
console.log("expense_attachments columns:", runQuery("PRAGMA table_info(expense_attachments);"));
console.log("expense_itineraries columns:", runQuery("PRAGMA table_info(expense_itineraries);"));
console.log("expenses columns:", runQuery("PRAGMA table_info(expenses);"));
console.log("expense_breakdown_calls columns:", runQuery("PRAGMA table_info(expense_breakdown_calls);"));
console.log("expense_pms_calls columns:", runQuery("PRAGMA table_info(expense_pms_calls);"));
