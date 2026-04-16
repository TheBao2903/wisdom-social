import { DEFAULT_CHAT_USER_ID } from "@/constants/chat";

export function parseNumericUserId(
    rawUserId?: string | number | null,
): number | null {
    if (typeof rawUserId === "number") {
        return Number.isFinite(rawUserId) ? rawUserId : null;
    }

    if (typeof rawUserId === "string") {
        const parsed = Number(rawUserId);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

export function resolveEffectiveChatUserId(
    rawUserId?: string | number | null,
): number {
    // Temporary hard-code for chat rollout: always use default chat identity.
    void rawUserId;
    return DEFAULT_CHAT_USER_ID;
}
