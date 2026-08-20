const fs = require('fs');
const path = require('path');

const classified = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'july_classified_remarks.json'), 'utf8'));

console.log("=== ALL MISCELLANEOUS ITEMS ===");
classified.filter(c => c.category === 'MISCELLANEOUS').forEach(c => console.log(`  "${c.desc}" -> ₹${c.totalAmt}`));
