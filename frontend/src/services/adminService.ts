import api from "./api";

export interface UserCreatePayload {
  e_code: string;
  name: string;
  password: string;
  role: string;
  designation: string;
  grade: string;
  district: string;
  zone: string;
  manager: string;
  zonal_manager: string;
  coordinator: string;
  mobile_number: string;
  mail_id: string;
  type: string;
  date_of_joining: string; // YYYY-MM-DD format
  date_of_birth: string;   // YYYY-MM-DD format
  e_upkaran_id: string;
  allowed_windows?: string;
}

export interface UserEditPayload {
  name?: string;
  role?: string;
  designation?: string;
  grade?: string;
  district?: string;
  zone?: string;
  manager?: string;
  zonal_manager?: string;
  coordinator?: string;
  mobile_number?: string;
  mail_id?: string;
  user_status?: string; // active, locked, disabled
  type?: string;
  date_of_joining?: string;
  date_of_birth?: string;
  e_upkaran_id?: string;
  allowed_windows?: string;
  new_user_id?: string;
  new_e_code?: string;
  password?: string;
  admin_update_password?: string;
}

export interface HierarchyApprover {
  id?: number;
  level_number: number;
  approver_id: number;
  approver_name?: string;
  approver_code?: string;
  approver_role?: string;
}

export interface HierarchyRequester {
  id?: number;
  user_id: number;
  user_name?: string;
  user_code?: string;
}

export interface ApprovalHierarchy {
  id?: number;
  name: string;
  requester_ids: number[];
  requesters?: HierarchyRequester[];
  approvers: { level_number: number; approver_id: number }[] | HierarchyApprover[];
}

export interface ApprovalHierarchyResponse {
  id: number;
  name: string;
  requesters: HierarchyRequester[];
  approvers: HierarchyApprover[];
}

export const adminService = {
  getUsers: async (): Promise<any[]> => {
    const response = await api.get("/admin/users");
    return response.data;
  },

  createUser: async (data: UserCreatePayload): Promise<any> => {
    const response = await api.post("/admin/users", data);
    return response.data;
  },

  updateUser: async (userId: string, data: UserEditPayload): Promise<any> => {
    const response = await api.put(`/admin/users/${userId}`, data);
    return response.data;
  },

  bulkCreateUsers: async (data: UserCreatePayload[]): Promise<any> => {
    const response = await api.post("/admin/users/bulk", data);
    return response.data;
  },

  getEligibleApprovers: async (): Promise<any[]> => {
    const response = await api.get("/admin/eligible-approvers");
    return response.data;
  },

  getHierarchies: async (): Promise<ApprovalHierarchyResponse[]> => {
    const response = await api.get("/admin/hierarchies");
    return response.data;
  },

  saveHierarchy: async (data: ApprovalHierarchy): Promise<ApprovalHierarchyResponse> => {
    const response = await api.post("/admin/hierarchies", data);
    return response.data;
  },

  deleteHierarchy: async (hierarchyId: number): Promise<any> => {
    const response = await api.delete(`/admin/hierarchies/${hierarchyId}`);
    return response.data;
  },

  logoutAllUsers: async (): Promise<any> => {
    const response = await api.post("/admin/logout-all");
    return response.data;
  },

  logoutSingleUser: async (userCode: string): Promise<any> => {
    const response = await api.post(`/admin/logout-user/${userCode}`);
    return response.data;
  },

  exportHierarchies: async (): Promise<any> => {
    const response = await api.get("/admin/hierarchies/export", { responseType: "blob" });
    return response.data;
  },

  bulkImportHierarchies: async (data: any[]): Promise<any> => {
    const response = await api.post("/admin/hierarchies/bulk", { rows: data });
    return response.data;
  },

  getSettings: async (): Promise<any> => {
    const response = await api.get("/admin/settings");
    return response.data;
  },

  saveSettings: async (settings: any): Promise<any> => {
    const response = await api.post("/admin/settings", { settings });
    return response.data;
  },

  runMigrations: async (): Promise<any> => {
    const response = await api.post("/admin/run-migrations");
    return response.data;
  }
};
