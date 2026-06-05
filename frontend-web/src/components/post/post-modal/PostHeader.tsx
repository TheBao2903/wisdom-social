/**
 * 📌 PostHeader Component
 *
 * Responsibility:
 * - Display post author avatar and username
 * - Show privacy level (Public/Friends/Specific/Only Me)
 * - Display location if available
 * - Handle owner menu (Edit, Delete, Privacy, Copy link)
 *
 * Why:
 * - Isolates header UI and menu logic from PostModal container
 * - Makes header styling changes independent
 * - Centralizes owner action handlers
 *
 * Props:
 * - post: PostData (contains privacy, location)
 * - author: UserData (avatar, username)
 * - currentUser: UserData | undefined
 * - isOwnPost: boolean
 * - showMenu: boolean, setShowMenu: (bool) => void
 * - showPrivacyMenu: boolean, setShowPrivacyMenu: (bool) => void
 * - showSpecificModal: boolean, setShowSpecificModal: (bool) => void
 * - showExcludedModal: boolean, setShowExcludedModal: (bool) => void
 *
 * Handlers:
 * - onEdit(): Open edit modal
 * - onChangePrivacy(newPrivacy: string): Update post privacy
 * - onDelete(): Delete post
 * - onCopyLink(): Copy post URL
 * - onOpenSpecificModal(): Open specific friends selector
 * - onOpenExcludedModal(): Open friends excluded selector
 *
 * Notes:
 * - Only shows menu for post owner
 * - Displays different privacy info for owner vs others
 */

import React from "react";
import { Link } from "react-router-dom";
import { Users, Globe, Lock, Music, Play, Pause } from "lucide-react";
import type { PostData, UserData } from "../../../types/post";
import PostHeaderMenu from "../PostHeaderMenu";
import useMusicAutoplay from "../../../hooks/useMusicAutoplay";
import { useFriendStatus } from "../../../hooks/useFriendStatus";
import { getAvatarUrl } from "../../../utils/s3";

const DEFAULT_AVATAR_URL = "https://i.pravatar.cc/150?img=5";

interface PostHeaderProps {
  post: PostData;
  author: UserData | null;
  currentUser: { id: string | number; username?: string } | null | undefined;
  isOwnPost: boolean;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
  showPrivacyMenu: boolean;
  setShowPrivacyMenu: (show: boolean) => void;
  onEdit: () => void;
  onChangePrivacy: (newPrivacy: string) => void;
  onDelete: () => void;
  onCopyLink: () => void;
  taggedUsers?: UserData[];
  musicScopeId?: string;
  musicAutoPlayEnabled?: boolean;
}

