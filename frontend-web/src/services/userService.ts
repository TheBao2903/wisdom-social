import axiosClient from "../api/axiosClient";
import type { User, ApiResponse } from '../types';
import { setCookie } from '../utils/cookies';

export interface UserRequestRegister {
    phone: string;
    password: string;
    confirmPassword: string;
    ipAddress?: string;
}

export interface UserResponseRegister {
    phone: string;
    username: string;
    gender?: string;
    birthday?: string;
    createdAt: string;
}

export interface UserRequestConfirmRegister {
    phone: string;
    otp: string;
}

export interface UserResponseConfirmRegister {
    token?: string;
    userId?: string;
    username?: string;
}

export interface UserRequestLogin {
    phone: string;
    password: string;
    ipAddress?: string;
}

export interface UserResponseLogin {
    token: string;
    refreskToken: string;
    idToken?: string;
    id?: string | number;
    phone: string;
    username?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    bio?: string;
    birthday?: string;
    gender?: string;
    createdAt: string;
}

export interface UserRequestUpdate {
    username?: string;
    name?: string;
    bio?: string;
    avatarUrl?: string;
    birthday?: string;
    gender?: string;
}

export interface UserRequestForgotPassword {
    phone: string;
}

export interface UserResponseOTPPassword {
    OTP?: string;
    otpId?: string;
    expiresIn?: number;
}

export interface UserRequestResetPassword {
    phone: string;
    password: string;
    confirmPassword: string;
    confirmationCode: string;
    instant?: string;
}

export interface UserProfileResponse {
    id: string;
    username: string;
    fullName?: string;
    name?: string;
    avatarUrl: string;
    bio?: string;
    postsCount: number;
    followersCount: number;
    followingCount: number;
    friendsCount?: number;
    isVerified?: boolean;
}

// User Service
export const userService = {
    // Auth endpoints
    async register(data: UserRequestRegister): Promise<UserResponseRegister> {
        const response = await axiosClient.post(`auth/register`, data);
        return response.data.data;
    },

    async confirmRegister(data: UserRequestConfirmRegister): Promise<UserResponseConfirmRegister> {
        const response = await axiosClient.post(`auth/confirm`, data);
        return response.data.data;
    },

    async login(data: UserRequestLogin): Promise<UserResponseLogin> {
        const response = await axiosClient.post(`auth/login`, data);
        const loginData = response.data.data;

        if (loginData.token) {
            setCookie('accessToken', loginData.token, 0.042); // 1 hour
        }

        if (loginData.refreskToken) {
            setCookie('refreshToken', loginData.refreskToken, 7); // 7 days
        }

        localStorage.setItem('type', 'normal');


        return loginData;
    },

    async logout(): Promise<void> {
        await axiosClient.post(`auth/logout`, {});
    },

    async refreshToken(): Promise<string> {
        const response = await axiosClient.get(`auth/refresh`);
        return response.data.data;
    },

    async refreshQrToken(): Promise<string> {
        const response = await axiosClient.get(`session/qr-login/access-token`);
        return response.data.data ?? response.data;
    },

    async getCurrentUser(): Promise<ApiResponse<User>> {
        const response = await axiosClient.get(`auth/me`);
        return response.data.data;
    },

    async forgotPassword(data: UserRequestForgotPassword): Promise<UserResponseOTPPassword> {
        const response = await axiosClient.post(`auth/forgot-password`, {
            ...data,
            instant: new Date().toISOString(),
        });
        return response.data.data;
    },

    async resetPassword(data: UserRequestResetPassword): Promise<string> {
        const response = await axiosClient.post(`auth/reset-password`, data);
        return response.data.message || response.data.data;
    },

    async getAllUsers(): Promise<User[]> {
        const response = await axiosClient.get(`auth/users`);
        return response.data.data;
    },

        async getAllUsersSearch(id:number): Promise<User[]> {
        const response = await axiosClient.get(`auth/users/${id}`);
        return response.data.data;
    },

    async deleteUser(id: number): Promise<string> {
        const response = await axiosClient.delete(`auth/users/${id}`);
        return response.data.data;
    },

    async updateUser(id: number, data: UserRequestUpdate): Promise<User> {
        const response = await axiosClient.put(`auth/users/${id}`, data);
        return response.data.data;
    },

    async getUserProfile(id: string | number): Promise<UserProfileResponse> {
        const response = await axiosClient.get(`auth/users/${id}`);
        return response.data.data;
    },

    async searchUserByUsername(keyword: string): Promise<User[]> {
        const response = await axiosClient.get(`auth/users/username/${keyword}`);
        return response.data.data;
    },

    // Image upload endpoints
    async getUploadAvatarUrl(type: string, extension: string): Promise<{ imageUrl: string; uploadUrl: string }> {
        const response = await axiosClient.get(`auth/upload-avatar`, {
            params: { type, extension }
        });
        return response.data.data;
    },

    async updateUploadAvatarUrl(type: string, extension: string): Promise<string> {
        const response = await axiosClient.get(`auth/users/update/upload-avatar`, {
            params: { type, extension }
        });
        return response.data;
    },

    async getUsersBlockedByMe(userId: string | number): Promise<User[]> {
        const response = await axiosClient.get(`auth/users/blocked/${userId}`);
        return response.data.data;
    },
};

export default userService;
