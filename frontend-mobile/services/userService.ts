import apiClient from "@/api/apiClient";
import { buildS3Url } from "@/utils/s3";

export type UpdateUserPayload = {
    name?: string;
    username?: string;
    bio?: string;
    birthday?: string;
    gender?: "MALE" | "FEMALE" | "HIDDEN";
    website?: string;
    avatarUrl?: string;
    privacyProfile?: "PUBLIC" | "FRIENDS" | "ONLY_ME";
};

export type User = {
    id: string;
    username: string;
    fullName?: string;
    name?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
    phone?: string;
    birthday?: string;
    gender?: "MALE" | "FEMALE" | "HIDDEN";
    website?: string;
    followers?: number;
    following?: number;
    postsCount?: number;
    privacyProfile?: "PUBLIC" | "FRIENDS" | "ONLY_ME";
    isPrivate?: boolean;
    friendsCount?: number;
};

const mapUser = (raw: Record<string, unknown> | null | undefined): User => {
    const id = raw?.id;
    const username =
        typeof raw?.username === "string" && raw.username.trim()
            ? raw.username.trim()
            : `user${id ?? ""}`;
    const avatarUrl =
        typeof raw?.avatarUrl === "string"
            ? buildS3Url(raw.avatarUrl)
              : undefined;

    // Debug logging
    if (raw?.avatarUrl) {
        console.log('[userService] Raw avatarUrl:', raw.avatarUrl);
        console.log('[userService] Built S3 URL:', avatarUrl);
    }

    return {
        id: String(id ?? ""),
        username,
        fullName:
            (typeof raw?.name === "string" && raw.name.trim()) ||
            (typeof raw?.fullName === "string" && raw.fullName.trim()) ||
            username,
        name:
            (typeof raw?.name === "string" && raw.name.trim()) ||
            (typeof raw?.fullName === "string" && raw.fullName.trim()) ||
            undefined,
        phone: typeof raw?.phone === "string" ? raw.phone : undefined,
        bio: typeof raw?.bio === "string" ? raw.bio : undefined,
        avatarUrl,
        birthday: typeof raw?.birthday === "string" ? raw.birthday : undefined,
        gender:
            raw?.gender === "MALE" ||
            raw?.gender === "FEMALE" ||
            raw?.gender === "HIDDEN"
                ? raw.gender
                : undefined,
        followers:
            typeof raw?.followerCount === "number"
                ? raw.followerCount
                : typeof raw?.friendCount === "number"
                  ? raw.friendCount
                : typeof raw?.followers === "number"
                  ? raw.followers
                  : 0,
        following:
            typeof raw?.followingCount === "number"
                ? raw.followingCount
                : typeof raw?.following === "number"
                  ? raw.following
                  : 0,
        postsCount:
            typeof raw?.postCount === "number"
                ? raw.postCount
                : typeof raw?.postsCount === "number"
                  ? raw.postsCount
                  : 0,
        privacyProfile:
            raw?.privacyProfile === "PUBLIC" ||
            raw?.privacyProfile === "FRIENDS" ||
            raw?.privacyProfile === "ONLY_ME"
                ? raw.privacyProfile
                : undefined,
        isPrivate: typeof raw?.isPrivate === "boolean" ? raw.isPrivate : undefined,
        friendsCount: typeof raw?.friendsCount === "number" ? raw.friendsCount : undefined,
    };
};

const unwrapData = <T>(response: {
    data?: { data?: T } | T;
}): T | undefined => {
    const payload = response.data;
    if (payload && typeof payload === "object" && "data" in payload) {
        return (payload as { data?: T }).data;
    }
    return payload as T | undefined;
};

