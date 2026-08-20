const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

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

  // 1. SPARE PURCHASE / PARTS (Check hardware / parts / cable FIRST to prevent "cable to X" false positives)
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
    combined.includes("teflon") ||
    combined.includes("tap role") ||
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
    combined.includes("vesline") ||
    combined.includes("tie rap") ||
    combined.includes("holder")
  ) {
    if (!combined.includes("bus fare") && !combined.includes("auto fare") && !combined.includes("bus stand to hotel") && !combined.includes("loading taxi") && !combined.includes("travel charges")) {
      return "SPARE_PURCHASE";
    }
  }

  // 2. COURIER / PARCEL
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
    return "PRINTING";
  }

  // 4. PUBLIC TRAVEL / LOCAL CONVEYANCE / BUS / TRAIN / AUTO / CAB / TAXI
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
    combined.includes("auto") ||
    combined.includes("cab") ||
    combined.includes("taxi") ||
    combined.includes("up down charge") ||
    combined.includes("room to ") ||
    combined.includes("hospital to ") ||
    combined.includes("chc to ") ||
    combined.includes("phc to ") ||
    combined.includes("hotel to") ||
    combined.includes("hotel  to") ||
    combined.includes("to hotel") ||
    combined.includes("satellite hospital to home") ||
    combined.includes("return hanumangarh to bikaner") ||
    combined.includes("mch visit") ||
    combined.includes("merta city hospital") ||
    combined.includes("bhinay hospital") ||
    combined.includes("bus")
  ) {
    return "PUBLIC_TRAVEL";
  }

  // 5. HOTEL / BOARDING & LODGING
  if (
    combined.includes("hotel") ||
    combined.includes("sandas inn") ||
    combined.includes("lodging") ||
    combined.includes("boarding") ||
    combined.includes("room stay") ||
    combined.includes("room rent") ||
    combined.includes("night stay")
  ) {
    return "HOTEL";
  }

  return "MISCELLANEOUS";
}

function simplifyDeductionReasons(categoryTexts, comments) {
  const parts = [];

  if (categoryTexts && categoryTexts.length > 0) {
    parts.push(...categoryTexts);
  }

  const baseCommuteHospitals = new Set();
  let hasBaseCommuteTA = false;
  let hasBaseDA = false;
  let hasKmAdjustment = false;
  let hasWrongAmount = false;
  const otherCleanComments = new Set();

  for (const rawComment of (comments || [])) {
    if (!rawComment) continue;
    const c = rawComment.trim();
    const cLower = c.toLowerCase();

    if (cLower === "na" || cLower === "n/a" || cLower === "nil" || cLower === "none" || cLower === "ok" || cLower === ".") continue;
    if (cLower.startsWith("[policyrestoration]")) continue;

    if (cLower.includes("commute ta") || cLower.includes("base location commute")) {
      hasBaseCommuteTA = true;
      const match = c.match(/Base:\s*([^—–-]+)/i);
      if (match && match[1]) {
        const hosp = match[1].trim()
          .replace(/Hospital\s+/i, "Hosp ")
          .replace(/Medical College And Hospital/i, "MC")
          .replace(/Medical College/i, "MC");
        if (hosp.length < 35) baseCommuteHospitals.add(hosp);
      }
      continue;
    }

    if (cLower.includes("da not applicable at base") || cLower.includes("da not allowed at base") || cLower.includes("base location da")) {
      hasBaseDA = true;
      continue;
    }

    if (
      cLower.startsWith("actual ") ||
      cLower.startsWith("actual km") ||
      cLower.includes("wrong km") ||
      cLower.includes("km update") ||
      cLower.includes("shortest path") ||
      cLower.includes("distance was incorrect") ||
      cLower === "km"
    ) {
      hasKmAdjustment = true;
      continue;
    }

    if (cLower.includes("wrong amount")) {
      hasWrongAmount = true;
      continue;
    }

    let cleaned = c
      .replace(/\[Retroactive\]\s*/gi, "")
      .replace(/\[Policy\]\s*/gi, "")
      .replace(/\s*Applied:\s*\d{4}-\d{2}-\d{2}\.?/gi, "")
      .trim();

    if (cleaned.length > 0 && cleaned.length < 60) {
      otherCleanComments.add(cleaned);
    }
  }

  const policyTags = [];
  if (hasBaseCommuteTA && hasBaseDA) {
    const hospStr = baseCommuteHospitals.size > 0 ? ` (${Array.from(baseCommuteHospitals)[0]})` : "";
    policyTags.push(`Base Commute TA & DA not eligible${hospStr}`);
  } else if (hasBaseCommuteTA) {
    const hospStr = baseCommuteHospitals.size > 0 ? ` (${Array.from(baseCommuteHospitals)[0]})` : "";
    policyTags.push(`Base Commute TA not eligible${hospStr}`);
  } else if (hasBaseDA) {
    policyTags.push("Base DA not eligible");
  }

  if (hasKmAdjustment && !categoryTexts.some(t => t.startsWith("KM:"))) {
    policyTags.push("Route KM adjusted");
  }
  if (hasWrongAmount) {
    policyTags.push("Amount adjusted");
  }

  for (const c of otherCleanComments) {
    if (!policyTags.some(t => t.toLowerCase() === c.toLowerCase())) {
      policyTags.push(c);
    }
  }

  const allFinalParts = [...parts, ...policyTags];
  if (allFinalParts.length === 0) return "";
  return allFinalParts.join("; ");
}

