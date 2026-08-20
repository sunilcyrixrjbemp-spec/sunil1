const fs = require('fs');
const path = require('path');

const affected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'july_affected_engineers.json'), 'utf8'));

console.log(`Total Affected Engineers: ${affected.length}`);

// Calculate total amounts moved
let totalPrevPrinting = 0;
let totalPrevCourier = 0;
let totalPrevSpare = 0;
let totalPrevMisc = 0;

let totalNewPrinting = 0;
let totalNewCourier = 0;
let totalNewSpare = 0;
let totalNewMisc = 0;

for (const a of affected) {
  totalPrevPrinting += a.prev_printing;
  totalPrevCourier += a.prev_courier;
  totalPrevSpare += a.prev_spare;
  totalPrevMisc += a.prev_misc;

  totalNewPrinting += a.new_printing;
  totalNewCourier += a.new_courier;
  totalNewSpare += a.new_spare;
  totalNewMisc += a.new_misc;
}

console.log("\n=== TOTAL CATEGORY SHIFTS (FOR AFFECTED ENGINEERS) ===");
console.log(`Printing & Stationery (5314105):  Old: ₹${totalPrevPrinting.toFixed(2)}  --->  New: ₹${totalNewPrinting.toFixed(2)}  (Diff: ₹${(totalNewPrinting - totalPrevPrinting).toFixed(2)})`);
console.log(`Courier Charges (5314103):        Old: ₹${totalPrevCourier.toFixed(2)}   --->  New: ₹${totalNewCourier.toFixed(2)}   (Diff: +₹${(totalNewCourier - totalPrevCourier).toFixed(2)})`);
console.log(`Spare Purchase (5314108):         Old: ₹${totalPrevSpare.toFixed(2)}     --->  New: ₹${totalNewSpare.toFixed(2)}     (Diff: +₹${(totalNewSpare - totalPrevSpare).toFixed(2)})`);
console.log(`Miscellaneous Expenses (5314106): Old: ₹${totalPrevMisc.toFixed(2)}      --->  New: ₹${totalNewMisc.toFixed(2)}      (Diff: +₹${(totalNewMisc - totalPrevMisc).toFixed(2)})`);

console.log("\n=== TOP 20 AFFECTED ENGINEERS BY SHIFTED AMOUNT ===");
const sorted = affected.sort((a, b) => (b.totalOtherAmount || 0) - (a.totalOtherAmount || 0));

sorted.slice(0, 20).forEach((eng, idx) => {
  console.log(`${idx + 1}. ${eng.ee_name} (${eng.ee_code} - ${eng.district})`);
  console.log(`   Total Other: ₹${eng.totalOtherAmount.toFixed(2)} | Shifted from Printing -> Courier: ₹${eng.new_courier - eng.prev_courier}, Spare: ₹${eng.new_spare - eng.prev_spare}, Misc: ₹${eng.new_misc - eng.prev_misc}, Remaining Printing: ₹${eng.new_printing}`);
});
