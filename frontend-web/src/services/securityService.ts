import axiosClient from "../api/axiosClient";
import { clearAuthStorage } from "../utils/cookies";

export interface DeletionResult {
    success: boolean;
    message?: string;
    scheduledFor?: string;
    remainingDays?: number;
}

export interface SecurityResult {
    success: boolean;
    message?: string;
}

const DEFAULT_DELETION_DAYS = 15;

export const securityService = {
    async logoutAllDevices(): Promise<SecurityResult> {
        try {
            await axiosClient.post("auth/logout-all", {});
            clearAuthStorage();
            return { success: true };
        } catch (error: any) {
            // Still clear local data even if API fails so this device is signed out
            clearAuthStorage();
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Không thể đăng xuất tất cả thiết bị." };
        }
    },

    async requestAccountDeletion(pinCode?: string): Promise<DeletionResult> {
        try {
            const payload = pinCode ? { pinCode } : {};
            const response = await axiosClient.post("auth/request-deletion", payload);
            const data = response.data?.data ?? response.data;
            return {
                success: true,
                scheduledFor: data?.scheduledFor,
                remainingDays: data?.remainingDays ?? DEFAULT_DELETION_DAYS,
            };
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Không thể yêu cầu xóa tài khoản." };
        }
    },

    async cancelAccountDeletion(pinCode?: string): Promise<SecurityResult> {
        try {
            const payload = pinCode ? { pinCode } : {};
            const response = await axiosClient.post("auth/cancel-deletion", payload);
            const data = response.data?.data ?? response.data;
            return {
                success: true,
                message: data?.message || "Yêu cầu xóa tài khoản đã được hủy.",
            };
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Không thể hủy yêu cầu xóa tài khoản." };
        }
    },

    async setupPinCode(pinCode: string): Promise<SecurityResult> {
        try {
            await axiosClient.post("auth/setup-pin", { pinCode });
            return { success: true };
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Không thể cài đặt mã PIN." };
        }
    },

    async removePinCode(pinCode: string): Promise<SecurityResult> {
        try {
            await axiosClient.post("auth/remove-pin", { pinCode });
            return { success: true };
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Không thể xóa mã PIN." };
        }
    },

    // Xác thực mã PIN 2 lớp (2FA) của user hiện tại mà không thực hiện hành động nào.
    async verifyPin(pinCode: string): Promise<SecurityResult> {
        try {
            await axiosClient.post("auth/verify-pin", { pinCode });
            return { success: true };
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "";
            return { success: false, message: msg || "Mã PIN không chính xác." };
        }
    },
};

/**
 * Compute deletion-pending state from /auth/me-style user data.
 * Returns { pending, remainingDays } when account has a scheduled deletion in the future.
 */
export const computeDeletionStatus = (
    user: { deletionScheduledFor?: string | null } | null | undefined,
): { pending: boolean; remainingDays: number } => {
    if (!user?.deletionScheduledFor) return { pending: false, remainingDays: 0 };
    const scheduledFor = new Date(user.deletionScheduledFor);
    const now = new Date();
    if (scheduledFor <= now) return { pending: false, remainingDays: 0 };
    const ms = scheduledFor.getTime() - now.getTime();
    return {
        pending: true,
        remainingDays: Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24))),
    };
};

export default securityService;
