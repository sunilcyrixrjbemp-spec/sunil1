const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

const legsByCode = {};
const legsByExpenseId = {};

for (const leg of legs) {
  if (leg.exp_id) {
    const key = leg.exp_id.trim().toUpperCase();
    if (!legsByCode[key]) legsByCode[key] = [];
    legsByCode[key].push(leg);
  }
  if (leg.expense_id) {
    if (!legsByExpenseId[leg.expense_id]) legsByExpenseId[leg.expense_id] = [];
    legsByExpenseId[leg.expense_id].push(leg);
  }
}

let exactMatchCount = 0;
let mismatchCount = 0;

for (const exp of expenses) {
  const expAmt = parseFloat(exp.amount || 0);
  if (expAmt === 0) {
    exactMatchCount++;
    continue;
  }

  const expCode = (exp.expense_code || "").trim().toUpperCase();
  const expLegs = legsByCode[expCode] || legsByExpenseId[exp.id] || [];

  let legPvtTravel = 0;
  let legPubTravel = 0;
  let legDa = 0;
  let legLp = 0;
  let legHotel = 0;
  let legOther = 0;

  for (const leg of expLegs) {
    const mode = (leg.travel_mode || "").trim().toLowerCase();
    const sub = (leg.sub_mode || "").trim().toLowerCase();

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

  if (Math.abs(legSum - expAmt) < 0.05) {
    exactMatchCount++;
  } else {
    mismatchCount++;
    console.log(`Mismatch on ${expCode} (ID: ${exp.id}): exp.amount = ${expAmt}, legSum = ${legSum}`);
  }
}

console.log(`\nFinal Match Check: ${exactMatchCount} / ${expenses.length} (Mismatches: ${mismatchCount})`);
