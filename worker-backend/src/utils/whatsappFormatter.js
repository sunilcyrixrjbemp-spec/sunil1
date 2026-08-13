/**
 * whatsappFormatter.js
 * Standardized WhatsApp Message Formatter for Cyrix Field Connect
 * Matches ClaimDetailsModal layout 1-to-1 with executive breakdown & direct action links.
 */

export function formatClaimSubmissionWhatsAppMessage(claimData, user) {
  const code = claimData.expense_code || "N/A";
  const empName = user.name || "Employee";
  const eCode = user.e_code || user.user_id || "N/A";
  const dateStr = claimData.expense_date || new Date().toISOString().split("T")[0];
  
  const legs = Array.isArray(claimData.itineraries) ? claimData.itineraries : [];
  const totalAmount = parseFloat(claimData.total_amount || 0).toFixed(2);
  const totalKm = legs.reduce((sum, l) => sum + parseFloat(l.km || l.distance_km || 0), 0).toFixed(1);
  
  let legsFormatted = "";
  legs.forEach((leg, idx) => {
    const fromLoc = leg.from || leg.from_location || "N/A";
    const toLoc = leg.to || leg.to_location || "N/A";
    const mode = leg.mode || leg.travel_mode || "Travel";
    const km = parseFloat(leg.km || leg.distance_km || 0).toFixed(1);
    const ta = parseFloat(leg.amount || leg.travel_amount || 0).toFixed(2);
    const da = parseFloat(leg.da || leg.da_amount || 0).toFixed(2);
    
    legsFormatted += `\n• *Leg #${idx + 1}:* ${fromLoc} ➔ ${toLoc}\n  ↳ Mode: ${mode} | ${km} KM | TA: ₹${ta}${parseFloat(da) > 0 ? ` | DA: ₹${da}` : ""}`;
  });

  const reviewLink = `https://indrae.in/#/approval-center?expense_id=${claimData.expense_id || claimData.id}&claim_code=${code}`;

  return `📋 *CYRIX FIELD CONNECT — CLAIM SUBMITTED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Employee:* ${empName} (${eCode})
📜 *Claim Code:* ${code}
📅 *Travel Date:* ${dateStr}

💰 *EXECUTIVE AMOUNT BREAKDOWN:*
• *Total Claimed Amount:* ₹${totalAmount}
• *Total Distance:* ${totalKm} KM
• *Total Visits:* ${legs.length} Legs

🗺️ *ITINERARY ROUTE DETAILS:*${legsFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍💼 *DIRECT MANAGER ACTION:*
Click link below to view full claim details, photos & approve/reject:
🔗 ${reviewLink}`;
}

export function formatClaimApprovedWhatsAppMessage(claimData, approverUser) {
  const code = claimData.expense_code || "N/A";
  const totalAmount = parseFloat(claimData.total_amount || claimData.amount || 0).toFixed(2);
  const approverName = approverUser?.name || "Manager";
  const dateStr = new Date().toISOString().split("T")[0];

  const viewLink = `https://indrae.in/#/home?claim_code=${code}`;

  return `✅ *CYRIX FIELD CONNECT — CLAIM APPROVED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your expense claim has been successfully approved!

📜 *Claim Code:* ${code}
💰 *Approved Amount:* ₹${totalAmount}
👨‍💼 *Approved By:* ${approverName}
📅 *Date:* ${dateStr}
🔄 *Status:* Approved (Final)

🔗 *View Claim Summary:* ${viewLink}`;
}

export function formatClaimRejectedWhatsAppMessage(claimData, approverUser, reason) {
  const code = claimData.expense_code || "N/A";
  const totalAmount = parseFloat(claimData.total_amount || claimData.amount || 0).toFixed(2);
  const approverName = approverUser?.name || "Manager";

  const viewLink = `https://indrae.in/#/home?claim_code=${code}`;

  return `❌ *CYRIX FIELD CONNECT — CLAIM REJECTED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your expense claim has been rejected by manager.

📜 *Claim Code:* ${code}
💰 *Claim Amount:* ₹${totalAmount}
👨‍💼 *Action By:* ${approverName}
⚠️ *Rejection Remark:* "${reason || 'Policy discrepancy'}"

🔗 *Review Details:* ${viewLink}`;
}
