/**
 * ============================================================
 * Login & Session Cache Warming Service
 * Cyrix Field Connect — Cloudflare Worker Backend
 * ============================================================
 * Pre-computes and warms personalized caches for the logged-in user
 * in the background via ctx.waitUntil() without blocking HTTP responses.
 * ============================================================
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function warmUserCache(env, user) {
  if (!env.DB || !env.OTPS_KV || !user || !user.id) return;

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentMonthName = MONTH_NAMES[currentMonthIdx];
    const monthNum = currentMonthIdx + 1;

    const roleLower = (user.role || "").toLowerCase();
    const isAdmin = ["admin", "administrator", "general manager", "gm", "director", "vp", "state head", "project manager", "operation head"].some(r => roleLower.includes(r));
    const isManager = isAdmin || roleLower.includes("manager") || roleLower.includes("reviewer") || roleLower.includes("head");

    // 1. Warm Master Month Dataset in KV (shared by all users)
    const masterKey = `analysis_master:${currentYear}_${monthNum}`;
    const existingMaster = await env.OTPS_KV.get(masterKey);

    let rows = [];
    if (!existingMaster) {
      const monthParam = `${currentYear}-${String(monthNum).padStart(2, "0")}`;
      const globalSql = `
        SELECT 
          e.id, e.user_id, e.month, e.year, e.amount, e.status, e.itinerary, e.expense_code,
          e.pms_count, e.calibration_count, e.asset_tagging, e.mobilise_count, e.calls_completed, e.calls_assigned,
          e.district_type,
          u.name as engineer_name, u.district as user_district, u.zone as user_zone, u.manager as user_manager, u.coordinator as user_coordinator, u.role as user_role
        FROM expenses e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE (
          (e.year = ? AND (
            e.month = ? OR LOWER(e.month) = ? OR e.month = ? OR e.month = ? OR LOWER(e.month) LIKE ?
          ))
          OR e.itinerary LIKE ?
          OR e.date LIKE ?
        )
      `;
      const binds = [
        currentYear,
        currentMonthName,
        currentMonthName.toLowerCase(),
        String(monthNum),
        String(monthNum).padStart(2, "0"),
        `%${currentMonthName.toLowerCase()}%`,
        `${monthParam}%`,
        `${monthParam}%`
      ];
      const { results: allRows } = await env.DB.prepare(globalSql).bind(...binds).all();
      rows = allRows || [];
      await env.OTPS_KV.put(masterKey, JSON.stringify({ rows, computed_at: new Date().toISOString() }), { expirationTtl: 86400 });
    } else {
      try {
        const parsed = JSON.parse(existingMaster);
        rows = parsed.rows || [];
      } catch (e) {}
    }

    let totalAmount = 0;
    let totalPms = 0;
    let totalCalibration = 0;
    let totalTagging = 0;
    let totalMobilised = 0;
    let totalCalls = 0;

    const engineerMap = {};
    const districtCalMap = {};
    const dayTrendsMap = {};
    let pms3m = 0;
    let pms6m = 0;
    let pms12m = 0;

    for (const r of rows) {
      const amt = parseFloat(r.amount) || 0;
      const pms = parseInt(r.pms_count, 10) || 0;
      const cal = parseInt(r.calibration_count, 10) || 0;
      const tag = parseInt(r.asset_tagging, 10) || 0;
      const mob = parseInt(r.mobilise_count, 10) || 0;
      const calls = parseInt(r.calls_completed, 10) || 0;

      totalAmount += amt;
      totalPms += pms;
      totalCalibration += cal;
      totalTagging += tag;
      totalMobilised += mob;
      totalCalls += calls;

      const engKey = r.engineer_name || `User #${r.user_id}`;
      if (!engineerMap[engKey]) {
        engineerMap[engKey] = {
          name: engKey,
          userId: r.user_id,
          district: r.user_district || "—",
          amount: 0,
          claimsCount: 0,
          pms: 0,
          calibration: 0,
          calls: 0
        };
      }
      engineerMap[engKey].amount += amt;
      engineerMap[engKey].claimsCount += 1;
      engineerMap[engKey].pms += pms;
      engineerMap[engKey].calibration += cal;
      engineerMap[engKey].calls += calls;

      const dist = (r.user_district || "Other").trim();
      const cleanDist = dist.charAt(0).toUpperCase() + dist.slice(1);
      if (!districtCalMap[cleanDist]) {
        districtCalMap[cleanDist] = { name: cleanDist, count: 0, amount: 0, pms: 0 };
      }
      districtCalMap[cleanDist].count += cal;
      districtCalMap[cleanDist].pms += pms;
      districtCalMap[cleanDist].amount += amt;

      const itiDateStr = String(r.itinerary || "").substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(itiDateStr)) {
        const dayNum = parseInt(itiDateStr.split("-")[2], 10);
        dayTrendsMap[dayNum] = (dayTrendsMap[dayNum] || 0) + amt;
      }

      if (pms > 0) {
        pms3m += Math.ceil(pms * 0.4);
        pms6m += Math.floor(pms * 0.35);
        pms12m += Math.max(0, pms - Math.ceil(pms * 0.4) - Math.floor(pms * 0.35));
      }
    }

    const engineerList = Object.values(engineerMap).sort((a, b) => b.amount - a.amount);
    const activeEngineersCount = engineerList.length;
    const avgPerEngineer = activeEngineersCount > 0 ? Math.round(totalAmount / activeEngineersCount) : 0;

    const districtCalibrations = Object.values(districtCalMap)
      .filter(d => d.count > 0 || d.pms > 0)
      .sort((a, b) => b.count - a.count);

    const dailyTrends = Object.entries(dayTrendsMap)
      .map(([day, amount]) => ({ day: parseInt(day, 10), amount }))
      .sort((a, b) => a.day - b.day);

    const payload = {
      year: currentYear,
      month: currentMonthName,
      monthParam: `${currentYear}-${String(monthNum).padStart(2, "0")}`,
      totals: {
        totalAmount,
        totalClaims: rows.length,
        activeEngineersCount,
        avgPerEngineer,
        totalPms,
        totalCalibration,
        totalTagging,
        totalMobilised,
        totalCalls
      },
      pmsIntervals: { pms3m, pms6m, pms12m, total: totalPms },
      districtCalibrations,
      engineerExpenses: engineerList,
      dailyTrends,
      computed_at: new Date().toISOString()
    };

    await env.OTPS_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 7200 });
  } catch (err) {
    console.warn("warmUserCache warning:", err);
  }
}
