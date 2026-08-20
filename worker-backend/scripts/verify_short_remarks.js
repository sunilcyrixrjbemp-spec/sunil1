const path = require('path');
const XLSX = require(path.resolve(__dirname, '../../frontend/node_modules/xlsx'));

const wb = XLSX.readFile('C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.xlsx');
const sheet = wb.Sheets['Consolidated Report'];
const data = XLSX.utils.sheet_to_json(sheet);

console.log("=== SAMPLE OF SHORT & CLEAN DEDUCTION REMARKS (FIRST 15) ===");
data.slice(0, 15).forEach((r, idx) => {
  console.log(`${idx + 1}. ${r['EE Name']} (${r['EE Code']}):`);
  console.log(`   Deduction Reason: "${r['Reason for deduction'] || 'None'}"`);
});
