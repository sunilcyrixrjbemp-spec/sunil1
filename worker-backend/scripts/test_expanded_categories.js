const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs } = rawData;

function categorizeOther(desc, localPurchaseRemark) {
  const d = (desc || "").toLowerCase().trim();
  const lp = (localPurchaseRemark || "").toLowerCase().trim();
  const combined = `${d} ${lp}`.trim();

  if (!combined) return "MISCELLANEOUS";

  // 1. HOTEL / LODGING
  if (
    combined.includes("hotel") ||
    combined.includes("sandas inn") ||
    combined.includes("lodging") ||
    combined.includes("boarding") ||
    combined.includes("room stay") ||
    combined.includes("room rent") ||
    combined.includes("night stay")
  ) {
    // If it mentions bus stand to hotel or hotel to bus stand, that is travel!
    if (
      (combined.includes("to hotel") || combined.includes("hotel to")) &&
      (combined.includes("bus") || combined.includes("auto") || combined.includes("railway") || combined.includes("station") || combined.includes("hospital") || combined.includes("room"))
    ) {
      return "PUBLIC_TRAVEL";
    }
    return "HOTEL";
  }

  // 2. PUBLIC TRAVEL / LOCAL CONVEYANCE / BUS / TRAIN / AUTO / CAB / TAXI
  if (
    combined.includes("bus stand") ||
    combined.includes("railway station") ||
    combined.includes("rail station") ||
    combined.includes("bus fare") ||
    combined.includes("bus charge") ||
    combined.includes("traveling from") ||
    combined.includes("travelling from") ||
    combined.includes("travel charges") ||
    combined.includes("loading taxi") ||
    combined.includes("auto fare") ||
    combined.includes("auto charges") ||
    combined.includes("auto use") ||
    combined.includes("auto room to") ||
    combined === "auto" ||
    combined.startsWith("auto ") ||
    combined.endsWith(" auto") ||
    combined.includes(" cab") ||
    combined === "cab" ||
    combined.includes("taxi") ||
    combined.includes("up down charge") ||
    combined.includes("room to ") ||
    combined.includes("hospital to ") ||
    combined.includes("chc to ") ||
    combined.includes("phc to ") ||
    combined.includes("satellite hospital to home") ||
    combined.includes("return hanumangarh to bikaner") ||
    combined.includes("mch visit") ||
    combined.includes("merta city hospital") ||
    combined.includes("bhinay hospital")
  ) {
    return "PUBLIC_TRAVEL";
  }

  // 3. PRINTING & STATIONERY
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

  // 4. COURIER / PARCEL
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
    combined.includes("tube sent")
  ) {
    return "COURIER";
  }

  // 5. SPARE PURCHASE COST - NON GST
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
    combined.includes("push button") ||
    combined.includes("twizzers") ||
    combined.includes("fitting")
  ) {
    return "SPARE_PURCHASE";
  }

  return "MISCELLANEOUS";
}

// Inspect classification results
const categoryCounts = {
  PUBLIC_TRAVEL: 0,
  HOTEL: 0,
  COURIER: 0,
  SPARE_PURCHASE: 0,
  PRINTING: 0,
  MISCELLANEOUS: 0
};

const legsByCode = {};
for (const leg of legs) {
  const key = (leg.exp_id || "").trim().toUpperCase();
  if (!legsByCode[key]) legsByCode[key] = [];
  legsByCode[key].push(leg);
}

const classifiedItems = [];

for (const exp of expenses) {
  const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
  for (const leg of expLegs) {
    const oth_amt = parseFloat(leg.other_amount || 0);
    if (oth_amt > 0) {
      const cat = categorizeOther(leg.other_desc, leg.local_purchase_remark);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      classifiedItems.push({
        cat,
        amt: oth_amt,
        desc: leg.other_desc,
        date: exp.itinerary || exp.created_at
      });
    }
  }
}

console.log("=== CATEGORY COUNTS FOR OTHER ITEMS ===");
console.log(categoryCounts);

console.log("\n=== PUBLIC_TRAVEL SAMPLES FROM OTHER ===");
classifiedItems.filter(x => x.cat === "PUBLIC_TRAVEL").forEach(x => {
  console.log(`  [₹${x.amt} | ${x.date}] "${x.desc}"`);
});

console.log("\n=== HOTEL SAMPLES FROM OTHER ===");
classifiedItems.filter(x => x.cat === "HOTEL").forEach(x => {
  console.log(`  [₹${x.amt} | ${x.date}] "${x.desc}"`);
});

console.log("\n=== REMAINING MISCELLANEOUS SAMPLES ===");
classifiedItems.filter(x => x.cat === "MISCELLANEOUS").forEach(x => {
  console.log(`  [₹${x.amt} | ${x.date}] "${x.desc}"`);
});
