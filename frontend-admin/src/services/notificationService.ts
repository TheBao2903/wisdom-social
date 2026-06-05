import axiosClient from '../api/axiosClient';

const unwrap = <T>(res: any): T => (res?.data?.data !== undefined ? res.data.data : res?.data);

const notificationService = {
  async getUnreadCount(): Promise<number> {
    try {
      const res = await axiosClient.get('/notifications/unread-count');
      return unwrap<number>(res) ?? 0;
    } catch {
      return 0;
    }
  },

  async markAllAsRead(): Promise<void> {
    await axiosClient.put('/notifications/read-all');
  },
};

export default notificationService;
