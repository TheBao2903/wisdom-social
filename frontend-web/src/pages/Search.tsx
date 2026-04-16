import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X, Loader2 } from "lucide-react";
import userService from "../services/userService";
import pageService from "../services/pageService";
import friendService from "../services/friendService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";
import type { User } from "../types";
import type { Page } from "../services/pageService";

type SearchItem =
    | { kind: "user"; data: User }
    | { kind: "page"; data: Page };

export default function Search() {
    const currentUser = useCurrentUser();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allPages, setAllPages] = useState<Page[]>([]);
    const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Build mixed list (alternate between users and pages)
    const buildMixedList = useCallback((users: User[], pages: Page[]): SearchItem[] => {
        const items: SearchItem[] = [];
        const maxLen = Math.max(users.length, pages.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < users.length) items.push({ kind: "user", data: users[i] });
            if (i < pages.length) items.push({ kind: "page", data: pages[i] });
        }
        return items;
    }, []);

    // Load all users and pages on mount
    const loadData = useCallback(async () => {
        const userId = currentUser?.id;
        if (!userId) return;

        setLoading(true);
        try {
            const [users, pages, blockedUsers] = await Promise.all([
                userService.getAllUsersSearch(currentUser?.id),
                pageService.getAllPages(),
                friendService.getBlockedUsers(userId),
            ]);

            // Create set of blocked user IDs for quick lookup
            const blockedIds = new Set(blockedUsers.map((u: User) => u.id));
            setBlockedUserIds(blockedIds);

            // Filter out current user and blocked users
            const filteredUsers = users.filter(
                (u: User) => u.id !== userId && !blockedIds.has(u.id)
            );

            setAllUsers(filteredUsers);
            setAllPages(pages);
            setResults(buildMixedList(filteredUsers, pages));
        } catch (err: any) {
            console.error("Error loading data:", err);
            setError("Không thể tải dữ liệu.");
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id, buildMixedList]);

    useEffect(() => {
        loadData();
    }, [currentUser?.id]);

    // Handle search with debounce
    const handleSearch = (text: string) => {
        setQuery(text);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const q = text.trim().toLowerCase();

            if (!q) {
                setResults(buildMixedList(allUsers, allPages));
                setError("");
                return;
            }

            // Filter users by name, username, or phone
            const matchedUsers = allUsers.filter(
                (u) =>
                    (u.name && u.name.toLowerCase().includes(q)) ||
                    (u.username && u.username.toLowerCase().includes(q)) ||
                    (u.phone && u.phone.includes(q))
            );

            // Filter pages by name, username, or category
            const matchedPages = allPages.filter(
                (p) =>
                    (p.name && p.name.toLowerCase().includes(q)) ||
                    (p.username && p.username?.toLowerCase().includes(q)) ||
                    (p.category && p.category.toLowerCase().includes(q))
            );

            setResults(buildMixedList(matchedUsers, matchedPages));
            setError("");
        }, 250);
    };

    const handleClearQuery = () => {
        setQuery("");
        setResults(buildMixedList(allUsers, allPages));
        setError("");
    };

    const addRecentSearch = (searchTerm: string) => {
        const updated = [searchTerm, ...recentSearches.filter((s) => s !== searchTerm)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem("recentSearches", JSON.stringify(updated));
    };

    const clearAllRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem("recentSearches");
    };

    const removeRecentSearch = (term: string) => {
        const updated = recentSearches.filter((s) => s !== term);
        setRecentSearches(updated);
        localStorage.setItem("recentSearches", JSON.stringify(updated));
    };

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("recentSearches");
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch {}
        }
    }, []);

    const handleSelectRecent = (term: string) => {
        setQuery(term);
        addRecentSearch(term);
    };

    const renderItem = (item: SearchItem) => {
        if (item.kind === "user") {
            const u = item.data;
            return (
                <Link
                    key={`user-${u.id}`}
                    to={`/profile/${u.username}`}
                    onClick={() => addRecentSearch(u.username)}
                    className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                >
                    <img
                        src={buildS3Url(u.avatarUrl) || "https://i.pravatar.cc/150"}
                        alt={u.username}
                        className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate dark:text-white">
                            {u.name || u.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            @{u.username}
                        </p>
                        {u.bio && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                                {u.bio}
                            </p>
                        )}
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center">
                        <SearchIcon size={14} className="text-gray-400" />
                    </div>
                </Link>
            );
        }

        const p = item.data;
        return (
            <Link
                key={`page-${p.id}`}
                to={`/page/${p.id}`}
                onClick={() => addRecentSearch(p.name)}
                className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
            >
                <img
                    src={buildS3Url(p.avatarUrl) || "https://i.pravatar.cc/150"}
                    alt={p.name}
                    className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate dark:text-white">
                        {p.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        @{p.username}
                    </p>
                    {p.category && (
                        <div className="mt-1">
                            <span className="inline-block text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                {p.category}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center">
                    <SearchIcon size={14} className="text-gray-400" />
                </div>
            </Link>
        );
    };

    return (
        <div className="max-w-[600px] mx-auto bg-white dark:bg-[#000] border-r border-gray-200 dark:border-[#262626] min-h-screen">
            {/* Search Header */}
            <div className="sticky top-0 bg-white dark:bg-[#000] border-b border-gray-200 dark:border-[#262626] p-4 z-10">
                <h1 className="text-2xl font-semibold mb-6 dark:text-white">
                    Tìm kiếm
                </h1>

                {/* Search Input */}
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <SearchIcon size={16} />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm kiếm người dùng, trang..."
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-[#262626] rounded-lg outline-none text-sm dark:text-white placeholder-gray-500 border border-gray-300 dark:border-[#363636]"
                    />
                    {query && (
                        <button
                            onClick={handleClearQuery}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {!query ? (
                    <>
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h2 className="text-base font-semibold dark:text-white">
                                        Tìm kiếm gần đây
                                    </h2>
                                    <button
                                        onClick={clearAllRecent}
                                        className="text-sm text-[#0095f6] hover:text-[#00376b] dark:text-[#3b82f6] dark:hover:text-[#60a5fa] font-semibold"
                                    >
                                        Xóa tất cả
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {recentSearches.map((search, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded"
                                        >
                                            <button
                                                onClick={() => handleSelectRecent(search)}
                                                className="flex items-center gap-3 flex-1 text-left"
                                            >
                                                <div className="w-9 h-9 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center flex-shrink-0">
                                                    <SearchIcon
                                                        size={16}
                                                        className="text-gray-500 dark:text-gray-400"
                                                    />
                                                </div>
                                                <span className="text-sm dark:text-white truncate">
                                                    {search}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => removeRecentSearch(search)}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Result Count */}
                        {!loading && results.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mb-4">
                                {results.length} kết quả cho "{query}"
                            </p>
                        )}

                        {/* Loading State */}
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="animate-spin text-gray-400 mb-2" size={32} />
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Đang tải...
                                </p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !loading && (
                            <div className="text-center py-8">
                                <p className="text-sm text-red-500">{error}</p>
                            </div>
                        )}

                        {/* Search Results */}
                        {!loading && !error && results.length > 0 && (
                            <div className="space-y-1">
                                {results.map((item) => renderItem(item))}
                            </div>
                        )}

                        {/* Empty State */}
                        {!loading && !error && query && results.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-[#262626] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <SearchIcon size={32} className="text-gray-400" />
                                </div>
                                <p className="text-sm font-semibold dark:text-white mb-1">
                                    Không tìm thấy kết quả
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Thử từ khóa khác
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
