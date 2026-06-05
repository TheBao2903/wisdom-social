import apiClient from "@/api/apiClient";
import { clearStorage } from "@/utils/storage";

export async function logoutAllDevices(): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/logout-all");
        await clearStorage();
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Không thể đăng xuất tất cả thiết bị.' };
    }
}

export async function setupPinCode(pinCode: string): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/setup-pin", { pinCode });
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Không thể cài đặt mã PIN.' };
    }
}

export async function removePinCode(pinCode: string): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/remove-pin", { pinCode });
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Không thể xóa mã PIN.' };
    }
}

// Xác thực mã PIN 2 lớp (2FA) của user hiện tại, không thực hiện hành động nào.
export async function verifyPin(pinCode: string): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/verify-pin", { pinCode });
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Mã PIN không chính xác.' };
    }
}

export async function requestAccountDeletion(pinCode?: string): Promise<{
    success: boolean;
    message?: string;
    scheduledFor?: string;
    remainingDays?: number;
}> {
    try {
        const payload = pinCode ? { pinCode } : {};
        const response = await apiClient.post("/auth/request-deletion", payload);
        const data = response.data?.data ?? response.data;
        return {
            success: true,
            scheduledFor: data?.scheduledFor,
            remainingDays: data?.remainingDays ?? 30,
        };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Không thể yêu cầu xóa tài khoản.' };
    }
}

export async function cancelAccountDeletion(pinCode?: string): Promise<{ success: boolean; message?: string }> {
    try {
        const payload = pinCode ? { pinCode } : {};
        const response = await apiClient.post("/auth/cancel-deletion", payload);
        const data = response.data?.data ?? response.data;
        return { success: true, message: data?.message || "Hủy xóa tài khoản thành công." };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: msg || 'Không thể hủy yêu cầu xóa tài khoản.' };
    }
}
