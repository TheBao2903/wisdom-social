import apiClient from "@/api/apiClient";
import { buildS3Url } from "@/utils/s3";

export type FriendUser = {
    id: number;
    name?: string;
    username?: string;
    avatar?: string;
    avatarUrl?: string;
    phone?: string;
    bio?: string;
    mutualFriendsCount?: number;
};

type FriendMutationListener = () => void;

const friendMutationListeners = new Set<FriendMutationListener>();

export const emitFriendMutation = () => {
    friendMutationListeners.forEach((listener) => listener());
};

export const subscribeFriendMutations = (
    listener: FriendMutationListener,
): (() => void) => {
    friendMutationListeners.add(listener);
    return () => {
        friendMutationListeners.delete(listener);
    };
};

function toFriendUsers(payload: unknown): FriendUser[] | null {
    const candidates = [
        payload,
        (payload as { data?: unknown } | null)?.data,
        (payload as { data?: { data?: unknown } } | null)?.data?.data,
    ];

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) {
            continue;
        }

        const normalized = candidate
            .map((item) => {
                if (!item || typeof item !== "object") return null;

                const raw = item as Record<string, unknown>;
                const id = Number(raw.userId ?? raw.id);
                if (!Number.isFinite(id)) return null;
                const avatarUrl = buildS3Url(
                    (typeof raw.avatarUrl === "string" && raw.avatarUrl.trim()) ||
                        (typeof raw.avatar === "string" && raw.avatar.trim()) ||
                        undefined,
                );

                return {
                    id,
                    name:
                        (typeof raw.name === "string" && raw.name.trim()) ||
                        undefined,
                    username:
                        (typeof raw.username === "string" &&
                            raw.username.trim()) ||
                        undefined,
                    avatarUrl,
                    avatar: avatarUrl,
                    phone:
                        (typeof raw.phone === "string" && raw.phone.trim()) ||
                        undefined,
                } as FriendUser;
            })
            .filter((item): item is FriendUser => Boolean(item));

        return normalized;
    }

    return null;
}

class FriendService {
    async getFriends(userId: number): Promise<FriendUser[]> {
        try {
            const response = await apiClient.get(`/friends/${userId}`);
            return toFriendUsers(response.data) ?? [];
        } catch {
            return [];
        }
    }

    async getSentRequests(userId: number): Promise<FriendUser[]> {
        try {
            const response = await apiClient.get(`/friends/sent-requests/${userId}`);
            return toFriendUsers(response.data) ?? [];
        } catch {
            return [];
        }
    }

    async getFriendRequests(userId: number): Promise<FriendUser[]> {
        try {
            const response = await apiClient.get(`/friends/requests/${userId}`);
            return toFriendUsers(response.data) ?? [];
        } catch {
            return [];
        }
    }

    async sendFriendRequest(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/friends/request", { senderId, receivedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }

    async acceptFriendRequest(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/friends/accept", { senderId, receivedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }

    async rejectFriendRequest(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/friends/reject", { senderId, receivedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }

    async cancelFriendRequest(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/friends/cancel", { senderId, receivedId });
            emitFriendMutation();
            return true;
        } catch {
            return false;
        }
    }

    async getFriendSuggestions(userId: number, limit = 20): Promise<FriendUser[]> {
        try {
            const response = await apiClient.get(`/friends/suggestions/${userId}`, {
                params: { limit },
            });
            return toFriendUsers(response.data) ?? [];
        } catch {
            return [];
        }
    }

    async getFriendStatus(myId: number, targetId: number): Promise<"NONE" | "SENT" | "RECEIVED" | "FRIEND" | "BLOCKED" | "BLOCKED_BY"> {
        try {
            const [blockedList, targetBlockedList, myFriends, receivedRequests, sentRequests] = await Promise.all([
                apiClient.get(`/auth/users/blocked/${myId}`).then((r) => toFriendUsers(r.data) ?? []).catch(() => []),
                apiClient.get(`/auth/users/blocked/${targetId}`).then((r) => toFriendUsers(r.data) ?? []).catch(() => []),
                apiClient.get(`/friends/${myId}`).then((r) => toFriendUsers(r.data) ?? []).catch(() => []),
                apiClient.get(`/friends/requests/${myId}`).then((r) => toFriendUsers(r.data) ?? []).catch(() => []),
                apiClient.get(`/friends/sent-requests/${myId}`).then((r) => toFriendUsers(r.data) ?? []).catch(() => []),
            ]);

            const hasId = (list: FriendUser[], id: number) =>
                list.some((u) => Number(u.id) === id);

            if (hasId(blockedList, targetId)) return "BLOCKED";
            if (hasId(targetBlockedList, myId)) return "BLOCKED_BY";
            if (hasId(myFriends, targetId)) return "FRIEND";
            if (hasId(receivedRequests, targetId)) return "RECEIVED";
            if (hasId(sentRequests, targetId)) return "SENT";
            return "NONE";
        } catch {
            return "NONE";
        }
    }
}

export default new FriendService();
