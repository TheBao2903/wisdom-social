import { Link } from "react-router-dom";
import {
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Music,
} from "lucide-react";
import type { Post } from "../../../types";
import type { PrivacyDisplay } from "./privacy";

interface PostCardHeaderProps {
  post: Post;
  displayPost: Post;
  authorAvatarUrl: string;
  isOwnPost: boolean;
  privacyDisplay: PrivacyDisplay;
  showMenu: boolean;
  showPrivacyMenu: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onTogglePrivacyMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onChangePrivacy: (privacy: string) => void;
  taggedUsers?: any[];
}

export default function PostCardHeader({
  post,
  displayPost,
  authorAvatarUrl,
  isOwnPost,
  privacyDisplay,
  showMenu,
  showPrivacyMenu,
  onToggleMenu,
  onCloseMenu,
  onTogglePrivacyMenu,
  onEdit,
  onDelete,
  onCopyLink,
  onChangePrivacy,
  taggedUsers = [],
}: PostCardHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${post.user.username}`}>
          <img
            src={authorAvatarUrl}
            alt={post.user.username}
            className="w-8 h-8 rounded-full object-cover"
          />
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-x-1">
            <Link
              to={`/profile/${post.user.username}`}
              className="text-sm font-semibold dark:text-white hover:underline"
            >
              {post.user.username}
            </Link>

            {taggedUsers.length > 0 && (
              <>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  is with
                </span>
                <Link
                  to={`/profile/${taggedUsers[0].username}`}
                  className="text-sm font-semibold dark:text-white hover:underline"
                >
                  {taggedUsers[0].username}
                </Link>
                {taggedUsers.length > 1 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    and {taggedUsers.length - 1} others
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <privacyDisplay.icon
                size={12}
                className={`${privacyDisplay.color}`}
              />
              <span
                className={`text-[10px] ${privacyDisplay.color} font-medium`}
              >
                {privacyDisplay.text}
              </span>
            </div>
            {(displayPost as any).location && (
              <div className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                <span className="text-[10px]">•</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span className="text-[10px]">
                  {typeof (displayPost as any).location === "string"
                    ? (displayPost as any).location
                    : (displayPost as any).location?.name}
                </span>
              </div>
            )}
            {!!displayPost.music && (
              <div className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                <span className="text-[10px]">•</span>
                <Music size={10} className="shrink-0" />
                <span className="text-[10px] truncate max-w-28">
                  {displayPost.music?.title}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={onToggleMenu}
          className="text-gray-900 dark:text-white hover:text-gray-500 dark:hover:text-gray-400"
        >
          <MoreHorizontal size={24} />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-20 py-2 border dark:border-gray-700">
              {isOwnPost && (
                <>
                  <button
                    onClick={onEdit}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={onTogglePrivacyMenu}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
                  >
                    <Globe className="w-4 h-4" />
                    Change privacy
                  </button>
                  {showPrivacyMenu && (
                    <div className="px-2 py-1 space-y-1">
                      <button
                        onClick={() => onChangePrivacy("PUBLIC")}
                        className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                      >
                        <Globe className="w-3 h-3" />
                        Public
                      </button>
                      <button
                        onClick={() => onChangePrivacy("FRIENDS")}
                        className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                      >
                        <Users className="w-3 h-3" />
                        Friends
                      </button>
                      <button
                        onClick={() => onChangePrivacy("ONLY_ME")}
                        className="w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-white flex items-center gap-2"
                      >
                        <Lock className="w-3 h-3" />
                        Only me
                      </button>
                    </div>
                  )}
                  <button
                    onClick={onDelete}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={onCopyLink}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 dark:text-white"
              >
                <LinkIcon className="w-4 h-4" />
                Copy link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
