import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_migration";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runQuery(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("Query Error:", e.message);
    return [];
  }
}

async function inspectItineraries() {
  console.log("Fetching expense_itineraries rows with GDrive links...");
  
  // Fetch in batches of 200
  let offset = 0;
  const limit = 200;
  const uniqueFileIds = new Set();
  let totalRowsChecked = 0;

  while (true) {
    const rows = runQuery(`SELECT id, itinerary_id, activity_details FROM expense_itineraries WHERE (activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%') LIMIT ${limit} OFFSET ${offset};`);
    if (!rows || rows.length === 0) break;

    totalRowsChecked += rows.length;
    for (const row of rows) {
      if (!row.activity_details) continue;
      const str = typeof row.activity_details === "string" ? row.activity_details : JSON.stringify(row.activity_details);
      
      // Match /gdrive/FILE_ID or id=FILE_ID or /d/FILE_ID
      const matches1 = str.match(/\/gdrive\/([a-zA-Z0-9_-]+)/g) || [];
      const matches2 = str.match(/id=([a-zA-Z0-9_-]+)/g) || [];
      const matches3 = str.match(/\/d\/([a-zA-Z0-9_-]+)/g) || [];

      matches1.forEach(m => uniqueFileIds.add(m.replace("/gdrive/", "")));
      matches2.forEach(m => uniqueFileIds.add(m.replace("id=", "")));
      matches3.forEach(m => uniqueFileIds.add(m.replace("/d/", "")));
    }

    console.log(`Checked ${totalRowsChecked} itinerary rows, found ${uniqueFileIds.size} unique GDrive file IDs...`);
    if (rows.length < limit) break;
    offset += limit;
  }

  console.log(`\nTOTAL unique GDrive file IDs in expense_itineraries: ${uniqueFileIds.size}`);
  
  // Check how many of these file IDs are already in file_metadata or R2
  const idsArray = Array.from(uniqueFileIds);
  let metadataCount = 0;
  for (let i = 0; i < idsArray.length; i += 100) {
    const chunk = idsArray.slice(i, i + 100);
    const inList = chunk.map(id => `'${id}'`).join(",");
    const res = runQuery(`SELECT COUNT(*) as cnt FROM file_metadata WHERE gdrive_file_id IN (${inList}) AND r2_object_key IS NOT NULL;`);
    metadataCount += res[0]?.cnt || 0;
  }
  console.log(`Already in file_metadata with R2 object key: ${metadataCount} / ${uniqueFileIds.size}`);
}

inspectItineraries();
