import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search as SearchIcon,
  X,
  Loader2,
  UserMinus,
  Users as UsersIcon,
  UserPlus,
  Send,
  Ban,
  RefreshCw,
  Check,
} from "lucide-react";
import { useFriendData } from "../contexts/FriendDataContext";
import blockService from "../services/blockService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useBlockNotifications } from "../hooks/useBlockNotifications";
import { usePresenceStatus } from "../hooks/usePresenceStatus";
import { buildS3Url } from "../utils/s3";
import type { User } from "../types";
import ConfirmModal from "../components/common/ConfirmModal";

type TabType = "friends" | "requests" | "sent" | "blocked";

const TABS: { key: TabType; label: string }[] = [
  { key: "friends", label: "Bạn bè" },
  { key: "requests", label: "Lời mời" },
  { key: "sent", label: "Đã gửi" },
  { key: "blocked", label: "Đã chặn" },
];

const EMPTY: Record<
  TabType,
  { Icon: typeof UsersIcon; title: string; sub: string }
> = {
  friends: {
    Icon: UsersIcon,
    title: "Chưa có bạn bè",
    sub: "Bắt đầu kết bạn từ trang Khám phá",
  },
  requests: {
    Icon: UserPlus,
    title: "Không có lời mời",
    sub: "Bạn chưa nhận lời mời kết bạn nào",
  },
  sent: {
    Icon: Send,
    title: "Chưa gửi lời mời",
    sub: "Các lời mời bạn đã gửi sẽ hiển thị ở đây",
  },
  blocked: {
    Icon: Ban,
    title: "Chưa chặn ai",
    sub: "Người bạn chặn sẽ hiển thị ở đây",
  },
};

function Avatar({ user, online = false }: { user: User; online?: boolean }) {
  const src =
    buildS3Url(user.avatarUrl) ||
    user.avatarUrl ||
    "https://i.pravatar.cc/150";
  return (
    <span className="relative inline-flex shrink-0">
      <img
        src={src}
        alt={user.username}
        className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-[#262626]"
      />
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-black"
          title="Đang hoạt động"
        />
      )}
    </span>
  );
}

