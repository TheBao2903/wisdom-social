import axiosClient from '../api/axiosClient';
import type { AdminStats } from '../types/models';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const adminService = {
  async lockUser(userId: number, reason: string): Promise<string> {
    const res = await axiosClient.post(`/admin/lock/${userId}`, { reason });
    return res.data;
  },

  async unlockUser(userId: number): Promise<string> {
    const res = await axiosClient.post(`/admin/unlock/${userId}`);
    return res.data;
  },

  async getStats(): Promise<AdminStats> {
    const res = await axiosClient.get('/admin/stats');
    return unwrap<AdminStats>(res);
  },
};

export default adminService;
