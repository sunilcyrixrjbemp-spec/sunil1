const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

const userMap = {};
for (const u of users) {
  if (u.id) userMap[u.id] = u;
  if (u.user_id) userMap[u.user_id] = u;
  if (u.e_code) userMap[u.e_code] = u;
}

const usr = userMap['E1704'];
const userExps = expenses.filter(e => e.user_id == usr.id || e.user_id == usr.user_id || e.user_id == usr.e_code);

console.log(`Sunil Vishnoi Base Reporting Location: "${usr.base_reporting_location}"`);

for (const exp of userExps) {
  const expLegs = legs.filter(l => (l.exp_id || "").trim().toUpperCase() === (exp.expense_code || "").trim().toUpperCase());
  const logs = editLogs.filter(l => l.expense_id == exp.id);
  
  console.log(`\nClaim: ${exp.expense_code} | Date: ${exp.itinerary} | Status: ${exp.status}`);
  console.log(`  Claimed (orig): ₹${exp.original_amount} | Approved (exp.amount): ₹${exp.amount}`);
  if (logs.length > 0) {
    console.log(`  Logs:`, logs.map(l => l.comment));
  }
  for (const l of expLegs) {
    console.log(`  Leg ${l.leg_number}: from "${l.from_location}" to "${l.to_location}" | mode=${l.travel_mode}, km=${l.distance_km} (orig=${l.original_distance_km}), travelAmt=${l.travel_amount}, da=${l.da_amount} (orig=${l.original_da_amount}), lp=${l.local_purchase}, hotel=${l.hotel_amount}, other=${l.other_amount}`);
  }
}
