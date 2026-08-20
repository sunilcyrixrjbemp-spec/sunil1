const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

// Let's inspect all misc entries per engineer
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

function categorizeOther(desc, localPurchaseRemark) {
  const d = (desc || "").toLowerCase().trim();
  const lp = (localPurchaseRemark || "").toLowerCase().trim();
  const combined = `${d} ${lp}`.trim();

  if (!combined) return "MISCELLANEOUS";

  if (
    combined.includes("print") ||
    combined.includes("priting") ||
    combined.includes("photo copy") ||
    combined.includes("photocopy") ||
    combined.includes("xerox") ||
    combined.includes("zerox") ||
    combined.includes("stationery") ||
    combined.includes("stationary") ||
    combined.includes("spiral") ||
    combined.includes("binding") ||
    combined.includes("lamination") ||
    combined.includes("notepad") ||
    combined.includes("note pad") ||
    combined.includes("register") ||
    combined.includes("stamp") ||
    combined.includes("cartridge") ||
    combined.includes("toner") ||
    combined.includes("file cover") ||
    combined.includes("file folder") ||
    combined.includes("box file") ||
    combined.includes("envelope") ||
    combined.includes("a4 size paper") ||
    combined.includes("paper rim") ||
    combined.includes("stapler") ||
    combined.includes("marker") ||
    combined.includes("whitener") ||
    combined.includes("pen and marker") ||
    combined.includes("marker and pen") ||
    combined === "pen"
  ) {
    if ((combined.includes("parcel") || combined.includes("courier")) && !combined.includes("print") && !combined.includes("xerox")) {
      return "COURIER";
    }
    return "PRINTING";
  }

  if (
    combined.includes("courier") ||
    combined.includes("courrier") ||
    combined.includes("corrier") ||
    combined.includes("curier") ||
    combined.includes("courior") ||
    combined.includes("parcel") ||
    combined.includes("parcal") ||
    combined.includes("parsal") ||
    combined.includes("speed post") ||
    combined.includes("speedpost") ||
    combined.includes("postage") ||
    combined.includes("dtdc") ||
    combined.includes("tirupati") ||
    combined.includes("cargo") ||
    combined.includes("dispatch") ||
    combined.includes("dak") ||
    combined.includes("delhivery") ||
    combined.includes("tracking") ||
    combined.includes("corier slip") ||
    combined.includes("tube received") ||
    combined.includes("tube collect") ||
    combined.includes("collect parsal") ||
    combined.includes("collect 3 parcel") ||
    combined.includes("contactor collect") ||
    combined.includes("bus charge") && combined.includes("tube") ||
    combined.includes("bus fare for nephro scope received")
  ) {
    return "COURIER";
  }

  if (
    combined.includes("purchase") ||
    combined.includes("purchased") ||
    combined.includes("perchage") ||
    combined.includes("purchese") ||
    combined.includes("purchse") ||
    combined.includes("spare") ||
    combined.includes("part") ||
    combined.includes("motor") ||
    combined.includes("moter") ||
    combined.includes("cable") ||
    combined.includes("wire") ||
    combined.includes("plug") ||
    combined.includes("socket") ||
    combined.includes("connector") ||
    combined.includes("coupler") ||
    combined.includes("adapter") ||
    combined.includes("adaptor") ||
    combined.includes("battery") ||
    combined.includes("bateri") ||
    combined.includes("cell") ||
    combined.includes("hardware") ||
    combined.includes("screw") ||
    combined.includes("scruu") ||
    combined.includes("scrue") ||
    combined.includes("nut") ||
    combined.includes("bolt") ||
    combined.includes("m-seal") ||
    combined.includes("mseal") ||
    combined.includes("m sil") ||
    combined.includes("feviquick") ||
    combined.includes("fevikwik") ||
    combined.includes("feviquik") ||
    combined.includes("fewikwik") ||
    combined.includes("fevitite") ||
    combined.includes("fivicvip") ||
    combined.includes("araldite") ||
    combined.includes("aerolite") ||
    combined.includes("anabond") ||
    combined.includes("boand tite") ||
    combined.includes("glue") ||
    combined.includes("tape") ||
    combined.includes("teplon") ||
    combined.includes("switch") ||
    combined.includes("swich") ||
    combined.includes("relay") ||
    combined.includes("really") ||
    combined.includes("replay") ||
    combined.includes("sensor") ||
    combined.includes("fuse") ||
    combined.includes("lead") ||
    combined.includes("cuff") ||
    combined.includes("probe") ||
    combined.includes("oil") ||
    combined.includes("grease") ||
    combined.includes("filter") ||
    combined.includes("repair") ||
    combined.includes("welding") ||
    combined.includes("soldering") ||
    combined.includes("solder") ||
    combined.includes("lath") ||
    combined.includes("lathe") ||
    combined.includes("tool") ||
    combined.includes("pana") ||
    combined.includes("goti") ||
    combined.includes("meter") ||
    combined.includes("fan") ||
    combined.includes("valve") ||
    combined.includes("compressor") ||
    combined.includes("power supply") ||
    combined.includes("power cord") ||
    combined.includes("transformer") ||
    combined.includes("capacitor") ||
    combined.includes("capictor") ||
    combined.includes("charger") ||
    combined.includes("wd40") ||
    combined.includes("wd 40") ||
    combined.includes("wd-40") ||
    combined.includes("w40") ||
    combined.includes("zorrik") ||
    combined.includes("carbon") ||
    combined.includes("brush") ||
    combined.includes("pendrive") ||
    combined.includes("pen drive") ||
    combined.includes("heating element") ||
    combined.includes("element") ||
    combined.includes("pipe") ||
    combined.includes("clamp") ||
    combined.includes("tester") ||
    combined.includes("board") ||
    combined.includes("diode") ||
    combined.includes("resistor") ||
    combined.includes("vdr") ||
    combined.includes("ic ") ||
    combined.includes("ic40") ||
    combined.includes("keypad") ||
    combined.includes("knob") ||
    combined.includes("wheel") ||
    combined.includes("bulb") ||
    combined.includes("balaab") ||
    combined.includes("lamp") ||
    combined.includes("led") ||
    combined.includes("light") ||
    combined.includes("cutter") ||
    combined.includes("stripper") ||
    combined.includes("iron") ||
    combined.includes("pvc") ||
    combined.includes("bearing") ||
    combined.includes("washer") ||
    combined.includes("seal") ||
    combined.includes("gasket") ||
    combined.includes("tubing") ||
    combined.includes("silicone") ||
    combined.includes("alcohol") ||
    combined.includes("alcohal") ||
    combined.includes("isopropyl") ||
    combined.includes("lubricant") ||
    combined.includes("kabze") ||
    combined.includes("spring") ||
    combined.includes("pin top") ||
    combined.includes("3 pin") ||
    combined.includes("three pin") ||
    combined.includes("lan") ||
    combined.includes("sata") ||
    combined.includes("hdd") ||
    combined.includes("ssd") ||
    combined.includes("ram") ||
    combined.includes("smps") ||
    combined.includes("push button")
  ) {
    return "SPARE_PURCHASE";
  }

  return "MISCELLANEOUS";
}

