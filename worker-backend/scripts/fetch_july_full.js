const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WRANGLER_CLI = path.resolve(__dirname, '../node_modules/wrangler/wrangler-dist/cli.js');
const CWD = path.resolve(__dirname, '..');

function queryD1Command(sql) {
  try {
    const raw = execSync(`node "${WRANGLER_CLI}" d1 execute expense_management_db --remote --json --command="${sql.replace(/"/g, '\\"')}"`, {
      cwd: CWD,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
    });
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = raw.substring(start, end + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0].results)) {
        return parsed[0].results;
      }
    }
    return [];
  } catch (e) {
    console.error('Error querying D1:', e.message);
    return [];
  }
}

async function main() {
  console.log('1. Fetching all users...');
  const users = queryD1Command("SELECT id, user_id, name, district, zone, grade, designation, date_of_joining, e_code, manager FROM users;");
  console.log(`Loaded ${users.length} users`);

  console.log('2. Fetching all approved July expenses...');
  const expenses = queryD1Command("SELECT id, user_id, expense_code, amount, original_amount, status, itinerary, month, year, created_at FROM expenses WHERE UPPER(month) = 'JULY' AND LOWER(status) = 'approved';");
  console.log(`Loaded ${expenses.length} approved July expenses`);

  console.log('3. Fetching all July expense itineraries...');
  const legs = queryD1Command(`SELECT i.id, i.exp_id, i.travel_mode, i.sub_mode, i.distance_km, i.travel_amount, i.sub_amount, i.da_amount, i.local_purchase, i.local_purchase_remark, i.hotel_amount, i.other_desc, i.other_amount, i.original_distance_km, i.original_travel_amount, i.original_sub_amount, i.original_da_amount, i.original_local_purchase, i.original_hotel_amount, i.original_other_amount, e.user_id, e.itinerary as claim_date, e.id as expense_id FROM expense_itineraries i JOIN expenses e ON i.exp_id = e.expense_code WHERE UPPER(e.month) = 'JULY' AND LOWER(e.status) = 'approved';`);
  console.log(`Loaded ${legs.length} itineraries`);

  console.log('4. Fetching July advances...');
  const advances = queryD1Command("SELECT user_id, advance_amount, month, year FROM engineer_advances WHERE UPPER(month) = 'JULY';");
  console.log(`Loaded ${advances.length} advances`);

  console.log('5. Fetching edit logs for July...');
  const editLogs = queryD1Command(`SELECT l.expense_id, l.comment, e.user_id, e.expense_code FROM expense_edit_logs l JOIN expenses e ON l.expense_id = e.id WHERE UPPER(e.month) = 'JULY' AND LOWER(e.status) = 'approved';`);
  console.log(`Loaded ${editLogs.length} edit logs`);

  const outputData = {
    fetched_at: new Date().toISOString(),
    users,
    expenses,
    legs,
    advances,
    editLogs
  };

  const outFile = path.resolve(__dirname, 'july_full_data.json');
  fs.writeFileSync(outFile, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`✅ Saved full dataset to ${outFile}`);
}

main().catch(console.error);
