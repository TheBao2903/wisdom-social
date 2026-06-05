import { NavLink } from "react-router-dom";
import { Grid, Bookmark, Ban, Share2, UserSquare2 } from "lucide-react";

interface ProfileTabsProps {
  username: string;
  isOwnProfile: boolean;
}

export default function ProfileTabs({
  username,
  isOwnProfile,
}: ProfileTabsProps) {
  const basePath = `/profile/${username}`;
  const tabs = [
    { icon: Grid, label: "Bài viết", path: basePath, end: true },
    { icon: Bookmark, label: "Đã lưu", path: `${basePath}/saved` },
    { icon: UserSquare2, label: "Gắn thẻ", path: `${basePath}/tagged` },
    { icon: Share2, label: "Chia sẻ", path: `${basePath}/shared` },
    ...(isOwnProfile
      ? [{ icon: Ban, label: "Đã chặn", path: `${basePath}/blocked` }]
      : []),
  ];

  return (
    <div className="border-y border-gray-200 dark:border-[#262626] bg-white dark:bg-black">
      <div className="max-w-3xl mx-auto flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center gap-1.5 py-3 border-t-2 -mt-px transition-colors text-[11px] uppercase tracking-wider ${
                  isActive
                    ? "border-black dark:border-white text-black dark:text-white font-semibold"
                    : "border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`
              }
              title={tab.label}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
