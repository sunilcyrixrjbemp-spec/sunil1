import api from "./api";

export interface ComplaintUploadResult {
  status: string;
  total_rows?: number;
  inserted: number;
  updated: number;
  skipped_final_closed: number;
  skipped_invalid: number;
}

export interface ComplaintJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_final_closed: number;
  skipped_invalid: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintPermissionUser {
  id: number;
  employee_code: string;
  name: string;
  role: string;
  district?: string;
  email?: string;
  has_permission: number;
  granted_by?: string;
  granted_at?: string;
}

export const complaintService = {
  // Check permission for current user
  checkPermission: async (): Promise<{ can_upload: boolean; is_admin: boolean }> => {
    const response = await api.get("/complaints/check-permission");
    return response.data;
  },

  // List all users and upload permissions (Admin only)
  listPermissions: async (): Promise<ComplaintPermissionUser[]> => {
    const response = await api.get("/complaints/permissions");
    return response.data.users || [];
  },

  // Toggle upload permission for a user (Admin only)
  togglePermission: async (targetUserId: string, isActive: boolean): Promise<any> => {
    const response = await api.post("/complaints/permissions/toggle", {
      target_user_id: targetUserId,
      is_active: isActive
    });
    return response.data;
  },

  // Path A: Upload a synchronous chunk of rows (2,000–5,000 rows)
  uploadChunk: async (rows: any[]): Promise<ComplaintUploadResult> => {
    const response = await api.post("/complaints/upload/chunk", { rows });
    return response.data;
  },

  // Path B: Initialize large asynchronous upload
  initLargeUpload: async (filename: string, totalRows?: number): Promise<{
    job_id: string;
    file_key: string;
    upload_endpoint: string;
  }> => {
    const response = await api.post("/complaints/upload/init-large", {
      filename,
      total_rows: totalRows
    });
    return response.data;
  },

  // Path B: Upload raw file directly to R2
  uploadFileToR2: async (uploadEndpoint: string, file: File, onProgress?: (pct: number) => void): Promise<any> => {
    const response = await api.put(uploadEndpoint, file, {
      headers: {
        "Content-Type": file.type || "text/csv"
      },
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) {
          const pct = Math.round((evt.loaded * 100) / evt.total);
          onProgress(pct);
        }
      }
    });
    return response.data;
  },

  // Path B: Enqueue job for background processing
  enqueueJob: async (jobId: string): Promise<any> => {
    const response = await api.post("/complaints/upload/enqueue", { job_id: jobId });
    return response.data;
  },

  // Path B: Poll job progress
  getJobStatus: async (jobId: string): Promise<ComplaintJobStatus> => {
    const response = await api.get(`/complaints/upload-jobs/${encodeURIComponent(jobId)}`);
    return response.data.job;
  }
};
