async function run() {
  const urls = [
    "https://fieldops-api.sunilbishnoi.workers.dev/api",
    "https://fieldops-secondary-api.sunilbishnoi.workers.dev/api"
  ];

  for (const baseUrl of urls) {
    console.log(`\nTesting ${baseUrl}...`);
    try {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "Admin", password: "Cyrix@Admin1" })
      });
      console.log(`Login status:`, loginRes.status);
      const loginData = await loginRes.json();
      console.log(`Login response:`, loginData.success ? "SUCCESS" : loginData.error || loginData.detail || JSON.stringify(loginData));
      
      if (loginData.token || loginData.access_token) {
        const token = loginData.token || loginData.access_token;
        const repRes = await fetch(`${baseUrl}/expense/consolidated-report?month=July&year=2026`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Consolidated report status:`, repRes.status);
        const repData = await repRes.json();
        console.log(`Records loaded:`, repData.data?.length || 0);
        if (repData.data && repData.data.length > 0) {
          console.log(`First record:`, repData.data[0]);
          return repData.data;
        }
      }
    } catch (e) {
      console.error(`Error on ${baseUrl}:`, e.message);
    }
  }
}

run();
