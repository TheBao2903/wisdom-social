import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Home, Search, PlusSquare, Heart, Clapperboard, FileText, Sparkles } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useNotificationContext } from "../../contexts/NotificationContext";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { unreadCount } = useNotificationContext();
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Clapperboard, label: "Reels", path: "/reels" },
    { icon: Heart, label: "Notifications", path: "/notifications", badge: unreadCount },
  ];

  const isActive = (path: string) => {
    if (path === "/")
      return location.pathname === "/" || location.pathname === "/feed";
    return location.pathname.startsWith(path);
  };

  const isProfileActive =
    currentUser &&
    location.pathname.includes(`/profile/${currentUser.username}`);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#000] border-t border-gray-200 dark:border-[#262626] md:hidden z-50">
      <ul className="flex justify-around items-center h-[49px] px-2 dark:text-white">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <li key={item.path}>
              <Link to={item.path} className="flex items-center justify-center">
                <div className="relative">
                  <Icon
                    className={active ? "fill-current" : ""}
                    size={26}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {/* Create Button with Popup */}
        <li className="relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="flex items-center justify-center"
          >
            <PlusSquare
              className={
                location.pathname === "/create" || location.pathname === "/create-story"
                  ? "fill-current"
                  : ""
              }
              size={26}
              strokeWidth={
                location.pathname === "/create" || location.pathname === "/create-story"
                  ? 2.5
                  : 1.8
              }
            />
          </button>

          {showCreateMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowCreateMenu(false)}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-white dark:bg-[#262626] border border-gray-200 dark:border-[#363636] rounded-2xl shadow-xl overflow-hidden z-50">
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    navigate("/create");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white transition-colors"
                >
                  <FileText size={18} />
                  <span className="text-sm font-medium">Tạo bài viết</span>
                </button>
                <div className="border-t border-gray-200 dark:border-[#363636]" />
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    navigate("/create-story");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#363636] dark:text-white transition-colors"
                >
                  <Sparkles size={18} />
                  <span className="text-sm font-medium">Tạo tin</span>
                </button>
              </div>
            </>
          )}
        </li>
        <li>
          {currentUser && (
            <Link
              to={`/profile/${currentUser.username}`}
              className="flex items-center justify-center"
            >
              <div
                className={`rounded-full ${
                  isProfileActive ? "ring-2 ring-black" : ""
                }`}
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  className="w-[26px] h-[26px] rounded-full object-cover"
                />
              </div>
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
