import NotificationItem from "../components/notification/NotificationItem";
import { useNotificationContext } from "../contexts/NotificationContext";
import { markAllAsRead } from "../services/notificationService";

export default function Notifications() {
    const { notifications, loading, markAsRead, unreadCount } = useNotificationContext();

    return (
        <div className="max-w-[600px] mx-auto bg-white dark:bg-[#000] border border-gray-200 dark:border-[#262626] rounded-lg">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-semibold dark:text-white">
                        Notifications
                    </h1>
                    {unreadCount > 0 && (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => markAllAsRead()}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Mark all as read
                            </button>
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                {unreadCount} new
                            </span>
                        </div>
                    )}
                </div>
                
                {loading && notifications.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">No notifications.</div>
                ) : (
                    <div className="space-y-1">
                        {notifications.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onMarkAsRead={() => markAsRead(notification.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
