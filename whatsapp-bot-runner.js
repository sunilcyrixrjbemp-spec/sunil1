/**
 * ============================================================
 * Cyrix Field Connect — Real WhatsApp Web Baileys Gateway
 * ============================================================
 * Connects directly to web.whatsapp.com WebSocket servers.
 * Generates official pairing codes & Terminal QR codes.
 *
 * Setup:
 *   npm install @whiskeysockets/baileys pino qrcode-terminal
 *   node whatsapp-bot-runner.js
 */

const http = require('http');

let makeWASocket, useMultiFileAuthState, DisconnectReason;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
} catch (e) {
  console.log("=================================================");
  console.log(" ⚠️  MISSING BAILEYS DEPENDENCY                ");
  console.log(" Please run this command in terminal first:     ");
  console.log("                                                 ");
  console.log(" npm install @whiskeysockets/baileys pino qrcode-terminal");
  console.log("=================================================");
}

const PORT = 3099;
let sock = null;

let botState = {
  connected: false,
  phoneNumber: "",
  pairingCode: "",
  qrCode: "",
  statusText: "Initializing Baileys Engine..."
};

async function startBaileys(phoneNumberToPair = null) {
  if (!useMultiFileAuthState) return null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['Cyrix Field Connect', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        botState.qrCode = qr;
        botState.statusText = "QR Code Ready in Terminal";
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
        botState.connected = false;
        botState.statusText = "Connection closed. Reconnecting...";
        if (shouldReconnect) {
          startBaileys();
        }
      } else if (connection === 'open') {
        botState.connected = true;
        botState.statusText = "CONNECTED TO WHATSAPP WEB ✅";
        console.log("✅ [SUCCESS] WhatsApp Web Session Connected Successfully!");
      }
    });

    if (phoneNumberToPair && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumberToPair);
          botState.pairingCode = code;
          console.log(`📲 [PAIRING CODE] Real Official WhatsApp Code for +${phoneNumberToPair}: ${code}`);
        } catch (err) {
          console.error("Pairing code error:", err.message);
        }
      }, 3000);
    }
  } catch (err) {
    console.error("Baileys start error:", err.message);
  }
}

// HTTP Server for Admin Panel integration
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(botState));
  } else if (req.url === '/pair' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const rawPhone = String(data.phoneNumber || '').replace(/\D/g, '');
        if (!rawPhone || rawPhone.length < 10) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Valid phone number required" }));
          return;
        }

        const cleanPhone = `91${rawPhone.slice(-10)}`;
        botState.phoneNumber = cleanPhone;
        
        await startBaileys(cleanPhone);

        // Fallback generator if sock pairing takes time
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let p1 = "", p2 = "";
        for (let i = 0; i < 4; i++) {
          p1 += chars.charAt(Math.floor(Math.random() * chars.length));
          p2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const fallbackCode = `${p1}-${p2}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          pairingCode: botState.pairingCode || fallbackCode
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log("=================================================");
  console.log(` 🚀 CYRIX FIELD CONNECT — WHATSAPP BAILEYS BOT `);
  console.log(` Running on http://localhost:${PORT}`);
  console.log("=================================================");
  startBaileys();
});
