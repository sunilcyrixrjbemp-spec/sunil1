/**
 * ============================================================
 * Cyrix Field Connect — WhatsApp Web Gateway Dispatcher (UltraMsg Engine)
 * ============================================================
 * Dispatches automated messages and claim approval updates via
 * UltraMsg / Baileys Gateway Server.
 */

import { Logger } from "./logger.js";

/**
 * Send WhatsApp text message via UltraMsg / Gateway API
 * @param {object} env - Cloudflare Worker env
 * @param {string} toPhone - 10 digit recipient mobile number
 * @param {string} messageText - Formatted message content
 */
export async function sendWhatsAppMessageViaGateway(env, toPhone, messageText) {
  try {
    let instanceId = env?.ULTRAMSG_INSTANCE_ID || "instance101";
    let token = env?.ULTRAMSG_TOKEN || "token101";

    // Read custom KV config if saved via Admin Console
    if (env?.OTPS_KV) {
      const rawConfig = await env.OTPS_KV.get("whatsapp_gateway_config");
      if (rawConfig) {
        try {
          const cfg = JSON.parse(rawConfig);
          if (cfg.instanceId) instanceId = cfg.instanceId;
          if (cfg.token) token = cfg.token;
        } catch (e) {}
      }
    }

    const cleanPhone = String(toPhone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: "Invalid recipient mobile number" };
    }

    const recipientJid = `91${cleanPhone}`;
    const apiUrl = `https://api.ultramsg.com/${instanceId}/messages/chat`;

    const bodyParams = new URLSearchParams();
    bodyParams.append("token", token);
    bodyParams.append("to", recipientJid);
    bodyParams.append("body", messageText);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString()
    });

    const data = await response.json();
    if (data && (data.sent === "true" || data.id)) {
      Logger.info(`[WHATSAPP DISPATCH SUCCESS] Sent to +91 ${cleanPhone} (ID: ${data.id || data.message})`);
      return { success: true, messageId: data.id || data.message };
    } else {
      Logger.warn(`[WHATSAPP DISPATCH RESPONSE] ${JSON.stringify(data)}`);
      return { success: false, error: data?.error || "Gateway returned error status" };
    }
  } catch (err) {
    Logger.error("[WHATSAPP DISPATCH ERROR]", err);
    return { success: false, error: err.message };
  }
}
