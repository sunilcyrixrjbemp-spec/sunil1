import api from "./api";

// ─── KPI Summary ──────────────────────────────────────────────────────────────
export interface LivePenaltyKPIs {
  total_complaints: number;
  total_accumulated_penalty: number;
  total_attend_penalty: number;
  total_delay_penalty: number;
  total_per_day_penalty: number;
  open_tickets: number;
  closed_tickets: number;
  open_penalty_tickets: number;
  critical_open_count: number;
  mch_open_count: number;
  others_open_count: number;
  mch_per_day_penalty: number;
  others_per_day_penalty: number;
}

export interface DistrictPenaltyStat {
  district: string;
  di_name: string;
  coordinator: string;
  zone: string;
  open_tickets: number;
  open_penalty_tickets: number;
  total_penalty: number;
  per_day_penalty: number;
  mch_per_day: number;
  others_per_day: number;
  unattended_count: number;
}

export interface CoordinatorPenaltyStat {
  coordinator: string;
  total_penalty: number;
  per_day_penalty: number;
  open_tickets: number;
  open_penalty_tickets: number;
}

export interface ZonePenaltyStat {
  zone: string;
  total_penalty: number;
  per_day_penalty: number;
  open_tickets: number;
}

export interface LivePenaltySummaryResponse {
  status: string;
  live_timestamp: string;
  kpis: LivePenaltyKPIs;
  districts: DistrictPenaltyStat[];
  coordinators: CoordinatorPenaltyStat[];
  zones: ZonePenaltyStat[];
}

// ─── Complaint Records ────────────────────────────────────────────────────────
export interface ComplaintPenaltyRecord {
  complaint_id: string;
  district_name: string;
  hospital_name: string;
  hospital_type: "MCH" | "Others";
  equipment_name: string;
  equipment_model: string;
  is_critical: boolean;
  asset_value: number;
  penalty_slab: number;
  status: "Open" | "Closed";
  complaint_status: string;
  is_under_warranty: "Yes" | "No";
  standby: "Yes" | "No";
  attend_hour_diff: number;
  attend_penalty: number;
  attend_per_day: number;
  penalty_down_days: number;
  delay_penalty: number;
  per_day_delay_penalty: number;
  total_penalty: number;
  total_per_day: number;
  di_name: string;
  coordinator_name: string;
  zone_name: string;
  complaint_raise_date: string;
  complaint_close_date: string;
  attend_date: string;
  bar_code: string;
}

export interface LivePenaltyRecordsResponse {
  status: string;
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  records: ComplaintPenaltyRecord[];
}

// ─── Repeater Calls ───────────────────────────────────────────────────────────
export interface RepeaterCallEntry {
  group_key: string;
  bar_code: string;
  equipment_name: string;
  equipment_model: string;
  hospital_name: string;
  district_name: string;
  hospital_type: "MCH" | "Others";
  is_critical: boolean;
  di_name: string;
  coordinator_name: string;
  zone_name: string;
  complaint_count: number;
  open_count: number;
  closed_count: number;
  total_penalty: number;
  per_day_penalty: number;
  total_downtime_days: number;
  last_complaint_date: string | null;
  recent_complaints: {
    complaint_id: string;
    status: string;
    raise_date: string;
    close_date: string;
    total_penalty: number;
    per_day: number;
    downtime_days: number;
  }[];
}

export interface RepeaterSummary {
  total_repeater_groups: number;
  total_repeater_complaints: number;
  total_repeater_penalty: number;
  total_repeater_per_day: number;
  active_repeaters: number;
}

export interface LivePenaltyRepeatersResponse {
  status: string;
  live_timestamp: string;
  group_by: string;
  min_count: number;
  summary: RepeaterSummary;
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  repeaters: RepeaterCallEntry[];
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const penaltyLiveService = {
  async getSummary(): Promise<LivePenaltySummaryResponse> {
    const res = await api.get("/complaints/live-penalty/summary");
    return res.data;
  },

  async getRecords(params: {
    page?: number;
    limit?: number;
    district?: string;
    status?: "open" | "closed" | "all";
    critical?: "yes" | "no" | "";
    search?: string;
    only_penalty?: boolean;
  }): Promise<LivePenaltyRecordsResponse> {
    const res = await api.get("/complaints/live-penalty/records", { params });
    return res.data;
  },

  async getRepeaters(params: {
    page?: number;
    limit?: number;
    group_by?: "equipment" | "hospital";
    min_count?: number;
    district?: string;
  }): Promise<LivePenaltyRepeatersResponse> {
    const res = await api.get("/complaints/live-penalty/repeaters", { params });
    return res.data;
  }
};
