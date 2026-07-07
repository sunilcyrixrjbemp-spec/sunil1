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
    return [];
  },

  markAsRead: async (_id: number): Promise<any> => {
    return { success: true };
  },

  markAllAsRead: async (): Promise<any> => {
    return { success: true };
  },

  deleteNotification: async (_id: number): Promise<any> => {
    return { success: true };
  }
};
