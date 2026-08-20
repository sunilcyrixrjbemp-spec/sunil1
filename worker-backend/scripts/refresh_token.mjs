import fs from "fs";

const CLIENT_ID = "54d11594-84e4-413e-b414-2e25e3e1423e";
const REFRESH_TOKEN = "cfort_B8R_9A7UZC4ualcyqJGI2wlwHjZDsDAP-1iRpC3pLeo.cCIwSmcWxOmqxZYWqA1LTUDksQOf5e1imJlYZgbEJsE";

async function refreshToken() {
  const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: REFRESH_TOKEN
    })
  });

  const data = await res.json();
  console.log("Refresh response:", data);
  if (data.access_token) {
    console.log("New access token:", data.access_token);
    // update default.toml
    const tomlPath = "C:/Users/Cyrix HealthCare/AppData/Roaming/xdg.config/.wrangler/config/default.toml";
    const tomlContent = `oauth_token = "${data.access_token}"\nexpiration_time = "${new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()}"\nrefresh_token = "${data.refresh_token || REFRESH_TOKEN}"\n`;
    fs.writeFileSync(tomlPath, tomlContent);
    console.log("Updated default.toml");
  }
}

refreshToken().catch(console.error);
