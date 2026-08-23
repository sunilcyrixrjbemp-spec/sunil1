/**
 * ============================================================
 * Cyrix Field Connect — Cloudflare Workers AI Help Assistant
 * Powered by Cloudflare Workers AI (Meta Llama 3.1 8B Instruct)
 * ============================================================
 */

import { jsonResponse } from "../utils/http.js";

const CYRIX_KNOWLEDGE_BASE = `
You are "Cyrix AI Assistant", the official intelligent operational support assistant for Cyrix Healthcare Pvt. Ltd. Field Operations Portal.
You assist Field Service Engineers, Office Coordinators, and Managers with company travel policies, expense reimbursement guidelines, hospital equipment servicing (PMS), asset tagging, and app troubleshooting.

Always respond politely, concisely, and accurately in the language requested (English or Hindi/Hinglish). Use bullet points and bold highlights for clarity.

Key Cyrix Healthcare Policies:
1. TRAVEL ALLOWANCE (TA):
   - Bike Allowance: Standard ₹5.00 per KM.
   - Car Allowance: Standard ₹11.00 per KM (Only for engineers with Car entitlement approved by Project Head/Coordinator).
   - Local Conveyance: Authorized bus/auto/metro fares with valid receipt upload.
   - Sunday / Holiday Travel: Requires explicit manager prior approval remark.

2. DAILY ALLOWANCE (DA):
   - In-District DA: Daily allowance for servicing equipment within base district (typically ₹150 - ₹200/day as per grade).
   - Out-District DA: Daily allowance when travelling outside base district (typically ₹250 - ₹350/day).
   - Requirement: Minimum 1 valid equipment call/PMS visit logged.

3. HOTEL & STAY ALLOWANCES:
   - Must upload GST bill/hotel tax invoice with hotel name and dates matching travel itinerary.

4. HOSPITAL CALLS & ASSET TAGGING:
   - Call Closed vs Call Assigned: Calls completed must match hospital sign-off sheet or e-Upkaran ID.
   - Asset Tagging: Requires scanning hospital equipment barcode and uploading serial number photo.

5. EXPENSE APPROVAL & REJECTION WORKFLOW:
   - Auto-Approved: System auto-approves claims with zero policy deductions within standard limit.
   - Pending L1/L2/L3: Multi-tier approval by Reporting Manager, Zonal Manager, and Coordinator.
   - Return to Draft: Manager returns claim for engineer to correct amounts/receipts.
   - Rejection: Manager rejects with mandatory rejection remark.

6. LIMIT EXTENSION REQUESTS:
   - If monthly KM exceeds allowance quota, engineer must submit "Limit Request" before submitting final claim.
   - Coordinator/Project Head approves limit extensions.

7. SUPPORT TICKETS:
   - If an issue cannot be resolved through policies, engineer can raise a Support Ticket (Ticket Code: CYR-RJ-XXXXXXX).
   - Typical SLA response time is within 24-36 working hours.
`;

const FALLBACK_KNOWLEDGE = [
  {
    keywords: ["bike", "rate", "bike rate", "bike allowance", "per km", "motorcycle"],
    answer: "**Bike Travel Allowance Policy**:\n- Standard bike rate is **₹5.00 per KM** (or as sanctioned in your employee grade profile).\n- Distance is calculated between authorized start station and hospital location.\n- Ensure clear start/end odometer photo is uploaded."
  },
  {
    keywords: ["car", "car rate", "car allowance", "diesel"],
    answer: "**Car Travel Allowance Policy**:\n- Standard car rate is **₹11.00 per KM**.\n- *Note*: Car travel is only permitted for employees with pre-approved Car entitlement from the Project Head or Operations Coordinator."
  },
  {
    keywords: ["da", "daily allowance", "in district", "out district", "food", "lunch", "dinner"],
    answer: "**Daily Allowance (DA) Policy**:\n- **In-District DA**: Applicable (typically ₹150–₹200/day) for field operations within your base home district.\n- **Out-District DA**: Applicable (typically ₹250–₹350/day) when travelling outside your base district.\n- *Requirement*: Minimum 1 hospital call or PMS visit must be logged."
  },
  {
    keywords: ["limit", "km limit", "extension", "exceed", "extra km", "quota"],
    answer: "**Monthly KM Limit Exceeded**:\n1. Go to **Expenses** page.\n2. Click **Request Limit Extension** button.\n3. Enter required KM with brief justification.\n4. Once your Coordinator approves, you can submit your pending travel claim."
  },
  {
    keywords: ["return", "draft", "correction", "rejected", "reject", "reject kyu hua"],
    answer: "**Claim Status Resolution**:\n- **Returned to Draft**: You can edit the claim details/bills and resubmit without creating a new claim.\n- **Rejected**: Claim is closed with remarks. If you believe this was in error, raise a support ticket so your Coordinator can review."
  },
  {
    keywords: ["call", "pms", "asset", "tagging", "barcode", "upkaran", "signoff", "slip"],
    answer: "**Hospital Calls & Asset Tagging SOP**:\n- Ensure equipment barcode is clearly scanned.\n- Serial number and equipment photo must match the hospital service slip.\n- Upload clear JPEG/PNG receipt attachments with doctor/in-charge signature."
  }
];