export default function FriendRequests() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<TabType>("friends");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<User[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    variant: "danger" | "warning" | "default";
    action: () => Promise<void>;
  } | null>(null);

  const {
    friends,
    friendsLoading,
    refreshFriends,
    friendRequests,
    friendRequestsLoading,
    refreshFriendRequests,
    sentRequests,
    sentRequestsLoading,
    refreshSentRequests,
    acceptRequest,
    rejectRequest,
    unfriend,
    cancelSentRequest,
    refreshTrigger,
  } = useFriendData();
  const friendPresenceByUserId = usePresenceStatus(
    friends.map((friend) => Number(friend.id))
  );

  // Load blocked users when the blocked tab opens (or on refresh)
  const loadBlocked = useCallback(async () => {
    if (!currentUser?.id) return;
    setBlockedLoading(true);
    try {
      setBlocked(await blockService.getBlockedUsers(currentUser.id));
    } finally {
      setBlockedLoading(false);
    }
  }, [currentUser?.id]);

  // Friend-event trigger only refreshes the blocked list when on that tab
  useEffect(() => {
    if (tab === "blocked") void loadBlocked();
  }, [tab, loadBlocked, refreshTrigger]);

  // Real-time block/unblock from other devices → patch only the blocked tab
  const blockTrigger = useBlockNotifications();
  useEffect(() => {
    if (blockTrigger > 0 && tab === "blocked") void loadBlocked();
  }, [blockTrigger, tab, loadBlocked]);

  // ── Source list per tab ─────────────────────────────────────────────
  const sourceList: User[] =
    tab === "friends"
      ? friends
      : tab === "requests"
        ? friendRequests
        : tab === "sent"
          ? sentRequests
          : blocked;

  const isLoading =
    tab === "friends"
      ? friendsLoading
      : tab === "requests"
        ? friendRequestsLoading
        : tab === "sent"
          ? sentRequestsLoading
          : blockedLoading;

  // ── Filter ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((u) => {
      return (
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))
      );
    });
  }, [search, sourceList]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleAccept = async (id: number) => {
    setPendingId(id);
    await acceptRequest(id);
    setPendingId(null);
  };
  const showConfirm = (
    title: string,
    message: string,
    confirmText: string,
    variant: "danger" | "warning" | "default",
    action: () => Promise<void>
  ) => {
    setConfirmModal({ title, message, confirmText, variant, action });
  };

  const handleReject = (id: number) => {
    showConfirm(
      "Từ chối lời mời",
      "Bạn có chắc muốn từ chối lời mời kết bạn này?",
      "Từ chối",
      "warning",
      async () => {
        setPendingId(id);
        await rejectRequest(id);
        setPendingId(null);
      }
    );
  };
  const handleCancelSent = (id: number) => {
    if (!currentUser?.id) return;
    showConfirm(
      "Hủy lời mời đã gửi",
      "Bạn có chắc muốn hủy lời mời kết bạn đã gửi?",
      "Hủy lời mời",
      "warning",
      async () => {
        setPendingId(id);
        try {
          await cancelSentRequest(id);
        } finally {
          setPendingId(null);
        }
      }
    );
  };
  const handleUnfriend = (id: number, username: string) => {
    showConfirm(
      "Hủy kết bạn",
      `Bạn có chắc muốn hủy kết bạn với ${username}?`,
      "Hủy kết bạn",
      "danger",
      async () => {
        setPendingId(id);
        await unfriend(id);
        setPendingId(null);
      }
    );
  };
  const handleUnblock = (id: number, username: string) => {
    if (!currentUser?.id) return;
    showConfirm(
      "Bỏ chặn người dùng",
      `Bạn có chắc muốn bỏ chặn ${username}?`,
      "Bỏ chặn",
      "warning",
      async () => {
        setPendingId(id);
        try {
          const ok = await blockService.unblockUser(currentUser.id, id);
          if (ok) setBlocked((prev) => prev.filter((u) => u.id !== id));
        } finally {
          setPendingId(null);
        }
      }
    );
  };
  const refreshAll = () => {
    if (tab === "friends") refreshFriends();
    else if (tab === "requests") refreshFriendRequests();
    else if (tab === "sent") refreshSentRequests();
    else void loadBlocked();
  };

  // ── Row renderers ───────────────────────────────────────────────────
  const renderFriend = (u: User) => (
    <Link
      to={`/profile/${u.username}`}
      key={u.id}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
    >
      <Avatar
        user={u}
        online={Boolean(friendPresenceByUserId[Number(u.id)]?.online)}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] dark:text-white truncate">
          {u.fullName || u.name || u.username}
        </p>
        {u.username && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
            @{u.username}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          handleUnfriend(u.id, u.username);
        }}
        disabled={pendingId === u.id}
        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#363636] flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
        title="Hủy kết bạn"
      >
        {pendingId === u.id ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <UserMinus size={16} />
        )}
      </button>
    </Link>
  );

  const renderRequest = (u: User) => (
    <div
      key={u.id}
      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
    >
      <Link
        to={`/profile/${u.username}`}
        className="flex items-center gap-3 mb-3"
      >
        <Avatar user={u} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] dark:text-white truncate">
            {u.fullName || u.name || u.username}
          </p>
          {u.username && (
            <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
              @{u.username}
            </p>
          )}
        </div>
      </Link>
      <div className="flex gap-2 pl-15">
        <button
          onClick={() => handleAccept(u.id)}
          disabled={pendingId === u.id}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pendingId === u.id ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Check size={15} />
          )}
          Chấp nhận
        </button>
        <button
          onClick={() => handleReject(u.id)}
          disabled={pendingId === u.id}
          className="flex-1 h-9 px-4 bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#363636] text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Từ chối
        </button>
      </div>
    </div>
  );

  const renderSent = (u: User) => (
    <Link
      to={`/profile/${u.username}`}
      key={u.id}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
    >
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] dark:text-white truncate">
          {u.fullName || u.name || u.username}
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
          Đang chờ phản hồi
        </p>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          handleCancelSent(u.id);
        }}
        disabled={pendingId === u.id}
        className="h-9 px-4 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#363636] text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
      >
        {pendingId === u.id ? (
          <Loader2 className="animate-spin" size={15} />
        ) : (
          "Hủy"
        )}
      </button>
    </Link>
  );

  const renderBlocked = (u: User) => (
    <Link
      to={`/profile/${u.username}`}
      key={u.id}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
    >
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] dark:text-white truncate">
          {u.fullName || u.name || u.username}
        </p>
        {u.username && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
            @{u.username}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          handleUnblock(u.id, u.username);
        }}
        disabled={pendingId === u.id}
        className="h-9 px-4 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#363636] text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
      >
        {pendingId === u.id ? (
          <Loader2 className="animate-spin" size={15} />
        ) : (
          "Bỏ chặn"
        )}
      </button>
    </Link>
  );

  const renderItem = (u: User) => {
    switch (tab) {
      case "friends":
        return renderFriend(u);
      case "requests":
        return renderRequest(u);
      case "sent":
        return renderSent(u);
      case "blocked":
        return renderBlocked(u);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  const empty = EMPTY[tab];
  const EmptyIcon = empty.Icon;

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-black min-h-screen border-x border-gray-100 dark:border-[#262626]">
      {confirmModal && (
        <ConfirmModal
          open
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText="Hủy"
          variant={confirmModal.variant}
          onConfirm={async () => {
            const act = confirmModal.action;
            setConfirmModal(null);
            await act();
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-[#262626]">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold dark:text-white tracking-tight">
            Danh bạ
          </h1>
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#363636] flex items-center justify-center text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw
              size={16}
              className={isLoading ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* Tab chips */}
        <div className="px-2 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-1">
            {TABS.map((t) => {
              const active = tab === t.key;
              const count =
                t.key === "requests"
                  ? friendRequests.length
                  : t.key === "sent"
                    ? sentRequests.length
                    : t.key === "friends"
                      ? friends.length
                      : blocked.length;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setSearch("");
                  }}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#363636]"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-white dark:bg-[#363636] text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 h-9 px-3 bg-gray-100 dark:bg-[#262626] rounded-lg">
            <SearchIcon size={15} className="text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm trong danh sách"
              className="flex-1 bg-transparent outline-none text-sm dark:text-white placeholder-gray-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100 dark:divide-[#262626]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : filtered.length > 0 ? (
          <>
            {tab === "friends" && (
              <p className="px-4 py-2 text-[12px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {filtered.length} bạn bè
                {search && ` khớp "${search}"`}
              </p>
            )}
            {filtered.map((u) => renderItem(u))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-[#363636] flex items-center justify-center mb-4">
              <EmptyIcon size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-base font-semibold dark:text-white mb-1">
              {search ? "Không tìm thấy" : empty.title}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              {search ? "Thử từ khóa khác" : empty.sub}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
