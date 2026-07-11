import api from "./api";

export const expenseService = {
  getExpenses: async (month?: string): Promise<any[]> => {
    const qp = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await api.get(`/expense/${qp}`);
    return response.data;
  },

  getExpenseInit: async (userId: string, month: string): Promise<any> => {
    const response = await api.get(`/expense/init?user_id=${userId}&month=${month}`);
    return response.data;
  },

  createLimitRequest: async (userId: string, type: string, amount: number, month?: string): Promise<any> => {
    const response = await api.post(`/expense/limit-request`, {
      user_id: userId,
      type: type,
      amount: amount,
      month: month
    });
    return response.data;
  },

  submitItineraryExpense: async (formData: FormData): Promise<any> => {
    const response = await api.post("/expense/", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  },

  getTeamExpenses: async (month?: string): Promise<any[]> => {
    const qp = month ? `?month=${encodeURIComponent(month)}` : "";
    const response = await api.get(`/expense/team${qp}`);
    return response.data;
  },

  getTeamUsers: async (): Promise<any[]> => {
    const response = await api.get("/expense/team-users");
    return response.data;
  },

  getKpiAppraisal: async (userId: string, month: string, year: number): Promise<any> => {
    const response = await api.get(`/expense/kpi-appraisal?user_id=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}&year=${year}`);
    return response.data;
  },

  saveKpiAppraisal: async (payload: any): Promise<any> => {
    const response = await api.post("/expense/kpi-appraisal", payload);
    return response.data;
  },

  getExpenseDetails: async (expenseId: number | string): Promise<any> => {
    const response = await api.get(`/expense/${expenseId}`);
    return response.data;
  },

  deleteExpense: async (expenseId: number): Promise<any> => {
    const response = await api.delete(`/expense/${expenseId}`);
    return response.data;
  },

  verifyBarcode: async (barcode: string, hospital?: string): Promise<any> => {
    const url = hospital 
      ? `/expense/verify-barcode?barcode=${barcode}&hospital=${encodeURIComponent(hospital)}` 
      : `/expense/verify-barcode?barcode=${barcode}`;
    const response = await api.get(url);
    return response.data;
  },

  getAssetValueMaster: async (): Promise<any[]> => {
    const response = await api.get("/expense/asset-value-master");
    return response.data;
  },

  getMonthSummary: async (params?: { month?: string; year?: number; district?: string; engineer?: string }): Promise<any> => {
    const qp = new URLSearchParams();
    if (params?.month) qp.set("month", params.month);
    if (params?.year) qp.set("year", String(params.year));
    if (params?.district) qp.set("district", params.district);
    if (params?.engineer) qp.set("engineer", params.engineer);
    const response = await api.get(`/expense/month-summary${qp.toString() ? "?" + qp.toString() : ""}`);
    return response.data;
  },

  getEngineerMonthClaims: async (userCode: string, month: string, year: number): Promise<any> => {
    const response = await api.get(
      `/expense/engineer-month-claims?user_code=${encodeURIComponent(userCode)}&month=${encodeURIComponent(month)}&year=${year}`
    );
    return response.data;
  },

  getEngineerAdvance: async (userCode: string, month: string, year: number): Promise<any> => {
    const response = await api.get(
      `/expense/engineer-advance?user_code=${encodeURIComponent(userCode)}&month=${encodeURIComponent(month)}&year=${year}`
    );
    return response.data;
  },

  saveEngineerAdvance: async (userCode: string, month: string, year: number, amount: number): Promise<any> => {
    const response = await api.post("/expense/engineer-advance", {
      user_code: userCode,
      month: month,
      year: year,
      advance_amount: amount
    });
    return response.data;
  },

  getConsolidatedReport: async (month: string, year: number): Promise<any> => {
    const response = await api.get(`/expense/consolidated-report?month=${encodeURIComponent(month)}&year=${year}`);
    return response.data;
  },

  getPolicyRules: async (grade: string): Promise<any> => {
    const response = await api.get(`/expense/policy-rules?grade=${encodeURIComponent(grade)}`);
    return response.data;
  }
};