const reportRows = [];

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

  const miscItemList = [];

  for (const exp of userExps) {
    const expAmt = parseFloat(exp.amount || 0);
    const expOrig = parseFloat(exp.original_amount || exp.amount || 0);
    claimed_amount += expOrig;

    const expComments = commentsByExpense[exp.id] || [];
    allComments.push(...expComments);

    const claimDate = exp.itinerary || (exp.created_at ? exp.created_at.split(" ")[0] : "");

    const expLegs = legsByCode[(exp.expense_code || "").trim().toUpperCase()] || [];

    if (expAmt > 0 && expLegs.length > 0) {
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
        const travelAmt = parseFloat(leg.travel_amount || 0);
        const subAmt = parseFloat(leg.sub_amount || 0);

        // Private Travel KM - only approved amount (waived commute legs have travelAmt = 0)
        if (mode === "bike") {
          if (travelAmt > 0) {
            bike_km += travelAmt / 4.5;
          }
        } else if (mode === "car") {
          if (travelAmt > 0) {
            car_km += travelAmt / 9.0;
          }
        }

        // Public Travel
        if (mode === "auto") auto_amount += travelAmt;
        if (sub_mode === "auto") auto_amount += subAmt;
        if (mode === "train" || mode === "bus") train_bus_amount += travelAmt;
        if (sub_mode === "train" || sub_mode === "bus") train_bus_amount += subAmt;

        da_allowance += parseFloat(leg.da_amount || 0);
        boarding_lodging += parseFloat(leg.hotel_amount || 0);

        const baseLp = parseFloat(leg.local_purchase || 0);
        spare_purchase += baseLp;

        const oth_desc = (leg.other_desc || "").trim();
        const oth_amt = parseFloat(leg.other_amount || 0);

        if (oth_amt > 0) {
          const newCat = categorizeOther(oth_desc, leg.local_purchase_remark);
          if (newCat === "COURIER") {
            courier_charges += oth_amt;
          } else if (newCat === "SPARE_PURCHASE") {
            spare_purchase += oth_amt;
          } else if (newCat === "PRINTING") {
            printing_stationery += oth_amt;
          } else if (newCat === "PUBLIC_TRAVEL") {
            train_bus_amount += oth_amt;
          } else if (newCat === "HOTEL") {
            boarding_lodging += oth_amt;
          } else {
            misc_expenses += oth_amt;
            let dateStr = claimDate;
            if (claimDate.includes("-")) {
              const parts = claimDate.split("-");
              if (parts.length === 3) {
                dateStr = (parts[0].length === 4) ? `${parts[2]}-Jul` : `${parts[0]}-Jul`;
              }
            }
            miscItemList.push({
              date: dateStr,
              fullDate: claimDate,
              amount: oth_amt,
              desc: oth_desc || "Misc"
            });
          }
        }

        // Deductions tracking for Reason column
        const kmDiff = parseFloat(leg.original_distance_km || 0) - (travelAmt > 0 ? (mode === "bike" ? travelAmt / 4.5 : travelAmt / 9.0) : 0);
        const autoDiff = (
          ((leg.travel_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_travel_amount || 0) - travelAmt) : 0) +
          ((leg.sub_mode || "").trim().toLowerCase() === "auto" ? (parseFloat(leg.original_sub_amount || 0) - subAmt) : 0)
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
    } else if (expAmt > 0) {
      // Direct claim without separate legs
      da_allowance += expAmt;
    }
  }

  const categoryTexts = [];
  const kmDays = Object.keys(kmDeductions).map(Number).sort((a,b)=>a-b);
  if (kmDays.length > 0) {
    const totalKm = kmDays.reduce((sum, d) => sum + kmDeductions[d], 0);
    categoryTexts.push(`KM: ${totalKm.toFixed(0)}km (${kmDays.length} days: ${kmDays.join(",")})`);
  }
  const autoDays = Object.keys(autoDeductions).map(Number).sort((a,b)=>a-b);
  if (autoDays.length > 0) {
    const totalAuto = autoDays.reduce((sum, d) => sum + autoDeductions[d], 0);
    categoryTexts.push(`Auto: ₹${totalAuto.toFixed(0)} (${autoDays.length} days: ${autoDays.join(",")})`);
  }
  const daDays = Object.keys(daDeductions).map(Number).sort((a,b)=>a-b);
  if (daDays.length > 0) {
    const totalDa = daDays.reduce((sum, d) => sum + daDeductions[d], 0);
    categoryTexts.push(`DA: ₹${totalDa.toFixed(0)} (${daDays.length} days: ${daDays.join(",")})`);
  }
  const hotelDays = Object.keys(hotelDeductions).map(Number).sort((a,b)=>a-b);
  if (hotelDays.length > 0) {
    const totalHotel = hotelDays.reduce((sum, d) => sum + hotelDeductions[d], 0);
    categoryTexts.push(`Hotel: ₹${totalHotel.toFixed(0)} (${hotelDays.length} days: ${hotelDays.join(",")})`);
  }
  const spareDays = Object.keys(spareDeductions).map(Number).sort((a,b)=>a-b);
  if (spareDays.length > 0) {
    const totalSpare = spareDays.reduce((sum, d) => sum + spareDeductions[d], 0);
    categoryTexts.push(`Spare: ₹${totalSpare.toFixed(0)} (${spareDays.length} days: ${spareDays.join(",")})`);
  }
  const otherDays = Object.keys(otherDeductions).map(Number).sort((a,b)=>a-b);
  if (otherDays.length > 0) {
    const totalOther = otherDays.reduce((sum, d) => sum + otherDeductions[d], 0);
    categoryTexts.push(`Other: ₹${totalOther.toFixed(0)} (${otherDays.length} days: ${otherDays.join(",")})`);
  }

  const deduction_reason = simplifyDeductionReasons(categoryTexts, allComments);

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

  reportRows.push({
    ee_code: usr.e_code || usr.user_id || user_code,
    ee_name: usr.name || "",
    grade: usr.grade || "",
    designation: usr.designation || "",
    cc: usr.zone || usr.district || "",
    submitted_date: "5 August",
    mail_hard_copy: "Soft Copy",
    bike_km,
    car_km,
    auto_amount,
    train_bus_amount,
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
    remarks: "", // Clean remarks column
    manager: resolvedManager,
    state: "Rajasthan",
    claimed_amount,
    diff,
    miscItemList
  });
}

