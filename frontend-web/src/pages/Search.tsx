import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search as SearchIcon,
  X,
  Loader2,
  User as UserIcon,
  Flag,
  Users,
  Compass,
  CheckCircle2,
} from "lucide-react";
import userService from "../services/userService";
import pageService from "../services/pageService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useBlockNotifications } from "../hooks/useBlockNotifications";
import { useRealtimePageList } from "../hooks/useRealtimePageList";
import { buildS3Url } from "../utils/s3";
import type { User as UserType } from "../types";
import type { Page } from "../services/pageService";

type TabType = "all" | "users" | "pages";

const TABS: { key: TabType; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "users", label: "Người dùng" },
  { key: "pages", label: "Trang" },
];

type SearchItem =
  | { kind: "user"; data: UserType }
  | { kind: "page"; data: Page };

function buildMixedList(users: UserType[], pages: Page[]): SearchItem[] {
  const items: SearchItem[] = [];
  const maxLen = Math.max(users.length, pages.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < users.length) items.push({ kind: "user", data: users[i] });
    if (i < pages.length) items.push({ kind: "page", data: pages[i] });
  }
  return items;
}

export default function Search() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<TabType>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [allPages, setAllPages] = useState<Page[]>([]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load source data ────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId) return;
    try {
      const users = await userService.getAllUsersSearch(userId);
      setAllUsers(users.filter((u: UserType) => u.id !== userId));
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }, [currentUser?.id]);

  const loadPages = useCallback(async () => {
    try {
      const pages = await pageService.getAllPages();
      setAllPages(pages);
    } catch (err) {
      console.error("Error loading pages:", err);
    }
  }, []);

  const loadInitial = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadUsers(), loadPages()]);
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, loadUsers, loadPages]);

  useEffect(() => {
    void loadInitial();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block events affect ONLY the user list (filtered server-side).
  // Pages are unrelated to block events — don't refetch them.
  const blockTrigger = useBlockNotifications();
  useEffect(() => {
    if (blockTrigger > 0) void loadUsers();
  }, [blockTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time page list updates — patch state in place, no full refetch.
  useRealtimePageList({
    onPageCreated: (_id, page) => {
      if (!page) return;
      const np = page as unknown as Page;
      setAllPages((prev) => (prev.some((p) => p.id === np.id) ? prev : [np, ...prev]));
    },
    onPageUpdated: (_id, page) => {
      if (!page) return;
      const up = page as unknown as Page;
      setAllPages((prev) => prev.map((p) => (p.id === up.id ? { ...p, ...up } : p)));
    },
    onPageDeleted: (pageId) => {
      setAllPages((prev) => prev.filter((p) => p.id !== pageId));
    },
  });

  // ── Debounced query ─────────────────────────────────────────────────
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 250);
  };

  // ── Recent searches ─────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {}
    }
  }, []);
  const persistRecent = (next: string[]) => {
    setRecentSearches(next);
    localStorage.setItem("recentSearches", JSON.stringify(next));
  };
  const addRecent = (term: string) => {
    if (!term.trim()) return;
    persistRecent(
      [term, ...recentSearches.filter((s) => s !== term)].slice(0, 8),
    );
  };
  const removeRecent = (term: string) =>
    persistRecent(recentSearches.filter((s) => s !== term));
  const clearAllRecent = () => persistRecent([]);

  // ── Filter ──────────────────────────────────────────────────────────
  const q = debouncedQuery.trim().toLowerCase();
  const matchedUsers = useMemo(() => {
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)),
    );
  }, [allUsers, q]);
  const matchedPages = useMemo(() => {
    if (!q) return allPages;
    return allPages.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)),
    );
  }, [allPages, q]);

  const results: SearchItem[] =
    tab === "users"
      ? matchedUsers.map((u) => ({ kind: "user" as const, data: u }))
      : tab === "pages"
        ? matchedPages.map((p) => ({ kind: "page" as const, data: p }))
        : buildMixedList(matchedUsers, matchedPages);

  // ── Renderers ───────────────────────────────────────────────────────
  const renderItem = (item: SearchItem) => {
    if (item.kind === "user") {
      const u = item.data;
      const src =
        buildS3Url(u.avatarUrl) || u.avatarUrl || "https://i.pravatar.cc/150";
      return (
        <Link
          key={`user-${u.id}`}
          to={`/profile/${u.username}`}
          onClick={() => addRecent(u.username || u.name || u.fullName || "")}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <img
            src={src}
            alt={u.username}
            className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-[#262626] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] dark:text-white truncate">
              {u.fullName || u.name || u.username || u.phone}
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
              {u.username ? `@${u.username}` : u.phone}
              {u.bio ? ` · ${u.bio}` : ""}
            </p>
          </div>
          {tab === "all" && (
            <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#262626] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
              <UserIcon size={14} />
            </span>
          )}
        </Link>
      );
    }

    const p = item.data;
    const src =
      buildS3Url(p.avatarUrl) || p.avatarUrl || "https://i.pravatar.cc/150";
    return (
      <Link
        key={`page-${p.id}`}
        to={`/pages/${p.id}`}
        onClick={() => addRecent(p.name)}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
      >
        <img
          src={src}
          alt={p.name}
          className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-[#262626] shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-semibold text-[15px] dark:text-white truncate">
              {p.name}
            </p>
            {p.isVerified && (
              <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
            )}
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
            {p.username
              ? `@${p.username}${p.category ? ` · ${p.category}` : ""}`
              : p.category || "Trang"}
          </p>
        </div>
        {tab === "all" && (
          <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#262626] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
            <Flag size={14} />
          </span>
        )}
      </Link>
    );
  };

  const EMPTY: Record<TabType, { Icon: typeof Compass; text: string }> = {
    all: {
      Icon: Compass,
      text: query ? "Không tìm thấy kết quả" : "Chưa có dữ liệu",
    },
    users: {
      Icon: Users,
      text: query ? "Không tìm thấy người dùng" : "Chưa có người dùng",
    },
    pages: {
      Icon: Flag,
      text: query ? "Không tìm thấy trang" : "Chưa có trang nào",
    },
  };
  const empty = EMPTY[tab];
  const EmptyIcon = empty.Icon;

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-black min-h-screen border-x border-gray-100 dark:border-[#262626]">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-[#262626]">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold dark:text-white tracking-tight">
            Khám phá
          </h1>
        </div>

        {/* Tab chips */}
        <div className="px-2 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-1">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
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

        {/* Search bar */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 h-9 px-3 bg-gray-100 dark:bg-[#262626] rounded-lg">
            <SearchIcon size={15} className="text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={
                tab === "users"
                  ? "Tìm kiếm người dùng..."
                  : tab === "pages"
                    ? "Tìm kiếm trang..."
                    : "Tìm kiếm người dùng, trang..."
              }
              className="flex-1 bg-transparent outline-none text-sm dark:text-white placeholder-gray-500"
              autoCapitalize="none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Recent searches (only when no query) */}
        {!query && !loading && recentSearches.length > 0 && (
          <div className="border-b border-gray-100 dark:border-[#262626]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-[12px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                Tìm kiếm gần đây
              </p>
              <button
                onClick={clearAllRecent}
                className="text-[13px] text-blue-500 hover:text-blue-700 font-semibold"
              >
                Xóa tất cả
              </button>
            </div>
            <div className="pb-2">
              {recentSearches.map((term) => (
                <div
                  key={term}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
                >
                  <button
                    onClick={() => {
                      setQuery(term);
                      setDebouncedQuery(term);
                    }}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#262626] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                      <SearchIcon size={15} />
                    </span>
                    <span className="text-sm dark:text-white truncate">
                      {term}
                    </span>
                  </button>
                  <button
                    onClick={() => removeRecent(term)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-500 mb-2" size={28} />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Đang tải...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-8 text-sm text-red-500">{error}</div>
        )}

        {/* Result count */}
        {!loading && !error && results.length > 0 && (
          <p className="px-4 py-2 text-[12px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {results.length} kết quả{query ? ` cho "${query}"` : ""}
          </p>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-[#262626]">
            {results.map((item) => renderItem(item))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-[#363636] flex items-center justify-center mb-4">
              <EmptyIcon size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-base font-semibold dark:text-white mb-1">
              {empty.text}
            </p>
            {query && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Thử từ khóa khác
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
