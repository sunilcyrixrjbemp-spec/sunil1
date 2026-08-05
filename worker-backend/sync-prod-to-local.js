/**
 * sync-prod-to-local.js
 * Syncs ALL production D1 users to local D1 for development
 * Run: node sync-prod-to-local.js
 */

const { execSync } = require('child_process');
const fs = require('fs');

const WRANGLER = `"C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend\\node_modules\\.bin\\wrangler.cmd"`;
const CWD = `C:\\Users\\Cyrix HealthCare\\Desktop\\Sunil React.tsx\\worker-backend`;

function wrangler(cmd) {
  try {
    return execSync(`${WRANGLER} ${cmd}`, { cwd: CWD, encoding: 'utf8', timeout: 60000 });
  } catch(e) {
    return e.stdout || e.message;
  }
}

console.log('🔄 Fetching users from production D1...');

// Pull all users from production
const raw = wrangler(`d1 execute expense_management_db --remote --command "SELECT user_id, name, e_code, hashed_password, designation, grade, zone, district, manager, zonal_manager, coordinator, mobile_number, mail_id, role, user_status, date_of_birth, date_of_joining, allowed_windows, type FROM users LIMIT 500;" --json`);

let data;
try {
  const parsed = JSON.parse(raw.trim().split('\n').filter(l => l.startsWith('[') || l.startsWith('{')).join(''));
  data = Array.isArray(parsed) ? parsed[0]?.results : parsed?.results;
} catch(e) {
  // Try extracting JSON from raw output
  const jsonMatch = raw.match(/\[\s*\{[\s\S]*"success":\s*true[\s\S]*\}\s*\]/);
  if (jsonMatch) {
    const arr = JSON.parse(jsonMatch[0]);
    data = arr[0]?.results;
  }
}

if (!data || data.length === 0) {
  console.error('❌ Could not parse production data. Raw output:');
  console.log(raw.substring(0, 500));
  process.exit(1);
}

console.log(`✅ Got ${data.length} users from production`);

// Build SQL
const lines = [];
lines.push('-- Production Users Sync');
lines.push('-- Generated: ' + new Date().toISOString());
lines.push('');

// First clear existing test users (keep schema)
lines.push('DELETE FROM users WHERE user_id IN (\'Admin\', \'Manager01\', \'User001\');');
lines.push('');

for (const u of data) {
  const esc = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
  
  lines.push(`INSERT OR REPLACE INTO users (user_id, name, e_code, hashed_password, designation, grade, zone, district, manager, zonal_manager, coordinator, mobile_number, mail_id, role, user_status, date_of_birth, date_of_joining, allowed_windows, type, created_at, updated_at)
VALUES (${esc(u.user_id)}, ${esc(u.name)}, ${esc(u.e_code)}, ${esc(u.hashed_password)}, ${esc(u.designation)}, ${esc(u.grade)}, ${esc(u.zone)}, ${esc(u.district)}, ${esc(u.manager)}, ${esc(u.zonal_manager)}, ${esc(u.coordinator)}, ${esc(u.mobile_number)}, ${esc(u.mail_id)}, ${esc(u.role)}, ${esc(u.user_status || 'active')}, ${esc(u.date_of_birth)}, ${esc(u.date_of_joining)}, ${esc(u.allowed_windows)}, ${esc(u.type)}, datetime('now'), datetime('now'));`);
}

lines.push('');
lines.push(`SELECT COUNT(*) as synced_users FROM users;`);

const sqlFile = `${CWD}\\sync-prod-users.sql`;
fs.writeFileSync(sqlFile, lines.join('\n'));
console.log(`📝 SQL written to sync-prod-users.sql (${data.length} users)`);

// Execute against local D1
console.log('🔄 Inserting into local D1...');
const result = wrangler(`d1 execute expense_management_db --local --file "sync-prod-users.sql"`);
console.log(result.substring(result.length - 500));
console.log('✅ Sync complete!');
