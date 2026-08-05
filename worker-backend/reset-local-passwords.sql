-- Reset Admin password to: Cyrix@Admin1
-- Hash: pbkdf2_sha256$100000$CyrixLocalSalt2026$c9967dae8a4a2f9bf8df8aee4a17b0b307dda6e12b43247ec4893c165ccf1a1f
UPDATE users SET 
  hashed_password = 'pbkdf2_sha256$100000$CyrixLocalSalt2026$c9967dae8a4a2f9bf8df8aee4a17b0b307dda6e12b43247ec4893c165ccf1a1f',
  user_status = 'active',
  failed_attempt = 0,
  active_session_id = NULL
WHERE user_id = 'Admin';

-- Reset Manager01 password to: Cyrix@Manager1
-- Same salt for simplicity
UPDATE users SET 
  hashed_password = 'pbkdf2_sha256$100000$CyrixLocalSalt2026$c9967dae8a4a2f9bf8df8aee4a17b0b307dda6e12b43247ec4893c165ccf1a1f',
  user_status = 'active',
  failed_attempt = 0,
  active_session_id = NULL
WHERE user_id = 'Manager01';

-- Ensure role column has correct value (used as fallback by auth.js)
UPDATE users SET role = 'Admin' WHERE user_id = 'Admin';
UPDATE users SET role = 'Manager' WHERE user_id = 'Manager01';
UPDATE users SET role = 'Engineer' WHERE user_id = 'User001';

-- Ensure active_session_id col allows NULL (reset any stale session)
UPDATE users SET active_session_id = NULL;

-- Show result
SELECT user_id, name, role, user_status, substr(hashed_password,1,30) as hash_preview FROM users;
