/**
 * FieldOps Secondary API Server — Cloudflare Worker (JavaScript)
 * 
 * This Worker connects directly to the Secondary D1 database via native binding.
 * It serves as a read-only + write-sync API that can:
 *   1. Serve all read (GET) requests from the secondary D1
 *   2. Accept write replication requests from the primary Render backend
 *   3. Act as a backup API server if Render goes down
 * 
 * D1 binding is ZERO-latency (no HTTP API calls) — much faster than REST API.
 */

// ─── CORS Helpers ──────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Key, X-Auth-Email',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ─── Auth Middleware ────────────────────────────────────────────────────────
function verifyApiSecret(request, env) {
  const authHeader = request.headers.get('X-API-Secret') || '';
  if (authHeader !== env.API_SECRET) {
    return false;
  }
  return true;
}

// ─── Route Handler ─────────────────────────────────────────────────────────
class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  put(path, handler) {
    this.routes.push({ method: 'PUT', path, handler });
  }

  delete(path, handler) {
    this.routes.push({ method: 'DELETE', path, handler });
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      // Support :param style patterns
      const routeParts = route.path.split('/');
      const pathParts = pathname.split('/');

      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}

// ─── Create Router & Register Routes ───────────────────────────────────────
const router = new Router();

// Health check
router.get('/api/health', async (req, env, params, query) => {
  const result = await env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first();
  return jsonResponse({
    status: 'ok',
    server: 'cloudflare-worker-secondary',
    database: 'connected',
    users_count: result?.cnt || 0,
    timestamp: new Date().toISOString(),
  });
});

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────

// Get dropdowns (hospitals, zones, etc.)
router.get('/api/auth/dropdowns', async (req, env, params, query) => {
  const hospitals = await env.DB.prepare('SELECT id, hospital_name, zone, district FROM main_hospitals ORDER BY hospital_name').all();
  return jsonResponse({
    hospitals: hospitals.results || [],
  });
});

// Bootstrap data
router.get('/api/auth/bootstrap', async (req, env, params, query) => {
  return jsonResponse({ status: 'ok', source: 'secondary' });
});

// ─── USER ROUTES ───────────────────────────────────────────────────────────