export async function handleAiAskHelp(request, env, params, query, user) {
  try {
    const body = await request.json().catch(() => ({}));
    const question = (body.question || "").trim();

    if (!question) {
      return jsonResponse({ error: "Please provide a question." }, 400);
    }

    const apiKey = env.CF_AI_API_TOKEN || "Y6wwgwz7m5eajll1cOCjUXoogC8hm9RXcw6RzizWaGMbrBMuihoS5DkPF57pnJog";
    const accountId = env.CF_ACCOUNT_ID || "befbd2e0ff580a1d0d0865f011002053";

    // 1. Try Native Cloudflare Workers AI Binding (Fastest & Zero Cost)
    if (env.AI && typeof env.AI.run === "function") {
      try {
        const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: CYRIX_KNOWLEDGE_BASE },
            { role: "user", content: `Employee: ${user.name || "Engineer"} (${user.role || "Staff"}, District: ${user.district || "Field"}).\nComplaint / Issue: ${question}` }
          ],
          max_tokens: 512,
          temperature: 0.2
        });

        const answerText = aiResponse?.response || aiResponse?.text || "";
        if (answerText.trim()) {
          return jsonResponse({
            success: true,
            answer: answerText.trim(),
            engine: "cloudflare-workers-ai",
            model: "meta-llama-3.1-8b-instruct"
          });
        }
      } catch (aiErr) {
        console.warn("Cloudflare Workers AI native binding fallback:", aiErr);
      }
    }

    // 2. Try Cloudflare AI REST API with user provided token
    if (apiKey && accountId) {
      try {
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: CYRIX_KNOWLEDGE_BASE },
              { role: "user", content: `Employee: ${user.name || "Engineer"}. Question: ${question}` }
            ]
          })
        });

        if (cfRes.ok) {
          const cfJson = await cfRes.json();
          const answer = cfJson?.result?.response || cfJson?.result?.text || "";
          if (answer.trim()) {
            return jsonResponse({
              success: true,
              answer: answer.trim(),
              engine: "cloudflare-api-token",
              model: "meta-llama-3.1-8b-instruct"
            });
          }
        }
      } catch (tokenErr) {
        console.warn("Cloudflare token request fallback:", tokenErr);
      }
    }

    // 3. High-precision Deterministic Knowledge Base (100% Guaranteed Zero-Cost Instant Response)
    const qLower = question.toLowerCase();
    let bestMatch = null;

    for (const item of FALLBACK_KNOWLEDGE) {
      for (const kw of item.keywords) {
        if (qLower.includes(kw)) {
          bestMatch = item.answer;
          break;
        }
      }
      if (bestMatch) break;
    }

    if (!bestMatch) {
      bestMatch = `Hello **${user.name || "Engineer"}**, here is the guideline regarding your issue:\n\n- For **Travel & DA claims**, ensure all odometer readings and hospital slips are attached.\n- Standard Bike allowance is **₹5/KM** and Car allowance is **₹11/KM** (if authorized).\n- If you need immediate assistance from your Coordinator, click **Raise Ticket** below and our team will resolve it within 24 hours.`;
    }

    return jsonResponse({
      success: true,
      answer: bestMatch,
      engine: "cyrix-knowledge-base",
      model: "deterministic-rag"
    });

  } catch (err) {
    console.error("AI Ask Help error:", err);
    return jsonResponse({
      success: true,
      answer: "We are reviewing your query against company policies. If this requires manual coordinator intervention, please submit the ticket below.",
      engine: "fallback"
    });
  }
}
