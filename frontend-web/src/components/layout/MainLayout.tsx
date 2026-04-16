import { Outlet, useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import Sidebar from "../nav/Sidebar";
import BottomNav from "../nav/BottomNav";
import { suggestedUsers } from "../../api/mockData";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useAvatarBuster } from "../../context/AvatarContext";
import { FriendNotificationProvider } from "../../contexts/FriendNotificationContext";
import {
    FriendDataProvider,
    useFriendData,
} from "../../contexts/FriendDataContext";
import { buildS3Url } from "../../utils/s3";
import { useSidebarLayout } from "../../hooks/useSidebarLayout";

// Inner component that uses FriendDataContext
function MainLayoutContent() {
    const location = useLocation();
    const currentUser = useCurrentUser();
    const avatarBuster = useAvatarBuster();
    const { sidebarWidth } = useSidebarLayout();
    const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(false);
    const isMessagesRoute = location.pathname.startsWith("/messages");

    console.log(
        "🔴 MainLayoutContent re-render with currentUser:",
        currentUser,
    );

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#000]">
            {/* Sidebar for desktop */}
            <Sidebar />

            {/* Main Content */}
            <main
                className="min-h-screen pb-16 md:pb-0 xl:mr-[72px]"
                style={{ marginLeft: `${sidebarWidth}px` }}
            >
                <div className="max-w-[975px] mx-auto pt-6 px-8 md:px-12">
                    <Outlet />
                </div>
            </main>

            {/* Right Panel for desktop - Suggestions */}
            {!isMessagesRoute && (
                <aside
                    className={`hidden xl:block fixed right-0 top-0 h-screen overflow-y-auto pt-8 bg-white dark:bg-black border-l border-gray-200 dark:border-[#262626] transition-[width] duration-300 ease-in-out z-40 ${
                        isRightSidebarExpanded
                            ? "w-[383px] px-12"
                            : "w-[72px] px-3"
                    }`}
                    onMouseEnter={() => setIsRightSidebarExpanded(true)}
                    onMouseLeave={() => setIsRightSidebarExpanded(false)}
                >
                    <div className="space-y-6 pt-2">
                        {/* Current User */}
                        {currentUser && (
                            <Link
                                to={`/profile/${currentUser.username}`}
                                className="flex items-center gap-3 py-2 overflow-hidden"
                            >
                                <img
                                    src={
                                        buildS3Url(currentUser.avatarUrl) +
                                        `?bust=${avatarBuster}`
                                    }
                                    alt={currentUser.username}
                                    className="w-11 h-11 rounded-full shrink-0"
                                />
                                <div
                                    className={`flex-1 min-w-0 transition-all duration-200 ${
                                        isRightSidebarExpanded
                                            ? "opacity-100 delay-75"
                                            : "opacity-0 w-0 invisible"
                                    }`}
                                >
                                    <p className="text-sm font-semibold truncate dark:text-white">
                                        {currentUser.username}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate">
                                        {currentUser.fullName}
                                    </p>
                                </div>
                            </Link>
                        )}

                        {/* Suggestions for you */}
                        <div className={isRightSidebarExpanded ? "" : "hidden"}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                    Suggestions For You
                                </h2>
                                <button className="text-xs font-semibold hover:text-gray-500 dark:text-white dark:hover:text-gray-400">
                                    See All
                                </button>
                            </div>

                            <div className="space-y-3">
                                {suggestedUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between"
                                    >
                                        <Link
                                            to={`/profile/${user.username}`}
                                            className="flex items-center gap-3 flex-1 min-w-0"
                                        >
                                            <img
                                                src={
                                                    buildS3Url(
                                                        user.avatarUrl,
                                                    ) ||
                                                    "https://i.pravatar.cc/150"
                                                }
                                                alt={user.username}
                                                className="w-11 h-11 rounded-full flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate dark:text-white">
                                                    {user.username}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    Suggested for you
                                                </p>
                                            </div>
                                        </Link>
                                        <button className="text-xs font-semibold text-[#0095f6] hover:text-[#00376b] flex-shrink-0">
                                            Follow
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Links */}
                        <div
                            className={`pt-6 ${isRightSidebarExpanded ? "" : "hidden"}`}
                        >
                            <div className="text-xs text-gray-400 space-y-3">
                                <div className="flex flex-wrap gap-x-1 gap-y-1">
                                    <a
                                        href="#"
                                        className="hover:underline after:content-['·'] after:mx-1 last:after:content-['']"
                                    >
                                        About
                                    </a>
                                    <a
                                        href="#"
                                        className="hover:underline after:content-['·'] after:mx-1 last:after:content-['']"
                                    >
                                        Help
                                    </a>
                                    <a
                                        href="#"
                                        className="hover:underline after:content-['·'] after:mx-1 last:after:content-['']"
                                    >
                                        Press
                                    </a>
                                    <span>·</span>
                                    <a href="#" className="hover:underline">
                                        API
                                    </a>
                                    <span>·</span>
                                    <a href="#" className="hover:underline">
                                        Jobs
                                    </a>
                                    <span>·</span>
                                    <a href="#" className="hover:underline">
                                        Privacy
                                    </a>
                                    <span>·</span>
                                    <a href="#" className="hover:underline">
                                        Terms
                                    </a>
                                </div>
                                <p className="text-gray-400">© 2026 SOCIAL</p>
                            </div>
                        </div>
                    </div>
                </aside>
            )}

            {/* Bottom Navigation for mobile */}
            <BottomNav />
        </div>
    );
}

// Wrapper component that connects notifications to data refresh
function MainLayoutWithNotifications() {
    const { triggerRefreshAll } = useFriendData();

    // Callback khi nhận friend request mới - auto refresh danh sách
    const handleFriendRequest = useCallback(() => {
        console.log("📬 New friend request notification - refreshing list...");
        triggerRefreshAll();
    }, [triggerRefreshAll]);

    // Callback khi friend request được accept - refresh cả 2 list
    const handleFriendAccept = useCallback(() => {
        console.log("✅ Friend request accepted - refreshing both lists...");
        triggerRefreshAll();
    }, [triggerRefreshAll]);

    // Callback khi friend request bị reject
    const handleFriendReject = useCallback(() => {
        console.log("❌ Friend request rejected - refreshing requests...");
        triggerRefreshAll();
    }, [triggerRefreshAll]);

    // Callback khi friend request bị cancel hoặc unfriend
    const handleFriendCancel = useCallback(() => {
        console.log("🚫 Friend canceled - refreshing both lists...");
        triggerRefreshAll();
    }, [triggerRefreshAll]);

    return (
        <FriendNotificationProvider
            onFriendRequest={handleFriendRequest}
            onFriendAccept={handleFriendAccept}
            onFriendReject={handleFriendReject}
            onFriendCancel={handleFriendCancel}
        >
            <MainLayoutContent />
        </FriendNotificationProvider>
    );
}

// Main export - provides FriendDataContext first
export default function MainLayout() {
    return (
        <FriendDataProvider>
            <MainLayoutWithNotifications />
        </FriendDataProvider>
    );
}