reportRows.sort((a, b) => a.ee_name.localeCompare(b.ee_name));

function buildExcelHtml(rows) {
  let rowsHtml = "";
  
  rows.forEach((r, idx) => {
    const R = idx + 2;
    const privateTravelFormula = `=(${r.bike_km.toFixed(2)}*4.5)+(${r.car_km.toFixed(2)}*9)`;
    const publicTravelFormula = `=${r.auto_amount.toFixed(2)}+${r.train_bus_amount.toFixed(2)}`;
    const totalFormula = `=SUM(I${R}:Q${R})`;
    const netPayableFormula = `=R${R}-S${R}`;
    const diffFormula = `=AC${R}-R${R}`;

    const miscTitle = (r.miscItemList && r.miscItemList.length > 0)
      ? ` title="${r.miscItemList.map(m => `${m.date}: ₹${m.amount} (${m.desc})`).join('&#10;')}"`
      : "";

    rowsHtml += `
      <tr>
        <td>${idx + 1}</td>
        <td>${r.submitted_date || ""}</td>
        <td>${r.mail_hard_copy || "Soft Copy"}</td>
        <td style="mso-number-format:'\\@';">${r.ee_code}</td>
        <td>${r.grade || ""}</td>
        <td>${r.designation || ""}</td>
        <td>${r.cc || ""}</td>
        <td>${r.ee_name || ""}</td>
        <td style="text-align:right;">${privateTravelFormula}</td>
        <td style="text-align:right;">${publicTravelFormula}</td>
        <td style="text-align:right;">${(r.da_allowance || 0).toFixed(2)}</td>
        <td style="text-align:right;">${(r.spare_purchase || 0).toFixed(2)}</td>
        <td style="text-align:right;">${(r.courier_charges || 0).toFixed(2)}</td>
        <td style="text-align:right;">${(r.boarding_lodging || 0).toFixed(2)}</td>
        <td style="text-align:right;">${(r.printing_stationery || 0).toFixed(2)}</td>
        <td style="text-align:right;"${miscTitle}>${(r.misc_expenses || 0).toFixed(2)}</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right; font-weight:bold;">${totalFormula}</td>
        <td style="text-align:right; color:red;">${(r.advance || 0).toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:green;">${netPayableFormula}</td>
        <td></td>
        <td>Approved</td>
        <td>${(r.deduction_reason || "").replace(/"/g, "&quot;")}</td>
        <td>${r.month || ""}</td>
        <td>${r.hold_reason || "No"}</td>
        <td></td>
        <td>${r.manager || ""}</td>
        <td>${r.state || "Rajasthan"}</td>
        <td style="text-align:right;">${(r.claimed_amount || 0).toFixed(2)}</td>
        <td style="text-align:right; font-weight:bold; color:red;">${diffFormula}</td>
      </tr>
    `;
  });

  rowsHtml += `
    <tr style="background-color:#e8f5e9; font-weight:bold; border-top:2px solid #1b5e20;">
      <td colspan="8" style="text-align:center; font-family:'Segoe UI', sans-serif;">GRAND TOTAL</td>
      <td style="text-align:right;">=SUM(I2:I${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(J2:J${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(K2:K${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(L2:L${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(M2:M${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(N2:N${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(O2:O${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(P2:P${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(Q2:Q${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(R2:R${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(S2:S${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(T2:T${rows.length + 1})</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td style="text-align:right;">=SUM(AC2:AC${rows.length + 1})</td>
      <td style="text-align:right;">=SUM(AD2:AD${rows.length + 1})</td>
    </tr>
  `;

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; }
        th { 
          background-color: #1b5e20; 
          color: #ffffff; 
          font-weight: bold; 
          border: 1px solid #1b5e20; 
          padding: 6px 8.5px; 
          font-family: 'Segoe UI', sans-serif; 
          font-size: 10pt; 
          text-align: center;
        }
        td { 
          border: 1px solid #c8e6c9; 
          padding: 5px 6px; 
          font-family: 'Segoe UI', sans-serif; 
          font-size: 9.5pt; 
        }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Sl No</th>
            <th>Submitted Date</th>
            <th>Mail / Hard Copy</th>
            <th>EE Code</th>
            <th>Grade</th>
            <th>Designation</th>
            <th>CC</th>
            <th>EE Name</th>
            <th>5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)</th>
            <th>5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)</th>
            <th>5314102 - Exp Daily Allowances</th>
            <th>5314108 - Exp Spare Purchase Cost - Non GST</th>
            <th>5314103 - Exp Courier Charges</th>
            <th>5314104 - Exp Boarding & Lodging</th>
            <th>5314105 - Exp Printing & Stationery</th>
            <th>5314106 - Exp Miscellaneous Expenses</th>
            <th>5314107 - Exp Fuel Expenses</th>
            <th>Total</th>
            <th>Advances</th>
            <th>Net Payable</th>
            <th>GST Bills</th>
            <th>Status</th>
            <th>Reason for deduction</th>
            <th>Month</th>
            <th>Hold Reson</th>
            <th>Remarks</th>
            <th>Manager</th>
            <th>State</th>
            <th>total claimed amount</th>
            <th>differenece</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

