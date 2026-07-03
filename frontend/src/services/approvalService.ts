import api from "./api";

const getLocalTimestamp = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const approvalService = {
  getPendingApprovals: async (): Promise<any[]> => {
    const response = await api.get("/approval/");
    return response.data;
  },

  approveExpense: async (expenseId: number, comments: string, itineraryEdits?: any[], approvedValue?: number): Promise<any> => {
    const response = await api.post(`/approval/${expenseId}/approve`, {
      comments,
      itinerary_edits: itineraryEdits,
      client_timestamp: getLocalTimestamp(),
      approved_value: approvedValue
    });
    return response.data;
  },

  rejectExpense: async (expenseId: number, comments: string, itineraryEdits?: any[]): Promise<any> => {
    const response = await api.post(`/approval/${expenseId}/reject`, {
      comments,
      itinerary_edits: itineraryEdits,
      client_timestamp: getLocalTimestamp()
    });
    return response.data;
  }
};
