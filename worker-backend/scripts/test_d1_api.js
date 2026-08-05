import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ACCOUNT_ID = "befbd2e0ff580a1d0d0865f011002053";
const DB_ID = "34e085d8-c078-4f2f-b240-9bf8f4cf9301";
const API_TOKEN = "9RkyvFfIdtWvL9H_3U3yXfI8J_80Wz-Y56V0X_y1"; // From environment
const WRANGLER_BIN = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\.bin\\wrangler.cmd"`;
const TEMP_DIR = "C:/Users/Cyrix HealthCare/AppData/Local/Temp/gdrive_migration";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

async function queryD1(sql, params = []) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, params })
    });
    const json = await res.json();
    if (json.success && json.result && json.result[0]) {
      return json.result[0].results || [];
    }
    console.error("D1 REST API error:", json.errors);
    return [];
  } catch (e) {
    console.error("Fetch D1 error:", e.message);
    return [];
  }
}

async function testApi() {
  const rows = await queryD1("SELECT id, exp_id, bill_type, file_url FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%') LIMIT 5");
  console.log("D1 REST API Rows:", rows);
}

testApi();
