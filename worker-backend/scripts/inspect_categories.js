const fs = require('fs');
const path = require('path');

const classified = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'july_classified_remarks.json'), 'utf8'));

console.log("=== PRINTING (9 items) ===");
classified.filter(c => c.category === 'PRINTING').forEach(c => console.log(`  "${c.desc}" -> ₹${c.totalAmt}`));

console.log("\n=== COURIER (46 items) ===");
classified.filter(c => c.category === 'COURIER').forEach(c => console.log(`  "${c.desc}" -> ₹${c.totalAmt}`));

console.log("\n=== MISCELLANEOUS (Top 25) ===");
classified.filter(c => c.category === 'MISCELLANEOUS').slice(0, 25).forEach(c => console.log(`  "${c.desc}" -> ₹${c.totalAmt}`));
