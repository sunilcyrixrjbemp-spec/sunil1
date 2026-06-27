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
  }
};
