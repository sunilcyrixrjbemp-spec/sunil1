const fs = require('fs');
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../../frontend/node_modules/xlsx'));

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

// Name lookup map for managers
const nameLookupMap = {};
for (const u of users) {
  if (u.user_id) nameLookupMap[u.user_id.toLowerCase().trim()] = u.name;
  if (u.e_code) nameLookupMap[u.e_code.toLowerCase().trim()] = u.name;
  if (u.name) nameLookupMap[u.name.toLowerCase().trim()] = u.name;
}

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

const legsByCode = {};
for (const leg of legs) {
  const key = (leg.exp_id || "").trim().toUpperCase();
  if (!legsByCode[key]) legsByCode[key] = [];
  legsByCode[key].push(leg);
}

const advancesMap = {};
for (const adv of advances) {
  advancesMap[(adv.user_id || "").toLowerCase()] = parseFloat(adv.advance_amount || 0);
}

const commentsByExpense = {};
for (const log of editLogs) {
  if (log.comment && log.comment.trim()) {
    if (!commentsByExpense[log.expense_id]) commentsByExpense[log.expense_id] = [];
    commentsByExpense[log.expense_id].push(log.comment.trim());
  }
}

const expensesByUser = {};
for (const exp of expenses) {
  const usr = userMap[exp.user_id];
  if (!usr) continue;
  const uCode = usr.user_id || usr.e_code || exp.user_id;
  if (!expensesByUser[uCode]) expensesByUser[uCode] = [];
  expensesByUser[uCode].push(exp);
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

const rows = [];

for (const [user_code, userExps] of Object.entries(expensesByUser)) {
  const usr = userByCode[user_code] || { name: user_code, e_code: user_code, user_id: user_code };

  let bike_km = 0;
  let car_km = 0;
  let auto_amount = 0;
  let train_bus_amount = 0;
  let da_allowance = 0;
  let spare_purchase = 0;
  let courier_charges = 0;
  let boarding_lodging = 0;
  let printing_stationery = 0;
  let misc_expenses = 0;
  let claimed_amount = 0;

  const allComments = [];
  const kmDeductions = {};
  const autoDeductions = {};
  const daDeductions = {};
  const hotelDeductions = {};
  const spareDeductions = {};
  const otherDeductions = {};

  for (const exp of userExps) {
    claimed_amount += parseFloat(exp.original_amount || exp.amount || 0);
    const expComments = commentsByExpense[exp.id] || [];
    allComments.push(...expComments);

    const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];
    for (const leg of expLegs) {
      let day = 0;
      if (exp.itinerary) {
        day = parseInt(exp.itinerary.split("-")[2], 10) || 0;
      } else if (exp.created_at) {
        const datePart = exp.created_at.split(" ")[0];
        day = parseInt(datePart.split("-")[2], 10) || 0;
      }

      const mode = (leg.travel_mode || "").trim().toLowerCase();
      const sub_mode = (leg.sub_mode || "").trim().toLowerCase();

      if (mode === "bike") bike_km += parseFloat(leg.distance_km || 0);
      if (mode === "car") car_km += parseFloat(leg.distance_km || 0);

      if (mode === "auto") auto_amount += parseFloat(leg.travel_amount || 0);
      if (sub_mode === "auto") auto_amount += parseFloat(leg.sub_amount || 0);

      if (mode === "train" || mode === "bus") train_bus_amount += parseFloat(leg.travel_amount || 0);

      da_allowance += parseFloat(leg.da_amount || 0);
      boarding_lodging += parseFloat(leg.hotel_amount || 0);

      const baseLp = parseFloat(leg.local_purchase || 0);
      spare_purchase += baseLp;

      const oth_desc = (leg.other_desc || "").trim();
      const oth_amt = parseFloat(leg.other_amount || 0);

      if (oth_amt > 0) {
        const newCat = categorizeOther(oth_desc, leg.local_purchase_remark);
        if (newCat === "COURIER") courier_charges += oth_amt;
        else if (newCat === "SPARE_PURCHASE") spare_purchase += oth_amt;
        else if (newCat === "PRINTING") printing_stationery += oth_amt;
        else misc_expenses += oth_amt;
      }

      // Deductions
      const kmDiff = parseFloat(leg.original_distance_km || 0) - parseFloat(leg.distance_km || 0);
      const autoDiff = (
        ((leg.travel_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_travel_amount || 0) - parseFloat(leg.travel_amount || 0)) : 0) +
        ((leg.sub_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_sub_amount || 0) - parseFloat(leg.sub_amount || 0)) : 0)
      );
      const daDiff = parseFloat(leg.original_da_amount || 0) - parseFloat(leg.da_amount || 0);
      const hotelDiff = parseFloat(leg.original_hotel_amount || 0) - parseFloat(leg.hotel_amount || 0);
      const spareDiff = parseFloat(leg.original_local_purchase || 0) - parseFloat(leg.local_purchase || 0);
      const otherDiff = parseFloat(leg.original_other_amount || 0) - parseFloat(leg.other_amount || 0);

      if (day > 0) {
        if (kmDiff > 0) kmDeductions[day] = (kmDeductions[day] || 0) + kmDiff;
        if (autoDiff > 0) autoDeductions[day] = (autoDeductions[day] || 0) + autoDiff;
        if (daDiff > 0) daDeductions[day] = (daDeductions[day] || 0) + daDiff;
        if (hotelDiff > 0) hotelDeductions[day] = (hotelDeductions[day] || 0) + hotelDiff;
        if (spareDiff > 0) spareDeductions[day] = (spareDeductions[day] || 0) + spareDiff;
        if (otherDiff > 0) otherDeductions[day] = (otherDeductions[day] || 0) + otherDiff;
      }
    }
  }

  const categoryTexts = [];
  const kmDays = Object.keys(kmDeductions).map(Number).sort((a,b)=>a-b);
  if (kmDays.length > 0) {
    const totalKm = kmDays.reduce((sum, d) => sum + kmDeductions[d], 0);
    categoryTexts.push(`KM: ${totalKm}km (${kmDays.length} days: ${kmDays.join(",")})`);
  }
  const autoDays = Object.keys(autoDeductions).map(Number).sort((a,b)=>a-b);
  if (autoDays.length > 0) {
    const totalAuto = autoDays.reduce((sum, d) => sum + autoDeductions[d], 0);
    categoryTexts.push(`Auto: ${totalAuto} (${autoDays.length} days: ${autoDays.join(",")})`);
  }
  const daDays = Object.keys(daDeductions).map(Number).sort((a,b)=>a-b);
  if (daDays.length > 0) {
    const totalDa = daDays.reduce((sum, d) => sum + daDeductions[d], 0);
    categoryTexts.push(`DA: ${totalDa} (${daDays.length} days: ${daDays.join(",")})`);
  }
  const hotelDays = Object.keys(hotelDeductions).map(Number).sort((a,b)=>a-b);
  if (hotelDays.length > 0) {
    const totalHotel = hotelDays.reduce((sum, d) => sum + hotelDeductions[d], 0);
    categoryTexts.push(`Hotel: ${totalHotel} (${hotelDays.length} days: ${hotelDays.join(",")})`);
  }
  const spareDays = Object.keys(spareDeductions).map(Number).sort((a,b)=>a-b);
  if (spareDays.length > 0) {
    const totalSpare = spareDays.reduce((sum, d) => sum + spareDeductions[d], 0);
    categoryTexts.push(`Spare: ${totalSpare} (${spareDays.length} days: ${spareDays.join(",")})`);
  }
  const otherDays = Object.keys(otherDeductions).map(Number).sort((a,b)=>a-b);
  if (otherDays.length > 0) {
    const totalOther = otherDays.reduce((sum, d) => sum + otherDeductions[d], 0);
    categoryTexts.push(`Other: ${totalOther} (${otherDays.length} days: ${otherDays.join(",")})`);
  }

  const seenReasons = new Set();
  const uniqueReasons = [];
  for (const r of [...categoryTexts, ...allComments]) {
    if (!r) continue;
    const normalized = r.trim().toLowerCase().replace(/\s+/g, " ");
    if (!seenReasons.has(normalized)) {
      seenReasons.add(normalized);
      uniqueReasons.push(r.trim());
    }
  }
  const deduction_reason = uniqueReasons.join("; ");

  const user_advance = advancesMap[(usr.user_id || "").toLowerCase()] || advancesMap[(usr.e_code || "").toLowerCase()] || 0;

  const rawManager = (usr.manager || "").trim();
  const resolvedManager = rawManager && rawManager.toLowerCase() !== "none"
    ? (nameLookupMap[rawManager.toLowerCase()] || rawManager)
    : "";

  const pvtTravel = (bike_km * 4.5) + (car_km * 9.0);
  const pubTravel = auto_amount + train_bus_amount;
  const totalApproved = pvtTravel + pubTravel + da_allowance + spare_purchase + courier_charges + boarding_lodging + printing_stationery + misc_expenses;
  const netPayable = totalApproved - user_advance;
  const diff = claimed_amount - totalApproved;

  rows.push({
    ee_code: usr.e_code || usr.user_id || user_code,
    ee_name: usr.name || "",
    grade: usr.grade || "",
    designation: usr.designation || "",
    cc: usr.zone || usr.district || "",
    submitted_date: "5 August",
    mail_hard_copy: "Soft Copy",
    pvtTravel,
    pubTravel,
    da_allowance,
    spare_purchase,
    courier_charges,
    boarding_lodging,
    printing_stationery,
    misc_expenses,
    fuel: 0,
    totalApproved,
    advance: user_advance,
    netPayable,
    gst_bills: "",
    status: "Approved",
    deduction_reason,
    month: "July-2026",
    hold_reason: "No",
    remarks: "",
    manager: resolvedManager,
    state: "Rajasthan",
    claimed_amount,
    diff
  });
}

