import api from "./api";

export interface NotificationItem {
  id: number;
  user_id: string;
  title: string;
  description: string;
  type: "warning" | "success" | "error" | "info";
  read: boolean;
  link: string;
  created_at: string;
}

export const notificationService = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const response = await api.get("/notifications/");
    return response.data;
  },

  markAsRead: async (id: number): Promise<any> => {
    const response = await api.post(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<any> => {
    const response = await api.post("/notifications/read-all");
    return response.data;
  },

  deleteNotification: async (id: number): Promise<any> => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  }
};
