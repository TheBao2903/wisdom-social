import axiosClient from '../api/axiosClient';
import type { ApiResponse, User } from '../types/models';

export interface LoginRequest {
  phone: string;
  password: string;
  ipAddress?: string;
}

const authService = {
  async login(payload: LoginRequest) {
    const res = await axiosClient.post('/auth/login', payload);
    return res.data;
  },

  async logout() {
    await axiosClient.post('/auth/logout');
    return 'ok';
  },

  async getMe(): Promise<User | null> {
    try {
      const res = await axiosClient.get<ApiResponse<User>>('/auth/me');
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },
};

export default authService;
