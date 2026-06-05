import { useNotificationContext } from "../contexts/NotificationContext";

/**
 * Hook để sử dụng NotificationContext.
 * Giữ nguyên để không làm gãy các component đang import hook này.
 */
const useNotifications = () => {
  return useNotificationContext();
};

export default useNotifications;
