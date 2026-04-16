import * as Device from "expo-device";
import { Platform } from "react-native";

export type DeviceInfo = {
    deviceType: string;
    deviceName: string;
    ipAddress: string;
};

const getPublicIp = async (): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("https://api.ipify.org?format=json", {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const data = (await response.json()) as { ip?: string };
        return data.ip ?? "";
    } catch {
        return "";
    }
};

export const getDeviceInfo = async (): Promise<DeviceInfo> => {
    const os = Platform.OS.toUpperCase();
    const model = Device.modelName ?? Device.deviceName ?? "Unknown Device";
    const manufacturer = Device.manufacturer ?? "";
    const deviceName = manufacturer ? `${manufacturer} ${model}` : model;
    const ipAddress = await getPublicIp();

    return {
        deviceType: os,
        deviceName,
        ipAddress,
    };
};
