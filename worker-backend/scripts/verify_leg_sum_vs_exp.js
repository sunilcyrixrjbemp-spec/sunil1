const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

const legsByCode = {};
for (const leg of legs) {
  const key = (leg.exp_id || "").trim().toUpperCase();
  if (!legsByCode[key]) legsByCode[key] = [];
  legsByCode[key].push(leg);
}

let exactMatchCount = 0;
let mismatchCount = 0;
const mismatches = [];

for (const exp of expenses) {
  const expCode = (exp.expense_code || "").trim().toUpperCase();
  const expLegs = legsByCode[expCode] || [];

  let legPvtTravel = 0;
  let legPubTravel = 0;
  let legDa = 0;
  let legLp = 0;
  let legHotel = 0;
  let legOther = 0;

  for (const leg of expLegs) {
    const mode = (leg.travel_mode || "").trim().toLowerCase();
    const sub = (leg.sub_mode || "").trim().toLowerCase();

    // Travel amount for private vs public
    const travelAmt = parseFloat(leg.travel_amount || 0);
    const subAmt = parseFloat(leg.sub_amount || 0);

    if (mode === "bike" || mode === "car") {
      legPvtTravel += travelAmt;
    } else if (mode === "auto" || mode === "bus" || mode === "train") {
      legPubTravel += travelAmt;
    }

    if (sub === "auto" || sub === "bus" || sub === "train") {
      legPubTravel += subAmt;
    }

    legDa += parseFloat(leg.da_amount || 0);
    legLp += parseFloat(leg.local_purchase || 0);
    legHotel += parseFloat(leg.hotel_amount || 0);
    legOther += parseFloat(leg.other_amount || 0);
  }

  const legSum = legPvtTravel + legPubTravel + legDa + legLp + legHotel + legOther;
  const expAmt = parseFloat(exp.amount || 0);

  if (Math.abs(legSum - expAmt) < 0.05) {
    exactMatchCount++;
  } else {
    mismatchCount++;
    mismatches.push({
      exp_code: exp.expense_code,
      user_id: exp.user_id,
      expAmt,
      legSum,
      diff: legSum - expAmt,
      legs: expLegs
    });
  }
}

console.log(`Total Approved Expenses: ${expenses.length}`);
console.log(`Exact Matches between Leg Sum and exp.amount (Approved DB/PDF): ${exactMatchCount}`);
console.log(`Mismatches: ${mismatchCount}`);

if (mismatches.length > 0) {
  console.log("\nSample mismatches:");
  mismatches.slice(0, 10).forEach(m => {
    console.log(`  Claim: ${m.exp_code} | exp.amount: ₹${m.expAmt} | legSum: ₹${m.legSum} | diff: ₹${m.diff}`);
  });
}