async function generateExcelJSWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cyrix Field Connect";
  workbook.lastModifiedBy = "Cyrix Field Connect";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Consolidated Report", {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const columns = [
    { header: "Sl No", key: "sl_no", width: 8 },
    { header: "Submitted Date", key: "submitted_date", width: 15 },
    { header: "Mail / Hard Copy", key: "mail_hard_copy", width: 16 },
    { header: "EE Code", key: "ee_code", width: 12 },
    { header: "Grade", key: "grade", width: 10 },
    { header: "Designation", key: "designation", width: 26 },
    { header: "CC", key: "cc", width: 14 },
    { header: "EE Name", key: "ee_name", width: 28 },
    { header: "5314101 - Exp Travelling Expense - Private Transport (Bike and personal car)", key: "pvt_travel", width: 24 },
    { header: "5314101 - Exp Travelling Expense - public Transport (Bus, Train, Auto, uber, Rapido etc)", key: "pub_travel", width: 24 },
    { header: "5314102 - Exp Daily Allowances", key: "da_allowance", width: 18 },
    { header: "5314108 - Exp Spare Purchase Cost - Non GST", key: "spare_purchase", width: 22 },
    { header: "5314103 - Exp Courier Charges", key: "courier_charges", width: 18 },
    { header: "5314104 - Exp Boarding & Lodging", key: "boarding_lodging", width: 20 },
    { header: "5314105 - Exp Printing & Stationery", key: "printing_stationery", width: 20 },
    { header: "5314106 - Exp Miscellaneous Expenses", key: "misc_expenses", width: 20 },
    { header: "5314107 - Exp Fuel Expenses", key: "fuel", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Advances", key: "advance", width: 14 },
    { header: "Net Payable", key: "net_payable", width: 16 },
    { header: "GST Bills", key: "gst_bills", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Reason for deduction", key: "deduction_reason", width: 45 },
    { header: "Month", key: "month", width: 14 },
    { header: "Hold Reson", key: "hold_reason", width: 12 },
    { header: "Remarks", key: "remarks", width: 20 },
    { header: "Manager", key: "manager", width: 22 },
    { header: "State", key: "state", width: 14 },
    { header: "total claimed amount", key: "claimed_amount", width: 20 },
    { header: "differenece", key: "diff", width: 16 }
  ];

  worksheet.columns = columns;

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B5E20' } // Dark Green
    };
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B5E20' } },
      bottom: { style: 'thin', color: { argb: 'FF1B5E20' } },
      left: { style: 'thin', color: { argb: 'FF1B5E20' } },
      right: { style: 'thin', color: { argb: 'FF1B5E20' } }
    };
  });

  // Add Data Rows
  reportRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const row = worksheet.addRow({
      sl_no: idx + 1,
      submitted_date: r.submitted_date,
      mail_hard_copy: r.mail_hard_copy,
      ee_code: r.ee_code,
      grade: r.grade,
      designation: r.designation,
      cc: r.cc,
      ee_name: r.ee_name,
      pvt_travel: { formula: `(${r.bike_km.toFixed(2)}*4.5)+(${r.car_km.toFixed(2)}*9)` },
      pub_travel: { formula: `${(r.auto_amount || 0).toFixed(2)}+${(r.train_bus_amount || 0).toFixed(2)}` },
      da_allowance: r.da_allowance,
      spare_purchase: r.spare_purchase,
      courier_charges: r.courier_charges,
      boarding_lodging: r.boarding_lodging,
      printing_stationery: r.printing_stationery,
      misc_expenses: r.misc_expenses,
      fuel: 0,
      total: { formula: `SUM(I${rowNum}:Q${rowNum})` },
      advance: r.advance,
      net_payable: { formula: `R${rowNum}-S${rowNum}` },
      gst_bills: "",
      status: "Approved",
      deduction_reason: r.deduction_reason,
      month: r.month,
      hold_reason: r.hold_reason,
      remarks: "",
      manager: r.manager,
      state: r.state,
      claimed_amount: r.claimed_amount,
      diff: { formula: `AC${rowNum}-R${rowNum}` }
    });

    row.height = 20;

    // Formatting per cell
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFC8E6C9' } },
        bottom: { style: 'thin', color: { argb: 'FFC8E6C9' } },
        left: { style: 'thin', color: { argb: 'FFC8E6C9' } },
        right: { style: 'thin', color: { argb: 'FFC8E6C9' } }
      };

      // Number formatting for currency columns
      if ([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 29, 30].includes(colNumber)) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1 || colNumber === 4 || colNumber === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Bold totals
      if (colNumber === 18) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
      } else if (colNumber === 19) {
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FFD32F2F' } }; // Red advances
      } else if (colNumber === 20) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF2E7D32' } }; // Green net payable
      } else if (colNumber === 30) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFD32F2F' } }; // Red diff
      }
    });

    // Native Excel Note on Misc Cell (Column P / col 16)
    if (r.miscItemList && r.miscItemList.length > 0) {
      const miscCell = row.getCell(16);
      miscCell.note = r.miscItemList.map(m => `${m.date}: ₹${m.amount} (${m.desc})`).join('\n');
    }
  });

  // Add Grand Total Summary Row
  const grandTotalRowNum = reportRows.length + 2;
  const grandTotalRow = worksheet.addRow({
    sl_no: "GRAND TOTAL",
    pvt_travel: { formula: `SUM(I2:I${grandTotalRowNum - 1})` },
    pub_travel: { formula: `SUM(J2:J${grandTotalRowNum - 1})` },
    da_allowance: { formula: `SUM(K2:K${grandTotalRowNum - 1})` },
    spare_purchase: { formula: `SUM(L2:L${grandTotalRowNum - 1})` },
    courier_charges: { formula: `SUM(M2:M${grandTotalRowNum - 1})` },
    boarding_lodging: { formula: `SUM(N2:N${grandTotalRowNum - 1})` },
    printing_stationery: { formula: `SUM(O2:O${grandTotalRowNum - 1})` },
    misc_expenses: { formula: `SUM(P2:P${grandTotalRowNum - 1})` },
    fuel: { formula: `SUM(Q2:Q${grandTotalRowNum - 1})` },
    total: { formula: `SUM(R2:R${grandTotalRowNum - 1})` },
    advance: { formula: `SUM(S2:S${grandTotalRowNum - 1})` },
    net_payable: { formula: `SUM(T2:T${grandTotalRowNum - 1})` },
    claimed_amount: { formula: `SUM(AC2:AC${grandTotalRowNum - 1})` },
    diff: { formula: `SUM(AD2:AD${grandTotalRowNum - 1})` }
  });

  worksheet.mergeCells(`A${grandTotalRowNum}:H${grandTotalRowNum}`);
  grandTotalRow.height = 24;

  grandTotalRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' } // Light Green
    };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1B5E20' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1B5E20' } },
      bottom: { style: 'medium', color: { argb: 'FF1B5E20' } }
    };
    if (colNumber >= 9) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  return workbook;
}

