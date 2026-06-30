import api from "./api";

export const expenseService = {
  getExpenses: async (): Promise<any[]> => {
    const response = await api.get("/expense/");
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

  getTeamExpenses: async (): Promise<any[]> => {
    const response = await api.get("/expense/team");
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

  verifyBarcode: async (barcode: string): Promise<any> => {
    const response = await api.get(`/expense/verify-barcode?barcode=${barcode}`);
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
  }
};
