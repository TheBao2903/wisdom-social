import apiClient from "@/api/apiClient";
import type { ApiResponse, Notification } from "@/types";

const API_PATH = "/notifications";

const unwrapSuccess = <T>(payload: ApiResponse<T> | T): { success: boolean; data: T | null } => {
    if (payload && typeof payload === "object" && "success" in payload) {
        const response = payload as ApiResponse<T>;
        return { success: response.success, data: response.data ?? null };
    }
    return { success: true, data: payload as T };
};

export const getNotifications = async (
    page: number = 0,
    size: number = 20,
): Promise<Notification[]> => {
    try {
        const response = await apiClient.get<ApiResponse<Notification[]> | Notification[]>(
            `${API_PATH}?page=${page}&size=${size}`,
        );
        const { success, data } = unwrapSuccess<Notification[]>(response.data);
        if (success && Array.isArray(data)) return data;
        return [];
    } catch (error) {
        console.error("notificationService: Error fetching notifications:", error);
        return [];
    }
};

export const getUnreadCount = async (): Promise<number> => {
    try {
        const response = await apiClient.get<ApiResponse<number> | number>(`${API_PATH}/unread-count`);
        const { success, data } = unwrapSuccess<number>(response.data);
        if (success && typeof data === "number") return data;
        return 0;
    } catch (error) {
        console.error("notificationService: Error fetching unread count:", error);
        return 0;
    }
};

export const markAsRead = async (notificationId: string): Promise<boolean> => {
    try {
        const response = await apiClient.put<ApiResponse<void>>(`${API_PATH}/${notificationId}/read`);
        return Boolean(response.data?.success ?? true);
    } catch (error) {
        console.error("notificationService: Error marking notification as read:", error);
        return false;
    }
};

export const markAllAsRead = async (): Promise<boolean> => {
    try {
        const response = await apiClient.put<ApiResponse<void>>(`${API_PATH}/read-all`);
        return Boolean(response.data?.success ?? true);
    } catch (error) {
        console.error("notificationService: Error marking all notifications as read:", error);
        return false;
    }
};
