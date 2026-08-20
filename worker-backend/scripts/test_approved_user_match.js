const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

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

const expensesByUser = {};
for (const exp of expenses) {
  const usr = userMap[exp.user_id];
  if (!usr) continue;
  const uCode = usr.user_id || usr.e_code || exp.user_id;
  if (!expensesByUser[uCode]) expensesByUser[uCode] = [];
  expensesByUser[uCode].push(exp);
}

let totalEngineers = 0;
let perfectMatchEngineers = 0;

console.log("=== CHECKING USER TOTALS WITH APPROVED TRAVEL AND DEDUCTIONS ===");

for (const [user_code, userExps] of Object.entries(expensesByUser)) {
  const usr = userMap[user_code] || { name: user_code, e_code: user_code };
  totalEngineers++;

  let userExpApprovedTotal = 0;
  let userClaimedTotal = 0;

  let userBikeKm = 0;
  let userCarKm = 0;
  let userAuto = 0;
  let userTrainBus = 0;
  let userDa = 0;
  let userLp = 0;
  let userCourier = 0;
  let userHotel = 0;
  let userPrint = 0;
  let userMisc = 0;

  for (const exp of userExps) {
    const expAmt = parseFloat(exp.amount || 0);
    const expOrig = parseFloat(exp.original_amount || exp.amount || 0);
    userExpApprovedTotal += expAmt;
    userClaimedTotal += expOrig;

    if (expAmt === 0) continue; // Zeroed out claim

    const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
    
    // If expense has legs
    if (expLegs.length > 0) {
      for (const leg of expLegs) {
        const mode = (leg.travel_mode || "").trim().toLowerCase();
        const sub = (leg.sub_mode || "").trim().toLowerCase();
        const travelAmt = parseFloat(leg.travel_amount || 0);
        const subAmt = parseFloat(leg.sub_amount || 0);

        // Private Travel KM - only if travelAmt > 0 (not a deducted commute leg!)
        if (mode === "bike") {
          if (travelAmt > 0) {
            userBikeKm += travelAmt / 4.5;
          }
        } else if (mode === "car") {
          if (travelAmt > 0) {
            userCarKm += travelAmt / 9.0;
          }
        }

        // Public Travel
        if (mode === "auto") userAuto += travelAmt;
        if (sub === "auto") userAuto += subAmt;
        if (mode === "train" || mode === "bus") userTrainBus += travelAmt;
        if (sub === "train" || sub === "bus") userTrainBus += subAmt;

        userDa += parseFloat(leg.da_amount || 0);
        userHotel += parseFloat(leg.hotel_amount || 0);

        // Local Purchase
        const baseLp = parseFloat(leg.local_purchase || 0);
        userLp += baseLp;

        // Other Amount
        const oth_amt = parseFloat(leg.other_amount || 0);
        if (oth_amt > 0) {
          const newCat = categorizeOther(leg.other_desc, leg.local_purchase_remark);
          if (newCat === "COURIER") userCourier += oth_amt;
          else if (newCat === "SPARE_PURCHASE") userLp += oth_amt;
          else if (newCat === "PRINTING") userPrint += oth_amt;
          else userMisc += oth_amt;
        }
      }
    } else {
      // Direct claim without separate legs
      userDa += expAmt;
    }
  }

  const pvtTravel = (userBikeKm * 4.5) + (userCarKm * 9.0);
  const pubTravel = userAuto + userTrainBus;
  const totalApproved = pvtTravel + pubTravel + userDa + userLp + userCourier + userHotel + userPrint + userMisc;

  const diff = totalApproved - userExpApprovedTotal;
  if (Math.abs(diff) < 0.1) {
    perfectMatchEngineers++;
  } else {
    console.log(`Discrepancy for ${usr.name} (${user_code}): Calculated Total = ₹${totalApproved.toFixed(2)} vs exp.amount = ₹${userExpApprovedTotal.toFixed(2)} (diff: ₹${diff.toFixed(2)})`);
  }
}

console.log(`\nResults: ${perfectMatchEngineers} / ${totalEngineers} engineers have 100% PERFECT MATCH with DB/PDF Approved Amounts!`);
