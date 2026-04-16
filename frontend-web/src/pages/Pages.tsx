import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Loader2, Users, Heart, Globe, Building2 } from "lucide-react";
import pageService, { type Page } from "../services/pageService";
import { buildS3Url } from "../utils/s3";

type TabType = "all" | "my-pages";

export default function Pages() {
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const loadPages = useCallback(async () => {
        setLoading(true);
        try {
            const data = activeTab === "all" 
                ? await pageService.getAllPages()
                : await pageService.getMyPages();
            setPages(data || []);
        } catch (error) {
            console.error("Error loading pages:", error);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadPages();
    }, [loadPages]);

    const filteredPages = pages.filter(page => 
        page.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold dark:text-white">Pages</h1>
                <Link
                    to="/pages/create"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    <Plus size={20} />
                    <span>Tạo Page</span>
                </Link>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Tìm kiếm pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-[#262626] border-none rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-[#363636]">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                        activeTab === "all"
                            ? "text-blue-500 border-b-2 border-blue-500"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    Tất cả Pages
                </button>
                <button
                    onClick={() => setActiveTab("my-pages")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                        activeTab === "my-pages"
                            ? "text-blue-500 border-b-2 border-blue-500"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    Pages của tôi
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredPages.length === 0 && (
                <div className="text-center py-12">
                    <Building2 className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={64} />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {searchQuery 
                            ? "Không tìm thấy page nào" 
                            : activeTab === "my-pages" 
                                ? "Bạn chưa tạo page nào" 
                                : "Chưa có page nào"}
                    </p>
                    {activeTab === "my-pages" && !searchQuery && (
                        <Link
                            to="/pages/create"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            <Plus size={20} />
                            Tạo Page đầu tiên
                        </Link>
                    )}
                </div>
            )}

            {/* Pages Grid */}
            {!loading && filteredPages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredPages.map((page) => (
                        <Link
                            key={page.id}
                            to={`/pages/${page.id}`}
                            className="flex gap-4 p-4 bg-white dark:bg-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors border border-gray-200 dark:border-[#363636]"
                        >
                            {/* Avatar */}
                            <img
                                src={buildS3Url(page.avatarUrl) || "https://via.placeholder.com/80"}
                                alt={page.name}
                                className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                            />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold dark:text-white truncate">
                                        {page.name}
                                    </h3>
                                    {page.isVerified && (
                                        <span className="text-blue-500">✓</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    @{page.username}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Globe size={14} />
                                        {page.category}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
