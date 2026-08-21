import api from "./api";

export interface TRCMachine {
  id: number;
  trc_number: string;
  district: string;
  zone?: string;
  hospital_name: string;
  equipment_name: string;
  equipment_model?: string;
  barcode: string;
  serial_number?: string;
  complaint_id?: string;
  di_name?: string;
  coordinator_name?: string;
  dm_name?: string;
  complaint_date?: string;
  oem_name?: string;
  machine_status_prior?: string;
  warehouse_receive_date?: string;
  receive_date: string;
  receive_time: string;
  received_by_id: string;
  received_by_name: string;
  condition_received: "Good" | "Damaged" | "Broken" | "Missing Accessories";
  accessories_received?: string | string[]; // JSON string or array
  receive_notes?: string;
  video_url?: string;
  front_photo_url?: string;
  back_photo_url?: string;
  damage_photo_url?: string;
  current_status: TRCStatus;
  assigned_engineer_id?: string;
  assigned_engineer_name?: string;
  assigned_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TRCStatus =
  | "Machine Received in TRC"
  | "Assigned to Engineer"
  | "Diagnosis Completed"
  | "Waiting Spare Part"
  | "Repair In Progress"
  | "Repair Completed"
  | "QC Completed"
  | "Ready for Warehouse Dispatch"
  | "Dispatched"
  | "Field Confirmation Pending"
  | "Closed";

export interface TRCAssignment {
  id: number;
  trc_id: number;
  trc_number: string;
  assigned_engineer_id: string;
  assigned_engineer_name: string;
  assigned_by_id: string;
  assigned_by_name: string;
  assign_date: string;
  assign_time: string;
  notes?: string;
  status: string;
  created_at: string;
}

export interface TRCDiagnosis {
  id: number;
  trc_id: number;
  trc_number: string;
  diagnosis_date: string;
  diagnosis_time: string;
  issue_category: "Electrical" | "Mechanical" | "PCB" | "Calibration" | "Software" | "Display" | "Sensor" | "Other";
  root_cause: string;
  issue_description: string;
  repairable: "Yes" | "No";
  severity: "Critical" | "High" | "Medium" | "Low";
  diagnosis_video_url?: string;
  diagnosis_photos?: string | string[];
  diagnosed_by_id: string;
  diagnosed_by_name: string;
  created_at: string;
}

export interface TRCSpareRequest {
  id: number;
  trc_id: number;
  trc_number: string;
  spare_required: string;
  part_name: string;
  part_number?: string;
  quantity: number;
  part_photo_url?: string;
  damaged_part_photo_url?: string;
  remarks?: string;
  status: "Pending" | "Ordered" | "Received at TRC" | "Rejected";
  email_sent: number;
  email_recipients?: string;
  email_sent_at?: string;
  requested_by_id: string;
  requested_by_name: string;
  created_at: string;
}

export interface TRCRepair {
  id: number;
  trc_id: number;
  trc_number: string;
  repair_start_date: string;
  repair_start_time?: string;
  repair_end_date: string;
  repair_end_time?: string;
  activity_description: string;
  parts_used?: string;
  calibration_done: "Yes" | "No";
  testing_done: "Yes" | "No";
  repair_summary: string;
  repair_video_url?: string;
  repair_photos?: string | string[];
  repaired_by_id: string;
  repaired_by_name: string;
  created_at: string;
}

export interface TRCQC {
  id: number;
  trc_id: number;
  trc_number: string;
  power_on: number;
  self_test_passed: number;
  calibration_passed: number;
  display_ok: number;
  accessories_working: number;
  final_functional_test: number;
  all_checks_passed: number;
  qc_video_url?: string;
  qc_remarks?: string;
  qc_by_id: string;
  qc_by_name: string;
  qc_date: string;
  qc_time: string;
  status: "Passed" | "Failed" | "Conditional";
  created_at: string;
}

export interface TRCMedia {
  id: number;
  trc_id: number;
  trc_number?: string;
  stage: string;
  media_type: "video" | "photo" | "document";
  media_label?: string;
  file_url: string;
  r2_key?: string;
  original_filename?: string;
  file_size?: number;
  created_at: string;
}

export interface TRCStatusHistory {
  id: number;
  trc_id: number;
  trc_number?: string;
  from_status?: string;
  to_status: string;
  stage_name?: string;
  remarks?: string;
  changed_by_id: string;
  changed_by_name: string;
  created_at: string;
}

export interface TRCEmailLog {
  id: number;
  trc_id: number;
  trc_number?: string;
  subject: string;
  recipients: string;
  email_type: string;
  body_html?: string;
  status: string;
  sent_by_name: string;
  sent_at: string;
}

export interface TRCStats {
  total: number;
  received: number;
  assigned: number;
  diagnosisCompleted: number;
  waitingSpares: number;
  repairInProgress: number;
  repairCompleted: number;
  qcCompleted: number;
  readyDispatch: number;
  dispatched: number;
  closed: number;
}

export interface TRCEngineer {
  user_id: string;
  name: string;
  designation: string;
  mobile_number?: string;
  email?: string;
}

export const trcService = {
  /**
   * Step 1: Verify machine barcode and district
   */
  async verifyBarcode(district: string, barcode: string) {
    const res = await api.post("/trc/verify-barcode", { district, barcode });
    return res.data;
  },

  /**
   * Step 2: Receive machine into TRC
   */
  async receiveMachine(data: Partial<TRCMachine>) {
    const res = await api.post("/trc/receive", data);
    return res.data;
  },

  /**
   * List TRC machines with filter
   */
  async getMachines(params?: {
    zone?: string;
    district?: string;
    hospital?: string;
    status?: string;
    assigned_to?: string;
    search?: string;
    tab?: string;
    limit?: number;
    offset?: number;
  }) {
    const res = await api.get("/trc/machines", { params });
    return res.data;
  },

  /**
   * Get full details of machine bundle
   */
  async getMachineDetails(id: number | string) {
    const res = await api.get(`/trc/machines/${id}`);
    return res.data;
  },

  /**
   * Step 3: Assign machine to engineer
   */
  async assignMachine(data: {
    trc_id: number;
    assigned_engineer_id: string;
    assigned_engineer_name: string;
    assign_date?: string;
    assign_time?: string;
    notes?: string;
  }) {
    const res = await api.post("/trc/assign", data);
    return res.data;
  },

  /**
   * Step 4: Submit diagnosis
   */
  async saveDiagnosis(data: {
    trc_id: number;
    issue_category: string;
    root_cause: string;
    issue_description: string;
    repairable: "Yes" | "No";
    severity: "Critical" | "High" | "Medium" | "Low";
    diagnosis_video_url?: string;
    diagnosis_photos?: string[];
    diagnosis_date?: string;
    diagnosis_time?: string;
  }) {
    const res = await api.post("/trc/diagnosis", data);
    return res.data;
  },

  /**
   * Step 5: Request spare part
   */
  async requestSparePart(data: {
    trc_id: number;
    part_name: string;
    part_number?: string;
    quantity: number;
    part_photo_url?: string;
    damaged_part_photo_url?: string;
    remarks?: string;
  }) {
    const res = await api.post("/trc/spare-request", data);
    return res.data;
  },

  /**
   * Update spare part requisition status
   */
  async updateSpareStatus(data: { spare_id: number; status: string; remarks?: string }) {
    const res = await api.post("/trc/spare-status", data);
    return res.data;
  },

  /**
   * Step 6: Save repair activity
   */
  async saveRepair(data: {
    trc_id: number;
    activity_description: string;
    repair_summary: string;
    parts_used?: string;
    calibration_done: "Yes" | "No";
    testing_done: "Yes" | "No";
    repair_start_date?: string;
    repair_start_time?: string;
    repair_end_date?: string;
    repair_end_time?: string;
    repair_video_url?: string;
    repair_photos?: string[];
  }) {
    const res = await api.post("/trc/repair", data);
    return res.data;
  },

  /**
   * Step 7: Save Quality Check
   */
  async saveQC(data: {
    trc_id: number;
    power_on: boolean;
    self_test_passed: boolean;
    calibration_passed: boolean;
    display_ok: boolean;
    accessories_working: boolean;
    final_functional_test: boolean;
    qc_video_url?: string;
    qc_remarks?: string;
    qc_date?: string;
    qc_time?: string;
  }) {
    const res = await api.post("/trc/qc", data);
    return res.data;
  },

  /**
   * Dispatch machine
   */
  async dispatchMachine(data: {
    trc_id: number;
    courier_name?: string;
    tracking_number?: string;
    destination?: string;
    dispatch_date?: string;
    remarks?: string;
  }) {
    const res = await api.post("/trc/dispatch", data);
    return res.data;
  },

  /**
   * Close machine lifecycle
   */
  async closeMachine(data: { trc_id: number; remarks?: string }) {
    const res = await api.post("/trc/close", data);
    return res.data;
  },

  /**
   * Get available TRC engineers
   */
  async getEngineers(): Promise<{ success: boolean; engineers: TRCEngineer[] }> {
    const res = await api.get("/trc/engineers");
    return res.data;
  },

  /**
   * Get KPI statistics
   */
  async getStats(): Promise<{ success: boolean; stats: TRCStats }> {
    const res = await api.get("/trc/stats");
    return res.data;
  },

  /**
   * Upload video/photo media directly to R2
   */
  async uploadMedia(
    file: File,
    stage: string,
    label?: string,
    trcId?: number,
    trcNumber?: string,
    onProgress?: (percent: number) => void
  ) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("stage", stage);
    if (label) formData.append("label", label);
    if (trcId) formData.append("trc_id", String(trcId));
    if (trcNumber) formData.append("trc_number", trcNumber);

    const res = await api.post("/trc/upload-media", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    return res.data;
  },

  /**
   * Fetch active location hierarchy dynamically from Database (Zones, Districts, Facilities)
   */
  async getDistricts(): Promise<{
    success: boolean;
    zones?: string[];
    districts?: string[];
    districtsByZone?: Record<string, string[]>;
    facilitiesByDistrict?: Record<string, string[]>;
    equipments?: string[];
    makes?: string[];
    hospitalMapping?: Record<string, { di_name?: string; coordinator_name?: string; zone_name?: string; district_name?: string }>;
    districtMapping?: Record<string, { dm_name?: string; coordinator_name?: string; di_name?: string }>;
    count?: number;
  }> {
    const res = await api.get("/trc/districts");
    return res.data;
  },
};
