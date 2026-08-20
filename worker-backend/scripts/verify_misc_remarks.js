const path = require('path');
const XLSX = require(path.resolve(__dirname, '../../frontend/node_modules/xlsx'));

const wb = XLSX.readFile('C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.xlsx');
const sheet = wb.Sheets['Consolidated Report'];
const data = XLSX.utils.sheet_to_json(sheet);

console.log("=== SAMPLE OF ROWS WITH MISC COMMENTS IN REMARKS COLUMN ===");
const withMisc = data.filter(r => r['5314106 - Exp Miscellaneous Expenses'] > 0);
console.log(`Total engineers with Misc Expenses: ${withMisc.length}`);

withMisc.slice(0, 15).forEach((r, idx) => {
  console.log(`\n${idx + 1}. ${r['EE Name']} (${r['EE Code']}) - District: ${r['CC']}`);
  console.log(`   Misc Amount (Col P): ₹${r['5314106 - Exp Miscellaneous Expenses']}`);
  console.log(`   Remarks (Col Z): "${r['Remarks']}"`);
});
