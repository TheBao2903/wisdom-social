import axiosClient from '../api/axiosClient';
import type { User, UserProfile } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const userService = {
  async getAllUsers(): Promise<User[]> {
    const res = await axiosClient.get('/auth/users');
    const list = unwrap<User[]>(res);
    return Array.isArray(list) ? list : [];
  },

  async deleteUser(id: number): Promise<string> {
    const res = await axiosClient.delete(`/auth/users/${id}`);
    return unwrap<string>(res);
  },

  async updateUser(id: number, body: Partial<User>): Promise<User> {
    const res = await axiosClient.put(`/auth/users/${id}`, body);
    return unwrap<User>(res);
  },

  async searchByUsername(keyword: string): Promise<User[]> {
    const res = await axiosClient.get(`/auth/users/username/${encodeURIComponent(keyword)}`);
    return unwrap<User[]>(res) ?? [];
  },

  async getProfile(id: number): Promise<UserProfile> {
    const res = await axiosClient.get(`/auth/user/${id}`);
    return unwrap<UserProfile>(res);
  },
};

export default userService;