const expensesByUser = {};
for (const exp of expenses) {
  const usr = userMap[exp.user_id];
  if (!usr) continue;
  const uCode = usr.user_id || usr.e_code || exp.user_id;
  if (!expensesByUser[uCode]) expensesByUser[uCode] = [];
  expensesByUser[uCode].push(exp);
}

const engineerMiscDetails = [];

for (const [user_code, userExps] of Object.entries(expensesByUser)) {
  const usr = userMap[user_code] || { name: user_code, e_code: user_code };
  const miscItems = [];

  for (const exp of userExps) {
    const claimDate = exp.itinerary || (exp.created_at ? exp.created_at.split(" ")[0] : "");
    const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];

    for (const leg of expLegs) {
      const oth_desc = (leg.other_desc || "").trim();
      const oth_amt = parseFloat(leg.other_amount || 0);

      if (oth_amt > 0) {
        const cat = categorizeOther(oth_desc, leg.local_purchase_remark);
        if (cat === "MISCELLANEOUS") {
          // Format date cleanly e.g. 19-Jul or 2026-07-19
          let formattedDate = claimDate;
          if (claimDate.includes("-")) {
            const parts = claimDate.split("-");
            if (parts.length === 3) {
              // parts: [YYYY, MM, DD] or [DD, MM, YYYY]
              if (parts[0].length === 4) {
                formattedDate = `${parts[2]}-Jul`;
              } else {
                formattedDate = `${parts[0]}-Jul`;
              }
            }
          }

          miscItems.push({
            date: formattedDate,
            fullDate: claimDate,
            amount: oth_amt,
            desc: oth_desc || "Misc"
          });
        }
      }
    }
  }

  if (miscItems.length > 0) {
    const totalMisc = miscItems.reduce((s, x) => s + x.amount, 0);
    // Sort miscItems by date
    miscItems.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    
    // Create concise summary string:
    // e.g. "Misc (₹2473): [19-Jul: ₹2473 - Food with BME], [12-Jul: ₹2150 - Food with BME]"
    const itemStrings = miscItems.map(m => `${m.date}: ₹${m.amount} (${m.desc})`);
    const summaryStr = itemStrings.join("; ");

    engineerMiscDetails.push({
      ee_name: usr.name,
      ee_code: usr.e_code || usr.user_id,
      totalMisc,
      summaryStr,
      items: miscItems
    });
  }
}

console.log(`Total engineers with Misc Expenses: ${engineerMiscDetails.length}`);
console.log("\nSample Misc remarks strings:");
engineerMiscDetails.slice(0, 15).forEach((e, idx) => {
  console.log(`${idx + 1}. ${e.ee_name} (${e.ee_code}) -> Total Misc: ₹${e.totalMisc}`);
  console.log(`   Remarks: "${e.summaryStr}"`);
});