const PostHeader: React.FC<PostHeaderProps> = ({
  post,
  author,
  isOwnPost,
  showMenu,
  setShowMenu,
  showPrivacyMenu,
  setShowPrivacyMenu,
  onEdit,
  onChangePrivacy,
  onDelete,
  onCopyLink,
  taggedUsers: _taggedUsers = [],
  musicScopeId,
  musicAutoPlayEnabled = true,
}) => {
  const authorDisplay = {
    id: author?.id ?? Number(post.authorId || 0),
    username: author?.username || "unknown",
    avatarUrl: getAvatarUrl(author?.avatarUrl) || DEFAULT_AVATAR_URL,
  };

  // Check friendship status with post author
  const {
    status: friendshipStatus,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    loading: friendActionLoading,
  } = useFriendStatus(Number(authorDisplay.id));

  return (
    <div className="p-3 border-b dark:border-[#363636] flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${authorDisplay.username}`}>
          <img
            src={authorDisplay.avatarUrl}
            alt={authorDisplay.username}
            onError={(event) => {
              event.currentTarget.src = DEFAULT_AVATAR_URL;
            }}
            className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-800"
          />
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${authorDisplay.username}`}
              className="font-bold text-sm dark:text-white hover:opacity-70 transition-opacity"
            >
              {authorDisplay.username}
            </Link>
            {!isOwnPost && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[10px]">•</span>
                {/* Show friend action button based on friendship status */}
                {friendshipStatus === "loading" ? (
                  <button
                    disabled
                    className="text-[#3b5998] text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 opacity-50 cursor-not-allowed"
                  >
                    ...
                  </button>
                ) : friendshipStatus === "none" ? (
                  <button
                    onClick={sendRequest}
                    disabled={friendActionLoading}
                    className="text-[#3b5998] text-xs font-bold hover:text-[#2d4373] transition-colors bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Kết bạn
                  </button>
                ) : friendshipStatus === "pending_sent" ? (
                  <button
                    onClick={cancelRequest}
                    disabled={friendActionLoading}
                    className="text-gray-600 text-xs font-bold hover:text-gray-800 transition-colors bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Đã gửi lời mời
                  </button>
                ) : friendshipStatus === "pending_received" ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={acceptRequest}
                      disabled={friendActionLoading}
                      className="text-[#3b5998] text-xs font-bold hover:text-[#2d4373] transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Chấp nhận
                    </button>
                    <button
                      onClick={rejectRequest}
                      disabled={friendActionLoading}
                      className="text-gray-600 text-xs font-bold hover:text-gray-800 transition-colors bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Từ chối
                    </button>
                  </div>
                ) : friendshipStatus === "friends" ? (
                  <span className="text-gray-500 text-xs font-semibold">
                    Bạn bè
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Music Display under username */}
          {post.music && (
            <MusicDisplay
              music={post.music}
              scopeId={musicScopeId || `post-modal-music-${post.id}`}
              autoPlayEnabled={musicAutoPlayEnabled}
            />
          )}

          {post.location && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {typeof post.location === "string"
                ? post.location
                : post.location.name || post.location.address}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Privacy Badge (Icon Only) */}
        {isOwnPost && post.privacy && (
          <div
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
            title={post.privacy}
          >
            {post.privacy === "PUBLIC" && (
              <Globe className="w-4 h-4 text-gray-400" />
            )}
            {post.privacy === "FRIENDS" && (
              <Users className="w-4 h-4 text-gray-400" />
            )}
            {post.privacy === "ONLY_ME" && (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            {["SPECIFIC", "EXCEPT"].includes(post.privacy) && (
              <Users className="w-4 h-4 text-gray-400" />
            )}
          </div>
        )}

        <PostHeaderMenu
          isOwnPost={isOwnPost}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          showPrivacyMenu={showPrivacyMenu}
          setShowPrivacyMenu={setShowPrivacyMenu}
          onEdit={onEdit}
          onChangePrivacy={onChangePrivacy}
          onDelete={onDelete}
          onCopyLink={onCopyLink}
        />
      </div>
    </div>
  );
};

const MusicDisplay: React.FC<{
  music: any;
  scopeId: string;
  autoPlayEnabled: boolean;
}> = ({ music, scopeId, autoPlayEnabled }) => {
  const {
    containerRef,
    playingUrl,
    audioUrl,
    togglePlay: handleToggle,
  } = useMusicAutoplay({
    musicId: scopeId,
    audioPath: music?.audioUrl,
    enabled: Boolean(autoPlayEnabled && music?.audioUrl),
    focusRatio: 0.65,
  });

  return (
    <div ref={containerRef} className="mt-0.5">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors group"
      >
        <div className="relative flex items-center justify-center">
          <Music
            size={12}
            className={`shrink-0 ${
              playingUrl === audioUrl ? "text-blue-500 animate-pulse" : ""
            }`}
          />
          {playingUrl === audioUrl && (
            <div className="absolute -inset-1 bg-blue-500/10 rounded-full animate-ping" />
          )}
        </div>
        <span className="truncate max-w-[150px]">
          {music.title} • {music.artist}
        </span>
        {playingUrl === audioUrl ? (
          <Pause size={10} className="fill-current" />
        ) : (
          <Play
            size={10}
            className="fill-current opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </button>
    </div>
  );
};

export default PostHeader;
