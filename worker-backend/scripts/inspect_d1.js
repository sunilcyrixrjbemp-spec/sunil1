const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WRANGLER_CLI = path.resolve(__dirname, '../node_modules/wrangler/wrangler-dist/cli.js');
const CWD = path.resolve(__dirname, '..');

const raw = execSync(`node "${WRANGLER_CLI}" d1 execute expense_management_db --remote --json --command="SELECT id, name, user_id, e_code FROM users LIMIT 3;"`, {
  cwd: CWD,
  encoding: 'utf8'
});

console.log("Raw output:\n", raw);
