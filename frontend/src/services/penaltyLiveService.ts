import api from "./api";

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
  }
};
