import fs from "fs";

const ACCOUNT_ID = "befbd2e0ff580a1d0d0865f011002053";
const DB_ID = "34e085d8-c078-4f2f-b240-9bf8f4cf9301";
const API_TOKEN = "9RkyvFfIdtWvL9H_3U3yXfI8J_80Wz-Y56V0X_y1";

async function queryD1(sql, params = []) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, params })
    });
    const json = await res.json();
    if (json.success && json.result && json.result[0]) {
      return json.result[0].results || [];
    }
    console.error("D1 REST API error:", json.errors);
    return [];
  } catch (e) {
    console.error("Fetch D1 error:", e.message);
    return [];
  }
}

async function run() {
  console.log("Fetching July data from D1...");
  
  // 1. Fetch users
  const users = await queryD1("SELECT id, user_id, name, district, zone, grade, designation, date_of_joining, e_code, manager FROM users");
  console.log(`Loaded ${users.length} users`);

  // 2. Fetch all approved July expenses
  const expenses = await queryD1("SELECT id, user_id, expense_code, amount, original_amount, status, itinerary, month, year, created_at FROM expenses WHERE UPPER(month) = 'JULY' AND LOWER(status) = 'approved'");
  console.log(`Loaded ${expenses.length} approved July expenses`);

  // 3. Fetch all itineraries for July
  const legs = await queryD1(`
    SELECT i.id, i.exp_id, i.travel_mode, i.sub_mode, i.distance_km, i.travel_amount, i.sub_amount, i.da_amount, 
           i.local_purchase, i.local_purchase_remark, i.hotel_amount, i.other_desc, i.other_amount,
           i.original_distance_km, i.original_travel_amount, i.original_sub_amount, i.original_da_amount,
           i.original_local_purchase, i.original_hotel_amount, i.original_other_amount,
           e.user_id, e.itinerary as claim_date
    FROM expense_itineraries i
    JOIN expenses e ON i.exp_id = e.expense_code
    WHERE UPPER(e.month) = 'JULY' AND LOWER(e.status) = 'approved'
  `);
  console.log(`Loaded ${legs.length} itinerary legs for July`);

  // 4. Fetch advances
  const advances = await queryD1("SELECT user_id, advance_amount, month, year FROM engineer_advances WHERE UPPER(month) = 'JULY'");
  console.log(`Loaded ${advances.length} advances for July`);

  // 5. Fetch edit logs
  const editLogs = await queryD1(`
    SELECT l.expense_id, l.comment, e.user_id, e.expense_code
    FROM expense_edit_logs l
    JOIN expenses e ON l.expense_id = e.id
    WHERE UPPER(e.month) = 'JULY' AND LOWER(e.status) = 'approved'
  `);
  console.log(`Loaded ${editLogs.length} edit logs for July`);

  // Save raw data to JSON for comprehensive analysis
  fs.writeFileSync("july_raw_data.json", JSON.stringify({ users, expenses, legs, advances, editLogs }, null, 2));
  console.log("Saved raw data to july_raw_data.json");

  // Let's analyze all other_amount > 0 entries and their other_desc
  const otherEntries = legs.filter(l => parseFloat(l.other_amount || 0) > 0 || parseFloat(l.original_other_amount || 0) > 0 || (l.other_desc && l.other_desc.trim().length > 0));
  console.log(`\nFound ${otherEntries.length} legs with other_amount/other_desc:`);
  
  const userMap = {};
  for (const u of users) {
    userMap[u.id] = u;
    userMap[u.user_id] = u;
  }

  for (const entry of otherEntries) {
    const usr = userMap[entry.user_id] || { name: entry.user_id, e_code: entry.user_id };
    console.log(`User: ${usr.name} (${usr.e_code}) | ExpCode: ${entry.exp_id} | Date: ${entry.claim_date} | Amount: ${entry.other_amount} (Orig: ${entry.original_other_amount}) | Desc: "${entry.other_desc}"`);
  }
}

run().catch(console.error);
