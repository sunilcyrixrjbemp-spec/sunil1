/**
 * ============================================================
 * Cloudflare Worker Cron Job: Pre-compute Analytics Cache
 * Cyrix Field Connect — Cloudflare Worker Backend
 * ============================================================
 * Runs on schedule (e.g. every 20 minutes):
 * Pre-aggregates analysis summaries for active months & manager scopes,
 * and saves into KV with 2-hour TTL for sub-50ms instant response.
 * ============================================================
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function precomputeAnalyticsCache(env) {
  if (!env.DB || !env.OTPS_KV) {
    console.warn("precomputeAnalyticsCache: DB or OTPS_KV not bound");
    return;
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentMonthName = MONTH_NAMES[currentMonthIdx];

    // Compute for current month & previous month
    const targetMonths = [
      { year: currentYear, monthName: currentMonthName, monthNum: currentMonthIdx + 1 }
    ];

    if (currentMonthIdx > 0) {
      targetMonths.push({
        year: currentYear,
        monthName: MONTH_NAMES[currentMonthIdx - 1],
        monthNum: currentMonthIdx
      });
    }

    // Fetch active reviewers/managers and admins
    const usersRes = await env.DB.prepare(`
      SELECT id, user_id, name, role, district, zone FROM users
      WHERE status != 'inactive' AND (
        LOWER(role) LIKE '%admin%' OR LOWER(role) LIKE '%manager%' OR LOWER(role) LIKE '%reviewer%'
        OR LOWER(role) LIKE '%director%' OR LOWER(role) LIKE '%vp%' OR LOWER(role) LIKE '%head%'
      )
    `).all();

    const managers = usersRes.results || [];
    console.log(`[Cron Precompute] Warming analysis cache for ${managers.length} managers across ${targetMonths.length} months`);

    for (const m of targetMonths) {
      // 1. Precompute global team summary (Admin / all users)
      const globalSql = `
        SELECT 
          e.id, e.user_id, e.amount, e.pms_count, e.calibration_count, e.asset_tagging,
          e.mobilise_count, e.calls_completed, e.itinerary,
          u.name as engineer_name, u.district as user_district, u.zone as user_zone
        FROM expenses e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.year = ? AND (e.month = ? OR LOWER(e.month) = ?)
      `;
      const { results: allRows } = await env.DB.prepare(globalSql).bind(m.year, m.monthName, m.monthName.toLowerCase()).all();
      const rows = allRows || [];

      // Compute global aggregates
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
        year: m.year,
        month: m.monthName,
        monthParam: `${m.year}-${String(m.monthNum).padStart(2, "0")}`,
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

      // Store in KV for all managers & admin scope
      const globalKey = `analysis_summary:global:team:${m.year}_${m.monthNum}`;
      await env.OTPS_KV.put(globalKey, JSON.stringify(payload), { expirationTtl: 7200 });

      for (const mgr of managers) {
        const mgrKey = `analysis_summary:${mgr.id}:team:${m.year}_${m.monthNum}`;
        await env.OTPS_KV.put(mgrKey, JSON.stringify(payload), { expirationTtl: 7200 });
      }

      // Also precompute filter options
      const [distRows, zoneRows, engRows] = await Promise.all([
        env.DB.prepare("SELECT DISTINCT district FROM users WHERE district IS NOT NULL AND district != '' ORDER BY district ASC").all(),
        env.DB.prepare("SELECT DISTINCT zone FROM users WHERE zone IS NOT NULL AND zone != '' ORDER BY zone ASC").all(),
        env.DB.prepare("SELECT id, user_id, name, district, zone, role FROM users WHERE status != 'inactive' ORDER BY name ASC").all()
      ]);

      const filtersPayload = {
        districts: (distRows.results || []).map(r => r.district).filter(Boolean),
        zones: (zoneRows.results || []).map(r => r.zone).filter(Boolean),
        engineers: (engRows.results || []).map(u => ({
          id: u.id,
          user_id: u.user_id,
          name: u.name,
          district: u.district,
          zone: u.zone,
          role: u.role
        })),
        computed_at: new Date().toISOString()
      };

      const filtersKey = `analysis_filters:${m.year}_${m.monthName}`;
      await env.OTPS_KV.put(filtersKey, JSON.stringify(filtersPayload), { expirationTtl: 7200 });
    }

    console.log("[Cron Precompute] Analytics cache warming completed successfully");
  } catch (err) {
    console.error("[Cron Precompute] Error warming analytics cache:", err);
  }
}