rows.sort((a, b) => a.ee_name.localeCompare(b.ee_name));

const headers = [
  "Sl No", "Submitted Date", "Mail / Hard Copy", "EE Code", "Grade", "Designation", "CC", "EE Name",
  "5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)",
  "5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)",
  "5314102 - Exp Daily Allowances",
  "5314108 - Exp Spare Purchase Cost - Non GST",
  "5314103 - Exp Courier Charges",
  "5314104 - Exp Boarding & Lodging",
  "5314105 - Exp Printing & Stationery",
  "5314106 - Exp Miscellaneous Expenses",
  "5314107 - Exp Fuel Expenses",
  "Total",
  "Advances",
  "Net Payable",
  "GST Bills",
  "Status",
  "Reason for deduction",
  "Month",
  "Hold Reson",
  "Remarks",
  "Manager",
  "State",
  "total claimed amount",
  "differenece"
];

const sheetData = [headers];

rows.forEach((r, idx) => {
  const rowNum = idx + 2;
  sheetData.push([
    idx + 1,
    r.submitted_date,
    r.mail_hard_copy,
    r.ee_code,
    r.grade,
    r.designation,
    r.cc,
    r.ee_name,
    { f: `(${r.pvtTravel.toFixed(2)})` },
    { f: `(${r.pubTravel.toFixed(2)})` },
    r.da_allowance,
    r.spare_purchase,
    r.courier_charges,
    r.boarding_lodging,
    r.printing_stationery,
    r.misc_expenses,
    0,
    { f: `SUM(I${rowNum}:Q${rowNum})` },
    r.advance,
    { f: `R${rowNum}-S${rowNum}` },
    "",
    "Approved",
    r.deduction_reason,
    r.month,
    r.hold_reason,
    r.remarks,
    r.manager,
    r.state,
    r.claimed_amount,
    { f: `AC${rowNum}-R${rowNum}` }
  ]);
});

