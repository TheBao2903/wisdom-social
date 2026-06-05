import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Loader2,
  Flag,
  X,
  Lock,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  Check,
  ThumbsUp,
} from "lucide-react";
import pageService, { type Page } from "../services/pageService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";
import { useRealtimePageList } from "../hooks/useRealtimePageList";

type TabType = "discover" | "my-pages";

type PageWithMeta = Page & {
  memberCount?: number;
  followCount?: number;
  userRole?: string;
};

const ROLE_CONFIG: Record<
  string,
  { label: string; cls: string }
> = {
  OWNER: {
    label: "Chủ sở hữu",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  ADMIN: {
    label: "Quản trị viên",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  MODERATOR: {
    label: "Kiểm duyệt viên",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

const TABS: { key: TabType; label: string }[] = [
  { key: "discover", label: "Khám phá" },
  { key: "my-pages", label: "Pages của tôi" },
];

const GRADIENT_COVER =
  "bg-gradient-to-br from-[#1a73e8] to-[#0d47a1]";

export default function Pages() {
  const currentUser = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabType>("discover");
  const [pages, setPages] = useState<PageWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [followingId, setFollowingId] = useState<number | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [likingId, setLikingId] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const loadSeqRef = useRef(0);

  const loadPages = useCallback(async () => {
    // Guard against stale/concurrent runs (e.g. fast tab switches): only the
    // latest run is allowed to commit its results.
    const seq = ++loadSeqRef.current;
    const isStale = () => seq !== loadSeqRef.current;
    setLoading(true);
    try {
      const data =
        activeTab === "discover"
          ? await pageService.getAllPages()
          : await pageService.getMyPages();
      if (isStale()) return;
      const list = (data as PageWithMeta[]) || [];
      setPages(list);

      // Like/follow state is embedded on each page by the backend (/page/all),
      // so seed the optimistic-update Sets directly from the list — no per-page
      // interaction-status calls, and correct regardless of currentUser timing.
      if (activeTab === "discover") {
        const liked = new Set<number>();
        const followed = new Set<number>();
        list.forEach((p) => {
          if (p.isLiked) liked.add(p.id);
          if (p.isFollowing) followed.add(p.id);
        });
        setLikedIds(liked);
        setFollowedIds(followed);
      } else {
        setLikedIds(new Set());
        setFollowedIds(new Set());
      }
    } catch (err) {
      console.error("Error loading pages:", err);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  // Real-time updates
  useRealtimePageList({
    onPageCreated: (_pageId, page) => {
      if (page) {
        setPages((prev) => {
          const np = page as unknown as PageWithMeta;
          if (prev.some((p) => p.id === np.id)) return prev;
          return [np, ...prev];
        });
      } else {
        void loadPages();
      }
    },
    onPageDeleted: (pageId) => {
      setPages((prev) => prev.filter((p) => p.id !== pageId));
    },
    onPageUpdated: (pageId, page) => {
      if (page) {
        const up = page as unknown as PageWithMeta;
        setPages((prev) => prev.map((p) => (p.id === up.id ? { ...p, ...up } : p)));
      } else {
        pageService
          .getPageById(pageId)
          .then((fresh) =>
            setPages((prev) =>
              prev.map((p) => (p.id === fresh.id ? (fresh as PageWithMeta) : p)),
            ),
          )
          .catch(() => {});
      }
    },
  });

  const filteredPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q),
    );
  }, [pages, searchQuery]);

  const handleFollow = async (page: PageWithMeta) => {
    if (!currentUser?.id || followingId) return;
    const uid = Number(currentUser.id);
    const wasFollowing = followedIds.has(page.id);
    setFollowingId(page.id);
    try {
      if (wasFollowing) {
        await pageService.cancelFollowPage(uid, page.id);
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(page.id);
          return next;
        });
      } else {
        await pageService.followPage(uid, page.id);
        setFollowedIds((prev) => new Set(prev).add(page.id));
      }
    } catch (err) {
      console.error("Follow page error:", err);
    } finally {
      setFollowingId(null);
    }
  };

  const handleLike = async (page: PageWithMeta) => {
    if (!currentUser?.id || likingId) return;
    const uid = Number(currentUser.id);
    const wasLiked = likedIds.has(page.id);
    setLikingId(page.id);
    try {
      if (wasLiked) {
        await pageService.cancelLikePage(uid, page.id);
        setLikedIds((prev) => {
          const next = new Set(prev);
          next.delete(page.id);
          return next;
        });
      } else {
        await pageService.likePage(uid, page.id);
        setLikedIds((prev) => new Set(prev).add(page.id));
      }
    } catch (err) {
      console.error("Like page error:", err);
    } finally {
      setLikingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-black min-h-screen border-x border-gray-100 dark:border-[#262626]">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-[#262626]">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold dark:text-white tracking-tight">
            Pages
          </h1>
          {activeTab === "discover" && (
            <Link
              to="/pages/create"
              className="inline-flex items-center gap-1.5 h-9 px-3 bg-blue-500 hover:bg-blue-600 text-white! rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus size={16} className="text-white" /> Tạo
            </Link>
          )}
        </div>

        {/* Tab chips */}
        <div className="px-2 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-1">
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key);
                    setSearchQuery("");
                  }}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#363636]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 h-9 px-3 bg-gray-100 dark:bg-[#262626] rounded-lg">
            <Search size={15} className="text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm Pages..."
              className="flex-1 bg-transparent outline-none text-sm dark:text-white placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : activeTab === "discover" ? (
        <div className="p-3 space-y-3">
          {filteredPages.length > 0 ? (
            filteredPages.map((p) => (
              <DiscoverCard
                key={p.id}
                page={p}
                followed={followedIds.has(p.id)}
                following={followingId === p.id}
                onFollow={() => handleFollow(p)}
                liked={likedIds.has(p.id)}
                liking={likingId === p.id}
                onLike={() => handleLike(p)}
              />
            ))
          ) : (
            <EmptyState
              tab="discover"
              hasQuery={!!searchQuery}
            />
          )}
        </div>
      ) : (
        <div>
          {/* Create page row at top */}
          {filteredPages.length > 0 && (
            <Link
              to="/pages/create"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors border-b border-gray-100 dark:border-[#262626]"
            >
              <span className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center shrink-0">
                <Plus size={20} />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-blue-500">
                Tạo trang mới
              </span>
              <ChevronRight size={18} className="text-gray-400" />
            </Link>
          )}

          {filteredPages.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-[#262626]">
              {filteredPages.map((p) => (
                <MyPageRow key={p.id} page={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              tab="my-pages"
              hasQuery={!!searchQuery}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Discover card: cover + avatar overlap + follow button ──────────────
function DiscoverCard({
  page,
  followed,
  following,
  onFollow,
  liked,
  liking,
  onLike,
}: {
  page: PageWithMeta;
  followed: boolean;
  following: boolean;
  onFollow: () => void;
  liked: boolean;
  liking: boolean;
  onLike: () => void;
}) {
  const coverUrl = buildS3Url(page.coverUrl);
  const avatarUrl = buildS3Url(page.avatarUrl);
  return (
    <Link
      to={`/pages/${page.id}`}
      className="block bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-[#262626] rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Cover */}
      <div className={`relative h-32 md:h-36 ${coverUrl ? "" : GRADIENT_COVER}`}>
        {coverUrl && (
          <img
            src={`${coverUrl}?t=${page.updatedAt}`}
            alt={page.name}
            className="w-full h-full object-cover"
          />
        )}
        {page.status === "PRIVATE" && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white text-[11px] font-semibold">
            <Lock size={10} /> Riêng tư
          </span>
        )}
      </div>

      {/* Info row */}
      <div className="flex items-end gap-3 px-4 pb-3 pr-4">
        {/* Avatar overlapping cover */}
        <div className="-mt-6 shrink-0">
          {avatarUrl ? (
            <img
              src={`${avatarUrl}?t=${page.updatedAt}`}
              alt={page.name}
              className="w-14 h-14 rounded-full object-cover border-[3px] border-white dark:border-[#0f0f0f]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/40 border-[3px] border-white dark:border-[#0f0f0f] flex items-center justify-center text-blue-500">
              <Flag size={20} />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-2">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[15px] font-bold dark:text-white truncate">
              {page.name}
            </p>
            {page.isVerified && (
              <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
            )}
          </div>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {page.category || "Trang"}
            {page.memberCount && page.memberCount > 0
              ? ` · ${page.memberCount.toLocaleString()} thành viên`
              : ""}
          </p>
        </div>

        {/* Like + Follow buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Like (toggle) */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!liking) onLike();
            }}
            disabled={liking}
            title={liked ? "Bỏ thích" : "Thích"}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
              liked
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                : "bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#363636]"
            }`}
          >
            {liking ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <ThumbsUp size={14} fill={liked ? "currentColor" : "none"} />
            )}
            {liked ? "Đã thích" : "Thích"}
          </button>

          {/* Follow (toggle) */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!following) onFollow();
            }}
            disabled={following}
            title={followed ? "Bỏ theo dõi" : "Theo dõi"}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
              followed
                ? "bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#363636]"
                : "bg-blue-50 dark:bg-blue-900/30 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            }`}
          >
            {following ? (
              <Loader2 className="animate-spin" size={14} />
            ) : followed ? (
              <Check size={14} />
            ) : (
              <UserPlus size={14} />
            )}
            {followed ? "Đã theo dõi" : "Theo dõi"}
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── My pages compact row ──────────────────────────────────────────────
function MyPageRow({ page }: { page: PageWithMeta }) {
  const coverUrl = buildS3Url(page.coverUrl);
  const avatarUrl = buildS3Url(page.avatarUrl);
  const role = page.userRole ? ROLE_CONFIG[page.userRole] : null;

  return (
    <Link
      to={`/pages/${page.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
    >
      {/* Cover thumb + avatar overlay */}
      <div className="relative w-18 h-13 shrink-0">
        {coverUrl ? (
          <img
            src={`${coverUrl}?t=${page.updatedAt}`}
            alt={page.name}
            className="w-full h-full rounded-lg object-cover"
          />
        ) : (
          <div className={`w-full h-full rounded-lg ${GRADIENT_COVER}`} />
        )}
        <div className="absolute -bottom-2 -left-1">
          {avatarUrl ? (
            <img
              src={`${avatarUrl}?t=${page.updatedAt}`}
              alt={page.name}
              className="w-7 h-7 rounded-full object-cover border-2 border-white dark:border-black"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/40 border-2 border-white dark:border-black flex items-center justify-center text-blue-500">
              <Flag size={11} />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-[15px] font-bold dark:text-white truncate">
            {page.name}
          </p>
          {page.isVerified && (
            <CheckCircle2 size={13} className="text-blue-500 shrink-0" />
          )}
        </div>
        {page.category && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {page.category}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {role && (
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${role.cls}`}
            >
              {role.label}
            </span>
          )}
          {page.status === "PRIVATE" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <Lock size={10} /> Riêng tư
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={18} className="text-gray-400 shrink-0" />
    </Link>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────
function EmptyState({
  tab,
  hasQuery,
}: {
  tab: TabType;
  hasQuery: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-[#363636] flex items-center justify-center mb-4">
        <Flag size={28} className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-base font-semibold dark:text-white mb-1">
        {hasQuery
          ? "Không tìm thấy"
          : tab === "discover"
            ? "Chưa có trang nào"
            : "Bạn chưa quản lý trang nào"}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        {hasQuery
          ? "Thử từ khóa khác"
          : tab === "discover"
            ? "Hãy quay lại sau hoặc tạo trang của bạn"
            : "Tạo trang để kết nối cộng đồng của bạn"}
      </p>
      {tab === "my-pages" && !hasQuery && (
        <Link
          to="/pages/create"
          className="mt-5 inline-flex items-center gap-2 h-10 px-5 bg-blue-500 hover:bg-blue-600 text-white! rounded-full text-sm font-semibold transition-colors"
        >
          <Plus size={16} className="text-white" /> Tạo trang mới
        </Link>
      )}
    </div>
  );
}
