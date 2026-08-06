import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NODE_BIN = `"C:\\Users\\Cyrix HealthCare\\AppData\\Local\\node-portable\\node-v22.16.0-win-x64\\node.exe"`;
const WRANGLER_JS = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\wrangler\\bin\\wrangler.js"`;

function testWranglerR2() {
  console.log("Testing Wrangler R2 access...");
  const tempFile = "C:\\Users\\Cyrix HealthCare\\AppData\\Local\\Temp\\r2_test.txt";
  fs.writeFileSync(tempFile, "R2 upload test " + Date.now());
  
  try {
    const cmd = `${NODE_BIN} ${WRANGLER_JS} r2 object put "fieldops-uploads/test_upload.txt" --file "${tempFile}" --remote`;
    const out = execSync(cmd, { cwd: "C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend", encoding: "utf8" });
    console.log("R2 Put Output:", out);
    console.log("✅ R2 Upload succeeded!");
  } catch (e) {
    console.error("❌ R2 Upload error:", e.message);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

testWranglerR2();
