import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { User } from "../../types";
import { Settings, LogOut, QrCode, X, MessageCircle } from "lucide-react";
import { logout } from "../../utils/auth";
import axiosClient from "../../api/axiosClient";
import NoteModal from "./NoteModal";
import FriendsModal from "./FriendsModal";
import { buildS3Url } from "../../utils/s3";
import BlockUnblockButton from "../friend/BlockUnblockButton";
import FriendActions from "../friend/FriendActions";

interface NoteMusic {
  title: string;
  artist: string;
  coverUrl: string;
  previewUrl: string;
}

interface Note {
  id: string;
  userId: string;
  content: string;
  emoji: string;
  location?: string;
  music?: NoteMusic;
  createdAt: string;
  expireAt: string;
}

interface ProfileHeaderProps {
  user: User;
  isOwnProfile?: boolean;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  HIDDEN: "Ẩn",
  OTHER: "Khác",
};

export default function ProfileHeader({
  user,
  isOwnProfile = false,
}: ProfileHeaderProps) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    axiosClient
      .get(`/notes/user/${user.id}`)
      .then((res) => setNote(res.data.data ?? null))
      .catch(() => setNote(null));
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const genderLabel = GENDER_LABELS[user.gender || "HIDDEN"] || "Ẩn";

  return (
    <>
      <div className="bg-white dark:bg-black px-6 md:px-8 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Main Profile Card - Web-appropriate sizing */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-8 border border-gray-200 dark:border-[#262626]">

            {/* Settings button - top right */}
            {isOwnProfile && (
              <div className="absolute top-8 right-8">
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <Settings size={24} />
                  </button>

                  {showSettingsMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSettingsMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#262626] rounded-lg shadow-lg overflow-hidden z-50">
                        <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#363636] dark:text-gray-200 transition-colors text-sm border-b border-gray-200 dark:border-[#363636]">
                          <QrCode size={18} />
                          QR code
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#363636] text-red-600 dark:text-red-400 transition-colors text-sm font-medium"
                        >
                          <LogOut size={18} />
                          Đăng xuất
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Top section: Avatar + User Info */}
            <div className="flex gap-8 md:gap-10">
              {/* Avatar Column */}
              <div className="flex flex-col items-center flex-shrink-0">
                {note && (
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="mb-3 w-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-none px-3 py-2 shadow-sm text-left text-xs hover:shadow-md transition-all"
                  >
                    {note.content ? (
                      <span className="text-gray-700 dark:text-gray-200 line-clamp-2 break-words">
                        {note.content}
                      </span>
                    ) : note.music ? (
                      <span>🎵 {note.music.title}</span>
                    ) : note.location ? (
                      <span>📍 {note.location}</span>
                    ) : null}
                  </button>
                )}
                <button
                  onClick={() => isOwnProfile ? setShowNoteModal(true) : setShowAvatarModal(true)}
                  className="relative mb-2 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={buildS3Url(user.avatarUrl) || user.avatarUrl || "https://i.pravatar.cc/150"}
                    alt={user.username}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-[#363636]"
                  />
                  <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-3 border-white dark:border-[#1a1a1a]" />
                </button>
                {isOwnProfile && !note && (
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="text-sm text-blue-500 hover:text-blue-600 font-medium mt-1"
                  >
                    + Thêm ghi chú
                  </button>
                )}
              </div>

              {/* Right column: Info + Stats */}
              <div className="flex-1 min-w-0">
                {/* Name and username */}
                <div className="mb-4">
                  <h1 className="text-2xl font-bold dark:text-white">
                    {user.fullName || user.username}
                  </h1>
                  {user.username && (
                    <p className="text-gray-600 dark:text-gray-400 text-base">
                      @{user.username}
                    </p>
                  )}
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="text-base dark:text-gray-300 mb-4 leading-relaxed">
                    {user.bio}
                  </p>
                )}

                {/* Birthday & Gender */}
                <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
                  {user.birthday && (
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>{user.birthday}</span>
                    </div>
                  )}
                  {user.gender && (
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>{GENDER_LABELS[user.gender] || "Ẩn"}</span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-8 mb-6 pb-6 border-b border-gray-200 dark:border-[#262626]">
                  <div>
                    <p className="text-2xl font-bold dark:text-white">{user.postsCount || 0}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Bài viết</p>
                  </div>
                  <button
                    onClick={() => setShowFriendsModal(true)}
                    className="text-left hover:opacity-70 transition-opacity"
                  >
                    <p className="text-2xl font-bold dark:text-white">
                      {user.friendsCount?.toLocaleString() || 0}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Bạn bè</p>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                  {isOwnProfile ? (
                    <>
                      <Link
                        to="/edit-profile"
                        className="flex-1 min-w-[140px] px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors text-center"
                      >
                        ✎ Chỉnh sửa hồ sơ
                      </Link>
                      <Link
                        to="/settings"
                        className="px-6 py-3 bg-gray-200 dark:bg-[#262626] hover:bg-gray-300 dark:hover:bg-[#363636] dark:text-white rounded-lg font-semibold transition-colors"
                      >
                        Cài đặt
                      </Link>
                    </>
                  ) : (
                    <>
                      <FriendActions
                        targetUserId={user.id}
                        targetUsername={user.username}
                        size="md"
                      />
                      <button className="flex-1 min-w-[140px] px-6 py-3 bg-gray-200 dark:bg-[#262626] hover:bg-gray-300 dark:hover:bg-[#363636] dark:text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                        <MessageCircle size={18} />
                        Nhắn tin
                      </button>
                      <BlockUnblockButton userId={user.id} username={user.username} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar View Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <button
            onClick={() => setShowAvatarModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X size={32} />
          </button>
          <img
            src={buildS3Url(user.avatarUrl) || user.avatarUrl}
            alt={user.username}
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
          />
        </div>
      )}

      {/* Note modal */}
      {showNoteModal && (
        <NoteModal
          userId={String(user.id)}
          isOwnProfile={isOwnProfile}
          onClose={() => setShowNoteModal(false)}
          onNoteChange={(updated) => setNote(updated)}
        />
      )}

      {/* Friends modal */}
      {showFriendsModal && (
        <FriendsModal
          userId={user.id}
          onClose={() => setShowFriendsModal(false)}
        />
      )}
    </>
  );
}
