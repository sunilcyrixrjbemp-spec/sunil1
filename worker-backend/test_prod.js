import { signJwt } from "./src/utils/security.js";

async function run() {
  const secret = "012001@Sunil";
  const token = await signJwt({ sub: "Admin", sid: "test-session", exp: Math.floor(Date.now() / 1000) + 3600, type: "access" }, secret);
  console.log("Token:", token);

  const res = await fetch("https://fieldops-secondary-api.sunilbishnoi.workers.dev/api/expense/1589", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
