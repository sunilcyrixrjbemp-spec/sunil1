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

    // Precompute for all 12 months of current year + last year's previous 3 months
    const targetMonths = [];
    for (let m = 0; m < 12; m++) {
      targetMonths.push({
        year: currentYear,
        monthName: MONTH_NAMES[m],
        monthNum: m + 1
      });
    }
    // Also include previous year's Q4
    for (let m = 9; m < 12; m++) {
      targetMonths.push({
        year: currentYear - 1,
        monthName: MONTH_NAMES[m],
        monthNum: m + 1
      });
    }

    console.log(`[Cron Precompute] Warming Universal Master Analysis dataset across ${targetMonths.length} months`);

    for (const m of targetMonths) {
      const monthParam = `${m.year}-${String(m.monthNum).padStart(2, "0")}`;
      const masterKey = `analysis_master:${m.year}_${m.monthNum}`;

      // Universal SQL query matching all month storage formats
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
        m.year,
        m.monthName,
        m.monthName.toLowerCase(),
        String(m.monthNum),
        String(m.monthNum).padStart(2, "0"),
        `%${m.monthName.toLowerCase()}%`,
        `${monthParam}%`,
        `${monthParam}%`
      ];

      const { results: allRows } = await env.DB.prepare(globalSql).bind(...binds).all();
      const rows = allRows || [];

      // 1. Store the Master Dataset in KV (shared by all users)
      await env.OTPS_KV.put(masterKey, JSON.stringify({ rows, computed_at: new Date().toISOString() }), { expirationTtl: 86400 });

      // 2. Compute Admin Statewide Summary
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

        const dist = (r.user_district || r.district_type || "Other").trim();
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
        monthParam,
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

      // Store in KV for admin statewide dashboard (TTL = 24 hours)
      const adminKey = `analysis_summary:admin:team:${m.year}_${m.monthNum}`;
      await env.OTPS_KV.put(adminKey, JSON.stringify(payload), { expirationTtl: 86400 });

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
      await env.OTPS_KV.put(filtersKey, JSON.stringify(filtersPayload), { expirationTtl: 86400 });
    }

    console.log("[Cron Precompute] Analytics cache warming completed successfully");
  } catch (err) {
    console.error("[Cron Precompute] Error warming analytics cache:", err);
  }
}