// Grand Total Row
const grandTotalRowNum = rows.length + 2;
sheetData.push([
  "GRAND TOTAL", "", "", "", "", "", "", "",
  { f: `SUM(I2:I${grandTotalRowNum - 1})` },
  { f: `SUM(J2:J${grandTotalRowNum - 1})` },
  { f: `SUM(K2:K${grandTotalRowNum - 1})` },
  { f: `SUM(L2:L${grandTotalRowNum - 1})` },
  { f: `SUM(M2:M${grandTotalRowNum - 1})` },
  { f: `SUM(N2:N${grandTotalRowNum - 1})` },
  { f: `SUM(O2:O${grandTotalRowNum - 1})` },
  { f: `SUM(P2:P${grandTotalRowNum - 1})` },
  { f: `SUM(Q2:Q${grandTotalRowNum - 1})` },
  { f: `SUM(R2:R${grandTotalRowNum - 1})` },
  { f: `SUM(S2:S${grandTotalRowNum - 1})` },
  { f: `SUM(T2:T${grandTotalRowNum - 1})` },
  "", "", "", "", "", "", "", "",
  { f: `SUM(AC2:AC${grandTotalRowNum - 1})` },
  { f: `SUM(AD2:AD${grandTotalRowNum - 1})` }
]);

const ws = XLSX.utils.aoa_to_sheet(sheetData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Consolidated Report");

const outPath = "C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.xlsx";
XLSX.writeFile(wb, outPath);
console.log(`✅ Saved XLSX to ${outPath}`);
