import axiosClient from "../api/axiosClient";
import type { ApiResponse, Notification } from "../types";

const API_PATH = "/notifications";

export const getNotifications = async (
  page: number = 0,
  size: number = 20
): Promise<Notification[]> => {
  try {
    console.log(`notificationService: Fetching notifications (page: ${page}, size: ${size})`);
    const response = await axiosClient.get<ApiResponse<Notification[]>>(
      `${API_PATH}?page=${page}&size=${size}`
    );

    if (response.data.success && response.data.data) {
      console.log(`notificationService: Successfully fetched ${response.data.data.length} notifications`);
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error("notificationService: Error fetching notifications:", error);
    return [];
  }
};

export const getUnreadCount = async (): Promise<number> => {
  try {
    const response = await axiosClient.get<ApiResponse<number>>(`${API_PATH}/unread-count`);

    if (response.data.success && response.data.data !== null) {
      return response.data.data;
    }
    return 0;
  } catch (error) {
    console.error("notificationService: Error fetching unread count:", error);
    return 0;
  }
};

export const markAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const response = await axiosClient.put<ApiResponse<void>>(`${API_PATH}/${notificationId}/read`);
    return response.data.success;
  } catch (error) {
    console.error("notificationService: Error marking notification as read:", error);
    return false;
  }
};
export const markAllAsRead = async (): Promise<boolean> => {
  try {
    const response = await axiosClient.put<ApiResponse<void>>(`${API_PATH}/read-all`);
    return response.data.success;
  } catch (error) {
    console.error("notificationService: Error marking all notifications as read:", error);
    return false;
  }
};
