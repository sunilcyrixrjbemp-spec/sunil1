import { execSync } from "child_process";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function runUpdate(sql) {
  const sanitized = sql.replace(/[\r\n]+/g, " ").replace(/"/g, '\\"');
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} d1 execute expense_management_db --remote --command "${sanitized}" --json`;
    const output = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = output.indexOf("[");
    const parsed = JSON.parse(output.substring(jsonStart));
    return parsed[0]?.meta?.changes || 0;
  } catch (e) {
    console.error("Update error:", e.message);
    return 0;
  }
}

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

async function testUpdates() {
  console.log("=== EXECUTING UPDATE STATEMENTS VIA WRANGLER --command ===");

  // Table 1: expense_attachments
  let c1 = runUpdate("UPDATE expense_attachments SET file_url = REPLACE(file_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE file_url LIKE '%/gdrive/%';");
  let c2 = runUpdate("UPDATE expense_attachments SET file_url = REPLACE(file_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE file_url LIKE '%drive.google%';");
  let c3 = runUpdate("UPDATE expense_attachments SET file_url = REPLACE(file_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE file_url LIKE '%googleusercontent%';");
  console.log(`Table 1 (expense_attachments) updated rows: ${c1 + c2 + c3}`);

  // Table 2: expense_breakdown_calls
  let b1 = runUpdate("UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE photo_url LIKE '%/gdrive/%';");
  let b2 = runUpdate("UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE photo_url LIKE '%drive.google%';");
  let b3 = runUpdate("UPDATE expense_breakdown_calls SET photo_url = REPLACE(photo_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE photo_url LIKE '%googleusercontent%';");
  console.log(`Table 2 (expense_breakdown_calls) updated rows: ${b1 + b2 + b3}`);

  // Table 3: expense_pms_calls
  let p1 = runUpdate("UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE photo_url LIKE '%/gdrive/%';");
  let p2 = runUpdate("UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE photo_url LIKE '%drive.google%';");
  let p3 = runUpdate("UPDATE expense_pms_calls SET photo_url = REPLACE(photo_url, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE photo_url LIKE '%googleusercontent%';");
  console.log(`Table 3 (expense_pms_calls) updated rows: ${p1 + p2 + p3}`);

  // Table 4: expenses
  let e1 = runUpdate("UPDATE expenses SET attachments = REPLACE(attachments, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE attachments LIKE '%/gdrive/%';");
  let e2 = runUpdate("UPDATE expenses SET attachments = REPLACE(attachments, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE attachments LIKE '%drive.google%';");
  let e3 = runUpdate("UPDATE expenses SET attachments = REPLACE(attachments, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE attachments LIKE '%googleusercontent%';");
  console.log(`Table 4 (expenses) updated rows: ${e1 + e2 + e3}`);

  // Table 5: expense_itineraries
  let i1 = runUpdate("UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, '/api/upload/file/gdrive/', '/uploads/gdrive/') WHERE activity_details LIKE '%/gdrive/%';");
  let i2 = runUpdate("UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, 'https://drive.google.com/uc?export=download&id=', '/uploads/gdrive/') WHERE activity_details LIKE '%drive.google%';");
  let i3 = runUpdate("UPDATE expense_itineraries SET activity_details = REPLACE(activity_details, 'https://lh3.googleusercontent.com/d/', '/uploads/gdrive/') WHERE activity_details LIKE '%googleusercontent%';");
  console.log(`Table 5 (expense_itineraries) updated rows: ${i1 + i2 + i3}`);

  // Table 6: file_metadata
  let m1 = runUpdate("UPDATE file_metadata SET upload_source = 'r2', r2_bucket = 'fieldops-uploads', r2_object_key = CASE WHEN r2_object_key IS NOT NULL AND r2_object_key != '' THEN r2_object_key ELSE 'gdrive/' || gdrive_file_id || '.jpg' END, r2_url = CASE WHEN r2_object_key IS NOT NULL AND r2_object_key != '' AND r2_object_key NOT LIKE '/uploads/%' THEN '/uploads/' || r2_object_key ELSE '/uploads/gdrive/' || gdrive_file_id || '.jpg' END, migrated_at = CURRENT_TIMESTAMP WHERE (gdrive_file_id IS NOT NULL AND gdrive_file_id != '') OR r2_url LIKE '%google%' OR r2_url LIKE '%gdrive%';");
  console.log(`Table 6 (file_metadata) updated rows: ${m1}`);

  console.log("\n=== VERIFICATION AUDIT RESULTS ===");
  console.log("expense_attachments remaining GDrive:", runQuery("SELECT COUNT(*) as cnt FROM expense_attachments WHERE (file_url LIKE '%gdrive%' OR file_url LIKE '%drive.google%' OR file_url LIKE '%script.google%')")[0]?.cnt);
  console.log("expense_breakdown_calls remaining GDrive:", runQuery("SELECT COUNT(*) as cnt FROM expense_breakdown_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%')")[0]?.cnt);
  console.log("expense_pms_calls remaining GDrive:", runQuery("SELECT COUNT(*) as cnt FROM expense_pms_calls WHERE (photo_url LIKE '%gdrive%' OR photo_url LIKE '%drive.google%' OR photo_url LIKE '%script.google%')")[0]?.cnt);
  console.log("expenses remaining GDrive:", runQuery("SELECT COUNT(*) as cnt FROM expenses WHERE (attachments LIKE '%gdrive%' OR attachments LIKE '%drive.google%' OR attachments LIKE '%script.google%')")[0]?.cnt);
  console.log("expense_itineraries remaining GDrive:", runQuery("SELECT COUNT(*) as cnt FROM expense_itineraries WHERE (activity_details LIKE '%gdrive%' OR activity_details LIKE '%drive.google%' OR activity_details LIKE '%script.google%')")[0]?.cnt);
  console.log("file_metadata remaining Google URLs:", runQuery("SELECT COUNT(*) as cnt FROM file_metadata WHERE (r2_url LIKE '%googleusercontent%' OR r2_url LIKE '%drive.google%')")[0]?.cnt);
}

testUpdates();
