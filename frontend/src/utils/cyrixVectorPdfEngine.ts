import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function numberToWords(num: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const n = Math.floor(num);
  if (n < 0) return "Negative " + numberToWords(Math.abs(n));
  if (n === 0) return "Zero";
  if (n < 20) return a[n];
  if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
  return numberToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numberToWords(n % 10000000) : "");
}

function amountWords(amount: number): string {
  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);
  let w = (amount < 0 ? "Negative " : "") + "Rupees " + numberToWords(rupees);
  if (paise > 0) w += " And " + numberToWords(paise) + " Paise";
  return w + " Only";
}

function fmtDate(d: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(2);
    return `${dd}-${mm}-${yy}`;
  } catch { return d; }
}

const modeAbbr = (m: string) => {
  if (!m) return "";
  const map: Record<string, string> = {
    "Train": "T", "Bus": "B", "Bike": "Bi", "Car": "C", "Auto": "A",
    "train": "T", "bus": "B", "bike": "Bi", "car": "C", "auto": "A",
  };
  return map[m] || m;
};

const getCleanTicketNumber = (l: any): string => {
  const raw = String(l.complaint_id || l.ticket_no || l.ticket_id || l.mpt_id || "").trim();
  if (!raw || raw === "—" || raw === "-" || raw.toLowerCase().includes("barcode")) return "";
  return raw.replace(/barcode[:\s]*/gi, "").trim();
};

/**
 * Filter Return to home/hotel/room in Home District
 */
function cleanReturnText(text: string, isHomeDistrict: boolean): string {
  if (!text) return "";
  if (!isHomeDistrict) return text;

  const lower = text.toLowerCase();
  const returnPhrases = [
    "return to hotel", "return to hotal", "return to home", "return to room", "return to house",
    "back to home", "back to hotel", "back to hotal", "back to house", "back to room",
    "return room tonk", "return to room tonk"
  ];

  for (const p of returnPhrases) {
    if (lower.includes(p)) {
      const cleaned = text.replace(new RegExp(p, "gi"), "").replace(/^[\s,;\-]+|[\s,;\-]+$/g, "").trim();
      return cleaned || "Field visit";
    }
  }
  return text;
}

const getFormattedPurpose = (l: any, userDistrict: string = ""): string => {
  const homeDist = (userDistrict || "").trim().toLowerCase();
  const workedDist = (l.worked_district || l.district || "").trim().toLowerCase();
  const isHomeDistrict = homeDist && workedDist ? homeDist === workedDist : true;

  const parts: string[] = [];
  let acts: string[] = [];
  let actOtherDesc = "";
  if (l.activity_details) {
    try {
      const details = typeof l.activity_details === 'string' ? JSON.parse(l.activity_details) : l.activity_details;
      if (details && typeof details === 'object') {
        acts = details.selected_activities || [];
        actOtherDesc = details.activity_other_desc || "";
      }
    } catch (e) {}
  }
  
  const visitPurposeStr = String(l.visit_purpose || "");
  if ((!Array.isArray(acts) || acts.length === 0) && visitPurposeStr) {
    let clean = visitPurposeStr;
    if (clean.startsWith("Activities: ")) {
      clean = clean.replace("Activities: ", "");
    }
    acts = clean.split(",").map((s: string) => s.trim());
  }

  const finalActs = Array.isArray(acts) ? acts : [];
  finalActs.forEach((act: string) => {
    const actClean = act.trim();
    if (l.other_desc && actClean === l.other_desc.trim()) return;

    if (actClean === "Calls" || actClean === "Breakdown Call") {
      parts.push("Breakdown Call");
    } else if (actClean === "PMS") {
      parts.push("PMS");
    } else if (actClean === "Asset Tagging") {
      parts.push("Asset Tagging");
    } else if (actClean === "Mobilise Asset Update" || actClean === "Asset Verification") {
      parts.push("Asset Verification");
    } else if (actClean === "Calibration") {
      parts.push("Calibration");
    } else if (actClean && actClean !== "Field visit") {
      parts.push(actClean);
    }
  });

  if (actOtherDesc && actOtherDesc.trim()) parts.push(actOtherDesc.trim());

  let result = "";
  if (parts.length === 0) {
    const cleanPurpose = l.visit_purpose && !visitPurposeStr.startsWith("Activities:") ? visitPurposeStr : "Field visit";
    result = (l.other_desc && cleanPurpose.trim() === l.other_desc.trim()) ? "Field visit" : cleanPurpose;
  } else {
    result = parts.join(", ");
  }

  return cleanReturnText(result, isHomeDistrict);
};

