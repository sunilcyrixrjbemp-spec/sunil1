/**
 * ============================================================
 * Fast KV-Backed Analysis & Analytics Service
 * Cyrix Field Connect — Frontend
 * ============================================================
 */

import api from "./api";

export interface AnalysisSummaryTotals {
  totalAmount: number;
  totalClaims: number;
  activeEngineersCount: number;
  avgPerEngineer: number;
  totalPms: number;
  totalCalibration: number;
  totalTagging: number;
  totalMobilised: number;
  totalCalls: number;
}

export interface AnalysisPmsIntervals {
  pms3m: number;
  pms6m: number;
  pms12m: number;
  total: number;
}

export interface DistrictCalibrationItem {
  name: string;
  count: number;
  amount: number;
  pms: number;
}

export interface EngineerExpenseItem {
  name: string;
  userId: number;
  district: string;
  amount: number;
  claimsCount: number;
  pms: number;
  calibration: number;
  calls: number;
}

export interface DailyExpenseTrend {
  day: number;
  amount: number;
}

export interface AnalysisSummaryResponse {
  year: number;
  month: string;
  monthParam: string;
  totals: AnalysisSummaryTotals;
  pmsIntervals: AnalysisPmsIntervals;
  districtCalibrations: DistrictCalibrationItem[];
  engineerExpenses: EngineerExpenseItem[];
  dailyTrends: DailyExpenseTrend[];
  computed_at?: string;
  from_cache?: boolean;
}

export interface AnalysisFilterOptionsResponse {
  districts: string[];
  zones: string[];
  engineers: {
    id: number;
    user_id: string;
    name: string;
    district: string;
    zone: string;
    role: string;
  }[];
  computed_at?: string;
}

export interface AnalysisClaimsResponse {
  status: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: any[];
}

export const analysisService = {
  /**
   * Fetch instant KV-backed / pre-computed analysis summary
   */
  async getSummary(params: {
    month?: string;
    year?: number;
    viewMode?: "my" | "team";
    district?: string;
    engineer?: string;
    zone?: string;
    status?: string;
  }): Promise<AnalysisSummaryResponse> {
    const res = await api.get("/analysis/summary", { params });
    return res.data;
  },

  /**
   * Fetch distinct dropdown filter options
   */
  async getFilterOptions(params?: {
    month?: string;
    year?: number;
  }): Promise<AnalysisFilterOptionsResponse> {
    const res = await api.get("/analysis/filter-options", { params });
    return res.data;
  },

  /**
   * Fetch server-side paginated claims table
   */
  async getClaims(params: {
    month?: string;
    year?: number;
    page?: number;
    pageSize?: number;
    district?: string;
    engineer?: string;
    zone?: string;
    status?: string;
    search?: string;
  }): Promise<AnalysisClaimsResponse> {
    const res = await api.get("/analysis/claims", { params });
    return res.data;
  }
};
