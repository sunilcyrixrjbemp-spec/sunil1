import api from "./api";

export interface TicketCreatePayload {
  concern_type: string;  // Expense, Profile, TA/DA
  expense_id?: number | null;
  expense_code?: string | null;
  priority: string;  // Low, Medium, High, Critical
  description: string;
  assigned_to_name: string;  // Select reporting manager or coordinator name
}

export const ticketService = {
  getTickets: async (): Promise<any[]> => {
    const response = await api.get("/ticket/");
    return response.data;
  },

  createTicket: async (payload: TicketCreatePayload): Promise<any> => {
    const response = await api.post("/ticket/", payload);
    return response.data;
  },

  addComment: async (ticketId: number, comment: string): Promise<any> => {
    const response = await api.post(`/ticket/${ticketId}/comment`, { comment });
    return response.data;
  },

  closeTicket: async (ticketId: number): Promise<any> => {
    const response = await api.post(`/ticket/${ticketId}/close`);
    return response.data;
  },

  reopenTicket: async (ticketId: number): Promise<any> => {
    const response = await api.post(`/ticket/${ticketId}/reopen`);
    return response.data;
  },

  toggleFollowup: async (ticketId: number): Promise<any> => {
    const response = await api.post(`/ticket/${ticketId}/followup`);
    return response.data;
  }
};
