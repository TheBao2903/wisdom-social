import { Link, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Heart, Clapperboard } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export default function BottomNav() {
  const location = useLocation();
  const currentUser = useCurrentUser();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: PlusSquare, label: "Create", path: "/create" },
    { icon: Clapperboard, label: "Reels", path: "/reels" },
    { icon: Heart, label: "Notifications", path: "/notifications" },
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
                <Icon
                  className={active ? "fill-current" : ""}
                  size={26}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </Link>
            </li>
          );
        })}
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
                  src={currentUser.avatar}
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
