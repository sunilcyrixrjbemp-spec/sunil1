// Generate PBKDF2 hash matching the worker's getPasswordHash function
// Then output a SQL seed file for local D1

import { pbkdf2Sync, randomBytes } from 'crypto';

function generateHash(password) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const salt = "SunilLocalDev16"; // Fixed salt for reproducible local hash
  const iterations = 100000;
  
  const derived = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const keyHex = derived.toString('hex');
  return `pbkdf2_sha256$${iterations}$${salt}$${keyHex}`;
}

const adminHash   = generateHash("Admin@123");
const managerHash = generateHash("Manager@123");
const userHash    = generateHash("User@123");

const now = new Date().toISOString();

const sql = `-- Seed data for local development
-- Admin user: user_id=Admin, password=Admin@123
INSERT OR IGNORE INTO users (
  user_id, e_code, name, hashed_password, user_status,
  designation, grade, district, zone,
  manager, zonal_manager, coordinator,
  mobile_number, mail_id, role, type,
  date_of_joining, date_of_birth,
  base_reporting_location, failed_attempt, created_at, updated_at
) VALUES (
  'Admin', 'E001', 'Admin User', '${adminHash}', 'active',
  'Sr. Engineer', 'L3', 'Jaipur', 'Zone A',
  NULL, NULL, NULL,
  '9999999999', 'admin@cyrix.in', 'admin', 'HQ',
  '2020-01-01', '1990-01-01',
  'Jaipur', 0, '${now}', '${now}'
);

-- Manager user: user_id=Manager01, password=Manager@123
INSERT OR IGNORE INTO users (
  user_id, e_code, name, hashed_password, user_status,
  designation, grade, district, zone,
  manager, zonal_manager, coordinator,
  mobile_number, mail_id, role, type,
  date_of_joining, date_of_birth,
  base_reporting_location, failed_attempt, created_at, updated_at
) VALUES (
  'Manager01', 'E002', 'Ramesh Manager', '${managerHash}', 'active',
  'Manager', 'L4', 'Jaipur', 'Zone A',
  'Admin', NULL, NULL,
  '9888888888', 'manager@cyrix.in', 'manager', 'HQ',
  '2019-05-15', '1985-06-20',
  'Jaipur', 0, '${now}', '${now}'
);

-- Field user: user_id=User001, password=User@123
INSERT OR IGNORE INTO users (
  user_id, e_code, name, hashed_password, user_status,
  designation, grade, district, zone,
  manager, zonal_manager, coordinator,
  mobile_number, mail_id, role, type,
  date_of_joining, date_of_birth,
  base_reporting_location, failed_attempt, created_at, updated_at
) VALUES (
  'User001', 'E003', 'Sunil Field Engineer', '${userHash}', 'active',
  'Field Engineer', 'L2', 'Jaipur', 'Zone A',
  'Manager01', NULL, NULL,
  '9777777777', 'user001@cyrix.in', 'user', 'field',
  '2022-03-10', '1995-07-15',
  'Jaipur', 0, '${now}', '${now}'
);
`;

console.log("=== SEED SQL GENERATED ===");
console.log(sql);
console.log("=== HASH VALUES ===");
console.log("Admin@123  hash:", adminHash);
console.log("Manager@123 hash:", managerHash);
console.log("User@123   hash:", userHash);

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('seed_local.sql', sql, 'utf8');
console.log("\n✅ Written to seed_local.sql");
