import apiClient from "@/api/apiClient";

export interface UserPresenceStatus {
    userId: number;
    online: boolean;
    lastActiveAt?: string | null;
}

function unwrapData<T>(response: { data: any }): T {
    return (response.data?.data ?? response.data) as T;
}

function normalizeStatus(raw: any): UserPresenceStatus {
    return {
        userId: Number(raw?.userId),
        online: Boolean(raw?.online ?? raw?.isOnline),
        lastActiveAt: raw?.lastActiveAt ?? null,
    };
}

const presenceService = {
    async getUserStatus(userId: number): Promise<UserPresenceStatus> {
        const response = await apiClient.get(`/users/status/${userId}`);
        return normalizeStatus(unwrapData<any>(response));
    },

    async getBulkStatus(userIds: number[]): Promise<UserPresenceStatus[]> {
        if (userIds.length === 0) return [];

        const response = await apiClient.post("/users/status/bulk", userIds);
        const data = unwrapData<any[]>(response);
        return Array.isArray(data) ? data.map(normalizeStatus) : [];
    },
};

export default presenceService;