const userService = {
    async searchUserByUsername(username: string): Promise<User[] | null> {
        const keyword = username.trim();
        if (!keyword) return [];

        try {
            const response = await apiClient.get(
                `/auth/users/username/${encodeURIComponent(keyword)}`,
            );
            const data = unwrapData<Record<string, unknown>[]>(response);
            if (!Array.isArray(data)) return [];
            return data.map((item) => mapUser(item));
        } catch (error) {
            console.error("Error searching user:", error);
            return null;
        }
    },

    async updateUser(userId: string, data: UpdateUserPayload): Promise<User> {
        try {
            const payload: Record<string, string> = {};

            if (data.name !== undefined) payload.name = data.name.trim();
            if (data.username !== undefined)
                payload.username = data.username.trim();
            if (data.bio !== undefined) payload.bio = data.bio.trim();
            if (data.birthday !== undefined)
                payload.birthday = data.birthday.trim();
            if (data.gender) payload.gender = data.gender;
            if (data.avatarUrl !== undefined)
                payload.avatarUrl = data.avatarUrl.trim();
            if (data.privacyProfile) payload.privacyProfile = data.privacyProfile;

            const response = await apiClient.put(`/auth/users/${userId}`, payload);
            const updated = unwrapData<Record<string, unknown>>(response);
            return mapUser(updated);
        } catch (error) {
            console.error("Error updating user:", error);
            throw error;
        }
    },

    async getCurrentUser(): Promise<User | null> {
        try {
            const response = await apiClient.get("/auth/me");
            const data = unwrapData<Record<string, unknown>>(response);
            return data ? mapUser(data) : null;
        } catch (error) {
            console.error("Error fetching current user:", error);
            return null;
        }
    },

    async getUserProfile(userId: string | number): Promise<User | null> {
        try {
            const response = await apiClient.get(`/auth/user/${userId}`);
            const data = unwrapData<Record<string, unknown>>(response);
            return data ? mapUser(data) : null;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
    },

    async getAllUsers(): Promise<User[]> {
        try {
            const response = await apiClient.get("/auth/users");
            const data = unwrapData<Record<string, unknown>[]>(response);
            if (!Array.isArray(data)) return [];
            return data.map((item) => mapUser(item));
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    },

    async getUsersForUser(userId: string | number): Promise<User[]> {
        try {
            const response = await apiClient.get(`/auth/users/${userId}`);
            const data = unwrapData<Record<string, unknown>[]>(response);
            if (!Array.isArray(data)) return [];
            return data.map((item) => mapUser(item));
        } catch (error) {
            console.error("Error fetching users for user:", error);
            return [];
        }
    },

    async deleteUser(userId: string | number): Promise<boolean> {
        try {
            await apiClient.delete(`/auth/users/${userId}`);
            return true;
        } catch (error) {
            console.error("Error deleting user:", error);
            return false;
        }
    },

    async getBlockedUsers(userId: string | number): Promise<User[]> {
        try {
            const response = await apiClient.get(`/auth/users/blocked/${userId}`);
            const data = unwrapData<Record<string, unknown>[]>(response);
            if (!Array.isArray(data)) return [];
            return data.map((item) => mapUser(item));
        } catch (error) {
            console.error("Error fetching blocked users:", error);
            return [];
        }
    },

    async blockUser(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/block", { senderId, receivedId });
            return true;
        } catch (error) {
            console.error("Error blocking user:", error);
            return false;
        }
    },

    async cancelBlockUser(senderId: number, receivedId: number): Promise<boolean> {
        try {
            await apiClient.post("/auth/users/cancel-block", {
                senderId,
                receivedId,
            });
            return true;
        } catch (error) {
            console.error("Error canceling block user:", error);
            return false;
        }
    },

    async getUploadAvatarUrl(
        type: string,
        extension: string,
    ): Promise<{ imageUrl: string; uploadUrl: string }> {
        try {
            const response = await apiClient.get("/auth/upload-avatar", {
                params: { type, extension },
            });
            const data =
                unwrapData<Record<string, string>>(response) ??
                ({} as Record<string, string>);

            return {
                imageUrl: data.imageUrl ?? "",
                uploadUrl: data.uploadUrl ?? "",
            };
        } catch (error) {
            console.error("Error getting upload URL:", error);
            throw error;
        }
    },

    async updateUploadAvatarUrl(
        type: string,
        extension: string,
    ): Promise<string> {
        const response = await apiClient.get("/auth/users/update/upload-avatar", {
            params: { type, extension },
        });
        const data = unwrapData<string>(response) ?? response.data;
        return typeof data === "string" ? data.replace(/^"|"$/g, "").trim() : "";
    },

};

export default userService;
