const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const { users, expenses, legs, advances, editLogs } = rawData;

// Build lookup maps
const userMap = {};
const userByCode = {};
for (const u of users) {
  if (u.id) userMap[u.id] = u;
  if (u.user_id) {
    userMap[u.user_id] = u;
    userByCode[u.user_id] = u;
  }
  if (u.e_code) {
    userMap[u.e_code] = u;
    userByCode[u.e_code] = u;
  }
}

// Find all legs with other_amount > 0 or other_desc present
const otherLegs = legs.filter(l => (parseFloat(l.other_amount || 0) > 0 || parseFloat(l.original_other_amount || 0) > 0 || (l.other_desc && l.other_desc.trim())));

console.log(`Total legs with other_amount / other_desc: ${otherLegs.length}`);

// Let's see unique other_desc values and amounts
const descSummary = {};
for (const leg of otherLegs) {
  const desc = (leg.other_desc || "").trim();
  const amt = parseFloat(leg.other_amount || 0);
  const origAmt = parseFloat(leg.original_other_amount || 0);
  const usr = userMap[leg.user_id] || { name: leg.user_id, e_code: leg.user_id, id: leg.user_id };

  if (!descSummary[desc]) {
    descSummary[desc] = {
      desc,
      count: 0,
      totalApprovedAmt: 0,
      totalClaimedAmt: 0,
      engineers: new Set(),
      items: []
    };
  }

  descSummary[desc].count++;
  descSummary[desc].totalApprovedAmt += amt;
  descSummary[desc].totalClaimedAmt += origAmt;
  descSummary[desc].engineers.add(`${usr.name} (${usr.e_code})`);
  descSummary[desc].items.push({
    engineerName: usr.name,
    eeCode: usr.e_code,
    expCode: leg.exp_id,
    date: leg.claim_date,
    amount: amt,
    origAmount: origAmt,
    desc: desc,
    localPurchase: leg.local_purchase,
    localPurchaseRemark: leg.local_purchase_remark
  });
}

console.log("\n=== SUMMARY OF OTHER / MISC DESCRIPTIONS ===");
const sortedDescs = Object.values(descSummary).sort((a, b) => b.totalApprovedAmt - a.totalApprovedAmt);

for (const s of sortedDescs) {
  console.log(`Desc: "${s.desc}" | Count: ${s.count} | Approved: ₹${s.totalApprovedAmt.toFixed(2)} | Claimed: ₹${s.totalClaimedAmt.toFixed(2)} | Engineers: [${Array.from(s.engineers).join(', ')}]`);
}

// Let's categorize each description according to the user's rules:
// 1. Courier / Parcel -> Courier Charges (5314103)
// 2. Local purchase / Purchase / Spare / Part / Material -> Spare Purchase Cost - Non GST (5314108)
// 3. Photo copy / Printing / Xerox / Stationery / Binding -> Printing & Stationery (5314105)
// 4. Other / Misc / Toll / Parking / etc. -> Miscellaneous Expenses (5314106)

function categorizeOtherDesc(desc, localPurchaseRemark) {
  const d = (desc || "").toLowerCase().trim();
  const lp = (localPurchaseRemark || "").toLowerCase().trim();
  const text = `${d} ${lp}`;

  // Courier keywords
  if (
    text.includes("courier") ||
    text.includes("courrier") ||
    text.includes("curier") ||
    text.includes("courior") ||
    text.includes("parcel") ||
    text.includes("speed post") ||
    text.includes("postage") ||
    text.includes("cargo") ||
    text.includes("dispatch") ||
    text.includes("dak")
  ) {
    return "COURIER";
  }

  // Spare / Local Purchase keywords
  if (
    text.includes("local purchase") ||
    text.includes("purchase") ||
    text.includes("purchese") ||
    text.includes("purchse") ||
    text.includes("spare") ||
    text.includes("part") ||
    text.includes("material") ||
    text.includes("cable") ||
    text.includes("wire") ||
    text.includes("plug") ||
    text.includes("socket") ||
    text.includes("connector") ||
    text.includes("adapter") ||
    text.includes("adaptor") ||
    text.includes("battery") ||
    text.includes("cell") ||
    text.includes("hardware") ||
    text.includes("screw") ||
    text.includes("nut") ||
    text.includes("bolt") ||
    text.includes("m-seal") ||
    text.includes("mseal") ||
    text.includes("feviquick") ||
    text.includes("fevikwik") ||
    text.includes("glue") ||
    text.includes("tape") ||
    text.includes("switch") ||
    text.includes("relay") ||
    text.includes("sensor") ||
    text.includes("fuse") ||
    text.includes("lead") ||
    text.includes("cuff") ||
    text.includes("probe") ||
    text.includes("oil") ||
    text.includes("grease") ||
    text.includes("filter") ||
    text.includes("repair") ||
    text.includes("welding") ||
    text.includes("soldering") ||
    text.includes("tool") ||
    text.includes("meter")
  ) {
    return "SPARE_PURCHASE";
  }

  // Printing & Stationery keywords
  if (
    text.includes("print") ||
    text.includes("priting") ||
    text.includes("photo copy") ||
    text.includes("photocopy") ||
    text.includes("xerox") ||
    text.includes("zerox") ||
    text.includes("stationery") ||
    text.includes("stationary") ||
    text.includes("scan") ||
    text.includes("binding") ||
    text.includes("spiral") ||
    text.includes("lamination") ||
    text.includes("paper") ||
    text.includes("pen") ||
    text.includes("pad") ||
    text.includes("folder") ||
    text.includes("file") ||
    text.includes("stamp") ||
    text.includes("ink") ||
    text.includes("cartridge")
  ) {
    return "PRINTING";
  }

  // Miscellaneous Expenses
  return "MISCELLANEOUS";
}

