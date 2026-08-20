const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

const mismatchCodes = [
  'RJ-07/26-001753', 'RJ-07/26-002704', 'RJ-07/26-002753', 'RJ-07/26-002839',
  'RJ-07/26-003157', 'RJ-07/26-003253', 'RJ-07/26-003400', 'RJ-07/26-003593',
  'RJ-07/26-003728', 'RJ-07/26-003760'
];

for (const code of mismatchCodes) {
  const exp = expenses.find(e => (e.expense_code || "").trim().toUpperCase() === code);
  const expLegs = legs.filter(l => (l.exp_id || "").trim().toUpperCase() === code);
  const logs = editLogs.filter(l => l.expense_id == exp?.id);
  console.log(`\nExpense: ${code} | status: ${exp?.status} | amount: ₹${exp?.amount} | orig_amount: ₹${exp?.original_amount}`);
  console.log(`  Itinerary legs found in legs dump: ${expLegs.length}`);
  for (const l of expLegs) {
    console.log(`    leg ${l.leg_number}: mode=${l.travel_mode}, km=${l.distance_km}, travelAmt=${l.travel_amount}, da=${l.da_amount}, lp=${l.local_purchase}, hotel=${l.hotel_amount}, other=${l.other_amount}`);
  }
  if (logs.length > 0) {
    console.log(`  Logs:`, logs.map(l => l.comment));
  }
}
