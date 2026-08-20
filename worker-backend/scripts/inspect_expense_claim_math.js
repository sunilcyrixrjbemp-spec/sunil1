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

// Let's inspect user E1704 (Sunil Vishnoi) and E1889 (Akhil Kumar)
const targetUsers = ['E1704', 'E1889', 'E2095', 'E1700'];

for (const targetCode of targetUsers) {
  const usr = userMap[targetCode];
  if (!usr) continue;

  console.log(`\n======================================================`);
  console.log(`USER: ${usr.name} (${usr.e_code} / ${usr.user_id})`);
  console.log(`======================================================`);

  const userExps = expenses.filter(e => e.user_id == usr.id || e.user_id == usr.user_id || e.user_id == usr.e_code);
  console.log(`Total approved expenses in July: ${userExps.length}`);

  let totalExpApprovedAmt = 0;
  let totalExpOriginalAmt = 0;

  for (const exp of userExps) {
    totalExpApprovedAmt += parseFloat(exp.amount || 0);
    totalExpOriginalAmt += parseFloat(exp.original_amount || exp.amount || 0);

    const expLegs = legs.filter(l => (l.exp_id || "").trim().toUpperCase() === (exp.expense_code || "").trim().toUpperCase());
    
    // Sum of leg approved fields
    let legBikeKm = 0;
    let legCarKm = 0;
    let legAuto = 0;
    let legTrainBus = 0;
    let legDa = 0;
    let legLp = 0;
    let legHotel = 0;
    let legOther = 0;

    for (const leg of expLegs) {
      const mode = (leg.travel_mode || "").toLowerCase();
      const sub = (leg.sub_mode || "").toLowerCase();
      if (mode === "bike") legBikeKm += parseFloat(leg.distance_km || 0);
      if (mode === "car") legCarKm += parseFloat(leg.distance_km || 0);
      if (mode === "auto") legAuto += parseFloat(leg.travel_amount || 0);
      if (sub === "auto") legAuto += parseFloat(leg.sub_amount || 0);
      if (mode === "train" || mode === "bus") legTrainBus += parseFloat(leg.travel_amount || 0);
      legDa += parseFloat(leg.da_amount || 0);
      legLp += parseFloat(leg.local_purchase || 0);
      legHotel += parseFloat(leg.hotel_amount || 0);
      legOther += parseFloat(leg.other_amount || 0);
    }

    const calculatedLegTotal = (legBikeKm * 4.5) + (legCarKm * 9.0) + legAuto + legTrainBus + legDa + legLp + legHotel + legOther;
    const expAmount = parseFloat(exp.amount || 0);
    const expOrig = parseFloat(exp.original_amount || exp.amount || 0);

    if (Math.abs(calculatedLegTotal - expAmount) > 0.01 || Math.abs(expOrig - expAmount) > 0.01) {
      console.log(`\n  Claim: ${exp.expense_code} | Date: ${exp.itinerary}`);
      console.log(`    exp.original_amount: ₹${expOrig.toFixed(2)}`);
      console.log(`    exp.amount (Approved in DB): ₹${expAmount.toFixed(2)}`);
      console.log(`    calculatedLegTotal (Sum of leg fields): ₹${calculatedLegTotal.toFixed(2)}`);
      console.log(`    Difference (LegTotal - exp.amount): ₹${(calculatedLegTotal - expAmount).toFixed(2)}`);

      // Print edit logs for this expense
      const logs = editLogs.filter(l => l.expense_id == exp.id);
      if (logs.length > 0) {
        console.log(`    Edit Logs:`, logs.map(l => l.comment));
      }

      // Print legs
      for (const leg of expLegs) {
        console.log(`    Leg: mode=${leg.travel_mode}, km=${leg.distance_km} (orig=${leg.original_distance_km}), travelAmt=${leg.travel_amount}, da=${leg.da_amount} (orig=${leg.original_da_amount}), lp=${leg.local_purchase}, hotel=${leg.hotel_amount}, other=${leg.other_amount}`);
      }
    }
  }

  console.log(`\nSUMMARY FOR ${usr.name}:`);
  console.log(`  Total exp.original_amount (Claimed): ₹${totalExpOriginalAmt.toFixed(2)}`);
  console.log(`  Total exp.amount (Approved in Expenses Table / PDF): ₹${totalExpApprovedAmt.toFixed(2)}`);
}
