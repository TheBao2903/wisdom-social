import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
    Home,
    Search,
    Compass,
    Clapperboard,
    MessageCircle,
    Heart,
    PlusSquare,
    Menu,
    Moon,
    Sun,
    Settings,
    Bookmark,
    RefreshCw,
    UserPlus,
    Flag,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { buildS3Url } from "../../utils/s3";
import { useFriendDataSafe } from "../../contexts/FriendDataContext";
import { useSidebarLayout } from "../../hooks/useSidebarLayout";

export default function Sidebar() {
    const location = useLocation();
    const { isDark, toggleTheme } = useTheme();
    const currentUser = useCurrentUser();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const { sidebarCollapsed, toggleSidebarCollapsed } = useSidebarLayout();
    const showLabels = !sidebarCollapsed;

    // Get friend requests count for badge (safe - returns 0 if not in provider)
    const { friendRequests } = useFriendDataSafe();
    const friendRequestsCount = friendRequests?.length || 0;

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Search", path: "/search" },
        { icon: Compass, label: "Explore", path: "/explore" },
        { icon: Clapperboard, label: "Reels", path: "/reels" },
        { icon: MessageCircle, label: "Messages", path: "/messages" },
        { icon: Heart, label: "Notifications", path: "/notifications" },
        {
            icon: UserPlus,
            label: "Friend Requests",
            path: "/friend-requests",
            badge: friendRequestsCount,
        },
        { icon: Flag, label: "Pages", path: "/pages" },
        { icon: PlusSquare, label: "Create", path: "/create" },
    ];

    const isActive = (path: string) => {
        if (path === "/")
            return location.pathname === "/" || location.pathname === "/feed";
        return location.pathname.startsWith(path);
    };

    return (
        <aside
            className={`fixed left-0 top-0 z-50 hidden h-screen flex-col border-r border-gray-200 bg-white px-2.5 py-8 transition-[width,padding] duration-300 dark:border-[#262626] dark:bg-[#000] md:flex ${
                sidebarCollapsed ? "w-[88px]" : "w-[208px] lg:w-[272px]"
            }`}
        >
            {/* Logo */}
            <div className="mb-8 mt-2 flex items-center justify-between px-2">
                {showLabels ? (
                    <h1 className="text-2xl font-semibold font-serif dark:text-white">
                        Instagram
                    </h1>
                ) : (
                    <h1 className="w-full text-center text-xl font-semibold font-serif dark:text-white">
                        IG
                    </h1>
                )}

                <button
                    type="button"
                    onClick={toggleSidebarCollapsed}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#262626] dark:hover:text-white ${
                        sidebarCollapsed ? "absolute right-2" : ""
                    }`}
                    title={
                        sidebarCollapsed
                            ? "Mở rộng thanh điều hướng"
                            : "Thu gọn thanh điều hướng"
                    }
                >
                    {sidebarCollapsed ? (
                        <ChevronRight size={18} />
                    ) : (
                        <ChevronLeft size={18} />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        const badge = "badge" in item ? (item as any).badge : 0;

                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`flex items-center rounded-lg py-3 transition-all hover:bg-gray-100 dark:hover:bg-[#262626] ${
                                        showLabels
                                            ? "gap-4 px-3"
                                            : "justify-center px-2"
                                    } ${
                                        active ? "font-bold" : "font-normal"
                                    } dark:text-white`}
                                >
                                    <div className="relative">
                                        <Icon
                                            className={
                                                active ? "fill-current" : ""
                                            }
                                            size={26}
                                            strokeWidth={active ? 2.5 : 1.5}
                                        />
                                        {badge > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                                {badge > 99 ? "99+" : badge}
                                            </span>
                                        )}
                                    </div>
                                    {showLabels && (
                                        <span className="text-[16px]">
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}

                    {/* Profile */}
                    {currentUser && (
                        <li>
                            <Link
                                to={`/profile/${currentUser.username}`}
                                className={`flex items-center rounded-lg py-3 transition-all hover:bg-gray-100 dark:hover:bg-[#262626] ${
                                    showLabels
                                        ? "gap-4 px-3"
                                        : "justify-center px-2"
                                } ${
                                    location.pathname.includes(
                                        `/profile/${currentUser.username}`,
                                    )
                                        ? "font-bold"
                                        : "font-normal"
                                } dark:text-white`}
                            >
                                <img
                                    src={
                                        buildS3Url(currentUser.avatarUrl) ||
                                        currentUser.avatarUrl
                                    }
                                    alt={currentUser.username}
                                    className="w-[26px] h-[26px] rounded-full object-cover"
                                />
                                {showLabels && (
                                    <span className="text-[16px]">Profile</span>
                                )}
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>

            {/* More menu at Bottom */}
            <div className="mt-auto relative">
                <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className={`flex w-full items-center rounded-lg py-3 transition-all hover:bg-gray-100 dark:hover:bg-[#262626] dark:text-white ${
                        showLabels ? "gap-4 px-3" : "justify-center px-2"
                    }`}
                >
                    <Menu size={26} strokeWidth={1.5} />
                    {showLabels && <span className="text-[16px]">More</span>}
                </button>

                {/* More Menu Popup */}
                {showMoreMenu && (
                    <>
                        <div
                            className="fixed inset-0"
                            onClick={() => setShowMoreMenu(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-2xl shadow-xl overflow-hidden">
                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white">
                                <Settings size={20} />
                                <span className="text-sm">Settings</span>
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white">
                                <Bookmark size={20} />
                                <span className="text-sm">Saved</span>
                            </button>
                            <button
                                onClick={() => {
                                    toggleTheme();
                                    setShowMoreMenu(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white border-t border-gray-200 dark:border-[#363636]"
                            >
                                {isDark ? (
                                    <Sun size={20} />
                                ) : (
                                    <Moon size={20} />
                                )}
                                <span className="text-sm">
                                    {isDark
                                        ? "Switch to light mode"
                                        : "Switch to dark mode"}
                                </span>
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white border-t border-gray-200 dark:border-[#363636]">
                                <RefreshCw size={20} />
                                <span className="text-sm">
                                    Report a problem
                                </span>
                            </button>
                            <div className="border-t border-gray-200 dark:border-[#363636]" />
                            <button className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white">
                                <span className="text-sm">Switch accounts</span>
                            </button>
                            <button className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white">
                                <span className="text-sm">Log out</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}
