import { execSync } from "child_process";

const WRANGLER_BIN = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\.bin\\wrangler.cmd"`;

function runD1Query(sql) {
  try {
    // Escape double quotes inside SQL
    const sanitizedSql = sql.replace(/"/g, '\\"');
    const cmd = `${WRANGLER_BIN} d1 execute expense_management_db --remote --command "${sanitizedSql}" --json`;
    const output = execSync(cmd, { cwd: "c:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("D1 Query Error:", e.message);
    return [];
  }
}

const rows = runD1Query("SELECT id, exp_id, bill_type, file_url FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%') LIMIT 5;");
console.log("Found rows:", rows.length, rows);
