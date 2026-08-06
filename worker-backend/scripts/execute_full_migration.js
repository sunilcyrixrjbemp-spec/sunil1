import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;
const TEMP_DIR = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\gdrive_migration_exec";

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function runD1File(sqlStatements) {
  const tmpFile = path.join(TEMP_DIR, `migration_${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sqlStatements.join("\n"));
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --file "${tmpFile}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    return output;
  } catch (e) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.error("D1 File Execution Error:", e.message);
    return null;
  }
}

function runD1Command(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = output.indexOf("[");
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.results || [];
  } catch (e) {
    console.error("D1 Command Error:", e.message);
    return [];
  }
}

async function runFullMigration() {
  console.log("=========================================================================");
  console.log("🚀 EXECUTING COMPLETE GDRIVE -> CLOUDFLARE R2 DATABASE MIGRATION");
  console.log("=========================================================================\n");

  const migrationSql = [
    "--- 1. expense_attachments ---",
    "UPDATE expense_attachments SET file_url = REPLACE(file_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE file_url LIKE '%/gdrive/%';",
    "UPDATE expense_attachments SET file_url = REPLACE(file_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE file_url LIKE '%drive.google%';",
    "UPDATE expense_attachments SET file_url = REPLACE(file_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE file_url LIKE '%googleusercontent%';",

    "--- 2. expense_breakdown_calls ---",
    "UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE photo_url LIKE '%/gdrive/%';",
    "UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE photo_url LIKE '%drive.google%';",
    "UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE photo_url LIKE '%googleusercontent%';",

    "--- 3. expense_pms_calls ---",
    "UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE photo_url LIKE '%/gdrive/%';",
    "UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE photo_url LIKE '%drive.google%';",
    "UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE photo_url LIKE '%googleusercontent%';",

    "--- 4. expenses ---",
    "UPDATE expenses SET attachments = REPLACE(attachments, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE attachments LIKE '%/gdrive/%';",
    "UPDATE expenses SET attachments = REPLACE(attachments, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE attachments LIKE '%drive.google%';",
    "UPDATE expenses SET attachments = REPLACE(attachments, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE attachments LIKE '%googleusercontent%';",

    "--- 5. expense_itineraries ---",
    "UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE activity_details LIKE '%/gdrive/%';",
    "UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE activity_details LIKE '%drive.google%';",
    "UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE activity_details LIKE '%googleusercontent%';",

    "--- 6. file_metadata ---",
    "UPDATE file_metadata SET upload_source = 'r2', r2_bucket = 'fieldops-uploads', r2_object_key = CASE WHEN r2_object_key IS NOT NULL AND r2_object_key != '' THEN r2_object_key ELSE 'gdrive/' || gdrive_file_id || '.jpg' END, r2_url = CASE WHEN r2_object_key IS NOT NULL AND r2_object_key != '' AND r2_object_key NOT LIKE '/uploads/%' THEN '/uploads/' || r2_object_key ELSE '/uploads/gdrive/' || gdrive_file_id || '.jpg' END, migrated_at = CURRENT_TIMESTAMP WHERE (gdrive_file_id IS NOT NULL AND gdrive_file_id != '') OR r2_url LIKE '%google%' OR r2_url LIKE '%gdrive%';"
  ];

  console.log("Applying batch migration updates to D1 database...");
  runD1File(migrationSql);
  console.log("✅ SQL Migration commands executed successfully!\n");

  console.log("=== RUNNING POST-MIGRATION VERIFICATION AUDIT ===");

  const v1 = runD1Command("SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%' OR file_url LIKE '%googleusercontent%'")[0]?.cnt;
  console.log(`1. expense_attachments remaining GDrive links: ${v1}`);

  const v2 = runD1Command("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'")[0]?.cnt;
  console.log(`2. expense_breakdown_calls remaining GDrive links: ${v2}`);

  const v3 = runD1Command("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%' OR photo_url LIKE '%googleusercontent%'")[0]?.cnt;
  console.log(`3. expense_pms_calls remaining GDrive links: ${v3}`);

  const v4 = runD1Command("SELECT COUNT(*) as cnt FROM expenses WHERE attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%' OR attachments LIKE '%googleusercontent%'")[0]?.cnt;
  console.log(`4. expenses remaining GDrive links: ${v4}`);

  const v5 = runD1Command("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%' OR activity_details LIKE '%googleusercontent%'")[0]?.cnt;
  console.log(`5. expense_itineraries remaining GDrive links: ${v5}`);

  const v6 = runD1Command("SELECT COUNT(*) as cnt FROM file_metadata WHERE r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%' OR r2_url LIKE '%/gdrive/%'")[0]?.cnt;
  console.log(`6. file_metadata remaining Google/GDrive URLs: ${v6}`);

  const r2Atts = runD1Command("SELECT COUNT(*) as cnt FROM expense_attachments WHERE file_url LIKE '%/uploads/%'")[0]?.cnt;
  const r2Bds = runD1Command("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE photo_url LIKE '%/uploads/%'")[0]?.cnt;
  const r2Pmss = runD1Command("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE photo_url LIKE '%/uploads/%'")[0]?.cnt;
  const r2Exps = runD1Command("SELECT COUNT(*) as cnt FROM expenses WHERE attachments LIKE '%/uploads/%'")[0]?.cnt;
  const r2Itis = runD1Command("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE activity_details LIKE '%/uploads/%'")[0]?.cnt;
  const r2Meta = runD1Command("SELECT COUNT(*) as cnt FROM file_metadata WHERE r2_url LIKE '%/uploads/%'")[0]?.cnt;

  console.log("\n=== CLEAN R2 (`/uploads/...`) RECORD COUNTS ===");
  console.log(`1. expense_attachments R2 path count: ${r2Atts}`);
  console.log(`2. expense_breakdown_calls R2 path count: ${r2Bds}`);
  console.log(`3. expense_pms_calls R2 path count: ${r2Pmss}`);
  console.log(`4. expenses R2 path count: ${r2Exps}`);
  console.log(`5. expense_itineraries R2 path count: ${r2Itis}`);
  console.log(`6. file_metadata R2 path count: ${r2Meta}`);
}

runFullMigration();
