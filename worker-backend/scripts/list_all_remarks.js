const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const { legs } = rawData;
const otherLegs = legs.filter(l => (parseFloat(l.other_amount || 0) > 0 || parseFloat(l.original_other_amount || 0) > 0 || (l.other_desc && l.other_desc.trim())));

const uniqueDescriptions = {};
for (const leg of otherLegs) {
  const d = (leg.other_desc || "").trim();
  const amt = parseFloat(leg.other_amount || 0);
  if (!uniqueDescriptions[d]) {
    uniqueDescriptions[d] = { desc: d, count: 0, totalAmt: 0 };
  }
  uniqueDescriptions[d].count++;
  uniqueDescriptions[d].totalAmt += amt;
}

const list = Object.values(uniqueDescriptions).sort((a, b) => b.totalAmt - a.totalAmt);
console.log(`Total unique remarks: ${list.length}`);
fs.writeFileSync(path.resolve(__dirname, 'july_all_remarks.json'), JSON.stringify(list, null, 2));

console.log("Top 50 remarks by amount:");
for (let i = 0; i < Math.min(50, list.length); i++) {
  console.log(`${i + 1}. "${list[i].desc}" -> Count: ${list[i].count}, Total: ₹${list[i].totalAmt}`);
}
