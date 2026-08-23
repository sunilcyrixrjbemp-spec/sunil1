/**
 * Cyrix Healthcare — Server-side Reimbursement PDF Template Builder
 * Pure JavaScript utility producing clean Chromium-compliant print HTML/CSS.
 */

function numberToWords(num) {
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

function amountWords(amount) {
  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);
  let w = (amount < 0 ? "Negative " : "") + "Rupees " + numberToWords(rupees);
  if (paise > 0) w += " And " + numberToWords(paise) + " Paise";
  return w + " Only";
}

function fmtDate(d) {
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

export function buildServerExcelPrintHTML(user, claims = [], attachments = [], advance = 0) {
  const allLegs = [];
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
      
      // If total approved amount for this leg is 0, do not show in PDF table
      if (legTotal <= 0) {
        continue;
      }

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

  const getFormattedPurpose = (l) => {
    const parts = [];
    let acts = [];
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
      acts = clean.split(",").map((s) => s.trim());
    }

    const finalActs = Array.isArray(acts) ? acts : [];
    finalActs.forEach((act) => {
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

    if (parts.length === 0) {
      const cleanPurpose = l.visit_purpose && !visitPurposeStr.startsWith("Activities:") ? visitPurposeStr : "Field visit";
      if (l.other_desc && cleanPurpose.trim() === l.other_desc.trim()) return "Field visit";
      return cleanPurpose;
    }
    return parts.join(", ");
  };

  const getActivityOtherDesc = (l) => l.other_desc || "";

  const modeAbbr = (m) => {
    if (!m) return "";
    const map = {
      "Train": "T", "Bus": "B", "Bike": "Bi", "Car": "C", "Auto": "A",
      "train": "T", "bus": "B", "bike": "Bi", "car": "C", "auto": "A",
    };
    return map[m] || m;
  };

  const getCleanTicketNumber = (l) => {
    const raw = String(l.complaint_id || l.ticket_no || l.ticket_id || l.mpt_id || "").trim();
    if (!raw || raw === "—" || raw === "-" || raw.toLowerCase().includes("barcode")) return "";
    return raw.replace(/barcode[:\\s]*/gi, "").trim();
  };

  const isCallOrPmsReport = (label = "", billType = "") => {
    const l = (label || "").toLowerCase();
    const b = (billType || "").toLowerCase();
    if (l.includes("hotel") || l.includes("purchase") || l.includes("ticket") || l.includes("receipt") || l.includes("bill") || l.includes("fare") || l.includes("travel")) {
      return false;
    }
    return l.includes("pms report") || l.includes("service report sheet") || l.includes("breakdown call report") ||
           b.includes("pms_report") || b.includes("service_report_sheet") || b === "service_report";
  };

  const getBillFingerprint = (urlStr) => {
    if (!urlStr) return "";
    if (urlStr.startsWith("data:")) return urlStr.slice(0, 150);
    const clean = urlStr.split("?")[0].replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").toLowerCase();
    const filename = clean.split("/").pop() || clean;
    return filename.replace(/\.[^/.]+$/, "").trim();
  };

  const allAttachmentsMap = new Map();
  const seenFingerprints = new Set();

  (attachments || []).forEach((att, idx) => {
    const rawUrl = att.file_url || att.url || (typeof att === "string" ? att : "");
    const origUrl = att.original_url || rawUrl;
    const fp = getBillFingerprint(origUrl) || getBillFingerprint(rawUrl);
    const label = att.bill_type || att.billType || "Expense Bill";

    if (rawUrl && fp && !isCallOrPmsReport(label, att.bill_type) && !seenFingerprints.has(fp)) {
      seenFingerprints.add(fp);
      allAttachmentsMap.set(fp, {
        url: rawUrl,
        date: att.date ? fmtDate(att.date) : `Bill #${idx + 1}`,
        label: label
      });
    }
  });

  (claims || []).forEach((claim) => {
    const claimDate = claim.date ? fmtDate(claim.date) : "";
    const claimAtts = [
      ...(Array.isArray(claim.attachments) ? claim.attachments : []),
      ...(Array.isArray(claim.attachments_detailed) ? claim.attachments_detailed : []),
      ...(Array.isArray(claim.attachment_urls) ? claim.attachment_urls : []),
      ...(typeof claim.attachments === "string" ? (() => { try { return JSON.parse(claim.attachments); } catch { return [claim.attachments]; } })() : [])
    ];

    claimAtts.forEach((cItem, cIdx) => {
      const cUrl = typeof cItem === "string" ? cItem : (cItem.file_url || cItem.url);
      const fp = getBillFingerprint(cUrl);
      const label = (typeof cItem === "object" && (cItem.bill_type || cItem.billType)) ? (cItem.bill_type || cItem.billType) : `Claim Attachment #${cIdx + 1}`;
      if (cUrl && fp && !isCallOrPmsReport(label, (cItem.bill_type || "")) && !seenFingerprints.has(fp)) {
        seenFingerprints.add(fp);
        allAttachmentsMap.set(fp, { url: cUrl, date: claimDate, label: label });
      }
    });

    (claim.legs || []).forEach((leg) => {
      const candidateFields = [
        { key: "hotel_receipt", label: "Hotel Bill Receipt" },
        { key: "local_purchase_bill", label: "Local Purchase Bill" },
        { key: "other_bill", label: "Other Expense Bill" },
        { key: "receipt_url", label: "Travel / Bill Receipt" },
        { key: "bill_url", label: "Travel Ticket" },
        { key: "attachment_url", label: "Expense Bill Attachment" },
        { key: "file_url", label: "Expense Bill Attachment" },
        { key: "bill_copy", label: "Expense Bill Copy" },
        { key: "receipt", label: "Bill Receipt" },
        { key: "ticket_attachment", label: "Train / Bus Ticket" },
        { key: "main_bill_file", label: "Travel Ticket Receipt" },
        { key: "sub_bill_file", label: "Sub-connection Ticket" },
        { key: "hotel_bill_file", label: "Hotel Bill" },
        { key: "lp_bill_file", label: "Local Purchase Bill" },
        { key: "oth_bill_file", label: "Other Expense Bill" },
        { key: "other_attachment", label: "Other Bill Attachment" }
      ];

      candidateFields.forEach(field => {
        const u = leg[field.key];
        const fp = getBillFingerprint(u);
        if (u && fp && !isCallOrPmsReport(field.label, "") && !seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          allAttachmentsMap.set(fp, { url: u, date: claimDate, label: field.label });
        }
      });

      if (Array.isArray(leg.attachments)) {
        leg.attachments.forEach((aItem, aIdx) => {
          const aUrl = typeof aItem === "string" ? aItem : (aItem.file_url || aItem.url);
          const fp = getBillFingerprint(aUrl);
          const label = aItem.bill_type || `Bill Attachment #${aIdx + 1}`;
          if (aUrl && fp && !isCallOrPmsReport(label, aItem.bill_type || "") && !seenFingerprints.has(fp)) {
            seenFingerprints.add(fp);
            allAttachmentsMap.set(fp, { url: aUrl, date: claimDate, label: label });
          }
        });
      }
    });
  });

  const finalAttachments = Array.from(allAttachmentsMap.values());

  // ── 1 DEDICATED FULL A4 PAGE PER UNIQUE BILL ATTACHMENT ──
  let attachmentsSection = "";
  if (finalAttachments.length > 0) {
    const totalAtts = finalAttachments.length;
    attachmentsSection = finalAttachments.map((att, idx) => {
      const absoluteUrl = att.url;
      const dateStr = att.date || `Receipt #${idx + 1}`;
      const attLabel = att.label || "Expense Bill";

      return `
        <div class="attachment-page" style="page-break-before:always;display:flex;flex-direction:column;width:100%;height:100vh;box-sizing:border-box;padding:4mm;">
          <div style="background:#1E293B;color:#fff;padding:4px 12px;font-size:9pt;font-weight:bold;font-family:'Aptos','Segoe UI',Calibri,sans-serif;text-align:center;text-transform:uppercase;margin-bottom:6px;border-radius:3px;letter-spacing:0.5px;">
            VERIFIED BILL RECEIPT &mdash; ${attLabel} &mdash; ${dateStr} (BILL ${idx + 1} OF ${totalAtts})
          </div>
          <div style="flex:1;width:100%;display:flex;align-items:center;justify-content:center;border:1px solid #475569;border-radius:4px;padding:6px;background:#fff;overflow:hidden;box-sizing:border-box;">
            <img src="${absoluteUrl}" style="max-width:100%;max-height:92vh;object-fit:contain;display:block;margin:0 auto;" alt="Bill ${dateStr}" />
          </div>
        </div>
      `;
    }).join("\\n");
  }

  // ── Multi-page Table Split (12 rows per page to prevent any footer or signature cut-off) ──
  const ROWS_PER_PAGE = 10;
  const numPages = Math.max(1, Math.ceil(allLegs.length / ROWS_PER_PAGE));

  let summaryPagesHtml = "";
  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const isLastPage = pageIdx === numPages - 1;
    const pageLegs = allLegs.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);

    const pageRowsHtml = pageLegs.map((r, i) => {
      const l = r.leg || {};
      const taCol   = l.ta_amount || 0;
      const bikeCarAmt = (l.bike_amount || 0) + (l.car_amount || 0);
      const rowTotal = taCol + bikeCarAmt + (l.auto_amount || 0) + (l.da_amount || 0)
                     + (l.local_purchase || 0) + (l.hotel_amount || 0) + (l.other_amount || 0);
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const c = `border:1px solid #475569!important;padding:5px 3px;font-size:7.5pt;font-weight:600;color:#0f172a;vertical-align:middle!important;text-align:center!important;line-height:1.2;font-family:'Aptos','Segoe UI',Calibri,sans-serif;`;
      const pmsCalibCount = (l.pms_count || 0) + (l.calibration_count || 0);
      const ticketNo = getCleanTicketNumber(l);

      return `<tr style="background:${bg}!important;height:22px;">
        <td style="${c}">${fmtDate(r.date)}</td>
        <td style="${c}">${l.from_location || ""}</td>
        <td style="${c}">${l.to_location || ""}</td>
        <td style="${c}">${l.worked_district || ""}</td>
        <td style="${c}font-weight:700;">${modeAbbr(l.travel_mode)}</td>
        <td style="${c}">${l.distance_km > 0 ? l.distance_km.toFixed(1) : ""}</td>
        <td style="${c}">${taCol > 0 ? taCol.toFixed(2) : ""}</td>
        <td style="${c}">${l.auto_amount > 0 ? l.auto_amount.toFixed(2) : ""}</td>
        <td style="${c}">${l.da_amount > 0 ? l.da_amount.toFixed(2) : ""}</td>
        <td style="${c}">${l.local_purchase > 0 ? l.local_purchase.toFixed(2) : ""}</td>
        <td style="${c}">${l.hotel_amount > 0 ? l.hotel_amount.toFixed(2) : ""}</td>
        <td style="${c}">${getActivityOtherDesc(l) || ""}</td>
        <td style="${c}">${l.other_amount > 0 ? l.other_amount.toFixed(2) : ""}</td>
        <td style="${c}font-weight:800;background:#ecfdf5!important;color:#065f46;white-space:nowrap!important;">${rowTotal > 0 ? rowTotal.toFixed(2) : ""}</td>
        <td style="${c};text-align:center!important;word-break:break-word;font-size:7pt;">${getFormattedPurpose(l) || ""}</td>
        <td style="${c}font-weight:bold;color:#1e293b;">${ticketNo || ""}</td>
        <td style="${c}">${pmsCalibCount > 0 ? String(pmsCalibCount) : ""}</td>
        <td style="${c}">${(l.calls_completed > 0 || l.calls_assigned > 0) ? `${l.calls_completed}/${l.calls_assigned}` : ""}</td>
      </tr>`;
    }).join("\\n");

    summaryPagesHtml += `
    <div class="summary-page wrap" style="width:100%;box-sizing:border-box;page-break-after:always;">
      <table style="margin-bottom:0;width:100%;">
        <colgroup><col style="width:12%;"><col style="width:68%;"><col style="width:20%;"></colgroup>
        <tr>
          <td style="background:#fff!important;border:1.5px solid #1E293B;padding:2px;text-align:center;vertical-align:middle;height:32px;">
            <div style="font-weight:900;color:#1E293B;font-size:10pt;">CYRIX</div>
          </td>
          <td class="main-hdr">
            CYRIX HEALTHCARE &mdash; EXPENSES REIMBURSEMENT FORM ${numPages > 1 ? `(PAGE ${pageIdx + 1} OF ${numPages})` : ""}
          </td>
          <td style="background:#1E293B!important;color:#fff!important;border:1.5px solid #1E293B;padding:2px 6px;font-size:7.5pt;font-weight:bold;text-align:center;vertical-align:middle;font-family:'Aptos','Segoe UI',Calibri,sans-serif;">
            <div>PERIOD: ${(user.month || "MONTH").toUpperCase().substring(0,3)} ${user.year || "2026"}</div>
          </td>
        </tr>
      </table>

      <table class="info-tbl" style="width:100%;">
        <colgroup><col style="width:7%;"><col style="width:23%;"><col style="width:8%;"><col style="width:12%;"><col style="width:8%;"><col style="width:12%;"><col style="width:10%;"><col style="width:20%;"></colgroup>
        <tr>
          <td class="info-lbl">NAME :</td><td class="info-val">${user.name || ""}</td>
          <td class="info-lbl">EE CODE:</td><td class="info-val">${user.e_code || ""}</td>
          <td class="info-lbl">PROJECT:</td><td class="info-val">RJBEMP</td>
          <td class="info-lbl">LOCATION:</td><td class="info-val" style="border-right:none;">${(user.district || "").toUpperCase()}</td>
        </tr>
      </table>

      <table style="margin-bottom:0;width:100%;border-top:none;border-bottom:none;">
        <colgroup>
          <col style="width:5%;">
          <col style="width:7%;">
          <col style="width:7%;">
          <col style="width:5.5%;">
          <col style="width:3.5%;">
          <col style="width:4%;">
          <col style="width:4.5%;">
          <col style="width:4%;">
          <col style="width:4%;">
          <col style="width:4.5%;">
          <col style="width:4.5%;">
          <col style="width:6.5%;">
          <col style="width:4.5%;">
          <col style="width:6.5%;">
          <col style="width:10%;">
          <col style="width:5%;">
          <col style="width:4%;">
          <col style="width:4%;">
        </colgroup>
        <thead>
          <tr>
            <th class="col-h1" rowspan="2">Date<br>(DD-MM-YY)</th>
            <th class="col-h1" colspan="2">Locations</th>
            <th class="col-h1" rowspan="2">Worked<br>District</th>
            <th class="col-h1" rowspan="2">Mode<br>(T/B/Bi/C)</th>
            <th class="col-h1" rowspan="2">Dist.<br>(KM)</th>
            <th class="col-h1" rowspan="2">Train/Bus<br>Fare (TA)</th>
            <th class="col-h1" rowspan="2">Auto<br>Fare</th>
            <th class="col-h1" rowspan="2">D.A.</th>
            <th class="col-h1" rowspan="2">Local Spare<br>Purch. Rate</th>
            <th class="col-h1" rowspan="2">Hotel<br>Bill</th>
            <th class="col-h1" colspan="2">Other Expenses</th>
            <th class="col-h1" rowspan="2">Total<br>(₹)</th>
            <th class="col-h1" rowspan="2">Remarks /<br>Purpose</th>
            <th class="col-h1" rowspan="2">Ticket No. /<br>MPT ID</th>
            <th class="col-h1" rowspan="2">PMS /<br>Calib.</th>
            <th class="col-h1" rowspan="2">Calls<br>(Done/Assign)</th>
          </tr>
          <tr>
            <th class="col-h2">From</th>
            <th class="col-h2">To</th>
            <th class="col-h2">Description</th>
            <th class="col-h2">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${pageRowsHtml || `<tr><td colspan="18" style="text-align:center;padding:12px;color:#888;font-style:italic;font-size:7.5pt;">No expense records found.</td></tr>`}
        </tbody>
        ${isLastPage ? `
        <tfoot>
          <tr style="background:#FEF3C7!important;height:22px;">
            <td class="tot-lbl" colspan="5" style="text-align:center;border:1.5px solid #1E293B!important;text-transform:uppercase;background:#FEF3C7!important;font-weight:bold;vertical-align:middle;line-height:1.2;padding:5px 3px;">
              TOTAL EXPENSE CLAIMED
            </td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gKM > 0 ? gKM.toFixed(1) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gTA > 0 ? gTA.toFixed(2) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gAuto > 0 ? gAuto.toFixed(2) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gDA > 0 ? gDA.toFixed(2) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gLocal > 0 ? gLocal.toFixed(2) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gHotel > 0 ? gHotel.toFixed(2) : ""}</td>
            <td class="tot-lbl" style="text-align:center;font-size:7pt;border:1.5px solid #1E293B!important;vertical-align:middle;line-height:1.2;padding:5px 3px;">Total</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gOther > 0 ? gOther.toFixed(2) : ""}</td>
            <td class="tot-num" style="background:#FEF3C7!important;font-weight:bold;text-align:center;border:1.5px solid #1E293B!important;color:#0f172a;vertical-align:middle;line-height:1.2;padding:5px 3px;white-space:nowrap!important;">₹${gTotal.toFixed(2)}</td>
            <td class="tot-lbl" style="border:1.5px solid #1E293B!important;vertical-align:middle;line-height:1.2;padding:5px 3px;"></td>
            <td class="tot-lbl" style="border:1.5px solid #1E293B!important;font-size:6.5pt!important;text-align:center;font-weight:bold;vertical-align:middle;line-height:1.2;padding:5px 3px;">
              ${gAssetQty > 0 ? `Qty: ${gAssetQty} | ₹${gAssetVal.toLocaleString('en-IN')}` : ""}
            </td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;font-weight:bold;vertical-align:middle;line-height:1.2;padding:5px 3px;">${gPMSCalib > 0 ? String(gPMSCalib) : ""}</td>
            <td class="tot-num" style="border:1.5px solid #1E293B!important;text-align:center;font-weight:bold;vertical-align:middle;line-height:1.2;padding:5px 3px;">${(gCallsC > 0 || gCallsA > 0) ? `${gCallsC}/${gCallsA}` : ""}</td>
          </tr>
          <tr style="height:20px;">
            <td colspan="13" style="border:1.5px solid #1E293B!important;background:#fff!important;font-weight:bold;text-align:center;padding:2px 4px;font-size:7pt;text-transform:uppercase;font-family:'Aptos','Segoe UI',Calibri,sans-serif;vertical-align:middle;line-height:1.2;">LESS: MONTHLY ADVANCE DEDUCTION</td>
            <td style="border:1.5px solid #1E293B!important;background:#fff!important;font-weight:bold;text-align:center;font-size:7.5pt!important;color:#b91c1c;vertical-align:middle;line-height:1.2;white-space:nowrap!important;">₹${advance > 0 ? Math.round(advance).toFixed(2) : "0.00"}</td>
            <td colspan="4" style="border:1.5px solid #1E293B!important;background:#fff!important;"></td>
          </tr>
          <tr style="background:#F1F5F9!important;height:20px;">
            <td class="net-lbl" colspan="13" style="border:1.5px solid #1E293B!important;background:#F1F5F9!important;color:#0f172a;font-size:7.5pt;font-weight:bold;vertical-align:middle;line-height:1.2;">NET PAYABLE AMOUNT</td>
            <td class="net-val" style="font-weight:900;font-size:8pt!important;border:1.5px solid #1E293B!important;background:#F1F5F9!important;color:#0f172a;text-align:center;vertical-align:middle;line-height:1.2;white-space:nowrap!important;">₹${Math.round(gTotal - advance).toFixed(2)}</td>
            <td colspan="4" style="border:1.5px solid #1E293B!important;background:#F1F5F9!important;"></td>
          </tr>
        </tfoot>
        ` : ""}
      </table>

      ${isLastPage ? `
        <div class="awords-box" style="padding:2.5px 5px;font-size:6.5pt;line-height:1.2;">Amount in words: <strong style="color:#0f172a;">${amountWords(gTotal - advance).toUpperCase()}</strong></div>
        <div class="remarks-box" style="padding:2px 5px;font-size:6.5pt;line-height:1.2;">REMARKS: AUDITED &amp; APPROVED BY CYRIX MANAGEMENT</div>
        <table class="sig-tbl" style="width:100%;margin-top:0;">
          <colgroup><col style="width:25%;"><col style="width:25%;"><col style="width:25%;"><col style="width:25%;"></colgroup>
          <tr>
            <td class="sig-lbl">Claimed By:<br><strong>${user.name || ""}</strong></td>
            <td class="sig-lbl">Approved By (Manager):<br><strong>${user.manager || ""}</strong></td>
            <td class="sig-lbl">Checked By (Coordinator):<br><strong>${user.coordinator || ""}</strong></td>
            <td class="sig-lbl" style="border-right:none;">Accounted By:<br><strong>Amit Rawat</strong></td>
          </tr>
          <tr>
            <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
            <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
            <td class="sig-val">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
            <td class="sig-val" style="border-right:none;">Date: ${new Date().toLocaleDateString("en-IN", {timeZone: "Asia/Kolkata"})}</td>
          </tr>
        </table>
      ` : `
        <div style="font-size:7pt;font-weight:bold;text-align:center;padding:3px;color:#444;font-style:italic;">
          Summary continued on Page ${pageIdx + 2} of ${numPages} ...
        </div>
      `}
    </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Expense Form — ${user.name} — ${user.month} ${user.year}</title>
  <style>
    * { -webkit-print-color-adjust: exact!important; print-color-adjust: exact!important; box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Aptos', 'Segoe UI', Calibri, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 7.5pt; line-height: 1.2; margin: 0; padding: 0; }
    .wrap { width: 100%; padding: 4mm 5mm; background: #fff; line-height: 1.2; box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #475569!important; padding: 3px 2px; vertical-align: middle; text-align: center; word-wrap: break-word; line-height: 1.2; font-family: 'Aptos', 'Segoe UI', Calibri, Arial, sans-serif; }
    tbody tr { page-break-inside: avoid!important; break-inside: avoid!important; }
    .main-hdr { background: #1E293B!important; color: #fff!important; text-align: center; font-size: 10pt!important; font-weight: 800!important; padding: 4px!important; border: 1.5px solid #1E293B!important; letter-spacing: 0.5px; vertical-align: middle; }
    .info-tbl { margin-bottom: 0; border: 1.5px solid #1E293B!important; border-top: none!important; }
    .info-lbl { font-weight: bold; background: #F1F5F9!important; color: #1E293B; border-right: 1px solid #475569!important; font-size: 6.5pt; text-align: center; padding: 2.5px 3px; text-transform: uppercase; white-space: nowrap; vertical-align: middle; }
    .info-val { background: #fff!important; color: #0f172a!important; border-right: 1px solid #475569!important; font-size: 6.5pt; text-align: center; padding: 2.5px 3px; font-weight: bold; vertical-align: middle; }
    .col-h1 { background: #1E293B!important; color: #fff!important; font-size: 6.5pt!important; font-weight: bold!important; text-align: center!important; padding: 3.5px 2px!important; border: 1px solid #475569!important; line-height: 1.15; vertical-align: middle; }
    .col-h2 { background: #334155!important; color: #fff!important; font-size: 6.5pt!important; font-weight: bold!important; text-align: center!important; padding: 3px 2px!important; border: 1px solid #475569!important; line-height: 1.15; vertical-align: middle; }
    .tot-lbl { border: 1.5px solid #1E293B!important; padding: 3px 2px; font-size: 7pt; font-weight: bold; color: #0f172a; background: #FEF3C7!important; vertical-align: middle; text-align: center; line-height: 1.2; }
    .tot-num { border: 1.5px solid #1E293B!important; padding: 3px 2px; font-size: 7pt; font-weight: bold; color: #0f172a; background: #FEF3C7!important; vertical-align: middle; text-align: center; line-height: 1.2; white-space: nowrap!important; }
    .net-lbl { border: 1.5px solid #1E293B!important; padding: 3px 4px; font-size: 7pt; font-weight: bold; color: #0f172a; background: #F1F5F9!important; text-align: center; text-transform: uppercase; vertical-align: middle; line-height: 1.2; }
    .net-val { border: 1.5px solid #1E293B!important; padding: 3px 4px; font-size: 7.5pt; font-weight: 900; color: #0f172a; background: #F1F5F9!important; text-align: center; vertical-align: middle; line-height: 1.2; white-space: nowrap!important; }
    .awords-box { border: 1.5px solid #1E293B!important; border-top: none!important; padding: 2.5px 5px; font-size: 6.5pt; font-weight: 600; color: #0f172a; background: #fff!important; text-align: center; vertical-align: middle; }
    .remarks-box { border: 1.5px solid #1E293B!important; border-top: none!important; padding: 2.5px 5px; font-size: 6.5pt; font-weight: bold; color: #0f172a; background: #F1F5F9!important; text-align: center; vertical-align: middle; }
    .sig-tbl { border: 1.5px solid #1E293B!important; border-top: none!important; }
    .sig-lbl { border-right: 1px solid #475569!important; padding: 2px 4px; font-size: 6.5pt; font-weight: 600; color: #0f172a; background: #fff!important; height: 22px; vertical-align: top; text-align: center; }
    .sig-val { border-right: 1px solid #475569!important; padding: 2px 4px; font-size: 6.5pt; font-weight: 600; color: #475569; background: #fff!important; height: 16px; vertical-align: middle; text-align: center; }
    .attachment-page { page-break-before: always!important; break-before: page!important; height: 100vh!important; page-break-inside: avoid!important; break-inside: avoid!important; overflow: hidden!important; }
    @page { size: A4 landscape; margin: 4mm 5mm; }
    @media print {
      body { margin: 0; padding: 0; }
      .wrap { page-break-after: always; page-break-inside: avoid; }
      tbody tr { page-break-inside: avoid!important; break-inside: avoid!important; }
      .attachment-page { page-break-before: always!important; break-before: page!important; height: 100vh!important; page-break-inside: avoid!important; break-inside: avoid!important; overflow: hidden!important; }
    }
  </style>
</head>
<body>
${summaryPagesHtml}
${attachmentsSection}
</body>
</html>`;
}
