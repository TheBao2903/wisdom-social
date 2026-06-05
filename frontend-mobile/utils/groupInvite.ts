import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveExpoLanHost(): string | null {
    const hostUri =
        (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
        (
            Constants as unknown as {
                manifest?: { debuggerHost?: string };
                manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
            }
        ).manifest2?.extra?.expoClient?.hostUri ??
        (
            Constants as unknown as {
                manifest?: { debuggerHost?: string };
            }
        ).manifest?.debuggerHost;

    if (!hostUri || typeof hostUri !== "string") return null;
    return hostUri.split(":")[0]?.trim() || null;
}

export function buildGroupInviteUrl(token: string): string {
    const configuredUrl =
        process.env.EXPO_PUBLIC_WEB_URL ||
        process.env.EXPO_PUBLIC_INVITE_WEB_URL;
    const baseUrl =
        configuredUrl?.replace(/\/+$/, "") ||
        (resolveExpoLanHost()
            ? `http://${resolveExpoLanHost()}:5173`
            : Platform.OS === "android"
              ? "http://10.0.2.2:5173"
              : "http://localhost:5173");

    return `${baseUrl}/g/${token}`;
}

export function extractGroupInviteToken(
    value: string,
    options: { allowRawToken?: boolean } = {},
): string | null {
    const trimmed = value.trim();
    const match = trimmed.match(/(?:^|\/)g\/([A-Za-z0-9_-]+)/);
    if (match?.[1]) return match[1];

    if (options.allowRawToken === false) return null;

    const tokenOnly = trimmed.match(/^[A-Za-z0-9_-]{16,}$/);
    return tokenOnly?.[0] ?? null;
}