export async function generateCyrixVectorPdf(
  user: any,
  claims: any[] = [],
  attachments: any[] = [],
  advance: number = 0
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 5;
  const tableWidth = pageWidth - margin * 2; // Exact 287mm

  const userDistrict = user.district || "";
  const managerName = user.manager || user.manager_name || "Manager";
  const coordinatorName = user.coordinator || user.coordinator_name || "Coordinator";

  const allLegs: { date: string; expCode: string; leg: any }[] = [];
  for (const claim of claims) {
    const claimStat = String(claim.status || "").toLowerCase();
    if (claimStat && claimStat !== "approved" && claimStat !== "auto_approved" && claimStat !== "auto-approved") {
      continue;
    }
    for (const rawLeg of (claim.legs || [])) {
      const legStat = String(rawLeg.status || "").toLowerCase();
      if (legStat === "rejected") continue;

      const mode = String(rawLeg.travel_mode || "").toLowerCase();
      const isBusOrTrain = mode.includes("bus") || mode.includes("train") || mode === "b" || mode === "t";

      const getTAAmount = () => {
        if (rawLeg.approved_ta_amount !== undefined && rawLeg.approved_ta_amount !== null && parseFloat(rawLeg.approved_ta_amount) > 0) return parseFloat(rawLeg.approved_ta_amount);
        if (rawLeg.ta_amount !== undefined && rawLeg.ta_amount !== null && parseFloat(rawLeg.ta_amount) > 0) return parseFloat(rawLeg.ta_amount);
        if (rawLeg.approved_travel_amount !== undefined && rawLeg.approved_travel_amount !== null && parseFloat(rawLeg.approved_travel_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.approved_travel_amount);
        if (rawLeg.travel_amount !== undefined && rawLeg.travel_amount !== null && parseFloat(rawLeg.travel_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.travel_amount);
        if (rawLeg.approved_sub_amount !== undefined && rawLeg.approved_sub_amount !== null && parseFloat(rawLeg.approved_sub_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.approved_sub_amount);
        if (rawLeg.sub_amount !== undefined && rawLeg.sub_amount !== null && parseFloat(rawLeg.sub_amount) > 0 && isBusOrTrain) return parseFloat(rawLeg.sub_amount);
        return 0;
      };

      const leg = {
        ...rawLeg,
        ta_amount: getTAAmount(),
        bike_amount: rawLeg.approved_bike_amount !== undefined ? parseFloat(rawLeg.approved_bike_amount || 0) : parseFloat(rawLeg.bike_amount || 0),
        car_amount: rawLeg.approved_car_amount !== undefined ? parseFloat(rawLeg.approved_car_amount || 0) : parseFloat(rawLeg.car_amount || 0),
        auto_amount: rawLeg.approved_auto_amount !== undefined ? parseFloat(rawLeg.approved_auto_amount || 0) : parseFloat(rawLeg.auto_amount || 0),
        da_amount: rawLeg.approved_da_amount !== undefined ? parseFloat(rawLeg.approved_da_amount || 0) : parseFloat(rawLeg.da_amount || 0),
        local_purchase: rawLeg.approved_local_purchase !== undefined ? parseFloat(rawLeg.approved_local_purchase || 0) : parseFloat(rawLeg.local_purchase || 0),
        hotel_amount: rawLeg.approved_hotel_amount !== undefined ? parseFloat(rawLeg.approved_hotel_amount || 0) : parseFloat(rawLeg.hotel_amount || 0),
        other_amount: rawLeg.approved_other_amount !== undefined ? parseFloat(rawLeg.approved_other_amount || 0) : parseFloat(rawLeg.other_amount || 0),
      };

      const legTotal = leg.ta_amount + leg.bike_amount + leg.car_amount + leg.auto_amount + leg.da_amount + leg.local_purchase + leg.hotel_amount + leg.other_amount;
      if (legTotal <= 0) continue;

      allLegs.push({ date: claim.date, expCode: claim.expense_code, leg });
    }
  }

  // Grand totals
  const gTA     = allLegs.reduce((s, r) => s + (r.leg.ta_amount || 0), 0);
  const gBikeCar= allLegs.reduce((s, r) => s + (r.leg.bike_amount || 0) + (r.leg.car_amount || 0), 0);
  const gAuto   = allLegs.reduce((s, r) => s + (r.leg.auto_amount || 0), 0);
  const gDA     = allLegs.reduce((s, r) => s + (r.leg.da_amount || 0), 0);
  const gLocal  = allLegs.reduce((s, r) => s + (r.leg.local_purchase || 0), 0);
  const gHotel  = allLegs.reduce((s, r) => s + (r.leg.hotel_amount || 0), 0);
  const gOther  = allLegs.reduce((s, r) => s + (r.leg.other_amount || 0), 0);
  const gKM     = allLegs.reduce((s, r) => s + (r.leg.distance_km || 0), 0);
  const gTotal  = gTA + gBikeCar + gAuto + gDA + gLocal + gHotel + gOther;

  const gPMS = allLegs.reduce((s, r) => s + (r.leg.pms_count || 0), 0);
  const gCalibration = allLegs.reduce((s, r) => s + (r.leg.calibration_count || 0), 0);
  const gPMSCalib = gPMS + gCalibration;
  
  const gCallsA = allLegs.reduce((s, r) => s + (r.leg.calls_assigned || 0), 0);
  const gCallsC = allLegs.reduce((s, r) => s + (r.leg.calls_completed || 0), 0);
  const gAssetQty = allLegs.reduce((s, r) => s + (r.leg.asset_tagging_qty || 0), 0);
  const gAssetVal = allLegs.reduce((s, r) => s + (r.leg.asset_tagging_val || 0), 0);

  // Dynamic Balanced Page Splitting
  const totalLegCount = allLegs.length;
  let ROWS_PER_PAGE = 15;
  if (totalLegCount <= 15) {
    ROWS_PER_PAGE = 15;
  } else if (totalLegCount <= 30) {
    ROWS_PER_PAGE = Math.ceil(totalLegCount / 2);
  } else if (totalLegCount <= 45) {
    ROWS_PER_PAGE = Math.ceil(totalLegCount / 3);
  } else {
    ROWS_PER_PAGE = 15;
  }

  const numPages = Math.max(1, Math.ceil(totalLegCount / ROWS_PER_PAGE));

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage("a4", "landscape");
    }

    const isLastPage = (pageIdx === numPages - 1);
    const pageLegs = allLegs.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);

    // 1. Header Banner (Exact tableWidth 287mm)
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(margin, 5, tableWidth, 9, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const titleText = `CYRIX HEALTHCARE — EXPENSES REIMBURSEMENT FORM ${numPages > 1 ? `(PAGE ${pageIdx + 1} OF ${numPages})` : ""}`;
    doc.text(titleText, pageWidth / 2, 11, { align: "center" });

    doc.setFontSize(7.5);
    doc.text(`PERIOD: ${(user.month || "MONTH").toUpperCase().substring(0, 3)} ${user.year || "2026"}`, margin + tableWidth - 4, 11, { align: "right" });

    // 2. Info Bar (Exact tableWidth 287mm)
    doc.setFillColor(241, 245, 249); // #F1F5F9
    doc.rect(margin, 14, tableWidth, 6.5, "F");
    doc.setDrawColor(71, 85, 105);
    doc.rect(margin, 14, tableWidth, 6.5, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.2);
    const infoY = 18.5;
    doc.text(`NAME: ${user.name || ""}`, margin + 4, infoY);
    doc.text(`EE CODE: ${user.e_code || ""}`, margin + 55, infoY);
    doc.text(`GRADE: ${user.grade || "L1"}`, margin + 95, infoY);
    doc.text(`MOBILE: ${user.phone || user.mobile || user.contact_no || ""}`, margin + 130, infoY);
    doc.text("PROJECT: RJBEMP", margin + 185, infoY);
    doc.text(`LOCATION: ${(user.district || "").toUpperCase()}`, margin + tableWidth - 4, infoY, { align: "right" });

    // 3. Table Rows Data
    const tableBody = pageLegs.map((r) => {
      const l = r.leg || {};
      const taCol = l.ta_amount || 0;
      const bikeCarAmt = (l.bike_amount || 0) + (l.car_amount || 0);
      const rowTotal = taCol + bikeCarAmt + (l.auto_amount || 0) + (l.da_amount || 0)
                     + (l.local_purchase || 0) + (l.hotel_amount || 0) + (l.other_amount || 0);
      const pmsCalibCount = (l.pms_count || 0) + (l.calibration_count || 0);
      const ticketNo = getCleanTicketNumber(l);
      const otherDescClean = cleanReturnText(l.other_desc || "", (userDistrict.trim().toLowerCase() === (l.worked_district || "").trim().toLowerCase()));

      return [
        fmtDate(r.date),
        l.from_location || "",
        l.to_location || "",
        l.worked_district || "",
        modeAbbr(l.travel_mode),
        l.distance_km > 0 ? l.distance_km.toFixed(1) : "",
        taCol > 0 ? taCol.toFixed(2) : "",
        l.auto_amount > 0 ? l.auto_amount.toFixed(2) : "",
        l.da_amount > 0 ? l.da_amount.toFixed(2) : "",
        l.local_purchase > 0 ? l.local_purchase.toFixed(2) : "",
        l.hotel_amount > 0 ? l.hotel_amount.toFixed(2) : "",
        otherDescClean || "",
        l.other_amount > 0 ? l.other_amount.toFixed(2) : "",
        rowTotal > 0 ? rowTotal.toFixed(2) : "",
        getFormattedPurpose(l, userDistrict) || "",
        ticketNo || "",
        pmsCalibCount > 0 ? String(pmsCalibCount) : "",
        (l.calls_completed > 0 || l.calls_assigned > 0) ? `${l.calls_completed}/${l.calls_assigned}` : ""
      ];
    });

    // ONLY construct footer on the VERY LAST page!
    const footRows: any[] = [];
    if (isLastPage) {
      footRows.push([
        { content: "TOTAL EXPENSE CLAIMED", colSpan: 5, styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gKM > 0 ? gKM.toFixed(1) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gTA > 0 ? gTA.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gAuto > 0 ? gAuto.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gDA > 0 ? gDA.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gLocal > 0 ? gLocal.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gHotel > 0 ? gHotel.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: "Total", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gOther > 0 ? gOther.toFixed(2) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gTotal.toFixed(2), styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: "", styles: { fillColor: [254, 243, 199] } },
        { content: gAssetQty > 0 ? `Qty: ${gAssetQty} | ${gAssetVal.toLocaleString("en-IN")}` : "", styles: { halign: "center", fontSize: 5.5, fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: gPMSCalib > 0 ? String(gPMSCalib) : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: (gCallsC > 0 || gCallsA > 0) ? `${gCallsC}/${gCallsA}` : "", styles: { halign: "center", fontStyle: "bold", fillColor: [254, 243, 199] } }
      ]);
      footRows.push([
        { content: "LESS: MONTHLY ADVANCE DEDUCTION", colSpan: 13, styles: { halign: "center", fontStyle: "bold" } },
        { content: advance > 0 ? Math.round(advance).toFixed(2) : "0.00", styles: { halign: "center", fontStyle: "bold", textColor: [185, 28, 28] } },
        { content: "", colSpan: 4 }
      ]);
      footRows.push([
        { content: "NET PAYABLE AMOUNT", colSpan: 13, styles: { halign: "center", fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: Math.round(gTotal - advance).toFixed(2), styles: { halign: "center", fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: "", colSpan: 4, styles: { fillColor: [241, 245, 249] } }
      ]);
    }

    // AutoTable width EXACTLY 287mm (Sum of columns = 287mm)
    autoTable(doc, {
      startY: 20.5,
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      pageBreak: "avoid",
      showFoot: isLastPage ? "lastPage" : "never",
      head: [
        [
          { content: "Date\n(DD-MM-YY)", rowSpan: 2 },
          { content: "Locations", colSpan: 2 },
          { content: "Worked\nDistrict", rowSpan: 2 },
          { content: "Mode\n(T/B/Bi/C)", rowSpan: 2 },
          { content: "Dist.\n(KM)", rowSpan: 2 },
          { content: "Train/Bus\nFare (TA)", rowSpan: 2 },
          { content: "Auto\nFare", rowSpan: 2 },
          { content: "D.A.", rowSpan: 2 },
          { content: "Local Spare\nPurch. Rate", rowSpan: 2 },
          { content: "Hotel\nBill", rowSpan: 2 },
          { content: "Other Expenses", colSpan: 2 },
          { content: "Total\n(Rs.)", rowSpan: 2 },
          { content: "Remarks /\nPurpose", rowSpan: 2 },
          { content: "Ticket No. /\nMPT ID", rowSpan: 2 },
          { content: "PMS /\nCalib.", rowSpan: 2 },
          { content: "Calls\n(Done/Assign)", rowSpan: 2 }
        ],
        ["From", "To", "Description", "Amount"]
      ],
      body: tableBody,
      foot: isLastPage ? footRows : undefined,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        minCellHeight: 5.4,
        halign: "center",
        valign: "middle",
        lineColor: [71, 85, 105],
        lineWidth: 0.15,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 6.8,
        cellPadding: 1.8
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 19 },
        2: { cellWidth: 19 },
        3: { cellWidth: 16 },
        4: { cellWidth: 8, fontStyle: "bold" },
        5: { cellWidth: 12 },
        6: { cellWidth: 15 },
        7: { cellWidth: 13 },
        8: { cellWidth: 16 }, // D.A. column: 16mm (Fits 2750.00 cleanly)
        9: { cellWidth: 13 },
        10: { cellWidth: 16 }, // Hotel column: 16mm (Fits 9200.00 cleanly)
        11: { cellWidth: 19 },
        12: { cellWidth: 13 },
        13: { cellWidth: 21, fontStyle: "bold" }, // Total column: 21mm (Fits 19155.00 cleanly)
        14: { cellWidth: 35 },
        15: { cellWidth: 14, fontStyle: "bold" },
        16: { cellWidth: 11 },
        17: { cellWidth: 12 }
        // Total sum = 15+19+19+16+8+12+15+13+16+13+16+19+13+21+35+14+11+12 = 287mm!
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 140;

    if (isLastPage) {
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.15);

      // 1. Amount in words box (Direct continuous attachment at finalY)
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, finalY, tableWidth, 5.5, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Amount in words: ${amountWords(gTotal - advance).toUpperCase()}`, pageWidth / 2, finalY + 3.8, { align: "center" });

      // 2. Remarks Box (Direct continuous attachment at finalY + 5.5)
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, finalY + 5.5, tableWidth, 5.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.text(
        `REMARKS: AUDITED BY: ${coordinatorName.toUpperCase()} | APPROVED BY: ${managerName.toUpperCase()}`,
        pageWidth / 2,
        finalY + 9.3,
        { align: "center" }
      );

      // 3. Signature Table Box (Direct continuous attachment at finalY + 11)
      const sigY = finalY + 11;
      const sigH = 14;
      const colW = tableWidth / 4;

      doc.setFillColor(255, 255, 255);
      doc.rect(margin, sigY, tableWidth, sigH, "FD");

      const sigs = [
        { label: "Claimed By:", name: user.name || "" },
        { label: "Approved By (Manager):", name: managerName },
        { label: "Audited By (Coordinator):", name: coordinatorName },
        { label: "Accounted By:", name: "Amit Rawat" }
      ];

      const todayStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

      sigs.forEach((sig, sIdx) => {
        const x = margin + sIdx * colW;
        if (sIdx > 0) {
          doc.line(x, sigY, x, sigY + sigH);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.text(sig.label, x + colW / 2, sigY + 3.8, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.text(sig.name, x + colW / 2, sigY + 7.8, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.text(`Date: ${todayStr}`, x + colW / 2, sigY + 11.8, { align: "center" });
      });
    }
  }

  // 4. Attachments (Dedicated 1 page per unique bill attachment)
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (let aIdx = 0; aIdx < attachments.length; aIdx++) {
      const att = attachments[aIdx];
      const imgData = att.file_url || att.url || "";
      if (!imgData) continue;

      doc.addPage("a4", "landscape");

      // Banner
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, 5, tableWidth, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      const attDate = att.date ? fmtDate(att.date) : `Receipt #${aIdx + 1}`;
      const attLabel = att.bill_type || att.billType || "Expense Bill";
      doc.text(
        `VERIFIED BILL RECEIPT — ${attLabel.toUpperCase()} — ${attDate} (BILL ${aIdx + 1} OF ${attachments.length})`,
        pageWidth / 2,
        10.5,
        { align: "center" }
      );

      // Embed Image
      try {
        doc.addImage(imgData, "JPEG", 15, 16, pageWidth - 30, pageHeight - 22, undefined, "FAST");
      } catch (imgErr) {
        console.warn("Direct image embed fallback:", imgErr);
      }
    }
  }

  return doc.output("blob");
}