// Get user profile
router.get('/api/users/profile', async (req, env, params, query) => {
  // Token-based auth would be needed here
  return jsonResponse({ error: 'Auth required on primary server' }, 401);
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────────

// List all users
router.get('/api/admin/users', async (req, env, params, query) => {
  const users = await env.DB.prepare(`
    SELECT u.id, u.user_id, u.e_code, u.name, u.email, u.phone, u.zone, u.district,
           u.designation, u.user_status, u.user_type, u.created_at, u.updated_at,
           r.role
    FROM users u
    LEFT JOIN user_roles r ON u.user_id = r.user_id
    ORDER BY u.name
  `).all();
  return jsonResponse(users.results || []);
});

// Get eligible approvers
router.get('/api/admin/eligible-approvers', async (req, env, params, query) => {
  const users = await env.DB.prepare(`
    SELECT u.id, u.user_id, u.name, u.designation, u.zone, u.district
    FROM users u
    JOIN user_roles r ON u.user_id = r.user_id
    WHERE r.role IN ('admin', 'approver', 'zonal_head', 'coordinator', 'district_incharge')
    AND u.user_status = 'active'
    ORDER BY u.name
  `).all();
  return jsonResponse(users.results || []);
});

// Get hierarchies
router.get('/api/admin/hierarchies', async (req, env, params, query) => {
  const hierarchies = await env.DB.prepare(`
    SELECT * FROM user_approval_chains ORDER BY id
  `).all();
  return jsonResponse(hierarchies.results || []);
});

// ─── EXPENSE ROUTES ────────────────────────────────────────────────────────

// List expenses for a user
router.get('/api/expenses', async (req, env, params, query) => {
  const month = query.get('month');
  const userId = query.get('user_id');

  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const bindings = [];

  if (userId) {
    sql += ' AND user_id = ?';
    bindings.push(userId);
  }
  if (month) {
    sql += ' AND claim_month = ?';
    bindings.push(month);
  }
  sql += ' ORDER BY created_at DESC';

  const stmt = env.DB.prepare(sql);
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();
  return jsonResponse(result.results || []);
});

// Get expense details
router.get('/api/expenses/:id', async (req, env, params, query) => {
  const expense = await env.DB.prepare('SELECT * FROM expenses WHERE id = ?').bind(params.id).first();
  if (!expense) return jsonResponse({ error: 'Not found' }, 404);

  // Get itineraries
  const itineraries = await env.DB.prepare(
    'SELECT * FROM expense_itineraries WHERE expense_id = ? ORDER BY id'
  ).bind(params.id).all();

  // Get attachments
  const attachments = await env.DB.prepare(
    'SELECT * FROM expense_attachments WHERE expense_id = ?'
  ).bind(params.id).all();

  return jsonResponse({
    ...expense,
    itineraries: itineraries.results || [],
    attachments: attachments.results || [],
  });
});

// Get asset value master
router.get('/api/expenses/asset-value-master', async (req, env, params, query) => {
  const result = await env.DB.prepare('SELECT equipment_name, rmsc_tender_cost FROM asset_value_master').all();
  return jsonResponse(result.results || []);
});

// ─── APPROVAL ROUTES ───────────────────────────────────────────────────────

// Get pending approvals
router.get('/api/approvals', async (req, env, params, query) => {
  const userId = query.get('user_id');
  if (!userId) return jsonResponse({ error: 'user_id required' }, 400);

  const result = await env.DB.prepare(`
    SELECT e.*, u.name as user_name
    FROM expenses e
    JOIN users u ON e.user_id = u.user_id
    WHERE e.current_approver_id = ? AND e.approval_status = 'pending'
    ORDER BY e.created_at DESC
  `).bind(userId).all();
  return jsonResponse(result.results || []);
});

// ─── REPORT ROUTES ─────────────────────────────────────────────────────────

// Get penalties
router.get('/api/reports/penalties', async (req, env, params, query) => {
  const district = query.get('district');
  const coordinator = query.get('coordinator');
  const month = query.get('month');
  const page = parseInt(query.get('page') || '1');
  const pageSize = parseInt(query.get('page_size') || '100');
  const offset = (page - 1) * pageSize;

  let sql = 'SELECT * FROM rj_penalties WHERE 1=1';
  const bindings = [];
  if (district) { sql += ' AND district_name = ?'; bindings.push(district); }
  if (coordinator) { sql += ' AND coordinator_name = ?'; bindings.push(coordinator); }
  if (month) { sql += ' AND month = ?'; bindings.push(month); }
  sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  bindings.push(pageSize, offset);

  const stmt = env.DB.prepare(sql);
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

  // Count total
  let countSql = 'SELECT COUNT(*) as total FROM rj_penalties WHERE 1=1';
  const countBindings = [];
  if (district) { countSql += ' AND district_name = ?'; countBindings.push(district); }
  if (coordinator) { countSql += ' AND coordinator_name = ?'; countBindings.push(coordinator); }
  if (month) { countSql += ' AND month = ?'; countBindings.push(month); }

  const countStmt = env.DB.prepare(countSql);
  const countResult = countBindings.length > 0 ? await countStmt.bind(...countBindings).first() : await countStmt.first();

  return jsonResponse({
    data: result.results || [],
    total: countResult?.total || 0,
    page,
    page_size: pageSize,
  });
});

// Assets inventory
router.get('/api/reports/assets', async (req, env, params, query) => {
  const page = parseInt(query.get('page') || '1');
  const pageSize = parseInt(query.get('page_size') || '100');
  const offset = (page - 1) * pageSize;
  const search = query.get('search');
  const district = query.get('district');

  let sql = 'SELECT * FROM assets_inventory WHERE 1=1';
  const bindings = [];
  if (search) { sql += ' AND (equipment_name LIKE ? OR hospital_name LIKE ? OR serial_no LIKE ?)'; bindings.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (district) { sql += ' AND district_name = ?'; bindings.push(district); }
  sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  bindings.push(pageSize, offset);

  const stmt = env.DB.prepare(sql);
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

  return jsonResponse({
    data: result.results || [],
    page,
    page_size: pageSize,
  });
});

// Assets filters
router.get('/api/reports/assets-filters', async (req, env, params, query) => {
  const districts = await env.DB.prepare('SELECT DISTINCT district_name FROM assets_inventory WHERE district_name IS NOT NULL ORDER BY district_name').all();
  const hospitals = await env.DB.prepare('SELECT DISTINCT hospital_name FROM assets_inventory WHERE hospital_name IS NOT NULL ORDER BY hospital_name').all();
  const groups = await env.DB.prepare('SELECT DISTINCT group_name FROM assets_inventory WHERE group_name IS NOT NULL ORDER BY group_name').all();
  const statuses = await env.DB.prepare('SELECT DISTINCT inventory_status FROM assets_inventory WHERE inventory_status IS NOT NULL ORDER BY inventory_status').all();

  return jsonResponse({
    districts: (districts.results || []).map(r => r.district_name),
    hospitals: (hospitals.results || []).map(r => r.hospital_name),
    groups: (groups.results || []).map(r => r.group_name),
    statuses: (statuses.results || []).map(r => r.inventory_status),
  });
});

// ─── NOTIFICATION ROUTES ───────────────────────────────────────────────────

router.get('/api/notifications', async (req, env, params, query) => {
  const userId = query.get('user_id');
  if (!userId) return jsonResponse({ error: 'user_id required' }, 400);

  const result = await env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return jsonResponse(result.results || []);
});

// ─── MONITORING ROUTES ─────────────────────────────────────────────────────

router.get('/api/monitoring/summary', async (req, env, params, query) => {
  const date = query.get('date');
  let sql = 'SELECT COUNT(*) as total_ops FROM db_op_logs WHERE 1=1';
  const bindings = [];
  if (date) { sql += ' AND date(created_at) = ?'; bindings.push(date); }

  const stmt = env.DB.prepare(sql);
  const result = bindings.length > 0 ? await stmt.bind(...bindings).first() : await stmt.first();
  return jsonResponse({ total_ops: result?.total_ops || 0 });
});

// ─── WRITE REPLICATION ENDPOINT ────────────────────────────────────────────
// Accepts write operations from the primary Render backend for sync

router.post('/api/replicate', async (req, env, params, query) => {
  // Verify API secret
  if (!verifyApiSecret(req, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const { sql, params: sqlParams } = body;

    if (!sql) return jsonResponse({ error: 'sql required' }, 400);

    const stmt = env.DB.prepare(sql);
    let result;
    if (sqlParams && sqlParams.length > 0) {
      result = await stmt.bind(...sqlParams).run();
    } else {
      result = await stmt.run();
    }

    return jsonResponse({
      success: true,
      meta: result.meta || {},
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

// Batch replication
router.post('/api/replicate/batch', async (req, env, params, query) => {
  if (!verifyApiSecret(req, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const { statements } = body;

    if (!Array.isArray(statements)) return jsonResponse({ error: 'statements array required' }, 400);

    const batch = statements.map(s => {
      const stmt = env.DB.prepare(s.sql);
      if (s.params && s.params.length > 0) {
        return stmt.bind(...s.params);
      }
      return stmt;
    });

    const results = await env.DB.batch(batch);
    return jsonResponse({
      success: true,
      results_count: results.length,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

// ─── GENERIC TABLE QUERY ───────────────────────────────────────────────────
// Serves any table data via GET /api/table/:tableName

router.get('/api/table/:tableName', async (req, env, params, query) => {
  const tableName = params.tableName;
  // Whitelist allowed tables
  const allowedTables = [
    'allowance_master', 'main_hospitals', 'asset_value_master',
    'critical_equipment', 'facility_details', 'di_name_list',
    'sla_configs', 'attend_penalty_configs', 'penalty_slab_configs',
  ];
  if (!allowedTables.includes(tableName)) {
    return jsonResponse({ error: 'Table not allowed' }, 403);
  }

  const result = await env.DB.prepare(`SELECT * FROM [${tableName}]`).all();
  return jsonResponse(result.results || []);
});


// ─── Main Worker Entry Point ───────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;
    const origin = request.headers.get('Origin') || '*';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Root health
    if (pathname === '/' || pathname === '') {
      return jsonResponse({
        service: 'FieldOps Secondary API',
        version: '1.0.0',
        status: 'running',
        engine: 'Cloudflare Workers + D1',
        timestamp: new Date().toISOString(),
      });
    }

    // Match route
    const match = router.match(method, pathname);
    if (match) {
      try {
        return await match.handler(request, env, match.params, searchParams);
      } catch (error) {
        console.error(`Route error [${method} ${pathname}]:`, error);
        return jsonResponse({ error: 'Internal server error', detail: error.message }, 500, origin);
      }
    }

    return jsonResponse({ error: 'Not found', path: pathname }, 404, origin);
  },
};
