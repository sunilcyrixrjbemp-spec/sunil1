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

const expensesByUser = {};
for (const exp of expenses) {
  const usr = userMap[exp.user_id];
  if (!usr) continue;
  const uCode = usr.user_id || usr.e_code || exp.user_id;
  if (!expensesByUser[uCode]) expensesByUser[uCode] = [];
  expensesByUser[uCode].push(exp);
}

const legsByCode = {};
for (const leg of legs) {
  const key = (leg.exp_id || "").trim().toUpperCase();
  if (!legsByCode[key]) legsByCode[key] = [];
  legsByCode[key].push(leg);
}

console.log("Analyzing all 183 engineers for Approved Amount discrepancies...");

let totalDiscrepantUsers = 0;
const discrepantSummary = [];

for (const [user_code, userExps] of Object.entries(expensesByUser)) {
  const usr = userMap[user_code] || { name: user_code, e_code: user_code };

  let totalExpApproved = 0;
  let totalExpClaimed = 0;

  let sumBikeKm = 0;
  let sumCarKm = 0;
  let sumAuto = 0;
  let sumTrainBus = 0;
  let sumDa = 0;
  let sumLp = 0;
  let sumHotel = 0;
  let sumOther = 0;

  let sumLegTravelAmount = 0; // actual travel_amount stored in legs

  for (const exp of userExps) {
    totalExpApproved += parseFloat(exp.amount || 0);
    totalExpClaimed += parseFloat(exp.original_amount || exp.amount || 0);

    const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
    for (const leg of expLegs) {
      const mode = (leg.travel_mode || "").toLowerCase();
      const sub = (leg.sub_mode || "").toLowerCase();

      if (mode === "bike") sumBikeKm += parseFloat(leg.distance_km || 0);
      if (mode === "car") sumCarKm += parseFloat(leg.distance_km || 0);
      if (mode === "auto") sumAuto += parseFloat(leg.travel_amount || 0);
      if (sub === "auto") sumAuto += parseFloat(leg.sub_amount || 0);
      if (mode === "train" || mode === "bus") sumTrainBus += parseFloat(leg.travel_amount || 0);

      sumDa += parseFloat(leg.da_amount || 0);
      sumLp += parseFloat(leg.local_purchase || 0);
      sumHotel += parseFloat(leg.hotel_amount || 0);
      sumOther += parseFloat(leg.other_amount || 0);

      sumLegTravelAmount += parseFloat(leg.travel_amount || 0) + parseFloat(leg.sub_amount || 0);
    }
  }

  const pvtTravelCalc = (sumBikeKm * 4.5) + (sumCarKm * 9.0);
  const pubTravelCalc = sumAuto + sumTrainBus;
  const rawSumOfColumns = pvtTravelCalc + pubTravelCalc + sumDa + sumLp + sumHotel + sumOther;

  const diff = rawSumOfColumns - totalExpApproved;

  if (Math.abs(diff) > 1.0) {
    totalDiscrepantUsers++;
    discrepantSummary.push({
      name: usr.name,
      ee_code: usr.e_code || usr.user_id,
      totalExpApproved,
      totalExpClaimed,
      rawSumOfColumns,
      diff,
      pvtTravelCalc,
      pubTravelCalc,
      sumDa,
      sumLp,
      sumHotel,
      sumOther
    });
  }
}

console.log(`\nFound ${totalDiscrepantUsers} users where Raw Sum of Columns (${discrepantSummary.length}) exceeds exp.amount (Approved DB amount)!`);
console.log("\nTop 20 discrepancies:");
discrepantSummary.sort((a, b) => b.diff - a.diff).slice(0, 20).forEach((d, idx) => {
  console.log(`${idx + 1}. ${d.name} (${d.ee_code}):`);
  console.log(`   Approved in DB/PDF: ₹${d.totalExpApproved.toFixed(2)} | Claimed: ₹${d.totalExpClaimed.toFixed(2)}`);
  console.log(`   Consolidated Sheet Column Sum: ₹${d.rawSumOfColumns.toFixed(2)}  (Over-calculated by: +₹${d.diff.toFixed(2)})`);
});
