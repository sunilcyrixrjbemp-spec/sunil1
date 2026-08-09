import api from "./api";

export interface PenaltyRecord {
  id?: number | string;
  complaint_id: string;
  district_name: string;
  hospital_name: string;
  bar_code: string;
  equipment_name: string;
  equipment_model?: string;
  complaint_raise_date: string;
  attend_date: string;
  complaint_close_date: string;
  final_close_date?: string;
  attended_engineer_name?: string;
  close_engineer_id?: string;
  total_downtime?: number;
  total_penalty?: number;
  status?: string;
  created_at?: string;
}

export interface DailyPenaltyRecord {
  id: number;
  complaint_id: string;
  barcode: string;
  day_number: number;
  call_status: string;
  is_part_missing: boolean;
  is_standby_provided: boolean;
  is_exempted: boolean;
  exemption_reason: string;
  daily_penalty_amount: number;
  engineer_name: string;
  created_at: string;
}

export const penaltyService = {
  verifyBarcode: async (barcode: string) => {
    const res = await api.post("/penalty/verify-barcode", { barcode });
    return res.data;
  },

  savePenaltyEntries: async (entries: any[]) => {
    const res = await api.post("/penalty/save", { entries });
    return res.data;
  },

  getPenaltyList: async (params?: { district?: string; search?: string; complaint_id?: string }) => {
    const qp = new URLSearchParams();
    if (params?.district) qp.set("district", params.district);
    if (params?.search) qp.set("search", params.search);
    if (params?.complaint_id) qp.set("complaint_id", params.complaint_id);

    const res = await api.get(`/penalty/list?${qp.toString()}`);
    return res.data;
  }
};
