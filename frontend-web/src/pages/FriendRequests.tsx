import { useState, useEffect } from "react";
import { UserPlus, Send, RefreshCw } from "lucide-react";
import FriendRequestsList from "../components/friend/FriendRequestsList";
import SentRequestsList from "../components/friend/SentRequestsList";
import { useFriendData } from "../contexts/FriendDataContext";

type TabType = "received" | "sent";

export default function FriendRequests() {
    const [activeTab, setActiveTab] = useState<TabType>("received");
    const {
        friendRequests,
        refreshFriendRequests,
        friendRequestsLoading,
        refreshTrigger
    } = useFriendData();

    // Watch refreshTrigger to force re-render when data updates
    useEffect(() => {
        console.log("🔄 FriendRequests: refreshTrigger changed, data refreshed");
    }, [refreshTrigger]);

    const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
        { id: "received", label: "Lời mời đã nhận", icon: <UserPlus size={18} />, count: friendRequests.length },
        { id: "sent", label: "Lời mời đã gửi", icon: <Send size={18} /> },
    ];

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white">
                        Lời mời kết bạn
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Quản lý các lời mời kết bạn của bạn
                    </p>
                </div>
                <button
                    onClick={() => refreshFriendRequests()}
                    disabled={friendRequestsLoading}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] disabled:opacity-50 transition-colors"
                    title="Làm mới"
                >
                    <RefreshCw 
                        size={20} 
                        className={`text-gray-500 dark:text-gray-400 ${friendRequestsLoading ? 'animate-spin' : ''}`} 
                    />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-[#262626] mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors relative ${
                            activeTab === tab.id
                                ? "text-blue-500"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full min-w-[20px] text-center">
                                {tab.count}
                            </span>
                        )}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#262626]">
                {activeTab === "received" ? (
                    <FriendRequestsList />
                ) : (
                    <SentRequestsList />
                )}
            </div>
        </div>
    );
}
