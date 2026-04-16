import apiClient from "@/api/apiClient";

export type DeviceSettingDTO = {
    id?: number;
    userId?: number;
    deviceName: string;
    deviceType: string;
    themeMode?: "light" | "dark" | "system";
    pushEnabled?: boolean;
    likesEnabled?: boolean;
    commentsEnabled?: boolean;
    followsEnabled?: boolean;
    messagesEnabled?: boolean;
    pageUpdatesEnabled?: boolean;
};

class DeviceSettingService {
    async get(deviceName: string, deviceType: string): Promise<DeviceSettingDTO | null> {
        try {
            const res = await apiClient.get("/device-settings", {
                params: { deviceName, deviceType },
            });
            return res.data?.data ?? res.data ?? null;
        } catch {
            return null;
        }
    }

    async save(dto: DeviceSettingDTO): Promise<DeviceSettingDTO | null> {
        try {
            const res = await apiClient.put("/device-settings", dto);
            return res.data?.data ?? res.data ?? null;
        } catch {
            return null;
        }
    }
}

export default new DeviceSettingService();