// Let's check which engineers have items that were wrongly put into Printing previously
const engineerIssues = {};

for (const leg of otherLegs) {
  const amt = parseFloat(leg.other_amount || 0);
  const origAmt = parseFloat(leg.original_other_amount || 0);
  const desc = (leg.other_desc || "").trim();
  const usr = userMap[leg.user_id] || { name: leg.user_id, e_code: leg.user_id, user_id: leg.user_id };
  const eeCode = usr.e_code || usr.user_id;

  // Previous logic: if desc contains "courier" or "courrier", courier_charges += amt; ELSE printing_stationery += amt;
  const prevCat = (desc.toLowerCase().includes("courier") || desc.toLowerCase().includes("courrier")) ? "COURIER" : "PRINTING";
  const newCat = categorizeOtherDesc(desc, leg.local_purchase_remark);

  const isChanged = (prevCat !== newCat);

  if (!engineerIssues[eeCode]) {
    engineerIssues[eeCode] = {
      name: usr.name,
      eeCode: eeCode,
      designation: usr.designation,
      district: usr.district,
      totalOtherAmt: 0,
      prevPrintingAmt: 0,
      prevCourierAmt: 0,
      newPrintingAmt: 0,
      newCourierAmt: 0,
      newSpareAmt: 0,
      newMiscAmt: 0,
      changedEntries: [],
      allEntries: []
    };
  }

  engineerIssues[eeCode].totalOtherAmt += amt;
  if (prevCat === "PRINTING") engineerIssues[eeCode].prevPrintingAmt += amt;
  if (prevCat === "COURIER") engineerIssues[eeCode].prevCourierAmt += amt;

  if (newCat === "PRINTING") engineerIssues[eeCode].newPrintingAmt += amt;
  if (newCat === "COURIER") engineerIssues[eeCode].newCourierAmt += amt;
  if (newCat === "SPARE_PURCHASE") engineerIssues[eeCode].newSpareAmt += amt;
  if (newCat === "MISCELLANEOUS") engineerIssues[eeCode].newMiscAmt += amt;

  const entryInfo = {
    expId: leg.exp_id,
    date: leg.claim_date,
    amount: amt,
    origAmount: origAmt,
    desc: desc,
    prevCat,
    newCat,
    isChanged
  };

  engineerIssues[eeCode].allEntries.push(entryInfo);
  if (isChanged) {
    engineerIssues[eeCode].changedEntries.push(entryInfo);
  }
}

console.log("\n=== DETAILED ANALYSIS PER ENGINEER AFFECTED ===");
let totalAffectedEngineers = 0;
for (const [code, info] of Object.entries(engineerIssues)) {
  if (info.changedEntries.length > 0) {
    totalAffectedEngineers++;
    console.log(`\n👨‍🔧 Engineer: ${info.name} (EE Code: ${info.eeCode}, District: ${info.district})`);
    console.log(`   Total Other Amount: ₹${info.totalOtherAmt.toFixed(2)}`);
    console.log(`   [OLD] Courier: ₹${info.prevCourierAmt.toFixed(2)} | Printing: ₹${info.prevPrintingAmt.toFixed(2)}`);
    console.log(`   [NEW] Courier: ₹${info.newCourierAmt.toFixed(2)} | Spare Purchase: ₹${info.newSpareAmt.toFixed(2)} | Printing: ₹${info.newPrintingAmt.toFixed(2)} | Misc: ₹${info.newMiscAmt.toFixed(2)}`);
    console.log(`   Changed Lines (${info.changedEntries.length}):`);
    for (const ch of info.changedEntries) {
      console.log(`     - Date: ${ch.date} | Claim: ${ch.expId} | Amt: ₹${ch.amount.toFixed(2)} | Remark: "${ch.desc}" -> Was [${ch.prevCat}] => Now [${ch.newCat}]`);
    }
  }
}

console.log(`\nTotal engineers affected by misclassification: ${totalAffectedEngineers}`);
