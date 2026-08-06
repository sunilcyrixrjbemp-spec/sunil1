import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

const tmpFile = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\test.sql";
fs.writeFileSync(tmpFile, "SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '%gdrive%';");

const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
const jsonStart = output.indexOf("[");
console.log("Raw JSON output:", output.substring(jsonStart));
