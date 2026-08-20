const fs = require('fs');
const path = require('path');

const remarksList = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'july_all_remarks.json'), 'utf8'));

function classifyRemark(desc) {
  const d = (desc || "").toLowerCase().trim();

  if (!d) return "MISCELLANEOUS";

  // 1. Printing & Stationery
  // Check for printing/photocopy/stationery first or specific print terms
  if (
    d.includes("print") ||
    d.includes("photo copy") ||
    d.includes("photocopy") ||
    d.includes("xerox") ||
    d.includes("zerox") ||
    d.includes("stationery") ||
    d.includes("stationary") ||
    d.includes("spiral") ||
    d.includes("binding") ||
    d.includes("lamination") ||
    d.includes("notepad") ||
    d.includes("note pad") ||
    d.includes("register") ||
    d.includes("stamp") ||
    d.includes("cartridge") ||
    d.includes("toner") ||
    d.includes("file cover") ||
    d.includes("file folder") ||
    d.includes("stapler") ||
    d.includes("marker") ||
    d.includes("whitener") ||
    d.includes("pen ") ||
    d === "pen"
  ) {
    // If it mentions parcel or courier and printing, check context
    if ((d.includes("parcel") || d.includes("courier")) && !d.includes("print") && !d.includes("xerox")) {
      // courier
    } else {
      return "PRINTING";
    }
  }

  // 2. Courier & Parcel
  if (
    d.includes("courier") ||
    d.includes("courrier") ||
    d.includes("corrier") ||
    d.includes("curier") ||
    d.includes("courior") ||
    d.includes("parcel") ||
    d.includes("parcal") ||
    d.includes("parsal") ||
    d.includes("speed post") ||
    d.includes("speedpost") ||
    d.includes("postage") ||
    d.includes("dtdc") ||
    d.includes("tirupati") ||
    d.includes("cargo") ||
    d.includes("dispatch") ||
    d.includes("dak") ||
    d.includes("send to") ||
    d.includes("sent to") ||
    d.includes("delhivery") ||
    d.includes("tracking") ||
    d.includes("transport") && (d.includes("bikaner") || d.includes("jodhpur") || d.includes("jaipur") || d.includes("send") || d.includes("received"))
  ) {
    return "COURIER";
  }

  // 3. Spare Purchase / Local Purchase / Hardware / Tools / Components / Materials
  if (
    d.includes("purchase") ||
    d.includes("purchased") ||
    d.includes("perchage") ||
    d.includes("purchese") ||
    d.includes("purchse") ||
    d.includes("spare") ||
    d.includes("part") ||
    d.includes("motor") ||
    d.includes("moter") ||
    d.includes("cable") ||
    d.includes("wire") ||
    d.includes("plug") ||
    d.includes("socket") ||
    d.includes("connector") ||
    d.includes("adapter") ||
    d.includes("adaptor") ||
    d.includes("battery") ||
    d.includes("bateri") ||
    d.includes("cell") ||
    d.includes("hardware") ||
    d.includes("screw") ||
    d.includes("scruu") ||
    d.includes("nut") ||
    d.includes("bolt") ||
    d.includes("m-seal") ||
    d.includes("mseal") ||
    d.includes("feviquick") ||
    d.includes("fevikwik") ||
    d.includes("feviquik") ||
    d.includes("fevitite") ||
    d.includes("glue") ||
    d.includes("tape") ||
    d.includes("switch") ||
    d.includes("swich") ||
    d.includes("relay") ||
    d.includes("really") ||
    d.includes("sensor") ||
    d.includes("fuse") ||
    d.includes("lead") ||
    d.includes("cuff") ||
    d.includes("probe") ||
    d.includes("oil") ||
    d.includes("grease") ||
    d.includes("filter") ||
    d.includes("repair") ||
    d.includes("welding") ||
    d.includes("soldering") ||
    d.includes("solder") ||
    d.includes("tool") ||
    d.includes("pana") ||
    d.includes("goti") ||
    d.includes("meter") ||
    d.includes("fan") ||
    d.includes("valve") ||
    d.includes("compressor") ||
    d.includes("power supply") ||
    d.includes("transformer") ||
    d.includes("capacitor") ||
    d.includes("charger") ||
    d.includes("wd40") ||
    d.includes("w40") ||
    d.includes("carbon") ||
    d.includes("brush") ||
    d.includes("pendrive") ||
    d.includes("pen drive") ||
    d.includes("heating element") ||
    d.includes("element") ||
    d.includes("pipe") ||
    d.includes("clamp") ||
    d.includes("tester") ||
    d.includes("board") ||
    d.includes("diode") ||
    d.includes("resistor") ||
    d.includes("keypad") ||
    d.includes("knob") ||
    d.includes("wheel") ||
    d.includes("bulb") ||
    d.includes("lamp") ||
    d.includes("cutter") ||
    d.includes("stripper") ||
    d.includes("iron") ||
    d.includes("pvc") ||
    d.includes("bearing") ||
    d.includes("washer") ||
    d.includes("keypad") ||
    d.includes("seal") ||
    d.includes("gasket") ||
    d.includes("potentiometer") ||
    d.includes("multimeter") ||
    d.includes("lan") ||
    d.includes("sata") ||
    d.includes("hdd") ||
    d.includes("ssd") ||
    d.includes("ram") ||
    d.includes("smps")
  ) {
    return "SPARE_PURCHASE";
  }

  // 4. Miscellaneous Expenses (Recharge, Food, Toll, Hotel, Taxi/Travel in misc, etc.)
  return "MISCELLANEOUS";
}

const classified = remarksList.map(r => ({
  ...r,
  category: classifyRemark(r.desc)
}));

const byCategory = {
  COURIER: [],
  SPARE_PURCHASE: [],
  PRINTING: [],
  MISCELLANEOUS: []
};

for (const c of classified) {
  byCategory[c.category].push(c);
}

console.log(`\n=== CATEGORY SUMMARY ===`);
console.log(`COURIER: ${byCategory.COURIER.length} remarks, Total: ₹${byCategory.COURIER.reduce((s,x)=>s+x.totalAmt,0).toFixed(2)}`);
console.log(`SPARE_PURCHASE: ${byCategory.SPARE_PURCHASE.length} remarks, Total: ₹${byCategory.SPARE_PURCHASE.reduce((s,x)=>s+x.totalAmt,0).toFixed(2)}`);
console.log(`PRINTING: ${byCategory.PRINTING.length} remarks, Total: ₹${byCategory.PRINTING.reduce((s,x)=>s+x.totalAmt,0).toFixed(2)}`);
console.log(`MISCELLANEOUS: ${byCategory.MISCELLANEOUS.length} remarks, Total: ₹${byCategory.MISCELLANEOUS.reduce((s,x)=>s+x.totalAmt,0).toFixed(2)}`);

fs.writeFileSync(path.resolve(__dirname, 'july_classified_remarks.json'), JSON.stringify(classified, null, 2));
console.log("\nSaved july_classified_remarks.json");