async function main() {
  const wb = await generateExcelJSWorkbook();
  const htmlContent = buildExcelHtml(reportRows);

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

  const csvRows = [headers];
  reportRows.forEach((r, idx) => {
    csvRows.push([
      idx + 1,
      r.submitted_date,
      r.mail_hard_copy,
      r.ee_code,
      r.grade,
      r.designation,
      r.cc,
      `"${r.ee_name}"`,
      r.pvtTravel.toFixed(2),
      r.pubTravel.toFixed(2),
      r.da_allowance.toFixed(2),
      r.spare_purchase.toFixed(2),
      r.courier_charges.toFixed(2),
      r.boarding_lodging.toFixed(2),
      r.printing_stationery.toFixed(2),
      r.misc_expenses.toFixed(2),
      "0.00",
      r.totalApproved.toFixed(2),
      r.advance.toFixed(2),
      r.netPayable.toFixed(2),
      "",
      "Approved",
      `"${(r.deduction_reason || "").replace(/"/g, '""')}"`,
      r.month,
      r.hold_reason,
      `"${(r.remarks || "").replace(/"/g, '""')}"`,
      `"${r.manager}"`,
      r.state,
      r.claimed_amount.toFixed(2),
      r.diff.toFixed(2)
    ]);
  });
  const csvContent = csvRows.map(row => row.join(",")).join("\n");

  // Save files to Desktop
  const desktopPaths = [
    { type: 'xlsx', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_ShortRemarks.xlsx' },
    { type: 'xlsx', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.xlsx' },
    { type: 'xlsx', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_Final.xlsx' },
    { type: 'xlsx', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_ShortRemarks_V2.xlsx' },
    { type: 'xlsx', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_CellNotes.xlsx' },
    { type: 'html', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_ShortRemarks.xls' },
    { type: 'html', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.xls' },
    { type: 'html', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_Final.xls' },
    { type: 'csv', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026_ShortRemarks.csv' },
    { type: 'csv', path: 'C:/Users/Cyrix HealthCare/Desktop/Consolidated_Report_July_2026.csv' }
  ];

  for (const item of desktopPaths) {
    try {
      if (item.type === 'xlsx') {
        await wb.xlsx.writeFile(item.path);
      } else if (item.type === 'html') {
        fs.writeFileSync(item.path, htmlContent, 'utf8');
      } else if (item.type === 'csv') {
        fs.writeFileSync(item.path, csvContent, 'utf8');
      }
      console.log(`✅ Saved to Desktop: ${item.path}`);
    } catch (e) {
      console.warn(`⚠️ Note: ${item.path} (${e.message})`);
    }
  }
}

main().catch(console.error);
