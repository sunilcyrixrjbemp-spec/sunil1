import { execSync } from "child_process";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runQuery(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
  const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
  const jsonStart = output.indexOf("[");
  if (jsonStart === -1) return [];
  return JSON.parse(output.substring(jsonStart))[0]?.results || [];
}

function extractFileId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/gdrive\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function main() {
  console.log("=== DEEP AUDIT OF ALL 6 TABLES ===");

  // 1. expense_attachments
  const atts = runQuery("SELECT id, exp_id, bill_type, file_url FROM expense_attachments WHERE file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%photos.app%' OR file_url LIKE '%googleusercontent%'");
  console.log(`Table 1 (expense_attachments) GDrive items count: ${atts.length}`);

  // 2. expense_breakdown_calls
  const bds = runQuery("SELECT id, itinerary_id, photo_url FROM expense_breakdown_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%photos.app%' OR photo_url LIKE '%googleusercontent%'");
  console.log(`Table 2 (expense_breakdown_calls) GDrive items count: ${bds.length}`);

  // 3. expense_pms_calls
  const pmss = runQuery("SELECT id, itinerary_id, photo_url FROM expense_pms_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%photos.app%' OR photo_url LIKE '%googleusercontent%'");
  console.log(`Table 3 (expense_pms_calls) GDrive items count: ${pmss.length}`);

  // 4. expenses
  const exps = runQuery("SELECT id, expense_code, attachments FROM expenses WHERE attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%photos.app%' OR attachments LIKE '%googleusercontent%'");
  console.log(`Table 4 (expenses) GDrive items count: ${exps.length}`);

  // 5. expense_itineraries
  const itis = runQuery("SELECT id, itinerary_id, activity_details FROM expense_itineraries WHERE activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%photos.app%' OR activity_details LIKE '%googleusercontent%'");
  console.log(`Table 5 (expense_itineraries) GDrive items count: ${itis.length}`);

  // 6. file_metadata
  const fms = runQuery("SELECT id, gdrive_file_id, r2_url, r2_object_key FROM file_metadata WHERE (gdrive_file_id IS NOT NULL AND gdrive_file_id != '') OR r2_url LIKE '%gdrive%' OR r2_url LIKE '%google%'");
  console.log(`Table 6 (file_metadata) GDrive/Google items count: ${fms.length}`);
  
  const fmsR2Google = runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%'");
  console.log(`Table 6 (file_metadata) rows where r2_url has google domain: ${fmsR2Google[0]?.cnt}`);

  // Collect unique file IDs across all tables
  const allFileIds = new Set();
  atts.forEach(a => { const id = extractFileId(a.file_url); if (id) allFileIds.add(id); });
  bds.forEach(b => { const id = extractFileId(b.photo_url); if (id) allFileIds.add(id); });
  pmss.forEach(p => { const id = extractFileId(p.photo_url); if (id) allFileIds.add(id); });
  exps.forEach(e => {
    try {
      const arr = JSON.parse(e.attachments);
      if (Array.isArray(arr)) {
        arr.forEach(u => { const id = extractFileId(u); if (id) allFileIds.add(id); });
      }
    } catch (_) {
      const id = extractFileId(e.attachments); if (id) allFileIds.add(id);
    }
  });
  itis.forEach(i => {
    try {
      const obj = JSON.parse(i.activity_details);
      const str = JSON.stringify(obj);
      const matches = str.match(/\/gdrive\/([a-zA-Z0-9_-]+)/g) || [];
      matches.forEach(m => {
        const id = m.replace("/gdrive/", "");
        if (id) allFileIds.add(id);
      });
    } catch (_) {}
  });

  console.log(`\nTOTAL DISTINCT GDrive File IDs found across all tables: ${allFileIds.size}`);
}

main();
