const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs } = rawData;

const userMap = {};
for (const u of users) {
  if (u.id) userMap[u.id] = u;
  if (u.user_id) userMap[u.user_id] = u;
  if (u.e_code) userMap[u.e_code] = u;
}

const legsByCode = {};
for (const leg of legs) {
  const key = (leg.exp_id || "").trim().toUpperCase();
  if (!legsByCode[key]) legsByCode[key] = [];
  legsByCode[key].push(leg);
}

// Let's inspect all legs with other_amount > 0
const allOtherItems = [];

for (const exp of expenses) {
  const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
  for (const leg of expLegs) {
    const oth_amt = parseFloat(leg.other_amount || 0);
    if (oth_amt > 0) {
      allOtherItems.push({
        exp_code: exp.expense_code,
        user_id: exp.user_id,
        user_name: userMap[exp.user_id]?.name || exp.user_id,
        date: exp.itinerary || exp.created_at,
        amount: oth_amt,
        desc: leg.other_desc,
        lp_remark: leg.local_purchase_remark
      });
    }
  }
}

console.log(`Total legs with other_amount > 0: ${allOtherItems.length}`);
console.log("\nSample descriptions in other_amount:");
allOtherItems.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.user_name} | ₹${item.amount} | ${item.date}] "${item.desc}" (LP: "${item.lp_remark}")`);
});
