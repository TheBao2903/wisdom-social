import { Link, useLocation } from "react-router-dom";
import { Grid, Bookmark, Ban } from "lucide-react";

interface ProfileTabsProps {
    username: string;
}

export default function ProfileTabs({ username }: ProfileTabsProps) {
    const location = useLocation();
    const basePath = `/profile/${username}`;

    const tabs = [
        { icon: Grid, label: "Bài viết", path: `${basePath}/posts` },
        { icon: Bookmark, label: "Đã lưu", path: `${basePath}/saved` },
        { icon: Ban, label: "Đã chặn", path: `${basePath}/blocked` },
    ];

    return (
        <div className="border-t border-gray-200 dark:border-[#262626] bg-white dark:bg-black">
            <div className="max-w-6xl mx-auto px-6 md:px-8 flex gap-8">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = location.pathname === tab.path;

                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`flex items-center gap-2 py-4 border-b-2 transition-colors font-medium text-base ${
                                isActive
                                    ? "border-black dark:border-white text-black dark:text-white"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                            <span>{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
