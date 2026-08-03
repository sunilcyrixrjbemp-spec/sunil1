-- Seed data for local development
-- Admin user: user_id=Admin, password=Admin@123
INSERT OR IGNORE INTO users (
  user_id, e_code, name, hashed_password, user_status,
  designation, grade, district, zone,
  manager, zonal_manager, coordinator,
  mobile_number, mail_id, role, type,
  date_of_joining, date_of_birth,
  base_reporting_location, failed_attempt, created_at, updated_at
) VALUES (
  'Admin', 'E001', 'Admin User', 'pbkdf2_sha256$100000$SunilLocalDev16$f2f690a7da52115246ce3947d014eee94a0375a4649fa7d1331e587682a7cac5', 'active',
  'Sr. Engineer', 'L3', 'Jaipur', 'Zone A',
  NULL, NULL, NULL,
  '9999999999', 'admin@cyrix.in', 'admin', 'HQ',
  '2020-01-01', '1990-01-01',
  'Jaipur', 0, '2026-07-31T15:10:18.961Z', '2026-07-31T15:10:18.961Z'
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
  'Manager01', 'E002', 'Ramesh Manager', 'pbkdf2_sha256$100000$SunilLocalDev16$131dda3d9ccec38add911966e0f91c96078544807e6dce7b3ce8b89ddff2dd39', 'active',
  'Manager', 'L4', 'Jaipur', 'Zone A',
  'Admin', NULL, NULL,
  '9888888888', 'manager@cyrix.in', 'manager', 'HQ',
  '2019-05-15', '1985-06-20',
  'Jaipur', 0, '2026-07-31T15:10:18.961Z', '2026-07-31T15:10:18.961Z'
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
  'User001', 'E003', 'Sunil Field Engineer', 'pbkdf2_sha256$100000$SunilLocalDev16$a892561f4b0953d9b8fbea21fdb7ed096658e270d06ed904ebd70835e650dfef', 'active',
  'Field Engineer', 'L2', 'Jaipur', 'Zone A',
  'Manager01', NULL, NULL,
  '9777777777', 'user001@cyrix.in', 'user', 'field',
  '2022-03-10', '1995-07-15',
  'Jaipur', 0, '2026-07-31T15:10:18.961Z', '2026-07-31T15:10:18.961Z'
);
